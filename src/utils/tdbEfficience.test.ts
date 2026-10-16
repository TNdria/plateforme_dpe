import { describe, expect, it } from 'vitest';
import { normaliser, computeEfficience, tdbIndicators, bottleneckStatus } from './tdbEfficience';
const row = { ratio_em: 60, ratio_eq: 80, eleve_2km: 90, point_eau: 60, electricite: 30,
  ratio_ece: 10000, mlg_sc1: 70, mlg_sc2: 60, fr_sc1: 50, fr_sc2: 40, maths_sc1: 30,
  maths_sc2: 20, red_ensemble: 10, txRetentionTotal: 60, TPA: 80, tx_admis: 90 };
describe('TDB specification scoring', () => {
  it('uses inverse normalization from section 8.1', () => {
    expect(normaliser(60, 45, 60)).toBe(87.5);
    expect(normaliser(2, 1, 1)).toBe(50);
    expect(normaliser(0, 45, 60)).toBe(0);
    expect(normaliser(null, 45, 60)).toBeNull();
  });
  it('reads imported indicators before aggregate fields', () => {
    expect(tdbIndicators({ indicateurs: row, ressources: { nbr_eleve: 0 } }, 'cisco').rem).toBe(60);
    expect(computeEfficience({ indicateurs: row }, 'cisco')).toEqual({ x: 35.1, y: 80 });
  });
  it('includes TPA only for school results and respects zero values', () => {
    expect(computeEfficience({ ...row, point_eau: 'OUI', electricite: 'NON' }, 'ecole').y).toBe(80);
    expect(computeEfficience({ ...row, TPA: 0 }, 'ecole').y).toBe(60);
    expect(computeEfficience({ ...row, TPA: 0 }, 'zap').y).toBe(80);
  });
  it('does not invent a score when data is unavailable', () => {
    expect(computeEfficience({})).toEqual({ x: null, y: null });
    expect(tdbIndicators({ ressources: { eff_t1: 100, eff_t5: 60 } }).retention).toBeNull();
  });
  it('makes cash and manual scores increase with resources', () => {
    const low = computeEfficience(row, 'cisco').x;
    const high = computeEfficience({ ...row, ratio_ece: 20000, mlg_sc1: 100 }, 'cisco').x;
    expect(Number(high)).toBeGreaterThan(Number(low));
  });
  it('handles exact bottleneck thresholds', () => {
    expect([null, 49.9, 50, 75, 75.1].map(bottleneckStatus)).toEqual(['missing', 'critical', 'warning', 'warning', 'good']);
  });
});