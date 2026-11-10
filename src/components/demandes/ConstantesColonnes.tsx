// @ts-nocheck
import { NIVEAU_LABELS } from "@/utils/demandeHelpers";

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

export const PROXIMITE_CONFIG = {
  prescolaire: {
    labelExistProche: "Existence d'une école préscolaire publique à moins de 800 m",
    labelDistancePlusProche: "Distance par rapport à l'école la plus proche (Km)",
  },
  primaire: {
    labelExistProche: "Existence d'une école primaire publique à moins de 2 km",
    labelDistancePlusProche: "Distance par rapport à l'école la plus proche (Km)",
  },
  college: {
    labelExistProche: "Existence d'un CEG à moins de 5 km",
    labelDistancePlusProche: "Distance par rapport au CEG le plus proche (Km)",
  },
  lycee: {
    labelExistProche: "Existence d'un lycée à moins de 20 km",
    labelDistancePlusProche: "Distance par rapport au lycée le plus proche (Km)",
  },
};

export const COLONNES_AIRE_VILLAGES = [
  { key: "fokontany", label: "Fokontany" },
  { key: "nom_village", label: "Nom du village" },
  { key: "distance_future", label: "Dist. future (km)" },
  { key: "distance_proche", label: "Dist. proche (km)" },
  { key: "population", label: "Population scolarisable" },
  { key: "latitude", label: "Latitude" },
  { key: "longitude", label: "Longitude" },
];

export const COLONNES_AIRE_ECOLES_COLLEGE = [
  { key: "fokontany", label: "Fokontany" },
  { key: "code_inferieur", label: "Code EPP" },
  { key: "nom_inferieur", label: "Nom de l'EPP" },
  { key: "distance_future", label: "Dist. future (km)" },
  { key: "effectif_t5", label: "Effectif T5" },
  { key: "latitude", label: "Latitude" },
  { key: "longitude", label: "Longitude" },
];

export const COLONNES_AIRE_ECOLES_LYCEE = [
  { key: "fokontany", label: "Fokontany" },
  { key: "code_inferieur", label: "Code CEG" },
  { key: "nom_inferieur", label: "Nom du CEG" },
  { key: "distance_future", label: "Dist. future (km)" },
  { key: "distance_proche", label: "Dist. proche (km)" },
  { key: "effectif_t9", label: "Effectif T9" },
  { key: "latitude", label: "Latitude" },
  { key: "longitude", label: "Longitude" },
];

export const getColonnesAireParNiveau = (niveauKey) => {
  switch (niveauKey) {
    case "college": return COLONNES_AIRE_ECOLES_COLLEGE;
    case "lycee":   return COLONNES_AIRE_ECOLES_LYCEE;
    default:        return COLONNES_AIRE_VILLAGES;
  }
};

export const getTitreAireParNiveau = (niveauKey) => {
  switch (niveauKey) {
    case "college":     return "Liste des EPP alimentant le futur CEG";
    case "lycee":       return "Liste des CEG alimentant le futur lycée";
    case "prescolaire": return "Liste des villages alimentant la future école préscolaire";
    case "primaire":    return "Liste des villages alimentant la future EPP";
    default:            return "Liste des villages / établissements alimentants";
  }
};

export const COLONNES_ENSEIGNANT_PRESCO_PRIMAIRE = [
  { key: "nom_enseignant", label: "Nom" },
  { key: "statut", label: "Statut" },
  { key: "profil", label: "Profil" },
  { key: "diplome_academique", label: "Diplôme académique" },
  { key: "diplome_pedagogique", label: "Diplôme pédagogique" },
  { key: "date_entreeAdmin", label: "Date d'entrée dans l'administration" },
];

export const COLONNES_ENSEIGNANT_COLLEGE = [
  { key: "nom_prenoms", label: "Nom et Prénom" },
  { key: "statut", label: "Statut" },
  { key: "profil", label: "Profil" },
  { key: "diplome_academique", label: "Diplôme académique" },
  { key: "diplome_pedagogique", label: "Diplôme pédagogique" },
  { key: "matiere", label: "Matière enseignée" },
  { key: "date_entree", label: "Date d'entrée dans l'administration" },
];

export const COLONNES_ENSEIGNANT_LYCEE = [
  { key: "nom_prenoms", label: "Nom et Prénom" },
  { key: "statut", label: "Statut" },
  { key: "profil", label: "Profil" },
  { key: "serie_bacc", label: "Série Bacc" },
  { key: "diplome_academique", label: "Diplôme académique le plus élevé" },
  { key: "diplome_pedagogique", label: "Diplôme pédagogique" },
  { key: "matiere", label: "Matière enseignée" },
  { key: "date_entree", label: "Date d'entrée dans l'administration" },
];

export const getColonnesEnseignantParNiveau = (niveauKey) => {
  switch (niveauKey) {
    case "college": return COLONNES_ENSEIGNANT_COLLEGE;
    case "lycee":   return COLONNES_ENSEIGNANT_LYCEE;
    default:        return COLONNES_ENSEIGNANT_PRESCO_PRIMAIRE;
  }
};

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

export const COLONNES_PROCHES = [
  { key: "fokontany", label: "Fokontany" },
  { key: "nom", label: "Nom" },
  { key: "code", label: "Code" },
  { key: "distance_km", label: "Distance (km)" },
  { key: "effectif", label: "Effectif" },
  { key: "salle", label: "Salles" },
  { key: "obstacle", label: "Obstacle" },
  { key: "nature_obstacle", label: "Nature" },
  { key: "statut_juridique", label: "Statut" },
];

export const CLES_INFO_INTERNES = [
  "distance_zap", "distance_cisco", "distance_dren", "existe_proche",
  "distance_plus_proche", "position_centrale", "present_ors", "ecart_centre_km",
  "champs_zap", "commune_sans_ceg", "district_sans_lycee",
];

export const SEUIL_EFFECTIF_MIN = { prescolaire: null, primaire: null, college: null, lycee: 250 };
export const SURFACE_NORME_M2 = { prescolaire: 2000, primaire: 2000, college: 2000, lycee: 2000 };
export const RAYON_TABLEAU_PROCHES_KM = { prescolaire: 3, primaire: 3, college: 8, lycee: 20 };

export const FICHE_NIVEAU = {
  prescolaire: {
    long: "École Préscolaire", court: "école préscolaire",
    pluriel: "écoles préscolaires", de: "de l'",
    leNouveau: "la nouvelle école préscolaire",
    duNouveau: "de la nouvelle école préscolaire",
    auNouveau: "à la nouvelle école préscolaire",
    article: "La", aireNom: "villages",
    aireEffLabel: "Population", aireNomCol: "Nom du village",
  },
  primaire: {
    long: "École Primaire", court: "école primaire",
    pluriel: "écoles primaires", de: "de l'",
    leNouveau: "la nouvelle école primaire",
    duNouveau: "de la nouvelle école primaire",
    auNouveau: "à la nouvelle école primaire",
    article: "La", aireNom: "villages",
    aireEffLabel: "Population", aireNomCol: "Nom du village",
  },
  college: {
    long: "Collège d'Enseignement Général", court: "collège",
    pluriel: "collèges", de: "du ",
    leNouveau: "le nouveau collège",
    duNouveau: "du nouveau collège",
    auNouveau: "au nouveau collège",
    article: "Le", aireNom: "écoles primaires (EPP)",
    aireEffLabel: "Effectif de CM2 (T5)",
    aireNomCol: "Nom de l'EPP (Privé et Public)",
  },
  lycee: {
    long: "Lycée d'Enseignement Général", court: "lycée",
    pluriel: "lycées", de: "du ",
    leNouveau: "le nouveau lycée",
    duNouveau: "du nouveau lycée",
    auNouveau: "au nouveau lycée",
    article: "Le", aireNom: "collèges",
    aireEffLabel: "Effectif de 3ème",
    aireNomCol: "Nom de l'établissement (Privé et Public)",
  },
};