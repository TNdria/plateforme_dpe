import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { FileText, Target, ShieldCheck, Activity, Sparkles, Building2 } from 'lucide-react';
import { dashboardApi, Dren, Cisco } from '@/services/api';
import { supabase } from '@/integrations/supabase/client';
import { useDiagnosticDataset } from '@/hooks/useDiagnosticDataset';
import DiagnosticFilters from '@/components/diagnostic/DiagnosticFilters';
import DiagnosticTextView from '@/components/diagnostic/DiagnosticTextView';
import { exportDiagnosticToPDF, exportDiagnosticToDocx } from '@/utils/diagnosticExport';
import DataActionsBar from '@/components/admin/DataActionsBar';
import logoMen from '@/assets/logoMen.jpg';
import logoDpe from '@/assets/logoDpe.jpg';
import { Badge } from '@/components/ui/badge';

interface DiagnosticResult {
  diagnostic: string; drenName: string; ciscoName: string;
  niveau: string; annee: string; generatedAt: string;
}

const nf = (v: any) => (v === null || v === undefined ? '—' : new Intl.NumberFormat('fr-FR').format(Number(v)));
const pct = (v: any) => (v === null || v === undefined ? '—' : `${Number(v).toFixed(1)} %`);
const rat = (v: any) => (v === null || v === undefined ? '—' : Number(v).toFixed(2));

const LEVELS = [
  { key: 'presco', label: 'Préscolaire' },
  { key: 'primaire', label: 'Primaire' },
  { key: 'college', label: 'Collège' },
  { key: 'lycee', label: 'Lycée' },
] as const;

const Table = ({ head, rows }: { head: string[]; rows: (string | number)[][] }) => (
  <div className="overflow-x-auto rounded-lg border border-border">
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">Tableau statistique</caption>
      <thead className="sticky top-0 z-10">
        <tr className="bg-primary text-primary-foreground">
          {head.map((h, i) => (
            <th
              key={i}
              scope="col"
              className={`border-b-2 border-secondary px-3 py-2 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap ${i === 0 ? 'text-left' : 'text-right'}`}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={`transition-colors hover:bg-primary/5 ${i % 2 ? 'bg-muted/40' : 'bg-card'}`}>
            {r.map((c, j) => (
              <td
                key={j}
                className={`border-t border-border/60 px-3 py-1.5 ${
                  j === 0
                    ? 'font-medium text-foreground border-r border-border/60'
                    : 'text-right tabular-nums text-foreground/90'
                }`}
              >
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Block = ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
  <Card className="overflow-hidden border-border shadow-sm transition-shadow hover:shadow-md">
    <CardHeader className="gap-1 border-b border-border bg-primary/5 pb-2">
      <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
        <span className="h-4 w-1 rounded-full bg-primary" />
        {title}
      </CardTitle>
      {subtitle && <p className="text-xs italic leading-relaxed text-muted-foreground">{subtitle}</p>}
    </CardHeader>
    <CardContent className="pt-4">{children}</CardContent>
  </Card>
);

const Kpi = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className="group relative overflow-hidden rounded-lg border border-border bg-card p-3 pl-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
    <span className="absolute inset-y-0 left-0 w-1 bg-primary" />
    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="mt-0.5 text-xl font-bold tabular-nums text-primary">{value}</p>
    {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
  </div>
);

const Diagnostic = () => {
  const [drens, setDrens] = useState<Dren[]>([]);
  const [ciscos, setCiscos] = useState<Cisco[]>([]);
  const [selectedDren, setSelectedDren] = useState('0');
  const [selectedCisco, setSelectedCisco] = useState('0');
  const [selectedAnnee, setSelectedAnnee] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [activeTab, setActiveTab] = useState('monographie');

  const { dataset, loading: statsLoading } = useDiagnosticDataset(Number(selectedDren), Number(selectedCisco));

  useEffect(() => { dashboardApi.getDrens().then(setDrens).catch(() => {}); }, []);

  const years = dataset?.years ?? [];
  const annee = useMemo(() => {
    if (selectedAnnee && dataset?.annees?.[selectedAnnee]) return selectedAnnee;
    return years.length ? String(years[years.length - 1]) : '';
  }, [selectedAnnee, dataset, years]);

  const cur = dataset?.annees?.[annee];
  const ind = dataset?.indicateurs?.[annee];

  const handleDrenChange = async (value: string) => {
    setSelectedDren(value); setSelectedCisco('0'); setDiagnosticResult(null);
    if (value !== '0') {
      try { setLoading(true); setCiscos(await dashboardApi.getCiscos(Number(value))); }
      catch { toast.error('Erreur lors du chargement des CISCOs'); }
      finally { setLoading(false); }
    } else setCiscos([]);
  };

  const handleGenerateDiagnostic = async () => {
    if (!dataset) { toast.error('Données non chargées'); return; }
    setGenerating(true); setDiagnosticResult(null); setActiveTab('diagnostic');
    try {
      const drenName = drens.find(d => d.CODE_DREN === Number(selectedDren))?.DREN || '';
      const ciscoName = ciscos.find(c => c.CODE_CISCO === Number(selectedCisco))?.CISCO || '';
      const { data, error } = await supabase.functions.invoke('ai-diagnostic', {
        body: { dataset, drenName, ciscoName, annee },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setDiagnosticResult(data as DiagnosticResult);
      toast.success('Diagnostic généré selon le plan officiel du MEN');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Erreur lors de la génération du diagnostic');
    } finally { setGenerating(false); }
  };

  const evo = (get: (y: string) => any) => years.map((y) => get(String(y)));

  const drenLabel = drens.find(d => d.CODE_DREN === Number(selectedDren))?.DREN || '';
  const ciscoLabel = ciscos.find(c => c.CODE_CISCO === Number(selectedCisco))?.CISCO || '';
  const scopeLabel = ciscoLabel ? `CISCO ${ciscoLabel}` : drenLabel ? `DREN ${drenLabel}` : 'Niveau national — Madagascar';

  const totalLevels = (path: any) => LEVELS.reduce((s, l) => s + (Number(path?.[l.key]?.total) || 0), 0);

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="relative border-b border-border bg-card/90 px-4 py-3 backdrop-blur">
        <div className="absolute inset-x-0 top-0 flex h-1">
          <span className="h-full flex-[6] bg-primary" />
          <span className="h-full flex-1 bg-secondary" />
          <span className="h-full flex-1 bg-destructive" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={logoMen} alt="Logo Ministère de l'Éducation Nationale" className="h-12 w-12 rounded-lg object-contain bg-card p-0.5 shadow-sm ring-1 ring-secondary/30" />
            <div className="leading-tight">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Ministère de l'Éducation Nationale — Direction de la Planification de l'Éducation
              </p>
              <h1 className="flex items-center gap-2 text-base font-bold uppercase tracking-wide text-primary">
                <FileText className="h-4 w-4 text-primary" />
                Diagnostic du système éducatif
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge className="bg-primary text-primary-foreground hover:bg-primary/90 text-[10px]">{scopeLabel}</Badge>
                <Badge variant="outline" className="border-secondary/50 text-[10px] text-secondary">Année {annee || '—'}</Badge>
                <Badge variant="outline" className="border-border text-[10px] text-muted-foreground">Plan officiel MEN</Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DataActionsBar table="fpe_a1" tableLabel="Données diagnostic" compact />
            <img src={logoDpe} alt="Logo DPE" className="hidden h-12 w-12 rounded-lg object-contain bg-card p-0.5 shadow-sm ring-1 ring-primary/20 md:block" />
          </div>
        </div>
      </div>


      <div className="border-b border-border bg-muted/30 p-4">
        <div className="rounded-lg border border-border bg-card p-3 shadow-sm">

          <DiagnosticFilters
            drens={drens} ciscos={ciscos}
            selectedDren={selectedDren} selectedCisco={selectedCisco}
            selectedSecteur="2" selectedAnnee={annee}
            generating={generating} loading={loading} statsLoading={statsLoading}
            hasDiagnostic={!!diagnosticResult}
            onDrenChange={handleDrenChange} onCiscoChange={(v) => { setSelectedCisco(v); setDiagnosticResult(null); }}
            onSecteurChange={() => {}} onAnneeChange={setSelectedAnnee}
            onGenerate={handleGenerateDiagnostic}
            onExportPDF={() => { if (diagnosticResult) exportDiagnosticToPDF(diagnosticResult); }}
            onExportDocx={() => { if (diagnosticResult) exportDiagnosticToDocx(diagnosticResult); }}
          />
        </div>
        {cur && (
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
            <Kpi label="Établissements" value={nf(totalLevels(cur?.etablissements))} hint="tous niveaux" />
            <Kpi label="Salles de classe" value={nf(totalLevels(cur?.salles))} hint="tous niveaux" />
            <Kpi label="Élèves" value={nf(totalLevels(cur?.eleves))} hint="tous niveaux" />
            <Kpi label="Enseignants" value={nf(totalLevels(cur?.enseignants))} hint="tous niveaux" />
            <Kpi label="TBS Primaire" value={pct(ind?.couverture?.tbsPrimaire)} hint="cible 100 %" />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="border-b border-border bg-card px-4 pt-2">
            <TabsList className="h-auto flex-wrap gap-1 bg-muted/60 p-1">
              {[
                { v: 'monographie', i: <Building2 className="h-3.5 w-3.5" />, l: 'Monographie' },
                { v: 'couverture', i: <Target className="h-3.5 w-3.5" />, l: 'I. Couverture' },
                { v: 'efficacite', i: <Activity className="h-3.5 w-3.5" />, l: 'II. Efficacité interne' },
                { v: 'qualite', i: <ShieldCheck className="h-3.5 w-3.5" />, l: 'III. Qualité' },
                { v: 'diagnostic', i: <Sparkles className="h-3.5 w-3.5" />, l: 'Document IA' },
              ].map((t) => (
                <TabsTrigger
                  key={t.v}
                  value={t.v}
                  className="gap-1.5 text-xs transition-colors data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                >
                  {t.i}{t.l}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="monographie" className="flex-1 overflow-hidden m-0">
            <ScrollArea className="h-full"><div className="p-4 space-y-4">
              <Block title="Population scolarisable" subtitle={dataset?.population?.source}>
                <Table head={['Groupe', 'Effectif']} rows={[
                  ['Population totale', nf(dataset?.population?.total)],
                  ['3-5 ans (préscolaire)', nf(dataset?.population?.p3_5)],
                  ['6-10 ans (primaire)', nf(dataset?.population?.p6_10)],
                  ['11-14 ans (collège)', nf(dataset?.population?.p11_14)],
                  ['15-17 ans (lycée)', nf(dataset?.population?.p15_17)],
                ]} />
              </Block>
              <Block title={`Tableau monographique — année ${annee || '—'}`}>
                <Table head={['Rubrique', ...LEVELS.map(l => l.label)]} rows={[
                  ['Établissements', ...LEVELS.map(l => nf(cur?.etablissements?.[l.key]?.total))],
                  ['Salles de classe', ...LEVELS.map(l => nf(cur?.salles?.[l.key]?.total))],
                  ['Effectif élèves', ...LEVELS.map(l => nf(cur?.eleves?.[l.key]?.total))],
                  ['dont filles', ...LEVELS.map(l => nf(cur?.eleves?.[l.key]?.filles))],
                  ['Enseignants', ...LEVELS.map(l => nf(cur?.enseignants?.[l.key]?.total))],
                  ['Places assises', ...LEVELS.map(l => nf(cur?.places?.[l.key]?.total))],
                ]} />
              </Block>
            </div></ScrollArea>
          </TabsContent>

          <TabsContent value="couverture" className="flex-1 overflow-hidden m-0">
            <ScrollArea className="h-full"><div className="p-4 space-y-4">
              <Block title="Évolution des taux de couverture" subtitle="TBS = effectif du niveau / population scolarisable × 100 ; TBA = (effectif classe d'entrée − redoublants) / population de l'âge légal × 100">
                <Table head={['Indicateur', ...years.map(String)]} rows={[
                  ['Taux de préscolarisation', ...evo(y => pct(dataset?.indicateurs?.[y]?.couverture?.tauxPrescolarisation))],
                  ['TBS Primaire', ...evo(y => pct(dataset?.indicateurs?.[y]?.couverture?.tbsPrimaire))],
                  ['TBA Primaire (11ème)', ...evo(y => pct(dataset?.indicateurs?.[y]?.couverture?.tbaPrimaire))],
                  ['TBS Collège', ...evo(y => pct(dataset?.indicateurs?.[y]?.couverture?.tbsCollege))],
                  ['TBA Collège (6ème)', ...evo(y => pct(dataset?.indicateurs?.[y]?.couverture?.tbaCollege))],
                  ['TBS Lycée', ...evo(y => pct(dataset?.indicateurs?.[y]?.couverture?.tbsLycee))],
                  ['TBA Lycée (2nde)', ...evo(y => pct(dataset?.indicateurs?.[y]?.couverture?.tbaLycee))],
                  ['Transition 7ème → 6ème', ...evo(y => pct(dataset?.indicateurs?.[y]?.couverture?.transition?.primaireCollege))],
                  ['Transition 3ème → 2nde', ...evo(y => pct(dataset?.indicateurs?.[y]?.couverture?.transition?.collegeLycee))],
                ]} />
              </Block>
              <Block title={`Capacité d'accueil et secteur privé — ${annee || '—'}`}>
                <Table head={['Indicateur', 'Valeur']} rows={[
                  ['Salles pour 1000 enfants scolarisables (primaire)', rat(ind?.couverture?.sallesPour1000Scolarisables)],
                  ['Ratio classe pédagogique / salle', rat(ind?.couverture?.ratioClassePedagogiqueSalle)],
                  ["Taux d'utilisation des salles — Collège", pct(ind?.couverture?.tauxUtilisationSalleCollege)],
                  ["Taux d'utilisation des salles — Lycée", pct(ind?.couverture?.tauxUtilisationSalleLycee)],
                  ['% EPP pourvus de CAP', pct(ind?.couverture?.pourcentageEppAvecCap)],
                  ...LEVELS.map(l => [`Part du privé — ${l.label}`, pct(ind?.couverture?.partPrive?.[l.key])] as (string | number)[]),
                  ...LEVELS.map(l => [`Parité filles/garçons — ${l.label}`, rat(ind?.couverture?.pariteFillesGarcons?.[l.key])] as (string | number)[]),
                ]} />
              </Block>
            </div></ScrollArea>
          </TabsContent>

          <TabsContent value="efficacite" className="flex-1 overflow-hidden m-0">
            <ScrollArea className="h-full"><div className="p-4 space-y-4">
              {(['primaire', 'college', 'lycee'] as const).map((niv) => {
                const bloc = ind?.efficacite?.[niv] || {};
                const classes = Object.keys(bloc);
                return (
                  <Block key={niv} title={`Flux ${niv === 'primaire' ? 'Primaire' : niv === 'college' ? 'Collège' : 'Lycée'} — ${annee || '—'}`}
                    subtitle="Promotion = (effectif classe sup. N − redoublants classe sup. N) / effectif classe N-1 × 100 ; Abandon = 100 − (promotion + redoublement)">
                    {classes.length ? (
                      <Table head={['Taux', ...classes]} rows={[
                        ['Promotion (%)', ...classes.map(c => pct(bloc[c]?.promotion))],
                        ['Redoublement (%)', ...classes.map(c => pct(bloc[c]?.redoublement))],
                        ['Abandon (%)', ...classes.map(c => pct(bloc[c]?.abandon))],
                      ]} />
                    ) : <p className="text-sm text-muted-foreground">Donnée non disponible</p>}
                  </Block>
                );
              })}
              <Block title="Profils de rétention (cohortes apparentes)">
                {dataset?.retention ? (
                  <div className="space-y-3">
                    {Object.entries(dataset.retention).map(([niv, val]: any) => {
                      const cls = Object.keys(val).filter(k => k !== 'cohorte');
                      return (
                        <div key={niv}>
                          <p className="text-sm font-semibold capitalize mb-1">{niv} — {val.cohorte}</p>
                          <Table head={['Classe', ...cls]} rows={[['Rétention (%)', ...cls.map(c => pct(val[c]))]]} />
                        </div>
                      );
                    })}
                  </div>
                ) : <p className="text-sm text-muted-foreground">Donnée non disponible</p>}
              </Block>
            </div></ScrollArea>
          </TabsContent>

          <TabsContent value="qualite" className="flex-1 overflow-hidden m-0">
            <ScrollArea className="h-full"><div className="p-4 space-y-4">
              <Block title={`Intrants pédagogiques — ${annee || '—'}`} subtitle="Normes MEN : REM primaire 40-52 ; ratio élève/place assise ≤ 1 ; enseignants qualifiés > 80 %">
                <Table head={['Indicateur', ...LEVELS.map(l => l.label)]} rows={[
                  ['% enseignants qualifiés', ...LEVELS.map(l => pct(ind?.qualite?.pourcentageQualifies?.[l.key]))],
                  ['% non fonctionnaires (FRAM)', ...LEVELS.map(l => pct(ind?.qualite?.pourcentageNonFonctionnaires?.[l.key]))],
                  ['Ratio élève / enseignant', ...LEVELS.map(l => rat(ind?.qualite?.ratioEleveEnseignant?.[l.key]))],
                  ['Ratio élève / place assise', ...LEVELS.map(l => rat(ind?.qualite?.ratioElevePlaceAssise?.[l.key]))],
                  ['Ratio élève / salle', ...LEVELS.map(l => rat(ind?.qualite?.ratioEleveSalle?.[l.key]))],
                  ['% salles en mauvais état', ...LEVELS.map(l => pct(ind?.qualite?.pourcentageSallesMauvaisEtat?.[l.key]))],
                ]} />
              </Block>
              <Block title="Manuels scolaires et multigrade (primaire)" subtitle="Ratio élève / manuel — cible : 1">
                <Table head={['Indicateur', 'Valeur']} rows={[
                  ['Ratio élève / manuel Malagasy', rat(ind?.qualite?.ratioEleveManuel?.malagasy)],
                  ['Ratio élève / manuel Français', rat(ind?.qualite?.ratioEleveManuel?.francais)],
                  ['Ratio élève / manuel Mathématiques', rat(ind?.qualite?.ratioEleveManuel?.maths)],
                  ['% élèves en classe multigrade', pct(ind?.qualite?.pourcentageMultigrade)],
                ]} />
              </Block>
              <Block title="Résultats aux examens officiels" subtitle="Taux de réussite = admis / présentés × 100 (et / inscrits en classe terminale du cycle)">
                <Table head={['Examen', 'Présentés', 'Admis', 'Taux de réussite', 'Sur inscrits']} rows={[
                  ['CEPE', nf(ind?.resultats?.cepe?.presentes), nf(ind?.resultats?.cepe?.admis), pct(ind?.resultats?.cepe?.tauxReussite), pct(ind?.resultats?.cepe?.tauxReussiteSurInscrits)],
                  ['BEPC', nf(ind?.resultats?.bepc?.presentes), nf(ind?.resultats?.bepc?.admis), pct(ind?.resultats?.bepc?.tauxReussite), pct(ind?.resultats?.bepc?.tauxReussiteSurInscrits)],
                ]} />
                {ind?.resultats?.cepe?.scores && (
                  <div className="mt-3">
                    <p className="text-sm font-semibold mb-1">Scores moyens CEPE</p>
                    <Table head={['Malagasy', 'Français', 'Calcul', 'Moyenne générale']} rows={[[
                      rat(ind.resultats.cepe.scores.malagasy), rat(ind.resultats.cepe.scores.francais),
                      rat(ind.resultats.cepe.scores.calcul), rat(ind.resultats.cepe.moyenne),
                    ]]} />
                  </div>
                )}
              </Block>
            </div></ScrollArea>
          </TabsContent>

          <TabsContent value="diagnostic" className="flex-1 overflow-hidden m-0">
            <DiagnosticTextView diagnostic={diagnosticResult} generating={generating} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Diagnostic;
