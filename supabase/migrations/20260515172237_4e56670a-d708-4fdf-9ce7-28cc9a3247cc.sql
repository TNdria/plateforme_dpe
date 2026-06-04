
CREATE TABLE IF NOT EXISTS public.examen_cepe_candidates (
  id BIGSERIAL PRIMARY KEY,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  "ANNEE_SCOLAIRE" INTEGER,
  "CODE_ETAB" INTEGER,
  "GENRE" TEXT,
  "OP" NUMERIC,
  "PROBLEME" NUMERIC,
  "SVT" NUMERIC,
  "TFM" NUMERIC,
  "MALAGASY" NUMERIC,
  "FRANCAIS" NUMERIC,
  "GEOGRAPHIE" NUMERIC,
  "TOTAL" NUMERIC,
  "MOYENNE" NUMERIC,
  "CEPE" TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_examen_cepe_cand_year_etab ON public.examen_cepe_candidates ("ANNEE_SCOLAIRE", "CODE_ETAB");
CREATE INDEX IF NOT EXISTS idx_examen_cepe_cand_year ON public.examen_cepe_candidates ("ANNEE_SCOLAIRE");

ALTER TABLE public.examen_cepe_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read examen_cepe_candidates"
  ON public.examen_cepe_candidates FOR SELECT
  USING (true);
