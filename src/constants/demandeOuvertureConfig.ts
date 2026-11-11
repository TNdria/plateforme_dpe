export const LABEL_CLS = "text-[11px] font-medium text-slate-700 dark:text-slate-200";
export const INPUT_CLS = "h-9 text-sm";

export const NIVEAU_CONFIG = {
  prescolaire: { label: "Préscolaire", code: "prescolaire" },
  primaire: { label: "Primaire", code: "primaire" },
  college: { label: "Collège", code: "college" },
  lycee: { label: "Lycée", code: "lycee" },
  autre: { label: "Autre", code: "autre" },
} as const;

export const KEY_TO_NIVEAU_LABEL = {
  prescolaire: "Préscolaire",
  primaire: "Primaire",
  college: "Collège",
  lycee: "Lycée",
  Tous: "Tous",
} as const;

export const ORDRE_LOC = ["dren", "cisco", "zap", "commune", "fokontany"] as const;

export const NIVEAU_COLONNES_EFFECTIF = {
  prescolaire: ["eff_ps", "eff_ms", "eff_gs"],
  primaire: ["eff_t1", "eff_t2", "eff_t3", "eff_t4", "eff_t5"],
  college: ["eff_t6", "eff_t7", "eff_t8", "eff_t9"],
  lycee: ["_2nde", "_1re", "tle"],
} as const;

export const COLONNES_PERSONNEL_ORS = [
  { key: "nom", label: "Nom", type: "text" },
  { key: "poste", label: "Poste", type: "text" },
  { key: "effectif", label: "Effectif", type: "number" },
] as const;

export const COLONNES_PERSONNEL_DETAIL = [
  { key: "nom", label: "Nom", type: "text" },
  { key: "grade", label: "Grade", type: "text" },
  { key: "matiere", label: "Matière", type: "text" },
  { key: "effectif", label: "Effectif", type: "number" },
] as const;

export const emptyLocalisationDetail = {
  village: "",
  commune: "",
  cisco: "",
  dren: "",
  zap: "",
};

export const emptyLocSelection = {
  dren: "",
  cisco: "",
  zap: "",
  commune: "",
  fokontany: "",
};

export const emptyLocOptions = {
  dren: [],
  cisco: [],
  zap: [],
  commune: [],
  fokontany: [],
};

export const emptyNouvelleCreation = {
  surface_terrain_prevu: "",
  nombre_batiment: "",
  nombre_salle: "",
  latrine_total: "",
};

export const emptyRegularisation = {
  date_ouverture: "",
  nbr_salle: "",
  nbr_tablebanc: "",
  latrine_total: "",
  nombre_annee: "",
};

export const piecesInitiales = [];
export const emptyInfoComplementaire = {};
export const emptyRessources = {
  latrine_total: "",
  nombre_point_eau: "",
  nombre_bureau: "",
  surface_terrain: "",
};

export const empty = {
  id: "",
  type_demande: "",
  sous_type: "",
  niveau_etab: "",
  nom_etab: "",
  date_depot: "",
  statut: "",
  localisation: {},
  nouvelle_creation: emptyNouvelleCreation,
  regularisation: emptyRegularisation,
  pieces: piecesInitiales,
  ressources: emptyRessources,
};
