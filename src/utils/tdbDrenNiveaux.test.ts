import { describe, it, expect } from 'vitest';
import { val, effectifNiveaux, tauxRedoublement, tauxPromotion, tauxAbandon, retentionProfile, disparite, tauxTransition } from './tdbDrenNiveaux';

const d = { '0': { eff1_g: 60, eff1_f: 40, red1_g: 6, red1_f: 4, eff2_g: 50, eff2_f: 30, red2_g: 0, red2_f: 0 }, '1': { eff1_g: 10, eff1_f: 10, red1_g: 0, red1_f: 0, eff2_g: 0, eff2_f: 0, red2_g: 0, red2_f: 0 } };
const next = { '0': { eff1_g: 0, eff1_f: 0, red1_g: 5, red1_f: 5, eff2_g: 50, eff2_f: 40, red2_g: 5, red2_f: 5 }, '1': {} };

describe('TDB DREN niveaux', () => {
  it('reads numeric strings without replacing missing values with zero', () => {
    expect(val({ '0': { salles: '1 215', sections: '1214' }, '1': {} }, 'salles', '0')).toBe(1215);
    expect(val({ '0': { salles: '' }, '1': {} }, 'salles', '0')).toBeNull();
  });
  it('ensemble = public + privé', () => expect(val(d, 'eff1_g', 'ens')).toBe(70));
  it('additionne une plage de niveaux sans remplacer une absence par zéro', () => {
    expect(effectifNiveaux(d, '0', [1, 2])).toBe(180);
    expect(effectifNiveaux(d, '0', [1, 2], 'f')).toBe(70);
    expect(effectifNiveaux({ '0': { eff1_g: 10 }, '1': {} }, '0', [1, 2])).toBeNull();
  });
  it('transition t → t+1 : entrants de l’année suivante ÷ effectif du cycle précédent (t)', () => {
    const cur = { '0': { eff1_g: 90, eff1_f: 90, red1_g: 10, red1_f: 10, eff_cycle_actuel: 1000, eff_cycle_precedent: 800 }, '1': {} };
    const next = { '0': { eff1_g: 100, eff1_f: 100, red1_g: 0, red1_f: 0 }, '1': {} };
    expect(tauxTransition(cur, '0', 2, next)).toBe(20);
    expect(tauxTransition(cur, '0', 2, null)).toBe(20);
  });
  it('redoublement niveau 1 public = 10 %', () => expect(tauxRedoublement(d, '0', 2, 1)).toBe(10));
  it('promotion niveau 1 public = (90-10)/100 = 80 %', () => expect(tauxPromotion(d, next, '0', 1)).toBe(80));
  it('abandon = 100 - promotion - redoublement t+1 = 10 %', () => expect(tauxAbandon(d, next, '0', 1)).toBe(10));
  it('promotion sans année suivante = null', () => expect(tauxPromotion(d, null, '0', 1)).toBeNull());
  it('rétention: taux d’accès par âge officiel, pas un rapport d’effectifs', () => expect(retentionProfile(d, '0', 2, { p0: 100, p1: 200 })[1]).toBeCloseTo(44.4, 1));
  it('rétention sans populations = indisponible', () => expect(retentionProfile(d, '0', 2)[1]).toBeNull());
  it('conserve promotion >100 et abandon négatif', () => {
    const nx = { '0': { eff2_g: 120, eff2_f: 0, red2_g: 0, red2_f: 0, red1_g: 5, red1_f: 0 }, '1': {} };
    expect(tauxPromotion(d, nx, '0', 1)).toBe(120);
    expect(tauxAbandon(d, nx, '0', 1)).toBe(-25);
  });
  it('disparité réussite : seuil 0.9 inclus sans disparité', () => expect(disparite(90, 100, true)).toBeNull());
  it('disparité réussite : ratio inférieur à 0.9 défavorise filles', () => expect(disparite(89, 100, true)).toBe('F'));
  it('disparité réussite : ratio supérieur à 1 défavorise garçons', () => expect(disparite(101, 100, true)).toBe('G'));
  it('disparité aux dépens des filles quand leur redoublement est plus élevé', () => expect(disparite(12, 8, false)).toBe('F'));
});
