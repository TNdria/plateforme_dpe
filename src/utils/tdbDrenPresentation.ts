import { drenRead } from './tdbDrenFormulas';
import { drenNumber } from './tdbDrenFormulas';

export type IndicatorSense = 'higher' | 'lower' | 'neutral';
const isMissingToken = (value: unknown) => typeof value === 'string' && /^(?:n\/a|na|nd|non disponible|null|undefined|\s*)$/i.test(value.trim());

export function drenCellStatus(value: unknown, national: unknown, sense?: IndicatorSense, max?: number) {
  const v = drenNumber(value), m = drenNumber(national);
  if (v === null) return 'missing';
  if (v < 0 || (max !== undefined && v > max)) return 'review';
  if (sense === 'neutral' || !sense) return 'ok';
  return m !== null && (sense === 'higher' ? v < m : v > m) ? 'attention' : 'ok';
}
export function drenReportFormat(value: unknown, unit = '', digits = 1) {
  const v = drenNumber(value);
  return v === null ? '0' : new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v).replace(/,/g, ' ') + unit;
}

// The current DREN endpoint's base aggregates are public-sector data.
// An absent sector must never be presented as an all-sector aggregate.
export function drenReportSector(entity: any, sector: 'public' | 'prive' | 'ensemble') {
  if (sector === 'public') return entity?.public ?? entity?.secteurs?.public ?? entity ?? {};
  return entity?.[sector] ?? entity?.secteurs?.[sector] ?? {};
}

function asDrenLookupSources(entity: any) {
  if (!entity || typeof entity !== 'object') return [];
  const sources = [
    entity?.indicateurs,
    entity?.indicators,
    entity?.population,
    entity?.cepe,
    entity?.finances,
    entity?.ueas,
    entity?.data,
    entity?.ressources,
    entity?.personnel,
    entity?.sections,
    entity?.places,
    entity?.caisse,
    entity?.manuels,
    entity,
  ];
  const sectors = entity?.secteurs && typeof entity.secteurs === 'object' ? Object.values(entity.secteurs) : [];
  const aliases = [entity?.public, entity?.prive, entity?.ensemble];
  return [...sources, ...sectors, ...aliases.filter(Boolean)];
}

export function drenReportRead(entity: any, ...keys: string[]) {
  if (!entity || keys.length === 0) return null;
  const lookup = { ...entity, data: {
    ...entity?.ressources, ...entity?.personnel, ...entity?.sections,
    ...entity?.places, ...entity?.caisse, ...entity?.manuels, ...entity?.cepe, ...entity?.finances, ...entity?.data,
  } };
  const searchIn = asDrenLookupSources(entity).concat(lookup);
  for (const source of searchIn) {
    if (!source || typeof source !== 'object') continue;
    for (const key of keys) {
      const match = Object.keys(source).find((candidate) => {
        const normalized = candidate.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const wanted = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return normalized === wanted;
      });
      if (match) {
        const value = source[match];
        if (isMissingToken(value)) continue;
        const numeric = drenNumber(value);
        if (numeric !== null) return numeric;
      }
    }
  }
  return drenRead(lookup, ...keys);
}