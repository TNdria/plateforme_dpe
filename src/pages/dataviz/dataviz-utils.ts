/**
 * DataViz utility functions - ratio calculation, color logic, slider ranges
 * Ported from original cartethematique.js
 */

export type Niveau = 'primaire' | 'college' | 'lycee';

export const NIVEAUX: { value: Niveau; label: string }[] = [
  { value: 'primaire', label: 'Primaire (EPP)' },
  { value: 'college', label: 'Collège (CEG)' },
  { value: 'lycee', label: 'Lycée' },
];

type ThemeEntry = { value: string; label: string; niveaux: Niveau[] };

export const ALL_THEMES: ThemeEntry[] = [
  { value: '0', label: '--Choisir un thème--', niveaux: ['primaire', 'college', 'lycee'] },
  { value: 'hm', label: 'Densité des écoles', niveaux: ['primaire', 'college', 'lycee'] },
  { value: 'rem', label: 'Ratio élève-maître', niveaux: ['primaire', 'college', 'lycee'] },
  { value: 're-sdc', label: 'Ratio élèves par salle de classe', niveaux: ['primaire', 'college', 'lycee'] },
  { value: 'ratio-pa', label: 'Ratio élèves par place assise', niveaux: ['primaire', 'college', 'lycee'] },
  { value: 'elec', label: 'Pourcentage des écoles électrifiées', niveaux: ['primaire', 'college', 'lycee'] },
  { value: 'eau', label: "Pourcentage des écoles avec point d'eau", niveaux: ['primaire', 'college', 'lycee'] },
  { value: 'exist-lat-g', label: 'Pourcentage des écoles ayant des latrines pour garçons', niveaux: ['primaire', 'college', 'lycee'] },
  { value: 'exist-lat-f', label: 'Pourcentage des écoles ayant des latrines pour filles', niveaux: ['primaire', 'college', 'lycee'] },
  { value: 'exist-lat', label: 'Pourcentage des écoles ayant des latrines communes', niveaux: ['primaire', 'college', 'lycee'] },
  { value: 'ens-f', label: 'Pourcentage des enseignants Fonctionnaires', niveaux: ['primaire', 'college', 'lycee'] },
  { value: 'ens-fsub', label: 'Pourcentage des enseignants FRAM subventionnés', niveaux: ['primaire'] },
  { value: 'ens-fnsub', label: 'Pourcentage des enseignants FRAM non subventionnés et Autres', niveaux: ['primaire'] },
  { value: 'ens-q', label: 'Pourcentage des enseignants qualifiés', niveaux: ['primaire', 'college', 'lycee'] },
  { value: 'extra-ens', label: 'Nombre des enseignants en sureffectif', niveaux: ['primaire', 'college', 'lycee'] },
  // ── Nouveaux indicateurs (ajoutés suite à la consolidation) ──
  { value: 'nbr-etab', label: "Nombre d'établissements", niveaux: ['primaire', 'college', 'lycee'] },
  { value: 'eff-total', label: "Effectif total des élèves", niveaux: ['primaire', 'college', 'lycee'] },
  { value: 're-etab', label: "Ratio élèves par établissement", niveaux: ['primaire', 'college', 'lycee'] },
  { value: 'sdc-be-pct', label: "Pourcentage de salles de classe en bon état", niveaux: ['primaire', 'college', 'lycee'] },
  { value: 'pers-etab', label: "Personnel enseignant par établissement", niveaux: ['primaire', 'college', 'lycee'] },
];

/** Backward compat: themes filtered by current niveau */
export const THEMES = ALL_THEMES;

export function getThemesForNiveau(niveau: Niveau): ThemeEntry[] {
  return ALL_THEMES.filter(t => t.niveaux.includes(niveau));
}

/** Get default slider range and start values per theme */
export function getSliderDefaults(theme: string): { range: [number, number]; start: [number, number] } {
  switch (theme) {
    case 'hm': return { range: [1, 1], start: [1, 1] };
    case 'rem': return { range: [0, 100], start: [25, 50] };
    case 're-sdc': return { range: [0, 100], start: [25, 60] };
    case 'ratio-pa': return { range: [0, 10], start: [0, 1] };
    case 'elec': case 'eau': return { range: [0, 100], start: [50, 75] };
    case 'exist-lat-g': case 'exist-lat-f': case 'exist-lat':
    case 'ens-f': case 'ens-fsub': case 'ens-fnsub':
      return { range: [0, 100], start: [30, 60] };
    case 'ens-q': return { range: [0, 100], start: [35, 75] };
    case 'extra-ens': return { range: [0, 20], start: [1, 2] };
    // Nouveaux indicateurs
    case 'nbr-etab': return { range: [0, 2000], start: [50, 500] };
    case 'eff-total': return { range: [0, 200000], start: [5000, 50000] };
    case 're-etab': return { range: [0, 1000], start: [100, 400] };
    case 'sdc-be-pct': return { range: [0, 100], start: [40, 75] };
    case 'pers-etab': return { range: [0, 50], start: [3, 10] };
    default: return { range: [0, 100], start: [25, 75] };
  }
}

/** Calculate ratio from data row based on selected theme - matches original calculateRatio */
export function calculateRatio(data: any, theme: string): number {
  const safeDiv = (a: number, b: number) => b === 0 ? 0 : a / b;
  const pf = (v: any) => parseFloat(v) || 0;
  const pi = (v: any) => parseInt(v) || 0;

  switch (theme) {
    case 'rem':
      return safeDiv(pf(data.eff_2025), pf(data.en_classe));
    case 're-sdc': {
      const sdc = pf(data.sdc_be) + pf(data.sdc_me);
      return safeDiv(pf(data.eff_2025), sdc);
    }
    case 'ratio-pa':
      return safeDiv(pf(data.eff_2025), pf(data.places));
    case 'elec':
      return Math.round(safeDiv(pf(data.elec), pf(data.nbr_etab)) * 100);
    case 'eau':
      return Math.round(safeDiv(pf(data.eau), pf(data.nbr_etab)) * 100);
    case 'exist-lat-g':
      return Math.round(safeDiv(pi(data.latrine_g), pf(data.nbr_etab)) * 100);
    case 'exist-lat-f':
      return Math.round(safeDiv(pi(data.latrine_f), pf(data.nbr_etab)) * 100);
    case 'exist-lat':
      return Math.round(safeDiv(pi(data.latrine), pf(data.nbr_etab)) * 100);
    case 'ens-f':
      return safeDiv(pi(data.fonct), pf(data.pers_total)) * 100;
    case 'ens-fsub':
      return safeDiv(pi(data.fs), pf(data.pers_total)) * 100;
    case 'ens-fnsub':
      return safeDiv(pi(data.fns), pf(data.pers_total)) * 100;
    case 'ens-q':
      return safeDiv(pi(data.qualifiee), pf(data.pers_total)) * 100;
    case 'extra-ens': {
      const sdcE = pf(data.sdc_be) + pf(data.sdc_me);
      return pi(data.en_classe) - (sdcE * 2);
    }
    // Nouveaux indicateurs
    case 'nbr-etab':
      return pf(data.nbr_etab);
    case 'eff-total':
      return pf(data.eff_2025);
    case 're-etab':
      return safeDiv(pf(data.eff_2025), pf(data.nbr_etab));
    case 'sdc-be-pct': {
      const tot = pf(data.sdc_be) + pf(data.sdc_me);
      return safeDiv(pf(data.sdc_be), tot) * 100;
    }
    case 'pers-etab':
      return safeDiv(pf(data.pers_total), pf(data.nbr_etab));
    default:
      return 0;
  }
}

/** 3-color scheme based on slider bounds - matches original getColor */
export function getThematicColor(ratio: number, minBound: number, maxBound: number): string {
  if (isNaN(ratio)) return '#FFFFFF';
  if (ratio < minBound) return '#FFFFFF'; // Below min = white
  if (ratio > maxBound) return '#FF0000'; // Above max = red
  return '#00AA00'; // In range = green
}

/** Check if theme is a percentage indicator */
export function isPercentageTheme(theme: string): boolean {
  return ['elec', 'eau', 'exist-lat-g', 'exist-lat-f', 'exist-lat',
    'ens-f', 'ens-fsub', 'ens-fnsub', 'ens-q', 'sdc-be-pct'].includes(theme);
}

/** Check if theme is an integer count (no decimals) */
export function isCountTheme(theme: string): boolean {
  return ['nbr-etab', 'eff-total', 'extra-ens'].includes(theme);
}

/** Get unit suffix */
export function getThemeUnit(theme: string): string {
  if (isPercentageTheme(theme)) return '%';
  if (theme === 'rem') return ' élèves/ens';
  if (theme === 're-sdc') return ' élèves/sdc';
  if (theme === 'ratio-pa') return ' élèves/place';
  if (theme === 're-etab') return ' élèves/étab';
  if (theme === 'pers-etab') return ' ens/étab';
  if (theme === 'nbr-etab') return ' étab';
  if (theme === 'eff-total') return ' élèves';
  if (theme === 'extra-ens') return ' ens.';
  return '';
}

/** Format a numeric value for the carte thématique (fr-FR thousands separator, smart decimals). */
export function formatThemeValue(value: number, theme: string): string {
  if (!Number.isFinite(value)) return '—';
  const isCount = isCountTheme(theme);
  const opts: Intl.NumberFormatOptions = isCount
    ? { maximumFractionDigits: 0 }
    : { minimumFractionDigits: 1, maximumFractionDigits: 1 };
  return value.toLocaleString('fr-FR', opts);
}


/** GeoJSON styles for boundary layers */
export const STYLE_DREN = { fillColor: '#4e73df', color: '#4e73df', weight: 1, opacity: 1, fillOpacity: 0.02 };
export const STYLE_CISCO = { fillColor: '#22afbe', color: '#22afbe', weight: 1, opacity: 1, fillOpacity: 0.05 };
export const STYLE_COMMUNE = { fillColor: '#c0c0c0', color: '#c0c0c0', weight: 2, opacity: 1, fillOpacity: 0.03 };
