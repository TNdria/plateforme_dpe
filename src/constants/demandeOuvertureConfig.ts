// @ts-nocheck
// ============================================================
// COLONNES ENSEIGNANTS
// ============================================================

export const SELECT_OBSTACLE = {
  key: "obstacle",
  label: "Obstacle physique",
  type: "select",
  options: ["Non", "Oui"],
};

export const STATUT_ENSEIGNANT_OPTIONS = [
  "Public",
  "Fonctionnaire État",
  "FRAM subventionné",
  "FRAM non subventionné",
  "Privé",
];

export const PROFIL_ENSEIGNANT_OPTIONS = ["Scientifique", "Littéraire", "Autre"];

export const COLONNES_ENSEIGNANT_COMMUNES = [
  { key: "fonction", label: "Fonction" },
  { key: "statut", label: "Statut", type: "select", options: STATUT_ENSEIGNANT_OPTIONS },
  { key: "profil", label: "Profil", type: "select", options: PROFIL_ENSEIGNANT_OPTIONS },
];

export const COLONNES_PROCHE = (nom, code, effectif) => [
  { key: "fokontany", label: "Fokontany" },
  { key: "nom", label: nom },
  { key: "code", label: code },
  { key: "effectif", label: effectif },
  { key: "salle", label: "Salle de classe" },
  SELECT_OBSTACLE,
  { key: "nature_obstacle", label: "Nature de l'obstacle" },
];

// ============================================================
// COLONNES AIRE DE RECRUTEMENT
// ============================================================

// ✅ Population SAISISSABLE pour Préscolaire / Primaire.
//    Elle est marquée `editable: true` ; le composant StepRecrutement
//    passera `readOnly` globalement mais autorisera l'édition de cette
//    seule colonne (grâce au flag `editable`).
export const COLONNES_AIRE_VILLAGE = [
  { key: "fokontany", label: "Fokontany" },
  { key: "nom_village", label: "Nom du village" },
  { key: "distance_future", label: "Distance par rapport au future école (Km)" },
  { key: "distance_proche", label: "Distance par rapport l'école la plus proche (Km)" },
  { key: "population", label: "Population", type: "number", editable: true },
];

export const COLONNES_ENSEIGNANT_BASE = [
  { key: "nom_enseignant", label: "Nom" },
  ...COLONNES_ENSEIGNANT_COMMUNES,
  { key: "diplome_academique", label: "Diplôme académique" },
  { key: "diplome_pedagogique", label: "Diplôme pédagogique" },
  { key: "date_entreeAdmin", label: "Date d'entrée dans l'administration", type: "date" },
];

// ============================================================
// CONFIG NIVEAUX
// ============================================================

export const NIVEAU_CONFIG = {
  prescolaire: {
    sigle: "Presco",
    sigleInferieur: null,
    seuilProximite: 0.8,
    labelExistProche: "Existence d'une école prescolaire publique à moins de 800 m",
    labelDistancePlusProche: "Distance par rapport à l'école la plus proche (Km)",
    champsZap: [{ key: "nb_niveau_fokontany" }],
    colonnesProche: COLONNES_PROCHE("Nom de l'école", "Code de l'école", "Effectif"),
    labelListeAire: "Liste des villages alimentant la future école prescolaire",
    colonnesAire: COLONNES_AIRE_VILLAGE,
    anneesEtudes: ["P1", "P2"],
    colonnesEnseignant: COLONNES_ENSEIGNANT_BASE,
  },
  primaire: {
    sigle: "EPP",
    sigleInferieur: null,
    seuilProximite: 2,
    labelExistProche: "Existence d'une école primaire publique à moins de 2 km",
    labelDistancePlusProche: "Distance par rapport à l'école la plus proche (Km)",
    champsZap: [{ key: "nb_niveau_fokontany", label: "Nombre d'EPP dans le Fokontany" }],
    colonnesProche: COLONNES_PROCHE("Nom de l'école", "Code de l'école", "Effectif"),
    labelListeAire: "Liste des villages alimentant la future EPP",
    colonnesAire: COLONNES_AIRE_VILLAGE,
    anneesEtudes: ["T1", "T2", "T3", "T4", "T5"],
    colonnesEnseignant: COLONNES_ENSEIGNANT_BASE,
  },
  college: {
    sigle: "CEG",
    sigleInferieur: "EPP",
    seuilProximite: 5,
    labelExistProche: "Existence d'un CEG à moins de 5 km",
    labelDistancePlusProche: "Distance par rapport au CEG le plus proche (Km)",
    champsZap: [
      { key: "nb_inferieur_zap", label: "Nombre d'EPP dans la Zap" },
      { key: "nb_niveau_zap", label: "Nombre de collège dans la Zap" },
    ],
    colonnesProche: COLONNES_PROCHE("Nom du CEG", "Code du CEG", "Effectif actuel"),
    labelListeAire: "Liste des EPP alimentant le futur CEG",
    colonnesAire: [
      { key: "fokontany", label: "Fokontany" },
      { key: "code_inferieur", label: "Code EPP" },
      { key: "nom_inferieur", label: "Nom de l'EPP" },
      { key: "distance_future", label: "Distance par rapport au future CEG (Km)" },
      { key: "effectif_t5", label: "Effectif T5" },
    ],
    anneesEtudes: ["T6", "T7", "T8", "T9"],
    colonnesEnseignant: [
      { key: "nom_prenoms", label: "Nom et Prénom" },
      ...COLONNES_ENSEIGNANT_COMMUNES,
      { key: "diplome_academique", label: "Diplôme académique" },
      { key: "diplome_pedagogique", label: "Diplôme pédagogique" },
      { key: "matiere", label: "Matière enseignée" },
      { key: "date_entree", label: "Date d'entrée dans l'administration", type: "date" },
    ],
  },
  lycee: {
    sigle: "Lycée",
    sigleInferieur: "CEG",
    seuilProximite: 20,
    labelExistProche: "Existence d'un lycée à moins de 20 km",
    labelDistancePlusProche: "Distance par rapport au lycée le plus proche (Km)",
    champsZap: [
      { key: "nb_inferieur_zap", label: "Nombre de CEG dans la Zap" },
      { key: "nb_niveau_zap", label: "Nombre de Lycée dans la Zap" },
    ],
    colonnesProche: [
      { key: "fokontany", label: "Fokontany" },
      { key: "code", label: "Code du lycée" },
      { key: "nom", label: "Nom du lycée" },
      { key: "effectif", label: "Effectif" },
      { key: "salle", label: "Salle de classe" },
    ],
    labelListeAire: "Liste des CEG alimentant le futur lycée",
    colonnesAire: [
      { key: "fokontany", label: "Fokontany" },
      { key: "code_inferieur", label: "Code CEG" },
      { key: "nom_inferieur", label: "Nom du CEG" },
      { key: "distance_future", label: "Distance par rapport au futur lycée (Km)" },
      { key: "distance_proche", label: "Distance par rapport lycée le plus proche (Km)" },
      { key: "effectif_t9", label: "Effectif T9" },
    ],
    anneesEtudes: ["2nde", "1ère", "Tle"],
    colonnesEnseignant: [
      { key: "nom_prenoms", label: "Nom et Prénom" },
      ...COLONNES_ENSEIGNANT_COMMUNES,
      { key: "serie_bacc", label: "Série Bacc" },
      { key: "diplome_academique", label: "Diplôme académique le plus élevé" },
      { key: "diplome_pedagogique", label: "Diplôme pédagogique" },
      { key: "matiere", label: "Matière enseignée" },
      { key: "date_entree", label: "Date d'entrée dans l'administration", type: "date" },
    ],
  },
};

// ============================================================
// COLONNES PERSONNEL / EFFECTIFS
// ============================================================

export const COLONNES_PERSONNEL_ORS = [
  { key: "annee_scolaire", label: "Année scolaire" },
  { key: "code_etab", label: "Code établissement" },
  { key: "nombre_enseignants", label: "Enseignants en salle" },
  { key: "nombre_personnel_total", label: "Personnel total" },
  { key: "nombre_fonctionnaire", label: "Fonctionnaires" },
  { key: "nombre_non_salarie", label: "FRAM non subventionnés" },
  { key: "nombre_subventionne", label: "FRAM subventionnés" },
  { key: "nombre_litteraire", label: "Littéraire" },
  { key: "nombre_scientifique", label: "Scientifique" },
];

export const COLONNES_PERSONNEL_DETAIL = [
  { key: "nom_prenoms", label: "Nom et prénoms" },
  { key: "fonction", label: "Fonction" },
  { key: "date_entree", label: "Date d'entrée dans l'administration", type: "date" },
  { key: "diplome_pedagogique", label: "Diplôme pédagogique" },
  { key: "matiere_enseignee_1", label: "Matière enseignée" },
  { key: "diplome_academique", label: "Diplôme académique" },
];

export const NIVEAU_COLONNES_EFFECTIF = {
  prescolaire: [
    { key: "eff_ps", label: "PS" },
    { key: "eff_ms", label: "MS" },
    { key: "eff_gs", label: "GS" },
  ],
  primaire: [
    { key: "eff_t1", label: "T1" },
    { key: "eff_t2", label: "T2" },
    { key: "eff_t3", label: "T3" },
    { key: "eff_t4", label: "T4" },
    { key: "eff_t5", label: "T5" },
  ],
  college: [
    { key: "eff_t6", label: "T6" },
    { key: "eff_t7", label: "T7" },
    { key: "eff_t8", label: "T8" },
    { key: "eff_t9", label: "T9" },
  ],
  lycee: [
    { key: "_2nde", label: "2nde" },
    { key: "_1re", label: "1ère" },
    { key: "tle", label: "Tle" },
  ],
};

export const KEY_TO_NIVEAU_LABEL = {
  prescolaire: "Préscolaire",
  primaire: "Primaire",
  college: "Collège",
  lycee: "Lycée",
};

export const ORDRE_LOC = ["dren", "cisco", "zap", "commune", "fokontany"];

// ============================================================
// ÉTATS INITIAUX
// ============================================================

export const empty = {
  nom_demandeur: "",
  telephone_demandeur: "",
  email_demandeur: "",
  nom_etab: "",
  code_etab: "",
  niveau_etab: "Primaire",
  statut_juridique: "",
  type_demande: "Nouvelle création",
  sous_type: "creation",
  observation: "",
  localisation: "",
};

export const emptyLocalisationDetail = {
  village: "",
  fokontany: "",
  commune: "",
  zap: "",
  cisco: "",
  dren: "",
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
  nombre_tablebanc_prevus: "",
  surface_terrain_prevu: "",
  type_batiment_prevu: "",
  nombre_salle_prevu: "",
  latrine_f: "",
  latrine_g: "",
  date_ouverture_fait: "",
};

export const emptyRegularisation = {
  nbr_salle: "",
  date_ouverture: "",
  nbr_tablebanc: "",
  type_batiment: "",
  surface_terrain: "",
  nombre_annee: "",
  nbr_batiment: "",
  latrine_f: 0,
  latrine_g: 0,
  latrine_total: 0,
  latrine_separee: false,
};

export const piecesInitiales = [
  { code: "demande", nom: "Demande", fichier: null },
  { code: "fiche_technique", nom: "Fiche technique", fichier: null },
  { code: "pv_deliberation", nom: "PV de réunion de la délibération de la communauté", fichier: null },
  { code: "fiches_presence", nom: "Fiches de présence de la réunion (nom et prénoms, village d'origine, émargement)", fichier: null },
  { code: "situation_juridique", nom: "Situation juridique du domaine scolaire (lettre de donation, affecté au MEN, titre et borné)", fichier: null },
  { code: "plan_construction", nom: "Plan de construction et de financement", fichier: null },
  { code: "engagement_commune", nom: "Lettre d'engagement de la commune pour la prise en charge des ENF", fichier: null },
  { code: "proposition_directeur", nom: "Lettre de proposition d'affectation du Directeur (Fonctionnaire ou contractuel) et ses enseignants (Chef CISCO)", fichier: null },
  { code: "photos", nom: "Photo des infrastructures existantes", fichier: null },
];

export const emptyInfoComplementaire = {
  distance_zap: "",
  distance_cisco: "",
  distance_dren: "",
  existe_proche: false,
  distance_plus_proche: "",
};

export const emptyRessources = {
  nb_salle_classe: "",
  type_batiment: "",
  nb_tablebanc: "",
  surface_terrain: "",
  enseignants: [],
};

export const LABEL_CLS = "text-xs sm:text-sm font-medium";
export const INPUT_CLS = "h-9 w-full";