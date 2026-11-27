// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2, AlertTriangle, Info, User, School, ClipboardList, MapPin,
  Building2, FileText, Eye, Download, Users, ChevronRight, CheckCircle2, XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose,
} from "@/components/ui/dialog";
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

const NAVY = "bg-[#2f4a8a]";
const CARTE = "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-xl";
const LABEL_SECTION = "text-[11px] font-semibold tracking-wider uppercase text-muted-foreground";

const SEUIL_SATURATION_ELEVES = 2000;

const _estPriveEtab = (e) => {
  if (!e) return false;
  const statut = String(e.statut_juridique ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (statut === "prive") return true;
  if (statut === "public") return false;
  const secteur = e.secteur ?? e.secteur_code;
  if (secteur !== null && secteur !== undefined && String(secteur).trim() !== "") {
    const s = String(secteur).trim().toLowerCase();
    if (s !== "0" && s !== "0.0" && s !== "public") return true;
  }
  return false;
};

const _estSatureEtab = (e) => {
  if (!e) return false;
  const eff = Number(e.effectif ?? e.effectif_total ?? e.nombre_eleves ?? 0);
  return Number.isFinite(eff) && eff >= SEUIL_SATURATION_ELEVES;
};

const _haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
};

const _toNumber = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const _filtrerAireVoronoiFront = (aire, proches, futurePos, estNouvelleCreation) => {
  if (!estNouvelleCreation || !Array.isArray(aire) || !aire.length) return aire;
  if (!futurePos) return aire;

  const concurrents = (Array.isArray(proches) ? proches : [])
    .filter((p) => !_estPriveEtab(p) && !_estSatureEtab(p))
    .map((p) => {
      const lat = _toNumber(p.latitude ?? p.lat);
      const lng = _toNumber(p.longitude ?? p.lng ?? p.lon);
      return lat !== null && lng !== null ? { lat, lng } : null;
    })
    .filter(Boolean);

  if (!concurrents.length) return aire;

  return aire.filter((v) => {
    const latV = _toNumber(v.latitude ?? v.lat);
    const lngV = _toNumber(v.longitude ?? v.lng ?? v.lon);
    const dFutur = _toNumber(v.distance_future ?? v.distance_km ?? v.distance);
    if (latV === null || lngV === null || dFutur === null) return false;
    const dConc = Math.min(...concurrents.map((c) => _haversineKm(latV, lngV, c.lat, c.lng)));
    return dFutur <= dConc;
  });
};

const _extrairePositionFuture = (demande) => {
  let lat = _toNumber(demande?.latitude);
  let lng = _toNumber(demande?.longitude);
  if (lat !== null && lng !== null) return [lat, lng];

  const loc = demande?.localisation_detail || demande?.localisation || {};
  lat = _toNumber(loc.latitude ?? loc.lat);
  lng = _toNumber(loc.longitude ?? loc.lng ?? loc.lon);
  if (lat !== null && lng !== null) return [lat, lng];

  const village = demande?.village_implantation_detail || demande?.village_detail;
  if (village) {
    lat = _toNumber(village.latitude ?? village.lat);
    lng = _toNumber(village.longitude ?? village.lng ?? village.lon);
    if (lat !== null && lng !== null) return [lat, lng];
  }

  return null;
};

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
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  const angle = (Math.atan2(y, x) * 180) / Math.PI;
  const normalise = (angle + 360) % 360;

  const directions = ["Nord", "Nord-Est", "Est", "Sud-Est", "Sud", "Sud-Ouest", "Ouest", "Nord-Ouest"];
  return directions[Math.round(normalise / 45) % 8];
}

function formaterDistance(zone) {
  if (!zone) return null;
  const km = Number(zone.distance_km);
  if (Number.isFinite(km) && km >= 0) return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`;
  const m = Number(zone.distance_m);
  if (Number.isFinite(m) && m >= 0) return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;
  return null;
}

function genererLibelleZoneEligible(zone, villageNonEligible, villageReference) {
  if (!zone) return "";
  const morceaux = [];
  if (zone.nom) morceaux.push(`point centroïde (${zone.nom})`);
  else morceaux.push("point centroïde (sans nom)");

  const origine = villageNonEligible || villageReference;
  const direction = calculerDirection(origine, zone);
  if (direction) morceaux.push(`au ${direction.toLowerCase()}`);

  const distanceTxt = formaterDistance(zone);
  const nomVillage = (villageNonEligible && villageNonEligible.nom) || (villageReference && villageReference.nom) || "—";

  if (distanceTxt) morceaux.push(`${distanceTxt} par rapport au village ${nomVillage} sélectionné non éligible`);
  else morceaux.push(`par rapport au village ${nomVillage} sélectionné non éligible`);

  return morceaux.join(", ");
}

function AnalyseGlobaleInline() { return null; }

function BoutonSection({ icon: Icon, label, count, actif, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={cn(
        "group flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all duration-200",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2f4a8a]/40",
        actif
          ? `${NAVY} border-transparent text-white shadow-md`
          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-foreground hover:border-[#2f4a8a]/40 hover:bg-slate-50 dark:hover:bg-slate-800"
      )}
    >
      <span className="flex items-center gap-3 min-w-0">
        <Icon className={cn("h-4 w-4 shrink-0", actif ? "text-white" : "text-[#2f4a8a] dark:text-blue-300")} />
        <span className={cn("truncate", actif ? "font-semibold" : "font-medium")}>{label}</span>
      </span>
      <span className="flex items-center gap-2 shrink-0">
        {typeof count === "number" && (
          <span className={cn("min-w-[28px] rounded-full px-2 py-0.5 text-center text-[11px] font-bold", count > 0 ? "bg-green-600 text-white" : actif ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500 border border-slate-200")}>
            {count}
          </span>
        )}
        <ChevronRight className={cn("h-4 w-4 transition-transform duration-200", actif ? "rotate-90 text-white" : "text-muted-foreground group-hover:translate-x-0.5")} />
      </span>
    </button>
  );
}

export default function DemandeDetailModal({ ouvert, onClose, chargement, erreur, demande }) {
  const [ongletActif, setOngletActif] = useState(null);

  useEffect(() => { setOngletActif(null); }, [ouvert, demande]);
  const basculerOnglet = (key) => setOngletActif((prev) => (prev === key ? null : key));

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
        surfaceTerrain: premierNonVide(demande?.nouvelle_creation?.surface_terrain_prevu, demande?.regularisation?.surface_terrain, demande?.ressources?.surface_terrain),
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
        surfaceTerrain: premierNonVide(demande?.nouvelle_creation?.surface_terrain_prevu, demande?.regularisation?.surface_terrain, demande?.ressources?.surface_terrain),
      };
    } catch (error) { return null; }
  }, [demande]);

  const analyseNormes = useMemo(() => {
    if (!contexteAnalyse) return null;
    try { return analyserNormes(contexteAnalyse, detectPhase(contexteAnalyse)); }
    catch (error) { return null; }
  }, [contexteAnalyse]);

  const verdictAnalyse = useMemo(() => {
    if (!analyseNormes) return { statut: "non_conforme", conforme: false, nonConformes: 1, nonVerifiables: 0, conformes: 0, total: 0, verdict: "non_conforme", message: "ANALYSE NON VALIDÉE : les informations nécessaires à l'analyse sont incomplètes." };

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
      message: invalide ? analyseNormes.message || "ANALYSE NON VALIDÉE" : analyseNormes.message || "ANALYSE VALIDÉE : toutes les informations obligatoires sont conformes.",
    };
  }, [analyseNormes]);

  const vueCarteRef = useRef(null);
  useEffect(() => { vueCarteRef.current = null; }, [demande]);

  if (!ouvert) return null;

  const niveauKey = niveauToKey(demande?.niveau_etab || demande?.niveau);
  const typeDemandeNormalise = String(demande?.type_demande || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const estNouvelleCreation = typeDemandeNormalise === "nouvelle creation" || typeDemandeNormalise === "nouvelle_creation" || typeDemandeNormalise === "creation";
  const estRegularisation = typeDemandeNormalise.includes("regularisation");

  const sousTypeKey = estNouvelleCreation ? getSousTypeKey(demande) : null;
  const estProvisoire = sousTypeKey === "provisoire";
  const libelleTypeDemande = getLibelleTypeDemande(demande?.type_demande, sousTypeKey);

  const villageNonEligible = getVillageNonEligible(demande);
  const zoneProposee = getZoneProposee(demande);

  const villageReference = {
    nom: getLocalisationValue(demande, "village"),
    latitude: getLatitude(demande),
    longitude: getLongitude(demande),
    commune: getLocalisationValue(demande, "commune"),
    fokontany: getLocalisationValue(demande, "fokontany"),
  };

  const libelleZoneEligible = genererLibelleZoneEligible(zoneProposee, villageNonEligible, villageReference);

  const colonnesEffectif = NIVEAU_COLONNES_EFFECTIF[niveauKey] || [];
  const piecesData = getPiecesAnalyse(demande);
  const etablissementsProches = getEtablissementsProchesAnalyse(demande);
  const aireRecrutement = getAireRecrutementAnalyse(demande);
  const aireSansCoord = demande?.aire_recrutement_sans_coord || [];

  const aireRecrutementAffichee = (() => {
    if (!estNouvelleCreation || estRegularisation) return aireRecrutement;
    const futurePos = _extrairePositionFuture(demande);
    if (!futurePos) return aireRecrutement;
    const proches = Array.isArray(etablissementsProches) && etablissementsProches.length > 0 ? etablissementsProches : getEtablissementsProchesAnalyse(demande);
    return _filtrerAireVoronoiFront(aireRecrutement, proches, futurePos, true);
  })();

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

  const existeProche = typeof infoComp?.existe_proche === "boolean" ? infoComp.existe_proche : infoComp?.existe_proche !== undefined && infoComp?.existe_proche !== null && infoComp?.existe_proche !== "" ? String(infoComp.existe_proche).toLowerCase() === "true" : Array.isArray(etablissementsProches) && etablissementsProches.length > 0;

  const distancePlusProcheAffichee = premierNonVide(infoComp?.distance_plus_proche, getDistancePlusProche(demande));
  const nouvelleCreationData = demande?.nouvelle_creation || null;
  const dateOuvertureFait = nouvelleCreationData?.date_ouverture_fait ?? demande?.date_ouverture_fait ?? null;
  const evolutionProvisoire = estProvisoire ? normaliserEvolutionPourAffichage(demande) : [];
  const analyseValidee = verdictAnalyse?.conforme === true;

  const nbProches = Array.isArray(etablissementsProches) ? etablissementsProches.length : 0;
  const nbAire = Array.isArray(aireRecrutementAffichee) ? aireRecrutementAffichee.length : 0;
  const nbPieces = Array.isArray(piecesData) ? piecesData.length : 0;

  const sections = [
    { key: "general", label: "Général", icon: ClipboardList },
    { key: "localisation", label: "Localisation", icon: MapPin },
    ...(estNouvelleCreation ? [{ key: "nouvelle_creation", label: estProvisoire ? "Ouverture provisoire" : "Nouvelle création", icon: School }] : []),
    ...(estRegularisation ? [{ key: "regularisation", label: "Régularisation", icon: FileText }] : []),
    { key: "proximite", label: "Proximité", icon: Building2, count: nbProches },
    { key: "recrutement", label: "Recrutement", icon: Users, count: nbAire },
    { key: "pieces", label: "Pièces", icon: FileText, count: nbPieces },
  ];

  const sectionActive = sections.find((s) => s.key === ongletActif) || null;

  return (
    <Dialog open={ouvert} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[1000px] max-w-[1000px] max-h-[94dvh] overflow-hidden flex flex-col p-0 gap-0 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-foreground shadow-2xl">
        <DialogHeader className="border-b px-6 py-5 shrink-0 bg-white dark:bg-slate-950 space-y-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pr-8">
            <div className="flex items-start gap-3">
              <div className={cn("mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg", NAVY)}>
                <FileText className="h-4.5 w-4.5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-semibold leading-tight">Détail de la demande</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1">
                  {demande?.nom_etab ? (<>Dossier <strong className="text-foreground/80">{demande.nom_etab}</strong></>) : ("Consultation du dossier de demande")}
                </DialogDescription>
              </div>
            </div>
            {demande?.reference && (
              <div className="text-left sm:text-right text-[11px] leading-tight text-muted-foreground">
                <div><strong>Référence :</strong> {demande.reference}</div>
                <div><strong>Niveau :</strong> {mapNiveau(demande?.niveau_etab)}</div>
                <div className="mt-1 pt-1 border-t font-medium text-foreground">{demande?.commune || ""} · {demande?.cisco || ""}</div>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5 bg-white dark:bg-slate-950">
          {chargement && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-[#2f4a8a]" />
              <p className="text-sm text-muted-foreground">Chargement…</p>
            </div>
          )}

          {erreur && !chargement && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{erreur}</span>
            </div>
          )}

          {demande && !chargement && !erreur && (
            <>
              <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3", analyseValidee ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900" : "bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-800")}>
                <div className="flex items-center gap-3">
                  {analyseValidee ? <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" /> : <XCircle className="h-5 w-5 text-red-500 shrink-0" />}
                  <div className="leading-tight">
                    <p className="text-sm font-semibold">{analyseValidee ? "Analyse validée" : "Analyse non validée"}</p>
                    <p className="text-xs text-muted-foreground hidden sm:block">{analyseValidee ? "Les conditions essentielles sont respectées." : "Certaines conditions ne sont pas respectées."}</p>
                  </div>
                </div>
                <BoutonFicheTechnique demande={demande} analyseValidee={analyseValidee} vueRef={vueCarteRef} />
              </div>

              <AnalyseGlobaleInline verdict={verdictAnalyse} analyse={analyseNormes} />

              <div className="space-y-2.5">
                <p className={LABEL_SECTION}>Sections du dossier</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {sections.map((s) => (
                    <BoutonSection key={s.key} icon={s.icon} label={s.label} count={s.count} actif={ongletActif === s.key} onClick={() => basculerOnglet(s.key)} />
                  ))}
                </div>
              </div>

              {sectionActive && (
                <div key={sectionActive.key} className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
                  <div className="flex items-center gap-3">
                    <p className={LABEL_SECTION}>{sectionActive.label}</p>
                    <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                  </div>

                  {ongletActif === "general" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className={CARTE}>
                          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4 text-[#2f4a8a] dark:text-blue-300" /> Demandeur</CardTitle></CardHeader>
                          <CardContent>
                            <InfoRow label="Nom" value={demande.nom_demandeur} />
                            <InfoRow label="Téléphone" value={demande.telephone_demandeur} />
                            <InfoRow label="Email" value={demande.email_demandeur} />
                          </CardContent>
                        </Card>
                        <Card className={CARTE}>
                          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><School className="h-4 w-4 text-[#2f4a8a] dark:text-blue-300" /> Établissement</CardTitle></CardHeader>
                          <CardContent>
                            <InfoRow label="Nom" value={demande.nom_etab} />
                            {!estNouvelleCreation && <InfoRow label="Code" value={demande.code_etab} />}
                            <InfoRow label="Niveau" value={mapNiveau(demande.niveau_etab)} />
                            <InfoRow label="Statut juridique" value={demande.statut_juridique} />
                          </CardContent>
                        </Card>
                        <Card className={CARTE}>
                          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ClipboardList className="h-4 w-4 text-[#2f4a8a] dark:text-blue-300" /> Demande</CardTitle></CardHeader>
                          <CardContent className="grid grid-cols-1 gap-3">
                            <InfoRow label="Type de demande" value={libelleTypeDemande} />
                            <InfoRow label="Date de dépôt" value={dateFR(demande.date_depot)} />
                            <InfoRow label="N° de demande" value={demande.id_demande} />
                          </CardContent>
                        </Card>
                      </div>
                      <AnalyseInline analyse={analyseNormes} ids={["critere-locaux", "critere-salle", "critere-salles-appartenance", "critere-latrines", "critere-educateur", "critere-domaine-scolaire", "critere-enseignants", "critere-enseignants-total", "critere-enseignants-etat", "critere-enseignants-fram", "critere-non-configure"]} titre="Analyse automatique des informations générales" />
                    </div>
                  )}

                  {ongletActif === "localisation" && (
                    <div className="space-y-4">
                      <Card className={CARTE}>
                        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4 text-[#2f4a8a] dark:text-blue-300" /> Lieu d'implantation</CardTitle></CardHeader>
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
                            {estNouvelleCreation && !estProvisoire && zoneProposee && <InfoRow label="Zone éligible proposée" value={libelleZoneEligible || "—"} />}
                          </div>
                        </CardContent>
                      </Card>
                      <Card className={CARTE}>
                        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4 text-[#2f4a8a] dark:text-blue-300" /> Carte de localisation ORS</CardTitle></CardHeader>
                        <CardContent>
                          <DemandeLocalisationMap demande={demande} etablissementsProches={etablissementsProches} aireRecrutement={aireRecrutement} aireSansCoord={aireSansCoord} vueRef={vueCarteRef} masquerAireVoisins={true} />
                        </CardContent>
                      </Card>
                      <AnalyseInline analyse={analyseNormes} ids={["critere-central"]} sansConteneur={true} />
                    </div>
                  )}

                  {ongletActif === "nouvelle_creation" && estNouvelleCreation && (
                    <div className="space-y-4">
                      <div className={cn("p-3 rounded-xl border text-xs flex items-start gap-2 bg-slate-50 dark:bg-slate-900", estProvisoire ? "border-slate-200" : "border-[#2f4a8a]/30")}>
                        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#2f4a8a] dark:text-blue-300" />
                        <span><strong>{libelleTypeDemande}</strong>{estProvisoire ? " — L'école existe déjà de fait : la date d'ouverture de fait et l'évolution des effectifs sont renseignées." : " — L'école n'existe pas encore : les informations ci-dessous sont des prévisions."}</span>
                      </div>
                      {nouvelleCreationData && (
                        <Card className={CARTE}>
                          <CardHeader className="pb-2"><CardTitle className="text-sm">{estProvisoire ? "Informations d'ouverture provisoire" : "Informations de nouvelle création"}</CardTitle></CardHeader>
                          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <InfoRow label="Nb table-bancs" value={nouvelleCreationData.nombre_tablebanc_prevus} />
                            <InfoRow label="Surface terrain prévue (m²)" value={nouvelleCreationData.surface_terrain_prevu} />
                            <InfoRow label="Type de bâtiment prévu" value={nouvelleCreationData.type_batiment_prevu} />
                            <InfoRow label="Nb salle prévu" value={nouvelleCreationData.nombre_salle_prevu} />
                            <InfoRow label="Latrines Filles" value={nouvelleCreationData.latrine_f} />
                            <InfoRow label="Latrines Garçons" value={nouvelleCreationData.latrine_g} />
                            <InfoRow label="Total latrines" value={nouvelleCreationData.latrine_total} />
                            <InfoRow label="Latrines séparées" value={nouvelleCreationData.latrine_separee} />
                            {estProvisoire && <InfoRow label="Date d'ouverture de fait" value={dateFR(dateOuvertureFait)} />}
                          </CardContent>
                        </Card>
                      )}
                      {estProvisoire && (
                        <Card className={CARTE}>
                          <CardHeader className="pb-2"><CardTitle className="text-sm">Évolution des effectifs (ouverture provisoire)</CardTitle></CardHeader>
                          <CardContent><DataTable titre="Évolution des effectifs" colonnes={colonnesEvolution} lignes={evolutionProvisoire} /></CardContent>
                        </Card>
                      )}
                      {Array.isArray(demande.enseignants) && demande.enseignants.length > 0 && (
                        <Card className={CARTE}>
                          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4 text-[#2f4a8a] dark:text-blue-300" /> Enseignants</CardTitle></CardHeader>
                          <CardContent><DataTable titre="Enseignants" colonnes={colonnesEnseignant} lignes={demande.enseignants} /></CardContent>
                        </Card>
                      )}
                      <AnalyseInline analyse={analyseNormes} ids={["critere-population", "critere-population-scolarisable", "critere-locaux", "critere-enseignants", "critere-enseignants-total", "critere-enseignants-etat", "critere-enseignants-fram"]} titre={estProvisoire ? "Analyse automatique de l'ouverture provisoire" : "Analyse automatique de la nouvelle création"} />
                    </div>
                  )}

                  {ongletActif === "regularisation" && estRegularisation && (
                    <div className="space-y-4">
                      {demande.regularisation && (
                        <Card className={CARTE}>
                          <CardHeader className="pb-2"><CardTitle className="text-sm">Informations de la régularisation</CardTitle></CardHeader>
                          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                        <Card className={CARTE}>
                          <CardHeader className="pb-2"><CardTitle className="text-sm">Personnel enseignant existant (historique ORS)</CardTitle></CardHeader>
                          <CardContent><DataTable titre="Personnel existant" colonnes={COLONNES_PERSONNEL_ORS} lignes={demande.personnel_existant} /></CardContent>
                        </Card>
                      )}
                      {Array.isArray(demande.enseignants) && demande.enseignants.length > 0 && (
                        <Card className={CARTE}>
                          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4 text-[#2f4a8a] dark:text-blue-300" /> Renseignements du personnel</CardTitle></CardHeader>
                          <CardContent>
                            <DataTable titre="Renseignements du personnel" colonnes={colonnesEnseignant} lignes={demande.enseignants.map((p) => {
                              const dateBrute = premierNonVide(p?.agent_etat_entree_administration, p?.premiere_prise_service_admin, p?.date_entree_administrative, p?.date_entree_enseignante, p?.prise_service_poste_actuel, p?.date_entreeAdmin, p?.date_entree_admin, p?.date_entree, p?.date_entree_administration, p?.date_entree_dans_administration);
                              return { ...p, date_entreeAdmin: dateBrute || "—", date_entree: dateBrute || "—", agent_etat_entree_administration: dateBrute || "—" };
                            })} />
                          </CardContent>
                        </Card>
                      )}
                      {Array.isArray(demande.evolution_effectifs) && demande.evolution_effectifs.length > 0 && (
                        <Card className={CARTE}>
                          <CardHeader className="pb-2"><CardTitle className="text-sm">Évolution des effectifs (ORS)</CardTitle></CardHeader>
                          <CardContent><DataTable titre="Évolution des effectifs" colonnes={colonnesEvolution} lignes={normaliserEvolutionPourAffichage(demande)} /></CardContent>
                        </Card>
                      )}
                      <AnalyseInline analyse={analyseNormes} titre="Analyse automatique de la régularisation" />
                    </div>
                  )}

                  {ongletActif === "proximite" && (
                    <div className="space-y-4">
                      <Card className={CARTE}>
                        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4 text-[#2f4a8a] dark:text-blue-300" /> Informations complémentaires</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <InfoRow label="Distance CISCO (km)" value={infoComp.distance_cisco} />
                          <InfoRow label="Distance DREN (km)" value={infoComp.distance_dren} />
                          <InfoRow label={proxCfg.labelExistProche} value={existeProche ? "Oui" : "Non"} />
                          {!existeProche && <InfoRow label={proxCfg.labelDistancePlusProche} value={distancePlusProcheAffichee} />}
                        </CardContent>
                      </Card>
                      <Card className={CARTE}>
                        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4 text-[#2f4a8a] dark:text-blue-300" /> Établissements proches</CardTitle></CardHeader>
                        <CardContent><DataTable titre="Établissements proches" colonnes={COLONNES_PROCHES} lignes={etablissementsProches} /></CardContent>
                      </Card>
                      <AnalyseInline analyse={analyseNormes} ids={["critere-distance", "critere-distance-lycee", "critere-distance-800m"]} titre="Analyse automatique de la proximité" />
                    </div>
                  )}

                  {ongletActif === "recrutement" && (
                    <div className="space-y-4">
                      <Card className={CARTE}>
                        <CardHeader className="pb-2"><CardTitle className="text-sm">{titreAire}</CardTitle></CardHeader>
                        <CardContent><DataTable titre="Aire de recrutement" colonnes={colonnesAire} lignes={aireRecrutementAffichee} /></CardContent>
                      </Card>
                      {aireSansCoord.length > 0 && (
                        <Card className={CARTE}>
                          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Info className="h-4 w-4 text-muted-foreground" /> Éléments de l'aire sans coordonnées GPS ({aireSansCoord.length})</CardTitle></CardHeader>
                          <CardContent>
                            <div className="text-xs text-muted-foreground mb-2">Ces villages/établissements sont comptés dans l'aire de recrutement mais ne peuvent pas être affichés sur la carte.</div>
                            <DataTable titre="Aire sans coordonnées" colonnes={colonnesAire} lignes={aireSansCoord} />
                          </CardContent>
                        </Card>
                      )}
                      <AnalyseInline analyse={analyseNormes} ids={["critere-t5", "critere-t9", "critere-enfants", "critere-population", "critere-population-scolarisable"]} titre="Analyse automatique de l'aire de recrutement" />
                    </div>
                  )}

                  {ongletActif === "pieces" && (
                    <div>
                      {!Array.isArray(piecesData) || piecesData.length === 0 ? (
                        <div className="p-6 bg-slate-50 dark:bg-slate-900 border border-dashed rounded-xl text-sm text-muted-foreground italic text-center">Aucune pièce jointe enregistrée.</div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {piecesData.map((piece, i) => {
                            const urlFichier = piece?.fichier || piece?.fichier_url || piece?.url || piece?.file;
                            return (
                              <Card key={i} className={CARTE}>
                                <CardContent className="p-3 flex items-start gap-3">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#2f4a8a]/10">
                                    <FileText className="h-4 w-4 text-[#2f4a8a] dark:text-blue-300" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-foreground truncate">{piece?.nom_piece || piece?.nom || piece?.libelle || "Pièce"}</p>
                                    <div className="flex flex-wrap items-center gap-3 mt-1">
                                      {urlFichier && (
                                        <>
                                          <a href={urlFichier} target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#2f4a8a] dark:text-blue-300 hover:underline flex items-center gap-1"><Eye className="h-3 w-3" /> Voir</a>
                                          <a href={urlFichier} download className="text-[11px] text-[#2f4a8a] dark:text-blue-300 hover:underline flex items-center gap-1"><Download className="h-3 w-3" /> Télécharger</a>
                                        </>
                                      )}
                                    </div>
                                    <Badge variant="outline" className={cn("text-[10px] mt-1.5 border", piece?.fourni ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-600 border-red-200")}>{piece?.fourni ? "Fourni" : "Non fourni"}</Badge>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t px-6 py-3 shrink-0 bg-white dark:bg-slate-950">
          <DialogClose asChild>
            <Button variant="outline" size="sm" className="rounded-lg">Fermer</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}