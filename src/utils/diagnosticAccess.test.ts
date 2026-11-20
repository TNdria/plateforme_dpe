import { describe, expect, it } from 'vitest';
import { isDiagnosticAdmin, resolveDiagnosticScope } from '../../supabase/functions/db-query/diagnosticAccess';
import type { DiagnosticAccount, DiagnosticRequest } from '../../supabase/functions/db-query/diagnosticAccess';

const admin = { is_active: true, is_staff: true, is_superuser: true, dren: 0, cisco: 0 };
const dpeStaff = { is_active: true, is_staff: true, is_superuser: false, dren: 0, cisco: 0 };
const drenUser = { is_active: true, is_staff: false, is_superuser: false, dren: 61, cisco: 0 };
const ciscoUser = { is_active: true, is_staff: false, is_superuser: false, dren: 61, cisco: 609 };

describe('diagnostic access rules', () => {
  it('denies guests and inactive accounts', () => {
    expect(resolveDiagnosticScope(null, { codeDren: 0, codeCisco: 0 }).allowed).toBe(false);
    expect(resolveDiagnosticScope({ ...ciscoUser, is_active: false }, { codeDren: 61, codeCisco: 609 }).allowed).toBe(false);
    expect(isDiagnosticAdmin(null)).toBe(false);
  });

  it('lets administrators and DPE read national, DREN and CISCO diagnostics', () => {
    for (const account of [admin, dpeStaff]) {
      expect(resolveDiagnosticScope(account, { codeDren: 0, codeCisco: 0 })).toMatchObject({
        allowed: true, level: 'national', scope: { codeDren: 0, codeCisco: 0 },
      });
      expect(resolveDiagnosticScope(account, { codeDren: 11, codeCisco: 0 })).toMatchObject({
        allowed: true, level: 'dren', scope: { codeDren: 11, codeCisco: 0 },
      });
      expect(resolveDiagnosticScope(account, { codeDren: 11, codeCisco: 105, ciscoDren: 11 })).toMatchObject({
        allowed: true, level: 'cisco', scope: { codeDren: 11, codeCisco: 105 },
      });
    }
  });

  it('limits a DREN team to its own DREN and its CISCOs', () => {
    expect(resolveDiagnosticScope(drenUser, { codeDren: 61, codeCisco: 0 })).toMatchObject({
      allowed: true, level: 'dren', scope: { codeDren: 61, codeCisco: 0 },
    });
    expect(resolveDiagnosticScope(drenUser, { codeDren: 61, codeCisco: 609, ciscoDren: 61 })).toMatchObject({
      allowed: true, level: 'cisco', scope: { codeDren: 61, codeCisco: 609 },
    });

    // National, other DREN, other DREN's CISCO, unknown CISCO.
    expect(resolveDiagnosticScope(drenUser, { codeDren: 0, codeCisco: 0 }).allowed).toBe(false);
    expect(resolveDiagnosticScope(drenUser, { codeDren: 11, codeCisco: 0 }).allowed).toBe(false);
    expect(resolveDiagnosticScope(drenUser, { codeDren: 61, codeCisco: 105, ciscoDren: 11 }).allowed).toBe(false);
    expect(resolveDiagnosticScope(drenUser, { codeDren: 61, codeCisco: 999, ciscoDren: null }).allowed).toBe(false);
  });

  it('limits a CISCO team to its own CISCO only', () => {
    expect(resolveDiagnosticScope(ciscoUser, { codeDren: 61, codeCisco: 609, ciscoDren: 61 })).toMatchObject({
      allowed: true, level: 'cisco', scope: { codeDren: 61, codeCisco: 609 },
    });

    // National, its DREN, another CISCO of the same DREN, another DREN.
    expect(resolveDiagnosticScope(ciscoUser, { codeDren: 0, codeCisco: 0 }).allowed).toBe(false);
    expect(resolveDiagnosticScope(ciscoUser, { codeDren: 61, codeCisco: 0 }).allowed).toBe(false);
    expect(resolveDiagnosticScope(ciscoUser, { codeDren: 61, codeCisco: 604, ciscoDren: 61 }).allowed).toBe(false);
    expect(resolveDiagnosticScope(ciscoUser, { codeDren: 11, codeCisco: 105, ciscoDren: 11 }).allowed).toBe(false);
  });

  it('denies accounts with no administrative perimeter', () => {
    expect(resolveDiagnosticScope({ is_active: true, dren: 0, cisco: 0 }, { codeDren: 0, codeCisco: 0 }).allowed).toBe(false);
    expect(resolveDiagnosticScope({ is_active: true, dren: 0, cisco: 0 }, { codeDren: 61, codeCisco: 609 }).allowed).toBe(false);
  });

  // Matrice de non-régression par profil, identique pour la consultation et
  // pour l'export : les deux passent par resolveDiagnosticScope.
  describe('profil × périmètre (consultation/export)', () => {
    const cases: Array<[string, DiagnosticAccount, DiagnosticRequest, boolean]> = [
      ['Admin / National', admin, { codeDren: 0, codeCisco: 0 }, true],
      ['Admin / DREN 11', admin, { codeDren: 11, codeCisco: 0 }, true],
      ['DPE / CISCO 105', dpeStaff, { codeDren: 11, codeCisco: 105, ciscoDren: 11 }, true],
      ['Planif DREN 61 / sa DREN', drenUser, { codeDren: 61, codeCisco: 0 }, true],
      ['Planif DREN 61 / CISCO 609', drenUser, { codeDren: 61, codeCisco: 609, ciscoDren: 61 }, true],
      ['Planif DREN 61 / National', drenUser, { codeDren: 0, codeCisco: 0 }, false],
      ['Planif DREN 61 / DREN 11', drenUser, { codeDren: 11, codeCisco: 0 }, false],
      ['Planif CISCO 609 BELOHA / son CISCO', ciscoUser, { codeDren: 61, codeCisco: 609, ciscoDren: 61 }, true],
      ['Planif CISCO 609 BELOHA / sa DREN', ciscoUser, { codeDren: 61, codeCisco: 0 }, false],
      ['Planif CISCO 609 BELOHA / National', ciscoUser, { codeDren: 0, codeCisco: 0 }, false],
      ['Planif CISCO 609 BELOHA / CISCO 604', ciscoUser, { codeDren: 61, codeCisco: 604, ciscoDren: 61 }, false],
      ['Compte sans périmètre / National', { is_active: true, dren: 0, cisco: 0 }, { codeDren: 0, codeCisco: 0 }, false],
    ];

    it.each(cases)('%s', (_label, account, request, expected) => {
      expect(resolveDiagnosticScope(account, request).allowed).toBe(expected);
    });
  });
});
