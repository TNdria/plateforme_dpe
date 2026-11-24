// Validation serveur d'une demande de diagnostic.
//
// Le jeton de session est signé par `issueTdbSession` au login et conservé
// uniquement en mémoire côté client. On le vérifie ici, puis on relit le
// compte en base à chaque demande (droits faisant foi, comme pour les
// téléchargements TDB) avant d'appliquer les règles de `diagnosticAccess.ts`.

import { passwordMatchesSession, verifyTdbSession } from './tdbDownloadAuth.ts';
import { resolveDiagnosticScope, type DiagnosticLevel } from './diagnosticAccess.ts';

export type DiagnosticAuthBody = {
  sessionToken?: unknown;
  codeDren?: unknown;
  codeCisco?: unknown;
};

export type DiagnosticAuthResult =
  | { ok: true; account: any; scope: { codeDren: number; codeCisco: number }; level: DiagnosticLevel }
  | { ok: false; status: 401 | 403; error: string };

const asCode = (value: unknown): number => {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : 0;
};

export async function authorizeDiagnosticRequest(
  client: any,
  body: DiagnosticAuthBody | null | undefined,
): Promise<DiagnosticAuthResult> {
  const secret = Deno.env.get('TDB_SESSION_SECRET') || '';
  const session = await verifyTdbSession(
    typeof body?.sessionToken === 'string' ? body?.sessionToken : '',
    secret,
  );
  if (!session) {
    return { ok: false, status: 401, error: 'Session expirée ou invalide. Reconnectez-vous pour continuer.' };
  }

  const users = await client.queryObject(
    'SELECT password, is_active, is_staff, is_superuser, dren, cisco FROM login_customuser WHERE id = $1',
    [session.sub],
  );
  const account: any = users.rows[0];
  if (!account || !(await passwordMatchesSession(account.password, session.fingerprint))) {
    return { ok: false, status: 401, error: 'Session expirée ou invalide. Reconnectez-vous pour continuer.' };
  }

  const codeDren = asCode(body?.codeDren);
  const codeCisco = asCode(body?.codeCisco);

  // Un CISCO demandé par un compte DREN doit appartenir à sa DREN. On résout
  // le rattachement en base ; un code inconnu est refusé (fail closed).
  let ciscoDren: number | null | undefined;
  if (codeCisco > 0) {
    const ciscoRows = await client.queryObject(
      'SELECT "CODE_DREN" FROM v_cisco WHERE "CODE_CISCO" = $1',
      [codeCisco],
    );
    const cisco: any = ciscoRows.rows[0];
    if (cisco) {
      ciscoDren = Number(cisco.CODE_DREN) || null;
    } else {
      // CISCO absent du référentiel `v_cisco` mais présent dans la collecte
      // (ex. CISCO 622 de la DREN 61) : rattachement résolu dans la dernière
      // année collectée, uniquement s'il est univoque.
      const rows = await client.queryObject(
        `SELECT DISTINCT "CODE_DREN" FROM fpe_a1
          WHERE "CODE_CISCO" = $1 AND "CODE_DREN" IS NOT NULL
            AND "ANNEE_SCOLAIRE" = (SELECT MAX("ANNEE_SCOLAIRE") FROM fpe_a1)`,
        [codeCisco],
      );
      const found = (rows.rows || []) as any[];
      ciscoDren = found.length === 1 ? Number(found[0].CODE_DREN) || null : null;
    }
  }

  const decision = resolveDiagnosticScope(account, { codeDren, codeCisco, ciscoDren });
  if (!decision.allowed) {
    const error = 'reason' in decision ? decision.reason : 'Accès refusé.';
    return { ok: false, status: 403, error };
  }

  return { ok: true, account, scope: decision.scope, level: decision.level };
}
