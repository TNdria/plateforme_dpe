import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendReferenceImport } from './referenceImport';
import { importReference } from '../../supabase/functions/db-query/refImport';
import { repairReferenceBatch } from '../../supabase/functions/db-query/refBatch';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('reference import connection recovery', () => {
  it('retries the identical payload after Firefox NetworkError', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockRejectedValueOnce(new TypeError('NetworkError when attempting to fetch resource.'))
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, inserted: 335 }) });
    vi.stubGlobal('fetch', fetcher);
    const pending = sendReferenceImport('/import', { kind: 'caisse', rows: [1] }, 'public-key');
    await vi.runAllTimersAsync();
    expect(await pending).toEqual({ inserted: 335 });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][1].body).toBe(fetcher.mock.calls[1][1].body);
  });

  it('does not retry a refused import', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'Accès refusé' }) });
    vi.stubGlobal('fetch', fetcher);
    await expect(sendReferenceImport('/import', {}, 'public-key')).rejects.toThrow('Accès refusé');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('atomic reference replacement', () => {
  const client = () => ({ queryObject: vi.fn().mockImplementation(async (sql: string) =>
    ({ rows: sql.includes('pg_try_advisory') ? [{ locked: true }] : sql.includes('SELECT now()') ? [{ batch_ts: '2026-11-07 08:19:00.123456+00' }] : [] })) });

  it.each(['caisse', 'population', 'population_cisco'])('links %s rows to the exact history timestamp', async (kind) => {
    const db = client();
    const rows = [{ annee: 2026, niveau: 'PRIMAIRE', code: 503140006, total: 100, code_dren: 51, code_cisco: 5101 }];
    expect((await importReference(db, { kind, rows })).inserted).toBe(1);
    const insert = db.queryObject.mock.calls.find(([sql]) => sql.startsWith('INSERT') && !sql.includes('tdb_import_batches'));
    const history = db.queryObject.mock.calls.find(([sql]) => sql.startsWith('INSERT') && sql.includes('tdb_import_batches'));
    expect(insert?.[1][1]).toBe('2026-11-07 08:19:00.123456+00');
    expect(history?.[1][5]).toBe(insert?.[1][1]);
    expect(insert?.[0]).toContain('$2::timestamptz');
  });

  it('sends 26418 caisse rows in one insert, preserving values', async () => {
    const db = client();
    const rows = Array.from({ length: 26418 }, (_, i) => ({ annee: 2026, niveau: 'PRIMAIRE', code: 503140006 + i, total: '2 565 500,5' }));
    const result = await importReference(db, { kind: 'caisse', rows });
    expect(result.inserted).toBe(26418);
    const inserts = db.queryObject.mock.calls.filter(([sql]) => sql.startsWith('INSERT') && !sql.includes('tdb_import_batches'));
    expect(inserts).toHaveLength(1);
    const data = JSON.parse(inserts[0][1][0]);
    expect(data).toHaveLength(26418);
    expect(data[0]).toEqual({ a: 2026, n: 'PRIMAIRE', c: 503140006, t: 2565500.5 });
    expect(db.queryObject.mock.calls.at(-1)?.[0]).toBe('COMMIT');
  });

  it('sends population ages and nulls in one insert', async () => {
    const db = client();
    const result = await importReference(db, { kind: 'population', rows: [{ annee: 2026, code_dren: 51, dren: 'ALAOTRA', g_3: 18895, f_3: 18681, t_3: 37576 }] });
    expect(result.inserted).toBe(1);
    const insert = db.queryObject.mock.calls.find(([sql]) => sql.startsWith('INSERT'));
    expect(JSON.parse(insert?.[1][0] ?? '[]')[0]).toMatchObject({ annee: 2026, code_dren: 51, g_3: 18895, f_3: 18681, t_3: 37576, t_17: null });
  });

  it('rolls back replacement when insertion fails', async () => {
    const db = client();
    db.queryObject.mockImplementation(async (sql: string) => {
      if (sql.startsWith('INSERT')) throw new Error('connection closed');
      return { rows: sql.includes('pg_try_advisory') ? [{ locked: true }] : sql.includes('SELECT now()') ? [{ batch_ts: '2026-11-07 08:19:00+00' }] : [] };
    });
    const result = await importReference(db, { kind: 'population', rows: [{ annee: 2026, code_dren: 51 }] });
    expect(result.success).toBe(false);
    expect(result.retryable).toBe(true);
    expect(db.queryObject.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
  });
});

describe('legacy reference batch recovery', () => {
  it('repairs an exact, complete, unambiguous transaction match', async () => {
    const db = { queryObject: vi.fn().mockResolvedValue({ rows: [{ row_count: 23, exact_rows: 23, linked_rows: 0, conflicts: 0 }] }) };
    await repairReferenceBatch(db, 'tdb_population_dren', 'population-old');
    expect(db.queryObject).toHaveBeenCalledTimes(2);
    expect(db.queryObject.mock.calls[1][0]).toContain('batch_ts_start = created_at, batch_ts_end = created_at');
    expect(db.queryObject.mock.calls[1][1]).toEqual(['population-old', 'tdb_population_dren']);
  });

  it.each([
    { row_count: 23, exact_rows: 22, linked_rows: 0, conflicts: 0 },
    { row_count: 23, exact_rows: 23, linked_rows: 23, conflicts: 0 },
    { row_count: 23, exact_rows: 23, linked_rows: 0, conflicts: 1 },
    { row_count: 0, exact_rows: 0, linked_rows: 0, conflicts: 0 },
  ])('does not reassign missing, already linked or ambiguous rows: %j', async (stats) => {
    const db = { queryObject: vi.fn().mockResolvedValue({ rows: [stats] }) };
    await repairReferenceBatch(db, 'tdb_population_cisco', 'old');
    expect(db.queryObject).toHaveBeenCalledTimes(1);
  });

  it('never queries an unsupported table', async () => {
    const db = { queryObject: vi.fn() };
    await repairReferenceBatch(db, 'tdb_ecole', 'old');
    expect(db.queryObject).not.toHaveBeenCalled();
  });
});