// @ts-nocheck
import { useEffect, useMemo, useRef } from "react";
import {
  Loader2, AlertTriangle, Info, User, School, ClipboardList, MapPin,
  Building2, FileText, Eye, Download, Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import {
  buildAnalyseContext, analyserNormes, detectPhase,
} from "@/services/normesAnalyse";

import {
  getEnseignantsAnalyse, getInfoComplementaireAnalyse, getEtablissementsProchesAnalyse,
  getAireRecrutementAnalyse, getEvolutionEffectifsAnalyse, getPiecesAnalyse,
  niveauToKey, calculerDernierEffectifConnu, getCodeProvisoireMen,
  getAccessibiliteSite, getDistancePlusProche, premierNonVide,
  getSousTypeKey, getLibelleTypeDemande, mapNiveau, getLocalisationValue,
  getLatitude, getLongitude, normaliserEvolutionPourAffichage,
  getVillageNonEligible, getZoneProposee,
} from "@/utils/demandeHelpers";

import {
  NIVEAU_COLONNES_EFFECTIF, PROXIMITE_CONFIG, CLES_INFO_INTERNES,
  COLONNES_PROCHES, COLONNES_PERSONNEL_ORS,
  getColonnesAireParNiveau, getTitreAireParNiveau, getColonnesEnseignantParNiveau,
} from "./ConstantesColonnes";

import AnalyseInline, { normaliserStatutAnalyse } from "./AnalyseInline";
import { InfoRow, DataTable, dateFR } from "./InfoRowEtDataTable";
import DemandeLocalisationMap from "./DemandeLocalisationMap";
import BoutonFicheTechnique from "./BoutonFicheTechnique";

/* ============================================================
 * HELPERS — direction géographique + format libellé zone
 * ============================================================ */

function _coordonnees(obj) {
  if (!obj) return null;
  const lat = Number(obj.latitude ?? obj.lat);
  const lng = Number(obj.longitude ?? obj.lng ?? obj.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

function calculerDirection(origine, destination) {
  const o = _coordonnees(origine);
  const d = _coordonnees(destination);
  if (!o || !d) return null;

  const toRad = (v) => (v * Math.PI) / 180;
  const lat1 = toRad(o.lat);
  const lat2 = toRad(d.lat);
  const dLon = toRad(d.lng - o.lng);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  const angle = (Math.atan2(y, x) * 180) / Math.PI;
  const normalise = (angle + 360) % 360;

  const directions = [
    "Nord", "Nord-Est", "Est", "Sud-Est",
    "Sud", "Sud-Ouest", "Ouest", "Nord-Ouest",
  ];

  return directions[Math.round(normalise / 45) % 8];
}

function formaterDistance(zone) {
  if (!zone) return null;
  const km = Number(zone.distance_km);
  if (Number.isFinite(km) && km >= 0) {
    return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`;
  }
  const m = Number(zone.distance_m);
  if (Number.isFinite(m) && m >= 0) {
    return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;
  }
  return null;
}

function genererLibelleZoneEligible(zone, villageNonEligible, villageReference) {
  if (!zone) return "";

  const morceaux = [];
  if (zone.nom) {
    morceaux.push(`point centroïde (${zone.nom})`);
  } else {
    morceaux.push("point centroïde (sans nom)");
  }

  const origine = villageNonEligible || villageReference;
  const direction = calculerDirection(origine, zone);
  if (direction) morceaux.push(`au ${direction.toLowerCase()}`);

  const distanceTxt = formaterDistance(zone);
  const nomVillage =
    (villageNonEligible && villageNonEligible.nom) ||
    (villageReference && villageReference.nom) ||
    "—";

  if (distanceTxt) {
    morceaux.push(`${distanceTxt} par rapport au village ${nomVillage} sélectionné non éligible`);
  } else {
    morceaux.push(`par rapport au village ${nomVillage} sélectionné non éligible`);
  }

  return morceaux.join(", ");
}

function AnalyseGlobaleInline({ verdict, analyse }) {
  return null;
}

export default function DemandeDetailModal({ ouvert, onClose, chargement, erreur, demande }) {
  const contexteAnalyse = useMemo(() => {
    if (!demande) return null;
    try {
      const base = buildAnalyseContext({
        details: demande,
        enseignants: getEnseignantsAnalyse(demande),
        infoComplementaire: getInfoComplementaireAnalyse(demande),
        etablissementsProches: getEtablissementsProchesAnalyse(demande),
        aireRecrutement: getAireRecrutementAnalyse(demande),
        evolutionEffectifs: getEvolutionEffectifsAnalyse(demande),
        pieces: getPiecesAnalyse(demande),
        niveauKey: niveauToKey(demande?.niveau_etab || demande?.niveau),
        surfaceTerrain: premierNonVide(
          demande?.nouvelle_creation?.surface_terrain_prevu,
          demande?.regularisation?.surface_terrain,
          demande?.ressources?.surface_terrain,
        ),
      });

      const effectifDerniereAnnee = calculerDernierEffectifConnu(demande);
      const codeProvisoireMen = getCodeProvisoireMen(demande);
      const accessibilite = getAccessibiliteSite(demande);
      const distancePlusProche = getDistancePlusProche(demande);

      return {
        ...base,
        effectif_total: effectifDerniereAnnee,
        effectif: effectifDerniereAnnee,
        nombre_eleves: effectifDerniereAnnee,
        code_provisoire: codeProvisoireMen,
        code_provisoire_men: codeProvisoireMen,
        code_etab: codeProvisoireMen,
        accessibilite_site: accessibilite,
        accessibilite: accessibilite,
        distance_plus_proche: distancePlusProche,
        regularisation: demande?.regularisation || null,
        nouvelle_creation: demande?.nouvelle_creation || null,
        surfaceTerrain: premierNonVide(
          demande?.nouvelle_creation?.surface_terrain_prevu,
          demande?.regularisation?.surface_terrain,
          demande?.ressources?.surface_terrain,
        ),
      };
    } catch (error) {
      console.error("Erreur construction du contexte d'analyse :", error);
      return null;
    }
  }, [demande]);

  const analyseNormes = useMemo(() => {
    if (!contexteAnalyse) return null;
    try { return analyserNormes(contexteAnalyse, detectPhase(contexteAnalyse)); }
    catch (error) { console.error("Erreur analyse automatique des normes :", error); return null; }
  }, [contexteAnalyse]);

  const verdictAnalyse = useMemo(() => {
    if (!analyseNormes) {
      return {
        statut: "non_conforme", conforme: false,
        nonConformes: 1, nonVerifiables: 0, conformes: 0, total: 0,
        verdict: "non_conforme",
        message: "ANALYSE NON VALIDÉE : les informations nécessaires à l'analyse sont incomplètes.",
      };
    }
    const items = Array.isArray(analyseNormes.items) ? analyseNormes.items : [];
    const summary = analyseNormes.summary || {};
    const nonConformes = items.filter((i) => {
      const s = normaliserStatutAnalyse(i);
      return s !== "conforme" && s !== "non_applicable";
    }).length;
    const conformes = items.filter((i) => normaliserStatutAnalyse(i) === "conforme").length;
    const total = Number(summary.total ?? items.length);
    const invalide = nonConformes > 0 || analyseNormes.verdict !== "validee" || items.length === 0;
    return {
      statut: invalide ? "non_conforme" : "conforme",
      conforme: !invalide,
      nonConformes: invalide ? Math.max(1, nonConformes) : 0,
      nonVerifiables: 0, conformes, total,
      verdict: invalide ? "non_conforme" : "validee",
      message: invalide ? analyseNormes.message || "ANALYSE NON VALIDÉE"
        : analyseNormes.message || "ANALYSE VALIDÉE : toutes les informations obligatoires sont conformes.",
    };
  }, [analyseNormes]);

  const vueCarteRef = useRef(null);
  useEffect(() => { vueCarteRef.current = null; }, [demande]);

  if (!ouvert) return null;

  const niveauKey = niveauToKey(demande?.niveau_etab || demande?.niveau);

  const typeDemandeNormalise = String(demande?.type_demande || "")
    .trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const estNouvelleCreation =
    typeDemandeNormalise === "nouvelle creation" ||
    typeDemandeNormalise === "nouvelle_creation" ||
    typeDemandeNormalise === "creation";

  const estRegularisation = typeDemandeNormalise.includes("regularisation");

  const sousTypeKey = estNouvelleCreation ? getSousTypeKey(demande) : null;
  const estProvisoire = sousTypeKey === "provisoire";
  const libelleTypeDemande = getLibelleTypeDemande(demande?.type_demande, sousTypeKey);
  const libelleSousType = sousTypeKey ? { creation: "Nouvelle", provisoire: "Ouverture provisoire" }[sousTypeKey] : null;

  const villageNonEligible = getVillageNonEligible(demande);
  const zoneProposee = getZoneProposee(demande);

  const villageReference = {
    nom: getLocalisationValue(demande, "village"),
    latitude: getLatitude(demande),
    longitude: getLongitude(demande),
    commune: getLocalisationValue(demande, "commune"),
    fokontany: getLocalisationValue(demande, "fokontany"),
  };

  const libelleZoneEligible = genererLibelleZoneEligible(
    zoneProposee,
    villageNonEligible,
    villageReference
  );

  const colonnesEffectif = NIVEAU_COLONNES_EFFECTIF[niveauKey] || [];
  const piecesData = getPiecesAnalyse(demande);
  const etablissementsProches = getEtablissementsProchesAnalyse(demande);
  const aireRecrutement = getAireRecrutementAnalyse(demande);
  const aireSansCoord = demande?.aire_recrutement_sans_coord || [];

  const colonnesAire = getColonnesAireParNiveau(niveauKey);
  const colonnesEnseignant = getColonnesEnseignantParNiveau(niveauKey);
  const titreAire = getTitreAireParNiveau(niveauKey);

  const colonnesEvolution = [
    { key: "annee", label: "Année" },
    ...colonnesEffectif,
    { key: "effectif_total", label: "Total" },
  ];

  const infoComp = demande?.info_complementaire || demande?.information_complementaire_detail || {};

  const proxCfg = PROXIMITE_CONFIG[niveauKey] || PROXIMITE_CONFIG.primaire;
  const existeProche =
    typeof infoComp?.existe_proche === "boolean"
      ? infoComp.existe_proche
      : infoComp?.existe_proche !== undefined && infoComp?.existe_proche !== null && infoComp?.existe_proche !== ""
        ? String(infoComp.existe_proche).toLowerCase() === "true"
        : Array.isArray(etablissementsProches) && etablissementsProches.length > 0;
  const distancePlusProcheAffichee = premierNonVide(
    infoComp?.distance_plus_proche,
    getDistancePlusProche(demande),
  );

  const nouvelleCreationData = demande?.nouvelle_creation || null;
  const dateOuvertureFait =
    nouvelleCreationData?.date_ouverture_fait ?? demande?.date_ouverture_fait ?? null;
  const evolutionProvisoire = estProvisoire ? normaliserEvolutionPourAffichage(demande) : [];

  const analyseValidee = verdictAnalyse?.conforme === true;

  return (
    <Dialog open={ouvert} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[1100px] max-w-[1100px] max-h-[94dvh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="border-b px-6 py-4 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-semibold">
                Détail de la demande
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {demande?.nom_etab
                  ? `Consultation du dossier du ${demande.nom_etab}`
                  : "Consultation du dossier de demande"}
              </DialogDescription>
            </div>
            {demande?.reference && (
              <div className="text-left sm:text-right text-[11px] leading-tight text-muted-foreground">
                <div><strong>Référence :</strong> {demande.reference}</div>
                <div><strong>Niveau :</strong> {mapNiveau(demande?.niveau_etab)}</div>
                <div className="mt-1 pt-1 border-t font-medium text-foreground">
                  {demande?.commune || ""} · {demande?.cisco || ""}
                </div>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
          {chargement && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Chargement…</p>
            </div>
          )}

          {erreur && !chargement && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{erreur}</span>
            </div>
          )}

          {demande && !chargement && !erreur && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-muted/50 border">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={analyseValidee ? "default" : "secondary"}
                    className={cn(
                      "text-xs",
                      analyseValidee
                        ? "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/10"
                        : "bg-muted text-muted-foreground border border-border"
                    )}
                  >
                    {analyseValidee ? "✓ Analyse validée" : "⚠ Analyse non validée"}
                  </Badge>
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {analyseValidee ? "Les conditions essentielles sont respectées." : "Certaines conditions ne sont pas respectées."}
                  </span>
                </div>
                <BoutonFicheTechnique demande={demande} analyseValidee={analyseValidee} vueRef={vueCarteRef} />
              </div>

              <AnalyseGlobaleInline verdict={verdictAnalyse} analyse={analyseNormes} />

              <Tabs defaultValue="general" className="w-full">
                <TabsList className="flex w-full flex-wrap h-auto bg-muted/50 p-1">
                  <TabsTrigger value="general" className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">Général</TabsTrigger>
                  <TabsTrigger value="localisation" className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">Localisation</TabsTrigger>
                  {estNouvelleCreation && (
                    <TabsTrigger value="nouvelle_creation" className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                      {estProvisoire ? "Ouv. provisoire" : "Nouv. création"}
                    </TabsTrigger>
                  )}
                  {estRegularisation && (
                    <TabsTrigger value="regularisation" className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                      Régularisation
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="proximite" className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">Proximité</TabsTrigger>
                  <TabsTrigger value="recrutement" className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">Recrutement</TabsTrigger>
                  <TabsTrigger value="pieces" className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">Pièces</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <User className="h-4 w-4 text-primary" /> Demandeur
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <InfoRow label="Nom" value={demande.nom_demandeur} />
                        <InfoRow label="Téléphone" value={demande.telephone_demandeur} />
                        <InfoRow label="Email" value={demande.email_demandeur} />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <School className="h-4 w-4 text-primary" /> Établissement
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <InfoRow label="Nom" value={demande.nom_etab} />
                        {!estNouvelleCreation && <InfoRow label="Code" value={demande.code_etab} />}
                        <InfoRow label="Niveau" value={mapNiveau(demande.niveau_etab)} />
                        <InfoRow label="Statut juridique" value={demande.statut_juridique} />
                      </CardContent>
                    </Card>

                    <Card className="md:col-span-2">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <ClipboardList className="h-4 w-4 text-primary" /> Demande
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <InfoRow label="Type de demande" value={libelleTypeDemande} />
                        <InfoRow label="Date de dépôt" value={dateFR(demande.date_depot)} />
                        <InfoRow label="N° de demande" value={demande.id_demande} />
                      </CardContent>
                    </Card>
                  </div>

                  <AnalyseInline
                    analyse={analyseNormes}
                    ids={[
                      "critere-locaux", "critere-salle", "critere-salles-appartenance",
                      "critere-latrines", "critere-educateur", "critere-domaine-scolaire",
                      "critere-enseignants", "critere-enseignants-total",
                      "critere-enseignants-etat", "critere-enseignants-fram",
                      "critere-non-configure",
                    ]}
                    titre="Analyse automatique des informations générales"
                  />
                </TabsContent>

                <TabsContent value="localisation" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" /> Lieu d'implantation
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <InfoRow label="Village" value={getLocalisationValue(demande, "village")} />
                        <InfoRow label="Fokontany" value={getLocalisationValue(demande, "fokontany")} />
                        <InfoRow label="Commune" value={getLocalisationValue(demande, "commune")} />
                        <InfoRow label="ZAP" value={getLocalisationValue(demande, "zap")} />
                        <InfoRow label="CISCO" value={getLocalisationValue(demande, "cisco")} />
                        <InfoRow label="DREN" value={getLocalisationValue(demande, "dren")} />
                        <InfoRow label="Latitude" value={getLatitude(demande)} />
                        <InfoRow label="Longitude" value={getLongitude(demande)} />

                        {estNouvelleCreation && !estProvisoire && zoneProposee && (
                          <InfoRow
                            label="Zone éligible proposée"
                            value={libelleZoneEligible || "—"}
                          />
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" /> Carte de localisation ORS
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <DemandeLocalisationMap
                        demande={demande}
                        etablissementsProches={etablissementsProches}
                        aireRecrutement={aireRecrutement}
                        aireSansCoord={aireSansCoord}
                        vueRef={vueCarteRef}
                        masquerAireVoisins={true}
                      />
                    </CardContent>
                  </Card>

                  {/* ✅ ICI LA CORRECTION : Sans conteneur et uniquement critere-central */}
                  <AnalyseInline
                    analyse={analyseNormes}
                    ids={["critere-central"]}
                    sansConteneur={true}
                  />
                </TabsContent>

                {estNouvelleCreation && (
                  <TabsContent value="nouvelle_creation" className="space-y-4 mt-4">
                    <div
                      className={cn(
                        "p-2.5 rounded-lg border text-xs flex items-start gap-2",
                        estProvisoire
                          ? "border-border bg-muted/50 text-foreground"
                          : "border-primary/30 bg-primary/5 text-foreground"
                      )}
                    >
                      <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                      <span>
                        <strong>{libelleTypeDemande}</strong>
                        {estProvisoire
                          ? " — L'école existe déjà de fait : la date d'ouverture de fait et l'évolution des effectifs sont renseignées."
                          : " — L'école n'existe pas encore : les informations ci-dessous sont des prévisions."}
                      </span>
                    </div>

                    {nouvelleCreationData && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">
                            {estProvisoire
                              ? "Informations d'ouverture provisoire"
                              : "Informations de nouvelle création"}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <InfoRow label="Nb table-bancs" value={nouvelleCreationData.nombre_tablebanc_prevus} />
                          <InfoRow label="Surface terrain prévue (m²)" value={nouvelleCreationData.surface_terrain_prevu} />
                          <InfoRow label="Type de bâtiment prévu" value={nouvelleCreationData.type_batiment_prevu} />
                          <InfoRow label="Nb salle prévu" value={nouvelleCreationData.nombre_salle_prevu} />
                          <InfoRow label="Latrines Filles" value={nouvelleCreationData.latrine_f} />
                          <InfoRow label="Latrines Garçons" value={nouvelleCreationData.latrine_g} />
                          <InfoRow label="Total latrines" value={nouvelleCreationData.latrine_total} />
                          <InfoRow label="Latrines séparées" value={nouvelleCreationData.latrine_separee} />
                          {estProvisoire && (
                            <InfoRow label="Date d'ouverture de fait" value={dateFR(dateOuvertureFait)} />
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {estProvisoire && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Évolution des effectifs (ouverture provisoire)</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <DataTable
                            titre="Évolution des effectifs"
                            colonnes={colonnesEvolution}
                            lignes={evolutionProvisoire}
                          />
                        </CardContent>
                      </Card>
                    )}

                    {Array.isArray(demande.enseignants) && demande.enseignants.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" /> Enseignants
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <DataTable
                            titre="Enseignants"
                            colonnes={colonnesEnseignant}
                            lignes={demande.enseignants}
                          />
                        </CardContent>
                      </Card>
                    )}

                    <AnalyseInline
                      analyse={analyseNormes}
                      ids={[
                        "critere-population", "critere-population-scolarisable", "critere-locaux",
                        "critere-enseignants", "critere-enseignants-total",
                        "critere-enseignants-etat", "critere-enseignants-fram",
                      ]}
                      titre={
                        estProvisoire
                          ? "Analyse automatique de l'ouverture provisoire"
                          : "Analyse automatique de la nouvelle création"
                      }
                    />
                  </TabsContent>
                )}

                {estRegularisation && (
                  <TabsContent value="regularisation" className="space-y-4 mt-4">
                    {demande.regularisation && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Informations de la régularisation</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <InfoRow label="Nb salles" value={demande.regularisation.nombre_salle} />
                          <InfoRow label="Nb bâtiments" value={demande.regularisation.nombre_batiment} />
                          <InfoRow label="Nb salle (nbr_salle)" value={demande.regularisation.nbr_salle} />
                          <InfoRow label="Date d'ouverture" value={dateFR(demande.regularisation.date_ouverture)} />
                          <InfoRow label="Nb table-bancs" value={demande.regularisation.nbr_tablebanc} />
                          <InfoRow label="Type de bâtiment" value={demande.regularisation.type_batiment} />
                          <InfoRow label="Surface terrain (m²)" value={demande.regularisation.surface_terrain} />
                          <InfoRow label="Nb années d'existant" value={demande.regularisation.nombre_annee} />
                          <InfoRow label="Latrines Filles" value={demande.regularisation.latrine_f} />
                          <InfoRow label="Latrines Garçons" value={demande.regularisation.latrine_g} />
                          <InfoRow label="Total latrines" value={demande.regularisation.latrine_total} />
                          <InfoRow label="Latrines séparées" value={demande.regularisation.latrine_separee} />
                        </CardContent>
                      </Card>
                    )}

                    {Array.isArray(demande.personnel_existant) && demande.personnel_existant.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Personnel enseignant existant (historique ORS)</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <DataTable
                            titre="Personnel existant"
                            colonnes={COLONNES_PERSONNEL_ORS}
                            lignes={demande.personnel_existant}
                          />
                        </CardContent>
                      </Card>
                    )}

                    {Array.isArray(demande.enseignants) && demande.enseignants.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" /> Renseignements du personnel
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <DataTable
                            titre="Renseignements du personnel"
                            colonnes={colonnesEnseignant}
                            lignes={demande.enseignants.map((p) => {
                              const dateBrute = premierNonVide(
                                p?.agent_etat_entree_administration,
                                p?.premiere_prise_service_admin,
                                p?.date_entree_administrative,
                                p?.date_entree_enseignante,
                                p?.prise_service_poste_actuel,
                                p?.date_entreeAdmin,
                                p?.date_entree_admin,
                                p?.date_entree,
                                p?.date_entree_administration,
                                p?.date_entree_dans_administration,
                              );

                              return {
                                ...p,
                                date_entreeAdmin: dateBrute || "—",
                                date_entree: dateBrute || "—",
                                agent_etat_entree_administration: dateBrute || "—",
                              };
                            })}
                          />
                        </CardContent>
                      </Card>
                    )}

                    {Array.isArray(demande.evolution_effectifs) && demande.evolution_effectifs.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Évolution des effectifs (ORS)</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <DataTable
                            titre="Évolution des effectifs"
                            colonnes={colonnesEvolution}
                            lignes={normaliserEvolutionPourAffichage(demande)}
                          />
                        </CardContent>
                      </Card>
                    )}

                    <AnalyseInline analyse={analyseNormes} titre="Analyse automatique de la régularisation" />
                  </TabsContent>
                )}

                <TabsContent value="proximite" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary" /> Informations complémentaires
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <InfoRow label="Distance CISCO (km)" value={infoComp.distance_cisco} />
                      <InfoRow label="Distance DREN (km)" value={infoComp.distance_dren} />
                      <InfoRow label={proxCfg.labelExistProche} value={existeProche ? "Oui" : "Non"} />
                      {!existeProche && (
                        <InfoRow label={proxCfg.labelDistancePlusProche} value={distancePlusProcheAffichee} />
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary" /> Établissements proches
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <DataTable titre="Établissements proches" colonnes={COLONNES_PROCHES} lignes={etablissementsProches} />
                    </CardContent>
                  </Card>

                  <AnalyseInline
                    analyse={analyseNormes}
                    ids={["critere-distance", "critere-distance-lycee", "critere-distance-800m"]}
                    titre="Analyse automatique de la proximité"
                  />
                </TabsContent>

                <TabsContent value="recrutement" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" /> Carte de l'aire de recrutement
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <DemandeLocalisationMap
                        demande={demande}
                        etablissementsProches={etablissementsProches}
                        aireRecrutement={aireRecrutement}
                        aireSansCoord={aireSansCoord}
                        masquerAireVoisins={false}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{titreAire}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <DataTable
                        titre="Aire de recrutement"
                        colonnes={colonnesAire}
                        lignes={aireRecrutement}
                      />
                    </CardContent>
                  </Card>

                  {aireSansCoord.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Info className="h-4 w-4 text-muted-foreground" />
                          Éléments de l'aire sans coordonnées GPS ({aireSansCoord.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-xs text-muted-foreground mb-2">
                          Ces villages/établissements sont comptés dans l'aire de recrutement mais ne peuvent pas être affichés sur la carte.
                        </div>
                        <DataTable
                          titre="Aire sans coordonnées"
                          colonnes={colonnesAire}
                          lignes={aireSansCoord}
                        />
                      </CardContent>
                    </Card>
                  )}

                  <AnalyseInline
                    analyse={analyseNormes}
                    ids={["critere-t5", "critere-t9", "critere-enfants", "critere-population", "critere-population-scolarisable"]}
                    titre="Analyse automatique de l'aire de recrutement"
                  />
                </TabsContent>

                <TabsContent value="pieces" className="mt-4">
                  {!Array.isArray(piecesData) || piecesData.length === 0 ? (
                    <div className="p-4 bg-muted/30 rounded-lg text-sm text-muted-foreground italic text-center">
                      Aucune pièce jointe enregistrée.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {piecesData.map((piece, i) => {
                        const urlFichier = piece?.fichier || piece?.fichier_url || piece?.url || piece?.file;
                        return (
                          <Card key={i}>
                            <CardContent className="p-3 flex items-start gap-3">
                              <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-foreground truncate">
                                  {piece?.nom_piece || piece?.nom || piece?.libelle || "Pièce"}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  {urlFichier && (
                                    <>
                                      <a href={urlFichier} target="_blank" rel="noopener noreferrer"
                                        className="text-[11px] text-primary hover:underline flex items-center gap-1">
                                        <Eye className="h-3 w-3" /> Voir
                                      </a>
                                      <a href={urlFichier} download
                                        className="text-[11px] text-primary hover:underline flex items-center gap-1">
                                        <Download className="h-3 w-3" /> Télécharger
                                      </a>
                                    </>
                                  )}
                                </div>
                                <Badge variant={piece?.fourni ? "default" : "outline"} className="text-[10px] mt-1">
                                  {piece?.fourni ? "Fourni" : "Non fourni"}
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t px-6 py-3 shrink-0 bg-background">
          <DialogClose asChild>
            <Button variant="outline" size="sm">Fermer</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}