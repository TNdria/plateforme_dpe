// @ts-nocheck
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { COLONNES_PERSONNEL_ORS, COLONNES_PERSONNEL_DETAIL } from "@/constants/demandeOuvertureConfig";
import { SectionBar, ReadOnlyField } from "./FormulaireUI";
import DynamicTable from "./DynamicTable";

export default function StepRegularisation({
  regularisation, personnelExistant, personnelDetail, setPersonnelExistant, setPersonnelDetail,
  getFieldErrorMessage,
}) {
  return (
    <div className="space-y-5">
      <SectionBar num="3" title="Informations du régularisation" sub="" accent="amber" />

      <div className="p-2.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 text-xs flex items-start gap-2">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>Les champs grisés sont récupérés automatiquement depuis l'ORS.</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <ReadOnlyField label="Nombre de salle de classe" value={regularisation.nbr_salle} error={getFieldErrorMessage("nbr_salle")} />
        <ReadOnlyField label="Date d'ouverture" type="date" value={regularisation.date_ouverture} error={getFieldErrorMessage("date_ouverture")} />
        <ReadOnlyField label="Nombre de table-bancs" value={regularisation.nbr_tablebanc} error={getFieldErrorMessage("nbr_tablebanc")} />
        <ReadOnlyField label="Nombre d'années d'existant" value={regularisation.nombre_annee} />
        <ReadOnlyField label="Nombre de latrines Filles" value={regularisation.latrine_f ?? 0} />
        <ReadOnlyField label="Nombre de latrines Garçons" value={regularisation.latrine_g ?? 0} />
        <ReadOnlyField label="Total latrines" value={regularisation.latrine_total ?? 0} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm sm:text-base">Personnel enseignant existant (historique ORS)</CardTitle>
        </CardHeader>
        <CardContent>
          {personnelExistant.length === 0 ? (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>Aucune donnée de personnel enseignant n'a été retrouvée dans l'ORS pour cet établissement.</span>
            </div>
          ) : (
            <DynamicTable columns={COLONNES_PERSONNEL_ORS} rows={personnelExistant}
              onChangeRows={setPersonnelExistant} addLabel="" readOnly />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm sm:text-base">Renseignements du personnel</CardTitle>
        </CardHeader>
        <CardContent>
          {personnelDetail.length === 0 ? (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>Aucune information détaillée du personnel n'a été retrouvée dans l'ORS.</span>
            </div>
          ) : (
            <DynamicTable columns={COLONNES_PERSONNEL_DETAIL} rows={personnelDetail}
              onChangeRows={setPersonnelDetail} addLabel="" readOnly />
          )}
        </CardContent>
      </Card>
    </div>
  );
}