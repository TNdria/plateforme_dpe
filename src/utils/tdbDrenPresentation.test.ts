import { describe, expect, it } from 'vitest';
import { drenReportRead, drenReportSector, drenCellStatus, drenReportFormat } from './tdbDrenPresentation';

describe('DREN report sector provenance', () => {
  it('reads existing CEPE scores from their nested exam block', () => {
    expect(drenReportRead({ cepe: { sm_frs: 8.6, sm_mths: 7.6, sm_total: 8.8 } }, 'sm_frs')).toBe(8.6);
    expect(drenReportRead({ cepe: { sm_total: 8.8 } }, 'sm_total')).toBe(8.8);
  });
  it('does not duplicate public aggregates into ensemble or private columns', () => {
    const entity = { ressources: { nbr_eleve: 200 } };
    expect(drenReportSector(entity, 'public')).toBe(entity);
    expect(drenReportRead(drenReportSector(entity, 'ensemble'), 'nbr_eleve')).toBeNull();
    expect(drenReportRead(drenReportSector(entity, 'prive'), 'nbr_eleve')).toBeNull();
  });
  it('uses explicit all-sector data when provided', () => {
    const entity = { ressources: { nbr_eleve: 200 }, secteurs: { ensemble: { ressources: { nbr_eleve: 350 } } } };
    expect(drenReportRead(drenReportSector(entity, 'ensemble'), 'nbr_eleve')).toBe(350);
  });
  it('preserves imported indicators and genuine zero values', () => {
    expect(drenReportRead({ indicateurs: { etab_eau: 0 }, ressources: { etab_eau: 8 } }, 'etab_eau')).toBe(0);
  });
});
describe('DREN specification statuses', () => {
  it('missing remains distinct from a genuine zero', () => {
    expect(drenCellStatus(null, 0)).toBe('missing');
    expect(drenCellStatus(0, 0)).toBe('ok');
  });
  it('higher repetition is attention', () => expect(drenCellStatus(35.1, 26.1, 'lower', 100)).toBe('attention'));
  it('lower abandonment than MADA is normal', () => expect(drenCellStatus(8.3, 10.6, 'lower', 100)).toBe('ok'));
  it('lower promotion is attention', () => expect(drenCellStatus(55.7, 63.8, 'higher', 100)).toBe('attention'));
  it('negative abandonment is review, not missing', () => expect(drenCellStatus(-3.2, 7.6, 'lower', 100)).toBe('review'));
  it('promotion >100 is review but TBS may exceed 100', () => {
    expect(drenCellStatus(101.2, 87.6, 'higher', 100)).toBe('review');
    expect(drenCellStatus(156.9, 136.2, 'higher')).toBe('ok');
  });
  it('report numbers keep negative signs and the requested decimal point', () => expect(drenReportFormat(-3.2, '%')).toBe('-3.2%'));
});