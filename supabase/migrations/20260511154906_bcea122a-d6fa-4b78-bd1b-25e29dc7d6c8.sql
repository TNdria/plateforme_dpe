
-- =============== TDB tables (CSV snapshot storage) ===============

CREATE TABLE IF NOT EXISTS public.tdb_mada (
  id BIGSERIAL PRIMARY KEY,
  "CODE_MADA" INTEGER,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tdb_dren (
  id BIGSERIAL PRIMARY KEY,
  "CODE_DREN" INTEGER,
  "DREN" TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tdb_dren_code_idx ON public.tdb_dren ("CODE_DREN");

CREATE TABLE IF NOT EXISTS public.tdb_cisco (
  id BIGSERIAL PRIMARY KEY,
  "CODE_DREN" INTEGER,
  "DREN" TEXT,
  "CODE_CISCO" INTEGER,
  "CISCO" TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tdb_cisco_code_idx ON public.tdb_cisco ("CODE_CISCO");
CREATE INDEX IF NOT EXISTS tdb_cisco_dren_idx ON public.tdb_cisco ("CODE_DREN");

CREATE TABLE IF NOT EXISTS public.tdb_zap (
  id BIGSERIAL PRIMARY KEY,
  "CODE_DREN" INTEGER,
  "DREN" TEXT,
  "CODE_CISCO" INTEGER,
  "CISCO" TEXT,
  "CODE_ZAP" INTEGER,
  "ZAP" TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tdb_zap_code_idx ON public.tdb_zap ("CODE_ZAP");
CREATE INDEX IF NOT EXISTS tdb_zap_cisco_idx ON public.tdb_zap ("CODE_CISCO");
CREATE INDEX IF NOT EXISTS tdb_zap_dren_idx ON public.tdb_zap ("CODE_DREN");

CREATE TABLE IF NOT EXISTS public.tdb_ecole (
  id BIGSERIAL PRIMARY KEY,
  "CODE_DREN" INTEGER,
  "DREN" TEXT,
  "CODE_CISCO" INTEGER,
  "CISCO" TEXT,
  "CODE_ZAP" INTEGER,
  "ZAP" TEXT,
  "CODE_ETAB" INTEGER,
  "NOM_ETAB" TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tdb_ecole_code_idx ON public.tdb_ecole ("CODE_ETAB");
CREATE INDEX IF NOT EXISTS tdb_ecole_zap_idx ON public.tdb_ecole ("CODE_ZAP");
CREATE INDEX IF NOT EXISTS tdb_ecole_cisco_idx ON public.tdb_ecole ("CODE_CISCO");
CREATE INDEX IF NOT EXISTS tdb_ecole_dren_idx ON public.tdb_ecole ("CODE_DREN");

CREATE TABLE IF NOT EXISTS public.tdb_ref (
  id BIGSERIAL PRIMARY KEY,
  "CODE_ETAB" INTEGER,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tdb_ref_code_idx ON public.tdb_ref ("CODE_ETAB");

-- =============== Import batches log ===============
CREATE TABLE IF NOT EXISTS public.tdb_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  file_name TEXT,
  row_count INTEGER NOT NULL DEFAULT 0,
  imported_by TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  batch_ts_start TIMESTAMPTZ NOT NULL,
  batch_ts_end TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tdb_import_batches_created_idx ON public.tdb_import_batches (created_at DESC);

-- =============== RLS: public read, no public write ===============
ALTER TABLE public.tdb_mada ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tdb_dren ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tdb_cisco ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tdb_zap ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tdb_ecole ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tdb_ref ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tdb_import_batches ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['tdb_mada','tdb_dren','tdb_cisco','tdb_zap','tdb_ecole','tdb_ref','tdb_import_batches']) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Public read %1$s" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "Public read %1$s" ON public.%1$I FOR SELECT USING (true)', t);
  END LOOP;
END $$;
