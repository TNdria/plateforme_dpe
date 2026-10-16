import { tdbIndicators, normaliser, bounded, bottleneckStatus } from '@/utils/tdbEfficience';
export interface GoulotItem { name: string; value: number | null }
const barClasses = { critical: 'tdb-status-critical', warning: 'tdb-status-warning', good: 'tdb-status-good', missing: '' };
const valueClasses = { critical: 'tdb-value-critical', warning: 'tdb-value-warning', good: 'tdb-value-good', missing: 'tdb-value-missing' };
export function GoulotBars({ items, title = "Goulots d’étranglement — Indicateurs" }: { items: GoulotItem[]; title?: string }) {
  return <div className="tdb-chart tdb-bottlenecks" data-testid="goulot-chart">
    <h4 className="tdb-chart-title">{title}</h4>
    <table className="tdb-bottleneck-table"><tbody>{items.map(it => {
      const value = it.value === null ? null : bounded(it.value);
      const status = bottleneckStatus(value);
      return <tr key={it.name}><td>{it.name}</td><td><div className="tdb-bar-track"><div className={`tdb-bar ${barClasses[status]}`} style={{ width: `${(value ?? 0) / 120 * 100}%` }} /></div></td><td className={valueClasses[status]}>{value === null ? 'n/d' : `${value.toFixed(1)} %`}</td></tr>;
    })}<tr><td /><td><div className="tdb-bar-axis">{[0, 50, 100, 120].map(n => <span key={n}>{n}</span>)}</div></td><td /></tr></tbody></table>
    <div className="tdb-chart-note">Pourcentage (%)</div>
    <div className="tdb-chart-legend"><span className="tdb-value-critical">● &lt; 50 % (Critique)</span><span className="tdb-value-warning">● 50–75 % (Attention)</span><span className="tdb-value-good">● &gt; 75 % (Bon)</span></div>
  </div>;
}
export default GoulotBars;
export function buildGoulotItems(entity: any, _examKey = 'cepe', _lastK = 't5'): GoulotItem[] {
  const i = tdbIndicators(entity, 'cisco');
  return [
    { name: 'Taux de promotion', value: i.promotion },
    { name: 'Taux de rétention', value: i.retention },
    { name: 'Enseignants ayant un diplôme pédagogique', value: i.qualified },
    { name: 'Élèves par maître (score normalisé)', value: normaliser(i.rem, 45, 60) },
    { name: 'Élèves par place assise (score normalisé)', value: normaliser(i.places, 1, 1) },
    { name: 'Écoles ayant l’électricité', value: i.electricity },
    { name: 'Écoles ayant un point d’eau', value: i.water },
    { name: 'Élèves vivant à moins de 2 km de leur école', value: i.distance },
    { name: 'Taux d’admis au CEPE', value: i.admission },
  ];
}

/** % sans diplôme pédagogique, plafonné à 100 % (dénominateur = max(enseignants en classe, sans diplôme)). */
export function pctSansDiplome(p: any): string {
  const s = Number(p?.sans_diplome_ped), t = Number(p?.pers_en_classe);
  if (!isFinite(s) || !(t > 0)) return '-';
  return `${Math.min((s / Math.max(t, s)) * 100, 100).toFixed(1)}%`;
}
