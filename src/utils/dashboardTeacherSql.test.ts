import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Execute the actual query builder without importing the Deno server entry point.
const source = readFileSync('supabase/functions/db-query/index.ts', 'utf8');
const start = source.indexOf('async function executeStatsEnseignants(');
const end = source.indexOf('\nasync function executeStatsPlaces(', start);
const functionSource = source.slice(start, end).replace(
  'client: Client, codeDren: number, codeCisco: number, secteur: number',
  'client, codeDren, codeCisco, secteur',
);
const execute = new Function('getAvailableYearsFromDB', 'si', `${functionSource}; return executeStatsEnseignants;`)(
  async () => [2025, 2026],
  (column: string) => `COALESCE(NULLIF(${column}::text, '')::integer, 0)`,
);

async function captureQuery(codeDren = 0, codeCisco = 0, secteur = 2) {
  let sql = '';
  await execute({ queryObject: async (query: string) => { sql = query; return { rows: [] }; } }, codeDren, codeCisco, secteur);
  return sql;
}

describe('Dashboard — enseignants en salle', () => {
  for (const [level, column] of [
    ['N0', 'PRESCO'], ['N1', 'PRIMAIRE'], ['N2', 'COLLEGE'], ['N3', 'LYCEE'],
  ]) {
    it(`${level} exige le niveau tenu = 1 et EN_SALLE = 1`, async () => {
      const sql = await captureQuery();
      for (const year of [2025, 2026]) {
        expect(sql).toContain(`SUM(CASE WHEN p1."NIVEAU_TENU_${column}"='1' AND p1."ANNEE_SCOLAIRE" = ${year} THEN 1 ELSE 0 END) AS "${level}_${year}"`);
      }
      expect(sql).toMatch(/FROM fpe_p1 p1 WHERE[^;]*AND COALESCE\(NULLIF\(p1\."EN_SALLE"::text, ''\)::integer, 0\) = 1/);
    });
  }

  it('exclut le personnel administratif (EN_SALLE = 0) sans filtre supplémentaire de statut ou existence du niveau', async () => {
    const sql = await captureQuery();
    expect(sql).toContain('::integer, 0) = 1');
    expect(sql).not.toMatch(/CODE_STATUT|EXISTE_|JOIN/);
  });

  it('conserve les filtres DREN, CISCO et secteur', async () => {
    expect(await captureQuery(11, 0, 0)).toContain('p1."SECTEUR" = 0');
    expect(await captureQuery(11, 0, 0)).toContain('AND p1."CODE_DREN" = 11');
    expect(await captureQuery(11, 1101, 1)).toContain('AND p1."CODE_CISCO" = 1101');
    expect(await captureQuery(11, 1101, 1)).toContain('p1."SECTEUR" = 1');
  });
});