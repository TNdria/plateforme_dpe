// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from "react";

import {
  Search, Eye, Filter, ClipboardList, CalendarDays, Loader2, RefreshCw,
  User, School, MapPin, FileText, Building2, AlertTriangle, Download,
  Users, Database, Layers, CheckCircle2, XCircle, FileDown, Printer,
  Minus, Info, Trash2,
} from "lucide-react";

import { MapContainer, TileLayer, Marker, Popup, Circle, Polygon, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import html2canvas from "html2canvas";
import { toPng } from "html-to-image";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { demandeService } from "@/services/demandeService";
import { asList } from "@/services/demandeApi";
import { cn } from "@/lib/utils";

import {
  buildAnalyseContext,
  analyserNormes,
  detectPhase,
} from "@/services/normesAnalyse";

const createMapIcon = (background, border, symbol, size = 34) =>
  L.divIcon({
    className: "custom-map-marker",
    html: `
      <div style="width:${size}px;height:${size}px;border-radius:50%;
        background:${background};border:2.5px solid ${border};
        box-shadow:0 1px 3px rgba(0,0,0,.5);
        display:flex;align-items:center;justify-content:center;">
        <span style="color:white;font-size:${Math.round(size * 0.5)}px;font-weight:800;">${symbol}</span>
      </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });

const escapeMapText = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
}[c] || c));

const COULEUR_ECOLE_NOUVELLE = "#facc15";
const COULEUR_ECOLE_EXISTANTE = "#1d8fd1";
const COULEUR_COUVERT = "#8a8a8a";
const COULEUR_HORS_ZONE = "#e53935";

const createLabeledMapIcon = (
  background, border, symbol, label,
  secondary = "", size = 14, labelWidth = 230, shape = "dot",
) => {
  const safeLabel = escapeMapText(label || "Lieu non renseigné");
  const safeSecondary = escapeMapText(secondary);

  const fontSizeMain = Math.max(10, Math.min(12, Math.round(size * 0.6)));
  const fontSizeSecondary = Math.max(9, fontSizeMain - 2);
  const boxHeight = Math.max(20, size + 4);
  const iconTop = Math.round((boxHeight - size) / 2);
  const topMain = Math.max(0, Math.round((boxHeight - fontSizeMain * 1.2) / 2));
  const topSecondary = topMain + fontSizeMain + 1;

  const glyph =
    shape === "school"
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}"
           style="position:absolute;left:0;top:${iconTop}px;z-index:2;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.45));">
           <path d="M12 2 1.5 10h21z" fill="${background}"/>
           <rect x="3.5" y="10" width="17" height="11" fill="${background}"/>
           <rect x="10" y="14" width="4" height="7" fill="#ffffff"/>
           <rect x="5.5" y="12.5" width="3" height="3" fill="#ffffff"/>
           <rect x="15.5" y="12.5" width="3" height="3" fill="#ffffff"/>
         </svg>`
      : `<div style="position:absolute;left:0;top:${iconTop}px;width:${size}px;height:${size}px;
           border-radius:50%;background:${background};
           box-shadow:0 1px 2px rgba(0,0,0,.45);z-index:2;"></div>`;

  return L.divIcon({
    className: "fiche-labeled-marker",
    html: `
      <div style="position:relative;width:${labelWidth + 20}px;height:${boxHeight}px;overflow:visible;">
        ${glyph}
        <div style="position:absolute;left:${size + 5}px;top:${topMain}px;
          color:#111827;font-family:Arial,sans-serif;font-size:${fontSizeMain}px;font-weight:700;
          line-height:1.2;white-space:nowrap;
          text-shadow:-1px -1px 0 rgba(255,255,255,.95),1px -1px 0 rgba(255,255,255,.95),
            -1px 1px 0 rgba(255,255,255,.95),1px 1px 0 rgba(255,255,255,.95),0 0 3px rgba(255,255,255,.9);
          z-index:3;">${safeLabel}</div>
        ${safeSecondary ? `<div style="position:absolute;left:${size + 5}px;top:${topSecondary}px;
                 color:#475569;font-family:Arial,sans-serif;font-size:${fontSizeSecondary}px;font-weight:600;
                 line-height:1.1;white-space:nowrap;
                 text-shadow:-1px -1px 0 rgba(255,255,255,.95),1px -1px 0 rgba(255,255,255,.95),
                   -1px 1px 0 rgba(255,255,255,.95),1px 1px 0 rgba(255,255,255,.95);
                 z-index:3;">${safeSecondary}</div>` : ""}
      </div>`,
    iconSize: [labelWidth + 20, boxHeight],
    iconAnchor: [size / 2, Math.round(boxHeight / 2)],
    popupAnchor: [0, -Math.round(boxHeight / 2)],
  });
};

function SchoolGlyph({ color, size = 14 }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12 2 1.5 10h21z" fill={color} />
      <rect x="3.5" y="10" width="17" height="11" fill={color} />
      <rect x="10" y="14" width="4" height="7" fill="#ffffff" />
      <rect x="5.5" y="12.5" width="3" height="3" fill="#ffffff" />
      <rect x="15.5" y="12.5" width="3" height="3" fill="#ffffff" />
    </svg>
  );
}

const NIVEAU_LABELS = {
  prescolaire: "Préscolaire",
  primaire: "Primaire",
  college: "Collège",
  lycee: "Lycée",
};

const NIVEAU_COLONNES_EFFECTIF = {
  prescolaire: [
    { key: "eff_ps", label: "PS" },
    { key: "eff_ms", label: "MS" },
    { key: "eff_gs", label: "GS" },
  ],
  primaire: [
    { key: "eff_t1", label: "T1" },
    { key: "eff_t2", label: "T2" },
    { key: "eff_t3", label: "T3" },
    { key: "eff_t4", label: "T4" },
    { key: "eff_t5", label: "T5" },
  ],
  college: [
    { key: "eff_t6", label: "T6" },
    { key: "eff_t7", label: "T7" },
    { key: "eff_t8", label: "T8" },
    { key: "eff_t9", label: "T9" },
  ],
  lycee: [
    { key: "_2nde", label: "2nde" },
    { key: "_1re", label: "1ère" },
    { key: "tle", label: "Tle" },
  ],
};

const SOUS_TYPE_LABELS = {
  creation: "Nouvelle",
  provisoire: "Ouverture provisoire",
};

const PROXIMITE_CONFIG = {
  prescolaire: {
    labelExistProche: "Existence d'une école préscolaire publique à moins de 800 m",
    labelDistancePlusProche: "Distance par rapport à l'école la plus proche (Km)",
  },
  primaire: {
    labelExistProche: "Existence d'une école primaire publique à moins de 2 km",
    labelDistancePlusProche: "Distance par rapport à l'école la plus proche (Km)",
  },
  college: {
    labelExistProche: "Existence d'un CEG à moins de 5 km",
    labelDistancePlusProche: "Distance par rapport au CEG le plus proche (Km)",
  },
  lycee: {
    labelExistProche: "Existence d'un lycée à moins de 20 km",
    labelDistancePlusProche: "Distance par rapport au lycée le plus proche (Km)",
  },
};

const COLONNES_AIRE_VILLAGES = [
  { key: "fokontany", label: "Fokontany" },
  { key: "nom_village", label: "Nom du village" },
  { key: "distance_future", label: "Dist. future (km)" },
  { key: "distance_proche", label: "Dist. proche (km)" },
  { key: "population", label: "Population scolarisable" },
  { key: "latitude", label: "Latitude" },
  { key: "longitude", label: "Longitude" },
];

const COLONNES_AIRE_ECOLES_COLLEGE = [
  { key: "fokontany", label: "Fokontany" },
  { key: "code_inferieur", label: "Code EPP" },
  { key: "nom_inferieur", label: "Nom de l'EPP" },
  { key: "distance_future", label: "Dist. future (km)" },
  { key: "effectif_t5", label: "Effectif T5" },
  { key: "latitude", label: "Latitude" },
  { key: "longitude", label: "Longitude" },
];

const COLONNES_AIRE_ECOLES_LYCEE = [
  { key: "fokontany", label: "Fokontany" },
  { key: "code_inferieur", label: "Code CEG" },
  { key: "nom_inferieur", label: "Nom du CEG" },
  { key: "distance_future", label: "Dist. future (km)" },
  { key: "distance_proche", label: "Dist. proche (km)" },
  { key: "effectif_t9", label: "Effectif T9" },
  { key: "latitude", label: "Latitude" },
  { key: "longitude", label: "Longitude" },
];

const getColonnesAireParNiveau = (niveauKey) => {
  switch (niveauKey) {
    case "college": return COLONNES_AIRE_ECOLES_COLLEGE;
    case "lycee":   return COLONNES_AIRE_ECOLES_LYCEE;
    default:        return COLONNES_AIRE_VILLAGES;
  }
};

const getTitreAireParNiveau = (niveauKey) => {
  switch (niveauKey) {
    case "college":     return "Liste des EPP alimentant le futur CEG";
    case "lycee":       return "Liste des CEG alimentant le futur lycée";
    case "prescolaire": return "Liste des villages alimentant la future école préscolaire";
    case "primaire":    return "Liste des villages alimentant la future EPP";
    default:            return "Liste des villages / établissements alimentants";
  }
};

const COLONNES_ENSEIGNANT_PRESCO_PRIMAIRE = [
  { key: "nom_enseignant", label: "Nom" },
  { key: "statut", label: "Statut" },
  { key: "profil", label: "Profil" },
  { key: "diplome_academique", label: "Diplôme académique" },
  { key: "diplome_pedagogique", label: "Diplôme pédagogique" },
  { key: "date_entreeAdmin", label: "Date d'entrée dans l'administration" },
];

const COLONNES_ENSEIGNANT_COLLEGE = [
  { key: "nom_prenoms", label: "Nom et Prénom" },
  { key: "statut", label: "Statut" },
  { key: "profil", label: "Profil" },
  { key: "diplome_academique", label: "Diplôme académique" },
  { key: "diplome_pedagogique", label: "Diplôme pédagogique" },
  { key: "matiere", label: "Matière enseignée" },
  { key: "date_entree", label: "Date d'entrée dans l'administration" },
];

const COLONNES_ENSEIGNANT_LYCEE = [
  { key: "nom_prenoms", label: "Nom et Prénom" },
  { key: "statut", label: "Statut" },
  { key: "profil", label: "Profil" },
  { key: "serie_bacc", label: "Série Bacc" },
  { key: "diplome_academique", label: "Diplôme académique le plus élevé" },
  { key: "diplome_pedagogique", label: "Diplôme pédagogique" },
  { key: "matiere", label: "Matière enseignée" },
  { key: "date_entree", label: "Date d'entrée dans l'administration" },
];

const getColonnesEnseignantParNiveau = (niveauKey) => {
  switch (niveauKey) {
    case "college": return COLONNES_ENSEIGNANT_COLLEGE;
    case "lycee":   return COLONNES_ENSEIGNANT_LYCEE;
    default:        return COLONNES_ENSEIGNANT_PRESCO_PRIMAIRE;
  }
};

const COLONNES_PERSONNEL_ORS = [
  { key: "annee_scolaire", label: "Année scolaire" },
  { key: "code_etab", label: "Code établissement" },
  { key: "nombre_enseignants", label: "Enseignants en salle" },
  { key: "nombre_personnel_total", label: "Personnel total" },
  { key: "nombre_fonctionnaire", label: "Fonctionnaires" },
  { key: "nombre_non_salarie", label: "FRAM non subventionnés" },
  { key: "nombre_subventionne", label: "FRAM subventionnés" },
  { key: "nombre_litteraire", label: "Littéraire" },
  { key: "nombre_scientifique", label: "Scientifique" },
];

const mapNiveau = (n) => {
  if (!n) return "—";
  const s = String(n).trim();
  if (["Préscolaire", "Primaire", "Collège", "Lycée"].includes(s)) return s;
  return NIVEAU_LABELS[s.toLowerCase()] || s;
};

const niveauToKey = (n) => {
  const s = String(n || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (s.startsWith("presco") || s.startsWith("matern") || s.includes("maternel")) {
    return "prescolaire";
  }
  if (s.startsWith("lyc")) return "lycee";
  if (s.startsWith("col") || s.startsWith("ceg")) return "college";
  if (s.startsWith("prim") || s.startsWith("epp")) return "primaire";

  return "primaire";
};

const formatDate = (v) => {
  if (!v) return "—";
  if (typeof v === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(v)) return v;
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  } catch { return String(v); }
};

const getDemandeur = (item) => {
  if (!item) return "—";
  if (typeof item.nom_demandeur === "string" && item.nom_demandeur.trim()) return item.nom_demandeur;
  if (typeof item.demandeur === "string" && item.demandeur.trim()) return item.demandeur;
  if (item.demandeur && typeof item.demandeur === "object") {
    return item.demandeur.username || item.demandeur.nom || item.demandeur.name || "—";
  }
  return "—";
};

const normaliserTexte = (v) =>
  String(v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const estTypeNouvelleCreation = (typeDemande) => {
  const t = normaliserTexte(typeDemande).replace(/_/g, " ");
  return t === "nouvelle creation" || t === "creation";
};

const getSousTypeKey = (item, avecDefaut = true) => {
  if (!item) return null;
  if (!estTypeNouvelleCreation(item?.type_demande)) return null;

  const brut = normaliserTexte(
    item?.sous_type ?? item?.sous_type_demande ?? item?.nature_demande ??
    item?.nouvelle_creation?.sous_type ?? ""
  );

  if (brut.includes("provisoire")) return "provisoire";
  if (brut === "creation" || brut.includes("nouvelle") || brut.includes("creation")) return "creation";

  if (item?.nouvelle_creation?.date_ouverture_fait) return "provisoire";
  if (Array.isArray(item?.evolution_effectifs) && item.evolution_effectifs.length > 0) return "provisoire";

  return avecDefaut ? "creation" : null;
};

const getLibelleTypeDemande = (typeDemande, sousTypeKey) => {
  const base = typeDemande || "—";
  if (!sousTypeKey || !SOUS_TYPE_LABELS[sousTypeKey]) return base;
  return `${base} (${SOUS_TYPE_LABELS[sousTypeKey]})`;
};

const getNestedLocalisationObjects = (item) => {
  if (!item) return [];
  const values = [];
  const pushObject = (value) => {
    if (value && typeof value === "object" && !Array.isArray(value) && !values.includes(value)) {
      values.push(value);
    }
  };

  pushObject(item);
  pushObject(item.localisation_detail);
  pushObject(item.localisation);
  pushObject(item.localisationDetail);
  pushObject(item.village_implantation_detail);
  pushObject(item.lieu_implantation);
  pushObject(item.lieuImplantation);
  pushObject(item.info_complementaire);

  const roots = [...values];
  for (const root of roots) {
    pushObject(root.localisation_detail);
    pushObject(root.localisation);
    pushObject(root.village_detail);
    pushObject(root.villageDetail);
    pushObject(root.village);
    pushObject(root.fokontany_detail);
    pushObject(root.commune_detail);
    pushObject(root.zap_detail);
    pushObject(root.cisco_detail);
    pushObject(root.dren_detail);
    pushObject(root.coordonnees);
    pushObject(root.coordinates);
    pushObject(root.gps);
    pushObject(root.position);
  }
  return values;
};

const LOC_ALIASES = {
  village: ["village", "nom_village", "village_nom", "nomVillage", "libelle_village"],
  fokontany: ["fokontany", "nom_fokontany", "fokontany_nom", "nomFokontany", "libelle_fokontany"],
  commune: ["commune", "nom_commune", "commune_nom", "nomCommune", "libelle_commune"],
  zap: ["zap", "nom_zap", "zap_nom", "nomZap", "code_zap", "codeZap", "libelle_zap"],
  cisco: ["cisco", "nom_cisco", "cisco_nom", "nomCisco", "code_cisco", "codeCisco", "libelle_cisco"],
  dren: ["dren", "nom_dren", "dren_nom", "nomDren", "code_dren", "codeDren", "libelle_dren"],
};

const getLocalisationValue = (item, champ) => {
  if (!item) return "—";
  for (const source of getNestedLocalisationObjects(item)) {
    for (const key of LOC_ALIASES[champ] || []) {
      const value = source?.[key];
      if (value === null || value === undefined || String(value).trim() === "") continue;
      if (typeof value === "object") {
        return String(
          value.nom ?? value.name ?? value.libelle ?? value.nom_village ?? value.nom_fokontany ??
            value.nom_commune ?? value.nom_zap ?? value.nom_cisco ?? value.nom_dren ?? "—"
        );
      }
      return String(value);
    }
  }
  return "—";
};

const mapDemande = (item) => {
  const typeDemande = item?.type_demande || "—";
  const sousType = getSousTypeKey({ ...item, type_demande: typeDemande }, false);

  return {
    id: item?.id_demande ?? item?.id ?? Math.random(),
    reference: item?.reference || item?.numero_demande ||
      `${String(item?.id_demande ?? item?.id ?? "").padStart(6, "0")}`,
    nom_etab: item?.nom_etab || item?.nom_etablissement || "—",
    niveau: mapNiveau(item?.niveau_etab || item?.niveau),
    type_demande: typeDemande,
    sous_type: sousType,
    type_demande_label: getLibelleTypeDemande(typeDemande, sousType),
    demandeur: getDemandeur(item),
    date_depot: formatDate(item?.date_depot),
    statut: item?.statut_demande || item?.statut || "En attente",
    commune: getLocalisationValue(item, "commune"),
    cisco: getLocalisationValue(item, "cisco"),
  };
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const n = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const toNum = (v) => {
  const n = toNumber(v);
  return n === null ? 0 : n;
};

const firstArray = (demande, keys) => {
  for (const k of keys) {
    if (Array.isArray(demande?.[k])) return demande[k];
  }
  return [];
};

const getEnseignantsAnalyse = (d) =>
  firstArray(d, ["enseignants", "personnel_existant", "personnel"]);

const getEtablissementsProchesAnalyse = (d) => {
  const direct = firstArray(d, [
    "etablissements_proches", "etablissements_proches_liste",
    "proximite", "etablissements_proximite",
  ]);
  if (direct.length) return direct;
  const info = getInfoComplementaireAnalyse(d);
  return firstArray(info, ["etablissements_proches", "etablissements_proches_liste", "proximite"]);
};

const normaliserNiveauItem = (item) => {
  const valeur = String(
    item?.niveau_etab ?? item?.niveau ?? item?.type_niveau ??
    item?.niveau_etablissement ?? item?.niveauEtab ?? ""
  )
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (valeur.startsWith("presco") || valeur.includes("matern")) return "prescolaire";
  if (valeur.startsWith("prim") || valeur.includes("epp")) return "primaire";
  if (valeur.startsWith("col") || valeur.includes("ceg")) return "college";
  if (valeur.startsWith("lyc")) return "lycee";
  return "";
};

const getAireCandidateArrays = (d) => {
  const candidates = [];
  const ajouter = (value) => {
    if (Array.isArray(value) && value.length) candidates.push(value);
  };

  [
    "aire_recrutement", "aires_recrutement", "aireRecrutement",
    "recrutement", "zone_recrutement", "zoneRecrutement",
    "villages_alimentants", "villages_alimentant",
    "villages_recrutement", "villages_recrutement_liste",
    "ecoles_alimentantes", "ecoles_alimentant",
    "etablissements_alimentants", "etablissements_alimentant",
    "etablissements_recrutement", "ecoles_rattachement",
    "etablissements_rattachement",
  ].forEach((key) => ajouter(d?.[key]));

  const info = getInfoComplementaireAnalyse(d);
  [
    "aire_recrutement", "aires_recrutement", "recrutement",
    "zone_recrutement", "villages_alimentants",
    "ecoles_alimentantes", "etablissements_alimentants",
  ].forEach((key) => ajouter(info?.[key]));

  return candidates;
};

const getAireRecrutementAnalyse = (d) => {
  const niveauKey = niveauToKey(d?.niveau_etab || d?.niveau);

  const candidates = getAireCandidateArrays(d);
  if (candidates.length) {
    return candidates[0].map((item) => normaliserAireItem(item, niveauKey));
  }

  const info = getInfoComplementaireAnalyse(d);
  const depuisInfo = [
    info?.aire_recrutement, info?.villages_alimentants,
    info?.ecoles_alimentantes, info?.etablissements_alimentants,
  ].find((v) => Array.isArray(v) && v.length);

  if (depuisInfo) {
    return depuisInfo.map((item) => normaliserAireItem(item, niveauKey));
  }

  if (niveauKey === "primaire" || niveauKey === "prescolaire") return [];

  // ✅ CORRECTION : fallback via établissements de niveau inférieur
  const reference = Array.isArray(d?.etablissements_reference)
    ? d.etablissements_reference
    : [];

  if (reference.length) {
    return reference.map((item) => normaliserAireItem(item, niveauKey));
  }

  const proches = getEtablissementsProchesAnalyse(d);
  if (!proches.length) return [];

  const niveauInferieurAttendu = niveauKey === "lycee" ? "college" : "primaire";
  const derives = proches.filter((item) =>
    normaliserNiveauItem(item) === niveauInferieurAttendu
  );

  return derives.map((item) => normaliserAireItem(item, niveauKey));
};

// ✅ CORRECTION : ne plus écraser latitude/longitude avec null
const normaliserAireItem = (item, niveauKey) => {
  if (!item || typeof item !== "object") return item;

  const nom =
    item?.nom_village ?? item?.village_nom ?? item?.nom_inferieur ??
    item?.nom_ecole ?? item?.nom_etab ?? item?.nom_etablissement ??
    item?.nom ?? item?.libelle ?? item?.village?.nom ??
    item?.etablissement?.nom ?? "—";

  const code =
    item?.code_inferieur ?? item?.code_ecole ?? item?.code_etab ??
    item?.code_etablissement ?? item?.code ?? item?.etablissement?.code ?? "";

  const lat = toNumber(
    item?.latitude ?? item?.lat ?? item?.latitude_village ??
    item?.coord_latitude ?? item?.y ??
    item?.village?.latitude ?? item?.etablissement?.latitude
  );

  const lng = toNumber(
    item?.longitude ?? item?.lng ?? item?.lon ?? item?.longitude_village ??
    item?.coord_longitude ?? item?.x ??
    item?.village?.longitude ?? item?.etablissement?.longitude
  );

  const effet =
    item?.effectif_t9 ?? item?.effectif_t5 ?? item?.effectif_t1 ??
    item?.effectif ?? item?.effectif_total ??
    item?.population_scolarisable ?? item?.population ?? null;

  const base = {
    ...item,
    // ✅ CORRECTION : ne pas écraser si la valeur calculée est null
    latitude: lat !== null ? lat : (item?.latitude ?? null),
    longitude: lng !== null ? lng : (item?.longitude ?? null),
    distance_future:
      item?.distance_future ?? item?.distance_km ?? item?.distance ?? null,
    distance_proche: item?.distance_proche ?? null,
  };

  if (niveauKey === "primaire" || niveauKey === "prescolaire") {
    base.nom_village = item?.nom_village ?? nom;
    base.population = item?.population ?? effet;
    base.population_scolarisable = item?.population_scolarisable ?? null;

    delete base.effectif_t5;
    delete base.effectif_t9;
    delete base.nom_inferieur;
    delete base.code_inferieur;
  } else if (niveauKey === "college") {
    base.nom_inferieur = item?.nom_inferieur ?? nom;
    base.code_inferieur = item?.code_inferieur ?? code;
    base.nom_ecole = item?.nom_ecole ?? nom;
    base.effectif_t5 = item?.effectif_t5 ?? effet;

    delete base.effectif_t9;
    delete base.nom_village;
    delete base.population;
    delete base.population_scolarisable;
  } else if (niveauKey === "lycee") {
    base.nom_inferieur = item?.nom_inferieur ?? nom;
    base.code_inferieur = item?.code_inferieur ?? code;
    base.nom_ecole = item?.nom_ecole ?? nom;
    base.effectif_t9 = item?.effectif_t9 ?? effet;

    delete base.effectif_t5;
    delete base.nom_village;
    delete base.population;
    delete base.population_scolarisable;
  }

  return base;
};

const getEtablissementsProchesPourNiveau = (d) => {
  const niveauKey = niveauToKey(d?.niveau_etab || d?.niveau);
  const proches = getEtablissementsProchesAnalyse(d);
  if (!proches.length) return [];

  const pertinents = proches.filter((item) => {
    const n = normaliserNiveauItem(item);
    if (niveauKey === "lycee") return n === "lycee";
    if (niveauKey === "college") return n === "college";
    if (niveauKey === "primaire") return n === "primaire";
    if (niveauKey === "prescolaire") return n === "prescolaire";
    return true;
  });

  return pertinents.length ? pertinents : proches;
};

const getNomAireItem = (item) => {
  if (!item) return "—";
  const candidats = [
    item?.nom_village, item?.village_nom, item?.nom_inferieur, item?.nom_ecole,
    item?.nom_etab, item?.nom_etablissement, item?.nom, item?.libelle,
    item?.name, item?.NOM_ETAB, item?.NOM_ETABLISSEMENT, item?.NOM_ECOLE,
    item?.VILLAGE, item?.NAME, item?.LIBELLE,
    item?.village?.nom, item?.village?.name, item?.village?.libelle, item?.village?.VILLAGE,
    item?.etablissement?.nom, item?.etablissement?.name,
    item?.etablissement?.nom_etab, item?.etablissement?.NOM_ETAB,
    item?.ecole?.nom, item?.ecole?.name, item?.ecole?.nom_etab, item?.ecole?.NOM_ETAB,
  ];

  const nom = candidats.find((v) => v !== null && v !== undefined && String(v).trim() !== "");
  if (nom !== undefined) return String(nom).trim();

  const fkt = [item?.fokontany, item?.nom_fokontany, item?.FOKONTANY,
    item?.fokontany?.nom, item?.fokontany?.name]
    .find((v) => v !== null && v !== undefined && String(v).trim() !== "");
  if (fkt !== undefined) return `Fokontany : ${String(fkt).trim()}`;

  return "Lieu sans nom fourni par l'API";
};

const getCodeAireItem = (item) =>
  item?.code_inferieur ?? item?.code_ecole ?? item?.code_etab ??
  item?.code_etablissement ?? item?.code ?? item?.etablissement?.code ?? "—";

const getEvolutionEffectifsAnalyse = (d) =>
  firstArray(d, ["evolution_effectifs", "evolutionEffectifs", "evolution"]);

const sommeChamps = (objet, cles) => {
  return cles.reduce((total, cle) => {
    const n = Number(objet?.[cle]);
    return total + (Number.isFinite(n) ? n : 0);
  }, 0);
};

const normaliserEvolutionPourAffichage = (d) => {
  const niveauKey = niveauToKey(d?.niveau_etab || d?.niveau);
  const evolution = getEvolutionEffectifsAnalyse(d);

  return evolution.map((e) => {
    const row = { ...e };

    if (niveauKey === "prescolaire") {
      row.eff_ps = toNumber(e?.eff_ps) ?? toNumber(e?.ps) ?? toNumber(e?.PS) ?? sommeChamps(e, ["ps_g", "ps_f", "PS_G", "PS_F"]);
      row.eff_ms = toNumber(e?.eff_ms) ?? toNumber(e?.ms) ?? toNumber(e?.MS) ?? sommeChamps(e, ["ms_g", "ms_f", "MS_G", "MS_F"]);
      row.eff_gs = toNumber(e?.eff_gs) ?? toNumber(e?.gs) ?? toNumber(e?.GS) ?? sommeChamps(e, ["gs_g", "gs_f", "GS_G", "GS_F"]);
    }

    if (niveauKey === "primaire") {
      ["t1", "t2", "t3", "t4", "t5"].forEach((niveau) => {
        const key = `eff_${niveau}`;
        if (row[key] === undefined) {
          row[key] = e?.[niveau] ?? e?.[niveau.toUpperCase()] ?? 0;
        }
      });
    }

    if (niveauKey === "college") {
      ["t6", "t7", "t8", "t9"].forEach((niveau) => {
        const key = `eff_${niveau}`;
        if (row[key] === undefined) {
          row[key] = e?.[niveau] ?? e?.[niveau.toUpperCase()] ?? 0;
        }
      });
    }

    if (niveauKey === "lycee") {
      row._2nde = e?._2nde ?? e?.["2nde"] ?? e?.seconde ?? 0;
      row._1re = e?._1re ?? e?.["1ere"] ?? e?.["1ère"] ?? e?.premiere ?? 0;
      row.tle = e?.tle ?? e?.["Tle"] ?? e?.terminale ?? 0;
    }

    if (row.effectif_total === undefined || row.effectif_total === null) {
      if (niveauKey === "prescolaire") {
        row.effectif_total = Number(row.eff_ps || 0) + Number(row.eff_ms || 0) + Number(row.eff_gs || 0);
      } else if (niveauKey === "primaire") {
        row.effectif_total = sommeChamps(row, ["eff_t1", "eff_t2", "eff_t3", "eff_t4", "eff_t5"]);
      } else if (niveauKey === "college") {
        row.effectif_total = sommeChamps(row, ["eff_t6", "eff_t7", "eff_t8", "eff_t9"]);
      } else {
        row.effectif_total = sommeChamps(row, ["_2nde", "_1re", "tle"]);
      }
    }

    return row;
  });
};

const getPiecesAnalyse = (d) => firstArray(d, ["pieces", "pieces_fournies"]);

const getInfoComplementaireAnalyse = (d) => ({
  ...(d?.info_complementaire || {}),
  ...(d?.information_complementaire_detail || {}),
});

const getPersonnelDetailAnalyse = (d) => {
  const cles = [
    "enseignants", "personnel_enseignant_detail", "personnel_detail",
    "personnel", "personnel_existant", "liste_enseignants", "liste_personnel",
  ];
  for (const cle of cles) {
    const valeur = d?.[cle];
    if (Array.isArray(valeur) && valeur.length > 0) return valeur;
  }
  return [];
};

const calculerDernierEffectifConnu = (demande) => {
  const evolution = normaliserEvolutionPourAffichage(demande);
  if (!Array.isArray(evolution) || evolution.length === 0) return 0;

  const triee = [...evolution].sort((a, b) =>
    String(b?.annee ?? b?.annee_scolaire ?? "").localeCompare(
      String(a?.annee ?? a?.annee_scolaire ?? ""), undefined, { numeric: true }
    )
  );

  const derniere = triee[0];
  if (!derniere) return 0;

  const totalDirect = Number(derniere?.effectif_total ?? derniere?.effectif ?? derniere?.total ?? 0);
  if (Number.isFinite(totalDirect) && totalDirect > 0) return totalDirect;

  let somme = 0;
  Object.entries(derniere).forEach(([cle, val]) => {
    if (
      cle.startsWith("eff_") ||
      cle === "_2nde" || cle === "_1re" || cle === "tle" ||
      ["ps", "ms", "gs", "ps_g", "ps_f", "ms_g", "ms_f", "gs_g", "gs_f",
       "PS_G", "PS_F", "MS_G", "MS_F", "GS_G", "GS_F"].includes(cle)
    ) {
      const n = Number(val);
      if (Number.isFinite(n)) somme += n;
    }
  });
  return somme;
};

const getCodeProvisoireMen = (demande) => {
  const candidats = [
    demande?.code_etab,
    demande?.regularisation?.code_etablissement,
    demande?.etablissement_existant_id,
  ];
  for (const c of candidats) {
    const v = String(c ?? "").trim();
    if (v) return v;
  }
  return "";
};

const getAccessibiliteSite = (demande) => {
  const info = getInfoComplementaireAnalyse(demande);
  if (typeof info?.accessibilite_site === "boolean") return info.accessibilite_site;
  if (typeof info?.accessibilite === "boolean") return info.accessibilite;
  const lat = getLatitude(demande);
  const lng = getLongitude(demande);
  if (lat !== null && lng !== null) return true;
  return null;
};

const getDistancePlusProche = (demande) => {
  const info = getInfoComplementaireAnalyse(demande);
  const directe = Number(info?.distance_plus_proche);
  if (Number.isFinite(directe) && directe > 0) return directe;

  const proches = getEtablissementsProchesAnalyse(demande);
  if (!Array.isArray(proches) || proches.length === 0) return null;

  const distances = proches
    .map((p) => Number(p?.distance_km ?? p?.distance ?? NaN))
    .filter((n) => Number.isFinite(n));

  if (distances.length === 0) return null;
  return Math.min(...distances);
};

const LAT_KEYS = [
  "latitude", "lat", "latitude_implantation", "latitude_village",
  "latitude_etab", "lat_village", "lat_etab", "coord_latitude",
  "coord_lat", "lat_coord", "y",
];
const LNG_KEYS = [
  "longitude", "lng", "lon", "longitude_implantation", "longitude_village",
  "longitude_etab", "long_village", "lon_village", "lng_etab",
  "coord_longitude", "coord_lng", "lon_coord", "x",
];

const findCoord = (item, keys, limit) => {
  if (!item) return null;
  for (const source of getNestedLocalisationObjects(item)) {
    for (const key of keys) {
      const value = toNumber(source?.[key]);
      if (value !== null && Math.abs(value) <= limit) return value;
    }
  }
  return null;
};

const getLatitude = (item) => findCoord(item, LAT_KEYS, 90);
const getLongitude = (item) => findCoord(item, LNG_KEYS, 180);

const getPosition = (item) => {
  const lat = getLatitude(item);
  const lng = getLongitude(item);
  if (lat === null || lng === null) return null;
  if (lat === 0 && lng === 0) return null;
  return [lat, lng];
};

const attendreTuilesChargees = (conteneur, timeoutMs = 8000) =>
  new Promise((resolve) => {
    const debut = Date.now();
    const check = () => {
      const tuiles = Array.from(conteneur.querySelectorAll(".leaflet-tile"));
      const pretes = tuiles.length > 0 && tuiles.every((t) => t.complete && t.naturalWidth > 0);
      if (pretes || Date.now() - debut > timeoutMs) resolve();
      else setTimeout(check, 150);
    };
    check();
  });

const aplatirTransformsLeaflet = (docClone, racine) => {
  const vue = docClone.defaultView;
  racine.querySelectorAll("*").forEach((el) => {
    const transform = el.style?.transform;
    if (!transform || transform === "none") return;
    const m = transform.match(/translate(?:3d)?\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px/);
    if (!m) return;
    const scale = transform.match(/scale\(\s*([\d.]+)/);
    if (scale && Math.abs(parseFloat(scale[1]) - 1) > 0.001) return;
    const cs = vue.getComputedStyle(el);
    if (cs.position === "static") return;
    const left = parseFloat(cs.left);
    const top = parseFloat(cs.top);
    el.style.left = `${(Number.isFinite(left) ? left : 0) + parseFloat(m[1])}px`;
    el.style.top = `${(Number.isFinite(top) ? top : 0) + parseFloat(m[2])}px`;
    el.style.transform = "none";
  });
};

const capturerCarteEnBase64 = async (conteneur) => {
  if (!conteneur) return null;
  await attendreTuilesChargees(conteneur);
  await new Promise((r) => setTimeout(r, 500));

  try {
    return await toPng(conteneur, {
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      skipFonts: true,
      filter: (node) => !(node?.classList && node.classList.contains("leaflet-control-zoom")),
    });
  } catch (e) {
    console.warn("html-to-image a échoué, repli sur html2canvas :", e);
  }

  try {
    const { width, height } = conteneur.getBoundingClientRect();
    const canvas = await html2canvas(conteneur, {
      useCORS: true, allowTaint: false, backgroundColor: "#ffffff",
      scale: 2, logging: false, imageTimeout: 15000,
      width: Math.round(width), height: Math.round(height),
      scrollX: 0, scrollY: 0, foreignObjectRendering: false,
      onclone: (docClone) => {
        const racine = docClone.querySelector("[data-capture-carte]");
        if (racine) aplatirTransformsLeaflet(docClone, racine);
      },
    });
    return canvas.toDataURL("image/png");
  } catch (e) {
    console.warn("Impossible de capturer la carte :", e);
    return null;
  }
};

const fmtFr = (v, fallback = "NÉANT") => {
  if (v === null || v === undefined || v === "") return fallback;
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  return String(v);
};

const esc = (v) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const SEUIL_EFFECTIF_MIN = { prescolaire: null, primaire: null, college: null, lycee: 250 };
const SURFACE_NORME_M2 = { prescolaire: 2000, primaire: 2000, college: 2000, lycee: 2000 };
const RAYON_TABLEAU_PROCHES_KM = { prescolaire: 3, primaire: 3, college: 8, lycee: 20 };

const FICHE_NIVEAU = {
  prescolaire: {
    long: "École Préscolaire", court: "école préscolaire",
    pluriel: "écoles préscolaires", de: "de l'",
    leNouveau: "la nouvelle école préscolaire",
    duNouveau: "de la nouvelle école préscolaire",
    auNouveau: "à la nouvelle école préscolaire",
    article: "La", aireNom: "villages",
    aireEffLabel: "Population", aireNomCol: "Nom du village",
  },
  primaire: {
    long: "École Primaire", court: "école primaire",
    pluriel: "écoles primaires", de: "de l'",
    leNouveau: "la nouvelle école primaire",
    duNouveau: "de la nouvelle école primaire",
    auNouveau: "à la nouvelle école primaire",
    article: "La", aireNom: "villages",
    aireEffLabel: "Population", aireNomCol: "Nom du village",
  },
  college: {
    long: "Collège d'Enseignement Général", court: "collège",
    pluriel: "collèges", de: "du ",
    leNouveau: "le nouveau collège",
    duNouveau: "du nouveau collège",
    auNouveau: "au nouveau collège",
    article: "Le", aireNom: "écoles primaires (EPP)",
    aireEffLabel: "Effectif de CM2 (T5)",
    aireNomCol: "Nom de l'EPP (Privé et Public)",
  },
  lycee: {
    long: "Lycée d'Enseignement Général", court: "lycée",
    pluriel: "lycées", de: "du ",
    leNouveau: "le nouveau lycée",
    duNouveau: "du nouveau lycée",
    auNouveau: "au nouveau lycée",
    article: "Le", aireNom: "collèges",
    aireEffLabel: "Effectif de 3ème",
    aireNomCol: "Nom de l'établissement (Privé et Public)",
  },
};

const MOIS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

const premierNonVide = (...valeurs) => {
  for (const v of valeurs) {
    if (v !== null && v !== undefined && String(v).trim() !== "") return v;
  }
  return null;
};

const fmtMilliers = (v) => {
  const n = toNumber(v);
  if (n === null) return v === null || v === undefined || v === "" ? "—" : String(v);
  const [ent, dec] = String(n).split(".");
  return ent.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0") + (dec ? "," + dec : "");
};

const fmtDistanceFiche = (v) => {
  const n = toNumber(v);
  if (n === null) return "—";
  if (n < 1) return `${Math.round(n * 1000)} m`;
  const txt = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
  return `${txt.replace(".", ",")} km`;
};

const dateLongueFr = (v) => {
  if (!v) return "—";
  const s = String(v).trim();
  let d = null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  else {
    const t = new Date(s);
    if (!isNaN(t.getTime())) d = t;
  }
  if (!d) return s;
  const jour = d.getDate() === 1 ? "1er" : String(d.getDate());
  return `${jour} ${MOIS_FR[d.getMonth()]} ${d.getFullYear()}`;
};

const anneeScolaireCourante = () => {
  const d = new Date();
  const y = d.getFullYear();
  return d.getMonth() >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
};

const anneeScolaireDepuisDate = (v) => {
  if (!v) return "—";
  const s = String(v).trim();
  if (/^\d{4}\s*[-_/]\s*\d{4}$/.test(s)) return s.replace(/\s*[_/]\s*/g, "-").replace(/\s/g, "");
  let d = null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  else {
    const t = new Date(s);
    if (!isNaN(t.getTime())) d = t;
  }
  if (!d) return s;
  const y = d.getFullYear();
  return d.getMonth() >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
};

const normaliserAnneeLabel = (a) =>
  a === null || a === undefined ? "" : String(a).trim().replace(/[_/]/g, "-");

const CLES_SERIES_EFFECTIFS = [
  "effectifs_par_annee", "effectifs_annuels", "historique_effectifs",
  "evolution_effectifs", "evolution",
];

const extraireSerieEffectifs = (item) => {
  const out = {};
  const ajouter = (annee, val) => {
    const label = normaliserAnneeLabel(annee);
    const n = toNumber(val);
    if (label && n !== null) out[label] = n;
  };

  for (const cle of CLES_SERIES_EFFECTIFS) {
    const v = item?.[cle];
    if (Array.isArray(v)) {
      v.forEach((e) =>
        ajouter(
          e?.annee ?? e?.annee_scolaire,
          e?.effectif ?? e?.effectif_total ?? e?.total ??
          e?.effectif_t9 ?? e?.effectif_t5 ??
          e?.eff_ps ?? e?.eff_ms ?? e?.eff_gs ??
          e?.eff_t5 ?? e?.eff_t9 ?? null
        )
      );
    } else if (v && typeof v === "object") {
      Object.entries(v).forEach(([a, val]) => ajouter(a, val));
    }
  }

  Object.entries(item || {}).forEach(([k, val]) => {
    const m = k.match(/(20\d{2})[_-]?(20\d{2})/);
    if (m && /^(eff|effectif|ps|ms|gs)/i.test(k) && typeof val !== "object") {
      ajouter(`${m[1]}-${m[2]}`, val);
    }
  });

  return out;
};

const estPayeParEtat = (statut) => {
  const s = String(statut ?? "").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!s) return false;
  if (s.includes("non subvention") || s.includes("non fonction")) return false;
  return s.includes("fonction") || s.includes("subvention") ||
    s.includes("ecd") || s.includes("etat");
};

const estDiplomeSuperieur = (diplome) => {
  const s = String(diplome ?? "").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return /bacc\s*\+\s*([3-9])|licence|master|doctorat|maitrise|dea|dess|ingenieur/.test(s);
};

const valeurOuiNon = (v) => {
  if (v === null || v === undefined || String(v).trim() === "") return "—";
  const s = String(v).trim().toLowerCase();
  if (v === true || s === "true" || s === "1" || s.startsWith("oui")) return "Oui";
  if (v === false || s === "false" || s === "0" || s.startsWith("non")) return "Non";
  return String(v);
};

const texteObstacle = (p) => {
  const nature = p?.nature_obstacle ?? p?.nature;
  if (nature !== null && nature !== undefined && String(nature).trim() !== "") return String(nature);
  const ob = p?.obstacle;
  if (typeof ob === "boolean") return ob ? "Oui" : "Non";
  if (ob !== null && ob !== undefined && String(ob).trim() !== "") return String(ob);
  return "—";
};

const genererFicheTechnique = (
  demande,
  carteBase64 = null,
  analyseValidee = null,
) => {
  if (!demande) return "";

  const typeDemandeNormalise = String(demande?.type_demande || "")
    .trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const estRegularisation = typeDemandeNormalise.includes("regularisation");

  const niveauKey = niveauToKey(demande?.niveau_etab || demande?.niveau);
  const cfg = FICHE_NIVEAU[niveauKey] || FICHE_NIVEAU.primaire;
  const estEcole = niveauKey === "college" || niveauKey === "lycee";

  const nomEtab = fmtFr(demande?.nom_etab);
  const commune = getLocalisationValue(demande, "commune");
  const cisco = getLocalisationValue(demande, "cisco");
  const dren = getLocalisationValue(demande, "dren");
  const fokontany = getLocalisationValue(demande, "fokontany");
  const village = getLocalisationValue(demande, "village");
  const zap = getLocalisationValue(demande, "zap");

  const codeProvisoire = getCodeProvisoireMen(demande) || "NÉANT";
  const nomDemandeur = getDemandeur(demande);
  const motifDemande = premierNonVide(demande?.motif, demande?.motifs, demande?.objet_demande);
  const dateDepotBrute = demande?.date_depot ?? demande?.date_creation;

  const ressources = demande?.ressources || {};
  const regularisation = demande?.regularisation || {};
  const nouvelleCreation = demande?.nouvelle_creation || {};
  const sourceInfra = estRegularisation ? regularisation : nouvelleCreation;

  const surfaceTerrain = premierNonVide(
    // Nouvelle création
    nouvelleCreation?.surface_terrain_prevu,
    nouvelleCreation?.surface_terrain,
    nouvelleCreation?.superficie_terrain,
    nouvelleCreation?.superficie,
    nouvelleCreation?.surface,
    nouvelleCreation?.superficie_terrain_prevu,
    // Régularisation
    regularisation?.surface_terrain,
    regularisation?.superficie_terrain,
    regularisation?.superficie,
    regularisation?.surface,
    // Ressources
    ressources?.surface_terrain,
    ressources?.superficie_terrain,
    ressources?.superficie,
    ressources?.surface,
    // À la racine de la demande
    demande?.surface_terrain,
    demande?.superficie_terrain,
    demande?.superficie,
    demande?.surface,
    // Info complémentaire
    demande?.info_complementaire?.surface_terrain,
    demande?.info_complementaire?.superficie_terrain,
  );

  const aire = getAireRecrutementAnalyse(demande);
  const proches = getEtablissementsProchesPourNiveau(demande);
  const pieces = getPiecesAnalyse(demande);
  const evolutionNorm = normaliserEvolutionPourAffichage(demande);

  const evolutionTriee = [...evolutionNorm].sort((a, b) =>
    normaliserAnneeLabel(a?.annee ?? a?.annee_scolaire).localeCompare(
      normaliserAnneeLabel(b?.annee ?? b?.annee_scolaire)
    )
  );
  const dernieresAnnees = evolutionTriee.slice(-3);
  const anneeDerniereConnue =
    normaliserAnneeLabel(
      evolutionTriee[evolutionTriee.length - 1]?.annee ??
        evolutionTriee[evolutionTriee.length - 1]?.annee_scolaire
    ) || anneeScolaireCourante();
  const effectifDerniere = calculerDernierEffectifConnu(demande);

  const anneeEnquete = anneeDerniereConnue;
  const anneeEnqueteCourte = anneeEnquete.replace(/(\d{2})(\d{2})-(\d{2})(\d{2})/, "$2-$4");

  const th = (txt, attrs = "") => `<th ${attrs}>${esc(txt)}</th>`;
  const td = (txt, attrs = "") => `<td ${attrs}>${esc(txt)}</td>`;
  const tbl = (thead, tbody, cls = "", largeurs = []) => {
    const colgroup = largeurs.length
      ? `<colgroup>${largeurs.map((w) => `<col style="width:${w}%" width="${w}%" />`).join("")}</colgroup>`
      : "";
    const corps = tbody.replace(/<tr class="total">[\s\S]*?<\/tr>/g, (m) =>
      m.replace(/<td /g, '<td style="font-weight:bold;background:#eaeff6;" ')
    );
    return `<table class="${cls}" width="100%" border="1" cellspacing="0" cellpadding="4">${colgroup}<thead>${thead}</thead><tbody>${corps}</tbody></table>`;
  };
  const source = (txt) => `<p class="source">Source : ${esc(txt)}</p>`;
  const tiret = (html) => `<p class="tiret">–&nbsp;&nbsp;${html}</p>`;
  const puce = (html) => `<p class="puce-titre">•&nbsp;&nbsp;${html}</p>`;
  const vide = `<p class="vide">NÉANT</p>`;
  const section = (num, titre) =>
    `<h2><span class="num">${num} -</span> ${esc(titre)} :</h2>`;
  const sousTitre = (num, titre) => `<h3>${num ? `${num} - ` : ""}${esc(titre)}</h3>`;
  const ligneLoc = (label, valeur) =>
    `<p class="loc">${esc(label).padEnd(10, " ").replace(/ /g, "&nbsp;")}<span class="deux-points">:</span> <strong>${esc(valeur)}</strong></p>`;

  const objetHtml = `<p class="texte">Demande d'ouverture officielle ${esc(cfg.de)}<strong>${esc(cfg.long)} ${esc(nomEtab)}</strong>, CISCO <strong>${esc(cisco)}</strong>, DREN <strong>${esc(dren)}</strong>.</p>`;

  const contexteHtml = `<p class="texte">Par sa lettre${dateDepotBrute ? ` en date du <strong>${esc(dateLongueFr(dateDepotBrute))}</strong>` : ""}, ${nomDemandeur !== "—" ? `<strong>${esc(nomDemandeur)}</strong>, ` : ""}commune de <strong>${esc(commune)}</strong>, CISCO de <strong>${esc(cisco)}</strong>, DREN de <strong>${esc(dren)}</strong>, sollicite la délivrance de l'autorisation d'ouverture officielle ${esc(cfg.de)}<strong>${esc(cfg.long)} ${esc(nomEtab)}</strong>.</p>${motifDemande ? `<p class="texte"><em>Motif invoqué :</em> ${esc(motifDemande)}</p>` : ""}`;

  const piecesHtml = Array.isArray(pieces) && pieces.length
    ? pieces.map((p, i) => {
        const nom = p?.nom_piece || p?.nom || p?.libelle || "—";
        const fourni = p?.fourni === undefined ? true : Boolean(p?.fourni);
        const fin = i === pieces.length - 1 ? "" : " ;";
        return tiret(`${esc(nom)}${fourni ? "" : " <em>(non fournie)</em>"}${fin}`);
      }).join("")
    : vide;

  const anneeOuvertureProv = regularisation?.date_ouverture
    ? anneeScolaireDepuisDate(regularisation.date_ouverture) : null;

  const lieuImplantation =
    [village !== "—" ? village : "", fokontany !== "—" ? `fokontany ${fokontany}` : ""]
      .filter(Boolean).join(", ") || "NÉANT";

  const localisationHtml = `
    ${tiret(`Lieu d'implantation : <strong>${esc(lieuImplantation)}</strong>`)}
    <div class="bloc-loc">
      ${ligneLoc("Code", codeProvisoire)}
      ${ligneLoc("COMMUNE", commune)}
      ${zap !== "—" ? ligneLoc("ZAP", zap) : ""}
      ${ligneLoc("CISCO", cisco)}
      ${ligneLoc("DREN", dren)}
    </div>
    ${tiret(`Superficie du domaine : <strong>${surfaceTerrain !== null ? `${esc(fmtMilliers(surfaceTerrain))} m²` : "NÉANT"}</strong>`)}
    ${anneeOuvertureProv ? tiret(`Année d'ouverture provisoire : <strong>${esc(anneeOuvertureProv)}</strong>`) : ""}
  `;

  const lat = getLatitude(demande);
  const lng = getLongitude(demande);

  const carteHtml = carteBase64
    ? `<div class="carte"><img src="${carteBase64}" alt="Analyse spatiale" class="carte-image" width="680" /><p class="carte-source">${lat !== null && lng !== null ? `Coordonnées : ${lat.toFixed(5)}, ${lng.toFixed(5)} — ` : ""}SOURCE MEN / DPE ${new Date().getFullYear()}</p></div>`
    : lat !== null && lng !== null
    ? `<p class="vide">Carte en cours de génération… (coordonnées : ${lat.toFixed(5)}, ${lng.toFixed(5)})</p>`
    : `<p class="vide">Coordonnées GPS non disponibles pour la carte.</p>`;

  let aireTableHtml = vide;
  let totauxAnnuelsAire = [];

  if (aire.length && estEcole) {
    const LABEL_DERNIERE = "Dernière année connue";
    const valeurUnique = (item) =>
      toNumber(niveauKey === "lycee" ? item?.effectif_t9 ?? item?.effectif : item?.effectif_t5 ?? item?.effectif);

    const series = aire.map((item) => {
      const s = extraireSerieEffectifs(item);
      if (Object.keys(s).length) return s;
      const u = valeurUnique(item);
      return u !== null ? { [LABEL_DERNIERE]: u } : {};
    });

    const annees = Array.from(new Set(series.flatMap((s) => Object.keys(s)))).sort((a, b) => {
      if (a === LABEL_DERNIERE) return 1;
      if (b === LABEL_DERNIERE) return -1;
      return a.localeCompare(b);
    });
    const colonnes = annees.length ? annees : [LABEL_DERNIERE];
    const totaux = colonnes.map((c) => series.reduce((acc, s) => acc + (s[c] ?? 0), 0));
    totauxAnnuelsAire = totaux;

    const head = `<tr>${th("CODE ETAB", 'rowspan="2"')}${th(cfg.aireNomCol, 'rowspan="2"')}${th(`Distance par rapport ${cfg.auNouveau} à vol d'oiseau`, 'rowspan="2"')}${th(cfg.aireEffLabel, `colspan="${colonnes.length}"`)}</tr><tr>${colonnes.map((c) => th(c)).join("")}</tr>`;

    const body = aire.map((item, i) => {
      const s = series[i];
      const nom = item?.nom_inferieur ?? item?.nom_ecole ?? getNomAireItem(item);
      return `<tr>${td(getCodeAireItem(item), 'class="c"')}${td(nom)}${td(fmtDistanceFiche(item?.distance_future ?? item?.distance_km ?? item?.distance), 'class="c"')}${colonnes.map((c) => td(s[c] !== undefined ? s[c] : "—", 'class="c"')).join("")}</tr>`;
    }).join("") + `<tr class="total">${td("Total", 'colspan="3"')}${totaux.map((t) => td(t, 'class="c"')).join("")}</tr>`;

    aireTableHtml = tbl(head, body, "aire");
  } else if (aire.length) {
    const popTotal = aire.reduce((acc, item) =>
      acc + toNum(item?.population ?? item?.population_scolarisable), 0);
    totauxAnnuelsAire = [popTotal];

    const head = `<tr>${th("N°")}${th("Fokontany")}${th("Nom du village")}${th(`Distance par rapport ${cfg.auNouveau} à vol d'oiseau`)}${th("Population")}</tr>`;

    const body = aire.map((item, i) =>
      `<tr>${td(i + 1, 'class="c"')}${td(item?.fokontany ?? fokontany ?? "—")}${td(item?.nom_village ?? item?.village_nom ?? item?.nom ?? getNomAireItem(item))}${td(fmtDistanceFiche(item?.distance_future ?? item?.distance_km ?? item?.distance), 'class="c"')}${td(item?.population ?? item?.population_scolarisable ?? "—", 'class="c"')}</tr>`
    ).join("") + `<tr class="total">${td("Total", 'colspan="4"')}${td(popTotal, 'class="c"')}</tr>`;

    aireTableHtml = tbl(head, body, "aire");
  }

  const nbAirePad = String(aire.length).padStart(2, "0");
  const introEvaluation = aire.length
    ? `D'après la demande d'ouverture ${esc(cfg.de)}${esc(cfg.court)} ${esc(nomEtab)}, la zone de recrutement est formée par les <strong>${nbAirePad}</strong> ${esc(cfg.aireNom)} dont les renseignements sont cités ci-après :`
    : `Aucune donnée d'aire de recrutement n'a été renseignée dans la demande d'ouverture ${esc(cfg.de)}${esc(cfg.court)} ${esc(nomEtab)}.`;

  const prochesTries = [...proches].sort((a, b) => {
    const da = toNumber(a?.distance_km ?? a?.distance);
    const db = toNumber(b?.distance_km ?? b?.distance);
    return (da ?? Infinity) - (db ?? Infinity);
  });

  const rayonProches = RAYON_TABLEAU_PROCHES_KM[niveauKey] ?? 5;
  const effectifTotalProches = prochesTries.reduce((acc, p) =>
    acc + toNum(p?.effectif ?? p?.effectif_total), 0);

  const prochesTableHtml = prochesTries.length
    ? tbl(
        `<tr>${th(`Liste des ${cfg.pluriel} existants dans la CISCO de rattachement ainsi que les ${cfg.pluriel} environnants (moins de ${rayonProches} km)`)}${th("Distance à vol d'oiseau avec " + cfg.leNouveau + " (km)")}${th("Obstacle par rapport " + cfg.auNouveau)}${th("Effectif total des élèves")}${th("Nombre de salles de classe utilisées")}</tr>`,
        prochesTries.map((p) =>
          `<tr>${td(String(p?.nom || p?.nom_etab || p?.nom_etablissement || "—").toUpperCase())}${td(fmtDistanceFiche(p?.distance_km ?? p?.distance), 'class="c"')}${td(texteObstacle(p), 'class="c"')}${td(p?.effectif ?? p?.effectif_total ?? "—", 'class="c"')}${td(p?.salle ?? p?.nombre_salle ?? p?.nombre_salle_classe ?? "—", 'class="c"')}</tr>`
        ).join("") + `<tr class="total">${td("TOTAL")}${td("")}${td("")}${td(effectifTotalProches, 'class="c"')}${td("")}</tr>`,
        "proches"
      )
    : vide;

  const colsClasses = NIVEAU_COLONNES_EFFECTIF[niveauKey] || [];

  let effectifsHtml = "";
  if (estRegularisation) {
    if (dernieresAnnees.length && colsClasses.length) {
      const k = colsClasses.length;
      const head = `<tr>${th("")}${dernieresAnnees.map((e) => th(normaliserAnneeLabel(e?.annee ?? e?.annee_scolaire) || "—", `colspan="${k}"`)).join("")}</tr><tr>${th("CLASSE", 'class="l"')}${dernieresAnnees.map(() => colsClasses.map((c) => th(c.label)).join("")).join("")}</tr>`;

      const body = `<tr>${td("EFFECTIFS", 'class="l b"')}${dernieresAnnees.map((e) => colsClasses.map((c) => td(toNumber(e?.[c.key]) ?? "—", 'class="c"')).join("")).join("")}</tr><tr class="total">${td("Total", 'class="l"')}${dernieresAnnees.map((e) => td(toNum(e?.effectif_total), `colspan="${k}" class="c"`)).join("")}</tr>`;

      effectifsHtml = puce(`<strong>Effectif des élèves des trois dernières années scolaires</strong>`) +
        tbl(head, body, "effectifs dense", [13, ...dernieresAnnees.flatMap(() => colsClasses.map(() => 87 / (3 * k)))].slice(0, 1 + dernieresAnnees.length * k)) +
        source(`Dossier d'ouverture ${nomEtab}`);
    } else {
      effectifsHtml = puce(`<strong>Effectif des élèves des trois dernières années scolaires</strong>`) + vide;
    }
  }

  const nbBatiments = premierNonVide(sourceInfra?.nbr_batiment, sourceInfra?.nombre_batiment, sourceInfra?.nombre_batiment_prevu);
  const nbSalles = premierNonVide(sourceInfra?.nbr_salle, sourceInfra?.nombre_salle, sourceInfra?.nombre_salle_prevu);
  const nbBureaux = premierNonVide(sourceInfra?.nombre_bureau, sourceInfra?.nbr_bureau, sourceInfra?.bureau, ressources?.nombre_bureau, ressources?.nbr_bureau, ressources?.bureau);
  const nbLatrines = premierNonVide(sourceInfra?.latrine_total, ressources?.latrine_total);
  const nbPointsEau = premierNonVide(sourceInfra?.nombre_point_eau, sourceInfra?.nbr_point_eau, sourceInfra?.point_eau, ressources?.nombre_point_eau, ressources?.nbr_point_eau, ressources?.point_eau);
  const terrainSport = (() => {
    const candidats = [
      sourceInfra?.terrain_sport,
      sourceInfra?.terrain_de_sport,
      ressources?.terrain_sport,
      ressources?.terrain_de_sport,
      demande?.terrain_sport,
      demande?.terrain_de_sport,
    ];
    for (const v of candidats) {
      if (v === true || v === false) return v;          // ✅ booléen direct
      if (v === 0 || v === 1) return Boolean(v);        // ✅ numérique
      if (typeof v === "string" && v.trim() !== "") {
        const s = v.trim().toLowerCase();
        if (["true", "1", "oui", "yes", "bon", "x"].includes(s)) return true;
        if (["false", "0", "non", "no", "aucun"].includes(s)) return false;
      }
    }
    return false;
  })();

  const infraHtml = puce(`<strong>${estRegularisation ? `Infrastructure ${esc(cfg.duNouveau)}` : "Infrastructure prévue pour la nouvelle création"}</strong>`) +
    tbl(
      `<tr>${th("Nombre de bâtiments")}${th("Salles de classe")}${th("Bureau")}${th("Latrines")}${th("Point d'eau")}${th("Terrain de sport (Oui ou Non)")}</tr>`,
      `<tr>${td(nbBatiments ?? "—", 'class="c"')}${td(nbSalles ?? "—", 'class="c"')}${td(nbBureaux ?? "—", 'class="c"')}${td(nbLatrines ?? "—", 'class="c"')}${td(nbPointsEau ?? "—", 'class="c"')}${td(valeurOuiNon(terrainSport), 'class="c"')}</tr>`,
      "infra"
    );

  const personnelDetail = getPersonnelDetailAnalyse(demande);
  let personnelTableHtml = vide;
  let modePersonnel = "aucun";
  let nbEnseignants = 0;
  let nbDiplomes = 0;
  let nbPayesEtat = 0;

  if (Array.isArray(personnelDetail) && personnelDetail.length > 0) {
    const premier = personnelDetail[0] || {};
    const estFicheEnseignant =
      "nom_enseignant" in premier || "nom_prenoms" in premier ||
      "date_entreeAdmin" in premier || "date_entree" in premier ||
      "diplome_academique" in premier || "diplome_pedagogique" in premier ||
      "profil" in premier || "fonction" in premier || "statut" in premier;

    if (estFicheEnseignant) {
      modePersonnel = "detail";
      nbEnseignants = personnelDetail.length;

      const lignes = personnelDetail.map((p, i) => {
        const nom = p?.nom_enseignant || p?.nom_prenoms || p?.nomPrenoms ||
          [p?.nom, p?.prenoms].filter(Boolean).join(" ") || "—";
        const dateEntree =  p?.agent_etat_entree_administration || p?.date_entree_admin ||
          p?.date_entree || p?.date_entree_administration ||
          p?.date_entree_dans_administration || "—";
        const statut = p?.statut ?? p?.statut2 ?? "—";

        const matieres = [p?.matiere_enseignee_1, p?.matiere_enseignee_2, p?.matiere_enseignee_3]
          .filter((m) => m !== null && m !== undefined && String(m).trim() !== "");
        const matiere = matieres.length ? matieres.join(", ")
          : Array.isArray(p?.matieres) ? p.matieres.join(", ")
          : p?.matiere_enseignee ?? p?.matiere ?? p?.matieres ?? "—";

        if (estDiplomeSuperieur(p?.diplome_academique)) nbDiplomes++;
        if (estPayeParEtat(statut)) nbPayesEtat++;

        return `<tr>${td(`${i + 1}. ${String(nom).toUpperCase()}`)}${td(p?.fonction || p?.poste || "—", 'class="c"')}${td(statut, 'class="c"')}${td(dateEntree || "—", 'class="c"')}${td(p?.diplome_academique || "—", 'class="c"')}${td(p?.diplome_pedagogique || "—", 'class="c"')}${td(matiere, 'class="c"')}</tr>`;
      });

      personnelTableHtml = tbl(
        `<tr>${th("NOM ET PRÉNOMS")}${th("FONCTION")}${th("STATUT")}${th("DATE D'ENTRÉE DANS L'ADMINISTRATION")}${th("DIPLÔME ACADÉMIQUE")}${th("DIPLÔME PÉDAGOGIQUE")}${th("MATIÈRE ENSEIGNÉE")}</tr>`,
        lignes.join(""), "personnel dense", [23, 10, 14, 12, 13, 12, 16]
      );
    } else {
      modePersonnel = "agrege";
      const tri = [...personnelDetail].sort((a, b) =>
        String(a?.annee_scolaire ?? a?.annee ?? "").localeCompare(String(b?.annee_scolaire ?? b?.annee ?? ""))
      );
      const derniere = tri[tri.length - 1] || {};
      nbEnseignants = toNum(derniere?.nombre_enseignants ?? derniere?.nombre_enseignant);
      nbPayesEtat = toNum(derniere?.nombre_enseignant_fonctionnaire ?? derniere?.nombre_fonctionnaire) +
        toNum(derniere?.nombre_enseignant_subventionne ?? derniere?.nombre_subventionne);

      personnelTableHtml = tbl(
        `<tr>${th("ANNÉE SCOLAIRE")}${th("ENSEIGNANTS")}${th("FONCTIONNAIRES")}${th("NON SALARIÉS")}${th("SUBVENTIONNÉS")}</tr>`,
        tri.map((p) =>
          `<tr>${td(p?.annee_scolaire || p?.annee || "—", 'class="c"')}${td(p?.nombre_enseignants ?? p?.nombre_enseignant ?? "—", 'class="c"')}${td(p?.nombre_enseignant_fonctionnaire ?? p?.nombre_fonctionnaire ?? "—", 'class="c"')}${td(p?.nombre_enseignant_non_salarie ?? p?.nombre_non_salarie ?? "—", 'class="c"')}${td(p?.nombre_enseignant_subventionne ?? p?.nombre_subventionne ?? "—", 'class="c"')}</tr>`
        ).join(""), "personnel"
      );
    }
  }

  const personnelHtml = puce(`<strong>${estRegularisation ? "Renseignement du personnel" : "Enseignants prévus pour la nouvelle création"}</strong>`) + personnelTableHtml;

  const plusProche = prochesTries.find((p) => toNumber(p?.distance_km ?? p?.distance) !== null);
  const c1 = plusProche
    ? `${esc(cfg.article)} ${esc(cfg.court)} <strong>${esc(String(plusProche?.nom || plusProche?.nom_etab || plusProche?.nom_etablissement || "—").toUpperCase())}</strong> le plus proche se situe à <strong>${esc(fmtDistanceFiche(plusProche?.distance_km ?? plusProche?.distance))}</strong> à vol d'oiseau.`
    : getDistancePlusProche(demande) !== null
    ? `L'établissement existant le plus proche se situe à <strong>${esc(fmtDistanceFiche(getDistancePlusProche(demande)))}</strong> à vol d'oiseau.`
    : `Aucun établissement existant de même niveau n'est recensé à proximité dans le dossier.`;

  const totauxValides = totauxAnnuelsAire.filter((n) => Number.isFinite(n));
  const minAire = totauxValides.length ? Math.min(...totauxValides) : null;
  const maxAire = totauxValides.length ? Math.max(...totauxValides) : null;
  const dernierTotalAire = totauxValides.length ? totauxValides[totauxValides.length - 1] : null;

  const sujetAire = estEcole ? "L'effectif des élèves susceptibles de fréquenter" : "La population scolarisable susceptible de fréquenter";
  const c2 = maxAire === null || maxAire === 0
    ? `Les données d'effectif de l'aire de recrutement ne sont pas disponibles dans le détail de la demande.`
    : minAire === maxAire
    ? `${sujetAire} ${esc(cfg.leNouveau)} <strong>${esc(nomEtab)}</strong> dans sa zone de recrutement est de <strong>${esc(maxAire)}</strong>.`
    : `${sujetAire} ${esc(cfg.leNouveau)} <strong>${esc(nomEtab)}</strong> dans sa zone de recrutement varie de <strong>${esc(minAire)}</strong> à <strong>${esc(maxAire)}</strong>.`;

  const seuil = SEUIL_EFFECTIF_MIN[niveauKey] ?? null;
  const comparerSeuil = (n) => {
    if (seuil === null) return "";
    if (n >= seuil) return `, soit conforme au seuil minimum requis par la carte scolaire (<strong>${esc(seuil)}</strong> élèves)`;
    if (n < seuil / 2) return `, soit <strong>très en dessous</strong> du seuil minimum requis par la carte scolaire (<strong>${esc(seuil)}</strong> élèves)`;
    return `, soit <strong>en dessous</strong> du seuil minimum requis par la carte scolaire (<strong>${esc(seuil)}</strong> élèves)`;
  };

  let c3;
  if (estRegularisation) {
    c3 = evolutionTriee.length > 0
      ? `Pour l'année scolaire <strong>${esc(anneeDerniereConnue)}</strong>, <strong>${esc(effectifDerniere)}</strong> élève(s) sont inscrits${comparerSeuil(effectifDerniere)}.`
      : `Aucun effectif d'élèves n'est renseigné pour les dernières années scolaires.`;
  } else {
    c3 = dernierTotalAire !== null && dernierTotalAire > 0
      ? `L'établissement n'ayant pas encore d'élèves inscrits, l'effectif potentiel retenu dans l'aire de recrutement est de <strong>${esc(dernierTotalAire)}</strong> élève(s)${comparerSeuil(dernierTotalAire)}.`
      : `L'établissement n'ayant pas encore d'élèves inscrits, aucun effectif potentiel n'est disponible pour l'aire de recrutement.`;
  }

  let c4;
  if (nbEnseignants === 0) {
    c4 = `Aucune information sur le personnel enseignant n'est renseignée dans la demande.`;
  } else {
    let diplomeTxt = "";
    if (modePersonnel === "detail") {
      if (nbDiplomes === 0) diplomeTxt = `, dont aucun n'est diplômé de licence ou plus`;
      else if (nbDiplomes / nbEnseignants >= 0.5) diplomeTxt = `, majoritairement diplômés de licence ou plus`;
      else diplomeTxt = `, dont <strong>${nbDiplomes}</strong> diplômé(s) de licence ou plus`;
    }
    const etatTxt = nbPayesEtat === 0
      ? `, mais <strong>aucun enseignant n'est payé par l'État</strong>`
      : `, et <strong>${nbPayesEtat}</strong> sont payé(s) par l'État`;
    c4 = `Le personnel enseignant ${estRegularisation ? "est" : "prévu est"} composé de <strong>${nbEnseignants}</strong> agent(s)` + diplomeTxt + etatTxt + `.`;
  }

const surfaceNum = toNumber(surfaceTerrain);
const normeSurface = 2000;
let c5;
if (surfaceNum === null || surfaceNum === 0) {
  c5 = `La surface du terrain disponible pour la construction des infrastructures scolaires n'est pas renseignée.`;
} else if (surfaceNum >= normeSurface * 1.5) {
  c5 = `La surface du terrain disponible pour la construction des infrastructures scolaires est de <strong>${esc(fmtMilliers(surfaceNum))} m²</strong>, respectant <strong>largement</strong> la norme requise de ${esc(fmtMilliers(normeSurface))} m².`;
} else if (surfaceNum >= normeSurface) {
  c5 = `La surface du terrain disponible pour la construction des infrastructures scolaires est de <strong>${esc(fmtMilliers(surfaceNum))} m²</strong>, respectant la norme requise de ${esc(fmtMilliers(normeSurface))} m².`;
} else {
  c5 = `La surface du terrain disponible pour la construction des infrastructures scolaires est de <strong>${esc(fmtMilliers(surfaceNum))} m²</strong>, <strong>inférieure</strong> à la norme requise de ${esc(fmtMilliers(normeSurface))} m².`;
}

  const verdictHtml = analyseValidee === true
    ? `Au vu de ces éléments, le comité <strong>suggère l'ouverture</strong> ${esc(cfg.de)}${esc(cfg.long)} <strong>${esc(nomEtab)}</strong>, les conditions essentielles pour la création officielle de l'établissement étant respectées.`
    : `Au vu de ces éléments, le comité <strong>ne suggère pas l'ouverture</strong> ${esc(cfg.de)}${esc(cfg.long)} <strong>${esc(nomEtab)}</strong>, étant donné que les conditions essentielles pour la création officielle de l'établissement ne sont pas encore entièrement respectées.`;

  return `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8" /><title>Fiche technique ${esc(nomEtab)}</title><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]--><style>@page { size: A4; margin: 18mm 16mm; } body { font-family: "Times New Roman", Times, serif; font-size: 11.5pt; line-height: 1.4; color: #111827; } @media screen { body { max-width: 210mm; margin: 0 auto; padding: 14mm 16mm; background: #fff; } } .entete { text-align: center; margin-bottom: 6px; } .entete .t1 { font-size: 20pt; font-weight: bold; letter-spacing: 3px; color: #1f3864; margin: 0; } .entete .t2 { font-size: 12pt; font-weight: bold; margin: 6px 0 0 0; } .entete .t3 { font-size: 15pt; font-weight: bold; color: #1f3864; margin: 2px 0 0 0; text-transform: uppercase; } h2, h3, p.puce-titre { page-break-after: avoid; } table.dense, table.personnel { table-layout: fixed; } th, td { word-wrap: break-word; } h2 { font-size: 12.5pt; color: #1f3864; margin: 18px 0 6px 0; padding-bottom: 2px; border-bottom: 1px solid #9fb2d0; } h2 .num { margin-right: 4px; } h3 { font-size: 11.5pt; margin: 14px 0 4px 0; color: #111827; } p { margin: 4px 0; } p.texte { text-align: justify; text-indent: 28pt; } p.tiret { margin: 3px 0 3px 18pt; text-indent: -14pt; text-align: justify; } p.puce-titre { margin: 12px 0 4px 6pt; } .bloc-loc { margin: 2px 0 2px 44pt; } p.loc { margin: 1px 0; } .vide { font-style: italic; color: #6b7280; } p.source { font-style: italic; font-size: 9.5pt; color: #374151; margin: 3px 0 10px 0; } table { width: 100%; border-collapse: collapse; margin: 6px 0 4px 0; font-size: 10pt; border: 1px solid #5b6b82; } th, td { border: 1px solid #5b6b82; padding: 4px 6px; vertical-align: middle; text-align: left; } th { background: #dbe5f1; color: #1f3864; font-weight: bold; text-align: center; } th.l, td.l { text-align: left; } td.b { font-weight: bold; } td.c { text-align: center; } tr { page-break-inside: avoid; } tbody tr:nth-child(even) td { background: #f6f8fb; } tr.total td { background: #eaeff6 !important; font-weight: bold; } table.dense { font-size: 8.5pt; } table.dense th, table.dense td { padding: 3px 3px; } table.personnel { font-size: 8pt; } table.personnel th, table.personnel td { padding: 3px 4px; } .carte { page-break-before: always; page-break-after: always; text-align: center; margin: 0; } .carte-image { width: 100%; max-width: 100%; height: auto; border: 1px solid #5b6b82; } .carte-source { font-size: 8.5pt; color: #4b5563; margin-top: 4px; text-align: center; } .conclusion { margin-top: 4px; } .verdict { margin-top: 10px; text-align: justify; text-indent: 28pt; } .signatures { margin-top: 26px; page-break-inside: avoid; } .signatures p { font-weight: bold; margin: 0 0 54px 0; line-height: 1.3; } .signatures .g { text-align: left; width: 48%; } .signatures .d { text-align: right; margin-left: 52%; } .signatures .m { text-align: center; }</style></head><body>
  <div class="entete" style="text-align:center;"><p class="t1" style="font-size:20pt;font-weight:bold;letter-spacing:3px;color:#1f3864;margin:0;text-align:center;">FICHE TECHNIQUE</p><p class="t2" style="font-size:12pt;font-weight:bold;margin:6px 0 0 0;text-align:center;">AUTORISATION D'OUVERTURE OFFICIELLE ${esc(cfg.de.toUpperCase())}${esc(cfg.long.toUpperCase())}</p><p class="t3" style="font-size:15pt;font-weight:bold;color:#1f3864;margin:2px 0 0 0;text-align:center;">${esc(nomEtab.toUpperCase())}</p></div>
  <hr style="border:0;border-top:2px solid #1f3864;width:40%;margin:8px auto 14px auto;" />
  ${section("I", "Objet")}${objetHtml}
  ${section("II", "Contexte")}${contexteHtml}
  ${section("III", "Pièces jointes")}${piecesHtml}
  ${section("IV", "Localisation de l'établissement")}${localisationHtml}
  ${carteHtml}
  ${section("V", "Évaluation technique du dossier")}<p class="texte">${introEvaluation}</p>
  ${sousTitre("1", `Aire de recrutement (${cfg.aireNom} devant envoyer des élèves ${cfg.auNouveau})`)}${aireTableHtml}${aire.length ? source(`Fiche Primaire d'Enquête ${anneeEnquete}`) : ""}
  ${sousTitre("2", `${cfg.pluriel.charAt(0).toUpperCase() + cfg.pluriel.slice(1)} existants dans la CISCO de rattachement ainsi que les ${cfg.pluriel} environnants.`)}${prochesTableHtml}${prochesTries.length ? source(`FPE ${anneeEnqueteCourte}`) : ""}
  ${sousTitre("3", `Situation ${cfg.duNouveau}`)}${effectifsHtml}${infraHtml}${personnelHtml}
  <h2>CONCLUSION :</h2>
  <div class="conclusion">${tiret(c1)}${tiret(c2)}${tiret(c3)}${tiret(c4)}${tiret(c5)}<p class="verdict">${verdictHtml}</p></div>
  <div class="signatures"><p class="g">Avis de Madame Le Directeur de la Planification de l'Éducation</p><p class="d">Avis de Monsieur le Directeur de l'Enseignement Secondaire</p><p class="g">Avis de Madame le Directeur Général en charge des Établissements Scolaires</p><p class="d">Avis de Madame Le Secrétaire Général</p><p class="m">Décision du Ministre de l'Éducation Nationale</p></div>
  </body></html>`.trim();
};

const telechargerFicheDOCX = (demande, htmlRiche) => {
  if (!demande || !htmlRiche) return;
  const nomFichier = `Fiche_Technique_${String(demande?.nom_etab || "etablissement").replace(/[^a-zA-Z0-9_-]/g, "_")}_${new Date().toISOString().slice(0, 10)}.doc`;
  const blob = new Blob(["\ufeff", htmlRiche], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomFichier;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const imprimerFichePDF = (demande, htmlRiche) => {
  if (!demande || !htmlRiche) return;
  const win = window.open("", "_blank");
  if (!win) { alert("Merci d'autoriser les pop-ups."); return; }
  const html = htmlRiche.replace("</body>", `<script>window.onload = function() { setTimeout(function(){ window.print(); }, 700); };</script></body>`);
  win.document.open();
  win.document.write(html);
  win.document.close();
};

function RecenterMap({ points }) {
  const map = useMap();
  const signature = points.map((p) => p.join(",")).join("|");

  useEffect(() => {
    const timers = [50, 300, 700].map((ms) => setTimeout(() => map.invalidateSize(), ms));
    const timer = setTimeout(() => {
      if (!points.length) return;
      const pointsValides = points.filter(([lat, lng]) => {
        const okLat = typeof lat === "number" && lat >= -26 && lat <= -11;
        const okLng = typeof lng === "number" && lng >= 42 && lng <= 52;
        return okLat && okLng;
      });
      if (pointsValides.length === 0) return;
      if (pointsValides.length === 1) { map.setView(pointsValides[0], 12, { animate: false }); return; }
      try {
        const bounds = L.latLngBounds(pointsValides);
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const spanLat = Math.abs(ne.lat - sw.lat);
        const spanLng = Math.abs(ne.lng - sw.lng);
        if (spanLat > 1.5 || spanLng > 1.5) { map.setView(pointsValides[0], 11, { animate: false }); return; }
        map.fitBounds(bounds.pad(0.15), { animate: false, maxZoom: 13 });
      } catch (e) { map.setView(pointsValides[0], 11, { animate: false }); }
    }, 350);
    return () => { timers.forEach(clearTimeout); clearTimeout(timer); };
  }, [map, signature]);

  return null;
}

function ForceMinZoom({ minZoom }) {
  const map = useMap();
  useEffect(() => {
    const appliquer = () => { if (map.getZoom() < minZoom) map.setZoom(minZoom, { animate: false }); };
    appliquer();
    map.on("zoomend", appliquer);
    return () => { map.off("zoomend", appliquer); };
  }, [map, minZoom]);
  return null;
}

const calculerMaxBounds = (contourCommune, contourFokontany, futurePosition, rayonKm = 0) => {
  let pts = null;
  let minZoom = 10;
  if (contourCommune && contourCommune.length >= 3) { pts = contourCommune; minZoom = 10; }
  else if (contourFokontany && contourFokontany.length >= 3) { pts = contourFokontany; minZoom = 12; }
  else if (futurePosition) {
    const [lat, lng] = futurePosition;
    const delta = 0.05;
    pts = [[lat - delta, lng - delta], [lat + delta, lng + delta]];
    minZoom = 11;
  }
  if (pts && futurePosition && rayonKm > 0) {
    const [lat, lng] = futurePosition;
    const dLat = rayonKm / 111;
    const dLng = rayonKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
    pts = [...pts, [lat - dLat, lng - dLng], [lat + dLat, lng + dLng]];
    minZoom = rayonKm > 5 ? Math.min(minZoom, 9) : Math.min(minZoom, 10);
  }
  if (!pts || pts.length === 0) return { bounds: null, minZoom: 5 };
  const ptsValides = pts.filter(([lat, lng]) =>
    typeof lat === "number" && typeof lng === "number" && lat >= -26 && lat <= -11 && lng >= 42 && lng <= 52
  );
  if (ptsValides.length === 0) return { bounds: null, minZoom: 5 };
  try {
    const bounds = L.latLngBounds(ptsValides);
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const padLat = (ne.lat - sw.lat) * 0.15;
    const padLng = (ne.lng - sw.lng) * 0.15;
    const boundsAvecMarge = L.latLngBounds(
      [sw.lat - padLat, sw.lng - padLng],
      [ne.lat + padLat, ne.lng + padLng],
    );
    return { bounds: boundsAvecMarge, minZoom };
  } catch (e) { return { bounds: null, minZoom: 5 }; }
};

function convexHull(points) {
  const uniques = Array.from(new Map(points.map((p) => [`${p[0].toFixed(8)},${p[1].toFixed(8)}`, p])).values());
  if (uniques.length <= 2) return uniques;
  const pts = [...uniques].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const cross = (o, a, b) => (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}

const getRayonCarteKm = (niveauKey) => {
  switch (niveauKey) {
    case "prescolaire": case "primaire": return 3;
    case "college": return 8;
    case "lycee": return 25;
    default: return 5;
  }
};

const getRayonRecrutementKm = (niveauKey) => {
  switch (niveauKey) {
    case "prescolaire": return 0.8;
    case "primaire": return 2;
    case "college": return 5;
    case "lycee": return 20;
    default: return 5;
  }
};

const getDistanceKmItem = (item, origine) => {
  const valeurs = [item?.distance_km, item?.distance, item?.distance_future, item?.distance_au_nouveau, item?.distance_nouveau];
  for (const valeur of valeurs) {
    const n = toNumber(valeur);
    if (n !== null && n >= 0) return n;
  }
  if (!origine) return null;
  const position = getPosition(item);
  if (!position) return null;
  const metres = L.latLng(origine).distanceTo(L.latLng(position));
  return Number.isFinite(metres) ? metres / 1000 : null;
};

// ✅ CORRECTION : si pas de distance mais position connue, on considère l'item affichable
const estDansRayonAnalyse = (item, origine, rayonKm) => {
  const distance = getDistanceKmItem(item, origine);
  if (distance === null) {
    const position = getPosition(item);
    return Boolean(position);
  }
  return distance <= rayonKm + 0.05;
};

const getGeometryCandidates = (demande, type) => {
  if (!demande) return [];
  const info = getInfoComplementaireAnalyse(demande);
  const localisation = demande?.localisation_detail ?? demande?.localisation ?? {};
  const commune = demande?.commune_detail ?? localisation?.commune_detail ?? demande?.commune ?? {};
  const fokontany = demande?.fokontany_detail ?? localisation?.fokontany_detail ?? demande?.fokontany ?? {};

  if (type === "commune") {
    return [
      demande?.limite_commune,
      demande?.commune_geometry,
      demande?.commune_contour,
      demande?.contour_commune,
      demande?.geojson_commune,
      commune?.contour,
      commune?.limite,
      commune?.geometry,
      commune?.geojson,
      localisation?.limite_commune,
      localisation?.commune_contour,
      localisation?.commune_geometry,
      localisation?.commune?.contour,
      localisation?.commune?.limite,
      info?.limite_commune,
      info?.commune_contour,
      info?.contour_commune,
      info?.geometry_commune,
    ].filter(Boolean);
  }
  return [
    demande?.limite_fokontany,
    demande?.fokontany_geometry,
    demande?.fokontany_contour,
    demande?.contour_fokontany,
    demande?.geojson_fokontany,
    fokontany?.contour,
    fokontany?.limite,
    fokontany?.geometry,
    fokontany?.geojson,
    localisation?.limite_fokontany,
    localisation?.fokontany_contour,
    localisation?.fokontany_geometry,
    localisation?.fokontany?.contour,
    localisation?.fokontany?.limite,
    info?.limite_fokontany,
    info?.fokontany_contour,
    info?.contour_fokontany,
    info?.geometry_fokontany,
  ].filter(Boolean);
};

const convertirGeometryEnAnneau = (candidate) => {
  if (!candidate) return null;
  if (candidate?.type === "Feature") return convertirGeometryEnAnneau(candidate.geometry);
  if (candidate?.type === "FeatureCollection" && Array.isArray(candidate.features)) {
    let meilleur = null;
    for (const feature of candidate.features) {
      const anneau = convertirGeometryEnAnneau(feature);
      if (anneau && anneau.length >= 3) if (!meilleur || anneau.length > meilleur.length) meilleur = anneau;
    }
    return meilleur;
  }
  if (candidate?.type === "Polygon" && Array.isArray(candidate.coordinates?.[0])) {
    const points = candidate.coordinates[0].map((p) => {
      if (!Array.isArray(p) || p.length < 2) return null;
      const lng = Number(p[0]); const lat = Number(p[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return [lat, lng];
    }).filter((p) => Boolean(p));
    return points.length >= 3 ? points : null;
  }
  if (candidate?.type === "MultiPolygon" && Array.isArray(candidate.coordinates)) {
    let meilleur = null;
    for (const poly of candidate.coordinates) {
      if (!Array.isArray(poly?.[0])) continue;
      const points = poly[0].map((p) => {
        if (!Array.isArray(p) || p.length < 2) return null;
        const lng = Number(p[0]); const lat = Number(p[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return [lat, lng];
      }).filter((p) => Boolean(p));
      if (points.length >= 3) if (!meilleur || points.length > meilleur.length) meilleur = points;
    }
    return meilleur;
  }
  if (Array.isArray(candidate) && candidate.length >= 3) {
    const points = candidate.map((p) => {
      if (Array.isArray(p) && p.length >= 2) {
        const a = Number(p[0]); const b = Number(p[1]);
        if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
        return (Math.abs(a) <= 90 ? [a, b] : [b, a]);
      }
      if (p && typeof p === "object") {
        const lat = Number(p.lat ?? p.latitude ?? p.y);
        const lng = Number(p.lng ?? p.lon ?? p.longitude ?? p.x);
        if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
      }
      return null;
    }).filter((p) => Boolean(p));
    return points.length >= 3 ? points : null;
  }
  if (candidate?.coordinates) return convertirGeometryEnAnneau({ type: candidate.type || "Polygon", coordinates: candidate.coordinates });
  return null;
};

const extraireContour = (demande, type) => {
  for (const candidate of getGeometryCandidates(demande, type)) {
    const anneau = convertirGeometryEnAnneau(candidate);
    if (anneau && anneau.length >= 3) return anneau;
  }
  return null;
};

const estEtablissementNiveau = (item, niveauKey) =>
  normaliserNiveauItem(item) === niveauKey;

const getMapPointLabel = (item, niveauKey, type, demandeContext = {}) => {
  if (type === "nouveau") {
    const main = getNomAireItem({
      ...item,
      nom_etab: item?.nom_etab ?? item?.NOM_ETAB ?? item?.nom_etablissement,
    });
    return {
      main:
        main === "Lieu sans nom fourni par l'API"
          ? "Nouvel établissement"
          : main,
      secondary: "",
    };
  }

  return {
    main: getNomAireItem(item),
    secondary: "",
  };
};

function ExposerCarte({ instanceRef }) {
  const map = useMap();
  useEffect(() => {
    if (instanceRef) instanceRef.current = map;
    return () => { if (instanceRef) instanceRef.current = null; };
  }, [map, instanceRef]);
  return null;
}

function SuivreVue({ vueRef }) {
  const map = useMap();
  useEffect(() => {
    const enregistrer = () => {
      const c = map.getCenter();
      const s = map.getSize();
      vueRef.current = { center: [c.lat, c.lng], zoom: map.getZoom(), size: { x: s.x, y: s.y } };
    };
    map.on("moveend", enregistrer);
    map.on("resize", enregistrer);
    enregistrer();
    return () => { map.off("moveend", enregistrer); map.off("resize", enregistrer); };
  }, [map, vueRef]);
  return null;
}

function DemandeLocalisationMap({
  demande,
  etablissementsProches,
  aireRecrutement,
  aireSansCoord = [],
  mapRef,
  avecCapture = false,
  vueRef = null,
  mapInstanceRef = null,
  captureSize = null,
}) {
  const niveauKey = niveauToKey(demande?.niveau_etab || demande?.niveau);
  const niveauLabel = mapNiveau(demande?.niveau_etab || demande?.niveau);
  const rayonCarte = getRayonCarteKm(niveauKey);
  const futurePosition = getPosition(demande);

  const demandeContext = {
    commune: getLocalisationValue(demande, "commune"),
    cisco: getLocalisationValue(demande, "cisco"),
    fokontany: getLocalisationValue(demande, "fokontany"),
    village: getLocalisationValue(demande, "village"),
  };

  const withPosition = (list) =>
    (Array.isArray(list) ? list : [])
      .map((item) => ({ item, position: getPosition(item) }))
      .filter((x) => Boolean(x.position));

  const recrutement = (Array.isArray(aireRecrutement) ? aireRecrutement : [])
    .map((item) => normaliserAireItem(item, niveauKey));

  const nearbyAll = Array.isArray(etablissementsProches) ? etablissementsProches : [];
  const nearbyFiltered = nearbyAll.filter((item) => estEtablissementNiveau(item, niveauKey));
  const candidatsProximite = nearbyFiltered.length
    ? nearbyFiltered
    : nearbyAll.filter((item) => !normaliserNiveauItem(item));

  const nearbySource = candidatsProximite.filter((item) =>
    estDansRayonAnalyse(item, futurePosition, rayonCarte)
  );

  // ✅ CORRECTION : garder tous les items avec coordonnées
  const recrutementAvecCoord = recrutement.filter((item) => Boolean(getPosition(item)));
  const recrutementDansRayon = recrutementAvecCoord.filter((item) =>
    estDansRayonAnalyse(item, futurePosition, rayonCarte)
  );

  const nearby = withPosition(nearbySource);

  // ✅ CORRECTION : on garde tous les items avec coordonnées, pas seulement ceux du rayon
  const feedersBruts = withPosition(recrutementAvecCoord);

  const feeders = futurePosition
    ? feedersBruts.filter(({ position }) => {
        const [latF, lngF] = position;
        const [latN, lngN] = futurePosition;
        const memeLat = Math.abs(latF - latN) < 0.0001;
        const memeLng = Math.abs(lngF - lngN) < 0.0001;
        return !(memeLat && memeLng);
      })
    : feedersBruts;

  const recrutementSansCoord = [
    ...(Array.isArray(aireSansCoord) ? aireSansCoord : []),
    ...recrutement.filter((item) => !getPosition(item)),
  ];
  const prochesSansCoord = nearbyAll.filter((item) => !getPosition(item));
  const prochesHorsRayon = candidatsProximite.filter((item) => {
    const dist = getDistanceKmItem(item, futurePosition);
    return dist !== null && dist > rayonCarte + 0.05;
  });

  const feederPoints = feeders.map(({ position }) => position);
  const nearbyPoints = nearby.map(({ position }) => position);

  const airePolygon = convexHull([
    ...(futurePosition ? [futurePosition] : []),
    ...feederPoints,
  ]);
  const rayonNorme = getRayonRecrutementKm(niveauKey) * 1000;
  const rayonNormeKm = getRayonRecrutementKm(niveauKey);
  const rayonLabel = rayonNormeKm < 1 ? `${Math.round(rayonNormeKm * 1000)} m` : `${rayonNormeKm} km`;
  const estHorsRayon = (item) => {
    const d = getDistanceKmItem(item, futurePosition);
    return d !== null && d > rayonNormeKm + 0.05;
  };

  const distancesFeeder = futurePosition
    ? feederPoints
        .map((position) => L.latLng(futurePosition).distanceTo(L.latLng(position)))
        .filter((d) => Number.isFinite(d) && d > 0)
    : [];

  const rayonAffichage =
    distancesFeeder.length > 0
      ? Math.min(
          rayonNorme,
          Math.max(rayonNorme * 0.35, Math.max(...distancesFeeder) * 1.15)
        )
      : rayonNorme;

  const contourCommune = extraireContour(demande, "commune");
  const contourFokontany = extraireContour(demande, "fokontany");

  const pointsPourCadrage = (() => {
    if (contourCommune && contourCommune.length >= 3) return contourCommune;
    if (contourFokontany && contourFokontany.length >= 3) return contourFokontany;
    const cercle = [];
    if (futurePosition) {
      const [la, lo] = futurePosition;
      const dLat = rayonNormeKm / 111;
      const dLng = rayonNormeKm / (111 * Math.max(0.2, Math.cos((la * Math.PI) / 180)));
      cercle.push([la - dLat, lo - dLng], [la + dLat, lo + dLng]);
    }
    return [
      ...(futurePosition ? [futurePosition] : []),
      ...nearbyPoints,
      ...feederPoints,
      ...cercle,
    ];
  })();

  const { bounds: maxBounds, minZoom: minZoomCarte } = useMemo(
    () =>
      calculerMaxBounds(contourCommune, contourFokontany, futurePosition, rayonNormeKm),
    [
      contourCommune ? contourCommune.length : 0,
      contourFokontany ? contourFokontany.length : 0,
      futurePosition ? futurePosition.join(",") : "",
      rayonNormeKm,
    ]
  );

  const center = pointsPourCadrage[0] || [-18.8792, 47.5079];
  const usePolygon = airePolygon.length >= 3;

  const nomCommune = getLocalisationValue(demande, "commune");
  const nomFokontany = getLocalisationValue(demande, "fokontany");

  return (
    <div className="space-y-3">
      <div
        ref={mapRef}
        data-capture-carte={avecCapture ? "true" : undefined}
        className="rounded-lg border overflow-hidden relative"
        style={{ background: "#ffffff", ...(avecCapture ? { width: `${(captureSize?.w ?? 1160) + 2}px` } : {}) }}
      >
        <MapContainer
          center={center}
          zoom={12}
          minZoom={avecCapture ? 5 : minZoomCarte}
          maxZoom={18}
          maxBounds={avecCapture ? undefined : (maxBounds ?? undefined)}
          maxBoundsViscosity={1.0}
          scrollWheelZoom={!avecCapture}
          zoomControl={!avecCapture}
          style={{ height: avecCapture ? `${captureSize?.h ?? 500}px` : "500px", width: "100%" }}
          attributionControl={!avecCapture}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            crossOrigin="anonymous"
          />
          <RecenterMap points={pointsPourCadrage} />
          {mapInstanceRef && <ExposerCarte instanceRef={mapInstanceRef} />}
          {!avecCapture && vueRef && <SuivreVue vueRef={vueRef} />}
          {!avecCapture && <ForceMinZoom minZoom={minZoomCarte} />}

          {contourCommune && contourCommune.length >= 3 && (
            <Polygon
              positions={contourCommune}
              pathOptions={{
                color: "#1e3a8a",
                weight: 3,
                opacity: 0.9,
                fillColor: "#3b82f6",
                fillOpacity: 0.08,
              }}
            >
              <Tooltip sticky>
                <strong>Commune : {nomCommune}</strong>
              </Tooltip>
            </Polygon>
          )}

          {contourFokontany && contourFokontany.length >= 3 && (
            <Polygon
              positions={contourFokontany}
              pathOptions={{
                color: "#7c3aed",
                fillColor: "#ede9fe",
                fillOpacity: 0.10,
                weight: 2.5,
                dashArray: "6 4",
              }}
            >
              <Tooltip sticky>
                <strong>Fokontany : {nomFokontany}</strong>
              </Tooltip>
            </Polygon>
          )}

          {futurePosition && usePolygon && (
            <Polygon
              positions={airePolygon}
              pathOptions={{
                color: "#2563eb",
                fillColor: "#bfdbfe",
                fillOpacity: 0.28,
                weight: 2,
                dashArray: "7 5",
              }}
            />
          )}

          {futurePosition && (
            <Circle
              center={futurePosition}
              radius={rayonNorme}
              pathOptions={{
                color: "#1f2937",
                weight: 1.6,
                opacity: 0.9,
                dashArray: "8 6",
                fill: false,
                fillOpacity: 0,
              }}
            >
              <Tooltip sticky>
                <strong>Rayon réglementaire : {rayonLabel}</strong>
              </Tooltip>
            </Circle>
          )}

          {futurePosition && (
            <Marker
              position={futurePosition}
              icon={createLabeledMapIcon(
                COULEUR_ECOLE_NOUVELLE,
                null,
                "",
                getMapPointLabel(demande, niveauKey, "nouveau", demandeContext).main,
                getMapPointLabel(demande, niveauKey, "nouveau", demandeContext).secondary,
                22,
                260,
                "school"
              )}
            >
              <Popup>
                <div className="space-y-1 min-w-[230px]">
                  <div className="font-bold text-amber-600">Nouvel établissement</div>
                  <div>
                    <strong>Nom :</strong> {demande?.nom_etab || "—"}
                  </div>
                  <div>
                    <strong>Niveau :</strong> {niveauLabel}
                  </div>
                  <div>
                    <strong>Village :</strong> {getLocalisationValue(demande, "village")}
                  </div>
                  <div>
                    <strong>Fokontany :</strong> {getLocalisationValue(demande, "fokontany")}
                  </div>
                  <div>
                    <strong>Commune :</strong> {getLocalisationValue(demande, "commune")}
                  </div>
                  <div>
                    <strong>CISCO :</strong> {getLocalisationValue(demande, "cisco")}
                  </div>
                </div>
              </Popup>
            </Marker>
          )}

          {nearby.map(({ item, position }, index) => {
            const label = getMapPointLabel(item, niveauKey, "existant", demandeContext);
            const hors = estHorsRayon(item);
            return (
              <Marker
                key={`proche-${index}`}
                position={position}
                icon={
                  hors
                    ? createLabeledMapIcon(COULEUR_HORS_ZONE, null, "", label.main, label.secondary, 9, 200, "dot")
                    : createLabeledMapIcon(COULEUR_ECOLE_EXISTANTE, null, "", label.main, label.secondary, 16, 200, "school")
                }
              >
                <Popup>
                  <div className="space-y-1 min-w-[230px]">
                    <div className="font-bold text-blue-700">Établissement existant</div>
                    <div><strong>Nom :</strong> {getNomAireItem(item)}</div>
                    <div><strong>Fokontany :</strong> {item?.fokontany ?? "—"}</div>
                    <div><strong>Commune :</strong> {item?.commune ?? demandeContext.commune}</div>
                    <div><strong>Distance :</strong> {item?.distance_km ?? item?.distance ?? "—"} km</div>
                    <div><strong>Effectif :</strong> {item?.effectif ?? item?.effectif_total ?? "—"}</div>
                    <div className={hors ? "font-bold text-red-600" : "font-bold text-green-700"}>
                      {hors ? `Hors du rayon (> ${rayonLabel})` : `Dans le rayon (≤ ${rayonLabel})`}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {feeders.map(({ item, position }, index) => {
            const isSchool = niveauKey === "college" || niveauKey === "lycee";
            const label = getMapPointLabel(item, niveauKey, "alimentant", demandeContext);
            const hors = estHorsRayon(item);
            return (
              <Marker
                key={`alimentant-${index}`}
                position={position}
                icon={createLabeledMapIcon(
                  hors ? COULEUR_HORS_ZONE : COULEUR_COUVERT,
                  null,
                  "",
                  label.main,
                  label.secondary,
                  9,
                  200,
                  "dot"
                )}
              >
                <Popup>
                  <div className="space-y-1 min-w-[240px]">
                    <div className="font-bold text-gray-700">
                      {isSchool ? "École alimentante" : "Village alimentant"}
                    </div>
                    <div>
                      <strong>Nom :</strong> {getNomAireItem(item)}
                    </div>
                    <div>
                      <strong>Fokontany :</strong> {item?.fokontany ?? "—"}
                    </div>
                    <div>
                      <strong>Commune :</strong> {item?.commune ?? demandeContext.commune}
                    </div>
                    {niveauKey === "college" && (
                      <div>
                        <strong>Effectif T5 :</strong>{" "}
                        {item?.effectif_t5 ?? item?.effectif ?? "—"}
                      </div>
                    )}
                    {niveauKey === "lycee" && (
                      <div>
                        <strong>Effectif T9 :</strong>{" "}
                        {item?.effectif_t9 ?? item?.effectif ?? "—"}
                      </div>
                    )}
                    {(niveauKey === "primaire" || niveauKey === "prescolaire") && (
                      <>
                        <div>
                          <strong>Population :</strong> {item?.population ?? "—"}
                        </div>
                        <div>
                          <strong>Population scolarisable :</strong>{" "}
                          {item?.population_scolarisable ?? "—"}
                        </div>
                      </>
                    )}
                    <div>
                      <strong>Distance :</strong>{" "}
                      {item?.distance_future ?? item?.distance_km ?? item?.distance ?? "—"} km
                    </div>
                    <div className={hors ? "font-bold text-red-600" : "font-bold text-green-700"}>
                      {hors ? `Hors du rayon (> ${rayonLabel})` : `Dans le rayon (≤ ${rayonLabel})`}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        <div
          className="absolute left-3 top-3 z-[1000] bg-white/95 border border-slate-700 px-3 py-1.5 shadow-sm text-center"
          style={{ pointerEvents: "none" }}
        >
          <div className="text-xs md:text-sm font-black uppercase leading-tight">
            Analyse spatiale de l'implantation du nouveau {niveauLabel}
          </div>
          <div className="text-[11px] md:text-xs font-bold uppercase">
            {demande?.nom_etab || "Établissement"}
          </div>
        </div>

        <style>{`
          .fiche-labeled-marker { background: transparent !important; border: 0 !important; overflow: visible !important; width: auto !important; height: auto !important; }
          .fiche-labeled-marker > div { overflow: visible !important; }
        `}</style>

        <div
          className="absolute right-3 top-3 z-[1000] bg-white/90 border rounded px-2 py-1 text-base font-bold"
          style={{ pointerEvents: "none" }}
        >
          N ↑
        </div>

        <div
          className="absolute left-3 bottom-3 z-[1000] bg-white/96 border border-slate-500 rounded p-2 text-[10px] leading-4 shadow-md min-w-[220px]"
          style={{ pointerEvents: "none" }}
        >
          <div className="font-bold mb-1 text-slate-900 text-[11px]">Légende</div>
          <div className="flex items-center gap-1.5">
            <SchoolGlyph color={COULEUR_ECOLE_NOUVELLE} size={14} />
            Nouveau {niveauLabel}
          </div>
          <div className="flex items-center gap-1.5">
            <SchoolGlyph color={COULEUR_ECOLE_EXISTANTE} size={14} />
            {niveauLabel} existant
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: COULEUR_COUVERT }} />
            {niveauKey === "lycee"
              ? "CEG couvert (dans le rayon)"
              : niveauKey === "college"
              ? "EPP couverte (dans le rayon)"
              : "Village couvert (dans le rayon)"}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: COULEUR_HORS_ZONE }} />
            Hors zone (hors du rayon)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full border border-dashed border-slate-800" />
            Rayon réglementaire ({rayonLabel})
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full bg-blue-200 border-2 border-blue-600" />
            Aire de recrutement (polygone)
          </div>
          {contourCommune && (
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-3 border-2 border-blue-900 bg-blue-100/40" />
              Limite de la commune
            </div>
          )}
          {contourFokontany && (
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-3 border-2 border-violet-600 border-dashed bg-violet-100/40" />
              Limite du fokontany
            </div>
          )}
        </div>
      </div>

      {!futurePosition && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <strong> Les coordonnées GPS du nouvel établissement sont introuvables.</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const normaliserStatutAnalyse = (item) => {
  const valeur = String(item?.statut ?? item?.status ?? item?.resultat ?? item?.etat ?? "").toLowerCase().trim();
  if (["na", "non_applicable", "non applicable", "non-applicable"].includes(valeur)) return "non_applicable";
  if (["ok", "conforme", "derog", "derogation"].includes(valeur) || valeur.includes("derog") ||
      (valeur.includes("conforme") && !valeur.includes("non"))) return "conforme";
  if (["ko", "non_conforme"].includes(valeur) || valeur.includes("non conforme") ||
      valeur.includes("refus") || valeur.includes("echec") || valeur.includes("échec")) return "non_conforme";
  return "non_verifiable";
};

function AnalyseInline({ analyse, ids, titre = "Résultat de l'analyse automatique" }) {
  const tous = Array.isArray(analyse?.items) ? analyse.items : [];
  const items = ids?.length ? tous.filter((x) => ids.includes(String(x.id))) : tous;
  if (!items.length) return null;

  const nonConformes = items.filter((x) => {
    const s = normaliserStatutAnalyse(x);
    return s !== "conforme" && s !== "non_applicable";
  });
  const sectionValidee = nonConformes.length === 0;

  return (
    <Card className={cn("border-2", sectionValidee ? "border-green-500/40 bg-green-50/30" : "border-red-500/40 bg-red-50/30")}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            {sectionValidee ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
            {titre}
          </span>
          <Badge className={cn("text-[10px]", sectionValidee ? "bg-green-600 text-white" : "bg-red-600 text-white")}>
            {sectionValidee ? "ANALYSE VALIDÉE" : "ANALYSE NON VALIDÉE"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => {
          const statut = normaliserStatutAnalyse(item);
          const ok = statut === "conforme";
          const na = statut === "non_applicable";
          const estDerog = String(item?.statut || "").toLowerCase().includes("derog");
          return (
            <div key={String(item.id)} className={cn("rounded-lg border p-3",
              na ? "border-slate-200 bg-slate-50"
                : ok ? (estDerog ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50")
                : "border-red-200 bg-red-50")}>
              <div className="flex items-start gap-2">
                {na ? <Minus className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                  : ok ? (estDerog ? <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    : <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />)
                  : <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />}
                <div className="min-w-0 flex-1">
                  <p className={cn("text-xs font-semibold", na ? "text-slate-700" : ok ? (estDerog ? "text-amber-800" : "text-green-800") : "text-red-800")}>
                    {item.libelle}{na && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">(non applicable)</span>}
                  </p>
                  {item.norme && <p className="text-[11px] text-muted-foreground mt-1"><strong>Norme :</strong> {item.norme}</p>}
                  <p className="text-[11px] text-muted-foreground mt-1"><strong>Valeur :</strong> {item.valeur ?? "Non renseignée"}</p>
                  <p className={cn("text-xs mt-1", na ? "text-slate-600" : ok ? (estDerog ? "text-amber-700" : "text-green-700") : "text-red-700")}>
                    {item.detail || (ok ? "Critère conforme." : "Information obligatoire absente ou non conforme.")}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function AnalyseGlobaleInline({ verdict, analyse }) {
  return null;
}

const fmt = (value, fallback = "—") => {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (Array.isArray(value)) return value.length === 0 ? fallback : value.join(", ");
  if (typeof value === "object") return value.nom || value.name || value.libelle || value.nom_etab || value.nom_village || JSON.stringify(value);
  return String(value);
};

const dateFR = (value) => {
  if (!value) return "—";
  try {
    const d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("fr-FR");
  } catch { return String(value); }
};

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 border-b border-border/50 last:border-0">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground font-medium break-words">{fmt(value)}</span>
    </div>
  );
}

function DataTable({ titre, colonnes, lignes }) {
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

const COLONNES_PROCHES = [
  { key: "fokontany", label: "Fokontany" },
  { key: "nom", label: "Nom" },
  { key: "code", label: "Code" },
  { key: "distance_km", label: "Distance (km)" },
  { key: "effectif", label: "Effectif" },
  { key: "salle", label: "Salles" },
  { key: "obstacle", label: "Obstacle" },
  { key: "nature_obstacle", label: "Nature" },
  { key: "statut_juridique", label: "Statut" },
];

const CLES_INFO_INTERNES = [
  "distance_zap", "distance_cisco", "distance_dren", "existe_proche",
  "distance_plus_proche", "position_centrale", "present_ors", "ecart_centre_km",
  "champs_zap", "commune_sans_ceg", "district_sans_lycee",
];
// ============================================================
// BOUTON FICHE TECHNIQUE
// ============================================================

function BoutonFicheTechnique({ demande, analyseValidee, vueRef = null }) {
  const [modalOuverte, setModalOuverte] = useState(false);
  const [carteBase64, setCarteBase64] = useState(null);
  const [generationCarte, setGenerationCarte] = useState(false);
  const [contenuFiche, setContenuFiche] = useState("");
  const [tailleCapture, setTailleCapture] = useState({ w: 1160, h: 500 });
  const carteRef = useRef(null);
  const captureMapRef = useRef(null);

  const etablissementsProches = getEtablissementsProchesAnalyse(demande);
  const aireRecrutement = getAireRecrutementAnalyse(demande);
  const aireSansCoord = demande?.aire_recrutement_sans_coord || [];

  const ouvrirModale = async () => {
    setModalOuverte(true);
    setContenuFiche(genererFicheTechnique(demande, null, analyseValidee));
    setGenerationCarte(true);

    const vue = vueRef?.current;
    if (vue?.size) setTailleCapture({ w: Math.round(vue.size.x), h: Math.round(vue.size.y) });
    await new Promise((r) => setTimeout(r, 400));
    const carteCachee = captureMapRef.current;
    if (carteCachee) {
      carteCachee.invalidateSize(false);
      if (vue) carteCachee.setView(vue.center, vue.zoom, { animate: false });
    }

    await new Promise((r) => setTimeout(r, 1500));

    const base64 = await capturerCarteEnBase64(carteRef.current);
    setCarteBase64(base64);
    setContenuFiche(genererFicheTechnique(demande, base64, analyseValidee));
    setGenerationCarte(false);
  };

  return (
    <>
      {generationCarte && (
        <div
          style={{ position: "fixed", left: "-10000px", top: 0, width: `${tailleCapture.w + 40}px`, pointerEvents: "none", zIndex: -1 }}
          aria-hidden="true"
        >
          <DemandeLocalisationMap
            demande={demande}
            etablissementsProches={etablissementsProches}
            aireRecrutement={aireRecrutement}
            aireSansCoord={aireSansCoord}
            mapRef={carteRef}
            mapInstanceRef={captureMapRef}
            captureSize={tailleCapture}
            avecCapture
          />
        </div>
      )}

      <Button
        type="button"
        size="sm"
        onClick={ouvrirModale}
        className={cn(
          "gap-2 text-white shadow-sm",
          analyseValidee
            ? "bg-emerald-600 hover:bg-emerald-700"
            : "bg-amber-600 hover:bg-amber-700"
        )}
      >
        <FileText className="h-4 w-4" />
        Fiche technique
      </Button>

      <Dialog open={modalOuverte} onOpenChange={setModalOuverte}>
        <DialogContent className="max-w-6xl max-h-[94vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
              <FileText className={cn("h-5 w-5", analyseValidee ? "text-emerald-600" : "text-amber-600")} />
              Fiche technique — {demande?.nom_etab}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {generationCarte
                ? "Génération de la carte en cours…"
                : "Aperçu de la fiche technique. Vous pouvez la télécharger ou l'imprimer."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b">
            <Badge
              className={cn(
                "text-xs",
                analyseValidee
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  : "bg-amber-100 text-amber-800 border border-amber-300"
              )}
              variant="outline"
            >
              {analyseValidee ? "✓ Analyse validée" : "⚠ Analyse non validée"}
            </Badge>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => imprimerFichePDF(demande, contenuFiche)}
                disabled={generationCarte}
                className="gap-2"
              >
                <Printer className="h-4 w-4" />
                Imprimer / PDF
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => telechargerFicheDOCX(demande, contenuFiche)}
                disabled={generationCarte}
                className={cn(
                  "gap-2 text-white",
                  analyseValidee
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-amber-600 hover:bg-amber-700"
                )}
              >
                <FileDown className="h-4 w-4" />
                Télécharger DOCX
              </Button>
            </div>
          </div>

          {generationCarte ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Génération de la fiche et de la carte…</p>
            </div>
          ) : (
            <iframe
              title="Aperçu de la fiche technique"
              srcDoc={contenuFiche}
              className="w-full bg-white border rounded-lg"
              style={{ height: "70vh" }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================
// MODAL DÉTAIL COMPLET
// ============================================================

function DemandeDetailModal({ ouvert, onClose, chargement, erreur, demande }) {
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
  const libelleSousType = sousTypeKey ? SOUS_TYPE_LABELS[sousTypeKey] : null;

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

  const champsSupplementaires = [
    ...Object.entries(infoComp).filter(([k]) => !CLES_INFO_INTERNES.includes(k)),
    ...Object.entries(infoComp.champs_zap || {}),
  ];

  const analyseValidee = verdictAnalyse?.conforme === true;

  return (
    <Dialog open={ouvert} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-7xl max-h-[94vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
            Détail complet de la demande
          </DialogTitle>
        </DialogHeader>

        {chargement && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Chargement…</p>
          </div>
        )}

        {erreur && !chargement && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{erreur}</span>
          </div>
        )}

        {demande && !chargement && !erreur && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-muted/30 border">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className={cn(
                    "text-xs",
                    analyseValidee
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : "bg-amber-100 text-amber-800 border border-amber-300"
                  )}
                  variant="outline"
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
              <TabsList className="flex w-full flex-wrap h-auto">
                <TabsTrigger value="general" className="text-xs">Général</TabsTrigger>
                <TabsTrigger value="localisation" className="text-xs">Localisation</TabsTrigger>
                {estNouvelleCreation && (
                  <TabsTrigger value="nouvelle_creation" className="text-xs">
                    {estProvisoire ? "Ouv. provisoire" : "Nouv. création"}
                  </TabsTrigger>
                )}
                {estRegularisation && <TabsTrigger value="regularisation" className="text-xs">Régularisation</TabsTrigger>}
                <TabsTrigger value="proximite" className="text-xs">Proximité</TabsTrigger>
                <TabsTrigger value="recrutement" className="text-xs">Recrutement</TabsTrigger>
                <TabsTrigger value="pieces" className="text-xs">Pièces</TabsTrigger>
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
                      {estNouvelleCreation && libelleSousType && (
                        <InfoRow label="Nature de la demande" value={libelleSousType} />
                      )}
                      {estProvisoire && (
                        <InfoRow label="Date d'ouverture de fait" value={dateFR(dateOuvertureFait)} />
                      )}
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
                      <InfoRow label="Source coordonnées" value={demande?.source_coordonnees || "—"} />
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
                    />
                  </CardContent>
                </Card>

                <AnalyseInline
                  analyse={analyseNormes}
                  ids={[
                    "critere-central", "critere-ors", "critere-accessibilite",
                    "critere-distance-800m", "critere-epp-rattachement",
                    "critere-village-sans-epp", "critere-espace-adequat",
                  ]}
                  titre="Analyse automatique de la localisation"
                />
              </TabsContent>

              {estNouvelleCreation && (
                <TabsContent value="nouvelle_creation" className="space-y-4 mt-4">
                  <div
                    className={cn(
                      "p-2.5 rounded-lg border text-xs flex items-start gap-2",
                      estProvisoire
                        ? "border-amber-200 bg-amber-50 text-amber-800"
                        : "border-emerald-200 bg-emerald-50 text-emerald-800"
                    )}
                  >
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
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
                            ? "Informations — Ouverture provisoire"
                            : "Informations — Nouvelle création"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <InfoRow label="Nb table-bancs prévus" value={nouvelleCreationData.nombre_tablebanc_prevus} />
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
                          <Users className="h-4 w-4 text-primary" /> Enseignants prévus
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <DataTable
                          titre="Enseignants prévus"
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
                        <CardTitle className="text-sm">Informations — Régularisation</CardTitle>
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
                      <InfoRow
                        label={proxCfg.labelDistancePlusProche}
                        value={distancePlusProcheAffichee}
                      />
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
                      etablissementsProches={[]}
                      aireRecrutement={aireRecrutement}
                      aireSansCoord={aireSansCoord}
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
                        <Info className="h-4 w-4 text-amber-600" />
                        Éléments de l'aire sans coordonnées GPS ({aireSansCoord.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xs text-amber-800 mb-2">
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

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" size="sm" onClick={onClose}>Fermer</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// SOUS-COMPOSANTS DESIGN
// ============================================================

const FilterField = ({ label, locked, children }) => (
  <div className="space-y-1.5">
    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
      {label}{locked && <Info className="h-3 w-3 text-amber-600" />}
    </label>
    {children}
  </div>
);

const StatCard = ({ icon: Icon, theme, label, value, hint }) => (
  <Card className={cn("group relative overflow-hidden shadow-sm hover:shadow-md transition-all h-full flex flex-col border-2", theme.ring)}>
    <div className="px-4 pt-4 pb-2 border-b border-border/40">
      <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-muted-foreground text-center">{label}</p>
    </div>
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-5 bg-gradient-to-b from-transparent to-muted/10">
      <div className="h-14 flex items-center justify-center">
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", theme.iconBg)}>
          <Icon className={cn("w-6 h-6", theme.iconColor)} />
        </div>
      </div>
      <div className="h-14 flex items-center justify-center">
        <p className="text-[2.1rem] font-bold tracking-tight leading-none tabular-nums text-foreground">{value}</p>
      </div>
    </div>
    <div className="px-4 pt-3 pb-4 border-t border-border/30 text-center">
      <div className="min-h-[36px] flex items-center justify-center">
        {hint && <p className="text-xs text-muted-foreground text-center leading-relaxed">{hint}</p>}
      </div>
    </div>
  </Card>
);

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================

export default function Demandes() {
  const [demandes, setDemandes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recherche, setRecherche] = useState("");
  const [niveau, setNiveau] = useState("Tous");
  const [typeDemande, setTypeDemande] = useState("Tous");

  const [detailOuvert, setDetailOuvert] = useState(false);
  const [detailChargement, setDetailChargement] = useState(false);
  const [detailDemande, setDetailDemande] = useState(null);
  const [detailErreur, setDetailErreur] = useState("");

  const [suppressionOuverte, setSuppressionOuverte] = useState(false);
  const [demandeASupprimer, setDemandeASupprimer] = useState(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  const chargerDemandes = async () => {
    detailCacheRef.current.clear();
    setLoading(true);
    setError("");
    try {
      const response = await demandeService.list();
      const data = asList(response);
      setDemandes(data.map(mapDemande));
    } catch (e) {
      console.error("Erreur chargement demandes :", e);
      setError(e?.message || "Impossible de charger les demandes depuis le serveur.");
      setDemandes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { chargerDemandes(); }, []);

const detailReqRef = useRef(0);
const detailCacheRef = useRef(new Map());     // id -> données déjà chargées
const detailPromesses = useRef(new Map());    // id -> promesse (préchargement)

const chargerDetail = (id) => {
  if (!detailPromesses.current.has(id)) {
    const p = demandeService
      .detailComplet(id)
      .then((response) => {
        const data = response?.data ?? response;
        detailCacheRef.current.set(id, data);
        return data;
      })
      .finally(() => detailPromesses.current.delete(id));
    detailPromesses.current.set(id, p);
  }
  return detailPromesses.current.get(id);
};

const prechargerDetail = (id) => {
  if (!detailCacheRef.current.has(id)) chargerDetail(id).catch(() => {});
};

const ouvrirDetail = async (id) => {
  const reqId = ++detailReqRef.current;
  setDetailOuvert(true);
  setDetailErreur("");

  const enCache = detailCacheRef.current.get(id);
  if (enCache) {
    setDetailDemande(enCache);
    setDetailChargement(false);
    return;
  }

  setDetailDemande(null);
  setDetailChargement(true);
  try {
    const data = await chargerDetail(id);
    if (reqId !== detailReqRef.current) return;   // une autre demande a été ouverte entre-temps
    setDetailDemande(data);
  } catch (e) {
    if (reqId !== detailReqRef.current) return;
    console.error("Erreur chargement détail :", e);
    setDetailErreur(e?.message || "Impossible de charger le détail de la demande.");
  } finally {
    if (reqId === detailReqRef.current) setDetailChargement(false);
  }
};

const fermerDetail = () => {
  detailReqRef.current++;   // invalide toute réponse en retard
  setDetailOuvert(false);
  setDetailDemande(null);
  setDetailErreur("");
  setDetailChargement(false);
};

  const ouvrirSuppression = (demande) => {
    setDemandeASupprimer(demande);
    setSuppressionOuverte(true);
  };

  const confirmerSuppression = async () => {
    if (!demandeASupprimer) return;
    setSuppressionEnCours(true);
    try {
      await demandeService.remove(demandeASupprimer.id);
      detailCacheRef.current.delete(demandeASupprimer.id);
      setDemandes((prev) => prev.filter((d) => d.id !== demandeASupprimer.id));
      setSuppressionOuverte(false);
      setDemandeASupprimer(null);
    } catch (e) {
      console.error("Erreur suppression demande :", e);
      setError(e?.message || "Impossible de supprimer la demande.");
    } finally {
      setSuppressionEnCours(false);
    }
  };

  const demandesFiltrees = useMemo(() => {
    const texte = recherche.toLowerCase().trim();
    return demandes.filter((demande) => {
      const correspondRecherche = !texte ||
        demande.reference.toLowerCase().includes(texte) ||
        demande.nom_etab.toLowerCase().includes(texte) ||
        demande.demandeur.toLowerCase().includes(texte) ||
        demande.commune.toLowerCase().includes(texte) ||
        demande.cisco.toLowerCase().includes(texte);
      return correspondRecherche &&
        (niveau === "Tous" || demande.niveau === niveau) &&
        (typeDemande === "Tous" || demande.type_demande === typeDemande);
    });
  }, [demandes, recherche, niveau, typeDemande]);

  const stats = useMemo(() => ({
    total: demandes.length,
    enAttente: demandes.filter((d) => d.statut === "En attente").length,
    enCours: demandes.filter((d) => d.statut === "En cours").length,
    validees: demandes.filter((d) => d.statut === "Validée").length,
  }), [demandes]);

  const STAT_THEMES = {
    total:    { ring: "ring-blue-500/30 border-blue-500/20",       iconBg: "bg-blue-500/10",    iconColor: "text-blue-600 dark:text-blue-400" },
    attente:  { ring: "ring-yellow-500/30 border-yellow-500/20",   iconBg: "bg-yellow-500/10",  iconColor: "text-yellow-600 dark:text-yellow-400" },
    encours:  { ring: "ring-indigo-500/30 border-indigo-500/20",   iconBg: "bg-indigo-500/10",  iconColor: "text-indigo-600 dark:text-indigo-400" },
    validees: { ring: "ring-emerald-500/30 border-emerald-500/20", iconBg: "bg-emerald-500/10", iconColor: "text-emerald-600 dark:text-emerald-400" },
  };

  return (
    <div className="space-y-4 pb-8">
      <div className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-sm">
        <div className="mx-auto max-w-none px-3 sm:px-4 py-2 sm:py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <img src="/src/assets/logoMen.jpg" alt="MEN" className="h-8 w-8 sm:h-9 sm:w-9 rounded-md object-contain ring-1 ring-border bg-white p-0.5" onError={(e) => { e.target.style.display = "none"; }} />
              <img src="/src/assets/logoDpe.jpg" alt="DPE" className="h-8 w-8 sm:h-9 sm:w-9 rounded-md object-contain ring-1 ring-border bg-white p-0.5" onError={(e) => { e.target.style.display = "none"; }} />
            </div>

            <div className="flex-1 min-w-[180px]">
              <h1 className="text-sm sm:text-base font-semibold leading-tight text-foreground">
                Demandes d'ouverture
              </h1>
              <p className="text-xs text-muted-foreground">
                Ministère de l'Éducation Nationale · Consultation et vérification des demandes
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {loading && (
                <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
                  <RefreshCw className="h-3 w-3 animate-spin" /> Chargement
                </Badge>
              )}
              <Badge variant="outline" className="gap-1 text-xs">
                <Database className="h-3 w-3" /> {demandesFiltrees.length} / {demandes.length}
              </Badge>
              <Button variant="outline" size="sm" onClick={chargerDemandes} disabled={loading} className="gap-2">
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Actualiser
              </Button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-3 sm:mx-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs font-medium flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="px-3 sm:px-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={ClipboardList} theme={STAT_THEMES.total}    label="Total des demandes" value={String(stats.total)}    hint="Toutes les demandes enregistrées" />
        <StatCard icon={CalendarDays}  theme={STAT_THEMES.attente}  label="En attente"        value={String(stats.enAttente)} hint="Demandes en attente de traitement" />
        <StatCard icon={Loader2}       theme={STAT_THEMES.encours}  label="En cours"          value={String(stats.enCours)}   hint="Demandes en cours d'instruction" />
        <StatCard icon={Database}      theme={STAT_THEMES.validees} label="Validées"          value={String(stats.validees)}  hint="Demandes validées" />
      </div>

      <div className="px-3 sm:px-4">
        <Card className="border-border shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
            <Filter className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Recherche et filtres</h2>
            <div className="ml-auto">
              <Badge variant="outline" className="text-[10px] font-normal border-green-500 text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400 px-2.5 py-0.5">
                {demandesFiltrees.length} / {demandes.length} demandes
              </Badge>
            </div>
          </div>
          <CardContent className="p-3 sm:p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <FilterField label="Rechercher">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Référence, établissement, demandeur..." className="pl-9 h-9" />
                </div>
              </FilterField>
              <FilterField label="Niveau">
                <select value={niveau} onChange={(e) => setNiveau(e.target.value)} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="Tous">Tous les niveaux</option>
                  <option value="Préscolaire">Préscolaire</option>
                  <option value="Primaire">Primaire</option>
                  <option value="Collège">Collège</option>
                  <option value="Lycée">Lycée</option>
                </select>
              </FilterField>
              <FilterField label="Type de demande">
                <select value={typeDemande} onChange={(e) => setTypeDemande(e.target.value)} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="Tous">Tous les types</option>
                  <option value="Nouvelle création">Nouvelle création</option>
                  <option value="Régularisation">Régularisation</option>
                </select>
              </FilterField>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="px-3 sm:px-4">
        <Card className="border-border shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Liste des demandes</h3>
              {demandesFiltrees.length > 0 && (
                <Badge variant="secondary" className="font-normal text-[10px]">
                  {demandesFiltrees.length} ligne{demandesFiltrees.length > 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5">
              <Layers className="h-3 w-3" /> Triable et consultable
            </div>
          </div>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-blue-100/80 dark:bg-blue-950/40">
                    {["Référence", "Établissement", "Niveau", "Demandeur", "Date", "Type demande"].map((h) => (
                      <th key={h} className="text-left py-3 px-3 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap">{h}</th>
                    ))}
                    <th className="text-right py-3 px-3 font-bold uppercase tracking-wider text-[11px]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && demandes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Chargement des demandes...
                      </td>
                    </tr>
                  ) : (
                    demandesFiltrees.map((demande) => (
                      <tr key={demande.id} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                        <td className="py-3 px-3 font-medium whitespace-nowrap text-xs">{demande.reference}</td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-sm">{demande.nom_etab}</div>
                          <div className="text-xs text-muted-foreground">{demande.commune} · {demande.cisco}</div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-sm">{demande.niveau}</td>
                        <td className="py-3 px-3 text-sm">{demande.demandeur}</td>
                        <td className="py-3 px-3 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-muted-foreground" /> {demande.date_depot}
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <Badge variant="outline" className="text-[10px] font-semibold border-primary/30 bg-primary/5 text-primary">
                            {demande.type_demande_label}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <Button variant="outline" size="sm" onMouseEnter={() => prechargerDetail(demande.id)} onClick={() => ouvrirDetail(demande.id)} className="gap-1.5 h-8" title="Voir le détail">
                              <Eye className="h-3.5 w-3.5" /> Voir
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => ouvrirSuppression(demande)}
                              className="gap-1.5 h-8 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:hover:bg-red-950/30"
                              title="Supprimer la demande">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                  {!loading && demandesFiltrees.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-muted-foreground">
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                          <Filter className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                          {demandes.length === 0 ? "Aucune demande enregistrée" : "Aucune demande trouvée"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                          {demandes.length === 0 ? "Aucune demande n'a encore été soumise." : "Aucune demande ne correspond aux filtres sélectionnés."}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <DemandeDetailModal
        ouvert={detailOuvert}
        onClose={fermerDetail}
        chargement={detailChargement}
        erreur={detailErreur}
        demande={detailDemande}
      />

      <Dialog open={suppressionOuverte} onOpenChange={setSuppressionOuverte}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 text-sm sm:text-base">
              <AlertTriangle className="h-5 w-5" /> Confirmer la suppression
            </DialogTitle>
            <DialogDescription className="text-sm pt-2">
              Voulez-vous vraiment supprimer cette demande ? Cette action est <strong>irréversible</strong>.
            </DialogDescription>
          </DialogHeader>

          {demandeASupprimer && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Référence</span>
                <span className="font-medium">{demandeASupprimer.reference}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Établissement</span>
                <span className="font-medium truncate max-w-[200px]">{demandeASupprimer.nom_etab}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Niveau</span>
                <span className="font-medium">{demandeASupprimer.niveau}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Type</span>
                <span className="font-medium">{demandeASupprimer.type_demande_label}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" size="sm" onClick={() => setSuppressionOuverte(false)} disabled={suppressionEnCours}>Annuler</Button>
            <Button variant="destructive" size="sm" onClick={confirmerSuppression} disabled={suppressionEnCours}
              className="gap-2 bg-red-600 hover:bg-red-700">
              {suppressionEnCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {suppressionEnCours ? "Suppression…" : "Ok"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
