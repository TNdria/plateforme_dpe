import { describe, expect, it } from 'vitest';
import { canDownloadTdb, issueTdbSession, verifyTdbSession, passwordMatchesSession } from '../../supabase/functions/db-query/tdbDownloadAuth';

describe('TDB download permissions', () => {
  it('denies guests for all TDB levels', () => {
    for (const level of ['DREN', 'CISCO', 'ZAP', 'ÉCOLE']) expect(canDownloadTdb(null, { level, code: 101 })).toBe(false);
  });

  it('allows DREN-level accounts to download every report in their administrative perimeter', () => {
    const account = { is_active: true, dren: 11, cisco: 0 };

    expect(canDownloadTdb(account, { level: 'DREN', code: 11 })).toBe(true);
    expect(canDownloadTdb(account, { level: 'CISCO', code: 110 })).toBe(true);
    expect(canDownloadTdb(account, { level: 'ZAP', code: 110040 })).toBe(true);
    expect(canDownloadTdb(account, { level: 'ÉCOLE', code: 110040002 })).toBe(true);

    expect(canDownloadTdb(account, { level: 'DREN', code: 12 })).toBe(false);
    expect(canDownloadTdb(account, { level: 'CISCO', code: 210 })).toBe(false);
    expect(canDownloadTdb(account, { level: 'ZAP', code: 210040 })).toBe(false);
  });

  it('allows CISCO-level accounts to download all subordinate ZAP and ÉCOLE files in their CISCO', () => {
    const account = { is_active: true, dren: 11, cisco: 110 };

    expect(canDownloadTdb(account, { level: 'DREN', code: 11 })).toBe(true);
    expect(canDownloadTdb(account, { level: 'CISCO', code: 110 })).toBe(true);
    expect(canDownloadTdb(account, { level: 'ZAP', code: 110040 })).toBe(true);
    expect(canDownloadTdb(account, { level: 'ÉCOLE', code: 110040002 })).toBe(true);

    expect(canDownloadTdb(account, { level: 'CISCO', code: 210 })).toBe(false);
    expect(canDownloadTdb(account, { level: 'ZAP', code: 210040 })).toBe(false);
    expect(canDownloadTdb(account, { level: 'ÉCOLE', code: 210040002 })).toBe(false);
  });

  it('denies unrelated TDBs even when the user has a valid DREN or CISCO code', () => {
    const account = { is_active: true, dren: 11, cisco: 110 };

    expect(canDownloadTdb(account, { level: 'CISCO', code: 111 })).toBe(false);
    expect(canDownloadTdb(account, { level: 'ZAP', code: 111040 })).toBe(false);
    expect(canDownloadTdb(account, { level: 'ÉCOLE', code: 111040003 })).toBe(false);
    expect(canDownloadTdb(account, { level: 'DREN', code: 12 })).toBe(false);
  });

  it('allows administrators all valid TDB levels regardless of codes', () => {
    for (const role of ['is_superuser', 'is_staff']) for (const level of ['DREN', 'CISCO', 'ZAP', 'ÉCOLE']) {
      expect(canDownloadTdb({ is_active: true, [role]: true }, { level, code: 999 })).toBe(true);
    }
    expect(canDownloadTdb({ is_active: true, is_staff: true, dren: 11, cisco: 110 }, { level: 'DREN', code: 999 })).toBe(true);
  });

  it('denies inactive and unassigned accounts and invalid targets', () => {
    expect(canDownloadTdb({ is_active: false, is_superuser: true }, { level: 'DREN', code: 11 })).toBe(false);
    expect(canDownloadTdb({ is_active: true }, { level: 'DREN', code: 11 })).toBe(false);
    expect(canDownloadTdb({ is_active: true, is_superuser: true }, { level: 'DREN', code: 0 })).toBe(false);
    expect(canDownloadTdb({ is_active: true, dren: 11, cisco: 110 }, { level: 'INVALID', code: 11 })).toBe(false);
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