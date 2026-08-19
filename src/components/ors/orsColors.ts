
// Couleurs distinctes par type d'intervention (recommandation Validation
// Technique) : Reconstruction: rouge, Extension: orange, Réhabilitation:
// jaune doré, Table-bancs: bleu ciel, Conforme: vert.
export const ORS_COLORS = {
  nouvelle_creation: "#8b5cf6",
  reconstruction: "#dc2626",
  extension: "#f97316",
  rehabilitation: "#eab308",
  tablebanc: "#0ea5e9",
  conforme: "#16a34a",
  default: "#36b9cc",
  prive: "#f6c23e",
  villageHorsZone: "#FF0000",
  villageCouvert: "#888888",
  villageAutre: "#e74a3b",
  horsZoneEligible: "#dc2626",
  limiteDren: "#4e73df",
  limiteCisco: "#22afbe",
} as const;

/** Couleur du marqueur "principal" (CEG pour collège, Lycée pour lycée) hors
 * tout filtre de catégorie. */
export const NIVEAU_MAIN_COLOR: Record<"college" | "lycee", string> = {
  college: "#16a34a",
  lycee: "#8b5cf6",
};