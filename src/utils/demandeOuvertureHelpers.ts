export function niveauToKey(value: string | null | undefined) {
  const raw = String(value ?? "").toLowerCase().trim();
  if (!raw) return "autre";
  if (raw.includes("presco") || raw.includes("matern")) return "prescolaire";
  if (raw.includes("primaire") || raw.includes("epp")) return "primaire";
  if (raw.includes("college") || raw.includes("ceg")) return "college";
  if (raw.includes("lycee") || raw.includes("lycée")) return "lycee";
  return "autre";
}

export function makeEmptyRow(columns: Array<{ key: string; defaultValue?: string | number | boolean }> = []) {
  return Object.fromEntries(columns.map((column) => [column.key, column.defaultValue ?? ""]));
}

export function calculerTotalEvolutionLigne(row: Record<string, unknown> = {}, columns: Array<{ key: string }> = []) {
  return columns.reduce((total, column) => {
    const value = Number(row[column.key]);
    return total + (Number.isFinite(value) ? value : 0);
  }, 0);
}

export function construireAireListe(items: unknown[] = []) {
  return Array.isArray(items) ? items.map((item, index) => ({ id: index, ...((item && typeof item === "object") ? item : { nom: String(item) }) })) : [];
}

export function fusionnerLocalisation(a: Record<string, unknown> = {}, b: Record<string, unknown> = {}) {
  return { ...a, ...b };
}

export function deriveStatutJuridique(value: unknown) {
  if (!value) return "inconnu";
  return String(value).trim();
}

export function lireLatrines(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function lignesPersonnelDepuis(values: unknown[] = []) {
  return Array.isArray(values) ? values : [];
}

export function construirePersonnelDetail(values: unknown[] = []) {
  return Array.isArray(values) ? values : [];
}

export function formatDateForInput(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") {
    const match = value.match(/^\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : value;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value);
}

export function validerEtape(_form: Record<string, unknown>) {
  return { valid: true, errors: [] as Array<{ field: string; message: string }> };
}

export default {
  niveauToKey,
  makeEmptyRow,
  calculerTotalEvolutionLigne,
  construireAireListe,
  fusionnerLocalisation,
  deriveStatutJuridique,
  lireLatrines,
  lignesPersonnelDepuis,
  construirePersonnelDetail,
  formatDateForInput,
  validerEtape,
};
