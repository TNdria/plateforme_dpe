import * as XLSX from "xlsx";

let cachedRows: any[][] = [];

const normHeader = (value: unknown) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "");

const KNOWN_HEADERS = new Set([
  "anneescolaire", "annee", "anneeexamen", "codedren", "dren", "codecisco", "cisco", "codezap", "zap",
  "codeetab", "codeetablissement", "codeecole", "matricule", "codecentre", "codecentreexamen", "ecoleorigine", "ecoledorigine",
  "sexe", "genre", "option", "op", "operation", "probleme", "problemes", "svt", "tfm", "histoire", "histoiregeographie",
  "histogeo", "malagasy", "mlg", "francais", "frs", "anglais", "mathematique", "mathematiques", "maths", "physique",
  "bonus", "geographie", "geo", "total", "totalgeneral", "totalbepc", "moyenne", "moyennebepc", "resultat", "decision",
  "statut", "cepe", "bepc", "nometab",
]);

function trimTable(rows: any[][]) {
  let first = Infinity;
  let last = -1;
  rows.forEach((row) => {
    row.forEach((cell, index) => {
      if (cell !== null && cell !== undefined && String(cell).trim() !== "") {
        first = Math.min(first, index);
        last = Math.max(last, index);
      }
    });
  });
  if (!Number.isFinite(first) || last < first) return rows;
  return rows.map((row) => row.slice(first, last + 1));
}

function headerScore(row: any[]) {
  const nonEmpty = row.filter((cell) => cell !== null && cell !== undefined && String(cell).trim() !== "");
  const known = nonEmpty.filter((cell) => KNOWN_HEADERS.has(normHeader(cell))).length;
  const text = nonEmpty.filter((cell) => typeof cell === "string" || Number.isNaN(Number(cell))).length;
  return known * 3 + Math.min(text, 4);
}

function extractFirstTabularSheet(workbook: XLSX.WorkBook) {
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const json: any[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      blankrows: false,
      defval: null,
    });

    const filtered = json.filter(
      (row: any[]) => Array.isArray(row) && row.some((cell: any) => cell !== null && cell !== undefined && cell !== ""),
    );

    if (filtered.length >= 2) {
      const scanLimit = Math.min(filtered.length - 1, 40);
      let bestIndex = 0;
      let bestScore = -1;
      for (let i = 0; i < scanLimit; i++) {
        const score = headerScore(filtered[i]);
        if (score > bestScore) {
          bestScore = score;
          bestIndex = i;
        }
      }
      const rows = trimTable(filtered.slice(bestScore >= 4 ? bestIndex : 0));
      if (rows.length >= 2) return { sheetName, rows };
    }
  }

  return null;
}

self.onmessage = (event: MessageEvent) => {
  const { id, type, buffer, offset = 0, limit = 1000 } = event.data ?? {};

  try {
    if (type === "parse") {
      const workbook = XLSX.read(buffer, { type: "array", dense: true } as any);
      const extracted = extractFirstTabularSheet(workbook);

      if (!extracted) {
        cachedRows = [];
        self.postMessage({ id, ok: false, error: "Aucune feuille tabulaire détectée. Le fichier semble contenir une image ou une mise en page sans tableau exploitable." });
        return;
      }

      const headers = (extracted.rows[0] as any[]).map((header: any) => String(header ?? "").trim());
      cachedRows = extracted.rows.slice(1);

      self.postMessage({
        id,
        ok: true,
        headers,
        sheetName: extracted.sheetName,
        rowCount: cachedRows.length,
        previewRows: cachedRows.slice(0, 3),
      });
      return;
    }

    if (type === "getChunk") {
      self.postMessage({
        id,
        ok: true,
        rows: cachedRows.slice(offset, offset + limit),
      });
      return;
    }

    if (type === "clear") {
      cachedRows = [];
      self.postMessage({ id, ok: true });
      return;
    }

    self.postMessage({ id, ok: false, error: `Action worker inconnue: ${type}` });
  } catch (error: any) {
    self.postMessage({ id, ok: false, error: error?.message || "Erreur de lecture Excel" });
  }
};