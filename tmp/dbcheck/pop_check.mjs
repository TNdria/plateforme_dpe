import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL });
await c.connect();
const q = async (s) => (await c.query(s)).rows;
console.log('AGES 61:');
console.log(await q(`
SELECT p.code_cisco, p.code_dren, p.pop_5_ans, p.pop_6_ans, p.pop_7_ans, p.pop_8_ans, p.pop_9_ans, p.pop_10_ans, p.pop_11_ans,
  (p.pop_0_ans+p.pop_1_an+p.pop_2_ans+p.pop_3_ans+p.pop_4_ans+p.pop_5_ans+p.pop_6_ans+p.pop_7_ans+p.pop_8_ans+p.pop_9_ans+p.pop_10_ans+p.pop_11_ans+p.pop_12_ans+p.pop_13_ans+p.pop_14_ans+p.pop_15_ans+p.pop_16_ans+p.pop_17_ans+p.pop_18_ans+p.pop_19_ans+p.pop_20_ans+p.pop_21_ans+p.pop_22_ans+p.pop_23_ans+p.pop_24_ans) AS somme_0_24, p.pop_total
FROM population_2025 p WHERE p.code_dren=61 ORDER BY 1`));
console.log('TBS par cisco DREN 61 (primaire 2026 / pop 6-10):');
console.log(await q(`
WITH el AS (SELECT "CODE_CISCO" cis, count(DISTINCT "CODE_ETAB") etabs FROM fpe_e1 WHERE "ANNEE_SCOLAIRE"=2026 AND "CODE_DREN"=61 GROUP BY 1)
SELECT p.code_cisco, el.etabs,
  (p.pop_6_ans+p.pop_7_ans+p.pop_8_ans+p.pop_9_ans+p.pop_10_ans) AS pop610
FROM population_2025 p LEFT JOIN el ON el.cis = p.code_cisco::int WHERE p.code_dren=61 ORDER BY 1`));
console.log('National TBS check:');
console.log(await q(`
SELECT (SELECT count(*)::int FROM fpe_e1 WHERE "ANNEE_SCOLAIRE"=2026) etabs_e1,
       (SELECT count(*)::int FROM fpe_a1 WHERE "ANNEE_SCOLAIRE"=2026 AND "EXISTE_PRIMAIRE"=1) etabs_primaire_a1,
       (SELECT sum(pop_6_ans+pop_7_ans+pop_8_ans+pop_9_ans+pop_10_ans) FROM population_2025) pop610`));
console.log('Autres tables population:');
console.log(await q(`SELECT table_name FROM information_schema.tables WHERE table_name ILIKE '%pop%'`));
await c.end();
