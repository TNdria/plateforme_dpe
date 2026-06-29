import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, FileDown, MapPin, Printer, Eye } from 'lucide-react';
import { PDFViewer } from '@/components/pdf/PDFViewer';
import { dashboardApi, tdbApi, Dren, Cisco, Zap } from '@/services/api';
import { printTdb } from '@/utils/printTdb';
import { generateMultiPagePdf } from '@/utils/multiPagePdf';
import emojiHappy from '@/assets/emoji-happy.jpg';
import emojiSad from '@/assets/emoji-sad.jpg';
import { TDBShell } from '@/components/tdb/TDBShell';
import { TDBImportDialog } from '@/components/tdb/TDBImportDialog';
import { EfficienceGrid } from '@/components/tdb/EfficienceGrid';
import { DisparityIcon } from '@/components/score/DisparityIcon';
import DataActionsBar from '@/components/admin/DataActionsBar';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  Cell, ResponsiveContainer, LabelList, LineChart, Line, Legend,
  ReferenceLine
} from 'recharts';

// Helpers
const fmt = (n: any) => { const v = Number(n); return isNaN(v) ? '-' : new Intl.NumberFormat('fr-FR').format(v); };
const pct = (num: any, den: any, dec = 1) => { const n = Number(num), d = Number(den); if (!d || isNaN(n) || isNaN(d)) return '-'; return (n / d * 100).toFixed(dec) + '%'; };
const pctVal = (num: any, den: any) => { const n = Number(num), d = Number(den); if (!d || isNaN(n) || isNaN(d)) return 0; return Number((n / d * 100).toFixed(1)); };
const ratio = (num: any, den: any, dec = 1) => { const n = Number(num), d = Number(den); if (!d || isNaN(n) || isNaN(d)) return '-'; return (n / d).toFixed(dec); };
const ratioVal = (num: any, den: any) => { const n = Number(num), d = Number(den); if (!d || isNaN(n) || isNaN(d)) return 0; return Number((n / d).toFixed(2)); };
// Helper: returns manquant style if value is '-'
const manq = (val: string | number) => val === '-' || val === '' || val === null || val === undefined ? { background: '#7CB5EC' } : {};

interface TdbZapData {
  names: { ZAP: string; CISCO: string; DREN: string; CODE_ZAP?: number };
  annee: number;
  zap: any;
  cisco: any;
  dren: any;
  efficience: any[];
  suiviLongitudinal: any[];
}

// Helper: render a data cell with auto manquant background
const D = ({ v, style = {} }: { v: any; style?: React.CSSProperties }) => {
  const val = v === null || v === undefined ? '-' : String(v);
  const isMissing = val === '-' || val === '';
  return <td style={{ padding: '2px 4px', verticalAlign: 'middle', fontSize: '10px', border: '1px solid #555', textAlign: 'right', ...(isMissing ? { background: '#7CB5EC' } : {}), ...style }}>{val}</td>;
};

const s = {
  titre: {
    letterSpacing: '0.15em', textTransform: 'uppercase' as const, width: '100%',
    background: '#337ab7', color: '#fff', padding: '5px 10px', marginTop: '6px', marginBottom: '4px', fontWeight: 'bold', fontSize: '11px', textAlign: 'center' as const,
  },
  gris: { background: '#bbbbcc', textAlign: 'center' as const, fontWeight: 'bold' as const },
  td: { padding: '2px 4px', verticalAlign: 'middle' as const, fontSize: '10px', border: '1px solid #555' },
  th: { textAlign: 'center' as const, fontWeight: 'bold' as const, fontSize: '10px', padding: '2px 4px', border: '1px solid #555' },
  mena: { background: 'rgba(255, 0, 0, 0.75)', fontWeight: 700 as const, color: '#fff' },
  mavo: { background: '#ffff00' },
  manquant: { background: '#7CB5EC' },
};

// Emoji images from validation document
const SmileyHappy = () => (
  <img src={emojiHappy} alt="Bon" width={28} height={28} style={{ display: 'inline-block', objectFit: 'contain' }} />
);
const SmileySad = () => (
  <img src={emojiSad} alt="Mauvais" width={28} height={28} style={{ display: 'inline-block', objectFit: 'contain' }} />
);
const SmileyNeutral = () => (
  <svg width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="13" fill="#FFC107" stroke="#333" strokeWidth="1"/><circle cx="9" cy="11" r="2" fill="#333"/><circle cx="19" cy="11" r="2" fill="#333"/><line x1="8" y1="19" x2="20" y2="19" stroke="#333" strokeWidth="1.5"/></svg>
);

const getSmiley = (zapVal: number, ciscoVal: number) => {
  if (zapVal <= 0 && ciscoVal <= 0) return <SmileyNeutral />;
  if (zapVal < ciscoVal) return <SmileyHappy />;
  if (zapVal > ciscoVal) return <SmileySad />;
  return <SmileyNeutral />;
};

const TDBZap = () => {
  const [drens, setDrens] = useState<Dren[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [ciscos, setCiscos] = useState<Cisco[]>([]);
  const [zaps, setZaps] = useState<Zap[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedDren, setSelectedDren] = useState<string>('0');
  const [selectedCisco, setSelectedCisco] = useState<string>('0');
  const [selectedZap, setSelectedZap] = useState<string>('0');
  const [selectedAnnee, setSelectedAnnee] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [tdbData, setTdbData] = useState<TdbZapData | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([null, null]);

  useEffect(() => {
    dashboardApi.getDrens().then(setDrens).catch(() => toast.error('Erreur DRENs'));
    dashboardApi.getAvailableYears().then((data) => {
      const years = data.map((d: any) => Number(d.annee)).filter((y: number) => !isNaN(y));
      setAvailableYears(years);
      if (years.length > 0) setSelectedAnnee(String(years[0]));
    }).catch(() => toast.error('Erreur années'));
  }, []);

  const handleDrenChange = async (value: string) => {
    setSelectedDren(value); setSelectedCisco('0'); setSelectedZap('0'); setTdbData(null);
    setCiscos([]); setZaps([]);
    if (value !== '0') {
      try { const data = await tdbApi.getCiscos(Number(value)); setCiscos(Array.isArray(data) ? data : []); }
      catch { toast.error('Erreur CISCOs'); }
    }
  };

  const handleCiscoChange = async (value: string) => {
    setSelectedCisco(value); setSelectedZap('0'); setTdbData(null); setZaps([]);
    if (value !== '0') {
      try { const data = await tdbApi.getZaps(Number(value)); setZaps(Array.isArray(data) ? data : []); }
      catch { toast.error('Erreur ZAPs'); }
    }
  };

  const loadTdb = async () => {
    if (selectedZap === '0' || selectedCisco === '0' || selectedDren === '0' || !selectedAnnee) return;
    setLoading(true);
    try {
      const data = await tdbApi.getTdbZapData(Number(selectedZap), Number(selectedCisco), Number(selectedDren), Number(selectedAnnee));
      setTdbData(data);
      toast.success('Tableau de bord ZAP chargé');
    } catch (err) { console.error(err); toast.error('Erreur lors du chargement du TDB ZAP'); }
    finally { setLoading(false); }
  };

  const generatePdf = useCallback(async () => {
    if (!tdbData || !printRef.current) return;
    setGeneratingPdf(true);
    try {
      const { openHtmlPdf } = await import('@/utils/htmlToPdf');
      openHtmlPdf(printRef.current, `TDB_ZAP_${tdbData.names.ZAP}_${tdbData.annee}`, 'print');
      toast.success('Boîte de dialogue d\'impression ouverte');
    } catch (err) { console.error(err); toast.error('Erreur PDF'); }
    finally { setGeneratingPdf(false); }
  }, [tdbData]);

  const previewPdf = useCallback(async () => {
    if (!tdbData || !printRef.current) return;
    setGeneratingPreview(true);
    try {
      const { openHtmlPdf } = await import('@/utils/htmlToPdf');
      openHtmlPdf(printRef.current, `TDB_ZAP_${tdbData.names.ZAP}_${tdbData.annee}`, 'preview');
      toast.success('Aperçu ouvert dans un nouvel onglet');
    } catch (e) { console.error(e); toast.error('Erreur aperçu'); }
    finally { setGeneratingPreview(false); }
  }, [tdbData]);

  // Generate diagnostic text
  const getDiagnostic = (z: any, c: any) => {
    const lines: string[] = [];
    const zapREM = ratioVal(Number(z.personnel?.pers_en_classe || 0), Number(z.ressources?.nbr_eleve || 1));
    const ciscoREM = ratioVal(Number(c.personnel?.pers_en_classe || 0), Number(c.ressources?.nbr_eleve || 1));
    const zapAdmis = pctVal(Number(z.cepe?.admis_g||0)+Number(z.cepe?.admis_f||0), Number(z.cepe?.nbr_g||0)+Number(z.cepe?.nbr_f||0));
    const ciscoAdmis = pctVal(Number(c.cepe?.admis_g||0)+Number(c.cepe?.admis_f||0), Number(c.cepe?.nbr_g||0)+Number(c.cepe?.nbr_f||0));

    if (zapREM >= ciscoREM && zapAdmis >= ciscoAdmis) {
      lines.push("**Ressources et résultats élevés** : Situation idéale. La ZAP a les moyens et les utilise efficacement pour obtenir de très bons résultats.");
      lines.push("Votre ZAP dispose de ressources abondantes et parvient à obtenir d'excellents résultats. La gestion des moyens est optimale et l'organisation pédagogique est efficace. C'est une situation idéale à maintenir et à valoriser.");
    } else if (zapREM < ciscoREM && zapAdmis >= ciscoAdmis) {
      lines.push("**Ressources faibles mais résultats élevés** : La ZAP obtient de bons résultats malgré des ressources limitées.");
      lines.push("Votre ZAP fait preuve d'une grande efficience. Il serait judicieux de renforcer les ressources pour pérenniser ces résultats.");
    } else if (zapREM >= ciscoREM && zapAdmis < ciscoAdmis) {
      lines.push("**Ressources élevées mais résultats faibles** : La ZAP dispose de moyens mais ne parvient pas à les transformer en résultats.");
      lines.push("Investiguer les causes : qualité de l'enseignement, absentéisme, gestion des ressources.");
    } else {
      lines.push("**Ressources et résultats faibles** : Situation critique nécessitant une attention particulière.");
      lines.push("Votre ZAP manque de moyens et les résultats s'en ressentent. Un plan d'action urgent est nécessaire.");
    }

    // Abandon check
    const abZapDiag = (() => {
      const rates = [['eff_t1','eff_t2','red_t1','red_t2'],['eff_t2','eff_t3','red_t2','red_t3'],['eff_t3','eff_t4','red_t3','red_t4'],['eff_t4','eff_t5','red_t4','red_t5']];
      const vals = rates.map(([f,t,rf,rt]) => { const eF = Number(z.ressources?.[f]||0), eT = Number(z.ressources?.[t]||0), rF = Number(z.ressources?.[rf]||0), rT = Number(z.ressources?.[rt]||0); return eF > 0 ? Math.max(0, (eF-eT+rT-rF)/eF*100) : null; }).filter(v => v !== null);
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    })();
    const abCiscoDiag = (() => {
      const rates = [['eff_t1','eff_t2','red_t1','red_t2'],['eff_t2','eff_t3','red_t2','red_t3'],['eff_t3','eff_t4','red_t3','red_t4'],['eff_t4','eff_t5','red_t4','red_t5']];
      const vals = rates.map(([f,t,rf,rt]) => { const eF = Number(c.ressources?.[f]||0), eT = Number(c.ressources?.[t]||0), rF = Number(c.ressources?.[rf]||0), rT = Number(c.ressources?.[rt]||0); return eF > 0 ? Math.max(0, (eF-eT+rT-rF)/eF*100) : null; }).filter(v => v !== null);
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    })();
    if (abZapDiag > abCiscoDiag) {
      lines.push("**Taux d'abandon préoccupant** : plusieurs élèves quittent encore l'école.");
      lines.push("Votre ZAP est en **moins bonne** situation que la CISCO.");
      lines.push("Identifier les causes spécifiques (absentéisme, éloignement) et mettre en place un suivi ciblé.");
    }

    return lines;
  };

  const renderTdb = () => {
    if (!tdbData) return null;
    const z = tdbData.zap, c = tdbData.cisco, d = tdbData.dren;
    const anneeDisplay = `${tdbData.annee - 1}-${tdbData.annee}`;

    // Efficience scatter data
    const efficienceData = (tdbData.efficience || []).map((item: any) => {
      const nbrEleve = Number(item.nbr_eleve || 0);
      const persEnClasse = Number(item.pers_en_classe || 0);
      const admis = Number(item.admis || 0);
      const inscrits = Number(item.inscrits_cepe || 0);
      const ressourcesScore = persEnClasse > 0 && nbrEleve > 0 ? (persEnClasse / nbrEleve * 100) : 0;
      const resultatsScore = inscrits > 0 ? (admis / inscrits * 100) : 0;
      return {
        name: item.ZAP || '',
        code: item.CODE_ZAP,
        x: Number(ressourcesScore.toFixed(1)),
        y: Number(resultatsScore.toFixed(1)),
        isCurrent: Number(item.CODE_ZAP) === Number(selectedZap),
      };
    });

    // Suivi longitudinal data
    const suiviData = (tdbData.suiviLongitudinal || []).map((item: any) => ({
      name: item.label || `T1-${item.annee}`,
      Ensemble: Number(item.t1_ensemble || 0),
      Garçons: Number(item.t1_g || 0),
      Filles: Number(item.t1_f || 0),
    }));

    const diagnosticLines = getDiagnostic(z, c);

    // Disparité smiley helpers
    const abAvg = (lvl: any) => {
      const rates = [['eff_t1','eff_t2','red_t1','red_t2'],['eff_t2','eff_t3','red_t2','red_t3'],['eff_t3','eff_t4','red_t3','red_t4'],['eff_t4','eff_t5','red_t4','red_t5']];
      const vals = rates.map(([f,t,rf,rt]) => { const eF = Number(lvl.ressources[f]||0), eT = Number(lvl.ressources[t]||0), rF = Number(lvl.ressources[rf]||0), rT = Number(lvl.ressources[rt]||0); return eF > 0 ? Math.max(0, (eF-eT+rT-rF)/eF*100) : null; }).filter(v => v !== null);
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    };
    const abZap = abAvg(z);
    const abCisco = abAvg(c);
    const redZap = pctVal(Number(z.ressources?.red_g||0)+Number(z.ressources?.red_f||0), z.ressources?.nbr_eleve);
    const redCisco = pctVal(Number(c.ressources?.red_g||0)+Number(c.ressources?.red_f||0), c.ressources?.nbr_eleve);

    return (
      <div ref={printRef} style={{ width: '100%', maxWidth: '1191px', margin: '0 auto', padding: '8px', font: '10px verdana', background: '#fff', userSelect: 'text' }}>
        {/* HEADER */}
        <div style={{ border: '2px solid #000', padding: '6px 10px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none' }}>
            <tbody>
              <tr>
                <td style={{ width: '12%', verticalAlign: 'middle', textAlign: 'center', border: 'none', padding: '4px' }}>
                  <img src="/img/logoMen.jpg" width="70" height="70" alt="MEN" style={{ maxWidth: '70px', display: 'block', margin: '0 auto' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </td>
                <td style={{ width: '18%', verticalAlign: 'middle', textAlign: 'center', border: 'none', padding: '4px', fontSize: '9px', lineHeight: '1.3' }}>
                  Ministère de l'Éducation<br/>Nationale
                </td>
                <td style={{ width: '30%', textAlign: 'center', verticalAlign: 'middle', border: 'none', padding: '4px' }}>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#337ab7', letterSpacing: '0.05em' }}>TABLEAU DE BORD {anneeDisplay}</div>
                  <div style={{ fontSize: '11px', fontWeight: 'bold', marginTop: '4px' }}>CODE : {tdbData.names.CODE_ZAP || selectedZap}</div>
                </td>
                <td style={{ width: '25%', verticalAlign: 'middle', textAlign: 'left', border: 'none', padding: '4px', fontSize: '11px', lineHeight: '1.6' }}>
                  <div>DREN : <b>{tdbData.names.DREN}</b></div>
                  <div>CISCO : <b>{tdbData.names.CISCO}</b></div>
                  <div>ZAP : <b>{tdbData.names.ZAP}</b></div>
                </td>
                <td style={{ width: '15%', verticalAlign: 'top', textAlign: 'right', border: 'none', padding: '4px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#e74c3c', marginBottom: '4px' }}>Par DPE/MEN</div>
                  <img src="/img/logoDpe.jpg" width="70" height="70" alt="DPE" style={{ maxWidth: '70px', display: 'block', marginLeft: 'auto', borderRadius: 4 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </td>
              </tr>
            </tbody>
          </table>
          <div style={{ textAlign: 'center', marginTop: '4px', fontSize: '9px', borderTop: '1px solid #ccc', paddingTop: '3px' }}>
            <span style={{ display: 'inline-block', marginRight: '15px' }}><span style={{ display: 'inline-block', width: '12px', height: '12px', background: '#7CB5EC', verticalAlign: 'middle', marginRight: '3px', border: '1px solid #999' }}></span> Données manquante(s)</span>
            <span style={{ display: 'inline-block', marginRight: '15px' }}><span style={{ display: 'inline-block', width: '12px', height: '12px', background: '#ffff00', verticalAlign: 'middle', marginRight: '3px', border: '1px solid #999' }}></span> Données à vérifier</span>
            <span style={{ display: 'inline-block' }}><span style={{ display: 'inline-block', width: '12px', height: '12px', background: 'rgba(255,0,0,0.75)', verticalAlign: 'middle', marginRight: '3px', border: '1px solid #999' }}></span> Attention !</span>
          </div>
        </div>

        {/* RÉSULTATS SCOLAIRES */}
        <div style={s.titre}>RÉSULTATS SCOLAIRES</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }} cellPadding={0} cellSpacing={0}>
          <tbody>
            <tr>
              {/* LEFT COLUMN */}
              <td style={{ width: '50%', verticalAlign: 'top', paddingRight: '4px' }}>
                {/* Taux d'abandon + Redoublants side by side */}
                <table style={{ width: '100%' }}><tbody><tr>
                  <td style={{ width: '50%', verticalAlign: 'top', paddingRight: '2px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }} border={1} cellPadding={1} cellSpacing={0}>
                      <thead>
                        <tr style={s.gris}><th colSpan={4} style={s.th}>Taux d'abandon</th></tr>
                        <tr>
                          <th style={{ ...s.th, width: '34%' }}>Classes</th>
                          <th style={{ ...s.th, width: '22%', fontSize: '9px' }}>ZAP</th>
                          <th style={{ ...s.th, width: '22%', fontSize: '9px' }}>CISCO</th>
                          <th style={{ ...s.th, width: '22%', fontSize: '9px' }}>DREN</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[['T1→T2','eff_t1','eff_t2','red_t1','red_t2'],['T2→T3','eff_t2','eff_t3','red_t2','red_t3'],['T3→T4','eff_t3','eff_t4','red_t3','red_t4'],['T4→T5','eff_t4','eff_t5','red_t4','red_t5']].map(([label, from, to, redFrom, redTo]) => {
                          const ab = (lvl: any) => {
                            const effFrom = Number(lvl.ressources[from]||0);
                            const effTo = Number(lvl.ressources[to]||0);
                            const rFrom = Number(lvl.ressources[redFrom]||0);
                            const rTo = Number(lvl.ressources[redTo]||0);
                            if (!effFrom) return '-';
                            const abandon = (effFrom - effTo + rTo - rFrom) / effFrom * 100;
                            return Math.max(0, abandon).toFixed(1) + '%';
                          };
                          const zapV = (() => {
                            const effFrom = Number(z.ressources[from]||0);
                            const effTo = Number(z.ressources[to]||0);
                            const rFrom = Number(z.ressources[redFrom]||0);
                            const rTo = Number(z.ressources[redTo]||0);
                            return effFrom > 0 ? Math.max(0, (effFrom - effTo + rTo - rFrom) / effFrom * 100) : 0;
                          })();
                          const ciscoV = (() => {
                            const effFrom = Number(c.ressources[from]||0);
                            const effTo = Number(c.ressources[to]||0);
                            const rFrom = Number(c.ressources[redFrom]||0);
                            const rTo = Number(c.ressources[redTo]||0);
                            return effFrom > 0 ? Math.max(0, (effFrom - effTo + rTo - rFrom) / effFrom * 100) : 0;
                          })();
                          const abZ = ab(z), abC = ab(c), abD = ab(d);
                          return (
                            <tr key={label}>
                              <td style={s.td}>{label}</td>
                              <td style={{ ...s.td, textAlign: 'right', ...manq(abZ), ...(zapV > ciscoV ? s.mena : {}) }}>{abZ}</td>
                              <td style={{ ...s.td, textAlign: 'right', ...manq(abC) }}>{abC}</td>
                              <td style={{ ...s.td, textAlign: 'right', ...manq(abD) }}>{abD}</td>
                            </tr>
                          );
                        })}
                        <tr style={{ fontWeight: 'bold' }}>
                          <td style={s.td}>Ensemble</td>
                          {[z, c, d].map((lvl, i) => {
                            const rates = [['eff_t1','eff_t2','red_t1','red_t2'],['eff_t2','eff_t3','red_t2','red_t3'],['eff_t3','eff_t4','red_t3','red_t4'],['eff_t4','eff_t5','red_t4','red_t5']];
                            const vals = rates.map(([f,t,rf,rt]) => {
                              const eF = Number(lvl.ressources[f]||0), eT = Number(lvl.ressources[t]||0);
                              const rF = Number(lvl.ressources[rf]||0), rT = Number(lvl.ressources[rt]||0);
                              return eF > 0 ? Math.max(0, (eF - eT + rT - rF) / eF * 100) : null;
                            }).filter(v => v !== null);
                            const val = vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) + '%' : '-';
                            return <td key={i} style={{ ...s.td, textAlign: 'right', ...manq(val) }}>{val}</td>;
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </td>
                  <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: '2px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }} border={1} cellPadding={1} cellSpacing={0}>
                      <thead>
                        <tr style={s.gris}><th colSpan={4} style={s.th}>Pourcentage des redoublants</th></tr>
                        <tr>
                          <th style={{ ...s.th, width: '34%' }}>Classes</th>
                          <th style={{ ...s.th, width: '22%', fontSize: '9px' }}>ZAP</th>
                          <th style={{ ...s.th, width: '22%', fontSize: '9px' }}>CISCO</th>
                          <th style={{ ...s.th, width: '22%', fontSize: '9px' }}>DREN</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[['T1→T2',1],['T2→T3',2],['T3→T4',3],['T4→T5',4]].map(([label, idx]: any) => {
                          const k = `red_t${idx}`, ke = `eff_t${idx}`;
                          const zapV = pctVal(z.ressources[k], z.ressources[ke]);
                          const ciscoV = pctVal(c.ressources[k], c.ressources[ke]);
                          const vZ = pct(z.ressources[k], z.ressources[ke], 1), vC = pct(c.ressources[k], c.ressources[ke], 1), vD = pct(d.ressources[k], d.ressources[ke], 1);
                          return (
                            <tr key={label}>
                              <td style={s.td}>{label}</td>
                              <td style={{ ...s.td, textAlign: 'right', ...manq(vZ), ...(zapV > ciscoV ? s.mena : {}) }}>{vZ}</td>
                              <td style={{ ...s.td, textAlign: 'right', ...manq(vC) }}>{vC}</td>
                              <td style={{ ...s.td, textAlign: 'right', ...manq(vD) }}>{vD}</td>
                            </tr>
                          );
                        })}
                        <tr style={{ fontWeight: 'bold' }}>
                          <td style={s.td}>Ensemble</td>
                          {[z, c, d].map((lvl, i) => {
                            const totalRed = [1,2,3,4].reduce((acc, idx) => acc + Number(lvl.ressources[`red_t${idx}`]||0), 0);
                            const totalEff = [1,2,3,4].reduce((acc, idx) => acc + Number(lvl.ressources[`eff_t${idx}`]||0), 0);
                            const val = totalEff > 0 ? (totalRed / totalEff * 100).toFixed(1) + '%' : '-';
                            return <td key={i} style={{ ...s.td, textAlign: 'right', ...manq(val) }}>{val}</td>;
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr></tbody></table>

                {/* Retention + Redoublants par genre */}
                <table style={{ width: '100%', marginTop: '4px' }}><tbody><tr>
                  <td style={{ width: '50%', verticalAlign: 'top', paddingRight: '2px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }} border={1} cellPadding={1} cellSpacing={0}>
                      <thead><tr style={s.gris}><th colSpan={4} style={s.th}>Taux de rétention</th></tr></thead>
                      <tbody>
                        {(() => {
                          const retG = (lvl: any) => {
                            const t5g = Number(lvl.ressources?.eff_t5_g||0);
                            const t1g = Number(lvl.ressources?.eff_t1_g||0);
                            return t1g > 0 ? (t5g / t1g * 100).toFixed(1) + '%' : '-';
                          };
                          const retF = (lvl: any) => {
                            const t5f = Number(lvl.ressources?.eff_t5_f||0);
                            const t1f = Number(lvl.ressources?.eff_t1_f||0);
                            return t1f > 0 ? (t5f / t1f * 100).toFixed(1) + '%' : '-';
                          };
                          const retE = (lvl: any) => {
                            const t5 = Number(lvl.ressources?.eff_t5||0);
                            const t1 = Number(lvl.ressources?.eff_t1||0);
                            return t1 > 0 ? (t5 / t1 * 100).toFixed(1) + '%' : '-';
                          };
                          const rGz = retG(z), rGc = retG(c), rGd = retG(d);
                          const rFz = retF(z), rFc = retF(c), rFd = retF(d);
                          const rEz = retE(z), rEc = retE(c), rEd = retE(d);
                          const dispRet = (lvl: any): 'f' | 'g' | null => {
                            const t5g = Number(lvl.ressources?.eff_t5_g||0), t1g = Number(lvl.ressources?.eff_t1_g||0);
                            const t5f = Number(lvl.ressources?.eff_t5_f||0), t1f = Number(lvl.ressources?.eff_t1_f||0);
                            const g = t1g > 0 ? t5g / t1g * 100 : 0;
                            const f = t1f > 0 ? t5f / t1f * 100 : 0;
                            if (g == null || f == null || (isNaN(g) && isNaN(f)) || (g === 0 && f === 0)) return null; if (Math.abs(g - f) < 0.01) return null;
                            return f < g ? 'f' : 'g';
                          };
                          return (<>
                            <tr><td style={{ ...s.td, width: '34%' }}>Garçons</td><td style={{ ...s.td, textAlign: 'right', ...manq(rGz) }}>{rGz}</td><td style={{ ...s.td, textAlign: 'right', ...manq(rGc) }}>{rGc}</td><td style={{ ...s.td, textAlign: 'right', ...manq(rGd) }}>{rGd}</td></tr>
                            <tr><td style={s.td}>Filles</td><td style={{ ...s.td, textAlign: 'right', ...manq(rFz) }}>{rFz}</td><td style={{ ...s.td, textAlign: 'right', ...manq(rFc) }}>{rFc}</td><td style={{ ...s.td, textAlign: 'right', ...manq(rFd) }}>{rFd}</td></tr>
                            <tr><td style={s.td}>Ensemble</td><td style={{ ...s.td, textAlign: 'right', ...manq(rEz) }}>{rEz}</td><td style={{ ...s.td, textAlign: 'right', ...manq(rEc) }}>{rEc}</td><td style={{ ...s.td, textAlign: 'right', ...manq(rEd) }}>{rEd}</td></tr>
                            <tr><td style={s.td}>Disparité aux dépens des</td>{[z, c, d].map((lvl, i) => <td key={i} style={{ ...s.td, textAlign: 'center', padding: 2 }}><DisparityIcon kind={dispRet(lvl)} /></td>)}</tr>
                          </>);
                        })()}
                      </tbody>
                    </table>
                  </td>
                  <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: '2px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }} border={1} cellPadding={1} cellSpacing={0}>
                      <thead><tr style={s.gris}><th colSpan={4} style={s.th}>Redoublants par genre</th></tr></thead>
                      <tbody>
                        {(() => {
                          const rG = (lvl: any) => pct(lvl.ressources?.red_g, lvl.ressources?.nbr_eleve_g, 1);
                          const rF = (lvl: any) => pct(lvl.ressources?.red_f, lvl.ressources?.nbr_eleve_f, 1);
                          const rE = (lvl: any) => pct(Number(lvl.ressources?.red_g||0)+Number(lvl.ressources?.red_f||0), lvl.ressources?.nbr_eleve, 1);
                          const isMenaG = pctVal(z.ressources?.red_g, z.ressources?.nbr_eleve_g) > pctVal(c.ressources?.red_g, c.ressources?.nbr_eleve_g);
                          const isMenaF = pctVal(z.ressources?.red_f, z.ressources?.nbr_eleve_f) > pctVal(c.ressources?.red_f, c.ressources?.nbr_eleve_f);
                          const isMenaE = redZap > redCisco;
                          const gZ = rG(z), gC = rG(c), gD = rG(d);
                          const fZ = rF(z), fC = rF(c), fD = rF(d);
                          const eZ = rE(z), eC = rE(c), eD = rE(d);
                          const dispRed = (lvl: any): 'f' | 'g' | null => {
                            const g = pctVal(lvl.ressources?.red_g, lvl.ressources?.nbr_eleve_g);
                            const f = pctVal(lvl.ressources?.red_f, lvl.ressources?.nbr_eleve_f);
                            if (g == null || f == null || (isNaN(g) && isNaN(f)) || (g === 0 && f === 0)) return null; if (Math.abs(g - f) < 0.01) return null;
                            return f > g ? 'f' : 'g';
                          };
                          return (<>
                            <tr><td style={{ ...s.td, width: '34%' }}>Garçons</td><td style={{ ...s.td, textAlign: 'right', ...manq(gZ), ...(isMenaG ? s.mena : {}) }}>{gZ}</td><td style={{ ...s.td, textAlign: 'right', ...manq(gC) }}>{gC}</td><td style={{ ...s.td, textAlign: 'right', ...manq(gD) }}>{gD}</td></tr>
                            <tr><td style={s.td}>Filles</td><td style={{ ...s.td, textAlign: 'right', ...manq(fZ), ...(isMenaF ? s.mena : {}) }}>{fZ}</td><td style={{ ...s.td, textAlign: 'right', ...manq(fC) }}>{fC}</td><td style={{ ...s.td, textAlign: 'right', ...manq(fD) }}>{fD}</td></tr>
                            <tr><td style={s.td}>Ensemble</td><td style={{ ...s.td, textAlign: 'right', ...manq(eZ), ...(isMenaE ? s.mena : {}) }}>{eZ}</td><td style={{ ...s.td, textAlign: 'right', ...manq(eC) }}>{eC}</td><td style={{ ...s.td, textAlign: 'right', ...manq(eD) }}>{eD}</td></tr>
                            <tr><td style={s.td}>Disparité aux dépens des</td>{[z, c, d].map((lvl, i) => <td key={i} style={{ ...s.td, textAlign: 'center', padding: 2 }}><DisparityIcon kind={dispRed(lvl)} /></td>)}</tr>
                          </>);
                        })()}
                      </tbody>
                    </table>
                  </td>
                </tr></tbody></table>

                {/* Disparité with smileys */}
                <table style={{ width: '100%', marginTop: '4px' }}><tbody><tr>
                  <td style={{ width: '50%', verticalAlign: 'top', paddingRight: '2px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }} border={1} cellPadding={1} cellSpacing={0}>
                      <thead><tr style={s.gris}><th colSpan={3} style={s.th}>Disparité au dépens des</th></tr></thead>
                      <tbody>
                        <tr>
                          <td style={{ ...s.td, textAlign: 'center', padding: '4px' }}>{getSmiley(abZap, abCisco)}</td>
                          <td style={{ ...s.td, textAlign: 'center', padding: '4px' }}>{getSmiley(redZap, redCisco)}</td>
                          <td style={{ ...s.td, textAlign: 'center', padding: '4px' }}>{getSmiley(abZap + redZap, abCisco + redCisco)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                  <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: '2px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }} border={1} cellPadding={1} cellSpacing={0}>
                      <thead><tr style={s.gris}><th colSpan={3} style={s.th}>Disparité au dépens des</th></tr></thead>
                      <tbody>
                        <tr>
                          <td style={{ ...s.td, textAlign: 'center', padding: '4px' }}>{getSmiley(redZap, redCisco)}</td>
                          <td style={{ ...s.td, textAlign: 'center', padding: '4px' }}>{getSmiley(abZap, abCisco)}</td>
                          <td style={{ ...s.td, textAlign: 'center', padding: '4px' }}>{getSmiley(abZap + redZap, abCisco + redCisco)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr></tbody></table>

                {/* Enfants 10ans déscolarisés / jamais scolarisés */}
                <table style={{ width: '100%', marginTop: '4px' }}><tbody><tr>
                  <td style={{ width: '50%', verticalAlign: 'top', paddingRight: '2px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }} border={1} cellPadding={1} cellSpacing={0}>
                      <thead>
                        <tr style={s.gris}><th colSpan={4} style={s.th}>Enfants 10ans déscolarisés</th></tr>
                      </thead>
                      <tbody>
                        <tr><td style={s.td}>Garçons</td><td style={{ ...s.td, textAlign: 'center' }}>0%</td><td style={{ ...s.td, textAlign: 'center' }}>0%</td><td style={{ ...s.td, textAlign: 'center' }}>0%</td></tr>
                        <tr><td style={s.td}>Filles</td><td style={{ ...s.td, textAlign: 'center' }}>0%</td><td style={{ ...s.td, textAlign: 'center' }}>0%</td><td style={{ ...s.td, textAlign: 'center' }}>0%</td></tr>
                        <tr><td style={s.td}>Ensemble</td><td style={{ ...s.td, textAlign: 'center' }}>0%</td><td style={{ ...s.td, textAlign: 'center' }}>0%</td><td style={{ ...s.td, textAlign: 'center' }}>0%</td></tr>
                      </tbody>
                    </table>
                  </td>
                  <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: '2px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }} border={1} cellPadding={1} cellSpacing={0}>
                      <thead>
                        <tr style={s.gris}><th colSpan={4} style={s.th}>Enfants 10ans jamais scolarisés</th></tr>
                      </thead>
                      <tbody>
                        <tr><td style={s.td}>Garçons</td><td style={{ ...s.td, textAlign: 'center' }}>0%</td><td style={{ ...s.td, textAlign: 'center' }}>0%</td><td style={{ ...s.td, textAlign: 'center' }}>0%</td></tr>
                        <tr><td style={s.td}>Filles</td><td style={{ ...s.td, textAlign: 'center' }}>0%</td><td style={{ ...s.td, textAlign: 'center' }}>0%</td><td style={{ ...s.td, textAlign: 'center' }}>0%</td></tr>
                        <tr><td style={s.td}>Ensemble</td><td style={{ ...s.td, textAlign: 'center' }}>0%</td><td style={{ ...s.td, textAlign: 'center' }}>0%</td><td style={{ ...s.td, textAlign: 'center' }}>0%</td></tr>
                      </tbody>
                    </table>
                  </td>
                </tr></tbody></table>
              </td>

              {/* RIGHT COLUMN - CEPE */}
              <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: '4px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }} border={1} cellPadding={1} cellSpacing={0}>
                  <thead>
                    <tr style={s.gris}>
                      <th colSpan={8} style={{ ...s.th, fontSize: '9px' }}>
                        Score moyen (SM) sur 20 et pourcentage d'élèves ayant obtenu une note ≥ 10/20
                        <br />Résultats CEPE : {anneeDisplay}
                      </th>
                    </tr>
                    <tr>
                      <th style={{ ...s.th, width: '22%' }} rowSpan={2} colSpan={2}>Matières</th>
                      <th style={s.th} colSpan={2}>ZAP</th>
                      <th style={s.th} colSpan={2}>CISCO</th>
                      <th style={s.th} colSpan={2}>DREN</th>
                    </tr>
                    <tr>
                      <td style={{ ...s.td, textAlign: 'center' }}><b>SM</b></td>
                      <td style={{ ...s.td, textAlign: 'center' }}><b>≥ 10</b></td>
                      <td style={{ ...s.td, textAlign: 'center' }}><b>SM</b></td>
                      <td style={{ ...s.td, textAlign: 'center' }}><b>≥ 10</b></td>
                      <td style={{ ...s.td, textAlign: 'center' }}><b>SM</b></td>
                      <td style={{ ...s.td, textAlign: 'center' }}><b>≥ 10</b></td>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const smFmt = (v: any) => { const n = Number(v); return isNaN(n) || n === 0 ? '-' : n.toFixed(1); };
                      const noteFmt = (sup: any, examData: any) => {
                        const sv = Number(sup);
                        if (isNaN(sv) || sv === 0) return '-';
                        const t = Number(examData?.total_candidats) || (Number(examData?.nbr_g || 0) + Number(examData?.nbr_f || 0));
                        if (t > 0) return Math.min(100, sv / t * 100).toFixed(1) + '%';
                        if (sv > 0 && sv <= 100) return sv.toFixed(1) + '%';
                        return '-';
                      };
                        const cepeRow = (label: string, smKey: string, noteKey: string, isSub = false) => {
                          const zSm = smFmt(z.cepe?.[smKey]), cSm = smFmt(c.cepe?.[smKey]), dSm = smFmt(d.cepe?.[smKey]);
                          const zN = noteFmt(z.cepe?.[noteKey], z.cepe), cN = noteFmt(c.cepe?.[noteKey], c.cepe), dN = noteFmt(d.cepe?.[noteKey], d.cepe);
                          return (
                            <tr key={label}>
                              {isSub ? <td colSpan={2} style={{ ...s.td, paddingLeft: '10px' }}>{label}</td>
                                : <th colSpan={2} style={{ ...s.td, textAlign: 'left', fontWeight: 'bold' }}>{label}</th>}
                              <td style={{ ...s.td, textAlign: 'center', ...manq(zSm) }}>{zSm}</td>
                              <td style={{ ...s.td, textAlign: 'center', ...manq(zN) }}>{zN}</td>
                              <td style={{ ...s.td, textAlign: 'center', ...manq(cSm) }}>{cSm}</td>
                              <td style={{ ...s.td, textAlign: 'center', ...manq(cN) }}>{cN}</td>
                              <td style={{ ...s.td, textAlign: 'center', ...manq(dSm) }}>{dSm}</td>
                              <td style={{ ...s.td, textAlign: 'center', ...manq(dN) }}>{dN}</td>
                            </tr>
                          );
                        };
                      return (<>
                        {cepeRow('Malagasy', 'sm_mlg', 'mlg_sup10')}
                        {cepeRow('Français', 'sm_frs', 'frs_sup10')}
                        {cepeRow('Mathématiques', 'sm_mths', 'mths_sup10')}
                        {cepeRow('-Opération', 'sm_mths_operation', 'op_sup10', true)}
                        {cepeRow('-Problème', 'sm_mths_probleme', 'prob_sup10', true)}
                        {cepeRow('Histoire', 'sm_histoire', 'histoire_sup10')}
                        {cepeRow('Géographie', 'sm_geographie', 'geographie_sup10')}
                        {cepeRow('SVT', 'sm_svt', 'svt_sup10')}
                      </>);
                    })()}
                  </tbody>
                </table>

                {/* Pourcentage des admis au CEPE */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '4px' }} border={1} cellPadding={1} cellSpacing={0}>
                  <thead><tr style={s.gris}><th colSpan={4} style={s.th}>Pourcentage des admis au CEPE</th></tr></thead>
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
                      const gZ = pctDirect(z, 'tx_admis_g', 'admis_g', 'nbr_g'), gC = pctDirect(c, 'tx_admis_g', 'admis_g', 'nbr_g'), gD = pctDirect(d, 'tx_admis_g', 'admis_g', 'nbr_g');
                      const fZ = pctDirect(z, 'tx_admis_f', 'admis_f', 'nbr_f'), fC = pctDirect(c, 'tx_admis_f', 'admis_f', 'nbr_f'), fD = pctDirect(d, 'tx_admis_f', 'admis_f', 'nbr_f');
                      const eZ = pctEns(z), eC = pctEns(c), eD = pctEns(d);
                      const disp = (lvl: any): 'f' | 'g' | null => {
                        const g = pctVal(lvl.cepe?.admis_g, lvl.cepe?.nbr_g);
                        const f = pctVal(lvl.cepe?.admis_f, lvl.cepe?.nbr_f);
                        if (g == null || f == null || (isNaN(g) && isNaN(f)) || (g === 0 && f === 0)) return null; if (Math.abs(g - f) < 0.01) return null;
                        return f < g ? 'f' : 'g';
                      };
                      return (<>
                        <tr><td style={s.td}>Garçons</td><td style={{ ...s.td, textAlign: 'center', ...manq(gZ) }}>{gZ}</td><td style={{ ...s.td, textAlign: 'center', ...manq(gC) }}>{gC}</td><td style={{ ...s.td, textAlign: 'center', ...manq(gD) }}>{gD}</td></tr>
                        <tr><td style={s.td}>Filles</td><td style={{ ...s.td, textAlign: 'center', ...manq(fZ) }}>{fZ}</td><td style={{ ...s.td, textAlign: 'center', ...manq(fC) }}>{fC}</td><td style={{ ...s.td, textAlign: 'center', ...manq(fD) }}>{fD}</td></tr>
                        <tr><td style={s.td}>Ensemble</td><td style={{ ...s.td, textAlign: 'center', ...manq(eZ) }}>{eZ}</td><td style={{ ...s.td, textAlign: 'center', ...manq(eC) }}>{eC}</td><td style={{ ...s.td, textAlign: 'center', ...manq(eD) }}>{eD}</td></tr>
                        <tr><td style={s.td}>Disparité aux dépens des</td>{[z, c, d].map((lvl, i) => <td key={i} style={{ ...s.td, textAlign: 'center', padding: 2 }}><DisparityIcon kind={disp(lvl)} /></td>)}</tr>
                      </>);
                    })()}
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* RESSOURCES SCOLAIRES */}
        <div style={s.titre}>RESSOURCES SCOLAIRES</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }} cellSpacing={0}>
          <tbody>
            <tr>
              {/* LEFT */}
              <td style={{ width: '50%', verticalAlign: 'top', paddingRight: '4px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }} border={1} cellPadding={1} cellSpacing={0}>
                  <thead>
                    <tr>
                      <th style={{ ...s.th, width: '46%' }}>Ressources</th>
                      <th style={{ ...s.gris, ...s.th, width: '18%' }}>ZAP</th>
                      <th style={{ ...s.gris, ...s.th, width: '18%' }}>CISCO</th>
                      <th style={{ ...s.gris, ...s.th, width: '18%' }}>DREN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Nombre d\'élèves', [fmt(z.ressources?.nbr_eleve), fmt(c.ressources?.nbr_eleve), fmt(d.ressources?.nbr_eleve)]],
                      ['Nombre d\'enseignant en classe', [fmt(z.personnel?.pers_en_classe), fmt(c.personnel?.pers_en_classe), fmt(d.personnel?.pers_en_classe)]],
                      ['Fonctionnaire et contractuels', [fmt(z.personnel?.fonctionnaire), fmt(c.personnel?.fonctionnaire), fmt(d.personnel?.fonctionnaire)]],
                      ['FRAM subventionnés', [fmt(z.personnel?.sub), fmt(c.personnel?.sub), fmt(d.personnel?.sub)]],
                      ['FRAM non subventionnés', [fmt(z.personnel?.non_sub), fmt(c.personnel?.non_sub), fmt(d.personnel?.non_sub)]],
                      ['Nombre de classes pédagogiques', [fmt(z.sections?.nbr_section), fmt(c.sections?.nbr_section), fmt(d.sections?.nbr_section)]],
                    ].map(([label, vals]: any) => (
                      <tr key={label}><td style={s.td}>{label}</td>{vals.map((v: string, i: number) => <td key={i} style={{ ...s.td, textAlign: 'right', ...manq(v) }}>{v}</td>)}</tr>
                    ))}
                  </tbody>
                </table>

                {/* Contexte */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '3px' }} border={1} cellPadding={1} cellSpacing={0}>
                  <thead>
                    <tr style={s.gris}><th colSpan={4} style={s.th}>Contexte</th></tr>
                  </thead>
                  <tbody>
                    {[
                      ['Écoles continues', [pct(z.ressources?.ecole_continue, z.ressources?.nbr_etab), pct(c.ressources?.ecole_continue, c.ressources?.nbr_etab), pct(d.ressources?.ecole_continue, d.ressources?.nbr_etab)]],
                      ['Élèves vivant à moins de 2km', [pct(Number(z.ressources?.nbr_eleve||0)-Number(z.ressources?.eleve_2km||0), z.ressources?.nbr_eleve), pct(Number(c.ressources?.nbr_eleve||0)-Number(c.ressources?.eleve_2km||0), c.ressources?.nbr_eleve), pct(Number(d.ressources?.nbr_eleve||0)-Number(d.ressources?.eleve_2km||0), d.ressources?.nbr_eleve)]],
                      ['Existence de point d\'eau', [pct(z.ressources?.etab_eau, z.ressources?.nbr_etab, 0), pct(c.ressources?.etab_eau, c.ressources?.nbr_etab, 0), pct(d.ressources?.etab_eau, d.ressources?.nbr_etab, 0)]],
                      ['Existence de l\'électricité', [pct(z.ressources?.etab_elec, z.ressources?.nbr_etab, 0), pct(c.ressources?.etab_elec, c.ressources?.nbr_etab, 0), pct(d.ressources?.etab_elec, d.ressources?.nbr_etab, 0)]],
                    ].map(([label, vals]: any) => (
                      <tr key={label}><td style={s.td}>{label}</td>{vals.map((v: string, i: number) => <td key={i} style={{ ...s.td, textAlign: 'right', ...manq(v) }}>{v}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </td>

              {/* RIGHT - Ratios */}
              <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: '4px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }} border={1} cellPadding={1} cellSpacing={0}>
                  <thead>
                    <tr>
                      <th style={{ ...s.th, width: '46%' }}>Ressources</th>
                      <th style={{ ...s.gris, ...s.th, width: '18%' }}>ZAP</th>
                      <th style={{ ...s.gris, ...s.th, width: '18%' }}>CISCO</th>
                      <th style={{ ...s.gris, ...s.th, width: '18%' }}>DREN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Nombre d\'élèves par maître', [ratio(z.ressources?.nbr_eleve, z.personnel?.pers_en_classe, 1), ratio(c.ressources?.nbr_eleve, c.personnel?.pers_en_classe, 1), ratio(d.ressources?.nbr_eleve, d.personnel?.pers_en_classe, 1)]],
                      ['% enseignants qualifiés', [pct(Number(z.personnel?.pers_en_classe||0)-Number(z.personnel?.sans_diplome_ped||0), z.personnel?.pers_en_classe), pct(Number(c.personnel?.pers_en_classe||0)-Number(c.personnel?.sans_diplome_ped||0), c.personnel?.pers_en_classe), pct(Number(d.personnel?.pers_en_classe||0)-Number(d.personnel?.sans_diplome_ped||0), d.personnel?.pers_en_classe)]],
                      ['Ratio classes péd. / salle', [ratio(z.sections?.nbr_section, z.sections?.nbr_sdc), ratio(c.sections?.nbr_section, c.sections?.nbr_sdc), ratio(d.sections?.nbr_section, d.sections?.nbr_sdc)]],
                      ['Élèves par place assise', [ratio(z.ressources?.nbr_eleve, z.places?.places_assises), ratio(c.ressources?.nbr_eleve, c.places?.places_assises), ratio(d.ressources?.nbr_eleve, d.places?.places_assises)]],
                      ['Élèves par Latrine', [ratio(z.ressources?.nbr_eleve, z.places?.latrines, 1), ratio(c.ressources?.nbr_eleve, c.places?.latrines, 1), ratio(d.ressources?.nbr_eleve, d.places?.latrines, 1)]],
                      ['Filles par latrine filles', [ratio(z.ressources?.nbr_eleve_f, z.places?.latrines_fille, 1), ratio(c.ressources?.nbr_eleve_f, c.places?.latrines_fille, 1), ratio(d.ressources?.nbr_eleve_f, d.places?.latrines_fille, 1)]],
                      ['Élèves par manuel Malagasy', [ratio(z.ressources?.nbr_eleve, z.manuels?.malagasy, 1), ratio(c.ressources?.nbr_eleve, c.manuels?.malagasy, 1), ratio(d.ressources?.nbr_eleve, d.manuels?.malagasy, 1)]],
                      ['Élèves par manuel Maths', [ratio(z.ressources?.nbr_eleve, z.manuels?.maths, 1), ratio(c.ressources?.nbr_eleve, c.manuels?.maths, 1), ratio(d.ressources?.nbr_eleve, d.manuels?.maths, 1)]],
                      ['Élèves par manuel Français', [ratio(z.ressources?.nbr_eleve, z.manuels?.francais, 1), ratio(c.ressources?.nbr_eleve, c.manuels?.francais, 1), ratio(d.ressources?.nbr_eleve, d.manuels?.francais, 1)]],
                    ].map(([label, vals]: any) => (
                      <tr key={label}><td style={s.td}>{label}</td>{vals.map((v: string, i: number) => <td key={i} style={{ ...s.td, textAlign: 'right', ...manq(v) }}>{v}</td>)}</tr>
                    ))}
                  </tbody>
                </table>

                {/* Ressources financières */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '3px' }} border={1} cellPadding={1} cellSpacing={0}>
                  <thead>
                    <tr style={s.gris}><th colSpan={4} style={s.th}>Ressources financières en Ariary</th></tr>
                  </thead>
                  <tbody>
                    <tr><td style={s.td}>Caisse écoles/Subvention/Autres</td>
                      <td style={{ ...s.td, textAlign: 'right' }}>{fmt(z.caisse?.total_fce || 0)}</td>
                      <td style={{ ...s.td, textAlign: 'right' }}>{fmt(c.caisse?.total_fce || 0)}</td>
                      <td style={{ ...s.td, textAlign: 'right' }}>{fmt(d.caisse?.total_fce || 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* EFFICIENCE ET SUIVI LONGITUDINAL */}
        <div style={s.titre}>Efficience et suivi longitudinal des cohortes d'élèves</div>
        <div style={{ border: '1px solid #000', display: 'grid', gridTemplateColumns: '50% 50%', minHeight: '320px' }}>
          {/* Efficience scatter — une seule vue */}
          <div style={{ padding: '8px', borderRight: '1px solid #ccc' }}>
            <h4 style={{ textAlign: 'center', fontSize: '11px', fontWeight: 'bold', marginBottom: '6px' }}>Efficience — votre ZAP (en rouge) parmi les autres</h4>
            {efficienceData.length === 0 || efficienceData.every((p:any)=>p.x===0 && p.y===0) ? (
              <div style={{ height: 290, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 10, fontStyle: 'italic', textAlign: 'center' }}>
                Aucune donnée d'efficience disponible.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={290}>
                <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="x" name="Ressources (%)" domain={[0, 100]}
                    label={{ value: 'Ressources (%)', position: 'insideBottom', offset: -10, fontSize: 10 }} tick={{ fontSize: 9 }} />
                  <YAxis type="number" dataKey="y" name="Résultats (%)" domain={[0, 100]}
                    label={{ value: 'Résultats (%)', angle: -90, position: 'insideLeft', fontSize: 10 }} tick={{ fontSize: 9 }} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(value: any, name: string) => [`${value}%`, name]} />
                  <ReferenceLine x={50} stroke="#999" strokeDasharray="3 3" />
                  <ReferenceLine y={50} stroke="#999" strokeDasharray="3 3" />
                  <Scatter data={efficienceData}>
                    {efficienceData.map((entry: any, index: number) => (
                      <Cell key={index} fill={entry.isCurrent ? '#e74c3c' : '#337ab7'} />
                    ))}
                    <LabelList dataKey="name" position="right" style={{ fontSize: 8 }} />
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>
          {/* Suivi longitudinal des cohortes */}
          <div style={{ padding: '8px' }}>
            <h4 style={{ textAlign: 'center', fontSize: '11px', fontWeight: 'bold', marginBottom: '6px' }}>Suivi longitudinal des cohortes (4 ans)</h4>
            <ResponsiveContainer width="100%" height={290}>
              <LineChart data={suiviData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} label={{ value: 'Effectif', angle: -90, position: 'insideLeft', fontSize: 9 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Line type="monotone" dataKey="Ensemble" stroke="#337ab7" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Garçons" stroke="#5cb85c" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Filles" stroke="#e74c3c" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* DIAGNOSTIC ET REMARQUES */}
        <div style={{ border: '1px solid #000', borderTop: 'none', padding: '10px', fontSize: '10px' }}>
          <h4 style={{ fontSize: '11px', fontWeight: 'bold', textDecoration: 'underline', marginBottom: '6px' }}>
            Diagnostic et Remarques sur les résultats de votre ZAP:
          </h4>
          {diagnosticLines.map((line, i) => (
            <p key={i} style={{ margin: '3px 0', lineHeight: '1.4' }}
              dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') }} />
          ))}
        </div>
      </div>
    );
  };

  const zapName = tdbData?.names?.ZAP ?? (zaps.find(z => String(z.CODE_ZAP) === selectedZap)?.ZAP ?? '');
  const anneeLabel = selectedAnnee ? `${Number(selectedAnnee) - 1} – ${selectedAnnee}` : '';

  return (
    <>
      <TDBShell
        level="ZAP"
        cycle="PRIMAIRE"
        title="Tableau de Bord — ZAP"
        entityName={zapName}
        entityCode={selectedZap !== '0' ? selectedZap : undefined}
        annee={anneeLabel}
        loading={loading}
        hasData={!!tdbData}
        generatingPdf={generatingPdf}
        generatingPreview={generatingPreview}
        onDownloadPdf={tdbData ? generatePdf : undefined}
        onPrint={tdbData ? () => { if (printRef.current) printTdb(printRef.current, `TDB_ZAP_${tdbData.names.ZAP}_${tdbData.annee}`); } : undefined}
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
              <Select value={selectedCisco} onValueChange={handleCiscoChange} disabled={selectedDren === '0'}>
                <SelectTrigger className="w-56"><SelectValue placeholder="Sélectionner CISCO" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sélectionner CISCO</SelectItem>
                  {ciscos.map((c) => (<SelectItem key={c.CODE_CISCO} value={c.CODE_CISCO.toString()}>{c.CISCO}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">ZAP</label>
              <Select value={selectedZap} onValueChange={(v) => { setSelectedZap(v); setTdbData(null); }} disabled={selectedCisco === '0'}>
                <SelectTrigger className="w-56"><SelectValue placeholder="Sélectionner ZAP" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sélectionner ZAP</SelectItem>
                  {zaps.map((z) => (<SelectItem key={z.CODE_ZAP} value={z.CODE_ZAP.toString()}>{z.ZAP}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Année</label>
              <Select value={selectedAnnee} onValueChange={(v) => { setSelectedAnnee(v); setTdbData(null); }}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Année" /></SelectTrigger>
                <SelectContent>
                  {availableYears.map((y) => (<SelectItem key={y} value={String(y)}>{y - 1}-{y}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="hidden md:block ml-auto">
              <DataActionsBar table="tdb_zap" tableLabel="TDB ZAP" compact />
            </div>
          </>
        }
        primaryAction={
          <Button onClick={loadTdb} disabled={selectedZap === '0' || loading}>
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

export default TDBZap;
