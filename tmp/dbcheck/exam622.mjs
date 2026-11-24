import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL });
await c.connect();
const q = async (s) => (await c.query(s)).rows;
for (const t of ['examen_cepe_candidates','examen_bepc_candidates']) {
  console.log(t, await q(`SELECT "ANNEE_SCOLAIRE" y, count(*)::int n,
    count(*) FILTER (WHERE "CODE_ETAB" IS NULL OR "CODE_ETAB"::text='')::int sans_etab,
    count(*) FILTER (WHERE upper(btrim(COALESCE("CISCO",'')))='ANTANIMORA SUD')::int nom_622
    FROM ${t} GROUP BY 1 ORDER BY 1`));
}
await c.end();
