const REFERENCE_TABLES = new Set(['tdb_population_dren', 'tdb_population_cisco', 'tdb_caisse_ecole_import']);

/** Recover legacy reference batches using PostgreSQL's exact transaction timestamp,
 * never a time window or the whole table, so unrelated imports stay untouched. */
export async function repairReferenceBatch(client: any, table: string, batchId: string): Promise<void> {
  if (!REFERENCE_TABLES.has(table)) return;
  const result = await client.queryObject(`
    SELECT b.row_count,
      (SELECT COUNT(*)::int FROM public."${table}" r WHERE r.imported_at = b.created_at) AS exact_rows,
      (SELECT COUNT(*)::int FROM public."${table}" r WHERE r.imported_at BETWEEN b.batch_ts_start AND b.batch_ts_end) AS linked_rows,
      (SELECT COUNT(*)::int FROM public.tdb_import_batches other
       WHERE other.id <> b.id AND other.table_name = b.table_name AND other.created_at = b.created_at) AS conflicts
    FROM public.tdb_import_batches b WHERE b.id = $1 AND b.table_name = $2 AND b.status = 'completed'`, [batchId, table]);
  const stats = result.rows[0];
  if (!stats || Number(stats.row_count) <= 0 || Number(stats.exact_rows) !== Number(stats.row_count)
      || Number(stats.linked_rows) !== 0 || Number(stats.conflicts) !== 0) return;
  await client.queryObject(`UPDATE public.tdb_import_batches
    SET batch_ts_start = created_at, batch_ts_end = created_at
    WHERE id = $1 AND table_name = $2 AND status = 'completed'`, [batchId, table]);
}