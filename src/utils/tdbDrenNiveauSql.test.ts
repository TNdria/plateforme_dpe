import { describe, expect, it } from 'vitest';
import { executeTdbDrenNiveau } from '../../supabase/functions/db-query/tdbDrenNiveau';

/** Exécute l'action avec un client factice et capture le SQL émis. */
async function captureSql(niveau: 'presco' | 'college' | 'lycee') {
  const queries: string[] = [];
  const client = {
    queryObject: async (q: string) => {
      queries.push(q);
      return { rows: [] };
    },
  };
  const data = await executeTdbDrenNiveau(client, 11, 2026, niveau);
  return { sql: queries.join('\n'), data };
}

describe('getTdbDrenNiveau — colonnes sources', () => {
  it('ne référence aucune colonne redoublant pour le préscolaire', async () => {
    const { sql, data } = await captureSql('presco');
    // PS/MS/GS ne portent que _G et _F : ajouter _REDOUBLANT ferait échouer la requête
    // d'effectifs et remettrait tous les indicateurs du niveau à zéro.
    expect(sql).toContain('e."PS_G"');
    expect(sql).not.toMatch(/_REDOUBLANT/);
    expect(data.dren['0']).toEqual({});
  });

  it('conserve les redoublants du collège et du lycée', async () => {
    const college = await captureSql('college');
    expect(college.sql).toContain('e."T6_G_REDOUBLANT"');
    expect(college.sql).toContain('AS red1_g');

    const lycee = await captureSql('lycee');
    expect(lycee.sql).toContain('e."_2NDE_G_REDOUBLANT"');
  });

  it('fournit le dénominateur du taux de transition (t et t+1)', async () => {
    const college = await captureSql('college');
    expect(college.sql).toContain('AS eff_cycle_actuel');
    expect(college.sql).toContain('AS eff_cycle_precedent');
  });

  it('fournit le nombre total d’EPP pour le taux d’EPP ayant de CAP', async () => {
    const presco = await captureSql('presco');
    expect(presco.sql).toContain('AS nbr_epp');
    expect(presco.sql).toContain('"EXISTE_PRIMAIRE"');
  });
});
