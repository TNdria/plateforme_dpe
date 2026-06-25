import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, FileDown, Building2, Printer, Eye } from 'lucide-react';
import { PDFViewer } from '@/components/pdf/PDFViewer';
import { dashboardApi, tdbApi, Dren, Cisco } from '@/services/api';
import { printTdb } from '@/utils/printTdb';
import { generateMultiPagePdf } from '@/utils/multiPagePdf';
import { GenderLabel } from '@/components/score/GenderRow';
import { ScoreY, computeScoreY } from '@/components/score/ScoreY';
import { TDBShell } from '@/components/tdb/TDBShell';
import { TDBImportDialog } from '@/components/tdb/TDBImportDialog';
import { DisparityIcon } from '@/components/score/DisparityIcon';
import DataActionsBar from '@/components/admin/DataActionsBar';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ScatterChart, Scatter, Cell, ResponsiveContainer, LabelList, ReferenceLine
} from 'recharts';

// Helpers
const fmt = (n: any) => { const v = Number(n); return isNaN(v) ? '-' : new Intl.NumberFormat('fr-FR').format(v); };
const pct = (num: any, den: any, dec = 1) => { const n = Number(num), d = Number(den); if (!d || isNaN(n) || isNaN(d)) return '-'; return (n / d * 100).toFixed(dec) + '%'; };
const pctVal = (num: any, den: any) => { const n = Number(num), d = Number(den); if (!d || isNaN(n) || isNaN(d)) return 0; return Number((n / d * 100).toFixed(1)); };
const ratio = (num: any, den: any, dec = 1) => { const n = Number(num), d = Number(den); if (!d || isNaN(n) || isNaN(d)) return '-'; return (n / d).toFixed(dec); };
const ratioVal = (num: any, den: any) => { const n = Number(num), d = Number(den); if (!d || isNaN(n) || isNaN(d)) return 0; return Number((n / d).toFixed(2)); };
const manq = (val: string | number) => val === '-' || val === '' || val === null || val === undefined ? { background: '#7CB5EC' } : {};

interface TdbData {
  names: { CISCO: string; DREN: string };
  annee: number;
  cisco: any;
  dren: any;
  mada: any;
  efficience: any[];
}

// Helper: render a data cell with auto manquant background
const DC = ({ v, style = {} }: { v: any; style?: React.CSSProperties }) => {
  const val = v === null || v === undefined ? '-' : String(v);
  const isMissing = val === '-' || val === '';
  return <td style={{ padding: '3px', verticalAlign: 'middle', fontSize: '11px', border: '1px solid #333', textAlign: 'right', ...(isMissing ? { background: '#7CB5EC' } : {}), ...style }}>{val}</td>;
};

// ===== Reusable styled components matching cisco.html =====
const styles = {
  titreIndicateur: {
    letterSpacing: '0.2em', textTransform: 'uppercase' as const, width: '99%',
    background: '#337ab7', color: '#fff', padding: '6px 10px', marginTop: '7px', marginBottom: '7px', fontWeight: 'bold', fontSize: '12px'
  },
  gris: { background: '#bbbbcc', textAlign: 'center' as const, fontWeight: 'bold' },
  item: { font: '10px verdana', padding: '3px' },
  td: { padding: '3px', verticalAlign: 'middle' as const, fontSize: '11px', border: '1px solid #333' },
  th: { textAlign: 'center' as const, fontWeight: 'bold', fontSize: '11px', padding: '3px', border: '1px solid #333' },
  mena: { background: 'rgba(255, 0, 0, 0.75)', fontWeight: 700, color: '#fff' },
  mavo: { background: '#ffff00' },
  manquant: { background: '#7CB5EC' },
  manga: { background: '#f1f1f1' },
};

const TDBCisco = () => {
  const [drens, setDrens] = useState<Dren[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [ciscos, setCiscos] = useState<Cisco[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedDren, setSelectedDren] = useState<string>('0');
  const [selectedCisco, setSelectedCisco] = useState<string>('0');
  const [selectedAnnee, setSelectedAnnee] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [tdbData, setTdbData] = useState<TdbData | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null]);

  useEffect(() => {
    dashboardApi.getDrens().then(setDrens).catch(() => toast.error('Erreur DRENs'));
    dashboardApi.getAvailableYears().then((data) => {
      const years = data.map((d: any) => Number(d.annee)).filter((y: number) => !isNaN(y));
      setAvailableYears(years);
      if (years.length > 0) setSelectedAnnee(String(years[0]));
    }).catch(() => toast.error('Erreur années'));
  }, []);

  const handleDrenChange = async (value: string) => {
    setSelectedDren(value); setSelectedCisco('0'); setTdbData(null);
    if (value !== '0') {
      try { const data = await tdbApi.getCiscos(Number(value)); setCiscos(Array.isArray(data) ? data : []); }
      catch { toast.error('Erreur CISCOs'); }
    } else { setCiscos([]); }
  };

  const loadTdb = async () => {
    if (selectedCisco === '0' || selectedDren === '0') return;
    setLoading(true);
    try {
      const data = await tdbApi.getTdbCiscoData(Number(selectedCisco), Number(selectedDren), Number(selectedAnnee));
      setTdbData(data);
      toast.success('Tableau de bord chargé');
    } catch (err) { console.error(err); toast.error('Erreur lors du chargement du TDB'); }
    finally { setLoading(false); }
  };

  const generatePdf = useCallback(async () => {
    if (!tdbData || !printRef.current) return;
    setGeneratingPdf(true);
    try {
      const { openHtmlPdf } = await import('@/utils/htmlToPdf');
      openHtmlPdf(printRef.current, `TDB_CISCO_${tdbData.names.CISCO}_${tdbData.annee}`, 'print');
      toast.success('Boîte de dialogue d\'impression ouverte');
    } catch (err) { console.error(err); toast.error('Erreur PDF'); }
    finally { setGeneratingPdf(false); }
  }, [tdbData]);

  const previewPdf = useCallback(async () => {
    if (!tdbData || !printRef.current) return;
    setGeneratingPreview(true);
    try {
      const { openHtmlPdf } = await import('@/utils/htmlToPdf');
      openHtmlPdf(printRef.current, `TDB_CISCO_${tdbData.names.CISCO}_${tdbData.annee}`, 'preview');
      toast.success('Aperçu ouvert dans un nouvel onglet');
    } catch (e) { console.error(e); toast.error('Erreur aperçu'); }
    finally { setGeneratingPreview(false); }
  }, [tdbData]);

  // Compute "mena" class: if CISCO value is worse than DREN
  const getMenaClass = (ciscoVal: string, drenVal: string, higherIsWorse = true) => {
    const c = parseFloat(ciscoVal), d = parseFloat(drenVal);
    if (isNaN(c) || isNaN(d)) return '';
    return (higherIsWorse ? c > d : c < d) ? 'bg-red-500/75 font-bold' : '';
  };

  const renderTdb = () => {
    if (!tdbData) return null;
    const c = tdbData.cisco, d = tdbData.dren, m = tdbData.mada;
    const anneeDisplay = `${tdbData.annee - 1} - ${tdbData.annee}`;

    // Goulot data
    const goulotData = [
      {
        name: "Pourcentage de Fokontany ayant au\nmoins une École",
        cisco: 100, dren: 100, mada: 100
      },
      {
        name: "Nombre de SdC définitives pour\n1000 enfants d'âge scolaire",
        cisco: ratioVal(Number(c.sections?.nbr_sdc || 0) * 1000, c.ressources?.nbr_eleve),
        dren: ratioVal(Number(d.sections?.nbr_sdc || 0) * 1000, d.ressources?.nbr_eleve),
        mada: ratioVal(Number(m.sections?.nbr_sdc || 0) * 1000, m.ressources?.nbr_eleve),
      },
      {
        name: "Nombre d'enseignants pour\n1000 enfants d'âge scolaire",
        cisco: ratioVal(Number(c.personnel?.pers_en_classe || 0) * 1000, c.ressources?.nbr_eleve),
        dren: ratioVal(Number(d.personnel?.pers_en_classe || 0) * 1000, d.ressources?.nbr_eleve),
        mada: ratioVal(Number(m.personnel?.pers_en_classe || 0) * 1000, m.ressources?.nbr_eleve),
      },
      {
        name: "Nombre de places assises par\nenfants d'âge scolaire",
        cisco: ratioVal(c.places?.places_assises, c.ressources?.nbr_eleve) * 100,
        dren: ratioVal(d.places?.places_assises, d.ressources?.nbr_eleve) * 100,
        mada: ratioVal(m.places?.places_assises, m.ressources?.nbr_eleve) * 100,
      },
      {
        name: "Nombre de lot de\nmanuels(malagasy,maths,frs) par\nenfants d'âge scolaire",
        cisco: ratioVal((Number(c.manuels?.malagasy||0)+Number(c.manuels?.maths||0)+Number(c.manuels?.francais||0))/3, c.ressources?.nbr_eleve) * 100,
        dren: ratioVal((Number(d.manuels?.malagasy||0)+Number(d.manuels?.maths||0)+Number(d.manuels?.francais||0))/3, d.ressources?.nbr_eleve) * 100,
        mada: ratioVal((Number(m.manuels?.malagasy||0)+Number(m.manuels?.maths||0)+Number(m.manuels?.francais||0))/3, m.ressources?.nbr_eleve) * 100,
      },
      {
        name: "Taux de rétention",
        cisco: pctVal(c.ressources?.ecole_continue, c.ressources?.nbr_etab),
        dren: pctVal(d.ressources?.ecole_continue, d.ressources?.nbr_etab),
        mada: pctVal(m.ressources?.ecole_continue, m.ressources?.nbr_etab),
      },
      {
        name: "Pourcentage des admis au CEPE",
        cisco: pctVal(Number(c.cepe?.admis_g||0)+Number(c.cepe?.admis_f||0), Number(c.cepe?.nbr_g||0)+Number(c.cepe?.nbr_f||0)),
        dren: pctVal(Number(d.cepe?.admis_g||0)+Number(d.cepe?.admis_f||0), Number(d.cepe?.nbr_g||0)+Number(d.cepe?.nbr_f||0)),
        mada: pctVal(Number(m.cepe?.admis_g||0)+Number(m.cepe?.admis_f||0), Number(m.cepe?.nbr_g||0)+Number(m.cepe?.nbr_f||0)),
      },
    ];

    // Efficience scatter data
    const efficienceData = (tdbData.efficience || []).map((item: any) => {
      const nbrEleve = Number(item.nbr_eleve || 0);
      const persEnClasse = Number(item.pers_en_classe || 0);
      const admis = Number(item.admis || 0);
      const inscrits = Number(item.inscrits_cepe || 0);
      const ressourcesScore = persEnClasse > 0 && nbrEleve > 0 ? (persEnClasse / nbrEleve * 100) : 0;
      const resultatsScore = inscrits > 0 ? (admis / inscrits * 100) : 0;
      return {
        name: item.CISCO || '',
        code: item.CODE_CISCO,
        x: Number(ressourcesScore.toFixed(1)),
        y: Number(resultatsScore.toFixed(1)),
        isCurrent: Number(item.CODE_CISCO) === Number(selectedCisco),
      };
    });

    return (
      <div style={{ width: '100%', maxWidth: '1191px', margin: '0 auto', font: '12px verdana', background: '#fff' }}>
        <div className="w-full space-y-3">
          {/* ===== TAB 0: RÉSULTATS ===== */}
          <div>
          <div ref={(el) => { sectionRefs.current[0] = el; }} style={{ padding: '10px', background: '#fff' }}>
        <div style={{ border: '2px solid #000', padding: '15px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ width: '15%', verticalAlign: 'top', textAlign: 'center' }}>
                  <img src="/img/logoMen.jpg" width="90" height="90" alt="MEN" style={{ maxWidth: '90px' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </td>
                <td style={{ width: '70%', textAlign: 'center', verticalAlign: 'top' }}>
                  <b style={{ fontSize: '14px' }}>Ministère de l'Éducation Nationale</b>
                  <br />
                  <b style={{ fontSize: '13px' }}>TABLEAU DE BORD DE LA CISCO : {anneeDisplay}</b>
                  <br />
                  <span style={{ fontSize: '12px' }}>
                    DREN : <b>{tdbData.names.DREN}</b> &nbsp;&nbsp;
                    CISCO : <b>{tdbData.names.CISCO}</b> &nbsp;&nbsp;
                    Code : <b>{selectedCisco}</b>
                  </span>
                  {(() => {
                    const red_ensemble = pctVal(Number(c.ressources?.red_g||0)+Number(c.ressources?.red_f||0), c.ressources?.nbr_eleve);
                    const txRetentionTotal = pctVal(c.ressources?.eff_t5, c.ressources?.eff_t1);
                    const TPA = Number(c.ressources?.tpa || 0);
                    const tx_admis = pctVal(Number(c.cepe?.admis_g||0)+Number(c.cepe?.admis_f||0), Number(c.cepe?.nbr_g||0)+Number(c.cepe?.nbr_f||0));
                    const y = computeScoreY({ red_ensemble, txRetentionTotal, TPA, tx_admis });
                    return (
                      <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 10px', background: '#f5f7fa', border: '1px solid #ccd', borderRadius: 6 }}>
                        <span style={{ fontSize: 11, color: '#555' }}>Score Y :</span>
                        <ScoreY value={y} size={28} showLabel />
                      </div>
                    );
                  })()}
                </td>
                <td style={{ width: '15%', verticalAlign: 'top', textAlign: 'center' }}>
                  <img src="/img/logoDpe.jpg" width="80" height="80" alt="DPE" style={{ maxWidth: '80px', borderRadius: 4 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#e74c3c', marginTop: '4px' }}>DPE</div>
                </td>
              </tr>
            </tbody>
          </table>
          <div style={{ textAlign: 'center', marginTop: '5px', fontSize: '10px' }}>
            <span style={{ display: 'inline-block', marginRight: '12px' }}><span style={{ display: 'inline-block', width: '14px', height: '14px', background: '#7CB5EC', verticalAlign: 'middle', marginRight: '4px' }}></span> Données manquante(s)</span>
            <span style={{ display: 'inline-block', marginRight: '12px' }}><span style={{ display: 'inline-block', width: '14px', height: '14px', background: '#ffff00', verticalAlign: 'middle', marginRight: '4px' }}></span> À vérifier</span>
            <span style={{ display: 'inline-block' }}><span style={{ display: 'inline-block', width: '14px', height: '14px', background: 'rgba(255,0,0,0.75)', verticalAlign: 'middle', marginRight: '4px' }}></span> Attention</span>
          </div>
        </div>

        {/* ===== RÉSULTATS SCOLAIRES ===== */}
        <div style={styles.titreIndicateur}><b>Résultats Scolaires</b></div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }} cellPadding={0} cellSpacing={0}>
          <tbody>
            <tr>
              {/* LEFT COLUMN */}
              <td style={{ width: '50%', verticalAlign: 'top' }}>

                {/* Taux d'abandon + Pourcentage des redoublants */}
                <table style={{ width: '100%' }}>
                  <tbody>
                    <tr>
                      <td style={{ width: '50%', verticalAlign: 'top' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }} border={1} cellPadding={2} cellSpacing={0}>
                          <thead>
                            <tr style={styles.gris}><th colSpan={4} style={styles.th}>Taux d'abandon</th></tr>
                            <tr>
                              <th style={{ ...styles.th, width: '34%' }}>Classe</th>
                              <th style={{ ...styles.th, width: '22%', fontSize: '10px' }}>CISCO</th>
                              <th style={{ ...styles.th, width: '22%', fontSize: '10px' }}>DREN</th>
                              <th style={{ ...styles.th, width: '22%', fontSize: '10px' }}>MADA</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr><td colSpan={4}>&nbsp;</td></tr>
                            {[
                              ['CP1->CP2', 'eff_t1', 'eff_t2', 'red_t1', 'red_t2'],
                              ['CP2->CE', 'eff_t2', 'eff_t3', 'red_t2', 'red_t3'],
                              ['CE->CM1', 'eff_t3', 'eff_t4', 'red_t3', 'red_t4'],
                              ['CM1->CM2', 'eff_t4', 'eff_t5', 'red_t4', 'red_t5'],
                            ].map(([label, from, to, redFrom, redTo]) => {
                              const ab = (lvl: any) => {
                                const effFrom = Number(lvl.ressources[from]||0);
                                const effTo = Number(lvl.ressources[to]||0);
                                const rFrom = Number(lvl.ressources[redFrom]||0);
                                const rTo = Number(lvl.ressources[redTo]||0);
                                if (!effFrom) return '-';
                                return Math.max(0, (effFrom - effTo + rTo - rFrom) / effFrom * 100).toFixed(1) + '%';
                              };
                              const abC = ab(c), abD = ab(d), abM = ab(m);
                              return (
                                <tr key={label}>
                                  <td style={{ ...styles.td, fontSize: '10px' }}>{label}</td>
                                  <td style={{ ...styles.td, textAlign: 'right', ...manq(abC) }}>{abC}</td>
                                  <td style={{ ...styles.td, textAlign: 'right', ...manq(abD) }}>{abD}</td>
                                  <td style={{ ...styles.td, textAlign: 'right', ...manq(abM) }}>{abM}</td>
                                </tr>
                              );
                            })}
                            <tr style={{ fontWeight: 'bold' }}>
                              <td style={{ ...styles.td, fontSize: '10px' }}>Ensemble</td>
                              {[c, d, m].map((lvl, i) => {
                                const rates = [['eff_t1','eff_t2','red_t1','red_t2'],['eff_t2','eff_t3','red_t2','red_t3'],['eff_t3','eff_t4','red_t3','red_t4'],['eff_t4','eff_t5','red_t4','red_t5']];
                                const vals = rates.map(([f,t,rf,rt]) => {
                                  const eF = Number(lvl.ressources[f]||0), eT = Number(lvl.ressources[t]||0);
                                  const rF = Number(lvl.ressources[rf]||0), rT = Number(lvl.ressources[rt]||0);
                                  return eF > 0 ? Math.max(0, (eF - eT + rT - rF) / eF * 100) : null;
                                }).filter(v => v !== null);
                                const val = vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) + '%' : '-';
                                return <td key={i} style={{ ...styles.td, textAlign: 'right', ...manq(val) }}>{val}</td>;
                              })}
                            </tr>
                          </tbody>
                        </table>
                      </td>
                      <td style={{ width: '50%', verticalAlign: 'top' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }} border={1} cellPadding={2} cellSpacing={0}>
                          <thead>
                            <tr style={styles.gris}><th colSpan={4} style={styles.th}>Pourcentage des redoublants</th></tr>
                            <tr>
                              <th style={{ ...styles.th, width: '34%' }}>&nbsp;</th>
                              <th style={{ ...styles.th, width: '22%', fontSize: '10px' }}>CISCO</th>
                              <th style={{ ...styles.th, width: '22%', fontSize: '10px' }}>DREN</th>
                              <th style={{ ...styles.th, width: '22%', fontSize: '10px' }}>MADA</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr><td colSpan={4}>&nbsp;</td></tr>
                            {[['CP1→CP2',1],['CP2→CE',2],['CE→CM1',3],['CM1→CM2',4]].map(([label, idx]: any) => {
                              const k = `red_t${idx}`, ke = `eff_t${idx}`;
                              const vc = pct(c.ressources[k], c.ressources[ke], 0);
                              const vd = pct(d.ressources[k], d.ressources[ke], 0);
                              const vm = pct(m.ressources[k], m.ressources[ke], 0);
                              const isMenaC = pctVal(c.ressources[k], c.ressources[ke]) > pctVal(d.ressources[k], d.ressources[ke]);
                              return (
                                <tr key={label}>
                                  <td style={{ ...styles.td, fontSize: '10px' }}>{label}</td>
                                  <td style={{ ...styles.td, textAlign: 'right', ...(isMenaC ? styles.mena : {}) }}>{vc}</td>
                                  <td style={{ ...styles.td, textAlign: 'right' }}>{vd}</td>
                                  <td style={{ ...styles.td, textAlign: 'right' }}>{vm}</td>
                                </tr>
                              );
                            })}
                            <tr style={{ fontWeight: 'bold' }}>
                              <td style={{ ...styles.td, fontSize: '10px' }}>Ensemble</td>
                              {[c, d, m].map((lvl, i) => {
                                const totalRed = [1,2,3,4].reduce((acc, idx) => acc + Number(lvl.ressources[`red_t${idx}`]||0), 0);
                                const totalEff = [1,2,3,4].reduce((acc, idx) => acc + Number(lvl.ressources[`eff_t${idx}`]||0), 0);
                                const val = totalEff > 0 ? (totalRed / totalEff * 100).toFixed(1) + '%' : '-';
                                return <td key={i} style={{ ...styles.td, textAlign: 'right' }}>{val}</td>;
                              })}
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Taux de retention + redoublants par genre */}
                <table style={{ width: '100%', marginTop: '5px' }}>
                  <tbody>
                    <tr>
                      <td style={{ width: '50%', verticalAlign: 'top' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }} border={1} cellPadding={1} cellSpacing={0}>
                          <thead>
                            <tr style={styles.gris}><th colSpan={4} style={styles.th}>Taux de rétention par genre</th></tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const retG = (lvl: any) => {
                                const t5g = Number(lvl.ressources?.eff_t5_g||0), t1g = Number(lvl.ressources?.eff_t1_g||0);
                                return t1g > 0 ? (t5g / t1g * 100).toFixed(1) + '%' : '-';
                              };
                              const retF = (lvl: any) => {
                                const t5f = Number(lvl.ressources?.eff_t5_f||0), t1f = Number(lvl.ressources?.eff_t1_f||0);
                                return t1f > 0 ? (t5f / t1f * 100).toFixed(1) + '%' : '-';
                              };
                              const retE = (lvl: any) => {
                                const t5 = Number(lvl.ressources?.eff_t5||0), t1 = Number(lvl.ressources?.eff_t1||0);
                                return t1 > 0 ? (t5 / t1 * 100).toFixed(1) + '%' : '-';
                              };
                              return (
                                <>
                                  <tr>
                                    <td style={{ ...styles.td, width: '34%' }}><GenderLabel gender="g" /></td>
                                    <td style={{ ...styles.td, textAlign: 'right' }}>{retG(c)}</td>
                                    <td style={{ ...styles.td, textAlign: 'right' }}>{retG(d)}</td>
                                    <td style={{ ...styles.td, textAlign: 'right' }}>{retG(m)}</td>
                                  </tr>
                                  <tr>
                                    <td style={{ ...styles.td, fontSize: '10px' }}><GenderLabel gender="f" /></td>
                                    <td style={{ ...styles.td, textAlign: 'right' }}>{retF(c)}</td>
                                    <td style={{ ...styles.td, textAlign: 'right' }}>{retF(d)}</td>
                                    <td style={{ ...styles.td, textAlign: 'right' }}>{retF(m)}</td>
                                  </tr>
                                  <tr>
                                    <td style={{ ...styles.td, fontSize: '10px' }}>Ensemble</td>
                                    <td style={{ ...styles.td, textAlign: 'right' }}>{retE(c)}</td>
                                    <td style={{ ...styles.td, textAlign: 'right' }}>{retE(d)}</td>
                                    <td style={{ ...styles.td, textAlign: 'right' }}>{retE(m)}</td>
                                  </tr>
                                  <tr>
                                    <td style={{ ...styles.td, fontSize: '10px' }}>Disparité au dépens des</td>
                                    {[c, d, m].map((lvl, i) => {
                                      const rg = Number(lvl.ressources?.eff_t1_g||0) > 0 ? Number(lvl.ressources?.eff_t5_g||0) / Number(lvl.ressources?.eff_t1_g||1) * 100 : 0;
                                      const rf = Number(lvl.ressources?.eff_t1_f||0) > 0 ? Number(lvl.ressources?.eff_t5_f||0) / Number(lvl.ressources?.eff_t1_f||1) * 100 : 0;
                                      const kind: 'f' | 'g' | null = Math.abs(rg - rf) < 0.1 ? null : rg < rf ? 'g' : 'f';
                                      return <td key={i} style={{ ...styles.td, textAlign: 'center', padding: 2 }}><DisparityIcon kind={kind} /></td>;
                                    })}
                                  </tr>
                                </>
                              );
                            })()}
                          </tbody>
                        </table>
                      </td>
                      <td style={{ width: '50%', verticalAlign: 'top' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }} border={1} cellPadding={1} cellSpacing={0}>
                          <thead>
                            <tr style={styles.gris}><th colSpan={4} style={styles.th}>Pourcentage des redoublants par genre</th></tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const redGpct = (lvl: any) => pct(lvl.ressources.red_g, lvl.ressources.nbr_eleve_g, 0);
                              const redFpct = (lvl: any) => pct(lvl.ressources.red_f, lvl.ressources.nbr_eleve_f, 0);
                              const redEpct = (lvl: any) => pct(Number(lvl.ressources.red_g||0)+Number(lvl.ressources.red_f||0), lvl.ressources.nbr_eleve, 0);
                              const isMenaG = pctVal(c.ressources.red_g, c.ressources.nbr_eleve_g) > pctVal(d.ressources.red_g, d.ressources.nbr_eleve_g);
                              const isMenaF = pctVal(c.ressources.red_f, c.ressources.nbr_eleve_f) > pctVal(d.ressources.red_f, d.ressources.nbr_eleve_f);
                              const isMenaE = pctVal(Number(c.ressources.red_g||0)+Number(c.ressources.red_f||0), c.ressources.nbr_eleve) > pctVal(Number(d.ressources.red_g||0)+Number(d.ressources.red_f||0), d.ressources.nbr_eleve);
                              return (
                                <>
                                  <tr>
                                    <td style={{ ...styles.td, width: '34%' }}><GenderLabel gender="g" /></td>
                                    <td style={{ ...styles.td, textAlign: 'right', ...(isMenaG ? styles.mena : {}) }}>{redGpct(c)}</td>
                                    <td style={{ ...styles.td, textAlign: 'right', width: '22%' }}>{redGpct(d)}</td>
                                    <td style={{ ...styles.td, textAlign: 'right', width: '22%' }}>{redGpct(m)}</td>
                                  </tr>
                                  <tr>
                                    <td style={{ ...styles.td, fontSize: '10px' }}><GenderLabel gender="f" /></td>
                                    <td style={{ ...styles.td, textAlign: 'right', ...(isMenaF ? styles.mena : {}) }}>{redFpct(c)}</td>
                                    <td style={{ ...styles.td, textAlign: 'right' }}>{redFpct(d)}</td>
                                    <td style={{ ...styles.td, textAlign: 'right' }}>{redFpct(m)}</td>
                                  </tr>
                                  <tr>
                                    <td style={{ ...styles.td, fontSize: '10px' }}>Ensemble</td>
                                    <td style={{ ...styles.td, textAlign: 'right', ...(isMenaE ? styles.mena : {}) }}>{redEpct(c)}</td>
                                    <td style={{ ...styles.td, textAlign: 'right' }}>{redEpct(d)}</td>
                                    <td style={{ ...styles.td, textAlign: 'right' }}>{redEpct(m)}</td>
                                  </tr>
                                  <tr>
                                    <td style={{ ...styles.td, fontSize: '10px' }}>Disparité au dépens des</td>
                                    {[c, d, m].map((lvl, i) => {
                                      const rg = pctVal(lvl.ressources.red_g, lvl.ressources.nbr_eleve_g);
                                      const rf = pctVal(lvl.ressources.red_f, lvl.ressources.nbr_eleve_f);
                                      const kind: 'f' | 'g' | null = Math.abs(rg - rf) < 0.1 ? null : rg > rf ? 'g' : 'f';
                                      return <td key={i} style={{ ...styles.td, textAlign: 'center', padding: 2 }}><DisparityIcon kind={kind} /></td>;
                                    })}
                                  </tr>
                                </>
                              );
                            })()}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>

              {/* RIGHT COLUMN - CEPE */}
              <td style={{ width: '50%', verticalAlign: 'top' }}>
                {/* Score moyen CEPE */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }} border={1} cellPadding={1} cellSpacing={0}>
                  <thead>
                    <tr style={styles.gris}>
                      <th colSpan={8} style={{ ...styles.th, fontSize: '10px' }}>
                        Score moyen(SM) sur 20 et pourcentage d'élèves ayant obtenu une note supérieure ou égale à 10/20 (Note &gt;= 10)
                        <br />Résultats CEPE {tdbData.annee}
                      </th>
                    </tr>
                    <tr>
                      <th style={{ ...styles.th, width: '25%' }} rowSpan={2} colSpan={2}>Matières</th>
                      <th style={{ ...styles.th, width: '25%' }} colSpan={2}>CISCO</th>
                      <th style={{ ...styles.th, width: '25%' }} colSpan={2}>DREN</th>
                      <th style={{ ...styles.th, width: '25%' }} colSpan={2}>MADA</th>
                    </tr>
                    <tr>
                      <td style={{ ...styles.td, textAlign: 'center' }}><b>SM</b></td>
                      <td style={{ ...styles.td, textAlign: 'center' }}><b>Note &gt;=10</b></td>
                      <td style={{ ...styles.td, textAlign: 'center' }}><b>SM</b></td>
                      <td style={{ ...styles.td, textAlign: 'center' }}><b>Note &gt;=10</b></td>
                      <td style={{ ...styles.td, textAlign: 'center' }}><b>SM</b></td>
                      <td style={{ ...styles.td, textAlign: 'center' }}><b>Note &gt;=10</b></td>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const smFmt = (v: any) => { const n = Number(v); return isNaN(n) || n === 0 ? '-' : n.toFixed(1); };
                      const noteFmt = (sup: any, examData: any) => {
                        const s = Number(sup);
                        if (isNaN(s) || s === 0) return '-';
                        const t = Number(examData?.total_candidats) || (Number(examData?.nbr_g || 0) + Number(examData?.nbr_f || 0));
                        if (t > 0) return Math.min(100, s / t * 100).toFixed(1) + '%';
                        if (s > 0 && s <= 100) return s.toFixed(1) + '%';
                        return '-';
                      };
                      const cepeRow = (label: string, smKey: string, noteKey: string, isSub = false) => {
                        const cSm = smFmt(c.cepe?.[smKey]), dSm = smFmt(d.cepe?.[smKey]), mSm = smFmt(m.cepe?.[smKey]);
                        const cN = noteFmt(c.cepe?.[noteKey], c.cepe), dN = noteFmt(d.cepe?.[noteKey], d.cepe), mN = noteFmt(m.cepe?.[noteKey], m.cepe);
                        return (
                          <tr key={label}>
                            {isSub ? <td colSpan={2} style={{ ...styles.td, paddingLeft: '10px' }}>{label}</td>
                              : <th colSpan={2} style={{ ...styles.td, textAlign: 'left', fontWeight: 'bold' }}>{label}</th>}
                            <td style={{ ...styles.td, textAlign: 'center', ...manq(cSm) }}>{cSm}</td>
                            <td style={{ ...styles.td, textAlign: 'center', ...manq(cN) }}>{cN}</td>
                            <td style={{ ...styles.td, textAlign: 'center', ...manq(dSm) }}>{dSm}</td>
                            <td style={{ ...styles.td, textAlign: 'center', ...manq(dN) }}>{dN}</td>
                            <td style={{ ...styles.td, textAlign: 'center', ...manq(mSm) }}>{mSm}</td>
                            <td style={{ ...styles.td, textAlign: 'center', ...manq(mN) }}>{mN}</td>
                          </tr>
                        );
                      };
                      return (<>
                        {cepeRow('Malagasy', 'sm_mlg', 'mlg_sup10')}
                        {cepeRow('Français', 'sm_frs', 'frs_sup10')}
                        {cepeRow('Mathématique', 'sm_mths', 'mths_sup10')}
                        {cepeRow('-Opération', 'sm_mths_operation', 'op_sup10', true)}
                        {cepeRow('-Problème', 'sm_mths_probleme', 'prob_sup10', true)}
                        {cepeRow('Histoire', 'sm_histoire', 'histoire_sup10')}
                        {cepeRow('Géographie', 'sm_geographie', 'geographie_sup10')}
                        {cepeRow('SVT', 'sm_svt', 'svt_sup10')}
                      </>);
                    })()}
                  </tbody>
                </table>

                {/* Pourcentage des admis CEPE */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '5px' }} border={1} cellPadding={1} cellSpacing={0}>
                  <thead>
                    <tr style={styles.gris}><th colSpan={4} style={styles.th}>Pourcentage des admis au CEPE (admis/inscrit en CM2)</th></tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const pctDirect = (lvl: any, key: string, numKey: string, denKey: string) => {
                        const direct = Number(lvl.cepe?.[key]);
                        if (!isNaN(direct) && direct > 0) return `${direct.toFixed(1)}%`;
                        return pct(lvl.cepe?.[numKey], lvl.cepe?.[denKey]);
                      };
                      const pctEns = (lvl: any) => {
                        const direct = Number(lvl.cepe?.tx_admis);
                        if (!isNaN(direct) && direct > 0) return `${direct.toFixed(1)}%`;
                        return pct(Number(lvl.cepe?.admis_g||0)+Number(lvl.cepe?.admis_f||0), Number(lvl.cepe?.nbr_g||0)+Number(lvl.cepe?.nbr_f||0));
                      };
                      return (<>
                        <tr><td style={styles.td}><GenderLabel gender="g" /></td>{[c,d,m].map((lvl, i) => <td key={i} style={{ ...styles.td, textAlign: 'center' }}>{pctDirect(lvl, 'tx_admis_g', 'admis_g', 'nbr_g')}</td>)}</tr>
                        <tr><td style={{ ...styles.td, fontSize: '10px' }}><GenderLabel gender="f" /></td>{[c,d,m].map((lvl, i) => <td key={i} style={{ ...styles.td, textAlign: 'center' }}>{pctDirect(lvl, 'tx_admis_f', 'admis_f', 'nbr_f')}</td>)}</tr>
                        <tr><td style={{ ...styles.td, fontSize: '10px' }}>Ensemble</td>{[c,d,m].map((lvl, i) => <td key={i} style={{ ...styles.td, textAlign: 'center' }}>{pctEns(lvl)}</td>)}</tr>
                      </>);
                    })()}
                    <tr>
                      <td style={{ ...styles.td, fontSize: '10px' }}>Disparité au dépens des</td>
                      {[c, d, m].map((lvl, i) => {
                        const txG = pctVal(lvl.cepe?.admis_g, lvl.cepe?.nbr_g);
                        const txF = pctVal(lvl.cepe?.admis_f, lvl.cepe?.nbr_f);
                        const kind: 'f' | 'g' | null = Math.abs(txG - txF) < 0.1 ? null : txG < txF ? 'g' : 'f';
                        return <td key={i} style={{ ...styles.td, textAlign: 'center', padding: 2 }}><DisparityIcon kind={kind} /></td>;
                      })}
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

          </div>
          </div>

          {/* ===== TAB 1: RESSOURCES ===== */}
          <div>
          <div ref={(el) => { sectionRefs.current[1] = el; }} style={{ padding: '10px', background: '#fff' }}>
        <div style={styles.titreIndicateur}><b>Ressources</b></div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }} cellSpacing={0}>
          <tbody>
            <tr>
              {/* LEFT */}
              <td style={{ width: '50%', verticalAlign: 'top' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }} border={1} cellPadding={1} cellSpacing={0}>
                  <thead>
                    <tr>
                      <th style={{ ...styles.th, width: '46%' }}>&nbsp;</th>
                      <th style={{ ...styles.gris, width: '18%', fontSize: '10px' }}>CISCO</th>
                      <th style={{ ...styles.gris, width: '18%', fontSize: '10px' }}>DREN</th>
                      <th style={{ ...styles.gris, width: '18%', fontSize: '10px' }}>MADA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Nombre d\'écoles fonctionnelles', [fmt(c.ressources.nbr_etab), fmt(d.ressources.nbr_etab), fmt(m.ressources.nbr_etab)]],
                      ['Nombre d\'élèves', [fmt(c.ressources.nbr_eleve), fmt(d.ressources.nbr_eleve), fmt(m.ressources.nbr_eleve)]],
                      ['Nombre d\'enseignant en classe', [fmt(c.personnel.pers_en_classe), fmt(d.personnel.pers_en_classe), fmt(m.personnel.pers_en_classe)]],
                      ['Fonctionnaire et contractuels', [fmt(c.personnel.fonctionnaire), fmt(d.personnel.fonctionnaire), fmt(m.personnel.fonctionnaire)]],
                      ['FRAM subventionnés', [fmt(c.personnel.sub), fmt(d.personnel.sub), fmt(m.personnel.sub)]],
                      ['FRAM non subventionnés', [fmt(c.personnel.non_sub), fmt(d.personnel.non_sub), fmt(m.personnel.non_sub)]],
                      ['Nombre de classes pédagogiques', [fmt(c.sections.nbr_section), fmt(d.sections.nbr_section), fmt(m.sections.nbr_section)]],
                    ].map(([label, vals]: any) => (
                      <tr key={label}><td style={styles.td}>{label}</td>{vals.map((v: string, i: number) => <td key={i} style={{ ...styles.td, textAlign: 'right', ...manq(v) }}>{v}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '3px' }} border={1} cellPadding={1} cellSpacing={0}>
                  <thead>
                    <tr>
                      <th style={{ ...styles.th, width: '46%' }}>&nbsp;</th>
                      <th style={{ ...styles.gris, width: '18%', fontSize: '10px' }}>CISCO</th>
                      <th style={{ ...styles.gris, width: '18%', fontSize: '10px' }}>DREN</th>
                      <th style={{ ...styles.gris, width: '18%', fontSize: '10px' }}>MADA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['% écoles continues', [pct(c.ressources.ecole_continue, c.ressources.nbr_etab), pct(d.ressources.ecole_continue, d.ressources.nbr_etab), pct(m.ressources.ecole_continue, m.ressources.nbr_etab)]],
                      ['% élèves < 2km', [pct(Number(c.ressources.nbr_eleve||0)-Number(c.ressources.eleve_2km||0), c.ressources.nbr_eleve), pct(Number(d.ressources.nbr_eleve||0)-Number(d.ressources.eleve_2km||0), d.ressources.nbr_eleve), pct(Number(m.ressources.nbr_eleve||0)-Number(m.ressources.eleve_2km||0), m.ressources.nbr_eleve)]],
                      ['% écoles avec eau', [pct(c.ressources.etab_eau, c.ressources.nbr_etab, 0), pct(d.ressources.etab_eau, d.ressources.nbr_etab, 0), pct(m.ressources.etab_eau, m.ressources.nbr_etab, 0)]],
                      ['% écoles avec électricité', [pct(c.ressources.etab_elec, c.ressources.nbr_etab, 0), pct(d.ressources.etab_elec, d.ressources.nbr_etab, 0), pct(m.ressources.etab_elec, m.ressources.nbr_etab, 0)]],
                      ['% fokontany avec EPP', ['-', '-', '-']],
                    ].map(([label, vals]: any) => (
                      <tr key={label}><td style={styles.td}>{label}</td>{vals.map((v: string, i: number) => <td key={i} style={{ ...styles.td, textAlign: 'right', ...manq(v) }}>{v}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </td>
              {/* RIGHT */}
              <td style={{ width: '50%', verticalAlign: 'top' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }} border={1} cellPadding={1} cellSpacing={0}>
                  <thead>
                    <tr>
                      <th style={{ ...styles.th, width: '46%' }}>&nbsp;</th>
                      <th style={{ ...styles.gris, width: '18%', fontSize: '10px' }}>CISCO</th>
                      <th style={{ ...styles.gris, width: '18%', fontSize: '10px' }}>DREN</th>
                      <th style={{ ...styles.gris, width: '18%', fontSize: '10px' }}>MADA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Élèves par maître', [ratio(c.ressources.nbr_eleve, c.personnel.pers_en_classe, 0), ratio(d.ressources.nbr_eleve, d.personnel.pers_en_classe, 0), ratio(m.ressources.nbr_eleve, m.personnel.pers_en_classe, 0)]],
                      ['% sans diplôme péd.', [pct(c.personnel.sans_diplome_ped, c.personnel.pers_en_classe), pct(d.personnel.sans_diplome_ped, d.personnel.pers_en_classe), pct(m.personnel.sans_diplome_ped, m.personnel.pers_en_classe)]],
                      ['Classes péd. / salle', [ratio(c.sections.nbr_section, c.sections.nbr_sdc, 0), ratio(d.sections.nbr_section, d.sections.nbr_sdc, 0), ratio(m.sections.nbr_section, m.sections.nbr_sdc, 0)]],
                      ['Élèves / place assise', [ratio(c.ressources.nbr_eleve, c.places.places_assises), ratio(d.ressources.nbr_eleve, d.places.places_assises), ratio(m.ressources.nbr_eleve, m.places.places_assises)]],
                      ['Élèves / Latrine', [ratio(c.ressources.nbr_eleve, c.places.latrines, 0), ratio(d.ressources.nbr_eleve, d.places.latrines, 0), ratio(m.ressources.nbr_eleve, m.places.latrines, 0)]],
                      ['Filles / latrine fille', [ratio(c.ressources.nbr_eleve_f, c.places.latrines_fille, 0), ratio(d.ressources.nbr_eleve_f, d.places.latrines_fille, 0), ratio(m.ressources.nbr_eleve_f, m.places.latrines_fille, 0)]],
                      ['Élèves / manuel Malagasy', [ratio(c.ressources.nbr_eleve, c.manuels?.malagasy, 0), ratio(d.ressources.nbr_eleve, d.manuels?.malagasy, 0), ratio(m.ressources.nbr_eleve, m.manuels?.malagasy, 0)]],
                    ].map(([label, vals]: any) => (
                      <tr key={label}><td style={styles.td}>{label}</td>{vals.map((v: string, i: number) => <td key={i} style={{ ...styles.td, textAlign: 'right', ...manq(v) }}>{v}</td>)}</tr>
                    ))}
                    <tr><td style={{ ...styles.td, paddingLeft: '10px' }}>-Mathématique</td>{[ratio(c.ressources.nbr_eleve, c.manuels?.maths, 0), ratio(d.ressources.nbr_eleve, d.manuels?.maths, 0), ratio(m.ressources.nbr_eleve, m.manuels?.maths, 0)].map((v, i) => <td key={i} style={{ ...styles.td, textAlign: 'right', ...manq(v) }}>{v}</td>)}</tr>
                    <tr><td style={{ ...styles.td, paddingLeft: '10px' }}>-Français</td>{[ratio(c.ressources.nbr_eleve, c.manuels?.francais, 0), ratio(d.ressources.nbr_eleve, d.manuels?.francais, 0), ratio(m.ressources.nbr_eleve, m.manuels?.francais, 0)].map((v, i) => <td key={i} style={{ ...styles.td, textAlign: 'right', ...manq(v) }}>{v}</td>)}</tr>
                  </tbody>
                </table>
                {/* Ressources financières */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '3px' }} border={1} cellPadding={1} cellSpacing={0}>
                  <thead>
                    <tr style={styles.gris}>
                      <th style={{ ...styles.th, width: '46%' }}>Ressources financières par élèves</th>
                      <th style={{ ...styles.th, width: '18%' }}>&nbsp;</th>
                      <th style={{ ...styles.th, width: '18%' }}>&nbsp;</th>
                      <th style={{ ...styles.th, width: '18%' }}>&nbsp;</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td style={styles.td}>Caisse école</td><td style={{ ...styles.td, ...styles.manga }}>-</td><td style={{ ...styles.td, ...styles.manga }}>-</td><td style={{ ...styles.td, ...styles.manga }}>-</td></tr>
                    <tr><td style={styles.td}>Subventions</td><td style={{ ...styles.td, ...styles.mavo, textAlign: 'right' }}>{fmt(c.caisse?.total_fce || 0)}Ar</td><td style={{ ...styles.td, ...styles.mavo, textAlign: 'right' }}>{fmt(d.caisse?.total_fce || 0)}Ar</td><td style={{ ...styles.td, textAlign: 'right' }}>{fmt(m.caisse?.total_fce || 0)}Ar</td></tr>
                    <tr><td style={styles.td}>Cotisation FRAM</td><td style={{ ...styles.td, ...styles.mavo, textAlign: 'right' }}>-</td><td style={{ ...styles.td, ...styles.mavo, textAlign: 'right' }}>-</td><td style={{ ...styles.td, textAlign: 'right' }}>-</td></tr>
                    <tr><td style={styles.td}>Autres</td><td style={{ ...styles.td, ...styles.mavo, textAlign: 'right' }}>-</td><td style={{ ...styles.td, ...styles.mavo, textAlign: 'right' }}>-</td><td style={{ ...styles.td, ...styles.mavo, textAlign: 'right' }}>-</td></tr>
                    <tr><td style={styles.td}>Total</td><td style={{ ...styles.td, textAlign: 'right' }}>{fmt(c.caisse?.total_fce || 0)}Ar</td><td style={{ ...styles.td, textAlign: 'right' }}>{fmt(d.caisse?.total_fce || 0)}Ar</td><td style={{ ...styles.td, textAlign: 'right' }}>{fmt(m.caisse?.total_fce || 0)}Ar</td></tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

          </div>
          </div>

          {/* ===== TAB 2: GOULOT ET EFFICIENCE ===== */}
          <div>
          <div ref={(el) => { sectionRefs.current[2] = el; }} style={{ padding: '10px', background: '#fff' }}>
        <div style={styles.titreIndicateur}><b>Goulot d'Étranglement&nbsp;&nbsp;et&nbsp;&nbsp;Efficience</b></div>
        <div style={{ border: '1px solid #000', display: 'flex', minHeight: '420px' }}>
          {/* Goulot bar chart */}
          <div style={{ width: '50%', padding: '10px' }}>
            <h4 style={{ textAlign: 'center', fontSize: '12px', fontWeight: 'bold', marginBottom: '10px' }}>Analyse des goulots d'étranglement</h4>
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={goulotData} layout="vertical" margin={{ top: 5, right: 30, left: 200, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} label={{ value: 'Indicateurs', position: 'insideBottom', offset: -10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={190} />
                <Tooltip />
                <Legend />
                <Bar dataKey="cisco" fill="#337ab7" name="CISCO" barSize={8} />
                <Bar dataKey="dren" fill="#5cb85c" name="DREN" barSize={8} />
                <Bar dataKey="mada" fill="#f0ad4e" name="MADA" barSize={8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Efficience scatter */}
          <div style={{ width: '50%', padding: '10px' }}>
            <h4 style={{ textAlign: 'center', fontSize: '12px', fontWeight: 'bold', marginBottom: '10px' }}>Efficience</h4>
            <ResponsiveContainer width="100%" height={380}>
              <ScatterChart margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="x" name="Ressources" label={{ value: 'Ressources', position: 'insideBottom', offset: -10 }} />
                <YAxis type="number" dataKey="y" name="Résultats" label={{ value: 'Résultats', angle: -90, position: 'insideLeft' }} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(value: any, name: string) => [`${value}%`, name]} />
                <Scatter data={efficienceData} fill="#337ab7">
                  {efficienceData.map((entry: any, index: number) => (
                    <Cell key={index} fill={entry.isCurrent ? '#e74c3c' : '#337ab7'} r={entry.isCurrent ? 8 : 5} />
                  ))}
                  <LabelList dataKey="name" position="right" style={{ fontSize: 9 }} />
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
          </div>
          </div>
        </div>
      </div>
    );
  };

  const ciscoName = tdbData?.names?.CISCO ?? (ciscos.find(c => String(c.CODE_CISCO) === selectedCisco)?.CISCO ?? '');
  const anneeLabel = selectedAnnee ? `${Number(selectedAnnee) - 1} – ${selectedAnnee}` : '';

  return (
    <>
      <TDBShell
        level="CISCO"
        cycle="PRIMAIRE"
        title="Tableau de Bord — CISCO"
        entityName={ciscoName}
        entityCode={selectedCisco !== '0' ? selectedCisco : undefined}
        annee={anneeLabel}
        loading={loading}
        hasData={!!tdbData}
        generatingPdf={generatingPdf}
        generatingPreview={generatingPreview}
        onDownloadPdf={tdbData ? generatePdf : undefined}
        onPrint={tdbData ? () => { if (printRef.current) printTdb(printRef.current, `TDB_CISCO_${tdbData.names.CISCO}_${tdbData.annee}`); } : undefined}
        onImportCsv={() => setImportOpen(true)}
        filters={
          <>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">DREN</label>
              <Select value={selectedDren} onValueChange={handleDrenChange}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Sélectionner DREN" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sélectionner DREN</SelectItem>
                  {drens.map((d) => (<SelectItem key={d.CODE_DREN} value={d.CODE_DREN.toString()}>{d.DREN}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">CISCO</label>
              <Select value={selectedCisco} onValueChange={(v) => { setSelectedCisco(v); setTdbData(null); }} disabled={selectedDren === '0'}>
                <SelectTrigger className="w-56"><SelectValue placeholder="Sélectionner CISCO" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sélectionner CISCO</SelectItem>
                  {ciscos.map((c) => (<SelectItem key={c.CODE_CISCO} value={c.CODE_CISCO.toString()}>{c.CISCO}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Année scolaire</label>
              <Select value={selectedAnnee} onValueChange={(v) => { setSelectedAnnee(v); setTdbData(null); }}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Année" /></SelectTrigger>
                <SelectContent>
                  {availableYears.map((y) => (<SelectItem key={y} value={String(y)}>{y - 1}-{y}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="hidden md:block ml-auto">
              <DataActionsBar table="tdb_cisco" tableLabel="TDB CISCO" compact />
            </div>
          </>
        }
        primaryAction={
          <Button onClick={loadTdb} disabled={selectedCisco === '0' || loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Appliquer
          </Button>
        }
        tabs={[{ value: 'tdb', label: 'Tableau de bord', content: <div ref={printRef}>{renderTdb()}</div> }]}
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

export default TDBCisco;
