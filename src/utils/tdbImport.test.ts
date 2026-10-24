import { describe, expect, it, vi } from 'vitest';
import { importTdbRows, latestTdbRow, splitTdbRow } from '../../supabase/functions/db-query/tdbStore';

const client = () => ({
  queryObject: vi.fn().mockImplementation(async (sql: string) => (
    { rows: sql.includes('pg_try_advisory') ? [{ locked: true }] : [] }
  )),
});

describe('splitTdbRow', () => {
  it('sépare les colonnes structurelles et conserve toutes les autres dans data', () => {
    const { struct, data } = splitTdbRow(
      'tdb_dren',
      ['CODE_DREN', 'DREN', 'txAdmis', 'TX avec espace', 'red_CP1'],
      [51, 'ALAOTRA MANGORO', '12,5', '1 234', '0'],
    );
    expect(struct).toEqual({ CODE_DREN: 51, DREN: 'ALAOTRA MANGORO' });
    expect(data).toEqual({ txAdmis: 12.5, 'TX avec espace': 1234, red_CP1: 0 });
  });

  it('accepte les en-têtes accentués ou en minuscules pour les colonnes structurelles', () => {
    const { struct } = splitTdbRow('tdb_cisco', ['code_dren', 'Code_Cisco', 'CISCO'], ['11', '115', 'ANTANANARIVO']);
    expect(struct).toEqual({ CODE_DREN: 11, CODE_CISCO: 115, CISCO: 'ANTANANARIVO' });
  });

  it('garde les valeurs non numériques telles quelles et nullifie les vides', () => {
    const { data } = splitTdbRow('tdb_dren', ['code_dren', 'etat', 'vide'], [51, 'OK', '']);
    expect(data).toEqual({ etat: 'OK', vide: null });
  });
});

describe('import TDB dans la base du ministère', () => {
  it('remplace les lignes des mêmes entités et journalise le lot', async () => {
    const db = client();
    const result = await importTdbRows(db, {
      table: 'tdb_dren',
      columns: ['CODE_DREN', 'DREN', 'txAdmis'],
      rows: [[51, 'ALAOTRA', 12.5], [52, 'VAKINANKARATRA', 30]],
      fileName: 'df_dren.csv',
      importedBy: 'admin',
      batchId: 'batch-1',
      batchTs: '2026-10-22T10:00:00.000Z',
    });

    expect(result.success).toBe(true);
    expect(result.inserted).toBe(2);

    const calls = db.queryObject.mock.calls;
    // Les CREATE TABLE IF NOT EXISTS précèdent la transaction au premier appel.
    expect(calls.some(([sql]) => String(sql) === 'BEGIN')).toBe(true);
    const del = calls.find(([sql]) => String(sql).startsWith('DELETE FROM public."tdb_dren"'));
    expect(del?.[0]).toContain('"CODE_DREN" = ANY($1::bigint[])');
    expect(del?.[1]).toEqual([[51, 52], '2026-10-22T10:00:00.000Z']);

    const insert = calls.find(([sql]) => String(sql).startsWith('INSERT INTO public."tdb_dren"'));
    expect(insert?.[0]).toContain('jsonb_to_recordset($1::jsonb)');
    const payload = JSON.parse(insert?.[1]?.[0] ?? '[]');
    expect(payload).toHaveLength(2);
    expect(payload[0]).toEqual({
      CODE_DREN: 51, DREN: 'ALAOTRA', data: { txAdmis: 12.5 }, imported_at: '2026-10-22T10:00:00.000Z',
    });

    const batch = calls.find(([sql]) => String(sql).startsWith('INSERT INTO public.tdb_import_batches'));
    expect(batch?.[0]).toContain('ON CONFLICT (id) DO UPDATE');
    expect(batch?.[1]?.[0]).toBe('batch-1');
    expect(calls.at(-1)?.[0]).toBe('COMMIT');
  });

  it('remplace tout le contenu de tdb_mada (une seule ligne nationale)', async () => {
    const db = client();
    await importTdbRows(db, {
      table: 'tdb_mada',
      columns: ['code_mada', 'TPA'],
      rows: [[0, 4.2]],
      batchId: 'batch-mada',
      batchTs: '2026-10-22T10:00:00.000Z',
    });
    const del = db.queryObject.mock.calls.find(([sql]) => String(sql).startsWith('DELETE FROM public."tdb_mada"'));
    expect(del?.[0]).toContain('WHERE imported_at <> $1::timestamptz');
    expect(del?.[1]).toEqual(['2026-10-22T10:00:00.000Z']);
  });

  it('annule tout quand l’insertion échoue (retryable)', async () => {
    const db = client();
    db.queryObject.mockImplementation(async (sql: string) => {
      if (sql.startsWith('INSERT INTO public."tdb_dren"')) throw new Error('connection closed');
      return { rows: sql.includes('pg_try_advisory') ? [{ locked: true }] : [] };
    });
    const result = await importTdbRows(db, {
      table: 'tdb_dren',
      columns: ['CODE_DREN'],
      rows: [[51]],
    });
    expect(result.success).toBe(false);
    expect(result.retryable).toBe(true);
    expect(db.queryObject.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
  });

  it('refuse un import concurrent sans rien écrire', async () => {
    const db = client();
    db.queryObject.mockImplementation(async (sql: string) => (
      { rows: sql.includes('pg_try_advisory') ? [{ locked: false }] : [] }
    ));
    const result = await importTdbRows(db, {
      table: 'tdb_dren',
      columns: ['CODE_DREN'],
      rows: [[51]],
    });
    expect(result.retryable).toBe(true);
    expect(db.queryObject.mock.calls.some(([sql]) => String(sql).startsWith('INSERT'))).toBe(false);
    expect(db.queryObject.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
  });
});

describe('latestTdbRow', () => {
  it('aplatit data puis les colonnes et filtre sur le périmètre', async () => {
    const db = {
      queryObject: vi.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT * FROM public."tdb_dren"')) {
          return { rows: [{ id: 3, CODE_DREN: 51, DREN: 'ALAOTRA', data: { txAdmis: 12.5 }, imported_at: '2026-10-22' }] };
        }
        return { rows: [] };
      }),
    };
    const row = await latestTdbRow(db, 'tdb_dren', { CODE_DREN: 51 });
    expect(row).toEqual({ txAdmis: 12.5, CODE_DREN: 51, DREN: 'ALAOTRA', imported_at: '2026-10-22' });
    const select = db.queryObject.mock.calls.find(([sql]) => String(sql).includes('SELECT * FROM public."tdb_dren"'));
    expect(select?.[0]).toContain('WHERE "CODE_DREN" = $1');
    expect(select?.[1]).toEqual([51]);
  });
});
