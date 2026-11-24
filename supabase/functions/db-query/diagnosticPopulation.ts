// Population de référence du Diagnostic (dénominateurs TBS / TBA).
// La projection officielle importée pour l'année (`tdb_population_cisco`,
// 3 à 17 ans) est la même source que le TDB DREN/Niveau : elle prime, sinon
// deux modules afficheraient deux TBS différents pour la même année. La table
// historique `population_2025` reste le repli pour ne jamais supprimer un taux
// qui était calculé auparavant.
import { popCiscoSource } from "./refImport.ts";

export type DiagnosticPopScope = { codeDren: number; codeCisco: number };
export type PopulationSource = { from: string; label: string };
export type PopulationYear = { p3_5: number; p6_10: number; p6: number; p11_14: number; p11: number; p15_17: number; p15: number; total: number; source: string };

const AGES = Array.from({ length: 15 }, (_, i) => i + 3); // 3..17

const num = (v: any) => {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
};

const fallbackSource = () =>
  `(SELECT code_cisco, code_dren, ${AGES.map((a) => `pop_${a}_ans`).join(", ")} FROM population_2025)`;

/** Source de population à utiliser pour une année donnée. */
export async function diagnosticPopulationSource(client: any, year: number): Promise<PopulationSource> {
  const imported = await popCiscoSource(client, year);
  return imported
    ? { from: imported, label: `projection ${year} — population de référence importée (RGPH-3)` }
    : { from: fallbackSource(), label: "population_2025 (projection RGPH-3)" };
}

const sampleWhere = (alias: string, scope: DiagnosticPopScope) =>
  scope.codeCisco > 0
    ? `${alias}.code_cisco = ${scope.codeCisco}`
    : scope.codeDren > 0
    ? `${alias}.code_dren = ${scope.codeDren}`
    : "TRUE";

/** Populations scolarisables du périmètre pour l'année. */
export function diagnosticPopulationQuery(year: number, source: PopulationSource, scope: DiagnosticPopScope): string {
  return `SELECT ${year} AS y,
      SUM(px.pop_3_ans+px.pop_4_ans+px.pop_5_ans) AS p3_5,
      SUM(px.pop_6_ans+px.pop_7_ans+px.pop_8_ans+px.pop_9_ans+px.pop_10_ans) AS p6_10,
      SUM(px.pop_6_ans) AS p6,
      SUM(px.pop_11_ans+px.pop_12_ans+px.pop_13_ans+px.pop_14_ans) AS p11_14,
      SUM(px.pop_11_ans) AS p11,
      SUM(px.pop_15_ans+px.pop_16_ans+px.pop_17_ans) AS p15_17,
      SUM(px.pop_15_ans) AS p15,
      SUM(px.pop_total) AS total
    FROM ${source.from} px WHERE ${sampleWhere("px", scope)}`;
}

/**
 * CISCO de la collecte (fpe_a1) présentes dans le périmètre pour l'année mais
 * absentes de la source de population : le dénominateur est alors partiel.
 */
export function diagnosticPopCoverageQuery(year: number, source: PopulationSource, scope: DiagnosticPopScope): string {
  const where =
    scope.codeCisco > 0
      ? `"CODE_CISCO" = ${scope.codeCisco}`
      : scope.codeDren > 0
      ? `"CODE_DREN" = ${scope.codeDren}`
      : "TRUE";
  return `SELECT ${year} AS y,
      COUNT(*) AS ciscos,
      COUNT(*) FILTER (WHERE p.code_cisco IS NULL) AS ciscos_sans_population,
      array_agg(x."CODE_CISCO" ORDER BY x."CODE_CISCO") FILTER (WHERE p.code_cisco IS NULL) AS codes_manquants
    FROM (SELECT DISTINCT "CODE_CISCO" FROM fpe_a1
          WHERE "ANNEE_SCOLAIRE" = ${year} AND ${where} AND "CODE_CISCO" IS NOT NULL) x
    LEFT JOIN (SELECT DISTINCT code_cisco FROM ${source.from} px) p
      ON p.code_cisco = x."CODE_CISCO"`;
}

/** Population par année, à partir des lignes renvoyées par `diagnosticPopulationQuery`. */
export function diagnosticPopulations(
  sources: Array<{ year: number; source: PopulationSource }>,
  results: Array<{ rows?: any[] }>,
): Record<number, PopulationYear> {
  const out: Record<number, PopulationYear> = {};
  sources.forEach((entry, i) => {
    const row: any = (results[i]?.rows as any[])?.[0] || {};
    out[entry.year] = {
      p3_5: num(row.p3_5),
      p6_10: num(row.p6_10),
      p6: num(row.p6),
      p11_14: num(row.p11_14),
      p11: num(row.p11),
      p15_17: num(row.p15_17),
      p15: num(row.p15),
      total: num(row.total),
      source: entry.source.label,
    };
  });
  return out;
}
