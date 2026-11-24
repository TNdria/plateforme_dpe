import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL });
await c.connect();
const q = async (s) => (await c.query(s)).rows;
for (const t of ['tdb_population_cisco','tdb_population_dren','population_rgph','population','population_worldpop30']) {
  console.log('==== ', t);
  try {
    console.log('cols:', (await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='${t}' ORDER BY ordinal_position`)).map(r=>`${r.column_name}:${r.data_type}`).join(', '));
    console.log('sample:', await q(`SELECT * FROM ${t} LIMIT 3`));
    console.log('count:', await q(`SELECT count(*)::int n FROM ${t}`));
  } catch(e) { console.log('ERR', e.message.split('\n')[0]); }
}
await c.end();
