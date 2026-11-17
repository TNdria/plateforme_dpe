/**
 * Endpoint serveur — données scolaires des millésimes récents (2026+).
 *
 * La fonction Supabase `db-query` peut renvoyer des données figées sur 2025.
 * Cet endpoint interroge directement PostgreSQL, côté serveur, pour les années
 * postérieures, en réutilisant exactement le SQL partagé de
 * `supabase/functions/_shared/donneesRecent.ts`.
 *
 * GET /api/donnees?action=getDataPrimaire&code_dren=0&code_cisco=0&code_commune=0&code_zap=0&secteur=2&annee=2026
 *
 * Variables d'environnement (côté serveur uniquement, jamais exposées au bundle) :
 *   DATABASE_URL (prioritaire) ou DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD
 *   (repli sur les variables standard PG*).
 */

import pg from "pg";
import {
  DATA_RECENT_ACTIONS,
  MIN_RECENT_ANNEE,
  buildDonneesRecentSql,
  type DataRecentLevel,
} from "../supabase/functions/_shared/donneesRecent";

const { Pool, types } = pg;

// int8/bigint : la fonction Supabase renvoie des nombres, on garde le même
// contrat côté client plutôt que des chaînes.
types.setTypeParser(20, (value: string) => Number(value));
// numeric : les agrégats peuvent dépasser la précision utile côté affichage.
types.setTypeParser(1700, (value: string) => Number(value));

let pool: pg.Pool | null = null;

function getConnectionConfig(): pg.PoolConfig {
  // Vercel/Supabase exposent parfois l'URL sous d'autres noms selon
  // l'intégration utilisée ; on accepte les conventions les plus courantes
  // pour que `/api/donnees` fonctionne aussi sans configuration manuelle.
  const connectionString =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.SUPABASE_DB_URL ??
    process.env.PGURL;
  if (connectionString) {
    return {
      connectionString,
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      ssl:
        process.env.DB_SSL === "true" ||
        /sslmode=(require|verify)/.test(connectionString) ||
        /supabase\.(co|com)/.test(connectionString)
          ? { rejectUnauthorized: false }
          : undefined,
    };
  }

  const host = process.env.DB_HOST ?? process.env.PGHOST ?? process.env.POSTGRES_HOST;
  const port = Number(
    process.env.DB_PORT ?? process.env.PGPORT ?? process.env.POSTGRES_PORT ?? 5432,
  );
  const database =
    process.env.DB_NAME ?? process.env.PGDATABASE ?? process.env.POSTGRES_DATABASE;
  const user = process.env.DB_USER ?? process.env.PGUSER ?? process.env.POSTGRES_USER;
  const password =
    process.env.DB_PASSWORD ?? process.env.PGPASSWORD ?? process.env.POSTGRES_PASSWORD;

  if (!host || !database || !user) {
    throw new Error(
      "Configuration base de données manquante (DATABASE_URL, POSTGRES_URL ou DB_HOST/DB_NAME/DB_USER).",
    );
  }

  return {
    host,
    port,
    database,
    user,
    password,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  };
}

function getPool(): pg.Pool {
  if (!pool) pool = new Pool(getConnectionConfig());
  return pool;
}

export interface DonneesQuery {
  action: string;
  codeDren: number;
  codeCisco: number;
  codeCommune: number;
  codeZap: number;
  secteur: number;
  annee: number;
}

function parseInteger(raw: string | null | undefined, fallback: number): number | null {
  if (raw == null || raw === "") return fallback;
  const value = Number(raw);
  return Number.isInteger(value) ? value : null;
}

type QueryInput = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | null {
  if (value == null) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export class DonneesRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "DonneesRequestError";
  }
}

function parseCode(raw: string | null | undefined, name: string): number {
  const value = parseInteger(raw, 0);
  if (value == null || value < 0) {
    throw new DonneesRequestError(400, `Paramètre invalide: ${name}`);
  }
  return value;
}

export function parseDonneesQuery(input: QueryInput): DonneesQuery {
  const action = firstValue(input.action) ?? "";
  if (!(action in DATA_RECENT_ACTIONS)) {
    throw new DonneesRequestError(400, `Action non supportée: ${action || "(vide)"}`);
  }

  const annee = parseInteger(firstValue(input.annee), MIN_RECENT_ANNEE);
  if (annee == null || annee < MIN_RECENT_ANNEE || annee > 2100) {
    throw new DonneesRequestError(
      400,
      `Année invalide: seules les années >= ${MIN_RECENT_ANNEE} sont servies par cet endpoint.`,
    );
  }

  return {
    action,
    annee,
    codeDren: parseCode(firstValue(input.code_dren), "code_dren"),
    codeCisco: parseCode(firstValue(input.code_cisco), "code_cisco"),
    codeCommune: parseCode(firstValue(input.code_commune), "code_commune"),
    codeZap: parseCode(firstValue(input.code_zap), "code_zap"),
    secteur: parseCode(firstValue(input.secteur) ?? "2", "secteur"),
  };
}

/** Exécute la requête et renvoie les lignes (même forme que `db-query`). */
export async function queryDonnees(q: DonneesQuery): Promise<Record<string, unknown>[]> {
  const level: DataRecentLevel = DATA_RECENT_ACTIONS[q.action];
  const sql = buildDonneesRecentSql(level, q);
  const result = await getPool().query(sql);
  return result.rows as Record<string, unknown>[];
}

interface MinimalRequest {
  method?: string;
  url?: string;
  query?: QueryInput;
}

interface MinimalResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

function sendJson(res: MinimalResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.end(JSON.stringify(body));
}

export default async function handler(req: MinimalRequest, res: MinimalResponse) {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, null);
    return;
  }
  if (req.method && req.method !== "GET") {
    sendJson(res, 405, { error: "Méthode non autorisée" });
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
