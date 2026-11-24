// Exécute le vrai builder Diagnostic contre la base ministérielle.
import pg from 'pg';
import { executeDiagnosticDataset } from '../../supabase/functions/db-query/diagnostic.ts';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const client = await pool.connect();
const scope = { codeDren: Number(process.argv[2] || 61), codeCisco: Number(process.argv[3] || 0) };
try {
  const ds = await executeDiagnosticDataset(
    { queryObject: async (sql) => ({ rows: (await client.query(sql)).rows }) },
    scope,
  );
  const year = String(ds.years[ds.years.length - 1]);
  const d = ds.annees[year];
  console.log('scope', ds.scope, 'année', year);
  console.log('etabs distincts', d.etablissements.total,
    '| niveaux', ['presco', 'primaire', 'college', 'lycee'].map((k) => d.etablissements[k].total).join('+'));
  console.log('enseignants distincts', d.enseignants.total,
    '| niveaux', ['presco', 'primaire', 'college', 'lycee'].map((k) => d.enseignants[k].total).join('+'));
  console.log('eleves primaire', d.eleves.primaire.total, '| population 6-10', ds.population.p6_10);
  console.log('TBS', ds.indicateurs[year].couverture.tbsPrimaire,
    '| TBA', ds.indicateurs[year].couverture.tbaPrimaire,
    '| presco', ds.indicateurs[year].couverture.tauxPrescolarisation);
  console.log('warnings', ds.warnings);
} finally {
  client.release();
  await pool.end();
}
