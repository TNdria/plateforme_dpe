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

describe('évaluations nationales des acquis (UEAS)', () => {
  const withUeas = () => {
    const raw = JSON.parse(JSON.stringify(primaryRaw));
    raw.ueas = [
      { CODE_DREN: 12, NIVEAU: 'T2', MATIERE: 'Lecture', SECTEUR: 'PUBLIC', MOYENNE: 42.5, ECART_TYPE: 12.1, PCT_50: 61.2 },
      { CODE_DREN: 12, NIVEAU: 'T2', MATIERE: 'Lecture', SECTEUR: 'ENSEMBLE', MOYENNE: 46, ECART_TYPE: 11.4, NB_SEUIL50: 620, ELEVES_TESTES: 1000 },
      { CODE_DREN: 0, NIVEAU: 'T2', MATIERE: 'Lecture', SECTEUR: 'MADA', MOYENNE: 38, ECART_TYPE: 13, PCT_50: 48.5 },
    ];
    return raw;
  };

  it('remplit Public, Ensemble et MADA sans inventer le Privé', () => {
    const model = buildDrenReport(withUeas(), 'primaire');
    const block = model.ueas.find((b) => b.title.includes('T2'))!;
    const lecture = block.subjectRows.find((r) => r.label === 'Lecture')!;
    expect(lecture.cells[0].value).toBeCloseTo(42.5, 1);
    expect(lecture.cells[0].display).toBe('42.5');
    expect(lecture.cells[2].display).toBe('61.2%');
    expect(lecture.cells[3].status).toBe('missing');
    expect(lecture.cells[6].value).toBeCloseTo(46, 1);
    expect(lecture.cells[8].value).toBeCloseTo(62, 1);
    expect(lecture.cells[9].value).toBeCloseTo(38, 1);
    expect(lecture.cells[11].value).toBeCloseTo(48.5, 1);
  });

  it('laisse « — » les matières et niveaux absents de l’import', () => {
    const model = buildDrenReport(withUeas(), 'primaire');
    const t2 = model.ueas.find((b) => b.title.includes('T2'))!;
    const maths = t2.subjectRows.find((r) => r.label === 'Mathématique')!;
    expect(maths.cells[0].status).toBe('missing');
    expect(maths.cells[0].display).toBe('—');
    const t5 = model.ueas.find((b) => b.title.includes('T5'))!;
    expect(t5.subjectRows.every((r) => r.cells.every((c) => c.value === null))).toBe(true);
  });

  it('sans import UEAS, les tableaux restent vides', () => {
    const model = buildDrenReport(JSON.parse(JSON.stringify(primaryRaw)), 'primaire');
    expect(model.ueas).toHaveLength(2);
    expect(model.ueas.every((b) => b.subjectRows.every((r) => r.cells.every((c) => c.value === null)))).toBe(true);
  });
});

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
  it('réserve Ensemble aux classes par salle, élèves par place et distance de 2 km', () => {
    const applicable = ['section_salle', 'eleves_place', 'moins_2km'];
    expect(model.other.rows.filter(r => r.cells[0].status !== 'na').map(r => r.meta?.code)).toEqual(applicable);
    for (const row of model.other.rows.filter(r => !applicable.includes(r.meta?.code ?? ''))) {
      expect(row.cells[0].value).toBeNull();
    }
  });
  it('garde les trois cellules Ensemble applicables lorsque leurs données sont absentes', () => {
    const report = buildDrenReport({ annee: 2025, dren: {}, mada: {} }, 'primaire');
    for (const code of ['section_salle', 'eleves_place', 'moins_2km']) {
      expect(report.other.rows.find(r => r.meta?.code === code)?.cells[0].status).toBe('missing');
    }
  });
  it('raccorde les autres matières à leurs agrégats DREN et MADA par classe', () => {
    const extra = { eleves_12: 200, eleves_3: 300, eleves_45: 400,
      manuel_autres_12: 50, manuel_autres_3: 100, manuel_autres_45: 200,
      r2_manuel_autres_12: 0.2, r2_manuel_autres_3: 0.4, r2_manuel_autres_45: 0.6 };
    const report = buildDrenReport({ ...primaryRaw, primaire_extra: {
      dren: { public: extra }, mada: { public: { ...extra, manuel_autres_12: 100, manuel_autres_3: 150, manuel_autres_45: 400 } },
    } }, 'primaire');
    const rows = report.manuals?.rows.filter(r => r.label.startsWith('Autres matières')) ?? [];
    expect(rows).toHaveLength(3);
    expect(rows.map(r => r.cells[0].value)).toEqual([4, 3, 2]);
    expect(rows.map(r => r.cells[1].value)).toEqual([2, 2, 1]);
    rows.forEach((r, i) => expect(r.cells[2].value).toBeCloseTo([80, 60, 40][i]));
  });
  it('ne répartit pas le total global autres entre les groupes sans source', () => {
    const report = buildDrenReport({ ...primaryRaw, primaire_extra: {
      dren: { ensemble: { eleves: 1000, manuel_autres: 200, r2_manuel_autres: 0.8 } },
    } }, 'primaire');
    const rows = report.manuals?.rows.filter(r => r.label.startsWith('Autres matières')) ?? [];
    expect(rows).toHaveLength(3);
    expect(rows.every(r => r.cells.every(c => c.status === 'missing'))).toBe(true);
  });
  it('affiche les sections et les 13 goulots', () => {
    expect(model.title).toBe('PRIMAIRE');
    expect(model.anneeLabel).toBe('2024 - 2025');
    expect(model.general).toHaveLength(3);
    expect(model.bottlenecks).toHaveLength(12);
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
    const exact = buildDrenReport({ ...primaryRaw, primaire_extra: {
      dren: { public: { ens_qualifies: 30, ens_classe: 40 }, ensemble: { ens_qualifies: 45, ens_classe: 60 } },
      mada: { public: { ens_qualifies: 50, ens_classe: 80 } },
    } }, 'primaire');
    expect(exact.human.rows[0].cells[0].value).toBeCloseTo(75, 1);
    expect(exact.human.rows[0].cells[1].value).toBeCloseTo(75, 1);
    expect(exact.human.rows[0].cells[2].value).toBeCloseTo(62.5, 1);
  });
  it('ne remplace pas la qualification académique et pédagogique par l’ancien calcul', () => {
    expect(model.human.rows[0].cells[1].status).toBe('missing');
    expect(model.human.rows[0].cells[2].status).toBe('missing');
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
  it('aligne chaque effectif avec les enseignants et manuels du même établissement', () => {
    const report = buildDrenReport({ ...primaryRaw, primaire_extra: {
      dren: { public: { repartition: [
        { code_etab: 101, nom_etab: 'EPP A', eleves: 120, enseignants: 4, eleves_12: 60, manuel_cal_12: 30 },
        { code_etab: 202, nom_etab: 'EPP B', eleves: 240, enseignants: 6, eleves_12: 100, manuel_cal_12: 20 },
      ] } },
    } }, 'primaire');
    expect(report.teacherAllocation).toEqual([
      { codeEtab: '101', nomEtab: 'EPP A', eleves: 120, enseignants: 4 },
      { codeEtab: '202', nomEtab: 'EPP B', eleves: 240, enseignants: 6 },
    ]);
    expect(report.manualAllocation).toEqual([
      { codeEtab: '101', nomEtab: 'EPP A', matiere: 'Mathématiques', groupe: 'T1-T2', eleves: 60, manuels: 30 },
      { codeEtab: '202', nomEtab: 'EPP B', matiere: 'Mathématiques', groupe: 'T1-T2', eleves: 100, manuels: 20 },
    ]);
  });
  it('conserve les observations manuelles incomplètes hors du tableau plutôt que de les compléter', () => {
    const report = buildDrenReport({ ...primaryRaw, primaire_extra: {
      dren: { public: { repartition: [{ code_etab: 101, nom_etab: 'EPP A', eleves_12: 60, manuel_cal_12: null }] } },
    } }, 'primaire');
    expect(report.manualAllocation).toEqual([]);
  });
});

describe('nuage d’efficience DREN', () => {
  const population = [
    { DREN: 'ATSINANANA', CODE_DREN: 12, nombre_eleves: 289239, ens_classe: 6436, ratio_em: 45, ratio_eq: 22, eleve_2km: 79, point_eau: 12, electricite: 1, ratio_ece: 3665, mlg_sc1: 80, mlg_sc2: 70, fr_sc1: 40, fr_sc2: 35, maths_sc1: 50, maths_sc2: 45, red_ensemble: 10, txRetentionTotal: 65, tx_admis: 43, ratio_epa: 1.8 },
    { DREN: 'ANALAMANGA', CODE_DREN: 11, nombre_eleves: 500000, ens_classe: 9000, ratio_em: 55, ratio_eq: 40, eleve_2km: 60, point_eau: 30, electricite: 10, ratio_ece: 8000, mlg_sc1: 90, mlg_sc2: 85, fr_sc1: 60, fr_sc2: 55, maths_sc1: 70, maths_sc2: 65, red_ensemble: 18, txRetentionTotal: 50, tx_admis: 35, ratio_epa: 2.5 },
  ];
  it('trace les autres DREN importées et exclut la DREN courante', () => {
    const model = buildDrenReport({ ...primaryRaw, efficiencePopulation: population }, 'primaire');
    const siblings = model.efficiency!.points.filter((p) => !p.isCurrent && !p.isParent);
    expect(siblings.map((p) => p.name)).toEqual(['ANALAMANGA']);
    expect(siblings[0].x).not.toBeNull();
    expect(siblings[0].y).not.toBeNull();
    expect(model.efficiency!.siblingsLabel).toBe('DREN');
  });
  it('ajoute MADAGASCAR comme point de comparaison', () => {
    const model = buildDrenReport({ ...primaryRaw, efficiencePopulation: population }, 'primaire');
    const parent = model.efficiency!.points.find((p) => p.isParent);
    expect(parent?.name).toBe('MADAGASCAR');
    expect(parent?.x).not.toBeNull();
  });
  it('utilise les agrégats SQL quand aucun import n’est disponible', () => {
    const report = buildDrenReport({
      ...primaryRaw,
      efficienceDrens: [
        { DREN: 'ATSINANANA', CODE_DREN: 12, nbr_eleve: 289239, pers_en_classe: 6436, nbr_etab: 1780, etab_eau: 217, etab_elec: 12, red_g: 12000, red_f: 11000, eff_t1: 62000, eff_t5: 44000 },
        { DREN: 'ANALAMANGA', CODE_DREN: 11, nbr_eleve: 500000, pers_en_classe: 9000, nbr_etab: 3000, etab_eau: 900, etab_elec: 300, red_g: 40000, red_f: 38000, eff_t1: 110000, eff_t5: 90000 },
      ],
    }, 'primaire');
    expect(report.efficiency!.points.filter((p) => !p.isCurrent && !p.isParent).map((p) => p.name)).toEqual(['ANALAMANGA']);
  });
  it('garde les CISCO comme population des rapports collège et lycée', () => {
    const report = buildDrenReport(collegeRaw, 'college');
    expect(report.efficiency!.siblingsLabel).toBe('CISCO');
    expect(report.efficiency!.points.filter((p) => !p.isCurrent && !p.isParent).map((p) => p.name)).toEqual(['TOAMASINA I', 'BRICKAVILLE']);
  });
  it('donne un score aux CISCO agrégés et les différencie par leurs ressources', () => {
    const report = buildDrenReport({
      ...collegeRaw,
      ciscos: [
        { CISCO: 'FAVORISE', CODE_CISCO: 1, etab: 30, eleves: 9000, redoublants: 400, ens_classe: 300, qualifies: 250, eau: 27, elec: 12, eleve_proche: 7000 },
        { CISCO: 'DEFAVORISE', CODE_CISCO: 2, etab: 40, eleves: 5000, redoublants: 900, ens_classe: 250, qualifies: 80, eau: 8, elec: 1, eleve_proche: 1500 },
      ],
    }, 'college');
    const [good, weak] = report.efficiency!.points.filter((p) => !p.isCurrent && !p.isParent);
    // Les lignes CISCO ne portent que des totaux : sans repli sur `eleves` /
    // `redoublants`, `effectif()` reste null et le point n'est pas tracé.
    expect(good.x).not.toBeNull();
    expect(good.y).not.toBeNull();
    expect(good.x!).toBeGreaterThan(weak.x!);
    expect(good.y!).toBeGreaterThan(weak.y!);
  });
});

describe('rapport primaire avec les deux secteurs', () => {
  it('calcule les trois admissions nationales sans effectifs CM2', () => {
    const report = buildDrenReport({ ...primaryRaw, mada: { cepe: primaryRaw.mada.cepe } }, 'primaire');
    expect(report.exams[0].admissionRows[0].cells[3].value).toBeCloseTo(418000 / 700000 * 100);
    expect(report.exams[0].admissionRows[1].cells[3].value).toBeCloseTo(208000 / 350000 * 100);
    expect(report.exams[0].admissionRows[2].cells[3].value).toBe(60);
  });
  it('exprime les salles par enfant sur une base 100 et non 1000', () => {
    const report = buildDrenReport(primaryRaw, 'primaire');
    expect(report.bottlenecks.find(b => b.meta.code === 'salles_1000')?.raw).toBeCloseTo(2226 / 380000 * 100);
  });
  it('exprime les enseignants par enfant sur une base 100 et non 1000', () => {
    const report = buildDrenReport(primaryRaw, 'primaire');
    expect(report.bottlenecks.find(b => b.meta.code === 'enseignants_1000')?.raw).toBeCloseTo(6436 / 380000 * 100);
  });
  it('exprime la couverture en places assises sur une base 100', () => {
    const report = buildDrenReport(primaryRaw, 'primaire');
    expect(report.bottlenecks.find(b => b.meta.code === 'places_enfant')?.raw).toBeCloseTo(159716 / 380000 * 100);
  });
  it('exprime les enseignants par groupe pédagogique sur une base 100', () => {
    const report = buildDrenReport(primaryRaw, 'primaire');
    expect(report.bottlenecks.find(b => b.meta.code === 'groupe_enseignant')?.raw).toBeCloseTo(6436 / 8663 * 100);
  });
  const withPrivate = () => {
    const raw = JSON.parse(JSON.stringify(primaryRaw));
    raw.dren.personnel.qualifies_classe = 1436;
    raw.dren_prive = {
      ressources: {
        nbr_etab: 220, nbr_eleve: 36572, nbr_eleve_f: 18000,
        eff_t1: 8000, eff_t2: 7000, eff_t3: 6000, eff_t4: 5000, eff_t5: 4000,
        red_t1: 1000, red_t2: 800, red_t3: 600, red_t4: 500, red_t5: 400,
        eff_t1_g: 4000, eff_t1_f: 4000, eff_t2_g: 3600, eff_t2_f: 3400,
        eff_t3_g: 3000, eff_t3_f: 3000, eff_t4_g: 2500, eff_t4_f: 2500,
        red_t2_g: 400, red_t2_f: 400, red_t3_g: 300, red_t3_f: 300, red_t4_g: 250, red_t4_f: 250, red_t5_g: 200, red_t5_f: 200,
        nbr_section: 1200, nbr_sdc: 500, places_assises: 20000,
        latrines: 100, latrines_fille: 30, eleve_2km: 30000,
        etab_eau: 50, etab_elec: 5, ecole_continue: 180,
        etab_latrine_f: 80, etab_cantine: 50, etab_handicap: 10,
        reinseres: 12, nbr_eleve_t1_t2: 15000, nbr_eleve_t3: 6000, nbr_eleve_t4_t5: 9000,
        etab_avec_cap: 60,
      },
      personnel: { nbr_pers: 800, pers_en_classe: 700, fonctionnaire: 0, sub: 100, non_sub: 600, qualifies_classe: 200, sans_diplome_ped: 500 },
      sections: { nbr_section: 1200, nbr_sdc: 500 },
      places: { places_assises: 20000, latrines: 100, latrines_fille: 30, etab_latrine_f: 80, etab_handicap: 10 },
      manuels: { malagasy: 30000, maths: 20000, francais: 10000, manuel_t1_t2: 25000, manuel_t3: 8000, manuel_t4_t5: 9000 },
      annee_suivante: { ressources: {
        eff_t2: 7000, red_t2: 800, eff_t3: 6000, red_t3: 600, eff_t4: 5000, red_t4: 500, eff_t5: 4000, red_t5: 400,
        eff_t2_g: 3600, red_t2_g: 400, eff_t2_f: 3400, red_t2_f: 400,
        eff_t3_g: 3000, red_t3_g: 300, eff_t3_f: 3000, red_t3_f: 300,
        eff_t4_g: 2500, red_t4_g: 250, eff_t4_f: 2500, red_t4_f: 250,
        eff_t5_g: 2000, red_t5_g: 200, eff_t5_f: 2000, red_t5_f: 200,
      } },
      cepe: { total_candidats: 5000, nbr_g: 2500, nbr_f: 2500, admis_g: 1800, admis_f: 1900, sm_mlg: 9.2, mlg_sup10: 4000, sm_frs: 6.5, frs_sup10: 2000, sm_mths: 5.5, mths_sup10: 1500, sm_total: 9.0, autres_sup10: 3000 },
    };
    raw.dren_ensemble = { cepe: { total_candidats: 50000, nbr_g: 25000, nbr_f: 25000, admis_g: 15000, admis_f: 16000, sm_mlg: 10.1, mlg_sup10: 40000, sm_frs: 7.1, frs_sup10: 25000, sm_mths: 6.0, mths_sup10: 18000, sm_total: 9.4, autres_sup10: 35000 } };
    return raw;
  };

  it('additionne les comptes publics et privés dans Ensemble', () => {
    const model = buildDrenReport(withPrivate(), 'primaire');
    const row = (label: string) => model.general.flatMap((t) => t.rows).find((r) => r.label === label)!;
    expect(row('Nombre de sections').cells[0].value).toBe(9863);
    expect(row('Nombre de sections').cells[1].value).toBe(8663);
    expect(row('Dont filles').cells[0].value).toBe(161605);
    expect(row('Nombre d’enfants réinsérés').cells[0].value).toBe(12);
    expect(row('Nombre d’enfants réinsérés').cells[0].display).not.toContain('%');
    expect(row('Nombre de places assises').cells[0].value).toBe(179716);
  });

  it('remplit les colonnes Privé et Ensemble des flux', () => {
    const model = buildDrenReport(withPrivate(), 'primaire');
    const red = model.flows.find((f) => f.title.includes('redoublants'))!;
    const t1 = red.rows.find((r) => r.label === 'T1')!;
    expect(t1.cells[1].value).toBeCloseTo(12.5, 1);
    expect(t1.cells[2].value).toBeCloseTo(32.5, 1);
    const promo = model.flows.find((f) => f.title.includes('Promotion'))!;
    expect(promo.rows.find((r) => r.label === 'T1 → T2')!.cells[1].value).toBeCloseTo(77.5, 1);
    expect(promo.rows.find((r) => r.label === 'Garçons')!.cells[1].value).not.toBeNull();
    expect(promo.rows.find((r) => r.label === 'Filles')!.cells[1].value).not.toBeNull();
  });

  const latestYear = () => {
    const raw = withPrivate();
    delete raw.dren.annee_suivante;
    delete raw.dren_prive.annee_suivante;
    delete raw.mada.annee_suivante;
    raw.dren.annee_precedente = { ressources: { eff_t1: 60000, eff_t2: 56000, eff_t3: 52000, eff_t4: 48000 } };
    raw.dren_prive.annee_precedente = { ressources: { eff_t1: 7800, eff_t2: 6900, eff_t3: 5900, eff_t4: 4900 } };
    raw.mada.annee_precedente = { ressources: { eff_t1: 890000, eff_t2: 840000, eff_t3: 790000, eff_t4: 750000 } };
    return raw;
  };

  it('mesure le flux entrant quand l’année suivante n’est pas encore disponible', () => {
    const model = buildDrenReport(latestYear(), 'primaire');
    const promo = model.flows.find((f) => f.title.includes('Promotion'))!;
    const row = promo.rows.find((r) => r.label === 'T1 → T2')!;
    expect(row.cells[0].value).toBeCloseTo(65.4, 1);
    expect(row.cells[1].value).toBeCloseTo(79.5, 1);
    expect(row.cells[2].value).toBeCloseTo(((58000 + 7000) - (18734 + 800)) / (60000 + 7800) * 100, 1);
    expect(row.cells[3].value).not.toBeNull();
    expect(row.cells[0].status).not.toBe('missing');
  });

  it('n’oppose pas un dénominateur public à un numérateur des deux secteurs', () => {
    const raw = latestYear();
    delete raw.dren_prive.annee_precedente;
    const model = buildDrenReport(raw, 'primaire');
    const row = model.flows.find((f) => f.title.includes('Promotion'))!.rows.find((r) => r.label === 'T1 → T2')!;
    expect(row.cells[0].value).not.toBeNull();
    expect(row.cells[2].value).toBeNull();
  });

  it('remplit le CEPE privé et l’ensemble sans recopier le public', () => {
    const model = buildDrenReport(withPrivate(), 'primaire');
    const row = model.exams[0].subjectRows[0];
    expect(row.cells[2].value).toBeCloseTo(9.2, 1);
    expect(row.cells[3].value).toBeCloseTo(80, 1);
    expect(row.cells[4].value).toBeCloseTo(10.1, 1);
    expect(row.cells[5].value).toBeCloseTo(80, 1);
  });

  it('calcule les indicateurs de ressources avec les nouveaux agrégats', () => {
    const model = buildDrenReport(withPrivate(), 'primaire');
    for (const label of ['Pourcentage d’établissements avec cantine scolaire', 'Pourcentage d’établissements accueillant des élèves en situation de handicap', 'Pourcentage d’établissements avec latrine pour filles']) {
      const cell = model.other.rows.find((r) => r.label === label)?.cells[0];
      expect(cell?.status).toBe('na');
      expect(cell?.value).toBeNull();
    }
    const manuals = model.bottlenecks.find((b) => b.meta.code === 'manuel_eleve');
    expect(manuals?.raw).toBeCloseTo(25000 / 15000 * 100, 2);
    expect(manuals?.meta.unit).toBe('%');
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
    const section = model.bottlenecks.find((b) => b.meta.code === 'eleves_section');
    expect(section?.value).toBeLessThanOrEqual(100);
    expect(section?.raw).toBeCloseTo(100 / 9.75, 2);
    expect(model.bottlenecks.every(b => b.meta.unit === '%')).toBe(true);
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

describe('Ensemble columns from imported indicateurs', () => {
  const withImports = () => {
    const raw = JSON.parse(JSON.stringify(primaryRaw));
    raw.dren.indicateurs = {
      ratio_em: 31.5, ratio_eq: 33.3,
      red_ensemble: 22.3, red_garcons: 23.5, red_fille: 20.8,
      red_CP1: 29.1, red_CP2: 25.0, red_CE: 23.8, red_CM1: 19.6, red_CM2: 15.8,
      txAbdcp1cp2: 9.0, txAbdcp2ce: 7.1, txAbdcecm1: 12.4, txAbdcm1cm2: 15.4, txAbdGlobal: 10.5,
      TPA: 52.5,
    };
    return raw;
  };
  const findRow = (table: any, label: string) => table.rows.find((r: any) => r.label === label);

  it('fills redoublants Ensemble column from imported red_* indicateurs', () => {
    const model = buildDrenReport(withImports(), 'primaire');
    const red = model.flows.find((f: any) => f.title.includes('redoublants'));
    // columns: Public, Privé, Ensemble, MADA
    expect(findRow(red, 'T1').cells[2].value).toBeCloseTo(29.1);
    expect(findRow(red, 'Ensemble').cells[2].value).toBeCloseTo(22.3);
    expect(findRow(red, 'Garçons').cells[2].value).toBeCloseTo(23.5);
    expect(findRow(red, 'Filles').cells[2].value).toBeCloseTo(20.8);
  });

  it('fills abandon Ensemble column from imported txAbd* indicateurs', () => {
    const model = buildDrenReport(withImports(), 'primaire');
    const aband = model.flows.find((f: any) => f.title.includes('abandon'));
    expect(findRow(aband, 'T1 → T2').cells[2].value).toBeCloseTo(9.0);
    expect(findRow(aband, 'Ensemble').cells[2].value).toBeCloseTo(10.5);
  });

  it('fills promotion Ensemble total from imported TPA', () => {
    const model = buildDrenReport(withImports(), 'primaire');
    const promo = model.flows.find((f: any) => f.title.includes('Promotion'));
    expect(findRow(promo, 'Ensemble').cells[2].value).toBeCloseTo(52.5);
  });

  it('fills ratio élève-maître and qualified teachers Ensemble from ratio_em/ratio_eq', () => {
    const model = buildDrenReport(withImports(), 'primaire');
    expect(findRow(model.human, 'Ratio élève-maître').cells[0].value).toBeCloseTo(31.5);
    expect(findRow(model.human, 'Pourcentage des enseignants qualifiés').cells[0].value).toBeCloseTo(33.3);
  });

  it('keeps Ensemble cells missing when no imported indicateurs exist', () => {
    const model = buildDrenReport(JSON.parse(JSON.stringify(primaryRaw)), 'primaire');
    const red = model.flows.find((f: any) => f.title.includes('redoublants'));
    expect(findRow(red, 'T1').cells[2].value).toBeNull();
    expect(findRow(model.human, 'Ratio élève-maître').cells[0].value).toBeNull();
  });

  it('computes TNS/TNA from age breakdown provided by the API', () => {
    const model = buildDrenReport(JSON.parse(JSON.stringify(primaryRaw)), 'primaire');
    const tns = model.coverage.rows.find((r: any) => r.label === 'TNS (%)');
    const tna = model.coverage.rows.find((r: any) => r.label === 'TNA (%)');
    // 250000 élèves de 6-10 ans / 380000 pop = 65.8 %
    expect(tns.cells[0].value).toBeCloseTo(65.8, 0);
    // 60000 nouveaux de 6 ans / 75000 pop = 80 %
    expect(tna.cells[0].value).toBeCloseTo(80, 0);
  });
});
