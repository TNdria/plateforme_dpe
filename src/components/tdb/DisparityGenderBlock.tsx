/**
 * DisparityGenderBlock — bloc « Résultats Scolaires » reproduisant fidèlement
 * le canevas officiel du TdB CEG :
 *   • Ligne 1 : Taux d'abandon (par transition de niveau) + Pourcentage des
 *     redoublants (par classe).
 *   • Ligne 2 : Taux de rétention par genre + Pourcentage de redoublants par
 *     genre, avec une ligne « Disparité aux dépens de » qui affiche une
 *     vignette fille / garçon selon le ratio F/G.
 *   • Encart Résultats BEPC (matières × SM / >=10) + Pourcentage des admis au
 *     BEPC par genre.
 */

import filleImg from '@/assets/score/fille.png';
import garconsImg from '@/assets/score/garcons.png';

type Lvl = any;

interface Props {
  /** Niveau pédagogique pour libellé examen */
  niveau?: 'primaire' | 'college' | 'lycee';
  /** Entité courante (école / ZAP / CISCO / DREN) */
  entity: Lvl;
  /** Libellé de l'entité (École, ZAP…) */
  entityLabel?: string;
  /** Données ZAP (optionnel, pour colonne contextuelle) */
  zapData?: Lvl;
  /** Données CISCO (optionnel, pour colonne contextuelle) */
  ciscoData?: Lvl;
  /** Affichage examen final selon le niveau */
  examLabel?: string;  // "BEPC", "CEPE", "BAC"…
}

const pctRaw = (num: any, den: any) => {
  const n = Number(num), d = Number(den);
  if (!d || isNaN(n) || isNaN(d)) return null;
  return (n / d) * 100;
};

const fmtPct = (v: number | null) => v == null ? '-' : v.toFixed(1) + '%';

const titreStyle: React.CSSProperties = {
  width: '100%', background: '#e9ecef', color: '#000', padding: '5px 10px',
  marginTop: 6, marginBottom: 6, fontWeight: 'bold', fontSize: 12,
  textAlign: 'center', border: '1px solid #555',
};
const cell: React.CSSProperties = { padding: '3px 6px', fontSize: 10, border: '1px solid #555', verticalAlign: 'middle' };
const th: React.CSSProperties = { ...cell, background: '#e9ecef', fontWeight: 'bold', textAlign: 'center' };
const subtitle: React.CSSProperties = { ...cell, background: '#f5f5f5', fontWeight: 'bold', textAlign: 'center', fontSize: 11 };

/** Couleurs d'état conformes au canevas officiel */
const COLOR_NONE = '#cfe2f3';   // bleu — données non disponibles
const COLOR_CHECK = '#fff2a8';  // jaune — données à vérifier
const COLOR_WARN = '#f4b6b6';   // rouge — attention

/** Décide la couleur de fond d'une cellule selon la valeur. */
function cellBg(v: number | null, kind: 'abandon' | 'redoublant'): string {
  if (v == null) return COLOR_NONE;
  if (kind === 'abandon' && v > 10) return COLOR_WARN;
  if (kind === 'redoublant' && v > 15) return COLOR_WARN;
  return 'transparent';
}

function getNiveauConfig(niveau: 'primaire' | 'college' | 'lycee') {
  if (niveau === 'college') {
    return {
      transitions: [
        { label: '6e → 5e', from: 't1', to: 't2' },
        { label: '5e → 4e', from: 't2', to: 't3' },
        { label: '4e → 3e', from: 't3', to: 't4' },
      ],
      classes: [
        { label: '6e', key: 't1' },
        { label: '5e', key: 't2' },
        { label: '4e', key: 't3' },
        { label: '3e', key: 't4' },
      ],
    };
  }
  if (niveau === 'lycee') {
    return {
      transitions: [
        { label: '2nde → 1ère', from: 't1', to: 't2' },
        { label: '1ère → Tle', from: 't2', to: 't3' },
      ],
      classes: [
        { label: '2nde', key: 't1' },
        { label: '1ère', key: 't2' },
        { label: 'Tle', key: 't3' },
      ],
    };
  }
  return {
    transitions: [
      { label: 'T1 → T2', from: 't1', to: 't2' },
      { label: 'T2 → T3', from: 't2', to: 't3' },
      { label: 'T3 → T4', from: 't3', to: 't4' },
      { label: 'T4 → T5', from: 't4', to: 't5' },
    ],
    classes: [
      { label: 'CP1', key: 't1' },
      { label: 'CP2', key: 't2' },
      { label: 'CE',  key: 't3' },
      { label: 'CM1', key: 't4' },
      { label: 'CM2', key: 't5' },
    ],
  };
}

/** Taux d'abandon entre deux niveaux : 1 - (eff_to / eff_from). */
function abandonRate(src: any, from: string, to: string): number | null {
  const r = src?.ressources || {};
  const a = Number(r[`eff_${from}`]);
  const b = Number(r[`eff_${to}`]);
  if (!a || isNaN(a) || isNaN(b)) return null;
  return Math.max(0, (1 - b / a) * 100);
}

/** Taux d'abandon ensemble : 1 - (eff dernier / eff premier). */
function abandonEnsemble(src: any, firstKey: string, lastKey: string): number | null {
  return abandonRate(src, firstKey, lastKey);
}

/** % redoublants à un niveau donné : red_<key> / eff_<key>. */
function redoublantRate(src: any, key: string): number | null {
  const r = src?.ressources || {};
  const num = Number(r[`red_${key}`]);
  const den = Number(r[`eff_${key}`]);
  if (!den || isNaN(num) || isNaN(den)) return null;
  return (num / den) * 100;
}

/** Lecture tolérante d'un nombre — accepte virgule, % et chaînes vides. */
function num(v: any): number | null {
  if (v == null) return null;
  const s = String(v).trim().replace('%', '').replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Cherche une clé dans `ressources` puis directement sur la ligne. */
function pick(src: any, ...keys: string[]): number | null {
  if (!src) return null;
  const bag = src?.ressources || {};
  for (const k of keys) {
    if (bag[k] != null) {
      const v = num(bag[k]);
      if (v != null) return v;
    }
    if (src[k] != null) {
      const v = num(src[k]);
      if (v != null) return v;
    }
  }
  return null;
}

/** Vignette indiquant aux dépens de qui (fille / garçon / égalité). */
function DisparityCell({ ratio, mode }: { ratio: number | null; mode: 'retention' | 'redoublant' }) {
  // retention : ratio = F/G ; F<G ⇒ disparité aux dépens des filles.
  // redoublant : ratio = F/G ; F<G (moins de filles redoublent) ⇒ aux dépens des garçons.
  if (ratio == null || !Number.isFinite(ratio) || (ratio >= 0.97 && ratio <= 1.03)) {
    return <span style={{ color: '#777' }}>—</span>;
  }
  const fileLow = ratio < 0.97;
  const showFille = mode === 'retention' ? fileLow : !fileLow;
  const src = showFille ? filleImg : garconsImg;
  const alt = showFille ? 'Aux dépens des filles' : 'Aux dépens des garçons';
  return <img src={src} alt="" title={alt} style={{ height: 36, width: 'auto', display: 'inline-block' }} />;
}

export function DisparityGenderBlock({
  niveau = 'college',
  entity,
  entityLabel = 'Établissement',
  zapData,
  ciscoData,
  examLabel,
}: Props) {
  if (!entity) return null;
  const cfg = getNiveauConfig(niveau);
  const sources: Array<{ label: string; src: any }> = [
    { label: entityLabel, src: entity },
    { label: 'ZAP', src: zapData ?? null },
    { label: 'CISCO', src: ciscoData ?? null },
  ];

  // Lignes Taux d'abandon
  const abRows = cfg.transitions.map(t => ({
    label: t.label,
    values: sources.map(s => abandonRate(s.src, t.from, t.to)),
  }));
  const firstKey = cfg.classes[0].key;
  const lastKey = cfg.classes[cfg.classes.length - 1].key;
  abRows.push({
    label: 'Ensemble',
    values: sources.map(s => abandonEnsemble(s.src, firstKey, lastKey)),
  });

  // Lignes redoublants
  const redRows = cfg.classes.map(c => ({
    label: c.label,
    values: sources.map(s => redoublantRate(s.src, c.key)),
  }));

  // --- Rétention par genre ---
  const retG = sources.map(s => pick(s.src, 'txRetentionGarcons', 'tx_retention_garcons', 'ret_g'));
  const retF = sources.map(s => pick(s.src, 'txRetentionFilles', 'tx_retention_filles', 'ret_f'));
  const retT = sources.map(s => pick(s.src, 'txRetentionTotal', 'tx_retention_total', 'ret_ensemble'));
  const retRatio = sources.map((_, i) => (retG[i] && retF[i] ? retF[i]! / retG[i]! : null));

  // --- Redoublants par genre ---
  const redG = sources.map(s => pick(s.src, 'red_garcons', 'pct_red_garcons'));
  const redF = sources.map(s => pick(s.src, 'red_fille', 'red_filles', 'pct_red_filles'));
  const redT = sources.map(s => pick(s.src, 'red_ensemble', 'pct_red_ensemble'));
  const redRatio = sources.map((_, i) => (redG[i] && redF[i] ? redF[i]! / redG[i]! : null));

  // --- Admis examen final par genre ---
  const exam = examLabel ?? (niveau === 'college' ? 'BEPC' : niveau === 'lycee' ? 'BAC' : 'CEPE');
  const admG = sources.map(s => pick(s.src, 'tx_admis_g', 'tx_admis_garcons'));
  const admF = sources.map(s => pick(s.src, 'tx_admis_f', 'tx_admis_filles'));
  const admT = sources.map(s => pick(s.src, 'tx_admis', 'tx_admis_ensemble'));
  const admRatio = sources.map((_, i) => (admG[i] && admF[i] ? admF[i]! / admG[i]! : null));

  const Legend = () => (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }} cellSpacing={0}>
      <tbody>
        <tr>
          <td style={{ ...cell, width: 120, background: COLOR_NONE }}>&nbsp;</td>
          <td style={{ ...cell, textAlign: 'center' }}>Données non disponible</td>
        </tr>
        <tr>
          <td style={{ ...cell, background: COLOR_CHECK }}>&nbsp;</td>
          <td style={{ ...cell, textAlign: 'center' }}>Données à vérifier</td>
        </tr>
        <tr>
          <td style={{ ...cell, background: COLOR_WARN }}>&nbsp;</td>
          <td style={{ ...cell, textAlign: 'center' }}>Attention !</td>
        </tr>
      </tbody>
    </table>
  );

  const renderTable = (
    title: string,
    rows: Array<{ label: string; values: Array<number | null> }>,
    kind: 'abandon' | 'redoublant',
  ) => (
    <table style={{ width: '100%', borderCollapse: 'collapse' }} cellSpacing={0}>
      <thead>
        <tr>
          <th colSpan={4} style={subtitle}>{title}</th>
        </tr>
        <tr>
          <th style={{ ...th, width: '34%' }}>Niveau</th>
          {sources.map(s => (
            <th key={s.label} style={th}>{s.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.label}>
            <td style={cell}>{r.label}</td>
            {r.values.map((v, i) => (
              <td key={i} style={{ ...cell, textAlign: 'center', background: cellBg(v, kind) }}>
                {fmtPct(v)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

  /** Tableau ventilé par genre + ligne « Disparité aux dépens de ». */
  const renderGenderTable = (
    title: string,
    g: Array<number | null>,
    f: Array<number | null>,
    t: Array<number | null>,
    ratios: Array<number | null>,
    mode: 'retention' | 'redoublant',
    kind: 'abandon' | 'redoublant',
  ) => (
    <table style={{ width: '100%', borderCollapse: 'collapse' }} cellSpacing={0}>
      <thead>
        <tr><th colSpan={4} style={subtitle}>{title}</th></tr>
        <tr>
          <th style={{ ...th, width: '34%' }}>Niveau</th>
          {sources.map(s => <th key={s.label} style={th}>{s.label}</th>)}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style={cell}>Garçons</td>
          {g.map((v, i) => <td key={i} style={{ ...cell, textAlign: 'center', background: cellBg(v, kind) }}>{fmtPct(v)}</td>)}
        </tr>
        <tr>
          <td style={cell}>Filles</td>
          {f.map((v, i) => <td key={i} style={{ ...cell, textAlign: 'center', background: cellBg(v, kind) }}>{fmtPct(v)}</td>)}
        </tr>
        <tr>
          <td style={cell}>Ensemble</td>
          {t.map((v, i) => <td key={i} style={{ ...cell, textAlign: 'center', background: cellBg(v, kind) }}>{fmtPct(v)}</td>)}
        </tr>
        <tr>
          <td style={{ ...cell, fontStyle: 'italic' }}>Disparité aux dépens de</td>
          {ratios.map((r, i) => (
            <td key={i} style={{ ...cell, textAlign: 'center', padding: 2 }}>
              <DisparityCell ratio={r} mode={mode} />
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );

  /** Tableau Pourcentage des admis à l'examen par genre. */
  const renderAdmisTable = () => (
    <table style={{ width: '100%', borderCollapse: 'collapse' }} cellSpacing={0}>
      <thead>
        <tr><th colSpan={4} style={subtitle}>Pourcentage des admis au {exam}</th></tr>
        <tr>
          <th style={{ ...th, width: '34%' }}>Genre</th>
          {sources.map(s => <th key={s.label} style={th}>{s.label}</th>)}
        </tr>
      </thead>
      <tbody>
        <tr><td style={cell}>Garçons</td>{admG.map((v, i) => <td key={i} style={{ ...cell, textAlign: 'center' }}>{fmtPct(v)}</td>)}</tr>
        <tr><td style={cell}>Filles</td>{admF.map((v, i) => <td key={i} style={{ ...cell, textAlign: 'center' }}>{fmtPct(v)}</td>)}</tr>
        <tr><td style={cell}>Ensemble</td>{admT.map((v, i) => <td key={i} style={{ ...cell, textAlign: 'center' }}>{fmtPct(v)}</td>)}</tr>
        <tr>
          <td style={{ ...cell, fontStyle: 'italic' }}>Disparité aux dépens des</td>
          {admRatio.map((r, i) => (
            <td key={i} style={{ ...cell, textAlign: 'center', padding: 2 }}>
              <DisparityCell ratio={r} mode="retention" />
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );

  return (
    <div>
      <div style={titreStyle}>DISPARITÉ FILLES / GARÇONS</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {renderTable("Taux d'abandon", abRows, 'abandon')}
        {renderTable('Pourcentage des redoublants', redRows, 'redoublant')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
        {renderGenderTable('Taux de rétention', retG, retF, retT, retRatio, 'retention', 'abandon')}
        {renderGenderTable('Pourcentage de Redoublants par genre', redG, redF, redT, redRatio, 'redoublant', 'redoublant')}
      </div>
      <div style={{ marginTop: 12 }}>
        {renderAdmisTable()}
      </div>
    </div>
  );
}

export default DisparityGenderBlock;