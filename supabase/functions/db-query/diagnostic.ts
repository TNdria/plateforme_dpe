// Diagnostic dataset builder — follows the official MEN document
// "DOCUMENT DE DIAGNOSTIC DU SYSTEME EDUCATIF" (formules officielles).
// All data comes from the DPE PostgreSQL server (fpe_*, population_2025, examen_*).

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
  const qPl = `
    SELECT ${yr('v."ANNEE_SCOLAIRE"')} AS y,
      SUM(COALESCE(v."places_n0",0)) AS presco, SUM(COALESCE(v."places_n1",0)) AS primaire,
      SUM(COALESCE(v."places_n2",0)) AS college, SUM(COALESCE(v."places_n3",0)) AS lycee
    FROM v_place_assises v WHERE ${scopeSql("v", s)} GROUP BY 1`;

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
  const qP1 = `SELECT ${yr('p."ANNEE_SCOLAIRE"')} AS y, ${n('p."SECTEUR"')}::int AS s, ${teacherCols}
    FROM fpe_p1 p WHERE ${scopeSql("p", s)} GROUP BY 1,2`;

  // ---------- 9. Population (dénominateurs TBS / TBA) ----------
  const popWhere = s.codeCisco > 0
    ? `code_cisco = ${s.codeCisco}`
    : s.codeDren > 0
    ? `code_dren = ${s.codeDren}`
    : "TRUE";
  const qPop = `SELECT
      SUM(pop_3_ans+pop_4_ans+pop_5_ans) AS p3_5,
      SUM(pop_6_ans+pop_7_ans+pop_8_ans+pop_9_ans+pop_10_ans) AS p6_10,
      SUM(pop_6_ans) AS p6,
      SUM(pop_11_ans+pop_12_ans+pop_13_ans+pop_14_ans) AS p11_14,
      SUM(pop_11_ans) AS p11,
      SUM(pop_15_ans+pop_16_ans+pop_17_ans) AS p15_17,
      SUM(pop_15_ans) AS p15,
      SUM(pop_total) AS total
    FROM population_2025 WHERE ${popWhere}`;

  // ---------- 10. Examens ----------
  const etabScope = `SELECT DISTINCT "CODE_ETAB" FROM fpe_a1 WHERE ${scopeSql("fpe_a1", s)}`;
  const qCepe = `SELECT ${yr('c."ANNEE_SCOLAIRE"')} AS y,
      COUNT(*) AS presentes,
      SUM(CASE WHEN upper(COALESCE(c."CEPE",'')) IN ('A','ADMIS') THEN 1 ELSE 0 END) AS admis,
      SUM(CASE WHEN upper(COALESCE(c."GENRE",'')) LIKE 'F%' THEN 1 ELSE 0 END) AS filles,
      AVG(NULLIF(${n('c."MOYENNE"')},0)) AS moyenne,
      AVG(NULLIF(${n('c."MALAGASY"')},0)) AS moy_malagasy,
      AVG(NULLIF(${n('c."FRANCAIS"')},0)) AS moy_francais,
      AVG(NULLIF(${n('c."OP"')},0)) AS moy_calcul
    FROM examen_cepe_candidates c WHERE c."CODE_ETAB" IN (${etabScope}) GROUP BY 1`;

  // Une requête en erreur ne doit jamais vider tout le diagnostic :
  // on isole chaque bloc et on renvoie des lignes vides en cas d'échec.
  const warnings: string[] = [];
  const safe = (label: string, q: string) =>
    client.queryObject(q).catch((e: any) => {
      warnings.push(`${label}: ${e?.message || e}`);
      return { rows: [] };
    });

  const [rE1, rE4, rA1, rJ1, rG1, rPl, rL1, rP1, rPop, rCepe] = await Promise.all([
    safe("fpe_e1", qE1), safe("fpe_e4", qE4), safe("fpe_a1", qA1),
    safe("fpe_j1", qJ1), safe("fpe_g1", qG1), safe("v_place_assises", qPl),
    safe("fpe_l1", qL1), safe("fpe_p1", qP1), safe("population_2025", qPop),
    safe("examen_cepe", qCepe),
  ]);

  let rBepc: any = { rows: [] };
  try {
    rBepc = await client.queryObject(`SELECT ${yr('b."ANNEE_SCOLAIRE"')} AS y, COUNT(*) AS presentes,
      SUM(CASE WHEN upper(COALESCE(b."BEPC",'')) IN ('A','ADMIS') THEN 1 ELSE 0 END) AS admis
      FROM examen_bepc_candidates b WHERE b."CODE_ETAB" IN (${etabScope}) GROUP BY 1`);
  } catch (_) { /* BEPC column layout may differ */ }

  // ============ Assemblage par année ============
  const empty = () => ({ g: 0, f: 0, pub: 0, priv: 0, total: 0 });
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
        etablissements: { presco: { pub: 0, priv: 0, total: 0 }, primaire: { pub: 0, priv: 0, total: 0 }, college: { pub: 0, priv: 0, total: 0 }, lycee: { pub: 0, priv: 0, total: 0 }, eppAvecCap: 0, electrifie: 0, pointEau: 0 },
        salles: { presco: { bon: 0, mauvais: 0, total: 0 }, primaire: { bon: 0, mauvais: 0, total: 0 }, college: { bon: 0, mauvais: 0, total: 0 }, lycee: { bon: 0, mauvais: 0, total: 0 } },
        sections: { presco: 0, primaire: 0, college: 0, lycee: 0, multigrade: 0 },
        places: { presco: 0, primaire: 0, college: 0, lycee: 0 },
        manuels: { malagasy: 0, francais: 0, maths: 0 },
        enseignants: {
          presco: { total: 0, qualifie: 0, fonctionnaire: 0, femmes: 0, pub: 0, priv: 0 },
          primaire: { total: 0, qualifie: 0, fonctionnaire: 0, femmes: 0, pub: 0, priv: 0 },
          college: { total: 0, qualifie: 0, fonctionnaire: 0, femmes: 0, pub: 0, priv: 0 },
          lycee: { total: 0, qualifie: 0, fonctionnaire: 0, femmes: 0, pub: 0, priv: 0 },
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
    lv.g += g; lv.f += f; lv.total += g + f;
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
    y.places = { presco: num(row.presco), primaire: num(row.primaire), college: num(row.college), lycee: num(row.lycee) };
  }
  for (const row of rL1.rows as any[]) {
    const y = ensure(num(row.y));
    y.manuels = { malagasy: num(row.malagasy), francais: num(row.francais), maths: num(row.maths) };
  }
  for (const row of rP1.rows as any[]) {
    const y = ensure(num(row.y));
    const priv = num(row.s) === 1;
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
    y.examens.bepc = { presentes: num(row.presentes), admis: num(row.admis) };
  }

  const popRow: any = (rPop.rows as any[])[0] || {};
  const population = {
    p3_5: num(popRow.p3_5), p6_10: num(popRow.p6_10), p6: num(popRow.p6),
    p11_14: num(popRow.p11_14), p11: num(popRow.p11),
    p15_17: num(popRow.p15_17), p15: num(popRow.p15), total: num(popRow.total),
    source: "population_2025 (projection RGPH-3)",
  };

  // Écarte les années sans effectifs (collecte non encore réalisée)
  for (const k of Object.keys(annees)) {
    const e = annees[k].eleves;
    if (e.presco.total + e.primaire.total + e.college.total + e.lycee.total === 0) delete annees[k];
  }

  // ============ Indicateurs officiels ============
  const yearList = Object.keys(annees).map(Number).sort((a, b) => a - b);
  const indicateurs: Record<string, any> = {};

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
    const prevT5 = grPrev("primaire", "T5");
    const prevT9 = grPrev("college", "T9");

    indicateurs[String(y)] = {
      couverture: {
        tauxPrescolarisation: r1(pct(el.presco.total, population.p3_5)),
        tbsPrimaire: r1(pct(el.primaire.total, population.p6_10)),
        tbaPrimaire: r1(pct(Math.max(gr("primaire", "T1").total - gr("primaire", "T1").redoublants, 0), population.p6)),
        tbsCollege: r1(pct(el.college.total, population.p11_14)),
        tbaCollege: r1(pct(Math.max(gr("college", "T6").total - gr("college", "T6").redoublants, 0), population.p11)),
        tbsLycee: r1(pct(el.lycee.total, population.p15_17)),
        tbaLycee: r1(pct(Math.max(gr("lycee", "2NDE").total - gr("lycee", "2NDE").redoublants, 0), population.p15)),
        sallesPour1000Scolarisables: r1(population.p6_10 > 0 ? (sdc.primaire.total / population.p6_10) * 1000 : null),
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
          presco: r2(div(el.presco.total, pl.presco)),
          primaire: r2(div(el.primaire.total, pl.primaire)),
          college: r2(div(el.college.total, pl.college)),
          lycee: r2(div(el.lycee.total, pl.lycee)),
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
              tauxReussiteSurInscrits: r1(pct(bepc.admis, gr("college", "T9").total)),
              presentes: bepc.presentes, admis: bepc.admis,
            }
          : null,
      },
    };
  }

  // Profil de rétention apparent T1 -> T5 (cohorte sur 5 ans)
  const last = yearList[yearList.length - 1];
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

  return {
    scope: s,
    years: yearList.length ? yearList : years,
    population,
    annees,
    indicateurs,
    retention,
    warnings,
  };
}
