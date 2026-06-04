import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus, Upload, ListChecks, Loader2, Pencil, Trash2,
  Search, ChevronLeft, ChevronRight, RefreshCw, Lock,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import QuickImportDialog from "./QuickImportDialog";

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

interface ColumnInfo { column_name: string; data_type: string; is_nullable?: string; }

interface Props {
  /** Database table name (whitelisted in db-query crudAny) */
  table: string;
  /** Friendly label for headings & toasts */
  tableLabel: string;
  /** Optional: hide actions when not relevant */
  showNew?: boolean;
  showImport?: boolean;
  showManage?: boolean;
  /** Callback fired after a successful insert/update/delete/import */
  onChange?: () => void;
  /** Compact (icon-only) variant */
  compact?: boolean;
}

const PAGE_SIZE = 25;

/**
 * Toolbar with three buttons: Nouveau / Importer / Gérer la liste.
 * Reserved to admin users (is_superuser or is_staff). Renders nothing otherwise.
 */
const DataActionsBar = ({
  table, tableLabel,
  showNew = true, showImport = true, showManage = true,
  onChange, compact = false,
}: Props) => {
  const { user } = useAuth();
  const isAdmin = !!user?.is_superuser || !!user?.is_staff;
  const adminUsername = user?.username || "";

  const [openNew, setOpenNew] = useState(false);
  const [openImport, setOpenImport] = useState(false);
  const [openManage, setOpenManage] = useState(false);

  // CRUD buttons are now centralized on the Admin page only.
  // This bar is intentionally hidden everywhere else.
  return null;

  // eslint-disable-next-line no-unreachable
  if (!isAdmin) return null;
  // eslint-disable-next-line no-unreachable
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {showNew && (
        <Button size={compact ? "sm" : "default"} onClick={() => setOpenNew(true)} className="gap-1.5">
          <Plus className="w-4 h-4" />
          {!compact && "Nouveau"}
        </Button>
      )}
      {showImport && (
        <Button size={compact ? "sm" : "default"} variant="outline" onClick={() => setOpenImport(true)} className="gap-1.5">
          <Upload className="w-4 h-4" />
          {!compact && "Importer"}
        </Button>
      )}
      {showManage && (
        <Button size={compact ? "sm" : "default"} variant="outline" onClick={() => setOpenManage(true)} className="gap-1.5">
          <ListChecks className="w-4 h-4" />
          {!compact && "Gérer la liste"}
        </Button>
      )}

      {/* Modals */}
      {openNew && (
        <NewRowDialog
          open={openNew}
          onOpenChange={setOpenNew}
          table={table}
          tableLabel={tableLabel}
          adminUsername={adminUsername}
          onSaved={() => { setOpenNew(false); onChange?.(); }}
        />
      )}
      {openImport && (
        <QuickImportDialog
          open={openImport}
          onOpenChange={setOpenImport}
          table={table}
          tableLabel={tableLabel}
          adminUsername={adminUsername}
          onImported={onChange}
        />
      )}
      {openManage && (
        <ManageDialog
          open={openManage}
          onOpenChange={setOpenManage}
          table={table}
          tableLabel={tableLabel}
          adminUsername={adminUsername}
          onChange={onChange}
        />
      )}
    </div>
  );
};

/* ───────────────────────── Sub-component: Quick "Nouveau" form ───────────────────────── */

interface NewRowProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  table: string;
  tableLabel: string;
  adminUsername: string;
  onSaved: () => void;
  initialRow?: Record<string, any>;
}

const renderInput = (
  c: ColumnInfo,
  value: any,
  onChange: (v: any) => void,
  disabled: boolean,
) => {
  const isNumeric = /int|numeric|double|real|bigint/i.test(c.data_type);
  const isBool = /bool/i.test(c.data_type);
  const isDate = /date|timestamp/i.test(c.data_type);
  const isLong = /text/i.test(c.data_type) && !/character varying/i.test(c.data_type);

  if (isBool) {
    const sv = value === true || value === "true" ? "true"
      : value === false || value === "false" ? "false" : "";
    return (
      <Select value={sv} onValueChange={(v) => onChange(v === "true")} disabled={disabled}>
        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="true">Oui</SelectItem>
          <SelectItem value="false">Non</SelectItem>
        </SelectContent>
      </Select>
    );
  }
  if (isLong) {
    return (
      <textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={3}
        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      />
    );
  }
  return (
    <Input
      type={isNumeric ? "number" : isDate ? "datetime-local" : "text"}
      step={isNumeric ? "any" : undefined}
      value={value === null || value === undefined ? "" : String(value)}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    />
  );
};

const NewRowDialog = ({ open, onOpenChange, table, tableLabel, adminUsername, onSaved, initialRow }: NewRowProps) => {
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [pk, setPk] = useState("id");
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isEdit = !!initialRow;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Use crudAny list with limit 0 to get pk + columns metadata cheaply
      const res = await call("crudAny", { adminUsername, op: "list", table, limit: 1, offset: 0 });
      if (cancelled) return;
      if (res.success) {
        setColumns(res.columns || []);
        setPk(res.pk || "id");
        const empty: Record<string, any> = {};
        (res.columns || []).forEach((c: ColumnInfo) => {
          if (initialRow) empty[c.column_name] = initialRow[c.column_name] ?? "";
          else if (c.column_name !== (res.pk || "id")) empty[c.column_name] = "";
        });
        setFormData(empty);
      } else {
        toast.error(res.error || "Impossible de charger la structure de la table");
        onOpenChange(false);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [adminUsername, table, initialRow, onOpenChange]);

  const handleSave = async () => {
    setSaving(true);
    const cleanData: Record<string, any> = {};
    Object.entries(formData).forEach(([k, v]) => {
      if (v === "" || v === null) cleanData[k] = null;
      else cleanData[k] = v;
    });
    const res = await call("crudAny", {
      adminUsername,
      op: isEdit ? "update" : "insert",
      table,
      data: cleanData,
      ...(isEdit && initialRow ? { id: initialRow[pk] } : {}),
    });
    if (res.success) {
      toast.success(isEdit ? "Ligne mise à jour" : "Ligne créée");
      onSaved();
    } else {
      toast.error(res.error || "Erreur");
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier" : "Nouvelle ligne"} — {tableLabel}</DialogTitle>
          <DialogDescription>
            Champs de la table <code className="bg-muted px-1 rounded text-xs">{table}</code>.
            PK <code className="bg-muted px-1 rounded text-xs">{pk}</code>{isEdit && " non modifiable"}.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 -mx-2 px-2">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2">
              {columns.map((c) => {
                const disabled = isEdit && c.column_name === pk;
                return (
                  <div key={c.column_name} className="space-y-1">
                    <Label className="text-xs flex items-center gap-1">
                      {c.column_name}
                      <span className="text-[10px] text-muted-foreground">({c.data_type.replace("character varying", "varchar")})</span>
                      {c.is_nullable === "NO" && <span className="text-destructive text-[10px]">*</span>}
                    </Label>
                    {renderInput(c, formData[c.column_name],
                      (v) => setFormData((p) => ({ ...p, [c.column_name]: v })),
                      disabled)}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
        <DialogFooter className="pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            {isEdit ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ───────────────────────── Sub-component: "Gérer la liste" CRUD ───────────────────────── */

interface ManageProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  table: string;
  tableLabel: string;
  adminUsername: string;
  onChange?: () => void;
}

const ManageDialog = ({ open, onOpenChange, table, tableLabel, adminUsername, onChange }: ManageProps) => {
  const [rows, setRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [pk, setPk] = useState("id");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<any | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await call("crudAny", {
      adminUsername, op: "list", table, search,
      limit: PAGE_SIZE, offset: page * PAGE_SIZE,
    });
    if (res.success) {
      setRows(res.data || []);
      setTotal(res.total || 0);
      setColumns(res.columns || []);
      setPk(res.pk || "id");
    } else toast.error(res.error || "Erreur");
    setLoading(false);
  }, [adminUsername, table, search, page]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const visibleCols = useMemo(() => columns.slice(0, 6), [columns]);

  const handleDelete = async () => {
    if (!deleting) return;
    const res = await call("crudAny", { adminUsername, op: "delete", table, id: deleting[pk] });
    if (res.success) {
      toast.success("Ligne supprimée");
      setDeleting(null);
      load();
      onChange?.();
    } else toast.error(res.error || "Erreur");
  };

  return (
    <>
      <Dialog open={open && !creating && !editing} onOpenChange={(o) => !o && onOpenChange(false)}>
        <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-primary" /> Gérer — {tableLabel}
            </DialogTitle>
            <DialogDescription>
              Liste paginée. Recherchez, créez, modifiez ou supprimez les lignes de <code className="bg-muted px-1 rounded text-xs">{table}</code>.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2 pb-2 border-b">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher (texte)…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { setPage(0); setSearch(searchInput); } }}
                className="pl-9 h-9"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => { setPage(0); setSearch(searchInput); }}>
              Rechercher
            </Button>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
            <div className="ml-auto flex gap-2">
              <Badge variant="secondary">{total.toLocaleString("fr-FR")} lignes</Badge>
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="w-4 h-4 mr-1" /> Nouvelle ligne
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  {visibleCols.map((c) => (
                    <TableHead key={c.column_name} className="text-xs whitespace-nowrap">
                      {c.column_name}
                    </TableHead>
                  ))}
                  <TableHead className="text-right text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={visibleCols.length + 1} className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  </TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={visibleCols.length + 1} className="text-center py-8 text-muted-foreground">
                    Aucune donnée
                  </TableCell></TableRow>
                ) : rows.map((r, idx) => (
                  <TableRow key={r[pk] ?? idx}>
                    {visibleCols.map((c) => (
                      <TableCell key={c.column_name} className="text-xs max-w-[200px] truncate">
                        {r[c.column_name] === null || r[c.column_name] === undefined
                          ? <span className="text-muted-foreground italic">null</span>
                          : typeof r[c.column_name] === "number"
                            ? Number(r[c.column_name]).toLocaleString("fr-FR")
                            : String(r[c.column_name])}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(r)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleting(r)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="pt-2 border-t flex-row sm:justify-between items-center gap-2">
            <div className="text-xs text-muted-foreground">
              Page {page + 1} / {totalPages} · {rows.length} sur {total.toLocaleString("fr-FR")}
            </div>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1 || loading} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Fermer</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create dialog */}
      {creating && (
        <NewRowDialog
          open={creating}
          onOpenChange={setCreating}
          table={table}
          tableLabel={tableLabel}
          adminUsername={adminUsername}
          onSaved={() => { setCreating(false); load(); onChange?.(); }}
        />
      )}

      {/* Edit dialog */}
      {editing && (
        <NewRowDialog
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          table={table}
          tableLabel={tableLabel}
          adminUsername={adminUsername}
          initialRow={editing}
          onSaved={() => { setEditing(null); load(); onChange?.(); }}
        />
      )}

      {/* Delete confirm */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Supprimer la ligne <code className="bg-muted px-1 rounded text-xs">{pk} = {deleting?.[pk]}</code> de <strong>{tableLabel}</strong> ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDelete}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DataActionsBar;