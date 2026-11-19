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

  it('ventile enseignants et personnel administratif par statut depuis fpe_p1', () => {
    const sql = build(2026);
    expect(sql).toContain('FROM fpe_p1');
    expect(sql).toContain('AS pers_admin');
    expect(sql).toContain('AS ens_fonct');
    expect(sql).toContain('AS ens_enf');
    // Statut 3 = FRAM subventionné, isolé pour distinguer subventionnés et non
    // subventionnés parmi les ENF enseignants.
    expect(sql).toContain('AS ens_sub');
    expect(sql).toContain('"CODE_STATUT" = \'3\'');
    expect(sql).toContain('AS admin_fonct');
    expect(sql).toContain('AS admin_enf');
    // EN_SALLE distingue les deux catégories ; le statut 1-2 (État) est
    // séparé des ENF pour chacune d'elles.
    expect(sql).toContain('COALESCE("EN_SALLE", 0) = 1');
    expect(sql).toContain('COALESCE("EN_SALLE", 0) = 0');
    expect(sql).toContain('"CODE_STATUT" IN (\'1\',\'2\')');
    expect(sql).toContain('"CODE_STATUT" NOT IN (\'1\',\'2\')');
  });

  it('refuse les millésimes absents des tables de collecte', () => {
    expect(() => build(MIN_DONNEES_ANNEE - 1)).toThrow();
  });
});
