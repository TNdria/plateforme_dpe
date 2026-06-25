export const EXAMEN_CEPE_COLUMNS = [
  "ANNEE_SCOLAIRE",
  "DREN",
  "CISCO",
  "OPTION",
  "CODE_CENTRE",
  "CODE_ETAB",
  "ECOLE_ORIGINE",
  "GENRE",
  "OP",
  "PROBLEME",
  "SVT",
  "TFM",
  "MALAGASY",
  "FRANCAIS",
  "GEOGRAPHIE",
  "TOTAL",
  "MOYENNE",
  "CEPE",
] as const;

export const EXAMEN_BEPC_COLUMNS = [
  "ANNEE_SCOLAIRE",
  "DREN",
  "CISCO",
  "MATRICULE",
  "CODE_ETAB",
  "ECOLE_ORIGINE",
  "CODE_CENTRE",
  "GENRE",
  "OPTION",
  "MALAGASY",
  "FRANCAIS",
  "ANGLAIS",
  "MATHEMATIQUE",
  "PHYSIQUE",
  "BONUS",
  "SVT",
  "HISTO_GEO",
  "TOTAL",
  "MOYENNE",
  "BEPC",
] as const;

export type ExamImportTable = "examen_cepe_candidates" | "examen_bepc_candidates";

export const normHeader = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s\-_.]+/g, "");

const CEPE_ALIASES: Record<string, string> = {
  anneescolaire: "ANNEE_SCOLAIRE",
  annee: "ANNEE_SCOLAIRE",
  anneeexamen: "ANNEE_SCOLAIRE",
  dren: "DREN",
  cisco: "CISCO",
  option: "OPTION",
  codecentre: "CODE_CENTRE",
  codecentreexamen: "CODE_CENTRE",
  centre: "CODE_CENTRE",
  codeetab: "CODE_ETAB",
  codeetablissement: "CODE_ETAB",
  codeecole: "CODE_ETAB",
  etabcode: "CODE_ETAB",
  ecoledorigine: "ECOLE_ORIGINE",
  ecoleorigine: "ECOLE_ORIGINE",
  etablissementorigine: "ECOLE_ORIGINE",
  sexe: "GENRE",
  genre: "GENRE",
  op: "OP",
  operation: "OP",
  ops: "OP",
  probleme: "PROBLEME",
  problemes: "PROBLEME",
  svt: "SVT",
  tfm: "TFM",
  histoire: "TFM",
  malagasy: "MALAGASY",
  mlg: "MALAGASY",
  francais: "FRANCAIS",
  frs: "FRANCAIS",
  geographie: "GEOGRAPHIE",
  geo: "GEOGRAPHIE",
  total: "TOTAL",
  totalgeneral: "TOTAL",
  moyenne: "MOYENNE",
  resultat: "CEPE",
  decision: "CEPE",
  statut: "CEPE",
  cepe: "CEPE",
};

const BEPC_ALIASES: Record<string, string> = {
  dren: "DREN",
  cisco: "CISCO",
  matricule: "MATRICULE",
  codeetablissement: "CODE_ETAB",
  codeetab: "CODE_ETAB",
  codeecole: "CODE_ETAB",
  ecoledorigine: "ECOLE_ORIGINE",
  ecoleorigine: "ECOLE_ORIGINE",
  etablissementorigine: "ECOLE_ORIGINE",
  codecentre: "CODE_CENTRE",
  centre: "CODE_CENTRE",
  sexe: "GENRE",
  genre: "GENRE",
  option: "OPTION",
  malagasy: "MALAGASY",
  francais: "FRANCAIS",
  anglais: "ANGLAIS",
  mathematique: "MATHEMATIQUE",
  mathematiques: "MATHEMATIQUE",
  maths: "MATHEMATIQUE",
  physique: "PHYSIQUE",
  bonus: "BONUS",
  svt: "SVT",
  histogeo: "HISTO_GEO",
  histoiregeographie: "HISTO_GEO",
  totalbepc: "TOTAL",
  total: "TOTAL",
  moyennebepc: "MOYENNE",
  moyenne: "MOYENNE",
  resultat: "BEPC",
  decision: "BEPC",
  statut: "BEPC",
  bepc: "BEPC",
  anneescolaire: "ANNEE_SCOLAIRE",
  annee: "ANNEE_SCOLAIRE",
};

const EXAM_ALIASES: Record<ExamImportTable, Record<string, string>> = {
  examen_cepe_candidates: CEPE_ALIASES,
  examen_bepc_candidates: BEPC_ALIASES,
};

const EXAM_COLUMNS: Record<ExamImportTable, readonly string[]> = {
  examen_cepe_candidates: EXAMEN_CEPE_COLUMNS,
  examen_bepc_candidates: EXAMEN_BEPC_COLUMNS,
};

const EXAM_REQUIRED_COLUMNS: Record<ExamImportTable, readonly string[]> = {
  examen_cepe_candidates: ["CODE_ETAB", "GENRE", "MALAGASY", "FRANCAIS", "OP", "PROBLEME", "CEPE"],
  examen_bepc_candidates: ["CODE_ETAB", "GENRE", "OPTION", "MALAGASY", "FRANCAIS", "MATHEMATIQUE", "BEPC"],
};

export function isExamImportTable(table?: string | null): table is ExamImportTable {
  return table === "examen_cepe_candidates" || table === "examen_bepc_candidates";
}

export function getExamColumns(table: ExamImportTable) {
  return EXAM_COLUMNS[table];
}

export function getExamRequiredColumns(table: ExamImportTable) {
  return EXAM_REQUIRED_COLUMNS[table];
}

export function getExamTableColumns(table: ExamImportTable) {
  if (table === "examen_cepe_candidates") {
    return EXAMEN_CEPE_COLUMNS.map((column_name) => ({
      column_name,
      data_type: ["ANNEE_SCOLAIRE", "CODE_ETAB"].includes(column_name)
        ? "integer"
        : ["DREN", "CISCO", "OPTION", "CODE_CENTRE", "ECOLE_ORIGINE", "GENRE", "CEPE"].includes(column_name)
          ? "text"
          : "numeric",
    }));
  }

  return EXAMEN_BEPC_COLUMNS.map((column_name) => ({
    column_name,
    data_type: ["ANNEE_SCOLAIRE", "CODE_ETAB"].includes(column_name)
      ? "integer"
      : ["DREN", "CISCO", "MATRICULE", "ECOLE_ORIGINE", "CODE_CENTRE", "GENRE", "OPTION", "BEPC"].includes(column_name)
        ? "text"
        : "numeric",
  }));
}

export function buildExamMapping(headers: string[], table: ExamImportTable): Record<string, string> {
  const cols = EXAM_COLUMNS[table];
  const aliases = EXAM_ALIASES[table];
  const mapping: Record<string, string> = {};

  headers.forEach((header) => {
    const trimmed = header.trim();
    const direct = cols.find((column) => column.toLowerCase() === trimmed.toLowerCase());
    if (direct) {
      mapping[header] = direct;
      return;
    }

    const alias = aliases[normHeader(trimmed)];
    if (alias && cols.includes(alias)) {
      mapping[header] = alias;
    }
  });

  return mapping;
}