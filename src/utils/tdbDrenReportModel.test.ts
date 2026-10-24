import { describe, expect, it } from 'vitest';
import {
  buildDrenReport,
  cellStatus,
  efficienceDiagnosis,
  formatDrenValue,
} from './tdbDrenReportModel';

const sectors = (over: Record<string, any> = {}, publicOnly = false) => {
  const pub: Record<string, any> = {
    etab: 100, etab_ferme: 2, salles: 300, sections: 400, places: 12000,
    eff1_g: 600, eff1_f: 600, eff2_g: 500, eff2_f: 500, eff3_g: 450, eff3_f: 450, eff4_g: 400, eff4_f: 400,
    red1_g: 60, red1_f: 60, red2_g: 40, red2_f: 40, red3_g: 30, red3_f: 30, red4_g: 90, red4_f: 90,
    ens: 500, ens_classe: 450, fonct: 300, fram_sub: 50, fram_non_sub: 100, qualifies: 180,
    latrines: 120, latrines_f: 30, eleve_proche: 4500, elec: 30, eau: 110, avec_primaire: 60,
    ...over,
  };
  const priv: Record<string, any> = {
    etab: 50, etab_ferme: 0, salles: 120, sections: 150, places: 5000,
    eff1_g: 300, eff1_f: 300, eff2_g: 250, eff2_f: 250, eff3_g: 200, eff3_f: 200, eff4_g: 180, eff4_f: 180,
    red1_g: 10, red1_f: 10, red2_g: 10, red2_f: 10, red3_g: 5, red3_f: 5, red4_g: 20, red4_f: 20,
    ens: 180, ens_classe: 160, fonct: 10, fram_sub: 20, fram_non_sub: 130, qualifies: 40,
    latrines: 30, latrines_f: 8, eleve_proche: 2000, elec: 20, eau: 40, avec_primaire: 20,
    ...over,
  };
  return publicOnly ? { '0': pub } : { '0': pub, '1': priv };
};

const primaryRaw = {
  annee: 2025,
  code_dren: 12,
  names: { DREN: 'ATSINANANA' },
  dren: {
    nombre_eleves_tous_secteurs: 325811,
    population: { pop_6ans: 75000, pop_6_10: 380000, pop_10ans: 76000 },
    ressources: {
      nbr_cisco: 7, nbr_zap: 99, nbr_etab: 1780, nbr_etab_ferme: 0,
      nbr_eleve: 289239, nbr_eleve_f: 143605,
      eff_t1: 62000, eff_t2: 58000, eff_t3: 54000, eff_t4: 50000, eff_t5: 44000,
      red_t1: 21762, red_t2: 18734, red_t3: 16578, red_t4: 11300, red_t5: 11616,
      nbr_section: 8663, nbr_sdc: 2226, places_assises: 159716,
      latrines: 575, latrines_fille: 148, eleve_2km: 229000,
      etab_eau: 217, etab_elec: 12, ecole_continue: 1300, latrines_f: 148, etab_latrine_f: 617,
      etab_avec_cap: 420, eleves_6_10ans: 250000, nouveaux_cp1_6ans: 60000,
    },
    annee_suivante: { ressources: { eff_t2: 58000, red_t2: 18734, red_t1: 21000, eff_t3: 54000, red_t3: 16578, eff_t4: 50000, red_t4: 11300, eff_t5: 44000, red_t5: 11616 } },
    personnel: { nbr_pers: 6611, pers_en_classe: 6436, fonctionnaire: 2474, sub: 1971, non_sub: 1963, sans_diplome_ped: 5000 },
    sections: { nbr_section: 8663, nbr_sdc: 2226 },
    places: { places_assises: 159716, latrines: 575, latrines_fille: 148 },
    cepe: {
      total_candidats: 40000, nbr_g: 20000, nbr_f: 20000, admis_g: 8300, admis_f: 9000,
      sm_mlg: 9.6, mlg_sup10: 23600, sm_frs: 3.3, frs_sup10: 10080,
      sm_mths: 6.4, mths_sup10: 9080, sm_total: 11.5, autres_sup10: 29600,
    },
    caisse: { total_fce: 1060000000 },
    manuels: { malagasy: 240000, maths: 240000, francais: 38000 },
  },
  mada: {
    population: { pop_6ans: 2600000, pop_6_10: 13000000, pop_10ans: 2500000 },
    ressources: {
      nbr_etab: 24000, nbr_eleve: 4100000, nbr_eleve_f: 2000000,
      eff_t1: 900000, eff_t2: 850000, eff_t3: 800000, eff_t4: 760000, eff_t5: 720000,
      red_t1: 208800, red_t2: 205700, red_t3: 193600, red_t4: 150000, red_t5: 154800,
      nbr_section: 120000, nbr_sdc: 30000, places_assises: 2000000,
      latrines: 10000, latrines_fille: 2400, eleve_2km: 3600000,
      etab_eau: 2400, etab_elec: 240, ecole_continue: 19000,
    },
    annee_suivante: { ressources: { eff_t2: 850000, red_t2: 205700, red_t1: 205000 } },
    personnel: { nbr_pers: 100000, pers_en_classe: 95000, fonctionnaire: 60000, sub: 20000, non_sub: 15000, sans_diplome_ped: 79000 },
    sections: { nbr_section: 120000, nbr_sdc: 30000 },
    places: { places_assises: 2000000, latrines: 10000, latrines_fille: 2400 },
    cepe: { total_candidats: 700000, nbr_g: 350000, nbr_f: 350000, admis_g: 208000, admis_f: 210000, sm_mlg: 8.6, mlg_sup10: 363300 },
    caisse: { total_fce: 14820000000 },
    manuels: { malagasy: 2000000, maths: 1800000, francais: 900000 },
  },
  efficience: [
    { CISCO: 'TOAMASINA I', nbr_eleve: 50000, pers_en_classe: 900, admis: 5000, inscrits_cepe: 9000 },
    { CISCO: 'BRICKAVILLE', nbr_eleve: 30000, pers_en_classe: 700, admis: 2000, inscrits_cepe: 6000 },
  ],
};

const collegeRaw = {
  niveau: 'college',
  annee: 2025,
  code_dren: 12,
  names: { DREN: 'ATSINANANA' },
  nb_cisco: 7,
  nb_zap: 99,
  grades: 4,
  dren: sectors(),
  mada: sectors({ etab: 150, etab_ferme: 1, salles: 420, sections: 520, places: 15000, ens: 700, ens_classe: 650 }),
  dren_next: sectors(),
  mada_next: sectors({ etab: 150, ens: 700, ens_classe: 650 }),
  pop_dren: { p0: 20000, p1: 19000, p2: 18000, p3: 17000, p4: 74000 },
  pop_mada: { p0: 600000, p1: 580000, p2: 560000, p3: 540000, p4: 2280000 },
  ciscos: [
    { CISCO: 'TOAMASINA I', CODE_CISCO: 1, eleves: 9000, redoublants: 700, ens_classe: 300 },
    { CISCO: 'BRICKAVILLE', CODE_CISCO: 2, eleves: 5000, redoublants: 600, ens_classe: 250 },
  ],
  bepc_dren: { total_candidats: 10000, nbr_g: 5000, nbr_f: 5000, admis_g: 1585, admis_f: 3025, tx_admis: 46.5, tx_admis_g: 31.7, tx_admis_f: 60.5, sm_mlg: 9.8, mlg_sup10: 4000, sm_frs: 8.1, frs_sup10: 3000, sm_math: 7.2, math_sup10: 2500, sm_svt: 10.1, svt_sup10: 5000, sm_phys: 9.9, phys_sup10: 4800 },
  bepc_mada: { total_candidats: 250000, nbr_g: 125000, nbr_f: 125000, admis_g: 56500, admis_f: 97500, tx_admis: 62.8, tx_admis_g: 45.2, tx_admis_f: 78.6, sm_mlg: 10.2, mlg_sup10: 120000, sm_frs: 8.8, frs_sup10: 90000, sm_math: 7.8, math_sup10: 70000, sm_svt: 10.4, svt_sup10: 130000, sm_phys: 10.1, phys_sup10: 125000 },
};

describe('formatage ministériel', () => {
  it('utilise l’espace des milliers, le point décimal et le % collé', () => {
    expect(formatDrenValue(3074, '', 0)).toBe('3 074');
    expect(formatDrenValue(46.5, '%')).toBe('46.5%');
    expect(formatDrenValue(-3.2, '%')).toBe('-3.2%');
    expect(formatDrenValue(null, '%')).toBe('—');
  });
});

describe('statuts des cellules', () => {
  it('distingue l’absence d’un zéro réel', () => {
    expect(cellStatus(null, 0)).toBe('missing');
    expect(cellStatus(0, 0)).toBe('ok');
  });
  it('rouge si la DREN est pire que MADA selon le sens', () => {
    expect(cellStatus(35.1, 26.1, 'lower', 100)).toBe('attention');
    expect(cellStatus(8.3, 10.6, 'lower', 100)).toBe('ok');
    expect(cellStatus(55.7, 63.8, 'higher', 100)).toBe('attention');
  });
  it('jaune pour une valeur incohérente, sans troncature', () => {
    expect(cellStatus(-3.2, 7.6, 'lower', 100)).toBe('review');
    expect(cellStatus(101.2, 87.6, 'higher', 100)).toBe('review');
    expect(cellStatus(156.9, 136.2, 'higher')).toBe('ok');
  });
});

describe('rapport primaire', () => {
  const model = buildDrenReport(primaryRaw, 'primaire');
  it('affiche les sections et les 13 goulots', () => {
    expect(model.title).toBe('PRIMAIRE');
    expect(model.anneeLabel).toBe('2024 - 2025');
    expect(model.general).toHaveLength(3);
    expect(model.bottlenecks).toHaveLength(13);
    expect(model.flows).toHaveLength(3);
  });
  it('ne duplique pas les agrégats publics dans la colonne Ensemble', () => {
    const effectif = model.general[2].rows.find((r) => r.label === 'Effectif des élèves')!;
    expect(effectif.cells[0].value).toBe(325811);
    expect(effectif.cells[1].value).toBe(289239);
    const sections = model.general[2].rows.find((r) => r.label === 'Nombre de sections')!;
    expect(sections.cells[0].status).toBe('missing');
    expect(sections.cells[0].value).toBeNull();
  });
  it('colore en rouge un redoublement supérieur à MADA et garde les colonnes Privé/Ensemble', () => {
    expect(model.flows[0].columns).toEqual(['Niveau', 'Public', 'Privé', 'Ensemble', 'MADA']);
    const t1 = model.flows[0].rows[0];
    expect(t1.cells[0].status).toBe('attention');
    expect(t1.cells[1].status).toBe('missing');
  });
  it('calcule les ratios et le total financier sans inventer les postes absents', () => {
    const total = model.finance!.rows.at(-1)!;
    expect(total.cells[0].value).toBeCloseTo(3664.8, 1);
    expect(model.human.rows[0].cells[1].value).toBeCloseTo(22.3, 1);
    expect(model.human.rows[0].cells[2].value).toBeCloseTo(16.8, 1);
  });
  it('calcule TNS, TNA et le taux d’EPP ayant de CAP depuis les effectifs par âge', () => {
    const row = (label: string) => model.coverage.rows.find((r) => r.label === label)!;
    expect(row('TNS (%)').cells[0].value).toBeCloseTo(65.8, 1);
    expect(row('TNA (%)').cells[0].value).toBe(80);
    const cap = model.other.rows.find((r) => r.label.includes('EPP ayant de CAP'))!;
    expect(cap.cells[1].value).toBeCloseTo(23.6, 1);
  });
  it('utilise le pourcentage importé sans le diviser par l’effectif', () => {
    const imported = {
      ...primaryRaw,
      dren: { ...primaryRaw.dren, indicateurs: { eleve_2km: 21.5, point_eau: 12.2, ecole_continue: 64.2 } },
    };
    const report = buildDrenReport(imported, 'primaire');
    const value = (label: string) => report.other.rows.find((r) => r.label === label)!.cells[1].value;
    expect(value('Pourcentage d’élèves vivant à moins de 2 km')).toBe(21.5);
    expect(value('Pourcentage d’établissements avec point d’eau')).toBe(12.2);
    expect(value('Pourcentage d’EPP continues')).toBe(64.2);
  });
});

describe('rapport collège', () => {
  const model = buildDrenReport(collegeRaw, 'college');
  it('calcule les effectifs par secteur et non depuis un champ absent', () => {
    const effectif = model.general[0].rows.find((r) => r.label === 'Effectif des élèves')!;
    expect(effectif.cells[0].value).toBe(5760);
    expect(effectif.cells[1].value).toBe(3900);
  });
  it('place les goulots en 0–100 et conserve la valeur brute', () => {
    expect(model.bottlenecks).toHaveLength(12);
    const section = model.bottlenecks.find((b) => b.label === 'Ratio élèves-section')!;
    expect(section.value).toBeLessThanOrEqual(100);
    expect(section.raw).toBeCloseTo(9.75, 2);
  });
  it('affiche les trois tableaux de flux dans l’ordre du collège', () => {
    expect(model.flows.map((f) => f.title)).toEqual([
      'Pourcentage de redoublants (en %)',
      'Taux de Promotion (%)',
      'Taux d’abandon (%)',
    ]);
  });
});

describe('diagnostic d’efficience', () => {
  it('reprend le texte de la case moyenne/moyenne', () => {
    expect(efficienceDiagnosis(40, 50)[0]).toContain('se situe dans la moyenne');
  });
  it('reprend le texte méritant de la case haute/moyenne', () => {
    expect(efficienceDiagnosis(50, 90)[0]).toContain('C’est méritant');
  });
  it('ne fabrique pas de diagnostic sans score', () => {
    expect(efficienceDiagnosis(null, 50)[0]).toContain('non calculable');
  });
});

describe('rapport lycée', () => {
  const model = buildDrenReport({ ...collegeRaw, niveau: 'lycee', grades: 3 }, 'lycee');
  it('inverse promotion et redoublants et conserve les valeurs négatives', () => {
    expect(model.flows[0].title).toBe('Taux de Promotion (%)');
    expect(model.flows[1].title).toBe('Pourcentage de redoublants (en %)');
    const abandon = model.flows[2].rows[0];
    expect(abandon.cells[0].status === 'review' || abandon.cells[0].status === 'ok' || abandon.cells[0].status === 'missing').toBe(true);
  });
  it('propose six séries BACC', () => {
    expect(model.exams).toHaveLength(6);
    expect(model.exams.map((e) => e.title)).toEqual([
      'BACC SÉRIE C', 'BACC SÉRIE D', 'BACC SÉRIE A', 'BACC SÉRIE LITTÉRAIRE', 'BACC SÉRIE SCIENTIFIQUE', 'BACC SÉRIE OSE',
    ]);
  });
});

describe('rapport préscolaire', () => {
  const model = buildDrenReport({ ...collegeRaw, niveau: 'presco', grades: 3 }, 'presco');
  it('n’affiche ni efficience ni manuels ni tableaux de flux', () => {
    expect(model.efficiency).toBeNull();
    expect(model.manuals).toBeNull();
    expect(model.flows).toHaveLength(0);
  });
  it('affiche six goulots', () => {
    expect(model.bottlenecks).toHaveLength(6);
  });
  it('applique les formules de préscolarisation 3–4 ans et d’abandon', () => {
    const row = (label: string) => model.coverage.rows.find((r) => r.label === label)!;
    expect(row('Taux de préscolarisation de 3 à 4 ans (public)').cells[0].value).toBeCloseTo(5.6, 1);
    expect(row('Parité filles / garçons de 3 à 4 ans').cells[0].value).toBe(1);
    expect(row('Taux de préscolarisation privé (3 à 5 ans)').cells[0].value).toBeCloseTo(2.6, 1);
    expect(row('Pourcentage d’abandon').cells[0].value).toBe(0);
  });
});
