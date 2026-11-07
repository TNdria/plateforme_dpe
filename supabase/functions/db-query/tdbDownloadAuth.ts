export type TdbDownloadTarget = { level: string; code: number };
export type DownloadAccount = { is_active: boolean; is_staff?: boolean; is_superuser?: boolean; dren?: unknown; cisco?: unknown };

function asPositiveInteger(value: unknown): number | null {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function withinAdministrativeScope(scope: number, targetCode: number, level: string): boolean {
  if (!Number.isSafeInteger(targetCode) || targetCode <= 0) return false;
  const scopeText = String(scope);
  const targetText = String(targetCode);

  if (targetText === scopeText) return true;

  if (level === 'DREN') return false;
  return targetText.startsWith(scopeText);
}

// DREN and CISCO users can access any TDB in their own hierarchy branch.
// Example: a DREN 11 user may open DREN 11, CISCO 110, ZAP 110040, and ÉCOLE 110040002.
// A CISCO 110 user may open CISCO 110, ZAP 110040, and ÉCOLE 110040002,
// and still see the DREN report for their DREN.
export function canDownloadTdb(account: DownloadAccount | null, target: TdbDownloadTarget): boolean {
  if (!account?.is_active || !Number.isSafeInteger(target.code) || target.code <= 0 ||
      !['DREN', 'CISCO', 'ZAP', 'ÉCOLE'].includes(target.level)) return false;
  if (account.is_superuser || account.is_staff) return true;

  const targetCode = Number(target.code);
  const dren = asPositiveInteger(account.dren);
  const cisco = asPositiveInteger(account.cisco);

  const hasDrenScope = dren !== null && (
    (target.level === 'DREN' && targetCode === dren) ||
    (target.level === 'CISCO' && withinAdministrativeScope(dren, targetCode, target.level)) ||
    (['ZAP', 'ÉCOLE'].includes(target.level) && 
      withinAdministrativeScope(dren, targetCode, target.level) && 
      !targetCode.toString().startsWith(dren.toString() + '1'))
  );

  // hasCiscoScope: CISCO users can access their exact CISCO code,
  // and ZAP/ÉCOLE codes in their CISCO perimeter.
  // Importantly, CISCO users should NOT be able to access other CISCO codes
  // through the DREN administrative scope.
  const hasCiscoScope = cisco !== null && (
    (target.level === 'CISCO' && targetCode === cisco) ||
    (target.level !== 'CISCO' && ['ZAP', 'ÉCOLE'].includes(target.level) && withinAdministrativeScope(cisco, targetCode, target.level))
  );

  // If the user has a CISCO code, DREN admin scope for CISCO targets is not applicable
  // This prevents CISCO 110 from accessing CISCO 111 etc. through DREN admin scope.
  // CISCO users can still access DREN reports in their admin perimeter.
  const effectiveHasDrenScope = hasDrenScope && !(cisco !== null && target.level === 'CISCO');

  return effectiveHasDrenScope || hasCiscoScope;
}

const encoder = new TextEncoder();
const toBase64 = (value: Uint8Array) => btoa(String.fromCharCode(...value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromBase64 = (value: string) => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
async function signingKey(secret: string) {
  if (!secret) throw new Error('Session signing unavailable');
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function issueTdbSession(userId: number, passwordHash: string, secret: string): Promise<string> {
  const fingerprint = toBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(passwordHash))));
  const payload = toBase64(encoder.encode(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600, fingerprint })));
  const signature = await crypto.subtle.sign('HMAC', await signingKey(secret), encoder.encode(payload));
  return `${payload}.${toBase64(new Uint8Array(signature))}`;
}
export async function verifyTdbSession(token: string, secret: string): Promise<{ sub: number; fingerprint: string } | null> {
  try {
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra) return null;
    if (!await crypto.subtle.verify('HMAC', await signingKey(secret), fromBase64(signature), encoder.encode(payload))) return null;
    const claims = JSON.parse(new TextDecoder().decode(fromBase64(payload)));
    if (!Number.isSafeInteger(claims.sub) || claims.sub <= 0 || claims.exp <= Math.floor(Date.now() / 1000) || typeof claims.fingerprint !== 'string') return null;
    return claims;
  } catch { return null; }
}
export async function passwordMatchesSession(hash: string, fingerprint: string): Promise<boolean> {
  return toBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(hash)))) === fingerprint;
}