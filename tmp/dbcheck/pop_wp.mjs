import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL });
await c.connect();
const q = async (s) => (await c.query(s)).rows;
for (const t of ['population','population_rgph','population_worldpop30']) {
  console.log('====',t);
  try {
    console.log('cols:', (await q(`SELECT column_name FROM information_schema.columns WHERE table_name='${t}' ORDER BY ordinal_position`)).map(r=>r.column_name).join(', '));
    console.log('n:', (await q(`SELECT count(*)::int n FROM ${t}`))[0].n);
    console.log(await q(`SELECT * FROM ${t} LIMIT 2`));
  } catch(e){ console.log('ERR', e.message.split('\n')[0]); }
}
await c.end();
