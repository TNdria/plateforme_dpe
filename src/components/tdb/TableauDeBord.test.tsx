import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TableauDeBord } from './TableauDeBord';

const primary = {
  annee: 2025,
  code_dren: 12,
  names: { DREN: 'ATSINANANA' },
  dren: {
    ressources: {
      nbr_cisco: 7, nbr_zap: 99, nbr_etab: 1780, nbr_etab_ferme: 0,
      nbr_eleve: 289239, nbr_eleve_f: 143605,
      eff_t1: 62000, eff_t2: 58000, eff_t3: 54000, eff_t4: 50000, eff_t5: 44000,
      red_t1: 21762, red_t2: 18734, red_t3: 16578, red_t4: 11300, red_t5: 11616,
      nbr_section: 8663, nbr_sdc: 2226, places_assises: 159716,
      latrines: 575, latrines_fille: 148, eleve_2km: 229000, etab_eau: 217, etab_elec: 12,
      ecole_continue: 1300, etab_latrine_f: 617,
    },
    annee_suivante: { ressources: { eff_t2: 58000, red_t2: 18734, red_t1: 21000 } },
    personnel: { nbr_pers: 6611, pers_en_classe: 6436, fonctionnaire: 2474, sub: 1971, non_sub: 1963, sans_diplome_ped: 5000 },
    sections: { nbr_section: 8663, nbr_sdc: 2226 },
    places: { places_assises: 159716, latrines: 575, latrines_fille: 148 },
    cepe: { total_candidats: 40000, nbr_g: 20000, nbr_f: 20000, admis_g: 8300, admis_f: 9000, sm_mlg: 9.6, mlg_sup10: 23600 },
    caisse: { total_fce: 1060000000 },
    manuels: {},
  },
  mada: {},
  efficience: [],
};

describe('TableauDeBord', () => {
  it('rend l’en-tête, les bandeaux, les 13 goulots et la matrice', () => {
    const html = renderToStaticMarkup(<TableauDeBord data={primary} niveau="primaire" codeDren="12" />);
    expect(html).toContain('TABLEAU DE BORD PRIMAIRE 2024 - 2025');
    expect(html).toContain('Ministère de l’Éducation Nationale');
    expect(html).toContain('DREN : ');
    expect(html).toContain('CODE : ');
    expect(html).toContain('DONNÉES GÉNÉRALES');
    expect(html).toContain('RÉSULTATS SCOLAIRES');
    expect(html).toContain('RESSOURCES');
    expect(html).toContain('ANALYSE DES GOULOTS D’ÉTRANGLEMENT (PUBLIC)');
    expect(html).toContain('EFFICIENCE (PUBLIC)');
    expect(html).toContain('Nombre de manuels par élève T4-T5');
    expect(html).toContain('Remarque(s) et Diagnostique(s)');
  });

  it('affiche un tiret bleu pour une donnée absente et un 0 pour un zéro réel', () => {
    const html = renderToStaticMarkup(<TableauDeBord data={primary} niveau="primaire" codeDren="12" />);
    expect(html).toContain('tdb-cell-missing" title="Nombre d’écoles fermées">—</td>');
    expect(html).toContain('title="Nombre d’écoles fermées">0</td>');
  });

  it('trace le nuage avec les autres DREN comparées', () => {
    const html = renderToStaticMarkup(<TableauDeBord data={{
      ...primary,
      efficienceDrens: [
        { DREN: 'ANALAMANGA', CODE_DREN: 11, nbr_eleve: 500000, pers_en_classe: 9000, nbr_etab: 3000, etab_eau: 900, etab_elec: 300, red_g: 40000, red_f: 38000 },
        { DREN: 'ATSINANANA', CODE_DREN: 12, nbr_eleve: 289239, pers_en_classe: 6436 },
      ],
    }} niveau="primaire" codeDren="12" />);
    expect(html).toContain('<title>ANALAMANGA</title>');
    expect(html).toContain('● DREN');
  });

  it('n’affiche pas de matrice au préscolaire et six goulots', () => {
    const html = renderToStaticMarkup(<TableauDeBord data={{ ...primary, niveau: 'presco', grades: 3 }} niveau="presco" codeDren="12" />);
    expect(html).not.toContain('EFFICIENCE (PUBLIC)');
    expect(html).toContain('Centres avec salles d’activités');
    expect(html).not.toContain('Centres avec bibliothèque');
  });

  it('rend les six séries BACC au lycée', () => {
    const html = renderToStaticMarkup(<TableauDeBord data={{ ...primary, niveau: 'lycee', grades: 3 }} niveau="lycee" codeDren="12" />);
    for (const title of ['BACC SÉRIE C', 'BACC SÉRIE D', 'BACC SÉRIE A', 'BACC SÉRIE LITTÉRAIRE', 'BACC SÉRIE SCIENTIFIQUE', 'BACC SÉRIE OSE']) {
      expect(html).toContain(title);
    }
  });
});
