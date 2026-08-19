export type EtablissementIconType = "primaire" | "college" | "lycee" | "village";

export const ETABLISSEMENT_ICON_CLASSES: Record<EtablissementIconType, string> = {
  primaire: "fas fa-book-open",
  college: "fas fa-school",
  lycee: "fas fa-building",
  village: "fas fa-home",
};

export const ETABLISSEMENT_ICON_ORDER: EtablissementIconType[] = [
  "primaire",
  "college",
  "lycee",
  "village",
];

export const getEtablissementIconClass = (type: EtablissementIconType): string =>
  ETABLISSEMENT_ICON_CLASSES[type];
