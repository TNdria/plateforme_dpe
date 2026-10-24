import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { TableauDeBord } from '../src/components/tdb/TableauDeBord';

const sector = (over: Record<string, any> = {}) => ({
  etab: 100, etab_ferme: 2, salles: 300, sections: 400, places: 12000,
  eff1_g: 600, eff1_f: 600, eff2_g: 500, eff2_f: 500, eff3_g: 450, eff3_f: 450, eff4_g: 400, eff4_f: 400,
  red1_g: 60, red1_f: 60, red2_g: 40, red2_f: 40, red3_g: 30, red3_f: 30, red4_g: 90, red4_f: 90,
  ens: 500, ens_classe: 450, fonct: 300, fram_sub: 50, fram_non_sub: 100, qualifies: 180,
  latrines: 120, latrines_f: 30, eleve_proche: 4500, elec: 30, eau: 110, avec_primaire: 60,
  taux_transition: 85.1, ...over,
});

const primary = {
  annee: 2025, code_dren: 12, names: { DREN: 'ATSINANANA' },
  dren: {
    nombre_eleves_tous_secteurs: 325811,
    population: { pop_6ans: 75000, pop_6_10: 380000, pop_10ans: 76000 },
    ressources: {
      nbr_cisco: 7, nbr_zap: 99, nbr_etab: 1780, nbr_etab_ferme: 0,
      nbr_eleve: 289239, nbr_eleve_f: 143605,
      eff_t1: 62000, eff_t2: 58000, eff_t3: 54000, eff_t4: 50000, eff_t5: 44000,
      red_t1: 21762, red_t2: 18734, red_t3: 16578, red_t4: 11300, red_t5: 11616,
      nbr_section: 8663, nbr_sdc: 2226, places_assises: 159716,
      latrines: 575, latrines_fille: 148, eleve_2km: 229000, etab_eau: 217, etab_elec: 12,
      ecole_continue: 1300, etab_latrine_f: 617,
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
      etab_eau: 2400, etab_elec: 240, ecole_continue: 19000, etab_latrine_f: 6700,
    },
    annee_suivante: { ressources: { eff_t2: 850000, red_t2: 205700, red_t1: 205000, eff_t3: 800000, red_t3: 193600, eff_t4: 760000, red_t4: 150000, eff_t5: 720000, red_t5: 154800 } },
    personnel: { nbr_pers: 100000, pers_en_classe: 95000, fonctionnaire: 60000, sub: 20000, non_sub: 15000, sans_diplome_ped: 79000 },
    sections: { nbr_section: 120000, nbr_sdc: 30000 },
    places: { places_assises: 2000000, latrines: 10000, latrines_fille: 2400 },
    cepe: { total_candidats: 700000, nbr_g: 350000, nbr_f: 350000, admis_g: 208000, admis_f: 210000, sm_mlg: 8.6, mlg_sup10: 363300, sm_frs: 3.1, frs_sup10: 170000, sm_mths: 4.9, mths_sup10: 100000, sm_total: 10.6, autres_sup10: 465000 },
    caisse: { total_fce: 14820000000 },
    manuels: { malagasy: 2000000, maths: 1800000, francais: 900000 },
  },
  efficience: [
    { CISCO: 'TOAMASINA I', nbr_eleve: 50000, pers_en_classe: 900, admis: 5000, inscrits_cepe: 9000 },
    { CISCO: 'TOAMASINA II', nbr_eleve: 38000, pers_en_classe: 820, admis: 3800, inscrits_cepe: 8000 },
    { CISCO: 'BRICKAVILLE', nbr_eleve: 30000, pers_en_classe: 700, admis: 2000, inscrits_cepe: 6000 },
    { CISCO: 'MAHANORO', nbr_eleve: 22000, pers_en_classe: 640, admis: 1200, inscrits_cepe: 5000 },
    { CISCO: 'MAROLAMBO', nbr_eleve: 26000, pers_en_classe: 700, admis: 1800, inscrits_cepe: 5400 },
    { CISCO: 'VATOMANDRY', nbr_eleve: 24000, pers_en_classe: 660, admis: 1600, inscrits_cepe: 5200 },
    { CISCO: 'ANTANAMBAO-MANAMPOTSY', nbr_eleve: 18000, pers_en_classe: 520, admis: 900, inscrits_cepe: 4200 },
  ],
};

const college = {
  niveau: 'college', annee: 2025, code_dren: 12, names: { DREN: 'ATSINANANA' }, nb_cisco: 7, nb_zap: 99, grades: 4,
  dren: { '0': sector(), '1': sector({ etab: 50, salles: 120, sections: 150, places: 5000, ens: 180, ens_classe: 160, qualifies: 40, eff1_g: 300, eff1_f: 300, eff2_g: 250, eff2_f: 250, eff3_g: 200, eff3_f: 200, eff4_g: 180, eff4_f: 180 }) },
  mada: { '0': sector({ etab: 150, etab_ferme: 1, salles: 420, sections: 520, places: 15000, ens: 700, ens_classe: 650 }), '1': sector({ etab: 80 }) },
  dren_next: { '0': sector(), '1': sector() },
  mada_next: { '0': sector(), '1': sector() },
  pop_dren: { p0: 20000, p1: 19000, p2: 18000, p3: 17000, p4: 74000 },
  pop_mada: { p0: 600000, p1: 580000, p2: 560000, p3: 540000, p4: 2280000 },
  ciscos: [
    { CISCO: 'TOAMASINA I', eleves: 9000, redoublants: 700, ens_classe: 300 },
    { CISCO: 'TOAMASINA II', eleves: 7000, redoublants: 800, ens_classe: 280 },
    { CISCO: 'BRICKAVILLE', eleves: 5000, redoublants: 600, ens_classe: 250 },
    { CISCO: 'MAHANORO', eleves: 4000, redoublants: 300, ens_classe: 190 },
    { CISCO: 'MAROLAMBO', eleves: 3500, redoublants: 400, ens_classe: 170 },
    { CISCO: 'VATOMANDRY', eleves: 3800, redoublants: 350, ens_classe: 180 },
  ],
  bepc_dren: { total_candidats: 10000, nbr_g: 5000, nbr_f: 5000, admis_g: 1585, admis_f: 3025, tx_admis: 46.5, tx_admis_g: 31.7, tx_admis_f: 60.5, sm_mlg: 9.8, mlg_sup10: 4000, sm_frs: 8.1, frs_sup10: 3000, sm_math: 7.2, math_sup10: 2500, sm_svt: 10.1, svt_sup10: 5000, sm_phys: 9.9, phys_sup10: 4800 },
  bepc_mada: { total_candidats: 250000, nbr_g: 125000, nbr_f: 125000, admis_g: 56500, admis_f: 97500, tx_admis: 62.8, tx_admis_g: 45.2, tx_admis_f: 78.6, sm_mlg: 10.2, mlg_sup10: 120000, sm_frs: 8.8, frs_sup10: 90000, sm_math: 7.8, math_sup10: 70000, sm_svt: 10.4, svt_sup10: 130000, sm_phys: 10.1, phys_sup10: 125000 },
};

const cases: [string, any, any][] = [
  ['primaire', primary, 'primaire'],
  ['college', college, 'college'],
  ['presco', { ...college, niveau: 'presco', grades: 3 }, 'presco'],
  ['lycee', { ...college, niveau: 'lycee', grades: 3, bepc_dren: undefined, bepc_mada: undefined }, 'lycee'],
];

const css = resolve('dist/assets/index-C3zE-X5M.css');
const fullCss = readFileSync(resolve('src/index.css'), 'utf8');
const reportCss = fullCss.slice(fullCss.indexOf('/* Tableau de bord DREN'));
for (const [name, data, niveau] of cases) {
  const html = renderToStaticMarkup(<TableauDeBord data={data} niveau={niveau} codeDren="12" />);
  writeFileSync(
    resolve(`tmp/preview-${name}.html`),
    `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><link rel="stylesheet" href="file://${css}"><style>body{margin:0;background:#e8e8e8}${reportCss}</style></head><body>${html}</body></html>`,
  );
  console.log(name, html.length);
}
