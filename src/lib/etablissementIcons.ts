export type EtablissementIconType = "prescolaire" | "primaire" | "college" | "lycee" | "village";

/**
 * Convention visuelle unique (2026) : TOUS les établissements scolaires
 * utilisent le même pictogramme de bâtiment (`fas fa-school`). La distinction
 * entre les niveaux se fait uniquement par la couleur (voir
 * ETABLISSEMENT_ICON_COLORS). Les villages, eux, sont représentés par un
 * simple point (`fas fa-circle`).
 */
export const ETABLISSEMENT_ICON_CLASSES: Record<EtablissementIconType, string> = {
  prescolaire: "fas fa-school",
  primaire: "fas fa-school",
  college: "fas fa-school",
  lycee: "fas fa-school",
  village: "fas fa-circle",
};

/** Couleur distinctive par niveau — seul élément différenciant les niveaux. */
export const ETABLISSEMENT_ICON_COLORS: Record<EtablissementIconType, string> = {
  prescolaire: "#f59e0b", // orange
  primaire: "#00bfcd", // cyan
  college: "#16a34a", // vert
  lycee: "#8b5cf6", // violet
  village: "#888888", // gris (point)
};

export const ETABLISSEMENT_ICON_ORDER: EtablissementIconType[] = [
  "prescolaire",
  "primaire",
  "college",
  "lycee",
  "village",
];

export const getEtablissementIconClass = (type: EtablissementIconType): string =>
  ETABLISSEMENT_ICON_CLASSES[type];

export const getEtablissementIconColor = (type: EtablissementIconType): string =>
  ETABLISSEMENT_ICON_COLORS[type];
