// @ts-nocheck
import { Badge } from "@/components/ui/badge";

const fmt = (value, fallback = "—") => {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (Array.isArray(value)) return value.length === 0 ? fallback : value.join(", ");
  if (typeof value === "object") return value.nom || value.name || value.libelle || value.nom_etab || value.nom_village || JSON.stringify(value);
  return String(value);
};

export function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 border-b border-border/50 last:border-0">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground font-medium break-words">{fmt(value)}</span>
    </div>
  );
}

export function DataTable({ titre, colonnes, lignes }) {
  if (!Array.isArray(lignes) || lignes.length === 0) {
    return (
      <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground italic">
        Aucune donnée disponible pour « {titre} ».
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
        {titre}
        <Badge variant="secondary" className="text-[10px]">{lignes.length}</Badge>
      </h4>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 border-b">
              {colonnes.map((c) => (
                <th key={c.key} className="text-left py-2 px-3 font-bold uppercase tracking-wider text-[10px] text-muted-foreground whitespace-nowrap">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.map((ligne, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                {colonnes.map((c) => (
                  <td key={c.key} className="py-2 px-3 text-foreground">{fmt(ligne?.[c.key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const dateFR = (value) => {
  if (!value) return "—";
  try {
    const d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("fr-FR");
  } catch { return String(value); }
};