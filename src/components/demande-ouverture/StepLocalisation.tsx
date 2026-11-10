// @ts-nocheck
import { Loader2, AlertTriangle, MapPin, Navigation, Info, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { INPUT_CLS } from "@/constants/demandeOuvertureConfig";
import { SectionBar, Field } from "./FormulaireUI";
import { SelectAvecRecherche } from "@/components/ui/select-recherche";

/* ============================================================
   HELPERS
============================================================ */

function formaterDistance(alt) {
  if (alt.distance_m != null) {
    const distance = Number(alt.distance_m);
    return distance >= 1000
      ? `${(distance / 1000).toFixed(2)} km`
      : `${Math.round(distance)} m`;
  }
  if (alt.distance_km != null) {
    return `${Number(alt.distance_km).toFixed(2)} km`;
  }
  return "";
}

function obtenirCoordonnees(obj) {
  if (!obj) return null;
  const latitude = Number(obj.latitude ?? obj.lat ?? obj.latitude_village);
  const longitude = Number(obj.longitude ?? obj.long ?? obj.lon ?? obj.longitude_village);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180 ||
    (latitude === 0 && longitude === 0)
  ) {
    return null;
  }
  return { latitude, longitude };
}

function calculerDirection(villageInitial, villageAlternatif) {
  const origine = obtenirCoordonnees(villageInitial);
  const destination = obtenirCoordonnees(villageAlternatif);
  if (!origine || !destination) {
    return { nom: "Direction indisponible", symbole: "📍", angle: null };
  }
  const toRad = (valeur) => valeur * Math.PI / 180;
  const lat1 = toRad(origine.latitude);
  const lat2 = toRad(destination.latitude);
  const dLon = toRad(destination.longitude - origine.longitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const angle = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  const directions = [
    { nom: "Nord", symbole: "↑" },
    { nom: "Nord-Est", symbole: "↗" },
    { nom: "Est", symbole: "→" },
    { nom: "Sud-Est", symbole: "↘" },
    { nom: "Sud", symbole: "↓" },
    { nom: "Sud-Ouest", symbole: "↙" },
    { nom: "Ouest", symbole: "←" },
    { nom: "Nord-Ouest", symbole: "↖" },
  ];
  const index = Math.round(angle / 45) % 8;
  return { ...directions[index], angle };
}

function obtenirNomVillage(v) {
  return v?.nom ?? v?.name ?? v?.nom_village ?? "";
}

function obtenirIdVillage(v) {
  return v?.id ?? v?.code ?? v?.code_village ?? "";
}

function optionsUniques(options = []) {
  return [...new Set(
    (Array.isArray(options) ? options : [])
      .filter(Boolean)
      .map((v) => String(v).trim())
      .filter(Boolean)
  )];
}

function estAlternativeSelectionnable(alt) {
  if (!alt) return false;
  return Boolean(
    alt.nom ||
    alt.code_village ||
    (alt.latitude != null && alt.longitude != null)
  );
}

function identifiantAlternative(alt, idx) {
  if (alt?.code_village != null && alt.code_village !== "") {
    return `code:${alt.code_village}`;
  }
  if (alt?.latitude != null && alt?.longitude != null) {
    return `geo:${alt.latitude},${alt.longitude}`;
  }
  return `idx:${idx}`;
}

function genererLibelleZone(alt, direction, distanceTxt) {
  const parts = [];
  if (distanceTxt) parts.push(distanceTxt);
  if (alt.commune) parts.push(alt.commune);
  if (direction?.nom && direction.nom !== "Direction indisponible") {
    parts.push(`au ${direction.nom.toLowerCase()}`);
  }
  return parts.join(", ");
}

/* ============================================================
   COMPOSANT
============================================================ */

export default function StepLocalisation({
  form,
  locSelection,
  locOptions,
  localisationDetail,
  villagesFokontany,
  villagesFokontanyLoading,
  villageLoading,
  changeLocSelection,
  changeLocalisationDetail,
  getFieldErrorClass,
  getFieldErrorMessage,
  hasFieldError,
  isAdmin,
  isCISCO,
  nomDren,
  nomCisco,
  eligibiliteVillageErreur = "",
  villagesAlternatifsProposes = [],
  onChoisirVillageAlternatif,
  codeVillageSelectionne = "",
  zoneProposeeSelectionnee = null,
}) {

  const listeVillages = Array.isArray(villagesFokontany)
    ? villagesFokontany
    : [];

  const villageInitial = listeVillages.find(
    (v) =>
      String(obtenirIdVillage(v)) ===
      String(codeVillageSelectionne)
  ) || listeVillages.find(
    (v) => obtenirNomVillage(v) === localisationDetail.village
  );

  const handleChangeVillage = (valeur) => {
    const index = listeVillages.findIndex((v, i) => {
      const id = obtenirIdVillage(v);
      const value = id !== ""
        ? String(id)
        : `${obtenirNomVillage(v)}#${i}`;
      return value === String(valeur);
    });
    if (index === -1) return;
    const village = listeVillages[index];
    const nom = obtenirNomVillage(village);
    const id = obtenirIdVillage(village);
    if (!nom) return;
    changeLocalisationDetail("village", nom, id !== "" ? id : valeur);
  };

  const nomsDoublons = (() => {
    const vus = new Set();
    const doublons = new Set();
    listeVillages.forEach((v) => {
      const nom = obtenirNomVillage(v);
      if (vus.has(nom)) doublons.add(nom);
      vus.add(nom);
    });
    return doublons;
  })();

  const choisirAlternatif = (alt) => {
    if (!estAlternativeSelectionnable(alt)) return;
    if (typeof onChoisirVillageAlternatif === "function") {
      onChoisirVillageAlternatif(alt);
    }
  };

  const rayonLabel =
    form.niveau_etab === "Préscolaire"
      ? "moins de 800 m"
      : "moins de 2 km";

  const alternatives = Array.isArray(villagesAlternatifsProposes)
    ? villagesAlternatifsProposes
    : [];

  return (
    <div className="space-y-5">

      <SectionBar
        num="2"
        title="Lieu d'implantation de l'école"
      />

      {form.type_demande === "Nouvelle création" ? (
        <>

          <div className="p-2.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 text-xs flex items-start gap-2">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              Sélectionnez en cascade le DREN, le CISCO, le ZAP,
              la Commune et le Fokontany, puis choisissez le village.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">

            <Field label="DREN" error={getFieldErrorMessage("dren")}>
              <SelectAvecRecherche
                value={locSelection.dren || ""}
                onValueChange={(v) => changeLocSelection("dren", v)}
                options={optionsUniques(locOptions.dren)}
                placeholder="Sélectionner un DREN"
                searchPlaceholder="Rechercher un DREN..."
                className={cn("h-9 w-full", getFieldErrorClass("dren"))}
              />
            </Field>

            <Field label="CISCO" error={getFieldErrorMessage("cisco")}>
              <SelectAvecRecherche
                value={locSelection.cisco || ""}
                onValueChange={(v) => changeLocSelection("cisco", v)}
                options={optionsUniques(locOptions.cisco)}
                placeholder="Sélectionner un CISCO"
                searchPlaceholder="Rechercher un CISCO..."
                className={cn("h-9 w-full", getFieldErrorClass("cisco"))}
                disabled={!locSelection.dren}
              />
            </Field>

            <Field label="ZAP" error={getFieldErrorMessage("zap")}>
              <SelectAvecRecherche
                value={locSelection.zap || ""}
                onValueChange={(v) => changeLocSelection("zap", v)}
                options={optionsUniques(locOptions.zap)}
                placeholder={
                  !locSelection.cisco
                    ? "Sélectionnez d'abord un CISCO"
                    : locOptions.zap.length === 0
                      ? "Aucun ZAP disponible"
                      : "Sélectionner un ZAP"
                }
                searchPlaceholder="Rechercher un ZAP..."
                className={cn("h-9 w-full", getFieldErrorClass("zap"))}
                disabled={!locSelection.cisco}
              />
            </Field>

            <Field label="Commune" error={getFieldErrorMessage("commune")}>
              <SelectAvecRecherche
                value={locSelection.commune || ""}
                onValueChange={(v) => changeLocSelection("commune", v)}
                options={optionsUniques(locOptions.commune)}
                placeholder="Sélectionner une commune"
                searchPlaceholder="Rechercher une commune..."
                className={cn("h-9 w-full", getFieldErrorClass("commune"))}
                disabled={!locSelection.zap}
              />
            </Field>

            <Field label="Fokontany" error={getFieldErrorMessage("fokontany")}>
              <SelectAvecRecherche
                value={locSelection.fokontany || ""}
                onValueChange={(v) => changeLocSelection("fokontany", v)}
                options={optionsUniques(locOptions.fokontany)}
                placeholder="Sélectionner un fokontany"
                searchPlaceholder="Rechercher un fokontany..."
                className={cn("h-9 w-full", getFieldErrorClass("fokontany"))}
                disabled={!locSelection.commune}
              />
            </Field>

            <Field label="Village" error={getFieldErrorMessage("village")}>
              <Select
                value={codeVillageSelectionne || ""}
                onValueChange={handleChangeVillage}
                disabled={!locSelection.fokontany || villagesFokontanyLoading}
              >
                <SelectTrigger
                  className={cn(
                    "h-9 w-full",
                    getFieldErrorClass("village"),
                    eligibiliteVillageErreur &&
                      "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                  )}
                >
                  <SelectValue
                    placeholder={
                      !locSelection.fokontany
                        ? "Sélectionnez d'abord un fokontany"
                        : villagesFokontanyLoading
                          ? "Chargement..."
                          : listeVillages.length === 0
                            ? "Aucun village trouvé"
                            : "Sélectionner un village"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {listeVillages.map((v, i) => {
                    const nom = obtenirNomVillage(v);
                    if (!nom) return null;
                    const id = obtenirIdVillage(v);
                    const valeur = id !== ""
                      ? String(id)
                      : `${nom}#${i}`;
                    const dist = Number(v?.distance_km);
                    const label =
                      nomsDoublons.has(nom) &&
                      Number.isFinite(dist)
                        ? `${nom} (${dist.toFixed(1)} km du centre)`
                        : nom;
                    return (
                      <SelectItem key={valeur} value={valeur}>
                        {label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              {eligibiliteVillageErreur && (
                <p className="text-xs text-blue-700 dark:text-blue-400 flex items-start gap-1 mt-1">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{eligibiliteVillageErreur}</span>
                </p>
              )}

              {zoneProposeeSelectionnee && (
                <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-start gap-1 mt-1">
                  <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>
                    Zone proposée sélectionnée :{" "}
                    <strong>
                      {zoneProposeeSelectionnee.nom ||
                        `zone (${zoneProposeeSelectionnee.code_village || "centroïde"})`}
                    </strong>
                    {zoneProposeeSelectionnee.distance_km != null && (
                      <>
                        {" — "}
                        {Number(zoneProposeeSelectionnee.distance_km).toFixed(2)} km
                      </>
                    )}
                  </span>
                </p>
              )}
            </Field>

          </div>

          {alternatives.length > 0 && (
            <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/20 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    Zone éligible proposée
                  </h4>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                    {alternatives.length} zone{alternatives.length > 1 ? "s" : ""} disponible{alternatives.length > 1 ? "s" : ""} à {rayonLabel} du village sélectionné
                  </p>
                </div>
              </div>

              {villageInitial && !obtenirCoordonnees(villageInitial) && (
                <p className="text-xs text-blue-800 dark:text-blue-300 italic">
                  Les coordonnées GPS du village sélectionné ne sont pas disponibles. La direction ne peut pas être calculée.
                </p>
              )}

              <div className="space-y-2">
                {alternatives.map((alt, idx) => {
                  const aUnNom = Boolean(alt.nom);
                  const selectionnable = estAlternativeSelectionnable(alt);
                  const distanceTxt = formaterDistance(alt);
                  const direction = calculerDirection(villageInitial, alt);
                  const cle = identifiantAlternative(alt, idx);

                  const estSelectionnee = Boolean(
                    zoneProposeeSelectionnee &&
                    ((zoneProposeeSelectionnee.code_village &&
                      alt.code_village &&
                      String(zoneProposeeSelectionnee.code_village) === String(alt.code_village)) ||
                     (zoneProposeeSelectionnee.latitude != null &&
                      zoneProposeeSelectionnee.longitude != null &&
                      alt.latitude != null &&
                      alt.longitude != null &&
                      Math.abs(Number(zoneProposeeSelectionnee.latitude) - Number(alt.latitude)) < 1e-6 &&
                      Math.abs(Number(zoneProposeeSelectionnee.longitude) - Number(alt.longitude)) < 1e-6))
                  );

                  const titrePrincipal = aUnNom
                    ? alt.nom
                    : `Point centroïde, sans nom`;

                  const sousTitre = genererLibelleZone(alt, direction, distanceTxt);

                  return (
                    <label
                      key={cle}
                      htmlFor={`zone-${cle}`}
                      className={cn(
                        "relative flex items-start gap-3 rounded-lg border bg-white dark:bg-slate-900 p-3 cursor-pointer transition-all",
                        estSelectionnee
                          ? "border-blue-500 ring-2 ring-blue-500/20 dark:border-blue-400"
                          : "border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700",
                        !selectionnable && "opacity-60 cursor-not-allowed"
                      )}
                    >
                      <input
                        type="radio"
                        id={`zone-${cle}`}
                        name="zone-eligible-proposee"
                        checked={estSelectionnee}
                        disabled={!selectionnable}
                        onChange={() => choisirAlternatif(alt)}
                        className="mt-1 h-4 w-4 shrink-0 accent-blue-600 cursor-pointer disabled:cursor-not-allowed"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {titrePrincipal}
                            </p>
                            {sousTitre && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {sousTitre}
                              </p>
                            )}
                          </div>

                          {direction.nom !== "Direction indisponible" && (
                            <span
                              className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                              title="Direction géographique par rapport au village initial"
                            >
                              <Navigation className="h-3 w-3" />
                              {direction.symbole} {direction.nom}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-muted-foreground">
                          {distanceTxt && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {distanceTxt}
                            </span>
                          )}
                          {alt.fokontany && (
                            <span>
                              <strong className="font-medium text-foreground/80">Fokontany :</strong> {alt.fokontany}
                            </span>
                          )}
                          {alt.code_village && (
                            <span>
                              <strong className="font-medium text-foreground/80">Code :</strong> {alt.code_village}
                            </span>
                          )}
                        </div>

                        {estSelectionnee && (
                          <p className="text-[11px] text-blue-700 dark:text-blue-300 font-medium mt-1.5 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Zone sélectionnée
                          </p>
                        )}

                        {!selectionnable && (
                          <p className="text-[11px] italic text-muted-foreground mt-1">
                            Coordonnées indisponibles — sélection impossible
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {locSelection.fokontany &&
            localisationDetail.village &&
            villageLoading &&
            !eligibiliteVillageErreur && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Récupération des informations depuis l'ORS...
              </div>
            )}

        </>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {[
            ["Village", localisationDetail.village],
            ["Fokontany", localisationDetail.fokontany],
            ["Commune", localisationDetail.commune],
            ["Zap", localisationDetail.zap],
            ["CISCO", localisationDetail.cisco],
            ["DREN", localisationDetail.dren],
          ].map(([label, valeur]) => (
            <Field key={label} label={label}>
              <Input
                className={cn(INPUT_CLS, "bg-muted")}
                value={valeur || ""}
                readOnly
              />
            </Field>
          ))}
        </div>
      )}

    </div>
  );
}