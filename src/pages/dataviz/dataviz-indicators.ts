/**
 * Registre DATAVIZ — 40 indicateurs issus du classeur
 * « Indicateurs Carte thématiques par niveau VF ».
 *
 * Le classeur est la référence des libellés, formules et seuils.
 * Les lignes rouges du classeur sont exclues.
 *
 * Contrat d'intégration backend prévu :
 * chaque ligne de réponse DATAVIZ peut fournir
 * DATAVIZ_VALUES: { "<code_indicateur>": number }.
 * Le backend devra alimenter cette valeur à partir de ses données réelles.
 *
 * Tant qu'une correspondance n'est pas confirmée, calculate() renvoie NaN :
 * aucune donnée absente n'est transformée artificiellement en zéro.
 */

export type Niveau = 'prescolaire' | 'primaire' | 'college' | 'lycee';

export const NIVEAUX: { value: Niveau; label: string }[] = [
  { value: 'prescolaire', label: 'Préscolaire' },
  { value: 'primaire', label: 'Primaire (EPP)' },
  { value: 'college', label: 'Collège (CEG)' },
  { value: 'lycee', label: 'Lycée' },
];

export type Polarity = 'lower-better' | 'higher-better' | 'neutral';
export type MappingStatus = 'ready' | 'pending' | 'ambiguous';
export type ColorClass = 'inf' | 'entre' | 'sup' | 'missing';

export interface IndicatorDef {
  value: string;
  label: string;
  niveaux: Niveau[];
  formula: string;
  defaultMinMax: string | null;
  defaultBounds: [number, number] | null;
  sourceFields: string[];
  sourceFieldLabels: Record<string, string>;
  calculate: (data: Record<string, unknown>) => number;
  sliderDefaults: { range: [number, number]; start: [number, number] };
  unit: string;
  isPercentage: boolean;
  isCount: boolean;
  polarity: Polarity;
  mappingStatus: MappingStatus;
  mappingNote?: string;
}

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (typeof value !== 'string' || value.trim() === '') return NaN;
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : NaN;
};

const read = (data: Record<string, unknown>, key: string): number => toNumber(data[key]);

const divide = (numerator: number, denominator: number): number =>
  Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0
    ? numerator / denominator
    : NaN;

const percent = (numerator: number, denominator: number): number => {
  const value = divide(numerator, denominator);
  return Number.isFinite(value) ? value * 100 : NaN;
};

const parseBounds = (value: string | null): [number, number] | null => {
  if (!value) return null;
  const match = value.match(/^\s*(-?\d+(?:[.,]\d+)?)\s*%?\s*-\s*(-?\d+(?:[.,]\d+)?)\s*%?\s*$/);
  if (!match) return null;
  const min = Number(match[1].replace(',', '.'));
  const max = Number(match[2].replace(',', '.'));
  return Number.isFinite(min) && Number.isFinite(max) ? [min, max] : null;
};

type IndicatorSpec = Omit<IndicatorDef, 'defaultBounds' | 'sliderDefaults' | 'calculate'> & {
  calculateLocal?: (data: Record<string, unknown>) => number;
};

const makeIndicator = (spec: IndicatorSpec): IndicatorDef => {
  const defaultBounds = parseBounds(spec.defaultMinMax);
  const maxBound = defaultBounds ? Math.max(100, defaultBounds[0], defaultBounds[1]) : 100;
  const range: [number, number] = [
    defaultBounds ? Math.min(0, defaultBounds[0]) : 0,
    maxBound,
  ];
  const start: [number, number] = defaultBounds ? [...defaultBounds] : [0, 100];

  return {
    ...spec,
    defaultBounds,
    sliderDefaults: { range, start },
    calculate: (data) => {
      const backendValues = data.DATAVIZ_VALUES;
      if (
        backendValues &&
        typeof backendValues === 'object' &&
        !Array.isArray(backendValues)
      ) {
        const value = toNumber((backendValues as Record<string, unknown>)[spec.value]);
        if (Number.isFinite(value)) return value;
      }
      return spec.calculateLocal ? spec.calculateLocal(data) : NaN;
    },
  };
};

const commonFields = {
  eff_2025: 'Effectif élèves inscrits',
  en_classe: 'Enseignants en activité',
  qualifiee: 'Enseignants qualifiés',
  fonctionnaire: 'Enseignants fonctionnaires',
  fram_sub: 'Enseignants FRAM subventionnés',
  fram_nonsub: 'Enseignants FRAM non subventionnés',
};

export const INDICATORS: IndicatorDef[] = [
  // ── PRÉSCOLAIRE : 6 indicateurs ─────────────────────────────────────────
  makeIndicator({
    value: 'pre-offre-fonctionnelle',
    label: "% d'établissements disposant d'une offre préscolaire fonctionnelle",
    niveaux: ['prescolaire'],
    formula: 'Comptage des établissements ayant au moins une section préscolaire effectivement ouverte et fonctionnelle.',
    defaultMinMax: '50%-75%',
    sourceFields: [],
    sourceFieldLabels: {},
    unit: ' établissements',
    isPercentage: false,
    isCount: true,
    polarity: 'higher-better',
    mappingStatus: 'ambiguous',
    mappingNote: "Le libellé annonce un pourcentage, mais la formule du classeur demande un comptage.",
  }),
  makeIndicator({
    value: 'pre-ratio-enfants-educateur',
    label: 'Ratio enfants-éducateur',
    niveaux: ['prescolaire'],
    formula: 'Effectif total des enfants inscrits /Nombre total d’éducateurs en activité.',
    defaultMinMax: '25-30',
    sourceFields: [],
    sourceFieldLabels: {},
    unit: ' enfants/éducateur',
    isPercentage: false,
    isCount: false,
    polarity: 'lower-better',
    mappingStatus: 'pending',
  }),
  makeIndicator({
    value: 'pre-educateurs-qualifies',
    label: 'Pourcentage d’éducateurs qualifiés',
    niveaux: ['prescolaire'],
    formula: '(Nombre d’éducateurs qualifiés / Nombre total d’éducateurs en activité) × 100.',
    defaultMinMax: '50%-75%',
    sourceFields: [],
    sourceFieldLabels: {},
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
    mappingStatus: 'pending',
  }),
  makeIndicator({
    value: 'pre-educateurs-fram',
    label: 'Pourcentage d’éducateurs FRAM',
    niveaux: ['prescolaire'],
    formula: '(Nombre d’éducateurs FRAM en activité / Nombre total d’éducateurs en activité) × 100.',
    defaultMinMax: '25-50%',
    sourceFields: [],
    sourceFieldLabels: {},
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'neutral',
    mappingStatus: 'pending',
  }),
  makeIndicator({
    value: 'pre-salles-bon-etat',
    label: 'Pourcentage de salles de classe en bon état',
    niveaux: ['prescolaire'],
    formula: '(Nombre de salles de classe en bon état / Nombre total de salles de classe évaluées) × 100.',
    defaultMinMax: '50-75%',
    sourceFields: [],
    sourceFieldLabels: {},
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
    mappingStatus: 'pending',
  }),
  makeIndicator({
    value: 'pre-cantine',
    label: "Pourcentage d'établissements disposant d'une cantine scolaire",
    niveaux: ['prescolaire'],
    formula: '(Nombre d’établissements disposant d’une cantine fonctionnelle / Nombre total d’établissements préscolaires fonctionnels) × 100.',
    defaultMinMax: '50-75%',
    sourceFields: [],
    sourceFieldLabels: {},
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
    mappingStatus: 'pending',
  }),

  // ── PRIMAIRE : 11 indicateurs ────────────────────────────────────────────
  makeIndicator({
    value: 'pri-ratio-eleves-salle',
    label: 'Ratio élèves par salle de classe utilisée',
    niveaux: ['primaire'],
    formula: 'Effectif total des élèves inscrits /Nombre total de salles de classe effectivement utilisées.',
    defaultMinMax: '50-50',
    sourceFields: [],
    sourceFieldLabels: {},
    unit: ' élèves/salle',
    isPercentage: false,
    isCount: false,
    polarity: 'lower-better',
    mappingStatus: 'pending',
    mappingNote: 'Le champ des salles effectivement utilisées reste à confirmer.',
  }),
  makeIndicator({
    value: 'pri-ratio-eleves-maitre',
    label: 'Ratio élèves-maître',
    niveaux: ['primaire'],
    formula: 'Effectif total des élèves inscrits /Nombre total d’enseignants en activité.',
    defaultMinMax: '50-50',
    sourceFields: ['eff_2025', 'en_classe'],
    sourceFieldLabels: { eff_2025: commonFields.eff_2025, en_classe: commonFields.en_classe },
    calculateLocal: (d) => divide(read(d, 'eff_2025'), read(d, 'en_classe')),
    unit: ' élèves/enseignant',
    isPercentage: false,
    isCount: false,
    polarity: 'lower-better',
    mappingStatus: 'ready',
  }),
  makeIndicator({
    value: 'pri-enseignants-qualifies',
    label: "Pourcentage d'enseignants qualifiés",
    niveaux: ['primaire'],
    formula: '(Nombre d’enseignants qualifiés /Nombre total d’enseignants en activité) × 100.',
    defaultMinMax: '50%-75%',
    sourceFields: ['qualifiee', 'en_classe'],
    sourceFieldLabels: { qualifiee: commonFields.qualifiee, en_classe: commonFields.en_classe },
    calculateLocal: (d) => percent(read(d, 'qualifiee'), read(d, 'en_classe')),
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
    mappingStatus: 'ready',
  }),
  makeIndicator({
    value: 'pri-enseignants-fram',
    label: "Pourcentage d'enseignants FRAM",
    niveaux: ['primaire'],
    formula: '(Nombre d’enseignants FRAM en activité / Nombre total d’enseignants en activité) × 100.',
    defaultMinMax: '25-50%',
    sourceFields: ['fram_sub', 'fram_nonsub', 'en_classe'],
    sourceFieldLabels: {
      fram_sub: commonFields.fram_sub,
      fram_nonsub: commonFields.fram_nonsub,
      en_classe: commonFields.en_classe,
    },
    calculateLocal: (d) => {
      const sub = read(d, 'fram_sub');
      const nonSub = read(d, 'fram_nonsub');
      return percent(sub + nonSub, read(d, 'en_classe'));
    },
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'neutral',
    mappingStatus: 'ready',
  }),
  makeIndicator({
    value: 'pri-salles-bon-etat',
    label: 'Pourcentage de salles de classe en bon état',
    niveaux: ['primaire'],
    formula: '(Nombre de salles de classe en bon état / Nombre total de salles de classe évaluées) × 100.',
    defaultMinMax: '50-75%',
    sourceFields: [],
    sourceFieldLabels: {},
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
    mappingStatus: 'pending',
    mappingNote: 'Le total des salles évaluées n’est pas identifié dans les champs frontend inspectés.',
  }),
  makeIndicator({
    value: 'pri-ecoles-latrines',
    label: "Pourcentage d'écoles disposant de latrines",
    niveaux: ['primaire'],
    formula: '(Nombre d’écoles disposant de latrines fonctionnelles /Nombre total d’écoles évaluées) × 100.',
    defaultMinMax: '50-75%',
    sourceFields: [],
    sourceFieldLabels: {},
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
    mappingStatus: 'pending',
  }),
  makeIndicator({
    value: 'pri-ecoles-latrines-filles',
    label: "Pourcentage d'écoles disposant de latrines pour filles",
    niveaux: ['primaire'],
    formula: '(Nombre d’écoles disposant de latrines fonctionnelles réservées aux filles / Nombre total d’écoles évaluées) × 100.',
    defaultMinMax: '50-75%',
    sourceFields: [],
    sourceFieldLabels: {},
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
    mappingStatus: 'pending',
  }),
  makeIndicator({
    value: 'pri-ecoles-point-eau',
    label: "Pourcentage d'écoles disposant d'un point d'eau",
    niveaux: ['primaire'],
    formula: '(Nombre d’écoles disposant d’un point d’eau fonctionnel / Nombre total d’écoles évaluées) × 100.',
    defaultMinMax: '50-75%',
    sourceFields: [],
    sourceFieldLabels: {},
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
    mappingStatus: 'pending',
  }),
  makeIndicator({
    value: 'pri-ecoles-electrifiees',
    label: "Pourcentage d'écoles électrifiées",
    niveaux: ['primaire'],
    formula: '(Nombre d’écoles disposant d’une installation électrique fonctionnelle / Nombre total d’écoles évaluées) × 100.',
    defaultMinMax: '50-75%',
    sourceFields: [],
    sourceFieldLabels: {},
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
    mappingStatus: 'pending',
  }),
  makeIndicator({
    value: 'pri-ecoles-cantine',
    label: "Pourcentage d'écoles disposant d'une cantine scolaire",
    niveaux: ['primaire'],
    formula: '(Nombre d’écoles disposant d’une cantine fonctionnelle / Nombre total d’écoles évaluées) × 100.',
    defaultMinMax: '50-75%',
    sourceFields: [],
    sourceFieldLabels: {},
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
    mappingStatus: 'pending',
  }),
  makeIndicator({
    value: 'pri-eleves-distance-2km',
    label: "Pourcentage d'élèves parcourant plus de 2 km pour accéder à l'école",
    niveaux: ['primaire'],
    formula: '(Nombre d’élèves parcourant plus de 2 km / Nombre total d’élèves dont la distance domicile-école est renseignée) × 100.',
    defaultMinMax: '50-75%',
    sourceFields: [],
    sourceFieldLabels: {},
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'lower-better',
    mappingStatus: 'pending',
  }),

  // ── COLLÈGE : 13 indicateurs ─────────────────────────────────────────────
  makeIndicator({
    value: 'col-communes-sans-ceg',
    label: 'Pourcentage de commune sans CEG',
    niveaux: ['college'],
    formula: '(Nombre de communes disposant d’au moins un collège fonctionnel / Nombre total de communes) × 100.',
    defaultMinMax: '50-75%',
    sourceFields: [],
    sourceFieldLabels: {},
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
    mappingStatus: 'ambiguous',
    mappingNote: 'Le libellé indique « sans CEG », mais la formule calcule les communes disposant d’au moins un CEG.',
  }),
  makeIndicator({
    value: 'col-ratio-eleves-salle',
    label: 'Ratio élèves par salle de classe utilisée',
    niveaux: ['college'],
    formula: 'Effectif total des élèves inscrits / Nombre total de salles de classe effectivement utilisées.',
    defaultMinMax: '50-50',
    sourceFields: [],
    sourceFieldLabels: {},
    unit: ' élèves/salle',
    isPercentage: false,
    isCount: false,
    polarity: 'lower-better',
    mappingStatus: 'pending',
  }),
  makeIndicator({
    value: 'col-ratio-eleves-enseignants-discipline',
    label: 'Ratio élèves-enseignants par discipline',
    niveaux: ['college'],
    formula: 'Pour chaque discipline : Effectif total des élèves concernés / Nombre d’enseignants en activité dans cette discipline.',
    defaultMinMax: '50-50',
    sourceFields: [],
    sourceFieldLabels: {},
    unit: ' élèves/enseignant',
    isPercentage: false,
    isCount: false,
    polarity: 'lower-better',
    mappingStatus: 'pending',
  }),
  makeIndicator({
    value: 'col-enseignants-qualifies',
    label: "Pourcentage d'enseignants qualifiés",
    niveaux: ['college'],
    formula: '(Nombre d’enseignants qualifiés / Nombre total d’enseignants en activité) × 100.',
    defaultMinMax: '50-75%',
    sourceFields: ['qualifiee', 'en_classe'],
    sourceFieldLabels: { qualifiee: commonFields.qualifiee, en_classe: commonFields.en_classe },
    calculateLocal: (d) => percent(read(d, 'qualifiee'), read(d, 'en_classe')),
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
    mappingStatus: 'ready',
  }),
  makeIndicator({
    value: 'col-enseignants-fonctionnaires',
    label: "Pourcentage d'enseignants fonctionnaires",
    niveaux: ['college'],
    formula: '(Nombre d’enseignants fonctionnaires en activité / Nombre total d’enseignants en activité) × 100.',
    defaultMinMax: '50-75%',
    sourceFields: ['fonctionnaire', 'en_classe'],
    sourceFieldLabels: { fonctionnaire: commonFields.fonctionnaire, en_classe: commonFields.en_classe },
    calculateLocal: (d) => percent(read(d, 'fonctionnaire'), read(d, 'en_classe')),
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
    mappingStatus: 'ready',
  }),
  makeIndicator({
    value: 'col-enseignants-fram',
    label: "Pourcentage d'enseignants FRAM",
    niveaux: ['college'],
    formula: '(Nombre d’enseignants FRAM en activité / Nombre total d’enseignants en activité) × 100.',
    defaultMinMax: '25-50%',
    sourceFields: ['fram_sub', 'fram_nonsub', 'en_classe'],
    sourceFieldLabels: {
      fram_sub: commonFields.fram_sub,
      fram_nonsub: commonFields.fram_nonsub,
      en_classe: commonFields.en_classe,
    },
    calculateLocal: (d) => percent(read(d, 'fram_sub') + read(d, 'fram_nonsub'), read(d, 'en_classe')),
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'neutral',
    mappingStatus: 'ready',
  }),
  makeIndicator({
    value: 'col-salles-bon-etat',
    label: 'Pourcentage de salles de classe en bon état',
    niveaux: ['college'],
    formula: '(Nombre de salles de classe en bon état / Nombre total de salles de classe évaluées) × 100.',
    defaultMinMax: '50-75%',
    sourceFields: [],
    sourceFieldLabels: {},
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
    mappingStatus: 'pending',
  }),
  makeIndicator({
    value: 'col-etablissements-latrines',
    label: "Pourcentage d'établissements disposant de latrines",
    niveaux: ['college'],
    formula: '(Nombre de collèges disposant de latrines fonctionnelles / Nombre total de collèges évalués) × 100.',
    defaultMinMax: '50-75%',
    sourceFields: [],
    sourceFieldLabels: {},
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
    mappingStatus: 'pending',
  }),
  makeIndicator({
    value: 'col-etablissements-latrines-filles',
    label: "Pourcentage d'établissements disposant de latrines pour filles",
    niveaux: ['college'],
    formula: '(Nombre de collèges disposant de latrines fonctionnelles réservées aux filles / Nombre total de collèges évalués) × 100.',
    defaultMinMax: '50-75%',
    sourceFields: [],
    sourceFieldLabels: {},
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
    mappingStatus: 'pending',
  }),
  makeIndicator({
    value: 'col-etablissements-point-eau',
    label: "Pourcentage d'établissements disposant d'un point d'eau",
    niveaux: ['college'],
    formula: '(Nombre de collèges disposant d’un point d’eau fonctionnel / Nombre total de collèges évalués) × 100.',
    defaultMinMax: '50-75%',
    sourceFields: [],
    sourceFieldLabels: {},
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
    mappingStatus: 'pending',
  }),
  makeIndicator({
    value: 'col-etablissements-electrifies',
    label: "Pourcentage d'établissements électrifiés",
    niveaux: ['college'],
    formula: '(Nombre de collèges disposant d’une installation électrique fonctionnelle / Nombre total de collèges évalués) × 100.',
    defaultMinMax: '50-75%',
    sourceFields: [],
    sourceFieldLabels: {},
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
    mappingStatus: 'pending',
  }),
  makeIndicator({
    value: 'col-colleges-laboratoire',
    label: "Pourcentage de collèges disposant d'un laboratoire fonctionnel",
    niveaux: ['college'],
    formula: '(Nombre de collèges disposant d’un laboratoire fonctionnel /Nombre total de collèges évalués) × 100.',
    defaultMinMax: '50-75%',
    sourceFields: [],
    sourceFieldLabels: {},
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
    mappingStatus: 'pending',
  }),
  makeIndicator({
    value: 'col-eleves-distance-5km',
    label: "Pourcentage d'élèves parcourant plus de 5 km pour accéder au collège",
    niveaux: ['college'],
    formula: '(Nombre d’élèves parcourant plus de 5 km / Nombre total d’élèves dont la distance domicile-collège est renseignée) × 100.',
    defaultMinMax: '50-75%',
    sourceFields: [],
    sourceFieldLabels: {},
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'lower-better',
    mappingStatus: 'pending',
  }),

  // ── LYCÉE : 10 indicateurs ───────────────────────────────────────────────
  makeIndicator({
    value: 'lyc-ratio-eleves-enseignants-discipline',
    label: 'Ratio élèves-enseignants par discipline',
    niveaux: ['lycee'],
    formula: 'Pour chaque matière : Effectif total des élèves concernés /Nombre d’enseignants en activité dans cette matière.',
    defaultMinMax: '50-50',
    sourceFields: [],
    sourceFieldLabels: {},
    unit: ' élèves/enseignant',
    isPercentage: false,
    isCount: false,
    polarity: 'lower-better',
    mappingStatus: 'pending',
  }),
  makeIndicator({
    value: 'lyc-enseignants-qualifies',
    label: "Pourcentage d'enseignants qualifiés",
    niveaux: ['lycee'],
    formula: '(Nombre d’enseignants qualifiés / Nombre total d’enseignants en activité) × 100.',
    defaultMinMax: '50-75%',
    sourceFields: ['qualifiee', 'en_classe'],
    sourceFieldLabels: { qualifiee: commonFields.qualifiee, en_classe: commonFields.en_classe },
    calculateLocal: (d) => percent(read(d, 'qualifiee'), read(d, 'en_classe')),
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
    mappingStatus: 'ready',
  }),
  makeIndicator({
    value: 'lyc-enseignants-fonctionnaires',
    label: "Pourcentage d'enseignants fonctionnaires",
    niveaux: ['lycee'],
    formula: '(Nombre d’enseignants fonctionnaires en activité / Nombre total d’enseignants en activité) × 100.',
    defaultMinMax: '50-75%',
    sourceFields: ['fonctionnaire', 'en_classe'],
    sourceFieldLabels: { fonctionnaire: commonFields.fonctionnaire, en_classe: commonFields.en_classe },
    calculateLocal: (d) => percent(read(d, 'fonctionnaire'), read(d, 'en_classe')),
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
    mappingStatus: 'ready',
  }),
  makeIndicator({
    value: 'lyc-enseignants-fram',
    label: "Pourcentage d'enseignants FRAM",
    niveaux: ['lycee'],
    formula: '(Nombre d’enseignants FRAM en activité / Nombre total d’enseignants en activité) × 100.',
    defaultMinMax: '25-50%',
    sourceFields: ['fram_sub', 'fram_nonsub', 'en_classe'],
    sourceFieldLabels: {
      fram_sub: commonFields.fram_sub,
      fram_nonsub: commonFields.fram_nonsub,
      en_classe: commonFields.en_classe,
    },
    calculateLocal: (d) => percent(read(d, 'fram_sub') + read(d, 'fram_nonsub'), read(d, 'en_classe')),
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'neutral',
    mappingStatus: 'ready',
  }),
  makeIndicator({
    value: 'lyc-etablissements-electrifies',
    label: "Pourcentage d'établissements électrifiés",
    niveaux: ['lycee'],
    formula: '(Nombre de lycées disposant d’une installation électrique fonctionnelle / Nombre total de lycées évalués) × 100.',
    defaultMinMax: '50-75%',
    sourceFields: [],
    sourceFieldLabels: {},
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
    mappingStatus: 'pending',
  }),
  makeIndicator({
    value: 'lyc-salles-bon-etat',
    label: 'Pourcentage de salles de classe en bon état',
    niveaux: ['lycee'],
    formula: '(Nombre de salles de classe en bon état /Nombre total de salles de classe évaluées) × 100.',
    defaultMinMax: '50-75%',
    sourceFields: [],
    sourceFieldLabels: {},
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
    mappingStatus: 'pending',
  }),
  makeIndicator({
    value: 'lyc-lycees-laboratoire',
    label: "Pourcentage de lycées disposant d'un laboratoire fonctionnel",
    niveaux: ['lycee'],
    formula: '(Nombre de lycées disposant d’un laboratoire fonctionnel / Nombre total de lycées évalués) × 100.',
    defaultMinMax: '50-75%',
    sourceFields: [],
    sourceFieldLabels: {},
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
    mappingStatus: 'pending',
  }),
  makeIndicator({
    value: 'lyc-lycees-latrines',
    label: 'Pourcentage de lycées disposant de latrines',
    niveaux: ['lycee'],
    formula: '(Nombre de lycées disposant de latrines fonctionnelles / Nombre total de lycées évalués) × 100.',
    defaultMinMax: '50-75%',
    sourceFields: [],
    sourceFieldLabels: {},
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
    mappingStatus: 'pending',
  }),
  makeIndicator({
    value: 'lyc-lycees-latrines-filles',
    label: 'Pourcentage de lycées disposant de latrines pour filles',
    niveaux: ['lycee'],
    formula: '(Nombre de lycées disposant de latrines fonctionnelles réservées aux filles / Nombre total de lycées évalués) × 100.',
    defaultMinMax: '50-75%',
    sourceFields: [],
    sourceFieldLabels: {},
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
    mappingStatus: 'pending',
  }),
  makeIndicator({
    value: 'lyc-etablissements-point-eau',
    label: "Pourcentage d'établissements disposant d'un point d'eau",
    niveaux: ['lycee'],
    formula: '(Nombre de lycées disposant d’un point d’eau fonctionnel / Nombre total de lycées évalués) × 100.',
    defaultMinMax: '50-75%',
    sourceFields: [],
    sourceFieldLabels: {},
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
    mappingStatus: 'pending',
  }),
];

export const THEME_PLACEHOLDER = {
  value: '0',
  label: '--Choisir un thème--',
} as const;

export function getThemesForNiveau(niveau: Niveau): {
  value: string;
  label: string;
  mappingStatus: MappingStatus;
  mappingNote?: string;
}[] {
  return [
    { ...THEME_PLACEHOLDER, mappingStatus: 'ready' },
    ...INDICATORS.filter((indicator) => indicator.niveaux.includes(niveau)).map((indicator) => ({
      value: indicator.value,
      label: indicator.label,
      mappingStatus: indicator.mappingStatus,
      mappingNote: indicator.mappingNote,
    })),
  ];
}

export function getIndicator(theme: string): IndicatorDef | undefined {
  return INDICATORS.find((indicator) => indicator.value === theme);
}

export function getSliderDefaults(theme: string): { range: [number, number]; start: [number, number] } {
  return getIndicator(theme)?.sliderDefaults ?? { range: [0, 100], start: [0, 100] };
}

export function calculateRatio(data: Record<string, unknown>, theme: string): number {
  const indicator = getIndicator(theme);
  if (!indicator) return NaN;
  try {
    return indicator.calculate(data);
  } catch {
    return NaN;
  }
}

export function classifyRatio(
  ratio: number,
  minBound: number,
  maxBound: number,
  polarity: Polarity = 'lower-better',
): ColorClass {
  if (!Number.isFinite(ratio)) return 'missing';

  if (polarity === 'higher-better') {
    if (ratio < minBound) return 'sup';
    if (ratio > maxBound) return 'inf';
    return 'entre';
  }

  if (ratio < minBound) return 'inf';
  if (ratio > maxBound) return 'sup';
  return 'entre';
}

export function getThematicColor(
  ratio: number,
  minBound: number,
  maxBound: number,
  polarity: Polarity = 'lower-better',
): string {
  const classification = classifyRatio(ratio, minBound, maxBound, polarity);
  if (classification === 'missing') return '#9CA3AF';
  if (classification === 'inf') return '#FFFFFF';
  if (classification === 'sup') return '#FF0000';
  return '#00AA00';
}

export function getLegendLabels(
  minBound: number,
  maxBound: number,
  polarity: Polarity,
  formatValue: (value: number) => string,
  unit: string,
): { white: string; green: string; red: string; missing: string } {
  const min = `${formatValue(minBound)}${unit || ''}`;
  const max = `${formatValue(maxBound)}${unit || ''}`;

  if (polarity === 'higher-better') {
    return {
      white: `Supérieur à ${max} (meilleur)`,
      green: `[${min} – ${max}]`,
      red: `Inférieur à ${min} (critique)`,
      missing: 'Donnée indisponible',
    };
  }

  return {
    white: `Inférieur à ${min}`,
    green: `[${min} – ${max}]`,
    red: `Supérieur à ${max}`,
    missing: 'Donnée indisponible',
  };
}

export function isPercentageTheme(theme: string): boolean {
  return getIndicator(theme)?.isPercentage ?? false;
}

export function isCountTheme(theme: string): boolean {
  return getIndicator(theme)?.isCount ?? false;
}

export function getThemeUnit(theme: string): string {
  return getIndicator(theme)?.unit ?? '';
}

export function getThemePolarity(theme: string): Polarity {
  return getIndicator(theme)?.polarity ?? 'lower-better';
}

export function formatThemeValue(value: number, theme: string): string {
  if (!Number.isFinite(value)) return '—';
  const options: Intl.NumberFormatOptions = isCountTheme(theme)
    ? { maximumFractionDigits: 0 }
    : { minimumFractionDigits: 1, maximumFractionDigits: 1 };
  return value.toLocaleString('fr-FR', options);
}

export function formatExportValue(value: number, theme: string): number | null {
  if (!Number.isFinite(value)) return null;
  return isCountTheme(theme) ? Math.round(value) : Math.round(value * 100) / 100;
}

export const STYLE_DREN = {
  fillColor: '#4e73df',
  color: '#4e73df',
  weight: 1,
  opacity: 1,
  fillOpacity: 0.02,
};

export const STYLE_CISCO = {
  fillColor: '#22afbe',
  color: '#22afbe',
  weight: 1,
  opacity: 1,
  fillOpacity: 0.05,
};

export const STYLE_COMMUNE = {
  fillColor: '#c0c0c0',
  color: '#c0c0c0',
  weight: 2,
  opacity: 1,
  fillOpacity: 0.03,
};

export const THEMES = [
  THEME_PLACEHOLDER,
  ...INDICATORS.map(({ value, label }) => ({ value, label })),
];