import { describe, expect, it } from 'vitest';
import { drenCoverage, drenRetention, drenAdmission, drenRepeat, drenPromotion, drenAbandon, drenFormat, drenExamThreshold } from './tdbDrenFormulas';
describe('DREN primary ODS reference', () => {
  it('computes TBS over population 6–10 without an artificial 100% cap', () => {
    expect(drenCoverage({ ressources: { nbr_eleve: 1200 }, population: { pop_6_10: 1000 } })[1].value).toBe(120);
  });
  it('uses age-eligible pupils for TNS, including from the resource block', () => {
    expect(drenCoverage({ eleves_6_10ans: 800, pop_6_10: 1000 })[2].value).toBe(80);
    expect(drenCoverage({ ressources: { eleves_6_10ans: 750 }, population: { pop_6_10: 1000 } })[2].value).toBe(75);
  });
  it('uses six-year-old CP1 pupils for TNA, including from the resource block', () => {
    expect(drenCoverage({ nouveaux_cp1_6ans: 150, pop_6ans: 200 })[3].value).toBe(75);
    expect(drenCoverage({ ressources: { nouveaux_cp1_6ans: 120 }, population: { pop_6ans: 200 } })[3].value).toBe(60);
  });
  it('uses population age 10 for completion, not CP1 enrolment', () => {
    expect(drenCoverage({ ressources: { eff_t5: 100, red_t5: 20, eff_t1: 400 }, population: { pop_10ans: 200 } })[4].value).toBe(40);
  });
  it('computes survival from new-entrant access rates and fixes the base at 100%', () => {
    const e = { ressources: { eff_t1: 200, red_t1: 20, eff_t5: 100, red_t5: 10 }, population: { pop_6ans: 300, pop_10ans: 150 } };
    expect(drenRetention(e, 1)).toBe(100);
    expect(drenRetention(e, 5)).toBe(100);
    expect(drenRetention({ ressources: e.ressources }, 5)).toBeNull();
  });
  it('uses same-sex CM2 enrolment for admitted girls and boys', () => {
    const e = { ressources: { eff_t5: 200, eff_t5_f: 120, eff_t5_g: 80 }, cepe: { admis_f: 60, admis_g: 40, nbr_f: 70, nbr_g: 50 } };
    expect(drenAdmission(e)).toBe(50);
    expect(drenAdmission(e, '_f')).toBe(50);
    expect(drenAdmission(e, '_g')).toBe(50);
  });
  it('uses same-year enrolment for repeaters and preserves a genuine zero', () => {
    expect(drenRepeat({ ressources: { red_t1: 0, eff_t1: 100 } }, 1)).toBe(0);
    expect(drenFormat(0, ' %')).toBe('0,0 %');
    expect(drenFormat(null)).toBe('—');
  });
  it('reprend le taux importé quand les effectifs de redoublants sont absents', () => {
    expect(drenRepeat({ ressources: { red_t1: 0, eff_t1: 100 }, indicateurs: { red_CP1: 12.5 } }, 1)).toBe(12.5);
    expect(drenRepeat({ ressources: { red_g: 0, red_f: 0, nbr_eleve: 1000 }, indicateurs: { red_ensemble: 9.4 } })).toBe(9.4);
    expect(drenRepeat({ ressources: { red_f: 0, red_g: 0, nbr_eleve_f: 400 }, indicateurs: { red_fille: 7.2 } }, undefined, '_f')).toBe(7.2);
  });
  it('requires next-year figures for promotion instead of same-year cross-grade ratios', () => {
    const e = { ressources: { eff_t1: 100, eff_t2: 500, red_t2: 0 }, annee_suivante: { ressources: { eff_t2: 90, red_t2: 10, red_t1: 5 } } };
    expect(drenPromotion(e, 1)).toBe(80);
    expect(drenPromotion({ ressources: e.ressources }, 1)).toBeNull();
    expect(drenAbandon(e, 1)).toBe(15);
  });
  it('retains negative abandonment caused by out-of-cohort entrants for review', () => {
    expect(drenAbandon({ ressources: { eff_t1: 100 }, annee_suivante: { ressources: { eff_t2: 110, red_t2: 0, red_t1: 5 } } }, 1)).toBeCloseTo(-15);
  });
  it('divides imported candidate counts by the exam denominator', () => {
    expect(drenExamThreshold({ indicateurs: { sup_10_mlg: 60 }, cepe: { mlg_sup10: 60, total_candidats: 200 } }, 'mlg_sup10')).toBe(30);
    expect(drenExamThreshold({ cepe: { mlg_sup10: 60, total_candidats: 200 } }, 'mlg_sup10')).toBe(30);
    expect(drenExamThreshold({ indicateurs: { sup_10_mlg: 14300 }, cepe: { mlg_sup10: 14300, total_candidats: 21632 } }, 'mlg_sup10')).toBeCloseTo(66.1, 1);
  });
  it('flags inconsistent exam proportions instead of clamping them to a fabricated 100%', () => {
    expect(drenAdmission({ ressources: { eff_t5: 100 }, cepe: { admis_f: 70, admis_g: 50 } })).toBeNull();
    expect(drenExamThreshold({ cepe: { mlg_sup10: 120, total_candidats: 100 } }, 'mlg_sup10')).toBeNull();
  });
});