import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL });
await c.connect();
const q = async (s) => (await c.query(s)).rows;
console.log(await q(`
WITH a AS (SELECT code_dren d, sum(pop_6_ans+pop_7_ans+pop_8_ans+pop_9_ans+pop_10_ans) p FROM population_2025 GROUP BY 1),
     b AS (SELECT code_dren d, sum(t_6+t_7+t_8+t_9+t_10) p FROM tdb_population_cisco WHERE annee=2026 GROUP BY 1)
SELECT a.d, a.p::int pop2025, b.p::int proj2026, round(100.0*a.p/b.p,1) ratio FROM a JOIN b USING (d) ORDER BY 4`));
await c.end();
