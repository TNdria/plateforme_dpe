import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, FileDown, School, Printer, Eye } from 'lucide-react';
import { PDFViewer } from '@/components/pdf/PDFViewer';
import { dashboardApi, tdbApi, Dren, Cisco, Zap } from '@/services/api';
import { printTdb } from '@/utils/printTdb';
import { generateMultiPagePdf } from '@/utils/multiPagePdf';
import { TDBShell } from '@/components/tdb/TDBShell';
import { TDBImportDialog } from '@/components/tdb/TDBImportDialog';
import { DisparityIcon } from '@/components/score/DisparityIcon';



/**
 * Adaptateur : mappe les colonnes "ressources" de l'API (eff_t1_g, red_t1_g, ...)
 * vers le format tdb_v_e1 attendu par etabIndicators.ts.
 * Quand les colonnes _PASSANT/_NOUVEAU/_TRANSFERT manquent, on prend 0 → l'algo
 * dégrade proprement et renvoie -1 ou des valeurs par défaut.
 */
const buildE1FromRessources = (r: any) => {
  if (!r) return null;
  const out: Record<string, number> = {};
  ['T1', 'T2', 'T3', 'T4', 'T5'].forEach((t) => {
    const i = t.toLowerCase();
    out[`${t}_G`] = Number(r[`eff_${i}_g`] || 0);
    out[`${t}_F`] = Number(r[`eff_${i}_f`] || 0);
    out[`${t}_G_REDOUBLANT`] = Number(r[`red_${i}_g`] || 0);
    out[`${t}_F_REDOUBLANT`] = Number(r[`red_${i}_f`] || 0);
    // Suffixes _PASSANT/_NOUVEAU/_TRANSFERT non exposés → 0
    ['G_PASSANT', 'F_PASSANT', 'G_NOUVEAU', 'F_NOUVEAU', 'G_TRANSFERT', 'F_TRANSFERT'].forEach(s => {
      out[`${t}_${s}`] = Number(r[`${t.toLowerCase()}_${s.toLowerCase()}`] || 0);
    });
  });
  return out;
};

import DataActionsBar from '@/components/admin/DataActionsBar';

// Normalisation 0-100 (port de tdb_pdf.py: normaliser_valeur_0_100)
const norm = (val: number, min = 0, max = 100): number => {
  if (!val || isNaN(val)) return 0;
  if (min === 0) return Math.max(0, Math.min(100, Math.round((max / val) * 100 * 10) / 10));
  if (max === 0) return Math.max(0, Math.min(100, Math.round((min / val) * 100 * 10) / 10));
  const n = Math.round(((min / val + max / val) / 2) * 100 * 10) / 10;
  return Math.max(0, Math.min(100, n));
};

// Helpers (same as TDBZap)
const fmt = (n: any) => { const v = Number(n); return isNaN(v) ? '-' : new Intl.NumberFormat('fr-FR').format(v); };
const pct = (num: any, den: any, dec = 1) => { const n = Number(num), d = Number(den); if (!d || isNaN(n) || isNaN(d)) return '-'; return (n / d * 100).toFixed(dec) + '%'; };
const pctVal = (num: any, den: any) => { const n = Number(num), d = Number(den); if (!d || isNaN(n) || isNaN(d)) return 0; return Number((n / d * 100).toFixed(1)); };
const ratio = (num: any, den: any, dec = 1) => { const n = Number(num), d = Number(den); if (!d || isNaN(n) || isNaN(d)) return '-'; return (n / d).toFixed(dec); };
const manq = (val: string | number) => val === '-' || val === '' || val === null || val === undefined ? { background: '#7CB5EC' } : {};

interface Ecole { CODE_ETAB: number; NOM_ETAB: string; SECTEUR: number; }

const s = {
  titre: { letterSpacing: '0.05em', textTransform: 'uppercase' as const, width: '100%', background: '#d9d9d9', color: '#000', padding: '4px 10px', marginTop: '8px', marginBottom: '4px', fontWeight: 'bold' as const, fontSize: '11px', textAlign: 'center' as const, border: '1px solid #555' },
  gris: { background: '#e5e5e5', textAlign: 'center' as const, fontWeight: 'bold' as const },
  td: { padding: '2px 4px', verticalAlign: 'middle' as const, fontSize: '10px', border: '1px solid #555' },
  th: { textAlign: 'center' as const, fontWeight: 'bold' as const, fontSize: '10px', padding: '2px 4px', border: '1px solid #555' },
  mena: { background: 'rgba(255, 0, 0, 0.75)', fontWeight: 700 as const, color: '#fff' },
};

const TDBEcole = () => {
  const [drens, setDrens] = useState<Dren[]>([]);
  const [ciscos, setCiscos] = useState<Cisco[]>([]);
  const [zaps, setZaps] = useState<Zap[]>([]);
  const [ecoles, setEcoles] = useState<Ecole[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedDren, setSelectedDren] = useState('0');
  const [selectedCisco, setSelectedCisco] = useState('0');
  const [selectedZap, setSelectedZap] = useState('0');
  const [selectedEcole, setSelectedEcole] = useState('0');
  const [selectedAnnee, setSelectedAnnee] = useState('');
  const [selectedNiveau, setSelectedNiveau] = useState<'primaire' | 'college' | 'lycee'>('primaire');
  const [loading, setLoading] = useState(false);
  const [tdbData, setTdbData] = useState<any>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dashboardApi.getDrens().then(setDrens).catch(() => toast.error('Erreur DRENs'));
    dashboardApi.getAvailableYears().then((data) => {
      const years = data.map((d: any) => Number(d.annee)).filter((y: number) => !isNaN(y));
      setAvailableYears(years);
      if (years.length > 0) setSelectedAnnee(String(years[0]));
    }).catch(() => toast.error('Erreur années'));
  }, []);

  const handleDrenChange = async (value: string) => {
    setSelectedDren(value); setSelectedCisco('0'); setSelectedZap('0'); setSelectedEcole('0'); setTdbData(null);
    setCiscos([]); setZaps([]); setEcoles([]);
    if (value !== '0') {
      try { setCiscos(await tdbApi.getCiscos(Number(value))); } catch { toast.error('Erreur CISCOs'); }
    }
  };
  const handleCiscoChange = async (value: string) => {
    setSelectedCisco(value); setSelectedZap('0'); setSelectedEcole('0'); setTdbData(null); setZaps([]); setEcoles([]);
    if (value !== '0') {
      try { setZaps(await tdbApi.getZaps(Number(value))); } catch { toast.error('Erreur ZAPs'); }
    }
  };
  const handleZapChange = async (value: string) => {
    setSelectedZap(value); setSelectedEcole('0'); setTdbData(null); setEcoles([]);
    if (value !== '0' && selectedAnnee) {
      try { setEcoles(await tdbApi.getEcolesByZap(Number(value), Number(selectedAnnee), selectedNiveau)); } catch { toast.error('Erreur écoles'); }
    }
  };
  const handleNiveauChange = async (value: 'primaire' | 'college' | 'lycee') => {
    setSelectedNiveau(value); setSelectedEcole('0'); setTdbData(null); setEcoles([]);
    if (selectedZap !== '0' && selectedAnnee) {
      try { setEcoles(await tdbApi.getEcolesByZap(Number(selectedZap), Number(selectedAnnee), value)); } catch { toast.error('Erreur écoles'); }
    }
  };

  const loadTdb = async () => {
    if (selectedEcole === '0' || selectedZap === '0' || selectedCisco === '0' || selectedDren === '0') return;
    setLoading(true);
    try {
      const data = await tdbApi.getTdbEcoleData(Number(selectedEcole), Number(selectedZap), Number(selectedCisco), Number(selectedDren), Number(selectedAnnee), selectedNiveau);
      setTdbData(data);
      toast.success('Tableau de bord École chargé');
    } catch (err) { console.error(err); toast.error('Erreur lors du chargement du TDB École'); }
    finally { setLoading(false); }
  };

  const generatePdf = useCallback(async () => {
    if (!printRef.current || !tdbData) return;
    setGeneratingPdf(true);
    try {
      await generateMultiPagePdf(
        [printRef.current],
        `TDB_ECOLE_${tdbData.names.NOM_ETAB}_${tdbData.annee}.pdf`,
        { orientation: 'portrait', format: 'a3', windowWidth: 1191 }
      );
      toast.success('PDF téléchargé');
    } catch { toast.error('Erreur PDF'); }
    finally { setGeneratingPdf(false); }
  }, [tdbData]);

  const previewPdf = useCallback(async () => {
    if (!printRef.current || !tdbData) return;
    setGeneratingPreview(true);
    try {
      const { openHtmlPdf } = await import('@/utils/htmlToPdf');
      openHtmlPdf(
        printRef.current,
        `TDB_ECOLE_${tdbData.names.NOM_ETAB}_${tdbData.annee}`,
        'preview',
      );
      toast.success('Aperçu ouvert dans un nouvel onglet');
    } catch { toast.error('Erreur aperçu'); }
    finally { setGeneratingPreview(false); }
  }, [tdbData]);

  const renderTdb = () => {
    if (!tdbData) return null;
    if (tdbData.__pending) {
      const ecoleName = ecoles.find(ec => String(ec.CODE_ETAB) === selectedEcole)?.NOM_ETAB ?? '';
      const niveauLabel = tdbData.niveau === 'college' ? 'Collège' : 'Lycée';
      return (
        <div className="max-w-2xl mx-auto my-8 p-8 rounded-lg border bg-card text-center space-y-4">
          <School className="w-12 h-12 mx-auto text-primary" />
          <h3 className="text-xl font-semibold">TDB {niveauLabel} — {ecoleName}</h3>
          <p className="text-sm text-muted-foreground">
            Le tableau de bord <strong>{niveauLabel}</strong> sera affiché ici dès que les indicateurs correspondants
            (équivalent <code className="bg-muted px-1 rounded">df_ecole.csv</code> pour {niveauLabel.toLowerCase()})
            seront fournis et importés.
          </p>
          <p className="text-xs text-muted-foreground">
            En attendant, l'établissement <strong>{ecoleName}</strong> est bien identifié comme proposant un cycle {niveauLabel.toLowerCase()}.
          </p>
        </div>
      );
    }
    const e = tdbData.ecole, z = tdbData.zap, c = tdbData.cisco;
    const anneeDisplay = `${tdbData.annee - 1}-${tdbData.annee}`;
    const etabLabel = selectedNiveau === 'college' ? 'CEG' : selectedNiveau === 'lycee' ? 'Lycée' : 'École';
    const labels = [etabLabel, 'ZAP', 'CISCO'];

    const abCalc = (lvl: any, from: string, to: string, redFrom: string, redTo: string) => {
      const eF = Number(lvl.ressources[from] || 0), eT = Number(lvl.ressources[to] || 0);
      const rF = Number(lvl.ressources[redFrom] || 0), rT = Number(lvl.ressources[redTo] || 0);
      return eF > 0 ? Math.max(0, (eF - eT + rT - rF) / eF * 100) : 0;
    };
    const abFmt = (lvl: any, from: string, to: string, redFrom: string, redTo: string) => {
      const v = abCalc(lvl, from, to, redFrom, redTo);
      return Number(lvl.ressources[from] || 0) > 0 ? v.toFixed(1) + '%' : '-';
    };

    return (
      <div ref={printRef} style={{ width: '100%', maxWidth: '1191px', margin: '0 auto', padding: '8px', font: '10px verdana', background: '#fff', color: '#000' }}>
        {/* HEADER — style PDF CEG */}
        <div style={{ border: '1.5px solid #000' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none' }}>
            <tbody>
              <tr>
                <td style={{ width: '14%', textAlign: 'center', border: 'none', padding: '6px 4px 0 4px', verticalAlign: 'top' }}>
                  <img src="/img/logoMen.jpg" width="46" height="46" alt="MEN" style={{ display: 'block', margin: '0 auto' }} onError={(ev) => { (ev.target as HTMLImageElement).style.display = 'none'; }} />
                </td>
                <td style={{ width: '20%', textAlign: 'center', border: 'none', padding: '6px 4px 0 4px', fontSize: '10px', fontWeight: 'bold', verticalAlign: 'middle' }}>
                  Ministère de l'Éducation Nationale
                </td>
                <td style={{ width: '32%', textAlign: 'center', border: 'none', padding: '6px 4px 0 4px', verticalAlign: 'middle' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold' }}>TABLEAU DU BORD {anneeDisplay}</div>
                </td>
                <td style={{ width: '22%', border: 'none', padding: '6px 4px 0 8px', fontSize: '10px', lineHeight: '1.5', verticalAlign: 'top' }}>
                  <div>DREN : <b>{tdbData.names.DREN || ''}</b></div>
                  <div>CISCO : <b>{tdbData.names.CISCO || ''}</b></div>
                  <div>ZAP : <b>{tdbData.names.ZAP || ''}</b></div>
                </td>
                <td style={{ width: '12%', textAlign: 'center', border: 'none', padding: '6px 4px 0 4px', verticalAlign: 'top' }}>
                  <img src="/img/logoDpe.jpg" width="56" height="46" alt="DPE" style={{ display: 'block', margin: '0 auto' }} onError={(ev) => { (ev.target as HTMLImageElement).style.display = 'none'; }} />
                </td>
              </tr>
              <tr>
                <td colSpan={2} style={{ border: 'none', padding: '2px 8px 6px 8px', fontSize: '10px', fontWeight: 'bold' }}>
                  Etablissement : <span style={{ fontWeight: 'normal' }}>{tdbData.names.NOM_ETAB || ''}</span>
                </td>
                <td style={{ border: 'none', padding: '2px 4px 6px 4px', fontSize: '10px', fontWeight: 'bold', textAlign: 'center' }}>
                  Code : <span style={{ fontWeight: 'normal' }}>{tdbData.names.CODE_ETAB || ''}</span>
                </td>
                <td colSpan={2} style={{ border: 'none', padding: '2px 4px 6px 8px', fontSize: '10px', fontWeight: 'bold' }}>
                  Statut : <span style={{ fontWeight: 'normal' }}>{tdbData.names.STATUT || (Number(tdbData.names.SECTEUR) === 2 ? 'Privé' : 'Public')}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* LÉGENDE — bandes pleine largeur style PDF CEG */}
        <div style={{ marginTop: '4px' }}>
          {[
            { color: '#7CB5EC', label: 'Données non disponible' },
            { color: '#ffff00', label: 'Données à vérifier' },
            { color: 'rgba(255,0,0,0.75)', label: 'Attention !' },
          ].map((it) => (
            <table key={it.label} style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1px' }}>
              <tbody>
                <tr>
                  <td style={{ width: '14%', border: '1px solid #555', background: it.color, height: '14px' }}></td>
                  <td style={{ border: '1px solid #555', textAlign: 'center', fontSize: '10px', padding: '2px' }}>{it.label}</td>
                </tr>
              </tbody>
            </table>
          ))}
        </div>


        {/* RÉSULTATS SCOLAIRES */}
        <div style={s.titre}>RÉSULTATS SCOLAIRES</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }} cellPadding={0} cellSpacing={0}>
          <tbody><tr>
            <td style={{ width: '50%', verticalAlign: 'top', paddingRight: '4px' }}>
              {/* Taux d'abandon + Redoublants */}
              <table style={{ width: '100%' }}><tbody><tr>
                <td style={{ width: '50%', verticalAlign: 'top', paddingRight: '2px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }} border={1} cellPadding={1} cellSpacing={0}>
                    <thead>
                      <tr style={s.gris}><th colSpan={4} style={s.th}>Taux d'abandon</th></tr>
                      <tr><th style={{ ...s.th, width: '34%' }}>Classe</th>{labels.map(l => <th key={l} style={{ ...s.th, width: '22%', fontSize: '9px' }}>{l}</th>)}</tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const rowsByNiveau: Record<string, Array<[string,string,string,string,string]>> = {
                          primaire: [['T1→T2','eff_t1','eff_t2','red_t1','red_t2'],['T2→T3','eff_t2','eff_t3','red_t2','red_t3'],['T3→T4','eff_t3','eff_t4','red_t3','red_t4'],['T4→T5','eff_t4','eff_t5','red_t4','red_t5']],
                          college: [['6e→5e','eff_t1','eff_t2','red_t1','red_t2'],['5e→4e','eff_t2','eff_t3','red_t2','red_t3'],['4e→3e','eff_t3','eff_t4','red_t3','red_t4']],
                          lycee:   [['2nde→1ère','eff_t1','eff_t2','red_t1','red_t2'],['1ère→Tle','eff_t2','eff_t3','red_t2','red_t3']],
                        };
                        const rows = rowsByNiveau[selectedNiveau];
                        const lastKey = selectedNiveau === 'primaire' ? 't5' : selectedNiveau === 'college' ? 't4' : 't3';
                        const ensembleRow: [string,string,string,string,string] = ['Ensemble','eff_t1',`eff_${lastKey}`,'red_t1',`red_${lastKey}`];
                        return [...rows, ensembleRow].map(([label, f, t, rf, rt]) => {
                        const eV = abCalc(e, f, t, rf, rt), zV = abCalc(z, f, t, rf, rt);
                        return (
                          <tr key={label}>
                            <td style={s.td}>{label}</td>
                            <td style={{ ...s.td, textAlign: 'right', ...manq(abFmt(e, f, t, rf, rt)), ...(eV > zV ? s.mena : {}) }}>{abFmt(e, f, t, rf, rt)}</td>
                            <td style={{ ...s.td, textAlign: 'right', ...manq(abFmt(z, f, t, rf, rt)) }}>{abFmt(z, f, t, rf, rt)}</td>
                            <td style={{ ...s.td, textAlign: 'right', ...manq(abFmt(c, f, t, rf, rt)) }}>{abFmt(c, f, t, rf, rt)}</td>
                          </tr>
                        );
                      });
                      })()}
                    </tbody>
                  </table>
                </td>
                <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: '2px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }} border={1} cellPadding={1} cellSpacing={0}>
                    <thead>
                      <tr style={s.gris}><th colSpan={4} style={s.th}>Pourcentage des redoublants</th></tr>
                      <tr><th style={{ ...s.th, width: '34%' }}>Classe</th>{labels.map(l => <th key={l} style={{ ...s.th, width: '22%', fontSize: '9px' }}>{l}</th>)}</tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const redRowsByNiveau: Record<string, Array<[string, number]>> = {
                          primaire: [['T1',1],['T2',2],['T3',3],['T4',4]],
                          college: [['6e',1],['5e',2],['4e',3],['3e',4]],
                          lycee:   [['2nde',1],['1ère',2],['Tle',3]],
                        };
                        return redRowsByNiveau[selectedNiveau].map(([label, idx]: any) => {
                        const eV = pctVal(e.ressources[`red_t${idx}`], e.ressources[`eff_t${idx}`]);
                        const zV = pctVal(z.ressources[`red_t${idx}`], z.ressources[`eff_t${idx}`]);
                        return (
                          <tr key={label}>
                            <td style={s.td}>{label}</td>
                            <td style={{ ...s.td, textAlign: 'right', ...(eV > zV ? s.mena : {}) }}>{pct(e.ressources[`red_t${idx}`], e.ressources[`eff_t${idx}`])}</td>
                            <td style={{ ...s.td, textAlign: 'right' }}>{pct(z.ressources[`red_t${idx}`], z.ressources[`eff_t${idx}`])}</td>
                            <td style={{ ...s.td, textAlign: 'right' }}>{pct(c.ressources[`red_t${idx}`], c.ressources[`eff_t${idx}`])}</td>
                          </tr>
                        );
                      });
                      })()}
                    </tbody>
                  </table>
                </td>
              </tr></tbody></table>

              {/* Rétention + Redoublants par genre */}
              <table style={{ width: '100%', marginTop: '4px' }}><tbody><tr>
                <td style={{ width: '50%', verticalAlign: 'top', paddingRight: '2px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }} border={1} cellPadding={1} cellSpacing={0}>
                    <thead>
                      <tr style={s.gris}><th colSpan={4} style={s.th}>Taux de rétention</th></tr>
                      <tr><th style={{ ...s.th, width: '34%' }}>Niveau</th>{labels.map(l => <th key={l} style={{ ...s.th, width: '22%', fontSize: '9px' }}>{l}</th>)}</tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const lastT = selectedNiveau === 'primaire' ? 't5' : selectedNiveau === 'college' ? 't4' : 't3';
                        const retVal = (lvl: any, numKey: string, denKey: string) => pctVal(lvl.ressources?.[numKey], lvl.ressources?.[denKey]);
                        const ret = (lvl: any, numKey: string, denKey: string) => pct(lvl.ressources?.[numKey], lvl.ressources?.[denKey]);
                        const depens = (lvl: any): 'f' | 'g' | null => {
                          const g = retVal(lvl, `eff_${lastT}_g`, 'eff_t1_g');
                          const f = retVal(lvl, `eff_${lastT}_f`, 'eff_t1_f');
                          if (g == null || f == null || (isNaN(g) && isNaN(f)) || (g === 0 && f === 0)) return null; if (Math.abs(g - f) < 0.01) return null;
                          return f < g ? 'f' : 'g';
                        };
                        return (<>
                          <tr><td style={s.td}>Garçons</td>{[e, z, c].map((l, i) => <td key={i} style={{ ...s.td, textAlign: 'right' }}>{ret(l, `eff_${lastT}_g`, 'eff_t1_g')}</td>)}</tr>
                          <tr><td style={s.td}>Filles</td>{[e, z, c].map((l, i) => <td key={i} style={{ ...s.td, textAlign: 'right' }}>{ret(l, `eff_${lastT}_f`, 'eff_t1_f')}</td>)}</tr>
                          <tr><td style={s.td}>Ensemble</td>{[e, z, c].map((l, i) => <td key={i} style={{ ...s.td, textAlign: 'right' }}>{pct(l.ressources?.[`eff_${lastT}`], l.ressources?.eff_t1)}</td>)}</tr>
                          <tr><td style={s.td}>Disparité aux dépens des</td>{[e, z, c].map((l, i) => <td key={i} style={{ ...s.td, textAlign: 'center', padding: 2 }}><DisparityIcon kind={depens(l)} /></td>)}</tr>
                        </>);
                      })()}
                    </tbody>
                  </table>
                </td>
                <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: '2px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }} border={1} cellPadding={1} cellSpacing={0}>
                    <thead><tr style={s.gris}><th colSpan={4} style={s.th}>Pourcentage de Redoublants par genre</th></tr></thead>
                    <tbody>
                      {(() => {
                        const rValG = (lvl: any) => pctVal(lvl.ressources?.red_g, lvl.ressources?.nbr_eleve_g);
                        const rValF = (lvl: any) => pctVal(lvl.ressources?.red_f, lvl.ressources?.nbr_eleve_f);
                        const rG = (lvl: any) => pct(lvl.ressources?.red_g, lvl.ressources?.nbr_eleve_g);
                        const rF = (lvl: any) => pct(lvl.ressources?.red_f, lvl.ressources?.nbr_eleve_f);
                        const rE = (lvl: any) => pct(Number(lvl.ressources?.red_g || 0) + Number(lvl.ressources?.red_f || 0), lvl.ressources?.nbr_eleve);
                        const depensRed = (lvl: any): 'f' | 'g' | null => {
                          const g = rValG(lvl), f = rValF(lvl);
                          if (g == null || f == null || (isNaN(g) && isNaN(f)) || (g === 0 && f === 0)) return null; if (Math.abs(g - f) < 0.01) return null;
                          return f > g ? 'f' : 'g';
                        };
                        return (<>
                          <tr><td style={s.td}>Garçons</td>{[e, z, c].map((l, i) => <td key={i} style={{ ...s.td, textAlign: 'right' }}>{rG(l)}</td>)}</tr>
                          <tr><td style={s.td}>Filles</td>{[e, z, c].map((l, i) => <td key={i} style={{ ...s.td, textAlign: 'right' }}>{rF(l)}</td>)}</tr>
                          <tr><td style={s.td}>Ensemble</td>{[e, z, c].map((l, i) => <td key={i} style={{ ...s.td, textAlign: 'right' }}>{rE(l)}</td>)}</tr>
                          <tr><td style={s.td}>Disparité aux dépens des</td>{[e, z, c].map((l, i) => <td key={i} style={{ ...s.td, textAlign: 'center', padding: 2 }}><DisparityIcon kind={depensRed(l)} /></td>)}</tr>
                        </>);
                      })()}
                    </tbody>
                  </table>
                </td>
              </tr></tbody></table>
            </td>

            {/* RIGHT - EXAMEN (CEPE / BEPC / BAC) */}
            <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: '4px' }}>
              {(() => {
                const examKey = selectedNiveau === 'college' ? 'bepc' : selectedNiveau === 'lycee' ? 'bac' : 'cepe';
                const examLabel = selectedNiveau === 'college' ? 'BEPC' : selectedNiveau === 'lycee' ? 'BAC' : 'CEPE';
                const subjects: Array<[string, string, string, boolean?]> =
                  selectedNiveau === 'college'
                    ? [
                        ['Malagasy', 'sm_mlg', 'mlg_sup10'],
                        ['Français', 'sm_frs', 'frs_sup10'],
                        ['Mathématiques', 'sm_math', 'math_sup10'],
                        ['Physique - chimie', 'sm_phys', 'phys_sup10'],
                        ['SVT', 'sm_svt', 'svt_sup10'],
                        ['HG', 'sm_hg', 'hg_sup10'],
                      ]
                    : selectedNiveau === 'lycee'
                      ? [
                          ['Français', 'sm_frs', 'frs_sup10'],
                          ['Philosophie', 'sm_philo', 'philo_sup10'],
                          ['Mathématiques', 'sm_math', 'math_sup10'],
                          ['Anglais', 'sm_ang', 'ang_sup10'],
                          ['Spécialité 1', 'sm_spe1', 'spe1_sup10'],
                          ['Spécialité 2', 'sm_spe2', 'spe2_sup10'],
                        ]
                      : [
                          ['Malagasy', 'sm_mlg', 'mlg_sup10'],
                          ['Français', 'sm_frs', 'frs_sup10'],
                          ['Mathématiques', 'sm_mths', 'mths_sup10'],
                          ['-Opération', 'sm_mths_operation', 'op_sup10', true],
                          ['-Problème', 'sm_mths_probleme', 'prob_sup10', true],
                          ['Histoire', 'sm_histoire', 'histoire_sup10'],
                          ['Géographie', 'sm_geographie', 'geographie_sup10'],
                          ['SVT', 'sm_svt', 'svt_sup10'],
                        ];
                const smFmt = (v: any) => { const n = Number(v); return isNaN(n) || n === 0 ? '-' : n.toFixed(1); };
                const noteFmt = (sup: any, examData: any) => {
                  const sv = Number(sup);
                  if (isNaN(sv) || sv === 0) return '-';
                  const t = Number(examData?.total_candidats) || (Number(examData?.nbr_g || 0) + Number(examData?.nbr_f || 0));
                  if (t > 0 && sv <= t) return (sv / t * 100).toFixed(1) + '%';
                  // Pas de total fiable ou incohérent : si la valeur est déjà un pourcentage (0-100), l'afficher tel quel.
                  if (sv > 0 && sv <= 100) return sv.toFixed(1) + '%';
                  return '-';
                };
                const admVal = (lvl: any, key: 'tx_admis_g' | 'tx_admis_f' | 'tx_admis') => {
                  const x = lvl?.[examKey] || {};
                  const direct = Number(x[key]);
                  if (!isNaN(direct) && direct > 0) return direct;
                  if (key === 'tx_admis_g') return pctVal(x.admis_g, x.nbr_g);
                  if (key === 'tx_admis_f') return pctVal(x.admis_f, x.nbr_f);
                  return pctVal(Number(x.admis_g || 0) + Number(x.admis_f || 0), Number(x.nbr_g || 0) + Number(x.nbr_f || 0));
                };
                const gP = (lvl: any) => {
                  const x = lvl?.[examKey] || {};
                  const direct = Number(x.tx_admis_g);
                  return !isNaN(direct) && direct > 0 ? `${direct.toFixed(1)}%` : pct(x.admis_g, x.nbr_g);
                };
                const fP = (lvl: any) => {
                  const x = lvl?.[examKey] || {};
                  const direct = Number(x.tx_admis_f);
                  return !isNaN(direct) && direct > 0 ? `${direct.toFixed(1)}%` : pct(x.admis_f, x.nbr_f);
                };
                const eP = (lvl: any) => {
                  const x = lvl?.[examKey] || {};
                  const direct = Number(x.tx_admis);
                  return !isNaN(direct) && direct > 0 ? `${direct.toFixed(1)}%` : pct(Number(x.admis_g || 0) + Number(x.admis_f || 0), Number(x.nbr_g || 0) + Number(x.nbr_f || 0));
                };
                const depensAdmis = (lvl: any): 'f' | 'g' | null => {
                  const g = admVal(lvl, 'tx_admis_g');
                  const f = admVal(lvl, 'tx_admis_f');
                  if (g == null || f == null || (isNaN(g) && isNaN(f)) || (g === 0 && f === 0)) return null; if (Math.abs(g - f) < 0.01) return null;
                  return f < g ? 'f' : 'g';
                };
                return (<>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }} border={1} cellPadding={1} cellSpacing={0}>
                    <thead>
                      <tr style={s.gris}><th colSpan={8} style={{ ...s.th, fontSize: '9px' }}>Score moyen (SM) sur 20 et pourcentage d'élèves ayant obtenu une note supérieure ou égale à 10/20 (Note &gt;= 10) Résultats {examLabel} : {anneeDisplay}</th></tr>
                      <tr>
                        <th style={{ ...s.th, width: '22%' }} rowSpan={2} colSpan={2}>Matières</th>
                        {labels.map(l => <th key={l} style={s.th} colSpan={2}>{l}</th>)}
                      </tr>
                      <tr>{labels.flatMap(l => ([<td key={`${l}sm`} style={{ ...s.td, textAlign: 'center' }}><b>SM</b></td>, <td key={`${l}n`} style={{ ...s.td, textAlign: 'center' }}><b>&gt;= 10</b></td>]))}</tr>
                    </thead>
                    <tbody>
                      {subjects.map(([label, smKey, noteKey, isSub]) => (
                        <tr key={label}>
                          {isSub ? <td colSpan={2} style={{ ...s.td, paddingLeft: '10px' }}>{label}</td> : <th colSpan={2} style={{ ...s.td, textAlign: 'left', fontWeight: 'bold' }}>{label}</th>}
                          {[e, z, c].map((lvl, i) => {
                            const x = lvl?.[examKey] || {};
                            return [
                              <td key={`${i}sm`} style={{ ...s.td, textAlign: 'center', ...manq(smFmt(x[smKey])) }}>{smFmt(x[smKey])}</td>,
                              <td key={`${i}n`} style={{ ...s.td, textAlign: 'center', ...manq(noteFmt(x[noteKey], x)) }}>{noteFmt(x[noteKey], x)}</td>,
                            ];
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '4px' }} border={1} cellPadding={1} cellSpacing={0}>
                    <thead>
                      <tr style={s.gris}><th colSpan={4} style={s.th}>Pourcentage des admis au {examLabel}</th></tr>
                      <tr><th style={{ ...s.th, width: '34%' }}>Genre</th>{labels.map(l => <th key={l} style={{ ...s.th, width: '22%', fontSize: '9px' }}>{l}</th>)}</tr>
                    </thead>
                    <tbody>
                      <tr><td style={s.td}>Garçons</td>{[e, z, c].map((l, i) => <td key={i} style={{ ...s.td, textAlign: 'center' }}>{gP(l)}</td>)}</tr>
                      <tr><td style={s.td}>Filles</td>{[e, z, c].map((l, i) => <td key={i} style={{ ...s.td, textAlign: 'center' }}>{fP(l)}</td>)}</tr>
                      <tr><td style={s.td}>Ensemble</td>{[e, z, c].map((l, i) => <td key={i} style={{ ...s.td, textAlign: 'center' }}>{eP(l)}</td>)}</tr>
                      <tr><td style={s.td}>Disparité aux dépens des</td>{[e, z, c].map((l, i) => <td key={i} style={{ ...s.td, textAlign: 'center', padding: 2 }}><DisparityIcon kind={depensAdmis(l)} /></td>)}</tr>
                    </tbody>
                  </table>
                  {selectedNiveau === 'lycee' && (
                    <p style={{ fontSize: '9px', textAlign: 'center', marginTop: '4px', color: '#666' }}>
                      Données BAC non encore importées — structure prête.
                    </p>
                  )}
                </>);
              })()}
            </td>
          </tr></tbody>
        </table>

        {/* RESSOURCES SCOLAIRES */}
        <div style={s.titre}>RESSOURCES SCOLAIRES</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }} cellSpacing={0}>
          <tbody><tr>
            <td style={{ width: '50%', verticalAlign: 'top', paddingRight: '4px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }} border={1} cellPadding={1} cellSpacing={0}>
                <thead><tr><th style={{ ...s.th, width: '46%' }}>Ressources</th>{labels.map(l => <th key={l} style={{ ...s.gris, ...s.th, width: '18%' }}>{l}</th>)}</tr></thead>
                <tbody>
                  {[
                    ["Nombre d'élèves", [fmt(e.ressources?.nbr_eleve), fmt(z.ressources?.nbr_eleve), fmt(c.ressources?.nbr_eleve)]],
                    ["Enseignants en classe", [fmt(e.personnel?.pers_en_classe), fmt(z.personnel?.pers_en_classe), fmt(c.personnel?.pers_en_classe)]],
                    ["Fonctionnaires", [fmt(e.personnel?.fonctionnaire), fmt(z.personnel?.fonctionnaire), fmt(c.personnel?.fonctionnaire)]],
                    ["FRAM subventionnés", [fmt(e.personnel?.sub), fmt(z.personnel?.sub), fmt(c.personnel?.sub)]],
                    ["FRAM non subventionnés", [fmt(e.personnel?.non_sub), fmt(z.personnel?.non_sub), fmt(c.personnel?.non_sub)]],
                    [selectedNiveau === 'college' ? 'Nombre de sections' : 'Classes pédagogiques', [fmt(e.sections?.nbr_section), fmt(z.sections?.nbr_section), fmt(c.sections?.nbr_section)]],
                  ].map(([label, vals]: any) => (
                    <tr key={label}><td style={s.td}>{label}</td>{vals.map((v: string, i: number) => <td key={i} style={{ ...s.td, textAlign: 'right', ...manq(v) }}>{v}</td>)}</tr>
                  ))}
                </tbody>
              </table>

              {/* Contexte / Environnements scolaires */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '3px' }} border={1} cellPadding={1} cellSpacing={0}>
                <thead><tr style={s.gris}><th colSpan={4} style={s.th}>{selectedNiveau === 'college' ? 'Environnements scolaires (Contexte)' : 'Contexte'}</th></tr></thead>
                <tbody>
                  {(selectedNiveau === 'college' ? [
                    ['Salles & équipements TICE', [pct(e.ressources?.etab_tice, e.ressources?.nbr_etab, 0), pct(z.ressources?.etab_tice, z.ressources?.nbr_etab, 0), pct(c.ressources?.etab_tice, c.ressources?.nbr_etab, 0)]],
                    ["Points d'eau fonctionnels", [pct(e.ressources?.etab_eau, e.ressources?.nbr_etab, 0), pct(z.ressources?.etab_eau, z.ressources?.nbr_etab, 0), pct(c.ressources?.etab_eau, c.ressources?.nbr_etab, 0)]],
                    ['Électricité', [pct(e.ressources?.etab_elec, e.ressources?.nbr_etab, 0), pct(z.ressources?.etab_elec, z.ressources?.nbr_etab, 0), pct(c.ressources?.etab_elec, c.ressources?.nbr_etab, 0)]],
                    ['Bibliothèque fonctionnelle', [pct(e.ressources?.etab_biblio, e.ressources?.nbr_etab, 0), pct(z.ressources?.etab_biblio, z.ressources?.nbr_etab, 0), pct(c.ressources?.etab_biblio, c.ressources?.nbr_etab, 0)]],
                  ] : [
                    ['Écoles continues', [pct(e.ressources?.ecole_continue, e.ressources?.nbr_etab), pct(z.ressources?.ecole_continue, z.ressources?.nbr_etab), pct(c.ressources?.ecole_continue, c.ressources?.nbr_etab)]],
                    ['Élèves < 2km', [pct(Number(e.ressources?.nbr_eleve || 0) - Number(e.ressources?.eleve_2km || 0), e.ressources?.nbr_eleve), pct(Number(z.ressources?.nbr_eleve || 0) - Number(z.ressources?.eleve_2km || 0), z.ressources?.nbr_eleve), pct(Number(c.ressources?.nbr_eleve || 0) - Number(c.ressources?.eleve_2km || 0), c.ressources?.nbr_eleve)]],
                    ['Point d\'eau', [pct(e.ressources?.etab_eau, e.ressources?.nbr_etab, 0), pct(z.ressources?.etab_eau, z.ressources?.nbr_etab, 0), pct(c.ressources?.etab_eau, c.ressources?.nbr_etab, 0)]],
                    ['Électricité', [pct(e.ressources?.etab_elec, e.ressources?.nbr_etab, 0), pct(z.ressources?.etab_elec, z.ressources?.nbr_etab, 0), pct(c.ressources?.etab_elec, c.ressources?.nbr_etab, 0)]],
                  ]).map(([label, vals]: any) => (
                    <tr key={label}><td style={s.td}>{label}</td>{vals.map((v: string, i: number) => <td key={i} style={{ ...s.td, textAlign: 'right', ...manq(v) }}>{v}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </td>

            {/* RIGHT - Ratios / Conditions d'apprentissage */}
            <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: '4px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }} border={1} cellPadding={1} cellSpacing={0}>
                <thead><tr><th style={{ ...s.th, width: '46%' }}>{selectedNiveau === 'college' ? "Conditions d'apprentissage" : 'Indicateurs'}</th>{labels.map(l => <th key={l} style={{ ...s.gris, ...s.th, width: '18%' }}>{l}</th>)}</tr></thead>
                <tbody>
                  {(selectedNiveau === 'college' ? [
                    ["Nombre d'élèves par enseignant", [ratio(e.ressources?.nbr_eleve, e.personnel?.pers_en_classe), ratio(z.ressources?.nbr_eleve, z.personnel?.pers_en_classe), ratio(c.ressources?.nbr_eleve, c.personnel?.pers_en_classe)]],
                    ['% enseignants qualifiés', [pct(Number(e.personnel?.pers_en_classe || 0) - Number(e.personnel?.sans_diplome_ped || 0), e.personnel?.pers_en_classe), pct(Number(z.personnel?.pers_en_classe || 0) - Number(z.personnel?.sans_diplome_ped || 0), z.personnel?.pers_en_classe), pct(Number(c.personnel?.pers_en_classe || 0) - Number(c.personnel?.sans_diplome_ped || 0), c.personnel?.pers_en_classe)]],
                    ['Ratio section par salle', [ratio(e.sections?.nbr_section, e.sections?.nbr_sdc), ratio(z.sections?.nbr_section, z.sections?.nbr_sdc), ratio(c.sections?.nbr_section, c.sections?.nbr_sdc)]],
                    ["Nombre d'élèves par place assise", [ratio(e.ressources?.nbr_eleve, e.places?.places_assises), ratio(z.ressources?.nbr_eleve, z.places?.places_assises), ratio(c.ressources?.nbr_eleve, c.places?.places_assises)]],
                    ["Nombre d'élèves par Latrine", [ratio(e.ressources?.nbr_eleve, e.places?.latrines), ratio(z.ressources?.nbr_eleve, z.places?.latrines), ratio(c.ressources?.nbr_eleve, c.places?.latrines)]],
                    ["Nombre d'élèves par Latrine pour filles", [ratio(e.ressources?.nbr_eleve_f, e.places?.latrines_fille), ratio(z.ressources?.nbr_eleve_f, z.places?.latrines_fille), ratio(c.ressources?.nbr_eleve_f, c.places?.latrines_fille)]],
                    ["% Élèves vivants à plus de 5km", [pct(e.ressources?.eleve_5km, e.ressources?.nbr_eleve), pct(z.ressources?.eleve_5km, z.ressources?.nbr_eleve), pct(c.ressources?.eleve_5km, c.ressources?.nbr_eleve)]],
                  ] : [
                    ['Élèves/maître', [ratio(e.ressources?.nbr_eleve, e.personnel?.pers_en_classe), ratio(z.ressources?.nbr_eleve, z.personnel?.pers_en_classe), ratio(c.ressources?.nbr_eleve, c.personnel?.pers_en_classe)]],
                    ['% enseignants qualifiés', [pct(Number(e.personnel?.pers_en_classe || 0) - Number(e.personnel?.sans_diplome_ped || 0), e.personnel?.pers_en_classe), pct(Number(z.personnel?.pers_en_classe || 0) - Number(z.personnel?.sans_diplome_ped || 0), z.personnel?.pers_en_classe), pct(Number(c.personnel?.pers_en_classe || 0) - Number(c.personnel?.sans_diplome_ped || 0), c.personnel?.pers_en_classe)]],
                    ['Classes/salle', [ratio(e.sections?.nbr_section, e.sections?.nbr_sdc), ratio(z.sections?.nbr_section, z.sections?.nbr_sdc), ratio(c.sections?.nbr_section, c.sections?.nbr_sdc)]],
                    ["Nombre d'élèves par place", [ratio(e.ressources?.nbr_eleve, e.places?.places_assises), ratio(z.ressources?.nbr_eleve, z.places?.places_assises), ratio(c.ressources?.nbr_eleve, c.places?.places_assises)]],
                    ["Nombre d'élèves par latrine", [ratio(e.ressources?.nbr_eleve, e.places?.latrines), ratio(z.ressources?.nbr_eleve, z.places?.latrines), ratio(c.ressources?.nbr_eleve, c.places?.latrines)]],
                    ['Nombre de filles par latrine fille', [ratio(e.ressources?.nbr_eleve_f, e.places?.latrines_fille), ratio(z.ressources?.nbr_eleve_f, z.places?.latrines_fille), ratio(c.ressources?.nbr_eleve_f, c.places?.latrines_fille)]],
                    ["Nombre d'élèves par manuel Malagasy", [ratio(e.ressources?.nbr_eleve, e.manuels?.malagasy), ratio(z.ressources?.nbr_eleve, z.manuels?.malagasy), ratio(c.ressources?.nbr_eleve, c.manuels?.malagasy)]],
                    ["Nombre d'élèves par manuel Mathématiques", [ratio(e.ressources?.nbr_eleve, e.manuels?.maths), ratio(z.ressources?.nbr_eleve, z.manuels?.maths), ratio(c.ressources?.nbr_eleve, c.manuels?.maths)]],
                    ["Nombre d'élèves par manuel Français", [ratio(e.ressources?.nbr_eleve, e.manuels?.francais), ratio(z.ressources?.nbr_eleve, z.manuels?.francais), ratio(c.ressources?.nbr_eleve, c.manuels?.francais)]],
                  ]).map(([label, vals]: any) => (
                    <tr key={label}><td style={s.td}>{label}</td>{vals.map((v: string, i: number) => <td key={i} style={{ ...s.td, textAlign: 'right', ...manq(v) }}>{v}</td>)}</tr>
                  ))}
                </tbody>
              </table>

              {/* Ressources financières */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '3px' }} border={1} cellPadding={1} cellSpacing={0}>
                <thead><tr style={s.gris}><th colSpan={4} style={s.th}>Ressources financières (Ariary)</th></tr></thead>
                <tbody>
                  <tr><td style={s.td}>{selectedNiveau === 'college' ? 'Caisse de soutien / Subvention' : 'Caisse écoles'}</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>{fmt(e.caisse?.total_fce || 0)}</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>{fmt(z.caisse?.total_fce || 0)}</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>{fmt(c.caisse?.total_fce || 0)}</td>
                  </tr>
                  {selectedNiveau === 'college' && (
                    <tr><td style={s.td}>Autres</td>
                      <td style={{ ...s.td, textAlign: 'right', ...manq(fmt(e.caisse?.autres)) }}>{fmt(e.caisse?.autres)}</td>
                      <td style={{ ...s.td, textAlign: 'right', ...manq(fmt(z.caisse?.autres)) }}>{fmt(z.caisse?.autres)}</td>
                      <td style={{ ...s.td, textAlign: 'right', ...manq(fmt(c.caisse?.autres)) }}>{fmt(c.caisse?.autres)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </td>
          </tr></tbody>
        </table>

        {/* === EFFICIENCE — grille smileys 3x3 style PDF CEG === */}
        {(() => {
          const etabLbl = selectedNiveau === 'college' ? 'CEG' : selectedNiveau === 'lycee' ? 'Lycée' : 'École';
          const redEns = pctVal(Number(e.ressources?.red_g || 0) + Number(e.ressources?.red_f || 0), e.ressources?.nbr_eleve);
          const lastK = selectedNiveau === 'primaire' ? 't5' : selectedNiveau === 'college' ? 't4' : 't3';
          const retEns = pctVal(e.ressources?.[`eff_${lastK}`], e.ressources?.eff_t1);
          const examKey = selectedNiveau === 'college' ? 'bepc' : selectedNiveau === 'lycee' ? 'bac' : 'cepe';
          const admisEns = pctVal(Number(e?.[examKey]?.admis_g || 0) + Number(e?.[examKey]?.admis_f || 0), Number(e?.[examKey]?.nbr_g || 0) + Number(e?.[examKey]?.nbr_f || 0));
          const scoreY = Math.round((((100 - Math.min(redEns, 100)) + retEns + admisEns) / 3) * 10) / 10;
          const rem = norm(Number(e.ressources?.nbr_eleve || 0) / Math.max(Number(e.personnel?.pers_en_classe || 1), 1), 45, 60);
          const eau = e.ressources?.etab_eau ? 100 : 0;
          const elec = e.ressources?.etab_elec ? 100 : 0;
          const scoreX = Math.round((((rem + eau + elec) / 3)) * 10) / 10;
          // Bin scores into 3 buckets (Bon ≥66, Moyen 33–66, Faible <33)
          const binX = scoreX >= 66 ? 2 : scoreX >= 33 ? 1 : 0; // 0 col = faible ress, 2 = bonne
          const binY = scoreY >= 66 ? 2 : scoreY >= 33 ? 1 : 0;
          // grid coord: row 0 = top (good results), row 2 = bottom (low results)
          const row = 2 - binY;
          const col = binX; // col 0 left = poor resources
          const FACES = [
            // ligne 0 (haut) — bons résultats
            ['😊', '😊', '😊'],
            // ligne 1 — moyen
            ['😐', '😐', '😐'],
            // ligne 2 (bas) — faibles
            ['☹️', '☹️', '😢'],
          ];
          return (
            <>
              <div style={s.titre}>Efficience</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {[0, 1, 2].map((r) => (
                    <tr key={r}>
                      {[0, 1, 2].map((c) => {
                        const active = r === row && c === col;
                        return (
                          <td key={c} style={{ border: '1px solid #888', width: '33.33%', height: '70px', textAlign: 'center', fontSize: '38px', position: 'relative', background: active ? '#fff8b0' : '#fff' }}>
                            <span style={{ opacity: active ? 1 : 0.35 }}>{FACES[r][c]}</span>
                            {active && (
                              <>
                                <span style={{ position: 'absolute', top: '4px', right: '6px', fontSize: '9px', fontWeight: 'bold', color: '#2e7d32' }}>{etabLbl}</span>
                                <span style={{ position: 'absolute', right: '4px', bottom: '2px', fontSize: '22px', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.3))' }} title="Position actuelle">🏍️</span>
                              </>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                </tbody>
              </table>
              <table style={{ width: '100%', fontSize: '9px', marginTop: '2px' }}>
                <tbody>
                  <tr>
                    <td style={{ textAlign: 'left' }}>← Ressources faibles</td>
                    <td style={{ textAlign: 'center' }}>Ressources moyennes</td>
                    <td style={{ textAlign: 'right' }}>Ressources élevées →</td>
                  </tr>
                </tbody>
              </table>

              {/* === DIAGNOSTIC ET REMARQUES (auto) === */}
              <div style={{ marginTop: '10px', borderTop: '1px solid #000', paddingTop: '6px' }}>
                <div style={{ fontSize: '10px', fontWeight: 'bold', fontStyle: 'italic', textDecoration: 'underline', marginBottom: '4px' }}>
                  Diagnostic et Remarques sur les résultats de votre {etabLbl} :
                </div>
                <div style={{ minHeight: '60px', border: '1px solid #888', padding: '6px', background: '#fff', fontSize: '10px', lineHeight: '1.45' }}>
                  {(() => {
                    const niveauX = binX === 2 ? 'élevées' : binX === 1 ? 'moyennes' : 'faibles';
                    const niveauY = binY === 2 ? 'bons' : binY === 1 ? 'moyens' : 'faibles';
                    const reco = binY < binX
                      ? `Les ressources sont ${niveauX} mais les résultats restent ${niveauY} : un travail d'accompagnement pédagogique et de suivi des élèves est recommandé.`
                      : binY > binX
                        ? `Avec des ressources ${niveauX}, votre ${etabLbl} obtient des résultats ${niveauY} : performance remarquable, à pérenniser.`
                        : `Vos ressources (${niveauX}) et vos résultats (${niveauY}) sont alignés. Pour progresser, ciblez en priorité ${binX < 2 ? 'le renforcement des ressources' : 'la qualité pédagogique'}.`;
                    return (
                      <div>
                        <div><b>Position :</b> Ressources <i>{niveauX}</i> · Résultats <i>{niveauY}</i> (score X = {scoreX.toFixed(1)} / Y = {scoreY.toFixed(1)})</div>
                        <div style={{ marginTop: 4 }}>{reco}</div>
                        <div style={{ marginTop: 4, color: '#555' }}>Taux d'abandon, redoublement et admission au {examKey.toUpperCase()} doivent être analysés conjointement avec les disparités filles / garçons ci-dessus.</div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </>
          );
        })()}

      </div>

    );
  };



  const ecoleName = tdbData?.names?.NOM_ETAB ?? (ecoles.find(e => String(e.CODE_ETAB) === selectedEcole)?.NOM_ETAB ?? '');
  const anneeLabel = selectedAnnee ? `${Number(selectedAnnee) - 1} – ${selectedAnnee}` : '';

  return (
    <>
      <TDBShell
        level="ÉCOLE"
        cycle="PRIMAIRE"
        title={`Tableau de Bord — ${selectedNiveau === 'college' ? 'CEG' : selectedNiveau === 'lycee' ? 'Lycée' : 'École'}`}
        entityName={ecoleName}
        entityCode={selectedEcole !== '0' ? selectedEcole : undefined}
        annee={anneeLabel}
        loading={loading}
        hasData={!!tdbData}
        
        generatingPdf={generatingPdf}
        generatingPreview={generatingPreview}
        onDownloadPdf={tdbData ? generatePdf : undefined}
        onPrint={tdbData ? () => { if (printRef.current) printTdb(printRef.current, `TDB_ECOLE_${tdbData.names.NOM_ETAB}_${tdbData.annee}`); } : undefined}
        onImportCsv={() => setImportOpen(true)}
        filters={
          <>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">DREN</label>
              <Select value={selectedDren} onValueChange={handleDrenChange}>
                <SelectTrigger className="w-44"><SelectValue placeholder="DREN" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sélectionner</SelectItem>
                  {drens.map(d => <SelectItem key={d.CODE_DREN} value={d.CODE_DREN.toString()}>{d.DREN}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">CISCO</label>
              <Select value={selectedCisco} onValueChange={handleCiscoChange} disabled={selectedDren === '0'}>
                <SelectTrigger className="w-48"><SelectValue placeholder="CISCO" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sélectionner</SelectItem>
                  {ciscos.map(c => <SelectItem key={c.CODE_CISCO} value={c.CODE_CISCO.toString()}>{c.CISCO}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Niveau</label>
              <Select value={selectedNiveau} onValueChange={(v) => handleNiveauChange(v as any)}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="primaire">Primaire</SelectItem>
                  <SelectItem value="college">Collège</SelectItem>
                  <SelectItem value="lycee">Lycée</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">ZAP</label>
              <Select value={selectedZap} onValueChange={handleZapChange} disabled={selectedCisco === '0'}>
                <SelectTrigger className="w-48"><SelectValue placeholder="ZAP" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sélectionner</SelectItem>
                  {zaps.map(z => <SelectItem key={z.CODE_ZAP} value={z.CODE_ZAP.toString()}>{z.ZAP}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">École</label>
              <Select value={selectedEcole} onValueChange={v => { setSelectedEcole(v); setTdbData(null); }} disabled={selectedZap === '0'}>
                <SelectTrigger className="w-56"><SelectValue placeholder="École" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sélectionner</SelectItem>
                  {ecoles.map(ec => <SelectItem key={ec.CODE_ETAB} value={ec.CODE_ETAB.toString()}>{ec.NOM_ETAB}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Année</label>
              <Select value={selectedAnnee} onValueChange={v => { setSelectedAnnee(v); setTdbData(null); }}>
                <SelectTrigger className="w-32"><SelectValue placeholder="Année" /></SelectTrigger>
                <SelectContent>
                  {availableYears.map(y => <SelectItem key={y} value={String(y)}>{y - 1}-{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="hidden md:block ml-auto">
              <DataActionsBar table="tdb_ecole" tableLabel="TDB École" compact />
            </div>
          </>
        }
        primaryAction={
          <Button onClick={loadTdb} disabled={selectedEcole === '0' || loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Appliquer
          </Button>
        }
        tabs={[
          { value: 'tdb', label: 'Tableau de bord', content: renderTdb() },
        ]}

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

export default TDBEcole;
