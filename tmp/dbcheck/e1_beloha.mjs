import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL });
await c.connect();
const q = async (s) => (await c.query(s)).rows;
const col = (x) => `COALESCE(NULLIF("${x}",'')::numeric,0)`;
const P = ['T1_G','T1_F','T2_G','T2_F','T3_G','T3_F','T4_G','T4_F','T5_G','T5_F'].map(col).join('+');
console.log('par cisco:', await q(`
SELECT "CODE_CISCO", count(*)::int etabs, count(*) FILTER (WHERE ${P}>0)::int avec_eleves,
  sum(${P})::int eleves,
  round(sum(${P})/NULLIF(count(*) FILTER (WHERE ${P}>0),0),1) moy_par_ecole
FROM fpe_e1 WHERE "ANNEE_SCOLAIRE"=2026 AND "CODE_DREN"=61 GROUP BY 1 ORDER BY 1`));
console.log('top 6 ecoles 609:', await q(`
SELECT "CODE_ETAB","NOM_ETAB", ${P}::int tot
FROM fpe_e1 WHERE "ANNEE_SCOLAIRE"=2026 AND "CODE_CISCO"=609 ORDER BY tot DESC LIMIT 6`));
console.log('top 6 ecoles 604:', await q(`
SELECT "CODE_ETAB","NOM_ETAB", ${P}::int tot
FROM fpe_e1 WHERE "ANNEE_SCOLAIRE"=2026 AND "CODE_CISCO"=604 ORDER BY tot DESC LIMIT 6`));
console.log('tbs par dren:', await q(`
WITH el AS (SELECT "CODE_DREN" d, sum(${P}) e FROM fpe_e1 WHERE "ANNEE_SCOLAIRE"=2026 GROUP BY 1),
     pp AS (SELECT code_dren d, sum(pop_6_ans+pop_7_ans+pop_8_ans+pop_9_ans+pop_10_ans) p FROM population_2025 GROUP BY 1)
SELECT el.d, el.e::int, pp.p::int, round(100.0*el.e/NULLIF(pp.p,0),1) tbs FROM el JOIN pp USING (d) ORDER BY 4 DESC LIMIT 10`));
await c.end();
