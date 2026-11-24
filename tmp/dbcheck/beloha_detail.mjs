import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 60000 });
const q = async (label, sql) => {
  try { const r = await pool.query(sql); console.log(`\n=== ${label} ===`); console.table(r.rows); }
  catch (e) { console.log(`\n=== ${label} ERROR ===`, e.message); }
};

const eff = `(COALESCE("T1_G"::text::int,0)+COALESCE("T1_F"::text::int,0)+COALESCE("T2_G"::text::int,0)+COALESCE("T2_F"::text::int,0)+COALESCE("T3_G"::text::int,0)+COALESCE("T3_F"::text::int,0)+COALESCE("T4_G"::text::int,0)+COALESCE("T4_F"::text::int,0)+COALESCE("T5_G"::text::int,0)+COALESCE("T5_F"::text::int,0))`;

await q("top 10 primary schools BELOHA 2026", `SELECT "CODE_ETAB","NOM_ETAB","ZAP",${eff} eff FROM fpe_e1 WHERE "ANNEE_SCOLAIRE"=2026 AND "CODE_CISCO"=609 AND "EXISTE_PRIMAIRE"=1 ORDER BY eff DESC LIMIT 12`);
await q("effectif distribution BELOHA 2026", `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY ${eff}) med, percentile_cont(0.9) WITHIN GROUP (ORDER BY ${eff}) p90, avg(${eff})::int moy, max(${eff}) max, count(*) n FROM fpe_e1 WHERE "ANNEE_SCOLAIRE"=2026 AND "CODE_CISCO"=609 AND "EXISTE_PRIMAIRE"=1`);
await q("duplicate school names BELOHA", `SELECT upper(btrim("NOM_ETAB")) nom, count(*) n, array_agg("CODE_ETAB") codes FROM fpe_a1 WHERE "ANNEE_SCOLAIRE"=2026 AND "CODE_CISCO"=609 GROUP BY 1 HAVING count(*)>1 ORDER BY n DESC LIMIT 20`);
await q("etabs per ZAP BELOHA", `SELECT "ZAP","CODE_ZAP", count(*) n FROM fpe_a1 WHERE "ANNEE_SCOLAIRE"=2026 AND "CODE_CISCO"=609 GROUP BY 1,2 ORDER BY n DESC`);
await q("national top schools", `SELECT "CODE_ETAB","NOM_ETAB","CODE_CISCO",${eff} eff FROM fpe_e1 WHERE "ANNEE_SCOLAIRE"=2026 AND "EXISTE_PRIMAIRE"=1 ORDER BY eff DESC LIMIT 8`);
await q("population_2025 all DREN 61", `SELECT * FROM population_2025 WHERE code_dren=61 ORDER BY code_cisco`);
await pool.end();
