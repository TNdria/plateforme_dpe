/**
 * SnapshotPanel — Displays the latest imported CSV row (jsonb data) for a TDB table
 * (tdb_dren, tdb_cisco, tdb_zap, tdb_ecole, tdb_mada) as a compact key/value grid.
 *
 * The component lives inside the print container so the indicators appear in the PDF
 * export. If no snapshot is available (no CSV imported yet), the panel is hidden.
 */
import { useEffect, useState } from "react";

type Loader = () => Promise<any>;

interface SnapshotPanelProps {
  /** Async function that returns { success, found, data } from the edge function */
  load: Loader;
  /** Title shown above the indicator grid */
  title: string;
  /** Reload trigger (changes whenever filters change) */
  reloadKey?: string | number;
}

const SKIP_KEYS = new Set([
  "id", "imported_at", "data",
  "CODE_MADA", "CODE_DREN", "DREN", "CODE_CISCO", "CISCO",
  "CODE_ZAP", "ZAP", "CODE_ETAB", "NOM_ETAB",
]);

const fmt = (v: any) => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "—";
    if (Math.abs(v) >= 1000) return v.toLocaleString("fr-FR");
    if (Number.isInteger(v)) return String(v);
    return v.toFixed(2);
  }
  return String(v);
};

export default function SnapshotPanel({ load, title, reloadKey }: SnapshotPanelProps) {
  const [rows, setRows] = useState<Array<[string, any]>>([]);
  const [importedAt, setImportedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .then((res: any) => {
        if (cancelled) return;
        if (res?.success && res?.found && res?.data && typeof res.data === "object") {
          const entries = Object.entries(res.data)
            .filter(([k, v]) => !SKIP_KEYS.has(k) && v !== null && v !== "" && v !== undefined)
            .sort(([a], [b]) => a.localeCompare(b));
          setRows(entries);
          setImportedAt(res.imported_at || null);
        } else {
          setRows([]);
          setImportedAt(null);
        }
      })
      .catch(() => {
        if (!cancelled) { setRows([]); setImportedAt(null); }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  if (loading) return null;
  if (rows.length === 0) return null;

  return (
    <div style={{
      marginTop: 12, padding: 8, border: "1px solid #cbd5e1", borderRadius: 4,
      background: "#f8fafc", fontFamily: "Verdana, sans-serif",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <div style={{ fontWeight: "bold", fontSize: 11, color: "#0f172a" }}>{title}</div>
        {importedAt && (
          <div style={{ fontSize: 9, color: "#64748b" }}>
            Importé le {new Date(importedAt).toLocaleDateString("fr-FR")}
          </div>
        )}
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "2px 8px",
        fontSize: 9,
      }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dotted #e2e8f0", padding: "1px 2px" }}>
            <span style={{ color: "#334155", marginRight: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={k}>{k}</span>
            <span style={{ fontWeight: 600, color: "#0f172a" }}>{fmt(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}