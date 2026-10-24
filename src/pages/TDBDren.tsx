import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { dashboardApi, tdbApi, Dren } from '@/services/api';
import { PDFViewer } from '@/components/pdf/PDFViewer';
import { TDBShell } from '@/components/tdb/TDBShell';
import { TDBImportDialog } from '@/components/tdb/TDBImportDialog';
import DataActionsBar from '@/components/admin/DataActionsBar';
import { TableauDeBord } from '@/components/tdb/TableauDeBord';

// Helper: render a data cell with auto manquant background
const DD = ({ v, style = {} }: { v: any; style?: React.CSSProperties }) => {
  const val = v === null || v === undefined ? '-' : String(v);
  const isMissing = val === '—' || val === '-' || val === '';
  return <td style={{ padding: '3px', verticalAlign: 'middle', fontSize: '11px', border: '1px solid #333', textAlign: 'right', ...(isMissing ? { background: '#7CB5EC' } : {}), ...style }}>{val}</td>;
};

const st = {
  titre: { letterSpacing: '0.2em', textTransform: 'uppercase' as const, width: '99%', background: '#337ab7', color: '#fff', padding: '6px 10px', marginTop: '7px', marginBottom: '7px', fontWeight: 'bold', fontSize: '12px' },
  gris: { background: '#bbbbcc', textAlign: 'center' as const, fontWeight: 'bold' as const },
  td: { padding: '3px', verticalAlign: 'middle' as const, fontSize: '11px', border: '1px solid #333' },
  th: { textAlign: 'center' as const, fontWeight: 'bold' as const, fontSize: '11px', padding: '3px', border: '1px solid #333' },
  mena: { background: 'rgba(255, 0, 0, 0.75)', fontWeight: 700 as const, color: '#fff' },
  mavo: { background: '#ffff00' },
  manquant: { background: '#7CB5EC' },
};

const TDBDren = () => {
  const [drens, setDrens] = useState<Dren[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedDren, setSelectedDren] = useState<string>('0');
  const [selectedAnnee, setSelectedAnnee] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [tdbData, setTdbData] = useState<any>(null);
  const [niveau, setNiveau] = useState<'presco' | 'primaire' | 'college' | 'lycee'>('primaire');
  const [niveauData, setNiveauData] = useState<any>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string>('');
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null]);

  useEffect(() => {
    dashboardApi.getDrens().then(setDrens).catch(() => toast.error('Erreur DRENs'));
  }, []);

  useEffect(() => {
    const niveauAnnee = niveau === 'presco' ? 'primaire' : niveau;
    dashboardApi.getAvailableYears({ code_dren: Number(selectedDren), niveau: niveauAnnee }).then((data) => {
      const years = data.map((d: any) => Number(d.annee)).filter((y: number) => !isNaN(y));
      setAvailableYears(years);
      if (years.length > 0) setSelectedAnnee(String(years[0]));
    }).catch(() => toast.error('Erreur années'));
  }, [selectedDren, niveau]);

  const loadTdb = async () => {
    if (selectedDren === '0' || !selectedAnnee) return;
    setLoading(true);
    try {
      if (niveau !== 'primaire') {
        const nd = await tdbApi.getTdbDrenNiveau(Number(selectedDren), Number(selectedAnnee), niveau);
        setNiveauData(nd); setTdbData(null);
        toast.success('Tableau de bord DREN chargé');
        return;
      }
      const data = await tdbApi.getTdbDrenData(Number(selectedDren), Number(selectedAnnee));
      setTdbData(data); setNiveauData(null);
      toast.success('Tableau de bord DREN chargé');
    } catch (err) { console.error(err); toast.error('Erreur lors du chargement du TDB DREN'); }
    finally { setLoading(false); }
  };

  const docName = tdbData ? `TDB_DREN_${tdbData.names.DREN}_${tdbData.annee}` : niveauData ? `TDB_DREN_${niveau}_${niveauData.names?.DREN}_${niveauData.annee}` : 'TDB_DREN';
  const generatePdf = useCallback(async () => {
    if ((!tdbData && !niveauData) || !printRef.current) return;
    setGeneratingPdf(true);
    try {
      const { openHtmlPdf } = await import('@/utils/htmlToPdf');
      openHtmlPdf(printRef.current, docName, 'print', { format: 'A4', onePage: false });
      toast.success('Fenêtre d\'impression A4 ouverte (texte sélectionnable)');
    } catch (err) { console.error(err); toast.error('Erreur PDF'); }
    finally { setGeneratingPdf(false); }
  }, [tdbData, niveauData, docName]);

  const previewPdf = useCallback(async () => {
    if ((!tdbData && !niveauData) || !printRef.current) return;
    setGeneratingPreview(true);
    try {
      const { openHtmlPdf } = await import('@/utils/htmlToPdf');
      openHtmlPdf(printRef.current, docName, 'preview', { format: 'A4', onePage: false });
      toast.success('Aperçu A4 ouvert dans un nouvel onglet');
    } catch (e) { console.error(e); toast.error('Erreur aperçu'); }
    finally { setGeneratingPreview(false); }
  }, [tdbData, niveauData, docName]);

  const drenName = tdbData?.names?.DREN ?? (drens.find(d => String(d.CODE_DREN) === selectedDren)?.DREN ?? '');
  const anneeLabel = selectedAnnee ? `${Number(selectedAnnee) - 1} – ${selectedAnnee}` : '';

  return (
    <>
      <TDBShell
        level="DREN"
        cycle={({ presco: 'PRÉSCOLAIRE', primaire: 'PRIMAIRE', college: 'COLLÈGE', lycee: 'LYCÉE' } as const)[niveau]}
        title="Tableau de Bord — DREN"
        entityName={drenName}
        entityCode={selectedDren !== '0' ? selectedDren : undefined}
        annee={anneeLabel}
        loading={loading}
        hasData={!!tdbData || !!niveauData}
        generatingPdf={generatingPdf}
        generatingPreview={generatingPreview}
        onDownloadPdf={tdbData || niveauData ? generatePdf : undefined}
        onPrint={tdbData || niveauData ? generatePdf : undefined}
        onImportCsv={() => setImportOpen(true)}
        filters={
          <>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">DREN</label>
              <Select value={selectedDren} onValueChange={(v) => { setSelectedDren(v); setTdbData(null); setNiveauData(null); }}>
                <SelectTrigger className="w-56"><SelectValue placeholder="Sélectionner DREN" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sélectionner DREN</SelectItem>
                  {drens.map((d) => (<SelectItem key={d.CODE_DREN} value={d.CODE_DREN.toString()}>{d.DREN}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Niveau</label>
              <Select value={niveau} onValueChange={(v) => { setNiveau(v as any); setTdbData(null); setNiveauData(null); }}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="presco">Préscolaire</SelectItem>
                  <SelectItem value="primaire">Primaire</SelectItem>
                  <SelectItem value="college">Collège</SelectItem>
                  <SelectItem value="lycee">Lycée</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Année scolaire</label>
              <Select value={selectedAnnee} onValueChange={(v) => { setSelectedAnnee(v); setTdbData(null); setNiveauData(null); }}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Année" /></SelectTrigger>
                <SelectContent>
                  {availableYears.map((y) => (<SelectItem key={y} value={String(y)}>{y-1}-{y}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="hidden md:block ml-auto">
              <DataActionsBar table="tdb_dren" tableLabel="TDB DREN" compact onChange={() => tdbData && loadTdb()} />
            </div>
          </>
        }
        primaryAction={
          <Button onClick={loadTdb} disabled={selectedDren === '0' || loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Appliquer
          </Button>
        }
        tabs={[{
          value: 'tdb',
          label: 'Tableau de bord',
          content: (
            <div ref={printRef}>
              {niveauData ? (
                <TableauDeBord data={niveauData} niveau={niveau} codeDren={selectedDren} />
              ) : tdbData ? (
                <TableauDeBord data={tdbData} niveau="primaire" codeDren={selectedDren} />
              ) : null}
            </div>
          ),
        }]}
      />
      {previewUrl && (
        <PDFViewer
          open={!!previewUrl}
          onOpenChange={(o) => { if (!o) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); } }}
          pdfUrl={previewUrl}
          pdfName={previewName}
        />
      )}
      <TDBImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
};

export default TDBDren;
