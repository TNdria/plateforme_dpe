import { describe, expect, it } from 'vitest';
import { canDownloadTdb, issueTdbSession, verifyTdbSession, passwordMatchesSession } from '../../supabase/functions/db-query/tdbDownloadAuth';

describe('TDB download permissions', () => {
  it('denies guests for all TDB levels', () => {
    for (const level of ['DREN', 'CISCO', 'ZAP', 'ÉCOLE']) expect(canDownloadTdb(null, { level, code: 101 })).toBe(false);
  });
  it('allows CISCO accounts only their own CISCO, even with a parent DREN', () => {
    const account = { is_active: true, dren: 11, cisco: '101' };
    expect(canDownloadTdb(account, { level: 'CISCO', code: 101 })).toBe(true);
    expect(canDownloadTdb(account, { level: 'CISCO', code: 102 })).toBe(false);
    for (const level of ['DREN', 'ZAP', 'ÉCOLE']) expect(canDownloadTdb(account, { level, code: 11 })).toBe(false);
  });
  it('allows DREN accounts only their assigned DREN', () => {
    const account = { is_active: true, dren: 11, cisco: 0 };
    expect(canDownloadTdb(account, { level: 'DREN', code: 11 })).toBe(true);
    expect(canDownloadTdb(account, { level: 'DREN', code: 12 })).toBe(false);
    expect(canDownloadTdb(account, { level: 'CISCO', code: 101 })).toBe(false);
  });
  it('allows administrators all valid TDB levels', () => {
    for (const role of ['is_superuser', 'is_staff']) for (const level of ['DREN', 'CISCO', 'ZAP', 'ÉCOLE']) {
      expect(canDownloadTdb({ is_active: true, [role]: true }, { level, code: 102 })).toBe(true);
    }
  });
  it('denies inactive and unassigned accounts and invalid targets', () => {
    expect(canDownloadTdb({ is_active: false, is_superuser: true }, { level: 'DREN', code: 11 })).toBe(false);
    expect(canDownloadTdb({ is_active: true }, { level: 'DREN', code: 11 })).toBe(false);
    expect(canDownloadTdb({ is_active: true, is_superuser: true }, { level: 'DREN', code: 0 })).toBe(false);
  });
  it('validates signed credentials and rejects forgeries and changed passwords', async () => {
    const token = await issueTdbSession(42, 'test-password-hash', 'test-only-secret');
    const session = await verifyTdbSession(token, 'test-only-secret');
    expect(session?.sub).toBe(42);
    expect(await verifyTdbSession(token, 'wrong-secret')).toBeNull();
    expect(await verifyTdbSession('forged.token', 'test-only-secret')).toBeNull();
    expect(await passwordMatchesSession('changed-hash', session?.fingerprint ?? '')).toBe(false);
    expect(await passwordMatchesSession('test-password-hash', session?.fingerprint ?? '')).toBe(true);
  });
});