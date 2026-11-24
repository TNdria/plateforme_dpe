import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL });
await c.connect();
const q = async (s) => (await c.query(s)).rows;
console.log('e1 cols:', (await q(`SELECT column_name FROM information_schema.columns WHERE table_name='fpe_e1' ORDER BY ordinal_position`)).map(r=>r.column_name).join(', '));
console.log('sample 609:', await q(`SELECT * FROM fpe_e1 WHERE "ANNEE_SCOLAIRE"=2026 AND "CODE_DREN"=61 AND "CODE_CISCO"=609 LIMIT 2`));
console.log('pupils per cisco DREN 61 (2026):', await q(`
SELECT "CODE_CISCO", count(*)::int etabs, sum("ELEVES_PRIMAIRE"::numeric)::int tot
FROM fpe_e1 WHERE "ANNEE_SCOLAIRE"=2026 AND "CODE_DREN"=61 GROUP BY 1 ORDER BY 1`));
console.log('pop tables cisco 609/622:');
for (const t of ['population','population_rgph','tdb_population_cisco']) {
  try { console.log(t, await q(`SELECT * FROM ${t} LIMIT 2`)); } catch(e) { console.log(t, 'ERR', e.message.split('\n')[0]); }
}
await c.end();
