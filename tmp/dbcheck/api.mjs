// api/donnees.ts
import pg from "pg";

// supabase/functions/_shared/donneesRecent.ts
var DATA_RECENT_ACTIONS = {
  getDataPrescolaire: "n0",
  getDataPrimaire: "n1",
  getDataCollege: "n2",
  getDataLycee: "n3"
};
var MIN_RECENT_ANNEE = 2026;
var DATA_RECENT_LEVELS = {
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
    places: "vp.places_n0"
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
    places: "vp.places_n1"
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
    places: "vp.places_n2"
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
    places: "vp.places_n3"
  }
};
function buildDonneesRecentSql(level, { codeDren, codeCisco, codeCommune, codeZap, secteur, annee }) {
  if (!Number.isInteger(annee) || annee < MIN_RECENT_ANNEE) {
    throw new Error(`Annee recente invalide: ${annee}`);
  }
  const cfg = DATA_RECENT_LEVELS[level];
  if (!cfg) throw new Error(`Niveau inconnu: ${level}`);
  const opDren = codeDren === 0 ? ">" : "=";
  const valDren = codeDren === 0 ? 0 : codeDren;
  const opCisco = codeCisco === 0 ? ">" : "=";
  const valCisco = codeCisco === 0 ? 0 : codeCisco;
  const opCommune = codeCommune === 0 ? ">" : "=";
  const valCommune = codeCommune === 0 ? 0 : codeCommune;
  const opZap = codeZap === 0 ? ">" : "=";
  const valZap = codeZap === 0 ? 0 : codeZap;
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

// api/donnees.ts
var { Pool, types } = pg;
types.setTypeParser(20, (value) => Number(value));
types.setTypeParser(1700, (value) => Number(value));
var pool = null;
function getConnectionConfig() {
  const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.POSTGRES_URL_NON_POOLING ?? process.env.SUPABASE_DB_URL ?? process.env.PGURL;
  if (connectionString) {
    return {
      connectionString,
      max: 3,
      idleTimeoutMillis: 1e4,
      connectionTimeoutMillis: 1e4,
      ssl: process.env.DB_SSL === "true" || /sslmode=(require|verify)/.test(connectionString) || /supabase\.(co|com)/.test(connectionString) ? { rejectUnauthorized: false } : void 0
    };
  }
  const host = process.env.DB_HOST ?? process.env.PGHOST ?? process.env.POSTGRES_HOST;
  const port = Number(
    process.env.DB_PORT ?? process.env.PGPORT ?? process.env.POSTGRES_PORT ?? 5432
  );
  const database = process.env.DB_NAME ?? process.env.PGDATABASE ?? process.env.POSTGRES_DATABASE;
  const user = process.env.DB_USER ?? process.env.PGUSER ?? process.env.POSTGRES_USER;
  const password = process.env.DB_PASSWORD ?? process.env.PGPASSWORD ?? process.env.POSTGRES_PASSWORD;
  if (!host || !database || !user) {
    throw new Error(
      "Configuration base de donn\xE9es manquante (DATABASE_URL, POSTGRES_URL ou DB_HOST/DB_NAME/DB_USER)."
    );
  }
  return {
    host,
    port,
    database,
    user,
    password,
    max: 3,
    idleTimeoutMillis: 1e4,
    connectionTimeoutMillis: 1e4,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : void 0
  };
}
function getPool() {
  if (!pool) pool = new Pool(getConnectionConfig());
  return pool;
}
function parseInteger(raw, fallback) {
  if (raw == null || raw === "") return fallback;
  const value = Number(raw);
  return Number.isInteger(value) ? value : null;
}
function firstValue(value) {
  if (value == null) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}
var DonneesRequestError = class extends Error {
  status;
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = "DonneesRequestError";
  }
};
function parseCode(raw, name) {
  const value = parseInteger(raw, 0);
  if (value == null || value < 0) {
    throw new DonneesRequestError(400, `Param\xE8tre invalide: ${name}`);
  }
  return value;
}
function parseDonneesQuery(input) {
  const action = firstValue(input.action) ?? "";
  if (!(action in DATA_RECENT_ACTIONS)) {
    throw new DonneesRequestError(400, `Action non support\xE9e: ${action || "(vide)"}`);
  }
  const annee = parseInteger(firstValue(input.annee), MIN_RECENT_ANNEE);
  if (annee == null || annee < MIN_RECENT_ANNEE || annee > 2100) {
    throw new DonneesRequestError(
      400,
      `Ann\xE9e invalide: seules les ann\xE9es >= ${MIN_RECENT_ANNEE} sont servies par cet endpoint.`
    );
  }
  return {
    action,
    annee,
    codeDren: parseCode(firstValue(input.code_dren), "code_dren"),
    codeCisco: parseCode(firstValue(input.code_cisco), "code_cisco"),
    codeCommune: parseCode(firstValue(input.code_commune), "code_commune"),
    codeZap: parseCode(firstValue(input.code_zap), "code_zap"),
    secteur: parseCode(firstValue(input.secteur) ?? "2", "secteur")
  };
}
async function queryDonnees(q) {
  const level = DATA_RECENT_ACTIONS[q.action];
  const sql = buildDonneesRecentSql(level, q);
  const result = await getPool().query(sql);
  return result.rows;
}
function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.end(JSON.stringify(body));
}
async function handler(req, res) {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, null);
    return;
  }
  if (req.method && req.method !== "GET") {
    sendJson(res, 405, { error: "M\xE9thode non autoris\xE9e" });
    return;
  }
  try {
    const params = req.query ?? Object.fromEntries(new URL(req.url ?? "/", "http://localhost").searchParams);
    const rows = await queryDonnees(parseDonneesQuery(params));
    sendJson(res, 200, rows);
  } catch (error) {
    const status = error instanceof DonneesRequestError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("[api/donnees]", message);
    sendJson(res, status, { error: message });
  }
}
export {
  DonneesRequestError,
  handler as default,
  parseDonneesQuery,
  queryDonnees
};
