import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Shield,
  Users,
  Database,
  Upload,
  FileSpreadsheet,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Search,
  Download,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  HardDriveUpload,
  History,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Navigate } from "react-router-dom";
import UniversalCrud from "@/components/admin/UniversalCrud";
import ImportBatchesPanel from "@/components/admin/ImportBatchesPanel";

const API_BASE = (() => {
  const pid = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  return pid ? `https://${pid}.supabase.co` : import.meta.env.VITE_SUPABASE_URL;
})();
const HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
};

async function adminFetch(action: string, body: Record<string, any>) {
  const res = await fetch(`${API_BASE}/functions/v1/db-query?action=${action}`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });
  return res.json();
}

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? value : []);

const formatAdminError = (value: unknown, fallback = "Réponse invalide du serveur") => {
  if (!value) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "message" in value) return String((value as { message?: unknown }).message || fallback);
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
};

<<<<<<< HEAD
=======
// ─── Django API Helpers ─────────────────────
const DJANGO_BASE_URL = 'https://dpe-men.mg';

async function djangoGet<T = any>(path: string): Promise<T> {
  const res = await fetch(`${DJANGO_BASE_URL}${path}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Django GET ${path} → ${res.status} - ${text}`);
  }
  return res.json();
}

async function djangoPost<T = any>(
  path: string,
  data: Record<string, any>
): Promise<T> {
  const res = await fetch(`${DJANGO_BASE_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Django POST ${path} → ${res.status} - ${text}`);
  }

  return res.json();
}

>>>>>>> f4c6f350 (Refonte du SIG : amélioration des déplacements, des API et de l'interface)
// ─── Mapping fichier CSV → table TDB (clés explicites pour l'utilisateur) ───
const EXAMEN_CEPE_COLUMNS = [
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

const EXAMEN_BEPC_COLUMNS = [
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

// Normalisation accents/espaces/tirets pour auto-mapping
const normHeader = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[\s\-_]+/g, "");

const BEPC_ALIASES: Record<string, string> = {
  dren: "DREN",
  cisco: "CISCO",
  matricule: "MATRICULE",
  codeetablissement: "CODE_ETAB",
  codeetab: "CODE_ETAB",
  codeecole: "CODE_ETAB",
  ecoledorigine: "ECOLE_ORIGINE",
  ecoleorigine: "ECOLE_ORIGINE",
  codecentre: "CODE_CENTRE",
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
  bepc: "BEPC",
  anneescolaire: "ANNEE_SCOLAIRE",
  annee: "ANNEE_SCOLAIRE",
};

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
  ecoledorigine: "ECOLE_ORIGINE",
  ecoleorigine: "ECOLE_ORIGINE",
  etablissementorigine: "ECOLE_ORIGINE",
  sexe: "GENRE",
  genre: "GENRE",
  op: "OP",
  operation: "OP",
  probleme: "PROBLEME",
  problemes: "PROBLEME",
  svt: "SVT",
  tfm: "TFM",
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
  cepe: "CEPE",
};

const IMPORT_TARGETS = [
  {
    table: "examen_cepe_candidates",
    label: "EXAMEN_CEPE_*.xlsx",
    description: "Résultats CEPE par candidat (notes par matière, genre, admis)",
    expectedHeaders: ["CODE_ETAB", "GENRE", "MOYENNE"],
    color: "bg-indigo-500/10 text-indigo-700 border-indigo-300",
  },
  {
    table: "examen_bepc_candidates",
    label: "anonymat_BEPC_*.xlsx",
    description: "Résultats BEPC par candidat (année à définir à l'import)",
    expectedHeaders: ["MATRICULE", "MALAGASY", "MATHEMATIQUE"],
    color: "bg-fuchsia-500/10 text-fuchsia-700 border-fuchsia-300",
  },
  {
    table: "tdb_mada",
    label: "df_mada.csv",
    description: "Données nationales agrégées (1 ligne)",
    expectedHeaders: ["code_mada", "txAbdGlobal", "tx_admis"],
    color: "bg-purple-500/10 text-purple-700 border-purple-300",
  },
  {
    table: "tdb_dren",
    label: "df_dren.csv",
    description: "Une ligne par DREN (23 régions)",
    expectedHeaders: ["CODE_DREN", "DREN", "txAbdGlobal"],
    color: "bg-blue-500/10 text-blue-700 border-blue-300",
  },
  {
    table: "tdb_cisco",
    label: "df_cisco.csv",
    description: "Une ligne par CISCO (114 circonscriptions)",
    expectedHeaders: ["CODE_CISCO", "CISCO", "CODE_DREN"],
    color: "bg-emerald-500/10 text-emerald-700 border-emerald-300",
  },
  {
    table: "tdb_zap",
    label: "df_zap.csv",
    description: "Une ligne par ZAP (~1700 zones)",
    expectedHeaders: ["CODE_ZAP", "ZAP", "CODE_CISCO"],
    color: "bg-amber-500/10 text-amber-700 border-amber-300",
  },
  {
    table: "tdb_ecole",
    label: "df_ecole.csv ou df_tdbecoles.csv",
    description: "Une ligne par établissement (~25 000 écoles)",
    expectedHeaders: ["CODE_ETAB", "NOM_ETAB", "CODE_ZAP"],
    color: "bg-rose-500/10 text-rose-700 border-rose-300",
  },
] as const;


interface DBUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  dren: number;
  cisco: number;
  date_joined: string;
  last_login: string | null;
}

type ImportWorkerResponse = {
  ok: boolean;
  error?: string;
  headers?: string[];
  rowCount?: number;
  previewRows?: any[][];
  rows?: any[][];
};

const Admin = () => {
  const { user } = useAuth();
  const isAdmin = user?.is_superuser === true;

  // ─── Users ───
  const [users, setUsers] = useState<DBUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editUser, setEditUser] = useState<DBUser | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showDelete, setShowDelete] = useState<DBUser | null>(null);
  const emptyForm = {
    username: "",
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    is_active: true,
    is_staff: false,
    is_superuser: false,
    dren: "0",
    cisco: "0",
  };
  const [formData, setFormData] = useState(emptyForm);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    is_active: true,
    is_staff: false,
    is_superuser: false,
    dren: "0",
    cisco: "0",
    newPassword: "",
  });

  // ─── Imports ───
  const [importTarget, setImportTarget] = useState<typeof IMPORT_TARGETS[number] | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<{ headers: string[]; rows: any[][] } | null>(null);
  const [importRowCount, setImportRowCount] = useState(0);
  const [workerBackedImport, setWorkerBackedImport] = useState(false);
  const [parsingFile, setParsingFile] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [tableColumns, setTableColumns] = useState<{ column_name: string; data_type: string }[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [showTruncate, setShowTruncate] = useState<typeof IMPORT_TARGETS[number] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importWorkerRef = useRef<Worker | null>(null);
  const workerResolversRef = useRef(new Map<number, (value: ImportWorkerResponse) => void>());
  const workerMessageIdRef = useRef(0);
  const isCepeImport = importTarget?.table === "examen_cepe_candidates";
  const isBepcImport = importTarget?.table === "examen_bepc_candidates";
  const isExamenImport = isCepeImport || isBepcImport;
  const [importYear, setImportYear] = useState<string>(String(new Date().getFullYear()));
  const importCanReachStep3 = !!importData;
  const displayedImportRowCount = workerBackedImport ? importRowCount : (importData?.rows.length ?? 0);
  const effectiveTableColumns = useMemo(() => {
    if (isCepeImport) {
      return EXAMEN_CEPE_COLUMNS.map((column_name) => ({
        column_name,
        data_type: ["ANNEE_SCOLAIRE", "CODE_ETAB"].includes(column_name) ? "integer" : ["DREN", "CISCO", "OPTION", "CODE_CENTRE", "ECOLE_ORIGINE", "GENRE", "CEPE"].includes(column_name) ? "text" : "numeric",
      }));
    }
    if (isBepcImport) {
      return EXAMEN_BEPC_COLUMNS.map((column_name) => ({
        column_name,
        data_type: ["ANNEE_SCOLAIRE", "CODE_ETAB"].includes(column_name) ? "integer"
          : ["GENRE", "OPTION", "BEPC", "MATRICULE", "ECOLE_ORIGINE", "CODE_CENTRE", "DREN", "CISCO"].includes(column_name) ? "text"
          : "numeric",
      }));
    }
    return tableColumns;
  }, [isCepeImport, isBepcImport, tableColumns]);


  useEffect(() => {
    const worker = new Worker(new URL("../workers/excelImport.worker.ts", import.meta.url), { type: "module" });
    importWorkerRef.current = worker;
    worker.onmessage = (event: MessageEvent<ImportWorkerResponse & { id?: number }>) => {
      const id = event.data?.id;
      if (typeof id !== "number") return;
      const resolve = workerResolversRef.current.get(id);
      if (!resolve) return;
      workerResolversRef.current.delete(id);
      resolve(event.data);
    };

    return () => {
      workerResolversRef.current.clear();
      worker.terminate();
      importWorkerRef.current = null;
    };
  }, []);

  const callImportWorker = useCallback((payload: Record<string, any>, transfer?: Transferable[]) => {
    const worker = importWorkerRef.current;
    if (!worker) return Promise.reject(new Error("Worker d'import indisponible"));

    const id = ++workerMessageIdRef.current;
    return new Promise<ImportWorkerResponse>((resolve) => {
      workerResolversRef.current.set(id, resolve);
      worker.postMessage({ id, ...payload }, transfer ?? []);
    });
  }, []);

  // ─── CRUD TDB ───
  const [crudTable, setCrudTable] = useState<string>("tdb_dren");
  const [crudRows, setCrudRows] = useState<any[]>([]);
  const [crudLoading, setCrudLoading] = useState(false);
  const [crudCounts, setCrudCounts] = useState<Record<string, number>>({});
  const [editRow, setEditRow] = useState<any>(null);
  const [deleteRow, setDeleteRow] = useState<any>(null);

  // ============ Load Users ============
  const loadUsers = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingUsers(true);
    try {
      const res = await adminFetch("listUsers", { adminUsername: user?.username });
      if (res.success) setUsers(asArray<DBUser>(res.users));
      else {
        setUsers([]);
        toast.error(formatAdminError(res.error, "Erreur de chargement des utilisateurs"));
      }
    } catch {
      setUsers([]);
      toast.error("Erreur de chargement");
    }
    setLoadingUsers(false);
  }, [isAdmin, user?.username]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleCreate = async () => {
    if (!formData.username || formData.username.length < 3) {
      toast.error("Identifiant requis (min 3 car.)");
      return;
    }
    if (!formData.password || formData.password.length < 4) {
      toast.error("Mot de passe requis (min 4 car.)");
      return;
    }
    const res = await adminFetch("createUser", { adminUsername: user?.username, ...formData });
    if (res.success) {
      toast.success(`Utilisateur ${formData.username} créé`);
      setShowCreate(false);
      setFormData(emptyForm);
      loadUsers();
    } else toast.error(res.error);
  };

  const handleUpdate = async () => {
    if (!editUser) return;
    const res = await adminFetch("updateUser", {
      adminUsername: user?.username,
      userId: editUser.id,
      ...editForm,
      newPassword: editForm.newPassword || undefined,
    });
    if (res.success) {
      toast.success("Utilisateur mis à jour");
      setEditUser(null);
      loadUsers();
    } else toast.error(res.error);
  };

  const handleDelete = async () => {
    if (!showDelete) return;
    const res = await adminFetch("deleteUser", {
      adminUsername: user?.username,
      userId: showDelete.id,
    });
    if (res.success) {
      toast.success("Utilisateur supprimé");
      setShowDelete(null);
      loadUsers();
    } else toast.error(res.error);
  };

  const openEdit = (u: DBUser) => {
    setEditUser(u);
    setEditForm({
      first_name: u.first_name,
      last_name: u.last_name,
      email: u.email,
      is_active: u.is_active,
      is_staff: u.is_staff,
      is_superuser: u.is_superuser,
      dren: String(u.dren || 0),
      cisco: String(u.cisco || 0),
      newPassword: "",
    });
  };

  // ============ Import file parsing ============
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportData(null);
    setImportRowCount(0);
    setWorkerBackedImport(false);
    setColumnMapping({});
    setParsingFile(true);

    const fname = file.name.toLowerCase();
    let headers: string[] = [];
    let rows: any[][] = [];
    let totalRows = 0;

    try {
      if (fname.endsWith(".csv") || fname.endsWith(".txt")) {
        const text = await file.text();
        const clean = text.replace(/^\uFEFF/, "");
        const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          toast.error("Fichier CSV vide");
          return;
        }
        const sep = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";
        const parseLine = (line: string): string[] => {
          const out: string[] = [];
          let cur = "",
            inQ = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"' && line[i + 1] === '"') {
              cur += '"';
              i++;
            } else if (ch === '"') inQ = !inQ;
            else if (ch === sep && !inQ) {
              out.push(cur);
              cur = "";
            } else cur += ch;
          }
          out.push(cur);
          return out;
        };
        headers = parseLine(lines[0]).map((h) => h.trim());
        rows = lines.slice(1).map(parseLine);
        totalRows = rows.length;
      } else {
        toast.info("Lecture du fichier Excel… cela peut prendre 30–60 s pour les gros fichiers.");
        await new Promise((r) => setTimeout(r, 30));
        let parsedOk = false;
        try {
          const buf = await file.arrayBuffer();
          // Try worker first (keeps UI responsive on huge files).
          const parsed = await callImportWorker({ type: "parse", buffer: buf.slice(0) }, [buf.slice(0)] as any).catch(() => null as any);
          if (parsed && parsed.ok && parsed.headers && parsed.rowCount !== undefined) {
            headers = parsed.headers;
            rows = parsed.previewRows || [];
            setImportRowCount(parsed.rowCount);
            setWorkerBackedImport(true);
            totalRows = parsed.rowCount;
            parsedOk = true;
          } else {
            // Fallback: parse inline on the main thread.
            const XLSX = await import("xlsx");
            const wb = XLSX.read(buf, { type: "array" });
            const norm = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
            const known = new Set(["anneescolaire","annee","dren","cisco","codeetab","codeetablissement","codecentre","ecoleorigine","ecoledorigine","sexe","genre","option","op","operation","probleme","svt","tfm","malagasy","mlg","francais","frs","anglais","mathematique","mathematiques","physique","bonus","histogeo","histoiregeographie","geographie","total","moyenne","resultat","decision","statut","cepe","bepc"]);
            const score = (row: any[]) => row.filter((cell) => known.has(norm(cell))).length * 3 + row.filter((cell) => cell !== null && cell !== undefined && String(cell).trim() !== "").length;
            const extracted = wb.SheetNames.map((name) => {
              const ws = wb.Sheets[name];
              const all: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: null });
              const filtered = all.filter((r: any[]) => Array.isArray(r) && r.some((c: any) => c !== null && c !== undefined && c !== ""));
              if (filtered.length < 2) return null;
              let idx = 0, best = -1;
              filtered.slice(0, 40).forEach((row, i) => { const s = score(row); if (s > best) { best = s; idx = i; } });
              return filtered.slice(best >= 4 ? idx : 0);
            }).find(Boolean) as any[][] | undefined;
            const json = extracted || [];
            if (json.length < 2) { toast.error("Fichier Excel vide"); return; }
            headers = (json[0] as any[]).map((h: any) => String(h ?? "").trim());
            rows = json.slice(1).filter((r: any[]) => Array.isArray(r) && r.some((c: any) => c !== null && c !== undefined && c !== ""));
            totalRows = rows.length;
            setWorkerBackedImport(false);
            parsedOk = true;
          }
        } catch (err: any) {
          toast.error(`Erreur lecture Excel: ${err?.message || err}`);
          return;
        }
        if (!parsedOk) return;
      }

      setImportData({ headers, rows });
      toast.success(`${totalRows || rows.length} lignes détectées (${headers.length} colonnes)`);

      // Helper: build auto-mapping for examen imports
      const buildExamenMapping = (hdrs: string[], table: string): Record<string, string> => {
        const cols = table === "examen_cepe_candidates"
          ? (EXAMEN_CEPE_COLUMNS as readonly string[])
          : (EXAMEN_BEPC_COLUMNS as readonly string[]);
        const aliases = table === "examen_cepe_candidates" ? CEPE_ALIASES : BEPC_ALIASES;
        const mapping: Record<string, string> = {};
        hdrs.forEach((h) => {
          const direct = cols.find((c) => c.toLowerCase() === h.toLowerCase().trim());
          if (direct) { mapping[h] = direct; return; }
          const alias = aliases[normHeader(h)];
          if (alias && cols.includes(alias)) mapping[h] = alias;
        });
        return mapping;
      };

      // Auto-detect target if not yet selected
      if (!importTarget) {
        const detected = IMPORT_TARGETS.find((t) =>
          t.expectedHeaders.every((h) => headers.includes(h)),
        );
        if (detected) {
          setImportTarget(detected);
          if (detected.table === "examen_cepe_candidates" || detected.table === "examen_bepc_candidates") {
            setTableColumns([]);
            setColumnMapping(buildExamenMapping(headers, detected.table));
          } else {
            await loadTableColumns(detected.table, headers);
          }
          toast.info(`Détection automatique : ${detected.label} → ${detected.table}`);
        }
      } else {
        if (importTarget.table === "examen_cepe_candidates" || importTarget.table === "examen_bepc_candidates") {
          setTableColumns([]);
          setColumnMapping(buildExamenMapping(headers, importTarget.table));
        } else {
          await loadTableColumns(importTarget.table, headers);
        }
      }
    } catch (err: any) {
      toast.error(`Erreur lecture fichier: ${err.message}`);
    } finally {
      setParsingFile(false);
    }
  };

  const loadTableColumns = async (tableName: string, headers?: string[]) => {
    const res = await adminFetch("getTableColumns", {
      adminUsername: user?.username,
      tableName,
    });
    if (res.success) {
      setTableColumns(res.columns);
      const hdrs = headers ?? importData?.headers ?? [];
      const mapping: Record<string, string> = {};
      hdrs.forEach((h) => {
        const m = res.columns.find(
          (c: any) => c.column_name.toLowerCase() === h.toLowerCase() || c.column_name === h,
        );
        if (m) mapping[h] = m.column_name;
      });
      setColumnMapping(mapping);
    }
  };

  const selectImportTarget = async (t: typeof IMPORT_TARGETS[number]) => {
    setImportTarget(t);
    if (!importData) return;

    if (t.table === "examen_cepe_candidates" || t.table === "examen_bepc_candidates") {
      const cols = t.table === "examen_cepe_candidates"
        ? (EXAMEN_CEPE_COLUMNS as readonly string[])
        : (EXAMEN_BEPC_COLUMNS as readonly string[]);
      const aliases = t.table === "examen_cepe_candidates" ? CEPE_ALIASES : BEPC_ALIASES;
      const fallbackMapping: Record<string, string> = {};
      importData.headers.forEach((h) => {
        const direct = cols.find((c) => c.toLowerCase() === h.toLowerCase().trim());
        if (direct) { fallbackMapping[h] = direct; return; }
        const alias = aliases[normHeader(h)];
        if (alias && cols.includes(alias)) fallbackMapping[h] = alias;
      });
      setTableColumns([]);
      setColumnMapping(fallbackMapping);
      return;
    }

    await loadTableColumns(t.table, importData.headers);
  };

  const handleImport = async () => {
    if (!importTarget || !importData) {
      toast.error("Sélectionnez une table cible");
      return;
    }
    const mapped = Object.entries(columnMapping).filter(([, v]) => v);
    if (mapped.length === 0) {
      toast.error("Aucune colonne mappée");
      return;
    }
    if (isExamenImport) {
      const y = parseInt(importYear, 10);
      if (!Number.isFinite(y) || y < 1990 || y > 2100) {
        toast.error("Veuillez sélectionner une année scolaire valide pour l'examen (ex. 2024)");
        return;
      }
    }
    setImporting(true);
    setImportProgress(0);
    try {
      const excelIdx = importData.headers
        .map((h, i) => ({ header: h, index: i, dbCol: columnMapping[h] }))
        .filter((x) => x.dbCol);
      // Pour les examens (CEPE / BEPC) : forcer ANNEE_SCOLAIRE depuis le sélecteur admin
      // (on remplace toute colonne ANNEE_SCOLAIRE éventuellement mappée pour garantir la cohérence).
      const filteredIdx = isExamenImport ? excelIdx.filter((x) => x.dbCol !== "ANNEE_SCOLAIRE") : excelIdx;
      const injectYear = isExamenImport;
      const columns = injectYear
        ? ["ANNEE_SCOLAIRE", ...filteredIdx.map((x) => x.dbCol)]
        : filteredIdx.map((x) => x.dbCol);
      const yearVal = isExamenImport ? parseInt(importYear, 10) : null;

      let totalInserted = 0;
      const errors: string[] = [];
      const totalSourceRows = workerBackedImport ? importRowCount : importData.rows.length;
      // Lots plus petits + pause réelle entre les lots → évite la surchauffe machine
      // (anciennement jusqu'à 2000 lignes/lot sans pause, ce qui saturait CPU et RAM
      // lors des très gros imports CEPE).
      const batch = totalSourceRows > 100000 ? 500 : totalSourceRows > 20000 ? 400 : 300;
      const pauseMs = totalSourceRows > 100000 ? 250 : totalSourceRows > 20000 ? 150 : 60;
      const importBatchId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const importBatchTs = new Date().toISOString();
      for (let i = 0; i < totalSourceRows; i += batch) {
        const rawSlice = workerBackedImport
          ? (await callImportWorker({ type: "getChunk", offset: i, limit: batch })).rows || []
          : importData.rows.slice(i, i + batch);
        const slice = rawSlice.map((row) => {
          const base = filteredIdx.map((x) => row[x.index] ?? null);
          return injectYear ? [yearVal, ...base] : base;
        });


        const res = await adminFetch("importData", {
          adminUsername: user?.username,
          tableName: importTarget.table,
          columns,
          rows: slice,
          fileName: importFile?.name,
          importBatchId,
          importBatchTs,
          isFirstChunk: i === 0,
          isFinalChunk: i + slice.length >= totalSourceRows,
        });
        if (res.success) {
          totalInserted += res.inserted;
          if (res.errors?.length) errors.push(...res.errors);
        } else {
          errors.push(res.error);
          break;
        }
        setImportProgress(Math.round(((i + slice.length) / totalSourceRows) * 100));
        // Vraie pause pour laisser le CPU respirer (évite la surchauffe).
        await new Promise((r) => setTimeout(r, pauseMs));
      }
      if (errors.length === 0) {
        toast.success(`${totalInserted} lignes insérées dans ${importTarget.table}`);
      } else {
        toast.warning(`${totalInserted} insérées, ${errors.length} erreurs`);
        console.warn("Erreurs import:", errors);
      }
      setImportFile(null);
      setImportData(null);
      setImportRowCount(0);
      setWorkerBackedImport(false);
      setColumnMapping({});
      await callImportWorker({ type: "clear" });
      if (fileRef.current) fileRef.current.value = "";
      loadCrudCounts();
    } catch (e: any) {
      toast.error(`Erreur d'import: ${e.message}`);
    }
    setImporting(false);
    setImportProgress(0);
  };

  const handleTruncate = async () => {
    if (!showTruncate) return;
    const res = await adminFetch("crudTdb", {
      adminUsername: user?.username,
      op: "truncate",
      table: showTruncate.table,
    });
    if (res.success) {
      toast.success(`Table ${showTruncate.table} vidée`);
      setShowTruncate(null);
      loadCrudCounts();
      if (crudTable === showTruncate.table) loadCrudData();
    } else toast.error(res.error);
  };

  // ============ CRUD TDB ============
  const loadCrudData = useCallback(async () => {
    setCrudLoading(true);
    try {
      const res = await adminFetch("crudTdb", {
        adminUsername: user?.username,
        op: "list",
        table: crudTable,
      });
      if (res.success && Array.isArray(res.data)) {
        setCrudRows(res.data);
      } else {
        setCrudRows([]);
        toast.error(formatAdminError(res.error ?? res.data, `Impossible de charger ${crudTable}`));
      }
    } catch (error) {
      setCrudRows([]);
      toast.error(formatAdminError(error, `Impossible de charger ${crudTable}`));
    }
    setCrudLoading(false);
  }, [crudTable, user?.username]);

  const loadCrudCounts = useCallback(async () => {
    const counts: Record<string, number> = {};
    await Promise.all(
      IMPORT_TARGETS.map(async (t) => {
        const res = await adminFetch("crudTdb", {
          adminUsername: user?.username,
          op: "list",
          table: t.table,
        });
        if (res.success) counts[t.table] = asArray(res.data).length;
      }),
    );
    setCrudCounts(counts);
  }, [user?.username]);

  useEffect(() => {
    if (isAdmin) {
      loadCrudData();
      loadCrudCounts();
    }
  }, [isAdmin, loadCrudData, loadCrudCounts]);

<<<<<<< HEAD
=======
  // ====================== CHARGER CONFIG SIG (Admin.tsx) ======================
  const loadSigConfig = async () => {
    setLoadingConfig(true);

    try {
      const res = await djangoGet('/sig/config/');
      const modules = res?.modules || {};

      // Fonction helper robuste pour gérer les deux conventions (camelCase / snake_case)
      const getModuleValue = (camelKey: string, snakeKey?: string): boolean => {
        return Boolean(
          modules[camelKey] ??
          modules[
            snakeKey || camelKey.replace(/([A-Z])/g, '_$1').toLowerCase()
          ] ??
          modules[camelKey.toLowerCase()] ??
          false
        );
      };

      setSigConfig({
        pointage: getModuleValue('pointage'),
        deplacement: getModuleValue('deplacement'),
        validation_deplacement: getModuleValue(
          'validationDeplacement',
          'validation_deplacement'
        ),
      });

      // Debug temporaire (à supprimer une fois que tout fonctionne)
      /*console.log('✅ Config SIG chargée (Admin):', {
        pointage: getModuleValue('pointage'),
        deplacement: getModuleValue('deplacement'),
        validation_deplacement: getModuleValue(
          'validationDeplacement',
          'validation_deplacement'
        ),
        rawModules: modules,
      });*/
    } catch (err) {
      //console.warn('❌ Impossible de charger config SIG', err);

      // Fallback sécurisé
      setSigConfig({
        pointage: true,
        deplacement: false,
        validation_deplacement: false,
      });
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadSigConfig();
  }, [isAdmin]);

  const updateSigConfig = async (cle_fonction: string, est_active: boolean) => {
    setLoadingConfig(true);
    try {
      await djangoPost('/sig/config/update/', {
        cle_fonction,
        est_active,
        adminUsername: user?.username,
      });
      toast.success(`Configuration mise à jour`);
      loadSigConfig();
    } catch (err: any) {
      toast.error(`Erreur mise à jour : ${err.message || 'Inconnue'}`);
    } finally {
      setLoadingConfig(false);
    }
  };

>>>>>>> f4c6f350 (Refonte du SIG : amélioration des déplacements, des API et de l'interface)
  const handleCrudDelete = async () => {
    if (!deleteRow) return;
    const res = await adminFetch("crudTdb", {
      adminUsername: user?.username,
      op: "delete",
      table: crudTable,
      id: deleteRow.id,
    });
    if (res.success) {
      toast.success("Ligne supprimée");
      setDeleteRow(null);
      loadCrudData();
      loadCrudCounts();
    } else toast.error(res.error);
  };

  const handleCrudUpdate = async () => {
    if (!editRow) return;
    const { id, imported_at, ...payload } = editRow;
    const res = await adminFetch("crudTdb", {
      adminUsername: user?.username,
      op: "update",
      table: crudTable,
      id,
      data: payload,
    });
    if (res.success) {
      toast.success("Ligne mise à jour");
      setEditRow(null);
      loadCrudData();
    } else toast.error(res.error);
  };

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.last_name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <Shield className="w-16 h-16 mx-auto text-destructive/50 mb-4" />
            <h2 className="text-xl font-bold mb-2">Accès refusé</h2>
            <p className="text-muted-foreground">
              Cette page est réservée aux administrateurs.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Display columns for CRUD per table
  const crudDisplayCols: Record<string, string[]> = {
    tdb_mada: ["id", "code_mada", "nombre_eleves", "txAbdGlobal", "tx_admis", "TPA"],
    tdb_dren: ["id", "CODE_DREN", "DREN", "nombre_eleves", "txAbdGlobal", "tx_admis", "TPA"],
    tdb_cisco: ["id", "CODE_CISCO", "CISCO", "DREN", "nombre_eleves", "txAbdGlobal", "tx_admis"],
    tdb_zap: ["id", "CODE_ZAP", "ZAP", "CISCO", "nombre_eleves", "txAbdGlobal", "tx_admis"],
    tdb_ecole: ["id", "CODE_ETAB", "NOM_ETAB", "ZAP", "nombre_eleves", "txAbdGlobal", "tx_admis"],
    examen_cepe_candidates: ["id", "ANNEE_SCOLAIRE", "CODE_ETAB", "GENRE", "MOYENNE", "CEPE"],
    examen_bepc_candidates: ["id", "ANNEE_SCOLAIRE", "CODE_ETAB", "GENRE", "OPTION", "MOYENNE", "BEPC"],

  };
  const crudRowsList = asArray<any>(crudRows);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-primary/8 via-background to-info/8 border-b border-border/60 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-info flex items-center justify-center shadow-md ring-2 ring-background">
              <ShieldCheck className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
                Console d'administration
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] h-5">
                  Superuser
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground">
                Connecté en tant que <strong className="text-foreground">{user.username}</strong> · Gérez utilisateurs, données et imports
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-success/10 border border-success/30 text-success-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="font-medium">Système opérationnel</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <Tabs defaultValue="import" className="space-y-4">
<<<<<<< HEAD
          <TabsList className="grid w-full max-w-4xl grid-cols-5 h-11 p-1 bg-muted/60">
            <TabsTrigger value="import" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Import</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">Historique</span>
            </TabsTrigger>
            <TabsTrigger value="crud-all" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Database className="w-4 h-4" />
              <span className="hidden sm:inline">CRUD Universel</span>
            </TabsTrigger>
            <TabsTrigger value="crud" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Données TDB</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Utilisateurs</span>
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px] ml-1">{users.length}</Badge>
=======
          <TabsList className="flex flex-wrap w-full max-w-6xl h-auto p-1 bg-muted/60 gap-1">
            <TabsTrigger
              value="import"
              className="flex items-center gap-2 px-3 py-2 whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md transition"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Import</span>
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="flex items-center gap-2 px-3 py-2 whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md transition"
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">Historique</span>
            </TabsTrigger>
            <TabsTrigger
              value="crud-all"
              className="flex items-center gap-2 px-3 py-2 whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md transition"
            >
              <Database className="w-4 h-4" />
              <span className="hidden sm:inline">CRUD Universel</span>
            </TabsTrigger>
            <TabsTrigger
              value="crud"
              className="flex items-center gap-2 px-3 py-2 whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Données TDB</span>
            </TabsTrigger>
            <TabsTrigger
              value="users"
              className="flex items-center gap-2 px-3 py-2 whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md transition"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Utilisateurs</span>
              <Badge
                variant="secondary"
                className="h-4 px-1.5 text-[10px] ml-1"
              >
                {users.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="sig"
              className="flex items-center gap-2 px-3 py-2 whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md transition"
            >
              <MapPin className="w-4 h-4" />
              <span className="hidden sm:inline">SIG</span>
>>>>>>> f4c6f350 (Refonte du SIG : amélioration des déplacements, des API et de l'interface)
            </TabsTrigger>
          </TabsList>

          {/* ============ IMPORT HISTORY TAB ============ */}
          <TabsContent value="history">
            <ImportBatchesPanel adminUsername={user.username} />
          </TabsContent>

          {/* ============ UNIVERSAL CRUD TAB ============ */}
          <TabsContent value="crud-all">
            <UniversalCrud adminUsername={user.username} />
          </TabsContent>

          {/* ============ IMPORT TAB ============ */}
          <TabsContent value="import" className="space-y-4">
            <Alert>
              <FileSpreadsheet className="h-4 w-4" />
              <AlertTitle>Comment importer vos fichiers ?</AlertTitle>
              <AlertDescription className="text-xs space-y-1 mt-2">
                <p><strong>1.</strong> Choisissez la table cible ci-dessous (selon le fichier).</p>
                <p><strong>2.</strong> Sélectionnez le fichier <code className="bg-muted px-1 rounded">.csv</code> ou <code className="bg-muted px-1 rounded">.xlsx</code>.</p>
                <p><strong>3.</strong> Vérifiez la correspondance auto des colonnes puis cliquez sur Importer.</p>
              </AlertDescription>
            </Alert>

            {/* Choix de la cible */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">
                Étape 1 — Choisir la table cible
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                {IMPORT_TARGETS.map((t) => {
                  const active = importTarget?.table === t.table;
                  const count = crudCounts[t.table] ?? 0;
                  return (
                    <button
                      key={t.table}
                      onClick={() => selectImportTarget(t)}
                      className={`text-left p-3 rounded-lg border-2 transition-all ${
                        active
                          ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                          : "border-border hover:border-primary/40 bg-card"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <Badge variant="outline" className={`text-xs ${t.color}`}>
                          {t.label}
                        </Badge>
                        {active && <CheckCircle2 className="w-4 h-4 text-primary" />}
                      </div>
                      <p className="text-sm font-bold mt-2">→ {t.table}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                      <p className="text-xs mt-2 font-medium">
                        {count} ligne{count > 1 ? "s" : ""} actuellement
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sélection fichier */}
            {importTarget && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <HardDriveUpload className="w-4 h-4" />
                    Étape 2 — Sélectionner le fichier {importTarget.label}
                  </CardTitle>
                  <CardDescription>
                    Le fichier sera importé dans la table{" "}
                    <code className="bg-muted px-1 rounded">{importTarget.table}</code>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isExamenImport && (
                    <div className="flex flex-wrap items-center gap-2 p-3 rounded-md border border-primary/40 bg-primary/5">
                      <Label htmlFor="exam-year" className="text-sm font-semibold whitespace-nowrap">
                        Année scolaire {isCepeImport ? "CEPE" : "BEPC"} <span className="text-destructive">*</span>
                      </Label>
                      <Select value={importYear} onValueChange={setImportYear} disabled={importing}>
                        <SelectTrigger id="exam-year" className="w-40 bg-background">
                          <SelectValue placeholder="— Choisir —" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 21 }, (_, k) => new Date().getFullYear() + 2 - k).map((y) => (
                            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Obligatoire. Cette année écrasera celle du fichier et remplacera les données existantes pour la même année.
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Input
                      ref={fileRef}
                      type="file"
                      accept=".csv,.xlsx,.xls,.txt"
                      onChange={handleFileSelect}
                      disabled={parsingFile || importing}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTruncate(importTarget)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Vider la table
                    </Button>
                  </div>
                  {importData && (
                    <p className="text-sm text-muted-foreground">
                      ✅ <strong>{displayedImportRowCount}</strong> lignes,{" "}
                      <strong>{importData.headers.length}</strong> colonnes détectées
                    </p>
                  )}
                  {parsingFile && (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Analyse du fichier en cours…
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Mapping + import */}
            {importData && importTarget && importCanReachStep3 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Étape 3 — Vérifier la correspondance des colonnes
                  </CardTitle>
                  <CardDescription>
                    Auto-détection par nom. Désélectionnez les colonnes à ignorer.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="border rounded-lg overflow-auto max-h-72">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Colonne CSV</TableHead>
                          <TableHead>Aperçu (1ère ligne)</TableHead>
                          <TableHead>→ Colonne DB</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importData.headers.map((h, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium text-xs">{h}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-32 truncate">
                              {String(importData.rows[0]?.[i] ?? "")}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={columnMapping[h] || "_skip"}
                                onValueChange={(v) =>
                                  setColumnMapping((p) => ({
                                    ...p,
                                    [h]: v === "_skip" ? "" : v,
                                  }))
                                }
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="_skip">— Ignorer —</SelectItem>
                                  {effectiveTableColumns.map((c) => (
                                    <SelectItem key={c.column_name} value={c.column_name}>
                                      {c.column_name} ({c.data_type})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <Button onClick={handleImport} disabled={importing || parsingFile} className="w-full" size="lg">
                    {importing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Importation… {importProgress}%
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Importer {displayedImportRowCount} lignes dans {importTarget.table}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ============ CRUD TAB ============ */}
          <TabsContent value="crud" className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Label className="text-sm font-semibold">Table:</Label>
              <Select value={crudTable} onValueChange={setCrudTable}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMPORT_TARGETS.map((t) => (
                    <SelectItem key={t.table} value={t.table}>
                      {t.table} ({crudCounts[t.table] ?? 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={loadCrudData}
                disabled={crudLoading}
              >
                <RefreshCw
                  className={`w-4 h-4 mr-1 ${crudLoading ? "animate-spin" : ""}`}
                />
                Actualiser
              </Button>
              <Badge variant="secondary" className="ml-auto">
                {crudRowsList.length} lignes affichées (max 200)
              </Badge>
            </div>

            <Card>
              <div className="overflow-auto max-h-[calc(100vh-280px)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {(crudDisplayCols[crudTable] || ["id"]).map((c) => (
                        <TableHead key={c}>{c}</TableHead>
                      ))}
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {crudLoading ? (
                      <TableRow>
                        <TableCell
                          colSpan={(crudDisplayCols[crudTable]?.length || 1) + 1}
                          className="text-center py-8"
                        >
                          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : crudRowsList.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={(crudDisplayCols[crudTable]?.length || 1) + 1}
                          className="text-center py-8 text-muted-foreground"
                        >
                          Aucune donnée. Importez via l'onglet Import.
                        </TableCell>
                      </TableRow>
                    ) : (
                      crudRowsList.map((r) => (
                        <TableRow key={r.id}>
                          {(crudDisplayCols[crudTable] || ["id"]).map((c) => (
                            <TableCell key={c} className="text-xs">
                              {r[c] === null || r[c] === undefined
                                ? "—"
                                : typeof r[c] === "number"
                                ? Number(r[c]).toLocaleString("fr-FR")
                                : String(r[c])}
                            </TableCell>
                          ))}
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setEditRow({ ...r })}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => setDeleteRow(r)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* ============ USERS TAB ============ */}
          <TabsContent value="users" className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un utilisateur..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadUsers}
                disabled={loadingUsers}
              >
                <RefreshCw
                  className={`w-4 h-4 mr-1 ${loadingUsers ? "animate-spin" : ""}`}
                />
                Actualiser
              </Button>
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Nouveau
              </Button>
            </div>

            <Card>
              <div className="overflow-auto max-h-[calc(100vh-280px)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Identifiant</TableHead>
                      <TableHead>Nom complet</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-center">Actif</TableHead>
                      <TableHead className="text-center">Rôle</TableHead>
                      <TableHead>DREN</TableHead>
                      <TableHead>CISCO</TableHead>
                      <TableHead>Dernière connexion</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingUsers ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          Aucun utilisateur trouvé
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium text-sm">
                            {u.username}
                            {u.username === user.username && (
                              <Badge variant="outline" className="ml-2 text-[10px]">
                                vous
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {`${u.first_name} ${u.last_name}`.trim() || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {u.email || "—"}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={u.is_active ? "default" : "destructive"}
                              className="text-xs"
                            >
                              {u.is_active ? "Oui" : "Non"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {u.is_superuser ? (
                              <Badge className="bg-primary/15 text-primary border-primary/30 text-xs">
                                <ShieldCheck className="w-3 h-3 mr-1" />
                                Admin
                              </Badge>
                            ) : u.is_staff ? (
                              <Badge variant="secondary" className="text-xs">
                                Staff
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                User
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">{u.dren || "—"}</TableCell>
                          <TableCell className="text-xs">{u.cisco || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {u.last_login
                              ? new Date(u.last_login).toLocaleDateString("fr-FR")
                              : "Jamais"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openEdit(u)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => setShowDelete(u)}
                                disabled={u.username === user.username}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>
<<<<<<< HEAD
=======

          {/* ============ SIG CONFIGURATION TAB ============ */}
          <TabsContent value="sig" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <MapPin className="w-6 h-6 text-primary" />
                  Configuration de la Carte SIG
                </CardTitle>
                <CardDescription>
                  Gérez les fonctionnalités globales disponibles sur la carte
                  SIG
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Pointage */}
                <div className="flex items-center justify-between p-6 border rounded-xl bg-card">
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg">
                      Pointage des établissements
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      Autorise les utilisateurs à effectuer le pointage des
                      établissements sur la carte SIG.
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <Switch
                      checked={Boolean(sigConfig?.pointage)}
                      onCheckedChange={(value) =>
                        updateSigConfig('pointage', value)
                      }
                      disabled={loadingConfig}
                      className="scale-125"
                    />

                    <span
                      className={`text-sm font-medium px-3 py-1 rounded-full ${
                        sigConfig.pointage
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {sigConfig.pointage ? '✅ Activé' : '❌ Désactivé'}
                    </span>
                  </div>
                </div>

                {/* Déplacement */}
                <div className="flex items-center justify-between p-6 border rounded-xl bg-card">
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg">
                      Déplacement des établissements et villages
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      Autorise le déplacement des établissements et villages sur
                      la carte SIG.
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <Switch
                      checked={Boolean(sigConfig?.deplacement)}
                      onCheckedChange={(value) =>
                        updateSigConfig('deplacement', value)
                      }
                      disabled={loadingConfig}
                    />

                    <span
                      className={`text-sm font-medium px-3 py-1 rounded-full ${
                        sigConfig.deplacement
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {sigConfig.deplacement ? '✅ Activé' : '❌ Désactivé'}
                    </span>
                  </div>
                </div>

                {/* Validation déplacement */}
                <div className="flex items-center justify-between p-6 border rounded-xl bg-card">
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg">
                      Validation des déplacements
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      Autorise la validation finale des déplacements effectués
                      sur la carte SIG.
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <Switch
                      checked={Boolean(sigConfig?.validation_deplacement)}
                      onCheckedChange={(value) =>
                        updateSigConfig('validation_deplacement', value)
                      }
                      disabled={loadingConfig}
                    />

                    <span
                      className={`text-sm font-medium px-3 py-1 rounded-full ${
                        sigConfig.validation_deplacement
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {sigConfig.validation_deplacement
                        ? '✅ Activé'
                        : '❌ Désactivé'}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground border-l-2 border-muted pl-4">
                  Les modifications sont appliquées immédiatement à tous les
                  utilisateurs de la plateforme SIG.
                </div>
              </CardContent>
            </Card>
          </TabsContent>
>>>>>>> f4c6f350 (Refonte du SIG : amélioration des déplacements, des API et de l'interface)
        </Tabs>
      </div>

      {/* ====== CREATE USER ====== */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Créer un utilisateur</DialogTitle>
            <DialogDescription>Renseignez les informations</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Identifiant *</Label>
                <Input
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>
              <div>
                <Label>Mot de passe *</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
              <div>
                <Label>Nom</Label>
                <Input
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Prénom</Label>
                <Input
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>DREN</Label>
                <Input
                  value={formData.dren}
                  onChange={(e) => setFormData({ ...formData, dren: e.target.value })}
                />
              </div>
              <div>
                <Label>CISCO</Label>
                <Input
                  value={formData.cisco}
                  onChange={(e) => setFormData({ ...formData, cisco: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                />
                <Label>Actif</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_staff}
                  onCheckedChange={(v) => setFormData({ ...formData, is_staff: v })}
                />
                <Label>Staff</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_superuser}
                  onCheckedChange={(v) => setFormData({ ...formData, is_superuser: v })}
                />
                <Label>Admin</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-1" />
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== EDIT USER ====== */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier: {editUser?.username}</DialogTitle>
            <DialogDescription>Modifiez les informations</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nom</Label>
                <Input
                  value={editForm.first_name}
                  onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Prénom</Label>
                <Input
                  value={editForm.last_name}
                  onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>DREN</Label>
                <Input
                  value={editForm.dren}
                  onChange={(e) => setEditForm({ ...editForm, dren: e.target.value })}
                />
              </div>
              <div>
                <Label>CISCO</Label>
                <Input
                  value={editForm.cisco}
                  onChange={(e) => setEditForm({ ...editForm, cisco: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Nouveau mot de passe (vide = inchangé)</Label>
              <Input
                type="password"
                value={editForm.newPassword}
                onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={editForm.is_active}
                  onCheckedChange={(v) => setEditForm({ ...editForm, is_active: v })}
                />
                <Label>Actif</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editForm.is_staff}
                  onCheckedChange={(v) => setEditForm({ ...editForm, is_staff: v })}
                />
                <Label>Staff</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editForm.is_superuser}
                  onCheckedChange={(v) => setEditForm({ ...editForm, is_superuser: v })}
                />
                <Label>Admin</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>
              Annuler
            </Button>
            <Button onClick={handleUpdate}>
              <Pencil className="w-4 h-4 mr-1" />
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== DELETE USER ====== */}
      <Dialog open={!!showDelete} onOpenChange={() => setShowDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer l'utilisateur</DialogTitle>
            <DialogDescription>
              Supprimer <strong>{showDelete?.username}</strong> ? Action irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-1" />
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== TRUNCATE ====== */}
      <Dialog open={!!showTruncate} onOpenChange={() => setShowTruncate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Vider la table {showTruncate?.table}
            </DialogTitle>
            <DialogDescription>
              Toutes les données de <strong>{showTruncate?.table}</strong> seront supprimées.
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTruncate(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleTruncate}>
              <Trash2 className="w-4 h-4 mr-1" />
              Vider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== CRUD DELETE ROW ====== */}
      <Dialog open={!!deleteRow} onOpenChange={() => setDeleteRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer cette ligne ?</DialogTitle>
            <DialogDescription>
              ID #{deleteRow?.id} dans {crudTable}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRow(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleCrudDelete}>
              <Trash2 className="w-4 h-4 mr-1" />
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== CRUD EDIT ROW ====== */}
      <Dialog open={!!editRow} onOpenChange={() => setEditRow(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Modifier ligne #{editRow?.id} de {crudTable}
            </DialogTitle>
            <DialogDescription>
              Modifiez les indicateurs principaux. Les champs non listés restent inchangés.
            </DialogDescription>
          </DialogHeader>
          {editRow && (
            <div className="grid grid-cols-2 gap-3">
              {Object.keys(editRow)
                .filter((k) => !["id", "imported_at"].includes(k))
                .slice(0, 30)
                .map((k) => (
                  <div key={k}>
                    <Label className="text-xs">{k}</Label>
                    <Input
                      value={editRow[k] ?? ""}
                      onChange={(e) =>
                        setEditRow({
                          ...editRow,
                          [k]: e.target.value === "" ? null : e.target.value,
                        })
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>
              Annuler
            </Button>
            <Button onClick={handleCrudUpdate}>
              <Pencil className="w-4 h-4 mr-1" />
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
