// @ts-nocheck
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { INPUT_CLS } from "@/constants/demandeOuvertureConfig";
import { SectionBar, Field } from "./FormulaireUI";
import DynamicTable, { EvolutionEffectifsSaisieTable } from "./DynamicTable";

export default function StepNouvelleCreation({
  form, niveauKey, cfg,
  nouvelleCreation, changeNouvelleCreation,
  evolutionSaisie, setEvolutionSaisie,
  ressources, changeEnseignants,
  getFieldErrorClass, getFieldErrorMessage, getTableErrors,
}) {
  return (
    <div className="space-y-5">
      <SectionBar
        num="3"
        title={form.sous_type === "provisoire" ? "Informations d'ouverture provisoire" : "Informations du Nouvelle création"}
        sub={form.sous_type === "provisoire" ? "L'école existe déjà de fait" : ""}
        accent={form.sous_type === "provisoire" ? "amber" : "green"}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {[
          ["nombre_tablebanc_prevus", "Nombre de table-bancs"],
          ["surface_terrain_prevu", "Surface de terrain (m²)"],
        ].map(([key, label]) => (
          <Field key={key} label={label} error={getFieldErrorMessage(key)}>
            <Input className={cn(INPUT_CLS, getFieldErrorClass(key))} type="text"
              value={nouvelleCreation[key]}
              onChange={(e) => changeNouvelleCreation(key, e.target.value)} />
          </Field>
        ))}

        <Field label="Type de bâtiment prévu" error={getFieldErrorMessage("type_batiment_prevu")}>
          <Select value={nouvelleCreation.type_batiment_prevu}
            onValueChange={(v) => changeNouvelleCreation("type_batiment_prevu", v)}>
            <SelectTrigger className={cn("h-9 w-full", getFieldErrorClass("type_batiment_prevu"))}>
              <SelectValue placeholder="Sélectionner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="En dur">En dur</SelectItem>
              <SelectItem value="Semi-dur">Semi-dur</SelectItem>
              <SelectItem value="Tout en matériaux locaux">Tout en matériaux locaux</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Nombre salle de classe prévu" error={getFieldErrorMessage("nombre_salle_prevu")}>
          <Input className={cn(INPUT_CLS, getFieldErrorClass("nombre_salle_prevu"))} type="text"
            value={nouvelleCreation.nombre_salle_prevu}
            onChange={(e) => changeNouvelleCreation("nombre_salle_prevu", e.target.value)} />
        </Field>

        <Field label="Nombre de latrines Garçons" error={getFieldErrorMessage("latrine_g")}>
          <Input type="number" min="0" className={cn(INPUT_CLS, getFieldErrorClass("latrine_g"))}
            value={nouvelleCreation.latrine_g}
            onChange={(e) => changeNouvelleCreation("latrine_g", e.target.value)} placeholder="0" />
        </Field>

        <Field label="Nombre de latrines Filles" error={getFieldErrorMessage("latrine_f")}>
          <Input type="number" min="0" className={cn(INPUT_CLS, getFieldErrorClass("latrine_f"))}
            value={nouvelleCreation.latrine_f}
            onChange={(e) => changeNouvelleCreation("latrine_f", e.target.value)} placeholder="0" />
        </Field>

        {form.sous_type === "provisoire" && (
          <Field label="Date d'ouverture de fait" error={getFieldErrorMessage("date_ouverture_fait")}>
            <Input type="date" className={cn(INPUT_CLS, getFieldErrorClass("date_ouverture_fait"))}
              value={nouvelleCreation.date_ouverture_fait}
              onChange={(e) => changeNouvelleCreation("date_ouverture_fait", e.target.value)} />
          </Field>
        )}
      </div>

      {form.sous_type === "provisoire" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm sm:text-base">Évolution des effectifs</CardTitle>
          </CardHeader>
          <CardContent>
            <EvolutionEffectifsSaisieTable niveauKey={niveauKey} rows={evolutionSaisie}
              onChangeRows={setEvolutionSaisie} errors={getTableErrors()} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm sm:text-base">Liste des enseignants</CardTitle>
        </CardHeader>
        <CardContent>
          <DynamicTable columns={cfg.colonnesEnseignant} rows={ressources.enseignants}
            onChangeRows={changeEnseignants} addLabel="Ajouter un enseignant"
            rowStatusFn={() => ""} errors={getTableErrors()} />
        </CardContent>
      </Card>
    </div>
  );
}