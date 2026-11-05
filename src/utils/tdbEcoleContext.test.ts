import { describe, expect, it } from 'vitest';
import { schoolPresence } from './tdbEcoleContext';

describe('Contexte de la colonne école', () => {
  it('école continue : présence OUI, absence NON', () => {
    expect(schoolPresence(1)).toBe('OUI');
    expect(schoolPresence(0)).toBe('NON');
  });
  it('point d’eau : accepte aussi les comptes transmis en texte', () => {
    expect(schoolPresence('1')).toBe('OUI');
    expect(schoolPresence('0')).toBe('NON');
  });
  it('électricité : présence OUI, absence NON', () => {
    expect(schoolPresence(true)).toBe('OUI');
    expect(schoolPresence(false)).toBe('NON');
  });
  it('ne transforme pas une donnée manquante en NON', () => {
    for (const value of [undefined, null, '', ' ', 'inconnu', -1]) {
      expect(schoolPresence(value)).toBe('-');
    }
  });
});