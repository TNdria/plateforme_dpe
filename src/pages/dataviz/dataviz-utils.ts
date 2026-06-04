/**
 * DataViz utility functions - ratio calculation, color logic, slider ranges
 * Ported from original cartethematique.js
 */

export const THEMES = [
  { value: '0', label: '--Choisir un thème--', group: '' },
  { value: 'hm', label: 'Densité des écoles', group: 'Primaire' },
  { value: 'rem', label: 'Ratio élève-maître', group: 'Primaire' },
  { value: 're-sdc', label: 'Ratio élèves par salle de classe', group: 'Primaire' },
  { value: 'ratio-pa', label: 'Ratio élèves par place assise', group: 'Primaire' },
  { value: 'elec', label: 'Pourcentage des École électrifiée', group: 'Primaire' },
  { value: 'eau', label: "Pourcentage des École avec point d'eau", group: 'Primaire' },
  { value: 'exist-lat-g', label: 'Pourcentage des École ayant des latrines pour garçons', group: 'Primaire' },
  { value: 'exist-lat-f', label: 'Pourcentage des École ayant des latrines pour filles', group: 'Primaire' },
  { value: 'exist-lat', label: 'Pourcentage des École ayant des latrines communes', group: 'Primaire' },
  { value: 'ens-f', label: 'Pourcentage des enseignants Fonctionnaires', group: 'Primaire' },
  { value: 'ens-fsub', label: 'Pourcentage des enseignants FRAM subventionnés', group: 'Primaire' },
  { value: 'ens-fnsub', label: 'Pourcentage des enseignants FRAM non subventionnés et Autres', group: 'Primaire' },
  { value: 'ens-q', label: 'Pourcentage des enseignants qualifiés', group: 'Primaire' },
  { value: 'extra-ens', label: 'Nombre des enseignants en sureffectif', group: 'Primaire' },
] as const;

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
    'ens-f', 'ens-fsub', 'ens-fnsub', 'ens-q'].includes(theme);
}

/** Get unit suffix */
export function getThemeUnit(theme: string): string {
  if (isPercentageTheme(theme)) return '%';
  if (theme === 'rem') return 'élèves/ens';
  if (theme === 're-sdc') return 'élèves/sdc';
  if (theme === 'ratio-pa') return 'élèves/place';
  return '';
}

/** GeoJSON styles for boundary layers */
export const STYLE_DREN = { fillColor: '#4e73df', color: '#4e73df', weight: 1, opacity: 1, fillOpacity: 0.02 };
export const STYLE_CISCO = { fillColor: '#22afbe', color: '#22afbe', weight: 1, opacity: 1, fillOpacity: 0.05 };
export const STYLE_COMMUNE = { fillColor: '#c0c0c0', color: '#c0c0c0', weight: 2, opacity: 1, fillOpacity: 0.03 };
