// DPE Edge Function - v31 2026-02-17 - Added login action
// Schema: fpe_e1 student columns (T1_F, T1_G, etc.) are character varying, need ::text cast
// Structural columns (SECTEUR, CODE_ZAP, CODE_DREN) are integer - no cast needed
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const VERSION = "v50-20260601-exam-dedup-year-and-django-preview";

// PBKDF2-SHA256 password verification for Django auth
async function verifyDjangoPassword(password: string, encoded: string): Promise<boolean> {
  try {
    const parts = encoded.split('$');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha256') return false;
    const iterations = parseInt(parts[1]);
    const salt = parts[2];
    const storedHash = parts[3];
    
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const derivedBits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: enc.encode(salt), iterations, hash: 'SHA-256' },
      keyMaterial,
      256
    );
    const derivedHash = btoa(String.fromCharCode(...new Uint8Array(derivedBits)));
    return derivedHash === storedHash;
  } catch (e) {
    console.error('Password verification error:', e);
    return false;
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function serializeData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data === 'bigint') return Number(data);
  if (Array.isArray(data)) return data.map(serializeData);
  if (typeof data === 'object') {
    const result: Record<string, any> = {};
    for (const key in data) result[key] = serializeData(data[key]);
    return result;
  }
  return data;
}

const dbConfig = {
  hostname: "102.16.234.114",
  port: 5453,
  database: "dpeapp",
  user: "dpeapp",
  password: "s3cret!",
};

// Safe integer cast helper - handles varchar, integer, or null columns
function si(col: string): string {
  return `COALESCE(NULLIF(${col}::text, '')::integer, 0)`;
}

// Resolve the year used for examen_cepe queries. If the requested year has no
// examen_cepe rows (e.g. 2025 not yet imported in Django), fall back to the
// most recent year with data so the TDB exam tables aren't empty.
async function resolveExamenYear(client: any, requested: number): Promise<number> {
  try {
    const r1 = await client.queryObject(
      `SELECT 1 FROM examen_cepe WHERE "id_annee_scolaire" = ${requested} LIMIT 1`
    );
    if (r1.rows.length > 0) return requested;
    const r2 = await client.queryObject(
      `SELECT MAX("id_annee_scolaire")::int AS y FROM examen_cepe WHERE "id_annee_scolaire" <= ${requested}`
    );
    const y = (r2.rows[0] as any)?.y;
    return Number.isFinite(y) && y > 0 ? Number(y) : requested;
  } catch (_) {
    return requested;
  }
}

function pickNumber(row: any, keys: string[]): number | null {
  if (!row) return null;
  const lowerMap = new Map<string, any>();
  const norm = (s: string) => s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s\-\/]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
  Object.keys(row).forEach((k) => {
    lowerMap.set(k.toLowerCase(), row[k]);
    lowerMap.set(norm(k), row[k]);
  });
  for (const key of keys) {
    const raw = row[key] ?? lowerMap.get(key.toLowerCase()) ?? lowerMap.get(norm(key));
    if (raw === null || raw === undefined || raw === '') continue;
    const n = typeof raw === 'number' ? raw : Number(String(raw).trim().replace(/\s/g, '').replace('%', '').replace(',', '.'));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function preferPercentOrCount(row: any, aliases: string[]): number | null {
  return pickNumber(row, aliases);
}

function averagePresent(values: Array<number | null>): number | null {
  const present = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (!present.length) return null;
  return Math.round((present.reduce((a, b) => a + b, 0) / present.length) * 10) / 10;
}

function sumPresent(values: Array<number | null>): number | null {
  const present = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (!present.length) return null;
  return present.reduce((a, b) => a + b, 0);
}

function normalizeImportedCepe(row: any): any | null {
  if (!row) return null;
  const smMlg = pickNumber(row, ['sm_mlg', 'SM_MALAGASY', 'score_moyen_malagasy']);
  const supMlg = preferPercentOrCount(row, ['sup_10_mlg', 'mlg_sup10', 'SUP_10_MALAGASY', 'pct_10_mlg', 'pourcentage_10_malagasy']);
  const smFr = pickNumber(row, ['sm_fr', 'sm_frs', 'SM_FRANCAIS', 'score_moyen_francais']);
  const supFr = preferPercentOrCount(row, ['sup_10_fr', 'frs_sup10', 'SUP_10_FRANCAIS', 'pct_10_fr', 'pourcentage_10_francais']);
  const smOp = pickNumber(row, ['sm_op', 'sm_mths_operation', 'SM_OP', 'sm_operation']);
  const supOp = preferPercentOrCount(row, ['sup_10_op', 'op_sup10', 'SUP_10_OP', 'pct_10_op', 'sup_10_operation']);
  const smProb = pickNumber(row, ['sm_probleme', 'sm_mths_probleme', 'SM_PROBLEME']);
  const supProb = preferPercentOrCount(row, ['sup_10_probleme', 'prob_sup10', 'SUP_10_PROBLEME', 'pct_10_probleme']);
  const smMaths = pickNumber(row, ['sm_maths', 'sm_mths', 'SM_MATHS', 'score_moyen_mathématiques', 'score_moyen_mathematiques']) ?? averagePresent([smOp, smProb]);
  const supMaths = preferPercentOrCount(row, ['sup_10_maths', 'mths_sup10', 'SUP_10_MATHS', 'pct_10_maths']) ?? averagePresent([supOp, supProb]);
  const smTfm = pickNumber(row, ['sm_tfm', 'sm_histoire', 'SM_TFM', 'SM_HISTOIRE']);
  const supTfm = pickNumber(row, ['sup_10_tfm', 'histoire_sup10', 'SUP_10_TFM', 'SUP_10_HISTOIRE']);
  const smGeo = pickNumber(row, ['sm_geo', 'sm_geographie', 'SM_GEOGRAPHIE']);
  const supGeo = pickNumber(row, ['sup_10_geo', 'geographie_sup10', 'SUP_10_GEOGRAPHIE']);
  const smSvt = pickNumber(row, ['sm_svt', 'SM_SVT']);
  const supSvt = pickNumber(row, ['sup_10_svt', 'SUP_10_SVT']);
  const txG = pickNumber(row, ['tx_admis_g', 'taux_admis_g', 'pourcentage_admis_garcons']);
  const txF = pickNumber(row, ['tx_admis_f', 'taux_admis_f', 'pourcentage_admis_filles']);
  const tx = pickNumber(row, ['tx_admis', 'taux_admis', 'pourcentage_admis']);
  const nbrG = pickNumber(row, ['nbr_g', 'nbrG', 'NBR_G', 'G', 'garcons', 'garçons']);
  const nbrF = pickNumber(row, ['nbr_f', 'nbrF', 'NBR_F', 'F', 'filles']);
  const total = pickNumber(row, ['total_candidats', 'Nbre', 'NBRE', 'inscrits_cepe', 'nb_candidats']) ?? sumPresent([nbrG, nbrF]);
  const admisG = pickNumber(row, ['admis_g', 'admisG', 'ADMIS_G']);
  const admisF = pickNumber(row, ['admis_f', 'admisF', 'ADMIS_F']);

  const hasCepe = [smMlg, supMlg, smFr, supFr, smMaths, supMaths, txG, txF, tx].some((v) => v !== null);
  if (!hasCepe) return null;

  const smAutres = pickNumber(row, ['sm_total', 'sm_autres']) ?? averagePresent([smTfm, smGeo, smSvt]);
  const supAutres = preferPercentOrCount(row, ['autres_sup10', 'sup_10_autres']) ?? averagePresent([supTfm, supGeo, supSvt]);
  return {
    source: 'csv_import',
    total_candidats: total,
    nbr_g: nbrG ?? (txG !== null ? 100 : null), nbr_f: nbrF ?? (txF !== null ? 100 : null),
    admis_g: admisG ?? (nbrG !== null && txG !== null ? Math.round(nbrG * txG / 100) : txG),
    admis_f: admisF ?? (nbrF !== null && txF !== null ? Math.round(nbrF * txF / 100) : txF),
    tx_admis_g: txG, tx_admis_f: txF, tx_admis: tx,
    sm_mlg: smMlg, mlg_sup10: supMlg,
    sm_mlg_fahazoana: pickNumber(row, ['sm_mlg_fahazoana', 'SM_FAHALALANA', 'sm_fahazoana_lahatsoratra']) ?? smMlg,
    mlg_compo_sup10: preferPercentOrCount(row, ['mlg_compo_sup10', 'sup_10_mlg_fahazoana', 'sup_10_fahazoana_lahatsoratra']) ?? supMlg,
    sm_mlg_fitsipika: pickNumber(row, ['sm_mlg_fitsipika']) ?? smMlg,
    mlg_gram_sup10: preferPercentOrCount(row, ['mlg_gram_sup10', 'sup_10_mlg_fitsipika']) ?? supMlg,
    sm_mlg_fanazarana: pickNumber(row, ['sm_mlg_fanazarana']) ?? smMlg,
    mlg_exp_sup10: preferPercentOrCount(row, ['mlg_exp_sup10', 'sup_10_mlg_fanazarana']) ?? supMlg,
    sm_frs: smFr, frs_sup10: supFr,
    sm_frs_comprehension: pickNumber(row, ['sm_frs_comprehension']) ?? smFr,
    frs_compo_sup10: preferPercentOrCount(row, ['frs_compo_sup10', 'sup_10_frs_comprehension']) ?? supFr,
    sm_frs_grammaire: pickNumber(row, ['sm_frs_grammaire']) ?? smFr,
    frs_gram_sup10: preferPercentOrCount(row, ['frs_gram_sup10', 'sup_10_frs_grammaire']) ?? supFr,
    sm_frs_expression: pickNumber(row, ['sm_frs_expression']) ?? smFr,
    frs_exp_sup10: preferPercentOrCount(row, ['frs_exp_sup10', 'sup_10_frs_expression']) ?? supFr,
    sm_mths: smMaths, mths_sup10: supMaths,
    sm_mths_operation: smOp, op_sup10: supOp,
    sm_mths_probleme: smProb, prob_sup10: supProb,
    sm_histoire: smTfm, histoire_sup10: supTfm,
    sm_geographie: smGeo, geographie_sup10: supGeo,
    sm_svt: smSvt, svt_sup10: supSvt,
    sm_total: smAutres, autres_sup10: supAutres,
  };
}

function completeCepe(row: any): any {
  if (!row || typeof row !== 'object') return row;
  const total = pickNumber(row, ['total_candidats', 'Nbre', 'NBRE', 'inscrits_cepe', 'nb_candidats']);
  const smAutres = pickNumber(row, ['sm_total', 'sm_autres']);
  const supAutres = pickNumber(row, ['autres_sup10', 'sup_10_autres', 'autres_sup_10']);
  const withValue = (key: string, value: number | null) => row[key] === null || row[key] === undefined ? value : row[key];
  return {
    ...row,
    total_candidats: total ?? row.total_candidats,
    sm_histoire: withValue('sm_histoire', pickNumber(row, ['sm_tfm', 'SM_TFM', 'SM_HISTOIRE']) ?? smAutres),
    histoire_sup10: withValue('histoire_sup10', pickNumber(row, ['sup_10_tfm', 'SUP_10_TFM', 'SUP_10_HISTOIRE']) ?? supAutres),
    sm_geographie: withValue('sm_geographie', pickNumber(row, ['sm_geo', 'SM_GEOGRAPHIE']) ?? smAutres),
    geographie_sup10: withValue('geographie_sup10', pickNumber(row, ['sup_10_geo', 'SUP_10_GEOGRAPHIE']) ?? supAutres),
    sm_svt: withValue('sm_svt', pickNumber(row, ['SM_SVT']) ?? smAutres),
    svt_sup10: withValue('svt_sup10', pickNumber(row, ['sup_10_svt', 'SUP_10_SVT']) ?? supAutres),
  };
}

async function getLatestImportedTdbRow(table: 'tdb_zap' | 'tdb_cisco' | 'tdb_dren' | 'tdb_ecole' | 'tdb_mada', filters: Record<string, number>): Promise<any | null> {
  const sbUrl = Deno.env.get('SUPABASE_DB_URL');
  if (!sbUrl) return null;
  const sb = new Client(sbUrl);
  try {
    await sb.connect();
    const conds: string[] = [];
    const params: any[] = [];
    Object.entries(filters).forEach(([col, value]) => {
      if (Number(value) > 0) { params.push(Number(value)); conds.push(`"${col}" = $${params.length}`); }
    });
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const res = await sb.queryObject(`SELECT * FROM public.${table} ${where} ORDER BY imported_at DESC, id DESC LIMIT 1`, params);
    await sb.end();
    const row: any = res.rows[0];
    if (!row) return null;
    const data = row.data && typeof row.data === 'object' ? row.data : {};
    const flat: Record<string, any> = { ...data };
    Object.keys(row).forEach((k) => { if (k !== 'data' && k !== 'id' && flat[k] === undefined) flat[k] = row[k]; });
    return flat;
  } catch (e) {
    try { await sb.end(); } catch (_) { /* noop */ }
    console.error('getLatestImportedTdbRow error:', table, e);
    return null;
  }
}

// Aggregate per-candidate CEPE results (stored in Supabase examen_cepe_candidates)
// into the same shape as normalizeImportedCepe — used as a fallback when the
// official Django examen_cepe table is empty for the requested year (e.g. 2025).
async function aggregateCandidatesCepe(
  djangoClient: any,
  annee: number,
  scope: { type: 'mada' | 'dren' | 'cisco' | 'zap' | 'ecole'; codeDren?: number; codeCisco?: number; codeZap?: number; codeEtab?: number },
): Promise<any | null> {
  // Now reads from Django DB (table examen_cepe_candidates is auto-created on import).
  try {
    // Probe — table may not exist yet on a fresh server.
    let probe;
    try {
      probe = await djangoClient.queryObject(
        `SELECT 1 FROM examen_cepe_candidates WHERE "ANNEE_SCOLAIRE"=$1 LIMIT 1`,
        [annee],
      );
    } catch (_e) {
      return null;
    }
    if (probe.rows.length === 0) return null;

    let etabFilter = '';
    const params: any[] = [annee];
    if (scope.type === 'ecole' && scope.codeEtab && scope.codeEtab > 0) {
      params.push(scope.codeEtab);
      etabFilter = `AND "CODE_ETAB" = $${params.length}`;
    } else if (scope.type !== 'mada') {
      const conds: string[] = [`"ANNEE_SCOLAIRE"=${annee}`, `"SECTEUR"=0`, `"EXISTE_PRIMAIRE"=1`];
      if (scope.codeDren && scope.codeDren > 0) conds.push(`"CODE_DREN"=${scope.codeDren}`);
      if (scope.codeCisco && scope.codeCisco > 0) conds.push(`"CODE_CISCO"=${scope.codeCisco}`);
      if (scope.codeZap && scope.codeZap > 0) conds.push(`"CODE_ZAP"=${scope.codeZap}`);
      let etabs: number[] = [];
      try {
        const ar = await djangoClient.queryObject(
          `SELECT DISTINCT "CODE_ETAB" FROM fpe_a1 WHERE ${conds.join(' AND ')}`,
        );
        etabs = (ar.rows as any[]).map((r) => Number(r.CODE_ETAB)).filter((n) => Number.isFinite(n));
      } catch (_) { /* fall back to all */ }
      if (etabs.length === 0) return null;
      params.push(etabs);
      etabFilter = `AND "CODE_ETAB" = ANY($${params.length}::int[])`;
    }

    const sql = `
      WITH per_etab AS (
        SELECT
          "CODE_ETAB",
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE upper("GENRE")='G') AS nbr_g,
          COUNT(*) FILTER (WHERE upper("GENRE")='F') AS nbr_f,
          COUNT(*) FILTER (WHERE upper("GENRE")='G' AND upper("CEPE")='A') AS admis_g,
          COUNT(*) FILTER (WHERE upper("GENRE")='F' AND upper("CEPE")='A') AS admis_f,
          ROUND((SUM("MALAGASY") * 0.25 / COUNT(*))::numeric, 1) AS sm_mlg,
          ROUND((SUM("FRANCAIS") * 0.5 / COUNT(*))::numeric, 1) AS sm_frs,
          ROUND((SUM("OP") * 0.5 / COUNT(*))::numeric, 1) AS sm_op,
          ROUND((SUM("PROBLEME") * 0.25 / COUNT(*))::numeric, 1) AS sm_prob,
          ROUND((SUM("SVT") * 0.25 / COUNT(*))::numeric, 1) AS sm_svt,
          ROUND((SUM("TFM") * 0.25 / COUNT(*))::numeric, 1) AS sm_histoire,
          ROUND((SUM("GEOGRAPHIE") * 0.5 / COUNT(*))::numeric, 1) AS sm_geographie,
          COUNT(*) FILTER (WHERE "MALAGASY" >= 20) AS mlg_sup10,
          COUNT(*) FILTER (WHERE "FRANCAIS" >= 10) AS frs_sup10,
          COUNT(*) FILTER (WHERE "OP" >= 10) AS op_sup10,
          COUNT(*) FILTER (WHERE "OP" >= 20) AS prob_sup10,
          COUNT(*) FILTER (WHERE "SVT" >= 20) AS svt_sup10,
          COUNT(*) FILTER (WHERE "TFM" >= 20) AS histoire_sup10,
          COUNT(*) FILTER (WHERE "GEOGRAPHIE" >= 10) AS geographie_sup10
        FROM examen_cepe_candidates
        WHERE "ANNEE_SCOLAIRE"=$1 ${etabFilter}
        GROUP BY "CODE_ETAB"
      )
      SELECT
        SUM(total) AS total, SUM(nbr_g) AS nbr_g, SUM(nbr_f) AS nbr_f,
        SUM(admis_g) AS admis_g, SUM(admis_f) AS admis_f,
        AVG(sm_mlg)::numeric AS sm_mlg, AVG(sm_frs)::numeric AS sm_frs,
        AVG(sm_op)::numeric AS sm_op, AVG(sm_prob)::numeric AS sm_prob,
        AVG((sm_op + sm_prob) / 2.0)::numeric AS sm_mths,
        AVG((sm_mlg + sm_frs + sm_op + sm_prob + sm_svt + sm_histoire + sm_geographie) / 7.0)::numeric AS sm_total,
        AVG(sm_svt)::numeric AS sm_svt, AVG(sm_histoire)::numeric AS sm_histoire, AVG(sm_geographie)::numeric AS sm_geographie,
        SUM(mlg_sup10) AS mlg_sup10, SUM(frs_sup10) AS frs_sup10,
        SUM(op_sup10) AS op_sup10, SUM(prob_sup10) AS prob_sup10, SUM(op_sup10) + SUM(prob_sup10) AS mths_sup10,
        SUM(svt_sup10) + SUM(histoire_sup10) + SUM(geographie_sup10) AS autres_sup10,
        SUM(svt_sup10) AS svt_sup10, SUM(histoire_sup10) AS histoire_sup10, SUM(geographie_sup10) AS geographie_sup10
      FROM per_etab
    `;
    const r = await djangoClient.queryObject(sql, params);
    const a: any = r.rows[0];
    if (!a || Number(a.total) === 0) return null;
    const round = (v: any) => v === null || v === undefined ? null : Math.round(Number(v) * 10) / 10;
    const total = Number(a.total) || 0;
    const nbrG = Number(a.nbr_g) || 0;
    const nbrF = Number(a.nbr_f) || 0;
    const admisG = Number(a.admis_g) || 0;
    const admisF = Number(a.admis_f) || 0;
    return {
      source: 'candidates',
      total_candidats: total,
      nbr_g: nbrG, nbr_f: nbrF,
      admis_g: admisG, admis_f: admisF,
      tx_admis_g: nbrG ? Math.round((admisG * 1000) / nbrG) / 10 : null,
      tx_admis_f: nbrF ? Math.round((admisF * 1000) / nbrF) / 10 : null,
      tx_admis: total ? Math.round(((admisG + admisF) * 1000) / total) / 10 : null,
      sm_mlg: round(a.sm_mlg), mlg_sup10: Number(a.mlg_sup10) || 0,
      sm_mlg_fahazoana: round(a.sm_mlg), mlg_compo_sup10: Number(a.mlg_sup10) || 0,
      sm_mlg_fitsipika: round(a.sm_mlg), mlg_gram_sup10: Number(a.mlg_sup10) || 0,
      sm_mlg_fanazarana: round(a.sm_mlg), mlg_exp_sup10: Number(a.mlg_sup10) || 0,
      sm_frs: round(a.sm_frs), frs_sup10: Number(a.frs_sup10) || 0,
      sm_frs_comprehension: round(a.sm_frs), frs_compo_sup10: Number(a.frs_sup10) || 0,
      sm_frs_grammaire: round(a.sm_frs), frs_gram_sup10: Number(a.frs_sup10) || 0,
      sm_frs_expression: round(a.sm_frs), frs_exp_sup10: Number(a.frs_sup10) || 0,
      sm_mths: round(a.sm_mths), mths_sup10: Number(a.mths_sup10) || 0,
      sm_mths_operation: round(a.sm_op), op_sup10: Number(a.op_sup10) || 0,
      sm_mths_probleme: round(a.sm_prob), prob_sup10: Number(a.prob_sup10) || 0,
      sm_svt: round(a.sm_svt), svt_sup10: Number(a.svt_sup10) || 0,
      sm_histoire: round(a.sm_histoire), histoire_sup10: Number(a.histoire_sup10) || 0,
      sm_geographie: round(a.sm_geographie), geographie_sup10: Number(a.geographie_sup10) || 0,
      sm_total: round(a.sm_total), autres_sup10: Number(a.autres_sup10) || 0,
    };
  } catch (e) {
    console.error('aggregateCandidatesCepe error:', e);
    return null;
  }
}

async function aggregateCandidatesBepc(
  djangoClient: any,
  annee: number,
  scope: { type: 'mada' | 'dren' | 'cisco' | 'zap' | 'ecole'; codeDren?: number; codeCisco?: number; codeZap?: number; codeEtab?: number },
): Promise<any | null> {
  try {
    let probe;
    try {
      probe = await djangoClient.queryObject(
        `SELECT 1 FROM examen_bepc_candidates WHERE "ANNEE_SCOLAIRE"=$1 LIMIT 1`,
        [annee],
      );
    } catch (_e) {
      return null;
    }
    if (probe.rows.length === 0) return null;

    let etabFilter = '';
    const params: any[] = [annee];
    if (scope.type === 'ecole' && scope.codeEtab && scope.codeEtab > 0) {
      params.push(scope.codeEtab);
      etabFilter = `AND "CODE_ETAB" = $${params.length}`;
    } else if (scope.type !== 'mada') {
      const conds: string[] = [`"ANNEE_SCOLAIRE"=${annee}`, `"SECTEUR"=0`, `"EXISTE_COLLEGE"=1`];
      if (scope.codeDren && scope.codeDren > 0) conds.push(`"CODE_DREN"=${scope.codeDren}`);
      if (scope.codeCisco && scope.codeCisco > 0) conds.push(`"CODE_CISCO"=${scope.codeCisco}`);
      if (scope.codeZap && scope.codeZap > 0) conds.push(`"CODE_ZAP"=${scope.codeZap}`);
      let etabs: number[] = [];
      try {
        const ar = await djangoClient.queryObject(
          `SELECT DISTINCT "CODE_ETAB" FROM fpe_a1 WHERE ${conds.join(' AND ')}`,
        );
        etabs = (ar.rows as any[]).map((r) => Number(r.CODE_ETAB)).filter((n) => Number.isFinite(n));
      } catch (_) { /* fall back */ }
      if (etabs.length === 0) return null;
      params.push(etabs);
      etabFilter = `AND "CODE_ETAB" = ANY($${params.length}::int[])`;
    }

    const sql = `
      WITH per_etab AS (
        SELECT
          "CODE_ETAB",
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE upper("GENRE")='G') AS nbr_g,
          COUNT(*) FILTER (WHERE upper("GENRE")='F') AS nbr_f,
          COUNT(*) FILTER (WHERE upper("GENRE")='G' AND upper("BEPC")='A') AS admis_g,
          COUNT(*) FILTER (WHERE upper("GENRE")='F' AND upper("BEPC")='A') AS admis_f,
          AVG("MALAGASY")::numeric AS sm_mlg,
          AVG("FRANCAIS")::numeric AS sm_frs,
          AVG("ANGLAIS")::numeric AS sm_ang,
          AVG("MATHEMATIQUE")::numeric AS sm_math,
          AVG("PHYSIQUE")::numeric AS sm_phys,
          AVG("SVT")::numeric AS sm_svt,
          AVG("HISTO_GEO"::numeric)::numeric AS sm_hg,
          COUNT(*) FILTER (WHERE "MALAGASY" >= 10) AS mlg_sup10,
          COUNT(*) FILTER (WHERE "FRANCAIS" >= 10) AS frs_sup10,
          COUNT(*) FILTER (WHERE "ANGLAIS" >= 10) AS ang_sup10,
          COUNT(*) FILTER (WHERE "MATHEMATIQUE" >= 10) AS math_sup10,
          COUNT(*) FILTER (WHERE "PHYSIQUE" >= 10) AS phys_sup10,
          COUNT(*) FILTER (WHERE "SVT" >= 10) AS svt_sup10,
          COUNT(*) FILTER (WHERE "HISTO_GEO"::numeric >= 10) AS hg_sup10
        FROM examen_bepc_candidates
        WHERE "ANNEE_SCOLAIRE"=$1 ${etabFilter}
        GROUP BY "CODE_ETAB"
      )
      SELECT
        SUM(total) AS total, SUM(nbr_g) AS nbr_g, SUM(nbr_f) AS nbr_f,
        SUM(admis_g) AS admis_g, SUM(admis_f) AS admis_f,
        AVG(sm_mlg) AS sm_mlg, AVG(sm_frs) AS sm_frs, AVG(sm_ang) AS sm_ang,
        AVG(sm_math) AS sm_math, AVG(sm_phys) AS sm_phys,
        AVG(sm_svt) AS sm_svt, AVG(sm_hg) AS sm_hg,
        SUM(mlg_sup10) AS mlg_sup10, SUM(frs_sup10) AS frs_sup10, SUM(ang_sup10) AS ang_sup10,
        SUM(math_sup10) AS math_sup10, SUM(phys_sup10) AS phys_sup10,
        SUM(svt_sup10) AS svt_sup10, SUM(hg_sup10) AS hg_sup10
      FROM per_etab
    `;
    const r = await djangoClient.queryObject(sql, params);
    const a: any = r.rows[0];
    if (!a || Number(a.total) === 0) return null;
    const round = (v: any) => v === null || v === undefined ? null : Math.round(Number(v) * 10) / 10;
    const total = Number(a.total) || 0;
    const nbrG = Number(a.nbr_g) || 0;
    const nbrF = Number(a.nbr_f) || 0;
    const admisG = Number(a.admis_g) || 0;
    const admisF = Number(a.admis_f) || 0;
    return {
      source: 'candidates',
      examen: 'BEPC',
      total_candidats: total,
      nbr_g: nbrG, nbr_f: nbrF,
      admis_g: admisG, admis_f: admisF,
      tx_admis_g: nbrG ? Math.round((admisG * 1000) / nbrG) / 10 : null,
      tx_admis_f: nbrF ? Math.round((admisF * 1000) / nbrF) / 10 : null,
      tx_admis: total ? Math.round(((admisG + admisF) * 1000) / total) / 10 : null,
      sm_mlg: round(a.sm_mlg), mlg_sup10: Number(a.mlg_sup10) || 0,
      sm_frs: round(a.sm_frs), frs_sup10: Number(a.frs_sup10) || 0,
      sm_ang: round(a.sm_ang), ang_sup10: Number(a.ang_sup10) || 0,
      sm_math: round(a.sm_math), math_sup10: Number(a.math_sup10) || 0,
      sm_phys: round(a.sm_phys), phys_sup10: Number(a.phys_sup10) || 0,
      sm_svt: round(a.sm_svt), svt_sup10: Number(a.svt_sup10) || 0,
      sm_hg: round(a.sm_hg), hg_sup10: Number(a.hg_sup10) || 0,
    };
  } catch (e) {
    console.error('aggregateCandidatesBepc error:', e);
    return null;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const client = new Client(dbConfig);

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";
    const codeDren = parseInt(url.searchParams.get("code_dren") || "0");
    const codeCisco = parseInt(url.searchParams.get("code_cisco") || "0");
    const codeCommune = parseInt(url.searchParams.get("code_commune") || "0");
    const codeZap = parseInt(url.searchParams.get("code_zap") || "0");
    const secteur = parseInt(url.searchParams.get("secteur") || "2");

    console.log(`[${VERSION}] Action: ${action}, DREN: ${codeDren}, CISCO: ${codeCisco}, Secteur: ${secteur}`);

    if (action === "health") {
      return new Response(
        JSON.stringify({ ok: true, function: "db-query", version: VERSION, dbHost: dbConfig.hostname, dbPort: dbConfig.port }),
        { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-cache" } },
      );
    }

    // Connect to user's PostgreSQL server with timeout — return clean error instead of hanging
    try {
      await Promise.race([
        client.connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("DB_CONNECT_TIMEOUT")), 8000)),
      ]);
    } catch (connErr: any) {
      console.error("DB connection failed:", connErr?.message || connErr);
      try { await client.end(); } catch (_e) { /* ignore */ }
      return new Response(
        JSON.stringify({
          error: `Impossible de joindre la base de données (${dbConfig.hostname}:${dbConfig.port}). Vérifiez que votre serveur PostgreSQL est démarré et accessible.`,
          code: "DB_UNREACHABLE",
          retryable: true,
          version: VERSION,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    let result: any;


    switch (action) {
      case "getDrens":
        result = await client.queryObject('SELECT * FROM v_dren ORDER BY "DREN"');
        break;

      case "getCiscos":
        if (!codeDren || codeDren === 0) {
          result = await client.queryObject('SELECT * FROM v_cisco WHERE "CODE_DREN" > 0 ORDER BY "CISCO"');
        } else {
          result = await client.queryObject(`SELECT * FROM v_cisco WHERE "CODE_DREN" = ${codeDren} ORDER BY "CISCO"`);
        }
        break;

      case "getLayerEtabN0":
        result = await executeLayerEtab(client, codeDren, codeCisco, 'v_fiche_ecole_n0');
        break;
      case "getLayerEtabN1":
        result = await executeLayerEtab(client, codeDren, codeCisco, 'v_fiche_ecole_n1');
        break;
      case "getLayerEtabN2":
        result = await executeLayerEtab(client, codeDren, codeCisco, 'v_fiche_ecole_n2');
        break;
      case "getLayerEtabN3":
        result = await executeLayerEtab(client, codeDren, codeCisco, 'v_fiche_ecole_n3');
        break;
      case "getLayerVillageN1":
        result = await executeLayerVillage(client, codeDren, codeCisco, 'v_village_n1');
        break;
      case "getLayerVillageN2":
        result = await executeLayerVillage(client, codeDren, codeCisco, 'v_village_n2');
        break;
      case "getLayerVillageN3":
        result = await executeLayerVillage(client, codeDren, codeCisco, 'v_village_n3');
        break;
      case "getVillagesExclus":
        result = await executeVillagesExclus(client, codeDren, codeCisco, 'v_village_exclu_n1');
        break;
      case "getVillagesExclusN3":
        result = await executeVillagesExclus(client, codeDren, codeCisco, 'v_village_exclu_n3');
        break;

      // ============ ORS Layer actions ============
      case "getLayerBesoinsN1": {
        const w = codeDren > 0 && codeCisco === 0 ? `WHERE "CODE_DREN" = ${codeDren}` : `WHERE "CODE_CISCO" = ${codeCisco}`;
        result = await client.queryObject(`SELECT * FROM v_layer_besoins_n1 ${w}`);
        break;
      }
      case "getLayerBesoinsN2": {
        const w = codeDren > 0 && codeCisco === 0 ? `WHERE "CODE_DREN" = ${codeDren}` : `WHERE "CODE_CISCO" = ${codeCisco}`;
        result = await client.queryObject(`SELECT * FROM v_layer_besoins_n2 ${w}`);
        break;
      }
      case "getLayerBesoinsN3": {
        const w = codeDren > 0 && codeCisco === 0 ? `WHERE "CODE_DREN" = ${codeDren}` : `WHERE "CODE_CISCO" = ${codeCisco}`;
        result = await client.queryObject(`SELECT * FROM v_layer_besoins_n3 ${w}`);
        break;
      }
      case "getLayerN2": {
        const w = codeDren > 0 && codeCisco === 0 ? `WHERE "CODE_DREN" = ${codeDren}` : `WHERE "CODE_CISCO" = ${codeCisco}`;
        result = await client.queryObject(`SELECT * FROM v_layer_n2 ${w}`);
        break;
      }
      case "getLayerN3": {
        const w = codeDren > 0 && codeCisco === 0 ? `WHERE "CODE_DREN" = ${codeDren}` : `WHERE "CODE_CISCO" = ${codeCisco}`;
        result = await client.queryObject(`SELECT * FROM v_layer_n3 ${w}`);
        break;
      }
      // ============ Besoins (Primaire / Collège / Lycée) - jointure avec fpe_a1 ============
      case "getBesoinsPrimaire":
      case "getBesoinsCollege":
      case "getBesoinsLycee": {
        const tableMap: Record<string, string> = {
          getBesoinsPrimaire: "besoins_primaire",
          getBesoinsCollege: "besoins_college",
          getBesoinsLycee: "besoins_lycee",
        };
        const table = tableMap[action];
        const annee = parseInt(url.searchParams.get("annee") || "2025");
        const conds: string[] = [`a1."ANNEE_SCOLAIRE" = ${annee}`];
        if (codeDren > 0) conds.push(`a1."CODE_DREN" = ${codeDren}`);
        if (codeCisco > 0) conds.push(`a1."CODE_CISCO" = ${codeCisco}`);
        if (codeZap > 0) conds.push(`a1."CODE_ZAP" = ${codeZap}`);
        const where = `WHERE ${conds.join(" AND ")}`;
        const sql = `
          SELECT a1."DREN", a1."CISCO", a1."ZAP", a1."NOM_ETAB", b.*
          FROM public.${table} b
          INNER JOIN fpe_a1 a1 ON a1."CODE_ETAB" = b."CODE_ETAB"
          ${where}
        `;
        result = await client.queryObject(sql);
        break;
      }
      case "getLayerDren": {
        const q = `SELECT json_build_object('type','FeatureCollection','features',json_agg(json_build_object('type','Feature','properties',json_build_object('name',r."REGION_NAM",'code',r."CODE_DREN"),'geometry',ST_AsGeoJSON(ST_SimplifyPreserveTopology(r.geom, 0.001))::json))) AS shape FROM shape_dren r WHERE CAST(r."CODE_DREN" AS INTEGER) = ${codeDren}`;
        result = await client.queryObject(q);
        break;
      }
      case "getLayerCisco": {
        const ciscoW = codeCisco === 0 ? `WHERE CAST(r."CODE_DREN" AS INTEGER) = ${codeDren}` : `WHERE CAST(r."CODE_CISCO" AS INTEGER) = ${codeCisco}`;
        const q = `SELECT json_build_object('type','FeatureCollection','features',json_agg(json_build_object('type','Feature','properties',json_build_object('name',r.cisco,'code',r."CODE_CISCO"),'geometry',ST_AsGeoJSON(ST_SimplifyPreserveTopology(r.geom, 0.001))::json))) AS shape FROM shape_cisco r ${ciscoW}`;
        result = await client.queryObject(q);
        break;
      }
      case "getLayerCommune": {
        const communeW = codeCisco === 0 ? `WHERE CAST(r.code_dren AS INTEGER) = ${codeDren}` : `WHERE CAST(r.code_cisco AS INTEGER) = ${codeCisco}`;
        const q = `SELECT json_build_object('type','FeatureCollection','features',json_agg(json_build_object('type','Feature','properties',json_build_object('name',r.commune_na,'code',r.code_commune),'geometry',ST_AsGeoJSON(ST_SimplifyPreserveTopology(r.geom, 0.001))::json))) AS shape FROM shape_commune r ${communeW}`;
        result = await client.queryObject(q);
        break;
      }
      case "getLayerFokontany": {
        const fktW = codeCisco === 0 ? `WHERE CAST(r.dren AS INTEGER) = ${codeDren}` : `WHERE CAST(r.cisco AS INTEGER) = ${codeCisco}`;
        const q = `SELECT json_build_object('type','FeatureCollection','features',json_agg(json_build_object('type','Feature','properties',json_build_object('name',r."FOKONTANY_",'code_dren',r.dren,'code_cisco',r.cisco),'geometry',ST_AsGeoJSON(ST_SimplifyPreserveTopology(r.geom, 0.001))::json))) AS shape FROM shape_fokontany r ${fktW}`;
        result = await client.queryObject(q);
        break;
      }
      case "getVillages": {
        const vW = codeDren > 0 && codeCisco === 0 ? `WHERE dren = ${codeDren}` : `WHERE cisco = ${codeCisco}`;
        result = await client.queryObject(`SELECT name, dren as code_dren, cisco as code_cisco, population, longitude, latitude FROM sig_village ${vW} ORDER BY name`);
        break;
      }
      case "getNouvelleCreation": {
        result = await client.queryObject(`SELECT * FROM v_layer_ncn1`);
        break;
      }
      case "getNouvelleCreationN3": {
        result = await client.queryObject(`SELECT * FROM v_layer_ncn3`);
        break;
      }
      case "getLayerNcN2": {
        const ncW = codeDren > 0 && codeCisco === 0 ? `WHERE "CODE_DREN" = ${codeDren}` : `WHERE "CODE_CISCO" = ${codeCisco}`;
        result = await client.queryObject(`SELECT * FROM v_layer_ncn2 ${ncW}`);
        break;
      }

      case "getStatsEtablissements":
        result = await executeStatsEtablissements(client, codeDren, codeCisco, secteur);
        break;
      case "getStatsElevesN0N1":
        result = await executeStatsElevesN0N1(client, codeDren, codeCisco, secteur);
        break;
      case "getStatsElevesN2N3":
        result = await executeStatsElevesN2N3(client, codeDren, codeCisco, secteur);
        break;
      case "getStatsEnseignants":
        result = await executeStatsEnseignants(client, codeDren, codeCisco, secteur);
        break;
      case "getStatsPlacesAssises":
        result = await executeStatsPlaces(client, codeDren, codeCisco, secteur);
        break;

      case "getZaps":
        result = await executeGetZaps(client, codeDren, codeCisco, codeCommune);
        break;
      case "getCommunes":
        result = await executeGetCommunes(client, codeDren, codeCisco, codeZap);
        break;
      case "getDataPrescolaire":
        result = await executeGetDataN0(client, codeDren, codeCisco, codeCommune, codeZap, secteur);
        break;
      case "getDataPrimaire":
        result = await executeGetDataN1(client, codeDren, codeCisco, codeCommune, codeZap, secteur);
        break;
      case "getDataCollege":
        result = await executeGetDataN2(client, codeDren, codeCisco, codeCommune, codeZap, secteur);
        break;
      case "getDataLycee":
        result = await executeGetDataN3(client, codeDren, codeCisco, codeCommune, codeZap, secteur);
        break;

      case "getTdbNbrStdDren": {
        const tdbResult = await executeTdbNbrStdDren(client, codeDren);
        await client.end();
        return new Response(JSON.stringify(serializeData(tdbResult.rows)), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      case "getTdbZapsByCisco":
        result = await executeTdbZapsByCisco(client, codeCisco);
        break;
      case "getTdb111":
        result = await executeTdb111(client, codeDren);
        break;

      // ============ DataViz actions ============
      case "getHeatmapN0":
        result = await client.queryObject(`SELECT * FROM v_heatmap WHERE "SECTEUR" = 0 AND "EXISTE_PRESCO" = 1`);
        break;
      case "getHeatmapN1":
        result = await client.queryObject(`SELECT * FROM v_heatmap WHERE "SECTEUR" = 0 AND "EXISTE_PRIMAIRE" = 1`);
        break;
      case "getHeatmapN2":
        result = await client.queryObject(`SELECT * FROM v_heatmap WHERE "SECTEUR" = 0 AND "EXISTE_COLLEGE" = 1`);
        break;
      case "getHeatmapN3":
        result = await client.queryObject(`SELECT * FROM v_heatmap WHERE "SECTEUR" = 0 AND "EXISTE_LYCEE" = 1`);
        break;
      case "getDatavizLayerDren": {
        const q = `SELECT json_build_object('type','FeatureCollection','features',json_agg(json_build_object('type','Feature','properties',json_build_object('NAME',r."REGION_NAM",'CODE',r."CODE_DREN"),'geometry',ST_AsGeoJSON(ST_SimplifyPreserveTopology(r.geom, 0.001))::json))) AS shape FROM shape_dren r WHERE CAST(r."CODE_DREN" AS INTEGER) > 0`;
        result = await client.queryObject(q);
        break;
      }
      case "getDatavizLayerCisco": {
        const q = `SELECT json_build_object('type','FeatureCollection','features',json_agg(json_build_object('type','Feature','properties',json_build_object('NAME',r.cisco,'CODE',r."CODE_CISCO"),'geometry',ST_AsGeoJSON(ST_SimplifyPreserveTopology(r.geom, 0.001))::json))) AS shape FROM shape_cisco r`;
        result = await client.queryObject(q);
        break;
      }
      case "getDatavizLayerCommune": {
        const code = parseInt(url.searchParams.get("code") || "0");
        let communeWhere = '';
        if (code > 0) {
          communeWhere = code < 70 ? `WHERE CAST(r.code_dren AS INTEGER) = ${code}` : `WHERE CAST(r.code_cisco AS INTEGER) = ${code}`;
        }
        const q = `SELECT json_build_object('type','FeatureCollection','features',json_agg(json_build_object('type','Feature','properties',json_build_object('NAME',r.commune_na,'CODE',r.code_commune),'geometry',ST_AsGeoJSON(ST_SimplifyPreserveTopology(r.geom, 0.001))::json))) AS shape FROM shape_commune r ${communeWhere}`;
        result = await client.queryObject(q);
        break;
      }
      case "getDatavizDataDren": {
        const niveauParam = parseInt(url.searchParams.get("niveau") || "1");
        const niveau = [1, 2, 3].includes(niveauParam) ? niveauParam : 1;
        result = await client.queryObject(`SELECT * FROM v_ct_n${niveau}_dren`);
        break;
      }
      case "getDatavizDataCisco": {
        const niveauParam = parseInt(url.searchParams.get("niveau") || "1");
        const niveau = [1, 2, 3].includes(niveauParam) ? niveauParam : 1;
        result = await client.queryObject(`SELECT * FROM v_ct_n${niveau}_cisco`);
        break;
      }
      case "getDatavizDataCommune": {
        const code = parseInt(url.searchParams.get("code") || "0");
        const niveauParam = parseInt(url.searchParams.get("niveau") || "1");
        const niveau = [1, 2, 3].includes(niveauParam) ? niveauParam : 1;
        let cWhere = '';
        if (code > 0) {
          cWhere = code < 70 ? `WHERE "CODE_DREN" = ${code}` : `WHERE "CODE_CISCO" = ${code}`;
        }
        result = await client.queryObject(`SELECT * FROM v_ct_n${niveau}_commune ${cWhere}`);
        break;
      }
      case "getDatavizDataEtab": {
        const code = parseInt(url.searchParams.get("code") || "0");
        const niveauParam = parseInt(url.searchParams.get("niveau") || "1");
        const niveau = [1, 2, 3].includes(niveauParam) ? niveauParam : 1;
        let eWhere = '';
        if (code > 0) {
          eWhere = code < 70 ? `WHERE "CODE_DREN" = ${code}` : `WHERE "CODE_CISCO" = ${code}`;
        }
        result = await client.queryObject(`SELECT * FROM v_ct_n${niveau}_ecole ${eWhere}`);
        break;
      }

      // ============ Dashboard diploma stats ============
      case "getStatsDiplomes": {
        const diplomesResult = await executeStatsDiplomes(client, codeDren, codeCisco, secteur);
        await client.end();
        return new Response(
          JSON.stringify(serializeData(diplomesResult.rows)),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============ ZAP count ============
      case "getZapCount": {
        result = await client.queryObject(`SELECT COUNT(*) AS total FROM v_zap WHERE "CODE_ZAP" > 0`);
        break;
      }

      // ============ Available years ============
      case "getAvailableYears": {
        result = await client.queryObject(`SELECT DISTINCT "ANNEE_SCOLAIRE" AS annee FROM fpe_a1 WHERE "ANNEE_SCOLAIRE" > 2000 ORDER BY "ANNEE_SCOLAIRE" DESC`);
        break;
      }

      case "getTdbCiscoData": {
        let annee = parseInt(url.searchParams.get("annee") || "2025");
        annee = await resolveExamenYear(client, annee);
        try {
          const rawData = await executeTdbCiscoData(client, codeCisco, codeDren, annee);
          const [csvCisco, csvDren, csvMada, candCisco, candDren, candMada] = await Promise.all([
            getLatestImportedTdbRow('tdb_cisco', { CODE_CISCO: codeCisco, CODE_DREN: codeDren }),
            getLatestImportedTdbRow('tdb_dren', { CODE_DREN: codeDren }),
            getLatestImportedTdbRow('tdb_mada', {}),
            aggregateCandidatesCepe(client, annee, { type: 'cisco', codeCisco, codeDren }),
            aggregateCandidatesCepe(client, annee, { type: 'dren', codeDren }),
            aggregateCandidatesCepe(client, annee, { type: 'mada' }),
          ]);
          rawData.cisco.cepe = completeCepe(normalizeImportedCepe(csvCisco) ?? candCisco ?? rawData.cisco.cepe);
          rawData.dren.cepe = completeCepe(normalizeImportedCepe(csvDren) ?? candDren ?? rawData.dren.cepe);
          rawData.mada.cepe = completeCepe(normalizeImportedCepe(csvMada) ?? candMada ?? rawData.mada.cepe);
          await client.end();
          return new Response(
            JSON.stringify({ ...serializeData(rawData), examen_annee: annee }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch (tdbErr: any) {
          console.error("getTdbCiscoData error:", tdbErr);
          await client.end();
          return new Response(
            JSON.stringify({ error: `TDB Error: ${tdbErr.message}`, version: VERSION }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      case "getTdbDrenData": {
        let annee = parseInt(url.searchParams.get("annee") || "2025");
        annee = await resolveExamenYear(client, annee);
        try {
          const rawData = await executeTdbDrenData(client, codeDren, annee);
          const [csvDren, csvMada, candDren, candMada] = await Promise.all([
            getLatestImportedTdbRow('tdb_dren', { CODE_DREN: codeDren }),
            getLatestImportedTdbRow('tdb_mada', {}),
            aggregateCandidatesCepe(client, annee, { type: 'dren', codeDren }),
            aggregateCandidatesCepe(client, annee, { type: 'mada' }),
          ]);
          rawData.dren.cepe = completeCepe(normalizeImportedCepe(csvDren) ?? candDren ?? rawData.dren.cepe);
          rawData.mada.cepe = completeCepe(normalizeImportedCepe(csvMada) ?? candMada ?? rawData.mada.cepe);
          await client.end();
          return new Response(JSON.stringify({ ...serializeData(rawData), examen_annee: annee }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } catch (tdbErr: any) {
          console.error("getTdbDrenData error:", tdbErr);
          await client.end();
          return new Response(JSON.stringify({ error: `TDB DREN Error: ${tdbErr.message}`, version: VERSION }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      case "getTdbZapData": {
        let annee = parseInt(url.searchParams.get("annee") || "2025");
        annee = await resolveExamenYear(client, annee);
        const codeZap = parseInt(url.searchParams.get("code_zap") || "0");
        try {
          const rawData = await executeTdbZapData(client, codeZap, codeCisco, codeDren, annee);
          const [csvZap, csvCisco, csvDren, candZap, candCisco, candDren] = await Promise.all([
            getLatestImportedTdbRow('tdb_zap', { CODE_ZAP: codeZap, CODE_CISCO: codeCisco, CODE_DREN: codeDren }),
            getLatestImportedTdbRow('tdb_cisco', { CODE_CISCO: codeCisco, CODE_DREN: codeDren }),
            getLatestImportedTdbRow('tdb_dren', { CODE_DREN: codeDren }),
            aggregateCandidatesCepe(client, annee, { type: 'zap', codeZap, codeCisco, codeDren }),
            aggregateCandidatesCepe(client, annee, { type: 'cisco', codeCisco, codeDren }),
            aggregateCandidatesCepe(client, annee, { type: 'dren', codeDren }),
          ]);
          rawData.zap.cepe = completeCepe(normalizeImportedCepe(csvZap) ?? candZap ?? rawData.zap.cepe);
          rawData.cisco.cepe = completeCepe(normalizeImportedCepe(csvCisco) ?? candCisco ?? rawData.cisco.cepe);
          rawData.dren.cepe = completeCepe(normalizeImportedCepe(csvDren) ?? candDren ?? rawData.dren.cepe);
          await client.end();
          return new Response(
            JSON.stringify({ ...serializeData(rawData), examen_annee: annee }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch (tdbErr: any) {
          console.error("getTdbZapData error:", tdbErr);
          await client.end();
          return new Response(
            JSON.stringify({ error: `TDB ZAP Error: ${tdbErr.message}`, version: VERSION }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      case "getEcolesByZap": {
        const annee = parseInt(url.searchParams.get("annee") || "2025");
        const codeZapParam = parseInt(url.searchParams.get("code_zap") || "0");
        const niveau = (url.searchParams.get("niveau") || "primaire").toLowerCase();
        const niveauCol = niveau === "college" ? "EXISTE_COLLEGE" : niveau === "lycee" ? "EXISTE_LYCEE" : "EXISTE_PRIMAIRE";
        const q = `
          SELECT DISTINCT a1."CODE_ETAB", a1."NOM_ETAB", a1."SECTEUR", a1."CODE_ZAP"
          FROM fpe_a1 a1
          WHERE a1."ANNEE_SCOLAIRE" = ${annee} AND a1."CODE_ZAP" = ${codeZapParam} AND a1."${niveauCol}" = 1 AND a1."SECTEUR" = 0
          ORDER BY a1."NOM_ETAB"
        `;
        result = await client.queryObject(q);
        break;
      }

      case "getTdbEcoleData": {
        let annee = parseInt(url.searchParams.get("annee") || "2025");
        annee = await resolveExamenYear(client, annee);
        const codeEtab = parseInt(url.searchParams.get("code_etab") || "0");
        const codeZapParam = parseInt(url.searchParams.get("code_zap") || "0");
        const niveau = (url.searchParams.get("niveau") || "primaire").toLowerCase();
        try {
          const rawData = await executeTdbEcoleData(client, codeEtab, codeZapParam, codeCisco, codeDren, annee);
          const [csvEcole, csvZap, csvCisco, candEcole, candZap, candCisco] = await Promise.all([
            getLatestImportedTdbRow('tdb_ecole', { CODE_ETAB: codeEtab, CODE_ZAP: codeZapParam, CODE_CISCO: codeCisco, CODE_DREN: codeDren }),
            getLatestImportedTdbRow('tdb_zap', { CODE_ZAP: codeZapParam, CODE_CISCO: codeCisco, CODE_DREN: codeDren }),
            getLatestImportedTdbRow('tdb_cisco', { CODE_CISCO: codeCisco, CODE_DREN: codeDren }),
            aggregateCandidatesCepe(client, annee, { type: 'ecole', codeEtab }),
            aggregateCandidatesCepe(client, annee, { type: 'zap', codeZap: codeZapParam, codeCisco, codeDren }),
            aggregateCandidatesCepe(client, annee, { type: 'cisco', codeCisco, codeDren }),
          ]);
          rawData.ecole.cepe = completeCepe(normalizeImportedCepe(csvEcole) ?? candEcole ?? rawData.ecole.cepe);
          rawData.zap.cepe = completeCepe(normalizeImportedCepe(csvZap) ?? candZap ?? rawData.zap.cepe);
          rawData.cisco.cepe = completeCepe(normalizeImportedCepe(csvCisco) ?? candCisco ?? rawData.cisco.cepe);

          if (niveau === 'college') {
            const [bepcE, bepcZ, bepcC] = await Promise.all([
              aggregateCandidatesBepc(client, annee, { type: 'ecole', codeEtab }),
              aggregateCandidatesBepc(client, annee, { type: 'zap', codeZap: codeZapParam, codeCisco, codeDren }),
              aggregateCandidatesBepc(client, annee, { type: 'cisco', codeCisco, codeDren }),
            ]);
            rawData.ecole.bepc = bepcE || {};
            rawData.zap.bepc = bepcZ || {};
            rawData.cisco.bepc = bepcC || {};
          } else if (niveau === 'lycee') {
            rawData.ecole.bac = {};
            rawData.zap.bac = {};
            rawData.cisco.bac = {};
          }
          rawData.niveau = niveau;
          await client.end();
          return new Response(JSON.stringify({ ...serializeData(rawData), examen_annee: annee }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } catch (tdbErr: any) {
          console.error("getTdbEcoleData error:", tdbErr);
          await client.end();
          return new Response(JSON.stringify({ error: `TDB Ecole Error: ${tdbErr.message}`, version: VERSION }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      // ============ SIG actions ============
      case "getSigVillages": {
        const q = `SELECT id, name, dren as code_dren, cisco as code_cisco, longitude, latitude, population, is_airtel, is_orange, is_telma, is_elec, is_eau FROM sig_village ${codeDren > 0 && codeCisco === 0 ? `WHERE dren = ${codeDren}` : codeCisco > 0 ? `WHERE cisco = ${codeCisco}` : 'WHERE dren > 0'} ORDER BY name`;
        result = await client.queryObject(q);
        break;
      }
      case "getSigLayerDren": {
        const q = `SELECT json_build_object('type','FeatureCollection','features',json_agg(json_build_object('type','Feature','properties',json_build_object('name',r."REGION_NAM",'code',r."CODE_DREN"),'geometry',ST_AsGeoJSON(ST_SimplifyPreserveTopology(r.geom, 0.001))::json))) AS shape FROM shape_dren r WHERE CAST(r."CODE_DREN" AS INTEGER) = ${codeDren}`;
        result = await client.queryObject(q);
        break;
      }
      case "getSigLayerCisco": {
        const ciscoWhere = codeCisco === 0 ? `WHERE CAST(r."CODE_DREN" AS INTEGER) = ${codeDren}` : `WHERE CAST(r."CODE_CISCO" AS INTEGER) = ${codeCisco}`;
        const q = `SELECT json_build_object('type','FeatureCollection','features',json_agg(json_build_object('type','Feature','properties',json_build_object('name',r.cisco,'code',r."CODE_CISCO"),'geometry',ST_AsGeoJSON(ST_SimplifyPreserveTopology(r.geom, 0.001))::json))) AS shape FROM shape_cisco r ${ciscoWhere}`;
        result = await client.queryObject(q);
        break;
      }
      case "getSigLayerCommune": {
        const communeWhere2 = codeCisco === 0 ? `WHERE CAST(r.code_dren AS INTEGER) = ${codeDren}` : `WHERE CAST(r.code_cisco AS INTEGER) = ${codeCisco}`;
        const q = `SELECT json_build_object('type','FeatureCollection','features',json_agg(json_build_object('type','Feature','properties',json_build_object('name',r.commune_na,'code',r.code_commune),'geometry',ST_AsGeoJSON(ST_SimplifyPreserveTopology(r.geom, 0.001))::json))) AS shape FROM shape_commune r ${communeWhere2}`;
        result = await client.queryObject(q);
        break;
      }
      case "getSigLayerFokontany": {
        const fktWhere = codeCisco === 0 ? `WHERE CAST(r.dren AS INTEGER) = ${codeDren}` : `WHERE CAST(r.cisco AS INTEGER) = ${codeCisco}`;
        const q = `SELECT json_build_object('type','FeatureCollection','features',json_agg(json_build_object('type','Feature','properties',json_build_object('name',r."FOKONTANY_",'code_dren',r.dren,'code_cisco',r.cisco),'geometry',ST_AsGeoJSON(ST_SimplifyPreserveTopology(r.geom, 0.001))::json))) AS shape FROM shape_fokontany r ${fktWhere}`;
        result = await client.queryObject(q);
        break;
      }
      case "getSigEtabNonGeolocalise": {
        const ngWhere = codeDren > 0 && codeCisco === 0 ? `WHERE v."CODE_DREN" = ${codeDren}` : `WHERE v."CODE_CISCO" = ${codeCisco}`;
        result = await client.queryObject(`SELECT v.* FROM v_etablissement_non_geolocalise v ${ngWhere}`);
        break;
      }
      case "sigGeolocaliserEtab": {
        const body = await req.json();
        const q = `INSERT INTO sig_etablissement (id, code, longitude, latitude, is_valid) VALUES ((SELECT COALESCE(MAX(id),0) FROM sig_etablissement) + 1, ${body.code_etab}, ${body.longitude}, ${body.latitude}, 0)`;
        await client.queryObject(q);
        await client.end();
        return new Response(JSON.stringify({status:'success',message:"Géolocalisation effectuée avec succès"}), {headers:{...corsHeaders,"Content-Type":"application/json"}});
      }
      case "sigUpdatePositionEtab": {
        const body2 = await req.json();
        await client.queryObject(`UPDATE sig_etablissement SET longitude=${body2.longitude}, latitude=${body2.latitude} WHERE code = ${body2.code_etab}`);
        await client.end();
        return new Response(JSON.stringify({status:'success',message:"Position mise à jour avec succès"}), {headers:{...corsHeaders,"Content-Type":"application/json"}});
      }
      case "sigGeolocaliserVillage": {
        const bv = await req.json();
        const q = `INSERT INTO sig_village (id,name,dren,cisco,population,is_airtel,is_orange,is_telma,is_elec,is_eau,latitude,longitude) VALUES ((SELECT COALESCE(MAX(id),0) FROM sig_village) + 1,'${(bv.name||'').toUpperCase().replace(/'/g,"''")}',${bv.dren},${bv.cisco},${bv.population||0},${bv.airtel?1:0},${bv.orange?1:0},${bv.telma?1:0},${bv.elec?1:0},${bv.eau?1:0},${bv.latitude},${bv.longitude})`;
        await client.queryObject(q);
        await client.end();
        return new Response(JSON.stringify({status:'success',message:`Village ${bv.name} ajouté avec succès`}), {headers:{...corsHeaders,"Content-Type":"application/json"}});
      }
      case "sigUpdatePositionVillage": {
        const bv2 = await req.json();
        await client.queryObject(`UPDATE sig_village SET longitude=${bv2.longitude}, latitude=${bv2.latitude} WHERE id = ${bv2.id}`);
        await client.end();
        return new Response(JSON.stringify({status:'success',message:"Position du village mise à jour"}), {headers:{...corsHeaders,"Content-Type":"application/json"}});
      }

      // ============ Authentication ============
      case "login": {
        const body = await req.json();
        const { username, password } = body;
        if (!username || !password) {
          await client.end();
          return new Response(JSON.stringify({ success: false, error: "Nom d'utilisateur et mot de passe requis" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        // Bootstrap admin/admin account on first login attempt
        if (username === 'admin' && password === 'admin') {
          const adminExists = await client.queryObject(`SELECT id FROM login_customuser WHERE username = 'admin'`);
          if (adminExists.rows.length === 0) {
            const aSalt = crypto.randomUUID().replace(/-/g, '').substring(0, 22);
            const aEnc = new TextEncoder();
            const aKM = await crypto.subtle.importKey('raw', aEnc.encode('admin'), 'PBKDF2', false, ['deriveBits']);
            const aBits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: aEnc.encode(aSalt), iterations: 600000, hash: 'SHA-256' }, aKM, 256);
            const aHash = `pbkdf2_sha256$600000$${aSalt}$${btoa(String.fromCharCode(...new Uint8Array(aBits)))}`;
            await client.queryObject(`INSERT INTO login_customuser (id, password, last_login, is_superuser, username, first_name, last_name, email, is_staff, is_active, date_joined, dren, cisco) VALUES ((SELECT COALESCE(MAX(id),0)+1 FROM login_customuser), '${aHash}', NULL, true, 'admin', 'Administrateur', 'Système', 'admin@dpe.local', true, true, NOW(), 0, 0)`);
            console.log('[bootstrap] Admin account created');
          }
        }
        const userResult = await client.queryObject(`SELECT id, username, password, first_name, last_name, is_active, is_staff, is_superuser, email, dren, cisco FROM login_customuser WHERE username = '${username.replace(/'/g, "''")}'`);
        if (userResult.rows.length === 0) {
          await client.end();
          return new Response(JSON.stringify({ success: false, error: "Identifiants invalides ou compte pas encore activé, veuillez réessayer ou contacter l'administrateur" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const user = userResult.rows[0] as any;
        if (!user.is_active) {
          await client.end();
          return new Response(JSON.stringify({ success: false, error: `Le compte de ${user.username} n'est pas encore activé, veuillez contacter l'administrateur` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const passwordValid = await verifyDjangoPassword(password, user.password);
        if (!passwordValid) {
          await client.end();
          return new Response(JSON.stringify({ success: false, error: "Identifiants invalides ou compte pas encore activé, veuillez réessayer ou contacter l'administrateur" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        // Check for custom user model fields (dren, cisco)
        const dren = user.dren;
        const cisco = user.cisco;
        const redirect = user.username === 'eager' ? '/eager' : '/dashboard';
        await client.end();
        return new Response(JSON.stringify({
          success: true,
          redirect,
          user: { username: user.username, first_name: user.first_name, last_name: user.last_name, is_active: user.is_active, is_staff: user.is_staff, is_superuser: user.is_superuser, dren, cisco }
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ============ Update password ============
      case "updatePassword": {
        const body = await req.json();
        const { username, current_password, new_password, first_name, last_name } = body;
        const uResult = await client.queryObject(`SELECT id, password FROM login_customuser WHERE username = '${username.replace(/'/g, "''")}'`);
        if (uResult.rows.length === 0) {
          await client.end();
          return new Response(JSON.stringify({ success: false, error: "Utilisateur non trouvé" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const u = uResult.rows[0] as any;
        const cpValid = await verifyDjangoPassword(current_password, u.password);
        if (!cpValid) {
          await client.end();
          return new Response(JSON.stringify({ success: false, error: "Le mot de passe actuel est incorrect" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const salt = crypto.randomUUID().replace(/-/g, '').substring(0, 22);
        const enc = new TextEncoder();
        const keyMat = await crypto.subtle.importKey('raw', enc.encode(new_password || current_password), 'PBKDF2', false, ['deriveBits']);
        const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 600000, hash: 'SHA-256' }, keyMat, 256);
        const newHash = `pbkdf2_sha256$600000$${salt}$${btoa(String.fromCharCode(...new Uint8Array(bits)))}`;
        
        let updateQuery = `UPDATE login_customuser SET`;
        const updates: string[] = [];
        if (first_name) updates.push(` first_name = '${first_name.replace(/'/g, "''")}'`);
        if (last_name) updates.push(` last_name = '${last_name.replace(/'/g, "''")}'`);
        if (new_password) updates.push(` password = '${newHash}'`);
        if (updates.length === 0) {
          await client.end();
          return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        updateQuery += updates.join(',') + ` WHERE id = ${u.id}`;
        await client.queryObject(updateQuery);
        await client.end();
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ============ Admin: List all users ============
      case "listUsers": {
        const body = await req.json();
        const { adminUsername } = body;
        // Verify admin
        const adminCheck = await client.queryObject(`SELECT is_superuser FROM login_customuser WHERE username = '${(adminUsername||'').replace(/'/g, "''")}'`);
        if (adminCheck.rows.length === 0 || !(adminCheck.rows[0] as any).is_superuser) {
          await client.end();
          return new Response(JSON.stringify({ success: false, error: "Accès refusé" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 });
        }
        const users = await client.queryObject(`SELECT id, username, first_name, last_name, email, is_active, is_staff, is_superuser, dren, cisco, date_joined, last_login FROM login_customuser ORDER BY date_joined DESC`);
        await client.end();
        return new Response(JSON.stringify({ success: true, users: serializeData(users.rows) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ============ Admin: Create user ============
      case "createUser": {
        const body = await req.json();
        const { adminUsername, username: newUsername, password: newPwd, first_name: fn, last_name: ln, email: em, is_active: active, is_staff: staff, is_superuser: su, dren: d, cisco: c } = body;
        // Verify admin
        const adminCheck2 = await client.queryObject(`SELECT is_superuser FROM login_customuser WHERE username = '${(adminUsername||'').replace(/'/g, "''")}'`);
        if (adminCheck2.rows.length === 0 || !(adminCheck2.rows[0] as any).is_superuser) {
          await client.end();
          return new Response(JSON.stringify({ success: false, error: "Accès refusé" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 });
        }
        // Check if user exists
        const existCheck = await client.queryObject(`SELECT id FROM login_customuser WHERE username = '${(newUsername||'').replace(/'/g, "''")}'`);
        if (existCheck.rows.length > 0) {
          await client.end();
          return new Response(JSON.stringify({ success: false, error: `L'utilisateur ${newUsername} existe déjà` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        // Hash password
        const salt2 = crypto.randomUUID().replace(/-/g, '').substring(0, 22);
        const enc2 = new TextEncoder();
        const keyMat2 = await crypto.subtle.importKey('raw', enc2.encode(newPwd || 'changeme'), 'PBKDF2', false, ['deriveBits']);
        const bits2 = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc2.encode(salt2), iterations: 600000, hash: 'SHA-256' }, keyMat2, 256);
        const hash2 = `pbkdf2_sha256$600000$${salt2}$${btoa(String.fromCharCode(...new Uint8Array(bits2)))}`;
        
        await client.queryObject(`INSERT INTO login_customuser (id, password, last_login, is_superuser, username, first_name, last_name, email, is_staff, is_active, date_joined, dren, cisco) VALUES ((SELECT COALESCE(MAX(id),0)+1 FROM login_customuser), '${hash2}', NULL, ${su || false}, '${(newUsername||'').replace(/'/g, "''")}', '${(fn||'').replace(/'/g, "''")}', '${(ln||'').replace(/'/g, "''")}', '${(em||'').replace(/'/g, "''")}', ${staff || false}, ${active !== false}, NOW(), ${parseInt(d) || 0}, ${parseInt(c) || 0})`);
        await client.end();
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ============ Admin: Update user ============
      case "updateUser": {
        const body = await req.json();
        const { adminUsername, userId, first_name: ufn, last_name: uln, email: uem, is_active: uactive, is_staff: ustaff, is_superuser: usu, dren: ud, cisco: uc, newPassword: unp } = body;
        const adminCheck3 = await client.queryObject(`SELECT is_superuser FROM login_customuser WHERE username = '${(adminUsername||'').replace(/'/g, "''")}'`);
        if (adminCheck3.rows.length === 0 || !(adminCheck3.rows[0] as any).is_superuser) {
          await client.end();
          return new Response(JSON.stringify({ success: false, error: "Accès refusé" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 });
        }
        const uUpdates: string[] = [];
        if (ufn !== undefined) uUpdates.push(`first_name = '${ufn.replace(/'/g, "''")}'`);
        if (uln !== undefined) uUpdates.push(`last_name = '${uln.replace(/'/g, "''")}'`);
        if (uem !== undefined) uUpdates.push(`email = '${uem.replace(/'/g, "''")}'`);
        if (uactive !== undefined) uUpdates.push(`is_active = ${uactive}`);
        if (ustaff !== undefined) uUpdates.push(`is_staff = ${ustaff}`);
        if (usu !== undefined) uUpdates.push(`is_superuser = ${usu}`);
        if (ud !== undefined) uUpdates.push(`dren = ${parseInt(ud) || 0}`);
        if (uc !== undefined) uUpdates.push(`cisco = ${parseInt(uc) || 0}`);
        if (unp) {
          const salt3 = crypto.randomUUID().replace(/-/g, '').substring(0, 22);
          const enc3 = new TextEncoder();
          const keyMat3 = await crypto.subtle.importKey('raw', enc3.encode(unp), 'PBKDF2', false, ['deriveBits']);
          const bits3 = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc3.encode(salt3), iterations: 600000, hash: 'SHA-256' }, keyMat3, 256);
          const hash3 = `pbkdf2_sha256$600000$${salt3}$${btoa(String.fromCharCode(...new Uint8Array(bits3)))}`;
          uUpdates.push(`password = '${hash3}'`);
        }
        if (uUpdates.length > 0) {
          await client.queryObject(`UPDATE login_customuser SET ${uUpdates.join(', ')} WHERE id = ${parseInt(userId)}`);
        }
        await client.end();
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ============ Admin: Delete user ============
      case "deleteUser": {
        const body = await req.json();
        const { adminUsername, userId } = body;
        const adminCheck4 = await client.queryObject(`SELECT is_superuser FROM login_customuser WHERE username = '${(adminUsername||'').replace(/'/g, "''")}'`);
        if (adminCheck4.rows.length === 0 || !(adminCheck4.rows[0] as any).is_superuser) {
          await client.end();
          return new Response(JSON.stringify({ success: false, error: "Accès refusé" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 });
        }
        // Don't allow deleting yourself
        const targetUser = await client.queryObject(`SELECT username FROM login_customuser WHERE id = ${parseInt(userId)}`);
        if (targetUser.rows.length > 0 && (targetUser.rows[0] as any).username === adminUsername) {
          await client.end();
          return new Response(JSON.stringify({ success: false, error: "Impossible de supprimer votre propre compte" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        await client.queryObject(`DELETE FROM login_customuser_groups WHERE customuser_id = ${parseInt(userId)}`);
        await client.queryObject(`DELETE FROM login_customuser_user_permissions WHERE customuser_id = ${parseInt(userId)}`);
        await client.queryObject(`DELETE FROM login_customuser WHERE id = ${parseInt(userId)}`);
        await client.end();
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ============ Admin: Import data (insert rows into a table) ============
      case "importData": {
        const body = await req.json();
        const { adminUsername, tableName, columns, rows: dataRows } = body;
        const adminCheck5 = await client.queryObject(`SELECT is_superuser FROM login_customuser WHERE username = '${(adminUsername||'').replace(/'/g, "''")}'`);
        if (adminCheck5.rows.length === 0 || !(adminCheck5.rows[0] as any).is_superuser) {
          await client.end();
          return new Response(JSON.stringify({ success: false, error: "Accès refusé" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 });
        }

        // ---- examen_cepe_candidates / examen_bepc_candidates live in the Django DB ----
        // Auto-create the table on first import with structural cols + flexible `data jsonb`.
        if (tableName === 'examen_cepe_candidates' || tableName === 'examen_bepc_candidates') {
          const isBepc = tableName === 'examen_bepc_candidates';

          try {
            if (isBepc) {
              await client.queryObject(`
                CREATE TABLE IF NOT EXISTS public.examen_bepc_candidates (
                  id BIGSERIAL PRIMARY KEY,
                  "ANNEE_SCOLAIRE" INTEGER,
                  "DREN" TEXT,
                  "CISCO" TEXT,
                  "MATRICULE" TEXT,
                  "CODE_ETAB" BIGINT,
                  "ECOLE_ORIGINE" TEXT,
                  "CODE_CENTRE" TEXT,
                  "GENRE" TEXT,
                  "OPTION" TEXT,
                  "MALAGASY" NUMERIC,
                  "FRANCAIS" NUMERIC,
                  "ANGLAIS" NUMERIC,
                  "MATHEMATIQUE" NUMERIC,
                  "PHYSIQUE" NUMERIC,
                  "BONUS" NUMERIC,
                  "SVT" NUMERIC,
                  "HISTO_GEO" NUMERIC,
                  "TOTAL" NUMERIC,
                  "MOYENNE" NUMERIC,
                  "BEPC" TEXT,
                  data JSONB NOT NULL DEFAULT '{}'::jsonb,
                  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
                );
                CREATE INDEX IF NOT EXISTS idx_examen_bepc_candidates_annee ON public.examen_bepc_candidates ("ANNEE_SCOLAIRE");
                CREATE INDEX IF NOT EXISTS idx_examen_bepc_candidates_etab ON public.examen_bepc_candidates ("CODE_ETAB");
                CREATE INDEX IF NOT EXISTS idx_examen_bepc_candidates_annee_etab ON public.examen_bepc_candidates ("ANNEE_SCOLAIRE","CODE_ETAB");
              `);
            } else {
              await client.queryObject(`
                CREATE TABLE IF NOT EXISTS public.examen_cepe_candidates (
                  id BIGSERIAL PRIMARY KEY,
                  "ANNEE_SCOLAIRE" INTEGER,
                  "DREN" TEXT,
                  "CISCO" TEXT,
                  "OPTION" TEXT,
                  "CODE_CENTRE" TEXT,
                  "CODE_ETAB" BIGINT,
                  "ECOLE_ORIGINE" TEXT,
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
                  data JSONB NOT NULL DEFAULT '{}'::jsonb,
                  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
                );
                ALTER TABLE public.examen_cepe_candidates ADD COLUMN IF NOT EXISTS "DREN" TEXT;
                ALTER TABLE public.examen_cepe_candidates ADD COLUMN IF NOT EXISTS "CISCO" TEXT;
                ALTER TABLE public.examen_cepe_candidates ADD COLUMN IF NOT EXISTS "OPTION" TEXT;
                ALTER TABLE public.examen_cepe_candidates ADD COLUMN IF NOT EXISTS "CODE_CENTRE" TEXT;
                ALTER TABLE public.examen_cepe_candidates ADD COLUMN IF NOT EXISTS "ECOLE_ORIGINE" TEXT;
                ALTER TABLE public.examen_cepe_candidates ALTER COLUMN "CODE_ETAB" TYPE BIGINT USING "CODE_ETAB"::bigint;
                CREATE INDEX IF NOT EXISTS idx_examen_cepe_candidates_annee ON public.examen_cepe_candidates ("ANNEE_SCOLAIRE");
                CREATE INDEX IF NOT EXISTS idx_examen_cepe_candidates_etab ON public.examen_cepe_candidates ("CODE_ETAB");
                CREATE INDEX IF NOT EXISTS idx_examen_cepe_candidates_annee_etab ON public.examen_cepe_candidates ("ANNEE_SCOLAIRE","CODE_ETAB");
              `);
            }
          } catch (e: any) {
            await client.end();
            return new Response(JSON.stringify({ success: false, error: `Création table Django: ${e.message}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          const structural = isBepc
            ? ['ANNEE_SCOLAIRE','DREN','CISCO','MATRICULE','CODE_ETAB','ECOLE_ORIGINE','CODE_CENTRE','GENRE','OPTION','MALAGASY','FRANCAIS','ANGLAIS','MATHEMATIQUE','PHYSIQUE','BONUS','SVT','HISTO_GEO','TOTAL','MOYENNE','BEPC']
            : ['ANNEE_SCOLAIRE','DREN','CISCO','OPTION','CODE_CENTRE','CODE_ETAB','ECOLE_ORIGINE','GENRE','OP','PROBLEME','SVT','TFM','MALAGASY','FRANCAIS','GEOGRAPHIE','TOTAL','MOYENNE','CEPE'];
          const intCols = ['ANNEE_SCOLAIRE','CODE_ETAB'];
          // Normalize file header → strip accents/spaces/punct and resolve common aliases
          const normHdr = (s: string) => String(s ?? '')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toUpperCase().replace(/[^A-Z0-9]+/g, '');
          const ALIASES: Record<string, string> = {
            ANNEESCOLAIRE: 'ANNEE_SCOLAIRE', ANNEE: 'ANNEE_SCOLAIRE',
            CODEETAB: 'CODE_ETAB', CODEETABLISSEMENT: 'CODE_ETAB', CODEETABLISSMEENT: 'CODE_ETAB', CODEECOLE: 'CODE_ETAB',
            CODECENTRE: 'CODE_CENTRE', CODECENTREEXAMEN: 'CODE_CENTRE', CENTRE: 'CODE_CENTRE',
            ECOLEORIGINE: 'ECOLE_ORIGINE', ECOLEDORIGINE: 'ECOLE_ORIGINE', ETABLISSEMENTORIGINE: 'ECOLE_ORIGINE',
            SEXE: 'GENRE', GENRE: 'GENRE',
            OPERATION: 'OP', OPS: 'OP', OP: 'OP',
            PROBLEME: 'PROBLEME', PROBLEMES: 'PROBLEME',
            HISTOIRE: 'TFM', HISTOIREGEO: 'HISTO_GEO', HISTOGEO: 'HISTO_GEO',
            MLG: 'MALAGASY', MALAGASY: 'MALAGASY',
            FRS: 'FRANCAIS', FRANCAIS: 'FRANCAIS',
            GEO: 'GEOGRAPHIE', GEOGRAPHIE: 'GEOGRAPHIE',
            MOYENNE: 'MOYENNE', TOTAL: 'TOTAL',
            RESULTAT: isBepc ? 'BEPC' : 'CEPE', DECISION: isBepc ? 'BEPC' : 'CEPE', STATUT: isBepc ? 'BEPC' : 'CEPE',
            MATHS: 'MATHEMATIQUE', MATHEMATIQUE: 'MATHEMATIQUE', MATHEMATIQUES: 'MATHEMATIQUE',
            DREN: 'DREN', CISCO: 'CISCO', OPTION: 'OPTION', SVT: 'SVT', TFM: 'TFM',
            CEPE: 'CEPE', BEPC: 'BEPC', ANGLAIS: 'ANGLAIS', PHYSIQUE: 'PHYSIQUE', BONUS: 'BONUS',
            MATRICULE: 'MATRICULE',
          };
          const headerToIdx = new Map<string, number>();
          (columns as string[]).forEach((c, i) => {
            const u = String(c).toUpperCase();
            headerToIdx.set(u, i);
            const n = normHdr(c);
            const target = ALIASES[n];
            if (target && !headerToIdx.has(target)) headerToIdx.set(target, i);
          });
          const structuralIdx: Record<string, number> = {};
          structural.forEach(s => {
            const i = headerToIdx.get(s.toUpperCase());
            if (i !== undefined) structuralIdx[s] = i;
          });


          const batchStartRes = await client.queryObject<{ now: string }>(`SELECT now() AT TIME ZONE 'UTC' AS now`);
          const batchTs = body.importBatchTs || (batchStartRes.rows[0] as any).now;
          const coerce = (v: any) => {
            if (v === null || v === undefined || v === '') return null;
            if (typeof v === 'number') return v;
            const s = String(v).trim();
            if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
            return s;
          };

          // ---- Dedup-by-year: on the FIRST chunk of an import session, delete any
          // existing rows for the same ANNEE_SCOLAIRE so re-imports REPLACE instead of
          // duplicating. Detected by checking whether the batchId already exists.
          let deletedBeforeInsert = 0;
          try {
            const yrIdx = structuralIdx['ANNEE_SCOLAIRE'];
            let yr: number | null = null;
            if (yrIdx !== undefined && dataRows.length > 0) {
              const raw = coerce((dataRows[0] as any[])[yrIdx]);
              const n = Number(raw);
              if (Number.isFinite(n)) yr = Math.trunc(n);
            }
            const batchIdProbe = body.importBatchId;
            let isFirstChunk = true;
            if (batchIdProbe) {
              const sbUrlProbe = Deno.env.get("SUPABASE_DB_URL");
              if (sbUrlProbe) {
                const sbp = new Client(sbUrlProbe);
                try {
                  await sbp.connect();
                  const ex = await sbp.queryObject<{ c: number }>(
                    `SELECT COUNT(*)::int AS c FROM tdb_import_batches WHERE id = $1`,
                    [batchIdProbe],
                  );
                  isFirstChunk = ((ex.rows[0] as any)?.c ?? 0) === 0;
                  await sbp.end();
                } catch (_) { try { await sbp.end(); } catch(_2) {} }
              }
            }
            if (isFirstChunk && yr !== null) {
              const delRes = await client.queryObject(
                `DELETE FROM public.${tableName} WHERE "ANNEE_SCOLAIRE" = $1`,
                [yr],
              );
              deletedBeforeInsert = (delRes as any).rowCount ?? 0;
            }
          } catch (_) { /* non-fatal */ }

          const colsList = ['data', 'imported_at', ...structural.map(s => `"${s}"`)].join(', ');
          const colCount = 2 + structural.length;
          let inserted = 0;
          const errors: string[] = [];
          // Build all row tuples first
          const tuples: any[][] = [];
          for (let i = 0; i < dataRows.length; i++) {
            try {
              const row = dataRows[i] as any[];
              const dataObj: Record<string, any> = {};
              (columns as string[]).forEach((c, idx) => { dataObj[c] = coerce(row[idx]); });
              const structVals = structural.map(s => {
                const idx = structuralIdx[s];
                if (idx === undefined) return null;
                const v = coerce(row[idx]);
                if (intCols.includes(s) && v !== null) {
                  const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : null;
                }
                return v;
              });
              tuples.push([JSON.stringify(dataObj), batchTs, ...structVals]);
            } catch (e: any) {
              if (errors.length < 5) errors.push(`Ligne ${i + 1}: ${e.message}`);
            }
          }
          // Bulk insert in sub-batches
          const SUB = 500;
          for (let off = 0; off < tuples.length; off += SUB) {
            const chunk = tuples.slice(off, off + SUB);
            const valuesSql = chunk.map((_, r) => {
              const ph = Array.from({ length: colCount }, (_, c) => `$${r * colCount + c + 1}`).join(', ');
              return `(${ph})`;
            }).join(', ');
            const flat: any[] = [];
            for (const t of chunk) flat.push(...t);
            try {
              await client.queryObject(`INSERT INTO public.${tableName} (${colsList}) VALUES ${valuesSql}`, flat);
              inserted += chunk.length;
            } catch (e: any) {
              // Fallback per-row to skip bad rows
              for (let k = 0; k < chunk.length; k++) {
                try {
                  const ph = Array.from({ length: colCount }, (_, c) => `$${c + 1}`).join(', ');
                  await client.queryObject(`INSERT INTO public.${tableName} (${colsList}) VALUES (${ph})`, chunk[k]);
                  inserted++;
                } catch (e2: any) {
                  if (errors.length < 5) errors.push(`Ligne ${off + k + 1}: ${e2.message}`);
                }
              }
            }
          }
          // Track batch in Supabase tdb_import_batches
          let batchId: string | null = null;
          if (inserted > 0) {
            const sbUrl = Deno.env.get("SUPABASE_DB_URL");
            if (sbUrl) {
              const sb = new Client(sbUrl);
              try {
                await sb.connect();
                const batchIdInput = body.importBatchId || crypto.randomUUID();
                const batchRes = await sb.queryObject<{ id: string }>(
                  `INSERT INTO tdb_import_batches (id, table_name, file_name, row_count, imported_by, batch_ts_start, batch_ts_end, status)
                   VALUES ($1, $2, $3, $4, $5, $6, $6, 'completed')
                   ON CONFLICT (id) DO UPDATE SET
                     row_count = tdb_import_batches.row_count + EXCLUDED.row_count,
                     batch_ts_end = EXCLUDED.batch_ts_end,
                     status = 'completed'
                   RETURNING id`,
                  [batchIdInput, tableName, body.fileName || null, inserted, adminUsername || 'unknown', batchTs],
                );
                batchId = (batchRes.rows[0] as any)?.id ?? null;
                await sb.end();
              } catch (_) { try { await sb.end(); } catch(_2) {} }
            }
          }
          await client.end();
          return new Response(JSON.stringify({ success: true, inserted, total: dataRows.length, errors, targetTable: `${tableName} (Django)`, batchId, batchTs, deletedBeforeInsert }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }



        // ---- TDB tables (tdb_*) live in Lovable Cloud (Supabase), not Django DB ----
        // Schema = structural columns + flexible `data jsonb` for all CSV indicators.
        const supabaseTables = ['tdb_ecole', 'tdb_zap', 'tdb_cisco', 'tdb_dren', 'tdb_mada', 'tdb_ref', 'app_settings'];
        if (supabaseTables.includes(tableName)) {
          await client.end();
          const sbUrl = Deno.env.get("SUPABASE_DB_URL");
          if (!sbUrl) {
            return new Response(JSON.stringify({ success: false, error: "SUPABASE_DB_URL non configuré" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          // Per-table structural columns to extract from CSV header into typed columns
          const structuralByTable: Record<string, string[]> = {
            tdb_mada:  ['CODE_MADA'],
            tdb_dren:  ['CODE_DREN','DREN'],
            tdb_cisco: ['CODE_DREN','DREN','CODE_CISCO','CISCO'],
            tdb_zap:   ['CODE_DREN','DREN','CODE_CISCO','CISCO','CODE_ZAP','ZAP'],
            tdb_ecole: ['CODE_DREN','DREN','CODE_CISCO','CISCO','CODE_ZAP','ZAP','CODE_ETAB','NOM_ETAB'],
            tdb_ref:   ['CODE_ETAB'],
            app_settings: [],
          };
          const structural = structuralByTable[tableName] || [];
          const sb = new Client(sbUrl);
          await sb.connect();
          try {
            // Build a case-insensitive map header -> CSV index
            const headerToIdx = new Map<string, number>();
            (columns as string[]).forEach((c, i) => headerToIdx.set(String(c).toUpperCase(), i));
            const structuralIdx: Record<string, number> = {};
            structural.forEach(s => {
              const i = headerToIdx.get(s.toUpperCase());
              if (i !== undefined) structuralIdx[s] = i;
            });
            const batchStartRes = await sb.queryObject<{ now: string }>(`SELECT now() AT TIME ZONE 'UTC' AS now`);
            const batchTs = body.importBatchTs || (batchStartRes.rows[0] as any).now;
            const batchIdInput = body.importBatchId || crypto.randomUUID();
            const coerce = (v: any) => {
              if (v === null || v === undefined || v === '') return null;
              if (typeof v === 'number') return v;
              const s = String(v).trim();
              if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
              return s;
            };
            // Build INSERT once
            const cols = ['data', 'imported_at', ...structural.map(s => `"${s}"`)];
            const colList = cols.map(c => c.startsWith('"') ? c : `"${c}"`).join(', ');
            const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
            const insertSql = `INSERT INTO "${tableName}" (${colList}) VALUES (${placeholders})`;
            let inserted = 0;
            const errors: string[] = [];
            for (let i = 0; i < dataRows.length; i++) {
              try {
                const row = dataRows[i] as any[];
                // Build full data jsonb (all CSV columns, original header casing)
                const dataObj: Record<string, any> = {};
                (columns as string[]).forEach((c, idx) => { dataObj[c] = coerce(row[idx]); });
                const structVals = structural.map(s => {
                  const idx = structuralIdx[s];
                  if (idx === undefined) return null;
                  const v = coerce(row[idx]);
                  // Force CODE_* to integer
                  if (s.startsWith('CODE_') && v !== null) {
                    const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : null;
                  }
                  return v;
                });
                const vals: any[] = [JSON.stringify(dataObj), batchTs, ...structVals];
                await sb.queryObject(insertSql, vals);
                inserted++;
              } catch (e: any) {
                if (errors.length < 5) errors.push(`Ligne ${i + 1}: ${e.message}`);
              }
            }
            // Record batch
            let batchId: string | null = null;
            if (inserted > 0) {
              try {
                const batchRes = await sb.queryObject<{ id: string }>(
                  `INSERT INTO tdb_import_batches (id, table_name, file_name, row_count, imported_by, batch_ts_start, batch_ts_end, status)
                   VALUES ($1, $2, $3, $4, $5, $6, $6, 'completed')
                   ON CONFLICT (id) DO UPDATE SET
                     row_count = tdb_import_batches.row_count + EXCLUDED.row_count,
                     batch_ts_end = EXCLUDED.batch_ts_end,
                     status = 'completed'
                   RETURNING id`,
                  [batchIdInput, tableName, body.fileName || null, inserted, adminUsername || 'unknown', batchTs],
                );
                batchId = (batchRes.rows[0] as any)?.id ?? null;
              } catch (_) { /* noop */ }
            }
            await sb.end();
            return new Response(JSON.stringify({ success: true, inserted, total: dataRows.length, errors, targetTable: tableName, batchId, batchTs }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          } catch (e: any) {
            try { await sb.end(); } catch (_) { /* noop */ }
            return new Response(JSON.stringify({ success: false, error: `Supabase: ${e.message}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }

        // Map TDB views (read-only) to their underlying source tables for INSERT
        // Reference: docs/python-reference/create_df_all.py + Django models
        const tdbViewToTable: Record<string, string> = {
          'tdb_v_a1': 'fpe_a1',
          'tdb_v_d1': 'fpe_d1',
          'tdb_v_e1': 'fpe_e1',
          'tdb_v_e4': 'fpe_e4',
          'tdb_v_g1_section': 'fpe_g1',
          'tdb_v_h1_cantine': 'fpe_h1',
          'tdb_v_j1_sdc': 'fpe_j1',
          'tdb_v_j2_latrine': 'fpe_j2',
          'tdb_v_k1_place': 'fpe_k1',
          'tdb_v_l1_manuel': 'fpe_l1',
          'tdb_v_p1': 'fpe_p1',
          'tdb_v_ce': 'caisse_ecole',
        };
        const targetTable = tdbViewToTable[tableName] || tableName;

        // Whitelist allowed tables (real source tables)
        const allowedTables = ['examen_cepe_candidates', 'examen_bepc_candidates', 'examen_cepe_old', 'caisse_ecole', 'fpe_a1', 'fpe_e1', 'fpe_e4', 'fpe_p1', 'fpe_d1', 'fpe_f1', 'fpe_g1', 'fpe_h1', 'fpe_j1', 'fpe_j2', 'fpe_k1', 'fpe_l1', 'population', 'population_2025', 'sig_village', 'sig_etablissement', 'screening_categorized', 'screening_commentaires', 'cepe', 'v_cepe_2025', 'tdb_mada', 'tdb_dren', 'tdb_cisco', 'tdb_zap', 'tdb_ecole'];
        if (!allowedTables.includes(targetTable)) {
          await client.end();
          return new Response(JSON.stringify({ success: false, error: `Table '${tableName}' non autorisée pour l'import` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Filter columns: only keep columns that actually exist in the target table
        // (the view may expose computed columns that don't exist in the source table)
        const targetColsRes = await client.queryObject(
          `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${targetTable.replace(/'/g, "''")}'`
        );
        const targetColsSet = new Set((targetColsRes.rows as any[]).map(r => r.column_name));
        const keepIdx: number[] = [];
        const keepCols: string[] = [];
        const ignoredCols: string[] = [];
        columns.forEach((c: string, i: number) => {
          if (targetColsSet.has(c)) { keepIdx.push(i); keepCols.push(c); }
          else ignoredCols.push(c);
        });
        if (keepCols.length === 0) {
          await client.end();
          return new Response(JSON.stringify({
            success: false,
            error: `Aucune colonne du fichier ne correspond aux colonnes de la table cible '${targetTable}'.`,
            ignoredColumns: ignoredCols,
            targetTable,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        let inserted = 0;
        const errors: string[] = [];
        const colList = keepCols.map((c: string) => `"${c}"`).join(', ');

        for (let i = 0; i < dataRows.length; i++) {
          try {
            const row = dataRows[i];
            const vals = keepIdx.map((idx) => {
              const v = row[idx];
              if (v === null || v === undefined || v === '') return 'NULL';
              if (typeof v === 'number') return v;
              const s = String(v).trim();
              // numeric auto-detect
              if (/^-?\d+(\.\d+)?$/.test(s)) return s;
              return `'${s.replace(/'/g, "''")}'`;
            }).join(', ');
            await client.queryObject(`INSERT INTO ${targetTable} (${colList}) VALUES (${vals})`);
            inserted++;
          } catch (e: any) {
            if (errors.length < 5) errors.push(`Ligne ${i+1}: ${e.message}`);
          }
        }
        await client.end();
        return new Response(JSON.stringify({
          success: true,
          inserted,
          total: dataRows.length,
          errors,
          targetTable,
          ignoredColumns: ignoredCols,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ============ Admin: Get table list ============
      case "getTableList": {
        const body = await req.json();
        const { adminUsername } = body;
        const adminCheck6 = await client.queryObject(`SELECT is_superuser FROM login_customuser WHERE username = '${(adminUsername||'').replace(/'/g, "''")}'`);
        if (adminCheck6.rows.length === 0 || !(adminCheck6.rows[0] as any).is_superuser) {
          await client.end();
          return new Response(JSON.stringify({ success: false, error: "Accès refusé" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 });
        }
        const tables = await client.queryObject(`SELECT table_name, pg_total_relation_size(quote_ident(table_name))::bigint as size_bytes FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`);
        await client.end();
        return new Response(JSON.stringify({ success: true, tables: serializeData(tables.rows) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ============ Admin: Get table columns ============
      case "getTableColumns": {
        const body = await req.json();
        const { adminUsername, tableName } = body;
        const adminCheck7 = await client.queryObject(`SELECT is_superuser FROM login_customuser WHERE username = '${(adminUsername||'').replace(/'/g, "''")}'`);
        if (adminCheck7.rows.length === 0 || !(adminCheck7.rows[0] as any).is_superuser) {
          await client.end();
          return new Response(JSON.stringify({ success: false, error: "Accès refusé" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 });
        }
        // tdb_* tables live in Supabase, not Django DB → use SUPABASE_DB_URL
        // (examen_cepe_candidates is in Django, handled by the default branch below)
        const supabaseTablesC = ['tdb_ecole', 'tdb_zap', 'tdb_cisco', 'tdb_dren', 'tdb_mada', 'tdb_ref', 'app_settings'];
        if (supabaseTablesC.includes(tableName)) {
          await client.end();
          const sbUrl = Deno.env.get("SUPABASE_DB_URL");
          if (!sbUrl) return new Response(JSON.stringify({ success: false, error: "SUPABASE_DB_URL non configuré" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          const sb = new Client(sbUrl);
          await sb.connect();
          const cols2 = await sb.queryObject(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [tableName]);
          await sb.end();
          return new Response(JSON.stringify({ success: true, columns: cols2.rows }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const cols = await client.queryObject(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${(tableName||'').replace(/'/g, "''")}' ORDER BY ordinal_position`);
        await client.end();
        return new Response(JSON.stringify({ success: true, columns: cols.rows }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ============ Admin: CRUD on tdb_* tables (via Supabase REST with service role) ============
      case "crudTdb": {
        const body = await req.json();
        const { adminUsername, op, table, id: rowId, data: rowData } = body;
        const adminCheckTdb = await client.queryObject(`SELECT is_superuser FROM login_customuser WHERE username = '${(adminUsername||'').replace(/'/g, "''")}'`);
        if (adminCheckTdb.rows.length === 0 || !(adminCheckTdb.rows[0] as any).is_superuser) {
          await client.end();
          return new Response(JSON.stringify({ success: false, error: "Accès refusé" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 });
        }
        await client.end();
        const allowedTdb = ['tdb_mada', 'tdb_dren', 'tdb_cisco', 'tdb_zap', 'tdb_ecole'];
        if (!allowedTdb.includes(table)) {
          return new Response(JSON.stringify({ success: false, error: `Table '${table}' non autorisée` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const supaUrl2 = Deno.env.get("SUPABASE_URL")!;
        const supaKey2 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const baseUrl = `${supaUrl2}/rest/v1/${table}`;
        const baseHeaders: Record<string, string> = {
          apikey: supaKey2,
          Authorization: `Bearer ${supaKey2}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        };
        try {
          if (op === "list") {
            const limit = parseInt(url.searchParams.get("limit") || "200");
            const offset = parseInt(url.searchParams.get("offset") || "0");
            const r = await fetch(`${baseUrl}?order=id.asc&limit=${limit}&offset=${offset}`, { headers: baseHeaders });
            const d = await r.json();
            return new Response(JSON.stringify({ success: true, data: d }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          if (op === "delete") {
            const r = await fetch(`${baseUrl}?id=eq.${rowId}`, { method: "DELETE", headers: baseHeaders });
            if (!r.ok) {
              const txt = await r.text();
              return new Response(JSON.stringify({ success: false, error: txt }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          if (op === "update") {
            const r = await fetch(`${baseUrl}?id=eq.${rowId}`, { method: "PATCH", headers: baseHeaders, body: JSON.stringify(rowData) });
            const d = await r.json();
            if (!r.ok) return new Response(JSON.stringify({ success: false, error: JSON.stringify(d) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            return new Response(JSON.stringify({ success: true, data: d }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          if (op === "insert") {
            const r = await fetch(baseUrl, { method: "POST", headers: baseHeaders, body: JSON.stringify(rowData) });
            const d = await r.json();
            if (!r.ok) return new Response(JSON.stringify({ success: false, error: JSON.stringify(d) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            return new Response(JSON.stringify({ success: true, data: d }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          if (op === "truncate") {
            const r = await fetch(`${baseUrl}?id=gt.0`, { method: "DELETE", headers: baseHeaders });
            if (!r.ok) {
              const txt = await r.text();
              return new Response(JSON.stringify({ success: false, error: txt }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          return new Response(JSON.stringify({ success: false, error: `Opération '${op}' inconnue` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } catch (e: any) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      // ============ TDB Pre-calculated data (from Supabase tdb_* tables) ============
      case "getTdbMada":
      case "getTdbDren":
      case "getTdbCisco":
      case "getTdbZap":
      case "getTdbEcole": {
        await client.end();
        const supaUrl = Deno.env.get("SUPABASE_URL")!;
        const supaKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const tableMap: Record<string, string> = {
          getTdbMada: 'tdb_mada',
          getTdbDren: 'tdb_dren',
          getTdbCisco: 'tdb_cisco',
          getTdbZap: 'tdb_zap',
          getTdbEcole: 'tdb_ecole',
        };
        const tbl = tableMap[action];
        const filters: string[] = [];
        if (codeDren > 0 && (action === 'getTdbDren' || action === 'getTdbCisco' || action === 'getTdbZap' || action === 'getTdbEcole')) {
          filters.push(`CODE_DREN=eq.${codeDren}`);
        }
        if (codeCisco > 0 && (action === 'getTdbCisco' || action === 'getTdbZap' || action === 'getTdbEcole')) {
          filters.push(`CODE_CISCO=eq.${codeCisco}`);
        }
        if (codeZap > 0 && (action === 'getTdbZap' || action === 'getTdbEcole')) {
          filters.push(`CODE_ZAP=eq.${codeZap}`);
        }
        const codeEtabParam = url.searchParams.get('code_etab');
        if (codeEtabParam && action === 'getTdbEcole') {
          filters.push(`CODE_ETAB=eq.${parseInt(codeEtabParam)}`);
        }
        const qs = filters.length ? `?${filters.join('&')}` : '';
        const tdbRes = await fetch(`${supaUrl}/rest/v1/${tbl}${qs}`, {
          headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}` },
        });
        const tdbData = await tdbRes.json();
        return new Response(JSON.stringify({ success: true, data: tdbData, version: VERSION }), {
          headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
        });
      }

      // ============ TDB Snapshot (latest imported row, flattened from data jsonb) ============
      case "getTdbMadaSnapshot":
      case "getTdbDrenSnapshot":
      case "getTdbCiscoSnapshot":
      case "getTdbZapSnapshot":
      case "getTdbEcoleSnapshot": {
        await client.end();
        const sbUrl = Deno.env.get("SUPABASE_DB_URL");
        if (!sbUrl) {
          return new Response(JSON.stringify({ success: false, error: "SUPABASE_DB_URL non configuré" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const tableMap: Record<string, string> = {
          getTdbMadaSnapshot: 'tdb_mada',
          getTdbDrenSnapshot: 'tdb_dren',
          getTdbCiscoSnapshot: 'tdb_cisco',
          getTdbZapSnapshot: 'tdb_zap',
          getTdbEcoleSnapshot: 'tdb_ecole',
        };
        const tbl = tableMap[action];
        const codeEtab = parseInt(url.searchParams.get('code_etab') || '0');
        const conds: string[] = [];
        const params: any[] = [];
        const addCond = (col: string, val: number) => {
          if (val > 0) { params.push(val); conds.push(`"${col}" = $${params.length}`); }
        };
        if (tbl === 'tdb_dren' || tbl === 'tdb_cisco' || tbl === 'tdb_zap' || tbl === 'tdb_ecole') addCond('CODE_DREN', codeDren);
        if (tbl === 'tdb_cisco' || tbl === 'tdb_zap' || tbl === 'tdb_ecole') addCond('CODE_CISCO', codeCisco);
        if (tbl === 'tdb_zap' || tbl === 'tdb_ecole') addCond('CODE_ZAP', codeZap);
        if (tbl === 'tdb_ecole') addCond('CODE_ETAB', codeEtab);
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
        const sb = new Client(sbUrl); await sb.connect();
        try {
          const r = await sb.queryObject(
            `SELECT * FROM ${tbl} ${where} ORDER BY imported_at DESC, id DESC LIMIT 1`,
            params,
          );
          await sb.end();
          if (r.rows.length === 0) {
            return new Response(JSON.stringify({ success: true, found: false, data: null, version: VERSION }), { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=120" } });
          }
          const row: any = r.rows[0];
          const data = (row.data && typeof row.data === 'object') ? row.data : {};
          // Flatten: structural cols + every key of data jsonb
          const flat: Record<string, any> = { ...data };
          for (const k of Object.keys(row)) {
            if (k === 'data' || k === 'id') continue;
            if (flat[k] === undefined || flat[k] === null) flat[k] = row[k];
          }
          return new Response(JSON.stringify({ success: true, found: true, data: flat, imported_at: row.imported_at, version: VERSION }), { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=120" } });
        } catch (e: any) {
          try { await sb.end(); } catch (_) {}
          return new Response(JSON.stringify({ success: false, error: e.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      // ============ Batch action - multiple queries in one connection ============
      case "batch": {
        const body = await req.json();
        const actions: Array<{ key: string; action: string; params?: Record<string, any> }> = body.actions || [];
        const batchResults: Record<string, any> = {};
        
        for (const item of actions) {
          try {
            const { key, action: batchAction, params: p } = item;
            const bDren = parseInt(p?.code_dren || "0");
            const bCisco = parseInt(p?.code_cisco || "0");
            const bSecteur = parseInt(p?.secteur || "2");
            
            let bResult: any;
            switch (batchAction) {
              case "getLayerEtabN0": bResult = await executeLayerEtab(client, bDren, bCisco, 'v_fiche_ecole_n0'); break;
              case "getLayerEtabN1": bResult = await executeLayerEtab(client, bDren, bCisco, 'v_fiche_ecole_n1'); break;
              case "getLayerEtabN2": bResult = await executeLayerEtab(client, bDren, bCisco, 'v_fiche_ecole_n2'); break;
              case "getLayerEtabN3": bResult = await executeLayerEtab(client, bDren, bCisco, 'v_fiche_ecole_n3'); break;
              case "getLayerBesoinsN1": {
                const w = bDren > 0 && bCisco === 0 ? `WHERE "CODE_DREN" = ${bDren}` : `WHERE "CODE_CISCO" = ${bCisco}`;
                bResult = await client.queryObject(`SELECT * FROM v_layer_besoins_n1 ${w}`); break;
              }
              case "getLayerBesoinsN2": {
                const w = bDren > 0 && bCisco === 0 ? `WHERE "CODE_DREN" = ${bDren}` : `WHERE "CODE_CISCO" = ${bCisco}`;
                bResult = await client.queryObject(`SELECT * FROM v_layer_besoins_n2 ${w}`); break;
              }
              case "getLayerBesoinsN3": {
                const w = bDren > 0 && bCisco === 0 ? `WHERE "CODE_DREN" = ${bDren}` : `WHERE "CODE_CISCO" = ${bCisco}`;
                bResult = await client.queryObject(`SELECT * FROM v_layer_besoins_n3 ${w}`); break;
              }
              case "getLayerN2": {
                const w = bDren > 0 && bCisco === 0 ? `WHERE "CODE_DREN" = ${bDren}` : `WHERE "CODE_CISCO" = ${bCisco}`;
                bResult = await client.queryObject(`SELECT * FROM v_layer_n2 ${w}`); break;
              }
              case "getLayerN3": {
                const w = bDren > 0 && bCisco === 0 ? `WHERE "CODE_DREN" = ${bDren}` : `WHERE "CODE_CISCO" = ${bCisco}`;
                bResult = await client.queryObject(`SELECT * FROM v_layer_n3 ${w}`); break;
              }
              case "getLayerDren": {
                bResult = await client.queryObject(`SELECT json_build_object('type','FeatureCollection','features',json_agg(json_build_object('type','Feature','properties',json_build_object('name',r."REGION_NAM",'code',r."CODE_DREN"),'geometry',ST_AsGeoJSON(ST_SimplifyPreserveTopology(r.geom, 0.001))::json))) AS shape FROM shape_dren r WHERE CAST(r."CODE_DREN" AS INTEGER) = ${bDren}`);
                break;
              }
              case "getLayerCisco": {
                const ciscoW = bCisco === 0 ? `WHERE CAST(r."CODE_DREN" AS INTEGER) = ${bDren}` : `WHERE CAST(r."CODE_CISCO" AS INTEGER) = ${bCisco}`;
                bResult = await client.queryObject(`SELECT json_build_object('type','FeatureCollection','features',json_agg(json_build_object('type','Feature','properties',json_build_object('name',r.cisco,'code',r."CODE_CISCO"),'geometry',ST_AsGeoJSON(ST_SimplifyPreserveTopology(r.geom, 0.001))::json))) AS shape FROM shape_cisco r ${ciscoW}`);
                break;
              }
              case "getLayerCommune": {
                const communeW = bCisco === 0 ? `WHERE CAST(r.code_dren AS INTEGER) = ${bDren}` : `WHERE CAST(r.code_cisco AS INTEGER) = ${bCisco}`;
                bResult = await client.queryObject(`SELECT json_build_object('type','FeatureCollection','features',json_agg(json_build_object('type','Feature','properties',json_build_object('name',r.commune_na,'code',r.code_commune),'geometry',ST_AsGeoJSON(ST_SimplifyPreserveTopology(r.geom, 0.001))::json))) AS shape FROM shape_commune r ${communeW}`);
                break;
              }
              case "getLayerFokontany": {
                const fktW = bCisco === 0 ? `WHERE CAST(r.dren AS INTEGER) = ${bDren}` : `WHERE CAST(r.cisco AS INTEGER) = ${bCisco}`;
                bResult = await client.queryObject(`SELECT json_build_object('type','FeatureCollection','features',json_agg(json_build_object('type','Feature','properties',json_build_object('name',r."FOKONTANY_",'code_dren',r.dren,'code_cisco',r.cisco),'geometry',ST_AsGeoJSON(ST_SimplifyPreserveTopology(r.geom, 0.001))::json))) AS shape FROM shape_fokontany r ${fktW}`);
                break;
              }
              case "getVillages": {
                const vW = bDren > 0 && bCisco === 0 ? `WHERE dren = ${bDren}` : `WHERE cisco = ${bCisco}`;
                bResult = await client.queryObject(`SELECT name, dren as code_dren, cisco as code_cisco, population, longitude, latitude FROM sig_village ${vW} ORDER BY name`);
                break;
              }
              case "getSigVillages": {
                const q = `SELECT id, name, dren as code_dren, cisco as code_cisco, longitude, latitude, population, is_airtel, is_orange, is_telma, is_elec, is_eau FROM sig_village ${bDren > 0 && bCisco === 0 ? `WHERE dren = ${bDren}` : bCisco > 0 ? `WHERE cisco = ${bCisco}` : 'WHERE dren > 0'} ORDER BY name`;
                bResult = await client.queryObject(q);
                break;
              }
              case "getSigLayerDren": {
                bResult = await client.queryObject(`SELECT json_build_object('type','FeatureCollection','features',json_agg(json_build_object('type','Feature','properties',json_build_object('name',r."REGION_NAM",'code',r."CODE_DREN"),'geometry',ST_AsGeoJSON(ST_SimplifyPreserveTopology(r.geom, 0.001))::json))) AS shape FROM shape_dren r WHERE CAST(r."CODE_DREN" AS INTEGER) = ${bDren}`);
                break;
              }
              case "getSigLayerCisco": {
                const ciscoWhere = bCisco === 0 ? `WHERE CAST(r."CODE_DREN" AS INTEGER) = ${bDren}` : `WHERE CAST(r."CODE_CISCO" AS INTEGER) = ${bCisco}`;
                bResult = await client.queryObject(`SELECT json_build_object('type','FeatureCollection','features',json_agg(json_build_object('type','Feature','properties',json_build_object('name',r.cisco,'code',r."CODE_CISCO"),'geometry',ST_AsGeoJSON(ST_SimplifyPreserveTopology(r.geom, 0.001))::json))) AS shape FROM shape_cisco r ${ciscoWhere}`);
                break;
              }
              case "getSigLayerCommune": {
                const communeWhere2 = bCisco === 0 ? `WHERE CAST(r.code_dren AS INTEGER) = ${bDren}` : `WHERE CAST(r.code_cisco AS INTEGER) = ${bCisco}`;
                bResult = await client.queryObject(`SELECT json_build_object('type','FeatureCollection','features',json_agg(json_build_object('type','Feature','properties',json_build_object('name',r.commune_na,'code',r.code_commune),'geometry',ST_AsGeoJSON(ST_SimplifyPreserveTopology(r.geom, 0.001))::json))) AS shape FROM shape_commune r ${communeWhere2}`);
                break;
              }
              case "getSigLayerFokontany": {
                const fktWhere = bCisco === 0 ? `WHERE CAST(r.dren AS INTEGER) = ${bDren}` : `WHERE CAST(r.cisco AS INTEGER) = ${bCisco}`;
                bResult = await client.queryObject(`SELECT json_build_object('type','FeatureCollection','features',json_agg(json_build_object('type','Feature','properties',json_build_object('name',r."FOKONTANY_",'code_dren',r.dren,'code_cisco',r.cisco),'geometry',ST_AsGeoJSON(ST_SimplifyPreserveTopology(r.geom, 0.001))::json))) AS shape FROM shape_fokontany r ${fktWhere}`);
                break;
              }
              default:
                batchResults[key] = { error: `Unknown batch action: ${batchAction}` };
                continue;
            }
            batchResults[key] = serializeData(bResult.rows);
          } catch (batchErr: any) {
            batchResults[item.key] = { error: batchErr.message };
          }
        }
        
        await client.end();
        return new Response(JSON.stringify(batchResults), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ============ Admin: List CSV import batches (Supabase) ============
      case "listImportBatches": {
        const body = await req.json().catch(() => ({}));
        const { adminUsername } = body;
        const adminCheckLB = await client.queryObject(`SELECT is_superuser FROM login_customuser WHERE username = '${(adminUsername||'').replace(/'/g, "''")}'`);
        if (adminCheckLB.rows.length === 0 || !(adminCheckLB.rows[0] as any).is_superuser) {
          await client.end();
          return new Response(JSON.stringify({ success: false, error: "Accès refusé" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 });
        }
        await client.end();
        const sbUrl = Deno.env.get("SUPABASE_DB_URL");
        const sb = new Client(sbUrl!); await sb.connect();
        try {
          const r = await sb.queryObject(
            `SELECT id, table_name, file_name, row_count, imported_by, status, batch_ts_start, batch_ts_end, created_at, notes
             FROM tdb_import_batches WHERE status = 'completed' ORDER BY created_at DESC LIMIT 200`
          );
          await sb.end();
          return new Response(JSON.stringify({ success: true, batches: r.rows }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } catch (e: any) {
          try { await sb.end(); } catch (_) {}
          return new Response(JSON.stringify({ success: false, error: e.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      // ============ Admin: Preview rows of an import batch (Supabase) ============
      case "getImportBatchRows": {
        const body = await req.json();
        const { adminUsername, batchId, limit = 100, offset = 0 } = body;
        const adminCheckGR = await client.queryObject(`SELECT is_superuser FROM login_customuser WHERE username = '${(adminUsername||'').replace(/'/g, "''")}'`);
        if (adminCheckGR.rows.length === 0 || !(adminCheckGR.rows[0] as any).is_superuser) {
          await client.end();
          return new Response(JSON.stringify({ success: false, error: "Accès refusé" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 });
        }
        await client.end();
        const allowedTablesGR = new Set(['tdb_ecole','tdb_zap','tdb_cisco','tdb_dren','tdb_mada','tdb_ref','examen_cepe_candidates','examen_bepc_candidates']);
        const sbUrl = Deno.env.get("SUPABASE_DB_URL");
        const sb = new Client(sbUrl!); await sb.connect();
        try {
          const b = await sb.queryObject<{ table_name: string; batch_ts_start: string; batch_ts_end: string }>(
            `SELECT table_name, batch_ts_start::text AS batch_ts_start, batch_ts_end::text AS batch_ts_end FROM tdb_import_batches WHERE id = $1`,
            [batchId],
          );
          if (b.rows.length === 0) {
            await sb.end();
            return new Response(JSON.stringify({ success: false, error: "Batch introuvable" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          const { table_name, batch_ts_start, batch_ts_end } = b.rows[0] as any;
          if (!allowedTablesGR.has(table_name)) {
            await sb.end();
            return new Response(JSON.stringify({ success: false, error: `Table '${table_name}' non supportée` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          const safeLimit = Math.min(Math.max(parseInt(String(limit)) || 100, 1), 500);
          const safeOffset = Math.max(parseInt(String(offset)) || 0, 0);
          // Exam tables live in the Django DB, not Supabase
          const isExamTbl = table_name === 'examen_cepe_candidates' || table_name === 'examen_bepc_candidates';
          const dbc = isExamTbl ? new Client(dbConfig) : sb;
          if (isExamTbl) { await sb.end(); await dbc.connect(); }
          try {
            const cnt = await dbc.queryObject<{ c: number }>(
              `SELECT COUNT(*)::int AS c FROM public.${table_name} WHERE imported_at BETWEEN $1::timestamptz AND $2::timestamptz`,
              [batch_ts_start, batch_ts_end],
            );
            const rows = await dbc.queryObject(
              `SELECT * FROM public.${table_name} WHERE imported_at BETWEEN $1::timestamptz AND $2::timestamptz ORDER BY id LIMIT ${safeLimit} OFFSET ${safeOffset}`,
              [batch_ts_start, batch_ts_end],
            );
            await dbc.end();
            const safeRows = (rows.rows as any[]).map(r => {
              const o: any = {};
              for (const k of Object.keys(r)) {
                const v = (r as any)[k];
                o[k] = typeof v === "bigint" ? Number(v) : v;
              }
              return o;
            });
            return new Response(JSON.stringify({
              success: true,
              table: table_name,
              total: (cnt.rows[0] as any)?.c ?? 0,
              limit: safeLimit,
              offset: safeOffset,
              rows: safeRows,
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          } catch (e: any) {
            try { await dbc.end(); } catch (_) {}
            return new Response(JSON.stringify({ success: false, error: e.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        } catch (e: any) {
          try { await sb.end(); } catch (_) {}
          return new Response(JSON.stringify({ success: false, error: e.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      // ============ Admin: Undo a CSV import batch ============
      case "deleteImportBatch": {
        const body = await req.json();
        const { adminUsername, batchId } = body;
        const adminCheckDB = await client.queryObject(`SELECT is_superuser FROM login_customuser WHERE username = '${(adminUsername||'').replace(/'/g, "''")}'`);
        if (adminCheckDB.rows.length === 0 || !(adminCheckDB.rows[0] as any).is_superuser) {
          await client.end();
          return new Response(JSON.stringify({ success: false, error: "Accès refusé" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 });
        }
        await client.end();
        const allowedTables = new Set(['tdb_ecole','tdb_zap','tdb_cisco','tdb_dren','tdb_mada','tdb_ref','app_settings','examen_cepe_candidates','examen_bepc_candidates']);
        const sbUrl = Deno.env.get("SUPABASE_DB_URL");
        const sb = new Client(sbUrl!); await sb.connect();
        try {
          const b = await sb.queryObject<{ table_name: string; batch_ts_start: string; batch_ts_end: string }>(
            `SELECT table_name, batch_ts_start::text AS batch_ts_start, batch_ts_end::text AS batch_ts_end FROM tdb_import_batches WHERE id = $1`,
            [batchId],
          );
          if (b.rows.length === 0) {
            await sb.end();
            return new Response(JSON.stringify({ success: false, error: "Batch introuvable" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          const { table_name, batch_ts_start, batch_ts_end } = b.rows[0] as any;
          if (!allowedTables.has(table_name)) {
            await sb.end();
            return new Response(JSON.stringify({ success: false, error: `Table '${table_name}' non supportée pour l'annulation` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          // Exam tables live in the Django DB
          const isExamTbl = table_name === 'examen_cepe_candidates' || table_name === 'examen_bepc_candidates';
          let deletedCount = 0;
          if (isExamTbl) {
            const dbc = new Client(dbConfig);
            await dbc.connect();
            try {
              const del = await dbc.queryObject(
                `DELETE FROM public.${table_name} WHERE imported_at BETWEEN $1::timestamptz AND $2::timestamptz`,
                [batch_ts_start, batch_ts_end],
              );
              deletedCount = (del as any).rowCount ?? 0;
            } finally { try { await dbc.end(); } catch(_) {} }
          } else {
            const del = await sb.queryObject(
              `DELETE FROM ${table_name} WHERE imported_at BETWEEN $1::timestamptz AND $2::timestamptz`,
              [batch_ts_start, batch_ts_end],
            );
            deletedCount = (del as any).rowCount ?? 0;
          }
          await sb.queryObject(
            `UPDATE tdb_import_batches SET status = 'reverted', notes = COALESCE(notes,'') || ' | reverted at ' || now() WHERE id = $1`,
            [batchId],
          );
          await sb.end();
          return new Response(JSON.stringify({ success: true, deleted: deletedCount, table: table_name }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } catch (e: any) {
          try { await sb.end(); } catch (_) {}
          return new Response(JSON.stringify({ success: false, error: e.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      // ============ Admin: Generic CRUD on whitelisted PostgreSQL tables ============
      case "crudAny": {
        const body = await req.json();
        const { adminUsername, op, table, id: rowId, idColumn, data: rowData, search, limit, offset, orderBy, orderDir } = body;
        const adminCheckAny = await client.queryObject(`SELECT is_superuser FROM login_customuser WHERE username = '${(adminUsername||'').replace(/'/g, "''")}'`);
        if (adminCheckAny.rows.length === 0 || !(adminCheckAny.rows[0] as any).is_superuser) {
          await client.end();
          return new Response(JSON.stringify({ success: false, error: "Accès refusé" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 });
        }

        // Whitelist of editable tables (Postgres source of truth)
        const allowedAny = [
          'tdb_mada','tdb_dren','tdb_cisco','tdb_zap','tdb_ecole',
          'fpe_a1','fpe_e1','fpe_e4','fpe_p1','fpe_d1','fpe_f1','fpe_g1','fpe_h1','fpe_j1','fpe_j2','fpe_k1','fpe_l1',
          'besoins_primaire','besoins_college','besoins_lycee',
          'population','population_2025','caisse_ecole','examen_cepe_old',
          'sig_village','sig_etablissement',
          'screening_categorized','screening_commentaires',
          'cepe','login_customuser'
        ];
        if (!allowedAny.includes(table)) {
          await client.end();
          return new Response(JSON.stringify({ success: false, error: `Table '${table}' non autorisée` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Resolve PK column (default id), validate it exists
        const colRes = await client.queryObject(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='${table}' ORDER BY ordinal_position`);
        const colNames = (colRes.rows as any[]).map(c => c.column_name);
        if (colNames.length === 0) {
          await client.end();
          return new Response(JSON.stringify({ success: false, error: `Table '${table}' introuvable` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const pk = idColumn && colNames.includes(idColumn) ? idColumn : (colNames.includes('id') ? 'id' : colNames[0]);
        const escVal = (v: any): string => {
          if (v === null || v === undefined || v === '') return 'NULL';
          if (typeof v === 'number') return String(v);
          if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
          return `'${String(v).replace(/'/g, "''")}'`;
        };

        try {
          if (op === 'columns') {
            await client.end();
            return new Response(JSON.stringify({ success: true, columns: colRes.rows, pk }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          if (op === 'count') {
            const r = await client.queryObject(`SELECT COUNT(*)::bigint AS n FROM "${table}"`);
            await client.end();
            return new Response(JSON.stringify({ success: true, count: Number((r.rows[0] as any).n) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          if (op === 'list') {
            const lim = Math.min(parseInt(String(limit || 50)), 500);
            const off = Math.max(parseInt(String(offset || 0)), 0);
            const ob = orderBy && colNames.includes(orderBy) ? orderBy : pk;
            const od = String(orderDir || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
            let where = '';
            if (search && String(search).trim().length > 0) {
              const s = String(search).replace(/'/g, "''");
              const textCols = (colRes.rows as any[]).filter(c => /char|text/i.test(c.data_type)).map(c => `"${c.column_name}"::text ILIKE '%${s}%'`);
              if (textCols.length > 0) where = `WHERE ${textCols.join(' OR ')}`;
            }
            const total = await client.queryObject(`SELECT COUNT(*)::bigint AS n FROM "${table}" ${where}`);
            const data = await client.queryObject(`SELECT * FROM "${table}" ${where} ORDER BY "${ob}" ${od} LIMIT ${lim} OFFSET ${off}`);
            await client.end();
            return new Response(JSON.stringify({ success: true, data: serializeData(data.rows), total: Number((total.rows[0] as any).n), pk, columns: colRes.rows }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          if (op === 'insert') {
            const entries = Object.entries(rowData || {}).filter(([k]) => colNames.includes(k));
            if (entries.length === 0) { await client.end(); return new Response(JSON.stringify({ success: false, error: 'Aucun champ valide' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
            const cols = entries.map(([k]) => `"${k}"`).join(', ');
            const vals = entries.map(([, v]) => escVal(v)).join(', ');
            const r = await client.queryObject(`INSERT INTO "${table}" (${cols}) VALUES (${vals}) RETURNING *`);
            await client.end();
            return new Response(JSON.stringify({ success: true, data: serializeData(r.rows[0]) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          if (op === 'update') {
            const entries = Object.entries(rowData || {}).filter(([k]) => colNames.includes(k) && k !== pk);
            if (entries.length === 0) { await client.end(); return new Response(JSON.stringify({ success: false, error: 'Aucun champ à modifier' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
            const setSql = entries.map(([k, v]) => `"${k}" = ${escVal(v)}`).join(', ');
            const r = await client.queryObject(`UPDATE "${table}" SET ${setSql} WHERE "${pk}" = ${escVal(rowId)} RETURNING *`);
            await client.end();
            return new Response(JSON.stringify({ success: true, data: serializeData(r.rows[0]) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          if (op === 'delete') {
            await client.queryObject(`DELETE FROM "${table}" WHERE "${pk}" = ${escVal(rowId)}`);
            await client.end();
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          if (op === 'truncate') {
            await client.queryObject(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);
            await client.end();
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          await client.end();
          return new Response(JSON.stringify({ success: false, error: `Opération '${op}' inconnue` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } catch (e: any) {
          try { await client.end(); } catch { /* ignore */ }
          return new Response(JSON.stringify({ success: false, error: e.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      default:
        await client.end();
        return new Response(
          JSON.stringify({ error: "Unknown action", requested: action, version: VERSION }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    await client.end();
    // Add cache headers for GeoJSON layer actions (heavy data)
    const isLayerAction = action.startsWith('getLayer') || action.startsWith('getDataviz') || action.startsWith('getSig') || action === 'getVillages';
    const cacheControl = isLayerAction ? "public, max-age=300" : "no-cache";
    return new Response(
      JSON.stringify(serializeData(result.rows)),
      { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": cacheControl } }
    );
  } catch (error: any) {
    console.error("Database error:", error);
    try { await client.end(); } catch (_e) { /* ignore */ }
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage, version: VERSION }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============ Stats functions ============

// Helper: get available years from DB
async function getAvailableYearsFromDB(client: Client): Promise<number[]> {
  const result = await client.queryObject<{annee: number}>(`SELECT DISTINCT "ANNEE_SCOLAIRE" AS annee FROM fpe_a1 WHERE "ANNEE_SCOLAIRE" > 2000 ORDER BY "ANNEE_SCOLAIRE" ASC`);
  return result.rows.map((r: any) => Number(r.annee)).filter((y: number) => !isNaN(y));
}

async function executeStatsEtablissements(client: Client, codeDren: number, codeCisco: number, secteur: number) {
  const sect = secteur > 1 ? ">= 0" : `= ${secteur}`;
  let selectPrefix = "", whereClause = "", groupBy = "";
  if (codeDren > 0 && codeCisco === 0) {
    selectPrefix = 'a1."CODE_DREN",'; whereClause = `AND a1."CODE_DREN" = ${codeDren}`; groupBy = 'GROUP BY a1."CODE_DREN"';
  } else if (codeCisco > 0) {
    selectPrefix = 'a1."CODE_CISCO",'; whereClause = `AND a1."CODE_CISCO" = ${codeCisco}`; groupBy = 'GROUP BY a1."CODE_CISCO"';
  }
  
  const years = await getAvailableYearsFromDB(client);
  const yearCols = years.map(y => `
    SUM(CASE WHEN a1."EXISTE_PRESCO"=1 AND a1."ANNEE_SCOLAIRE" = ${y} THEN 1 ELSE 0 END) AS "N0_${y}",
    SUM(CASE WHEN a1."EXISTE_PRIMAIRE"=1 AND a1."ANNEE_SCOLAIRE" = ${y} THEN 1 ELSE 0 END) AS "N1_${y}",
    SUM(CASE WHEN a1."EXISTE_COLLEGE"=1 AND a1."ANNEE_SCOLAIRE" = ${y} THEN 1 ELSE 0 END) AS "N2_${y}",
    SUM(CASE WHEN a1."EXISTE_LYCEE"=1 AND a1."ANNEE_SCOLAIRE" = ${y} THEN 1 ELSE 0 END) AS "N3_${y}"`
  ).join(',');

  const query = `
    SELECT ${selectPrefix} ${yearCols}
    FROM fpe_a1 a1 WHERE a1."SECTEUR" ${sect} ${whereClause} ${groupBy}
  `;
  return await client.queryObject(query);
}

async function executeStatsElevesN0N1(client: Client, codeDren: number, codeCisco: number, secteur: number) {
  const sect = secteur > 1 ? ">= 0" : `= ${secteur}`;
  let selectPrefix = "", whereClause = "", groupBy = "";
  if (codeDren > 0 && codeCisco === 0) {
    selectPrefix = 'eff."CODE_DREN",'; whereClause = `AND eff."CODE_DREN" = ${codeDren}`; groupBy = 'GROUP BY eff."CODE_DREN"';
  } else if (codeCisco > 0) {
    selectPrefix = 'eff."CODE_CISCO",'; whereClause = `AND eff."CODE_CISCO" = ${codeCisco}`; groupBy = 'GROUP BY eff."CODE_CISCO"';
  }
  
  const years = await getAvailableYearsFromDB(client);
  const yearCols = years.map(y => `
    SUM(CASE WHEN ${si('eff."EXISTE_PRESCO"')} = 1 AND eff."ANNEE_SCOLAIRE" = ${y} THEN (
      ${si('eff."PS_G"')}+${si('eff."PS_F"')}+
      ${si('eff."MS_G"')}+${si('eff."MS_F"')}+
      ${si('eff."GS_G"')}+${si('eff."GS_F"')}
    ) ELSE 0 END) AS "N0_${y}",
    SUM(CASE WHEN ${si('eff."EXISTE_PRIMAIRE"')} = 1 AND eff."ANNEE_SCOLAIRE" = ${y} THEN (
      ${si('eff."T1_F"')}+${si('eff."T1_G"')}+
      ${si('eff."T2_F"')}+${si('eff."T2_G"')}+
      ${si('eff."T3_F"')}+${si('eff."T3_G"')}+
      ${si('eff."T4_F"')}+${si('eff."T4_G"')}+
      ${si('eff."T5_F"')}+${si('eff."T5_G"')}
    ) ELSE 0 END) AS "N1_${y}"`
  ).join(',');

  const query = `
    SELECT ${selectPrefix} ${yearCols}
    FROM fpe_e1 eff WHERE ${si('eff."SECTEUR"')} ${sect} ${whereClause} ${groupBy}
  `;
  return await client.queryObject(query);
}

async function executeStatsElevesN2N3(client: Client, codeDren: number, codeCisco: number, secteur: number) {
  const sect = secteur > 1 ? ">= 0" : `= ${secteur}`;
  let selectPrefix = "", whereClause = "", groupBy = "";
  if (codeDren > 0 && codeCisco === 0) {
    selectPrefix = 'eff."CODE_DREN",'; whereClause = `AND eff."CODE_DREN" = ${codeDren}`; groupBy = 'GROUP BY eff."CODE_DREN"';
  } else if (codeCisco > 0) {
    selectPrefix = 'eff."CODE_CISCO",'; whereClause = `AND eff."CODE_CISCO" = ${codeCisco}`; groupBy = 'GROUP BY eff."CODE_CISCO"';
  }
  
  const years = await getAvailableYearsFromDB(client);
  const yearCols = years.map(y => `
    SUM(CASE WHEN ${si('eff."EXISTE_COLLEGE"')} = 1 AND eff."ANNEE_SCOLAIRE" = ${y} THEN (
      COALESCE(eff."T6_F",0)+COALESCE(eff."T6_G",0)+
      COALESCE(eff."T7_F",0)+COALESCE(eff."T7_G",0)+
      COALESCE(eff."T8_F",0)+COALESCE(eff."T8_G",0)+
      COALESCE(eff."T9_F",0)+COALESCE(eff."T9_G",0)
    ) ELSE 0 END) AS "N2_${y}",
    SUM(CASE WHEN ${si('eff."EXISTE_LYCEE"')} = 1 AND eff."ANNEE_SCOLAIRE" = ${y} THEN (
      COALESCE(eff."_2NDE_G",0)+COALESCE(eff."_2NDE_F",0)+
      COALESCE(eff."_1A_G",0)+COALESCE(eff."_1A_F",0)+
      COALESCE(eff."_1C_G",0)+COALESCE(eff."_1C_F",0)+
      COALESCE(eff."_1D_G",0)+COALESCE(eff."_1D_F",0)+
      COALESCE(eff."_1L_G",0)+COALESCE(eff."_1L_F",0)+
      COALESCE(eff."_1S_G",0)+COALESCE(eff."_1S_F",0)+
      COALESCE(eff."_1OSE_G",0)+COALESCE(eff."_1OSE_F",0)+
      COALESCE(eff."TA_G",0)+COALESCE(eff."TA_F",0)+
      COALESCE(eff."TC_G",0)+COALESCE(eff."TC_F",0)+
      COALESCE(eff."TD_G",0)+COALESCE(eff."TD_F",0)+
      COALESCE(eff."TL_G",0)+COALESCE(eff."TL_F",0)+
      COALESCE(eff."TS_G",0)+COALESCE(eff."TS_F",0)+
      COALESCE(eff."TOSE_G",0)+COALESCE(eff."TOSE_F",0)
    ) ELSE 0 END) AS "N3_${y}"`
  ).join(',');

  const query = `
    SELECT ${selectPrefix} ${yearCols}
    FROM fpe_e4 eff WHERE ${si('eff."SECTEUR"')} ${sect} ${whereClause} ${groupBy}
  `;
  return await client.queryObject(query);
}

async function executeStatsEnseignants(client: Client, codeDren: number, codeCisco: number, secteur: number) {
  const sect = secteur > 1 ? ">= 0" : `= ${secteur}`;
  let selectPrefix = "", whereClause = "", groupBy = "";
  if (codeDren > 0 && codeCisco === 0) {
    selectPrefix = 'p1."CODE_DREN",'; whereClause = `AND p1."CODE_DREN" = ${codeDren}`; groupBy = 'GROUP BY p1."CODE_DREN"';
  } else if (codeCisco > 0) {
    selectPrefix = 'p1."CODE_CISCO",'; whereClause = `AND p1."CODE_CISCO" = ${codeCisco}`; groupBy = 'GROUP BY p1."CODE_CISCO"';
  }
  
  const years = await getAvailableYearsFromDB(client);
  const yearCols = years.map(y => `
    SUM(CASE WHEN p1."NIVEAU_TENU_PRESCO"='1' AND p1."ANNEE_SCOLAIRE" = ${y} THEN 1 ELSE 0 END) AS "N0_${y}",
    SUM(CASE WHEN p1."NIVEAU_TENU_PRIMAIRE"='1' AND p1."ANNEE_SCOLAIRE" = ${y} THEN 1 ELSE 0 END) AS "N1_${y}",
    SUM(CASE WHEN p1."NIVEAU_TENU_COLLEGE"='1' AND p1."ANNEE_SCOLAIRE" = ${y} THEN 1 ELSE 0 END) AS "N2_${y}",
    SUM(CASE WHEN p1."NIVEAU_TENU_LYCEE"='1' AND p1."ANNEE_SCOLAIRE" = ${y} THEN 1 ELSE 0 END) AS "N3_${y}"`
  ).join(',');

  const query = `
    SELECT ${selectPrefix} ${yearCols}
    FROM fpe_p1 p1 WHERE p1."SECTEUR" ${sect} ${whereClause} ${groupBy}
  `;
  return await client.queryObject(query);
}

async function executeStatsPlaces(client: Client, codeDren: number, codeCisco: number, secteur: number) {
  const years = await getAvailableYearsFromDB(client);
  const latestYear = years.length > 0 ? Math.max(...years) : 2025;
  let whereClause = `WHERE v."ANNEE_SCOLAIRE" = ${latestYear}`;
  if (codeDren > 0 && codeCisco === 0) { whereClause += ` AND v."CODE_DREN" = ${codeDren}`; }
  else if (codeCisco > 0) { whereClause += ` AND v."CODE_CISCO" = ${codeCisco}`; }
  const query = `
    SELECT 
      COALESCE(SUM(v."places_n0"), 0) AS "N0_${latestYear}",
      COALESCE(SUM(v."places_n1"), 0) AS "N1_${latestYear}",
      COALESCE(SUM(v."places_n2"), 0) AS "N2_${latestYear}",
      COALESCE(SUM(v."places_n3"), 0) AS "N3_${latestYear}"
    FROM v_place_assises v ${whereClause}
  `;
  return await client.queryObject(query);
}

// ============ ORS helper functions ============

async function executeLayerEtab(client: Client, codeDren: number, codeCisco: number, tableName: string) {
  const opDren = codeDren === 0 ? ">" : "="; const valDren = codeDren === 0 ? 0 : codeDren;
  const opCisco = codeCisco === 0 ? ">" : "="; const valCisco = codeCisco === 0 ? 0 : codeCisco;
  return await client.queryObject(`SELECT * FROM ${tableName} WHERE "CODE_DREN" ${opDren} ${valDren} AND "CODE_CISCO" ${opCisco} ${valCisco} AND "ANNEE_SCOLAIRE" = 2025 ORDER BY "NOM_ETAB"`);
}

async function executeLayerVillage(client: Client, codeDren: number, codeCisco: number, tableName: string) {
  const opDren = codeDren === 0 ? ">" : "="; const valDren = codeDren === 0 ? 0 : codeDren;
  const opCisco = codeCisco === 0 ? ">" : "="; const valCisco = codeCisco === 0 ? 0 : codeCisco;
  return await client.queryObject(`SELECT * FROM ${tableName} WHERE "CODE_DREN" ${opDren} ${valDren} AND "CODE_CISCO" ${opCisco} ${valCisco} ORDER BY "VILLAGE"`);
}

async function executeVillagesExclus(client: Client, codeDren: number, codeCisco: number, tableName: string) {
  const opDren = codeDren === 0 ? ">" : "="; const valDren = codeDren === 0 ? 0 : codeDren;
  const opCisco = codeCisco === 0 ? ">" : "="; const valCisco = codeCisco === 0 ? 0 : codeCisco;
  return await client.queryObject(`SELECT * FROM ${tableName} WHERE "CODE_DREN" ${opDren} ${valDren} AND "CODE_CISCO" ${opCisco} ${valCisco} ORDER BY "VILLAGE"`);
}

async function executeGetZaps(client: Client, codeDren: number, codeCisco: number, codeCommune: number) {
  const opDren = codeDren === 0 ? ">" : "="; const valDren = codeDren === 0 ? 0 : codeDren;
  const opCisco = codeCisco === 0 ? ">" : "="; const valCisco = codeCisco === 0 ? 0 : codeCisco;
  const opCommune = codeCommune === 0 ? ">" : "="; const valCommune = codeCommune === 0 ? 0 : codeCommune;
  return await client.queryObject(`SELECT * FROM v_zap WHERE "CODE_DREN" ${opDren} ${valDren} AND "CODE_CISCO" ${opCisco} ${valCisco} AND "CODE_COMMUNE" ${opCommune} ${valCommune} ORDER BY "ZAP"`);
}

async function executeGetCommunes(client: Client, codeDren: number, codeCisco: number, codeZap: number) {
  const opDren = codeDren === 0 ? ">" : "="; const valDren = codeDren === 0 ? 0 : codeDren;
  const opCisco = codeCisco === 0 ? ">" : "="; const valCisco = codeCisco === 0 ? 0 : codeCisco;
  const opZap = codeZap === 0 ? ">" : "="; const valZap = codeZap === 0 ? 0 : codeZap;
  return await client.queryObject(`SELECT * FROM v_commune WHERE "CODE_DREN" ${opDren} ${valDren} AND "CODE_CISCO" ${opCisco} ${valCisco} AND "CODE_ZAP" ${opZap} ${valZap} ORDER BY "COMMUNE"`);
}

async function executeGetDataN0(client: Client, codeDren: number, codeCisco: number, codeCommune: number, codeZap: number, secteur: number) {
  const opDren = codeDren === 0 ? ">" : "="; const valDren = codeDren === 0 ? 0 : codeDren;
  const opCisco = codeCisco === 0 ? ">" : "="; const valCisco = codeCisco === 0 ? 0 : codeCisco;
  const opCommune = codeCommune === 0 ? ">" : "="; const valCommune = codeCommune === 0 ? 0 : codeCommune;
  const opZap = codeZap === 0 ? ">" : "="; const valZap = codeZap === 0 ? 0 : codeZap;
  const sect = secteur > 1 ? ">= 0" : `= ${secteur}`;
  const cols = `vf."CODE_ETAB", vf."DREN", vf."CISCO", vf."COMMUNE", vf."ZAP", vf."FOKONTANY",
    vf."NOM_ETAB", vf."CATEGORIE_COMMUNE", vf."CODE_DREN", vf."CODE_CISCO", vf."CODE_COMMUNE", vf."CODE_ZAP",
    vf."SECTEUR", vf."ANNEE_SCOLAIRE", vf.places, vf.sdc_be, vf.sdc_me,
    vf."TYPE_SOURCE_EAU", vf."TYPE_SOURCE_ELECTRICITE",
    vf.eff_2022, vf.eff_2023, vf.eff_2024, vf.eff_2025,
    vf.pers_total, vf.en_classe, vf.fonctionnaire, vf.fram_sub, vf.fram_nonsub,
    vf.bepc, vf.bacc, vf.qualifiee`;
  return await client.queryObject(`
    SELECT ${cols}, v.eff_ps, v.eff_ms, v.eff_gs
    FROM v_fiche_ecole_n0 vf
    INNER JOIN v_effectif_n0 v ON v."CODE_ETAB" = vf."CODE_ETAB" AND v."ANNEE_SCOLAIRE" = vf."ANNEE_SCOLAIRE"
    WHERE vf."CODE_DREN" ${opDren} ${valDren} AND vf."CODE_CISCO" ${opCisco} ${valCisco} 
    AND vf."CODE_COMMUNE" ${opCommune} ${valCommune} AND vf."CODE_ZAP" ${opZap} ${valZap} 
    AND vf."SECTEUR" ${sect} AND vf."ANNEE_SCOLAIRE" = 2025
  `);
}

async function executeGetDataN1(client: Client, codeDren: number, codeCisco: number, codeCommune: number, codeZap: number, secteur: number) {
  const opDren = codeDren === 0 ? ">" : "="; const valDren = codeDren === 0 ? 0 : codeDren;
  const opCisco = codeCisco === 0 ? ">" : "="; const valCisco = codeCisco === 0 ? 0 : codeCisco;
  const opCommune = codeCommune === 0 ? ">" : "="; const valCommune = codeCommune === 0 ? 0 : codeCommune;
  const opZap = codeZap === 0 ? ">" : "="; const valZap = codeZap === 0 ? 0 : codeZap;
  const sect = secteur > 1 ? ">= 0" : `= ${secteur}`;
  const cols = `vf."CODE_ETAB", vf."DREN", vf."CISCO", vf."COMMUNE", vf."ZAP", vf."FOKONTANY",
    vf."NOM_ETAB", vf."CATEGORIE_COMMUNE", vf."CODE_DREN", vf."CODE_CISCO", vf."CODE_COMMUNE", vf."CODE_ZAP",
    vf."SECTEUR", vf."ANNEE_SCOLAIRE", vf.places, vf.sdc_be, vf.sdc_me,
    vf."TYPE_SOURCE_EAU", vf."TYPE_SOURCE_ELECTRICITE",
    vf.eff_2022, vf.eff_2023, vf.eff_2024, vf.eff_2025,
    vf.pers_total, vf.en_classe, vf.fonctionnaire, vf.fram_sub, vf.fram_nonsub,
    vf.bepc, vf.bacc, vf.qualifiee`;
  return await client.queryObject(`
    SELECT ${cols}, v.eff_t1, v.eff_t2, v.eff_t3, v.eff_t4, v.eff_t5
    FROM v_fiche_ecole_n1 vf
    INNER JOIN v_effectif_n1 v ON v."CODE_ETAB" = vf."CODE_ETAB" AND v."ANNEE_SCOLAIRE" = vf."ANNEE_SCOLAIRE"
    WHERE vf."CODE_DREN" ${opDren} ${valDren} AND vf."CODE_CISCO" ${opCisco} ${valCisco} 
    AND vf."CODE_COMMUNE" ${opCommune} ${valCommune} AND vf."CODE_ZAP" ${opZap} ${valZap} 
    AND vf."SECTEUR" ${sect} AND vf."ANNEE_SCOLAIRE" = 2025
  `);
}

async function executeGetDataN2(client: Client, codeDren: number, codeCisco: number, codeCommune: number, codeZap: number, secteur: number) {
  const opDren = codeDren === 0 ? ">" : "="; const valDren = codeDren === 0 ? 0 : codeDren;
  const opCisco = codeCisco === 0 ? ">" : "="; const valCisco = codeCisco === 0 ? 0 : codeCisco;
  const opCommune = codeCommune === 0 ? ">" : "="; const valCommune = codeCommune === 0 ? 0 : codeCommune;
  const opZap = codeZap === 0 ? ">" : "="; const valZap = codeZap === 0 ? 0 : codeZap;
  const sect = secteur > 1 ? ">= 0" : `= ${secteur}`;
  const cols = `vf."CODE_ETAB", vf."DREN", vf."CISCO", vf."COMMUNE", vf."ZAP", vf."FOKONTANY",
    vf."NOM_ETAB", vf."CATEGORIE_COMMUNE", vf."CODE_DREN", vf."CODE_CISCO", vf."CODE_COMMUNE", vf."CODE_ZAP",
    vf."SECTEUR", vf."ANNEE_SCOLAIRE", vf.places, vf.sdc_be, vf.sdc_me,
    vf."TYPE_SOURCE_EAU", vf."TYPE_SOURCE_ELECTRICITE",
    vf.eff_2022, vf.eff_2023, vf.eff_2024, vf.eff_2025,
    vf.pers_total, vf.en_classe, vf.fonctionnaire, vf.fram_sub, vf.fram_nonsub,
    vf.bepc, vf.bacc, vf.qualifiee`;
  return await client.queryObject(`
    SELECT ${cols}, v.eff_t6, v.eff_t7, v.eff_t8, v.eff_t9
    FROM v_fiche_ecole_n2 vf
    INNER JOIN v_effectif_n2 v ON v."CODE_ETAB" = vf."CODE_ETAB" AND v."ANNEE_SCOLAIRE" = vf."ANNEE_SCOLAIRE"
    WHERE vf."CODE_DREN" ${opDren} ${valDren} AND vf."CODE_CISCO" ${opCisco} ${valCisco}
    AND vf."CODE_COMMUNE" ${opCommune} ${valCommune} AND vf."CODE_ZAP" ${opZap} ${valZap} 
    AND vf."SECTEUR" ${sect} AND vf."ANNEE_SCOLAIRE" = 2025
  `);
}

async function executeGetDataN3(client: Client, codeDren: number, codeCisco: number, codeCommune: number, codeZap: number, secteur: number) {
  const opDren = codeDren === 0 ? ">" : "="; const valDren = codeDren === 0 ? 0 : codeDren;
  const opCisco = codeCisco === 0 ? ">" : "="; const valCisco = codeCisco === 0 ? 0 : codeCisco;
  const opCommune = codeCommune === 0 ? ">" : "="; const valCommune = codeCommune === 0 ? 0 : codeCommune;
  const opZap = codeZap === 0 ? ">" : "="; const valZap = codeZap === 0 ? 0 : codeZap;
  const sect = secteur > 1 ? ">= 0" : `= ${secteur}`;
  const cols = `vf."CODE_ETAB", vf."DREN", vf."CISCO", vf."COMMUNE", vf."ZAP", vf."FOKONTANY",
    vf."NOM_ETAB", vf."CATEGORIE_COMMUNE", vf."CODE_DREN", vf."CODE_CISCO", vf."CODE_COMMUNE", vf."CODE_ZAP",
    vf."SECTEUR", vf."ANNEE_SCOLAIRE", vf.places, vf.sdc_be, vf.sdc_me,
    vf."TYPE_SOURCE_EAU", vf."TYPE_SOURCE_ELECTRICITE",
    vf.eff_2022, vf.eff_2023, vf.eff_2024, vf.eff_2025,
    vf.pers_total, vf.en_classe, vf.fonctionnaire, vf.fram_sub, vf.fram_nonsub,
    vf.bepc, vf.bacc, vf.qualifiee`;
  return await client.queryObject(`
    SELECT ${cols}, v._2nde, v._1re, v.tle
    FROM v_fiche_ecole_n3 vf
    INNER JOIN v_effectif_n3 v ON v."CODE_ETAB" = vf."CODE_ETAB" AND v."ANNEE_SCOLAIRE" = vf."ANNEE_SCOLAIRE"
    WHERE vf."CODE_DREN" ${opDren} ${valDren} AND vf."CODE_CISCO" ${opCisco} ${valCisco} 
    AND vf."CODE_COMMUNE" ${opCommune} ${valCommune} AND vf."CODE_ZAP" ${opZap} ${valZap} 
    AND vf."SECTEUR" ${sect} AND vf."ANNEE_SCOLAIRE" = 2025
  `);
}

// ============ TDB functions ============

async function executeTdbNbrStdDren(client: Client, codeDren: number) {
  const cd = codeDren || 11;
  const ciscoResult = await client.queryObject(`SELECT * FROM v_cisco WHERE "CODE_DREN" = ${cd} ORDER BY "CISCO"`);
  const zapResult = await client.queryObject(`SELECT * FROM v_zap WHERE "CODE_DREN" = ${cd} ORDER BY "CISCO"`);
  return { rows: [{ cisco: ciscoResult.rows, zap: zapResult.rows }] };
}

async function executeTdbZapsByCisco(client: Client, codeCisco: number) {
  return await client.queryObject(`SELECT * FROM v_zap WHERE "CODE_CISCO" = ${codeCisco || 101} ORDER BY "ZAP"`);
}

async function executeTdb111(client: Client, codeDren: number) {
  const cd = codeDren || 11;
  return await client.queryObject(`
    SELECT 
      SUM(CASE WHEN a1."EXISTE_COLLEGE" = 1 THEN 1 ELSE 0 END) AS nbr_ceg_ens,
      SUM(CASE WHEN a1."EXISTE_COLLEGE" = 1 AND a1."SECTEUR" = 0 THEN 1 ELSE 0 END) AS nbr_ceg_pub
    FROM fpe_a1 a1
    WHERE a1."CODE_DREN" = ${cd} AND a1."ANNEE_SCOLAIRE" = 2025 AND a1."EXISTE_COLLEGE" = 1
  `);
}

// ============ TDB DREN ============
async function executeTdbDrenData(client: Client, codeDren: number, annee: number) {
  const whereDren = `AND a1."CODE_DREN" = ${codeDren}`;
  const whereMada = '';

  // Reuse same helpers as CISCO but with DREN vs MADA
  async function getRessources(where: string) {
    const q = `SELECT COUNT(DISTINCT CASE WHEN a1."EXISTE_PRIMAIRE"=1 THEN a1."CODE_ETAB" END) AS nbr_etab,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T1_G"')}+${si('e1."T1_F"')}+${si('e1."T2_G"')}+${si('e1."T2_F"')}+${si('e1."T3_G"')}+${si('e1."T3_F"')}+${si('e1."T4_G"')}+${si('e1."T4_F"')}+${si('e1."T5_G"')}+${si('e1."T5_F"')} ELSE 0 END) AS nbr_eleve,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T1_G"')}+${si('e1."T2_G"')}+${si('e1."T3_G"')}+${si('e1."T4_G"')}+${si('e1."T5_G"')} ELSE 0 END) AS nbr_eleve_g,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T1_F"')}+${si('e1."T2_F"')}+${si('e1."T3_F"')}+${si('e1."T4_F"')}+${si('e1."T5_F"')} ELSE 0 END) AS nbr_eleve_f,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T1_G_REDOUBLANT"')}+${si('e1."T1_F_REDOUBLANT"')} ELSE 0 END) AS red_t1,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T2_G_REDOUBLANT"')}+${si('e1."T2_F_REDOUBLANT"')} ELSE 0 END) AS red_t2,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T3_G_REDOUBLANT"')}+${si('e1."T3_F_REDOUBLANT"')} ELSE 0 END) AS red_t3,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T4_G_REDOUBLANT"')}+${si('e1."T4_F_REDOUBLANT"')} ELSE 0 END) AS red_t4,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T5_G_REDOUBLANT"')}+${si('e1."T5_F_REDOUBLANT"')} ELSE 0 END) AS red_t5,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T1_G_REDOUBLANT"')}+${si('e1."T2_G_REDOUBLANT"')}+${si('e1."T3_G_REDOUBLANT"')}+${si('e1."T4_G_REDOUBLANT"')}+${si('e1."T5_G_REDOUBLANT"')} ELSE 0 END) AS red_g,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T1_F_REDOUBLANT"')}+${si('e1."T2_F_REDOUBLANT"')}+${si('e1."T3_F_REDOUBLANT"')}+${si('e1."T4_F_REDOUBLANT"')}+${si('e1."T5_F_REDOUBLANT"')} ELSE 0 END) AS red_f,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T1_G"')}+${si('e1."T1_F"')} ELSE 0 END) AS eff_t1,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T2_G"')}+${si('e1."T2_F"')} ELSE 0 END) AS eff_t2,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T3_G"')}+${si('e1."T3_F"')} ELSE 0 END) AS eff_t3,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T4_G"')}+${si('e1."T4_F"')} ELSE 0 END) AS eff_t4,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T5_G"')}+${si('e1."T5_F"')} ELSE 0 END) AS eff_t5,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T1_G"')} ELSE 0 END) AS eff_t1_g,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T1_F"')} ELSE 0 END) AS eff_t1_f,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T5_G"')} ELSE 0 END) AS eff_t5_g,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T5_F"')} ELSE 0 END) AS eff_t5_f,
      COUNT(DISTINCT CASE WHEN a1."EXISTE_PRIMAIRE"=1 AND a1."EST_ALIMENTE_EAU"='1' THEN a1."CODE_ETAB" END) AS etab_eau,
      COUNT(DISTINCT CASE WHEN a1."EXISTE_PRIMAIRE"=1 AND a1."EST_ELECTRIFIE"='1' THEN a1."CODE_ETAB" END) AS etab_elec,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T1_G_2KM"')}+${si('e1."T1_F_2KM"')}+${si('e1."T2_G_2KM"')}+${si('e1."T2_F_2KM"')}+${si('e1."T3_G_2KM"')}+${si('e1."T3_F_2KM"')}+${si('e1."T4_G_2KM"')}+${si('e1."T4_F_2KM"')}+${si('e1."T5_G_2KM"')}+${si('e1."T5_F_2KM"')} ELSE 0 END) AS eleve_2km,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 AND (${si('e1."T5_G"')}+${si('e1."T5_F"')}) > 0 THEN 1 ELSE 0 END) AS ecole_continue
    FROM fpe_a1 a1 LEFT JOIN fpe_e1 e1 ON e1."CODE_ETAB"=a1."CODE_ETAB" AND e1."ANNEE_SCOLAIRE"=a1."ANNEE_SCOLAIRE" AND e1."SECTEUR"=a1."SECTEUR"
    WHERE a1."ANNEE_SCOLAIRE"=${annee} AND a1."SECTEUR"=0 AND a1."EXISTE_PRIMAIRE"=1 ${where}`;
    return (await client.queryObject(q)).rows[0] || {};
  }
  async function getPersonnel(where: string) {
    const q = `SELECT SUM(CASE WHEN p1."CODE_STATUT" IN ('1','2','3','4') THEN 1 ELSE 0 END) AS nbr_pers,
      SUM(CASE WHEN p1."CODE_STATUT" IN ('1','2','3','4') AND ${si('p1."EN_SALLE"')}=1 THEN 1 ELSE 0 END) AS pers_en_classe,
      SUM(CASE WHEN p1."CODE_STATUT" IN ('1','2') THEN 1 ELSE 0 END) AS fonctionnaire,
      SUM(CASE WHEN p1."CODE_STATUT"='3' THEN 1 ELSE 0 END) AS sub,
      SUM(CASE WHEN p1."CODE_STATUT"='4' THEN 1 ELSE 0 END) AS non_sub,
      SUM(CASE WHEN COALESCE(p1."DIPLOME_PEDAGOGIQUE",'')='' THEN 1 ELSE 0 END) AS sans_diplome_ped
    FROM fpe_p1 p1 INNER JOIN fpe_a1 a1 ON a1."CODE_ETAB"=p1."CODE_ETAB" AND a1."ANNEE_SCOLAIRE"=p1."ANNEE_SCOLAIRE"
    WHERE p1."ANNEE_SCOLAIRE"=${annee} AND a1."EXISTE_PRIMAIRE"=1 AND a1."SECTEUR"=0 AND p1."NIVEAU_TENU_PRIMAIRE"='1' ${where}`;
    return (await client.queryObject(q)).rows[0] || {};
  }
  async function getSections(where: string) {
    try { const q = `SELECT SUM(${si('g1."T1_SECTION"')}+${si('g1."T2_SECTION"')}+${si('g1."T3_SECTION"')}+${si('g1."T4_SECTION"')}+${si('g1."T5_SECTION"')}) AS nbr_section, SUM(${si('j1."SDC_PRIMAIRE_BON_ETAT"')}+${si('j1."SDC_PRIMAIRE_MAUVAIS_ETAT"')}) AS nbr_sdc FROM fpe_a1 a1 LEFT JOIN fpe_g1 g1 ON g1."CODE_ETAB"=a1."CODE_ETAB" AND g1."ANNEE_SCOLAIRE"=a1."ANNEE_SCOLAIRE" LEFT JOIN fpe_j1 j1 ON j1."CODE_ETAB"=a1."CODE_ETAB" AND j1."ANNEE_SCOLAIRE"=a1."ANNEE_SCOLAIRE" WHERE a1."ANNEE_SCOLAIRE"=${annee} AND a1."EXISTE_PRIMAIRE"=1 AND a1."SECTEUR"=0 ${where}`; return (await client.queryObject(q)).rows[0] || {}; } catch(e) { return { nbr_section: 0, nbr_sdc: 0 }; }
  }
  async function getPlaces(where: string) {
    try { const q = `SELECT SUM((${si('k1."PRIMAIRE_TABLES_BANCS_1PL_BON_ETAT"')}+${si('k1."PRIMAIRE_TABLES_BANCS_1PL_MAUVAIS_ETAT"')})+(${si('k1."PRIMAIRE_TABLES_BANCS_2PL_BON_ETAT"')}+${si('k1."PRIMAIRE_TABLES_BANCS_2PL_MAUVAIS_ETAT"')})*2+(${si('k1."PRIMAIRE_TABLES_BANCS_3PL_BON_ETAT"')}+${si('k1."PRIMAIRE_TABLES_BANCS_3PL_MAUVAIS_ETAT"')})*3+(${si('k1."PRIMAIRE_TABLES_BANCS_4PL_BON_ETAT"')}+${si('k1."PRIMAIRE_TABLES_BANCS_4PL_MAUVAIS_ETAT"')})*4+(${si('k1."PRIMAIRE_TABLES_BANCS_5PL_PLUS_BON_ETAT"')}+${si('k1."PRIMAIRE_TABLES_BANCS_5PL_PLUS_MAUVAIS_ETAT"')})*5) AS places_assises, SUM(${si('j2."WC_LATRINES_COMMUNES_BON_ETAT"')}+${si('j2."WC_LATRINES_COMMUNES_MAUVAIS_ETAT"')}+${si('j2."WC_LATRINES_FILLES_BON_ETAT"')}+${si('j2."WC_LATRINES_FILLES_MAUVAIS_ETAT"')}+${si('j2."WC_LATRINES_GARCONS_BON_ETAT"')}+${si('j2."WC_LATRINES_GARCONS_MAUVAIS_ETAT"')}) AS latrines, SUM(${si('j2."WC_LATRINES_FILLES_BON_ETAT"')}+${si('j2."WC_LATRINES_FILLES_MAUVAIS_ETAT"')}) AS latrines_fille FROM fpe_a1 a1 LEFT JOIN fpe_k1 k1 ON k1."CODE_ETAB"=a1."CODE_ETAB" AND k1."ANNEE_SCOLAIRE"=a1."ANNEE_SCOLAIRE" LEFT JOIN fpe_j2 j2 ON j2."CODE_ETAB"=a1."CODE_ETAB" AND j2."ANNEE_SCOLAIRE"=a1."ANNEE_SCOLAIRE" WHERE a1."ANNEE_SCOLAIRE"=${annee} AND a1."EXISTE_PRIMAIRE"=1 AND a1."SECTEUR"=0 ${where}`; return (await client.queryObject(q)).rows[0] || {}; } catch(e) { return { places_assises: 0, latrines: 0, latrines_fille: 0 }; }
  }
  async function getCepe(where: string) {
    try { const q = `SELECT SUM(COALESCE(c."Nbre",0)) AS total_candidats, SUM(COALESCE(c."nbrG",0)) AS nbr_g, SUM(COALESCE(c."nbrF",0)) AS nbr_f, SUM(COALESCE(c."admisG",0)) AS admis_g, SUM(COALESCE(c."admisF",0)) AS admis_f, CASE WHEN SUM(COALESCE(c."Nbre",0))>0 THEN ROUND((SUM(c."mlg"*c."Nbre")/SUM(c."Nbre"))::numeric,1) END AS sm_mlg, CASE WHEN SUM(COALESCE(c."Nbre",0))>0 THEN ROUND((SUM(c."ml_fahazoana_lahatsoratra"*c."Nbre")/SUM(c."Nbre"))::numeric,1) END AS sm_mlg_fahazoana, CASE WHEN SUM(COALESCE(c."Nbre",0))>0 THEN ROUND((SUM(c."ml_fitsipika"*c."Nbre")/SUM(c."Nbre"))::numeric,1) END AS sm_mlg_fitsipika, CASE WHEN SUM(COALESCE(c."Nbre",0))>0 THEN ROUND((SUM(c."ml_fanazarana_hanoratra"*c."Nbre")/SUM(c."Nbre"))::numeric,1) END AS sm_mlg_fanazarana, CASE WHEN SUM(COALESCE(c."Nbre",0))>0 THEN ROUND((SUM(c."frs"*c."Nbre")/SUM(c."Nbre"))::numeric,1) END AS sm_frs, CASE WHEN SUM(COALESCE(c."Nbre",0))>0 THEN ROUND((SUM(c."fr_comprehension"*c."Nbre")/SUM(c."Nbre"))::numeric,1) END AS sm_frs_comprehension, CASE WHEN SUM(COALESCE(c."Nbre",0))>0 THEN ROUND((SUM(c."fr_grammaire"*c."Nbre")/SUM(c."Nbre"))::numeric,1) END AS sm_frs_grammaire, CASE WHEN SUM(COALESCE(c."Nbre",0))>0 THEN ROUND((SUM(c."fr_expression_ecrite"*c."Nbre")/SUM(c."Nbre"))::numeric,1) END AS sm_frs_expression, CASE WHEN SUM(COALESCE(c."Nbre",0))>0 THEN ROUND((SUM(c."operation"*c."Nbre")/SUM(c."Nbre"))::numeric,1) END AS sm_mths_operation, CASE WHEN SUM(COALESCE(c."Nbre",0))>0 THEN ROUND((SUM(c."probleme"*c."Nbre")/SUM(c."Nbre"))::numeric,1) END AS sm_mths_probleme, CASE WHEN SUM(COALESCE(c."Nbre",0))>0 THEN ROUND((SUM((COALESCE(c."operation",0)+COALESCE(c."probleme",0))/2.0*c."Nbre")/SUM(c."Nbre"))::numeric,1) END AS sm_mths, CASE WHEN SUM(COALESCE(c."Nbre",0))>0 THEN ROUND((SUM(c."moyenne"*c."Nbre")/SUM(c."Nbre"))::numeric,1) END AS sm_total, SUM(COALESCE(c."malagasy_sup_10",0)) AS mlg_sup10, SUM(COALESCE(c."malagasy_compo_sup_10",0)) AS mlg_compo_sup10, SUM(COALESCE(c."malagasy_gram_sup_10",0)) AS mlg_gram_sup10, SUM(COALESCE(c."malagasy_exp_10",0)) AS mlg_exp_sup10, SUM(COALESCE(c."francais_sup_10",0)) AS frs_sup10, SUM(COALESCE(c."francais_compo_sup_10",0)) AS frs_compo_sup10, SUM(COALESCE(c."francais_gram_sup_10",0)) AS frs_gram_sup10, SUM(COALESCE(c."francais_exp_10",0)) AS frs_exp_sup10, SUM(COALESCE(c."math_sup_10",0)) AS mths_sup10, SUM(COALESCE(c."op_sup_10",0)) AS op_sup10, SUM(COALESCE(c."probleme_sup_10",0)) AS prob_sup10, SUM(COALESCE(c."autres_sup_10",0)) AS autres_sup10 FROM examen_cepe c INNER JOIN fpe_a1 a1 ON a1."CODE_ETAB"=c."code_etab" AND a1."ANNEE_SCOLAIRE"=c."id_annee_scolaire" WHERE c."id_annee_scolaire"=${annee} AND a1."SECTEUR"=0 ${where}`; return (await client.queryObject(q)).rows[0] || {}; } catch(e) { return {}; }
  }
  async function getCaisseEcole(where: string) {
    try { const q = `SELECT SUM(COALESCE(ce."FCE",0)) AS total_fce FROM caisse_ecole ce INNER JOIN fpe_a1 a1 ON a1."CODE_ETAB"=ce."CODE_ETAB" AND a1."ANNEE_SCOLAIRE"=ce."ANNEE_SCOLAIRE" WHERE ce."ANNEE_SCOLAIRE"=${annee} AND a1."EXISTE_PRIMAIRE"=1 ${where}`; return (await client.queryObject(q)).rows[0] || {}; } catch(e) { return {}; }
  }
  async function getManuels(where: string) {
    try { const q = `SELECT SUM(${si('l1."MALAGASY_T1"')}+${si('l1."MALAGASY_T2"')}+${si('l1."MALAGASY_T3"')}+${si('l1."MALAGASY_T4"')}+${si('l1."MALAGASY_T5"')}) AS malagasy, SUM(${si('l1."MATHS_T1"')}+${si('l1."MATHS_T2"')}+${si('l1."MATHS_T3"')}+${si('l1."MATHS_T4"')}+${si('l1."MATHS_T5"')}) AS maths, SUM(${si('l1."FRANCAIS_T1"')}+${si('l1."FRANCAIS_T2"')}+${si('l1."FRANCAIS_T3"')}+${si('l1."FRANCAIS_T4"')}+${si('l1."FRANCAIS_T5"')}) AS francais FROM fpe_l1 l1 INNER JOIN fpe_a1 a1 ON a1."CODE_ETAB"=l1."CODE_ETAB" AND a1."ANNEE_SCOLAIRE"=l1."ANNEE_SCOLAIRE" WHERE l1."ANNEE_SCOLAIRE"=${annee} AND a1."EXISTE_PRIMAIRE"=1 AND a1."SECTEUR"=0 ${where}`; return (await client.queryObject(q)).rows[0] || {}; } catch(e) { return {}; }
  }
  async function getEfficience() {
    try { const q = `SELECT c."CISCO", c."CODE_CISCO", SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T1_G"')}+${si('e1."T1_F"')}+${si('e1."T2_G"')}+${si('e1."T2_F"')}+${si('e1."T3_G"')}+${si('e1."T3_F"')}+${si('e1."T4_G"')}+${si('e1."T4_F"')}+${si('e1."T5_G"')}+${si('e1."T5_F"')} ELSE 0 END) AS nbr_eleve, SUM(CASE WHEN p1."CODE_STATUT" IN ('1','2','3','4') AND ${si('p1."EN_SALLE"')}=1 THEN 1 ELSE 0 END) AS pers_en_classe, SUM(COALESCE(ce."admisG",0)+COALESCE(ce."admisF",0)) AS admis, SUM(COALESCE(ce."Nbre",0)) AS inscrits_cepe FROM v_cisco c LEFT JOIN fpe_a1 a1 ON a1."CODE_CISCO"=c."CODE_CISCO" AND a1."ANNEE_SCOLAIRE"=${annee} AND a1."SECTEUR"=0 AND a1."EXISTE_PRIMAIRE"=1 LEFT JOIN fpe_e1 e1 ON e1."CODE_ETAB"=a1."CODE_ETAB" AND e1."ANNEE_SCOLAIRE"=a1."ANNEE_SCOLAIRE" AND e1."SECTEUR"=a1."SECTEUR" LEFT JOIN fpe_p1 p1 ON p1."CODE_ETAB"=a1."CODE_ETAB" AND p1."ANNEE_SCOLAIRE"=a1."ANNEE_SCOLAIRE" AND p1."NIVEAU_TENU_PRIMAIRE"='1' LEFT JOIN examen_cepe ce ON ce."code_etab"=a1."CODE_ETAB" AND ce."id_annee_scolaire"=a1."ANNEE_SCOLAIRE" WHERE c."CODE_DREN"=${codeDren} GROUP BY c."CISCO",c."CODE_CISCO" ORDER BY c."CISCO"`; return (await client.queryObject(q)).rows || []; } catch(e) { return []; }
  }

  const [resDren, resMada, persDren, persMada, secDren, secMada, plDren, plMada, cepeDren, cepeMada, ceDren, ceMada, manDren, manMada, efficience] = await Promise.all([
    getRessources(whereDren), getRessources(whereMada),
    getPersonnel(whereDren), getPersonnel(whereMada),
    getSections(whereDren), getSections(whereMada),
    getPlaces(whereDren), getPlaces(whereMada),
    getCepe(whereDren), getCepe(whereMada),
    getCaisseEcole(whereDren), getCaisseEcole(whereMada),
    getManuels(whereDren), getManuels(whereMada),
    getEfficience(),
  ]);

  const namesResult = await client.queryObject(`SELECT "DREN" FROM v_dren WHERE "CODE_DREN"=${codeDren}`);
  const names = namesResult.rows[0] || { DREN: '' };

  return {
    version: VERSION, names, annee,
    dren: { ressources: resDren, personnel: persDren, sections: secDren, places: plDren, cepe: cepeDren, caisse: ceDren, manuels: manDren },
    mada: { ressources: resMada, personnel: persMada, sections: secMada, places: plMada, cepe: cepeMada, caisse: ceMada, manuels: manMada },
    efficience,
  };
}

// ============ TDB CISCO ============

async function executeTdbCiscoData(client: Client, codeCisco: number, codeDren: number, annee: number) {
  const whereCisco = `AND a1."CODE_CISCO" = ${codeCisco}`;
  const whereDren = `AND a1."CODE_DREN" = ${codeDren}`;
  const whereMada = '';

  async function getRessources(where: string) {
    // fpe_e1: SECTEUR=integer, EXISTE_PRIMAIRE=integer, T*_F/T*_G=varchar
    const q = `
      SELECT 
        COUNT(DISTINCT CASE WHEN a1."EXISTE_PRIMAIRE"=1 THEN a1."CODE_ETAB" END) AS nbr_etab,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN 
          ${si('e1."T1_G"')}+${si('e1."T1_F"')}+${si('e1."T2_G"')}+${si('e1."T2_F"')}+
          ${si('e1."T3_G"')}+${si('e1."T3_F"')}+${si('e1."T4_G"')}+${si('e1."T4_F"')}+
          ${si('e1."T5_G"')}+${si('e1."T5_F"')} ELSE 0 END) AS nbr_eleve,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN 
          ${si('e1."T1_G"')}+${si('e1."T2_G"')}+${si('e1."T3_G"')}+${si('e1."T4_G"')}+${si('e1."T5_G"')} ELSE 0 END) AS nbr_eleve_g,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN 
          ${si('e1."T1_F"')}+${si('e1."T2_F"')}+${si('e1."T3_F"')}+${si('e1."T4_F"')}+${si('e1."T5_F"')} ELSE 0 END) AS nbr_eleve_f,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T1_G_REDOUBLANT"')}+${si('e1."T1_F_REDOUBLANT"')} ELSE 0 END) AS red_t1,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T2_G_REDOUBLANT"')}+${si('e1."T2_F_REDOUBLANT"')} ELSE 0 END) AS red_t2,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T3_G_REDOUBLANT"')}+${si('e1."T3_F_REDOUBLANT"')} ELSE 0 END) AS red_t3,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T4_G_REDOUBLANT"')}+${si('e1."T4_F_REDOUBLANT"')} ELSE 0 END) AS red_t4,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T5_G_REDOUBLANT"')}+${si('e1."T5_F_REDOUBLANT"')} ELSE 0 END) AS red_t5,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN 
          ${si('e1."T1_G_REDOUBLANT"')}+${si('e1."T2_G_REDOUBLANT"')}+${si('e1."T3_G_REDOUBLANT"')}+
          ${si('e1."T4_G_REDOUBLANT"')}+${si('e1."T5_G_REDOUBLANT"')} ELSE 0 END) AS red_g,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN 
          ${si('e1."T1_F_REDOUBLANT"')}+${si('e1."T2_F_REDOUBLANT"')}+${si('e1."T3_F_REDOUBLANT"')}+
          ${si('e1."T4_F_REDOUBLANT"')}+${si('e1."T5_F_REDOUBLANT"')} ELSE 0 END) AS red_f,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T1_G"')}+${si('e1."T1_F"')} ELSE 0 END) AS eff_t1,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T2_G"')}+${si('e1."T2_F"')} ELSE 0 END) AS eff_t2,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T3_G"')}+${si('e1."T3_F"')} ELSE 0 END) AS eff_t3,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T4_G"')}+${si('e1."T4_F"')} ELSE 0 END) AS eff_t4,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T5_G"')}+${si('e1."T5_F"')} ELSE 0 END) AS eff_t5,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T1_G"')} ELSE 0 END) AS eff_t1_g,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T1_F"')} ELSE 0 END) AS eff_t1_f,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T5_G"')} ELSE 0 END) AS eff_t5_g,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T5_F"')} ELSE 0 END) AS eff_t5_f,
        COUNT(DISTINCT CASE WHEN a1."EXISTE_PRIMAIRE"=1 AND a1."EST_ALIMENTE_EAU"='1' THEN a1."CODE_ETAB" END) AS etab_eau,
        COUNT(DISTINCT CASE WHEN a1."EXISTE_PRIMAIRE"=1 AND a1."EST_ELECTRIFIE"='1' THEN a1."CODE_ETAB" END) AS etab_elec,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN 
          ${si('e1."T1_G_2KM"')}+${si('e1."T1_F_2KM"')}+${si('e1."T2_G_2KM"')}+${si('e1."T2_F_2KM"')}+
          ${si('e1."T3_G_2KM"')}+${si('e1."T3_F_2KM"')}+${si('e1."T4_G_2KM"')}+${si('e1."T4_F_2KM"')}+
          ${si('e1."T5_G_2KM"')}+${si('e1."T5_F_2KM"')} ELSE 0 END) AS eleve_2km,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 AND (${si('e1."T5_G"')}+${si('e1."T5_F"')}) > 0 THEN 1 ELSE 0 END) AS ecole_continue
      FROM fpe_a1 a1
      LEFT JOIN fpe_e1 e1 ON e1."CODE_ETAB" = a1."CODE_ETAB" AND e1."ANNEE_SCOLAIRE" = a1."ANNEE_SCOLAIRE" AND e1."SECTEUR" = a1."SECTEUR"
      WHERE a1."ANNEE_SCOLAIRE" = ${annee} AND a1."SECTEUR" = 0 AND a1."EXISTE_PRIMAIRE" = 1 ${where}
    `;
    return (await client.queryObject(q)).rows[0] || {};
  }

  async function getPersonnel(where: string) {
    const q = `
      SELECT 
        SUM(CASE WHEN p1."CODE_STATUT" IN ('1','2','3','4') THEN 1 ELSE 0 END) AS nbr_pers,
        SUM(CASE WHEN p1."CODE_STATUT" IN ('1','2','3','4') AND ${si('p1."EN_SALLE"')} = 1 THEN 1 ELSE 0 END) AS pers_en_classe,
        SUM(CASE WHEN p1."CODE_STATUT" IN ('1','2') THEN 1 ELSE 0 END) AS fonctionnaire,
        SUM(CASE WHEN p1."CODE_STATUT" = '3' THEN 1 ELSE 0 END) AS sub,
        SUM(CASE WHEN p1."CODE_STATUT" = '4' THEN 1 ELSE 0 END) AS non_sub,
        SUM(CASE WHEN COALESCE(p1."DIPLOME_PEDAGOGIQUE",'') = '' THEN 1 ELSE 0 END) AS sans_diplome_ped
      FROM fpe_p1 p1
      INNER JOIN fpe_a1 a1 ON a1."CODE_ETAB" = p1."CODE_ETAB" AND a1."ANNEE_SCOLAIRE" = p1."ANNEE_SCOLAIRE"
      WHERE p1."ANNEE_SCOLAIRE" = ${annee} AND a1."EXISTE_PRIMAIRE" = 1 AND a1."SECTEUR" = 0 
        AND p1."NIVEAU_TENU_PRIMAIRE" = '1' ${where}
    `;
    return (await client.queryObject(q)).rows[0] || {};
  }

  async function getSections(where: string) {
    try {
      const q = `
        SELECT 
          SUM(${si('g1."T1_SECTION"')}+${si('g1."T2_SECTION"')}+${si('g1."T3_SECTION"')}+${si('g1."T4_SECTION"')}+${si('g1."T5_SECTION"')}) AS nbr_section,
          SUM(${si('j1."SDC_PRIMAIRE_BON_ETAT"')}+${si('j1."SDC_PRIMAIRE_MAUVAIS_ETAT"')}) AS nbr_sdc
        FROM fpe_a1 a1
        LEFT JOIN fpe_g1 g1 ON g1."CODE_ETAB"=a1."CODE_ETAB" AND g1."ANNEE_SCOLAIRE"=a1."ANNEE_SCOLAIRE"
        LEFT JOIN fpe_j1 j1 ON j1."CODE_ETAB"=a1."CODE_ETAB" AND j1."ANNEE_SCOLAIRE"=a1."ANNEE_SCOLAIRE"
        WHERE a1."ANNEE_SCOLAIRE"=${annee} AND a1."EXISTE_PRIMAIRE"=1 AND a1."SECTEUR"=0 ${where}
      `;
      return (await client.queryObject(q)).rows[0] || {};
    } catch(e) { console.error('getSections error:', e); return { nbr_section: 0, nbr_sdc: 0 }; }
  }

  async function getPlaces(where: string) {
    try {
      const q = `
        SELECT 
          SUM(
            (${si('k1."PRIMAIRE_TABLES_BANCS_1PL_BON_ETAT"')} + ${si('k1."PRIMAIRE_TABLES_BANCS_1PL_MAUVAIS_ETAT"')}) +
            (${si('k1."PRIMAIRE_TABLES_BANCS_2PL_BON_ETAT"')} + ${si('k1."PRIMAIRE_TABLES_BANCS_2PL_MAUVAIS_ETAT"')})*2 +
            (${si('k1."PRIMAIRE_TABLES_BANCS_3PL_BON_ETAT"')} + ${si('k1."PRIMAIRE_TABLES_BANCS_3PL_MAUVAIS_ETAT"')})*3 +
            (${si('k1."PRIMAIRE_TABLES_BANCS_4PL_BON_ETAT"')} + ${si('k1."PRIMAIRE_TABLES_BANCS_4PL_MAUVAIS_ETAT"')})*4 +
            (${si('k1."PRIMAIRE_TABLES_BANCS_5PL_PLUS_BON_ETAT"')} + ${si('k1."PRIMAIRE_TABLES_BANCS_5PL_PLUS_MAUVAIS_ETAT"')})*5
          ) AS places_assises,
          SUM(${si('j2."WC_LATRINES_COMMUNES_BON_ETAT"')}+${si('j2."WC_LATRINES_COMMUNES_MAUVAIS_ETAT"')}+
              ${si('j2."WC_LATRINES_FILLES_BON_ETAT"')}+${si('j2."WC_LATRINES_FILLES_MAUVAIS_ETAT"')}+
              ${si('j2."WC_LATRINES_GARCONS_BON_ETAT"')}+${si('j2."WC_LATRINES_GARCONS_MAUVAIS_ETAT"')}) AS latrines,
          SUM(${si('j2."WC_LATRINES_FILLES_BON_ETAT"')}+${si('j2."WC_LATRINES_FILLES_MAUVAIS_ETAT"')}) AS latrines_fille
        FROM fpe_a1 a1
        LEFT JOIN fpe_k1 k1 ON k1."CODE_ETAB"=a1."CODE_ETAB" AND k1."ANNEE_SCOLAIRE"=a1."ANNEE_SCOLAIRE"
        LEFT JOIN fpe_j2 j2 ON j2."CODE_ETAB"=a1."CODE_ETAB" AND j2."ANNEE_SCOLAIRE"=a1."ANNEE_SCOLAIRE"
        WHERE a1."ANNEE_SCOLAIRE"=${annee} AND a1."EXISTE_PRIMAIRE"=1 AND a1."SECTEUR"=0 ${where}
      `;
      return (await client.queryObject(q)).rows[0] || {};
    } catch(e) { console.error('getPlaces error:', e); return { places_assises: 0, latrines: 0, latrines_fille: 0 }; }
  }

  async function getCepe(where: string) {
    try {
      // Use examen_cepe table exclusively - it has per-school aggregated data
      // Weighted averages: SUM(score * Nbre) / SUM(Nbre)
      // Note >= 10: SUM(xxx_sup_10) / SUM(Nbre) * 100
      const q = `
        SELECT 
          SUM(COALESCE(c."Nbre",0)) AS total_candidats,
          SUM(COALESCE(c."nbrG",0)) AS nbr_g,
          SUM(COALESCE(c."nbrF",0)) AS nbr_f,
          SUM(COALESCE(c."admisG",0)) AS admis_g,
          SUM(COALESCE(c."admisF",0)) AS admis_f,
          CASE WHEN SUM(COALESCE(c."Nbre",0)) > 0 THEN ROUND((SUM(c."mlg" * c."Nbre") / SUM(c."Nbre"))::numeric, 1) END AS sm_mlg,
          CASE WHEN SUM(COALESCE(c."Nbre",0)) > 0 THEN ROUND((SUM(c."ml_fahazoana_lahatsoratra" * c."Nbre") / SUM(c."Nbre"))::numeric, 1) END AS sm_mlg_fahazoana,
          CASE WHEN SUM(COALESCE(c."Nbre",0)) > 0 THEN ROUND((SUM(c."ml_fitsipika" * c."Nbre") / SUM(c."Nbre"))::numeric, 1) END AS sm_mlg_fitsipika,
          CASE WHEN SUM(COALESCE(c."Nbre",0)) > 0 THEN ROUND((SUM(c."ml_fanazarana_hanoratra" * c."Nbre") / SUM(c."Nbre"))::numeric, 1) END AS sm_mlg_fanazarana,
          CASE WHEN SUM(COALESCE(c."Nbre",0)) > 0 THEN ROUND((SUM(c."frs" * c."Nbre") / SUM(c."Nbre"))::numeric, 1) END AS sm_frs,
          CASE WHEN SUM(COALESCE(c."Nbre",0)) > 0 THEN ROUND((SUM(c."fr_comprehension" * c."Nbre") / SUM(c."Nbre"))::numeric, 1) END AS sm_frs_comprehension,
          CASE WHEN SUM(COALESCE(c."Nbre",0)) > 0 THEN ROUND((SUM(c."fr_grammaire" * c."Nbre") / SUM(c."Nbre"))::numeric, 1) END AS sm_frs_grammaire,
          CASE WHEN SUM(COALESCE(c."Nbre",0)) > 0 THEN ROUND((SUM(c."fr_expression_ecrite" * c."Nbre") / SUM(c."Nbre"))::numeric, 1) END AS sm_frs_expression,
          CASE WHEN SUM(COALESCE(c."Nbre",0)) > 0 THEN ROUND((SUM(c."operation" * c."Nbre") / SUM(c."Nbre"))::numeric, 1) END AS sm_mths_operation,
          CASE WHEN SUM(COALESCE(c."Nbre",0)) > 0 THEN ROUND((SUM(c."probleme" * c."Nbre") / SUM(c."Nbre"))::numeric, 1) END AS sm_mths_probleme,
          CASE WHEN SUM(COALESCE(c."Nbre",0)) > 0 THEN ROUND((SUM((COALESCE(c."operation",0)+COALESCE(c."probleme",0))/2.0 * c."Nbre") / SUM(c."Nbre"))::numeric, 1) END AS sm_mths,
          CASE WHEN SUM(COALESCE(c."Nbre",0)) > 0 THEN ROUND((SUM(c."moyenne" * c."Nbre") / SUM(c."Nbre"))::numeric, 1) END AS sm_total,
          SUM(COALESCE(c."malagasy_sup_10",0)) AS mlg_sup10,
          SUM(COALESCE(c."malagasy_compo_sup_10",0)) AS mlg_compo_sup10,
          SUM(COALESCE(c."malagasy_gram_sup_10",0)) AS mlg_gram_sup10,
          SUM(COALESCE(c."malagasy_exp_10",0)) AS mlg_exp_sup10,
          SUM(COALESCE(c."francais_sup_10",0)) AS frs_sup10,
          SUM(COALESCE(c."francais_compo_sup_10",0)) AS frs_compo_sup10,
          SUM(COALESCE(c."francais_gram_sup_10",0)) AS frs_gram_sup10,
          SUM(COALESCE(c."francais_exp_10",0)) AS frs_exp_sup10,
          SUM(COALESCE(c."math_sup_10",0)) AS mths_sup10,
          SUM(COALESCE(c."op_sup_10",0)) AS op_sup10,
          SUM(COALESCE(c."probleme_sup_10",0)) AS prob_sup10,
          SUM(COALESCE(c."autres_sup_10",0)) AS autres_sup10
        FROM examen_cepe c
        INNER JOIN fpe_a1 a1 ON a1."CODE_ETAB" = c."code_etab" AND a1."ANNEE_SCOLAIRE" = c."id_annee_scolaire"
        WHERE c."id_annee_scolaire" = ${annee} AND a1."SECTEUR" = 0 ${where}
      `;
      return (await client.queryObject(q)).rows[0] || {};
    } catch(e) { console.error('getCepe error:', e); return {}; }
  }

  async function getCaisseEcole(where: string) {
    try {
      const q = `
        SELECT 
          SUM(COALESCE(ce."FCE",0)) AS total_fce,
          SUM(COALESCE(ce."TOTAL_A_DOTER",0)) AS total_a_doter
        FROM caisse_ecole ce
        INNER JOIN fpe_a1 a1 ON a1."CODE_ETAB" = ce."CODE_ETAB" AND a1."ANNEE_SCOLAIRE" = ce."ANNEE_SCOLAIRE"
        WHERE ce."ANNEE_SCOLAIRE" = ${annee} AND a1."EXISTE_PRIMAIRE" = 1 ${where}
      `;
      return (await client.queryObject(q)).rows[0] || {};
    } catch(e) { console.error('getCaisseEcole error:', e); return {}; }
  }

  async function getManuels(where: string) {
    try {
      const q = `
        SELECT 
          SUM(${si('l1."MALAGASY_T1"')}+${si('l1."MALAGASY_T2"')}+${si('l1."MALAGASY_T3"')}+${si('l1."MALAGASY_T4"')}+${si('l1."MALAGASY_T5"')}) AS malagasy,
          SUM(${si('l1."MATHS_T1"')}+${si('l1."MATHS_T2"')}+${si('l1."MATHS_T3"')}+${si('l1."MATHS_T4"')}+${si('l1."MATHS_T5"')}) AS maths,
          SUM(${si('l1."FRANCAIS_T1"')}+${si('l1."FRANCAIS_T2"')}+${si('l1."FRANCAIS_T3"')}+${si('l1."FRANCAIS_T4"')}+${si('l1."FRANCAIS_T5"')}) AS francais
        FROM fpe_l1 l1
        INNER JOIN fpe_a1 a1 ON a1."CODE_ETAB"=l1."CODE_ETAB" AND a1."ANNEE_SCOLAIRE"=l1."ANNEE_SCOLAIRE"
        WHERE l1."ANNEE_SCOLAIRE"=${annee} AND a1."EXISTE_PRIMAIRE"=1 AND a1."SECTEUR"=0 ${where}
      `;
      return (await client.queryObject(q)).rows[0] || {};
    } catch(e) { console.error('getManuels error:', e); return {}; }
  }

  async function getRessourcesFin(where: string) {
    try {
      const q = `
        SELECT 
          SUM(${si('m1."PARTICIPATION_FRAM_PRIMAIRE"')}) AS fram,
          SUM(${si('m1."SUBVENTION_ENS_PRIMAIRE"')}) AS subvention,
          SUM(${si('m1."DONS_PRIMAIRE"')} + ${si('m1."ALLEGEMENT_PRIMAIRE"')}) AS autres,
          SUM(${si('m1."PARTICIPATION_FRAM_PRIMAIRE"')}+${si('m1."SUBVENTION_ENS_PRIMAIRE"')}+${si('m1."DONS_PRIMAIRE"')}+${si('m1."ALLEGEMENT_PRIMAIRE"')}) AS total
        FROM fpe_m1 m1
        INNER JOIN fpe_a1 a1 ON a1."CODE_ETAB"=m1."CODE_ETAB" AND a1."ANNEE_SCOLAIRE"=m1."ANNEE_SCOLAIRE"
        WHERE m1."ANNEE_SCOLAIRE"=${annee} AND a1."EXISTE_PRIMAIRE"=1 AND a1."SECTEUR"=0 ${where}
      `;
      return (await client.queryObject(q)).rows[0] || {};
    } catch(e) { console.error('getRessourcesFin error:', e); return {}; }
  }

  const [
    resCisco, resDren, resMada,
    persCisco, persDren, persMada,
    secCisco, secDren, secMada,
    plCisco, plDren, plMada,
    cepeCisco, cepeDren, cepeMada,
    ceCisco, ceDren, ceMada,
    manCisco, manDren, manMada,
    rfCisco, rfDren, rfMada
  ] = await Promise.all([
    getRessources(whereCisco), getRessources(whereDren), getRessources(whereMada),
    getPersonnel(whereCisco), getPersonnel(whereDren), getPersonnel(whereMada),
    getSections(whereCisco), getSections(whereDren), getSections(whereMada),
    getPlaces(whereCisco), getPlaces(whereDren), getPlaces(whereMada),
    getCepe(whereCisco), getCepe(whereDren), getCepe(whereMada),
    getCaisseEcole(whereCisco), getCaisseEcole(whereDren), getCaisseEcole(whereMada),
    getManuels(whereCisco), getManuels(whereDren), getManuels(whereMada),
    getRessourcesFin(whereCisco), getRessourcesFin(whereDren), getRessourcesFin(whereMada),
  ]);

  const namesResult = await client.queryObject(`
    SELECT c."CISCO", d."DREN" 
    FROM v_cisco c 
    INNER JOIN v_dren d ON d."CODE_DREN" = c."CODE_DREN" 
    WHERE c."CODE_CISCO" = ${codeCisco}
  `);
  const names = namesResult.rows[0] || { CISCO: '', DREN: '' };

  return {
    version: VERSION,
    names,
    annee,
    cisco: { ressources: resCisco, personnel: persCisco, sections: secCisco, places: plCisco, cepe: cepeCisco, caisse: ceCisco, manuels: manCisco, finances: rfCisco },
    dren: { ressources: resDren, personnel: persDren, sections: secDren, places: plDren, cepe: cepeDren, caisse: ceDren, manuels: manDren, finances: rfDren },
    mada: { ressources: resMada, personnel: persMada, sections: secMada, places: plMada, cepe: cepeMada, caisse: ceMada, manuels: manMada, finances: rfMada },
  };
}

// ============ TDB ZAP ============
async function executeTdbZapData(client: Client, codeZap: number, codeCisco: number, codeDren: number, annee: number) {
  // ZAP level: filter by CODE_ZAP; compare with CISCO and DREN
  const whereZap = `AND a1."CODE_ZAP" = ${codeZap}`;
  const whereCisco = `AND a1."CODE_CISCO" = ${codeCisco}`;
  const whereDren = `AND a1."CODE_DREN" = ${codeDren}`;

  // Reuse the same query functions from executeTdbCiscoData
  async function getRessources(where: string) {
    const q = `
      SELECT 
        COUNT(DISTINCT CASE WHEN a1."EXISTE_PRIMAIRE"=1 THEN a1."CODE_ETAB" END) AS nbr_etab,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN 
          ${si('e1."T1_G"')}+${si('e1."T1_F"')}+${si('e1."T2_G"')}+${si('e1."T2_F"')}+
          ${si('e1."T3_G"')}+${si('e1."T3_F"')}+${si('e1."T4_G"')}+${si('e1."T4_F"')}+
          ${si('e1."T5_G"')}+${si('e1."T5_F"')} ELSE 0 END) AS nbr_eleve,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN 
          ${si('e1."T1_G"')}+${si('e1."T2_G"')}+${si('e1."T3_G"')}+${si('e1."T4_G"')}+${si('e1."T5_G"')} ELSE 0 END) AS nbr_eleve_g,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN 
          ${si('e1."T1_F"')}+${si('e1."T2_F"')}+${si('e1."T3_F"')}+${si('e1."T4_F"')}+${si('e1."T5_F"')} ELSE 0 END) AS nbr_eleve_f,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T1_G_REDOUBLANT"')}+${si('e1."T1_F_REDOUBLANT"')} ELSE 0 END) AS red_t1,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T2_G_REDOUBLANT"')}+${si('e1."T2_F_REDOUBLANT"')} ELSE 0 END) AS red_t2,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T3_G_REDOUBLANT"')}+${si('e1."T3_F_REDOUBLANT"')} ELSE 0 END) AS red_t3,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T4_G_REDOUBLANT"')}+${si('e1."T4_F_REDOUBLANT"')} ELSE 0 END) AS red_t4,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T5_G_REDOUBLANT"')}+${si('e1."T5_F_REDOUBLANT"')} ELSE 0 END) AS red_t5,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN 
          ${si('e1."T1_G_REDOUBLANT"')}+${si('e1."T2_G_REDOUBLANT"')}+${si('e1."T3_G_REDOUBLANT"')}+
          ${si('e1."T4_G_REDOUBLANT"')}+${si('e1."T5_G_REDOUBLANT"')} ELSE 0 END) AS red_g,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN 
          ${si('e1."T1_F_REDOUBLANT"')}+${si('e1."T2_F_REDOUBLANT"')}+${si('e1."T3_F_REDOUBLANT"')}+
          ${si('e1."T4_F_REDOUBLANT"')}+${si('e1."T5_F_REDOUBLANT"')} ELSE 0 END) AS red_f,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T1_G"')}+${si('e1."T1_F"')} ELSE 0 END) AS eff_t1,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T2_G"')}+${si('e1."T2_F"')} ELSE 0 END) AS eff_t2,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T3_G"')}+${si('e1."T3_F"')} ELSE 0 END) AS eff_t3,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T4_G"')}+${si('e1."T4_F"')} ELSE 0 END) AS eff_t4,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T5_G"')}+${si('e1."T5_F"')} ELSE 0 END) AS eff_t5,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T1_G"')} ELSE 0 END) AS eff_t1_g,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T1_F"')} ELSE 0 END) AS eff_t1_f,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T5_G"')} ELSE 0 END) AS eff_t5_g,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T5_F"')} ELSE 0 END) AS eff_t5_f,
        COUNT(DISTINCT CASE WHEN a1."EXISTE_PRIMAIRE"=1 AND a1."EST_ALIMENTE_EAU"='1' THEN a1."CODE_ETAB" END) AS etab_eau,
        COUNT(DISTINCT CASE WHEN a1."EXISTE_PRIMAIRE"=1 AND a1."EST_ELECTRIFIE"='1' THEN a1."CODE_ETAB" END) AS etab_elec,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN 
          ${si('e1."T1_G_2KM"')}+${si('e1."T1_F_2KM"')}+${si('e1."T2_G_2KM"')}+${si('e1."T2_F_2KM"')}+
          ${si('e1."T3_G_2KM"')}+${si('e1."T3_F_2KM"')}+${si('e1."T4_G_2KM"')}+${si('e1."T4_F_2KM"')}+
          ${si('e1."T5_G_2KM"')}+${si('e1."T5_F_2KM"')} ELSE 0 END) AS eleve_2km,
        SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 AND (${si('e1."T5_G"')}+${si('e1."T5_F"')}) > 0 THEN 1 ELSE 0 END) AS ecole_continue
      FROM fpe_a1 a1
      LEFT JOIN fpe_e1 e1 ON e1."CODE_ETAB" = a1."CODE_ETAB" AND e1."ANNEE_SCOLAIRE" = a1."ANNEE_SCOLAIRE" AND e1."SECTEUR" = a1."SECTEUR"
      WHERE a1."ANNEE_SCOLAIRE" = ${annee} AND a1."SECTEUR" = 0 AND a1."EXISTE_PRIMAIRE" = 1 ${where}
    `;
    return (await client.queryObject(q)).rows[0] || {};
  }

  async function getPersonnel(where: string) {
    const q = `
      SELECT 
        SUM(CASE WHEN p1."CODE_STATUT" IN ('1','2','3','4') THEN 1 ELSE 0 END) AS nbr_pers,
        SUM(CASE WHEN p1."CODE_STATUT" IN ('1','2','3','4') AND ${si('p1."EN_SALLE"')} = 1 THEN 1 ELSE 0 END) AS pers_en_classe,
        SUM(CASE WHEN p1."CODE_STATUT" IN ('1','2') THEN 1 ELSE 0 END) AS fonctionnaire,
        SUM(CASE WHEN p1."CODE_STATUT" = '3' THEN 1 ELSE 0 END) AS sub,
        SUM(CASE WHEN p1."CODE_STATUT" = '4' THEN 1 ELSE 0 END) AS non_sub,
        SUM(CASE WHEN COALESCE(p1."DIPLOME_PEDAGOGIQUE",'') = '' THEN 1 ELSE 0 END) AS sans_diplome_ped
      FROM fpe_p1 p1
      INNER JOIN fpe_a1 a1 ON a1."CODE_ETAB" = p1."CODE_ETAB" AND a1."ANNEE_SCOLAIRE" = p1."ANNEE_SCOLAIRE"
      WHERE p1."ANNEE_SCOLAIRE" = ${annee} AND a1."EXISTE_PRIMAIRE" = 1 AND a1."SECTEUR" = 0 
        AND p1."NIVEAU_TENU_PRIMAIRE" = '1' ${where}
    `;
    return (await client.queryObject(q)).rows[0] || {};
  }

  async function getSections(where: string) {
    try {
      const q = `
        SELECT 
          SUM(${si('g1."T1_SECTION"')}+${si('g1."T2_SECTION"')}+${si('g1."T3_SECTION"')}+${si('g1."T4_SECTION"')}+${si('g1."T5_SECTION"')}) AS nbr_section,
          SUM(${si('j1."SDC_PRIMAIRE_BON_ETAT"')}+${si('j1."SDC_PRIMAIRE_MAUVAIS_ETAT"')}) AS nbr_sdc
        FROM fpe_a1 a1
        LEFT JOIN fpe_g1 g1 ON g1."CODE_ETAB"=a1."CODE_ETAB" AND g1."ANNEE_SCOLAIRE"=a1."ANNEE_SCOLAIRE"
        LEFT JOIN fpe_j1 j1 ON j1."CODE_ETAB"=a1."CODE_ETAB" AND j1."ANNEE_SCOLAIRE"=a1."ANNEE_SCOLAIRE"
        WHERE a1."ANNEE_SCOLAIRE"=${annee} AND a1."EXISTE_PRIMAIRE"=1 AND a1."SECTEUR"=0 ${where}
      `;
      return (await client.queryObject(q)).rows[0] || {};
    } catch(e) { console.error('getSections error:', e); return { nbr_section: 0, nbr_sdc: 0 }; }
  }

  async function getPlaces(where: string) {
    try {
      const q = `
        SELECT 
          SUM(
            (${si('k1."PRIMAIRE_TABLES_BANCS_1PL_BON_ETAT"')} + ${si('k1."PRIMAIRE_TABLES_BANCS_1PL_MAUVAIS_ETAT"')}) +
            (${si('k1."PRIMAIRE_TABLES_BANCS_2PL_BON_ETAT"')} + ${si('k1."PRIMAIRE_TABLES_BANCS_2PL_MAUVAIS_ETAT"')})*2 +
            (${si('k1."PRIMAIRE_TABLES_BANCS_3PL_BON_ETAT"')} + ${si('k1."PRIMAIRE_TABLES_BANCS_3PL_MAUVAIS_ETAT"')})*3 +
            (${si('k1."PRIMAIRE_TABLES_BANCS_4PL_BON_ETAT"')} + ${si('k1."PRIMAIRE_TABLES_BANCS_4PL_MAUVAIS_ETAT"')})*4 +
            (${si('k1."PRIMAIRE_TABLES_BANCS_5PL_PLUS_BON_ETAT"')} + ${si('k1."PRIMAIRE_TABLES_BANCS_5PL_PLUS_MAUVAIS_ETAT"')})*5
          ) AS places_assises,
          SUM(${si('j2."WC_LATRINES_COMMUNES_BON_ETAT"')}+${si('j2."WC_LATRINES_COMMUNES_MAUVAIS_ETAT"')}+
              ${si('j2."WC_LATRINES_FILLES_BON_ETAT"')}+${si('j2."WC_LATRINES_FILLES_MAUVAIS_ETAT"')}+
              ${si('j2."WC_LATRINES_GARCONS_BON_ETAT"')}+${si('j2."WC_LATRINES_GARCONS_MAUVAIS_ETAT"')}) AS latrines,
          SUM(${si('j2."WC_LATRINES_FILLES_BON_ETAT"')}+${si('j2."WC_LATRINES_FILLES_MAUVAIS_ETAT"')}) AS latrines_fille
        FROM fpe_a1 a1
        LEFT JOIN fpe_k1 k1 ON k1."CODE_ETAB"=a1."CODE_ETAB" AND k1."ANNEE_SCOLAIRE"=a1."ANNEE_SCOLAIRE"
        LEFT JOIN fpe_j2 j2 ON j2."CODE_ETAB"=a1."CODE_ETAB" AND j2."ANNEE_SCOLAIRE"=a1."ANNEE_SCOLAIRE"
        WHERE a1."ANNEE_SCOLAIRE"=${annee} AND a1."EXISTE_PRIMAIRE"=1 AND a1."SECTEUR"=0 ${where}
      `;
      return (await client.queryObject(q)).rows[0] || {};
    } catch(e) { console.error('getPlaces error:', e); return { places_assises: 0, latrines: 0, latrines_fille: 0 }; }
  }

  async function getCepe(where: string) {
    try {
      const q = `
        SELECT 
          SUM(COALESCE(c."Nbre",0)) AS total_candidats,
          SUM(COALESCE(c."nbrG",0)) AS nbr_g,
          SUM(COALESCE(c."nbrF",0)) AS nbr_f,
          SUM(COALESCE(c."admisG",0)) AS admis_g,
          SUM(COALESCE(c."admisF",0)) AS admis_f,
          CASE WHEN SUM(COALESCE(c."Nbre",0)) > 0 THEN ROUND((SUM(c."mlg" * c."Nbre") / SUM(c."Nbre"))::numeric, 1) END AS sm_mlg,
          CASE WHEN SUM(COALESCE(c."Nbre",0)) > 0 THEN ROUND((SUM(c."ml_fahazoana_lahatsoratra" * c."Nbre") / SUM(c."Nbre"))::numeric, 1) END AS sm_mlg_fahazoana,
          CASE WHEN SUM(COALESCE(c."Nbre",0)) > 0 THEN ROUND((SUM(c."ml_fitsipika" * c."Nbre") / SUM(c."Nbre"))::numeric, 1) END AS sm_mlg_fitsipika,
          CASE WHEN SUM(COALESCE(c."Nbre",0)) > 0 THEN ROUND((SUM(c."ml_fanazarana_hanoratra" * c."Nbre") / SUM(c."Nbre"))::numeric, 1) END AS sm_mlg_fanazarana,
          CASE WHEN SUM(COALESCE(c."Nbre",0)) > 0 THEN ROUND((SUM(c."frs" * c."Nbre") / SUM(c."Nbre"))::numeric, 1) END AS sm_frs,
          CASE WHEN SUM(COALESCE(c."Nbre",0)) > 0 THEN ROUND((SUM(c."fr_comprehension" * c."Nbre") / SUM(c."Nbre"))::numeric, 1) END AS sm_frs_comprehension,
          CASE WHEN SUM(COALESCE(c."Nbre",0)) > 0 THEN ROUND((SUM(c."fr_grammaire" * c."Nbre") / SUM(c."Nbre"))::numeric, 1) END AS sm_frs_grammaire,
          CASE WHEN SUM(COALESCE(c."Nbre",0)) > 0 THEN ROUND((SUM(c."fr_expression_ecrite" * c."Nbre") / SUM(c."Nbre"))::numeric, 1) END AS sm_frs_expression,
          CASE WHEN SUM(COALESCE(c."Nbre",0)) > 0 THEN ROUND((SUM(c."operation" * c."Nbre") / SUM(c."Nbre"))::numeric, 1) END AS sm_mths_operation,
          CASE WHEN SUM(COALESCE(c."Nbre",0)) > 0 THEN ROUND((SUM(c."probleme" * c."Nbre") / SUM(c."Nbre"))::numeric, 1) END AS sm_mths_probleme,
          CASE WHEN SUM(COALESCE(c."Nbre",0)) > 0 THEN ROUND((SUM((COALESCE(c."operation",0)+COALESCE(c."probleme",0))/2.0 * c."Nbre") / SUM(c."Nbre"))::numeric, 1) END AS sm_mths,
          CASE WHEN SUM(COALESCE(c."Nbre",0)) > 0 THEN ROUND((SUM(c."moyenne" * c."Nbre") / SUM(c."Nbre"))::numeric, 1) END AS sm_total,
          SUM(COALESCE(c."malagasy_sup_10",0)) AS mlg_sup10,
          SUM(COALESCE(c."malagasy_compo_sup_10",0)) AS mlg_compo_sup10,
          SUM(COALESCE(c."malagasy_gram_sup_10",0)) AS mlg_gram_sup10,
          SUM(COALESCE(c."malagasy_exp_10",0)) AS mlg_exp_sup10,
          SUM(COALESCE(c."francais_sup_10",0)) AS frs_sup10,
          SUM(COALESCE(c."francais_compo_sup_10",0)) AS frs_compo_sup10,
          SUM(COALESCE(c."francais_gram_sup_10",0)) AS frs_gram_sup10,
          SUM(COALESCE(c."francais_exp_10",0)) AS frs_exp_sup10,
          SUM(COALESCE(c."math_sup_10",0)) AS mths_sup10,
          SUM(COALESCE(c."op_sup_10",0)) AS op_sup10,
          SUM(COALESCE(c."probleme_sup_10",0)) AS prob_sup10,
          SUM(COALESCE(c."autres_sup_10",0)) AS autres_sup10
        FROM examen_cepe c
        INNER JOIN fpe_a1 a1 ON a1."CODE_ETAB" = c."code_etab" AND a1."ANNEE_SCOLAIRE" = c."id_annee_scolaire"
        WHERE c."id_annee_scolaire" = ${annee} AND a1."SECTEUR" = 0 ${where}
      `;
      return (await client.queryObject(q)).rows[0] || {};
    } catch(e) { console.error('getCepe error:', e); return {}; }
  }

  async function getCaisseEcole(where: string) {
    try {
      const q = `
        SELECT 
          SUM(COALESCE(ce."FCE",0)) AS total_fce,
          SUM(COALESCE(ce."TOTAL_A_DOTER",0)) AS total_a_doter
        FROM caisse_ecole ce
        INNER JOIN fpe_a1 a1 ON a1."CODE_ETAB" = ce."CODE_ETAB" AND a1."ANNEE_SCOLAIRE" = ce."ANNEE_SCOLAIRE"
        WHERE ce."ANNEE_SCOLAIRE" = ${annee} AND a1."EXISTE_PRIMAIRE" = 1 ${where}
      `;
      return (await client.queryObject(q)).rows[0] || {};
    } catch(e) { console.error('getCaisseEcole error:', e); return {}; }
  }

  async function getManuels(where: string) {
    try {
      const q = `
        SELECT 
          SUM(${si('l1."MALAGASY_T1"')}+${si('l1."MALAGASY_T2"')}+${si('l1."MALAGASY_T3"')}+${si('l1."MALAGASY_T4"')}+${si('l1."MALAGASY_T5"')}) AS malagasy,
          SUM(${si('l1."MATHS_T1"')}+${si('l1."MATHS_T2"')}+${si('l1."MATHS_T3"')}+${si('l1."MATHS_T4"')}+${si('l1."MATHS_T5"')}) AS maths,
          SUM(${si('l1."FRANCAIS_T1"')}+${si('l1."FRANCAIS_T2"')}+${si('l1."FRANCAIS_T3"')}+${si('l1."FRANCAIS_T4"')}+${si('l1."FRANCAIS_T5"')}) AS francais
        FROM fpe_l1 l1
        INNER JOIN fpe_a1 a1 ON a1."CODE_ETAB"=l1."CODE_ETAB" AND a1."ANNEE_SCOLAIRE"=l1."ANNEE_SCOLAIRE"
        WHERE l1."ANNEE_SCOLAIRE"=${annee} AND a1."EXISTE_PRIMAIRE"=1 AND a1."SECTEUR"=0 ${where}
      `;
      return (await client.queryObject(q)).rows[0] || {};
    } catch(e) { console.error('getManuels error:', e); return {}; }
  }

  async function getRessourcesFin(where: string) {
    try {
      const q = `
        SELECT 
          SUM(${si('m1."PARTICIPATION_FRAM_PRIMAIRE"')}) AS fram,
          SUM(${si('m1."SUBVENTION_ENS_PRIMAIRE"')}) AS subvention,
          SUM(${si('m1."DONS_PRIMAIRE"')} + ${si('m1."ALLEGEMENT_PRIMAIRE"')}) AS autres,
          SUM(${si('m1."PARTICIPATION_FRAM_PRIMAIRE"')}+${si('m1."SUBVENTION_ENS_PRIMAIRE"')}+${si('m1."DONS_PRIMAIRE"')}+${si('m1."ALLEGEMENT_PRIMAIRE"')}) AS total
        FROM fpe_m1 m1
        INNER JOIN fpe_a1 a1 ON a1."CODE_ETAB"=m1."CODE_ETAB" AND a1."ANNEE_SCOLAIRE"=m1."ANNEE_SCOLAIRE"
        WHERE m1."ANNEE_SCOLAIRE"=${annee} AND a1."EXISTE_PRIMAIRE"=1 AND a1."SECTEUR"=0 ${where}
      `;
      return (await client.queryObject(q)).rows[0] || {};
    } catch(e) { console.error('getRessourcesFin error:', e); return {}; }
  }

  // Efficience: get all ZAPs in the same CISCO for scatter plot
  async function getEfficience() {
    try {
      const q = `
        SELECT z."ZAP", z."CODE_ZAP",
          SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN 
            ${si('e1."T1_G"')}+${si('e1."T1_F"')}+${si('e1."T2_G"')}+${si('e1."T2_F"')}+
            ${si('e1."T3_G"')}+${si('e1."T3_F"')}+${si('e1."T4_G"')}+${si('e1."T4_F"')}+
            ${si('e1."T5_G"')}+${si('e1."T5_F"')} ELSE 0 END) AS nbr_eleve,
          SUM(CASE WHEN p1."CODE_STATUT" IN ('1','2','3','4') AND ${si('p1."EN_SALLE"')}=1 THEN 1 ELSE 0 END) AS pers_en_classe,
          SUM(COALESCE(c."admisG",0)+COALESCE(c."admisF",0)) AS admis,
          SUM(COALESCE(c."Nbre",0)) AS inscrits_cepe
        FROM v_zap z
        LEFT JOIN fpe_a1 a1 ON a1."CODE_ZAP" = z."CODE_ZAP" AND a1."ANNEE_SCOLAIRE" = ${annee} AND a1."SECTEUR" = 0 AND a1."EXISTE_PRIMAIRE" = 1
        LEFT JOIN fpe_e1 e1 ON e1."CODE_ETAB" = a1."CODE_ETAB" AND e1."ANNEE_SCOLAIRE" = a1."ANNEE_SCOLAIRE" AND e1."SECTEUR" = a1."SECTEUR"
        LEFT JOIN fpe_p1 p1 ON p1."CODE_ETAB" = a1."CODE_ETAB" AND p1."ANNEE_SCOLAIRE" = a1."ANNEE_SCOLAIRE" AND p1."NIVEAU_TENU_PRIMAIRE"='1'
        LEFT JOIN examen_cepe c ON c."code_etab" = a1."CODE_ETAB" AND c."id_annee_scolaire" = a1."ANNEE_SCOLAIRE"
        WHERE z."CODE_CISCO" = ${codeCisco}
        GROUP BY z."ZAP", z."CODE_ZAP"
        ORDER BY z."ZAP"
      `;
      return (await client.queryObject(q)).rows || [];
    } catch(e) { console.error('getEfficience error:', e); return []; }
  }

  // Suivi longitudinal: CP1 enrollments across 4 years for the current ZAP
  async function getSuiviLongitudinal() {
    try {
      const years = [annee - 3, annee - 2, annee - 1, annee];
      const results = [];
      for (const yr of years) {
        const q = `
          SELECT 
            SUM(${si('e1."T1_G"')}+${si('e1."T1_F"')}) AS t1_ensemble,
            SUM(${si('e1."T1_G"')}) AS t1_g,
            SUM(${si('e1."T1_F"')}) AS t1_f
          FROM fpe_a1 a1
          LEFT JOIN fpe_e1 e1 ON e1."CODE_ETAB" = a1."CODE_ETAB" AND e1."ANNEE_SCOLAIRE" = a1."ANNEE_SCOLAIRE" AND e1."SECTEUR" = a1."SECTEUR"
          WHERE a1."ANNEE_SCOLAIRE" = ${yr} AND a1."SECTEUR" = 0 AND a1."EXISTE_PRIMAIRE" = 1 ${whereZap}
        `;
        const row = (await client.queryObject(q)).rows[0] || {};
        results.push({ annee: yr, label: `T1-${yr}`, ...row });
      }
      return results;
    } catch(e) { console.error('getSuiviLongitudinal error:', e); return []; }
  }

  const [
    resZap, resCisco, resDren,
    persZap, persCisco, persDren,
    secZap, secCisco, secDren,
    plZap, plCisco, plDren,
    cepeZap, cepeCisco, cepeDren,
    ceZap, ceCisco, ceDren,
    manZap, manCisco, manDren,
    rfZap, rfCisco, rfDren,
    efficience, suiviLongitudinal
  ] = await Promise.all([
    getRessources(whereZap), getRessources(whereCisco), getRessources(whereDren),
    getPersonnel(whereZap), getPersonnel(whereCisco), getPersonnel(whereDren),
    getSections(whereZap), getSections(whereCisco), getSections(whereDren),
    getPlaces(whereZap), getPlaces(whereCisco), getPlaces(whereDren),
    getCepe(whereZap), getCepe(whereCisco), getCepe(whereDren),
    getCaisseEcole(whereZap), getCaisseEcole(whereCisco), getCaisseEcole(whereDren),
    getManuels(whereZap), getManuels(whereCisco), getManuels(whereDren),
    getRessourcesFin(whereZap), getRessourcesFin(whereCisco), getRessourcesFin(whereDren),
    getEfficience(), getSuiviLongitudinal(),
  ]);

  const namesResult = await client.queryObject(`
    SELECT z."ZAP", z."CODE_ZAP", c."CISCO", d."DREN"
    FROM v_zap z 
    INNER JOIN v_cisco c ON c."CODE_CISCO" = z."CODE_CISCO"
    INNER JOIN v_dren d ON d."CODE_DREN" = c."CODE_DREN"
    WHERE z."CODE_ZAP" = ${codeZap}
  `);
  const names = namesResult.rows[0] || { ZAP: '', CISCO: '', DREN: '' };

  return {
    version: VERSION,
    names,
    annee,
    zap: { ressources: resZap, personnel: persZap, sections: secZap, places: plZap, cepe: cepeZap, caisse: ceZap, manuels: manZap, finances: rfZap },
    cisco: { ressources: resCisco, personnel: persCisco, sections: secCisco, places: plCisco, cepe: cepeCisco, caisse: ceCisco, manuels: manCisco, finances: rfCisco },
    dren: { ressources: resDren, personnel: persDren, sections: secDren, places: plDren, cepe: cepeDren, caisse: ceDren, manuels: manDren, finances: rfDren },
    efficience,
    suiviLongitudinal,
  };
}

// ============ TDB ECOLE ============
async function executeTdbEcoleData(client: Client, codeEtab: number, codeZap: number, codeCisco: number, codeDren: number, annee: number) {
  const whereEcole = `AND a1."CODE_ETAB" = ${codeEtab}`;
  const whereZap = `AND a1."CODE_ZAP" = ${codeZap}`;
  const whereCisco = `AND a1."CODE_CISCO" = ${codeCisco}`;

  async function getRessources(where: string) {
    const q = `SELECT 
      COUNT(DISTINCT CASE WHEN a1."EXISTE_PRIMAIRE"=1 THEN a1."CODE_ETAB" END) AS nbr_etab,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T1_G"')}+${si('e1."T1_F"')}+${si('e1."T2_G"')}+${si('e1."T2_F"')}+${si('e1."T3_G"')}+${si('e1."T3_F"')}+${si('e1."T4_G"')}+${si('e1."T4_F"')}+${si('e1."T5_G"')}+${si('e1."T5_F"')} ELSE 0 END) AS nbr_eleve,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T1_G"')}+${si('e1."T2_G"')}+${si('e1."T3_G"')}+${si('e1."T4_G"')}+${si('e1."T5_G"')} ELSE 0 END) AS nbr_eleve_g,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T1_F"')}+${si('e1."T2_F"')}+${si('e1."T3_F"')}+${si('e1."T4_F"')}+${si('e1."T5_F"')} ELSE 0 END) AS nbr_eleve_f,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T1_G_REDOUBLANT"')}+${si('e1."T1_F_REDOUBLANT"')} ELSE 0 END) AS red_t1,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T2_G_REDOUBLANT"')}+${si('e1."T2_F_REDOUBLANT"')} ELSE 0 END) AS red_t2,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T3_G_REDOUBLANT"')}+${si('e1."T3_F_REDOUBLANT"')} ELSE 0 END) AS red_t3,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T4_G_REDOUBLANT"')}+${si('e1."T4_F_REDOUBLANT"')} ELSE 0 END) AS red_t4,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T5_G_REDOUBLANT"')}+${si('e1."T5_F_REDOUBLANT"')} ELSE 0 END) AS red_t5,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T1_G_REDOUBLANT"')}+${si('e1."T2_G_REDOUBLANT"')}+${si('e1."T3_G_REDOUBLANT"')}+${si('e1."T4_G_REDOUBLANT"')}+${si('e1."T5_G_REDOUBLANT"')} ELSE 0 END) AS red_g,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T1_F_REDOUBLANT"')}+${si('e1."T2_F_REDOUBLANT"')}+${si('e1."T3_F_REDOUBLANT"')}+${si('e1."T4_F_REDOUBLANT"')}+${si('e1."T5_F_REDOUBLANT"')} ELSE 0 END) AS red_f,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T1_G"')}+${si('e1."T1_F"')} ELSE 0 END) AS eff_t1,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T2_G"')}+${si('e1."T2_F"')} ELSE 0 END) AS eff_t2,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T3_G"')}+${si('e1."T3_F"')} ELSE 0 END) AS eff_t3,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T4_G"')}+${si('e1."T4_F"')} ELSE 0 END) AS eff_t4,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T5_G"')}+${si('e1."T5_F"')} ELSE 0 END) AS eff_t5,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T1_G"')} ELSE 0 END) AS eff_t1_g,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T1_F"')} ELSE 0 END) AS eff_t1_f,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T5_G"')} ELSE 0 END) AS eff_t5_g,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T5_F"')} ELSE 0 END) AS eff_t5_f,
      COUNT(DISTINCT CASE WHEN a1."EXISTE_PRIMAIRE"=1 AND a1."EST_ALIMENTE_EAU"='1' THEN a1."CODE_ETAB" END) AS etab_eau,
      COUNT(DISTINCT CASE WHEN a1."EXISTE_PRIMAIRE"=1 AND a1."EST_ELECTRIFIE"='1' THEN a1."CODE_ETAB" END) AS etab_elec,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 THEN ${si('e1."T1_G_2KM"')}+${si('e1."T1_F_2KM"')}+${si('e1."T2_G_2KM"')}+${si('e1."T2_F_2KM"')}+${si('e1."T3_G_2KM"')}+${si('e1."T3_F_2KM"')}+${si('e1."T4_G_2KM"')}+${si('e1."T4_F_2KM"')}+${si('e1."T5_G_2KM"')}+${si('e1."T5_F_2KM"')} ELSE 0 END) AS eleve_2km,
      SUM(CASE WHEN e1."EXISTE_PRIMAIRE"=1 AND (${si('e1."T5_G"')}+${si('e1."T5_F"')}) > 0 THEN 1 ELSE 0 END) AS ecole_continue
    FROM fpe_a1 a1 LEFT JOIN fpe_e1 e1 ON e1."CODE_ETAB"=a1."CODE_ETAB" AND e1."ANNEE_SCOLAIRE"=a1."ANNEE_SCOLAIRE" AND e1."SECTEUR"=a1."SECTEUR"
    WHERE a1."ANNEE_SCOLAIRE"=${annee} AND a1."SECTEUR"=0 AND a1."EXISTE_PRIMAIRE"=1 ${where}`;
    return (await client.queryObject(q)).rows[0] || {};
  }
  async function getPersonnel(where: string) {
    const q = `SELECT SUM(CASE WHEN p1."CODE_STATUT" IN ('1','2','3','4') THEN 1 ELSE 0 END) AS nbr_pers,
      SUM(CASE WHEN p1."CODE_STATUT" IN ('1','2','3','4') AND ${si('p1."EN_SALLE"')}=1 THEN 1 ELSE 0 END) AS pers_en_classe,
      SUM(CASE WHEN p1."CODE_STATUT" IN ('1','2') THEN 1 ELSE 0 END) AS fonctionnaire,
      SUM(CASE WHEN p1."CODE_STATUT"='3' THEN 1 ELSE 0 END) AS sub,
      SUM(CASE WHEN p1."CODE_STATUT"='4' THEN 1 ELSE 0 END) AS non_sub,
      SUM(CASE WHEN COALESCE(p1."DIPLOME_PEDAGOGIQUE",'')='' THEN 1 ELSE 0 END) AS sans_diplome_ped
    FROM fpe_p1 p1 INNER JOIN fpe_a1 a1 ON a1."CODE_ETAB"=p1."CODE_ETAB" AND a1."ANNEE_SCOLAIRE"=p1."ANNEE_SCOLAIRE"
    WHERE p1."ANNEE_SCOLAIRE"=${annee} AND a1."EXISTE_PRIMAIRE"=1 AND a1."SECTEUR"=0 AND p1."NIVEAU_TENU_PRIMAIRE"='1' ${where}`;
    return (await client.queryObject(q)).rows[0] || {};
  }
  async function getSections(where: string) {
    try { const q = `SELECT SUM(${si('g1."T1_SECTION"')}+${si('g1."T2_SECTION"')}+${si('g1."T3_SECTION"')}+${si('g1."T4_SECTION"')}+${si('g1."T5_SECTION"')}) AS nbr_section, SUM(${si('j1."SDC_PRIMAIRE_BON_ETAT"')}+${si('j1."SDC_PRIMAIRE_MAUVAIS_ETAT"')}) AS nbr_sdc FROM fpe_a1 a1 LEFT JOIN fpe_g1 g1 ON g1."CODE_ETAB"=a1."CODE_ETAB" AND g1."ANNEE_SCOLAIRE"=a1."ANNEE_SCOLAIRE" LEFT JOIN fpe_j1 j1 ON j1."CODE_ETAB"=a1."CODE_ETAB" AND j1."ANNEE_SCOLAIRE"=a1."ANNEE_SCOLAIRE" WHERE a1."ANNEE_SCOLAIRE"=${annee} AND a1."EXISTE_PRIMAIRE"=1 AND a1."SECTEUR"=0 ${where}`; return (await client.queryObject(q)).rows[0] || {}; } catch(e) { return { nbr_section: 0, nbr_sdc: 0 }; }
  }
  async function getPlaces(where: string) {
    try { const q = `SELECT SUM((${si('k1."PRIMAIRE_TABLES_BANCS_1PL_BON_ETAT"')}+${si('k1."PRIMAIRE_TABLES_BANCS_1PL_MAUVAIS_ETAT"')})+(${si('k1."PRIMAIRE_TABLES_BANCS_2PL_BON_ETAT"')}+${si('k1."PRIMAIRE_TABLES_BANCS_2PL_MAUVAIS_ETAT"')})*2+(${si('k1."PRIMAIRE_TABLES_BANCS_3PL_BON_ETAT"')}+${si('k1."PRIMAIRE_TABLES_BANCS_3PL_MAUVAIS_ETAT"')})*3+(${si('k1."PRIMAIRE_TABLES_BANCS_4PL_BON_ETAT"')}+${si('k1."PRIMAIRE_TABLES_BANCS_4PL_MAUVAIS_ETAT"')})*4+(${si('k1."PRIMAIRE_TABLES_BANCS_5PL_PLUS_BON_ETAT"')}+${si('k1."PRIMAIRE_TABLES_BANCS_5PL_PLUS_MAUVAIS_ETAT"')})*5) AS places_assises, SUM(${si('j2."WC_LATRINES_COMMUNES_BON_ETAT"')}+${si('j2."WC_LATRINES_COMMUNES_MAUVAIS_ETAT"')}+${si('j2."WC_LATRINES_FILLES_BON_ETAT"')}+${si('j2."WC_LATRINES_FILLES_MAUVAIS_ETAT"')}+${si('j2."WC_LATRINES_GARCONS_BON_ETAT"')}+${si('j2."WC_LATRINES_GARCONS_MAUVAIS_ETAT"')}) AS latrines, SUM(${si('j2."WC_LATRINES_FILLES_BON_ETAT"')}+${si('j2."WC_LATRINES_FILLES_MAUVAIS_ETAT"')}) AS latrines_fille FROM fpe_a1 a1 LEFT JOIN fpe_k1 k1 ON k1."CODE_ETAB"=a1."CODE_ETAB" AND k1."ANNEE_SCOLAIRE"=a1."ANNEE_SCOLAIRE" LEFT JOIN fpe_j2 j2 ON j2."CODE_ETAB"=a1."CODE_ETAB" AND j2."ANNEE_SCOLAIRE"=a1."ANNEE_SCOLAIRE" WHERE a1."ANNEE_SCOLAIRE"=${annee} AND a1."EXISTE_PRIMAIRE"=1 AND a1."SECTEUR"=0 ${where}`; return (await client.queryObject(q)).rows[0] || {}; } catch(e) { return { places_assises: 0, latrines: 0, latrines_fille: 0 }; }
  }
  async function getCepe(where: string) {
    try { const q = `SELECT SUM(COALESCE(c."Nbre",0)) AS total_candidats, SUM(COALESCE(c."nbrG",0)) AS nbr_g, SUM(COALESCE(c."nbrF",0)) AS nbr_f, SUM(COALESCE(c."admisG",0)) AS admis_g, SUM(COALESCE(c."admisF",0)) AS admis_f, CASE WHEN SUM(COALESCE(c."Nbre",0))>0 THEN ROUND((SUM(c."mlg"*c."Nbre")/SUM(c."Nbre"))::numeric,1) END AS sm_mlg, CASE WHEN SUM(COALESCE(c."Nbre",0))>0 THEN ROUND((SUM(c."ml_fahazoana_lahatsoratra"*c."Nbre")/SUM(c."Nbre"))::numeric,1) END AS sm_mlg_fahazoana, CASE WHEN SUM(COALESCE(c."Nbre",0))>0 THEN ROUND((SUM(c."ml_fitsipika"*c."Nbre")/SUM(c."Nbre"))::numeric,1) END AS sm_mlg_fitsipika, CASE WHEN SUM(COALESCE(c."Nbre",0))>0 THEN ROUND((SUM(c."ml_fanazarana_hanoratra"*c."Nbre")/SUM(c."Nbre"))::numeric,1) END AS sm_mlg_fanazarana, CASE WHEN SUM(COALESCE(c."Nbre",0))>0 THEN ROUND((SUM(c."frs"*c."Nbre")/SUM(c."Nbre"))::numeric,1) END AS sm_frs, CASE WHEN SUM(COALESCE(c."Nbre",0))>0 THEN ROUND((SUM(c."fr_comprehension"*c."Nbre")/SUM(c."Nbre"))::numeric,1) END AS sm_frs_comprehension, CASE WHEN SUM(COALESCE(c."Nbre",0))>0 THEN ROUND((SUM(c."fr_grammaire"*c."Nbre")/SUM(c."Nbre"))::numeric,1) END AS sm_frs_grammaire, CASE WHEN SUM(COALESCE(c."Nbre",0))>0 THEN ROUND((SUM(c."fr_expression_ecrite"*c."Nbre")/SUM(c."Nbre"))::numeric,1) END AS sm_frs_expression, CASE WHEN SUM(COALESCE(c."Nbre",0))>0 THEN ROUND((SUM(c."operation"*c."Nbre")/SUM(c."Nbre"))::numeric,1) END AS sm_mths_operation, CASE WHEN SUM(COALESCE(c."Nbre",0))>0 THEN ROUND((SUM(c."probleme"*c."Nbre")/SUM(c."Nbre"))::numeric,1) END AS sm_mths_probleme, CASE WHEN SUM(COALESCE(c."Nbre",0))>0 THEN ROUND((SUM((COALESCE(c."operation",0)+COALESCE(c."probleme",0))/2.0*c."Nbre")/SUM(c."Nbre"))::numeric,1) END AS sm_mths, CASE WHEN SUM(COALESCE(c."Nbre",0))>0 THEN ROUND((SUM(c."moyenne"*c."Nbre")/SUM(c."Nbre"))::numeric,1) END AS sm_total, SUM(COALESCE(c."malagasy_sup_10",0)) AS mlg_sup10, SUM(COALESCE(c."malagasy_compo_sup_10",0)) AS mlg_compo_sup10, SUM(COALESCE(c."malagasy_gram_sup_10",0)) AS mlg_gram_sup10, SUM(COALESCE(c."malagasy_exp_10",0)) AS mlg_exp_sup10, SUM(COALESCE(c."francais_sup_10",0)) AS frs_sup10, SUM(COALESCE(c."francais_compo_sup_10",0)) AS frs_compo_sup10, SUM(COALESCE(c."francais_gram_sup_10",0)) AS frs_gram_sup10, SUM(COALESCE(c."francais_exp_10",0)) AS frs_exp_sup10, SUM(COALESCE(c."math_sup_10",0)) AS mths_sup10, SUM(COALESCE(c."op_sup_10",0)) AS op_sup10, SUM(COALESCE(c."probleme_sup_10",0)) AS prob_sup10, SUM(COALESCE(c."autres_sup_10",0)) AS autres_sup10 FROM examen_cepe c INNER JOIN fpe_a1 a1 ON a1."CODE_ETAB"=c."code_etab" AND a1."ANNEE_SCOLAIRE"=c."id_annee_scolaire" WHERE c."id_annee_scolaire"=${annee} AND a1."SECTEUR"=0 ${where}`; return (await client.queryObject(q)).rows[0] || {}; } catch(e) { return {}; }
  }
  async function getCaisseEcole(where: string) {
    try { const q = `SELECT SUM(COALESCE(ce."FCE",0)) AS total_fce, SUM(COALESCE(ce."TOTAL_A_DOTER",0)) AS total_a_doter FROM caisse_ecole ce INNER JOIN fpe_a1 a1 ON a1."CODE_ETAB"=ce."CODE_ETAB" AND a1."ANNEE_SCOLAIRE"=ce."ANNEE_SCOLAIRE" WHERE ce."ANNEE_SCOLAIRE"=${annee} AND a1."EXISTE_PRIMAIRE"=1 ${where}`; return (await client.queryObject(q)).rows[0] || {}; } catch(e) { return {}; }
  }
  async function getManuels(where: string) {
    try { const q = `SELECT SUM(${si('l1."MALAGASY_T1"')}+${si('l1."MALAGASY_T2"')}+${si('l1."MALAGASY_T3"')}+${si('l1."MALAGASY_T4"')}+${si('l1."MALAGASY_T5"')}) AS malagasy, SUM(${si('l1."MATHS_T1"')}+${si('l1."MATHS_T2"')}+${si('l1."MATHS_T3"')}+${si('l1."MATHS_T4"')}+${si('l1."MATHS_T5"')}) AS maths, SUM(${si('l1."FRANCAIS_T1"')}+${si('l1."FRANCAIS_T2"')}+${si('l1."FRANCAIS_T3"')}+${si('l1."FRANCAIS_T4"')}+${si('l1."FRANCAIS_T5"')}) AS francais FROM fpe_l1 l1 INNER JOIN fpe_a1 a1 ON a1."CODE_ETAB"=l1."CODE_ETAB" AND a1."ANNEE_SCOLAIRE"=l1."ANNEE_SCOLAIRE" WHERE l1."ANNEE_SCOLAIRE"=${annee} AND a1."EXISTE_PRIMAIRE"=1 AND a1."SECTEUR"=0 ${where}`; return (await client.queryObject(q)).rows[0] || {}; } catch(e) { return {}; }
  }
  async function getRessourcesFin(where: string) {
    try { const q = `SELECT SUM(${si('m1."PARTICIPATION_FRAM_PRIMAIRE"')}) AS fram, SUM(${si('m1."SUBVENTION_ENS_PRIMAIRE"')}) AS subvention, SUM(${si('m1."DONS_PRIMAIRE"')}+${si('m1."ALLEGEMENT_PRIMAIRE"')}) AS autres, SUM(${si('m1."PARTICIPATION_FRAM_PRIMAIRE"')}+${si('m1."SUBVENTION_ENS_PRIMAIRE"')}+${si('m1."DONS_PRIMAIRE"')}+${si('m1."ALLEGEMENT_PRIMAIRE"')}) AS total FROM fpe_m1 m1 INNER JOIN fpe_a1 a1 ON a1."CODE_ETAB"=m1."CODE_ETAB" AND a1."ANNEE_SCOLAIRE"=m1."ANNEE_SCOLAIRE" WHERE m1."ANNEE_SCOLAIRE"=${annee} AND a1."EXISTE_PRIMAIRE"=1 AND a1."SECTEUR"=0 ${where}`; return (await client.queryObject(q)).rows[0] || {}; } catch(e) { return {}; }
  }

  const [
    resEcole, resZap, resCisco,
    persEcole, persZap, persCisco,
    secEcole, secZap, secCisco,
    plEcole, plZap, plCisco,
    cepeEcole, cepeZap, cepeCisco,
    ceEcole, ceZap, ceCisco,
    manEcole, manZap, manCisco,
    rfEcole, rfZap, rfCisco
  ] = await Promise.all([
    getRessources(whereEcole), getRessources(whereZap), getRessources(whereCisco),
    getPersonnel(whereEcole), getPersonnel(whereZap), getPersonnel(whereCisco),
    getSections(whereEcole), getSections(whereZap), getSections(whereCisco),
    getPlaces(whereEcole), getPlaces(whereZap), getPlaces(whereCisco),
    getCepe(whereEcole), getCepe(whereZap), getCepe(whereCisco),
    getCaisseEcole(whereEcole), getCaisseEcole(whereZap), getCaisseEcole(whereCisco),
    getManuels(whereEcole), getManuels(whereZap), getManuels(whereCisco),
    getRessourcesFin(whereEcole), getRessourcesFin(whereZap), getRessourcesFin(whereCisco),
  ]);

  const namesResult = await client.queryObject(`
    SELECT a1."NOM_ETAB", a1."CODE_ETAB", z."ZAP", z."CODE_ZAP", c."CISCO", d."DREN"
    FROM fpe_a1 a1
    INNER JOIN v_zap z ON z."CODE_ZAP" = a1."CODE_ZAP"
    INNER JOIN v_cisco c ON c."CODE_CISCO" = z."CODE_CISCO"
    INNER JOIN v_dren d ON d."CODE_DREN" = c."CODE_DREN"
    WHERE a1."CODE_ETAB" = ${codeEtab} AND a1."ANNEE_SCOLAIRE" = ${annee}
    LIMIT 1
  `);
  const names = namesResult.rows[0] || { NOM_ETAB: '', CODE_ETAB: codeEtab, ZAP: '', CISCO: '', DREN: '' };

  return {
    version: VERSION,
    names,
    annee,
    ecole: { ressources: resEcole, personnel: persEcole, sections: secEcole, places: plEcole, cepe: cepeEcole, caisse: ceEcole, manuels: manEcole, finances: rfEcole },
    zap: { ressources: resZap, personnel: persZap, sections: secZap, places: plZap, cepe: cepeZap, caisse: ceZap, manuels: manZap, finances: rfZap },
    cisco: { ressources: resCisco, personnel: persCisco, sections: secCisco, places: plCisco, cepe: cepeCisco, caisse: ceCisco, manuels: manCisco, finances: rfCisco },
  };
}

// ============ Diploma distribution ============
async function executeStatsDiplomes(client: Client, codeDren: number, codeCisco: number, secteur: number) {
  const sect = secteur > 1 ? ">= 0" : `= ${secteur}`;
  let whereClause = "";
  if (codeDren > 0 && codeCisco === 0) { whereClause = `AND p1."CODE_DREN" = ${codeDren}`; }
  else if (codeCisco > 0) { whereClause = `AND p1."CODE_CISCO" = ${codeCisco}`; }

  // Primaire diplomas
  const qPrimaire = `
    SELECT 
      COALESCE(p1."DIPLOME_ACADEMIQUE", 'NON RENSEIGNE') AS diplome,
      COUNT(*) AS total
    FROM fpe_p1 p1
    INNER JOIN fpe_a1 a1 ON a1."CODE_ETAB" = p1."CODE_ETAB" AND a1."ANNEE_SCOLAIRE" = p1."ANNEE_SCOLAIRE"
    WHERE p1."ANNEE_SCOLAIRE" = 2025 AND a1."EXISTE_PRIMAIRE" = 1 AND a1."SECTEUR" ${sect}
      AND p1."NIVEAU_TENU_PRIMAIRE" = '1' ${whereClause}
    GROUP BY p1."DIPLOME_ACADEMIQUE"
    ORDER BY total DESC
  `;

  // College diplomas
  const qCollege = `
    SELECT 
      COALESCE(p1."DIPLOME_ACADEMIQUE", 'NON RENSEIGNE') AS diplome,
      COUNT(*) AS total
    FROM fpe_p1 p1
    INNER JOIN fpe_a1 a1 ON a1."CODE_ETAB" = p1."CODE_ETAB" AND a1."ANNEE_SCOLAIRE" = p1."ANNEE_SCOLAIRE"
    WHERE p1."ANNEE_SCOLAIRE" = 2025 AND a1."EXISTE_COLLEGE" = 1 AND a1."SECTEUR" ${sect}
      AND p1."NIVEAU_TENU_COLLEGE" = '1' ${whereClause}
    GROUP BY p1."DIPLOME_ACADEMIQUE"
    ORDER BY total DESC
  `;

  // Lycee diplomas
  const qLycee = `
    SELECT 
      COALESCE(p1."DIPLOME_ACADEMIQUE", 'NON RENSEIGNE') AS diplome,
      COUNT(*) AS total
    FROM fpe_p1 p1
    INNER JOIN fpe_a1 a1 ON a1."CODE_ETAB" = p1."CODE_ETAB" AND a1."ANNEE_SCOLAIRE" = p1."ANNEE_SCOLAIRE"
    WHERE p1."ANNEE_SCOLAIRE" = 2025 AND a1."EXISTE_LYCEE" = 1 AND a1."SECTEUR" ${sect}
      AND p1."NIVEAU_TENU_LYCEE" = '1' ${whereClause}
    GROUP BY p1."DIPLOME_ACADEMIQUE"
    ORDER BY total DESC
  `;

  const [primaire, college, lycee] = await Promise.all([
    client.queryObject(qPrimaire),
    client.queryObject(qCollege),
    client.queryObject(qLycee),
  ]);

  return { rows: [{ primaire: primaire.rows, college: college.rows, lycee: lycee.rows }] };
}
