// @ts-nocheck
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { makeEmptyRow, calculerTotalEvolutionLigne } from "@/utils/demandeOuvertureHelpers";
import { NIVEAU_COLONNES_EFFECTIF } from "@/constants/demandeOuvertureConfig";

export default function DynamicTable({
  columns,
  rows,
  onChangeRows,
  addLabel,
  rowStatusFn,
  errors,
  readOnly = false,
  colonnesModifiables = null,
}) {
  // ✅ "verrouille" = pas d'ajout/suppression de lignes
  //    (mais certaines colonnes peuvent rester éditables via `editable`).
  const verrouille = readOnly || Array.isArray(colonnesModifiables);

  // ✅ Une colonne est modifiable si :
  //   - la colonne est explicitement marquée `editable: true`, OU
  //   - on n'est pas en mode strict readOnly (ni `colonnesModifiables`),
  //   - et la colonne n'est pas marquée `readOnly: true` côté config.
  const colonneEstModifiable = (col) => {
    const key = col?.key;

    // Colonne explicitement en lecture seule dans la config
    if (col?.readOnly === true) return false;

    // Colonne explicitement éditable → autorisée même si readOnly global
    if (col?.editable === true) return true;

    // Lecture seule globale → aucune autre colonne éditable
    if (readOnly) return false;

    // Mode "colonnesModifiables" → seules les colonnes listées sont éditables
    if (Array.isArray(colonnesModifiables)) {
      return colonnesModifiables.includes(key);
    }

    // Sinon : toutes les colonnes sont modifiables par défaut
    return true;
  };

  const changeCell = (index, key, value) => {
    if (key === "obstacle" && value === "Non") {
      onChangeRows(rows.map((row, i) => i === index ? { ...row, [key]: value, nature_obstacle: "" } : row));
      return;
    }
    onChangeRows(rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };

  const addRow = () => onChangeRows([...rows, makeEmptyRow(columns)]);
  const removeRow = (index) => onChangeRows(rows.filter((_, i) => i !== index));

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow>
              {columns.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}
              {!verrouille && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (verrouille ? 0 : 1)} className="text-center text-muted-foreground py-8 text-sm">
                  {verrouille ? "Aucune donnée récupérée." : `Aucune ligne. Cliquez sur « ${addLabel} » pour en ajouter une.`}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, i) => {
                const rowStatus = rowStatusFn ? rowStatusFn(row) : null;
                const hasError = errors && errors.length > 0 &&
                  (!row || Object.values(row).every((v) => !v || String(v).trim() === ""));

                const obstacleValue = row?.obstacle || "";
                const isObstacleNon = obstacleValue === "Non";

                return (
                  <TableRow key={i} className={cn(
                    hasError && "bg-red-50 dark:bg-red-950/20",
                    rowStatus?.status === "conforme" && "bg-emerald-50 dark:bg-emerald-950/20"
                  )}>
                    {columns.map((c) => {
                      const isError = errors && errors.some((e) => e.field === c.key && e.rowIndex === i);
                      const modifiable = colonneEstModifiable(c);
                      const isDisabledParObstacle = c.key === "nature_obstacle" && (isObstacleNon || !obstacleValue);
                      const isDisabled = !modifiable || isDisabledParObstacle;

                      return (
                        <TableCell key={c.key} className={cn(isError && "bg-red-50 dark:bg-red-950/20")}>
                          {c.type === "select" ? (
                            <Select value={row[c.key] ?? ""} onValueChange={(v) => changeCell(i, c.key, v)} disabled={isDisabled}>
                              <SelectTrigger className={cn("h-8 text-xs w-full", isError && "border-red-500")}>
                                <SelectValue placeholder="—" />
                              </SelectTrigger>
                              <SelectContent>
                                {c.options.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              type={c.type === "date" ? "date" : c.type === "number" ? "number" : "text"}
                              value={row[c.key] ?? ""}
                              onChange={(e) => changeCell(i, c.key, e.target.value)}
                              disabled={isDisabled}
                              className={cn("h-8 text-xs", isError && "border-red-500", isDisabled && "bg-muted")}
                            />
                          )}

                          {c.key === "nature_obstacle" && isDisabledParObstacle && modifiable && (
                            <small className="block text-muted-foreground text-[10px] mt-0.5">
                              {isObstacleNon ? "(Obstacle = Non)" : ""}
                            </small>
                          )}
                        </TableCell>
                      );
                    })}

                    {!verrouille && (
                      <TableCell>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(i)}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          aria-label="Supprimer la ligne" title="Supprimer la ligne">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {!verrouille && (
        <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-2">
          <Plus className="h-4 w-4" />
          {addLabel}
        </Button>
      )}
    </div>
  );
}

export function EvolutionEffectifsSaisieTable({ niveauKey, rows, onChangeRows, errors }) {
  const colonnesEffectif = NIVEAU_COLONNES_EFFECTIF[niveauKey] || [];

  const changeCell = (index, key, value) => {
    onChangeRows(rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };

  const addRow = () => onChangeRows([
    ...rows,
    { annee: "", ...colonnesEffectif.reduce((a, c) => ({ ...a, [c.key]: "" }), {}) },
  ]);

  const removeRow = (index) => onChangeRows(rows.filter((_, i) => i !== index));

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow>
              <TableHead>Année scolaire</TableHead>
              {colonnesEffectif.map((c) => <TableHead key={c.key} className="text-center">{c.label}</TableHead>)}
              <TableHead className="text-primary text-center bg-primary/5">Total</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colonnesEffectif.length + 3} className="text-center text-muted-foreground py-8 text-sm">
                  Aucune ligne. Cliquez sur « Ajouter une année » pour en ajouter une.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, i) => {
                const totalCalcule = calculerTotalEvolutionLigne(row, niveauKey);
                return (
                  <TableRow key={i}>
                    <TableCell>
                      <Input type="text" value={row.annee ?? ""} onChange={(e) => changeCell(i, "annee", e.target.value)}
                        placeholder="Ex. 2023-2024" className="h-8 text-xs" />
                    </TableCell>
                    {colonnesEffectif.map((c) => (
                      <TableCell key={c.key}>
                        <Input type="number" min="0" value={row[c.key] ?? ""} onChange={(e) => changeCell(i, c.key, e.target.value)}
                          className="h-8 text-xs text-center" placeholder="0" />
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-bold text-primary bg-primary/5">{totalCalcule}</TableCell>
                    <TableCell>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(i)}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        aria-label="Supprimer la ligne" title="Supprimer la ligne">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-2">
        <Plus className="h-4 w-4" />
        Ajouter une année
      </Button>
    </div>
  );
}