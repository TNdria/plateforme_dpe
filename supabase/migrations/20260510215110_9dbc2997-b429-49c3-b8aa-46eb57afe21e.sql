
CREATE TABLE IF NOT EXISTS public.tdb_import_batches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name text NOT NULL,
  file_name text,
  row_count integer NOT NULL DEFAULT 0,
  imported_by text,
  status text NOT NULL DEFAULT 'completed',
  batch_ts_start timestamptz NOT NULL,
  batch_ts_end timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

ALTER TABLE public.tdb_import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read import batches" ON public.tdb_import_batches FOR SELECT USING (true);
CREATE POLICY "Public write import batches" ON public.tdb_import_batches FOR ALL USING (true) WITH CHECK (true);

-- Enable INSERT/UPDATE/DELETE policies on tdb_* tables (currently SELECT-only)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tdb_ecole','tdb_ref','tdb_zap','tdb_cisco','tdb_dren','tdb_mada']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s write" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s write" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END $$;

-- Backfill the two batches just imported via psql
INSERT INTO public.tdb_import_batches (table_name, file_name, row_count, imported_by, batch_ts_start, batch_ts_end, notes) VALUES
  ('tdb_ref',   'df_ref-3.csv',        28210, 'system', '2026-05-10T21:48:55.067172+00', '2026-05-10T21:48:55.067172+00', 'Import initial via psql'),
  ('tdb_mada',  'df_mada-3.csv',           1, 'system', '2026-05-10T21:48:55.067172+00', '2026-05-10T21:48:55.067172+00', 'Import initial via psql'),
  ('tdb_dren',  'df_dren-3.csv',          23, 'system', '2026-05-10T21:48:55.067172+00', '2026-05-10T21:48:55.067172+00', 'Import initial via psql'),
  ('tdb_cisco', 'df_cisco-3.csv',        114, 'system', '2026-05-10T21:48:55.067172+00', '2026-05-10T21:48:55.067172+00', 'Import initial via psql'),
  ('tdb_zap',   'df_zap-3.csv',         1804, 'system', '2026-05-10T21:48:55.067172+00', '2026-05-10T21:48:55.067172+00', 'Import initial via psql'),
  ('tdb_ecole', 'df_tdbecoles-3.csv',    160, 'system', '2026-05-10T21:49:21.251524+00', '2026-05-10T21:49:21.251524+00', 'Import initial via psql');
