process.env.NODE_NO_WARNINGS = '1';
const { executeDiagnosticDataset } = await import('../../supabase/functions/db-query/diagnostic.ts');
const pg = (await import('pg')).default;
const c = new pg.Client({ connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL });
await c.connect();
const client = { queryObject: (q) => c.query(q) };
for (const [dren, cisco] of [[61, 609], [61, 0], [0, 0]]) {
  const ds = await executeDiagnosticDataset(client, { codeDren: dren, codeCisco: cisco });
  console.log(`\n=== ${dren}/${cisco} | source: ${ds.population.source} | p6_10 2026: ${ds.population.p6_10}`);
  for (const y of ds.years) {
    const i = ds.indicateurs[y];
    if (!i) { console.log(y, 'no indicateurs'); continue; }
    console.log(y, 'TBS', i.couverture.tbsPrimaire, '| TBA', i.couverture.tbaPrimaire, '| presco', i.couverture.tauxPrescolarisation, '| primaire', ds.annees[y].eleves.primaire.total);
  }
}
await c.end();
