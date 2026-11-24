// Diagnostic dataset builder — follows the official MEN document
// "DOCUMENT DE DIAGNOSTIC DU SYSTEME EDUCATIF" (formules officielles).
// All data comes from the DPE PostgreSQL server (fpe_*, population, examen_*).
import {
  diagnosticPopulations, diagnosticPopulationQuery, diagnosticPopCoverageQuery, diagnosticPopulationSource,
  type PopulationYear,
} from "./diagnosticPopulation.ts";

// Cast tolérant : certaines colonnes du serveur DPE contiennent du texte
// ('b', 'NA', '-', ...). On nettoie avant le cast pour ne jamais faire échouer
// la requête (sinon tout le diagnostic reste vide).
const n = (col: string) =>
  `(CASE WHEN btrim(regexp_replace(COALESCE(${col}::text,''), '[^0-9.\\-]', '', 'g')) ~ '^-?[0-9]+(\\.[0-9]+)?$'
         THEN btrim(regexp_replace(COALESCE(${col}::text,''), '[^0-9.\\-]', '', 'g'))::numeric ELSE 0 END)`;
const yr = (col: string) => `${n(col)}::int`;

export type Scope = { codeDren: number; codeCisco: number };

function scopeSql(alias: string, s: Scope): string {
  if (s.codeCisco > 0) return `${alias}."CODE_CISCO" = ${s.codeCisco}`;
  if (s.codeDren > 0) return `${alias}."CODE_DREN" = ${s.codeDren}`;
  return "TRUE";
}

const num = (v: any) => {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
};
const div = (a: number, b: number): number | null => (b > 0 ? a / b : null);
const pct = (a: number, b: number): number | null => (b > 0 ? (a / b) * 100 : null);
const r1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);
const r2 = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100);

const LY_1 = ["_1A", "_1C", "_1D", "_1L", "_1S", "_1OSE"];
const LY_T = ["TA", "TC", "TD", "TL", "TS", "TOSE"];

function sumCols(cols: string[], alias: string, suffix = ""): string {
  return cols.map((c) => n(`${alias}."${c}${suffix}"`)).join("+");
}

export async function executeDiagnosticDataset(client: any, s: Scope) {
  const years: number[] = (
    await client.queryObject(
      `SELECT DISTINCT ${yr('"ANNEE_SCOLAIRE"')} AS y FROM fpe_e1 WHERE "ANNEE_SCOLAIRE" IS NOT NULL ORDER BY 1`,
    ).catch(() => ({ rows: [] }))
  ).rows.map((r: any) => Number(r.y)).filter((y: number) => y > 2000);

  // ---------- 1. Préscolaire + Primaire (fpe_e1) ----------
  const gradesP = ["T1", "T2", "T3", "T4", "T5"];
  const qE1 = `
    SELECT ${yr('e."ANNEE_SCOLAIRE"')} AS y, ${n('e."SECTEUR"')}::int AS s,
      SUM(${n('e."PS_G"')}+${n('e."MS_G"')}+${n('e."GS_G"')}) AS presco_g,
      SUM(${n('e."PS_F"')}+${n('e."MS_F"')}+${n('e."GS_F"')}) AS presco_f,
      SUM(${n('e."EEC_G"')}+${n('e."EEC_F"')}) AS eec,
      ${gradesP.map((g) => `
      SUM(${n(`e."${g}_G"`)}) AS ${g.toLowerCase()}_g,
      SUM(${n(`e."${g}_F"`)}) AS ${g.toLowerCase()}_f,
      SUM(${n(`e."${g}_G_REDOUBLANT"`)}) AS ${g.toLowerCase()}_red_g,
      SUM(${n(`e."${g}_F_REDOUBLANT"`)}) AS ${g.toLowerCase()}_red_f`).join(",")}
    FROM fpe_e1 e WHERE ${scopeSql("e", s)} GROUP BY 1,2`;

  // ---------- 2. Collège + Lycée (fpe_e4) ----------
  const gradesC = ["T6", "T7", "T8", "T9"];
  const qE4 = `
    SELECT ${yr('e."ANNEE_SCOLAIRE"')} AS y, ${n('e."SECTEUR"')}::int AS s,
      ${gradesC.map((g) => `
      SUM(${n(`e."${g}_G"`)}) AS ${g.toLowerCase()}_g,
      SUM(${n(`e."${g}_F"`)}) AS ${g.toLowerCase()}_f,
      SUM(${n(`e."${g}_G_REDOUBLANT"`)}) AS ${g.toLowerCase()}_red_g,
      SUM(${n(`e."${g}_F_REDOUBLANT"`)}) AS ${g.toLowerCase()}_red_f`).join(",")},
      SUM(${n('e."_2NDE_G"')}) AS sec_g, SUM(${n('e."_2NDE_F"')}) AS sec_f,
      SUM(${n('e."_2NDE_G_REDOUBLANT"')}) AS sec_red_g, SUM(${n('e."_2NDE_F_REDOUBLANT"')}) AS sec_red_f,
      SUM(${sumCols(LY_1, "e", "_G")}) AS pre_g, SUM(${sumCols(LY_1, "e", "_F")}) AS pre_f,
      SUM(${sumCols(LY_1, "e", "_G_REDOUBLANT")}) AS pre_red_g, SUM(${sumCols(LY_1, "e", "_F_REDOUBLANT")}) AS pre_red_f,
      SUM(${sumCols(LY_T, "e", "_G")}) AS ter_g, SUM(${sumCols(LY_T, "e", "_F")}) AS ter_f,
      SUM(${sumCols(LY_T, "e", "_G_REDOUBLANT")}) AS ter_red_g, SUM(${sumCols(LY_T, "e", "_F_REDOUBLANT")}) AS ter_red_f
    FROM fpe_e4 e WHERE ${scopeSql("e", s)} GROUP BY 1,2`;

  // ---------- 3. Établissements (fpe_a1) ----------
  const qA1 = `
    SELECT ${yr('a."ANNEE_SCOLAIRE"')} AS y, ${n('a."SECTEUR"')}::int AS s,
      SUM(CASE WHEN ${n('a."EXISTE_PRESCO"')}=1 THEN 1 ELSE 0 END) AS presco,
      SUM(CASE WHEN ${n('a."EXISTE_PRIMAIRE"')}=1 THEN 1 ELSE 0 END) AS primaire,
      SUM(CASE WHEN ${n('a."EXISTE_COLLEGE"')}=1 THEN 1 ELSE 0 END) AS college,
      SUM(CASE WHEN ${n('a."EXISTE_LYCEE"')}=1 THEN 1 ELSE 0 END) AS lycee,
      SUM(CASE WHEN ${n('a."EXISTE_PRIMAIRE"')}=1 AND ${n('a."EXISTE_PRESCO"')}=1 THEN 1 ELSE 0 END) AS epp_avec_cap,
      COUNT(DISTINCT a."CODE_ETAB") AS etabs_distincts,
      SUM(CASE WHEN upper(COALESCE(a."EST_ELECTRIFIE",''))IN('1','OUI','TRUE') THEN 1 ELSE 0 END) AS electrifie,
      SUM(CASE WHEN upper(COALESCE(a."EST_ALIMENTE_EAU",''))IN('1','OUI','TRUE') THEN 1 ELSE 0 END) AS point_eau
    FROM fpe_a1 a WHERE ${scopeSql("a", s)} GROUP BY 1,2`;

  // ---------- 4. Salles de classe (fpe_j1) ----------
  const qJ1 = `
    SELECT ${yr('j."ANNEE_SCOLAIRE"')} AS y,
      SUM(${n('j."SDC_PRESCO_BON_ETAT"')}) AS presco_bon, SUM(${n('j."SDC_PRESCO_MAUVAIS_ETAT"')}) AS presco_mau,
      SUM(${n('j."SDC_PRIMAIRE_BON_ETAT"')}+${n('j."SDC_PRIMAIRE_2VAC_BON_ETAT"')}+${n('j."SDC_PRIMAIRE_2FLUX_BON_ETAT"')}) AS primaire_bon,
      SUM(${n('j."SDC_PRIMAIRE_MAUVAIS_ETAT"')}+${n('j."SDC_PRIMAIRE_2VAC_MAUVAIS_ETAT"')}+${n('j."SDC_PRIMAIRE_2FLUX_MAUVAIS_ETAT"')}) AS primaire_mau,
      SUM(${n('j."SDC_COLLEGE_BON_ETAT"')}) AS college_bon, SUM(${n('j."SDC_COLLEGE_MAUVAIS_ETAT"')}) AS college_mau,
      SUM(${n('j."SDC_LYCEE_BON_ETAT"')}) AS lycee_bon, SUM(${n('j."SDC_LYCEE_MAUVAIS_ETAT"')}) AS lycee_mau
    FROM fpe_j1 j WHERE ${scopeSql("j", s)} GROUP BY 1`;

  // ---------- 5. Sections / classes pédagogiques (fpe_g1) ----------
  const qG1 = `
    SELECT ${yr('g."ANNEE_SCOLAIRE"')} AS y,
      SUM(${n('g."PS_SECTION"')}+${n('g."MS_SECTION"')}+${n('g."GS_SECTION"')}) AS presco,
      SUM(${gradesP.map((x) => n(`g."${x}_SECTION"`)).join("+")}) AS primaire,
      SUM(${gradesC.map((x) => n(`g."${x}_SECTION"`)).join("+")}) AS college,
      SUM(${n('g."_2NDE_SECTION"')}+${[...LY_1, ...LY_T].map((x) => n(`g."${x}_SECTION"`)).join("+")}) AS lycee,
      SUM(${gradesP.map((x) => n(`g."${x}_SECTION_MULTIGRADE_1"`)).join("+")}) AS multigrade
    FROM fpe_g1 g WHERE ${scopeSql("g", s)} GROUP BY 1`;

  // ---------- 6. Places assises ----------
  // `v_place_assises` compte les bancs 3 places avec la formule `* 2 * 3`
  // (soit 6 places par banc) : chaque niveau collège/lycée/primaire est
  // surévalué de 3 places par banc de 3. On recalcule donc la capacité réelle
  // depuis `fpe_k1` (1 place par chaise, N places par banc de N places),
  // en ne retenant un niveau que si l'établissement l'offre (`EXISTE_*`).
  const seatCell = (col: string) => `COALESCE(${n(`k1."${col}"`)},0)`;
  const benchSeats = (level: string, widths: Array<[string, number]>) =>
    `CASE WHEN k1."EXISTE_${level}" = 1 THEN ${widths
      .map(([width, capacity]) =>
        `(${seatCell(`${level}_TABLES_BANCS_${width}_BON_ETAT`)}+${seatCell(`${level}_TABLES_BANCS_${width}_MAUVAIS_ETAT`)})*${capacity}`)
      .join("+")} ELSE 0 END`;
  const benches: Array<[string, number]> = [["1PL", 1], ["2PL", 2], ["3PL", 3], ["4PL", 4], ["5PL_PLUS", 5]];
  const qPl = `
    SELECT ${yr('k1."ANNEE_SCOLAIRE"')} AS y,
      SUM(CASE WHEN k1."EXISTE_PRESCO" = 1 THEN
        ${seatCell("PRESCO_PETITES_CHAISES_BON_ETAT")}+${seatCell("PRESCO_PETITES_CHAISES_MAUVAIS_ETAT")}
        +(${seatCell("PRESCO_TABLES_BANCS_2PL_BON_ETAT")}+${seatCell("PRESCO_TABLES_BANCS_2PL_MAUVAIS_ETAT")})*2
        ELSE 0 END) AS presco,
      SUM(${benchSeats("PRIMAIRE", benches)}) AS primaire,
      SUM(${benchSeats("COLLEGE", benches)}) AS college,
      SUM(${benchSeats("LYCEE", benches)}) AS lycee
    FROM fpe_k1 k1 WHERE ${scopeSql("k1", s)} GROUP BY 1`;

  // ---------- 7. Manuels primaire (fpe_l1) ----------
  const qL1 = `
    SELECT ${yr('l."ANNEE_SCOLAIRE"')} AS y,
      SUM(${gradesP.map((x) => n(`l."MALAGASY_${x}"`)).join("+")}) AS malagasy,
      SUM(${gradesP.map((x) => n(`l."FRANCAIS_${x}"`)).join("+")}) AS francais,
      SUM(${gradesP.map((x) => n(`l."MATHS_${x}"`)).join("+")}) AS maths
    FROM fpe_l1 l WHERE ${scopeSql("l", s)} GROUP BY 1`;

  // ---------- 8. Enseignants (fpe_p1) ----------
  const qual = `(COALESCE(p."DIPLOME_PEDAGOGIQUE",'') <> '' AND upper(p."DIPLOME_PEDAGOGIQUE") <> 'AUTRES')`;
  const fonc = `(p."STATUT" IN ('Titulaire','Fonctionnaire','Agent de l''Etat','Contractuel de l''Etat'))`;
  const lvl = (c: string) => `(p."NIVEAU_TENU_${c}" = '1')`;
  const teacherCols = [
    ["presco", "PRESCO"],
    ["primaire", "PRIMAIRE"],
    ["college", "COLLEGE"],
    ["lycee", "LYCEE"],
  ]
    .map(([k, c]) => `
      SUM(CASE WHEN ${lvl(c)} THEN 1 ELSE 0 END) AS ${k}_total,
      SUM(CASE WHEN ${lvl(c)} AND ${qual} THEN 1 ELSE 0 END) AS ${k}_qualifie,
      SUM(CASE WHEN ${lvl(c)} AND ${fonc} THEN 1 ELSE 0 END) AS ${k}_fonctionnaire,
      SUM(CASE WHEN ${lvl(c)} AND upper(COALESCE(p."SEXE",'')) LIKE 'F%' THEN 1 ELSE 0 END) AS ${k}_femmes`)
    .join(",");
  const qP1 = `SELECT ${yr('p."ANNEE_SCOLAIRE"')} AS y, ${n('p."SECTEUR"')}::int AS s,
      COUNT(*) AS pers_distincts, ${teacherCols}
    FROM fpe_p1 p WHERE ${scopeSql("p", s)} GROUP BY 1,2`;

  // ---------- 9. Population (dénominateurs TBS / TBA) ----------
  // Source par année : la projection officielle importée (`tdb_population_cisco`),
  // déjà utilisée par le TDB DREN/Niveau, prime sur la table historique
  // `population_2025` (repli, pour ne jamais supprimer un taux existant).
  // Couverture : certains CISCO de la collecte (ex. 622 en 2026) n'ont de ligne
  // dans aucune des deux sources ; on les compte pour ne jamais calculer un
  // taux sur un dénominateur partiel.

  // ---------- 10. Examens ----------
  // Périmètre des examens : les candidats sont rattachés par CODE_ETAB. Ce
  // code manque pour ~5 % des lignes BEPC et certains codes absents de
  // fpe_a1 ; on retombe alors sur le nom de DREN/CISCO fourni par la source
  // (texte), sans jamais réattribuer un code connu d'un autre périmètre.
  // Au national, tous les candidats sont retenus (aucune perte).
  const etabScope = `SELECT DISTINCT "CODE_ETAB" FROM fpe_a1 WHERE ${scopeSql("fpe_a1", s)}`;
  const examNameScope = (alias: string) =>
    s.codeCisco > 0
      ? `EXISTS (SELECT 1 FROM v_cisco vc WHERE vc."CODE_CISCO" = ${s.codeCisco} AND upper(btrim(vc."CISCO")) = upper(btrim(${alias}."CISCO")))`
      : s.codeDren > 0
      ? `EXISTS (SELECT 1 FROM v_dren vd WHERE vd."CODE_DREN" = ${s.codeDren} AND upper(btrim(vd."DREN")) = upper(btrim(${alias}."DREN")))`
      : "FALSE";
  const examWhere = (alias: string) => {
    if (s.codeCisco <= 0 && s.codeDren <= 0) return "TRUE";
    return `(${alias}."CODE_ETAB" IN (${etabScope})
      OR (${alias}."CODE_ETAB" NOT IN (SELECT "CODE_ETAB" FROM fpe_a1 WHERE "CODE_ETAB" IS NOT NULL)
          AND ${examNameScope(alias)}))`;
  };
  const qCepe = `SELECT ${yr('c."ANNEE_SCOLAIRE"')} AS y,
      COUNT(*) AS presentes,
      SUM(CASE WHEN upper(COALESCE(c."CEPE",'')) IN ('A','ADMIS') THEN 1 ELSE 0 END) AS admis,
      SUM(CASE WHEN upper(COALESCE(c."GENRE",'')) LIKE 'F%' THEN 1 ELSE 0 END) AS filles,
      AVG(NULLIF(${n('c."MOYENNE"')},0)) AS moyenne,
      AVG(NULLIF(${n('c."MALAGASY"')},0)) AS moy_malagasy,
      AVG(NULLIF(${n('c."FRANCAIS"')},0)) AS moy_francais,
      AVG(NULLIF(${n('c."OP"')},0)) AS moy_calcul
    FROM examen_cepe_candidates c WHERE ${examWhere("c")} GROUP BY 1`;

  // Une requête en erreur ne doit jamais vider tout le diagnostic :
  // on isole chaque bloc et on renvoie des lignes vides en cas d'échec.
  const warnings: string[] = [];
  const safe = (label: string, q: string) =>
    client.queryObject(q).catch((e: any) => {
      warnings.push(`${label}: ${e?.message || e}`);
      return { rows: [] };
    });

  const [rE1, rE4, rA1, rJ1, rG1, rPl, rL1, rP1, rCepe] = await Promise.all([
    safe("fpe_e1", qE1), safe("fpe_e4", qE4), safe("fpe_a1", qA1),
    safe("fpe_j1", qJ1), safe("fpe_g1", qG1), safe("v_place_assises", qPl),
    safe("fpe_l1", qL1), safe("fpe_p1", qP1), safe("examen_cepe", qCepe),
  ]);

  // Population : une source par année (projection importée, sinon population_2025).
  const popSources = await Promise.all(
    [...new Set(years)].filter((y) => y > 2000).map(async (year) => ({
      year, source: await diagnosticPopulationSource(client, year),
    })),
  );
  const [popResults, covResults] = await Promise.all([
    Promise.all(popSources.map((p) => safe(`population ${p.year}`, diagnosticPopulationQuery(p.year, p.source, s)))),
    Promise.all(popSources.map((p) => safe(`population_couverture ${p.year}`, diagnosticPopCoverageQuery(p.year, p.source, s)))),
  ]);
  const populations = diagnosticPopulations(popSources, popResults);

  // BEPC : même périmètre que le CEPE. On garde l'isolation par bloc pour
  // qu'une erreur BEPC n'efface pas le reste du diagnostic, mais elle est
  // désormais tracée dans `warnings` au lieu d'être avalée silencieusement.
  const admisBepc = `upper(COALESCE(b."BEPC",'')) IN ('A','ADMIS')`;
  const fillesBepc = `upper(COALESCE(b."GENRE",'')) LIKE 'F%'`;
  const garconsBepc = `upper(COALESCE(b."GENRE",'')) LIKE 'G%'`;
  const matieresBepc: Array<[string, string]> = [
    ["malagasy", "MALAGASY"], ["francais", "FRANCAIS"], ["anglais", "ANGLAIS"],
    ["mathematique", "MATHEMATIQUE"], ["physique", "PHYSIQUE"], ["svt", "SVT"],
    ["histoGeo", "HISTO_GEO"],
  ];
  const rBepc = await safe("examen_bepc_candidates", `SELECT ${yr('b."ANNEE_SCOLAIRE"')} AS y,
      COUNT(*) AS presentes,
      COUNT(*) FILTER (WHERE ${fillesBepc}) AS filles,
      COUNT(*) FILTER (WHERE ${garconsBepc}) AS garcons,
      COUNT(*) FILTER (WHERE ${admisBepc}) AS admis,
      COUNT(*) FILTER (WHERE ${admisBepc} AND ${fillesBepc}) AS admis_filles,
      COUNT(*) FILTER (WHERE ${admisBepc} AND ${garconsBepc}) AS admis_garcons,
      AVG(NULLIF(${n('b."MOYENNE"')},0)) AS moyenne,
      ${matieresBepc.map(([k, c]) => `
      AVG(NULLIF(${n(`b."${c}"`)},0)) AS "moy_${k}",
      COUNT(*) FILTER (WHERE ${n(`b."${c}"`)} > 10) AS "gt10_${k}"`).join(",")},
      COUNT(*) - COUNT(DISTINCT NULLIF(btrim(COALESCE(b."MATRICULE",'')),'')) AS doublons
      FROM examen_bepc_candidates b WHERE ${examWhere("b")} GROUP BY 1`);

  // ============ Assemblage par année ============
  const empty = () => ({ g: 0, f: 0, garcons: 0, filles: 0, pub: 0, priv: 0, total: 0 });
  const annees: Record<string, any> = {};
  const ensure = (y: number) => {
    const k = String(y);
    if (!annees[k]) {
      annees[k] = {
        annee: y,
        eleves: {
          presco: empty(),
          primaire: { ...empty(), grades: {} as Record<string, any> },
          college: { ...empty(), grades: {} as Record<string, any> },
          lycee: { ...empty(), grades: {} as Record<string, any> },
        },
        // `etablissements.total` = établissements DISTINCTS du périmètre ;
        // la somme des compteurs par niveau compte plusieurs fois une école
        // qui ouvre plusieurs niveaux (primaire + collège par exemple).
        etablissements: { presco: { pub: 0, priv: 0, total: 0 }, primaire: { pub: 0, priv: 0, total: 0 }, college: { pub: 0, priv: 0, total: 0 }, lycee: { pub: 0, priv: 0, total: 0 }, total: 0, eppAvecCap: 0, electrifie: 0, pointEau: 0 },
        salles: { presco: { bon: 0, mauvais: 0, total: 0 }, primaire: { bon: 0, mauvais: 0, total: 0 }, college: { bon: 0, mauvais: 0, total: 0 }, lycee: { bon: 0, mauvais: 0, total: 0 } },
        sections: { presco: 0, primaire: 0, college: 0, lycee: 0, multigrade: 0 },
        // Places assises recalculées depuis `fpe_k1` (la vue `v_place_assises`
        // surévalue les bancs de 3 places).
        places: {
          presco: { total: 0 }, primaire: { total: 0 },
          college: { total: 0 }, lycee: { total: 0 },
        },
        manuels: { malagasy: 0, francais: 0, maths: 0 },
        enseignants: {
          presco: { total: 0, qualifie: 0, fonctionnaire: 0, femmes: 0, pub: 0, priv: 0 },
          primaire: { total: 0, qualifie: 0, fonctionnaire: 0, femmes: 0, pub: 0, priv: 0 },
          college: { total: 0, qualifie: 0, fonctionnaire: 0, femmes: 0, pub: 0, priv: 0 },
          lycee: { total: 0, qualifie: 0, fonctionnaire: 0, femmes: 0, pub: 0, priv: 0 },
          // Personnel distinct (une ligne fpe_p1 = un enseignant) : la somme
          // des niveaux double les enseignants qui tiennent plusieurs niveaux.
          total: 0,
        },
        examens: { cepe: null as any, bepc: null as any },
      };
    }
    return annees[k];
  };

  const addGrade = (bucket: any, code: string, g: number, f: number, redG: number, redF: number) => {
    const cur = bucket.grades[code] || { g: 0, f: 0, total: 0, redoublants: 0, redG: 0, redF: 0 };
    cur.g += g; cur.f += f; cur.total += g + f;
    cur.redG += redG; cur.redF += redF; cur.redoublants += redG + redF;
    bucket.grades[code] = cur;
  };
  const addLevel = (lv: any, g: number, f: number, isPrive: boolean) => {
    lv.g += g; lv.f += f;
    // `filles`/`garcons` sont les libellés consommés par les vues Monographie
    // et Qualité ; `g`/`f` restent pour compatibilité.
    lv.garcons = (lv.garcons || 0) + g;
    lv.filles = (lv.filles || 0) + f;
    lv.total += g + f;
    if (isPrive) lv.priv += g + f; else lv.pub += g + f;
  };

  for (const row of rE1.rows as any[]) {
    const y = ensure(num(row.y));
    const priv = num(row.s) === 1;
    addLevel(y.eleves.presco, num(row.presco_g), num(row.presco_f), priv);
    for (const g of gradesP) {
      const k = g.toLowerCase();
      addLevel(y.eleves.primaire, num(row[`${k}_g`]), num(row[`${k}_f`]), priv);
      addGrade(y.eleves.primaire, g, num(row[`${k}_g`]), num(row[`${k}_f`]), num(row[`${k}_red_g`]), num(row[`${k}_red_f`]));
    }
  }
  for (const row of rE4.rows as any[]) {
    const y = ensure(num(row.y));
    const priv = num(row.s) === 1;
    for (const g of gradesC) {
      const k = g.toLowerCase();
      addLevel(y.eleves.college, num(row[`${k}_g`]), num(row[`${k}_f`]), priv);
      addGrade(y.eleves.college, g, num(row[`${k}_g`]), num(row[`${k}_f`]), num(row[`${k}_red_g`]), num(row[`${k}_red_f`]));
    }
    const lyc: Array<[string, string]> = [["2NDE", "sec"], ["1ERE", "pre"], ["TERM", "ter"]];
    for (const [code, p] of lyc) {
      addLevel(y.eleves.lycee, num(row[`${p}_g`]), num(row[`${p}_f`]), priv);
      addGrade(y.eleves.lycee, code, num(row[`${p}_g`]), num(row[`${p}_f`]), num(row[`${p}_red_g`]), num(row[`${p}_red_f`]));
    }
  }
  for (const row of rA1.rows as any[]) {
    const y = ensure(num(row.y));
    const key = num(row.s) === 1 ? "priv" : "pub";
    for (const lv of ["presco", "primaire", "college", "lycee"]) {
      y.etablissements[lv][key] += num(row[lv]);
      y.etablissements[lv].total += num(row[lv]);
    }
    y.etablissements.total += num(row.etabs_distincts);
    y.etablissements.eppAvecCap += num(row.epp_avec_cap);
    y.etablissements.electrifie += num(row.electrifie);
    y.etablissements.pointEau += num(row.point_eau);
  }
  for (const row of rJ1.rows as any[]) {
    const y = ensure(num(row.y));
    for (const lv of ["presco", "primaire", "college", "lycee"]) {
      y.salles[lv].bon = num(row[`${lv}_bon`]);
      y.salles[lv].mauvais = num(row[`${lv}_mau`]);
      y.salles[lv].total = y.salles[lv].bon + y.salles[lv].mauvais;
    }
  }
  for (const row of rG1.rows as any[]) {
    const y = ensure(num(row.y));
    y.sections = { presco: num(row.presco), primaire: num(row.primaire), college: num(row.college), lycee: num(row.lycee), multigrade: num(row.multigrade) };
  }
  for (const row of rPl.rows as any[]) {
    const y = ensure(num(row.y));
    y.places = {
      presco: { total: num(row.presco) },
      primaire: { total: num(row.primaire) },
      college: { total: num(row.college) },
      lycee: { total: num(row.lycee) },
    };
  }
  for (const row of rL1.rows as any[]) {
    const y = ensure(num(row.y));
    y.manuels = { malagasy: num(row.malagasy), francais: num(row.francais), maths: num(row.maths) };
  }
  for (const row of rP1.rows as any[]) {
    const y = ensure(num(row.y));
    const priv = num(row.s) === 1;
    y.enseignants.total += num(row.pers_distincts);
    for (const lv of ["presco", "primaire", "college", "lycee"]) {
      const t = y.enseignants[lv];
      t.total += num(row[`${lv}_total`]);
      t.qualifie += num(row[`${lv}_qualifie`]);
      t.fonctionnaire += num(row[`${lv}_fonctionnaire`]);
      t.femmes += num(row[`${lv}_femmes`]);
      if (priv) t.priv += num(row[`${lv}_total`]); else t.pub += num(row[`${lv}_total`]);
    }
  }
  for (const row of (rCepe.rows || []) as any[]) {
    const y = ensure(num(row.y));
    y.examens.cepe = {
      presentes: num(row.presentes), admis: num(row.admis), filles: num(row.filles),
      moyenne: r2(num(row.moyenne)), moyMalagasy: r2(num(row.moy_malagasy)),
      moyFrancais: r2(num(row.moy_francais)), moyCalcul: r2(num(row.moy_calcul)),
    };
  }
  for (const row of (rBepc.rows || []) as any[]) {
    const y = ensure(num(row.y));
    y.examens.bepc = {
      presentes: num(row.presentes), admis: num(row.admis),
      filles: num(row.filles), garcons: num(row.garcons),
      admisFilles: num(row.admis_filles), admisGarcons: num(row.admis_garcons),
      moyenne: r2(num(row.moyenne)),
      scores: Object.fromEntries(matieresBepc.map(([k]) => [k, r2(num(row[`moy_${k}`]))])),
      notesSup10: Object.fromEntries(matieresBepc.map(([k]) => [k, num(row[`gt10_${k}`])])),
      doublonsMatricule: num(row.doublons),
    };
    // Les doublons de matricule de la source sont signalés, pas corrigés en
    // silence : les totaux restent ceux des candidats officiellement présents.
    if (num(row.doublons) > 0) {
      warnings.push(`BEPC ${num(row.y)} : ${num(row.doublons)} matricule(s) en doublon dans la source`);
    }
  }

  const emptyPopulation = (): PopulationYear => ({
    p3_5: 0, p6_10: 0, p6: 0, p11_14: 0, p11: 0, p15_17: 0, p15: 0, total: 0, source: "",
  });

  // CISCO du périmètre sans population : le dénominateur est alors partiel.
  const popCoverage: Record<number, { ciscos: number; missing: number; codes: number[] }> = {};
  for (const res of covResults) {
    for (const row of (res.rows || []) as any[]) {
      popCoverage[num(row.y)] = {
        ciscos: num(row.ciscos),
        missing: num(row.ciscos_sans_population),
        codes: Array.isArray(row.codes_manquants) ? row.codes_manquants.map((c: any) => num(c)) : [],
      };
    }
  }
  const missingPopCodes = new Set<number>();
  for (const cov of Object.values(popCoverage)) {
    for (const code of cov.codes) if (code > 0) missingPopCodes.add(code);
  }
  const scopeIsNational = s.codeDren <= 0 && s.codeCisco <= 0;
  if (missingPopCodes.size > 0) {
    const codes = [...missingPopCodes].sort((a, b) => a - b).join(", ");
    warnings.push(
      scopeIsNational
        ? `La population de référence ne fournit aucune donnée pour la/les CISCO ${codes} : la couverture nationale est calculée sans elles (dénominateur incomplet, aucune correction automatique).`
        : `La population de référence ne fournit aucune donnée pour la/les CISCO ${codes} : les taux de couverture (TBS, TBA, préscolarisation, salles pour 1000) ne sont pas calculés sur ce périmètre afin de ne pas utiliser un dénominateur incomplet.`,
    );
  }

  // Écarte les années sans effectifs (collecte non encore réalisée)
  for (const k of Object.keys(annees)) {
    const e = annees[k].eleves;
    if (e.presco.total + e.primaire.total + e.college.total + e.lycee.total === 0) delete annees[k];
  }

  // ============ Indicateurs officiels ============
  const yearList = Object.keys(annees).map(Number).sort((a, b) => a - b);
  const indicateurs: Record<string, any> = {};
  // Population du dernier exercice : exposée pour l'affichage et l'IA.
  const population = populations[yearList.length ? yearList[yearList.length - 1] : 0] || emptyPopulation();

  for (const y of yearList) {
    const d = annees[String(y)];
    const prev = annees[String(y - 1)];
    const gr = (lv: string, code: string) => d.eleves[lv].grades[code] || { total: 0, redoublants: 0 };
    const grPrev = (lv: string, code: string) => (prev ? prev.eleves[lv].grades[code] || { total: 0, redoublants: 0 } : null);

    // --- Efficacité interne : promotion / redoublement / abandon (grade -> grade suivant)
    const flux = (lv: string, seq: string[]) => {
      const out: Record<string, any> = {};
      for (let i = 0; i < seq.length; i++) {
        const cur = seq[i];
        const prevYearCur = grPrev(lv, cur);
        if (!prevYearCur || prevYearCur.total === 0) { out[cur] = { promotion: null, redoublement: null, abandon: null }; continue; }
        const next = seq[i + 1];
        const promotionNum = next ? gr(lv, next).total - gr(lv, next).redoublants : null;
        const promotion = promotionNum === null ? null : pct(Math.max(promotionNum, 0), prevYearCur.total);
        const redoublement = pct(gr(lv, cur).redoublants, prevYearCur.total);
        const abandon = promotion === null || redoublement === null ? null : 100 - promotion - redoublement;
        out[cur] = { promotion: r1(promotion), redoublement: r1(redoublement), abandon: r1(abandon) };
      }
      return out;
    };

    const seqP = ["T1", "T2", "T3", "T4", "T5"];
    const seqC = ["T6", "T7", "T8", "T9"];
    const seqL = ["2NDE", "1ERE", "TERM"];

    const el = d.eleves, ens = d.enseignants, sdc = d.salles, pl = d.places;
    const cepe = d.examens.cepe, bepc = d.examens.bepc;
    // Taux assis sur la population : jamais calculés sur un dénominateur
    // partiel (CISCO de collecte absente de la source de population).
    const cov = popCoverage[y];
    const pop = populations[y] || emptyPopulation();
    const populationComplete = scopeIsNational || !cov || cov.missing === 0;
    const popRate = (value: number | null) => (populationComplete ? value : null);
    const prevT5 = grPrev("primaire", "T5");
    const prevT9 = grPrev("college", "T9");

    indicateurs[String(y)] = {
      couverture: {
        tauxPrescolarisation: popRate(r1(pct(el.presco.total, pop.p3_5))),
        tbsPrimaire: popRate(r1(pct(el.primaire.total, pop.p6_10))),
        tbaPrimaire: popRate(r1(pct(Math.max(gr("primaire", "T1").total - gr("primaire", "T1").redoublants, 0), pop.p6))),
        tbsCollege: popRate(r1(pct(el.college.total, pop.p11_14))),
        tbaCollege: popRate(r1(pct(Math.max(gr("college", "T6").total - gr("college", "T6").redoublants, 0), pop.p11))),
        tbsLycee: popRate(r1(pct(el.lycee.total, pop.p15_17))),
        tbaLycee: popRate(r1(pct(Math.max(gr("lycee", "2NDE").total - gr("lycee", "2NDE").redoublants, 0), pop.p15))),
        sallesPour1000Scolarisables: popRate(r1(pop.p6_10 > 0 ? (sdc.primaire.total / pop.p6_10) * 1000 : null)),
        ratioClassePedagogiqueSalle: r2(div(d.sections.primaire, sdc.primaire.total)),
        tauxUtilisationSalleCollege: r1(pct(d.sections.college, sdc.college.total)),
        tauxUtilisationSalleLycee: r1(pct(d.sections.lycee, sdc.lycee.total)),
        pourcentageEppAvecCap: r1(pct(d.etablissements.eppAvecCap, d.etablissements.primaire.total)),
        partPrive: {
          presco: r1(pct(el.presco.priv, el.presco.total)),
          primaire: r1(pct(el.primaire.priv, el.primaire.total)),
          college: r1(pct(el.college.priv, el.college.total)),
          lycee: r1(pct(el.lycee.priv, el.lycee.total)),
        },
        pariteFillesGarcons: {
          presco: r2(div(el.presco.f, el.presco.g)),
          primaire: r2(div(el.primaire.f, el.primaire.g)),
          college: r2(div(el.college.f, el.college.g)),
          lycee: r2(div(el.lycee.f, el.lycee.g)),
        },
        transition: {
          primaireCollege: r1(prevT5 ? pct(gr("college", "T6").total - gr("college", "T6").redoublants, prevT5.total) : null),
          collegeLycee: r1(prevT9 ? pct(gr("lycee", "2NDE").total - gr("lycee", "2NDE").redoublants, prevT9.total) : null),
        },
      },
      efficacite: {
        primaire: flux("primaire", seqP),
        college: flux("college", seqC),
        lycee: flux("lycee", seqL),
      },
      qualite: {
        pourcentageQualifies: {
          presco: r1(pct(ens.presco.qualifie, ens.presco.total)),
          primaire: r1(pct(ens.primaire.qualifie, ens.primaire.total)),
          college: r1(pct(ens.college.qualifie, ens.college.total)),
          lycee: r1(pct(ens.lycee.qualifie, ens.lycee.total)),
        },
        pourcentageNonFonctionnaires: {
          presco: r1(pct(ens.presco.total - ens.presco.fonctionnaire, ens.presco.total)),
          primaire: r1(pct(ens.primaire.total - ens.primaire.fonctionnaire, ens.primaire.total)),
          college: r1(pct(ens.college.total - ens.college.fonctionnaire, ens.college.total)),
          lycee: r1(pct(ens.lycee.total - ens.lycee.fonctionnaire, ens.lycee.total)),
        },
        ratioEleveEnseignant: {
          presco: r1(div(el.presco.total, ens.presco.total)),
          primaire: r1(div(el.primaire.total, ens.primaire.total)),
          college: r1(div(el.college.total, ens.college.total)),
          lycee: r1(div(el.lycee.total, ens.lycee.total)),
        },
        ratioElevePlaceAssise: {
          presco: r2(div(el.presco.total, pl.presco.total)),
          primaire: r2(div(el.primaire.total, pl.primaire.total)),
          college: r2(div(el.college.total, pl.college.total)),
          lycee: r2(div(el.lycee.total, pl.lycee.total)),
        },
        ratioEleveManuel: {
          malagasy: r2(div(el.primaire.total, d.manuels.malagasy)),
          francais: r2(div(el.primaire.total, d.manuels.francais)),
          maths: r2(div(el.primaire.total, d.manuels.maths)),
        },
        ratioEleveSalle: {
          presco: r1(div(el.presco.total, sdc.presco.total)),
          primaire: r1(div(el.primaire.total, sdc.primaire.total)),
          college: r1(div(el.college.total, sdc.college.total)),
          lycee: r1(div(el.lycee.total, sdc.lycee.total)),
        },
        pourcentageSallesMauvaisEtat: {
          primaire: r1(pct(sdc.primaire.mauvais, sdc.primaire.total)),
          college: r1(pct(sdc.college.mauvais, sdc.college.total)),
          lycee: r1(pct(sdc.lycee.mauvais, sdc.lycee.total)),
        },
        pourcentageMultigrade: r1(pct(d.sections.multigrade, d.sections.primaire)),
      },
      resultats: {
        cepe: cepe
          ? {
              tauxReussite: r1(pct(cepe.admis, cepe.presentes)),
              tauxReussiteSurInscrits: r1(prevT5 ? pct(cepe.admis, gr("primaire", "T5").total) : null),
              presentes: cepe.presentes, admis: cepe.admis,
              moyenne: cepe.moyenne, scores: { malagasy: cepe.moyMalagasy, francais: cepe.moyFrancais, calcul: cepe.moyCalcul },
            }
          : null,
        bepc: bepc
          ? {
              tauxReussite: r1(pct(bepc.admis, bepc.presentes)),
              tauxReussiteFilles: r1(pct(bepc.admisFilles, bepc.filles)),
              tauxReussiteGarcons: r1(pct(bepc.admisGarcons, bepc.garcons)),
              tauxReussiteSurInscrits: r1(pct(bepc.admis, gr("college", "T9").total)),
              presentes: bepc.presentes, admis: bepc.admis,
              filles: bepc.filles, garcons: bepc.garcons,
              admisFilles: bepc.admisFilles, admisGarcons: bepc.admisGarcons,
              moyenne: bepc.moyenne, scores: bepc.scores, notesSup10: bepc.notesSup10,
              doublonsMatricule: bepc.doublonsMatricule,
            }
          : null,
      },
    };
  }

  // TBS > 200 % : effectif supérieur au double de la population recensée.
  // Anomalie de collecte ou projection de population trop basse : on la
  // signale explicitement, sans plafonner ni corriger le chiffre source.
  const last = yearList[yearList.length - 1];
  if (last) {
    const covLast = popCoverage[last];
    if ((scopeIsNational || !covLast || covLast.missing === 0) && population.p6_10 > 0) {
      const lastEl = annees[String(last)].eleves.primaire;
      const tbs = pct(lastEl.total, population.p6_10);
      if (tbs !== null && tbs > 200) {
        const tba = pct(Math.max((lastEl.grades["T1"]?.total || 0) - (lastEl.grades["T1"]?.redoublants || 0), 0), population.p6);
        warnings.push(
          `TBS primaire ${last} = ${r1(tbs)} % (TBA ${r1(tba)} %) : effectif supérieur au double de la population scolarisable recensée. Vérifier la collecte et la projection de population (valeurs affichées telles quelles).`,
        );
      }
    }
  }

  // Profil de rétention apparent T1 -> T5 (cohorte sur 5 ans)
  const retention: Record<string, any> = {};
  if (last && annees[String(last - 4)]) {
    const start = annees[String(last - 4)].eleves.primaire.grades["T1"]?.total || 0;
    retention.primaire = {
      cohorte: `${last - 4} → ${last}`,
      T1: 100,
      T2: r1(pct(annees[String(last - 3)]?.eleves.primaire.grades["T2"]?.total || 0, start)),
      T3: r1(pct(annees[String(last - 2)]?.eleves.primaire.grades["T3"]?.total || 0, start)),
      T4: r1(pct(annees[String(last - 1)]?.eleves.primaire.grades["T4"]?.total || 0, start)),
      T5: r1(pct(annees[String(last)]?.eleves.primaire.grades["T5"]?.total || 0, start)),
    };
  }
  if (last && annees[String(last - 3)]) {
    const start = annees[String(last - 3)].eleves.college.grades["T6"]?.total || 0;
    retention.college = {
      cohorte: `${last - 3} → ${last}`,
      T6: 100,
      T7: r1(pct(annees[String(last - 2)]?.eleves.college.grades["T7"]?.total || 0, start)),
      T8: r1(pct(annees[String(last - 1)]?.eleves.college.grades["T8"]?.total || 0, start)),
      T9: r1(pct(annees[String(last)]?.eleves.college.grades["T9"]?.total || 0, start)),
    };
  }
  if (last && annees[String(last - 2)]) {
    const start = annees[String(last - 2)].eleves.lycee.grades["2NDE"]?.total || 0;
    retention.lycee = {
      cohorte: `${last - 2} → ${last}`,
      "2NDE": 100,
      "1ERE": r1(pct(annees[String(last - 1)]?.eleves.lycee.grades["1ERE"]?.total || 0, start)),
      TERM: r1(pct(annees[String(last)]?.eleves.lycee.grades["TERM"]?.total || 0, start)),
    };
  }

  // Dernière session d'examen réellement disponible par examen. Les vues
  // Qualité peuvent ainsi afficher le BEPC 2025 quand l'année sélectionnée
  // (2026) n'a pas encore de session, sans rattacher ces chiffres à 2026.
  const lastYearWith = (exam: "cepe" | "bepc") => {
    const available = yearList.filter((y) => !!annees[String(y)].examens[exam]);
    return available.length ? available[available.length - 1] : null;
  };

  return {
    scope: s,
    years: yearList.length ? yearList : years,
    population,
    annees,
    indicateurs,
    retention,
    sessionsExamens: { cepe: lastYearWith("cepe"), bepc: lastYearWith("bepc") },
    warnings,
  };
}
