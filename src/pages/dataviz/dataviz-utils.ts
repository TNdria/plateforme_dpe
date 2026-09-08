/**
 * DataViz utilities — réexporte le registre d'indicateurs
 * et conserve les helpers de style / format.
 *
 * Source de vérité : dataviz-indicators.ts
 */

export type { Niveau, Polarity, IndicatorDef, ColorClass } from './dataviz-indicators';

export {
  NIVEAUX,
  INDICATORS,
  THEME_PLACEHOLDER,
  THEMES,
  getThemesForNiveau,
  getIndicator,
  getSliderDefaults,
  calculateRatio,
  classifyRatio,
  getThematicColor,
  getLegendLabels,
  isPercentageTheme,
  isCountTheme,
  getThemeUnit,
  getThemePolarity,
  formatThemeValue,
  formatExportValue,
  STYLE_DREN,
  STYLE_CISCO,
  STYLE_COMMUNE,
} from './dataviz-indicators';