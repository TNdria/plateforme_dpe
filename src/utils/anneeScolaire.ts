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

/**
 * Millésime exploitable à partir d'une valeur d'interface (`"2024"`, `2024`),
 * ou `null` si ce n'en est pas un. Indispensable pour les gestionnaires
 * d'événements React : `onClick={handleFilter}` leur transmet l'événement en
 * premier argument, qui ne doit jamais être pris pour une année scolaire.
 */
export const parseSchoolYear = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isInteger(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : null;
  }
  return null;
};

/** « 2025-2026 » pour `annee = 2026`. */
export const formatAnneeScolaire = (annee: number | string): string => {
  const value = Number(annee);
  return Number.isFinite(value) ? `${value - 1}-${value}` : "";
};
