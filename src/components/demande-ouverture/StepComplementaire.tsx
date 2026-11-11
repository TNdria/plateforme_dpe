// @ts-nocheck
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { INPUT_CLS } from "@/constants/demandeOuvertureConfig";
import { SectionBar, Field, CheckboxOuiNon } from "./FormulaireUI";
import DynamicTable from "./DynamicTable";

export default function StepComplementaire({
  form, cfg, locSelection, infoComplementaire,
  changeInfoComplementaire, tableProche, setTableProche,
  getFieldErrorClass, getFieldErrorMessage, getTableErrors,
}) {
  return (
    <div className="space-y-5">
      <SectionBar num="4" title="Informations complémentaires" accent="" sub={`Niveau : ${cfg.sigle}`} />

      {form.type_demande === "Nouvelle création" && !locSelection.fokontany && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>Sélectionnez d'abord un fokontany dans le Lieu d'implantation pour récupérer ces informations.</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <Field label="Distance par rapport au CISCO (Km)" error={getFieldErrorMessage("distance_cisco")}>
          <Input className={cn(INPUT_CLS, getFieldErrorClass("distance_cisco"))} type="text"
            value={infoComplementaire.distance_cisco}
            onChange={(e) => changeInfoComplementaire("distance_cisco", e.target.value)} />
        </Field>

        <Field label="Distance par rapport au DREN (Km)" error={getFieldErrorMessage("distance_dren")}>
          <Input className={cn(INPUT_CLS, getFieldErrorClass("distance_dren"))} type="text"
            value={infoComplementaire.distance_dren}
            onChange={(e) => changeInfoComplementaire("distance_dren", e.target.value)} />
        </Field>

        {infoComplementaire.existe_proche !== true && (
          <Field label={cfg.labelDistancePlusProche} error={getFieldErrorMessage("distance_plus_proche")}>
            <Input className={cn(INPUT_CLS, getFieldErrorClass("distance_plus_proche"))} type="text"
              value={infoComplementaire.distance_plus_proche}
              onChange={(e) => changeInfoComplementaire("distance_plus_proche", e.target.value)} />
          </Field>
        )}
      </div>

      <div className="pt-1">
        <CheckboxOuiNon value={infoComplementaire.existe_proche}
          onChange={(v) => changeInfoComplementaire("existe_proche", v)}
          label={cfg.labelExistProche} />
      </div>

      {infoComplementaire.existe_proche === true && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm sm:text-base">Établissements {cfg.sigle} situés à proximité</CardTitle>
          </CardHeader>
          <CardContent>
            <DynamicTable columns={cfg.colonnesProche} rows={tableProche}
              onChangeRows={setTableProche}
              addLabel="Ajouter un établissement proche"
              rowStatusFn={() => ""} errors={getTableErrors()}
              colonnesModifiables={["obstacle", "nature_obstacle"]} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}