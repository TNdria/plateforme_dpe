// Autorisations du module Diagnostic.
//
// Règles métier :
//  - Administrateur / DPE (is_staff ou is_superuser) : diagnostics national,
//    DREN et CISCO.
//  - Équipe Planification DREN (dren > 0, pas de CISCO) : uniquement sa DREN
//    et les CISCO qui y sont rattachés.
//  - Équipe Planification CISCO (cisco > 0) : uniquement son CISCO.
//  - Tout autre compte : aucun accès.
//
// Ce module est volontairement pur (aucune dépendance Deno/DB) pour rester
// testable ; la lecture du compte et la résolution CISCO → DREN sont faites
// par `diagnosticRequestAuth.ts`.

export type DiagnosticAccount = {
  is_active?: boolean | null;
  is_staff?: boolean | null;
  is_superuser?: boolean | null;
  dren?: unknown;
  cisco?: unknown;
};

export type DiagnosticRequest = {
  codeDren?: number | null;
  codeCisco?: number | null;
  /**
   * DREN de rattachement du CISCO demandé, résolue côté serveur.
   * `undefined` = non vérifiable dans ce contexte (génération IA à partir d'un
   * dataset déjà autorisé) ; `null` = CISCO inconnu, on refuse.
   */
  ciscoDren?: number | null;
};

export type DiagnosticScope = { codeDren: number; codeCisco: number };
export type DiagnosticLevel = 'national' | 'dren' | 'cisco';

export type DiagnosticDecision =
  | { allowed: true; scope: DiagnosticScope; level: DiagnosticLevel }
  | { allowed: false; reason: string };

const asCode = (value: unknown): number => {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : 0;
};

export function isDiagnosticAdmin(account: DiagnosticAccount | null | undefined): boolean {
  return !!account?.is_active && (!!account.is_staff || !!account.is_superuser);
}

export function resolveDiagnosticScope(
  account: DiagnosticAccount | null | undefined,
  request: DiagnosticRequest,
): DiagnosticDecision {
  if (!account?.is_active) {
    return { allowed: false, reason: 'Compte inactif ou session invalide.' };
  }

  const requestedDren = asCode(request.codeDren);
  const requestedCisco = asCode(request.codeCisco);

  if (isDiagnosticAdmin(account)) {
    const level: DiagnosticLevel = requestedCisco > 0 ? 'cisco' : requestedDren > 0 ? 'dren' : 'national';
    return { allowed: true, scope: { codeDren: requestedDren, codeCisco: requestedCisco }, level };
  }

  const accountDren = asCode(account.dren);
  const accountCisco = asCode(account.cisco);

  // Un compte CISCO n'a accès qu'à son propre CISCO : ni le national, ni sa
  // DREN, ni un autre CISCO.
  if (accountCisco > 0) {
    if (requestedCisco !== accountCisco) {
      return { allowed: false, reason: "Votre compte n'est autorisé qu'à consulter le diagnostic de votre CISCO." };
    }
    return {
      allowed: true,
      scope: { codeDren: accountDren || requestedDren, codeCisco: accountCisco },
      level: 'cisco',
    };
  }

  // Un compte DREN n'a accès qu'à sa DREN et aux CISCO de sa DREN.
  if (accountDren > 0) {
    if (requestedDren !== accountDren) {
      return { allowed: false, reason: "Votre compte n'est autorisé qu'à consulter le diagnostic de votre DREN." };
    }
    if (requestedCisco > 0) {
      if (request.ciscoDren === null || (typeof request.ciscoDren === 'number' && request.ciscoDren !== accountDren)) {
        return { allowed: false, reason: "Ce CISCO n'est pas rattaché à votre DREN." };
      }
    }
    return {
      allowed: true,
      scope: { codeDren: accountDren, codeCisco: requestedCisco },
      level: requestedCisco > 0 ? 'cisco' : 'dren',
    };
  }

  return { allowed: false, reason: "Votre compte n'est rattaché à aucune DREN ni CISCO." };
}
