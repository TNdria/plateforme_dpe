import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 60000 });
const q = async (label, sql) => {
  try { const r = await pool.query(sql); console.log(`\n=== ${label} ===`); console.table(r.rows); }
  catch (e) { console.log(`\n=== ${label} ERROR ===`, e.message); }
};
await q("name overlap 604 vs 622 (2026)", `
SELECT count(*) AS n622,
  count(*) FILTER (WHERE upper(btrim(a."NOM_ETAB")) IN (SELECT upper(btrim(b."NOM_ETAB")) FROM fpe_a1 b WHERE b."ANNEE_SCOLAIRE"=2026 AND b."CODE_CISCO"=604)) AS names_also_in_604
FROM fpe_a1 a WHERE a."ANNEE_SCOLAIRE"=2026 AND a."CODE_CISCO"=622`);
await q("same name+zap in both ciscos", `
SELECT count(*) FROM fpe_a1 a JOIN fpe_a1 b
 ON b."ANNEE_SCOLAIRE"=a."ANNEE_SCOLAIRE" AND b."CODE_CISCO"=604
 AND upper(btrim(b."NOM_ETAB"))=upper(btrim(a."NOM_ETAB")) AND b."CODE_ZAP"=a."CODE_ZAP"
WHERE a."ANNEE_SCOLAIRE"=2026 AND a."CODE_CISCO"=622`);
await q("effectifs 604 vs 622", `
SELECT "CODE_CISCO", count(*) etabs,
 sum(CASE WHEN "EXISTE_PRIMAIRE"=1 THEN 1 ELSE 0 END) prim_etabs,
 sum(COALESCE("T1_G"::text::int,0)+COALESCE("T1_F"::text::int,0)+COALESCE("T2_G"::text::int,0)+COALESCE("T2_F"::text::int,0)+COALESCE("T3_G"::text::int,0)+COALESCE("T3_F"::text::int,0)+COALESCE("T4_G"::text::int,0)+COALESCE("T4_F"::text::int,0)+COALESCE("T5_G"::text::int,0)+COALESCE("T5_F"::text::int,0)) prim_eff
FROM fpe_e1 WHERE "ANNEE_SCOLAIRE"=2026 AND "CODE_CISCO" IN (604,622) GROUP BY 1 ORDER BY 1`);
await q("sample 622", `SELECT "CODE_ETAB","NOM_ETAB","CODE_ZAP","ZAP","CODE_DREN","CODE_CISCO","SECTEUR" FROM fpe_a1 WHERE "ANNEE_SCOLAIRE"=2026 AND "CODE_CISCO"=622 ORDER BY "CODE_ETAB" LIMIT 10`);
await q("population 2025 dren 61 sum", `SELECT code_dren, sum(pop_total) tot, sum(pop_6_ans+pop_7_ans+pop_8_ans+pop_9_ans+pop_10_ans) p6_10 FROM population_2025 WHERE code_dren=61 GROUP BY 1`);
await pool.end();
