// Types pour les indicateurs du diagnostic éducatif selon le MEN Madagascar

// Indicateurs de Couverture
export interface IndicateursCouverture {
  // Taux Brut de Scolarisation
  tbs: {
    prescolaire?: number;
    primaire?: number;
    college?: number;
    lycee?: number;
  };
  // Taux Net de Scolarisation
  tns: {
    prescolaire?: number;
    primaire?: number;
    college?: number;
    lycee?: number;
  };
  // Taux Brut d'Accès
  tba: {
    prescolaire?: number;
    primaire?: number;
    college?: number;
    lycee?: number;
  };
  // Accessibilité physique
  distanceSuperieure: {
    primaire2km?: number;
    college5km?: number;
  };
  // Établissements privés
  partPrive: {
    prescolaire?: number;
    primaire?: number;
    college?: number;
    lycee?: number;
  };
  // EPP avec CAP
  eppAvecCap?: number;
  // Écoles à cycle incomplet
  cycleIncomplet?: number;
}

// Indicateurs de Qualité
export interface IndicateursQualite {
  // Ratio élève/maître
  rem: {
    prescolaire?: number;
    primaire?: number;
    college?: number;
    lycee?: number;
  };
  // Ratio élève/salle de classe
  ratioEleveSdc: {
    prescolaire?: number;
    primaire?: number;
    college?: number;
    lycee?: number;
  };
  // Ratio élève/place assise
  ratioElevePlaceAssise: {
    prescolaire?: number;
    primaire?: number;
    college?: number;
    lycee?: number;
  };
  // Pourcentage enseignants qualifiés
  enseignantsQualifies: {
    prescolaire?: number;
    primaire?: number;
    college?: number;
    lycee?: number;
  };
  // Pourcentage enseignants fonctionnaires
  enseignantsFonctionnaires: {
    prescolaire?: number;
    primaire?: number;
    college?: number;
    lycee?: number;
  };
  // Infrastructures
  infrastructures: {
    electrifie?: number;
    pointEau?: number;
    latrinesSeparees?: number;
    cantineScolaire?: number;
    ordinateur?: number;
  };
  // Salles en mauvais état
  sdcMauvaisEtat?: number;
  // Élèves en classe multigrade
  classeMultigrade?: number;
  // Élèves hors âge normal
  horsAgeNormal: {
    primaire?: number;
    college?: number;
    lycee?: number;
  };
}

// Indicateurs d'Efficacité Interne
export interface IndicateursEfficacite {
  // Taux de redoublement
  tauxRedoublement: {
    primaire?: number;
    college?: number;
    lycee?: number;
  };
  // Taux d'abandon
  tauxAbandon: {
    primaire?: number;
    college?: number;
    lycee?: number;
  };
  // Taux de promotion
  tauxPromotion: {
    primaire?: number;
    college?: number;
    lycee?: number;
  };
  // Taux de rétention
  tauxRetention: {
    primaire?: number;
    college?: number;
    lycee?: number;
  };
  // Taux d'achèvement
  tauxAchevement: {
    primaire?: number;
    college?: number;
    lycee?: number;
  };
  // Taux de transition
  tauxTransition: {
    primaireVersCollege?: number;
    collegeVersLycee?: number;
  };
  // Coefficient d'efficacité interne
  coefficientEfficacite?: number;
}

// Indicateurs de Résultats aux examens
export interface IndicateursResultats {
  tauxReussiteCEPE?: number;
  tauxReussiteBEPC?: number;
  tauxReussiteBAC?: number;
}

// Données brutes du système éducatif
export interface DonneesSystemeEducatif {
  // Établissements
  etablissements: {
    prescolaire: { public: number; prive: number; total: number };
    primaire: { public: number; prive: number; total: number };
    college: { public: number; prive: number; total: number };
    lycee: { public: number; prive: number; total: number };
  };
  // Salles de classe
  sallesDeClasse: {
    prescolaire: { public: number; prive: number; total: number; bonEtat?: number; mauvaisEtat?: number };
    primaire: { public: number; prive: number; total: number; bonEtat?: number; mauvaisEtat?: number };
    college: { public: number; prive: number; total: number; bonEtat?: number; mauvaisEtat?: number };
    lycee: { public: number; prive: number; total: number; bonEtat?: number; mauvaisEtat?: number };
  };
  // Effectifs élèves
  effectifsEleves: {
    prescolaire: { total: number; filles: number; public: number; prive: number };
    primaire: { total: number; filles: number; public: number; prive: number; parClasse?: { t1: number; t2: number; t3: number; t4: number; t5: number } };
    college: { total: number; filles: number; public: number; prive: number; parClasse?: { t6: number; t7: number; t8: number; t9: number } };
    lycee: { total: number; filles: number; public: number; prive: number; parClasse?: { seconde: number; premiere: number; terminale: number } };
  };
  // Enseignants
  enseignants: {
    prescolaire: { total: number; femmes: number; fonctionnaire: number; nonFonctionnaire: number };
    primaire: { total: number; femmes: number; fonctionnaire: number; nonFonctionnaire: number };
    college: { total: number; femmes: number; fonctionnaire: number; nonFonctionnaire: number };
    lycee: { total: number; femmes: number; fonctionnaire: number; nonFonctionnaire: number };
  };
  // Places assises (tables-bancs)
  placesAssises: {
    prescolaire: { total: number };
    primaire: { total: number };
    college: { total: number };
    lycee: { total: number };
  };
}

// Structure complète du diagnostic
export interface DiagnosticComplet {
  // Métadonnées
  meta: {
    dren?: string;
    cisco?: string;
    anneeScolaire: string;
    dateGeneration: string;
    niveau: 'national' | 'dren' | 'cisco';
  };
  // Données brutes
  donnees: DonneesSystemeEducatif;
  // Indicateurs calculés
  indicateurs: {
    couverture: IndicateursCouverture;
    qualite: IndicateursQualite;
    efficacite: IndicateursEfficacite;
    resultats: IndicateursResultats;
  };
  // Texte du diagnostic généré par IA
  diagnosticTexte?: string;
}

// Niveaux d'enseignement
export type NiveauEnseignement = 'prescolaire' | 'primaire' | 'college' | 'lycee';

// Catégorie d'indicateur pour l'affichage
export interface CategorieIndicateur {
  id: string;
  nom: string;
  description: string;
  indicateurs: IndicateurAffichage[];
}

export interface IndicateurAffichage {
  id: string;
  nom: string;
  valeur: number | null;
  unite: '%' | 'ratio' | 'nombre';
  evolution?: number; // Changement par rapport à l'année précédente
  interpretation?: 'bon' | 'moyen' | 'mauvais';
  seuilBon?: number;
  seuilMauvais?: number;
  description?: string;
}

// Constantes pour l'interprétation des indicateurs
export const SEUILS_INDICATEURS = {
  rem: { bon: 40, mauvais: 52 }, // Ratio élève/maître
  tbs: { bon: 100, mauvais: 50 },
  tauxRedoublement: { bon: 5, mauvais: 15 },
  tauxAbandon: { bon: 3, mauvais: 10 },
  tauxAchevement: { bon: 80, mauvais: 50 },
  tauxReussite: { bon: 70, mauvais: 40 },
  enseignantsQualifies: { bon: 80, mauvais: 50 },
  sdcMauvaisEtat: { bon: 10, mauvais: 30 },
  cycleIncomplet: { bon: 10, mauvais: 30 },
};
