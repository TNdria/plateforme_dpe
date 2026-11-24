import pg from "pg";
import { buildDonneesRecentSql } from "../../supabase/functions/_shared/donneesRecent.ts";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 60000 });
const q = async (label, sql) => {
  try { const r = await pool.query(sql); console.log(`\n=== ${label} ===`); console.table(r.rows); }
  catch (e) { console.log(`\n=== ${label} ERROR ===`, e.message); }
};

const base = { codeDren: 61, codeCisco: 609, codeCommune: 0, codeZap: 0, secteur: 2, annee: 2026 };

for (const [level, action, effKeys] of [["n1", "primaire", ["eff_t1","eff_t2","eff_t3","eff_t4","eff_t5"]], ["n2", "college", ["eff_t6","eff_t7","eff_t8","eff_t9"]], ["n3", "lycee", ["_2nde","_1re","tle"]]]) {
  const sql = buildDonneesRecentSql(level, base);
  const r = await pool.query(sql);
  const rows = r.rows;
  const sum = (k) => rows.reduce((a, x) => a + (Number(x[k]) || 0), 0);
  const bySecteur = {};
  for (const row of rows) {
    const s = String(row.SECTEUR);
    bySecteur[s] ??= { rows: 0, eleves: 0, pers_total: 0 };
    bySecteur[s].rows++;
    bySecteur[s].eleves += effKeys.reduce((a, k) => a + (Number(row[k]) || 0), 0);
    bySecteur[s].pers_total += Number(row.pers_total) || 0;
  }
  console.log(`\n### API ${action} BELOHA 2026 — rows=${rows.length}`);
  console.table(bySecteur);
  console.log("sum eleves", sum("eff_total") || effKeys.reduce((a, k) => a + sum(k), 0), "sum pers_total", sum("pers_total"));
  const dup = {};
  for (const row of rows) dup[row.CODE_ETAB] = (dup[row.CODE_ETAB] || 0) + 1;
  const dups = Object.entries(dup).filter(([, n]) => n > 1);
  console.log("distinct etabs", Object.keys(dup).length, "duplicated codes", dups.length, dups.slice(0, 5));
}

await q("fpe_a1 BELOHA 2026 rows", `SELECT count(*) rows, count(DISTINCT "CODE_ETAB") etabs FROM fpe_a1 WHERE "ANNEE_SCOLAIRE"=2026 AND "CODE_CISCO"=609`);
await q("v_evolution rows per etab n2 BELOHA etabs", `SELECT count(*) rows, count(DISTINCT "CODE_ETAB") etabs FROM v_evolution_effectif_n2 WHERE "CODE_ETAB" IN (SELECT "CODE_ETAB" FROM fpe_a1 WHERE "ANNEE_SCOLAIRE"=2026 AND "CODE_CISCO"=609)`);
await q("v_sdc rows per etab+year BELOHA", `SELECT count(*) rows, count(DISTINCT "CODE_ETAB") etabs FROM v_sdc WHERE "ANNEE_SCOLAIRE"=2026 AND "CODE_ETAB" IN (SELECT "CODE_ETAB" FROM fpe_a1 WHERE "ANNEE_SCOLAIRE"=2026 AND "CODE_CISCO"=609)`);
await q("v_place_assises rows BELOHA", `SELECT count(*) rows, count(DISTINCT "CODE_ETAB") etabs FROM v_place_assises WHERE "ANNEE_SCOLAIRE"=2026 AND "CODE_ETAB" IN (SELECT "CODE_ETAB" FROM fpe_a1 WHERE "ANNEE_SCOLAIRE"=2026 AND "CODE_CISCO"=609)`);
await q("v_personnel rows BELOHA", `SELECT count(*) rows, count(DISTINCT "CODE_ETAB") etabs FROM v_personnel WHERE "ANNEE_SCOLAIRE"=2026 AND "CODE_ETAB" IN (SELECT "CODE_ETAB" FROM fpe_a1 WHERE "ANNEE_SCOLAIRE"=2026 AND "CODE_CISCO"=609)`);
await q("fpe_e4 rows per etab BELOHA", `SELECT count(*) rows, count(DISTINCT "CODE_ETAB") etabs FROM fpe_e4 WHERE "ANNEE_SCOLAIRE"=2026 AND "EXISTE_COLLEGE"=1 AND "CODE_ETAB" IN (SELECT "CODE_ETAB" FROM fpe_a1 WHERE "ANNEE_SCOLAIRE"=2026 AND "CODE_CISCO"=609)`);
await q("view columns v_evolution_effectif_n2", `SELECT column_name FROM information_schema.columns WHERE table_name='v_evolution_effectif_n2' ORDER BY ordinal_position`);
await q("v_evolution_n2 sample rows for 2 etabs", `SELECT * FROM v_evolution_effectif_n2 WHERE "CODE_ETAB" IN ('609011001','609010017') LIMIT 10`);
await pool.end();
