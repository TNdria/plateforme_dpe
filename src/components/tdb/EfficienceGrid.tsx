/**
 * EfficienceGrid — graphique unique « Efficience ».
 * Grille 3x3 à pictogrammes en fond + points des entités (nom au survol).
 * L'entité concernée et son entité parente sont mises en évidence.
 * Aucune valeur X/Y n'est affichée (remarques TDB 2026).
 */
export interface EfficiencePoint {
  name: string;
  x: number;
  y: number;
  isCurrent?: boolean;
  isParent?: boolean;
}

interface Props {
  entity: any;
  niveau?: 'primaire' | 'college' | 'lycee';
  entityLabel?: string;
  /** Entités sœurs (+ entité courante marquée isCurrent) */
  points?: EfficiencePoint[];
  /** Entité parente de comparaison (ZAP / CISCO / DREN) */
  parentPoint?: EfficiencePoint | null;
  pointsTitle?: string;
}

const norm = (val: number, lo: number, hi: number) => {
  if (!isFinite(val) || val <= 0) return 0;
  if (val <= lo) return 100;
  if (val >= hi) return 0;
  return ((hi - val) / (hi - lo)) * 100;
};
const pctVal = (n: any, d: any) => {
  const a = Number(n), b = Number(d);
  return b > 0 && !isNaN(a) ? (a / b) * 100 : 0;
};

const W = 600, H = 300;
const FACES = [['😊', '😊', '😊'], ['😐', '😐', '😐'], ['☹️', '☹️', '😢']];

export function EfficienceGrid({ entity, niveau = 'primaire', entityLabel = 'Entité', points = [], parentPoint = null }: Props) {
  if (!entity) return null;
  const examKey = niveau === 'college' ? 'bepc' : niveau === 'lycee' ? 'bac' : 'cepe';
  const lastK = niveau === 'primaire' ? 't5' : niveau === 'college' ? 't4' : 't3';

  const redEns = pctVal(Number(entity.ressources?.red_g || 0) + Number(entity.ressources?.red_f || 0), entity.ressources?.nbr_eleve);
  const retEns = Math.min(pctVal(entity.ressources?.[`eff_${lastK}`], entity.ressources?.eff_t1), 100);
  const admisEns = pctVal(
    Number(entity?.[examKey]?.admis_g || 0) + Number(entity?.[examKey]?.admis_f || 0),
    Number(entity?.[examKey]?.nbr_g || 0) + Number(entity?.[examKey]?.nbr_f || 0),
  );
  const scoreY = ((100 - Math.min(redEns, 100)) + retEns + admisEns) / 3;
  const rem = norm(Number(entity.ressources?.nbr_eleve || 0) / Math.max(Number(entity.personnel?.pers_en_classe || 1), 1), 45, 60);
  const etabEau = Number(entity.ressources?.etab_eau || 0);
  const etabElec = Number(entity.ressources?.etab_elec || 0);
  const nbrEtab = Math.max(Number(entity.ressources?.nbr_etab || 1), 1);
  const eau = etabEau > 1 ? (etabEau / nbrEtab) * 100 : etabEau * 100;
  const elec = etabElec > 1 ? (etabElec / nbrEtab) * 100 : etabElec * 100;
  const scoreX = (rem + Math.min(eau, 100) + Math.min(elec, 100)) / 3;

  const current = points.find((p) => p.isCurrent);
  const refX = current ? Number(current.x) : scoreX;
  const refY = current ? Number(current.y) : scoreY;

  const binX = refX >= 66 ? 2 : refX >= 33 ? 1 : 0;
  const binY = refY >= 66 ? 2 : refY >= 33 ? 1 : 0;
  const row = 2 - binY, col = binX;

  const niveauX = binX === 2 ? 'élevées' : binX === 1 ? 'moyennes' : 'faibles';
  const niveauY = binY === 2 ? 'bons' : binY === 1 ? 'moyens' : 'faibles';
  const reco = binY < binX
    ? `Ressources ${niveauX} mais résultats ${niveauY} : accompagnement pédagogique recommandé.`
    : binY > binX
      ? `Avec des ressources ${niveauX}, les résultats sont ${niveauY} : performance à pérenniser.`
      : `Ressources (${niveauX}) et résultats (${niveauY}) alignés. Cibler ${binX < 2 ? 'le renforcement des ressources' : 'la qualité pédagogique'}.`;

  const clamp = (v: number) => Math.max(1.5, Math.min(98.5, Number(v) || 0));
  const px = (x: number) => (clamp(x) / 100) * W;
  const py = (y: number) => H - (clamp(y) / 100) * H;
  const cw = W / 3, ch = H / 3;
  const siblings = points.filter((p) => !p.isCurrent && !p.isParent);
  const parent = parentPoint || points.find((p) => p.isParent) || null;
  const cur = { name: current?.name || entityLabel, x: refX, y: refY };

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', border: '1px solid #888', background: '#fff' }}>
        {[0, 1, 2].map((r) => [0, 1, 2].map((c) => {
          const active = r === row && c === col;
          return (
            <g key={`${r}-${c}`}>
              <rect x={c * cw} y={r * ch} width={cw} height={ch} fill={active ? '#fff8b0' : '#fff'} stroke="#888" strokeWidth={1} />
              <text x={c * cw + cw / 2} y={r * ch + ch / 2 + 14} textAnchor="middle" fontSize={40} opacity={active ? 0.9 : 0.25}>{FACES[r][c]}</text>
            </g>
          );
        }))}
        {siblings.map((p, i) => (
          <circle key={`${p.name}-${i}`} cx={px(p.x)} cy={py(p.y)} r={5} fill="#337ab7" fillOpacity={0.55} stroke="#fff" strokeWidth={1} style={{ cursor: 'pointer' }}>
            <title>{p.name}</title>
          </circle>
        ))}
        {parent && (
          <g>
            <rect x={px(parent.x) - 7} y={py(parent.y) - 7} width={14} height={14} fill="#2e7d32" stroke="#fff" strokeWidth={1.5} transform={`rotate(45 ${px(parent.x)} ${py(parent.y)})`}>
              <title>{parent.name}</title>
            </rect>
            <text x={px(parent.x) + 11} y={py(parent.y) + 4} fontSize={11} fontWeight="bold" fill="#2e7d32">{parent.name}</text>
          </g>
        )}
        <g>
          <circle cx={px(cur.x)} cy={py(cur.y)} r={9} fill="#c62828" stroke="#fff" strokeWidth={2}>
            <title>{cur.name}</title>
          </circle>
          <text x={px(cur.x) + 13} y={py(cur.y) - 8} fontSize={12} fontWeight="bold" fill="#c62828">{cur.name}</text>
        </g>
      </svg>
      <table style={{ width: '100%', fontSize: 9, marginTop: 2 }}>
        <tbody>
          <tr>
            <td style={{ textAlign: 'left' }}>← Ressources faibles</td>
            <td style={{ textAlign: 'center' }}>Ressources moyennes</td>
            <td style={{ textAlign: 'right' }}>Ressources élevées →</td>
          </tr>
        </tbody>
      </table>
      <div style={{ fontSize: 9, marginTop: 2, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 9, background: '#c62828', marginRight: 3 }} />{entityLabel} concerné(e)</span>
        {parent && <span><span style={{ display: 'inline-block', width: 8, height: 8, background: '#2e7d32', transform: 'rotate(45deg)', marginRight: 4 }} />Niveau de comparaison</span>}
        {siblings.length > 0 && <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 8, background: '#337ab7', opacity: 0.6, marginRight: 3 }} />Autres (nom au survol)</span>}
      </div>
      <div style={{ marginTop: 6, fontSize: 10, border: '1px solid #888', padding: 6, background: '#fff', lineHeight: 1.45 }}>
        <div>Ressources <i>{niveauX}</i> · Résultats <i>{niveauY}</i></div>
        <div style={{ marginTop: 4 }}>{reco}</div>
      </div>
    </div>
  );
}

export default EfficienceGrid;

/** Scores ressources (x) / résultats (y) d'une entité — mêmes formules que la grille. */
export function efficienceScores(entity: any, niveau: 'primaire' | 'college' | 'lycee' = 'primaire') {
  if (!entity) return { x: 0, y: 0 };
  const examKey = niveau === 'college' ? 'bepc' : niveau === 'lycee' ? 'bac' : 'cepe';
  const lastK = niveau === 'primaire' ? 't5' : niveau === 'college' ? 't4' : 't3';
  const red = pctVal(Number(entity.ressources?.red_g || 0) + Number(entity.ressources?.red_f || 0), entity.ressources?.nbr_eleve);
  const ret = Math.min(pctVal(entity.ressources?.[`eff_${lastK}`], entity.ressources?.eff_t1), 100);
  const adm = pctVal(Number(entity?.[examKey]?.admis_g || 0) + Number(entity?.[examKey]?.admis_f || 0), Number(entity?.[examKey]?.nbr_g || 0) + Number(entity?.[examKey]?.nbr_f || 0));
  const rem = norm(Number(entity.ressources?.nbr_eleve || 0) / Math.max(Number(entity.personnel?.pers_en_classe || 1), 1), 45, 60);
  const nb = Math.max(Number(entity.ressources?.nbr_etab || 1), 1);
  const ea = Number(entity.ressources?.etab_eau || 0), el = Number(entity.ressources?.etab_elec || 0);
  const eau = Math.min(ea > 1 ? (ea / nb) * 100 : ea * 100, 100);
  const elec = Math.min(el > 1 ? (el / nb) * 100 : el * 100, 100);
  return { x: (rem + eau + elec) / 3, y: ((100 - Math.min(red, 100)) + ret + adm) / 3 };
}
