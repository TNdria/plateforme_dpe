// TDB DREN pour le préscolaire, le collège et le lycée.
// Renvoie des sommes brutes par secteur (0 = public, 1 = privé) pour la DREN et MADA ;
// les indicateurs sont calculés côté client (src/utils/tdbDrenNiveaux.ts).

import { popSource } from "./refImport.ts";

const n = (col: string) =>
  `(CASE WHEN btrim(regexp_replace(COALESCE(${col}::text,''), '[^0-9.\\-]', '', 'g')) ~ '^-?[0-9]+(\\.[0-9]+)?$'
         THEN btrim(regexp_replace(COALESCE(${col}::text,''), '[^0-9.\\-]', '', 'g'))::numeric ELSE 0 END)`;

export type NiveauDren = 'presco' | 'college' | 'lycee';

const LY_1 = ["_1A", "_1C", "_1D", "_1L", "_1S", "_1OSE"];
const LY_T = ["TA", "TC", "TD", "TL", "TS", "TOSE"];

// `red: false` = le niveau ne porte pas de colonnes *_REDOUBLANT dans sa table d'effectifs
// (cas du préscolaire : seules PS/MS/GS _G et _F existent).
// `ageSuffixes` = suffixe de la colonne « âge officiel » de chaque niveau (TNS) ;
// `cran` = les colonnes *_CRAN (élèves réinsérés) existent pour ce niveau ;
// `prev` = table et dernière classe du cycle précédent (taux de transition).
type Cfg = {
  exist: string; eff: string; grades: string[][]; sections: string[];
  sdc: string; places: string; tenu: string; red: boolean; km?: string;
  pops: number[][];
  ageSuffixes?: string[];
  cran?: boolean;
  prev?: { table: string; exist: string; grade: string };
};
const CFG: Record<NiveauDren, Cfg> = {
  presco: { exist: 'EXISTE_PRESCO', eff: 'fpe_e1', grades: [['PS'], ['MS'], ['GS']], sections: ['PS', 'MS', 'GS'], sdc: 'PRESCO', places: 'places_n0', tenu: 'PRESCO', red: false, pops: [[3], [4], [5], [3, 4, 5]], ageSuffixes: ['_3ANS', '_4ANS', '_5ANS'] },
  college: { exist: 'EXISTE_COLLEGE', eff: 'fpe_e4', grades: [['T6'], ['T7'], ['T8'], ['T9']], sections: ['T6', 'T7', 'T8', 'T9'], sdc: 'COLLEGE', places: 'places_n2', tenu: 'COLLEGE', red: true, km: '5KM', pops: [[11], [12], [13], [14], [11, 12, 13, 14]], ageSuffixes: ['_11ANS', '_12ANS', '_13ANS', '_14ANS'], cran: true, prev: { table: 'fpe_e1', exist: 'EXISTE_PRIMAIRE', grade: 'T5' } },
  lycee: { exist: 'EXISTE_LYCEE', eff: 'fpe_e4', grades: [['_2NDE'], LY_1, LY_T], sections: ['_2NDE', ...LY_1, ...LY_T], sdc: 'LYCEE', places: 'places_n3', tenu: 'LYCEE', red: true, km: '5KM', pops: [[15], [16], [17], [15, 16, 17]], ageSuffixes: ['_15ANS', '_16ANS', '_17ANS'], cran: true, prev: { table: 'fpe_e4', exist: 'EXISTE_COLLEGE', grade: 'T9' } },
};

const sum = (cols: string[], alias: string, suffix: string) => cols.map((c) => n(`${alias}."${c}${suffix}"`)).join('+');

// Codes « matière enseignée » utilisés par la fiche établissement (MATIERE_ENSEIGNEE_1..8).
const MATIERES_LITTERAIRES = ['MLG', 'MALAGASY', 'FRA', 'HG', 'HIS', 'GEO', 'ANG', 'ALL', 'ESP', 'RUS', 'PHI'];
const MATIERES_SCIENTIFIQUES = ['MAT', 'MATH', 'SVT', 'PC', 'CHM', 'PHY', 'INFO', 'TICE', 'TM'];
const MATIERE_COLS = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => `p."MATIERE_ENSEIGNEE_${i}"`);
const VOLUME_COLS = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => `p."VOLUME_HORAIRE_HEBDO_${i}"`);
const matiere = (codes: string[]) =>
  MATIERE_COLS.map((col) => `upper(btrim(COALESCE(${col}::text,''))) ~ '^(${codes.join('|')})$'`).join(' OR ');
const diplome = `upper(COALESCE(p."DIPLOME_ACADEMIQUE",''))`;
const BACC2 = `${diplome} ~ '^BACC\\+[2-9]'`;
const LICENCE = `(${diplome} ~ '^BACC\\+[3-9]' OR ${diplome} LIKE '%LICENCE%' OR ${diplome} LIKE '%MAITRISE%' OR ${diplome} LIKE '%MASTER%' OR ${diplome} LIKE '%DOCTORAT%')`;

// Établissements offrant un aménagement accessible aux élèves en situation de handicap.
const ACCES_ESH = [
  'BUREAU_PROV_DIR_ACCES_ESH', 'BUREAU_PROV_DIR_ADJOINT_ACCES_ESH', 'BUREAU_SURVEILLANT_GENERAL_ACCES_ESH',
  'BUREAU_SURVEILLANT_ACCES_ESH', 'SALLES_PROFESSEURS_ACCES_ESH', 'BIBLIOTHEQUE_ACCES_ESH', 'INFIRMERIE_ACCES_ESH',
  'CANTINE_REFECTOIRE_ACCES_ESH', 'MAGASIN_STOCKAGE_ACCES_ESH', 'CUISINE_ACCES_ESH', 'LOGEMENT_ACCES_ESH',
  'SALLES_INFORMATIQUES_ACCES_ESH', 'LABORATOIRE_ACCES_ESH', 'TERRAIN_SPORT_ACCES_ESH', 'ESPACE_COIN_COUR_JEUX_ACCES_ESH',
  'WC_LATRINES_FILLES_ACCES_ESH', 'WC_LATRINES_GARCONS_ACCES_ESH', 'WC_LATRINES_COMMUNES_ACCES_ESH',
  'WC_LATRINES_PERSONNEL_ACCES_ESH', 'POINT_EAU_ACCES_ESH',
];

export async function executeTdbDrenNiveau(client: any, codeDren: number, annee: number, niveau: NiveauDren) {
  const c = CFG[niveau];
  const safe = async (label: string, q: string) => {
    try { return (await client.queryObject(q)).rows as any[]; }
    catch (e) { console.error(`tdbDrenNiveau ${label}`, (e as Error).message); return [] as any[]; }
  };
  const scope = (code: number) => (code > 0 ? `AND a."CODE_DREN"=${code}` : '');
  const join = (alias: string, table: string, year: number) =>
    `FROM ${table} ${alias} JOIN fpe_a1 a ON a."CODE_ETAB"=${alias}."CODE_ETAB" AND a."ANNEE_SCOLAIRE"=${alias}."ANNEE_SCOLAIRE"
     WHERE ${n(`${alias}."ANNEE_SCOLAIRE"`)}=${year} AND ${n(`a."${c.exist}"`)}=1`;

  // Les colonnes de redoublants ne sont ajoutées que si le niveau les possède ;
  // sinon la requête échouerait entièrement et tous les effectifs tomberaient à 0.
  const gradeCols = () => c.grades.map((g, i) => `
      SUM(${sum(g, 'e', '_G')}) AS eff${i + 1}_g, SUM(${sum(g, 'e', '_F')}) AS eff${i + 1}_f${c.red ? `,
      SUM(${sum(g, 'e', '_G_REDOUBLANT')}) AS red${i + 1}_g, SUM(${sum(g, 'e', '_F_REDOUBLANT')}) AS red${i + 1}_f` : ''}`).join(',');
  const kmCols = c.km ? `, SUM(${c.grades.map((g) => `${sum(g, 'e', `_G_${c.km}`)}+${sum(g, 'e', `_F_${c.km}`)}`).join('+')}) AS eleve_proche` : '';
  // Effectifs ayant l'âge officiel du niveau (numérateur du TNS).
  const ageCols = c.ageSuffixes
    ? `, SUM(${c.grades.flatMap((g, i) => g.flatMap((sec) => [`${sec}_G${c.ageSuffixes![i]}`, `${sec}_F${c.ageSuffixes![i]}`]))
      .map((col) => n(`e."${col}"`)).join('+')}) AS eleves_age`
    : '';
  // Élèves réinsérés (CRAN) du niveau.
  const cranCols = c.cran
    ? `, SUM(${c.grades.flatMap((g) => g.flatMap((sec) => [`${sec}_G_CRAN`, `${sec}_F_CRAN`]))
      .map((col) => n(`e."${col}"`)).join('+')}) AS reinseres`
    : '';

  async function sector(code: number, year = annee, withPrev = false) {
    const s = scope(code);
    const [etab, eff, effKm, sec, sdc, lat, pl, pers, prev, prevNow, epp] = await Promise.all([
      safe('a1', `SELECT ${n('a."SECTEUR"')}::int AS s, COUNT(DISTINCT a."CODE_ETAB") AS etab,
        COUNT(DISTINCT CASE WHEN upper(COALESCE(a."EST_ELECTRIFIE"::text,'')) IN ('1','OUI','TRUE') THEN a."CODE_ETAB" END) AS elec,
        COUNT(DISTINCT CASE WHEN upper(COALESCE(a."EST_ALIMENTE_EAU"::text,'')) IN ('1','OUI','TRUE') THEN a."CODE_ETAB" END) AS eau,
        COUNT(DISTINCT CASE WHEN ${n('a."EXISTE_PRIMAIRE"')}=1 THEN a."CODE_ETAB" END) AS avec_primaire
        FROM fpe_a1 a WHERE ${n('a."ANNEE_SCOLAIRE"')}=${year} AND ${n(`a."${c.exist}"`)}=1 ${s} GROUP BY 1`),
      safe('eff', `SELECT ${n('a."SECTEUR"')}::int AS s, ${gradeCols()}${ageCols}${cranCols} ${join('e', c.eff, year)} AND ${n('e."SECTEUR"')}=${n('a."SECTEUR"')} ${s} GROUP BY 1`),
      c.km ? safe('km', `SELECT ${n('a."SECTEUR"')}::int AS s ${kmCols} ${join('e', c.eff, year)} AND ${n('e."SECTEUR"')}=${n('a."SECTEUR"')} ${s} GROUP BY 1`) : Promise.resolve([]),
      safe('g1', `SELECT ${n('a."SECTEUR"')}::int AS s, SUM(${sum(c.sections, 'g', '_SECTION')}) AS sections ${join('g', 'fpe_g1', year)} ${s} GROUP BY 1`),
      safe('j1', `SELECT ${n('a."SECTEUR"')}::int AS s, SUM(${n(`j."SDC_${c.sdc}_BON_ETAT"`)}+${n(`j."SDC_${c.sdc}_MAUVAIS_ETAT"`)}) AS salles ${join('j', 'fpe_j1', year)} ${s} GROUP BY 1`),
      safe('j2', `SELECT ${n('a."SECTEUR"')}::int AS s,
        SUM(${['COMMUNES', 'FILLES', 'GARCONS'].flatMap((x) => [n(`j."WC_LATRINES_${x}_BON_ETAT"`), n(`j."WC_LATRINES_${x}_MAUVAIS_ETAT"`)]).join('+')}) AS latrines,
        SUM(${n('j."WC_LATRINES_FILLES_BON_ETAT"')}+${n('j."WC_LATRINES_FILLES_MAUVAIS_ETAT"')}) AS latrines_f,
        COUNT(DISTINCT CASE WHEN ${n('j."WC_LATRINES_FILLES_BON_ETAT"')}+${n('j."WC_LATRINES_FILLES_MAUVAIS_ETAT"')}>0 THEN a."CODE_ETAB" END) AS etab_latrine_f,
        COUNT(DISTINCT CASE WHEN ${ACCES_ESH.map((col) => n(`j."${col}"`)).join('+')}>0 THEN a."CODE_ETAB" END) AS handicap,
        COUNT(DISTINCT CASE WHEN ${n('j."LABORATOIRE_BON_ETAT"')}>0 THEN a."CODE_ETAB" END) AS laboratoire,
        COUNT(DISTINCT CASE WHEN ${n('j."SALLES_INFORMATIQUES_BON_ETAT"')}>0 THEN a."CODE_ETAB" END) AS tic,
        COUNT(DISTINCT CASE WHEN ${n('j."BIBLIOTHEQUE_BON_ETAT"')}>0 THEN a."CODE_ETAB" END) AS bibliotheque
        ${join('j', 'fpe_j2', year)} ${s} GROUP BY 1`),
      safe('places', `SELECT ${n('a."SECTEUR"')}::int AS s, SUM(COALESCE(v."${c.places}",0)) AS places ${join('v', 'v_place_assises', year)} ${s} GROUP BY 1`),
      safe('p1', `SELECT ${n('a."SECTEUR"')}::int AS s, COUNT(*) AS ens,
        SUM(CASE WHEN ${n('p."EN_SALLE"')}=1 THEN 1 ELSE 0 END) AS ens_classe,
        SUM(CASE WHEN p."CODE_STATUT"::text IN ('1','2') THEN 1 ELSE 0 END) AS fonct,
        SUM(CASE WHEN p."CODE_STATUT"::text='3' THEN 1 ELSE 0 END) AS fram_sub,
        SUM(CASE WHEN p."CODE_STATUT"::text='4' THEN 1 ELSE 0 END) AS fram_non_sub,
        SUM(CASE WHEN COALESCE(p."DIPLOME_PEDAGOGIQUE",'')<>'' AND upper(p."DIPLOME_PEDAGOGIQUE")<>'AUTRES' THEN 1 ELSE 0 END) AS qualifies,
        SUM(CASE WHEN ${matiere(MATIERES_LITTERAIRES)} THEN 1 ELSE 0 END) AS litteraire,
        SUM(CASE WHEN ${matiere(MATIERES_SCIENTIFIQUES)} THEN 1 ELSE 0 END) AS scientifique,
        SUM(CASE WHEN ${matiere(['EPS'])} THEN 1 ELSE 0 END) AS eps,
        SUM(CASE WHEN ${matiere(['SES'])} THEN 1 ELSE 0 END) AS ses,
        SUM(CASE WHEN ${BACC2} THEN 1 ELSE 0 END) AS ens_bacc2,
        SUM(CASE WHEN ${LICENCE} THEN 1 ELSE 0 END) AS ens_licence,
        SUM(${VOLUME_COLS.map((col) => n(col)).join('+')}) AS volume_horaire,
        SUM(CASE WHEN ${VOLUME_COLS.map((col) => n(col)).join('+')}>0 THEN 1 ELSE 0 END) AS ens_volume
        ${join('p', 'fpe_p1', year)} AND p."NIVEAU_TENU_${c.tenu}"::text='1' ${s} GROUP BY 1`),
      // Dernière classe du cycle précédent l'année d'avant : dénominateur du taux de transition.
      // ANNEE_SCOLAIRE, SECTEUR et EXISTE_* sont des colonnes integer indexées : on les
      // compare directement (sans cast texte) pour ne pas désactiver l'index.
      withPrev && c.prev
        ? safe('prev', `SELECT a."SECTEUR"::int AS s, SUM(${n(`e."${c.prev.grade}_G"`)}+${n(`e."${c.prev.grade}_F"`)}) AS eff_cycle_precedent
          FROM ${c.prev.table} e JOIN fpe_a1 a ON a."CODE_ETAB"=e."CODE_ETAB" AND a."ANNEE_SCOLAIRE"=e."ANNEE_SCOLAIRE"
          WHERE e."ANNEE_SCOLAIRE"=${year - 1} AND a."${c.prev.exist}"=1
            AND e."SECTEUR"=a."SECTEUR" ${s} GROUP BY 1`)
        : Promise.resolve([]),
      // Effectif de la dernière classe du cycle précédent pour l'année courante :
      // dénominateur du taux de transition t → t+1 (nouveaux entrants de l'année suivante).
      withPrev && c.prev
        ? safe('prevNow', `SELECT a."SECTEUR"::int AS s, SUM(${n(`e."${c.prev.grade}_G"`)}+${n(`e."${c.prev.grade}_F"`)}) AS eff_cycle_actuel
          FROM ${c.prev.table} e JOIN fpe_a1 a ON a."CODE_ETAB"=e."CODE_ETAB" AND a."ANNEE_SCOLAIRE"=e."ANNEE_SCOLAIRE"
          WHERE e."ANNEE_SCOLAIRE"=${year} AND a."${c.prev.exist}"=1
            AND e."SECTEUR"=a."SECTEUR" ${s} GROUP BY 1`)
        : Promise.resolve([]),
      // Nombre total d'EPP (écoles primaires) : dénominateur du « % d'EPP ayant de CAP ».
      niveau === 'presco'
        ? safe('epp', `SELECT ${n('a."SECTEUR"')}::int AS s, COUNT(DISTINCT a."CODE_ETAB") AS nbr_epp
          FROM fpe_a1 a WHERE ${n('a."ANNEE_SCOLAIRE"')}=${year} AND ${n('a."EXISTE_PRIMAIRE"')}=1 ${s} GROUP BY 1`)
        : Promise.resolve([]),
    ]);
    const out: Record<string, Record<string, number>> = { '0': {}, '1': {} };
    for (const rows of [etab, eff, effKm, sec, sdc, lat, pl, pers, prev, prevNow, epp]) {
      for (const r of rows) {
        const k = Number(r.s) === 0 ? '0' : '1';
        for (const [key, v] of Object.entries(r)) if (key !== 's') out[k][key] = (out[k][key] || 0) + (Number(v) || 0);
      }
    }
    return out;
  }

  const popSrc = await popSource(client, annee);
  async function population(code: number) {
    const ages = c.pops.map((list, i) => `SUM(${list.map((a) => `COALESCE(NULLIF(pop_${a}_ans::text,'')::numeric,0)`).join('+')}) AS p${i}`).join(',');
    const rows = await safe('pop', `SELECT ${ages} FROM ${popSrc || 'population_2025'} px WHERE ${code > 0 ? `code_dren=${code}` : 'TRUE'}`);
    return rows[0] ? Object.fromEntries(Object.entries(rows[0]).map(([k, v]) => [k, Number(v) || 0])) : {};
  }

  async function ciscos() {
    const red = c.red ? `, SUM(${c.grades.map((g) => `${sum(g, 'e', '_G_REDOUBLANT')}+${sum(g, 'e', '_F_REDOUBLANT')}`).join('+')}) AS redoublants` : '';
    const eff = c.grades.map((g) => `${sum(g, 'e', '_G')}+${sum(g, 'e', '_F')}`).join('+');
    const [r1, r2, r3] = await Promise.all([
      safe('cisco eff', `SELECT a."CODE_CISCO" AS code, SUM(${eff}) AS eleves${red} ${join('e', c.eff, annee)} AND ${n('a."SECTEUR"')}=0 AND ${n('e."SECTEUR"')}=0 AND a."CODE_DREN"=${codeDren} GROUP BY 1`),
      safe('cisco pers', `SELECT a."CODE_CISCO" AS code, SUM(CASE WHEN ${n('p."EN_SALLE"')}=1 THEN 1 ELSE 0 END) AS ens_classe ${join('p', 'fpe_p1', annee)} AND ${n('a."SECTEUR"')}=0 AND p."NIVEAU_TENU_${c.tenu}"::text='1' AND a."CODE_DREN"=${codeDren} GROUP BY 1`),
      safe('cisco noms', `SELECT "CODE_CISCO" AS code, "CISCO" AS nom FROM v_cisco WHERE "CODE_DREN"=${codeDren} ORDER BY "CISCO"`),
    ]);
    const by = (rows: any[]) => Object.fromEntries(rows.map((r) => [String(r.code), r]));
    const e = by(r1), p = by(r2);
    return r3.map((x) => ({ CISCO: x.nom, CODE_CISCO: x.code, eleves: Number(e[String(x.code)]?.eleves || 0), redoublants: Number(e[String(x.code)]?.redoublants || 0), ens_classe: Number(p[String(x.code)]?.ens_classe || 0) }))
      .filter((x) => x.eleves > 0);
  }

  const [dren, mada, drenNext, madaNext, popDren, popMada, cisco, meta, nom] = await Promise.all([
    sector(codeDren, annee, true), sector(0, annee, true), sector(codeDren, annee + 1), sector(0, annee + 1),
    (annee === 2025 || popSrc) ? population(codeDren) : Promise.resolve({}), (annee === 2025 || popSrc) ? population(0) : Promise.resolve({}),
    ciscos(),
    safe('meta', `SELECT (SELECT COUNT(*) FROM v_cisco WHERE "CODE_DREN"=${codeDren}) AS nb_cisco, (SELECT COUNT(*) FROM v_zap WHERE "CODE_DREN"=${codeDren}) AS nb_zap`),
    safe('nom', `SELECT "DREN" FROM v_dren WHERE "CODE_DREN"=${codeDren}`),
  ]);
  const hasNext = (s: Record<string, Record<string, number>>) => Object.keys(s['0']).length + Object.keys(s['1']).length > 0;
  return {
    niveau, annee, code_dren: codeDren,
    names: { DREN: nom[0]?.DREN || '' },
    nb_cisco: Number(meta[0]?.nb_cisco || 0), nb_zap: Number(meta[0]?.nb_zap || 0),
    grades: c.grades.length,
    dren, mada,
    dren_next: hasNext(drenNext) ? drenNext : null, mada_next: hasNext(madaNext) ? madaNext : null,
    pop_dren: popDren, pop_mada: popMada,
    ciscos: cisco,
  };
}
