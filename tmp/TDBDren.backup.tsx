import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, FileDown, Building2, Printer, Eye } from 'lucide-react';
import { dashboardApi, tdbApi, Dren } from '@/services/api';
import { printTdb } from '@/utils/printTdb';
import { PDFViewer } from '@/components/pdf/PDFViewer';
import { GenderLabel } from '@/components/score/GenderRow';
import DisparityIcon from '@/components/score/DisparityIcon';
import { TDBShell } from '@/components/tdb/TDBShell';
import { TDBImportDialog } from '@/components/tdb/TDBImportDialog';
import { EfficienceGrid } from '@/components/tdb/EfficienceGrid';
import DataActionsBar from '@/components/admin/DataActionsBar';
import { TableauDeBord } from '@/components/tdb/TableauDeBord';
import { DrenReferenceTables } from '@/components/tdb/DrenReferenceTables';
import { drenNumber, drenDivide, drenFormat, drenCoverage, drenRetention, drenAdmission, drenRepeat, drenPromotion, drenAbandon, drenCycleRate, drenEfficience, drenEfficienceEntity, drenBottlenecks, drenExamThreshold } from '@/utils/tdbDrenFormulas';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ScatterChart, Scatter, Cell, ResponsiveContainer, LabelList, ReferenceLine,
  LineChart, Line
} from 'recharts';

const fmt = (n: any) => drenFormat(n, '', 0);
const pct = (n: any, d: any, dec = 1) => drenFormat(drenDivide(n, d), ' %', dec);
const pctVal = (n: any, d: any) => drenDivide(n, d);
const ratio = (n: any, d: any, dec = 1) => drenFormat(drenDivide(n, d, 1), '', dec);
const ratioVal = (n: any, d: any) => drenDivide(n, d, 1);
const manq = (val: string | number) => val === '—' || val === '-' || val === '' || val === null || val === undefined ? { background: '#7CB5EC' } : {};

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

  const renderTdb = () => {
    if (!tdbData) return null;
    const d = tdbData.dren, m = tdbData.mada;
    const anneeDisplay = `${tdbData.annee - 1} - ${tdbData.annee}`;

    const comparisonEntity = (item: any) => ({ ...item, ressources: item, personnel: item, cepe: item.admis_g !== undefined || item.admis_f !== undefined ? item : {} });
    const drenPoints = (tdbData.efficienceDrens || []).filter((item: any) => String(item.CODE_DREN) !== selectedDren).map((item: any) => ({ name: item.DREN, ...drenEfficience(comparisonEntity(item)) }));
    const efficienceData = [...drenPoints, { name: tdbData.names?.DREN || 'DREN', isCurrent: true, ...drenEfficience(d) }];
    const efficienceTitre = 'Efficience — comparaison régionale et nationale';
    const retentionProfile = ['CP1', 'CP2', 'CE', 'CM1', 'CM2'].map((niveau, i) => ({ niveau, DREN: drenRetention(d, i + 1), MADA: drenRetention(m, i + 1) }));

    return (
      <div style={{ width: '100%', maxWidth: '1191px', margin: '0 auto', font: '12px verdana', background: '#fff' }}>
        <div className="w-full space-y-3">
          {/* ===== TAB 0: INFO GÉNÉRALES ===== */}
          <div>
          <div ref={(el) => { sectionRefs.current[0] = el; }} style={{ padding: '10px', background: '#fff' }}>
        <div style={{ border: '2px solid #000', padding: '15px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody><tr>
            <td style={{ width: '15%', verticalAlign: 'top', textAlign: 'center' }}>
              <img src="/img/logoMen.jpg" width="90" height="90" alt="MEN" style={{ maxWidth: '90px' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </td>
            <td style={{ width: '70%', textAlign: 'center', verticalAlign: 'top' }}>
              <b style={{ fontSize: '14px' }}>Ministère de l'Éducation Nationale</b><br />
              <b style={{ fontSize: '13px' }}>TABLEAU DE BORD DE LA DREN : {anneeDisplay}</b><br />
              <span style={{ fontSize: '12px' }}>DREN : <b>{tdbData.names.DREN}</b> &nbsp;&nbsp; Code : <b>{selectedDren}</b></span>
            </td>
            <td style={{ width: '15%', verticalAlign: 'top', textAlign: 'center' }}>
              <img src="/img/logoDpe.jpg" width="80" height="80" alt="DPE" style={{ maxWidth: '80px', borderRadius: 4 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#e74c3c', marginTop: '4px' }}>DPE</div>
            </td>
          </tr></tbody></table>
          <div style={{ textAlign: 'center', marginTop: '5px', fontSize: '10px' }}>
            <span style={{ display: 'inline-block', marginRight: '12px' }}><span style={{ display: 'inline-block', width: '14px', height: '14px', background: '#7CB5EC', verticalAlign: 'middle', marginRight: '4px' }}></span> Données manquante(s)</span>
            <span style={{ display: 'inline-block', marginRight: '12px' }}><span style={{ display: 'inline-block', width: '14px', height: '14px', background: '#ffff00', verticalAlign: 'middle', marginRight: '4px' }}></span> À vérifier</span>
            <span style={{ display: 'inline-block' }}><span style={{ display: 'inline-block', width: '14px', height: '14px', background: 'rgba(255,0,0,0.75)', verticalAlign: 'middle', marginRight: '4px' }}></span> Attention</span>
          </div>
        </div>

        {/* Info Générales: general stats */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }} border={1} cellPadding={3} cellSpacing={0}>
          <thead>
            <tr style={st.gris}><th style={st.th}>&nbsp;</th><th style={st.th}>Ensemble</th><th style={st.th}>Dont Public</th></tr>
          </thead>
          <tbody>
            {[
              ['Nombre d\'écoles fonctionnelles', fmt(d.ressources?.nbr_etab), fmt(d.ressources?.nbr_etab_pub ?? d.ressources?.nbr_etab)],
              ['Nombre de salles', fmt(d.sections?.nbr_sdc), fmt(d.sections?.nbr_sdc_pub ?? d.sections?.nbr_sdc)],
              ['Nombre d\'écoles fermées (ou fiche non disponible)', fmt(d.ressources?.nbr_etab_ferme ?? '-'), fmt(d.ressources?.nbr_etab_ferme_pub ?? '-')],
              ['Nombre de sections', fmt(d.sections?.nbr_section), fmt(d.sections?.nbr_section_pub ?? d.sections?.nbr_section)],
              ['Nombre de places assises', fmt(d.places?.places_assises), fmt(d.places?.places_assises_pub ?? d.places?.places_assises)],
              ['Effectif des élèves', fmt(d.ressources?.nbr_eleve), fmt(d.ressources?.nbr_eleve_pub ?? d.ressources?.nbr_eleve)],
              ['Dont filles', fmt(d.ressources?.nbr_eleve_f), fmt(d.ressources?.nbr_eleve_f_pub ?? d.ressources?.nbr_eleve_f)],
            ].map(([label, ens, pub]) => (
              <tr key={label as string}><td style={{ ...st.td, textAlign: 'left' }}>{label}</td><td style={{ ...st.td, textAlign: 'right' }}>{ens}</td><td style={{ ...st.td, textAlign: 'right' }}>{pub}</td></tr>
            ))}
          </tbody>
        </table>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '5px' }} border={1} cellPadding={3} cellSpacing={0}>
          <tbody>
            <tr><td style={{ ...st.td, textAlign: 'left' }}>Nombre des CISCOs</td><td style={{ ...st.td, textAlign: 'right' }}>{fmt(d.ressources?.nbr_cisco)}</td></tr>
            <tr><td style={{ ...st.td, textAlign: 'left' }}>Nombre des ZAPs</td><td style={{ ...st.td, textAlign: 'right' }}>{fmt(d.ressources?.nbr_zap)}</td></tr>
          </tbody>
        </table>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '5px' }} border={1} cellPadding={3} cellSpacing={0}>
          <thead>
            <tr style={st.gris}><th style={st.th}>&nbsp;</th><th style={st.th}>Ensemble</th><th style={st.th}>Dont Public</th></tr>
          </thead>
          <tbody>
            {[
              ['Nombre enseignants en classe', fmt(d.personnel?.pers_en_classe), fmt(d.personnel?.pers_en_classe_pub ?? d.personnel?.pers_en_classe)],
              ['Fonctionnaire et contractuels', fmt(d.personnel?.fonctionnaire), fmt(d.personnel?.fonctionnaire_pub ?? d.personnel?.fonctionnaire)],
              ['FRAM subventionnés', fmt(d.personnel?.sub), fmt(d.personnel?.sub_pub ?? d.personnel?.sub)],
              ['FRAM non subventionnés', fmt(d.personnel?.non_sub), fmt(d.personnel?.non_sub_pub ?? d.personnel?.non_sub)],
            ].map(([label, ens, pub]) => (
              <tr key={label as string}><td style={{ ...st.td, textAlign: 'left' }}>{label}</td><td style={{ ...st.td, textAlign: 'right' }}>{ens}</td><td style={{ ...st.td, textAlign: 'right' }}>{pub}</td></tr>
            ))}
          </tbody>
        </table>
          </div>
          </div>

          {/* ===== TAB 1: RÉSULTATS ===== */}
          <div>
          <div ref={(el) => { sectionRefs.current[1] = el; }} style={{ padding: '10px', background: '#fff' }}>
        <div style={st.titre}><b>Résultats Scolaires</b></div>
        {(() => {
          const rateRed = drenRepeat;
          const ratePromo = drenPromotion;
          const rateAband = drenAbandon;
          const cycleAvg = (lvl: any, fn: (l: any, i: number) => number | null, _levels: number[]) => fn === rateRed ? drenRepeat(lvl) : drenCycleRate(lvl, fn === ratePromo ? 'promotion' : 'abandon');
          const show = (v: number | null) => drenFormat(v, ' %');
          const NIV = [['CP1', 1], ['CP2', 2], ['CE', 3], ['CM1', 4], ['CM2', 5]] as [string, number][];

          // rows genre pour redoublants (seules données genrées disponibles)
          const redF = (lvl: any) => drenRepeat(lvl, undefined, '_f');
          const redG = (lvl: any) => drenRepeat(lvl, undefined, '_g');
          const retF = (lvl: any) => drenRetention(lvl, 5, '_f');
          const retG = (lvl: any) => drenRetention(lvl, 5, '_g');

          const fluxTable = (
            titre: string,
            fn: (l: any, i: number) => number | null,
            levels: number[],
            genre?: { f: (l: any) => number | null; g: (l: any) => number | null; worseIsHigh: boolean },
          ) => (
            <table style={{ width: '100%', borderCollapse: 'collapse' }} border={1} cellPadding={2} cellSpacing={0}>
              <thead>
                <tr style={st.gris}><th colSpan={3} style={st.th}>{titre}</th></tr>
                <tr><th style={{ ...st.th, width: '44%' }}>Niveau</th><th style={{ ...st.th, fontSize: '10px' }}>DREN</th><th style={{ ...st.th, fontSize: '10px' }}>MADA</th></tr>
              </thead>
              <tbody>
                {NIV.filter(([, i]) => levels.includes(i)).map(([label, i]) => {
                  const dv = fn(d, i), mv = fn(m, i);
                  return (
                    <tr key={label}>
                      <td style={{ ...st.td, fontSize: '10px' }}>{label}</td>
                      <td style={{ ...st.td, textAlign: 'right', ...manq(show(dv)) }}>{show(dv)}</td>
                      <td style={{ ...st.td, textAlign: 'right', ...manq(show(mv)) }}>{show(mv)}</td>
                    </tr>
                  );
                })}
                <tr style={{ fontWeight: 'bold' }}>
                  <td style={{ ...st.td, fontSize: '10px' }}>Dans le cycle</td>
                  <td style={{ ...st.td, textAlign: 'right' }}>{show(cycleAvg(d, fn, levels))}</td>
                  <td style={{ ...st.td, textAlign: 'right' }}>{show(cycleAvg(m, fn, levels))}</td>
                </tr>
                <tr>
                  <td style={{ ...st.td, fontSize: '10px', paddingLeft: 12 }}>- Dont Filles</td>
                  {[d, m].map((lvl, i) => { const v = genre ? genre.f(lvl) : null; return <td key={i} style={{ ...st.td, textAlign: 'right', ...manq(show(v)) }}>{show(v)}</td>; })}
                </tr>
                <tr>
                  <td style={{ ...st.td, fontSize: '10px', paddingLeft: 12 }}>- Dont Garçons</td>
                  {[d, m].map((lvl, i) => { const v = genre ? genre.g(lvl) : null; return <td key={i} style={{ ...st.td, textAlign: 'right', ...manq(show(v)) }}>{show(v)}</td>; })}
                </tr>
                <tr>
                  <td style={{ ...st.td, fontSize: '10px', paddingLeft: 12 }}>- Disparité au dépens des</td>
                  {[d, m].map((lvl, i) => {
                    let kind: 'f' | 'g' | null = null;
                    if (genre) {
                      const vf = genre.f(lvl), vg = genre.g(lvl);
                      if (vf !== null && vg !== null && vf !== vg) kind = genre.worseIsHigh ? (vf > vg ? 'f' : 'g') : (vf < vg ? 'f' : 'g');
                    }
                    return <td key={i} style={{ ...st.td, textAlign: 'center' }}><DisparityIcon kind={kind} size={26} /></td>;
                  })}
                </tr>
              </tbody>
            </table>
          );

          return (
            <>
              {/* --- Couverture + profil de rétention --- */}
              <table style={{ width: '100%', borderCollapse: 'collapse' }} cellPadding={0} cellSpacing={0}><tbody><tr>
                <td style={{ width: '50%', verticalAlign: 'top', paddingRight: 4 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }} border={1} cellPadding={2} cellSpacing={0}>
                    <thead>
                      <tr style={st.gris}><th style={{ ...st.th, width: '50%' }}>Couverture</th><th style={st.th}>Votre DREN</th><th style={st.th}>MADA</th></tr>
                    </thead>
                    <tbody>
                      {[
                        ...drenCoverage(d).map((row, i) => [row.label, drenFormat(row.value, row.unit), drenFormat(drenCoverage(m)[i].value, row.unit)]),
                      ].map(([label, dv, mv]: any) => (
                        <tr key={label}>
                          <td style={{ ...st.td, textAlign: 'left', fontSize: '10px' }}>{label}</td>
                          <td style={{ ...st.td, textAlign: 'right', ...manq(dv) }}>{dv}</td>
                          <td style={{ ...st.td, textAlign: 'right', ...manq(mv) }}>{mv}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </td>
                <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: 4 }}>
                  <div style={{ border: '1px solid #333', padding: 6, background: '#fafafa' }}>
                    <div style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 4 }}>Profil de rétention — taux d’accès par classe</div>
                    <ResponsiveContainer width="100%" height={190}>
                      <LineChart data={retentionProfile} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="niveau" tick={{ fontSize: 10 }} />
                        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(value: any) => `${value}%`} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Line type="monotone" dataKey="DREN" name="Profil régional" stroke="#337ab7" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="MADA" name="Profil national" stroke="#111" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </td>
              </tr></tbody></table>

              {/* --- CEPE : scores par matière + admis + genre --- */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }} cellPadding={0} cellSpacing={0}><tbody><tr>
                <td style={{ width: '55%', verticalAlign: 'top', paddingRight: 4 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }} border={1} cellPadding={1} cellSpacing={0}>
                    <thead>
                      <tr style={st.gris}><th colSpan={6} style={{ ...st.th, fontSize: '10px' }}>RÉSULTAT AU CEPE — Score moyen (SM) /20 et % d'élèves ≥ 10/20 ({tdbData.examen_annee ?? tdbData.annee})</th></tr>
                      <tr>
                        <th style={{ ...st.th, width: '30%' }} rowSpan={2} colSpan={2}>Matières</th>
                        <th style={st.th} colSpan={2}>Votre DREN</th>
                        <th style={st.th} colSpan={2}>MADA</th>
                      </tr>
                      <tr>
                        <td style={{ ...st.td, textAlign: 'center' }}><b>SM</b></td><td style={{ ...st.td, textAlign: 'center' }}><b>%≥10</b></td>
                        <td style={{ ...st.td, textAlign: 'center' }}><b>SM</b></td><td style={{ ...st.td, textAlign: 'center' }}><b>%≥10</b></td>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const smFmt = (v: any) => { const n = drenNumber(v); return drenFormat(n !== null && n >= 0 && n <= 20 ? n : null); };
                        const row = (label: string, smK: string, nK: string, isSub = false) => {
                          const dSm = smFmt(d.cepe?.[smK]), mSm = smFmt(m.cepe?.[smK]);
                          const dN = drenFormat(drenExamThreshold(d, nK), ' %'), mN = drenFormat(drenExamThreshold(m, nK), ' %');
                          return (
                            <tr key={label}>
                              {isSub ? <td colSpan={2} style={{ ...st.td, paddingLeft: '10px' }}>{label}</td> : <th colSpan={2} style={{ ...st.td, textAlign: 'left', fontWeight: 'bold' }}>{label}</th>}
                              <td style={{ ...st.td, textAlign: 'center', ...manq(dSm) }}>{dSm}</td>
                              <td style={{ ...st.td, textAlign: 'center', ...manq(dN) }}>{dN}</td>
                              <td style={{ ...st.td, textAlign: 'center', ...manq(mSm) }}>{mSm}</td>
                              <td style={{ ...st.td, textAlign: 'center', ...manq(mN) }}>{mN}</td>
                            </tr>
                          );
                        };
                        return (<>
                          {row('Malagasy', 'sm_mlg', 'mlg_sup10')}
                          {row('Français', 'sm_frs', 'frs_sup10')}
                          {row('Mathématique', 'sm_mths', 'mths_sup10')}
                          {row('-Opération', 'sm_mths_operation', 'op_sup10', true)}
                          {row('-Problème', 'sm_mths_probleme', 'prob_sup10', true)}
                          {row('Histoire', 'sm_histoire', 'histoire_sup10')}
                          {row('Géographie', 'sm_geographie', 'geographie_sup10')}
                          {row('SVT', 'sm_svt', 'svt_sup10')}
                        </>);
                      })()}
                    </tbody>
                  </table>
                </td>
                <td style={{ width: '45%', verticalAlign: 'top', paddingLeft: 4 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }} border={1} cellPadding={1} cellSpacing={0}>
                    <thead>
                      <tr style={st.gris}><th colSpan={3} style={st.th}>Admis au CEPE / inscrits CM2</th></tr>
                      <tr><th style={{ ...st.th, width: '44%' }}>&nbsp;</th><th style={{ ...st.th, fontSize: '10px' }}>DREN</th><th style={{ ...st.th, fontSize: '10px' }}>MADA</th></tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const pctDirect = (lvl: any, _key: string, numKey: string, _denKey: string) => drenFormat(drenAdmission(lvl, numKey === 'admis_f' ? '_f' : '_g'), ' %');
                        const pctEns = (lvl: any) => drenFormat(drenAdmission(lvl), ' %');
                        const dispKind = (lvl: any) => {
                          const f = pctVal(lvl.cepe?.admis_f, lvl.cepe?.nbr_f), g = pctVal(lvl.cepe?.admis_g, lvl.cepe?.nbr_g);
                          if (f === null || g === null || f === g) return null;
                          return f < g ? 'f' : 'g';
                        };
                        return (<>
                          <tr><td style={{ ...st.td, fontSize: '10px' }}><GenderLabel gender="f" /></td>{[d, m].map((lvl, i) => <td key={i} style={{ ...st.td, textAlign: 'right' }}>{pctDirect(lvl, 'tx_admis_f', 'admis_f', 'nbr_f')}</td>)}</tr>
                          <tr><td style={{ ...st.td, fontSize: '10px' }}><GenderLabel gender="g" /></td>{[d, m].map((lvl, i) => <td key={i} style={{ ...st.td, textAlign: 'right' }}>{pctDirect(lvl, 'tx_admis_g', 'admis_g', 'nbr_g')}</td>)}</tr>
                          <tr style={{ fontWeight: 'bold' }}><td style={{ ...st.td, fontSize: '10px' }}>Ensemble</td>{[d, m].map((lvl, i) => <td key={i} style={{ ...st.td, textAlign: 'right' }}>{pctEns(lvl)}</td>)}</tr>
                          <tr><td style={{ ...st.td, fontSize: '10px' }}>Disparité au dépens des</td>{[d, m].map((lvl, i) => <td key={i} style={{ ...st.td, textAlign: 'center' }}><DisparityIcon kind={dispKind(lvl) as any} size={26} /></td>)}</tr>
                        </>);
                      })()}
                    </tbody>
                  </table>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4 }} border={1} cellPadding={1} cellSpacing={0}>
                    <thead>
                      <tr style={st.gris}><th colSpan={3} style={st.th}>Taux de rétention par genre</th></tr>
                      <tr><th style={{ ...st.th, width: '44%' }}>&nbsp;</th><th style={{ ...st.th, fontSize: '10px' }}>DREN</th><th style={{ ...st.th, fontSize: '10px' }}>MADA</th></tr>
                    </thead>
                    <tbody>
                      <tr><td style={{ ...st.td, fontSize: '10px' }}><GenderLabel gender="f" /></td>{[d, m].map((lvl, i) => <td key={i} style={{ ...st.td, textAlign: 'right' }}>{show(retF(lvl))}</td>)}</tr>
                      <tr><td style={{ ...st.td, fontSize: '10px' }}><GenderLabel gender="g" /></td>{[d, m].map((lvl, i) => <td key={i} style={{ ...st.td, textAlign: 'right' }}>{show(retG(lvl))}</td>)}</tr>
                      <tr style={{ fontWeight: 'bold' }}><td style={{ ...st.td, fontSize: '10px' }}>Ensemble</td>{[d, m].map((lvl, i) => <td key={i} style={{ ...st.td, textAlign: 'right' }}>{show(drenRetention(lvl, 5))}</td>)}</tr>
                      <tr><td style={{ ...st.td, fontSize: '10px' }}>Disparité au dépens des</td>{[d, m].map((lvl, i) => {
                        const f = retF(lvl), g = retG(lvl);
                        const kind = f === null || g === null || f === g ? null : (f < g ? 'f' : 'g');
                        return <td key={i} style={{ ...st.td, textAlign: 'center' }}><DisparityIcon kind={kind as any} size={26} /></td>;
                      })}</tr>
                    </tbody>
                  </table>
                </td>
              </tr></tbody></table>

              {/* --- Taux de flux : redoublement / promotion / abandon --- */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }} cellPadding={0} cellSpacing={0}><tbody><tr>
                <td style={{ width: '33.33%', verticalAlign: 'top', paddingRight: 3 }}>
                  {fluxTable('Pourcentage de redoublants (en %)', rateRed, [1, 2, 3, 4, 5], { f: redF, g: redG, worseIsHigh: true })}
                </td>
                <td style={{ width: '33.33%', verticalAlign: 'top', padding: '0 3px' }}>
                  {fluxTable('Taux de promotion (en %)', ratePromo, [1, 2, 3, 4])}
                </td>
                <td style={{ width: '33.33%', verticalAlign: 'top', paddingLeft: 3 }}>
                  {fluxTable('Taux d\'abandon (en %)', rateAband, [1, 2, 3, 4])}
                </td>
              </tr></tbody></table>
            </>
          );
        })()}

          </div>
          </div>

          {/* ===== TAB 2: RESSOURCES ===== */}
          <div>
          <div ref={(el) => { sectionRefs.current[2] = el; }} style={{ padding: '10px', background: '#fff' }}>
        <div style={st.titre}><b>Ressources</b></div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }} cellSpacing={0}><tbody><tr>
          <td style={{ width: '50%', verticalAlign: 'top' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }} border={1} cellPadding={1} cellSpacing={0}>
              <thead><tr><th style={{ ...st.th, width: '50%' }}>&nbsp;</th><th style={{ ...st.gris, width: '25%', fontSize: '10px' }}>DREN</th><th style={{ ...st.gris, width: '25%', fontSize: '10px' }}>MADA</th></tr></thead>
              <tbody>
                {[
                  ['Nombre d\'écoles fonctionnelles', [fmt(d.ressources.nbr_etab), fmt(m.ressources.nbr_etab)]],
                  ['Nombre d\'élèves', [fmt(d.ressources.nbr_eleve), fmt(m.ressources.nbr_eleve)]],
                  ['Nombre d\'enseignant en classe', [fmt(d.personnel.pers_en_classe), fmt(m.personnel.pers_en_classe)]],
                  ['Fonctionnaire et contractuels', [fmt(d.personnel.fonctionnaire), fmt(m.personnel.fonctionnaire)]],
                  ['FRAM subventionnés', [fmt(d.personnel.sub), fmt(m.personnel.sub)]],
                  ['FRAM non subventionnés', [fmt(d.personnel.non_sub), fmt(m.personnel.non_sub)]],
                  ['Nombre de classes pédagogiques', [fmt(d.sections.nbr_section), fmt(m.sections.nbr_section)]],
                ].map(([label, vals]: any) => (
                  <tr key={label}><td style={st.td}>{label}</td>{vals.map((v: string, i: number) => <td key={i} style={{ ...st.td, textAlign: 'right', ...manq(v) }}>{v}</td>)}</tr>
                ))}
              </tbody>
            </table>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '3px' }} border={1} cellPadding={1} cellSpacing={0}>
              <thead><tr><th style={{ ...st.th, width: '50%' }}>&nbsp;</th><th style={{ ...st.gris, width: '25%', fontSize: '10px' }}>DREN</th><th style={{ ...st.gris, width: '25%', fontSize: '10px' }}>MADA</th></tr></thead>
              <tbody>
                {[
                  ['Écoles continues', [pct(d.ressources.ecole_continue, d.ressources.nbr_etab), pct(m.ressources.ecole_continue, m.ressources.nbr_etab)]],
                  ['Élèves < 2km', [pct(d.ressources.eleve_2km, d.ressources.nbr_eleve), pct(m.ressources.eleve_2km, m.ressources.nbr_eleve)]],
                  ['Écoles avec eau', [pct(d.ressources.etab_eau, d.ressources.nbr_etab, 0), pct(m.ressources.etab_eau, m.ressources.nbr_etab, 0)]],
                  ['Écoles avec électricité', [pct(d.ressources.etab_elec, d.ressources.nbr_etab, 0), pct(m.ressources.etab_elec, m.ressources.nbr_etab, 0)]],
                ].map(([label, vals]: any) => (
                  <tr key={label}><td style={st.td}>{label}</td>{vals.map((v: string, i: number) => <td key={i} style={{ ...st.td, textAlign: 'right', ...manq(v) }}>{v}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </td>
          <td style={{ width: '50%', verticalAlign: 'top' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }} border={1} cellPadding={1} cellSpacing={0}>
              <thead><tr><th style={{ ...st.th, width: '50%' }}>&nbsp;</th><th style={{ ...st.gris, width: '25%', fontSize: '10px' }}>DREN</th><th style={{ ...st.gris, width: '25%', fontSize: '10px' }}>MADA</th></tr></thead>
              <tbody>
                {[
                  ['Élèves par maître', [ratio(d.ressources.nbr_eleve, d.personnel.pers_en_classe, 0), ratio(m.ressources.nbr_eleve, m.personnel.pers_en_classe, 0)]],
                  ['% sans diplôme péd.', [pct(d.personnel.sans_diplome_ped, d.personnel.pers_en_classe), pct(m.personnel.sans_diplome_ped, m.personnel.pers_en_classe)]],
                  ['Classes péd. / salle', [ratio(d.sections.nbr_section, d.sections.nbr_sdc, 0), ratio(m.sections.nbr_section, m.sections.nbr_sdc, 0)]],
                  ['Élèves / place assise', [ratio(d.ressources.nbr_eleve, d.places.places_assises), ratio(m.ressources.nbr_eleve, m.places.places_assises)]],
                  ['Élèves / Latrine', [ratio(d.ressources.nbr_eleve, d.places.latrines, 0), ratio(m.ressources.nbr_eleve, m.places.latrines, 0)]],
                  ['Filles / latrine fille', [ratio(d.ressources.nbr_eleve_f, d.places.latrines_fille, 0), ratio(m.ressources.nbr_eleve_f, m.places.latrines_fille, 0)]],
                  ['Élèves / manuel Malagasy', [ratio(d.ressources.nbr_eleve, d.manuels?.malagasy, 0), ratio(m.ressources.nbr_eleve, m.manuels?.malagasy, 0)]],
                ].map(([label, vals]: any) => (
                  <tr key={label}><td style={st.td}>{label}</td>{vals.map((v: string, i: number) => <td key={i} style={{ ...st.td, textAlign: 'right', ...manq(v) }}>{v}</td>)}</tr>
                ))}
                <tr><td style={{ ...st.td, paddingLeft: '10px' }}>-Mathématique</td>{[ratio(d.ressources.nbr_eleve, d.manuels?.maths, 0), ratio(m.ressources.nbr_eleve, m.manuels?.maths, 0)].map((v, i) => <td key={i} style={{ ...st.td, textAlign: 'right', ...manq(v) }}>{v}</td>)}</tr>
                <tr><td style={{ ...st.td, paddingLeft: '10px' }}>-Français</td>{[ratio(d.ressources.nbr_eleve, d.manuels?.francais, 0), ratio(m.ressources.nbr_eleve, m.manuels?.francais, 0)].map((v, i) => <td key={i} style={{ ...st.td, textAlign: 'right', ...manq(v) }}>{v}</td>)}</tr>
              </tbody>
            </table>

          </td>
        </tr></tbody></table>

          </div>
          </div>

          <DrenReferenceTables dren={d} mada={m} />
          <p className="text-xs text-muted-foreground">— : donnée indisponible ou incohérente. Les indicateurs de population, d’acquis scolaires et de flux annuels nécessitent leurs sources correspondantes.</p>
          {/* ===== TAB 3: GOULOT ET EFFICIENCE ===== */}
          <div>
          <div ref={(el) => { sectionRefs.current[3] = el; }} style={{ padding: '10px', background: '#fff' }}>
        <div style={st.titre}><b>Goulot d'Étranglement du système</b></div>
        {(() => {
          const goulot = drenBottlenecks(d).map((row, i) => ({ ind: row.label, DREN: row.value, MADA: drenBottlenecks(m)[i].value }));
          const compared = goulot.filter((g): g is { ind: string; DREN: number; MADA: number } => g.DREN !== null && g.MADA !== null);
          const critiques = compared.filter(g => g.DREN < g.MADA).sort((a, b) => (a.DREN - a.MADA) - (b.DREN - b.MADA)).slice(0, 3);
          return (
            <>
              <div style={{ border: '1px solid #000', padding: '10px', marginBottom: 8 }}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={goulot} margin={{ top: 10, right: 20, left: 10, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="ind" tick={{ fontSize: 9 }} interval={0} angle={-25} textAnchor="end" height={70} />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: any) => `${v}%`} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="DREN" fill="#337ab7" />
                    <Bar dataKey="MADA" fill="#c0c0c0" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={st.titre}><b>Efficience et diagnostic du système</b></div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }} cellPadding={0} cellSpacing={0}><tbody><tr>
                <td style={{ width: '55%', verticalAlign: 'top', paddingRight: 4 }}>
                  <div style={{ border: '1px solid #000', padding: '8px' }}>
                    <h4 style={{ textAlign: 'center', fontSize: '11px', fontWeight: 'bold', marginBottom: '6px' }}>{efficienceTitre}</h4>
                    <EfficienceGrid
                      entity={drenEfficienceEntity(d)}
                      scope="dren"
                      parentPoint={{ name: 'MADAGASCAR', ...drenEfficience(m) }}
                      niveau="primaire"
                      entityLabel="DREN"
                      points={efficienceData}
                      pointsTitle="Comparaison des entités"
                    />
                  </div>

                </td>
                <td style={{ width: '45%', verticalAlign: 'top', paddingLeft: 4 }}>
                  <div style={{ border: '1px solid #000' }}>
                    <div style={{ ...st.gris, padding: '4px 6px', fontSize: 11 }}>Conclusion</div>
                    <div style={{ padding: '6px 8px', fontSize: 10, lineHeight: 1.55 }}>
                      {(() => {
                        const forts = compared.filter((g) => g.DREN >= g.MADA).sort((a, b) => (b.DREN - b.MADA) - (a.DREN - a.MADA));
                        return (
                          <>
                            <div style={{ marginBottom: 4 }}>
                              Sur les {compared.length} indicateurs comparés à la moyenne nationale,
                              {' '}<b>{forts.length}</b> sont au niveau ou au-dessus et
                              {' '}<b>{critiques.length ? compared.length - forts.length : 0}</b>{(critiques.length ? compared.length - forts.length : 0) > 1 ? ' sont en retard.' : ' est en retard.'}
                            </div>
                            {critiques.length > 0 ? (
                              <div style={{ marginBottom: 4 }}>
                                Les points à traiter en priorité sont :
                                <ul style={{ margin: '2px 0 0', padding: '0 0 0 18px' }}>
                                  {critiques.map((c) => (
                                    <li key={c.ind}>
                                      {c.ind} — {c.DREN.toFixed(1)} % contre {c.MADA.toFixed(1)} % au niveau national
                                      {' '}(écart de {(c.MADA - c.DREN).toFixed(1)} point{Math.abs(c.MADA - c.DREN) >= 2 ? 's' : ''}).
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : (
                              <div style={{ marginBottom: 4 }}>{compared.length ? 'Aucun indicateur disponible ne se situe en dessous de la moyenne nationale.' : 'Comparaison nationale indisponible : données insuffisantes.'}</div>
                            )}
                            {forts.length > 0 && (
                              <div>Point d'appui : {forts[0].ind} ({forts[0].DREN.toFixed(1)} % contre {forts[0].MADA.toFixed(1)} % au national).</div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </td>
              </tr></tbody></table>
            </>
          );
        })()}
          </div>
          </div>
        </div>
      </div>
    );
  };

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
        onPrint={tdbData || niveauData ? () => { if (printRef.current) printTdb(printRef.current, docName); } : undefined}
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
