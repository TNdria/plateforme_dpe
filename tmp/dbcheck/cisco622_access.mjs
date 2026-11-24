// Vérifie la résolution DREN d'un CISCO absent de v_cisco (CISCO 622).
import pg from 'pg';
import { resolveDiagnosticScope } from '../../supabase/functions/db-query/diagnosticAccess.ts';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const client = await pool.connect();
try {
  const codeCisco = 622;
  const ref = await client.query('SELECT "CODE_DREN" FROM v_cisco WHERE "CODE_CISCO" = $1', [codeCisco]);
  const rows = await client.query(
    `SELECT DISTINCT "CODE_DREN" FROM fpe_a1
      WHERE "CODE_CISCO" = $1 AND "CODE_DREN" IS NOT NULL
        AND "ANNEE_SCOLAIRE" = (SELECT MAX("ANNEE_SCOLAIRE") FROM fpe_a1)`,
    [codeCisco],
  );
  const ciscoDren = ref.rows.length
    ? Number(ref.rows[0].CODE_DREN)
    : rows.rows.length === 1 ? Number(rows.rows[0].CODE_DREN) : null;
  console.log('v_cisco:', ref.rows, '| collecte:', rows.rows, '| ciscoDren retenu:', ciscoDren);
  const account = { is_active: true, is_staff: false, is_superuser: false, dren: 61, cisco: null };
  console.log('DREN 61 -> 622 :', resolveDiagnosticScope(account, { codeDren: 61, codeCisco, ciscoDren }));
  console.log('DREN 62 -> 622 :', resolveDiagnosticScope(
    { ...account, dren: 62 }, { codeDren: 62, codeCisco, ciscoDren }));
} finally {
  client.release();
  await pool.end();
}
