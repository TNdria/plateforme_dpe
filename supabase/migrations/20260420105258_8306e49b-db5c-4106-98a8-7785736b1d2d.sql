
-- Table nationale (1 ligne)
CREATE TABLE IF NOT EXISTS public.tdb_mada (
  id SERIAL PRIMARY KEY,
  code_mada INTEGER DEFAULT 0,
  "txAbdcp1cp2" NUMERIC, "txAbdcp2ce" NUMERIC, "txAbdcecm1" NUMERIC, "txAbdcm1cm2" NUMERIC, "txAbdGlobal" NUMERIC,
  "txRetentionGarcons" NUMERIC, "txRetentionFilles" NUMERIC, "txRetentionTotal" NUMERIC,
  "red_CP1_g" NUMERIC, "red_CP1_f" NUMERIC, "red_CP1" NUMERIC,
  "red_CP2_g" NUMERIC, "red_CP2_f" NUMERIC, "red_CP2" NUMERIC,
  "red_CE_g" NUMERIC, "red_CE_f" NUMERIC, "red_CE" NUMERIC,
  "red_CM1_g" NUMERIC, "red_CM1_f" NUMERIC, "red_CM1" NUMERIC,
  "red_CM2_g" NUMERIC, "red_CM2_f" NUMERIC, "red_CM2" NUMERIC,
  "red_garcons" NUMERIC, "red_fille" NUMERIC, "red_ensemble" NUMERIC,
  "tx_admis_g" NUMERIC, "tx_admis_f" NUMERIC, "tx_admis" NUMERIC,
  "sm_op" NUMERIC, "sup_10_op" NUMERIC, "sm_probleme" NUMERIC, "sup_10_probleme" NUMERIC,
  "sm_maths" NUMERIC, "sup_10_maths" NUMERIC, "sm_tfm" NUMERIC, "sup_10_tfm" NUMERIC,
  "sm_mlg" NUMERIC, "sup_10_mlg" NUMERIC, "sm_fr" NUMERIC, "sup_10_fr" NUMERIC,
  "sm_geo" NUMERIC, "sup_10_geo" NUMERIC, "sm_svt" NUMERIC, "sup_10_svt" NUMERIC,
  "nombre_eleves" NUMERIC, "ens_classe" NUMERIC, "ens_im" NUMERIC,
  "fram_sub" NUMERIC, "fram_nonsub" NUMERIC, "nombre_section" NUMERIC,
  "ecole_continue" NUMERIC, "eleve_2km" NUMERIC, "point_eau" NUMERIC, "electricite" NUMERIC,
  "ratio_em" NUMERIC, "ratio_eq" NUMERIC, "ratio_cpsdc" NUMERIC, "ratio_epa" NUMERIC,
  "ratio_wc_com" NUMERIC, "ratio_wc_f" NUMERIC,
  "ratio_emlg" NUMERIC, "ratio_emths" NUMERIC, "ratio_efrs" NUMERIC,
  "montant_ce" NUMERIC, "ratio_ece" NUMERIC,
  "mlg_sc1" NUMERIC, "mlg_sc2" NUMERIC, "fr_sc1" NUMERIC, "fr_sc2" NUMERIC, "maths_sc1" NUMERIC, "maths_sc2" NUMERIC,
  "TPA" NUMERIC,
  imported_at TIMESTAMPTZ DEFAULT now()
);

-- Table par DREN
CREATE TABLE IF NOT EXISTS public.tdb_dren (
  id SERIAL PRIMARY KEY,
  "CODE_DREN" INTEGER, "DREN" TEXT,
  "txAbdcp1cp2" NUMERIC, "txAbdcp2ce" NUMERIC, "txAbdcecm1" NUMERIC, "txAbdcm1cm2" NUMERIC, "txAbdGlobal" NUMERIC,
  "txRetentionGarcons" NUMERIC, "txRetentionFilles" NUMERIC, "txRetentionTotal" NUMERIC,
  "red_CP1_g" NUMERIC, "red_CP1_f" NUMERIC, "red_CP1" NUMERIC,
  "red_CP2_g" NUMERIC, "red_CP2_f" NUMERIC, "red_CP2" NUMERIC,
  "red_CE_g" NUMERIC, "red_CE_f" NUMERIC, "red_CE" NUMERIC,
  "red_CM1_g" NUMERIC, "red_CM1_f" NUMERIC, "red_CM1" NUMERIC,
  "red_CM2_g" NUMERIC, "red_CM2_f" NUMERIC, "red_CM2" NUMERIC,
  "red_garcons" NUMERIC, "red_fille" NUMERIC, "red_ensemble" NUMERIC,
  "tx_admis_g" NUMERIC, "tx_admis_f" NUMERIC, "tx_admis" NUMERIC,
  "sm_op" NUMERIC, "sup_10_op" NUMERIC, "sm_probleme" NUMERIC, "sup_10_probleme" NUMERIC,
  "sm_maths" NUMERIC, "sup_10_maths" NUMERIC, "sm_tfm" NUMERIC, "sup_10_tfm" NUMERIC,
  "sm_mlg" NUMERIC, "sup_10_mlg" NUMERIC, "sm_fr" NUMERIC, "sup_10_fr" NUMERIC,
  "sm_geo" NUMERIC, "sup_10_geo" NUMERIC, "sm_svt" NUMERIC, "sup_10_svt" NUMERIC,
  "nombre_eleves" NUMERIC, "ens_classe" NUMERIC, "ens_im" NUMERIC,
  "fram_sub" NUMERIC, "fram_nonsub" NUMERIC, "nombre_section" NUMERIC,
  "ecole_continue" NUMERIC, "eleve_2km" NUMERIC, "point_eau" NUMERIC, "electricite" NUMERIC,
  "ratio_em" NUMERIC, "ratio_eq" NUMERIC, "ratio_cpsdc" NUMERIC, "ratio_epa" NUMERIC,
  "ratio_wc_com" NUMERIC, "ratio_wc_f" NUMERIC,
  "ratio_emlg" NUMERIC, "ratio_emths" NUMERIC, "ratio_efrs" NUMERIC,
  "montant_ce" NUMERIC, "ratio_ece" NUMERIC,
  "mlg_sc1" NUMERIC, "mlg_sc2" NUMERIC, "fr_sc1" NUMERIC, "fr_sc2" NUMERIC, "maths_sc1" NUMERIC, "maths_sc2" NUMERIC,
  "TPA" NUMERIC,
  imported_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tdb_dren_code ON public.tdb_dren("CODE_DREN");

-- Table par CISCO
CREATE TABLE IF NOT EXISTS public.tdb_cisco (
  id SERIAL PRIMARY KEY,
  "CODE_CISCO" INTEGER, "CISCO" TEXT, "CODE_DREN" INTEGER, "DREN" TEXT,
  "txAbdcp1cp2" NUMERIC, "txAbdcp2ce" NUMERIC, "txAbdcecm1" NUMERIC, "txAbdcm1cm2" NUMERIC, "txAbdGlobal" NUMERIC,
  "txRetentionGarcons" NUMERIC, "txRetentionFilles" NUMERIC, "txRetentionTotal" NUMERIC,
  "red_CP1_g" NUMERIC, "red_CP1_f" NUMERIC, "red_CP1" NUMERIC,
  "red_CP2_g" NUMERIC, "red_CP2_f" NUMERIC, "red_CP2" NUMERIC,
  "red_CE_g" NUMERIC, "red_CE_f" NUMERIC, "red_CE" NUMERIC,
  "red_CM1_g" NUMERIC, "red_CM1_f" NUMERIC, "red_CM1" NUMERIC,
  "red_CM2_g" NUMERIC, "red_CM2_f" NUMERIC, "red_CM2" NUMERIC,
  "red_garcons" NUMERIC, "red_fille" NUMERIC, "red_ensemble" NUMERIC,
  "tx_admis_g" NUMERIC, "tx_admis_f" NUMERIC, "tx_admis" NUMERIC,
  "sm_op" NUMERIC, "sup_10_op" NUMERIC, "sm_probleme" NUMERIC, "sup_10_probleme" NUMERIC,
  "sm_maths" NUMERIC, "sup_10_maths" NUMERIC, "sm_tfm" NUMERIC, "sup_10_tfm" NUMERIC,
  "sm_mlg" NUMERIC, "sup_10_mlg" NUMERIC, "sm_fr" NUMERIC, "sup_10_fr" NUMERIC,
  "sm_geo" NUMERIC, "sup_10_geo" NUMERIC, "sm_svt" NUMERIC, "sup_10_svt" NUMERIC,
  "nombre_eleves" NUMERIC, "ens_classe" NUMERIC, "ens_im" NUMERIC,
  "fram_sub" NUMERIC, "fram_nonsub" NUMERIC, "nombre_section" NUMERIC,
  "ecole_continue" NUMERIC, "eleve_2km" NUMERIC, "point_eau" NUMERIC, "electricite" NUMERIC,
  "ratio_em" NUMERIC, "ratio_eq" NUMERIC, "ratio_cpsdc" NUMERIC, "ratio_epa" NUMERIC,
  "ratio_wc_com" NUMERIC, "ratio_wc_f" NUMERIC,
  "ratio_emlg" NUMERIC, "ratio_emths" NUMERIC, "ratio_efrs" NUMERIC,
  "montant_ce" NUMERIC, "ratio_ece" NUMERIC,
  "mlg_sc1" NUMERIC, "mlg_sc2" NUMERIC, "fr_sc1" NUMERIC, "fr_sc2" NUMERIC, "maths_sc1" NUMERIC, "maths_sc2" NUMERIC,
  "TPA" NUMERIC,
  imported_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tdb_cisco_code ON public.tdb_cisco("CODE_CISCO");
CREATE INDEX IF NOT EXISTS idx_tdb_cisco_dren ON public.tdb_cisco("CODE_DREN");

-- Table par ZAP
CREATE TABLE IF NOT EXISTS public.tdb_zap (
  id SERIAL PRIMARY KEY,
  "CODE_ZAP" INTEGER, "ZAP" TEXT, "CODE_CISCO" INTEGER, "CISCO" TEXT, "CODE_DREN" INTEGER, "DREN" TEXT,
  "txAbdcp1cp2" NUMERIC, "txAbdcp2ce" NUMERIC, "txAbdcecm1" NUMERIC, "txAbdcm1cm2" NUMERIC, "txAbdGlobal" NUMERIC,
  "txRetentionGarcons" NUMERIC, "txRetentionFilles" NUMERIC, "txRetentionTotal" NUMERIC,
  "red_CP1_g" NUMERIC, "red_CP1_f" NUMERIC, "red_CP1" NUMERIC,
  "red_CP2_g" NUMERIC, "red_CP2_f" NUMERIC, "red_CP2" NUMERIC,
  "red_CE_g" NUMERIC, "red_CE_f" NUMERIC, "red_CE" NUMERIC,
  "red_CM1_g" NUMERIC, "red_CM1_f" NUMERIC, "red_CM1" NUMERIC,
  "red_CM2_g" NUMERIC, "red_CM2_f" NUMERIC, "red_CM2" NUMERIC,
  "red_garcons" NUMERIC, "red_fille" NUMERIC, "red_ensemble" NUMERIC,
  "tx_admis_g" NUMERIC, "tx_admis_f" NUMERIC, "tx_admis" NUMERIC,
  "sm_op" NUMERIC, "sup_10_op" NUMERIC, "sm_probleme" NUMERIC, "sup_10_probleme" NUMERIC,
  "sm_maths" NUMERIC, "sup_10_maths" NUMERIC, "sm_tfm" NUMERIC, "sup_10_tfm" NUMERIC,
  "sm_mlg" NUMERIC, "sup_10_mlg" NUMERIC, "sm_fr" NUMERIC, "sup_10_fr" NUMERIC,
  "sm_geo" NUMERIC, "sup_10_geo" NUMERIC, "sm_svt" NUMERIC, "sup_10_svt" NUMERIC,
  "nombre_eleves" NUMERIC, "ens_classe" NUMERIC, "ens_im" NUMERIC,
  "fram_sub" NUMERIC, "fram_nonsub" NUMERIC, "nombre_section" NUMERIC,
  "ecole_continue" NUMERIC, "eleve_2km" NUMERIC, "point_eau" NUMERIC, "electricite" NUMERIC,
  "ratio_em" NUMERIC, "ratio_eq" NUMERIC, "ratio_cpsdc" NUMERIC, "ratio_epa" NUMERIC,
  "ratio_wc_com" NUMERIC, "ratio_wc_f" NUMERIC,
  "ratio_emlg" NUMERIC, "ratio_emths" NUMERIC, "ratio_efrs" NUMERIC,
  "montant_ce" NUMERIC, "ratio_ece" NUMERIC,
  "mlg_sc1" NUMERIC, "mlg_sc2" NUMERIC, "fr_sc1" NUMERIC, "fr_sc2" NUMERIC, "maths_sc1" NUMERIC, "maths_sc2" NUMERIC,
  "TPA" NUMERIC,
  imported_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tdb_zap_code ON public.tdb_zap("CODE_ZAP");
CREATE INDEX IF NOT EXISTS idx_tdb_zap_cisco ON public.tdb_zap("CODE_CISCO");

-- Table par école
CREATE TABLE IF NOT EXISTS public.tdb_ecole (
  id SERIAL PRIMARY KEY,
  "CODE_ETAB" BIGINT, "NOM_ETAB" TEXT,
  "CODE_ZAP" INTEGER, "ZAP" TEXT, "CODE_CISCO" INTEGER, "CISCO" TEXT, "CODE_DREN" INTEGER, "DREN" TEXT,
  "txAbdcp1cp2" NUMERIC, "txAbdcp2ce" NUMERIC, "txAbdcecm1" NUMERIC, "txAbdcm1cm2" NUMERIC, "txAbdGlobal" NUMERIC,
  "txRetentionGarcons" NUMERIC, "txRetentionFilles" NUMERIC, "txRetentionTotal" NUMERIC,
  "profilRetGarcons" TEXT, "profilRetFilles" TEXT, "profilRetEnsemble" TEXT,
  "red_CP1_g" NUMERIC, "red_CP1_f" NUMERIC, "red_CP1" NUMERIC,
  "red_CP2_g" NUMERIC, "red_CP2_f" NUMERIC, "red_CP2" NUMERIC,
  "red_CE_g" NUMERIC, "red_CE_f" NUMERIC, "red_CE" NUMERIC,
  "red_CM1_g" NUMERIC, "red_CM1_f" NUMERIC, "red_CM1" NUMERIC,
  "red_CM2_g" NUMERIC, "red_CM2_f" NUMERIC, "red_CM2" NUMERIC,
  "red_garcons" NUMERIC, "red_fille" NUMERIC, "red_ensemble" NUMERIC,
  "tx_admis_g" NUMERIC, "tx_admis_f" NUMERIC, "tx_admis" NUMERIC,
  "sm_op" NUMERIC, "sup_10_op" NUMERIC, "sm_probleme" NUMERIC, "sup_10_probleme" NUMERIC,
  "sm_maths" NUMERIC, "sup_10_maths" NUMERIC, "sm_tfm" NUMERIC, "sup_10_tfm" NUMERIC,
  "sm_mlg" NUMERIC, "sup_10_mlg" NUMERIC, "sm_fr" NUMERIC, "sup_10_fr" NUMERIC,
  "sm_geo" NUMERIC, "sup_10_geo" NUMERIC, "sm_svt" NUMERIC, "sup_10_svt" NUMERIC,
  "nombre_eleves" NUMERIC, "ens_classe" NUMERIC, "ens_im" NUMERIC,
  "fram_sub" NUMERIC, "fram_nonsub" NUMERIC, "nombre_section" NUMERIC,
  "ecole_continue" TEXT, "eleve_2km" NUMERIC, "point_eau" TEXT, "electricite" TEXT,
  "ratio_em" NUMERIC, "ratio_eq" NUMERIC, "ratio_cpsdc" NUMERIC, "ratio_epa" NUMERIC,
  "ratio_wc_com" NUMERIC, "ratio_wc_f" NUMERIC,
  "ratio_emlg" NUMERIC, "ratio_emths" NUMERIC, "ratio_efrs" NUMERIC,
  "montant_ce" NUMERIC, "ratio_ece" NUMERIC,
  "mlg_sc1" NUMERIC, "mlg_sc2" NUMERIC, "fr_sc1" NUMERIC, "fr_sc2" NUMERIC, "maths_sc1" NUMERIC, "maths_sc2" NUMERIC,
  "TPA" NUMERIC,
  imported_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tdb_ecole_code ON public.tdb_ecole("CODE_ETAB");
CREATE INDEX IF NOT EXISTS idx_tdb_ecole_zap ON public.tdb_ecole("CODE_ZAP");
CREATE INDEX IF NOT EXISTS idx_tdb_ecole_cisco ON public.tdb_ecole("CODE_CISCO");

-- RLS : lecture publique (consultation TDB sans auth), écriture via edge function service-role uniquement
ALTER TABLE public.tdb_mada ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tdb_dren ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tdb_cisco ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tdb_zap ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tdb_ecole ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tdb_mada read" ON public.tdb_mada FOR SELECT USING (true);
CREATE POLICY "tdb_dren read" ON public.tdb_dren FOR SELECT USING (true);
CREATE POLICY "tdb_cisco read" ON public.tdb_cisco FOR SELECT USING (true);
CREATE POLICY "tdb_zap read" ON public.tdb_zap FOR SELECT USING (true);
CREATE POLICY "tdb_ecole read" ON public.tdb_ecole FOR SELECT USING (true);
