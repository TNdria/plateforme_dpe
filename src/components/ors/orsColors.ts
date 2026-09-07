export const ORS_COLORS = {
  eligible: "#00a638",
  nonEligible: "#fa2328",
  default: "#00bfcd", // Établissement public
  prive: "#f8c936", // Établissement privé
  villageHorsZone: "#fa2328", // Village hors de toute aire de recrutement
  villageCouvert: "#888888", // Village dans l'aire de recrutement d'un étab
  limiteDren: "#4e73df",
  limiteCisco: "#22afbe",
} as const;

/** Couleur du marqueur "principal" (CEG pour collège, Lycée pour lycée) hors
 * tout filtre de catégorie. */
export const NIVEAU_MAIN_COLOR: Record<"college" | "lycee", string> = {
  college: "#16a34a",
  lycee: "#8b5cf6",
};

/** Rayon fixe (mètres) de l'aire de recrutement par niveau — remplace, pour
 * le calcul de couverture village et les critères d'éligibilité, l'ancien
 * rayon ajustable par slider. Le slider reste utilisé ailleurs (clic droit
 * générique "Voir l'aire", analyse détaillée d'un village). */
export const AIRE_RECRUTEMENT_RADIUS: Record<"primaire" | "college" | "lycee", number> = {
  primaire: 2000,
  college: 5000,
  lycee: 20000,
};

// ============================================================================
//  SECTEUR — source unique de vérité (public / privé)
// ============================================================================
// Convention métier MEN (colonne entière en base) :
//   0 ou 2  → PUBLIC
//   1       → PRIVÉ
// En pratique, SECTEUR est parfois null/vide/non numérique pour une partie
// des établissements (donnée manquante côté BD, cf. audit du 05/09/2026 —
// confirmé par la fiche détail affichant "Non déterminé"). On normalise
// number | string numérique, et tout le reste devient `null` ("indéterminé").

export type SecteurNormalise = 0 | 1 | 2 | null;

/** Convertit la valeur brute (number ou string "0"/"1"/"2") en 0 | 1 | 2, ou
 * `null` si la valeur est absente/non reconnue ("indéterminé"). */
export const normalizeSectorValue = (value: unknown): SecteurNormalise => {
  if (value === null || value === undefined || value === "") return null;

  const n = typeof value === "number" ? value : Number(value);
  if (n === 0 || n === 1 || n === 2) return n as 0 | 1 | 2;
  return null;
};

/** Public = SECTEUR 0 ou 2, OU indéterminé (donnée manquante). Un SECTEUR
 * inconnu est traité comme public par défaut plutôt que comme privé : le
 * privé est l'exception qui doit être explicitement marquée (SECTEUR=1),
 * pas la supposition par défaut — peindre en jaune "privé" un établissement
 * dont on ne connaît juste pas le secteur est trompeur (cf. capture du
 * 05/09/2026 : ~150 EPP quasi tous jaunes alors que la grande majorité sont
 * publics). Le libellé "Non déterminé" reste affiché dans la fiche détail
 * (secteurLabel) pour ne pas masquer le problème de qualité de donnée. */
export const isPublicSecteur = (item: { SECTEUR?: unknown } | null | undefined): boolean => {
  const n = normalizeSectorValue(item?.SECTEUR);
  return n === null || n === 0 || n === 2;
};

/** Privé = SECTEUR 1 STRICTEMENT (jamais l'indéterminé — voir isPublicSecteur). */
export const isPrivateSecteur = (item: { SECTEUR?: unknown } | null | undefined): boolean =>
  normalizeSectorValue(item?.SECTEUR) === 1;

/** Libellé d'affichage. Accepte un objet établissement ou la valeur brute. */
export const secteurLabel = (item: { SECTEUR?: unknown } | null | undefined | unknown): string => {
  const value =
    item !== null && typeof item === "object" && "SECTEUR" in (item as object)
      ? (item as { SECTEUR?: unknown }).SECTEUR
      : item;
  const n = normalizeSectorValue(value);
  if (n === 1) return "PRIVÉ";
  if (n === 0 || n === 2) return "PUBLIC";
  return "Non déterminé";
};