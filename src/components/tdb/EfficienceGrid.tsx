import { computeEfficience, type TdbScope, type SchoolCycle } from '@/utils/tdbEfficience';

export interface EfficiencePoint {
  name: string;
  x: number | null;
  y: number | null;
  isCurrent?: boolean;
  isParent?: boolean;
}
interface Props {
  entity: any;
  niveau?: SchoolCycle;
  scope?: TdbScope;
  entityLabel?: string;
  points?: EfficiencePoint[];
  parentPoint?: EfficiencePoint | null;
  pointsTitle?: string;
}
const W = 660, H = 350;
const plot = { x: 64, y: 18, w: 570, h: 270 };
const faces = [['😅', '😊', '😐'], ['😊', '😐', '😕'], ['😐', '😕', '😢']];
const zones = [['tdb-zone-good', 'tdb-zone-positive', 'tdb-zone-neutral'], ['tdb-zone-positive', 'tdb-zone-neutral', 'tdb-zone-warning'], ['tdb-zone-neutral', 'tdb-zone-warning', 'tdb-zone-critical']];
const valid = (p: EfficiencePoint): p is EfficiencePoint & { x: number; y: number } =>
  p.x !== null && p.y !== null && Number.isFinite(p.x) && Number.isFinite(p.y);
export function EfficienceGrid({ entity, niveau = 'primaire', scope = 'ecole', entityLabel = 'Entité', points = [], parentPoint = null }: Props) {
  if (!entity) return null;
  const calculated = computeEfficience(entity, scope, niveau);
  const current = points.find(p => p.isCurrent) || { name: entityLabel, ...calculated };
  const siblings = points.filter(p => !p.isCurrent && !p.isParent && valid(p));
  const parent = parentPoint || points.find(p => p.isParent);
  const px = (n: number) => plot.x + Math.max(0, Math.min(100, n)) / 100 * plot.w;
  const py = (n: number) => plot.y + plot.h - Math.max(0, Math.min(100, n)) / 100 * plot.h;
  const label = (p: EfficiencePoint & { x: number; y: number }, kind: string) => {
    const right = p.x > 65;
    const text = p.name.length > 35 ? `${p.name.slice(0, 32)}…` : p.name;
    return <text className={kind === 'parent' ? 'tdb-point-parent' : 'tdb-point-current'} x={px(p.x) + (right ? -12 : 12)} y={py(p.y) + (kind === 'parent' ? 19 : -10)} textAnchor={right ? 'end' : 'start'} fontSize={11} fontWeight="bold">{text}</text>;
  };
  const bin = (n: number) => n < 100 / 3 ? 0 : n < 200 / 3 ? 1 : 2;
  const xLevel = valid(current) ? ['faibles', 'moyennes', 'élevées'][bin(current.x)] : '';
  const yLevel = valid(current) ? ['faibles', 'moyens', 'élevés'][bin(current.y)] : '';
  return <div className="tdb-chart" data-testid="efficience-chart">
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full h-auto" role="img" aria-label={`Efficience ${entityLabel} : ressources en abscisse, résultats en ordonnée`}>
      <title>Efficience — Ressources (%) / Résultats (%)</title>
      {[0, 1, 2].map(r => [0, 1, 2].map(c => <g key={`${r}-${c}`}>
        <rect x={plot.x + c * plot.w / 3} y={plot.y + r * plot.h / 3} width={plot.w / 3} height={plot.h / 3} className={zones[r][c]} />
        <text x={plot.x + (c + .5) * plot.w / 3} y={plot.y + (r + .5) * plot.h / 3 + 12} fontSize={34} textAnchor="middle" opacity={.5}>{faces[r][c]}</text>
      </g>))}
      {[0, 100 / 3, 200 / 3, 100].map(n => <g key={n}>
        <line x1={px(n)} x2={px(n)} y1={plot.y} y2={plot.y + plot.h} className="tdb-grid-line" />
        <line x1={plot.x} x2={plot.x + plot.w} y1={py(n)} y2={py(n)} className="tdb-grid-line" />
        <text x={px(n)} y={plot.y + plot.h + 18} fontSize={10} textAnchor="middle">{n.toFixed(n % 1 ? 2 : 0).replace('.', ',')}</text>
        <text x={plot.x - 9} y={py(n) + 4} fontSize={10} textAnchor="end">{n.toFixed(n % 1 ? 2 : 0).replace('.', ',')}</text>
      </g>)}
      <text x={plot.x + plot.w / 2} y={H - 15} textAnchor="middle" fontSize={13} fontWeight="bold">Ressources (%)</text>
      <text transform={`translate(16 ${plot.y + plot.h / 2}) rotate(-90)`} textAnchor="middle" fontSize={13} fontWeight="bold">Résultats (%)</text>
      {siblings.filter(valid).map((p, i) => <circle key={`${p.name}-${i}`} cx={px(p.x)} cy={py(p.y)} r={4} className="tdb-point-sibling"><title>{p.name}</title></circle>)}
      {parent && valid(parent) && <g><path d={`M ${px(parent.x)} ${py(parent.y) - 7} l 7 7 -7 7 -7 -7 Z`} className="tdb-marker-parent"><title>{parent.name}</title></path>{label(parent, 'parent')}</g>}
      {valid(current) && <g><polygon points={Array.from({ length: 6 }, (_, i) => { const a = i * Math.PI / 3; return `${px(current.x) + 9 * Math.cos(a)},${py(current.y) + 9 * Math.sin(a)}`; }).join(' ')} className="tdb-marker-current"><title>{current.name}</title></polygon>{label(current, 'current')}</g>}
    </svg>
    <div className="tdb-chart-legend"><span className="tdb-point-current">⬢ {entityLabel}</span>{parent && valid(parent) && <span className="tdb-point-parent">◆ Niveau de comparaison</span>}{siblings.length > 0 && <span>● Autres entités</span>}</div>
    <p className="tdb-chart-note">{valid(current) ? `Ressources ${xLevel} · Résultats ${yLevel}` : 'Efficience non calculable : certains indicateurs nécessaires sont indisponibles.'}</p>
    {niveau !== 'primaire' && <p className="tdb-chart-note">Seuils du primaire utilisés à titre indicatif ; normes du secondaire à confirmer.</p>}
  </div>;
}
export default EfficienceGrid;
export function efficienceScores(entity: any, niveau: SchoolCycle = 'primaire', scope: TdbScope = 'ecole') {
  return computeEfficience(entity, scope, niveau);
}
