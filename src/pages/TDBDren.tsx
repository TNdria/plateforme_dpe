import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, FileDown, Building2, Printer, Eye } from 'lucide-react';
import { dashboardApi, tdbApi, Dren } from '@/services/api';
import { printTdb } from '@/utils/printTdb';
import { generateMultiPagePdf } from '@/utils/multiPagePdf';
import { PDFViewer } from '@/components/pdf/PDFViewer';
import { GenderLabel } from '@/components/score/GenderRow';
import { ScoreY, computeScoreY } from '@/components/score/ScoreY';
import { TDBShell } from '@/components/tdb/TDBShell';
import { TDBImportDialog } from '@/components/tdb/TDBImportDialog';
import { EfficienceGrid } from '@/components/tdb/EfficienceGrid';
import DataActionsBar from '@/components/admin/DataActionsBar';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ScatterChart, Scatter, Cell, ResponsiveContainer, LabelList, ReferenceLine,
  LineChart, Line
} from 'recharts';

const fmt = (n: any) => { const v = Number(n); return isNaN(v) ? '-' : new Intl.NumberFormat('fr-FR').format(v); };
const pct = (num: any, den: any, dec = 1) => { const n = Number(num), d = Number(den); if (!d || isNaN(n) || isNaN(d)) return '-'; return (n / d * 100).toFixed(dec) + '%'; };
const pctVal = (num: any, den: any) => { const n = Number(num), d = Number(den); if (!d || isNaN(n) || isNaN(d)) return 0; return Number((n / d * 100).toFixed(1)); };
const ratio = (num: any, den: any, dec = 1) => { const n = Number(num), d = Number(den); if (!d || isNaN(n) || isNaN(d)) return '-'; return (n / d).toFixed(dec); };
const ratioVal = (num: any, den: any) => { const n = Number(num), d = Number(den); if (!d || isNaN(n) || isNaN(d)) return 0; return Number((n / d).toFixed(2)); };
const manq = (val: string | number) => val === '-' || val === '' || val === null || val === undefined ? { background: '#7CB5EC' } : {};

// Helper: render a data cell with auto manquant background
const DD = ({ v, style = {} }: { v: any; style?: React.CSSProperties }) => {
  const val = v === null || v === undefined ? '-' : String(v);
  const isMissing = val === '-' || val === '';
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
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string>('');
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

  const loadTdb = async () => {
    if (selectedDren === '0' || !selectedAnnee) return;
    setLoading(true);
    try {
      const data = await tdbApi.getTdbDrenData(Number(selectedDren), Number(selectedAnnee));
      setTdbData(data);
      toast.success('Tableau de bord DREN chargé');
    } catch (err) { console.error(err); toast.error('Erreur lors du chargement du TDB DREN'); }
    finally { setLoading(false); }
  };

  const generatePdf = useCallback(async () => {
    if (!tdbData || !printRef.current) return;
    setGeneratingPdf(true);
    try {
      await generateMultiPagePdf(
        [printRef.current],
        `TDB_DREN_${tdbData.names.DREN}_${tdbData.annee}.pdf`,
        { orientation: 'portrait', format: 'a3', windowWidth: 1191 }
      );
      toast.success('PDF téléchargé');
    } catch (err) { console.error(err); toast.error('Erreur PDF'); }
    finally { setGeneratingPdf(false); }
  }, [tdbData]);

  const previewPdf = useCallback(async () => {
    if (!tdbData || !printRef.current) return;
    setGeneratingPreview(true);
    try {
      const { openHtmlPdf } = await import('@/utils/htmlToPdf');
      openHtmlPdf(printRef.current, `TDB_DREN_${tdbData.names.DREN}_${tdbData.annee}`, 'preview');
      toast.success('Aperçu ouvert dans un nouvel onglet');
    } catch (e) { console.error(e); toast.error('Erreur aperçu'); }
    finally { setGeneratingPreview(false); }
  }, [tdbData]);

  const renderTdb = () => {
    if (!tdbData) return null;
    const d = tdbData.dren, m = tdbData.mada;
    const anneeDisplay = `${tdbData.annee - 1} - ${tdbData.annee}`;

    const efficienceData = (tdbData.efficience || []).map((item: any) => {
      const nbrEleve = Number(item.nbr_eleve || 0);
      const persEnClasse = Number(item.pers_en_classe || 0);
      const admis = Number(item.admis || 0);
      const inscrits = Number(item.inscrits_cepe || 0);
      const x = persEnClasse > 0 && nbrEleve > 0 ? Number((persEnClasse / nbrEleve * 100).toFixed(1)) : 0;
      const y = inscrits > 0 ? Number((admis / inscrits * 100).toFixed(1)) : 0;
      return { name: item.CISCO || '', code: item.CODE_CISCO, x, y, isCurrent: false };
    });

    // Profil de rétention pseudo-longitudinal (template Django ligne 222)
    // Pour chaque niveau (T1..T5), on affiche le taux de rétention par rapport à T1.
    const retentionProfile = (() => {
      const niveaux = ['CP1', 'CP2', 'CE', 'CM1', 'CM2'];
      const rate = (lvl: any, key: string) => {
        const t1 = Number(lvl.ressources?.eff_t1 || 0);
        const v = Number(lvl.ressources?.[key] || 0);
        return t1 > 0 ? Number((v / t1 * 100).toFixed(1)) : 0;
      };
      return niveaux.map((label, i) => ({
        niveau: label,
        DREN: rate(d, `eff_t${i + 1}`),
        MADA: rate(m, `eff_t${i + 1}`),
      }));
    })();

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
              {(() => {
                const red_ensemble = pctVal(Number(d.ressources?.red_g||0)+Number(d.ressources?.red_f||0), d.ressources?.nbr_eleve);
                const txRetentionTotal = pctVal(d.ressources?.eff_t5, d.ressources?.eff_t1);
                const TPA = Number(d.ressources?.tpa || 0);
                const tx_admis = pctVal(Number(d.cepe?.admis_g||0)+Number(d.cepe?.admis_f||0), Number(d.cepe?.nbr_g||0)+Number(d.cepe?.nbr_f||0));
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
              ['Nombre d\'écoles fonctionnelles', fmt(d.ressources?.nbr_etab), fmt(d.ressources?.nbr_etab_pub || '-')],
              ['Nombre de salles', fmt(d.sections?.nbr_sdc), fmt(d.sections?.nbr_sdc_pub || '-')],
              ['Nombre de sections', fmt(d.sections?.nbr_section), fmt(d.sections?.nbr_section_pub || '-')],
              ['Nombre de places assises', fmt(d.places?.places_assises), fmt(d.places?.places_assises_pub || '-')],
              ['Effectif des élèves', fmt(d.ressources?.nbr_eleve), fmt(d.ressources?.nbr_eleve_pub || '-')],
              ['Dont filles', fmt(d.ressources?.nbr_eleve_f), fmt(d.ressources?.nbr_eleve_f_pub || '-')],
            ].map(([label, ens, pub]) => (
              <tr key={label as string}><td style={{ ...st.td, textAlign: 'left' }}>{label}</td><td style={{ ...st.td, textAlign: 'right' }}>{ens}</td><td style={{ ...st.td, textAlign: 'right' }}>{pub}</td></tr>
            ))}
          </tbody>
        </table>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '5px' }} border={1} cellPadding={3} cellSpacing={0}>
          <tbody>
            <tr><td style={{ ...st.td, textAlign: 'left' }}>Nombre des CISCOs</td><td style={{ ...st.td, textAlign: 'right' }}>{fmt(d.ressources?.nbr_cisco || '-')}</td></tr>
            <tr><td style={{ ...st.td, textAlign: 'left' }}>Nombre des ZAPs</td><td style={{ ...st.td, textAlign: 'right' }}>{fmt(d.ressources?.nbr_zap || '-')}</td></tr>
          </tbody>
        </table>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '5px' }} border={1} cellPadding={3} cellSpacing={0}>
          <thead>
            <tr style={st.gris}><th style={st.th}>&nbsp;</th><th style={st.th}>Ensemble</th><th style={st.th}>Dont Public</th></tr>
          </thead>
          <tbody>
            {[
              ['Nombre enseignants en classe', fmt(d.personnel?.pers_en_classe), fmt(d.personnel?.pers_en_classe_pub || '-')],
              ['Fonctionnaire et contractuels', fmt(d.personnel?.fonctionnaire), fmt(d.personnel?.fonctionnaire_pub || '-')],
              ['FRAM subventionnés', fmt(d.personnel?.sub), fmt(d.personnel?.sub_pub || '-')],
              ['FRAM non subventionnés', fmt(d.personnel?.non_sub), fmt(d.personnel?.non_sub_pub || '-')],
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
        <table style={{ width: '100%', borderCollapse: 'collapse' }} cellPadding={0} cellSpacing={0}><tbody><tr>
          {/* LEFT */}
          <td style={{ width: '50%', verticalAlign: 'top' }}>
            <table style={{ width: '100%' }}><tbody><tr>
              <td style={{ width: '50%', verticalAlign: 'top' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }} border={1} cellPadding={2} cellSpacing={0}>
                  <thead>
                    <tr style={st.gris}><th colSpan={3} style={st.th}>Taux d'abandon</th></tr>
                    <tr><th style={{ ...st.th, width: '40%' }}>Classe</th><th style={{ ...st.th, width: '30%', fontSize: '10px' }}>DREN</th><th style={{ ...st.th, width: '30%', fontSize: '10px' }}>MADA</th></tr>
                  </thead>
                  <tbody>
                    {[['CP1->CP2','eff_t1','eff_t2','red_t1','red_t2'],['CP2->CE','eff_t2','eff_t3','red_t2','red_t3'],['CE->CM1','eff_t3','eff_t4','red_t3','red_t4'],['CM1->CM2','eff_t4','eff_t5','red_t4','red_t5']].map(([label, from, to, rF, rT]) => {
                      const ab = (lvl: any) => { const eF = Number(lvl.ressources[from]||0), eT = Number(lvl.ressources[to]||0), rFr = Number(lvl.ressources[rF]||0), rTo = Number(lvl.ressources[rT]||0); return eF > 0 ? Math.max(0, (eF - eT + rTo - rFr) / eF * 100).toFixed(1) + '%' : '-'; };
                      const dV = pctVal(Math.max(0, Number(d.ressources[from]||0)-Number(d.ressources[to]||0)+Number(d.ressources[rT]||0)-Number(d.ressources[rF]||0)), d.ressources[from]);
                      const mV = pctVal(Math.max(0, Number(m.ressources[from]||0)-Number(m.ressources[to]||0)+Number(m.ressources[rT]||0)-Number(m.ressources[rF]||0)), m.ressources[from]);
                      return (<tr key={label}><td style={{ ...st.td, fontSize: '10px' }}>{label}</td><td style={{ ...st.td, textAlign: 'right', ...(dV > mV ? st.mena : {}) }}>{ab(d)}</td><td style={{ ...st.td, textAlign: 'right' }}>{ab(m)}</td></tr>);
                    })}
                    <tr style={{ fontWeight: 'bold' }}>
                      <td style={{ ...st.td, fontSize: '10px' }}>Ensemble</td>
                      {[d, m].map((lvl, i) => {
                        const rates = [['eff_t1','eff_t2','red_t1','red_t2'],['eff_t2','eff_t3','red_t2','red_t3'],['eff_t3','eff_t4','red_t3','red_t4'],['eff_t4','eff_t5','red_t4','red_t5']];
                        const vals = rates.map(([f,t,rf,rt]) => { const eF = Number(lvl.ressources[f]||0), eT = Number(lvl.ressources[t]||0), rF = Number(lvl.ressources[rf]||0), rT = Number(lvl.ressources[rt]||0); return eF > 0 ? Math.max(0, (eF-eT+rT-rF)/eF*100) : null; }).filter(v => v !== null);
                        const val = vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)+'%' : '-';
                        return <td key={i} style={{ ...st.td, textAlign: 'right' }}>{val}</td>;
                      })}
                    </tr>
                  </tbody>
                </table>
              </td>
              <td style={{ width: '50%', verticalAlign: 'top' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }} border={1} cellPadding={2} cellSpacing={0}>
                  <thead>
                    <tr style={st.gris}><th colSpan={3} style={st.th}>Pourcentage des redoublants</th></tr>
                    <tr><th style={{ ...st.th, width: '40%' }}>Classe</th><th style={{ ...st.th, width: '30%', fontSize: '10px' }}>DREN</th><th style={{ ...st.th, width: '30%', fontSize: '10px' }}>MADA</th></tr>
                  </thead>
                  <tbody>
                    {[['CP1→CP2',1],['CP2→CE',2],['CE→CM1',3],['CM1→CM2',4]].map(([label, idx]: any) => {
                      const k = `red_t${idx}`, ke = `eff_t${idx}`;
                      const isDMena = pctVal(d.ressources[k], d.ressources[ke]) > pctVal(m.ressources[k], m.ressources[ke]);
                      return (<tr key={label}><td style={{ ...st.td, fontSize: '10px' }}>{label}</td><td style={{ ...st.td, textAlign: 'right', ...(isDMena ? st.mena : {}) }}>{pct(d.ressources[k], d.ressources[ke], 0)}</td><td style={{ ...st.td, textAlign: 'right' }}>{pct(m.ressources[k], m.ressources[ke], 0)}</td></tr>);
                    })}
                    <tr style={{ fontWeight: 'bold' }}>
                      <td style={{ ...st.td, fontSize: '10px' }}>Ensemble</td>
                      {[d, m].map((lvl, i) => {
                        const totalRed = [1,2,3,4].reduce((acc, idx) => acc + Number(lvl.ressources[`red_t${idx}`]||0), 0);
                        const totalEff = [1,2,3,4].reduce((acc, idx) => acc + Number(lvl.ressources[`eff_t${idx}`]||0), 0);
                        const val = totalEff > 0 ? (totalRed / totalEff * 100).toFixed(1)+'%' : '-';
                        return <td key={i} style={{ ...st.td, textAlign: 'right' }}>{val}</td>;
                      })}
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr></tbody></table>

            {/* Retention + Redoublants par genre */}
            <table style={{ width: '100%', marginTop: '5px' }}><tbody><tr>
              <td style={{ width: '50%', verticalAlign: 'top' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }} border={1} cellPadding={1} cellSpacing={0}>
                  <thead><tr style={st.gris}><th colSpan={3} style={st.th}>Taux de rétention par genre</th></tr></thead>
                  <tbody>
                    {(() => {
                      const retG = (lvl: any) => { const t5 = Number(lvl.ressources?.eff_t5_g||0), t1 = Number(lvl.ressources?.eff_t1_g||0); return t1 > 0 ? (t5/t1*100).toFixed(1)+'%' : '-'; };
                      const retF = (lvl: any) => { const t5 = Number(lvl.ressources?.eff_t5_f||0), t1 = Number(lvl.ressources?.eff_t1_f||0); return t1 > 0 ? (t5/t1*100).toFixed(1)+'%' : '-'; };
                      const retE = (lvl: any) => { const t5 = Number(lvl.ressources?.eff_t5||0), t1 = Number(lvl.ressources?.eff_t1||0); return t1 > 0 ? (t5/t1*100).toFixed(1)+'%' : '-'; };
                      return (<>
                        <tr><td style={{ ...st.td, width: '40%' }}>Garçons</td><td style={{ ...st.td, textAlign: 'right' }}>{retG(d)}</td><td style={{ ...st.td, textAlign: 'right' }}>{retG(m)}</td></tr>
                        <tr><td style={st.td}>Filles</td><td style={{ ...st.td, textAlign: 'right' }}>{retF(d)}</td><td style={{ ...st.td, textAlign: 'right' }}>{retF(m)}</td></tr>
                        <tr><td style={st.td}>Ensemble</td><td style={{ ...st.td, textAlign: 'right' }}>{retE(d)}</td><td style={{ ...st.td, textAlign: 'right' }}>{retE(m)}</td></tr>
                      </>);
                    })()}
                  </tbody>
                </table>
              </td>
              <td style={{ width: '50%', verticalAlign: 'top' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }} border={1} cellPadding={1} cellSpacing={0}>
                  <thead><tr style={st.gris}><th colSpan={3} style={st.th}>Redoublants par genre</th></tr></thead>
                  <tbody>
                    {(() => {
                      const rG = (lvl: any) => pct(lvl.ressources?.red_g, lvl.ressources?.nbr_eleve_g, 0);
                      const rF = (lvl: any) => pct(lvl.ressources?.red_f, lvl.ressources?.nbr_eleve_f, 0);
                      const rE = (lvl: any) => pct(Number(lvl.ressources?.red_g||0)+Number(lvl.ressources?.red_f||0), lvl.ressources?.nbr_eleve, 0);
                      return (<>
                        <tr><td style={{ ...st.td, width: '40%' }}>Garçons</td><td style={{ ...st.td, textAlign: 'right' }}>{rG(d)}</td><td style={{ ...st.td, textAlign: 'right' }}>{rG(m)}</td></tr>
                        <tr><td style={st.td}>Filles</td><td style={{ ...st.td, textAlign: 'right' }}>{rF(d)}</td><td style={{ ...st.td, textAlign: 'right' }}>{rF(m)}</td></tr>
                        <tr><td style={st.td}>Ensemble</td><td style={{ ...st.td, textAlign: 'right' }}>{rE(d)}</td><td style={{ ...st.td, textAlign: 'right' }}>{rE(m)}</td></tr>
                      </>);
                    })()}
                  </tbody>
                </table>
              </td>
            </tr></tbody></table>
          </td>

          {/* RIGHT - CEPE */}
          <td style={{ width: '50%', verticalAlign: 'top' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }} border={1} cellPadding={1} cellSpacing={0}>
              <thead>
                <tr style={st.gris}><th colSpan={6} style={{ ...st.th, fontSize: '10px' }}>Score moyen (SM) sur 20 et % d'élèves ≥ 10/20 — CEPE {tdbData.annee}</th></tr>
                <tr>
                  <th style={{ ...st.th, width: '30%' }} rowSpan={2} colSpan={2}>Matières</th>
                  <th style={st.th} colSpan={2}>DREN</th>
                  <th style={st.th} colSpan={2}>MADA</th>
                </tr>
                <tr>
                  <td style={{ ...st.td, textAlign: 'center' }}><b>SM</b></td><td style={{ ...st.td, textAlign: 'center' }}><b>≥10</b></td>
                  <td style={{ ...st.td, textAlign: 'center' }}><b>SM</b></td><td style={{ ...st.td, textAlign: 'center' }}><b>≥10</b></td>
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
                  const row = (label: string, smK: string, nK: string, isSub = false) => {
                    const dSm = smFmt(d.cepe?.[smK]), mSm = smFmt(m.cepe?.[smK]);
                    const dN = noteFmt(d.cepe?.[nK], d.cepe), mN = noteFmt(m.cepe?.[nK], m.cepe);
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
                    {row('Malagasy','sm_mlg','mlg_sup10')}
                    {row('Français','sm_frs','frs_sup10')}
                    {row('Mathématique','sm_mths','mths_sup10')}
                    {row('-Opération','sm_mths_operation','op_sup10',true)}
                    {row('-Problème','sm_mths_probleme','prob_sup10',true)}
                    {row('Histoire','sm_histoire','histoire_sup10')}
                    {row('Géographie','sm_geographie','geographie_sup10')}
                    {row('SVT','sm_svt','svt_sup10')}
                  </>);
                })()}
              </tbody>
            </table>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '5px' }} border={1} cellPadding={1} cellSpacing={0}>
              <thead><tr style={st.gris}><th colSpan={3} style={st.th}>Pourcentage des admis au CEPE</th></tr></thead>
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
                    <tr><td style={st.td}>Garçons</td>{[d,m].map((lvl, i) => <td key={i} style={{ ...st.td, textAlign: 'center' }}>{pctDirect(lvl, 'tx_admis_g', 'admis_g', 'nbr_g')}</td>)}</tr>
                    <tr><td style={st.td}>Filles</td>{[d,m].map((lvl, i) => <td key={i} style={{ ...st.td, textAlign: 'center' }}>{pctDirect(lvl, 'tx_admis_f', 'admis_f', 'nbr_f')}</td>)}</tr>
                    <tr><td style={st.td}>Ensemble</td>{[d,m].map((lvl, i) => <td key={i} style={{ ...st.td, textAlign: 'center' }}>{pctEns(lvl)}</td>)}</tr>
                  </>);
                })()}
              </tbody>
            </table>
          </td>
        </tr></tbody></table>

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
                  ['Élèves < 2km', [pct(Number(d.ressources.nbr_eleve||0)-Number(d.ressources.eleve_2km||0), d.ressources.nbr_eleve), pct(Number(m.ressources.nbr_eleve||0)-Number(m.ressources.eleve_2km||0), m.ressources.nbr_eleve)]],
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
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '3px' }} border={1} cellPadding={1} cellSpacing={0}>
              <thead><tr style={st.gris}><th style={{ ...st.th, width: '50%' }}>Ressources financières</th><th style={{ ...st.th, width: '25%' }}>&nbsp;</th><th style={{ ...st.th, width: '25%' }}>&nbsp;</th></tr></thead>
              <tbody>
                <tr><td style={st.td}>Subventions</td><td style={{ ...st.td, textAlign: 'right' }}>{fmt(d.caisse?.total_fce||0)}Ar</td><td style={{ ...st.td, textAlign: 'right' }}>{fmt(m.caisse?.total_fce||0)}Ar</td></tr>
              </tbody>
            </table>
          </td>
        </tr></tbody></table>

          </div>
          </div>

          {/* ===== TAB 3: GOULOT ET EFFICIENCE ===== */}
          <div>
          <div ref={(el) => { sectionRefs.current[3] = el; }} style={{ padding: '10px', background: '#fff' }}>
        <div style={st.titre}><b>Goulot d'Étranglement et Efficience</b></div>
        {/* PROFIL DE RÉTENTION pseudo-longitudinal */}
        <div style={{ border: '1px solid #000', padding: '10px', marginBottom: '8px' }}>
          <h4 style={{ textAlign: 'center', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>
            Profil de rétention pseudo-longitudinal (CP1 = 100%) — DREN vs MADA
          </h4>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={retentionProfile} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="niveau" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: any) => `${value}%`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="DREN" stroke="#337ab7" strokeWidth={2} dot={{ r: 4 }}>
                <LabelList dataKey="DREN" position="top" formatter={(v: any) => `${v}%`} style={{ fontSize: 9, fill: '#337ab7' }} />
              </Line>
              <Line type="monotone" dataKey="MADA" stroke="#d9534f" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{ border: '1px solid #000', padding: '10px' }}>
          <h4 style={{ textAlign: 'center', fontSize: '12px', fontWeight: 'bold', marginBottom: '10px' }}>Efficience des CISCOs de la DREN</h4>
          {efficienceData.length === 0 || efficienceData.every((p:any)=>p.x===0 && p.y===0) ? (
            <div style={{ height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 11, fontStyle: 'italic' }}>
              Aucune donnée d'efficience disponible pour cette année.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <ScatterChart margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="x" name="Ressources" domain={[0, 100]} label={{ value: 'Ressources (%)', position: 'insideBottom', offset: -10 }} tick={{ fontSize: 10 }} />
                <YAxis type="number" dataKey="y" name="Résultats" domain={[0, 100]} label={{ value: 'Résultats (%)', angle: -90, position: 'insideLeft' }} tick={{ fontSize: 10 }} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(value: any, name: string) => [`${value}%`, name]} />
                <ReferenceLine x={50} stroke="#999" strokeDasharray="3 3" />
                <ReferenceLine y={50} stroke="#999" strokeDasharray="3 3" />
                <Scatter data={efficienceData}>
                  {efficienceData.map((entry: any, index: number) => (<Cell key={index} fill="#337ab7" />))}
                  <LabelList dataKey="name" position="right" style={{ fontSize: 9 }} />
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </div>
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
        cycle="PRIMAIRE"
        title="Tableau de Bord — DREN"
        entityName={drenName}
        entityCode={selectedDren !== '0' ? selectedDren : undefined}
        annee={anneeLabel}
        loading={loading}
        hasData={!!tdbData}
        generatingPdf={generatingPdf}
        generatingPreview={generatingPreview}
        onDownloadPdf={tdbData ? generatePdf : undefined}
        onPrint={tdbData ? () => { if (printRef.current) printTdb(printRef.current, `TDB_DREN_${tdbData.names.DREN}_${tdbData.annee}`); } : undefined}
        onImportCsv={() => setImportOpen(true)}
        filters={
          <>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">DREN</label>
              <Select value={selectedDren} onValueChange={(v) => { setSelectedDren(v); setTdbData(null); }}>
                <SelectTrigger className="w-56"><SelectValue placeholder="Sélectionner DREN" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sélectionner DREN</SelectItem>
                  {drens.map((d) => (<SelectItem key={d.CODE_DREN} value={d.CODE_DREN.toString()}>{d.DREN}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Année scolaire</label>
              <Select value={selectedAnnee} onValueChange={(v) => { setSelectedAnnee(v); setTdbData(null); }}>
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

export default TDBDren;
