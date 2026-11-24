import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL });
await c.connect();
const q = async (s) => (await c.query(s)).rows;
console.log('--- fpe_a1 cols');
console.log((await q(`SELECT column_name FROM information_schema.columns WHERE table_name='fpe_a1' ORDER BY ordinal_position`)).map(r=>r.column_name).join(', '));
console.log('--- v_cisco cols');
console.log((await q(`SELECT column_name FROM information_schema.columns WHERE table_name='v_cisco' ORDER BY ordinal_position`)).map(r=>r.column_name).join(', '));
console.log('--- population_2025 cols');
console.log((await q(`SELECT column_name FROM information_schema.columns WHERE table_name='population_2025' ORDER BY ordinal_position`)).map(r=>r.column_name).join(', '));
console.log('--- sample fpe_a1 rows for 622');
console.log(await q(`SELECT * FROM fpe_a1 WHERE "CODE_CISCO"=622 ORDER BY "ANNEE_SCOLAIRE" DESC LIMIT 2`));
console.log('--- population 61 by cisco-ish');
console.log(await q(`SELECT * FROM population_2025 LIMIT 2`));
console.log('--- cisco 622 in other tables');
for (const t of ['fpe_e1','fpe_e4','fpe_g1','fpe_j1','fpe_p1','fpe_l1','etablissements','v_fiche_ecole_n0']) {
  try { const r = await q(`SELECT count(*)::int n FROM ${t} WHERE "CODE_CISCO"=622`); console.log(t, r[0].n); } catch(e){ console.log(t, 'ERR', e.message); }
}
await c.end();
