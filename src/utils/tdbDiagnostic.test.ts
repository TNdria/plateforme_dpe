import { describe, it, expect } from 'vitest';
import { buildDiagnostic } from './tdbDiagnostic';

describe('buildDiagnostic', () => {
  it('classe ressources faibles / résultats élevés comme efficient', () => {
    expect(buildDiagnostic({ entityLabel: 'ZAP', score: { x: 40, y: 70 } }).quadrant).toBe('efficient');
  });
  it('classe les goulots selon les seuils 50 / 75', () => {
    const r = buildDiagnostic({ entityLabel: 'CISCO', score: { x: 60, y: 60 }, goulots: [
      { label: 'A', value: 49 }, { label: 'B', value: 75 }, { label: 'C', value: 76 }, { label: 'D', value: null }] });
    expect(r.goulots!.critical.map(g => g.label)).toEqual(['A']);
    expect(r.goulots!.warning.map(g => g.label)).toEqual(['B']);
    expect(r.goulots!.good.map(g => g.label)).toEqual(['C']);
    expect(r.goulots!.missing.map(g => g.label)).toEqual(['D']);
  });
  it('sans score, pas de quadrant', () => {
    expect(buildDiagnostic({ entityLabel: 'École', score: { x: null, y: 50 } }).quadrant).toBeNull();
  });
});
