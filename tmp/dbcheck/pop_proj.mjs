import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL });
await c.connect();
const q = async (s) => (await c.query(s)).rows;
console.log('61 2026:', await q(`SELECT code_cisco, cisco, (t_6+t_7+t_8+t_9+t_10)::int p610, t_6::int FROM tdb_population_cisco WHERE annee=2026 AND code_dren=61 ORDER BY 1`));
console.log('622 present?', await q(`SELECT count(*)::int FROM tdb_population_cisco WHERE code_cisco=622`));
console.log('dren 2026 exists?', await q(`SELECT code_dren, (t_6+t_7+t_8+t_9+t_10)::int p610 FROM tdb_population_dren WHERE annee=2026 AND code_dren=61`));
console.log('TBS dren 2026 with proj:', await q(`
WITH el AS (SELECT "CODE_DREN" d, sum(COALESCE(NULLIF("T1_G",'')::numeric,0)+COALESCE(NULLIF("T1_F",'')::numeric,0)+COALESCE(NULLIF("T2_G",'')::numeric,0)+COALESCE(NULLIF("T2_F",'')::numeric,0)+COALESCE(NULLIF("T3_G",'')::numeric,0)+COALESCE(NULLIF("T3_F",'')::numeric,0)+COALESCE(NULLIF("T4_G",'')::numeric,0)+COALESCE(NULLIF("T4_F",'')::numeric,0)+COALESCE(NULLIF("T5_G",'')::numeric,0)+COALESCE(NULLIF("T5_F",'')::numeric,0)) e FROM fpe_e1 WHERE "ANNEE_SCOLAIRE"=2026 GROUP BY 1),
 pp AS (SELECT code_dren d, sum(t_6+t_7+t_8+t_9+t_10) p FROM tdb_population_cisco WHERE annee=2026 GROUP BY 1)
SELECT el.d, el.e::int, pp.p::int, round(100.0*el.e/NULLIF(pp.p,0),1) tbs FROM el JOIN pp USING (d) ORDER BY 4 DESC LIMIT 6`));
await c.end();
