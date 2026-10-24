// Indicateurs du TDB DREN préscolaire / collège / lycée à partir des sommes brutes
// renvoyées par l'action `getTdbDrenNiveau` (secteur '0' = public, '1' = privé).
export type NiveauDren = 'presco' | 'college' | 'lycee';
export type Secteur = '0' | '1' | 'ens';
type Row = Record<string, number | string | null>;
export type SectorData = Record<'0' | '1', Row>;

export const NIVEAU_LABELS: Record<NiveauDren, { titre: string; etab: string; grades: string[]; examen?: string }> = {
  presco: { titre: 'PRÉSCOLAIRE', etab: 'centres préscolaires (CAP)', grades: ['PS', 'MS', 'GS'] },
  college: { titre: 'COLLÈGE', etab: 'collèges', grades: ['6ème', '5ème', '4ème', '3ème'], examen: 'BEPC' },
  lycee: { titre: 'LYCÉE', etab: 'lycées', grades: ['2nde', '1ère', 'Tle'], examen: 'BACC' },
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || typeof v === 'boolean' || (typeof v === 'string' && !v.trim())) return null;
  const n = typeof v === 'string' ? Number(v.replace(/\s/g, '').replace(',', '.')) : Number(v);
  return Number.isFinite(n) ? n : null;
};
export const div = (a: number | null, b: number | null, factor = 100): number | null =>
  a === null || b === null || b <= 0 || a < 0 ? null : (a / b) * factor;

/** Valeur d'un champ pour un secteur ; `ens` additionne public + privé. Absent partout → null. */
export function val(data: SectorData | null | undefined, key: string, s: Secteur): number | null {
  if (!data) return null;
  if (s !== 'ens') return num(data[s]?.[key]);
  const a = num(data['0']?.[key]), b = num(data['1']?.[key]);
  return a === null && b === null ? null : (a ?? 0) + (b ?? 0);
}

export function effectif(data: SectorData | null | undefined, s: Secteur, grades: number, gender?: 'g' | 'f', grade?: number) {
  const list = grade ? [grade] : Array.from({ length: grades }, (_, i) => i + 1);
  const parts = list.flatMap((k) => (gender ? [`eff${k}_${gender}`] : [`eff${k}_g`, `eff${k}_f`])).map((key) => val(data, key, s));
  return parts.some((p) => p === null) ? null : parts.reduce<number>((a, b) => a + (b ?? 0), 0);
}
/** Effectif cumulé d'une plage de niveaux (ex. PS + MS pour les 3–4 ans). */
export function effectifNiveaux(data: SectorData | null | undefined, s: Secteur, niveaux: number[], gender?: 'g' | 'f') {
  const parts = niveaux.flatMap((k) => (gender ? [`eff${k}_${gender}`] : [`eff${k}_g`, `eff${k}_f`])).map((key) => val(data, key, s));
  return parts.some((p) => p === null) ? null : parts.reduce<number>((a, b) => a + (b ?? 0), 0);
}
export function redoublants(data: SectorData | null | undefined, s: Secteur, grades: number, gender?: 'g' | 'f', grade?: number) {
  const list = grade ? [grade] : Array.from({ length: grades }, (_, i) => i + 1);
  const parts = list.flatMap((k) => (gender ? [`red${k}_${gender}`] : [`red${k}_g`, `red${k}_f`])).map((key) => val(data, key, s));
  return parts.some((p) => p === null) ? null : parts.reduce<number>((a, b) => a + (b ?? 0), 0);
}

/** Taux de redoublement (%) = redoublants / effectif, par niveau ou cycle. */
export const tauxRedoublement = (d: SectorData | null | undefined, s: Secteur, grades: number, grade?: number, gender?: 'g' | 'f') =>
  div(redoublants(d, s, grades, gender, grade), effectif(d, s, grades, gender, grade));

/** Taux de promotion (%) = (effectif k+1 en t+1 − redoublants k+1 en t+1) / effectif k en t. */
export function tauxPromotion(d: SectorData | null | undefined, next: SectorData | null | undefined, s: Secteur, grade: number, gender?: 'g' | 'f') {
  const e = effectif(next, s, grade + 1, gender, grade + 1), r = redoublants(next, s, grade + 1, gender, grade + 1);
  const rate = div(e === null || r === null ? null : e - r, effectif(d, s, grade, gender, grade));
  return rate;
}
/** Taux d'abandon (%) = 100 − promotion − redoublement (t+1) ; incohérent → null. */
export function tauxAbandon(d: SectorData | null | undefined, next: SectorData | null | undefined, s: Secteur, grade: number, gender?: 'g' | 'f') {
  const p = tauxPromotion(d, next, s, grade, gender);
  const r = div(redoublants(next, s, grade, gender, grade), effectif(d, s, grade, gender, grade));
  return p === null || r === null ? null : 100 - p - r;
}
/** Moyenne pondérée par l'effectif sur les niveaux 1..grades-1. */
export function cycleRate(d: SectorData | null | undefined, next: SectorData | null | undefined, s: Secteur, grades: number, kind: 'promotion' | 'abandon', gender?: 'g' | 'f') {
  const items = Array.from({ length: grades - 1 }, (_, i) => i + 1).map((k) => ({
    rate: kind === 'promotion' ? tauxPromotion(d, next, s, k, gender) : tauxAbandon(d, next, s, k, gender),
    size: effectif(d, s, grades, gender, k),
  }));
  if (items.some((x) => x.rate === null || x.size === null)) return null;
  return div(items.reduce((a, x) => a + (x.rate ?? 0) * (x.size ?? 0), 0), items.reduce((a, x) => a + (x.size ?? 0), 0), 1);
}

/** Profil de rétention pseudo-longitudinal : nouveaux entrants du niveau k / nouveaux entrants du 1er niveau. */
export function retentionProfile(d: SectorData | null | undefined, s: Secteur, grades: number, population?: Record<string, number | null>) {
  const entrants = (k: number) => {
    const e = effectif(d, s, grades, undefined, k), r = redoublants(d, s, grades, undefined, k);
    return div(e === null || r === null ? null : e - r, population?.[`p${k - 1}`] ?? null);
  };
  return Array.from({ length: grades }, (_, i) => div(entrants(i + 1), entrants(1)));
}

/** TNS (%) = élèves ayant l'âge officiel du niveau ÷ population de ce groupe d'âge. */
export const tauxNetScolarisation = (d: SectorData | null | undefined, s: Secteur, populationAge: number | null) =>
  div(val(d, 'eleves_age', s), populationAge);

/**
 * Taux de transition (%) = nouveaux entrants du 1er niveau (t+1) ÷ effectif de la
 * dernière classe du cycle précédent (t). Si l'année t+1 n'est pas encore
 * disponible, on retombe sur le dernier flux observable : entrants (t) ÷ effectif
 * de la dernière classe du cycle précédent (t−1).
 */
export function tauxTransition(
  d: SectorData | null | undefined,
  s: Secteur,
  grades: number,
  next?: SectorData | null,
) {
  const entrants = (data: SectorData | null | undefined) => {
    if (!data) return null;
    const e = effectif(data, s, grades, undefined, 1), r = redoublants(data, s, grades, undefined, 1);
    return e === null || r === null ? null : e - r;
  };
  if (next) {
    const rate = div(entrants(next), val(d, 'eff_cycle_actuel', s));
    if (rate !== null) return rate;
  }
  return div(entrants(d), val(d, 'eff_cycle_precedent', s));
}

/** Indice de parité F/G = filles / garçons. */
export const parite = (filles: number | null, garcons: number | null) => div(filles, garcons, 1);

/** Côté du déséquilibre de genre (écart > 1 point) : 'F' si aux dépens des filles. */
export function disparite(rateF: number | null, rateG: number | null, higherIsBetter: boolean): 'F' | 'G' | null {
  if (rateF === null || rateG === null || rateG <= 0) return null;
  const ratio = rateF / rateG;
  if (ratio >= 0.9 && ratio <= 1) return null;
  return higherIsBetter ? (ratio < 0.9 ? 'F' : 'G') : (ratio > 1 ? 'F' : 'G');
}

/** Scores d'efficience des CISCO (0–100) : ressources = enseignants pour 100 élèves, résultats = 100 − redoublement. */
export function ciscoEfficience(ciscos: Array<{ CISCO: string; eleves: number; redoublants: number; ens_classe: number }>) {
  return ciscos.map(c => ({ name: c.CISCO, ressources: null, resultats: null }));
}
