import { describe, expect, it } from 'vitest';
import { resolveDonneesScope } from './donneesScope';

describe('Périmètre par défaut du module Données', () => {
  it('visiteur non connecté : national, filtres libres', () => {
    const scope = resolveDonneesScope(null);
    expect(scope.level).toBe('national');
    expect(scope.defaultDren).toBe('0');
    expect(scope.defaultCisco).toBe('0');
    expect(scope.drenLocked).toBe(false);
    expect(scope.ciscoLocked).toBe(false);
  });

  it('profil national (admin) : national même avec un rattachement', () => {
    const scope = resolveDonneesScope({ dren: 3, cisco: 12, is_superuser: true });
    expect(scope.level).toBe('national');
    expect(scope.defaultDren).toBe('0');
    expect(scope.defaultCisco).toBe('0');
  });

  it('profil DREN : DREN verrouillée, CISCO libre', () => {
    const scope = resolveDonneesScope({ dren: '4', cisco: '0' });
    expect(scope.level).toBe('dren');
    expect(scope.defaultDren).toBe('4');
    expect(scope.defaultCisco).toBe('0');
    expect(scope.drenLocked).toBe(true);
    expect(scope.ciscoLocked).toBe(false);
  });

  it('profil CISCO : DREN et CISCO verrouillées', () => {
    const scope = resolveDonneesScope({ dren: '4', cisco: '27' });
    expect(scope.level).toBe('cisco');
    expect(scope.defaultDren).toBe('4');
    expect(scope.defaultCisco).toBe('27');
    expect(scope.drenLocked).toBe(true);
    expect(scope.ciscoLocked).toBe(true);
  });

  it('utilisateur authentifié sans rattachement : national', () => {
    const scope = resolveDonneesScope({ dren: 0, cisco: 0 });
    expect(scope.level).toBe('national');
    expect(scope.drenLocked).toBe(false);
    expect(scope.ciscoLocked).toBe(false);
  });

  it('la clé change avec le périmètre pour déclencher le rechargement', () => {
    expect(resolveDonneesScope(null).key).not.toBe(resolveDonneesScope({ dren: 4 }).key);
    expect(resolveDonneesScope({ dren: 4 }).key).not.toBe(
      resolveDonneesScope({ dren: 4, cisco: 27 }).key,
    );
  });
});
