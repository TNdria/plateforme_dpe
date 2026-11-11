// @ts-nocheck
import { Loader2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionBar } from "./FormulaireUI";
import DynamicTable from "./DynamicTable";

export default function StepRecrutement({
  form, cfg, aireListe, setAireListe,
  villageLoading, getTableErrors,
}) {
  const niveauBrut = (form?.niveau_etab || "").toLowerCase();
  const populationSaisissable =
    niveauBrut.includes("presco") || niveauBrut.includes("primaire");

  const colonnes = (cfg?.colonnesAire || []).map((col) => {
    if (col.key === "population" && populationSaisissable) {
      return {
        ...col,
        type: col.type || "number",
        editable: true,
      };
    }
    return col;
  });

  return (
    <div className="space-y-5">
      <SectionBar
        num="5"
        title="Aire de recrutement de la future école"
        accent="green"
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm sm:text-base">
            {cfg?.labelListeAire}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {villageLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Récupération de l'aire de recrutement...
            </div>
          ) : aireListe.length === 0 ? (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                {form.type_demande === "Nouvelle création"
                  ? "Sélectionnez d'abord un fokontany pour récupérer l'aire de recrutement."
                  : "Aucune donnée d'aire de recrutement récupérée."}
              </span>
            </div>
          ) : (
            <DynamicTable
              columns={colonnes}
              rows={aireListe}
              onChangeRows={setAireListe}
              addLabel="Ajouter une ligne"
              errors={getTableErrors()}
              readOnly
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}