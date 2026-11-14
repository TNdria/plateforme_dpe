/**
 * Années scolaires disponibles dans l'application.
 *
 * Convention : `annee` est l'année de fin, donc `annee = 2026` correspond au
 * libellé « 2025-2026 ». Source unique pour les sélecteurs, les valeurs par
 * défaut et les libellés, afin que tous les modules avancent ensemble.
 */
export const FIRST_SCHOOL_YEAR = 2022;
export const LATEST_SCHOOL_YEAR = 2026;
export const DEFAULT_SCHOOL_YEAR = LATEST_SCHOOL_YEAR;

export const SCHOOL_YEARS: number[] = Array.from(
  { length: LATEST_SCHOOL_YEAR - FIRST_SCHOOL_YEAR + 1 },
  (_, index) => FIRST_SCHOOL_YEAR + index,
);

/** « 2025-2026 » pour `annee = 2026`. */
export const formatAnneeScolaire = (annee: number | string): string => {
  const value = Number(annee);
  return Number.isFinite(value) ? `${value - 1}-${value}` : "";
};
