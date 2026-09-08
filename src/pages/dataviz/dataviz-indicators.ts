/**
 * Registre unique des indicateurs de la carte thématique.
 * Source de vérité pour : select, calcul de ratio, plages slider,
 * unités, polarité (sens de l'indicateur), champs sources d'export.
 *
 * Pour ajouter un indicateur :
 *  1. Ajouter une entrée dans INDICATORS
 *  2. Renseigner les niveaux applicables (inclure 'prescolaire' si besoin)
 *  3. Définir calculate, sourceFields, polarity, sliderDefaults, unit
 *
 * Tout le reste (UI, couleurs, export) dérive automatiquement.
 */

export type Niveau = 'prescolaire' | 'primaire' | 'college' | 'lycee';

export const NIVEAUX: { value: Niveau; label: string }[] = [
  // { value: 'prescolaire', label: 'Préscolaire' }, // décommenter quand les données seront prêtes
  { value: 'primaire', label: 'Primaire (EPP)' },
  { value: 'college', label: 'Collège (CEG)' },
  { value: 'lycee', label: 'Lycée' },
];

/** Polarité : direction « souhaitable » de l'indicateur pour la coloration */
export type Polarity =
  | 'lower-better'   // ratio élevé = problème (ex. élèves/maître)
  | 'higher-better'  // taux élevé = mieux (ex. % électrification)
  | 'neutral';       // comptage pur, même logique que lower-better par défaut

export interface IndicatorDef {
  /** Code technique (valeur du select) */
  value: string;
  /** Libellé affiché */
  label: string;
  /** Niveaux scolaires pour lesquels l'indicateur est proposé */
  niveaux: Niveau[];
  /**
   * Champs bruts nécessaires au calcul (et exportés).
   * Utilisés aussi pour construire les colonnes d'export.
   */
  sourceFields: string[];
  /** Libellés humains des champs sources (pour les en-têtes d'export) */
  sourceFieldLabels: Record<string, string>;
  /** Fonction de calcul du ratio / valeur */
  calculate: (data: Record<string, unknown>) => number;
  /** Plage et valeurs initiales du slider [min, max] */
  sliderDefaults: { range: [number, number]; start: [number, number] };
  /** Unité affichée (suffixe) */
  unit: string;
  /** true si la valeur est un pourcentage 0-100 */
  isPercentage: boolean;
  /** true si la valeur est un entier (pas de décimales) */
  isCount: boolean;
  /** Sens de l'indicateur pour la coloration carte + export */
  polarity: Polarity;
}

const safeDiv = (a: number, b: number) => (b === 0 ? 0 : a / b);
const pf = (v: unknown) => parseFloat(String(v ?? '')) || 0;
const pi = (v: unknown) => parseInt(String(v ?? ''), 10) || 0;

/** Registre complet des indicateurs */
export const INDICATORS: IndicatorDef[] = [
  {
    value: 'rem',
    label: 'Ratio élève-maître',
    niveaux: ['primaire', 'college', 'lycee'],
    sourceFields: ['eff_2025', 'en_classe'],
    sourceFieldLabels: {
      eff_2025: 'Effectif élèves',
      en_classe: 'Enseignants en classe',
    },
    calculate: (d) => safeDiv(pf(d.eff_2025), pf(d.en_classe)),
    sliderDefaults: { range: [0, 100], start: [25, 50] },
    unit: ' élèves/ens',
    isPercentage: false,
    isCount: false,
    polarity: 'lower-better',
  },
  {
    value: 're-sdc',
    label: 'Ratio élèves par salle de classe',
    niveaux: ['primaire', 'college', 'lycee'],
    sourceFields: ['eff_2025', 'sdc_be', 'sdc_me'],
    sourceFieldLabels: {
      eff_2025: 'Effectif élèves',
      sdc_be: 'Salles bon état',
      sdc_me: 'Salles moyen état',
    },
    calculate: (d) => {
      const sdc = pf(d.sdc_be) + pf(d.sdc_me);
      return safeDiv(pf(d.eff_2025), sdc);
    },
    sliderDefaults: { range: [0, 100], start: [25, 60] },
    unit: ' élèves/sdc',
    isPercentage: false,
    isCount: false,
    polarity: 'lower-better',
  },
  {
    value: 'ratio-pa',
    label: 'Ratio élèves par place assise',
    niveaux: ['primaire', 'college', 'lycee'],
    sourceFields: ['eff_2025', 'places'],
    sourceFieldLabels: {
      eff_2025: 'Effectif élèves',
      places: 'Places assises',
    },
    calculate: (d) => safeDiv(pf(d.eff_2025), pf(d.places)),
    sliderDefaults: { range: [0, 10], start: [0, 1] },
    unit: ' élèves/place',
    isPercentage: false,
    isCount: false,
    polarity: 'lower-better',
  },
  {
    value: 'elec',
    label: 'Pourcentage des écoles électrifiées',
    niveaux: ['primaire', 'college', 'lycee'],
    sourceFields: ['elec', 'nbr_etab'],
    sourceFieldLabels: {
      elec: 'Écoles électrifiées',
      nbr_etab: "Nombre d'établissements",
    },
    calculate: (d) => Math.round(safeDiv(pf(d.elec), pf(d.nbr_etab)) * 100),
    sliderDefaults: { range: [0, 100], start: [50, 75] },
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
  },
  {
    value: 'eau',
    label: "Pourcentage des écoles avec point d'eau",
    niveaux: ['primaire', 'college', 'lycee'],
    sourceFields: ['eau', 'nbr_etab'],
    sourceFieldLabels: {
      eau: "Écoles avec point d'eau",
      nbr_etab: "Nombre d'établissements",
    },
    calculate: (d) => Math.round(safeDiv(pf(d.eau), pf(d.nbr_etab)) * 100),
    sliderDefaults: { range: [0, 100], start: [50, 75] },
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
  },
  {
    value: 'exist-lat-g',
    label: 'Pourcentage des écoles ayant des latrines pour garçons',
    niveaux: ['primaire', 'college', 'lycee'],
    sourceFields: ['latrine_g', 'nbr_etab'],
    sourceFieldLabels: {
      latrine_g: 'Écoles avec latrines garçons',
      nbr_etab: "Nombre d'établissements",
    },
    calculate: (d) => Math.round(safeDiv(pi(d.latrine_g), pf(d.nbr_etab)) * 100),
    sliderDefaults: { range: [0, 100], start: [30, 60] },
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
  },
  {
    value: 'exist-lat-f',
    label: 'Pourcentage des écoles ayant des latrines pour filles',
    niveaux: ['primaire', 'college', 'lycee'],
    sourceFields: ['latrine_f', 'nbr_etab'],
    sourceFieldLabels: {
      latrine_f: 'Écoles avec latrines filles',
      nbr_etab: "Nombre d'établissements",
    },
    calculate: (d) => Math.round(safeDiv(pi(d.latrine_f), pf(d.nbr_etab)) * 100),
    sliderDefaults: { range: [0, 100], start: [30, 60] },
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
  },
  {
    value: 'exist-lat',
    label: 'Pourcentage des écoles ayant des latrines communes',
    niveaux: ['primaire', 'college', 'lycee'],
    sourceFields: ['latrine', 'nbr_etab'],
    sourceFieldLabels: {
      latrine: 'Écoles avec latrines communes',
      nbr_etab: "Nombre d'établissements",
    },
    calculate: (d) => Math.round(safeDiv(pi(d.latrine), pf(d.nbr_etab)) * 100),
    sliderDefaults: { range: [0, 100], start: [30, 60] },
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
  },
  {
    value: 'ens-f',
    label: 'Pourcentage des enseignants Fonctionnaires',
    niveaux: ['primaire', 'college', 'lycee'],
    sourceFields: ['fonct', 'pers_total'],
    sourceFieldLabels: {
      fonct: 'Enseignants fonctionnaires',
      pers_total: 'Personnel enseignant total',
    },
    calculate: (d) => safeDiv(pi(d.fonct), pf(d.pers_total)) * 100,
    sliderDefaults: { range: [0, 100], start: [30, 60] },
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
  },
  {
    value: 'ens-fsub',
    label: 'Pourcentage des enseignants FRAM subventionnés',
    niveaux: ['primaire'],
    sourceFields: ['fs', 'pers_total'],
    sourceFieldLabels: {
      fs: 'FRAM subventionnés',
      pers_total: 'Personnel enseignant total',
    },
    calculate: (d) => safeDiv(pi(d.fs), pf(d.pers_total)) * 100,
    sliderDefaults: { range: [0, 100], start: [30, 60] },
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
  },
  {
    value: 'ens-fnsub',
    label: 'Pourcentage des enseignants FRAM non subventionnés et Autres',
    niveaux: ['primaire'],
    sourceFields: ['fns', 'pers_total'],
    sourceFieldLabels: {
      fns: 'FRAM non subventionnés / Autres',
      pers_total: 'Personnel enseignant total',
    },
    calculate: (d) => safeDiv(pi(d.fns), pf(d.pers_total)) * 100,
    sliderDefaults: { range: [0, 100], start: [30, 60] },
    unit: '%',
    isPercentage: true,
    isCount: false,
    // Part non subventionnée : plus bas = mieux (moins de précarité)
    polarity: 'lower-better',
  },
  {
    value: 'ens-q',
    label: 'Pourcentage des enseignants qualifiés',
    niveaux: ['primaire', 'college', 'lycee'],
    sourceFields: ['qualifiee', 'pers_total'],
    sourceFieldLabels: {
      qualifiee: 'Enseignants qualifiés',
      pers_total: 'Personnel enseignant total',
    },
    calculate: (d) => safeDiv(pi(d.qualifiee), pf(d.pers_total)) * 100,
    sliderDefaults: { range: [0, 100], start: [35, 75] },
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
  },
  {
    value: 'extra-ens',
    label: 'Nombre des enseignants en sureffectif',
    niveaux: ['primaire', 'college', 'lycee'],
    sourceFields: ['en_classe', 'sdc_be', 'sdc_me'],
    sourceFieldLabels: {
      en_classe: 'Enseignants en classe',
      sdc_be: 'Salles bon état',
      sdc_me: 'Salles moyen état',
    },
    // Formule MEN : en_classe - (sdc_be + sdc_me) * 2  (2 rotations / salle)
    calculate: (d) => {
      const sdcE = pf(d.sdc_be) + pf(d.sdc_me);
      return pi(d.en_classe) - sdcE * 2;
    },
    sliderDefaults: { range: [0, 20], start: [1, 2] },
    unit: ' ens.',
    isPercentage: false,
    isCount: true,
    polarity: 'lower-better',
  },
  // ── Indicateurs de volume / structure ──
  {
    value: 'nbr-etab',
    label: "Nombre d'établissements",
    niveaux: ['primaire', 'college', 'lycee'],
    sourceFields: ['nbr_etab'],
    sourceFieldLabels: {
      nbr_etab: "Nombre d'établissements",
    },
    calculate: (d) => pf(d.nbr_etab),
    sliderDefaults: { range: [0, 2000], start: [50, 500] },
    unit: ' étab',
    isPercentage: false,
    isCount: true,
    polarity: 'neutral',
  },
  {
    value: 'eff-total',
    label: 'Effectif total des élèves',
    niveaux: ['primaire', 'college', 'lycee'],
    sourceFields: ['eff_2025'],
    sourceFieldLabels: {
      eff_2025: 'Effectif total élèves',
    },
    calculate: (d) => pf(d.eff_2025),
    sliderDefaults: { range: [0, 200000], start: [5000, 50000] },
    unit: ' élèves',
    isPercentage: false,
    isCount: true,
    polarity: 'neutral',
  },
  {
    value: 're-etab',
    label: 'Ratio élèves par établissement',
    niveaux: ['primaire', 'college', 'lycee'],
    sourceFields: ['eff_2025', 'nbr_etab'],
    sourceFieldLabels: {
      eff_2025: 'Effectif élèves',
      nbr_etab: "Nombre d'établissements",
    },
    calculate: (d) => safeDiv(pf(d.eff_2025), pf(d.nbr_etab)),
    sliderDefaults: { range: [0, 1000], start: [100, 400] },
    unit: ' élèves/étab',
    isPercentage: false,
    isCount: false,
    polarity: 'lower-better',
  },
  {
    value: 'sdc-be-pct',
    label: 'Pourcentage de salles de classe en bon état',
    niveaux: ['primaire', 'college', 'lycee'],
    sourceFields: ['sdc_be', 'sdc_me'],
    sourceFieldLabels: {
      sdc_be: 'Salles bon état',
      sdc_me: 'Salles moyen état',
    },
    calculate: (d) => {
      const tot = pf(d.sdc_be) + pf(d.sdc_me);
      return safeDiv(pf(d.sdc_be), tot) * 100;
    },
    sliderDefaults: { range: [0, 100], start: [40, 75] },
    unit: '%',
    isPercentage: true,
    isCount: false,
    polarity: 'higher-better',
  },
  {
    value: 'pers-etab',
    label: 'Personnel enseignant par établissement',
    niveaux: ['primaire', 'college', 'lycee'],
    sourceFields: ['pers_total', 'nbr_etab'],
    sourceFieldLabels: {
      pers_total: 'Personnel enseignant total',
      nbr_etab: "Nombre d'établissements",
    },
    calculate: (d) => safeDiv(pf(d.pers_total), pf(d.nbr_etab)),
    sliderDefaults: { range: [0, 50], start: [3, 10] },
    unit: ' ens/étab',
    isPercentage: false,
    isCount: false,
    polarity: 'neutral',
  },
];

/** Placeholder « choisir un thème » */
export const THEME_PLACEHOLDER = {
  value: '0',
  label: '--Choisir un thème--',
} as const;

/** Indicateurs filtrés par niveau + placeholder en tête */
export function getThemesForNiveau(niveau: Niveau): { value: string; label: string }[] {
  const filtered = INDICATORS.filter((ind) => ind.niveaux.includes(niveau)).map((ind) => ({
    value: ind.value,
    label: ind.label,
  }));
  return [{ value: THEME_PLACEHOLDER.value, label: THEME_PLACEHOLDER.label }, ...filtered];
}

/** Récupère la définition complète d'un indicateur */
export function getIndicator(theme: string): IndicatorDef | undefined {
  return INDICATORS.find((ind) => ind.value === theme);
}

/** Plage et start du slider pour un thème */
export function getSliderDefaults(theme: string): { range: [number, number]; start: [number, number] } {
  const ind = getIndicator(theme);
  return ind?.sliderDefaults ?? { range: [0, 100], start: [25, 75] };
}

/** Calcul du ratio / valeur */
export function calculateRatio(data: Record<string, unknown>, theme: string): number {
  const ind = getIndicator(theme);
  if (!ind) return 0;
  try {
    return ind.calculate(data);
  } catch {
    return 0;
  }
}

/**
 * Classification couleur selon polarité.
 * - lower-better / neutral : < min → blanc, entre → vert, > max → rouge
 * - higher-better          : < min → rouge,  entre → vert, > max → blanc
 *   (haut = bon → blanc ; bas = critique → rouge)
 */
export type ColorClass = 'inf' | 'entre' | 'sup';

export function classifyRatio(
  ratio: number,
  minBound: number,
  maxBound: number,
  polarity: Polarity = 'lower-better',
): ColorClass {
  if (isNaN(ratio) || !Number.isFinite(ratio)) return 'inf';

  if (polarity === 'higher-better') {
    if (ratio < minBound) return 'sup'; // critique bas → traité comme « sup » pour rouge
    if (ratio > maxBound) return 'inf'; // excellent haut → « inf » pour blanc
    return 'entre';
  }

  // lower-better & neutral
  if (ratio < minBound) return 'inf';
  if (ratio > maxBound) return 'sup';
  return 'entre';
}

/** Couleur hex pour la carte (et légende) */
export function getThematicColor(
  ratio: number,
  minBound: number,
  maxBound: number,
  polarity: Polarity = 'lower-better',
): string {
  if (isNaN(ratio) || !Number.isFinite(ratio)) return '#FFFFFF';
  const cls = classifyRatio(ratio, minBound, maxBound, polarity);
  if (cls === 'inf') return '#FFFFFF';
  if (cls === 'sup') return '#FF0000';
  return '#00AA00';
}

/** Libellés de légende cohérents avec la polarité */
export function getLegendLabels(
  minBound: number,
  maxBound: number,
  polarity: Polarity,
  formatValue: (v: number) => string,
  unit: string,
): { white: string; green: string; red: string } {
  const minFmt = formatValue(minBound);
  const maxFmt = formatValue(maxBound);
  const u = unit || '';

  if (polarity === 'higher-better') {
    return {
      white: `Supérieur à ${maxFmt}${u} (meilleur)`,
      green: `[${minFmt} – ${maxFmt}]${u}`,
      red: `Inférieur à ${minFmt}${u} (critique)`,
    };
  }
  return {
    white: `Inférieur à ${minFmt}${u}`,
    green: `[${minFmt} – ${maxFmt}]${u}`,
    red: `Supérieur à ${maxFmt}${u}`,
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

/** Format affichage (fr-FR) — 1 décimale sauf comptages */
export function formatThemeValue(value: number, theme: string): string {
  if (!Number.isFinite(value)) return '—';
  const isCount = isCountTheme(theme);
  const opts: Intl.NumberFormatOptions = isCount
    ? { maximumFractionDigits: 0 }
    : { minimumFractionDigits: 1, maximumFractionDigits: 1 };
  return value.toLocaleString('fr-FR', opts);
}

/** Valeur export : toujours 2 décimales (sauf comptages entiers) */
export function formatExportValue(value: number, theme: string): number | null {
  if (!Number.isFinite(value)) return null;
  if (isCountTheme(theme)) return Math.round(value);
  return Math.round(value * 100) / 100;
}

/** Styles GeoJSON de base */
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

/** Compat : ancien nom THEMES (liste plate) */
export const THEMES = [
  { value: THEME_PLACEHOLDER.value, label: THEME_PLACEHOLDER.label },
  ...INDICATORS.map((i) => ({ value: i.value, label: i.label })),
];