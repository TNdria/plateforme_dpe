CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read app_settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Public can write app_settings" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);