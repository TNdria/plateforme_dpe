import { describe, expect, it } from 'vitest';
import {
  MIN_DONNEES_ANNEE,
  buildDonneesRecentSql,
} from '../../supabase/functions/_shared/donneesRecent';

const build = (annee: number) =>
  buildDonneesRecentSql('n1', {
    codeDren: 0,
    codeCisco: 0,
    codeCommune: 0,
    codeZap: 0,
    secteur: 2,
    annee,
  });

describe('buildDonneesRecentSql — millésimes servis', () => {
  it('reconstruit la fiche depuis les tables de collecte de l’année demandée', () => {
    const sql = build(2023);
    expect(sql).toContain('a1."ANNEE_SCOLAIRE" = 2023');
    expect(sql).toContain('"ANNEE_SCOLAIRE" = 2023');
    // Places, SDC et personnels doivent suivre le millésime demandé, pas celui
    // des vues figées sur 2025.
    expect(sql).toContain('sdc."ANNEE_SCOLAIRE" = 2023');
    expect(sql).toContain('vp."ANNEE_SCOLAIRE" = 2023');
    expect(sql).toContain('pers."ANNEE_SCOLAIRE" = 2023');
  });

  it('n’ajoute pas de colonne eff_<annee> en doublon des colonnes historiques', () => {
    const sql = build(2023);
    expect(sql).toContain('COALESCE(eveff.eff_2023, 0) AS eff_2023');
    expect(sql).not.toContain('v.eff_total AS "eff_2023"');
  });

  it('expose l’effectif total pour les années postérieures aux colonnes historiques', () => {
    const sql = build(2026);
    expect(sql).toContain('v.eff_total AS "eff_2026"');
  });

  it('refuse les millésimes absents des tables de collecte', () => {
    expect(() => build(MIN_DONNEES_ANNEE - 1)).toThrow();
  });
});
