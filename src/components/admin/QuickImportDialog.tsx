import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

const API_BASE = (() => {
  const pid = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  return pid ? `https://${pid}.supabase.co` : import.meta.env.VITE_SUPABASE_URL;
})();
const HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
};

const FLEXIBLE_TDB_TABLES = new Set(["tdb_ecole", "tdb_zap", "tdb_cisco", "tdb_dren", "tdb_mada", "tdb_ref", "examen_cepe_candidates", "examen_bepc_candidates"]);
const EXAM_TABLES = new Set(["examen_cepe_candidates", "examen_bepc_candidates"]);


async function call(action: string, body: Record<string, any>) {
  const r = await fetch(`${API_BASE}/functions/v1/db-query?action=${action}`, {
    method: "POST", headers: HEADERS, body: JSON.stringify(body),
  });
  return r.json();
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  table: string;
  tableLabel: string;
  adminUsername: string;
  onImported?: () => void;
}

const QuickImportDialog = ({ open, onOpenChange, table, tableLabel, adminUsername, onImported }: Props) => {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<{ headers: string[]; rows: any[][] } | null>(null);
  const [columns, setColumns] = useState<{ column_name: string; data_type: string }[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [anneeScolaire, setAnneeScolaire] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);
  const isFlexibleTdbImport = FLEXIBLE_TDB_TABLES.has(table);
  const isExamImport = EXAM_TABLES.has(table);

  const reset = () => {
    setFile(null); setData(null); setMapping({}); setProgress(0); setAnneeScolaire("");
    if (fileRef.current) fileRef.current.value = "";
  };


  const loadCols = useCallback(async (headers: string[]) => {
    const res = await call("getTableColumns", { adminUsername, tableName: table });
    if (res.success) {
      setColumns(res.columns || []);
      const map: Record<string, string> = {};
      headers.forEach((h) => {
        const m = res.columns.find(
          (c: any) => c.column_name.toLowerCase() === h.toLowerCase().trim() || c.column_name === h,
        );
        if (m) map[h] = m.column_name;
      });
      setMapping(map);
    } else {
      toast.error(res.error || "Impossible de lire les colonnes");
    }
  }, [adminUsername, table]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setData(null); setMapping({});

    // Auto-detect ANNEE_SCOLAIRE from filename for exam imports (e.g. CEPE_2024.xlsx → 2024)
    if (isExamImport) {
      const m = f.name.match(/(20\d{2}|19\d{2})/);
      if (m) setAnneeScolaire(m[1]);
    }

    let headers: string[] = [];
    let rows: any[][] = [];
    const fname = f.name.toLowerCase();


    try {
      if (fname.endsWith(".csv") || fname.endsWith(".txt")) {
        const text = (await f.text()).replace(/^\uFEFF/, "");
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) { toast.error("Fichier vide"); return; }
        const sep = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";
        const parseLine = (line: string) => {
          const out: string[] = []; let cur = ""; let inQ = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
            else if (ch === '"') inQ = !inQ;
            else if (ch === sep && !inQ) { out.push(cur); cur = ""; }
            else cur += ch;
          }
          out.push(cur); return out;
        };
        headers = parseLine(lines[0]).map((h) => h.trim());
        rows = lines.slice(1).map(parseLine);
      } else {
        toast.info("Lecture du fichier Excel… (peut prendre 30–60s pour les gros fichiers)");
        // Yield to keep UI responsive before heavy parsing.
        await new Promise((r) => setTimeout(r, 50));
        const XLSX = await import("xlsx");
        const buf = await f.arrayBuffer();
        await new Promise((r) => setTimeout(r, 0));
        const wb = XLSX.read(buf, { type: "array", dense: true } as any);
        const ws = wb.Sheets[wb.SheetNames[0]];
        await new Promise((r) => setTimeout(r, 0));
        const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: null });
        if (json.length < 2) { toast.error("Fichier vide"); return; }
        headers = (json[0] as any[]).map((h: any) => String(h ?? "").trim());
        rows = json.slice(1).filter((r: any[]) => Array.isArray(r) && r.some((c: any) => c !== null && c !== undefined && c !== ""));
      }
      setData({ headers, rows });
      toast.success(`${rows.length} lignes détectées (${headers.length} colonnes)`);
      if (isFlexibleTdbImport) {
        setColumns([]);
        setMapping({});
      } else {
        await loadCols(headers);
      }
    } catch (err: any) {
      toast.error(`Erreur lecture: ${err.message}`);
    }
  };

  const handleImport = async () => {
    if (!data) return;
    const mapped = Object.entries(mapping).filter(([, v]) => v);
    if (!isFlexibleTdbImport && mapped.length === 0) { toast.error("Aucune colonne mappée"); return; }
    if (isExamImport) {
      const yr = parseInt(anneeScolaire, 10);
      if (!Number.isFinite(yr) || yr < 1990 || yr > 2100) {
        toast.error("Veuillez renseigner une année scolaire valide (ex: 2024)");
        return;
      }
    }
    setImporting(true); setProgress(0);
    try {
      const idx = isFlexibleTdbImport
        ? data.headers.map((h, i) => ({ index: i, dbCol: h }))
        : data.headers.map((h, i) => ({ index: i, dbCol: mapping[h] })).filter((x) => x.dbCol);
      let cols = idx.map((x) => x.dbCol);
      let allRows = data.rows.map((r) => idx.map((x) => r[x.index] ?? null));
      // Inject ANNEE_SCOLAIRE (from filename/input) when not present in the file headers
      if (isExamImport) {
        const hasAnnee = cols.some((c) => String(c).toUpperCase().replace(/[^A-Z]/g, '') === 'ANNEESCOLAIRE');
        if (!hasAnnee) {
          cols = ['ANNEE_SCOLAIRE', ...cols];
          const yr = parseInt(anneeScolaire, 10);
          allRows = allRows.map((r) => [yr, ...r]);
        }
      }

      // Larger batches drastically reduce round-trips for huge files (600k rows).
      const batch = data.rows.length > 50000 ? 2000 : 500;
      let inserted = 0;
      const errors: string[] = [];
      let targetTable: string | undefined;
      const ignoredAll = new Set<string>();
      const importBatchId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const importBatchTs = new Date().toISOString();
      for (let i = 0; i < allRows.length; i += batch) {
        const slice = allRows.slice(i, i + batch);
        const res = await call("importData", {
          adminUsername, tableName: table, columns: cols, rows: slice, fileName: file?.name,
          importBatchId, importBatchTs, isFinalChunk: i + slice.length >= allRows.length,
        });
        if (res.success) {
          inserted += res.inserted || 0;
          if (res.errors?.length) errors.push(...res.errors);
          if (res.targetTable) targetTable = res.targetTable;
          (res.ignoredColumns || []).forEach((c: string) => ignoredAll.add(c));
        } else {
          errors.push(res.error || "Erreur inconnue");
          if (res.ignoredColumns) (res.ignoredColumns as string[]).forEach((c) => ignoredAll.add(c));
          break;
        }
        setProgress(Math.round(((i + slice.length) / allRows.length) * 100));
        // Yield to the browser so the page stays responsive between batches.
        await new Promise((r) => setTimeout(r, 0));
      }
      const tgt = targetTable && targetTable !== table ? ` → table ${targetTable}` : "";
      const ignoredMsg = ignoredAll.size > 0 ? ` (${ignoredAll.size} colonnes ignorées : ${[...ignoredAll].slice(0, 4).join(", ")}${ignoredAll.size > 4 ? "…" : ""})` : "";
      if (errors.length === 0 && inserted > 0) toast.success(`${inserted} lignes insérées dans ${tableLabel}${tgt}${ignoredMsg}`);
      else if (inserted > 0) toast.warning(`${inserted} insérées, ${errors.length} erreurs${tgt}. ${errors[0] ?? ""}`);
      else toast.error(`Aucune ligne insérée. ${errors[0] ?? ""}`);
      onImported?.();
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Erreur: ${e.message}`);
    }
    setImporting(false); setProgress(0);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !importing) { reset(); onOpenChange(false); } }}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" /> Importer des données — {tableLabel}
          </DialogTitle>
          <DialogDescription>
            {isFlexibleTdbImport
              ? <>Importez votre fichier CSV ou Excel : toutes les colonnes seront conservées dans <code className="bg-muted px-1 rounded text-xs">{table}</code> pour alimenter le TDB.</>
              : <>Importez un fichier CSV ou Excel. Les colonnes seront automatiquement mappées si leurs noms correspondent à ceux de la table <code className="bg-muted px-1 rounded text-xs">{table}</code>.</>}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-2 px-2">
          <div className="space-y-4 py-2">
            {/* File picker */}
            <div className="space-y-2">
              <Label>1. Sélectionnez votre fichier (.csv, .xlsx, .xls)</Label>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls,.txt"
                onChange={handleFile}
                disabled={importing}
                className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer cursor-pointer"
              />
              {file && (
                <div className="flex flex-wrap gap-2 text-sm">
                  <Badge variant="secondary"><FileSpreadsheet className="w-3 h-3 mr-1" />{file.name}</Badge>
                  {data && (
                    <>
                      <Badge variant="outline">{data.rows.length} lignes</Badge>
                      <Badge variant="outline">{data.headers.length} colonnes</Badge>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Année scolaire (examens uniquement) */}
            {isExamImport && file && (
              <div className="space-y-2 rounded-md border border-primary/40 bg-primary/5 p-3">
                <Label htmlFor="annee-scolaire" className="text-sm font-semibold">
                  Année scolaire de l'examen <span className="text-destructive">*</span>
                </Label>
                <Select value={anneeScolaire} onValueChange={setAnneeScolaire} disabled={importing}>
                  <SelectTrigger id="annee-scolaire" className="w-full sm:w-64 bg-background">
                    <SelectValue placeholder="— Choisir l'année —" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 21 }, (_, k) => new Date().getFullYear() + 2 - k).map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Obligatoire. Les données existantes pour cette année dans <code className="bg-muted px-1 rounded">{table}</code> seront <strong>remplacées</strong> par celles du fichier (peu importe le nom du fichier).
                </p>
              </div>
            )}


            {/* Mapping */}
            {data && columns.length > 0 && (
              <div className="space-y-2">
                <Label>2. Vérifiez le mapping (colonne fichier → colonne base)</Label>
                <div className="border rounded-md max-h-64 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-2">Colonne fichier</th>
                        <th className="text-left p-2">→ Colonne base de données</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.headers.map((h) => {
                        const matched = !!mapping[h];
                        return (
                          <tr key={h} className="border-t">
                            <td className="p-2 font-mono">
                              {matched
                                ? <CheckCircle2 className="inline w-3 h-3 text-green-600 mr-1" />
                                : <AlertTriangle className="inline w-3 h-3 text-amber-600 mr-1" />}
                              {h}
                            </td>
                            <td className="p-2">
                              <Select
                                value={mapping[h] || "__none__"}
                                onValueChange={(v) => setMapping((m) => {
                                  const nm = { ...m };
                                  if (v === "__none__") delete nm[h]; else nm[h] = v;
                                  return nm;
                                })}
                              >
                                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">— Ignorer —</SelectItem>
                                  {columns.map((c) => (
                                    <SelectItem key={c.column_name} value={c.column_name}>
                                      {c.column_name} <span className="text-muted-foreground ml-1">({c.data_type.replace("character varying","varchar")})</span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">
                  {Object.values(mapping).filter(Boolean).length} / {data.headers.length} colonnes mappées
                </p>
              </div>
            )}

            {importing && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground text-center">Import en cours… {progress}%</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="pt-2 border-t">
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }} disabled={importing}>
            Annuler
          </Button>
          <Button onClick={handleImport} disabled={!data || importing || (!isFlexibleTdbImport && Object.values(mapping).filter(Boolean).length === 0) || (isExamImport && !anneeScolaire)}>
            {importing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
            Importer {data && `(${data.rows.length} lignes)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuickImportDialog;