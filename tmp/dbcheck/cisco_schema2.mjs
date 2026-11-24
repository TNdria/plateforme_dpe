import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL });
await c.connect();
const q = async (s) => (await c.query(s)).rows;
console.log('population sample:', await q(`SELECT code_cisco, code_dren, pop_total FROM population_2025 ORDER BY code_cisco LIMIT 4`));
console.log('pop 61 codes:', (await q(`SELECT code_cisco, code_dren FROM population_2025 WHERE code_dren=61 ORDER BY code_cisco`)));
console.log('v_cisco 61:', await q(`SELECT * FROM v_cisco WHERE "CODE_DREN"=61 ORDER BY "CODE_CISCO"`));
console.log('fpe_a1 61 ciscos:', await q(`SELECT DISTINCT "CODE_CISCO","CISCO" FROM fpe_a1 WHERE "CODE_DREN"=61 ORDER BY 1`));
for (const t of ['fpe_e1','fpe_e4','fpe_g1','fpe_j1','fpe_p1','fpe_l1','etablissements','v_fiche_ecole_n0','v_fiche_ecole_n1']) {
  try { const r = await q(`SELECT count(*)::int n FROM ${t} WHERE "CODE_CISCO"=622`); console.log(t, r[0].n); } catch(e){ console.log(t, 'ERR', e.message.split('\n')[0]); }
}
console.log('622 etabs by year e1:', await q(`SELECT "ANNEE_SCOLAIRE", count(*)::int FROM fpe_e1 WHERE "CODE_CISCO"=622 GROUP BY 1 ORDER BY 1`));
await c.end();
