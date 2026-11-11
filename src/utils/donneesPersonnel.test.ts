import { describe, expect, it } from 'vitest';
import { groupPersonnel, sumPersonnelGroups } from './donneesPersonnel';

describe('regroupements du personnel établissement', () => {
  it('additionne fonctionnaires et contractuels de l’État', () => {
    expect(groupPersonnel({ fonctionnaire: 7, contractuel: 3 }).personnel_etat).toBe(10);
  });
  it('ne compte que les FRAM subventionnés dans les subventionnés', () => {
    expect(groupPersonnel({ fram_sub: 4, fram_nonsub: 8, autres: 2 }).personnel_subventionne).toBe(4);
  });
  it('additionne les FRAM non subventionnés et autres', () => {
    expect(groupPersonnel({ fram_nonsub: '8', autres: '2' }).personnel_non_subventionne).toBe(10);
  });
  it('conserve l’agrégat État quand les contractuels ne sont pas séparés', () => {
    expect(groupPersonnel({ fonctionnaire: 9 }).personnel_etat).toBe(9);
  });
  it('calcule Public, Privé et Total avec les mêmes regroupements', () => {
    expect(sumPersonnelGroups([
      { SECTEUR: 0, fonctionnaire: 7, contractuel: 3, fram_sub: 4, fram_nonsub: 8, autres: 2 },
      { SECTEUR: '1', fonctionnaire: 1, contractuel: 2, fram_sub: 5, fram_nonsub: 6, autres: 3 },
    ])).toEqual([
      { key: 'personnel_etat', public: 10, prive: 3, total: 13 },
      { key: 'personnel_subventionne', public: 4, prive: 5, total: 9 },
      { key: 'personnel_non_subventionne', public: 10, prive: 9, total: 19 },
    ]);
  });
  it('conserve les valeurs absentes', () => {
    expect(groupPersonnel({})).toEqual({ personnel_etat: null, personnel_subventionne: null, personnel_non_subventionne: null });
  });
});