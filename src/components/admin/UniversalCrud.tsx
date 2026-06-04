import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Loader2, Plus, Pencil, Trash2, RefreshCw, Search,
  ChevronLeft, ChevronRight, Database, Download, AlertTriangle,
} from "lucide-react";

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
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });
  return r.json();
}

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? value : []);

const formatError = (value: unknown, fallback = "Réponse invalide du serveur") => {
  if (!value) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "message" in value) return String((value as { message?: unknown }).message || fallback);
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
};

// Tables groupées par domaine — exposées dans le picker
export const CRUD_TABLES: { group: string; tables: { name: string; label: string; description: string }[] }[] = [
  {
    group: "Tableaux de Bord",
    tables: [
      { name: "tdb_mada", label: "TDB Madagascar", description: "Indicateurs nationaux agrégés" },
      { name: "tdb_dren", label: "TDB DREN", description: "Indicateurs par région (23)" },
      { name: "tdb_cisco", label: "TDB CISCO", description: "Indicateurs par circonscription" },
      { name: "tdb_zap", label: "TDB ZAP", description: "Indicateurs par ZAP" },
      { name: "tdb_ecole", label: "TDB École", description: "Indicateurs par établissement" },
    ],
  },
  {
    group: "Données FPE (annuelles)",
    tables: [
      { name: "fpe_a1", label: "Établissements (A1)", description: "Identification des écoles" },
      { name: "fpe_e1", label: "Élèves (E1)", description: "Effectifs par classe et genre" },
      { name: "fpe_e4", label: "Examens (E4)", description: "Résultats CEPE / BEPC / BACC" },
      { name: "fpe_p1", label: "Personnel (P1)", description: "Enseignants & administratifs" },
      { name: "fpe_d1", label: "Bâtiments (D1)", description: "Salles & infrastructure" },
      { name: "fpe_f1", label: "Mobilier (F1)", description: "Tables-bancs, bureaux" },
      { name: "fpe_g1", label: "Manuels (G1)", description: "Livres scolaires" },
      { name: "fpe_h1", label: "Latrines (H1)", description: "Sanitaires" },
      { name: "fpe_j1", label: "Cantine (J1)", description: "Restauration" },
      { name: "fpe_j2", label: "Cantine détail (J2)", description: "Repas servis" },
      { name: "fpe_k1", label: "Eau (K1)", description: "Accès à l'eau potable" },
      { name: "fpe_l1", label: "Énergie (L1)", description: "Électricité / panneaux" },
    ],
  },
  {
    group: "Besoins en infrastructure",
    tables: [
      { name: "besoins_primaire", label: "Besoins Primaire", description: "Requis vs disponible" },
      { name: "besoins_college", label: "Besoins Collège", description: "Requis vs disponible" },
      { name: "besoins_lycee", label: "Besoins Lycée", description: "Requis vs disponible" },
    ],
  },
  {
    group: "SIG / Géolocalisation",
    tables: [
      { name: "sig_etablissement", label: "SIG Établissements", description: "Coordonnées GPS écoles" },
      { name: "sig_village", label: "SIG Villages", description: "Coordonnées GPS villages" },
    ],
  },
  {
    group: "Population & autres",
    tables: [
      { name: "population", label: "Population", description: "Données population générale" },
      { name: "population_2025", label: "Population 2025", description: "Projections 2025" },
      { name: "caisse_ecole", label: "Caisse École", description: "Données financières" },
      { name: "cepe", label: "CEPE", description: "Examen CEPE" },
    ],
  },
];

interface ColumnInfo { column_name: string; data_type: string; is_nullable?: string; }

interface Props { adminUsername: string; }

const PAGE_SIZE = 25;

const UniversalCrud = ({ adminUsername }: Props) => {
  const [table, setTable] = useState<string>("tdb_dren");
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [pk, setPk] = useState<string>("id");
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [deleting, setDeleting] = useState<any | null>(null);
  const [truncating, setTruncating] = useState(false);
  const [saving, setSaving] = useState(false);

  const tableLabel = useMemo(() => {
    for (const g of CRUD_TABLES) {
      const t = g.tables.find((x) => x.name === table);
      if (t) return t.label;
    }
    return table;
  }, [table]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await call("crudAny", {
        adminUsername,
        op: "list",
        table,
        search,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      if (res.success) {
        setRows(asArray<any>(res.data));
        setTotal(Number(res.total) || 0);
        setColumns(asArray<ColumnInfo>(res.columns));
        setPk(res.pk || "id");
      } else {
        setRows([]);
        setTotal(0);
        setColumns([]);
        toast.error(formatError(res.error, "Erreur de chargement"));
      }
    } catch (error) {
      setRows([]);
      setTotal(0);
      setColumns([]);
      toast.error(formatError(error, "Erreur de chargement"));
    }
    setLoading(false);
  }, [adminUsername, table, search, page]);

  useEffect(() => { setPage(0); setSearch(""); setSearchInput(""); }, [table]);
  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const openCreate = () => {
    const empty: Record<string, any> = {};
    columns.forEach((c) => { if (c.column_name !== pk) empty[c.column_name] = ""; });
    setFormData(empty);
    setCreating(true);
  };

  const openEdit = (row: any) => {
    setEditing(row);
    const data: Record<string, any> = {};
    columns.forEach((c) => { data[c.column_name] = row[c.column_name] ?? ""; });
    setFormData(data);
  };

  const handleSave = async () => {
    setSaving(true);
    const op = creating ? "insert" : "update";
    const cleanData: Record<string, any> = {};
    Object.entries(formData).forEach(([k, v]) => {
      if (v === "" || v === null) cleanData[k] = null;
      else cleanData[k] = v;
    });
    const res = await call("crudAny", {
      adminUsername,
      op,
      table,
      data: cleanData,
      ...(editing ? { id: editing[pk] } : {}),
    });
    if (res.success) {
      toast.success(creating ? "Ligne créée" : "Ligne mise à jour");
      setCreating(false); setEditing(null); setFormData({});
      load();
    } else toast.error(res.error || "Erreur");
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const res = await call("crudAny", { adminUsername, op: "delete", table, id: deleting[pk] });
    if (res.success) { toast.success("Ligne supprimée"); setDeleting(null); load(); }
    else toast.error(res.error || "Erreur");
  };

  const handleTruncate = async () => {
    const res = await call("crudAny", { adminUsername, op: "truncate", table });
    if (res.success) { toast.success(`Table ${table} vidée`); setTruncating(false); load(); }
    else toast.error(res.error || "Erreur");
  };

  const exportCsv = () => {
    if (rows.length === 0) { toast.warning("Aucune donnée à exporter"); return; }
    const cols = columns.map((c) => c.column_name);
    const lines = [cols.join(";")];
    rows.forEach((r) => {
      lines.push(cols.map((c) => {
        const v = r[c];
        if (v === null || v === undefined) return "";
        const s = String(v).replace(/"/g, '""');
        return /[;"\n]/.test(s) ? `"${s}"` : s;
      }).join(";"));
    });
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${table}_page${page + 1}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Export CSV téléchargé");
  };

  // Columns to show in table (cap to 8 for readability)
  const visibleCols = useMemo(() => columns.slice(0, 8), [columns]);

  const renderField = (col: ColumnInfo) => {
    const isNumeric = /int|numeric|double|real|bigint/i.test(col.data_type);
    const isBool = /bool/i.test(col.data_type);
    const isDate = /date|timestamp/i.test(col.data_type);
    const isLong = /text/i.test(col.data_type) && !/character varying/i.test(col.data_type);
    const value = formData[col.column_name] ?? "";
    const disabled = creating ? false : col.column_name === pk;

    if (isBool) {
      return (
        <Select
          value={value === true || value === "true" ? "true" : value === false || value === "false" ? "false" : ""}
          onValueChange={(v) => setFormData((p) => ({ ...p, [col.column_name]: v === "true" }))}
          disabled={disabled}
        >
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
          value={value}
          onChange={(e) => setFormData((p) => ({ ...p, [col.column_name]: e.target.value }))}
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
        value={value === null ? "" : String(value)}
        onChange={(e) => setFormData((p) => ({ ...p, [col.column_name]: e.target.value }))}
        disabled={disabled}
      />
    );
  };

  return (
    <div className="space-y-4">
      {/* Picker + actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="w-4 h-4" />
            CRUD Universel — {tableLabel}
          </CardTitle>
          <CardDescription>
            Lecture / création / modification / suppression sur toutes les tables autorisées.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-sm font-semibold">Table:</Label>
            <Select value={table} onValueChange={setTable}>
              <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-96">
                {CRUD_TABLES.map((g) => (
                  <div key={g.group}>
                    <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{g.group}</div>
                    {g.tables.map((t) => (
                      <SelectItem key={t.name} value={t.name}>
                        <span className="font-medium">{t.label}</span>
                        <span className="text-muted-foreground ml-2 text-xs">({t.name})</span>
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>

            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher (texte)…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { setPage(0); setSearch(searchInput); } }}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => { setPage(0); setSearch(searchInput); }}>
              Rechercher
            </Button>

            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                Actualiser
              </Button>
              <Button variant="outline" size="sm" onClick={exportCsv}>
                <Download className="w-4 h-4 mr-1" /> Export CSV
              </Button>
              <Button size="sm" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-1" /> Nouvelle ligne
              </Button>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setTruncating(true)}>
                <Trash2 className="w-4 h-4 mr-1" /> Vider
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Badge variant="secondary">{total.toLocaleString("fr-FR")} lignes au total</Badge>
            <Badge variant="outline">{columns.length} colonnes</Badge>
            <Badge variant="outline">PK: {pk}</Badge>
            {search && <Badge variant="outline">🔎 “{search}”</Badge>}
          </div>
        </CardContent>
      </Card>

      {/* Data table */}
      <Card>
        <div className="overflow-auto max-h-[calc(100vh-380px)]">
          <Table>
            <TableHeader>
              <TableRow>
                {visibleCols.map((c) => (
                  <TableHead key={c.column_name} className="text-xs whitespace-nowrap">
                    {c.column_name}
                    <span className="ml-1 text-[10px] text-muted-foreground">({c.data_type.replace("character varying", "varchar")})</span>
                  </TableHead>
                ))}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={visibleCols.length + 1} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={visibleCols.length + 1} className="text-center py-8 text-muted-foreground">Aucune donnée</TableCell></TableRow>
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
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}>
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

        {/* Pagination */}
        <div className="flex items-center justify-between p-3 border-t">
          <div className="text-xs text-muted-foreground">
            Page {page + 1} / {totalPages} · Affichage {rows.length} sur {total.toLocaleString("fr-FR")} lignes
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1 || loading} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={creating || !!editing} onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{creating ? "Nouvelle ligne" : "Modifier la ligne"} — {tableLabel}</DialogTitle>
            <DialogDescription>
              Tous les champs sont optionnels sauf indiqué. PK <code className="text-xs bg-muted px-1 rounded">{pk}</code>{!creating && " non modifiable"}.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 -mx-2 px-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2">
              {columns.map((c) => (
                <div key={c.column_name} className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    {c.column_name}
                    <span className="text-[10px] text-muted-foreground">({c.data_type.replace("character varying", "varchar")})</span>
                    {c.is_nullable === "NO" && <span className="text-destructive text-[10px]">*</span>}
                  </Label>
                  {renderField(c)}
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter className="pt-2 border-t">
            <Button variant="outline" onClick={() => { setCreating(false); setEditing(null); }}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {creating ? "Créer" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-destructive" /> Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Supprimer la ligne <code className="bg-muted px-1 rounded">{pk} = {deleting?.[pk]}</code> de <strong>{table}</strong> ?<br/>Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDelete}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Truncate confirmation */}
      <Dialog open={truncating} onOpenChange={setTruncating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-destructive" /> Vider la table</DialogTitle>
            <DialogDescription>
              Vous êtes sur le point de supprimer <strong>toutes les lignes</strong> de <code className="bg-muted px-1 rounded">{table}</code> ({total.toLocaleString("fr-FR")} lignes). Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTruncating(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleTruncate}>Vider définitivement</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UniversalCrud;