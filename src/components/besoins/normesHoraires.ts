/**
 * Normes officielles de calcul des besoins — collège & lycée.
 *
 * Centralise toutes les valeurs numériques utilisées par les formules de
 * Besoins.tsx (enseignants, salles de classe) afin de ne PAS dépendre d'un
 * appel base de données : ce sont des constantes figées dans le code,
 * modifiables ici en un seul endroit.
 *
 * Source : normes_horaires.xlsx (feuille "normeCSV", id 1 à 80), reçu le
 * 2026-10-01. Pour toute mise à jour officielle des normes, modifier
 * uniquement ce fichier — Besoins.tsx n'y touche jamais directement.
 */

/** Effectif maximum par section/classe (id 1). */
export const ELEVE_PAR_SECTION = 50;

/** Volume horaire hebdomadaire qu'un enseignant peut assurer (id 2). */
export const HORAIRE_HEBDO_ENSEIGNANT = 20;

/* ───────────────────────── Collège (EPS / Littéraire / Scientifique) ─────────────────────────
 * id 3 et 4 du fichier source. La valeur EPS n'apparaît pas explicitement
 * dans le fichier reçu ; elle est reprise par défaut de la valeur EPS du
 * lycée (constante dans les 7 filières/cycles du lycée : voir plus bas),
 * à CONFIRMER auprès du Ministère.
 */
export const HORAIRE_COLLEGE_CONFIRME = false; // passer à true une fois HORAIRE_COLLEGE.eps confirmé
export const HORAIRE_COLLEGE = {
  litteraire: 14, // id 3 — "horaire litteraire"
  scientifique: 16, // id 4 — "horaire scientifique"
  eps: 2, // non fourni explicitement — repris de la valeur EPS lycée (constante partout), À CONFIRMER
};

/* ───────────────────────── Collège — Salles de classe (SDC) ─────────────────────────
 * id 75 à 80. Formule officielle (fournie en Excel) :
 *   requis_SDC = ARRONDI(
 *     Σ(sections_grade × horaire_eleve_grade) / heure_hebdo_utilisation_sdc
 *   )
 * avec heure_hebdo_utilisation_sdc = URB ou RUR selon CATEGORIE_COMMUNE,
 * et horaire_eleve_grade = volume horaire hebdomadaire d'un élève de ce
 * grade, HORS EPS (l'EPS ne consomme pas une salle de classe).
 */
export const UTILISATION_SDC_HEBDO = {
  urbain: 45, // id 75
  rural: 40, // id 76
};

export const HORAIRE_ELEVE_COLLEGE_SANS_EPS = {
  "6e": 25, // id 77
  "5e": 25, // id 78
  "4e": 27, // id 79
  "3e": 28, // id 80
};

/* ───────────────────────── Lycée — par matière et par filière/cycle ─────────────────────────
 * id 5 à 74 : 7 groupes filière/cycle (2nde — sans filière —, 1ère L/S/OSE,
 * Terminale L/S/OSE) × 10 matières (MAT, PC, FRA, ANG, MLG, PHI, HG, SVT,
 * SES, EPS).
 */
export type MatiereCode = "MAT" | "PC" | "FRA" | "ANG" | "MLG" | "PHI" | "HG" | "SVT" | "SES" | "EPS";

export const MATIERES_LYCEE: { code: MatiereCode; label: string }[] = [
  { code: "MAT", label: "Mathématiques" },
  { code: "PC", label: "Physique-Chimie" },
  { code: "FRA", label: "Français" },
  { code: "ANG", label: "Anglais" },
  { code: "MLG", label: "Malagasy" },
  { code: "PHI", label: "Philosophie" },
  { code: "HG", label: "Histoire-Géographie" },
  { code: "SVT", label: "SVT" },
  { code: "SES", label: "Sciences économiques et sociales" },
  { code: "EPS", label: "EPS" },
];

export type FiliereLycee = "2nd" | "1erL" | "1erS" | "1erOSE" | "TL" | "TS" | "TOSE";

export const FILIERES_LYCEE: { code: FiliereLycee; label: string; cycle: "2nde" | "1ere" | "terminale" }[] = [
  { code: "2nd", label: "2nde", cycle: "2nde" },
  { code: "1erL", label: "1ère L", cycle: "1ere" },
  { code: "1erS", label: "1ère S", cycle: "1ere" },
  { code: "1erOSE", label: "1ère OSE", cycle: "1ere" },
  { code: "TL", label: "Terminale L", cycle: "terminale" },
  { code: "TS", label: "Terminale S", cycle: "terminale" },
  { code: "TOSE", label: "Terminale OSE", cycle: "terminale" },
];

/** horaire hebdomadaire [filière][matière] — id 5 à 74 du fichier source. */
export const HORAIRE_LYCEE: Record<FiliereLycee, Record<MatiereCode, number>> = {
  "2nd": { MAT: 5, PC: 5, FRA: 3, ANG: 5, MLG: 4, PHI: 0, HG: 4, SVT: 4, SES: 0, EPS: 2 },
  "1erL": { MAT: 2, PC: 3, FRA: 3, ANG: 5, MLG: 4, PHI: 0, HG: 4, SVT: 2, SES: 0, EPS: 2 },
  "1erS": { MAT: 5, PC: 6, FRA: 3, ANG: 5, MLG: 4, PHI: 0, HG: 4, SVT: 5, SES: 0, EPS: 2 },
  "1erOSE": { MAT: 5, PC: 2, FRA: 4, ANG: 2, MLG: 2, PHI: 2, HG: 4, SVT: 2, SES: 5, EPS: 2 },
  TL: { MAT: 2, PC: 2, FRA: 3, ANG: 5, MLG: 4, PHI: 6, HG: 4, SVT: 2, SES: 0, EPS: 2 },
  TS: { MAT: 5, PC: 5, FRA: 3, ANG: 5, MLG: 4, PHI: 4, HG: 4, SVT: 5, SES: 0, EPS: 2 },
  TOSE: { MAT: 5, PC: 0, FRA: 3, ANG: 2, MLG: 3, PHI: 3, HG: 5, SVT: 3, SES: 5, EPS: 2 },
};

/**
 * Moyenne (non pondérée) de l'horaire d'une matière sur les filières d'un
 * même cycle — utilisée UNIQUEMENT en repli quand les effectifs par filière
 * ne sont pas disponibles (notre modèle de données actuel n'a que 3
 * agrégats 2nde/1ère/Tle, pas le détail par filière L/S/OSE). Dès que les
 * effectifs par filière seront collectés, utiliser HORAIRE_LYCEE
 * directement, filière par filière, plutôt que cette moyenne.
 */
export const HORAIRE_LYCEE_MOYENNE_PAR_CYCLE: Record<"2nde" | "1ere" | "terminale", Record<MatiereCode, number>> = (() => {
  const result: any = { "2nde": {}, "1ere": {}, terminale: {} };
  for (const matiere of MATIERES_LYCEE) {
    const parCycle: Record<string, number[]> = { "2nde": [], "1ere": [], terminale: [] };
    for (const filiere of FILIERES_LYCEE) {
      parCycle[filiere.cycle].push(HORAIRE_LYCEE[filiere.code][matiere.code]);
    }
    for (const cycle of ["2nde", "1ere", "terminale"] as const) {
      const valeurs = parCycle[cycle];
      result[cycle][matiere.code] = valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
    }
  }
  return result;
})();
