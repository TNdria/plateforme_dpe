import { ensureTdbTables } from './tdbStore';

// Import admin des données de référence TDB : Caisse école (par établissement et niveau)
// et Population DREN par âge (G/F/T, 3 à 17 ans). Les tables sont créées au besoin.

export const AGES = Array.from({ length: 15 }, (_, i) => i + 3); // 3..17

let ready = false;
export async function ensureRefTables(client: any) {
  if (ready) return;
  try {
    await ensureTdbTables(client);
    await client.queryObject(`CREATE TABLE IF NOT EXISTS public.tdb_caisse_ecole_import (
      id BIGSERIAL PRIMARY KEY, "ANNEE_SCOLAIRE" INTEGER NOT NULL, "NIVEAU" TEXT NOT NULL,
      "CODE_ETAB" BIGINT NOT NULL, "TOTAL" NUMERIC, imported_at TIMESTAMPTZ DEFAULT now())`);
    const ageCols = AGES.map((a) => `g_${a} NUMERIC, f_${a} NUMERIC, t_${a} NUMERIC`).join(', ');
    await client.queryObject(`CREATE TABLE IF NOT EXISTS public.tdb_population_dren (
      id BIGSERIAL PRIMARY KEY, annee INTEGER NOT NULL, code_dren INTEGER NOT NULL, dren TEXT,
      ${ageCols}, imported_at TIMESTAMPTZ DEFAULT now())`);
    ready = true;
  } catch (e) { console.error('ensureRefTables', e); }
}

/** Source caisse école : table historique + montants PRIMAIRE importés (prioritaires pour une même année/étab). */
export const CE_SRC = `(SELECT "CODE_ETAB","ANNEE_SCOLAIRE","FCE","TOTAL_A_DOTER" FROM caisse_ecole c0
   WHERE NOT EXISTS (SELECT 1 FROM tdb_caisse_ecole_import i WHERE i."NIVEAU"='PRIMAIRE' AND i."CODE_ETAB"=c0."CODE_ETAB" AND i."ANNEE_SCOLAIRE"=c0."ANNEE_SCOLAIRE")
   UNION ALL SELECT "CODE_ETAB","ANNEE_SCOLAIRE","TOTAL" AS "FCE",NULL::numeric AS "TOTAL_A_DOTER" FROM tdb_caisse_ecole_import WHERE "NIVEAU"='PRIMAIRE')`;

/** Sous-requête population compatible population_2025 (code_dren, pop_N_ans, pop_total) pour l'année demandée, ou null. */
export async function popSource(client: any, annee: number): Promise<string | null> {
  try {
    await ensureRefTables(client);
    const r = await client.queryObject(`SELECT COUNT(*)::int AS n FROM tdb_population_dren WHERE annee=${Number(annee)}`);
    if (!((r.rows[0] as any)?.n > 0)) return null;
    const cols = AGES.map((a) => `t_${a} AS pop_${a}_ans, g_${a} AS pop_${a}_ans_g, f_${a} AS pop_${a}_ans_f`).join(', ');
    return `(SELECT code_dren, ${cols}, (${AGES.map((a) => `COALESCE(t_${a},0)`).join('+')}) AS pop_total FROM tdb_population_dren WHERE annee=${Number(annee)})`;
  } catch { return null; }
}

const num = (v: any) => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export async function importReference(client: any, body: any) {
  await ensureRefTables(client);
  const { kind, rows, adminUsername, fileName } = body as { kind: 'caisse' | 'population'; rows: any[]; adminUsername?: string; fileName?: string };
  if (!Array.isArray(rows) || rows.length === 0) return { success: false, error: 'Aucune ligne à importer' };
  await client.queryObject('BEGIN');
  try {
    await client.queryObject("SET LOCAL statement_timeout = '45s'");
    const lock = await client.queryObject('SELECT pg_try_advisory_xact_lock(736241, $1) AS locked', [kind === 'caisse' ? 1 : 2]);
    if (!lock.rows[0]?.locked) {
      await client.queryObject('ROLLBACK');
      return { success: false, retryable: true, error: 'Un import est déjà en cours. Nouvelle tentative dans quelques secondes.' };
    }
    let inserted = 0;
    if (kind === 'caisse') {
      const clean = rows.map((r) => ({ a: Math.trunc(num(r.annee) ?? 0), n: String(r.niveau || '').toUpperCase(), c: num(r.code), t: num(r.total) }))
        .filter((r) => r.a > 1990 && r.c && ['PRIMAIRE', 'COLLEGE', 'LYCEE'].includes(r.n));
      const pairs = Array.from(new Set(clean.map((r) => `${r.a}|${r.n}`)));
      for (const p of pairs) {
        const [a, n] = p.split('|');
        await client.queryObject(`DELETE FROM tdb_caisse_ecole_import WHERE "ANNEE_SCOLAIRE"=$1 AND "NIVEAU"=$2`, [Number(a), n]);
      }
      // One database round trip rather than hundreds across the remote connection.
      await client.queryObject(`INSERT INTO tdb_caisse_ecole_import ("ANNEE_SCOLAIRE","NIVEAU","CODE_ETAB","TOTAL")
        SELECT a, n, c, t FROM jsonb_to_recordset($1::jsonb) AS r(a integer, n text, c bigint, t numeric)`,
        [JSON.stringify(clean.map((r) => ({ ...r, c: Math.trunc(r.c ?? 0) })))]);
      inserted = clean.length;
    } else if (kind === 'population') {
      const cols = AGES.flatMap((a) => [`g_${a}`, `f_${a}`, `t_${a}`]);
      const clean = rows.map((r) => ({ ...r, annee: Math.trunc(num(r.annee) ?? 0), code_dren: Math.trunc(num(r.code_dren) ?? 0) }))
        .filter((r) => r.annee > 1990 && r.code_dren > 0);
      const years = Array.from(new Set(clean.map((r) => r.annee)));
      if (years.length) await client.queryObject(`DELETE FROM tdb_population_dren WHERE annee = ANY($1)`, [years]);
      const all = ['annee', 'code_dren', 'dren', ...cols];
      const typedCols = ['annee integer', 'code_dren integer', 'dren text', ...cols.map((c) => `${c} numeric`)];
      await client.queryObject(`INSERT INTO tdb_population_dren (${all.join(',')})
        SELECT ${all.join(',')} FROM jsonb_to_recordset($1::jsonb) AS r(${typedCols.join(',')})`,
        [JSON.stringify(clean.map((r) => ({ annee: r.annee, code_dren: r.code_dren,
          dren: r.dren ? String(r.dren) : null, ...Object.fromEntries(cols.map((c) => [c, num(r[c])])) })))]);
      inserted = clean.length;
    } else {
      throw new Error('Type d\'import inconnu');
    }
    const batchId = `${kind}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const batchTs = new Date().toISOString();
    await client.queryObject(`INSERT INTO public.tdb_import_batches (id, table_name, file_name, row_count, imported_by, batch_ts_start, batch_ts_end, status)
      VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $6::timestamptz, 'completed')
      ON CONFLICT (id) DO UPDATE SET row_count = EXCLUDED.row_count, imported_by = EXCLUDED.imported_by, batch_ts_start = LEAST(public.tdb_import_batches.batch_ts_start, EXCLUDED.batch_ts_start), batch_ts_end = GREATEST(public.tdb_import_batches.batch_ts_end, EXCLUDED.batch_ts_end), status = 'completed'`,
      [batchId, kind === 'caisse' ? 'tdb_caisse_ecole_import' : 'tdb_population_dren', fileName || null, inserted, adminUsername || 'admin', batchTs]);
    await client.queryObject('COMMIT');
    return { success: true, inserted, total: rows.length, batchId };
  } catch (e: any) {
    await client.queryObject('ROLLBACK').catch(() => {});
    const retryable = /timeout|connection|closed|reset|socket|network/i.test(e.message || '') || ['57014', '40001', '40P01'].includes(e.code);
    return { success: false, error: e.message, retryable };
  }
}
