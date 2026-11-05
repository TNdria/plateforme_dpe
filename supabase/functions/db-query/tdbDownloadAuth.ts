export type TdbDownloadTarget = { level: string; code: number };
export type DownloadAccount = { is_active: boolean; is_staff?: boolean; is_superuser?: boolean; dren?: unknown; cisco?: unknown };

// Only the account's own administrative level; no upward or descendant grants.
export function canDownloadTdb(account: DownloadAccount | null, target: TdbDownloadTarget): boolean {
  if (!account?.is_active || !Number.isSafeInteger(target.code) || target.code <= 0 ||
      !['DREN', 'CISCO', 'ZAP', 'ÉCOLE'].includes(target.level)) return false;
  if (account.is_superuser || account.is_staff) return true;
  const cisco = Number(account.cisco);
  if (Number.isSafeInteger(cisco) && cisco > 0) return target.level === 'CISCO' && target.code === cisco;
  const dren = Number(account.dren);
  return Number.isSafeInteger(dren) && dren > 0 && target.level === 'DREN' && target.code === dren;
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