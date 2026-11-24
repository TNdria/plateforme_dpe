import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL });
await c.connect();
const q = async (s) => (await c.query(s)).rows;
const col = (x) => `COALESCE(NULLIF("${x}",'')::numeric,0)`;
const P = ['T1_G','T1_F','T2_G','T2_F','T3_G','T3_F','T4_G','T4_F','T5_G','T5_F'].map(col).join('+');
console.log('national primaire 2026 par secteur:', await q(`
SELECT "SECTEUR", count(*)::int n, sum(${P})::int eleves FROM fpe_e1 WHERE "ANNEE_SCOLAIRE"=2026 GROUP BY 1`));
console.log('cols CI totals nat:', await q(`SELECT sum(${col('CI_G')}+${col('CI_F')})::int ci FROM fpe_e1 WHERE "ANNEE_SCOLAIRE"=2026`));
console.log('pop610 2026 proj nat:', await q(`SELECT sum(t_6+t_7+t_8+t_9+t_10)::int p610, sum(t_3+t_4+t_5+t_6+t_7+t_8+t_9+t_10+t_11+t_12+t_13+t_14+t_15+t_16+t_17)::int p3_17 FROM tdb_population_cisco WHERE annee=2026`));
console.log('pop610 2025 proj nat:', await q(`SELECT sum(t_6+t_7+t_8+t_9+t_10)::int p610 FROM tdb_population_cisco WHERE annee=2025`));
console.log('pop_2025 nat:', await q(`SELECT sum(pop_6_ans+pop_7_ans+pop_8_ans+pop_9_ans+pop_10_ans)::int p610, sum(pop_total)::int tot FROM population_2025`));
console.log('proj nat total all ages:', await q(`SELECT sum(t_3+t_4+t_5+t_6+t_7+t_8+t_9+t_10+t_11+t_12+t_13+t_14+t_15+t_16+t_17)::int s FROM tdb_population_cisco WHERE annee=2026`));
console.log('annees e1:', await q(`SELECT "ANNEE_SCOLAIRE"::int y, count(*)::int n, sum(${P})::int eleves FROM fpe_e1 GROUP BY 1 ORDER BY 1`));
await c.end();
