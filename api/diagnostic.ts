/**
 * Endpoint serveur du module Diagnostic.
 *
 * Remplace l'appel à l'edge function Supabase `db-query` pour la lecture du
 * dataset : la connexion se fait directement sur le serveur PostgreSQL du
 * ministère (`102.16.234.114:5453`, base `dpeapp`), comme `/api/donnees`.
 *
 * L'autorisation reste serveur : le jeton de session signé (émis au login) est
 * vérifié ici, puis le compte est relu en base à chaque appel ; le périmètre
 * DREN/CISCO est résolu par les règles pures de `diagnosticAccess.ts`. Aucun
 * code de périmètre fourni par le client n'est pris pour argent comptant.
 *
 * POST /api/diagnostic
 *   { codeDren: number, codeCisco: number, sessionToken: string }
 *
 * Variables d'environnement (serveur uniquement) :
 *   TDB_SESSION_SECRET  même valeur que le secret de signature utilisé par le
 *                       login (obligatoire : sans lui, réponse 503 explicite).
 *   DATABASE_URL ou DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD.
 */

import pg from "pg";
import { executeDiagnosticDataset } from "../supabase/functions/db-query/diagnostic.js";
import { resolveDiagnosticScope } from "../supabase/functions/db-query/diagnosticAccess.js";
import {
  passwordMatchesSession,
  verifyTdbSession,
} from "../supabase/functions/db-query/tdbDownloadAuth.js";

const { Pool } = pg;

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (pool) return pool;

  const connectionString =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.PGURL;
  const common = {
    max: 4,
    idleTimeoutMillis: 30_000,
    // Les agrégats nationaux dépassent la minute : on attend une connexion
    // libre au lieu d'échouer immédiatement.
    connectionTimeoutMillis: 60_000,
  };

  if (connectionString) {
    const needsSsl =
      process.env.DB_SSL === "true" ||
      /sslmode=(require|verify)/.test(connectionString) ||
      /supabase\.(co|com)/.test(connectionString);
    pool = new Pool({
      connectionString,
      ...common,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    });
    // Un client inactif qui perd la connexion émet `error` sur le pool : sans
    // écouteur, Node lève une exception non capturée et la fonction Vercel
    // meurt en FUNCTION_INVOCATION_FAILED au lieu de répondre.
    pool.on("error", (error) => console.error("[api/diagnostic] pool", error.message));
    return pool;
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

  pool = new Pool({
    host,
    port,
    database,
    user,
    password,
    ...common,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });
  pool.on("error", (error) => console.error("[api/diagnostic] pool", error.message));
  return pool;
}

const asCode = (value: unknown): number => {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : 0;
};

// pg renvoie les `numeric` en chaînes : on garde ce contrat (identique à
// l'edge function) pour ne pas changer le format attendu par l'interface.
function serialize(value: unknown): unknown {
  if (typeof value === "bigint") return Number(value);
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) result[key] = serialize(entry);
    return result;
  }
  return value;
}

interface MinimalRequest {
  method?: string;
  body?: unknown;
  on?: (event: string, listener: (chunk?: unknown) => void) => void;
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
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(body));
}

async function readStream(stream: any): Promise<Record<string, unknown>> {
  if (!stream || typeof stream.on !== "function") return {};
  return new Promise((resolve) => {
    const chunks: string[] = [];
    stream.on("data", (chunk: unknown) => chunks.push(String(chunk)));
    stream.on("end", () => {
      try {
        resolve(JSON.parse(chunks.join("")));
      } catch {
        resolve({});
      }
    });
    stream.on("error", () => resolve({}));
  });
}

async function readBody(req: MinimalRequest): Promise<Record<string, unknown>> {
  const body: any = req.body;
  // Vercel fournit déjà le corps désérialisé ; en développement le middleware
  // Vite transmet le flux brut de la requête (objet avec `on`).
  if (body && typeof body === "object" && typeof body.on !== "function") {
    return body as Record<string, unknown>;
  }
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  if (body && typeof body.on === "function") return readStream(body);
  return readStream(req);
}

export default async function handler(req: MinimalRequest, res: MinimalResponse) {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, null);
    return;
  }
  if (req.method && req.method !== "POST") {
    sendJson(res, 405, { error: "Méthode non autorisée" });
    return;
  }

  const secret = process.env.TDB_SESSION_SECRET ?? "";
  if (!secret) {
    sendJson(res, 503, {
      code: "DIAG_ENDPOINT_UNCONFIGURED",
      error:
        "TDB_SESSION_SECRET n'est pas configuré côté serveur : le jeton de session ne peut pas être vérifié.",
    });
    return;
  }

  // La connexion est tentée DANS un try : une base injoignable ou une
  // configuration absente doit produire une réponse JSON explicite, jamais
  // un crash d'invocation (FUNCTION_INVOCATION_FAILED côté Vercel).
  let client: pg.PoolClient;
  try {
    client = await getPool().connect();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("[api/diagnostic] connexion PostgreSQL impossible :", message);
    sendJson(res, 503, {
      code: "DIAG_ENDPOINT_UNAVAILABLE",
      error:
        "La base de données du ministère est injoignable depuis le serveur. Réessayez plus tard.",
    });
    return;
  }

  try {
    const body = await readBody(req);
    const session = await verifyTdbSession(
      typeof body.sessionToken === "string" ? body.sessionToken : "",
      secret,
    );
    if (!session) {
      sendJson(res, 401, { error: "Session expirée ou invalide. Reconnectez-vous pour continuer." });
      return;
    }

    const users = await client.query(
      "SELECT password, is_active, is_staff, is_superuser, dren, cisco FROM login_customuser WHERE id = $1",
      [session.sub],
    );
    const account = users.rows[0];
    if (!account || !(await passwordMatchesSession(String(account.password), session.fingerprint))) {
      sendJson(res, 401, { error: "Session expirée ou invalide. Reconnectez-vous pour continuer." });
      return;
    }

    const codeDren = asCode(body.codeDren);
    const codeCisco = asCode(body.codeCisco);

    // Un CISCO demandé par un compte DREN doit appartenir à sa DREN : le
    // rattachement est résolu en base, un code inconnu est refusé.
    let ciscoDren: number | null | undefined;
    if (codeCisco > 0) {
      const ciscoRows = await client.query(
        'SELECT "CODE_DREN" FROM v_cisco WHERE "CODE_CISCO" = $1',
        [codeCisco],
      );
      const cisco = ciscoRows.rows[0];
      if (cisco) {
        ciscoDren = Number(cisco.CODE_DREN) || null;
      } else {
        // CISCO absent du référentiel `v_cisco` mais présent dans la collecte
        // (ex. CISCO 622 de la DREN 61) : on résout son rattachement dans la
        // dernière année collectée, et seulement s'il est univoque.
        const rows = await client.query(
          `SELECT DISTINCT "CODE_DREN" FROM fpe_a1
            WHERE "CODE_CISCO" = $1 AND "CODE_DREN" IS NOT NULL
              AND "ANNEE_SCOLAIRE" = (SELECT MAX("ANNEE_SCOLAIRE") FROM fpe_a1)`,
          [codeCisco],
        );
        ciscoDren = rows.rows.length === 1 ? Number(rows.rows[0].CODE_DREN) || null : null;
      }
    }

    const decision = resolveDiagnosticScope(account, { codeDren, codeCisco, ciscoDren });
    if (!decision.allowed) {
      sendJson(res, 403, { error: "reason" in decision ? decision.reason : "Accès refusé." });
      return;
    }

    const dataset = await executeDiagnosticDataset(
      {
        queryObject: async (sql: string) => {
          const result = await client.query(sql);
          return { rows: result.rows };
        },
      },
      decision.scope,
    );

    sendJson(res, 200, serialize(dataset));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("[api/diagnostic]", message);
    sendJson(res, 500, { error: `Lecture du diagnostic impossible : ${message}` });
  } finally {
    client.release();
  }
}

// Agrégats nationaux : laisser à la fonction le temps de terminer.
export const maxDuration = 300;
