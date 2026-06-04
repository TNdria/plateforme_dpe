export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      tdb_cisco: {
        Row: {
          CISCO: string | null
          CODE_CISCO: number | null
          CODE_DREN: number | null
          DREN: string | null
          ecole_continue: number | null
          electricite: number | null
          eleve_2km: number | null
          ens_classe: number | null
          ens_im: number | null
          fr_sc1: number | null
          fr_sc2: number | null
          fram_nonsub: number | null
          fram_sub: number | null
          id: number
          imported_at: string | null
          maths_sc1: number | null
          maths_sc2: number | null
          mlg_sc1: number | null
          mlg_sc2: number | null
          montant_ce: number | null
          nombre_eleves: number | null
          nombre_section: number | null
          point_eau: number | null
          ratio_cpsdc: number | null
          ratio_ece: number | null
          ratio_efrs: number | null
          ratio_em: number | null
          ratio_emlg: number | null
          ratio_emths: number | null
          ratio_epa: number | null
          ratio_eq: number | null
          ratio_wc_com: number | null
          ratio_wc_f: number | null
          red_CE: number | null
          red_CE_f: number | null
          red_CE_g: number | null
          red_CM1: number | null
          red_CM1_f: number | null
          red_CM1_g: number | null
          red_CM2: number | null
          red_CM2_f: number | null
          red_CM2_g: number | null
          red_CP1: number | null
          red_CP1_f: number | null
          red_CP1_g: number | null
          red_CP2: number | null
          red_CP2_f: number | null
          red_CP2_g: number | null
          red_ensemble: number | null
          red_fille: number | null
          red_garcons: number | null
          sm_fr: number | null
          sm_geo: number | null
          sm_maths: number | null
          sm_mlg: number | null
          sm_op: number | null
          sm_probleme: number | null
          sm_svt: number | null
          sm_tfm: number | null
          sup_10_fr: number | null
          sup_10_geo: number | null
          sup_10_maths: number | null
          sup_10_mlg: number | null
          sup_10_op: number | null
          sup_10_probleme: number | null
          sup_10_svt: number | null
          sup_10_tfm: number | null
          TPA: number | null
          tx_admis: number | null
          tx_admis_f: number | null
          tx_admis_g: number | null
          txAbdcecm1: number | null
          txAbdcm1cm2: number | null
          txAbdcp1cp2: number | null
          txAbdcp2ce: number | null
          txAbdGlobal: number | null
          txRetentionFilles: number | null
          txRetentionGarcons: number | null
          txRetentionTotal: number | null
        }
        Insert: {
          CISCO?: string | null
          CODE_CISCO?: number | null
          CODE_DREN?: number | null
          DREN?: string | null
          ecole_continue?: number | null
          electricite?: number | null
          eleve_2km?: number | null
          ens_classe?: number | null
          ens_im?: number | null
          fr_sc1?: number | null
          fr_sc2?: number | null
          fram_nonsub?: number | null
          fram_sub?: number | null
          id?: number
          imported_at?: string | null
          maths_sc1?: number | null
          maths_sc2?: number | null
          mlg_sc1?: number | null
          mlg_sc2?: number | null
          montant_ce?: number | null
          nombre_eleves?: number | null
          nombre_section?: number | null
          point_eau?: number | null
          ratio_cpsdc?: number | null
          ratio_ece?: number | null
          ratio_efrs?: number | null
          ratio_em?: number | null
          ratio_emlg?: number | null
          ratio_emths?: number | null
          ratio_epa?: number | null
          ratio_eq?: number | null
          ratio_wc_com?: number | null
          ratio_wc_f?: number | null
          red_CE?: number | null
          red_CE_f?: number | null
          red_CE_g?: number | null
          red_CM1?: number | null
          red_CM1_f?: number | null
          red_CM1_g?: number | null
          red_CM2?: number | null
          red_CM2_f?: number | null
          red_CM2_g?: number | null
          red_CP1?: number | null
          red_CP1_f?: number | null
          red_CP1_g?: number | null
          red_CP2?: number | null
          red_CP2_f?: number | null
          red_CP2_g?: number | null
          red_ensemble?: number | null
          red_fille?: number | null
          red_garcons?: number | null
          sm_fr?: number | null
          sm_geo?: number | null
          sm_maths?: number | null
          sm_mlg?: number | null
          sm_op?: number | null
          sm_probleme?: number | null
          sm_svt?: number | null
          sm_tfm?: number | null
          sup_10_fr?: number | null
          sup_10_geo?: number | null
          sup_10_maths?: number | null
          sup_10_mlg?: number | null
          sup_10_op?: number | null
          sup_10_probleme?: number | null
          sup_10_svt?: number | null
          sup_10_tfm?: number | null
          TPA?: number | null
          tx_admis?: number | null
          tx_admis_f?: number | null
          tx_admis_g?: number | null
          txAbdcecm1?: number | null
          txAbdcm1cm2?: number | null
          txAbdcp1cp2?: number | null
          txAbdcp2ce?: number | null
          txAbdGlobal?: number | null
          txRetentionFilles?: number | null
          txRetentionGarcons?: number | null
          txRetentionTotal?: number | null
        }
        Update: {
          CISCO?: string | null
          CODE_CISCO?: number | null
          CODE_DREN?: number | null
          DREN?: string | null
          ecole_continue?: number | null
          electricite?: number | null
          eleve_2km?: number | null
          ens_classe?: number | null
          ens_im?: number | null
          fr_sc1?: number | null
          fr_sc2?: number | null
          fram_nonsub?: number | null
          fram_sub?: number | null
          id?: number
          imported_at?: string | null
          maths_sc1?: number | null
          maths_sc2?: number | null
          mlg_sc1?: number | null
          mlg_sc2?: number | null
          montant_ce?: number | null
          nombre_eleves?: number | null
          nombre_section?: number | null
          point_eau?: number | null
          ratio_cpsdc?: number | null
          ratio_ece?: number | null
          ratio_efrs?: number | null
          ratio_em?: number | null
          ratio_emlg?: number | null
          ratio_emths?: number | null
          ratio_epa?: number | null
          ratio_eq?: number | null
          ratio_wc_com?: number | null
          ratio_wc_f?: number | null
          red_CE?: number | null
          red_CE_f?: number | null
          red_CE_g?: number | null
          red_CM1?: number | null
          red_CM1_f?: number | null
          red_CM1_g?: number | null
          red_CM2?: number | null
          red_CM2_f?: number | null
          red_CM2_g?: number | null
          red_CP1?: number | null
          red_CP1_f?: number | null
          red_CP1_g?: number | null
          red_CP2?: number | null
          red_CP2_f?: number | null
          red_CP2_g?: number | null
          red_ensemble?: number | null
          red_fille?: number | null
          red_garcons?: number | null
          sm_fr?: number | null
          sm_geo?: number | null
          sm_maths?: number | null
          sm_mlg?: number | null
          sm_op?: number | null
          sm_probleme?: number | null
          sm_svt?: number | null
          sm_tfm?: number | null
          sup_10_fr?: number | null
          sup_10_geo?: number | null
          sup_10_maths?: number | null
          sup_10_mlg?: number | null
          sup_10_op?: number | null
          sup_10_probleme?: number | null
          sup_10_svt?: number | null
          sup_10_tfm?: number | null
          TPA?: number | null
          tx_admis?: number | null
          tx_admis_f?: number | null
          tx_admis_g?: number | null
          txAbdcecm1?: number | null
          txAbdcm1cm2?: number | null
          txAbdcp1cp2?: number | null
          txAbdcp2ce?: number | null
          txAbdGlobal?: number | null
          txRetentionFilles?: number | null
          txRetentionGarcons?: number | null
          txRetentionTotal?: number | null
        }
        Relationships: []
      }
      tdb_dren: {
        Row: {
          CODE_DREN: number | null
          DREN: string | null
          ecole_continue: number | null
          electricite: number | null
          eleve_2km: number | null
          ens_classe: number | null
          ens_im: number | null
          fr_sc1: number | null
          fr_sc2: number | null
          fram_nonsub: number | null
          fram_sub: number | null
          id: number
          imported_at: string | null
          maths_sc1: number | null
          maths_sc2: number | null
          mlg_sc1: number | null
          mlg_sc2: number | null
          montant_ce: number | null
          nombre_eleves: number | null
          nombre_section: number | null
          point_eau: number | null
          ratio_cpsdc: number | null
          ratio_ece: number | null
          ratio_efrs: number | null
          ratio_em: number | null
          ratio_emlg: number | null
          ratio_emths: number | null
          ratio_epa: number | null
          ratio_eq: number | null
          ratio_wc_com: number | null
          ratio_wc_f: number | null
          red_CE: number | null
          red_CE_f: number | null
          red_CE_g: number | null
          red_CM1: number | null
          red_CM1_f: number | null
          red_CM1_g: number | null
          red_CM2: number | null
          red_CM2_f: number | null
          red_CM2_g: number | null
          red_CP1: number | null
          red_CP1_f: number | null
          red_CP1_g: number | null
          red_CP2: number | null
          red_CP2_f: number | null
          red_CP2_g: number | null
          red_ensemble: number | null
          red_fille: number | null
          red_garcons: number | null
          sm_fr: number | null
          sm_geo: number | null
          sm_maths: number | null
          sm_mlg: number | null
          sm_op: number | null
          sm_probleme: number | null
          sm_svt: number | null
          sm_tfm: number | null
          sup_10_fr: number | null
          sup_10_geo: number | null
          sup_10_maths: number | null
          sup_10_mlg: number | null
          sup_10_op: number | null
          sup_10_probleme: number | null
          sup_10_svt: number | null
          sup_10_tfm: number | null
          TPA: number | null
          tx_admis: number | null
          tx_admis_f: number | null
          tx_admis_g: number | null
          txAbdcecm1: number | null
          txAbdcm1cm2: number | null
          txAbdcp1cp2: number | null
          txAbdcp2ce: number | null
          txAbdGlobal: number | null
          txRetentionFilles: number | null
          txRetentionGarcons: number | null
          txRetentionTotal: number | null
        }
        Insert: {
          CODE_DREN?: number | null
          DREN?: string | null
          ecole_continue?: number | null
          electricite?: number | null
          eleve_2km?: number | null
          ens_classe?: number | null
          ens_im?: number | null
          fr_sc1?: number | null
          fr_sc2?: number | null
          fram_nonsub?: number | null
          fram_sub?: number | null
          id?: number
          imported_at?: string | null
          maths_sc1?: number | null
          maths_sc2?: number | null
          mlg_sc1?: number | null
          mlg_sc2?: number | null
          montant_ce?: number | null
          nombre_eleves?: number | null
          nombre_section?: number | null
          point_eau?: number | null
          ratio_cpsdc?: number | null
          ratio_ece?: number | null
          ratio_efrs?: number | null
          ratio_em?: number | null
          ratio_emlg?: number | null
          ratio_emths?: number | null
          ratio_epa?: number | null
          ratio_eq?: number | null
          ratio_wc_com?: number | null
          ratio_wc_f?: number | null
          red_CE?: number | null
          red_CE_f?: number | null
          red_CE_g?: number | null
          red_CM1?: number | null
          red_CM1_f?: number | null
          red_CM1_g?: number | null
          red_CM2?: number | null
          red_CM2_f?: number | null
          red_CM2_g?: number | null
          red_CP1?: number | null
          red_CP1_f?: number | null
          red_CP1_g?: number | null
          red_CP2?: number | null
          red_CP2_f?: number | null
          red_CP2_g?: number | null
          red_ensemble?: number | null
          red_fille?: number | null
          red_garcons?: number | null
          sm_fr?: number | null
          sm_geo?: number | null
          sm_maths?: number | null
          sm_mlg?: number | null
          sm_op?: number | null
          sm_probleme?: number | null
          sm_svt?: number | null
          sm_tfm?: number | null
          sup_10_fr?: number | null
          sup_10_geo?: number | null
          sup_10_maths?: number | null
          sup_10_mlg?: number | null
          sup_10_op?: number | null
          sup_10_probleme?: number | null
          sup_10_svt?: number | null
          sup_10_tfm?: number | null
          TPA?: number | null
          tx_admis?: number | null
          tx_admis_f?: number | null
          tx_admis_g?: number | null
          txAbdcecm1?: number | null
          txAbdcm1cm2?: number | null
          txAbdcp1cp2?: number | null
          txAbdcp2ce?: number | null
          txAbdGlobal?: number | null
          txRetentionFilles?: number | null
          txRetentionGarcons?: number | null
          txRetentionTotal?: number | null
        }
        Update: {
          CODE_DREN?: number | null
          DREN?: string | null
          ecole_continue?: number | null
          electricite?: number | null
          eleve_2km?: number | null
          ens_classe?: number | null
          ens_im?: number | null
          fr_sc1?: number | null
          fr_sc2?: number | null
          fram_nonsub?: number | null
          fram_sub?: number | null
          id?: number
          imported_at?: string | null
          maths_sc1?: number | null
          maths_sc2?: number | null
          mlg_sc1?: number | null
          mlg_sc2?: number | null
          montant_ce?: number | null
          nombre_eleves?: number | null
          nombre_section?: number | null
          point_eau?: number | null
          ratio_cpsdc?: number | null
          ratio_ece?: number | null
          ratio_efrs?: number | null
          ratio_em?: number | null
          ratio_emlg?: number | null
          ratio_emths?: number | null
          ratio_epa?: number | null
          ratio_eq?: number | null
          ratio_wc_com?: number | null
          ratio_wc_f?: number | null
          red_CE?: number | null
          red_CE_f?: number | null
          red_CE_g?: number | null
          red_CM1?: number | null
          red_CM1_f?: number | null
          red_CM1_g?: number | null
          red_CM2?: number | null
          red_CM2_f?: number | null
          red_CM2_g?: number | null
          red_CP1?: number | null
          red_CP1_f?: number | null
          red_CP1_g?: number | null
          red_CP2?: number | null
          red_CP2_f?: number | null
          red_CP2_g?: number | null
          red_ensemble?: number | null
          red_fille?: number | null
          red_garcons?: number | null
          sm_fr?: number | null
          sm_geo?: number | null
          sm_maths?: number | null
          sm_mlg?: number | null
          sm_op?: number | null
          sm_probleme?: number | null
          sm_svt?: number | null
          sm_tfm?: number | null
          sup_10_fr?: number | null
          sup_10_geo?: number | null
          sup_10_maths?: number | null
          sup_10_mlg?: number | null
          sup_10_op?: number | null
          sup_10_probleme?: number | null
          sup_10_svt?: number | null
          sup_10_tfm?: number | null
          TPA?: number | null
          tx_admis?: number | null
          tx_admis_f?: number | null
          tx_admis_g?: number | null
          txAbdcecm1?: number | null
          txAbdcm1cm2?: number | null
          txAbdcp1cp2?: number | null
          txAbdcp2ce?: number | null
          txAbdGlobal?: number | null
          txRetentionFilles?: number | null
          txRetentionGarcons?: number | null
          txRetentionTotal?: number | null
        }
        Relationships: []
      }
      tdb_ecole: {
        Row: {
          CISCO: string | null
          CODE_CISCO: number | null
          CODE_DREN: number | null
          CODE_ETAB: number | null
          CODE_ZAP: number | null
          DREN: string | null
          ecole_continue: string | null
          electricite: string | null
          eleve_2km: number | null
          ens_classe: number | null
          ens_im: number | null
          fr_sc1: number | null
          fr_sc2: number | null
          fram_nonsub: number | null
          fram_sub: number | null
          id: number
          imported_at: string | null
          maths_sc1: number | null
          maths_sc2: number | null
          mlg_sc1: number | null
          mlg_sc2: number | null
          montant_ce: number | null
          NOM_ETAB: string | null
          nombre_eleves: number | null
          nombre_section: number | null
          point_eau: string | null
          profilRetEnsemble: string | null
          profilRetFilles: string | null
          profilRetGarcons: string | null
          ratio_cpsdc: number | null
          ratio_ece: number | null
          ratio_efrs: number | null
          ratio_em: number | null
          ratio_emlg: number | null
          ratio_emths: number | null
          ratio_epa: number | null
          ratio_eq: number | null
          ratio_wc_com: number | null
          ratio_wc_f: number | null
          red_CE: number | null
          red_CE_f: number | null
          red_CE_g: number | null
          red_CM1: number | null
          red_CM1_f: number | null
          red_CM1_g: number | null
          red_CM2: number | null
          red_CM2_f: number | null
          red_CM2_g: number | null
          red_CP1: number | null
          red_CP1_f: number | null
          red_CP1_g: number | null
          red_CP2: number | null
          red_CP2_f: number | null
          red_CP2_g: number | null
          red_ensemble: number | null
          red_fille: number | null
          red_garcons: number | null
          sm_fr: number | null
          sm_geo: number | null
          sm_maths: number | null
          sm_mlg: number | null
          sm_op: number | null
          sm_probleme: number | null
          sm_svt: number | null
          sm_tfm: number | null
          sup_10_fr: number | null
          sup_10_geo: number | null
          sup_10_maths: number | null
          sup_10_mlg: number | null
          sup_10_op: number | null
          sup_10_probleme: number | null
          sup_10_svt: number | null
          sup_10_tfm: number | null
          TPA: number | null
          tx_admis: number | null
          tx_admis_f: number | null
          tx_admis_g: number | null
          txAbdcecm1: number | null
          txAbdcm1cm2: number | null
          txAbdcp1cp2: number | null
          txAbdcp2ce: number | null
          txAbdGlobal: number | null
          txRetentionFilles: number | null
          txRetentionGarcons: number | null
          txRetentionTotal: number | null
          ZAP: string | null
        }
        Insert: {
          CISCO?: string | null
          CODE_CISCO?: number | null
          CODE_DREN?: number | null
          CODE_ETAB?: number | null
          CODE_ZAP?: number | null
          DREN?: string | null
          ecole_continue?: string | null
          electricite?: string | null
          eleve_2km?: number | null
          ens_classe?: number | null
          ens_im?: number | null
          fr_sc1?: number | null
          fr_sc2?: number | null
          fram_nonsub?: number | null
          fram_sub?: number | null
          id?: number
          imported_at?: string | null
          maths_sc1?: number | null
          maths_sc2?: number | null
          mlg_sc1?: number | null
          mlg_sc2?: number | null
          montant_ce?: number | null
          NOM_ETAB?: string | null
          nombre_eleves?: number | null
          nombre_section?: number | null
          point_eau?: string | null
          profilRetEnsemble?: string | null
          profilRetFilles?: string | null
          profilRetGarcons?: string | null
          ratio_cpsdc?: number | null
          ratio_ece?: number | null
          ratio_efrs?: number | null
          ratio_em?: number | null
          ratio_emlg?: number | null
          ratio_emths?: number | null
          ratio_epa?: number | null
          ratio_eq?: number | null
          ratio_wc_com?: number | null
          ratio_wc_f?: number | null
          red_CE?: number | null
          red_CE_f?: number | null
          red_CE_g?: number | null
          red_CM1?: number | null
          red_CM1_f?: number | null
          red_CM1_g?: number | null
          red_CM2?: number | null
          red_CM2_f?: number | null
          red_CM2_g?: number | null
          red_CP1?: number | null
          red_CP1_f?: number | null
          red_CP1_g?: number | null
          red_CP2?: number | null
          red_CP2_f?: number | null
          red_CP2_g?: number | null
          red_ensemble?: number | null
          red_fille?: number | null
          red_garcons?: number | null
          sm_fr?: number | null
          sm_geo?: number | null
          sm_maths?: number | null
          sm_mlg?: number | null
          sm_op?: number | null
          sm_probleme?: number | null
          sm_svt?: number | null
          sm_tfm?: number | null
          sup_10_fr?: number | null
          sup_10_geo?: number | null
          sup_10_maths?: number | null
          sup_10_mlg?: number | null
          sup_10_op?: number | null
          sup_10_probleme?: number | null
          sup_10_svt?: number | null
          sup_10_tfm?: number | null
          TPA?: number | null
          tx_admis?: number | null
          tx_admis_f?: number | null
          tx_admis_g?: number | null
          txAbdcecm1?: number | null
          txAbdcm1cm2?: number | null
          txAbdcp1cp2?: number | null
          txAbdcp2ce?: number | null
          txAbdGlobal?: number | null
          txRetentionFilles?: number | null
          txRetentionGarcons?: number | null
          txRetentionTotal?: number | null
          ZAP?: string | null
        }
        Update: {
          CISCO?: string | null
          CODE_CISCO?: number | null
          CODE_DREN?: number | null
          CODE_ETAB?: number | null
          CODE_ZAP?: number | null
          DREN?: string | null
          ecole_continue?: string | null
          electricite?: string | null
          eleve_2km?: number | null
          ens_classe?: number | null
          ens_im?: number | null
          fr_sc1?: number | null
          fr_sc2?: number | null
          fram_nonsub?: number | null
          fram_sub?: number | null
          id?: number
          imported_at?: string | null
          maths_sc1?: number | null
          maths_sc2?: number | null
          mlg_sc1?: number | null
          mlg_sc2?: number | null
          montant_ce?: number | null
          NOM_ETAB?: string | null
          nombre_eleves?: number | null
          nombre_section?: number | null
          point_eau?: string | null
          profilRetEnsemble?: string | null
          profilRetFilles?: string | null
          profilRetGarcons?: string | null
          ratio_cpsdc?: number | null
          ratio_ece?: number | null
          ratio_efrs?: number | null
          ratio_em?: number | null
          ratio_emlg?: number | null
          ratio_emths?: number | null
          ratio_epa?: number | null
          ratio_eq?: number | null
          ratio_wc_com?: number | null
          ratio_wc_f?: number | null
          red_CE?: number | null
          red_CE_f?: number | null
          red_CE_g?: number | null
          red_CM1?: number | null
          red_CM1_f?: number | null
          red_CM1_g?: number | null
          red_CM2?: number | null
          red_CM2_f?: number | null
          red_CM2_g?: number | null
          red_CP1?: number | null
          red_CP1_f?: number | null
          red_CP1_g?: number | null
          red_CP2?: number | null
          red_CP2_f?: number | null
          red_CP2_g?: number | null
          red_ensemble?: number | null
          red_fille?: number | null
          red_garcons?: number | null
          sm_fr?: number | null
          sm_geo?: number | null
          sm_maths?: number | null
          sm_mlg?: number | null
          sm_op?: number | null
          sm_probleme?: number | null
          sm_svt?: number | null
          sm_tfm?: number | null
          sup_10_fr?: number | null
          sup_10_geo?: number | null
          sup_10_maths?: number | null
          sup_10_mlg?: number | null
          sup_10_op?: number | null
          sup_10_probleme?: number | null
          sup_10_svt?: number | null
          sup_10_tfm?: number | null
          TPA?: number | null
          tx_admis?: number | null
          tx_admis_f?: number | null
          tx_admis_g?: number | null
          txAbdcecm1?: number | null
          txAbdcm1cm2?: number | null
          txAbdcp1cp2?: number | null
          txAbdcp2ce?: number | null
          txAbdGlobal?: number | null
          txRetentionFilles?: number | null
          txRetentionGarcons?: number | null
          txRetentionTotal?: number | null
          ZAP?: string | null
        }
        Relationships: []
      }
      tdb_import_batches: {
        Row: {
          batch_ts_end: string
          batch_ts_start: string
          created_at: string
          file_name: string | null
          id: string
          imported_by: string | null
          notes: string | null
          row_count: number
          status: string
          table_name: string
        }
        Insert: {
          batch_ts_end: string
          batch_ts_start: string
          created_at?: string
          file_name?: string | null
          id?: string
          imported_by?: string | null
          notes?: string | null
          row_count?: number
          status?: string
          table_name: string
        }
        Update: {
          batch_ts_end?: string
          batch_ts_start?: string
          created_at?: string
          file_name?: string | null
          id?: string
          imported_by?: string | null
          notes?: string | null
          row_count?: number
          status?: string
          table_name?: string
        }
        Relationships: []
      }
      tdb_mada: {
        Row: {
          code_mada: number | null
          ecole_continue: number | null
          electricite: number | null
          eleve_2km: number | null
          ens_classe: number | null
          ens_im: number | null
          fr_sc1: number | null
          fr_sc2: number | null
          fram_nonsub: number | null
          fram_sub: number | null
          id: number
          imported_at: string | null
          maths_sc1: number | null
          maths_sc2: number | null
          mlg_sc1: number | null
          mlg_sc2: number | null
          montant_ce: number | null
          nombre_eleves: number | null
          nombre_section: number | null
          point_eau: number | null
          ratio_cpsdc: number | null
          ratio_ece: number | null
          ratio_efrs: number | null
          ratio_em: number | null
          ratio_emlg: number | null
          ratio_emths: number | null
          ratio_epa: number | null
          ratio_eq: number | null
          ratio_wc_com: number | null
          ratio_wc_f: number | null
          red_CE: number | null
          red_CE_f: number | null
          red_CE_g: number | null
          red_CM1: number | null
          red_CM1_f: number | null
          red_CM1_g: number | null
          red_CM2: number | null
          red_CM2_f: number | null
          red_CM2_g: number | null
          red_CP1: number | null
          red_CP1_f: number | null
          red_CP1_g: number | null
          red_CP2: number | null
          red_CP2_f: number | null
          red_CP2_g: number | null
          red_ensemble: number | null
          red_fille: number | null
          red_garcons: number | null
          sm_fr: number | null
          sm_geo: number | null
          sm_maths: number | null
          sm_mlg: number | null
          sm_op: number | null
          sm_probleme: number | null
          sm_svt: number | null
          sm_tfm: number | null
          sup_10_fr: number | null
          sup_10_geo: number | null
          sup_10_maths: number | null
          sup_10_mlg: number | null
          sup_10_op: number | null
          sup_10_probleme: number | null
          sup_10_svt: number | null
          sup_10_tfm: number | null
          TPA: number | null
          tx_admis: number | null
          tx_admis_f: number | null
          tx_admis_g: number | null
          txAbdcecm1: number | null
          txAbdcm1cm2: number | null
          txAbdcp1cp2: number | null
          txAbdcp2ce: number | null
          txAbdGlobal: number | null
          txRetentionFilles: number | null
          txRetentionGarcons: number | null
          txRetentionTotal: number | null
        }
        Insert: {
          code_mada?: number | null
          ecole_continue?: number | null
          electricite?: number | null
          eleve_2km?: number | null
          ens_classe?: number | null
          ens_im?: number | null
          fr_sc1?: number | null
          fr_sc2?: number | null
          fram_nonsub?: number | null
          fram_sub?: number | null
          id?: number
          imported_at?: string | null
          maths_sc1?: number | null
          maths_sc2?: number | null
          mlg_sc1?: number | null
          mlg_sc2?: number | null
          montant_ce?: number | null
          nombre_eleves?: number | null
          nombre_section?: number | null
          point_eau?: number | null
          ratio_cpsdc?: number | null
          ratio_ece?: number | null
          ratio_efrs?: number | null
          ratio_em?: number | null
          ratio_emlg?: number | null
          ratio_emths?: number | null
          ratio_epa?: number | null
          ratio_eq?: number | null
          ratio_wc_com?: number | null
          ratio_wc_f?: number | null
          red_CE?: number | null
          red_CE_f?: number | null
          red_CE_g?: number | null
          red_CM1?: number | null
          red_CM1_f?: number | null
          red_CM1_g?: number | null
          red_CM2?: number | null
          red_CM2_f?: number | null
          red_CM2_g?: number | null
          red_CP1?: number | null
          red_CP1_f?: number | null
          red_CP1_g?: number | null
          red_CP2?: number | null
          red_CP2_f?: number | null
          red_CP2_g?: number | null
          red_ensemble?: number | null
          red_fille?: number | null
          red_garcons?: number | null
          sm_fr?: number | null
          sm_geo?: number | null
          sm_maths?: number | null
          sm_mlg?: number | null
          sm_op?: number | null
          sm_probleme?: number | null
          sm_svt?: number | null
          sm_tfm?: number | null
          sup_10_fr?: number | null
          sup_10_geo?: number | null
          sup_10_maths?: number | null
          sup_10_mlg?: number | null
          sup_10_op?: number | null
          sup_10_probleme?: number | null
          sup_10_svt?: number | null
          sup_10_tfm?: number | null
          TPA?: number | null
          tx_admis?: number | null
          tx_admis_f?: number | null
          tx_admis_g?: number | null
          txAbdcecm1?: number | null
          txAbdcm1cm2?: number | null
          txAbdcp1cp2?: number | null
          txAbdcp2ce?: number | null
          txAbdGlobal?: number | null
          txRetentionFilles?: number | null
          txRetentionGarcons?: number | null
          txRetentionTotal?: number | null
        }
        Update: {
          code_mada?: number | null
          ecole_continue?: number | null
          electricite?: number | null
          eleve_2km?: number | null
          ens_classe?: number | null
          ens_im?: number | null
          fr_sc1?: number | null
          fr_sc2?: number | null
          fram_nonsub?: number | null
          fram_sub?: number | null
          id?: number
          imported_at?: string | null
          maths_sc1?: number | null
          maths_sc2?: number | null
          mlg_sc1?: number | null
          mlg_sc2?: number | null
          montant_ce?: number | null
          nombre_eleves?: number | null
          nombre_section?: number | null
          point_eau?: number | null
          ratio_cpsdc?: number | null
          ratio_ece?: number | null
          ratio_efrs?: number | null
          ratio_em?: number | null
          ratio_emlg?: number | null
          ratio_emths?: number | null
          ratio_epa?: number | null
          ratio_eq?: number | null
          ratio_wc_com?: number | null
          ratio_wc_f?: number | null
          red_CE?: number | null
          red_CE_f?: number | null
          red_CE_g?: number | null
          red_CM1?: number | null
          red_CM1_f?: number | null
          red_CM1_g?: number | null
          red_CM2?: number | null
          red_CM2_f?: number | null
          red_CM2_g?: number | null
          red_CP1?: number | null
          red_CP1_f?: number | null
          red_CP1_g?: number | null
          red_CP2?: number | null
          red_CP2_f?: number | null
          red_CP2_g?: number | null
          red_ensemble?: number | null
          red_fille?: number | null
          red_garcons?: number | null
          sm_fr?: number | null
          sm_geo?: number | null
          sm_maths?: number | null
          sm_mlg?: number | null
          sm_op?: number | null
          sm_probleme?: number | null
          sm_svt?: number | null
          sm_tfm?: number | null
          sup_10_fr?: number | null
          sup_10_geo?: number | null
          sup_10_maths?: number | null
          sup_10_mlg?: number | null
          sup_10_op?: number | null
          sup_10_probleme?: number | null
          sup_10_svt?: number | null
          sup_10_tfm?: number | null
          TPA?: number | null
          tx_admis?: number | null
          tx_admis_f?: number | null
          tx_admis_g?: number | null
          txAbdcecm1?: number | null
          txAbdcm1cm2?: number | null
          txAbdcp1cp2?: number | null
          txAbdcp2ce?: number | null
          txAbdGlobal?: number | null
          txRetentionFilles?: number | null
          txRetentionGarcons?: number | null
          txRetentionTotal?: number | null
        }
        Relationships: []
      }
      tdb_ref: {
        Row: {
          ALTITUDE: number | null
          CISCO: string | null
          CODE_CISCO: number | null
          CODE_DREN: number | null
          CODE_ETAB: number | null
          CODE_ZAP: number | null
          COMMUNE: string | null
          DISTRICT: string | null
          DREN: string | null
          FOKONTANY: string | null
          id: number
          imported_at: string | null
          LATITUDE: number | null
          LONGITUDE: number | null
          MILIEU: string | null
          NOM_ETAB: string | null
          REGION: string | null
          SECTEUR: string | null
          ZAP: string | null
        }
        Insert: {
          ALTITUDE?: number | null
          CISCO?: string | null
          CODE_CISCO?: number | null
          CODE_DREN?: number | null
          CODE_ETAB?: number | null
          CODE_ZAP?: number | null
          COMMUNE?: string | null
          DISTRICT?: string | null
          DREN?: string | null
          FOKONTANY?: string | null
          id?: number
          imported_at?: string | null
          LATITUDE?: number | null
          LONGITUDE?: number | null
          MILIEU?: string | null
          NOM_ETAB?: string | null
          REGION?: string | null
          SECTEUR?: string | null
          ZAP?: string | null
        }
        Update: {
          ALTITUDE?: number | null
          CISCO?: string | null
          CODE_CISCO?: number | null
          CODE_DREN?: number | null
          CODE_ETAB?: number | null
          CODE_ZAP?: number | null
          COMMUNE?: string | null
          DISTRICT?: string | null
          DREN?: string | null
          FOKONTANY?: string | null
          id?: number
          imported_at?: string | null
          LATITUDE?: number | null
          LONGITUDE?: number | null
          MILIEU?: string | null
          NOM_ETAB?: string | null
          REGION?: string | null
          SECTEUR?: string | null
          ZAP?: string | null
        }
        Relationships: []
      }
      tdb_zap: {
        Row: {
          CISCO: string | null
          CODE_CISCO: number | null
          CODE_DREN: number | null
          CODE_ZAP: number | null
          DREN: string | null
          ecole_continue: number | null
          electricite: number | null
          eleve_2km: number | null
          ens_classe: number | null
          ens_im: number | null
          fr_sc1: number | null
          fr_sc2: number | null
          fram_nonsub: number | null
          fram_sub: number | null
          id: number
          imported_at: string | null
          maths_sc1: number | null
          maths_sc2: number | null
          mlg_sc1: number | null
          mlg_sc2: number | null
          montant_ce: number | null
          nombre_eleves: number | null
          nombre_section: number | null
          point_eau: number | null
          ratio_cpsdc: number | null
          ratio_ece: number | null
          ratio_efrs: number | null
          ratio_em: number | null
          ratio_emlg: number | null
          ratio_emths: number | null
          ratio_epa: number | null
          ratio_eq: number | null
          ratio_wc_com: number | null
          ratio_wc_f: number | null
          red_CE: number | null
          red_CE_f: number | null
          red_CE_g: number | null
          red_CM1: number | null
          red_CM1_f: number | null
          red_CM1_g: number | null
          red_CM2: number | null
          red_CM2_f: number | null
          red_CM2_g: number | null
          red_CP1: number | null
          red_CP1_f: number | null
          red_CP1_g: number | null
          red_CP2: number | null
          red_CP2_f: number | null
          red_CP2_g: number | null
          red_ensemble: number | null
          red_fille: number | null
          red_garcons: number | null
          sm_fr: number | null
          sm_geo: number | null
          sm_maths: number | null
          sm_mlg: number | null
          sm_op: number | null
          sm_probleme: number | null
          sm_svt: number | null
          sm_tfm: number | null
          sup_10_fr: number | null
          sup_10_geo: number | null
          sup_10_maths: number | null
          sup_10_mlg: number | null
          sup_10_op: number | null
          sup_10_probleme: number | null
          sup_10_svt: number | null
          sup_10_tfm: number | null
          TPA: number | null
          tx_admis: number | null
          tx_admis_f: number | null
          tx_admis_g: number | null
          txAbdcecm1: number | null
          txAbdcm1cm2: number | null
          txAbdcp1cp2: number | null
          txAbdcp2ce: number | null
          txAbdGlobal: number | null
          txRetentionFilles: number | null
          txRetentionGarcons: number | null
          txRetentionTotal: number | null
          ZAP: string | null
        }
        Insert: {
          CISCO?: string | null
          CODE_CISCO?: number | null
          CODE_DREN?: number | null
          CODE_ZAP?: number | null
          DREN?: string | null
          ecole_continue?: number | null
          electricite?: number | null
          eleve_2km?: number | null
          ens_classe?: number | null
          ens_im?: number | null
          fr_sc1?: number | null
          fr_sc2?: number | null
          fram_nonsub?: number | null
          fram_sub?: number | null
          id?: number
          imported_at?: string | null
          maths_sc1?: number | null
          maths_sc2?: number | null
          mlg_sc1?: number | null
          mlg_sc2?: number | null
          montant_ce?: number | null
          nombre_eleves?: number | null
          nombre_section?: number | null
          point_eau?: number | null
          ratio_cpsdc?: number | null
          ratio_ece?: number | null
          ratio_efrs?: number | null
          ratio_em?: number | null
          ratio_emlg?: number | null
          ratio_emths?: number | null
          ratio_epa?: number | null
          ratio_eq?: number | null
          ratio_wc_com?: number | null
          ratio_wc_f?: number | null
          red_CE?: number | null
          red_CE_f?: number | null
          red_CE_g?: number | null
          red_CM1?: number | null
          red_CM1_f?: number | null
          red_CM1_g?: number | null
          red_CM2?: number | null
          red_CM2_f?: number | null
          red_CM2_g?: number | null
          red_CP1?: number | null
          red_CP1_f?: number | null
          red_CP1_g?: number | null
          red_CP2?: number | null
          red_CP2_f?: number | null
          red_CP2_g?: number | null
          red_ensemble?: number | null
          red_fille?: number | null
          red_garcons?: number | null
          sm_fr?: number | null
          sm_geo?: number | null
          sm_maths?: number | null
          sm_mlg?: number | null
          sm_op?: number | null
          sm_probleme?: number | null
          sm_svt?: number | null
          sm_tfm?: number | null
          sup_10_fr?: number | null
          sup_10_geo?: number | null
          sup_10_maths?: number | null
          sup_10_mlg?: number | null
          sup_10_op?: number | null
          sup_10_probleme?: number | null
          sup_10_svt?: number | null
          sup_10_tfm?: number | null
          TPA?: number | null
          tx_admis?: number | null
          tx_admis_f?: number | null
          tx_admis_g?: number | null
          txAbdcecm1?: number | null
          txAbdcm1cm2?: number | null
          txAbdcp1cp2?: number | null
          txAbdcp2ce?: number | null
          txAbdGlobal?: number | null
          txRetentionFilles?: number | null
          txRetentionGarcons?: number | null
          txRetentionTotal?: number | null
          ZAP?: string | null
        }
        Update: {
          CISCO?: string | null
          CODE_CISCO?: number | null
          CODE_DREN?: number | null
          CODE_ZAP?: number | null
          DREN?: string | null
          ecole_continue?: number | null
          electricite?: number | null
          eleve_2km?: number | null
          ens_classe?: number | null
          ens_im?: number | null
          fr_sc1?: number | null
          fr_sc2?: number | null
          fram_nonsub?: number | null
          fram_sub?: number | null
          id?: number
          imported_at?: string | null
          maths_sc1?: number | null
          maths_sc2?: number | null
          mlg_sc1?: number | null
          mlg_sc2?: number | null
          montant_ce?: number | null
          nombre_eleves?: number | null
          nombre_section?: number | null
          point_eau?: number | null
          ratio_cpsdc?: number | null
          ratio_ece?: number | null
          ratio_efrs?: number | null
          ratio_em?: number | null
          ratio_emlg?: number | null
          ratio_emths?: number | null
          ratio_epa?: number | null
          ratio_eq?: number | null
          ratio_wc_com?: number | null
          ratio_wc_f?: number | null
          red_CE?: number | null
          red_CE_f?: number | null
          red_CE_g?: number | null
          red_CM1?: number | null
          red_CM1_f?: number | null
          red_CM1_g?: number | null
          red_CM2?: number | null
          red_CM2_f?: number | null
          red_CM2_g?: number | null
          red_CP1?: number | null
          red_CP1_f?: number | null
          red_CP1_g?: number | null
          red_CP2?: number | null
          red_CP2_f?: number | null
          red_CP2_g?: number | null
          red_ensemble?: number | null
          red_fille?: number | null
          red_garcons?: number | null
          sm_fr?: number | null
          sm_geo?: number | null
          sm_maths?: number | null
          sm_mlg?: number | null
          sm_op?: number | null
          sm_probleme?: number | null
          sm_svt?: number | null
          sm_tfm?: number | null
          sup_10_fr?: number | null
          sup_10_geo?: number | null
          sup_10_maths?: number | null
          sup_10_mlg?: number | null
          sup_10_op?: number | null
          sup_10_probleme?: number | null
          sup_10_svt?: number | null
          sup_10_tfm?: number | null
          TPA?: number | null
          tx_admis?: number | null
          tx_admis_f?: number | null
          tx_admis_g?: number | null
          txAbdcecm1?: number | null
          txAbdcm1cm2?: number | null
          txAbdcp1cp2?: number | null
          txAbdcp2ce?: number | null
          txAbdGlobal?: number | null
          txRetentionFilles?: number | null
          txRetentionGarcons?: number | null
          txRetentionTotal?: number | null
          ZAP?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
