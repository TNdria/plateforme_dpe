import * as XLSX from "xlsx";

let cachedRows: any[][] = [];

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
      return { sheetName, rows: filtered };
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