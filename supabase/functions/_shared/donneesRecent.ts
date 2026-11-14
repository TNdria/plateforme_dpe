/**
 * Requêtes « millésime récent » (année > 2025) partagées entre la fonction
 * Supabase `db-query` (Deno) et l'endpoint Vercel `api/donnees` (Node).
 *
 * Les vues `v_effectif_n*` / `v_fiche_ecole_n*` sont figées sur 2025. Pour les
 * années suivantes on reconstruit la fiche depuis les tables réelles de
 * collecte (fpe_a1, fpe_e1/fpe_e4, v_personnel, v_sdc, v_place_assises).
 *
 * Ce module ne dépend d'aucun runtime : uniquement des constantes et une
 * fonction qui construit une chaîne SQL à partir de paramètres déjà validés.
 */

export type DataRecentLevel = "n0" | "n1" | "n2" | "n3";

export const DATA_RECENT_ACTIONS: Record<string, DataRecentLevel> = {
  getDataPrescolaire: "n0",
  getDataPrimaire: "n1",
  getDataCollege: "n2",
  getDataLycee: "n3",
};

/** Première année nécessitant la reconstruction (les vues sont figées sur 2025). */
export const MIN_RECENT_ANNEE = 2026;

export interface DonneesRecentParams {
  codeDren: number;
  codeCisco: number;
  codeCommune: number;
  codeZap: number;
  secteur: number;
  annee: number;
}

interface DataRecentLevelConfig {
  existsCol: string;
  evolutionView: string;
  effectifSql: (annee: number) => string;
  effCols: string;
  sdcBe: string;
  sdcMe: string;
  places: string;
}

export const DATA_RECENT_LEVELS: Record<DataRecentLevel, DataRecentLevelConfig> = {
  n0: {
    existsCol: "EXISTE_PRESCO",
    evolutionView: "v_evolution_effectif_n0",
    effectifSql: (annee) => `
      SELECT DISTINCT "CODE_ETAB",
        COALESCE("PS_G"::int, 0) + COALESCE("PS_F"::int, 0) AS eff_ps,
        COALESCE("MS_G"::int, 0) + COALESCE("MS_F"::int, 0) AS eff_ms,
        COALESCE("GS_G"::int, 0) + COALESCE("GS_F"::int, 0) AS eff_gs,
        COALESCE("PS_G"::int, 0) + COALESCE("PS_F"::int, 0)
          + COALESCE("MS_G"::int, 0) + COALESCE("MS_F"::int, 0)
          + COALESCE("GS_G"::int, 0) + COALESCE("GS_F"::int, 0) AS eff_total
      FROM fpe_e1
      WHERE "ANNEE_SCOLAIRE" = ${annee} AND "EXISTE_PRESCO" = 1
      `,
    effCols: "v.eff_ps, v.eff_ms, v.eff_gs",
    sdcBe: "sdc.sdc_be_n0",
    sdcMe: "sdc.sdc_me_n0",
    places: "vp.places_n0",
  },
  n1: {
    existsCol: "EXISTE_PRIMAIRE",
    evolutionView: "v_evolution_effectif_n1",
    effectifSql: (annee) => `
      SELECT DISTINCT "CODE_ETAB",
        COALESCE("T1_G"::int, 0) + COALESCE("T1_F"::int, 0) AS eff_t1,
        COALESCE("T2_G"::int, 0) + COALESCE("T2_F"::int, 0) AS eff_t2,
        COALESCE("T3_G"::int, 0) + COALESCE("T3_F"::int, 0) AS eff_t3,
        COALESCE("T4_G"::int, 0) + COALESCE("T4_F"::int, 0) AS eff_t4,
        COALESCE("T5_G"::int, 0) + COALESCE("T5_F"::int, 0) AS eff_t5,
        COALESCE("T1_G"::int, 0) + COALESCE("T1_F"::int, 0)
          + COALESCE("T2_G"::int, 0) + COALESCE("T2_F"::int, 0)
          + COALESCE("T3_G"::int, 0) + COALESCE("T3_F"::int, 0)
          + COALESCE("T4_G"::int, 0) + COALESCE("T4_F"::int, 0)
          + COALESCE("T5_G"::int, 0) + COALESCE("T5_F"::int, 0) AS eff_total
      FROM fpe_e1
      WHERE "ANNEE_SCOLAIRE" = ${annee} AND "EXISTE_PRIMAIRE" = 1
      `,
    effCols: "v.eff_t1, v.eff_t2, v.eff_t3, v.eff_t4, v.eff_t5",
    sdcBe: "sdc.sdc_be_n1",
    sdcMe: "sdc.sdc_me_n1",
    places: "vp.places_n1",
  },
  n2: {
    existsCol: "EXISTE_COLLEGE",
    evolutionView: "v_evolution_effectif_n2",
    effectifSql: (annee) => `
      SELECT DISTINCT "CODE_ETAB",
        COALESCE("T6_G"::int, 0) + COALESCE("T6_F"::int, 0) AS eff_t6,
        COALESCE("T7_G"::int, 0) + COALESCE("T7_F"::int, 0) AS eff_t7,
        COALESCE("T8_G"::int, 0) + COALESCE("T8_F"::int, 0) AS eff_t8,
        COALESCE("T9_G"::int, 0) + COALESCE("T9_F"::int, 0) AS eff_t9,
        COALESCE("T6_G"::int, 0) + COALESCE("T6_F"::int, 0)
          + COALESCE("T7_G"::int, 0) + COALESCE("T7_F"::int, 0)
          + COALESCE("T8_G"::int, 0) + COALESCE("T8_F"::int, 0)
          + COALESCE("T9_G"::int, 0) + COALESCE("T9_F"::int, 0) AS eff_total
      FROM fpe_e4
      WHERE "ANNEE_SCOLAIRE" = ${annee} AND "EXISTE_COLLEGE" = 1
      `,
    effCols: "v.eff_t6, v.eff_t7, v.eff_t8, v.eff_t9",
    sdcBe: "sdc.sdc_be_n2",
    sdcMe: "sdc.sdc_me_n2",
    places: "vp.places_n2",
  },
  n3: {
    existsCol: "EXISTE_LYCEE",
    evolutionView: "v_evolution_effectif_n3",
    effectifSql: (annee) => `
      SELECT DISTINCT "CODE_ETAB",
        COALESCE("_2NDE_G"::int, 0) + COALESCE("_2NDE_F"::int, 0) AS _2nde,
        COALESCE("_1A_G"::int, 0) + COALESCE("_1A_F"::int, 0)
          + COALESCE("_1C_G"::int, 0) + COALESCE("_1C_F"::int, 0)
          + COALESCE("_1D_G"::int, 0) + COALESCE("_1D_F"::int, 0)
          + COALESCE("_1L_G"::int, 0) + COALESCE("_1L_F"::int, 0)
          + COALESCE("_1S_G"::int, 0) + COALESCE("_1S_F"::int, 0)
          + COALESCE("_1OSE_G"::int, 0) + COALESCE("_1OSE_F"::int, 0) AS _1re,
        COALESCE("TA_G"::int, 0) + COALESCE("TA_F"::int, 0)
          + COALESCE("TC_G"::int, 0) + COALESCE("TC_F"::int, 0)
          + COALESCE("TD_G"::int, 0) + COALESCE("TD_F"::int, 0)
          + COALESCE("TL_G"::int, 0) + COALESCE("TL_F"::int, 0)
          + COALESCE("TS_G"::int, 0) + COALESCE("TS_F"::int, 0)
          + COALESCE("TOSE_G"::int, 0) + COALESCE("TOSE_F"::int, 0) AS tle,
        COALESCE("_2NDE_G"::int, 0) + COALESCE("_2NDE_F"::int, 0)
          + COALESCE("_1A_G"::int, 0) + COALESCE("_1A_F"::int, 0)
          + COALESCE("_1C_G"::int, 0) + COALESCE("_1C_F"::int, 0)
          + COALESCE("_1D_G"::int, 0) + COALESCE("_1D_F"::int, 0)
          + COALESCE("_1L_G"::int, 0) + COALESCE("_1L_F"::int, 0)
          + COALESCE("_1S_G"::int, 0) + COALESCE("_1S_F"::int, 0)
          + COALESCE("_1OSE_G"::int, 0) + COALESCE("_1OSE_F"::int, 0)
          + COALESCE("TA_G"::int, 0) + COALESCE("TA_F"::int, 0)
          + COALESCE("TC_G"::int, 0) + COALESCE("TC_F"::int, 0)
          + COALESCE("TD_G"::int, 0) + COALESCE("TD_F"::int, 0)
          + COALESCE("TL_G"::int, 0) + COALESCE("TL_F"::int, 0)
          + COALESCE("TS_G"::int, 0) + COALESCE("TS_F"::int, 0)
          + COALESCE("TOSE_G"::int, 0) + COALESCE("TOSE_F"::int, 0) AS eff_total
      FROM fpe_e4
      WHERE "ANNEE_SCOLAIRE" = ${annee} AND "EXISTE_LYCEE" = 1
      `,
    effCols: "v._2nde, v._1re, v.tle",
    sdcBe: "sdc.sdc_be_n3",
    sdcMe: "sdc.sdc_me_n3",
    places: "vp.places_n3",
  },
};

/**
 * Construit la requête « fiche établissement » d'un niveau pour une année
 * récente. `annee` est interpolée : l'appelant DOIT l'avoir validée comme
 * entier (voir `parseRecentAnnee`), d'où l'assertion ci-dessous.
 */
export function buildDonneesRecentSql(
  level: DataRecentLevel,
  { codeDren, codeCisco, codeCommune, codeZap, secteur, annee }: DonneesRecentParams,
): string {
  if (!Number.isInteger(annee) || annee < MIN_RECENT_ANNEE) {
    throw new Error(`Annee recente invalide: ${annee}`);
  }

  const cfg = DATA_RECENT_LEVELS[level];
  if (!cfg) throw new Error(`Niveau inconnu: ${level}`);

  const opDren = codeDren === 0 ? ">" : "="; const valDren = codeDren === 0 ? 0 : codeDren;
  const opCisco = codeCisco === 0 ? ">" : "="; const valCisco = codeCisco === 0 ? 0 : codeCisco;
  const opCommune = codeCommune === 0 ? ">" : "="; const valCommune = codeCommune === 0 ? 0 : codeCommune;
  const opZap = codeZap === 0 ? ">" : "="; const valZap = codeZap === 0 ? 0 : codeZap;
  const sect = secteur > 1 ? ">= 0" : `= ${secteur}`;

  return `
    SELECT a1."CODE_ETAB", a1."DREN", a1."CISCO", a1."COMMUNE", a1."ZAP", a1."FOKONTANY",
      a1."NOM_ETAB", a1."CATEGORIE_COMMUNE", a1."CODE_DREN", a1."CODE_CISCO", a1."CODE_COMMUNE", a1."CODE_ZAP",
      a1."SECTEUR", ${cfg.places} AS places, ${cfg.sdcBe} AS sdc_be, ${cfg.sdcMe} AS sdc_me,
      a1."TYPE_SOURCE_EAU", a1."TYPE_SOURCE_ELECTRICITE",
      COALESCE(eveff.eff_2022, 0) AS eff_2022, COALESCE(eveff.eff_2023, 0) AS eff_2023,
      COALESCE(eveff.eff_2024, 0) AS eff_2024, COALESCE(eveff.eff_2025, 0) AS eff_2025,
      pers.total AS pers_total, pers.en_classe, pers.fonctionnaire,
      pers.fram_sub, pers.fram_nonsub, pers.bepc, pers.bacc, pers.qualifiee,
      ${cfg.effCols}, v.eff_total AS "eff_${annee}", ${annee} AS "ANNEE_SCOLAIRE"
    FROM fpe_a1 a1
    LEFT JOIN ${cfg.evolutionView} eveff ON eveff."CODE_ETAB" = a1."CODE_ETAB"
    LEFT JOIN v_sdc sdc ON sdc."CODE_ETAB" = a1."CODE_ETAB" AND sdc."ANNEE_SCOLAIRE" = ${annee}
    LEFT JOIN v_place_assises vp ON vp."CODE_ETAB" = a1."CODE_ETAB" AND vp."ANNEE_SCOLAIRE" = ${annee}
    LEFT JOIN v_personnel pers ON pers."CODE_ETAB" = a1."CODE_ETAB" AND pers."ANNEE_SCOLAIRE" = ${annee}
    INNER JOIN (${cfg.effectifSql(annee)}) v ON v."CODE_ETAB" = a1."CODE_ETAB"
    WHERE a1."ANNEE_SCOLAIRE" = ${annee} AND a1."${cfg.existsCol}" = 1
      AND a1."CODE_DREN" ${opDren} ${valDren} AND a1."CODE_CISCO" ${opCisco} ${valCisco}
      AND a1."CODE_COMMUNE" ${opCommune} ${valCommune} AND a1."CODE_ZAP" ${opZap} ${valZap}
      AND a1."SECTEUR" ${sect}
  `;
}
