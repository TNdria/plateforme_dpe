/**
 * ImportBatchesPanel — Lists CSV import batches (tdb_import_batches) and lets admins:
 *  - Preview the actual rows imported by a batch (Eye button → dialog with paginated table)
 *  - Undo a batch (deletes rows where imported_at falls within batch range)
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { History, RefreshCw, Undo2, Loader2, Eye, ChevronLeft, ChevronRight, Download } from "lucide-react";

const API_BASE = (() => {
  const pid = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  return pid ? `https://${pid}.supabase.co` : import.meta.env.VITE_SUPABASE_URL;
})();
const HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
};
async function call(action: string, body: Record<string, any>) {
  const r = await fetch(`${API_BASE}/functions/v1/db-query?action=${action}`, {
    method: "POST", headers: HEADERS, body: JSON.stringify(body),
  });
  return r.json();
}

interface Batch {
  id: string;
  table_name: string;
  file_name: string | null;
  row_count: number;
  imported_by: string | null;
  status: string;
  batch_ts_start: string;
  batch_ts_end: string;
  created_at: string;
  notes: string | null;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

const PAGE_SIZE = 50;

export default function ImportBatchesPanel({ adminUsername }: { adminUsername: string }) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(false);
  const [reverting, setReverting] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Batch | null>(null);

  // Preview dialog state
  const [preview, setPreview] = useState<Batch | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [previewOffset, setPreviewOffset] = useState(0);

  const load = async () => {
    setLoading(true);
    const r = await call("listImportBatches", { adminUsername });
    if (r.success) setBatches(r.batches || []);
    else toast.error(r.error || "Erreur de chargement");
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const revert = async (b: Batch) => {
    setReverting(b.id);
    const r = await call("deleteImportBatch", { adminUsername, batchId: b.id });
    setReverting(null);
    setConfirm(null);
    if (r.success) {
      toast.success(`Import annulé : ${r.deleted} lignes supprimées de ${r.table}`);
      load();
    } else {
      toast.error(r.error || "Échec de l'annulation");
    }
  };

  const openPreview = async (b: Batch, offset = 0) => {
    setPreview(b);
    setPreviewOffset(offset);
    setPreviewLoading(true);
    const r = await call("getImportBatchRows", {
      adminUsername, batchId: b.id, limit: PAGE_SIZE, offset,
    });
    setPreviewLoading(false);
    if (r.success) {
      setPreviewRows(r.rows || []);
      setPreviewTotal(r.total || 0);
    } else {
      toast.error(r.error || "Erreur de chargement des lignes");
      setPreviewRows([]);
      setPreviewTotal(0);
    }
  };

  const closePreview = () => {
    setPreview(null);
    setPreviewRows([]);
    setPreviewTotal(0);
    setPreviewOffset(0);
  };

  const exportCsv = () => {
    if (!preview || previewRows.length === 0) return;
    const cols = Object.keys(previewRows[0]);
    const escape = (v: any) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [cols.join(","), ...previewRows.map(r => cols.map(c => escape(r[c])).join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${preview.table_name}_batch_${preview.id.slice(0, 8)}_p${previewOffset}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cols = previewRows[0] ? Object.keys(previewRows[0]) : [];
  const totalPages = Math.max(1, Math.ceil(previewTotal / PAGE_SIZE));
  const currentPage = Math.floor(previewOffset / PAGE_SIZE) + 1;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Historique des imports (CSV / Excel)
          </CardTitle>
          <CardDescription>
            Cliquez sur <strong>Voir</strong> pour inspecter les lignes importées,
            ou <strong>Annuler</strong> pour les supprimer.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          <span className="ml-1">Rafraîchir</span>
        </Button>
      </CardHeader>
      <CardContent>
        {batches.length === 0 && !loading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Aucun import enregistré pour le moment.
          </p>
        ) : (
          <div className="border rounded-md overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Fichier</TableHead>
                  <TableHead className="text-right">Lignes</TableHead>
                  <TableHead>Par</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="text-xs whitespace-nowrap">{fmt(b.created_at)}</TableCell>
                    <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{b.table_name}</code></TableCell>
                    <TableCell className="text-xs">{b.file_name || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{b.row_count.toLocaleString("fr-FR")}</TableCell>
                    <TableCell className="text-xs">{b.imported_by || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={b.status === "completed" ? "default" : "secondary"} className="text-[10px]">
                        {b.status === "completed" ? "Actif" : b.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1 whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openPreview(b, 0)}
                      >
                        <Eye className="w-3 h-3" />
                        <span className="ml-1">Voir</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setConfirm(b)}
                        disabled={reverting === b.id}
                      >
                        {reverting === b.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Undo2 className="w-3 h-3" />}
                        <span className="ml-1">Annuler</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Confirmation suppression */}
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler cet import ?</AlertDialogTitle>
            <AlertDialogDescription>
              Toutes les <strong>{confirm?.row_count.toLocaleString("fr-FR")}</strong> lignes
              insérées dans <code>{confirm?.table_name}</code> le {confirm && fmt(confirm.created_at)}
              {" "}seront <strong>définitivement supprimées</strong>. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirm && revert(confirm)}
            >
              Confirmer la suppression
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview dialog */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && closePreview()}>
        <DialogContent className="max-w-[95vw] w-[1400px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              Données importées — <code className="text-sm bg-muted px-1.5 py-0.5 rounded">{preview?.table_name}</code>
            </DialogTitle>
            <DialogDescription>
              {preview?.file_name && <>Fichier <strong>{preview.file_name}</strong> · </>}
              Importé le {preview && fmt(preview.created_at)}
              {preview?.imported_by && <> par <strong>{preview.imported_by}</strong></>}
              {" · "}<strong>{previewTotal.toLocaleString("fr-FR")}</strong> lignes au total
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 border rounded-md">
            {previewLoading ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : previewRows.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                Aucune ligne trouvée pour ce batch (peut-être déjà supprimée).
              </div>
            ) : (
              <div className="h-[60vh] overflow-auto">
                <table className="w-max min-w-full caption-bottom text-sm border-collapse">
                  <thead className="sticky top-0 bg-background z-10 border-b">
                    <tr>
                      {cols.map((c) => (
                        <th key={c} className="h-10 px-3 text-left align-middle font-medium text-muted-foreground text-xs whitespace-nowrap border-b">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="border-b hover:bg-muted/50">
                        {cols.map((c) => {
                          const v = row[c];
                          const display = v === null || v === undefined
                            ? <span className="text-muted-foreground italic">null</span>
                            : typeof v === "number"
                              ? v.toLocaleString("fr-FR")
                              : String(v);
                          return (
                            <td key={c} className="px-3 py-2 align-middle text-xs whitespace-nowrap max-w-[300px] truncate" title={String(v ?? "")}>
                              {display}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <DialogFooter className="flex-row items-center justify-between sm:justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              Page {currentPage} / {totalPages} · Lignes {previewOffset + 1}–{Math.min(previewOffset + PAGE_SIZE, previewTotal)}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={previewRows.length === 0}>
                <Download className="w-3 h-3 mr-1" /> Exporter CSV
              </Button>
              <Button
                variant="outline" size="sm"
                disabled={previewOffset === 0 || previewLoading}
                onClick={() => preview && openPreview(preview, Math.max(0, previewOffset - PAGE_SIZE))}
              >
                <ChevronLeft className="w-3 h-3" /> Préc.
              </Button>
              <Button
                variant="outline" size="sm"
                disabled={previewOffset + PAGE_SIZE >= previewTotal || previewLoading}
                onClick={() => preview && openPreview(preview, previewOffset + PAGE_SIZE)}
              >
                Suiv. <ChevronRight className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="sm" onClick={closePreview}>Fermer</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
