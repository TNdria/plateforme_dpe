/** Primary TDB specification: shared indicator adapter and scoring. */
export type TdbScope = 'ecole' | 'zap' | 'cisco' | 'dren';
export type SchoolCycle = 'primaire' | 'college' | 'lycee';

export function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(typeof value === 'string' ? value.replace(',', '.').replace('%', '').trim() : value);
  return Number.isFinite(n) ? n : null;
}
export const bounded = (n: number) => Math.max(0, Math.min(100, n));
export function normaliser(value: number | null, min: number, max: number): number | null {
  if (value === null) return null;
  return value <= 0 ? 0 : bounded(50 * (min + max) / value);
}
const divide = (n: unknown, d: unknown, multiplier = 1) => {
  const a = numberOrNull(n), b = numberOrNull(d);
  return a === null || b === null || b <= 0 ? null : a / b * multiplier;
};

export function tdbIndicators(entity: any, scope: TdbScope = 'ecole', cycle: SchoolCycle = 'primaire') {
  const r = entity?.ressources || entity || {};
  const p = entity?.personnel || entity || {};
  const exam = entity?.[cycle === 'college' ? 'bepc' : cycle === 'lycee' ? 'bac' : 'cepe'] || {};
  const sources = [entity?.indicateurs, entity?.indicators, entity?.data, entity, r].filter(Boolean);
  const read = (key: string): number | null => {
    for (const source of sources) {
      const k = Object.keys(source).find(k => k.toLowerCase() === key.toLowerCase());
      if (k !== undefined) { const n = numberOrNull(source[k]); if (n !== null) return n; }
    }
    return null;
  };
  const sum = (a: unknown, b: unknown) => {
    const x = numberOrNull(a), y = numberOrNull(b);
    return x === null || y === null ? null : x + y;
  };
  const context = (key: string, count: string) => {
    for (const source of sources) {
      const k = Object.keys(source).find(k => k.toLowerCase() === key);
      if (k === undefined) continue;
      const value = source[k];
      if (typeof value === 'boolean') return value ? 100 : 0;
      if (typeof value === 'string' && /^(oui|non)$/i.test(value)) return /^oui$/i.test(value) ? 100 : 0;
      const n = numberOrNull(value);
      if (n !== null) return scope === 'ecole' ? bounded(n * 100) : bounded(n);
    }
    return divide(r[count] ?? entity?.[count], r.nbr_etab ?? entity?.nbr_etab, 100);
  };
  const pupils = read('nombre_eleves') ?? numberOrNull(r.nbr_eleve);
  const teachers = read('ens_classe') ?? numberOrNull(p.pers_en_classe);
  const qualified = read('ratio_eq') ?? (teachers && numberOrNull(p.sans_diplome_ped) !== null
    ? bounded(100 - Number(p.sans_diplome_ped) / teachers * 100) : null);
  return {
    rem: read('ratio_em') ?? divide(pupils, teachers),
    qualified,
    distance: read('eleve_2km') ?? divide(r.eleve_moins_2km, pupils, 100),
    water: context('point_eau', 'etab_eau'),
    electricity: context('electricite', 'etab_elec'),
    cash: read('ratio_ece') ?? divide(r.caisse_ecole, pupils),
    manuals: ['mlg_sc1', 'mlg_sc2', 'fr_sc1', 'fr_sc2', 'maths_sc1', 'maths_sc2'].map(read),
    repeat: read('red_ensemble') ?? divide(sum(r.red_g ?? entity?.red_g, r.red_f ?? entity?.red_f), pupils, 100),
    // Do not substitute last-grade / first-grade enrolment for cohort retention.
    retention: read('txRetentionTotal'),
    promotion: read('TPA'),
    admission: read('tx_admis') ?? divide(sum(exam.admis_g, exam.admis_f) ?? entity?.admis,
      sum(exam.nbr_g, exam.nbr_f) ?? entity?.inscrits_cepe, 100),
    places: read('ratio_epa') ?? divide(pupils, entity?.places?.places_assises),
  };
}

export function computeEfficience(entity: any, scope: TdbScope = 'ecole', cycle: SchoolCycle = 'primaire') {
  const i = tdbIndicators(entity, scope, cycle);
  // Spec §8.2: X = mean of 12 components, each with fallback 50 when missing.
  const xParts = [normaliser(i.rem, 45, 60), i.qualified, i.distance, i.water, i.electricity,
    // Cash: the spec flags its documented 1/x formula as probably reversed — an increasing score is used instead.
    i.cash === null ? null : bounded(i.cash / 20000 * 100), ...i.manuals.map(n => normaliser(n, 1, 2))];
  const yParts = [i.repeat === null ? null : 100 - bounded(Math.trunc(i.repeat)), i.retention, i.admission,
    ...(scope === 'ecole' ? [i.promotion] : [])];
  // Spec §8.2: « repli 50 » — a missing component counts as 50, but an entity with no data at all has no score.
  const mean = (parts: (number | null)[]) => parts.every(n => n === null) ? null
    : Number((parts.reduce<number>((sum, n) => sum + (n === null ? 50 : bounded(n)), 0) / parts.length).toFixed(1));
  return { x: mean(xParts), y: mean(yParts) };
}

export function bottleneckStatus(value: number | null) {
  return value === null ? 'missing' : value < 50 ? 'critical' : value <= 75 ? 'warning' : 'good';
}