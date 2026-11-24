import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 60000 });
const q = async (label, sql) => {
  try { const r = await pool.query(sql); console.log(`\n=== ${label} ===`); console.table(r.rows); }
  catch (e) { console.log(`\n=== ${label} ERROR ===`, e.message); }
};
await q("login_customuser columns", `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='login_customuser' ORDER BY ordinal_position`);
await q("accounts by role (no secrets)", `SELECT id, username, is_active, is_staff, is_superuser, dren, cisco FROM login_customuser ORDER BY id LIMIT 40`);
await q("role counts", `SELECT
  count(*) total,
  count(*) FILTER (WHERE is_superuser) superusers,
  count(*) FILTER (WHERE is_staff AND NOT is_superuser) staff,
  count(*) FILTER (WHERE NOT is_staff AND NOT is_superuser AND coalesce(dren,0)>0 AND coalesce(cisco,0)=0) dren_only,
  count(*) FILTER (WHERE NOT is_staff AND NOT is_superuser AND coalesce(cisco,0)>0) cisco_role,
  count(*) FILTER (WHERE NOT is_staff AND NOT is_superuser AND coalesce(dren,0)=0 AND coalesce(cisco,0)=0) no_scope
  FROM login_customuser`);
await pool.end();
