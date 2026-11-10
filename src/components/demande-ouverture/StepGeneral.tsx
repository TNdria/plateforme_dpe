// @ts-nocheck
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { INPUT_CLS, KEY_TO_NIVEAU_LABEL } from "@/constants/demandeOuvertureConfig";
import { SectionBar, Field } from "./FormulaireUI";

export default function StepGeneral({
  form, change,
  niveauKey, estRegularisation,
  rechercheEtabStatut, etablissementSelectionne,
  etablissementsTrouves, selectionnerEtablissement,
  getFieldErrorClass, getFieldErrorMessage,
  isAdmin, isDPE, getNiveauxAutorises,
}) {
  // ✅ On récupère les niveaux autorisés pour l'utilisateur
  const niveauxDisponibles = getNiveauxAutorises 
    ? getNiveauxAutorises() 
    : ["Préscolaire", "Primaire", "Collège", "Lycée"];

  // ✅ On verrouille le niveau UNIQUEMENT pour le DPE (forcé sur Lycée)
  // Pour le CISCO, le niveau est LIBRE (Préscolaire, Primaire, Collège)
  const verrouillerNiveau = isDPE || estRegularisation;

  return (
    <div className="space-y-5">
      <SectionBar num="1" title="Informations générales" sub="" accent="" />

      <Card className="bg-muted/30 border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm sm:text-base">Informations du demandeur</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <Field label="Demandeur" error={getFieldErrorMessage("nom_demandeur")}>
              <Input type="text" placeholder="le demandeur"
                className={cn(INPUT_CLS, getFieldErrorClass("nom_demandeur"))}
                value={form.nom_demandeur}
                onChange={(e) => change("nom_demandeur", e.target.value)}
                required />
            </Field>

            <Field label="Téléphone" error={getFieldErrorMessage("telephone_demandeur")}>
              <Input type="tel" placeholder="Ex. 034 00 000 00"
                className={cn(INPUT_CLS, getFieldErrorClass("telephone_demandeur"))}
                value={form.telephone_demandeur}
                onChange={(e) => change("telephone_demandeur", e.target.value)}
                required />
            </Field>

            <Field label="Email" error={getFieldErrorMessage("email_demandeur")}>
              <Input type="email" placeholder="Ex. demandeur@email.com"
                className={cn(INPUT_CLS, getFieldErrorClass("email_demandeur"))}
                value={form.email_demandeur}
                onChange={(e) => change("email_demandeur", e.target.value)}
                required />
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <Field label="Type de demande" error={getFieldErrorMessage("type_demande")}>
          <Select value={form.type_demande} onValueChange={(v) => change("type_demande", v)}>
            <SelectTrigger className={cn("h-9 w-full", getFieldErrorClass("type_demande"))}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Nouvelle création">Nouvelle création</SelectItem>
              <SelectItem value="Régularisation">Régularisation</SelectItem>
            </SelectContent>
          </Select>

          {form.type_demande === "Nouvelle création" && (
            <div className="pt-2 space-y-1">
              <span className="block text-[11px] text-muted-foreground">Précisez la nature :</span>
              <div className="flex flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="radio" name="sous_type" value="creation"
                    checked={form.sous_type === "creation"}
                    onChange={(e) => change("sous_type", e.target.value)}
                    className="w-3.5 h-3.5 accent-primary cursor-pointer" />
                  <span className="text-xs">Nouvelle création</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="radio" name="sous_type" value="provisoire"
                    checked={form.sous_type === "provisoire"}
                    onChange={(e) => change("sous_type", e.target.value)}
                    className="w-3.5 h-3.5 accent-primary cursor-pointer" />
                  <span className="text-xs">Ouverture provisoire</span>
                </label>
              </div>
            </div>
          )}
        </Field>

        {estRegularisation && (
          <div className="space-y-1">
            <label className="text-xs sm:text-sm font-medium">Code établissement</label>
            <Input placeholder="Entrer le code de l'établissement" className={INPUT_CLS}
              value={form.code_etab}
              onChange={(e) => change("code_etab", e.target.value)} />

            {rechercheEtabStatut === "loading" && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Recherche en cours…
              </p>
            )}
            {rechercheEtabStatut === "found" && etablissementSelectionne && (
              <p className="text-xs text-emerald-600 font-medium">
                Établissement trouvé ({KEY_TO_NIVEAU_LABEL[niveauKey] ?? form.niveau_etab}) :{" "}
                {etablissementSelectionne.nom_etab ?? etablissementSelectionne.NOM_ETAB}
              </p>
            )}
            {rechercheEtabStatut === "notfound" && (
              <p className="text-xs text-amber-600">Aucun établissement trouvé.</p>
            )}
            {rechercheEtabStatut === "error" && (
              <p className="text-xs text-red-600">Erreur lors de la recherche. Réessayez.</p>
            )}
            {rechercheEtabStatut === "multiple" && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-muted-foreground">Plusieurs résultats, choisissez l'établissement :</p>
                {etablissementsTrouves.map((etab) => {
                  const codeEtab = etab.code_etab ?? etab.code_etablissement ?? etab.CODE_ETAB ?? etab.id;
                  return (
                    <Button key={`${etab.__niveau}-${codeEtab}`} type="button" variant="outline" size="sm"
                      className="w-full justify-start text-xs h-auto py-1.5"
                      onClick={() => selectionnerEtablissement(etab, etab.__niveau)}>
                      <span className="truncate">
                        <span className="font-semibold">[{KEY_TO_NIVEAU_LABEL[etab.__niveau] ?? etab.__niveau}]</span>{" "}
                        {etab.nom_etab ?? etab.NOM_ETAB} ({codeEtab})
                      </span>
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <Field label="Nom de l'établissement" error={getFieldErrorMessage("nom_etab")}>
          <Input className={cn(INPUT_CLS, getFieldErrorClass("nom_etab"))}
            value={form.nom_etab}
            onChange={(e) => change("nom_etab", e.target.value)}
            required />
        </Field>

        <Field label="Niveau" error={getFieldErrorMessage("niveau_etab")}>
          {verrouillerNiveau ? (
            <Input className={cn(INPUT_CLS, "bg-muted text-muted-foreground")}
              value={form.niveau_etab || ""} readOnly disabled />
          ) : (
            <Select 
              value={form.niveau_etab || ""} 
              onValueChange={(v) => change("niveau_etab", v)}
            >
              <SelectTrigger className={cn("h-9 w-full", getFieldErrorClass("niveau_etab"))}>
                <SelectValue placeholder="Sélectionner un niveau" />
              </SelectTrigger>
              <SelectContent>
                {/* ✅ On s'assure que les 3 niveaux sont bien présents */}
                {niveauxDisponibles.includes("Préscolaire") && (
                  <SelectItem value="Préscolaire">Préscolaire</SelectItem>
                )}
                {niveauxDisponibles.includes("Primaire") && (
                  <SelectItem value="Primaire">Primaire</SelectItem>
                )}
                {niveauxDisponibles.includes("Collège") && (
                  <SelectItem value="Collège">Collège</SelectItem>
                )}
                {niveauxDisponibles.includes("Lycée") && (
                  <SelectItem value="Lycée">Lycée</SelectItem>
                )}
              </SelectContent>
            </Select>
          )}
        </Field>

        <Field label="Statut juridique" >
          {estRegularisation ? (
            <Input className={cn(INPUT_CLS, "bg-muted text-muted-foreground")}
              value={form.statut_juridique || ""} readOnly disabled />
          ) : (
            <Select value={form.statut_juridique || ""} onValueChange={(v) => change("statut_juridique", v)}>
              <SelectTrigger className={cn("h-9 w-full", getFieldErrorClass("statut_juridique"))}>
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Public">Public</SelectItem>
                <SelectItem value="Privé">Privé</SelectItem>
              </SelectContent>
            </Select>
          )}
        </Field>
      </div>
    </div>
  );
}