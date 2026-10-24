import { numberOrNull, tdbIndicators, computeEfficience } from './tdbEfficience';

type Entity = Record<string, any>;
export const drenNumber = (v: unknown) => typeof v === 'boolean' || (typeof v === 'string' && !v.trim()) ? null : numberOrNull(v);
export function drenDivide(n: unknown, d: unknown, factor = 100): number | null {
  const a = drenNumber(n), b = drenNumber(d);
  return a === null || b === null || a < 0 || b <= 0 ? null : a / b * factor;
}
export function drenSum(values: unknown[]): number | null {
  const ns = values.map(drenNumber);
  return ns.some(n => n === null) ? null : ns.reduce<number>((sum, n) => sum + (n ?? 0), 0);
}
export function drenRead(entity: Entity, ...keys: string[]): number | null {
  const norm = (key: string) => key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const source of [entity?.indicateurs, entity?.indicators, entity?.population, entity?.ueas, entity?.ressources, entity?.data, entity]) {
    if (!source) continue;
    for (const key of keys) {
      const actual = Object.keys(source).find(k => norm(k) === norm(key));
      if (actual !== undefined) {
        const value = drenNumber(source[actual]);
        if (value !== null) return value;
      }
    }
  }
  return null;
}
export const drenFormat = (value: unknown, suffix = '', digits = 1) => {
  const n = drenNumber(value);
  return n === null ? '—' : `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)}${suffix}`;
};
export function drenRetention(entity: Entity, grade: number, gender = ''): number | null {
  const direct = drenRead(entity, `retention_t${grade}${gender}`, ...(grade === 5 ? [`txRetentionTotal${gender}`, `tx_retention${gender}`] : []));
  if (direct !== null) return direct;
  const r = entity?.ressources || {};
  const access = (k: number) => {
    const supplied = drenRead(entity, `ta_t${k}${gender}`);
    if (supplied !== null) return supplied;
    const eff = drenNumber(r[`eff_t${k}${gender}`]);
    const red = drenNumber(r[`red_t${k}${gender}`]);
    return drenDivide(eff === null || red === null ? null : eff - red,
      drenRead(entity, `pop_${k + 5}ans${gender}`, `population_${k + 5}ans${gender}`));
  };
  return drenDivide(access(grade), access(1));
}
export function drenAdmission(entity: Entity, gender = ''): number | null {
  const cepe = entity?.cepe || {};
  const admitted = gender ? cepe[`admis${gender}`] : drenSum([cepe.admis_f, cepe.admis_g]);
  const rate = drenDivide(admitted, entity?.ressources?.[`eff_t5${gender}`] ?? drenRead(entity, `inscrits_cm2${gender}`, `eff_t5${gender}`));
  return rate !== null && rate > 100 ? null : rate;
}
// Le snapshot importé (df_dren.csv) exprime le redoublement en pourcentage,
// alors que la source SQL fournit des effectifs. Ne mélange jamais les unités :
// le taux est calculé depuis les effectifs, puis le pourcentage importé sert de
// repli uniquement lorsque les effectifs de redoublants ne sont pas disponibles.
const IMPORTED_RED_GRADES = ['CP1', 'CP2', 'CE', 'CM1', 'CM2'];
export function drenRepeat(entity: Entity, grade?: number, gender = ''): number | null {
  const r = entity?.ressources || {};
  const pooled = grade ? drenDivide(r[`red_t${grade}`], r[`eff_t${grade}`])
    : drenDivide(gender ? r[`red${gender}`] : drenSum([r.red_f, r.red_g]), r[`nbr_eleve${gender}`]);
  if (pooled !== null && pooled > 0) return pooled;
  const imported = grade
    ? (IMPORTED_RED_GRADES[grade - 1] ? drenRead(entity, `red_${IMPORTED_RED_GRADES[grade - 1]}`) : null)
    : drenRead(entity, gender === '_f' ? 'red_fille' : gender === '_g' ? 'red_garcons' : 'red_ensemble');
  return imported ?? pooled;
}
export function drenPromotion(entity: Entity, grade: number): number | null {
  const direct = drenRead(entity, `promotion_t${grade}`, `tp_t${grade}`);
  if (direct !== null) return direct;
  const next = entity?.annee_suivante?.ressources;
  const eff = drenNumber(next?.[`eff_t${grade + 1}`]), red = drenNumber(next?.[`red_t${grade + 1}`]);
  return drenDivide(eff === null || red === null ? null : eff - red, entity?.ressources?.[`eff_t${grade}`]);
}
export function drenAbandon(entity: Entity, grade: number): number | null {
  const direct = drenRead(entity, `abandon_t${grade}`);
  if (direct !== null) return direct;
  const promotion = drenPromotion(entity, grade);
  const repeat = drenDivide(entity?.annee_suivante?.ressources?.[`red_t${grade}`], entity?.ressources?.[`eff_t${grade}`]);
  // Coherent flow identity; the ODS abandonment expression contains duplicated terms.
  return promotion === null || repeat === null ? null : 100 - promotion - repeat;
}
export function drenCycleRate(entity: Entity, kind: 'promotion' | 'abandon'): number | null {
  const rates = [1, 2, 3, 4].map(k => ({ rate: kind === 'promotion' ? drenPromotion(entity, k) : drenAbandon(entity, k), size: drenNumber(entity?.ressources?.[`eff_t${k}`]) }));
  if (rates.some(r => r.rate === null || r.size === null)) return null;
  return drenDivide(rates.reduce((sum, r) => sum + (r.rate ?? 0) * (r.size ?? 0), 0), rates.reduce((sum, r) => sum + (r.size ?? 0), 0), 1);
}
export function drenCoverage(entity: Entity) {
  const r = entity?.ressources || {};
  const pop = drenRead(entity, 'population_6_10', 'pop_6_10', 'pop_6_10ans');
  const cm2 = drenNumber(r.eff_t5), red = drenNumber(r.red_t5);
  return [
    { label: 'Taux d’accès générationnel', value: drenRead(entity, 'taux_acces_generationnel', 'tag'), unit: ' %' },
    { label: 'Taux brut de scolarisation (TBS)', value: drenRead(entity, 'tbs') ?? drenDivide(entity?.nombre_eleves_tous_secteurs ?? r.nbr_eleve, pop), unit: ' %' },
    { label: 'Taux net de scolarisation (TNS)', value: drenRead(entity, 'tns') ?? drenDivide(drenRead(entity, 'eleves_6_10ans'), pop), unit: ' %' },
    { label: 'Taux net d’accès (TNA)', value: drenRead(entity, 'tna') ?? drenDivide(drenRead(entity, 'nouveaux_cp1_6ans'), drenRead(entity, 'pop_6ans', 'population_6ans')), unit: ' %' },
    { label: 'Taux d’achèvement (CM2 / population de 10 ans)', value: drenRead(entity, 'taux_achevement') ?? drenDivide(cm2 === null || red === null ? null : cm2 - red, drenRead(entity, 'pop_10ans', 'population_10ans')), unit: ' %' },
    { label: 'Taux de rétention (CP1 → CM2)', value: drenRetention(entity, 5), unit: ' %' },
    { label: 'Salles définitives pour 1 000 enfants de 6–10 ans', value: drenDivide(drenRead(entity, 'salles_definitives'), pop, 1000), unit: '' },
    { label: 'Enseignants pour 1 000 enfants de 6–10 ans', value: drenDivide(entity?.personnel?.pers_en_classe, pop, 1000), unit: '' },
    { label: 'Places assises par enfant de 6–10 ans', value: drenDivide(entity?.places?.places_assises, pop, 1), unit: '' },
  ];
}
export function drenEfficienceEntity(entity: Entity) {
  return { ...entity, indicateurs: { ...entity?.indicateurs, txRetentionTotal: drenRetention(entity, 5), tx_admis: drenAdmission(entity) } };
}
export function drenEfficience(entity: Entity) {
  return computeEfficience(drenEfficienceEntity(entity), 'dren');
}
export function drenBottlenecks(entity: Entity) {
  const i = tdbIndicators(drenEfficienceEntity(entity), 'dren');
  return [
    { label: 'Élèves vivant à moins de 2 km', value: i.distance },
    { label: 'Établissements avec un point d’eau', value: i.water },
    { label: 'Établissements avec électricité', value: i.electricity },
    { label: 'Taux de rétention', value: drenRetention(entity, 5) },
    { label: 'Taux de promotion', value: drenCycleRate(entity, 'promotion') },
    { label: 'Enseignants ayant un diplôme pédagogique', value: i.qualified },
    { label: 'Admis CEPE / inscrits CM2', value: drenAdmission(entity) },
  ];
}
export function drenExamThreshold(entity: Entity, key: string): number | null {
  const aliases: Record<string, string[]> = { mlg_sup10: ['sup_10_mlg', 'pct_10_mlg'], frs_sup10: ['sup_10_fr', 'pct_10_fr'], op_sup10: ['sup_10_op', 'pct_10_op'], prob_sup10: ['sup_10_probleme', 'pct_10_probleme'], mths_sup10: ['sup_10_maths', 'pct_10_maths'], autres_sup10: ['autres_sup10', 'sup_10_autres'], histoire_sup10: ['sup_10_tfm'], geographie_sup10: ['sup_10_geo'], svt_sup10: ['sup_10_svt'] };
  const direct = drenRead({ indicateurs: entity?.indicateurs }, ...(aliases[key] || []));
  const calculated = drenDivide(entity?.cepe?.[key], entity?.cepe?.total_candidats ?? drenSum([entity?.cepe?.nbr_f, entity?.cepe?.nbr_g]));
  // Imported sup_10_* are candidate counts, not percentages. Prefer the
  // actual exam numerator/denominator; never interpret a count as a rate.
  const rate = calculated ?? drenDivide(direct, entity?.cepe?.total_candidats ?? drenSum([entity?.cepe?.nbr_f, entity?.cepe?.nbr_g]));
  return rate !== null && rate > 100 ? null : rate;
}