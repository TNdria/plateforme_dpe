/**
 * Normalisation à l'entrée du dataset Diagnostic.
 *
 * Le dataset a connu deux formes selon la version du service interrogé :
 *  - `places` : un simple nombre par niveau (ancienne fonction déployée) ou
 *    `{ total }` (version courante) ;
 *  - `eleves[<niveau>]` : seulement `g`/`f` (ancienne version) ou bien
 *    `g`/`f` + `garcons`/`filles` (version courante, consommés par les vues
 *    Monographie et Qualité).
 *
 * On rend les deux compatibles pour que l'affichage (places assises, « dont
 * filles ») ne dépende pas de la version du service, et on conserve
 * `undefined` quand la valeur est réellement absente (affichée « — »,
 * jamais 0).
 */
export const LEVEL_KEYS = ['presco', 'primaire', 'college', 'lycee'] as const;

export function normalizePlacesValue(value: unknown): { total: number | undefined } {
  if (typeof value === 'number' && Number.isFinite(value)) return { total: value };
  if (value && typeof value === 'object' && typeof (value as any).total === 'number') {
    return { total: (value as any).total };
  }
  return { total: undefined };
}

const count = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

export function normalizeElevesLevel(level: unknown): unknown {
  if (!level || typeof level !== 'object') return level;
  const lv = level as Record<string, any>;
  const filles = count(lv.filles) ?? count(lv.f);
  const garcons = count(lv.garcons) ?? count(lv.g);
  return {
    ...lv,
    ...(filles !== undefined ? { filles } : {}),
    ...(garcons !== undefined ? { garcons } : {}),
  };
}

export function normalizeDiagnosticDataset<T extends Record<string, any> | undefined>(dataset: T): T {
  const annees = dataset?.annees;
  if (!annees || typeof annees !== 'object') return dataset;
  for (const year of Object.keys(annees)) {
    const entry = annees[year];
    if (!entry || typeof entry !== 'object') continue;

    const places = entry.places;
    if (places && typeof places === 'object') {
      entry.places = {
        presco: normalizePlacesValue(places.presco),
        primaire: normalizePlacesValue(places.primaire),
        college: normalizePlacesValue(places.college),
        lycee: normalizePlacesValue(places.lycee),
      };
    }

    const eleves = entry.eleves;
    if (eleves && typeof eleves === 'object') {
      for (const key of LEVEL_KEYS) {
        if (eleves[key]) eleves[key] = normalizeElevesLevel(eleves[key]);
      }
    }
  }
  return dataset;
}
