/**
 * Modèle du tableau de bord DREN — cahier des charges ministériel.
 *
 * Le modèle ne contient aucune valeur historique : il organise les données
 * réellement renvoyées par `getTdbDrenData` (primaire) et `getTdbDrenNiveau`
 * (préscolaire / collège / lycée) dans les sections, tableaux et indicateurs
 * attendus, avec leur statut de cellule :
 *   - `missing`   : donnée non disponible (affichée « — » sur fond bleu) ;
 *   - `review`    : valeur incohérente (négative ou hors bornes), fond jaune ;
 *   - `attention` : DREN moins bonne que MADA selon le `sens`, fond rouge ;
 *   - `na`        : cellule non applicable, fond gris.
 *
 * Les calculs restent dans `tdbDrenFormulas`, `tdbDrenNiveaux` et
 * `tdbEfficience` ; ce module ne fait que les mettre en forme.
 */
import {
  drenAdmission,
  drenAbandon,
  drenCoverage,
  drenCycleRate,
  drenDivide,
  drenExamThreshold,
  drenPromotion,
  drenRead,
  drenRepeat,
  drenRetention,
  drenSum,
} from './tdbDrenFormulas';
import { drenReportRead } from './tdbDrenPresentation';
import {
  cycleRate,
  disparite,
  div,
  effectif,
  effectifNiveaux,
  parite,
  redoublants,
  retentionProfile,
  tauxAbandon,
  tauxNetScolarisation,
  tauxPromotion,
  tauxRedoublement,
  tauxTransition,
  val,
  type Secteur,
} from './tdbDrenNiveaux';
import { computeEfficience, tdbEntityName, type SchoolCycle } from './tdbEfficience';

export type ReportLevel = 'presco' | 'primaire' | 'college' | 'lycee';
export type IndicatorSection = 'generales' | 'resultats' | 'ressources' | 'goulots' | 'efficience';
export type IndicatorSense = 'higher' | 'lower';
export type CellStatus = 'ok' | 'missing' | 'review' | 'attention' | 'na';

export interface IndicatorMeta {
  code: string;
  label: string;
  section: IndicatorSection;
  unit: '%' | 'Ar' | '';
  digits: number;
  sense?: IndicatorSense;
  max?: number;
  definition: string;
  formula: string;
  dataNeeded: string;
  source: string;
  collect: string;
  owner: string;
  deadline: string;
}

export interface ReportCell {
  value: number | null;
  status: CellStatus;
  display: string;
  span?: number;
  icon?: 'f' | 'g' | null;
  meta?: IndicatorMeta;
}

export interface ReportRow {
  label: string;
  indent?: boolean;
  bold?: boolean;
  cells: ReportCell[];
  meta?: IndicatorMeta;
}

export interface ReportTable {
  title?: string;
  columns: string[];
  rows: ReportRow[];
  note?: string;
}

export interface ExamBlock {
  title: string;
  groups: { label: string; span: number }[];
  subColumns: string[];
  subjectRows: ReportRow[];
  admissionTitle?: string;
  admissionRows: ReportRow[];
  note?: string;
}

export interface GoulotItem {
  label: string;
  /** Valeur plafonnée à 100 pour l’affichage de la barre. */
  value: number | null;
  /** Valeur brute : au-delà de 100, la barre est pleine et l’étiquette est masquée. */
  raw: number | null;
  meta: IndicatorMeta;
}

export interface EfficiencyPoint {
  name: string;
  x: number | null;
  y: number | null;
  isCurrent?: boolean;
  isParent?: boolean;
}

export interface EfficiencyReport {
  x: number | null;
  y: number | null;
  points: EfficiencyPoint[];
  /** Population comparée (DREN, CISCO…) affichée dans la légende du nuage. */
  siblingsLabel: string;
  remarks: string[];
}

export interface DrenReportModel {
  level: ReportLevel;
  title: string;
  anneeLabel: string;
  drenName: string;
  drenCode: string;
  general: ReportTable[];
  coverage: ReportTable;
  profile: { label: string; dren: number | null; mada: number | null }[];
  profileTitle: string;
  exams: ExamBlock[];
  ueas: ExamBlock[];
  flows: ReportTable[];
  human: ReportTable;
  finance: ReportTable | null;
  other: ReportTable;
  manuals: ReportTable | null;
  bottlenecks: GoulotItem[];
  efficiency: EfficiencyReport | null;
  notes: string[];
}

const TITLES: Record<ReportLevel, string> = {
  presco: 'PRÉSCOLAIRE',
  primaire: 'PRIMAIRE',
  college: 'COLLÈGE',
  lycee: 'LYCÉE',
};
const GRADES: Record<ReportLevel, string[]> = {
  presco: ['PS', 'MS', 'GS'],
  primaire: ['T1', 'T2', 'T3', 'T4', 'T5'],
  college: ['6ème', '5ème', '4ème', '3ème'],
  lycee: ['Seconde', 'Première', 'Terminale'],
};
const CYCLE: Record<ReportLevel, SchoolCycle> = {
  presco: 'primaire',
  primaire: 'primaire',
  college: 'college',
  lycee: 'lycee',
};
const SECTORS: Secteur[] = ['0', '1', 'ens'];

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
  const n = typeof v === 'string' ? Number(v.replace(/\s/g, '').replace(',', '.').replace('%', '')) : Number(v);
  return Number.isFinite(n) ? n : null;
};
const ratio = (a: number | null, b: number | null, factor = 1) =>
  a === null || b === null || b <= 0 || a < 0 ? null : (a / b) * factor;
const round = (v: number | null, digits = 1) =>
  v === null || !Number.isFinite(v) ? null : Number(v.toFixed(digits));

/** Format ministériel : espace pour les milliers, point décimal, « % » collé. */
export function formatDrenValue(value: number | null, unit = '', digits = 1): string {
  if (value === null || !Number.isFinite(value)) return '—';
  const text = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
  return `${text.replace(/,/g, ' ')}${unit}`;
}

export function cellStatus(
  value: number | null,
  national: number | null,
  sense?: IndicatorSense,
  max?: number,
): CellStatus {
  if (value === null || !Number.isFinite(value)) return 'missing';
  if (value < 0 || (max !== undefined && value > max)) return 'review';
  if (national !== null && sense) {
    return sense === 'higher' ? (value < national ? 'attention' : 'ok') : value > national ? 'attention' : 'ok';
  }
  return 'ok';
}

function makeMeta(
  code: string,
  label: string,
  options: Partial<Omit<IndicatorMeta, 'code' | 'label'>> = {},
): IndicatorMeta {
  const base: IndicatorMeta = {
    code,
    label,
    section: 'resultats',
    unit: '%',
    digits: 1,
    definition: `Indicateur « ${label} » du tableau de bord DREN.`,
    formula: 'Valeur issue de la source, pour le périmètre sélectionné.',
    dataNeeded: 'Effectifs, personnels et infrastructures du périmètre.',
    source: 'FPE / INSTAT',
    collect: 'Collecte annuelle de la fiche établissement (FPE), consolidation DREN.',
    owner: 'Service de la planification — DREN',
    deadline: '15 novembre',
  };
  const defined = Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined));
  return { ...base, ...defined };
}

const META: Record<string, IndicatorMeta> = {
  taux_transition: makeMeta('taux_transition', 'Taux de transition entre cycles', {
    section: 'resultats',
    sense: 'higher',
    max: 100,
    definition: 'Part des élèves de la dernière classe d’un cycle qui entrent dans la première classe du cycle suivant.',
    formula: 'Nouveaux entrants en première année du cycle suivant (t+1) ÷ élèves de la dernière année du cycle précédent (t) × 100',
    dataNeeded: 'Effectifs de la dernière classe du cycle précédent et nouveaux entrants du cycle suivant.',
    source: 'FPE / DTIC',
  }),
  tbs: makeMeta('tbs', 'Taux brut de scolarisation (TBS)', {
    sense: 'higher',
    definition: 'Effectif scolarisé du cycle rapporté à la population d’âge officiel, sans restriction d’âge.',
    formula: 'Élèves du cycle ÷ population du groupe d’âge officiel × 100',
    dataNeeded: 'Effectif du cycle et projection démographique du groupe d’âge.',
    source: 'FPE / INSTAT',
  }),
  tns: makeMeta('tns', 'Taux net de scolarisation (TNS)', {
    sense: 'higher',
    max: 100,
    definition: 'Part des enfants d’âge officiel effectivement scolarisés dans le cycle.',
    formula: 'Élèves ayant l’âge officiel ÷ population du même groupe d’âge × 100',
    dataNeeded: 'Effectifs par âge et projection démographique.',
    source: 'FPE / INSTAT',
  }),
  tna: makeMeta('tna', 'Taux net d’accès (TNA)', {
    sense: 'higher',
    max: 100,
    definition: 'Part des enfants d’âge officiel qui accèdent pour la première fois à la première année du cycle.',
    formula: 'Nouveaux entrants à l’âge officiel ÷ population de l’âge officiel d’entrée × 100',
    dataNeeded: 'Nouveaux entrants par âge et population de l’âge d’entrée.',
    source: 'FPE / INSTAT',
  }),
  tag: makeMeta('tag', 'Taux d’accès générationnel', {
    section: 'resultats',
    sense: 'higher',
    max: 100,
    definition: 'Part d’une génération qui accède à l’école primaire, en suivant les enfants de 6 à 10 ans.',
    formula: 'Enfants de la génération ayant accédé (6 à 10 ans) ÷ population de la génération à 6 ans × 100',
    dataNeeded: 'Nouveaux entrants par âge officiel et population de la génération.',
    source: 'FPE / INSTAT',
  }),
  tba: makeMeta('tba', 'Taux brut d’accès (TBA)', {
    sense: 'higher',
    definition: 'Nouveaux entrants dans le cycle, tous âges confondus, rapportés à la population de l’âge officiel d’entrée.',
    formula: 'Nouveaux entrants en première année ÷ population de l’âge officiel d’entrée × 100',
    dataNeeded: 'Nouveaux entrants et population de l’âge d’entrée.',
    source: 'FPE / INSTAT',
  }),
  achevement: makeMeta('achevement', 'Taux d’achèvement', {
    sense: 'higher',
    max: 100,
    definition: 'Part d’une génération qui achève la dernière année du cycle.',
    formula: '(Inscrits en dernière année − redoublants de cette année) ÷ population de l’âge officiel de fin de cycle × 100',
    dataNeeded: 'Effectif et redoublants de la dernière classe, population de l’âge de fin de cycle.',
    source: 'FPE / INSTAT',
  }),
  retention: makeMeta('retention', 'Taux de rétention', {
    sense: 'higher',
    max: 100,
    definition: 'Dernier point du profil de rétention pseudo-longitudinal du cycle.',
    formula: 'Taux d’accès de la dernière classe ÷ taux d’accès de la première classe × 100',
    dataNeeded: 'Nouveaux entrants par niveau et populations des âges officiels.',
    source: 'FPE / INSTAT',
  }),
  reinseres: makeMeta('reinseres', 'Pourcentage des élèves réinsérés (CRAN)', {
    section: 'generales',
    sense: 'higher',
    max: 100,
    definition: 'Part des élèves du niveau inscrits après une réinsertion suivie par le CRAN.',
    formula: 'Élèves réinsérés (CRAN) ÷ effectif du niveau × 100',
    dataNeeded: 'Effectifs réinsérés (CRAN) et effectif total du niveau.',
    source: 'FPE',
  }),
  redoublement: makeMeta('redoublement', 'Pourcentage de redoublants', {
    sense: 'lower',
    max: 100,
    definition: 'Part des élèves d’un niveau qui redoublent la même année scolaire (photographie de l’année t).',
    formula: 'Redoublants du niveau (n, t) ÷ effectif du niveau (n, t) × 100',
    dataNeeded: 'Effectifs et redoublants par niveau.',
    source: 'FPE',
  }),
  promotion: makeMeta('promotion', 'Taux de promotion', {
    sense: 'higher',
    max: 100,
    definition: 'Part des élèves d’un niveau qui passent au niveau supérieur l’année suivante.',
    formula: '(Effectif du niveau n+1 en t+1 − redoublants du niveau n+1 en t+1) ÷ effectif du niveau n en t × 100',
    dataNeeded: 'Effectifs et redoublants de deux années consécutives.',
    source: 'FPE',
  }),
  abandon: makeMeta('abandon', 'Taux d’abandon', {
    sense: 'lower',
    max: 100,
    definition: 'Part des élèves qui quittent le système entre deux années scolaires.',
    formula: '100 − taux de promotion − redoublement de flux (redoublants n+1 en t+1 ÷ effectif n en t × 100)',
    dataNeeded: 'Effectifs et redoublants de deux années consécutives.',
    source: 'FPE',
  }),
  admis: makeMeta('admis', 'Pourcentage des admis à l’examen', {
    sense: 'higher',
    max: 100,
    definition: 'Part des candidats inscrits qui sont déclarés admis à l’examen de fin de cycle.',
    formula: 'Admis ÷ inscrits dans la classe d’examen × 100',
    dataNeeded: 'Candidats inscrits, présents et admis, par sexe.',
    source: 'DTIC',
  }),
  qualifies: makeMeta('qualifies', 'Pourcentage d’enseignants qualifiés', {
    section: 'ressources',
    sense: 'higher',
    max: 100,
    definition: 'Part des enseignants en classe titulaires d’un diplôme pédagogique.',
    formula: 'Enseignants avec diplôme pédagogique ÷ enseignants en classe × 100',
    dataNeeded: 'Personnel en classe et diplôme pédagogique.',
    source: 'Base RH DREN / FPE',
  }),
  eleves_enseignant: makeMeta('eleves_enseignant', 'Ratio élève-maître', {
    section: 'ressources',
    sense: 'lower',
    unit: '',
    digits: 0,
    definition: 'Nombre moyen d’élèves encadrés par un enseignant en classe.',
    formula: 'Effectif ÷ enseignants en classe',
    dataNeeded: 'Effectif et personnel en classe.',
    source: 'FPE',
  }),
  eleves_section: makeMeta('eleves_section', 'Élèves par section', {
    section: 'ressources',
    sense: 'lower',
    unit: '',
    digits: 0,
    definition: 'Nombre moyen d’élèves par section (groupe pédagogique).',
    formula: 'Effectif ÷ nombre de sections',
    dataNeeded: 'Effectif et nombre de sections.',
    source: 'FPE',
  }),
  eleves_salle: makeMeta('eleves_salle', 'Élèves par salle', {
    section: 'ressources',
    sense: 'lower',
    unit: '',
    digits: 0,
    definition: 'Nombre moyen d’élèves par salle de classe.',
    formula: 'Effectif ÷ nombre de salles',
    dataNeeded: 'Effectif et nombre de salles.',
    source: 'FPE',
  }),
  place_salle: makeMeta('place_salle', 'Places assises par salle', {
    section: 'ressources',
    unit: '',
    digits: 0,
    definition: 'Nombre moyen de places assises par salle.',
    formula: 'Σ (tables-bancs de k places × k) ÷ nombre de salles',
    dataNeeded: 'Inventaire du mobilier et nombre de salles.',
    source: 'FPE',
  }),
  section_salle: makeMeta('section_salle', 'Rapport section par salle', {
    section: 'ressources',
    sense: 'lower',
    unit: '',
    definition: 'Nombre de sections par salle de classe ; mesure la pression sur les locaux.',
    formula: 'Nombre de sections ÷ nombre de salles',
    dataNeeded: 'Sections et salles.',
    source: 'FPE',
  }),
  eleves_place: makeMeta('eleves_place', 'Élèves par place assise', {
    section: 'ressources',
    sense: 'lower',
    unit: '',
    definition: 'Nombre d’élèves pour une place assise disponible.',
    formula: 'Effectif ÷ places assises',
    dataNeeded: 'Effectif et places assises.',
    source: 'FPE',
  }),
  eleves_latrine: makeMeta('eleves_latrine', 'Élèves par latrine', {
    section: 'ressources',
    sense: 'lower',
    unit: '',
    digits: 0,
    definition: 'Nombre d’élèves par latrine disponible.',
    formula: 'Effectif ÷ nombre de latrines',
    dataNeeded: 'Effectif et latrines.',
    source: 'FPE',
  }),
  filles_latrine: makeMeta('filles_latrine', 'Filles par latrine pour filles', {
    section: 'ressources',
    sense: 'lower',
    unit: '',
    digits: 0,
    definition: 'Nombre de filles par latrine réservée aux filles.',
    formula: 'Effectif filles ÷ latrines filles',
    dataNeeded: 'Effectif filles et latrines filles.',
    source: 'FPE',
  }),
  latrine_filles: makeMeta('latrine_filles', 'Établissements avec latrine pour filles', {
    section: 'ressources',
    sense: 'higher',
    max: 100,
    definition: 'Part des établissements disposant d’une latrine réservée aux filles.',
    formula: 'Établissements avec latrine filles ÷ établissements × 100',
    dataNeeded: 'Inventaire des latrines par établissement.',
    source: 'FPE',
  }),
  electricite: makeMeta('electricite', 'Établissements avec électricité', {
    section: 'ressources',
    sense: 'higher',
    max: 100,
    definition: 'Part des établissements raccordés à l’électricité.',
    formula: 'Établissements électrifiés ÷ établissements × 100',
    dataNeeded: 'Fiche infrastructure de l’établissement.',
    source: 'FPE',
  }),
  cantine: makeMeta('cantine', 'Établissements avec cantine scolaire', {
    section: 'ressources',
    sense: 'higher',
    max: 100,
    definition: 'Part des établissements disposant d’une cantine scolaire.',
    formula: 'Établissements avec cantine ÷ établissements × 100',
    dataNeeded: 'Fiche infrastructure de l’établissement.',
    source: 'FPE',
  }),
  eau: makeMeta('eau', 'Établissements avec point d’eau', {
    section: 'ressources',
    sense: 'higher',
    max: 100,
    definition: 'Part des établissements disposant d’un point d’eau.',
    formula: 'Établissements avec point d’eau ÷ établissements × 100',
    dataNeeded: 'Fiche infrastructure de l’établissement.',
    source: 'FPE',
  }),
  handicap: makeMeta('handicap', 'Établissements accueillant des élèves en situation de handicap', {
    section: 'ressources',
    sense: 'higher',
    max: 100,
    definition: 'Part des établissements déclarant accueillir des élèves en situation de handicap.',
    formula: 'Établissements concernés ÷ établissements × 100',
    dataNeeded: 'Déclaration de l’établissement.',
    source: 'FPE',
  }),
  moins_2km: makeMeta('moins_2km', 'Élèves vivant à moins de 2 km', {
    section: 'ressources',
    sense: 'higher',
    max: 100,
    definition: 'Part des élèves dont le domicile est situé à moins de 2 km de l’établissement.',
    formula: 'Élèves à moins de 2 km ÷ effectif × 100',
    dataNeeded: 'Distance domicile-établissement déclarée.',
    source: 'FPE',
  }),
  moins_5km: makeMeta('moins_5km', 'Élèves vivant à moins de 5 km', {
    section: 'ressources',
    sense: 'higher',
    max: 100,
    definition: 'Part des élèves dont le domicile est situé à moins de 5 km de l’établissement.',
    formula: 'Élèves à moins de 5 km ÷ effectif × 100',
    dataNeeded: 'Distance domicile-établissement déclarée.',
    source: 'FPE',
  }),
  manuel_eleve: makeMeta('manuel_eleve', 'Ratio élève-manuel', {
    section: 'ressources',
    sense: 'lower',
    unit: '',
    definition: 'Nombre d’élèves par manuel utilisable, par discipline et par niveau.',
    formula: 'Effectif ÷ nombre de manuels disponibles',
    dataNeeded: 'Inventaire des manuels par discipline et par niveau.',
    source: 'FPE / partenaires',
  }),
  manuels_mal_repartis: makeMeta('manuels_mal_repartis', 'Manuels mal répartis', {
    section: 'ressources',
    sense: 'lower',
    max: 100,
    definition: 'Part de la variance des manuels par établissement non expliquée par le nombre d’élèves.',
    formula: '(1 − R²) × 100, régression des manuels par établissement sur les effectifs',
    dataNeeded: 'Manuels et effectifs par établissement public.',
    source: 'FPE',
  }),
  enseignants_mal_repartis: makeMeta('enseignants_mal_repartis', 'Enseignants mal répartis', {
    section: 'ressources',
    sense: 'lower',
    max: 100,
    definition: 'Part de la variance des enseignants par établissement non expliquée par le nombre d’élèves.',
    formula: '(1 − R²) × 100, régression des enseignants sur les effectifs par établissement',
    dataNeeded: 'Enseignants et effectifs par établissement public.',
    source: 'FPE / base RH',
  }),
  utilisation_salles: makeMeta('utilisation_salles', 'Taux d’utilisation des salles', {
    section: 'ressources',
    sense: 'higher',
    max: 100,
    definition: 'Occupation réelle des salles rapportée à leur capacité horaire maximale.',
    formula: '(Volume horaire élève × nombre de sections) ÷ (horaire maximal × nombre de salles) × 100',
    dataNeeded: 'Volume horaire, sections, salles et horaire maximal.',
    source: 'FPE',
  }),
  depense_eleve: makeMeta('depense_eleve', 'Montant par élève', {
    section: 'ressources',
    unit: 'Ar',
    digits: 0,
    definition: 'Montant moyen mobilisé par élève pour le poste considéré.',
    formula: 'Montant total du poste ÷ effectif total des élèves',
    dataNeeded: 'Comptes de l’établissement et effectif.',
    source: 'DEF / FPE',
  }),
  fokontany_ecole: makeMeta('fokontany_ecole', 'Fokontany ayant au moins une école', {
    section: 'goulots',
    sense: 'higher',
    max: 100,
    definition: 'Part des fokontany disposant d’au moins une école du niveau.',
    formula: 'Fokontany avec école ÷ fokontany × 100',
    dataNeeded: 'Liste des fokontany et implantation des écoles.',
    source: 'Ministère de l’Intérieur / FPE',
  }),
  salles_1000: makeMeta('salles_1000', 'Salles pour 1 000 enfants d’âge scolaire', {
    section: 'goulots',
    unit: '',
    sense: 'higher',
    definition: 'Nombre de salles de classe disponibles pour 1 000 enfants d’âge scolaire.',
    formula: 'Nombre de salles ÷ population d’âge scolaire × 1 000',
    dataNeeded: 'Salles et population d’âge scolaire.',
    source: 'FPE / INSTAT',
  }),
  enseignants_1000: makeMeta('enseignants_1000', 'Enseignants pour 1 000 enfants d’âge scolaire', {
    section: 'goulots',
    unit: '',
    sense: 'higher',
    definition: 'Nombre d’enseignants en classe pour 1 000 enfants d’âge scolaire.',
    formula: 'Enseignants en classe ÷ population d’âge scolaire × 1 000',
    dataNeeded: 'Enseignants et population.',
    source: 'FPE / INSTAT',
  }),
  places_enfant: makeMeta('places_enfant', 'Places assises par enfant d’âge scolaire', {
    section: 'goulots',
    sense: 'higher',
    unit: '',
    digits: 2,
    definition: 'Nombre de places assises disponibles par enfant d’âge scolaire.',
    formula: 'Places assises ÷ population d’âge scolaire',
    dataNeeded: 'Mobilier et population.',
    source: 'FPE / INSTAT',
  }),
  ecole_continue: makeMeta('ecole_continue', 'Élèves en école primaire continue', {
    section: 'goulots',
    sense: 'higher',
    max: 100,
    definition: 'Part des écoles primaires offrant le cycle complet T1 à T5.',
    formula: 'Écoles continues ÷ écoles × 100',
    dataNeeded: 'Sections ouvertes par école.',
    source: 'FPE',
  }),
  groupe_enseignant: makeMeta('groupe_enseignant', 'Ratio groupe pédagogique par enseignant', {
    section: 'goulots',
    sense: 'lower',
    unit: '',
    digits: 2,
    definition: 'Nombre de groupes pédagogiques par enseignant en classe.',
    formula: 'Nombre de sections ÷ enseignants en classe',
    dataNeeded: 'Sections et enseignants.',
    source: 'FPE',
  }),
};

function toCell(
  value: number | null,
  national: number | null,
  meta: IndicatorMeta,
  options: { na?: boolean; status?: CellStatus; span?: number; icon?: 'f' | 'g' | null; display?: string } = {},
): ReportCell {
  if (options.icon !== undefined) {
    return { value, status: 'ok', display: '', icon: options.icon, span: options.span, meta };
  }
  if (options.na) return { value: null, status: 'na', display: '', span: options.span, meta };
  const status = options.status ?? cellStatus(value, national, meta.sense, meta.max);
  const display =
    options.display ??
    (status === 'na' ? '' : formatDrenValue(value, meta.unit, meta.digits));
  return { value, status, display, span: options.span, meta };
}

function keysRow(
  label: string,
  meta: IndicatorMeta,
  values: number[],
  cell: (value: number | null, index: number) => ReportCell,
  options: { indent?: boolean; bold?: boolean } = {},
): ReportRow {
  return {
    label,
    meta,
    indent: options.indent,
    bold: options.bold,
    cells: values.map((_, i) => cell(values[i], i)),
  };
}

/* ------------------------------------------------------------------ */
/* Primaire                                                            */
/* ------------------------------------------------------------------ */

function buildPrimary(raw: any): DrenReportModel {
  const d = raw.dren || {};
  const m = raw.mada || {};
  const grades = GRADES.primaire;
  const g = grades.length;
  const read = (e: any, ...k: string[]) => drenReportRead(e, ...k);
  // Les ratios ci-dessous ont besoin des effectifs bruts de la source SQL :
  // `read` privilégie les `indicateurs` importés, qui expriment certains de ces
  // champs en pourcentage (eleve_2km, ecole_continue…) et fausseraient le calcul.
  const res = (e: any, key: string) => num(e?.ressources?.[key]);
  // Pourcentage déjà calculé dans le snapshot importé (df_dren.csv).
  const importedPct = (e: any, key: string) => num(drenRead({ indicateurs: e?.indicateurs }, key));
  const pop = (e: any) => (e?.population || {}) as Record<string, number | null>;
  const allPupils = (e: any) => read(e, 'nombre_eleves_tous_secteurs') ?? read(e, 'nbr_eleve');
  const qualified = (e: any) => {
    const teachers = read(e, 'pers_en_classe');
    const unqualified = read(e, 'sans_diplome_ped');
    return teachers === null || unqualified === null || teachers <= 0
      ? null
      : ((teachers - unqualified) / teachers) * 100;
  };
  const genderValue = (e: any, key: string) => read(e, key);

  const mk = (code: string, label: string, options: Partial<IndicatorMeta> = {}) =>
    META[code] ? { ...META[code], label, ...Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined)) } : makeMeta(code, label, options);

  /* ---- Données générales ---- */
  const gen = (label: string, ensemble: number | null, publicValue: number | null, code = label, opts: { naEnsemble?: boolean } = {}): ReportRow => {
    const meta = generalMeta(code, label);
    return {
      label,
      meta,
      cells: [
        toCell(ensemble, null, meta, { na: opts.naEnsemble }),
        toCell(publicValue, null, meta),
      ],
    };
  };
  const nonClasse = (() => {
    const total = read(d, 'nbr_pers'), inClass = read(d, 'pers_en_classe');
    return total === null || inClass === null ? null : total - inClass;
  })();
  const general: ReportTable[] = [
    {
      columns: ['', 'Ensemble', 'Publiques'],
      rows: [
        gen('Nombre de CISCO', read(d, 'nbr_cisco'), read(d, 'nbr_cisco'), 'cisco'),
        gen('Nombre de ZAP', read(d, 'nbr_zap'), read(d, 'nbr_zap'), 'zap'),
        gen('Nombre d’écoles fonctionnelles', null, read(d, 'nbr_etab'), 'etab'),
        gen('Nombre d’écoles fermées', null, read(d, 'nbr_etab_ferme'), 'etab_ferme'),
      ],
    },
    {
      columns: ['', 'Ensemble', 'Publiques'],
      rows: [
        gen('Nombre d’enseignants en classe', null, read(d, 'pers_en_classe'), 'ens_classe'),
        gen('Fonctionnaires / Personnel de l’État', null, read(d, 'fonctionnaire'), 'fonctionnaire', { naEnsemble: true }),
        gen('FRAM subventionnés', null, read(d, 'sub'), 'fram_sub', { naEnsemble: true }),
        gen('FRAM non subventionnés', null, read(d, 'non_sub'), 'fram_non_sub', { naEnsemble: true }),
        gen('Enseignants non en classe', null, nonClasse, 'non_classe'),
      ],
    },
    {
      columns: ['', 'Ensemble', 'Publiques'],
      rows: [
        gen('Nombre de sections', null, read(d, 'nbr_section'), 'sections'),
        gen('Effectif des élèves', allPupils(d), read(d, 'nbr_eleve'), 'effectif'),
        gen('Dont filles', null, read(d, 'nbr_eleve_f'), 'filles'),
        gen('Nombre d’enfants réinsérés', null, read(d, 'enfants_reinseres'), 'reinseres'),
        gen('Nombre de salles définitives', null, read(d, 'nbr_sdc'), 'salles'),
        gen('Nombre de places assises', null, read(d, 'places_assises'), 'places'),
      ],
    },
  ];

  /* ---- Couverture ---- */
  const coverageValues = (e: any) => {
    const base = drenCoverage(e);
    const p = pop(e);
    const t1 = read(e, 'eff_t1'), red1 = read(e, 'red_t1');
    const entrants = t1 === null || red1 === null ? null : t1 - red1;
    return [
      base[0].value,
      base[1].value,
      base[2].value,
      base[3].value,
      drenDivide(entrants, p.pop_6ans),
      base[4].value,
    ];
  };
  const coverageLabels = [
    ['Taux d’accès générationnel', 'tag'],
    ['TBS (%)', 'tbs'],
    ['TNS (%)', 'tns'],
    ['TNA (%)', 'tna'],
    ['TBA (%)', 'tba'],
    ['Taux d’achèvement', 'achevement'],
  ] as const;
  const cd = coverageValues(d), cm = coverageValues(m);
  const capped = new Set(['tag', 'tns', 'tna', 'achevement']);
  const coverage: ReportTable = {
    columns: ['Couverture', 'Votre DREN', 'MADA'],
    rows: coverageLabels.map(([label, code], i) => {
      const meta = mk(code, label, { sense: 'higher', max: capped.has(code) ? 100 : undefined });
      const dv = round(cd[i], 1), mv = round(cm[i], 1);
      return {
        label,
        meta,
        cells: [toCell(dv, mv, meta), toCell(mv, null, meta)],
      };
    }),
  };

  /* ---- Profil de rétention ---- */
  const profile = grades.map((label, i) => ({
    label,
    dren: i === 0 ? 100 : drenRetention(d, i + 1),
    mada: i === 0 ? 100 : drenRetention(m, i + 1),
  }));

  /* ---- CEPE ---- */
  const cepeMeta = (code: string, label: string, unit: '%' | '' = '%') =>
    makeMeta(code, label, {
      section: 'resultats',
      unit,
      digits: unit === '' ? 1 : 1,
      sense: code.includes('admis') ? 'higher' : 'higher',
      max: unit === '%' ? 100 : undefined,
      formula: unit === '%' ? 'Candidats ayant au moins 10/20 ÷ candidats × 100' : 'Σ (note × coefficient) ÷ (coefficient × nombre de candidats)',
      dataNeeded: 'Notes par matière et par candidat.',
      source: 'DTIC / CEPE',
    });
  const cepeSubject = (label: string, key: string): ReportRow => {
    const make = (e: any) => {
      const sm = key === 'autres' ? null : read(e, `sm_${key}`);
      const threshold = drenExamThresholdSafe(e, `${key}_sup10`);
      return { sm, threshold };
    };
    const dd = make(d), mm = make(m);
    const metaSm = cepeMeta(`cepe_sm_${key}`, `Score moyen — ${label}`, '');
    const metaPct = cepeMeta(`cepe_pct_${key}`, `% ≥ 10 — ${label}`);
    const smCell = (value: number | null, meta: IndicatorMeta) =>
      toCell(value, null, meta, value !== null && value < 10 ? { status: 'attention' } : {});
    return {
      label,
      cells: [
        smCell(dd.sm, metaSm),
        toCell(dd.threshold, mm.threshold, metaPct),
        toCell(null, null, metaSm),
        toCell(null, null, metaPct),
        toCell(dd.sm, null, metaSm),
        toCell(dd.threshold, null, metaPct),
        smCell(mm.sm, metaSm),
        toCell(mm.threshold, null, metaPct),
      ],
    };
  };
  const cepeAdmission = (e: any, meta: IndicatorMeta): number | null => drenAdmission(e);
  const examGroups = [
    { label: '', span: 1 },
    { label: 'Public', span: 2 },
    { label: 'Privé', span: 2 },
    { label: 'Ensemble', span: 2 },
    { label: 'MADA', span: 2 },
  ];
  const examSubColumns = ['Matières', 'SM', '%≥10', 'SM', '%≥10', 'SM', '%≥10', 'SM', '%≥10'];
  const cepeRows = [
    cepeSubject('Malagasy', 'mlg'),
    cepeSubject('Français', 'frs'),
    cepeSubject('Mathématiques', 'mths'),
    cepeSubject('Autres matières', 'autres'),
    {
      label: 'Ensemble',
      cells: [
        toCell(read(d, 'sm_total'), null, cepeMeta('cepe_sm_total', 'Score moyen — Ensemble', '')),
        toCell(null, null, cepeMeta('cepe_pct_total', '% ≥ 10 — Ensemble')),
        toCell(null, null, cepeMeta('cepe_sm_priv', 'Score moyen — Privé', '')),
        toCell(null, null, cepeMeta('cepe_pct_priv', '% ≥ 10 — Privé')),
        toCell(read(d, 'sm_total'), null, cepeMeta('cepe_sm_total_ens', 'Score moyen — Ensemble', '')),
        toCell(null, null, cepeMeta('cepe_pct_total_ens', '% ≥ 10 — Ensemble')),
        toCell(read(m, 'sm_total'), null, cepeMeta('cepe_sm_total_mada', 'Score moyen — MADA', '')),
        toCell(null, null, cepeMeta('cepe_pct_total_mada', '% ≥ 10 — MADA')),
      ],
    },
  ];
  const admisMeta = META.admis;
  const admissionRow = (label: string, fn: (e: any) => number | null): ReportRow => {
    const dv = fn(d), mv = fn(m);
    return {
      label,
      cells: [
        toCell(dv, mv, admisMeta, { span: 2 }),
        toCell(null, null, admisMeta, { span: 2 }),
        toCell(dv, mv, admisMeta, { span: 2 }),
        toCell(mv, null, admisMeta, { span: 2 }),
      ],
    };
  };
  const cepe: ExamBlock = {
    title: 'RÉSULTAT AU CEPE',
    groups: examGroups,
    subColumns: examSubColumns,
    subjectRows: cepeRows,
    admissionTitle: 'Pourcentage des admis au CEPE',
    admissionRows: [
      admissionRow('Ensemble', (e) => cepeAdmission(e, admisMeta)),
      admissionRow('dont Garçons', (e) => drenAdmission(e, '_g')),
      admissionRow('dont Filles', (e) => drenAdmission(e, '_f')),
    ],
    note: 'SM : Score Moyen sur 20. Les colonnes Privé et Ensemble ne sont pas collectées par la source primaire actuelle.',
  };

  /* ---- UEAS ---- */
  const ueas = (title: string, subjects: string[]): ExamBlock => ({
    title,
    groups: [
      { label: '', span: 1 },
      { label: 'Public', span: 3 },
      { label: 'Privé', span: 3 },
      { label: 'Ensemble', span: 3 },
      { label: 'MADA', span: 3 },
    ],
    subColumns: ['Matières', 'SM', 'std', '%≥50', 'SM', 'std', '%≥50', 'SM', 'std', '%≥50', 'SM', 'std', '%≥50'],
    subjectRows: subjects.map((label) => ({
      label,
      cells: Array.from({ length: 12 }, () =>
        toCell(null, null, makeMeta('ueas', `Évaluation UEAS — ${label}`, {
          formula: '% d’élèves ayant ≥ 50/100 ÷ élèves testés × 100',
          dataNeeded: 'Résultats individuels de l’évaluation nationale.',
          source: 'UEAS',
        })),
      ),
    })),
    admissionRows: [],
    note: 'SM : score moyen sur 100 · std : écart-type · % ≥50 : élèves ayant atteint le seuil de compétence (lecture CP2 : 30 mots/minute).',
  });

  /* ---- Flux ---- */
  const flowTable = (kind: 'red' | 'promo' | 'aband'): ReportTable => {
    const meta = kind === 'red' ? META.redoublement : kind === 'promo' ? META.promotion : META.abandon;
    const rate = (e: any, grade?: number, gender?: 'g' | 'f') =>
      kind === 'red'
        ? drenRepeat(e, grade, gender ? `_${gender}` : '')
        : grade
          ? kind === 'promo'
            ? drenPromotion(e, grade)
            : drenAbandon(e, grade)
          : gender
            ? read(e, `${kind}_${gender}`)
            : drenCycleRate(e, kind === 'promo' ? 'promotion' : 'abandon');
    const rows: ReportRow[] = grades.map((label, i) => {
      if (kind !== 'red' && i === g - 1) {
        return { label, cells: [1, 2, 3, 4].map(() => toCell(null, null, meta, { na: true })) };
      }
      const drenLevel = kind === 'red' ? label : `${label} → ${grades[i + 1]}`;
      const dv = rate(d, i + 1), mv = rate(m, i + 1);
      return {
        label: drenLevel,
        meta,
        cells: [
          toCell(dv, mv, meta),
          toCell(null, null, meta),
          toCell(null, null, meta),
          toCell(mv, null, meta),
        ],
      };
    });
    const dv = rate(d), mv = rate(m);
    const dg = rate(d, undefined, 'g'), df = rate(d, undefined, 'f');
    const side = disparite(df, dg, kind === 'promo');
    rows.push({
      label: 'Ensemble',
      bold: true,
      meta,
      cells: [toCell(dv, mv, meta), toCell(null, null, meta), toCell(null, null, meta), toCell(mv, null, meta)],
    });
    rows.push({
      label: 'Garçons',
      indent: true,
      meta,
      cells: [toCell(dg, null, meta), toCell(null, null, meta), toCell(null, null, meta), toCell(null, null, meta)],
    });
    rows.push({
      label: 'Filles',
      indent: true,
      meta,
      cells: [toCell(df, null, meta), toCell(null, null, meta), toCell(null, null, meta), toCell(null, null, meta)],
    });
    rows.push({
      label: 'Disparité au dépens des',
      meta,
      cells: [
        toCell(null, null, meta, { icon: side === 'F' ? 'f' : side === 'G' ? 'g' : null }),
        toCell(null, null, meta, { icon: null }),
        toCell(null, null, meta, { icon: null }),
        toCell(null, null, meta, { icon: null }),
      ],
    });
    return {
      title: kind === 'red' ? 'Pourcentage de redoublants (en %)' : kind === 'promo' ? 'Taux de Promotion (%)' : 'Taux d’abandon (%)',
      columns: ['Niveau', 'Public', 'Privé', 'Ensemble', 'MADA'],
      rows,
    };
  };

  /* ---- Ressources ---- */
  const humanMeta = (code: string, label: string) => mk(code, label, { section: 'ressources' });
  const humanRows: ReportRow[] = [
    {
      label: 'Pourcentage des enseignants qualifiés',
      meta: humanMeta('qualifies', 'Pourcentage des enseignants qualifiés'),
      cells: [
        toCell(null, null, humanMeta('qualifies', 'Pourcentage des enseignants qualifiés')),
        toCell(qualified(d), qualified(m), humanMeta('qualifies', 'Pourcentage des enseignants qualifiés')),
        toCell(qualified(m), null, humanMeta('qualifies', 'Pourcentage des enseignants qualifiés')),
      ],
    },
    {
      label: 'Ratio élève-maître',
      meta: humanMeta('eleves_enseignant', 'Ratio élève-maître'),
      cells: [
        toCell(null, null, humanMeta('eleves_enseignant', 'Ratio élève-maître')),
        toCell(ratio(read(d, 'nbr_eleve'), read(d, 'pers_en_classe')), ratio(read(m, 'nbr_eleve'), read(m, 'pers_en_classe')), humanMeta('eleves_enseignant', 'Ratio élève-maître')),
        toCell(ratio(read(m, 'nbr_eleve'), read(m, 'pers_en_classe')), null, humanMeta('eleves_enseignant', 'Ratio élève-maître')),
      ],
    },
    {
      label: 'Élèves par personnel administratif',
      meta: humanMeta('eleves_admin', 'Élèves par personnel administratif'),
      cells: [1, 2, 3].map(() => toCell(null, null, humanMeta('eleves_admin', 'Élèves par personnel administratif'), { na: true })),
    },
    {
      label: 'Enseignants mal répartis',
      meta: META.enseignants_mal_repartis,
      cells: [null, read(d, 'taux_aleas_enseignants'), read(m, 'taux_aleas_enseignants')].map((v, i) =>
        toCell(v, null, META.enseignants_mal_repartis, { na: i === 0 }),
      ),
    },
  ];
  const human: ReportTable = {
    columns: ['Ressources humaines', 'Ensemble', 'Publique', 'MADA publique'],
    rows: humanRows,
  };

  const financeRows: ReportRow[] = [
    ['Montant caisse école par élève (Ar)', 'total_fce'],
    ['Montant subventions par élève (bailleurs) (Ar)', 'subventions'],
    ['Montant cotisation FRAM par élève (Ar)', 'cotisations_fram'],
    ['Autres ressources par élève (Ar)', 'autres_ressources'],
  ].map(([label, key]) => {
    const meta = { ...META.depense_eleve, code: `finance_${key}`, label };
    const dv = ratio(read(d, key), read(d, 'nbr_eleve'));
    const mv = ratio(read(m, key), read(m, 'nbr_eleve'));
    return {
      label,
      meta,
      cells: [toCell(dv, mv, meta), toCell(mv, null, meta)],
    };
  });
  const totalMeta = { ...META.depense_eleve, code: 'finance_total', label: 'Total (Ar)' };
  const sumKnown = (values: (number | null)[]) => {
    const known = values.filter((v): v is number => v !== null);
    return known.length ? known.reduce((a, b) => a + b, 0) : null;
  };
  financeRows.push({
    label: 'Total (Ar)',
    bold: true,
    meta: totalMeta,
    cells: [
      toCell(sumKnown(financeRows.map((r) => r.cells[0].value)), null, totalMeta),
      toCell(sumKnown(financeRows.map((r) => r.cells[1].value)), null, totalMeta),
    ],
  });
  const finance: ReportTable = { columns: ['Ressources financières (public)', 'Votre DREN', 'MADA'], rows: financeRows };

  const otherMeta = (code: string, label: string) => mk(code, label, { section: 'ressources' });
  const otherRows: ReportRow[] = [];
  const pushOther = (label: string, code: string, dv: number | null, mv: number | null, options: Partial<IndicatorMeta> = {}) => {
    const meta = otherMeta(code, label);
    Object.assign(meta, Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined)));
    otherRows.push({
      label,
      meta,
      cells: [
        toCell(null, null, meta, { na: true }),
        toCell(dv, mv, meta),
        toCell(mv, null, meta),
      ],
    });
  };
  const eppCap = (e: any) => drenDivide(res(e, 'etab_avec_cap'), read(e, 'nbr_etab'));
  const eppContinues = (e: any) => importedPct(e, 'ecole_continue') ?? drenDivide(res(e, 'ecole_continue'), read(e, 'nbr_etab'));
  const within2km = (e: any) => importedPct(e, 'eleve_2km') ?? drenDivide(res(e, 'eleve_2km'), read(e, 'nbr_eleve'));
  const electricity = (e: any) => importedPct(e, 'electricite') ?? drenDivide(res(e, 'etab_elec'), read(e, 'nbr_etab'));
  const water = (e: any) => importedPct(e, 'point_eau') ?? drenDivide(res(e, 'etab_eau'), read(e, 'nbr_etab'));
  pushOther('Pourcentage d’EPP ayant de CAP (préscolaire)', 'epp_cap', eppCap(d), eppCap(m), { sense: 'higher', max: 100 });
  pushOther('Pourcentage d’EPP continues', 'epp_continues', eppContinues(d), eppContinues(m), { sense: 'higher', max: 100 });
  pushOther('Pourcentage de fokontany ayant au moins une EPP', 'fokontany_epp', null, null, { sense: 'higher', max: 100 });
  pushOther('Rapport classes pédagogiques par salle définitive', 'section_salle', ratio(read(d, 'nbr_section'), read(d, 'nbr_sdc')), ratio(read(m, 'nbr_section'), read(m, 'nbr_sdc')), { sense: 'lower', unit: '', digits: 1 });
  pushOther('Nombre d’élèves par place assise', 'eleves_place', ratio(read(d, 'nbr_eleve'), read(d, 'places_assises')), ratio(read(m, 'nbr_eleve'), read(m, 'places_assises')), { sense: 'lower', unit: '', digits: 1 });
  pushOther('Nombre d’élèves par latrine', 'eleves_latrine', ratio(read(d, 'nbr_eleve'), read(d, 'latrines'), 1), ratio(read(m, 'nbr_eleve'), read(m, 'latrines'), 1), { sense: 'lower', unit: '', digits: 0 });
  pushOther('Nombre de filles par latrine pour filles', 'filles_latrine', ratio(read(d, 'nbr_eleve_f'), read(d, 'latrines_fille')), ratio(read(m, 'nbr_eleve_f'), read(m, 'latrines_fille')), { sense: 'lower', unit: '', digits: 0 });
  pushOther('Pourcentage d’établissements avec latrine pour filles', 'latrine_filles', drenDivide(read(d, 'etab_latrine_f'), read(d, 'nbr_etab')), drenDivide(read(m, 'etab_latrine_f'), read(m, 'nbr_etab')));
  pushOther('Pourcentage d’élèves vivant à moins de 2 km', 'moins_2km', within2km(d), within2km(m));
  pushOther('Pourcentage d’établissements avec électricité', 'electricite', electricity(d), electricity(m));
  pushOther('Pourcentage d’établissements avec cantine scolaire', 'cantine', null, null);
  pushOther('Pourcentage d’établissements avec point d’eau', 'eau', water(d), water(m));
  pushOther('Pourcentage d’établissements accueillant des élèves en situation de handicap', 'handicap', null, null);
  const other: ReportTable = { columns: ['Autres ressources', 'Ensemble', 'Publique', 'MADA'], rows: otherRows };

  /* ---- Manuels ---- */
  const manualMeta = META.manuel_eleve;
  const manuals: ReportTable = {
    columns: ['Matière', 'Votre DREN', 'MADA'],
    note: 'Répartition par niveau (T1-T2 / T3 / T4-T5) non disponible dans la source actuelle.',
    rows: ['Malagasy', 'Calcul', 'Français', 'Autres matières'].map((label, i) => {
      const key = ['malagasy', 'maths', 'francais', 'autres'][i];
      return {
        label,
        meta: manualMeta,
        cells: [
          toCell(ratio(read(d, 'nbr_eleve'), read(d, key as any)), null, manualMeta),
          toCell(ratio(read(m, 'nbr_eleve'), read(m, key as any)), null, manualMeta),
        ],
      };
    }),
  };

  /* ---- Goulots ---- */
  const p = pop(d);
  const sortedProfile = profile;
  const bottleneckValues: [string, string, number | null][] = [
    ['Pourcentage de fokontany ayant au moins une école', 'fokontany_ecole', null],
    ['Nombre de salles de classes définitives pour 1 000 enfants', 'salles_1000', drenDivide(read(d, 'nbr_sdc'), p.pop_6_10, 1000)],
    ['Pourcentage d’élèves vivant à moins de 2 km', 'moins_2km', within2km(d)],
    ['Taux d’accès générationnel', 'tag', cd[0]],
    ['Taux de rétention', 'retention', sortedProfile[g - 1]?.dren ?? null],
    ['Nombre d’enseignants pour 1 000 enfants d’âge scolaire', 'enseignants_1000', drenDivide(read(d, 'pers_en_classe'), p.pop_6_10, 1000)],
    ['Nombre de places assises par enfant d’âge scolaire', 'places_enfant', drenDivide(read(d, 'places_assises'), p.pop_6_10, 1)],
    ['Pourcentage d’EPP continues', 'ecole_continue', eppContinues(d)],
    ['Pourcentage d’enseignants qualifiés', 'qualifies', qualified(d)],
    ['Ratio groupe pédagogique par enseignant', 'groupe_enseignant', ratio(read(d, 'nbr_section'), read(d, 'pers_en_classe'))],
    ['Nombre de manuels par élève T1-T2', 'manuel_eleve', null],
    ['Nombre de manuels par élève T3', 'manuel_eleve', null],
    ['Nombre de manuels par élève T4-T5', 'manuel_eleve', null],
  ];

  /* ---- Efficience ---- */
  const efficiency = buildEfficiency(
    raw,
    'primaire',
    d,
    sortedProfile[g - 1]?.dren ?? null,
    drenAdmission(d),
    m,
    sortedProfile[g - 1]?.mada ?? null,
    drenAdmission(m),
  );

  return {
    level: 'primaire',
    title: TITLES.primaire,
    anneeLabel: `${raw.annee - 1} - ${raw.annee}`,
    drenName: raw.names?.DREN || '',
    drenCode: raw.code_dren ? String(raw.code_dren) : '',
    general,
    coverage,
    profile,
    profileTitle: 'Profil de Rétention',
    exams: [cepe],
    ueas: [ueas('Évaluation Nationale des acquis scolaires T2 (UEAS)', ['Lecture', 'Mathématique']), ueas('Évaluation Nationale des acquis scolaires T5 (UEAS)', ['Malagasy', 'Mathématique', 'Français'])],
    flows: [flowTable('red'), flowTable('promo'), flowTable('aband')],
    human,
    finance,
    other,
    manuals,
    bottlenecks: bottleneckValues.map(([label, code, value]) => ({
      label,
      value: value === null ? null : Math.max(0, Math.min(100, value)),
      raw: value,
      meta: code === 'manuel_eleve' ? { ...META.manuel_eleve, label } : mk(code, label, { section: 'goulots' }),
    })),
    efficiency,
    notes: [
      'Les colonnes Privé et Ensemble ne sont pas fournies par l’actuelle action primaire ; elles restent signalées en bleu.',
      'Le taux d’accès générationnel n’est affiché que s’il est fourni par un import (projection de cohorte) ; il n’est pas déductible des seules données annuelles.',
      'Le TNA retire les redoublants de CP1 âgés de 6 ans : il mesure donc les seuls nouveaux entrants de 6 ans.',
    ],
  };
}

function generalMeta(code: string, label: string): IndicatorMeta {
  return META[code] ?? makeMeta(code, label, { section: 'generales', unit: '', digits: 0, sense: 'higher' });
}

function drenExamThresholdSafe(entity: any, key: string): number | null {
  return drenExamThreshold(entity, key);
}

/* ------------------------------------------------------------------ */
/* Préscolaire / collège / lycée                                       */
/* ------------------------------------------------------------------ */

function buildNiveau(raw: any, level: Exclude<ReportLevel, 'primaire'>): DrenReportModel {
  const grades = GRADES[level];
  const g = grades.length;
  const d = raw.dren || {};
  const m = raw.mada || {};
  const popD = raw.pop_dren || {};
  const popM = raw.pop_mada || {};
  const source: any = { ...raw };
  const v = (key: string, s: Secteur, entity: any = d) => val(entity, key, s);
  const eff = (s: Secteur, entity: any = d, grade?: number) => effectif(entity, s, g, undefined, grade);
  const effF = (s: Secteur, entity: any = d, grade?: number) => effectif(entity, s, g, 'f', grade);
  const entrants = (entity: any, k: number) => {
    const e = effectif(entity, 'ens', g, undefined, k);
    const r = redoublants(entity, 'ens', g, undefined, k);
    return e === null || r === null ? null : e - r;
  };
  const qualified = (s: Secteur, entity: any = d) => {
    const q = v('qualifies', s, entity);
    const teachers = v('ens_classe', s, entity);
    return q === null || teachers === null || teachers <= 0 ? null : (q / teachers) * 100;
  };
  const mkMeta = (code: string, label: string, options: Partial<IndicatorMeta> = {}) =>
    META[code] ? { ...META[code], label, ...Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined)) } : makeMeta(code, label, options);

  const etabLabel = level === 'presco' ? 'centres préscolaires (CAP)' : level === 'college' ? 'collèges' : 'lycées';
  const cols = level === 'college' ? ['', 'Ensemble', 'Dont Public'] : ['', 'Ensemble', 'Publiques'];

  const generalRow = (
    label: string,
    code: string,
    values: (s: Secteur) => number | null,
    options: { na?: number[] } = {},
  ): ReportRow => {
    const meta = generalMeta(code, label);
    return {
      label,
      meta,
      cells: [
        toCell(values('ens'), null, meta, { na: options.na?.includes(0) }),
        toCell(values('0'), null, meta, { na: options.na?.includes(1) }),
      ],
    };
  };
  const count = (label: string, key: string, ensemble = false): ReportRow =>
    generalRow(label, key, (s) => v(key, s), ensemble ? {} : { na: [0] });
  const nonClasse = (s: Secteur) => {
    const total = v('ens', s), inClass = v('ens_classe', s);
    return total === null || inClass === null ? null : total - inClass;
  };
  const general: ReportTable[] = [];
  if (level === 'college') {
    general.push({
      columns: cols,
      rows: [
        count('Nombre de collèges fonctionnels', 'etab', true),
        count('Nombre de collèges fermés', 'etab_ferme', true),
        count('Nombre de salles', 'salles', true),
        count('Nombre de sections', 'sections', true),
        count('Nombre de places assises', 'places', true),
        generalRow('Effectif des élèves', 'effectif', (s) => eff(s)),
        generalRow('Dont filles', 'filles', (s) => effF(s)),
        generalRow('Pourcentage des élèves réinsérés (CRAN)', 'reinseres', (s) => div(v('reinseres', s), eff(s), 100), { na: [0] }),
        generalRow('Dont filles mères', 'filles_meres', (s) => v('filles_meres', s), { na: [0] }),
      ],
    });
    general.push({
      columns: cols,
      rows: [
        { label: 'Nombre de CISCO', meta: generalMeta('cisco', 'Nombre de CISCO'), cells: [toCell(raw.nb_cisco, null, generalMeta('cisco', 'Nombre de CISCO')), toCell(raw.nb_cisco, null, generalMeta('cisco', 'Nombre de CISCO'))] },
        { label: 'Nombre de ZAP', meta: generalMeta('zap', 'Nombre de ZAP'), cells: [toCell(raw.nb_zap, null, generalMeta('zap', 'Nombre de ZAP')), toCell(raw.nb_zap, null, generalMeta('zap', 'Nombre de ZAP'))] },
        count('Nombre d’enseignants en classe', 'ens_classe', true),
        count('dont Fonctionnaires / Personnel de l’État', 'fonct', true),
        count('dont FRAM subventionnés', 'fram_sub', true),
        count('dont FRAM non subventionnés', 'fram_non_sub', true),
        generalRow('Enseignants non en classe', 'non_classe', nonClasse),
      ],
    });
    general.push({
      columns: cols,
      rows: [
        count('Nombre d’enseignants littéraires', 'litteraire', true),
        count('Nombre d’enseignants scientifiques', 'scientifique', true),
        count('Nombre d’enseignants EPS', 'eps', true),
        generalRow('Nombre d’enseignants non en classe', 'non_classe', nonClasse),
      ],
    });
  } else if (level === 'lycee') {
    general.push({
      columns: cols,
      rows: [
        count('Nombre de lycées fonctionnels', 'etab', true),
        count('Nombre de lycées fermés', 'etab_ferme', true),
        count('Nombre de salles', 'salles', true),
        count('Nombre de sections', 'sections', true),
        count('Nombre de places assises', 'places', true),
        generalRow('Effectif des élèves', 'effectif', (s) => eff(s)),
        generalRow('Dont filles', 'filles', (s) => effF(s)),
      ],
    });
    general.push({
      columns: cols,
      rows: [
        { label: 'Nombre de CISCO', meta: generalMeta('cisco', 'Nombre de CISCO'), cells: [toCell(raw.nb_cisco, null, generalMeta('cisco', 'Nombre de CISCO')), toCell(raw.nb_cisco, null, generalMeta('cisco', 'Nombre de CISCO'))] },
        { label: 'Nombre de ZAP', meta: generalMeta('zap', 'Nombre de ZAP'), cells: [toCell(raw.nb_zap, null, generalMeta('zap', 'Nombre de ZAP')), toCell(raw.nb_zap, null, generalMeta('zap', 'Nombre de ZAP'))] },
        count('Nombre d’enseignants littéraires', 'litteraire', true),
        count('Nombre d’enseignants scientifiques', 'scientifique', true),
        count('Nombre d’enseignants SES', 'ses', true),
        count('Nombre d’enseignants EPS', 'eps', true),
      ],
    });
    general.push({
      columns: cols,
      rows: [
        count('Nombre d’enseignants en classe', 'ens_classe', true),
        count('Fonctionnaires / Personnel de l’État', 'fonct', true),
        count('FRAM subventionnés', 'fram_sub', true),
        count('FRAM non subventionnés', 'fram_non_sub', true),
        generalRow('Nombre d’enseignants non en classe', 'non_classe', nonClasse),
      ],
    });
  } else {
    general.push({
      columns: cols,
      rows: [
        { label: 'Nombre de CISCO', meta: generalMeta('cisco', 'Nombre de CISCO'), cells: [toCell(raw.nb_cisco, null, generalMeta('cisco', 'Nombre de CISCO')), toCell(raw.nb_cisco, null, generalMeta('cisco', 'Nombre de CISCO'))] },
        { label: 'Nombre de ZAP', meta: generalMeta('zap', 'Nombre de ZAP'), cells: [toCell(raw.nb_zap, null, generalMeta('zap', 'Nombre de ZAP')), toCell(raw.nb_zap, null, generalMeta('zap', 'Nombre de ZAP'))] },
        count(`Nombre de ${etabLabel} fonctionnels`, 'etab', true),
        count('Nombre de centres fermés', 'etab_ferme', true),
        count('Nombre de sections', 'sections', true),
        generalRow('Effectif des enfants', 'effectif', (s) => eff(s)),
        generalRow('Dont filles', 'filles', (s) => effF(s)),
        count('Nombre de salles', 'salles', true),
        count('Nombre de places assises', 'places', true),
      ],
    });
    general.push({
      columns: cols,
      rows: [
        count('Éducateurs en classe', 'ens_classe', true),
        { ...count('dont Fonctionnaires', 'fonct'), cells: [toCell(null, null, generalMeta('fonct', 'dont Fonctionnaires'), { na: true }), toCell(v('fonct', '0'), null, generalMeta('fonct', 'dont Fonctionnaires'))] },
        { ...count('dont FRAM subventionnés', 'fram_sub'), cells: [toCell(null, null, generalMeta('fram_sub', 'dont FRAM subventionnés'), { na: true }), toCell(v('fram_sub', '0'), null, generalMeta('fram_sub', 'dont FRAM subventionnés'))] },
        { ...count('dont FRAM non subventionnés', 'fram_non_sub'), cells: [toCell(null, null, generalMeta('fram_non_sub', 'dont FRAM non subventionnés'), { na: true }), toCell(v('fram_non_sub', '0'), null, generalMeta('fram_non_sub', 'dont FRAM non subventionnés'))] },
        generalRow('Éducateurs non en classe', 'non_classe', nonClasse),
      ],
    });
  }

  /* ---- Couverture ---- */
  const coverageData = (entity: any, pop: any, next: any): (number | null)[] => {
    if (level === 'presco') {
      const five = effectif(entity, 'ens', g, undefined, 3);
      const fiveF = effectif(entity, 'ens', g, 'f', 3);
      const fiveG = effectif(entity, 'ens', g, 'g', 3);
      const pop34 = [num(pop?.p0), num(pop?.p1)];
      const pop345 = [num(pop?.p0), num(pop?.p1), num(pop?.p2)];
      const total34 = pop34.some((p) => p === null) ? null : pop34.reduce<number>((a, b) => a + (b ?? 0), 0);
      const total345 = pop345.some((p) => p === null) ? null : pop345.reduce<number>((a, b) => a + (b ?? 0), 0);
      const effectif34F = effectifNiveaux(entity, 'ens', [1, 2], 'f');
      const effectif34G = effectifNiveaux(entity, 'ens', [1, 2], 'g');
      // Abandon = effectif de début d'année − effectif de fin d'année (formule du cahier des charges).
      const currentTotal = effectif(entity, 'ens', g);
      const nextTotal = next ? effectif(next, 'ens', g) : null;
      return [
        div(five, pop.p2),
        parite(fiveF, fiveG),
        div(effectifNiveaux(entity, '0', [1, 2]), total34),
        parite(effectif34F, effectif34G),
        div(effectif(entity, '1', g), total345),
        null,
        div(currentTotal === null || nextTotal === null ? null : currentTotal - nextTotal, currentTotal),
        null,
      ];
    }
    // Population cumulée des âges officiels du cycle (dénominateur du TNS).
    const ages = Array.from({ length: g }, (_, i) => num(pop?.[`p${i}`]));
    const popAge = ages.some((p) => p === null) ? null : ages.reduce<number>((a, b) => a + (b ?? 0), 0);
    return [
      tauxTransition(entity, 'ens', g, next),
      div(entrants(entity, 1), pop.p0),
      div(effectif(entity, 'ens', g, undefined), pop[`p${g}`]),
      tauxNetScolarisation(entity, 'ens', popAge),
      div(entrants(entity, g), pop[`p${g - 1}`]),
    ];
  };
  const labels: [string, string][] = level === 'presco'
    ? [
        ['Taux de préscolarisation des enfants de 5 ans', 'presco5'],
        ['Parité filles / garçons à 5 ans', 'parite5'],
        ['Taux de préscolarisation de 3 à 4 ans (public)', 'presco34'],
        ['Parité filles / garçons de 3 à 4 ans', 'parite34'],
        ['Taux de préscolarisation privé (3 à 5 ans)', 'presco_prive'],
        ['Indice de parité intra-DREN', 'parite_intra'],
        ['Pourcentage d’abandon', 'abandon'],
        ['Indice de développement des enfants de 5 ans', 'indice_dev'],
      ]
    : [
        [`Taux de transition ${level === 'college' ? 'primaire vers collège' : 'collège vers lycée'}`, 'taux_transition'],
        [`TBA en ${grades[0]}`, 'tba'],
        ['TBS (%)', 'tbs'],
        ['TNS (%)', 'tns'],
        ['Taux d’achèvement', 'achevement'],
      ];
  const dv = coverageData(d, popD, raw.dren_next), mv = coverageData(m, popM, raw.mada_next);
  const coverage: ReportTable = {
    columns: ['Couverture', 'Votre DREN', 'MADA'],
    rows: labels.map(([label, code], i) => {
      const isRatio = level === 'presco' && ['parite5', 'parite34', 'parite_intra', 'indice_dev'].includes(code);
      const base = mkMeta(code, label, { sense: code === 'abandon' ? 'lower' : 'higher' });
      const meta: IndicatorMeta = isRatio
        ? { ...base, unit: '', digits: 2, max: undefined }
        : level === 'presco' ? { ...base, max: 100 } : base;
      const digits = isRatio ? 2 : 1;
      return {
        label,
        meta,
        cells: [
          toCell(round(dv[i], digits), round(mv[i], digits), meta),
          toCell(round(mv[i], digits), null, meta),
        ],
      };
    }),
  };

  /* ---- Profil derétention ---- */
  // Profil de rétention calculé uniquement pour le primaire (pseudo-longitudinal).
  // Pour collège et lycée, on garde une valeur par défaut (100 au premier niveau).
  const profile = level === 'presco' ? [] : level === 'college' || level === 'lycee'
    ? grades.map((label, i) => ({ label, dren: i === 0 ? 100 : null, mada: i === 0 ? 100 : null }))
    : grades.map((label, i) => {
    const pd = retentionProfile(d, 'ens', g, popD);
    const pm = retentionProfile(m, 'ens', g, popM);
    return { label, dren: i === 0 ? 100 : pd[i] ?? null, mada: i === 0 ? 100 : pm[i] ?? null };
  });

  /* ---- Examens ---- */
  const exams: ExamBlock[] = [];
  if (level === 'college') {
    const bd = raw.bepc_dren || {};
    const bm = raw.bepc_mada || {};
    const subj = [['Malagasy', 'mlg'], ['Français', 'frs'], ['Mathématiques', 'math'], ['SVT', 'svt'], ['Physique-Chimie', 'phys']] as [string, string][];
    const metaSm = (label: string) => makeMeta(`bepc_sm_${label}`, `Score moyen — ${label}`, { unit: '', digits: 1, formula: 'Note moyenne sur 20', source: 'DTIC / BEPC' });
    const metaPct = (label: string) => makeMeta(`bepc_pct_${label}`, `% ≥ 10 — ${label}`, { sense: 'higher', max: 100, formula: 'Candidats ≥ 10/20 ÷ candidats × 100', source: 'DTIC / BEPC' });
    const examRows: ReportRow[] = subj.map(([label, key]) => {
      const threshold = (e: any) => drenDivide(e?.[`${key}_sup10`], e?.total_candidats);
      const smCell = (value: number | null, meta: IndicatorMeta) =>
        toCell(value, null, meta, value !== null && value < 10 ? { status: 'attention' } : {});
      return {
        label,
        cells: [
          smCell(num(bd[`sm_${key}`]), metaSm(label)),
          toCell(threshold(bd), threshold(bm), metaPct(label)),
          toCell(null, null, metaSm(label)),
          toCell(null, null, metaPct(label)),
          toCell(num(bd[`sm_${key}`]), null, metaSm(label)),
          toCell(threshold(bd), null, metaPct(label)),
          smCell(num(bm[`sm_${key}`]), metaSm(label)),
          toCell(threshold(bm), null, metaPct(label)),
        ],
      };
    });
    const admission = (value: unknown, national: unknown, meta: IndicatorMeta) => toCell(num(value), num(national), meta, { span: 2 });
    const adm = META.admis;
    exams.push({
      title: 'RÉSULTAT AU BEPC',
      groups: [
        { label: '', span: 1 },
        { label: 'Public', span: 2 },
        { label: 'Privé', span: 2 },
        { label: 'Ensemble', span: 2 },
        { label: 'MADA', span: 2 },
      ],
      subColumns: ['Matières', 'SM', '%≥10', 'SM', '%≥10', 'SM', '%≥10', 'SM', '%≥10'],
      subjectRows: examRows,
      admissionTitle: 'Pourcentage des admis au BEPC',
      admissionRows: [
        { label: 'Ensemble', cells: [admission(bd.tx_admis, bm.tx_admis, adm), admission(null, null, adm), admission(bd.tx_admis, bm.tx_admis, adm), admission(bm.tx_admis, null, adm)] },
        { label: 'dont Garçons', cells: [admission(bd.tx_admis_g, bm.tx_admis_g, adm), admission(null, null, adm), admission(bd.tx_admis_g, bm.tx_admis_g, adm), admission(bm.tx_admis_g, null, adm)] },
        { label: 'dont Filles', cells: [admission(bd.tx_admis_f, bm.tx_admis_f, adm), admission(null, null, adm), admission(bd.tx_admis_f, bm.tx_admis_f, adm), admission(bm.tx_admis_f, null, adm)] },
      ],
      note: 'SM : Score Moyen sur 20 · std : écart-type.',
    });
    exams.push(emptyUeas('Évaluation des acquis scolaires 4ème année du collège', ['Malagasy', 'Français', 'Mathématique', 'Sciences (SVT, PC)']));
  } else if (level === 'lycee') {
    const series: [string, string[]][] = [
      ['C', ['Mathématiques', 'Physique']],
      ['D', ['SVT', 'Mathématiques', 'Physique']],
      ['A', ['Français', 'Malagasy', 'Philosophie', 'Histo-Géo']],
      ['Littéraire', ['Français', 'Malagasy', 'Philosophie', 'Histo-Géo']],
      ['Scientifique', ['SVT', 'Mathématiques', 'Physique']],
      ['OSE', ['Sciences économiques et sociales', 'Mathématiques']],
    ];
    for (const [serie, subjects] of series) {
      const metaSm = (label: string) => makeMeta(`bac_sm_${serie}_${label}`, `Score moyen — ${label}`, { unit: '', digits: 1, formula: 'Note moyenne sur 20', source: 'DTIC / BACC' });
      const metaPct = (label: string) => makeMeta(`bac_pct_${serie}_${label}`, `% ≥ 10 — ${label}`, { sense: 'higher', max: 100, formula: 'Candidats ≥ 10/20 ÷ candidats × 100', source: 'DTIC / BACC' });
      exams.push({
        title: `BACC SÉRIE ${serie.toUpperCase()}`,
        groups: [
          { label: '', span: 1 },
          { label: 'Public', span: 2 },
          { label: 'Privé', span: 2 },
          { label: 'Ensemble', span: 2 },
          { label: 'MADA', span: 2 },
        ],
        subColumns: ['Matières', 'SM', '%≥10', 'SM', '%≥10', 'SM', '%≥10', 'SM', '%≥10'],
        subjectRows: [
          ...subjects.map((label) => ({
            label,
            cells: [1, 2, 3, 4, 5, 6, 7, 8].map(() => toCell(null, null, metaSm(label))),
          })),
          {
            label: 'Moyenne',
            bold: true,
            cells: [
              toCell(null, null, metaSm('Moyenne'), { span: 2 }),
              toCell(null, null, metaSm('Moyenne'), { span: 2 }),
              toCell(null, null, metaSm('Moyenne'), { span: 2 }),
              toCell(null, null, metaSm('Moyenne'), { span: 2 }),
            ],
          },
        ],
        admissionTitle: 'Pourcentage des admis au BACC',
        admissionRows: [
          { label: 'Ensemble', cells: [1, 2, 3, 4].map(() => toCell(null, null, META.admis, { span: 2 })) },
          { label: 'dont Garçons', cells: [1, 2, 3, 4].map(() => toCell(null, null, META.admis, { span: 2 })) },
          { label: 'dont Filles', cells: [1, 2, 3, 4].map(() => toCell(null, null, META.admis, { span: 2 })) },
        ],
        note: 'SM : Score Moyen sur 20. Les résultats BACC par série ne sont pas encore collectés pour cette année.',
      });
    }
  }

  /* ---- Flux ---- */
  const flowTable = (kind: 'red' | 'promo' | 'aband'): ReportTable => {
    const meta = kind === 'red' ? META.redoublement : kind === 'promo' ? META.promotion : META.abandon;
    const rate = (entity: any, next: any, s: Secteur, grade?: number, gender?: 'g' | 'f') =>
      kind === 'red'
        ? tauxRedoublement(entity, s, g, grade, gender)
        : grade
          ? kind === 'promo'
            ? tauxPromotion(entity, next, s, grade, gender)
            : tauxAbandon(entity, next, s, grade, gender)
          : cycleRate(entity, next, s, g, kind === 'promo' ? 'promotion' : 'abandon', gender);
    const levels = kind === 'red' ? grades : grades.slice(0, -1);
    const rows: ReportRow[] = levels.map((label, i) => {
      const lvl = kind === 'red' ? label : `${label} → ${grades[i + 1]}`;
      const r = rate(d, raw.dren_next, '0', i + 1);
      const rp = rate(d, raw.dren_next, '1', i + 1);
      const re = rate(d, raw.dren_next, 'ens', i + 1);
      const rm = rate(m, raw.mada_next, 'ens', i + 1);
      return {
        label: lvl,
        meta,
        cells: [toCell(r, rm, meta), toCell(rp, null, meta), toCell(re, rm, meta), toCell(rm, null, meta)],
      };
    });
    if (kind !== 'red') {
      rows.push({ label: grades[g - 1], cells: [1, 2, 3, 4].map(() => toCell(null, null, meta, { na: true })) });
    }
    const ensembleLabel = level === 'lycee' ? 'Sur le cycle' : 'Ensemble';
    const rd = rate(d, raw.dren_next, 'ens'), rm = rate(m, raw.mada_next, 'ens');
    rows.push({
      label: ensembleLabel,
      bold: true,
      meta,
      cells: [toCell(rd, rm, meta), toCell(rate(d, raw.dren_next, '1'), null, meta), toCell(rd, rm, meta), toCell(rm, null, meta)],
    });
    const dg = rate(d, raw.dren_next, '0', undefined, 'g');
    const df = rate(d, raw.dren_next, '0', undefined, 'f');
    const eg = rate(d, raw.dren_next, 'ens', undefined, 'g');
    const ef = rate(d, raw.dren_next, 'ens', undefined, 'f');
    const side = disparite(ef, eg, kind === 'promo');
    rows.push({ label: 'Garçons', indent: true, meta, cells: [toCell(dg, null, meta), toCell(rate(d, raw.dren_next, '1', undefined, 'g'), null, meta), toCell(eg, null, meta), toCell(rate(m, raw.mada_next, 'ens', undefined, 'g'), null, meta)] });
    rows.push({ label: 'Filles', indent: true, meta, cells: [toCell(df, null, meta), toCell(rate(d, raw.dren_next, '1', undefined, 'f'), null, meta), toCell(ef, null, meta), toCell(rate(m, raw.mada_next, 'ens', undefined, 'f'), null, meta)] });
    rows.push({
      label: 'Disparité au dépens des',
      meta,
      cells: [
        toCell(null, null, meta, { icon: side === 'F' ? 'f' : side === 'G' ? 'g' : null }),
        toCell(null, null, meta, { icon: null }),
        toCell(null, null, meta, { icon: side === 'F' ? 'f' : side === 'G' ? 'g' : null }),
        toCell(null, null, meta, { icon: null }),
      ],
    });
    return {
      title: kind === 'red' ? 'Pourcentage de redoublants (en %)' : kind === 'promo' ? 'Taux de Promotion (%)' : 'Taux d’abandon (%)',
      columns: ['Niveau', 'Public', 'Privé', 'Ensemble', 'MADA'],
      rows,
    };
  };
  const flowsOrder: ('red' | 'promo' | 'aband')[] = level === 'lycee' ? ['promo', 'red', 'aband'] : ['red', 'promo', 'aband'];

  /* ---- Ressources humaines ---- */
  const humanRows: ReportRow[] = [];
  const pushHuman = (label: string, code: string, value: (s: Secteur, entity: any) => number | null, options: Partial<IndicatorMeta> = {}) => {
    const meta = mkMeta(code, label, { section: 'ressources', ...options });
    humanRows.push({
      label,
      meta,
      cells: [
        toCell(value('ens', d), value('ens', m), meta),
        toCell(value('0', d), value('0', m), meta),
        toCell(value('0', m), null, meta),
      ],
    });
  };
  if (level !== 'presco') {
    pushHuman('Pourcentage d’enseignants en classe (public)', 'utilisation_enseignants', (s, e) => (s === '0' ? div(v('ens_classe', s, e), v('ens', s, e), 100) : null), { sense: 'higher', max: 100 });
  }
  pushHuman(level === 'college' ? 'Enseignants ayant au moins BACC + 2' : 'Enseignants ayant au moins la licence', 'diplome_academique', (s, e) => div(v(level === 'college' ? 'ens_bacc2' : 'ens_licence', s, e), v('ens_classe', s, e), 100), { sense: 'higher', max: 100 });
  pushHuman('Enseignants ayant un diplôme pédagogique', 'qualifies', (s, e) => qualified(s, e), { sense: 'higher', max: 100 });
  pushHuman(level === 'presco' ? 'Éducateurs attestés 10 jours' : 'Volume horaire hebdomadaire reçu', level === 'presco' ? 'attestes' : 'volume_horaire', (s, e) => level === 'presco' ? v('attestes', s, e) : div(v('volume_horaire', s, e), v('ens_volume', s, e), 1), { sense: 'higher', ...(level === 'presco' ? {} : { unit: '', digits: 1 }) });
  pushHuman('Élèves par personnel administratif', 'eleves_admin', () => null, { unit: '', digits: 0 });
  pushHuman('Enseignants mal répartis', 'enseignants_mal_repartis', (s, e) => v('taux_aleas_enseignants', s, e), { sense: 'lower', max: 100 });
  const human: ReportTable = {
    columns: ['Ressources humaines', 'Ensemble', 'Publique', 'MADA publique'],
    rows: humanRows,
  };

  /* ---- Autres ressources ---- */
  const otherRows: ReportRow[] = [];
  const pushOther = (label: string, code: string, fn: (s: Secteur, entity: any) => number | null, options: Partial<IndicatorMeta> = {}) => {
    const meta = mkMeta(code, label, { section: 'ressources', ...options });
    otherRows.push({
      label,
      meta,
      cells: ['0', '1', 'ens'].map((s) => toCell(fn(s as Secteur, d), fn('ens' as Secteur, m), meta)),
    });
  };
  pushOther('Élèves par section', 'eleves_section', (s, e) => div(effectif(e, s, g), v('sections', s, e), 1), { unit: '', digits: 0 });
  pushOther('Élèves par salle', 'eleves_salle', (s, e) => div(effectif(e, s, g), v('salles', s, e), 1), { unit: '', digits: 0 });
  pushOther('Places assises par salle', 'place_salle', (s, e) => div(v('places', s, e), v('salles', s, e), 1), { unit: '', digits: 0 });
  pushOther('Rapport section par salle', 'section_salle', (s, e) => div(v('sections', s, e), v('salles', s, e), 1), { unit: '', digits: 1 });
  pushOther('Élèves par place assise', 'eleves_place', (s, e) => div(effectif(e, s, g), v('places', s, e), 1), { unit: '', digits: 1 });
  pushOther('Élèves par latrine', 'eleves_latrine', (s, e) => div(effectif(e, s, g), v('latrines', s, e), 1), { unit: '', digits: 0 });
  pushOther('Filles par latrine pour filles', 'filles_latrine', (s, e) => div(effectif(e, s, g, 'f'), v('latrines_f', s, e), 1), { unit: '', digits: 0 });
  pushOther('Établissements avec latrine pour filles', 'latrine_filles', (s, e) => div(v('etab_latrine_f', s, e), v('etab', s, e)));
  if (level === 'college') {
    pushOther('Élèves vivant à moins de 5 km', 'moins_5km', (s, e) => div(v('eleve_proche', s, e), effectif(e, s, g)));
  }
  pushOther('Établissements avec point d’eau', 'eau', (s, e) => div(v('eau', s, e), v('etab', s, e)));
  pushOther('Établissements avec électricité', 'electricite', (s, e) => div(v('elec', s, e), v('etab', s, e)));
  pushOther('Établissements accueillant des élèves en situation de handicap', 'handicap', (s, e) => div(v('handicap', s, e), v('etab', s, e)));
  // La formule du cahier des charges (volume horaire élève × sections ÷ horaire
  // maximal × salles) n'est pas alimentée : ne pas afficher sections/salles comme
  // un taux d'utilisation. Le rapport section/salle reste disponible ci-dessus.
  pushOther('Taux d’utilisation des salles', 'utilisation_salles', () => null, { sense: 'higher' });
  pushOther('Établissements avec laboratoire', 'laboratoire', (s, e) => div(v('laboratoire', s, e), v('etab', s, e)));
  pushOther('Établissements avec salle TIC', 'tic', (s, e) => div(v('tic', s, e), v('etab', s, e)));
  pushOther('Établissements avec bibliothèque', 'bibliotheque', (s, e) => div(v('bibliotheque', s, e), v('etab', s, e)));
  const other: ReportTable = {
    columns: ['Autres ressources', 'Public', 'Privé', 'Ensemble', 'MADA'],
    rows: otherRows,
  };

  /* ---- Manuels ---- */
  const manualSubjects = level === 'lycee'
    ? ['Français', 'Maths', 'Malagasy', 'PC', 'SVT', 'Philo', 'HG', 'SES']
    : level === 'college'
      ? ['Malagasy', 'Math', 'Français', 'SVT', 'PC']
      : ['Malagasy', 'Calcul', 'Français', 'Autres matières'];
  const manualMeta = META.manuel_eleve;
  const manuals: ReportTable | null = level === 'presco' ? null : level === 'lycee'
    ? {
        columns: ['Matière', 'DREN 2nde', 'DREN 1ère', 'DREN Tle', 'MADA 2nde', 'MADA 1ère', 'MADA Tle', 'Taux d’aléas'],
        rows: manualSubjects.map((label) => ({
          label,
          meta: manualMeta,
          cells: Array.from({ length: 8 }, () => toCell(null, null, manualMeta)),
        })),
      }
    : {
        columns: ['Matière', 'Votre DREN', 'MADA'],
        rows: manualSubjects.map((label) => ({
          label,
          meta: manualMeta,
          cells: [toCell(null, null, manualMeta), toCell(null, null, manualMeta)],
        })),
      };

  /* ---- Finances ---- */
  const financeLabels = level === 'presco'
    ? ['Subventions caisse école par enfant (Ar)', 'Cotisations FRAM par enfant (Ar)', 'Appuis PTF par enfant (Ar)', 'Autres ressources par enfant (Ar)']
    : level === 'college'
      ? ['Montant caisse école par élève (Ar)', 'Ressources propres par élève (Ar)', 'Cotisation FRAM par élève (Ar)', 'Autres ressources par élève (Ar)']
      : ['Caisse de soutien par élève (Ar)', 'Montant payé à la rentrée par élève (Ar)', 'Cotisation FRAM par élève (Ar)', 'Autres ressources par élève (Ar)'];
  const finance: ReportTable = {
    title: 'Ressources financières (Ar) par élève (public)',
    columns: ['Poste', 'Votre DREN', 'MADA'],
    rows: [
      ...financeLabels.map((label, i) => {
        const meta = { ...META.depense_eleve, code: `finance_${i}`, label };
        return { label, meta, cells: [toCell(null, null, meta), toCell(null, null, meta)] };
      }),
      {
        label: 'Total',
        bold: true,
        meta: { ...META.depense_eleve, code: 'finance_total', label: 'Total (Ar)' },
        cells: [toCell(null, null, META.depense_eleve), toCell(null, null, META.depense_eleve)],
      },
    ],
  };

  /* ---- Goulots ---- */
  const popOf = (entity: any, pop: any) => pop;
  const bottleneckDefs: [string, string, number | null][] = [];
  const b = (label: string, code: string, value: number | null) => bottleneckDefs.push([label, code, value]);
  if (level === 'presco') {
    b('Pourcentage d’EPP ayant des CAP', 'epp_cap', div(v('avec_primaire', '0'), v('nbr_epp', '0')));
    b('Taux d’inscription des enfants de 5 ans', 'presco5', dv[0]);
    b('Pourcentage d’éducateurs attestés', 'attestes', v('attestes', '0'));
    b('Pourcentage d’encadreurs de proximité formés', 'encadreurs', null);
    b('Centres avec matériels ludiques et didactiques', 'materiels', null);
    b('Centres avec salles d’activités', 'salles_activites', null);
  } else if (level === 'college') {
    b('Taux de transition primaire vers collège', 'taux_transition', dv[0]);
    b('Pourcentage de communes ayant au moins un collège', 'communes', null);
    b('Pourcentage des élèves vivant à moins de 5 km', 'moins_5km', div(v('eleve_proche', '0'), effectif(d, '0', g)));
    b('Nombre de salles pour 1 000 enfants scolarisables', 'salles_1000', div(v('salles', '0'), popOf(d, popD).p4, 1000));
    b('Taux de rétention', 'retention', profile[g - 1]?.dren ?? null);
    b('Ratio élèves-section', 'eleves_section', div(effectif(d, '0', g), v('sections', '0'), 1));
    ['Malagasy', 'Mathématiques', 'Français', 'SVT', 'PC'].forEach((s) => b(`Ratio élèves-manuels ${s}`, 'manuel_eleve', null));
    b('Enseignants qualifiés', 'qualifies', qualified('0'));
  } else {
    b('Taux de transition collège vers lycée', 'taux_transition', dv[0]);
    b('Taux de rétention', 'retention', profile[g - 1]?.dren ?? null);
    b('Pourcentage de districts ayant au moins un lycée', 'districts', null);
    b('Nombre de salles pour 1 000 enfants scolarisables', 'salles_1000', div(v('salles', '0'), popOf(d, popD).p3, 1000));
    b('Ratio élève-section', 'eleves_section', div(effectif(d, '0', g), v('sections', '0'), 1));
    ['Malagasy', 'Français', 'Mathématiques', 'Physique-Chimie', 'SVT'].forEach((s) => b(`Nombre d’élèves par manuel ${s}`, 'manuel_eleve', null));
    b('Pourcentage d’enseignants qualifiés', 'qualifies', qualified('0'));
    b('Pourcentage de lycées disposant de laboratoire', 'laboratoire', div(v('laboratoire', '0'), v('etab', '0')));
    b('Pourcentage de lycées disposant de bibliothèque', 'bibliotheque', div(v('bibliotheque', '0'), v('etab', '0')));
    b('Taux d’utilisation des salles', 'utilisation_salles', null);
  }

  const efficiency = level === 'presco' ? null : buildEfficiency(
    raw,
    level,
    d,
    profile[g - 1]?.dren ?? null,
    level === 'college' ? num(raw.bepc_dren?.tx_admis) : null,
    m,
    profile[g - 1]?.mada ?? null,
    level === 'college' ? num(raw.bepc_mada?.tx_admis) : null,
  );

  return {
    level,
    title: TITLES[level],
    anneeLabel: `${raw.annee - 1} - ${raw.annee}`,
    drenName: raw.names?.DREN || '',
    drenCode: raw.code_dren ? String(raw.code_dren) : '',
    general,
    coverage,
    profile,
    profileTitle: 'Profil de Rétention',
    exams,
    ueas: [],
    flows: level === 'presco' ? [] : flowsOrder.map(flowTable),
    human,
    finance,
    other,
    manuals,
    bottlenecks: bottleneckDefs.map(([label, code, value]) => ({
      label,
      value: value === null ? null : Math.max(0, Math.min(100, value)),
      raw: value,
      meta: mkMeta(code, label, { section: 'goulots' }),
    })),
    efficiency,
    notes: level === 'lycee'
      ? ['Les taux de promotion supérieurs à 100 % et les abandons négatifs traduisent des entrants hors cohorte : ils sont signalés en jaune, jamais tronqués.']
      : [],
  };
}

function emptyUeas(title: string, subjects: string[]): ExamBlock {
  return {
    title,
    groups: [
      { label: '', span: 1 },
      { label: 'Public', span: 3 },
      { label: 'Privé', span: 3 },
      { label: 'Ensemble', span: 3 },
      { label: 'MADA', span: 3 },
    ],
    subColumns: ['Matières', 'SM', 'std', '%≥50', 'SM', 'std', '%≥50', 'SM', 'std', '%≥50', 'SM', 'std', '%≥50'],
    subjectRows: subjects.map((label) => ({
      label,
      cells: Array.from({ length: 12 }, () =>
        toCell(null, null, makeMeta('ueas', `Évaluation des acquis — ${label}`, {
          formula: '% d’élèves ayant ≥ 50/100 ÷ élèves testés × 100',
          dataNeeded: 'Résultats individuels de l’évaluation nationale.',
          source: 'UEAS',
        })),
      ),
    })),
    admissionRows: [],
    note: 'SM : score moyen · std : écart-type · % ≥50 : seuil de compétence.',
  };
}

/* ------------------------------------------------------------------ */
/* Efficience                                                          */
/* ------------------------------------------------------------------ */

function buildEfficiency(
  raw: any,
  level: ReportLevel,
  dren: any,
  drenRetentionValue: number | null,
  drenAdmissionValue: number | null,
  mada: any,
  madaRetentionValue: number | null,
  madaAdmissionValue: number | null,
): EfficiencyReport | null {
  if (level === 'presco') return null;
  const cycle = CYCLE[level];
  const mergePrimary = (entity: any) => ({
    ...entity,
    data: { ...entity?.ressources, ...entity?.personnel, ...entity?.sections, ...entity?.places, ...entity?.caisse, ...entity?.manuels, ...entity?.data },
  });
  const drenEntity = level === 'primaire' ? mergePrimary(dren) : normalizeSectorEntity(dren, level, '0');
  const current = computeEfficience({
    ...drenEntity,
    indicateurs: {
      ...drenEntity.indicateurs,
      txRetentionTotal: drenRetentionValue,
      tx_admis: drenAdmissionValue,
    },
  }, 'dren', cycle);

  // Population comparée : les autres entités du même niveau.
  // Primaire : les DREN de Madagascar (import `tdb_dren`, sinon agrégat SQL
  // `efficienceDrens`). Collège / lycée : les CISCO de la DREN.
  const drenPopulation: any[] = level === 'primaire'
    ? (raw.efficiencePopulation || raw.efficienceDrens || [])
    : [];
  const currentCode = num(raw.code_dren);
  const points: EfficiencyPoint[] = drenPopulation
    .filter((row: any) => currentCode === null || num(row.CODE_DREN ?? row.code_dren) !== currentCode)
    .map((row: any) => ({
      name: tdbEntityName(row, 'dren') || 'DREN',
      ...computeEfficience(row, 'dren', cycle),
    }));
  if (level !== 'primaire') {
    for (const row of raw.ciscos || []) {
      const entity = normalizeSectorEntity(
        {
          '0': {
            eleves: num(row.eleves),
            redoublants: num(row.redoublants),
            ens_classe: num(row.ens_classe),
            etab: num(row.etab),
            qualifies: num(row.qualifies),
            eau: num(row.eau),
            elec: num(row.elec),
            eleve_proche: num(row.eleve_proche),
          },
          '1': {},
        },
        level,
        '0',
      );
      points.push({ name: tdbEntityName(row, 'cisco') || tdbEntityName(entity, 'cisco') || 'CISCO', ...computeEfficience(entity, 'cisco', cycle) });
    }
  }
  // Niveau national : point de comparaison fixe du nuage.
  const madaEntity = level === 'primaire' ? mergePrimary(mada) : normalizeSectorEntity(mada, level, '0');
  const madaScores = computeEfficience({
    ...madaEntity,
    indicateurs: {
      ...madaEntity.indicateurs,
      txRetentionTotal: madaRetentionValue,
      tx_admis: madaAdmissionValue,
    },
  }, 'dren', cycle);
  if (madaScores.x !== null && madaScores.y !== null) {
    points.push({ name: 'MADAGASCAR', isParent: true, x: madaScores.x, y: madaScores.y });
  }
  points.push({ name: raw.names?.DREN || tdbEntityName(dren, 'dren') || 'DREN', isCurrent: true, x: current.x, y: current.y });

  const remarks = efficienceDiagnosis(current.x, current.y);
  if (level === 'primaire') {
    if (drenAdmissionValue !== null && madaAdmissionValue !== null && drenAdmissionValue < madaAdmissionValue) {
      remarks.push(`Le taux de réussite au CEPE (${formatDrenValue(drenAdmissionValue, '%')}) est inférieur à la moyenne nationale (${formatDrenValue(madaAdmissionValue, '%')}).`);
    }
  } else {
    const grades = GRADES[level].length;
    const rep = tauxRedoublement(raw.dren, 'ens', grades);
    const repM = tauxRedoublement(raw.mada, 'ens', grades);
    if (rep !== null && repM !== null && rep > repM) {
      remarks.push(`Le taux de redoublement de votre DREN (${formatDrenValue(rep, '%')}) reste supérieur à la moyenne nationale (${formatDrenValue(repM, '%')}).`);
    }
    if (level === 'college' && num(raw.bepc_dren?.tx_admis) !== null && num(raw.bepc_mada?.tx_admis) !== null && num(raw.bepc_dren.tx_admis) < num(raw.bepc_mada.tx_admis)) {
      remarks.push(`Le taux de réussite au BEPC (${formatDrenValue(num(raw.bepc_dren.tx_admis), '%')}) est inférieur à la moyenne nationale (${formatDrenValue(num(raw.bepc_mada.tx_admis), '%')}).`);
    }
  }
  return {
    x: current.x,
    y: current.y,
    points,
    siblingsLabel: level === 'primaire' ? 'DREN' : 'CISCO',
    remarks,
  };
}

function normalizeSectorEntity(source: any, level: ReportLevel, sector: Secteur) {
  const grades = GRADES[level].length;
  // Les populations agrégées (CISCO du nuage d'efficience) n'ont pas le détail par
  // niveau : on retombe alors sur les totaux fournis, sinon le point n'a aucun score.
  const pupils = effectif(source, sector, grades) ?? val(source, 'eleves', sector);
  const girls = effectif(source, sector, grades, 'f');
  const teachers = val(source, 'ens_classe', sector);
  const red = redoublants(source, sector, grades) ?? val(source, 'redoublants', sector);
  const qualifies = val(source, 'qualifies', sector);
  return {
    ressources: {
      nbr_eleve: pupils,
      nbr_eleve_f: girls,
      pers_en_classe: teachers,
      nbr_etab: val(source, 'etab', sector),
      nbr_sdc: val(source, 'salles', sector),
      places_assises: val(source, 'places', sector),
      latrines: val(source, 'latrines', sector),
      latrines_fille: val(source, 'latrines_f', sector),
      etab_eau: val(source, 'eau', sector),
      etab_elec: val(source, 'elec', sector),
      eleve_2km: val(source, 'eleve_proche', sector),
      eleve_moins_2km: val(source, 'eleve_proche', sector),
      caisse_ecole: val(source, 'total_fce', sector),
      ratio_ece: null,
      qualifies,
      eleve_proche: val(source, 'eleve_proche', sector),
    },
    personnel: {
      pers_en_classe: teachers,
      sans_diplome_ped: null,
      nbr_pers: val(source, 'ens', sector),
    },
    indicateurs: {
      ratio_em: ratio(pupils, teachers),
      ratio_eq: teachers !== null && qualifies !== null ? (qualifies / teachers) * 100 : null,
      red_ensemble: red !== null && pupils !== null && pupils > 0 ? (red / pupils) * 100 : null,
      txRetentionTotal: null,
      tx_admis: null,
      TPA: null,
    },
    source,
    sector,
  };
}

export function efficienceDiagnosis(x: number | null, y: number | null): string[] {
  if (x === null || y === null) {
    return ['Efficience non calculable : certains indicateurs de ressources ou de résultats sont indisponibles.'];
  }
  const cx = x < 100 / 3 ? 0 : x < 200 / 3 ? 1 : 2;
  const ry = y < 100 / 3 ? 2 : y < 200 / 3 ? 1 : 0;
  const texts: string[][] = [
    [
      'Bravo, votre DREN obtient d’excellents résultats avec peu de ressources. C’est remarquable.',
      'Bravo, votre DREN est très performante avec un niveau de ressources conforme à la moyenne. C’est méritant.',
      'Votre DREN obtient de bons résultats mais mobilise beaucoup de ressources. L’efficience peut encore progresser.',
    ],
    [
      'La performance de votre DREN se situe dans la moyenne, avec un niveau de ressources faible. Ce qui est acceptable.',
      'La performance de votre DREN se situe dans la moyenne, compte tenu du niveau de ressources conforme à la moyenne. Ce qui est acceptable',
      'La performance de votre DREN est moyenne alors que les ressources sont élevées. Un gain d’efficience est attendu.',
    ],
    [
      'Les résultats de votre DREN sont faibles malgré des ressources limitées. Une action prioritaire est nécessaire.',
      'Les résultats de votre DREN sont en deçà de la moyenne pour un niveau de ressources moyen. Un plan de redressement est nécessaire.',
      'Les résultats sont faibles alors que les ressources sont élevées : situation de faible efficience. Une intervention urgente est requise.',
    ],
  ];
  return [texts[ry][cx]];
}

/* ------------------------------------------------------------------ */
/* Entrée publique                                                     */
/* ------------------------------------------------------------------ */

export function buildDrenReport(raw: any, level: ReportLevel): DrenReportModel {
  return level === 'primaire' ? buildPrimary(raw) : buildNiveau(raw, level);
}

export const DREN_LEVEL_TITLES = TITLES;
export const DREN_LEVEL_GRADES = GRADES;
