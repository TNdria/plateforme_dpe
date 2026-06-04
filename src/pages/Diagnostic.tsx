import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  FileText, Loader2, School, Users, GraduationCap, Building2,
  BarChart3, Target, TrendingUp, BookOpen, Sparkles, ShieldCheck, Activity
} from 'lucide-react';
import { dashboardApi, Dren, Cisco } from '@/services/api';
import { supabase } from '@/integrations/supabase/client';
import { useDiagnosticData } from '@/hooks/useDiagnosticData';
import DiagnosticFilters from '@/components/diagnostic/DiagnosticFilters';
import DiagnosticStatsBar from '@/components/diagnostic/DiagnosticStatsBar';
import CategorieIndicateurs from '@/components/diagnostic/CategorieIndicateurs';
import TableauNiveaux from '@/components/diagnostic/TableauNiveaux';
import DiagnosticTextView from '@/components/diagnostic/DiagnosticTextView';
import { exportDiagnosticToPDF, exportDiagnosticToDocx } from '@/utils/diagnosticExport';
import { fluxNationaux, efficaciteNationale, getFluxEvolution, getAchevementEvolution } from '@/data/educationIndicators';
import DataActionsBar from '@/components/admin/DataActionsBar';

interface DiagnosticResult {
  diagnostic: string;
  drenName: string;
  ciscoName: string;
  niveau: string;
  annee: string;
  generatedAt: string;
  indicateurs?: any;
}

const Diagnostic = () => {
  const [drens, setDrens] = useState<Dren[]>([]);
  const [ciscos, setCiscos] = useState<Cisco[]>([]);
  const [selectedDren, setSelectedDren] = useState<string>('0');
  const [selectedCisco, setSelectedCisco] = useState<string>('0');
  const [selectedSecteur] = useState<string>('2');
  const [selectedAnnee, setSelectedAnnee] = useState<string>('2025');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [activeTab, setActiveTab] = useState<string>('couverture');

  const { indicateurs, loading: statsLoading, interpreterRem } = useDiagnosticData(
    Number(selectedDren),
    Number(selectedCisco),
    Number(selectedSecteur),
    selectedAnnee
  );

  useEffect(() => {
    const fetchDrens = async () => {
      try {
        const data = await dashboardApi.getDrens();
        setDrens(data);
      } catch (err) {
        console.error('Erreur lors du chargement des DRENs:', err);
      }
    };
    fetchDrens();
  }, []);

  const handleDrenChange = async (value: string) => {
    setSelectedDren(value);
    setSelectedCisco('0');
    setDiagnosticResult(null);
    if (value !== '0') {
      try {
        setLoading(true);
        const data = await dashboardApi.getCiscos(Number(value));
        setCiscos(data);
      } catch (err) {
        toast.error('Erreur lors du chargement des CISCOs');
      } finally {
        setLoading(false);
      }
    } else {
      setCiscos([]);
    }
  };

  const handleGenerateDiagnostic = async () => {
    setGenerating(true);
    setDiagnosticResult(null);
    try {
      const codeDren = Number(selectedDren);
      const codeCisco = Number(selectedCisco);
      const drenName = drens.find(d => d.CODE_DREN === codeDren)?.DREN || '';
      const ciscoName = ciscos.find(c => c.CODE_CISCO === codeCisco)?.CISCO || '';

      const [etablissements, elevesN0N1, elevesN2N3, enseignants, places] = await Promise.all([
        dashboardApi.getStatsEtablissements(codeDren, codeCisco, Number(selectedSecteur)),
        dashboardApi.getStatsElevesN0N1(codeDren, codeCisco, Number(selectedSecteur)),
        dashboardApi.getStatsElevesN2N3(codeDren, codeCisco, Number(selectedSecteur)),
        dashboardApi.getStatsEnseignants(codeDren, codeCisco, Number(selectedSecteur)),
        dashboardApi.getStatsPlacesAssises(codeDren, codeCisco, Number(selectedSecteur)),
      ]);

      const { data, error } = await supabase.functions.invoke('ai-diagnostic', {
        body: {
          data: {
            etablissements: etablissements[0] || null,
            elevesN0N1: elevesN0N1[0] || null,
            elevesN2N3: elevesN2N3[0] || null,
            enseignants: enseignants[0] || null,
            places: places[0] || null,
            indicateurs: {
              rem: indicateurs.rem,
              ratioElevePlaceAssise: indicateurs.ratioElevePlaceAssise,
              donnees: indicateurs.donnees,
            },
            fluxNationaux,
            efficaciteNationale,
          },
          drenName,
          ciscoName,
          niveau: 'Tous niveaux',
          annee: selectedAnnee,
        },
      });

      if (error) throw error;
      setDiagnosticResult(data);
      setActiveTab('diagnostic');
      toast.success('Diagnostic généré avec succès');
    } catch (err: any) {
      console.error('Error generating diagnostic:', err);
      if (err.message?.includes('429')) {
        toast.error('Limite de requêtes atteinte. Réessayez dans quelques instants.');
      } else if (err.message?.includes('402')) {
        toast.error('Crédit insuffisant pour générer le diagnostic.');
      } else {
        toast.error('Erreur lors de la génération du diagnostic');
      }
    } finally {
      setGenerating(false);
    }
  };

  const indicateursQualite = [
    { id: 'rem_n0', nom: 'REM Préscolaire', valeur: indicateurs.rem.prescolaire, unite: 'ratio' as const, interpretation: interpreterRem(indicateurs.rem.prescolaire), description: 'Ratio élève/maître au préscolaire' },
    { id: 'rem_n1', nom: 'REM Primaire', valeur: indicateurs.rem.primaire, unite: 'ratio' as const, interpretation: interpreterRem(indicateurs.rem.primaire), description: 'Normal: 40-52 élèves/enseignant' },
    { id: 'rem_n2', nom: 'REM Collège', valeur: indicateurs.rem.college, unite: 'ratio' as const, interpretation: interpreterRem(indicateurs.rem.college), description: 'Ratio au collège' },
    { id: 'rem_n3', nom: 'REM Lycée', valeur: indicateurs.rem.lycee, unite: 'ratio' as const, interpretation: interpreterRem(indicateurs.rem.lycee), description: 'Ratio au lycée' },
  ];

  const indicateursPlaces = [
    { id: 'rp_n0', nom: 'Préscolaire', valeur: indicateurs.ratioElevePlaceAssise.prescolaire, unite: 'ratio' as const, interpretation: (indicateurs.ratioElevePlaceAssise.prescolaire || 0) > 1 ? 'mauvais' as const : 'bon' as const, description: 'Ratio élève/place assise' },
    { id: 'rp_n1', nom: 'Primaire', valeur: indicateurs.ratioElevePlaceAssise.primaire, unite: 'ratio' as const, interpretation: (indicateurs.ratioElevePlaceAssise.primaire || 0) > 1 ? 'mauvais' as const : 'bon' as const, description: '< 1: places suffisantes' },
    { id: 'rp_n2', nom: 'Collège', valeur: indicateurs.ratioElevePlaceAssise.college, unite: 'ratio' as const, interpretation: (indicateurs.ratioElevePlaceAssise.college || 0) > 1 ? 'mauvais' as const : 'bon' as const },
    { id: 'rp_n3', nom: 'Lycée', valeur: indicateurs.ratioElevePlaceAssise.lycee, unite: 'ratio' as const, interpretation: (indicateurs.ratioElevePlaceAssise.lycee || 0) > 1 ? 'mauvais' as const : 'bon' as const },
  ];

  const tableauRows = [
    { niveau: 'Préscolaire', etablissements: indicateurs.donnees.etablissements.prescolaire, eleves: indicateurs.donnees.eleves.prescolaire, enseignants: indicateurs.donnees.enseignants.prescolaire, places: indicateurs.donnees.places.prescolaire, rem: indicateurs.rem.prescolaire, ratioPlaces: indicateurs.ratioElevePlaceAssise.prescolaire },
    { niveau: 'Primaire', etablissements: indicateurs.donnees.etablissements.primaire, eleves: indicateurs.donnees.eleves.primaire, enseignants: indicateurs.donnees.enseignants.primaire, places: indicateurs.donnees.places.primaire, rem: indicateurs.rem.primaire, ratioPlaces: indicateurs.ratioElevePlaceAssise.primaire },
    { niveau: 'Collège', etablissements: indicateurs.donnees.etablissements.college, eleves: indicateurs.donnees.eleves.college, enseignants: indicateurs.donnees.enseignants.college, places: indicateurs.donnees.places.college, rem: indicateurs.rem.college, ratioPlaces: indicateurs.ratioElevePlaceAssise.college },
    { niveau: 'Lycée', etablissements: indicateurs.donnees.etablissements.lycee, eleves: indicateurs.donnees.eleves.lycee, enseignants: indicateurs.donnees.enseignants.lycee, places: indicateurs.donnees.places.lycee, rem: indicateurs.rem.lycee, ratioPlaces: indicateurs.ratioElevePlaceAssise.lycee },
  ];

  const totalRow = {
    niveau: 'TOTAL',
    etablissements: indicateurs.donnees.etablissements.total,
    eleves: indicateurs.donnees.eleves.total,
    enseignants: indicateurs.donnees.enseignants.total,
    places: indicateurs.donnees.places.total,
    rem: indicateurs.donnees.enseignants.total > 0 ? indicateurs.donnees.eleves.total / indicateurs.donnees.enseignants.total : null,
    ratioPlaces: indicateurs.donnees.places.total > 0 ? indicateurs.donnees.eleves.total / indicateurs.donnees.places.total : null,
  };

  const remGlobal = indicateurs.donnees.enseignants.total > 0
    ? (indicateurs.donnees.eleves.total / indicateurs.donnees.enseignants.total).toFixed(1)
    : 'N/A';

  // Latest flux values for display
  const latestFlux = {
    promotion: {
      primaire: fluxNationaux.promotion.primaire["2023-2024"],
      college: fluxNationaux.promotion.college["2023-2024"],
      lycee: fluxNationaux.promotion.lycee["2023-2024"],
    },
    redoublement: {
      primaire: fluxNationaux.redoublement.primaire["2023-2024"],
      college: fluxNationaux.redoublement.college["2023-2024"],
      lycee: fluxNationaux.redoublement.lycee["2023-2024"],
    },
    abandon: {
      primaire: fluxNationaux.abandon.primaire["2023-2024"],
      college: fluxNationaux.abandon.college["2023-2024"],
      lycee: fluxNationaux.abandon.lycee["2023-2024"],
    },
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 bg-primary/5 border-b border-border">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <span className="text-sm font-bold text-foreground uppercase tracking-wide">
              Diagnostic Éducatif — Plan Indicatif MEN
            </span>
          </div>
          <DataActionsBar table="fpe_a1" tableLabel="Données diagnostic" compact />
        </div>
      </div>

      <div className="p-4 border-b border-border bg-card">
        <DiagnosticFilters
          drens={drens} ciscos={ciscos}
          selectedDren={selectedDren} selectedCisco={selectedCisco}
          selectedSecteur={selectedSecteur} selectedAnnee={selectedAnnee}
          generating={generating} loading={loading} statsLoading={statsLoading}
          hasDiagnostic={!!diagnosticResult}
          onDrenChange={handleDrenChange} onCiscoChange={setSelectedCisco}
          onSecteurChange={() => {}} onAnneeChange={setSelectedAnnee}
          onGenerate={handleGenerateDiagnostic}
          onExportPDF={() => { if (diagnosticResult) exportDiagnosticToPDF(diagnosticResult); }}
          onExportDocx={() => { if (diagnosticResult) exportDiagnosticToDocx(diagnosticResult); }}
        />
      </div>

      <div className="p-4 border-b border-border bg-muted/30">
        <DiagnosticStatsBar donnees={indicateurs.donnees} remGlobal={remGlobal} loading={statsLoading} />
      </div>

      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="px-4 pt-2 border-b border-border bg-card">
            <TabsList className="h-auto flex-wrap">
              <TabsTrigger value="couverture" className="gap-1.5 text-xs">
                <Target className="w-3.5 h-3.5" />Ch.I Couverture
              </TabsTrigger>
              <TabsTrigger value="efficacite" className="gap-1.5 text-xs">
                <Activity className="w-3.5 h-3.5" />Ch.II Efficacité
              </TabsTrigger>
              <TabsTrigger value="qualite" className="gap-1.5 text-xs">
                <ShieldCheck className="w-3.5 h-3.5" />Ch.III Qualité
              </TabsTrigger>
              <TabsTrigger value="diagnostic" className="gap-1.5 text-xs" disabled={!diagnosticResult && !generating}>
                <Sparkles className="w-3.5 h-3.5" />Diagnostic IA
              </TabsTrigger>
            </TabsList>
          </div>

          {/* CHAPITRE I: Couverture */}
          <TabsContent value="couverture" className="flex-1 overflow-hidden m-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
                  <div className="flex items-start gap-3">
                    <Target className="w-6 h-6 text-primary mt-0.5" />
                    <div>
                      <h2 className="text-lg font-bold text-foreground">Chapitre I : Analyse de la couverture du système</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Capacité d'accueil, accès, rétention et participation du secteur privé
                      </p>
                    </div>
                  </div>
                </div>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-primary" />1.1 Capacité d'accueil du système
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">Évolution des établissements, salles de classe et effectifs par niveau</p>
                  </CardHeader>
                  <CardContent>
                    <TableauNiveaux rows={tableauRows} totals={totalRow} />
                  </CardContent>
                </Card>

                <CategorieIndicateurs
                  titre="1.2 Qualité de l'encadrement — Ratio Élève/Maître (REM)"
                  description="REM < 40: surplus d'enseignants | 40-52: normal | > 52: déficit d'enseignants"
                  icon={GraduationCap}
                  indicateurs={indicateursQualite}
                  colorClass="text-primary"
                />

                <CategorieIndicateurs
                  titre="1.3 Conditions matérielles — Ratio Élève/Place assise (TUPA)"
                  description="TUPA < 1: surplus de mobilier | = 1: normal | > 1: déficit de tables-bancs"
                  icon={School}
                  indicateurs={indicateursPlaces}
                  colorClass="text-warning"
                  compact
                />

                {!diagnosticResult && (
                  <Card className="border-dashed border-2 border-primary/30">
                    <CardContent className="py-8 text-center">
                      <Sparkles className="w-10 h-10 mx-auto mb-3 text-primary/40" />
                      <h3 className="text-base font-semibold mb-1">Analyse complète par l'IA</h3>
                      <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                        L'IA analysera tous les indicateurs et produira un diagnostic structuré
                      </p>
                      <Button onClick={handleGenerateDiagnostic} disabled={generating || statsLoading}>
                        {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Génération...</> : <><Sparkles className="w-4 h-4 mr-2" />Générer le diagnostic</>}
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* CHAPITRE II: Efficacité interne */}
          <TabsContent value="efficacite" className="flex-1 overflow-hidden m-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                <div className="p-4 rounded-lg bg-secondary/5 border border-secondary/10">
                  <div className="flex items-start gap-3">
                    <Activity className="w-6 h-6 text-secondary mt-0.5" />
                    <div>
                      <h2 className="text-lg font-bold text-foreground">Chapitre II : Efficacité interne du système</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Flux scolaires nationaux : promotion, redoublement, abandon (2023-2024)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Flux scolaires - Dernières données */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-secondary" />
                      2.1 Flux scolaires nationaux (2023-2024)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="border border-border p-2 text-left">Indicateur</th>
                            <th className="border border-border p-2 text-center">Primaire</th>
                            <th className="border border-border p-2 text-center">Collège</th>
                            <th className="border border-border p-2 text-center">Lycée</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-border p-2 font-medium text-green-700">Taux de promotion (%)</td>
                            <td className="border border-border p-2 text-center">{latestFlux.promotion.primaire.total}</td>
                            <td className="border border-border p-2 text-center">{latestFlux.promotion.college.total}</td>
                            <td className="border border-border p-2 text-center">{latestFlux.promotion.lycee.total}</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 font-medium text-amber-700">Taux de redoublement (%)</td>
                            <td className="border border-border p-2 text-center">{latestFlux.redoublement.primaire.total}</td>
                            <td className="border border-border p-2 text-center">{latestFlux.redoublement.college.total}</td>
                            <td className="border border-border p-2 text-center">{latestFlux.redoublement.lycee.total}</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 font-medium text-red-700">Taux d'abandon (%)</td>
                            <td className="border border-border p-2 text-center">{latestFlux.abandon.primaire.total}</td>
                            <td className="border border-border p-2 text-center">{latestFlux.abandon.college.total}</td>
                            <td className="border border-border p-2 text-center">{latestFlux.abandon.lycee.total}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-secondary" />
                      2.2 Taux d'achèvement et transition
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="border border-border p-2 text-left">Indicateur</th>
                            <th className="border border-border p-2 text-center">2022-2023</th>
                            <th className="border border-border p-2 text-center">2023-2024</th>
                            <th className="border border-border p-2 text-center">2024-2025</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-border p-2 font-medium">Achèvement Primaire (%)</td>
                            <td className="border border-border p-2 text-center">{efficaciteNationale.taux_achevement.primaire["2022-2023"]?.total ?? '-'}</td>
                            <td className="border border-border p-2 text-center">{efficaciteNationale.taux_achevement.primaire["2023-2024"]?.total ?? '-'}</td>
                            <td className="border border-border p-2 text-center">{efficaciteNationale.taux_achevement.primaire["2024-2025"]?.total ?? '-'}</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 font-medium">Achèvement Collège (%)</td>
                            <td className="border border-border p-2 text-center">{efficaciteNationale.taux_achevement.college["2022-2023"]?.total ?? '-'}</td>
                            <td className="border border-border p-2 text-center">{efficaciteNationale.taux_achevement.college["2023-2024"]?.total ?? '-'}</td>
                            <td className="border border-border p-2 text-center">{efficaciteNationale.taux_achevement.college["2024-2025"]?.total ?? '-'}</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 font-medium">Transition Prim→Col (%)</td>
                            <td className="border border-border p-2 text-center">{efficaciteNationale.taux_transition.primaire_college["2022-2023"]?.total ?? '-'}</td>
                            <td className="border border-border p-2 text-center">{efficaciteNationale.taux_transition.primaire_college["2023-2024"]?.total ?? '-'}</td>
                            <td className="border border-border p-2 text-center">{efficaciteNationale.taux_transition.primaire_college["2024-2025"]?.total ?? '-'}</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 font-medium">Transition Col→Lyc (%)</td>
                            <td className="border border-border p-2 text-center">{efficaciteNationale.taux_transition.college_lycee["2022-2023"]?.total ?? '-'}</td>
                            <td className="border border-border p-2 text-center">{efficaciteNationale.taux_transition.college_lycee["2023-2024"]?.total ?? '-'}</td>
                            <td className="border border-border p-2 text-center">{efficaciteNationale.taux_transition.college_lycee["2024-2025"]?.total ?? '-'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* CHAPITRE III: Qualité */}
          <TabsContent value="qualite" className="flex-1 overflow-hidden m-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                <div className="p-4 rounded-lg bg-accent border border-border/50">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="w-6 h-6 text-accent-foreground mt-0.5" />
                    <div>
                      <h2 className="text-lg font-bold text-foreground">Chapitre III : Qualité du service éducatif</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Résultats aux examens (CEPE, BEPC, BAC), scores moyens et analyse des compétences
                      </p>
                    </div>
                  </div>
                </div>

                <CategorieIndicateurs
                  titre="3.1 Ratio Élève/Maître par niveau"
                  description="Norme: 40-52 élèves/enseignant | < 40: surplus | > 52: déficit critique"
                  icon={GraduationCap}
                  indicateurs={indicateursQualite}
                  colorClass="text-primary"
                />

                <CategorieIndicateurs
                  titre="3.2 Ratio Élève/Place assise (TUPA)"
                  description="< 1: places suffisantes | = 1: normal | > 1: déficit de tables-bancs"
                  icon={School}
                  indicateurs={indicateursPlaces}
                  colorClass="text-warning"
                  compact
                />

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-accent-foreground" />
                      3.3 Résultats aux examens
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                      <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">Résultats scolaires</p>
                      <p className="text-sm mt-1">Les taux de réussite et scores moyens seront affichés ici lorsque les données des fiches établissement seront intégrées.</p>
                      <p className="text-xs mt-3 text-muted-foreground/70">Source: Fiches Tableau de Bord de l'École (format ZAP/CISCO)</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Diagnostic IA */}
          <TabsContent value="diagnostic" className="flex-1 overflow-hidden m-0">
            <DiagnosticTextView diagnostic={diagnosticResult} generating={generating} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Diagnostic;
