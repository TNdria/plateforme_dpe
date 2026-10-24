// Stockage des imports TDB (tdb_ecole, tdb_zap, tdb_cisco, tdb_dren, tdb_mada, tdb_ref)
// dans la base de données du ministère (celle de dbConfig), et plus dans Supabase.
//
// Schéma (identique aux migrations Supabase) : colonnes structurelles pour filtrer
// + `data jsonb` qui conserve TOUTES les colonnes du fichier importé + `imported_at`.
// Les lectures aplatissent `data` puis les colonnes, comme getLatestImportedTdbRow.

export const TDB_TABLES = ['tdb_ecole', 'tdb_zap', 'tdb_cisco', 'tdb_dren', 'tdb_mada', 'tdb_ref'] as const;
export type TdbTable = (typeof TDB_TABLES)[number];

type ColType = 'integer' | 'text';
type StructCol = { name: string; type: ColType };

/** Colonnes structurelles : elles servent aux filtres (CODE_DREN, CODE_ZAP, …). */
const STRUCT: Record<TdbTable, StructCol[]> = {
  tdb_ecole: [
    { name: 'CODE_DREN', type: 'integer' }, { name: 'DREN', type: 'text' },
    { name: 'CODE_CISCO', type: 'integer' }, { name: 'CISCO', type: 'text' },
    { name: 'CODE_ZAP', type: 'integer' }, { name: 'ZAP', type: 'text' },
    { name: 'CODE_ETAB', type: 'integer' }, { name: 'NOM_ETAB', type: 'text' },
  ],
  tdb_zap: [
    { name: 'CODE_DREN', type: 'integer' }, { name: 'DREN', type: 'text' },
    { name: 'CODE_CISCO', type: 'integer' }, { name: 'CISCO', type: 'text' },
    { name: 'CODE_ZAP', type: 'integer' }, { name: 'ZAP', type: 'text' },
  ],
  tdb_cisco: [
    { name: 'CODE_DREN', type: 'integer' }, { name: 'DREN', type: 'text' },
    { name: 'CODE_CISCO', type: 'integer' }, { name: 'CISCO', type: 'text' },
  ],
  tdb_dren: [{ name: 'CODE_DREN', type: 'integer' }, { name: 'DREN', type: 'text' }],
  tdb_mada: [{ name: 'CODE_MADA', type: 'integer' }],
  tdb_ref: [{ name: 'CODE_ETAB', type: 'integer' }],
};

/** Colonne qui identifie une entité : une réimportation remplace ses anciennes lignes. */
export const TDB_KEY_COL: Record<TdbTable, string> = {
  tdb_ecole: 'CODE_ETAB',
  tdb_zap: 'CODE_ZAP',
  tdb_cisco: 'CODE_CISCO',
  tdb_dren: 'CODE_DREN',
  tdb_mada: 'CODE_MADA',
  tdb_ref: 'CODE_ETAB',
};

export const isTdbTable = (table: string): table is TdbTable =>
  (TDB_TABLES as readonly string[]).includes(table);

const norm = (value: unknown) => String(value ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '');

const numLike = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const cleaned = String(value).trim().replace(/\s/g, '').replace(/\u00a0/g, '').replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : null;
};

const textValue = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
};

/**
 * Découpe une ligne de fichier en colonnes structurelles + `data` (toutes les autres
 * colonnes, converties en nombres quand la valeur est numérique).
 */
export function splitTdbRow(
  table: TdbTable,
  columns: string[],
  row: any[],
): { struct: Record<string, number | string | null>; data: Record<string, any> } {
  const byNorm = new Map(STRUCT[table].map((c) => [norm(c.name), c]));
  const struct: Record<string, number | string | null> = {};
  const data: Record<string, any> = {};
  columns.forEach((column, index) => {
    const raw = row?.[index];
    const target = byNorm.get(norm(column));
    if (target) {
      struct[target.name] = target.type === 'integer' ? numLike(raw) : textValue(raw);
      return;
    }
    if (raw === null || raw === undefined || raw === '') { data[column] = null; return; }
    const asNumber = numLike(raw);
    data[column] = asNumber !== null ? asNumber : (typeof raw === 'string' ? raw.trim() : raw);
  });
  return { struct, data };
}

let readyPromise: Promise<void> | null = null;

/**
 * Crée au besoin les tables TDB et l'historique des imports dans la base du ministère.
 * Idempotent : ALTER ... IF NOT EXISTS complète une table déjà présente.
 */
export async function ensureTdbTables(client: any): Promise<void> {
  // Une seule séquence DDL par instance, même si plusieurs requêtes arrivent en
  // parallèle sur la même connexion (cas des snapshots TDB chargés ensemble).
  if (!readyPromise) {
    readyPromise = createTdbTables(client).catch((e) => {
      readyPromise = null;
      throw e;
    });
  }
  return await readyPromise;
}

async function createTdbTables(client: any): Promise<void> {
  for (const table of TDB_TABLES) {
    const defs = STRUCT[table].map((c) => `"${c.name}" ${c.type === 'integer' ? 'INTEGER' : 'TEXT'}`).join(', ');
    await client.queryObject(`CREATE TABLE IF NOT EXISTS public."${table}" (
      id BIGSERIAL PRIMARY KEY,
      ${defs},
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    for (const c of STRUCT[table]) {
      await client.queryObject(
        `ALTER TABLE public."${table}" ADD COLUMN IF NOT EXISTS "${c.name}" ${c.type === 'integer' ? 'INTEGER' : 'TEXT'}`,
      );
    }
    await client.queryObject(`ALTER TABLE public."${table}" ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::jsonb`);
    await client.queryObject(`ALTER TABLE public."${table}" ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ NOT NULL DEFAULT now()`);
    const key = TDB_KEY_COL[table];
    await client.queryObject(`CREATE INDEX IF NOT EXISTS "idx_${table}_${key.toLowerCase()}" ON public."${table}" ("${key}")`);
    await client.queryObject(`CREATE INDEX IF NOT EXISTS "idx_${table}_imported_at" ON public."${table}" (imported_at DESC)`);
  }
  await client.queryObject(`CREATE TABLE IF NOT EXISTS public.tdb_import_batches (
    id TEXT PRIMARY KEY,
    table_name TEXT NOT NULL,
    file_name TEXT,
    row_count INTEGER NOT NULL DEFAULT 0,
    imported_by TEXT,
    status TEXT NOT NULL DEFAULT 'completed',
    batch_ts_start TIMESTAMPTZ NOT NULL,
    batch_ts_end TIMESTAMPTZ NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await client.queryObject(`CREATE INDEX IF NOT EXISTS "idx_tdb_import_batches_created" ON public.tdb_import_batches (created_at DESC)`);
}

export interface TdbImportInput {
  table: TdbTable;
  columns: string[];
  rows: any[][];
  fileName?: string | null;
  importedBy?: string | null;
  batchId?: string | null;
  batchTs?: string | null;
}

/**
 * Import atomique : une transaction + verrou consultatif, remplacement des lignes
 * existantes de la même entité, insertion en un seul enregistrement JSON par lot,
 * puis journalisation du lot. Un nouvel envoi du même payload ne crée pas de doublon.
 */
export async function importTdbRows(client: any, input: TdbImportInput) {
  const { table, columns, rows } = input;
  if (!isTdbTable(table)) return { success: false, error: `Table '${table}' non supportée` };
  if (!Array.isArray(rows) || rows.length === 0) return { success: false, error: 'Aucune ligne à importer' };

  await ensureTdbTables(client);
  const key = TDB_KEY_COL[table];
  const structCols = STRUCT[table];
  const intArrays = structCols.find((c) => c.name === key)?.type === 'integer';
  const ts = input.batchTs || new Date().toISOString();
  const batchId = input.batchId || (typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

  await client.queryObject('BEGIN');
  try {
    await client.queryObject("SET LOCAL statement_timeout = '90s'");
    const lock = await client.queryObject('SELECT pg_try_advisory_xact_lock(736241, $1) AS locked', [
      TDB_TABLES.indexOf(table) + 10,
    ]);
    if (!lock.rows?.[0]?.locked) {
      await client.queryObject('ROLLBACK');
      return { success: false, retryable: true, error: 'Un import est déjà en cours. Nouvelle tentative dans quelques secondes.' };
    }

    const records = rows.map((row) => {
      const { struct, data } = splitTdbRow(table, columns, row);
      return { struct, data };
    });

    const insertCols = [...structCols.map((c) => `"${c.name}"`), 'data', 'imported_at'];
    const recordset = [...structCols.map((c) => `"${c.name}" ${c.type}`), 'data jsonb', 'imported_at timestamptz'];
    let inserted = 0;
    let replacedOld = 0;
    const CHUNK = 500;

    for (let offset = 0; offset < records.length; offset += CHUNK) {
      const chunk = records.slice(offset, offset + CHUNK);
      // Remplacement : les lignes déjà présentes pour les mêmes entités sont supprimées.
      // tdb_mada est une ligne nationale unique → tout l'ancien contenu est remplacé.
      if (table === 'tdb_mada') {
        const del = await client.queryObject(
          `DELETE FROM public."${table}" WHERE imported_at <> $1::timestamptz`,
          [ts],
        );
        replacedOld += (del as any).rowCount ?? 0;
      } else {
        const keys = Array.from(new Set(
          chunk.map((r) => r.struct[key]).filter((v) => v !== null && v !== undefined),
        ));
        if (keys.length > 0) {
          const del = await client.queryObject(
            `DELETE FROM public."${table}" WHERE "${key}" = ANY($1::${intArrays ? 'bigint[]' : 'text[]'}) AND imported_at <> $2::timestamptz`,
            [keys, ts],
          );
          replacedOld += (del as any).rowCount ?? 0;
        }
      }

      const payload = chunk.map((r) => {
        const item: Record<string, any> = { data: r.data, imported_at: ts };
        for (const c of structCols) item[c.name] = r.struct[c.name] ?? null;
        return item;
      });
      await client.queryObject(
        `INSERT INTO public."${table}" (${insertCols.join(', ')})
         SELECT ${insertCols.join(', ')} FROM jsonb_to_recordset($1::jsonb) AS r(${recordset.join(', ')})`,
        [JSON.stringify(payload)],
      );
      inserted += chunk.length;
    }

    await client.queryObject(
      `INSERT INTO public.tdb_import_batches (id, table_name, file_name, row_count, imported_by, batch_ts_start, batch_ts_end, status)
       VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $6::timestamptz, 'completed')
       ON CONFLICT (id) DO UPDATE SET
         row_count = public.tdb_import_batches.row_count + EXCLUDED.row_count,
         batch_ts_start = LEAST(public.tdb_import_batches.batch_ts_start, EXCLUDED.batch_ts_start),
         batch_ts_end = GREATEST(public.tdb_import_batches.batch_ts_end, EXCLUDED.batch_ts_end),
         file_name = COALESCE(public.tdb_import_batches.file_name, EXCLUDED.file_name),
         status = 'completed'`,
      [batchId, table, input.fileName || null, inserted, input.importedBy || 'unknown', ts],
    );

    await client.queryObject('COMMIT');
    return { success: true, inserted, total: rows.length, batchId, batchTs: ts, replacedOld };
  } catch (e: any) {
    await client.queryObject('ROLLBACK').catch(() => {});
    const retryable = /timeout|connection|closed|reset|socket|network/i.test(e?.message || '')
      || ['57014', '40001', '40P01'].includes(e?.code);
    return { success: false, error: e?.message || 'Import impossible', retryable };
  }
}

/** Dernière ligne importée pour un périmètre, `data` aplati puis colonnes structurelles. */
export async function latestTdbRow(
  client: any,
  table: TdbTable,
  filters: Record<string, number>,
): Promise<any | null> {
  await ensureTdbTables(client);
  const conds: string[] = [];
  const params: any[] = [];
  for (const [column, value] of Object.entries(filters)) {
    if (Number(value) > 0 && STRUCT[table].some((c) => c.name === column)) {
      params.push(Number(value));
      conds.push(`"${column}" = $${params.length}`);
    }
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const res = await client.queryObject(
    `SELECT * FROM public."${table}" ${where} ORDER BY imported_at DESC, id DESC LIMIT 1`,
    params,
  );
  const row: any = res.rows?.[0];
  if (!row) return null;
  const data = row.data && typeof row.data === 'object' ? row.data : {};
  const flat: Record<string, any> = { ...data };
  for (const k of Object.keys(row)) {
    if (k === 'data' || k === 'id') continue;
    if (flat[k] === undefined || flat[k] === null) flat[k] = row[k];
  }
  return flat;
}

export async function listTdbRows(client: any, table: TdbTable, limit = 500, offset = 0) {
  await ensureTdbTables(client);
  const safeLimit = Math.min(Math.max(Number(limit) || 500, 1), 5000);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  return await client.queryObject(
    `SELECT * FROM public."${table}" ORDER BY id ASC LIMIT ${safeLimit} OFFSET ${safeOffset}`,
  );
}

/** Met à jour une ligne TDB ; les clés inconnues sont ignorées, un objet dans `data` reste du JSON. */
export async function updateTdbRow(client: any, table: TdbTable, id: any, values: Record<string, any>) {
  await ensureTdbTables(client);
  const colRes = await client.queryObject(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,
    [table],
  );
  const cols = new Set((colRes.rows as any[]).map((r) => r.column_name));
  const entries = Object.entries(values || {}).filter(([k]) => k !== 'id' && cols.has(k));
  if (entries.length === 0) return { success: false, error: 'Aucun champ à modifier' };
  const sets = entries.map(([k], i) => `"${k}" = $${i + 2}`).join(', ');
  const params = [id, ...entries.map(([k, v]) =>
    k === 'data' && v !== null && typeof v === 'object' ? JSON.stringify(v) : v)];
  const res = await client.queryObject(`UPDATE public."${table}" SET ${sets} WHERE id = $1 RETURNING *`, params);
  return { success: true, data: res.rows?.[0] ?? null };
}

export async function insertTdbRow(client: any, table: TdbTable, values: Record<string, any>) {
  await ensureTdbTables(client);
  const colRes = await client.queryObject(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,
    [table],
  );
  const cols = new Set((colRes.rows as any[]).map((r) => r.column_name));
  const entries = Object.entries(values || {}).filter(([k]) => k !== 'id' && cols.has(k));
  if (entries.length === 0) return { success: false, error: 'Aucun champ valide' };
  const names = entries.map(([k]) => `"${k}"`).join(', ');
  const placeholders = entries.map((_, i) => `$${i + 1}`).join(', ');
  const params = entries.map(([k, v]) =>
    k === 'data' && v !== null && typeof v === 'object' ? JSON.stringify(v) : v);
  const res = await client.queryObject(
    `INSERT INTO public."${table}" (${names}) VALUES (${placeholders}) RETURNING *`,
    params,
  );
  return { success: true, data: res.rows?.[0] ?? null };
}
