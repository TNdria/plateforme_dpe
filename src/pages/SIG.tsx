import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import logoMen from "@/assets/logoMen.jpg";
import logoDpe from "@/assets/logoDpe.jpg";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import * as turf from "@turf/turf";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Settings,
  Search,
  Loader2,
  Lock,
  Check,
  ClipboardList,
  Table,
  Filter,
  Trash,
  MapPin,
  ZoomIn,
  Download,
  FileImage,
  Archive,
  ChevronLeft,
  ChevronRight,
  Layers,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Move,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import DataActionsBar from "@/components/admin/DataActionsBar";
import { sumFields, BE_FIELDS, ME_FIELDS, NIVEAU_LABEL } from "../utils/sig";
import {
  SECTOR_COLORS,
  getEtablissementIconHtml,
  getSchoolLevelIconHtml,
} from "@/lib/etablissementIcons";
import { captureMapPng } from "@/utils/captureMapPng";
import { buildSigUniqueEstablishmentStats, countUniqueEstablishments } from "@/utils/sigUniqueCounts";

// ====================== CONFIG ======================
const DJANGO_BASE_URL = import.meta.env.VITE_API_URL || "https://dpe-men.mg";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Extrait le message d'erreur renvoyé par Django ({error} ou {message}) pour
// l'afficher tel quel (403 « Action non autorisée », 409 « déjà géolocalisé »,
// etc.) au lieu d'un message générique.
async function extractApiError(res: Response, fallback: string): Promise<ApiError> {
  let detail = fallback;
  try {
    const body = await res.json();
    if (body?.error) detail = String(body.error);
    else if (body?.message) detail = String(body.message);
  } catch {
    /* ignore */
  }
  return new ApiError(detail, res.status);
}

async function djangoGet<T = any>(path: string): Promise<T> {
  const url = `${DJANGO_BASE_URL}${path.startsWith("/") ? path : "/" + path}`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw await extractApiError(res, `Django GET ${path} → ${res.status}`);
  return res.json();
}

// Récupère un jeton CSRF frais auprès de Django avant chaque mutation.
async function getCsrfToken(): Promise<string> {
  const url = `${DJANGO_BASE_URL}/sig/csrf/`;

  const res = await fetch(url, {
    method: "GET",
    credentials: "include",
  });

  if (!res.ok) {
    throw await extractApiError(res, `Récupération du jeton CSRF → ${res.status}`);
  }

  const data = await res.json();

  if (!data?.csrfToken || typeof data.csrfToken !== "string") {
    throw new Error("Django n'a pas retourné de jeton CSRF valide.");
  }

  return data.csrfToken;
}

async function djangoPost<T = any>(
  path: string,
  data: Record<string, any>
): Promise<T> {
  const url = `${DJANGO_BASE_URL}${path.startsWith("/") ? path : "/" + path}`;

  const csrfToken = await getCsrfToken();

  const formData = new FormData();
  Object.entries(data).forEach(([k, v]) => formData.append(k, String(v)));

  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: {
      "X-CSRFToken": csrfToken,
    },
    body: formData,
  });

  if (!res.ok) throw await extractApiError(res, `Django POST ${path} → ${res.status}`);
  return res.json();
}

async function djangoPostJSON<T = any>(
  path: string,
  data: Record<string, any>
): Promise<T> {
  const url = `${DJANGO_BASE_URL}${path.startsWith("/") ? path : "/" + path}`;

  const csrfToken = await getCsrfToken();

  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) throw await extractApiError(res, `Django POST JSON ${path} → ${res.status}`);
  return res.json();
}

// ====================== INTERFACES ======================
interface Dren {
  CODE_DREN: number;
  DREN: string;
}
interface Cisco {
  CODE_CISCO: number;
  CISCO: string;
}
interface SearchItem {
  latLng: [number, number];
  id: string | number;
  name: string;
}

type GeoVerificationEndpoint = "establishments" | "villages";
type GeoVerificationStage = "pending" | "running" | "done" | "error";
type GeoVerificationRow = {
  id: number | string;
  code?: string | number | null;
  nom_etab?: string | null;
  name?: string | null;
  code_dren: number | string;
  code_cisco: number | string;
  latitude: number | string | null;
  longitude: number | string | null;
  is_valid?: number | null;
  population?: number | null;
  type_anomalie: string;
  nb_doublons: number | null;
};
type GeoVerificationEntry = {
  dren: number;
  cisco: number;
  initialization: GeoVerificationStage;
  establishments: { status: GeoVerificationStage; loading: boolean; hasData: boolean; data: GeoVerificationRow[]; error: string | null };
  villages: { status: GeoVerificationStage; loading: boolean; hasData: boolean; data: GeoVerificationRow[]; error: string | null };
  consolidation: GeoVerificationStage;
};

const emptyGeoVerificationEntry = (dren: number, cisco: number): GeoVerificationEntry => ({
  dren,
  cisco,
  initialization: "pending",
  establishments: { status: "pending", loading: false, hasData: false, data: [], error: null },
  villages: { status: "pending", loading: false, hasData: false, data: [], error: null },
  consolidation: "pending",
});

const geoAnomalyCategory = (value: unknown): string => {
  const type = String(value ?? "").trim().toUpperCase();
  if (type === "NON_GEOLOCALISE") return "NON_GEOLOCALISE";
  if (type === "HORS_ZONE") return "HORS_ZONE";
  if (type === "ZONE_NON_DEFINIE") return "ZONE_NON_DEFINIE";
  if (type.includes("DOUBLON")) return "DOUBLON";
  return "AUTRE";
};

const geoRowIsDuplicate = (row: GeoVerificationRow): boolean =>
  Number(row.nb_doublons) > 1 || geoAnomalyCategory(row.type_anomalie) === "DOUBLON";

const geoRowHasValidCoordinates = (row: GeoVerificationRow): boolean => {
  if (row.latitude === null || row.latitude === undefined || row.longitude === null || row.longitude === undefined) {
    return false;
  }
  if (String(row.latitude).trim() === "" || String(row.longitude).trim() === "") return false;
  const latitude = Number(row.latitude);
  const longitude = Number(row.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180 &&
    !(latitude === 0 && longitude === 0);
};

// ====================== RÔLES & PERMISSIONS SIG ======================
// Règles métier (identiques à views.py) :
//   ADMIN : is_superuser uniquement (is_staff seul ≠ ADMIN) — accès national
//   CISCO : cisco > 0 — limité à sa CISCO
//   DREN  : dren > 0  — consultation limitée à sa DREN
//   STAFF : is_staff sans DREN/CISCO — lecture nationale SEULEMENT
//   USER  : compte actif sans rattachement — consultation nationale seulement
//   Autre : aucun droit SIG
// Écriture (pointage, déplacement, validation/rejet, suppression) :
//   ADMIN et CISCO uniquement ; le CISCO est limité à sa DREN et sa CISCO.
// Le serveur reste l'unique autorité : ce code ne fait que masquer/désactiver
// l'interface ; /sig/config/ renvoie le rôle réel et Django re-contrôle tout.
type SigRole = "ADMIN" | "DREN" | "CISCO" | "STAFF" | "USER" | "UNKNOWN";
type SigHeaderAction = "POINTAGE" | "DEPLACEMENT" | "VALIDATION";

const emptySigConfig = (): SigConfig => ({
  role: "UNKNOWN",
  modules: {
    pointage: false,
    deplacement: false,
    validationDeplacement: false,
  },
  permissions: {
    valider: false,
    rejeter: false,
    supprimer: false,
    verifier: false,
  },
});

const parseSigConfig = (res: any): SigConfig => {
  const validRoles: SigRole[] = ["ADMIN", "DREN", "CISCO", "STAFF", "USER"];

  if (
    !res ||
    !validRoles.includes(res.role) ||
    !res.modules ||
    !res.permissions
  ) {
    throw new Error("Réponse /sig/config/ incomplète ou invalide");
  }

  const moduleKeys = ["pointage", "deplacement", "validationDeplacement"];
  const permissionKeys = ["valider", "rejeter", "supprimer", "verifier"];

  for (const key of moduleKeys) {
    if (typeof res.modules[key] !== "boolean") {
      throw new Error(`Module SIG invalide ou absent : ${key}`);
    }
  }

  for (const key of permissionKeys) {
    if (typeof res.permissions[key] !== "boolean") {
      throw new Error(`Permission SIG invalide ou absente : ${key}`);
    }
  }

  return {
    role: res.role,
    modules: {
      pointage: res.modules.pointage,
      deplacement: res.modules.deplacement,
      validationDeplacement: res.modules.validationDeplacement,
    },
    permissions: {
      valider: res.permissions.valider,
      rejeter: res.permissions.rejeter,
      supprimer: res.permissions.supprimer,
      verifier: res.permissions.verifier,
    },
  };
};

// Secteur : 0 = Public, toute autre valeur = Privé (même règle partout).
const secteurLabel = (secteur: unknown): string => (Number(secteur) === 0 ? "Public" : "Privé");

// ====================== FIX DEFAULT MARKERS ======================
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// ====================== STYLES COUCHES ======================
const STYLE_DREN = {
  fillColor: "#4e73df",
  color: "#4e73df",
  weight: 4,
  opacity: 1,
  fillOpacity: 0.03,
};
const STYLE_CISCO = {
  fillColor: "#22afbe",
  color: "#22afbe",
  weight: 3,
  opacity: 0.9,
  fillOpacity: 0.03,
};
const STYLE_COMMUNE = {
  fillColor: "#c0c0c0",
  color: "#c0c0c0",
  weight: 2,
  opacity: 0.8,
  fillOpacity: 0.03,
};
const STYLE_FOKONTANY = {
  fillColor: "#55ff00",
  color: "#55ff00",
  weight: 0.6,
  opacity: 0.5,
  fillOpacity: 0.03,
};

const MAPBOX_TOKEN =
  "pk.eyJ1IjoidG9reSIsImEiOiJjbTE4djVndXIxNmQwMmxzam1nY3JzcWU0In0.KtMOpNhicsXZkbmcFtVd8w";
const BING_KEY = "AuhiCJHlGzhg93IqUH_oCpl_-ZUrIE6SPftlyGYUvr9Amx5nzA-WqGcPquyFZl4L";

const NIVEAU_CONFIG: Record<
  string,
  { label: string; aireColor: string; rayon: number }
> = {
  n0: { label: "PRESCO", aireColor: "green", rayon: 2 },
  n1: {
    label: "PRIMAIRE",
    aireColor: "green",
    rayon: 2,
  },
  n2: { label: "COLLEGE", aireColor: "blue", rayon: 5 },
  n3: { label: "LYCEE", aireColor: "yellow", rayon: 20 },
};

const VILLAGE_CONFIG = {
  label: "Village",
  aireColor: "#a35b08",
  rayon: 5,
};

// Zoom minimum requis pour autoriser le déplacement (drag & drop) et la
// géolocalisation manuelle des marqueurs. Centralisé ici pour éviter les
// incohérences (auparavant la valeur 16 était dupliquée à 3 endroits et le
// menu contextuel testait à tort la valeur 15).
const MOVE_MIN_ZOOM = 16;

// ====================== COMPOSANT PRINCIPAL ======================
const SIG = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [capturingMap, setCapturingMap] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const layerControlRef = useRef<L.Control.Layers | null>(null);
  const legendControlRef = useRef<L.Control | null>(null);
  const layerPanelHostRef = useRef<HTMLDivElement>(null);
  const toolsPanelHostRef = useRef<HTMLDivElement>(null);
  const legendPanelHostRef = useRef<HTMLDivElement>(null);
  const renderLegendRef = useRef<() => void>(() => {});

  const etabLayersRef = useRef<Record<string, L.LayerGroup>>({});
  const aireLayersRef = useRef<Record<string, L.LayerGroup>>({});
  const shpRef = useRef<Record<string, L.GeoJSON | null>>({
    dren: null,
    cisco: null,
    commune: null,
    fokontany: null,
  });
  const villageLayerRef = useRef<L.LayerGroup>(new L.LayerGroup());
  const verificationLayerVisibilityRef = useRef<Record<string, boolean> | null>(null);
  const ctrlAireRef = useRef<L.Control | null>(null);
  const moveCtrlRef = useRef<L.Control | null>(null);
  const searchMarkerRef = useRef<L.Circle | null>(null);
  const positionAvantDeplacementRef = useRef<L.LatLng | null>(null);
  const verificationMarkersRef = useRef<L.LayerGroup>(new L.LayerGroup());
  const distanceLayerRef = useRef<L.LayerGroup>(new L.LayerGroup());
  const distanceFirstMarkerRef = useRef<{ latLng: L.LatLng; name: string } | null>(null);
  const showMarkerNamesRef = useRef(false);
  const measureDistanceEnabledRef = useRef(false);
  const measureMarkerClickRef = useRef<(point: { latLng: L.LatLng; name: string }) => void>(() => {});
  const [showRecap, setShowRecap] = useState(true);
  const markersRef = useRef<any[]>([]);
  const tempMarkersRef = useRef<any[]>([]);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  // Miroir de `sigMoveEnabled` dans une ref : les marqueurs Leaflet sont créés
  // une seule fois (hors du cycle de rendu React) et leurs handlers `dragend`
  // gardaient donc une closure obsolète sur l'état. On lit désormais cette
  // ref à jour au lieu d'interroger le DOM (`document.getElementById('check-move')`).
  const sigMoveEnabledRef = useRef(false);
  // Panneau latéral (filtres / récap / recherche) repliable — ouvert par
  // défaut sur desktop, replié par défaut sur mobile pour laisser la place à
  // la carte.
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true,
  );
  const [rightSidebarOpen, setRightSidebarOpen] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true,
  );
  useEffect(() => {
    const enforceNarrowLayout = () => {
      if (window.matchMedia("(max-width: 767px)").matches && sidebarOpen && rightSidebarOpen) {
        setRightSidebarOpen(false);
      }
    };
    window.addEventListener("resize", enforceNarrowLayout);
    return () => window.removeEventListener("resize", enforceNarrowLayout);
  }, [sidebarOpen, rightSidebarOpen]);

  // Afficher une aire uniquement si la case du niveau est cochée et si un
  // groupe d'établissements public ou privé de ce niveau est visible.
  const syncAireLayerVisibility = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const niveau of [1, 2, 3]) {
      const checkbox = document.getElementById(`aireN${niveau}`) as HTMLInputElement | null;
      for (const secteur of [0, 1]) {
        const etabLayer = etabLayersRef.current[`layer_etabN${niveau}S${secteur}`];
        const aireLayer = aireLayersRef.current[`aire_etabN${niveau}S${secteur}`];
        if (!aireLayer) continue;
        if (checkbox?.checked && etabLayer && map.hasLayer(etabLayer)) {
          aireLayer.addTo(map);
        } else if (map.hasLayer(aireLayer)) {
          map.removeLayer(aireLayer);
        }
      }
    }
  }, []);

  // ====================== STATE ======================
  const [drens, setDrens] = useState<Dren[]>([]);
  const [ciscos, setCiscos] = useState<Cisco[]>([]);
  const [selectedDren, setSelectedDren] = useState<number>(0);
  const [selectedCisco, setSelectedCisco] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(6);
  const [sigMoveEnabled, setSigMoveEnabled] = useState(false);
  const [showMarkerNames, setShowMarkerNames] = useState(false);
  const [measureDistanceEnabled, setMeasureDistanceEnabled] = useState(false);
  const [searchItems, setSearchItems] = useState<SearchItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
  const [sigConfig, setSigConfig] = useState<SigConfig>(emptySigConfig);
  // true si le serveur répond que le compte n'a aucun profil SIG.
  const [accessDenied, setAccessDenied] = useState(false);
  const sigRole = sigConfig.role;
  const [activeHeaderAction, setActiveHeaderAction] = useState<SigHeaderAction | null>(null);
  const sigActionLocked = activeHeaderAction !== null;
  const [actionStartedAt, setActionStartedAt] = useState<number | null>(null);
  const [actionElapsedSeconds, setActionElapsedSeconds] = useState(0);
  const [actionRecap, setActionRecap] = useState<{
    action: SigHeaderAction;
    username: string;
    startedAt: number;
    durationSeconds: number;
  } | null>(null);
  const actionRecapTimerRef = useRef<number | null>(null);

  // Ref lue par les handlers Leaflet (attachés une seule fois aux marqueurs) :
  // évite une closure obsolète sur les droits de l'utilisateur.
  const permsRef = useRef({ canMove: false });
  permsRef.current.canMove =
    sigConfig.modules.deplacement && activeHeaderAction === "DEPLACEMENT";
  const [showDeplacementsModal, setShowDeplacementsModal] = useState(false);
  const [verifyMode, setVerifyMode] = useState(false);
  const [verifyItem, setVerifyItem] = useState<any>(null);
  const [deplacements, setDeplacements] = useState<any[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<any | null>(null);
  const [photoError, setPhotoError] = useState(false);

  useEffect(() => {
    setPhotoError(false);
  }, [selectedSchool?.CODE_ETAB, selectedSchool?.PHOTO_URL]);

  const [niveau, setNiveau] = useState<number>(0);
  const [tablesBancs, setTablesBancs] = useState<any[]>([]);
  const [hoveredEtab, setHoveredEtab] = useState<any>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    lat: number;
    lng: number;
  } | null>(null);
  const [showGeoEtab, setShowGeoEtab] = useState(false);
  const [showGeoVillage, setShowGeoVillage] = useState(false);
  const [pointageType, setPointageType] = useState<"ETABLISSEMENT" | "VILLAGE" | null>(null);
  const [showPointageTypeDialog, setShowPointageTypeDialog] = useState(false);
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number }>({
    lat: 0,
    lng: 0,
  });
  const [etabNonPointe, setEtabNonPointe] = useState<any[]>([]);
  const [geoVerificationOpen, setGeoVerificationOpen] = useState(false);
  const [geoVerificationCache, setGeoVerificationCache] = useState<Record<string, GeoVerificationEntry>>({});
  const geoVerificationCacheRef = useRef<Record<string, GeoVerificationEntry>>({});
  const [geoVerificationContext, setGeoVerificationContext] = useState<{
    key: string;
    dren: number;
    cisco: number;
  } | null>(null);
  const [selectedEtabGeo, setSelectedEtabGeo] = useState<any | null>(null);
  const [showEtabNonPointeModal, setShowEtabNonPointeModal] = useState(false);
  const [etabNonPointeSearch, setEtabNonPointeSearch] = useState("");
  const [modalDrenFilter, setModalDrenFilter] = useState("");
  const [modalCiscoFilter, setModalCiscoFilter] = useState("");
  const [modalSecteurFilter, setModalSecteurFilter] = useState("all");
  const [modalZapFilter, setModalZapFilter] = useState("");
  const [filterEtabName, setFilterEtabName] = useState("");
  const [villageForm, setVillageForm] = useState({
    name: "",
    airtel: false,
    orange: false,
    telma: false,
    elec: false,
    eau: false,
  });
  const [stats, setStats] = useState({
    etablissements: 0,
    total: 0,
    public: {
      total: 0,
      prescolaire: 0,
      primaire: 0,
      college: 0,
      lycee: 0,
    },
    private: {
      total: 0,
      prescolaire: 0,
      primaire: 0,
      college: 0,
      lycee: 0,
    },
    villages: 0,
  });
  const geoVerificationEntry = geoVerificationContext
    ? geoVerificationCache[geoVerificationContext.key]
    : undefined;

  // Garde la ref `sigMoveEnabledRef` synchronisée avec l'état React à chaque
  // changement, pour que les handlers `dragend` (attachés une seule fois par
  // marqueur) lisent toujours la valeur courante.
  useEffect(() => {
    sigMoveEnabledRef.current = sigMoveEnabled;
  }, [sigMoveEnabled]);

  useEffect(() => {
    showMarkerNamesRef.current = showMarkerNames;
    const fontSize = showMarkerNames ? "11px" : "0px";
    mapRef.current?.getContainer().querySelectorAll<HTMLElement>(".label-etab, .label-village")
      .forEach((label) => { label.style.fontSize = fontSize; });
  }, [showMarkerNames]);

  useEffect(() => {
    measureDistanceEnabledRef.current = measureDistanceEnabled;
    distanceFirstMarkerRef.current = null;
    if (!measureDistanceEnabled) distanceLayerRef.current.clearLayers();
  }, [measureDistanceEnabled]);

  measureMarkerClickRef.current = ({ latLng, name }) => {
    if (!measureDistanceEnabledRef.current) return;
    const first = distanceFirstMarkerRef.current;
    if (!first) {
      distanceFirstMarkerRef.current = { latLng, name };
      toast.info(`Point de départ : ${name}. Cliquez sur le deuxième marqueur.`);
      return;
    }

    const end = { latLng, name };
    const distanceKm = turf.distance(
      turf.point([first.latLng.lng, first.latLng.lat]),
      turf.point([end.latLng.lng, end.latLng.lat]),
      { units: "kilometers" },
    );
    const distanceText = distanceKm < 1
      ? `${Math.round(distanceKm * 1000)} m`
      : `${distanceKm.toFixed(2)} km`;
    const line = L.polyline([first.latLng, end.latLng], {
      color: "#e11d48", weight: 3, dashArray: "7 6",
    });
    distanceLayerRef.current.addLayer(line);
    const label = document.createElement("div");
    label.textContent = `${first.name} ↔ ${end.name} : ${distanceText}`;
    distanceLayerRef.current.addLayer(
      L.tooltip({ permanent: true, direction: "top", className: "sig-distance-label" })
        .setLatLng(line.getCenter())
        .setContent(label),
    );
    distanceFirstMarkerRef.current = null;
    toast.success(`Distance : ${distanceText}`);
  };

  // ====================== ACTIONS D'EN-TÊTE SIG ======================

  const canStartPointage = Boolean(
    user &&
    (sigRole === "ADMIN" || sigRole === "CISCO") &&
    sigConfig.modules.pointage
  );

  const canStartDeplacement = Boolean(
    user &&
    (sigRole === "ADMIN" || sigRole === "CISCO") &&
    sigConfig.modules.deplacement
  );

  const canStartValidation = Boolean(
    user && sigConfig.permissions.verifier
  );

  const formatActionDuration = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds]
      .map((value) => String(value).padStart(2, "0"))
      .join(":");
  };

  const getHeaderActionLabel = (action: SigHeaderAction) => {
    if (action === "POINTAGE") return "Pointage";
    if (action === "DEPLACEMENT") return "Déplacement";
    return "Validation";
  };

  const startHeaderAction = (action: SigHeaderAction): boolean => {
    if (activeHeaderAction !== null) {
      toast.warning("Terminez d'abord l'action actuellement en cours.");
      return false;
    }

    const allowed =
      action === "POINTAGE"
        ? canStartPointage
        : action === "DEPLACEMENT"
          ? canStartDeplacement
          : canStartValidation;

    if (!allowed) {
      toast.error("Cette action n'est pas autorisée pour votre profil ou son module est désactivé.");
      return false;
    }

    if (actionRecapTimerRef.current !== null) {
      window.clearTimeout(actionRecapTimerRef.current);
      actionRecapTimerRef.current = null;
    }

    setActionRecap(null);
    setActiveHeaderAction(action);
    setActionStartedAt(Date.now());
    setActionElapsedSeconds(0);

    if (action === "POINTAGE") {
      setPointageType(null);
      setShowPointageTypeDialog(true);
    }

    if (action === "DEPLACEMENT") {
      // Le déplacement effectif reste soumis au contrôle de zoom
      // et à la commande existante sigMoveEnabled.
      setSigMoveEnabled(false);
    }

    return true;
  };

  const cancelHeaderAction = () => {
    setActiveHeaderAction(null);
    setActionStartedAt(null);
    setActionElapsedSeconds(0);
    setSigMoveEnabled(false);
  };

  const finishHeaderAction = () => {
    if (activeHeaderAction === null || actionStartedAt === null) return;

    const durationSeconds = Math.max(
      0,
      Math.floor((Date.now() - actionStartedAt) / 1000)
    );

    const username =
      [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
      user?.username ||
      "Utilisateur";

    const recap = {
      action: activeHeaderAction,
      username,
      startedAt: actionStartedAt,
      durationSeconds,
    };

    if (actionRecapTimerRef.current !== null) {
      window.clearTimeout(actionRecapTimerRef.current);
    }

    setActionRecap(recap);
    actionRecapTimerRef.current = window.setTimeout(() => {
      setActionRecap(null);
      actionRecapTimerRef.current = null;
    }, 15000);

    // Fermeture propre des interfaces associées à l'action.
    setShowPointageTypeDialog(false);
    setPointageType(null);
    setShowGeoEtab(false);
    setShowGeoVillage(false);
    setContextMenu(null);
    setShowDeplacementsModal(false);
    setSigMoveEnabled(false);

    if (verifyMode) {
      stopVerification();
    }

    setActiveHeaderAction(null);
    setActionStartedAt(null);
    setActionElapsedSeconds(0);
  };

  useEffect(() => {
    if (activeHeaderAction === null || actionStartedAt === null) return;

    const updateElapsed = () => {
      setActionElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - actionStartedAt) / 1000))
      );
    };

    updateElapsed();
    const interval = window.setInterval(updateElapsed, 1000);

    return () => window.clearInterval(interval);
  }, [activeHeaderAction, actionStartedAt]);

  useEffect(() => {
    return () => {
      if (actionRecapTimerRef.current !== null) {
        window.clearTimeout(actionRecapTimerRef.current);
      }
    };
  }, []);

  // Un marqueur n'est déplaçable que si le profil a le droit « déplacement »
  // ET que le mode « Déplacer » est actif (plus de drag suivi d'un snap-back).
  const applyDraggableState = useCallback(() => {
    const enabled =
      permsRef.current.canMove &&
      activeHeaderAction === "DEPLACEMENT" &&
      sigMoveEnabledRef.current;
    const apply = (layer: any) => {
      if (!layer?.options || typeof layer.getLatLng !== "function") return;
      layer.options.draggable = enabled;
      if (layer.dragging) {
        if (enabled) layer.dragging.enable();
        else layer.dragging.disable();
      }
    };
    Object.values(etabLayersRef.current).forEach((group) => group.eachLayer(apply));
    villageLayerRef.current.eachLayer(apply);
  }, []);

  useEffect(() => {
    applyDraggableState();
  }, [sigMoveEnabled, sigConfig.modules.deplacement, activeHeaderAction, applyDraggableState]);

  // Si le droit de déplacement disparaît, le mode « Déplacer » est coupé.
  useEffect(() => {
    if (
      (!sigConfig.modules.deplacement || activeHeaderAction !== "DEPLACEMENT") &&
      sigMoveEnabled
    ) {
      setSigMoveEnabled(false);
    }
  }, [sigConfig.modules.deplacement, activeHeaderAction, sigMoveEnabled]);

  // Suit la taille réelle du conteneur pendant les transitions des panneaux.
  // ResizeObserver ne notifie qu'en cas de changement de dimensions ; un seul
  // requestAnimationFrame regroupe les notifications d'une même frame.
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    let frame = 0;
    const observer = new ResizeObserver(() => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = 0;
        mapRef.current?.invalidateSize({ animate: false, pan: false });
      });
    });
    observer.observe(container);
    mapRef.current?.invalidateSize({ animate: false, pan: false });

    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // ====================== INIT MAP ======================
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomDelta: 0.5,
      zoomSnap: 0.5,
      scrollWheelZoom: false,
    }).setView([-18.9189596, 47.5135653], 6);

    L.control
      .scale({
        position: "bottomright",
        metric: true,
        imperial: false,
        maxWidth: 160,
      })
      .addTo(map);

    setTimeout(() => {
      const sc = document.querySelector(".leaflet-control-scale") as HTMLElement;
      if (sc)
        Object.assign(sc.style, {
          backgroundColor: "rgba(255,255,255,0.96)",
          border: "1px solid #d1d5db",
          borderRadius: "8px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
          padding: "5px 10px",
          fontSize: "12px",
          fontWeight: "500",
          color: "#1f2937",
          marginBottom: "14px",
          marginRight: "14px",
        });
      const sl = document.querySelector(".leaflet-control-scale-line") as HTMLElement;
      if (sl)
        Object.assign(sl.style, {
          border: "2.5px solid #374151",
          borderTop: "none",
          borderRadius: "3px",
          padding: "3px 7px",
          background: "rgba(255,255,255,0.9)",
          fontWeight: "700",
        });
    }, 400);

    const compassDiv = L.DomUtil.create("div", "leaflet-control");
    compassDiv.id = "compass-control";
    compassDiv.style.cssText = `
      position:relative;top:10px;left:5px;z-index:1000;
      background:rgba(255,255,255,0.95);border:2px solid #ccc;border-radius:50px;
      padding:6px;box-shadow:0 2px 8px rgba(0,0,0,0.2);pointer-events:none;
      width:45px;height:45px;display:flex;align-items:center;justify-content:center;
    `;
    compassDiv.innerHTML = `<img src="/img/Nord.png" alt="Nord" style="width:36px;height:36px;object-fit:contain;" title="Nord"/>`;
    document.getElementById("compass-control")?.remove();
    map.getContainer().appendChild(compassDiv);
    setTimeout(() => {
      const zc = document.querySelector(".leaflet-control-zoom") as HTMLElement;
      if (zc) zc.style.marginTop = "65px";
    }, 200);

    const DEFAULT_LAYER = L.tileLayer("", {
      maxZoom: 24,
      attribution: "© MEN/DPE",
    });

    const OSM_LAYER = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 22,
      attribution: "© OpenStreetMap",
    }).addTo(map);
    const IMAGERY_LAYER = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 22, attribution: "&copy; Esri" },
    );
    const MAP_BOX = L.tileLayer(
      `https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`,
      {
        maxZoom: 24,
        tileSize: 512,
        zoomOffset: -1,
        attribution: "&copy; Mapbox",
      },
    );
    const BING_LAYER = L.tileLayer(
      "https://ecn.t{s}.tiles.virtualearth.net/tiles/a{z}{x}{y}.jpeg?g=587&n=z&key=" + BING_KEY,
      {
        maxZoom: 19,
        attribution: "&copy; Microsoft Bing",
        subdomains: ["0", "1", "2", "3"],
      } as any,
    );

    const layerControl = L.control.layers(
      {
        DEFAULT: DEFAULT_LAYER,
        OSM: OSM_LAYER,
        IMAGERY: IMAGERY_LAYER,
        BING: BING_LAYER,
        MAPBOX: MAP_BOX,
      },
      {},
      { position: "topright", collapsed: false },
    );
    layerControl.addTo(map);
    layerControlRef.current = layerControl;
    if (layerControl.getContainer() && layerPanelHostRef.current) {
      layerPanelHostRef.current.appendChild(layerControl.getContainer()!);
    }

    const ResetControl = L.Control.extend({
      options: { position: "topleft" as L.ControlPosition },
      onAdd: () => {
        const btn = L.DomUtil.create("div", "leaflet-bar leaflet-control");
        btn.innerHTML =
          '<a href="#" title="Réinitialiser" style="font-size:16px;line-height:30px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;"><i class="fas fa-redo-alt"></i></a>';
        btn.onclick = (e) => {
          e.preventDefault();
          const drenShp = shpRef.current.dren;
          const ciscoShp = shpRef.current.cisco;
          if (drenShp && map.hasLayer(drenShp)) map.fitBounds(drenShp.getBounds());
          else if (ciscoShp && map.hasLayer(ciscoShp)) map.fitBounds(ciscoShp.getBounds());
          else map.setView([-18.9189596, 47.5135653], 6);
        };
        return btn;
      },
    });
    new ResetControl().addTo(map);

    const FullscreenControl = L.Control.extend({
      options: { position: "topleft" as L.ControlPosition },
      onAdd: () => {
        const btn = L.DomUtil.create("div", "leaflet-bar leaflet-control");
        btn.innerHTML =
          '<a href="#" title="Plein écran" style="font-size:16px;line-height:30px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;"><i class="fas fa-expand"></i></a>';
        btn.onclick = (e) => {
          e.preventDefault();
          const container = map.getContainer();
          if (!document.fullscreenElement) container.requestFullscreen?.();
          else document.exitFullscreen?.();
        };
        return btn;
      },
    });
    new FullscreenControl().addTo(map);

    const DownloadControl = L.Control.extend({
      options: { position: "topleft" as L.ControlPosition },
      onAdd: () => {
        const btn = L.DomUtil.create("div", "leaflet-bar leaflet-control");
        btn.innerHTML = `
          <a href="#" title="Télécharger coordonnées des marqueurs actifs" 
            style="font-size:16px;line-height:30px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;">
            <i class="fas fa-download"></i>
          </a>`;

        btn.onclick = (e: Event) => {
          e.preventDefault();
          const { total } = collectActiveMarkers();
          if (total === 0) {
            toast.error(
              "Appliquez d'abord un filtre et activez au moins un groupe de marqueurs pour établissement et/ou village",
            );
            return;
          }
          setShowDownloadModal(true);
        };
        return btn;
      },
    });
    new DownloadControl().addTo(map);

    const legend = new (L.Control.extend({
      options: { position: "bottomleft" },
    }))();
    legend.onAdd = () => {
      const div = L.DomUtil.create("div", "legend");
      div.style.cssText =
        "background:rgba(255,255,255,0.92);padding:10px 14px;border-radius:8px;font-size:12px;line-height:1.8;box-shadow:0 2px 12px rgba(0,0,0,0.15);";
      div.innerHTML = `<p style="font-size:14px;margin:0 0 4px"><strong><u>Légende</u></strong></p><div class="sig-legend-items">Activez une couche pour afficher sa légende.</div>`;
      L.DomEvent.disableClickPropagation(div);
      return div;
    };
    legend.addTo(map);
    legendControlRef.current = legend;
    if (legend.getContainer() && legendPanelHostRef.current) {
      legendPanelHostRef.current.appendChild(legend.getContainer()!);
    }
    const renderVisibleLegend = () => {
      const items: string[] = [];
      const add = (label: string, color: string, icon = "fa fa-square") => {
        items.push(`<div><i class="${icon}" style="color:${color};width:18px"></i> ${label}</div>`);
      };
      const addBoundary = (label: string, color: string) => {
        items.push(`<div><span class="inline-block h-3 w-6 shrink-0 border-2 bg-transparent" style="display:inline-block;width:24px;height:12px;box-sizing:border-box;border:2px solid ${color};background:transparent;vertical-align:middle"></span> ${label}</div>`);
      };
      for (let n = 0; n <= 3; n++) {
        const levelName = n === 0 ? "Préscolaire" : n === 1 ? "Primaire" : n === 2 ? "Collège" : "Lycée";
        for (const sector of [0, 1]) {
          if (map.hasLayer(etabLayersRef.current[`layer_etabN${n}S${sector}`])) {
            const color = sector === 0 ? SECTOR_COLORS.public : SECTOR_COLORS.private;
            const privateOutline = sector === 1 ? "stroke:#fff;stroke-width:.75;paint-order:stroke fill;" : "";
            const iconHtml = getSchoolLevelIconHtml(`n${n}`, `color:${color};width:18px;${privateOutline}`);
            if (iconHtml) items.push(`<div>${iconHtml} ${levelName} ${sector === 0 ? "public" : "privé"}</div>`);
          }
        }
      }
      if (map.hasLayer(villageLayerRef.current)) {
        items.push(`<div>${getEtablissementIconHtml("village", VILLAGE_CONFIG.aireColor, 18)} Villages</div>`);
      }
      for (const niveau of [1, 2, 3]) {
        for (const secteur of [0, 1]) {
          if (map.hasLayer(aireLayersRef.current[`aire_etabN${niveau}S${secteur}`])) {
            const title = niveau === 1 ? "Aire primaire" : niveau === 2 ? "Aire collège" : "Aire lycée";
            add(`${title} ${secteur === 0 ? "public" : "privé"}`, NIVEAU_CONFIG[`n${niveau}`].aireColor);
          }
        }
      }
      if (shpRef.current.dren && map.hasLayer(shpRef.current.dren)) addBoundary("Limite DREN", "#4e73df");
      if (shpRef.current.cisco && map.hasLayer(shpRef.current.cisco)) addBoundary("Limite CISCO", "#22afbe");
      if (shpRef.current.commune && map.hasLayer(shpRef.current.commune)) addBoundary("Limite Commune", "#c0c0c0");
      if (shpRef.current.fokontany && map.hasLayer(shpRef.current.fokontany)) addBoundary("Limite Fokontany", "#55ff00");
      const host = legend.getContainer()?.querySelector(".sig-legend-items");
      if (host) host.innerHTML = items.length ? items.join("") : "Aucune couche SIG active.";
    };
    renderLegendRef.current = renderVisibleLegend;
    map.on("overlayadd overlayremove", renderVisibleLegend);

    setTimeout(() => {
      const scale = document.querySelector(".leaflet-control-scale") as HTMLElement;
      if (scale) {
        scale.style.marginLeft = "20px";
        scale.style.marginBottom = "8px";
      }
    }, 400);

    const zoomCtrl = new (L.Control.extend({
      options: { position: "topleft" },
    }))();
    zoomCtrl.onAdd = () => {
      const div = L.DomUtil.create("div", "");
      div.style.cssText =
        "background:#272729af;padding:4px 10px;font-size:12px;color:#fff;border-radius:4px;";
      div.id = "zoom-indicator";
      div.innerHTML = `Niveau de Zoom: ${map.getZoom()}`;
      return div;
    };
    zoomCtrl.addTo(map);

    map.on("zoomend", () => {
      const z = map.getZoom();
      setZoomLevel(z);
      const el = document.getElementById("zoom-indicator");
      if (el) el.innerHTML = `Niveau de Zoom: ${z}`;
      let fontSize = "0px";
      if (showMarkerNamesRef.current) {
        if (z > 16) fontSize = "13px";
        else if (z > 14) fontSize = "10px";
        else fontSize = "8px";
      }
      document
        .querySelectorAll<HTMLElement>(".label-etab")
        .forEach((el) => (el.style.fontSize = fontSize));
      document
        .querySelectorAll<HTMLElement>(".label-village")
        .forEach((el) => (el.style.fontSize = fontSize));
      // ⚠️ Correctif : la case "Déplacer" est un input React contrôlé
      // (`checked={sigMoveEnabled}`). La modifier directement via le DOM
      // (`moveCheckbox.checked = false`) ne fonctionnait pas de façon fiable :
      // React réaffiche l'état précédent (`true`) au prochain rendu, ce qui
      // désynchronisait visuellement la case de l'état réel. On met
      // désormais à jour l'état React lui-même, qui pilote à la fois la case
      // à cocher et la ref utilisée par les handlers de drag.
      if (sigMoveEnabledRef.current && z < MOVE_MIN_ZOOM) {
        setSigMoveEnabled(false);
      }
    });

    map.on("baselayerchange", (e: any) => {
      const z = map.getZoom();
      const isDark = e.name !== "DEFAULT" && e.name !== "OSM";
      const color = isDark ? "white" : "black";
      if (z > 12) {
        document
          .querySelectorAll<HTMLElement>(".label-etab")
          .forEach((el) => (el.style.color = color));
        document
          .querySelectorAll<HTMLElement>(".label-village")
          .forEach((el) => (el.style.color = color));
      }
    });

    map.on("click", () => setContextMenu(null));

    for (let n = 0; n < 4; n++) {
      for (let s = 0; s < 2; s++) {
        etabLayersRef.current[`layer_etabN${n}S${s}`] = new L.LayerGroup();
        aireLayersRef.current[`aire_etabN${n}S${s}`] = new L.LayerGroup();
      }
    }

    mapRef.current = map;
    distanceLayerRef.current.addTo(map);
    map.on("overlayadd", syncAireLayerVisibility);
    map.on("overlayremove", syncAireLayerVisibility);

    djangoGet<Dren[]>("/sig/dren/").then(setDrens).catch(console.error);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [syncAireLayerVisibility]);

  // ====================== CHARGER TABLES BANCS ======================
  useEffect(() => {
    if (!selectedSchool?.CODE_ETAB) return;
    let cancelled = false;

    const load = async () => {
      try {
        const params = new URLSearchParams({
          niveau: String(niveau),
          code_etab: String(selectedSchool.CODE_ETAB),
        });
        const data = await djangoGet(`/sig/tables-bancs/?${params}`);
        if (!cancelled) setTablesBancs(data);
      } catch (err) {
        if (!cancelled) console.error("Erreur tables-bancs:", err);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [selectedSchool, niveau]);

  // ====================== CHARGER CONFIG SIG ======================
  // Le backend est l'unique source de vérité des rôles, modules et permissions.
  // Toute réponse invalide ou erreur entraîne une désactivation complète.
  useEffect(() => {
    let cancelled = false;

    const loadConfig = async () => {
      setSigConfig(emptySigConfig());
      setAccessDenied(false);

      try {
        const res = await djangoGet("/sig/config/");
        if (cancelled) return;

        const config = parseSigConfig(res);
        setSigConfig(config);
        setAccessDenied(config.role === "UNKNOWN");
      } catch (err) {
        if (cancelled) return;
        console.error("Erreur /sig/config/:", err);
        setSigConfig(emptySigConfig());
        setAccessDenied(true);
        toast.error("Configuration SIG indisponible : tous les droits sont désactivés");
      }
    };

    loadConfig();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // ====================== DÉPLACEMENTS ======================
  const loadDeplacements = async (): Promise<boolean> => {
    try {
      if (!sigConfig.permissions.verifier) {
        toast.error("Action non autorisée pour votre profil");
        return false;
      }

      let dren = selectedDren;
      let cisco = selectedCisco;

      if (sigRole === "CISCO") {
        dren = Number(user?.dren_code ?? user?.dren ?? 0) || 0;
        cisco = Number(user?.cisco_code ?? user?.cisco ?? 0) || 0;
        if (dren <= 0 || cisco <= 0) {
          toast.error("Périmètre CISCO du compte introuvable");
          return false;
        }
      } else if (dren <= 0) {
        toast.error("Sélectionnez une DREN pour consulter les déplacements");
        return false;
      }

      const url =
        `/sig/deplacements/non-valides/?dren=${dren}` +
        (cisco > 0 ? `&cisco=${cisco}` : "");

      const response = await djangoGet(url);
      const data = Array.isArray(response?.data) ? response.data : [];
      setDeplacements(data);

      if (data.length > 0) {
        toast.success(`📋 ${data.length} déplacement${data.length > 1 ? "s" : ""} en attente`);
      } else {
        toast.info("Aucun déplacement en attente pour ce périmètre", {
          duration: 3000,
        });
      }
      return true;
    } catch (e: any) {
      console.error(e);
      toast.error(
        e?.status === 403
          ? "Vous n'avez pas accès aux déplacements de cette zone"
          : "Impossible de charger les déplacements",
      );
      setDeplacements([]);
      return false;
    }
  };

  const openValidationAction = async () => {
    if (!canStartValidation) {
      toast.error("Consultation des déplacements non autorisée.");
      return;
    }

    if (!startHeaderAction("VALIDATION")) return;

    const loaded = await loadDeplacements();

    if (!loaded) {
      cancelHeaderAction();
      return;
    }

    setShowDeplacementsModal(true);
  };

  // ====================== GESTION CISCO =======================
  useEffect(() => {
    const load = async () => {
      if (selectedDren === 0) {
        setCiscos([]);
        setSelectedCisco(0);
        return;
      }

      try {
        const data = await djangoGet<Cisco[]>(`/sig/liste-cisco/${selectedDren}/`);
        const list = Array.isArray(data) ? data : [];

        setCiscos(list);
      } catch {
        setCiscos([]);
        setSelectedCisco(0);
        toast.error("Erreur chargement CISCO");
      }
    };

    load();
  }, [selectedDren]);

  const updateGeoVerificationEntry = useCallback((
    key: string,
    update: (entry: GeoVerificationEntry | undefined) => GeoVerificationEntry,
  ) => {
    const entry = update(geoVerificationCacheRef.current[key]);
    const next = { ...geoVerificationCacheRef.current, [key]: entry };
    geoVerificationCacheRef.current = next;
    setGeoVerificationCache(next);
  }, []);

  const runGeoVerification = useCallback((
    dren: number,
    cisco: number,
    force = false,
    onlyEndpoint?: GeoVerificationEndpoint,
  ) => {
    const key = `${dren}::${cisco}`;
    const current = geoVerificationCacheRef.current[key];
    if (current && !force && !onlyEndpoint) return;

    const base = current ?? emptyGeoVerificationEntry(dren, cisco);
    const requested: GeoVerificationEndpoint[] = onlyEndpoint
      ? [onlyEndpoint]
      : ["establishments", "villages"];
    const endpoints = requested.filter((endpoint) => !base[endpoint].loading);
    if (endpoints.length === 0) return;

    updateGeoVerificationEntry(key, (entry) => {
      const next = entry ?? emptyGeoVerificationEntry(dren, cisco);
      return {
        ...next,
        initialization: "done",
        consolidation: "running",
        ...Object.fromEntries(endpoints.map((endpoint) => [endpoint, {
          ...next[endpoint],
          status: "running",
          loading: true,
          error: null,
        }])),
      } as GeoVerificationEntry;
    });

    endpoints.forEach((endpoint) => {
      const url = endpoint === "establishments"
        ? `/sig/verification-geographique/etablissements/${dren}/${cisco}/`
        : `/sig/verification-geographique/villages/${dren}/${cisco}/`;

      void (async () => {
        try {
          const data = await djangoGet<GeoVerificationRow[]>(url);
          if (!Array.isArray(data)) throw new Error("Le backend n'a pas renvoyé un tableau de résultats.");
          updateGeoVerificationEntry(key, (entry) => {
            const next = entry ?? emptyGeoVerificationEntry(dren, cisco);
            const otherEndpoint: GeoVerificationEndpoint = endpoint === "establishments" ? "villages" : "establishments";
            return {
              ...next,
              [endpoint]: { status: "done", loading: false, hasData: true, data, error: null },
              consolidation: next[otherEndpoint].loading ? "running" : "done",
            };
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Erreur inconnue pendant la vérification.";
          updateGeoVerificationEntry(key, (entry) => {
            const next = entry ?? emptyGeoVerificationEntry(dren, cisco);
            const otherEndpoint: GeoVerificationEndpoint = endpoint === "establishments" ? "villages" : "establishments";
            return {
              ...next,
              [endpoint]: { ...next[endpoint], status: "error", loading: false, error: message },
              consolidation: next[otherEndpoint].loading ? "running" : "done",
            };
          });
        }
      })();
    });
  }, [updateGeoVerificationEntry]);

  const openGeoVerification = () => {
    if (!isAuthenticated || isLoading) {
      toast.error("Vous devez être connecté pour effectuer cette vérification.");
      return;
    }
    if (selectedDren <= 0) {
      toast.error("Veuillez sélectionner une DREN avant la vérification.");
      return;
    }
    if (sigRole === "CISCO" && (
      selectedCisco <= 0 || !ciscos.some((cisco) => cisco.CODE_CISCO === selectedCisco)
    )) {
      toast.error("La CISCO autorisée n'est pas encore disponible pour cette DREN.");
      return;
    }

    const key = `${selectedDren}::${selectedCisco}`;
    setGeoVerificationContext({ key, dren: selectedDren, cisco: selectedCisco });
    setGeoVerificationOpen(true);
    if (!geoVerificationCacheRef.current[key]) {
      runGeoVerification(selectedDren, selectedCisco);
    }
  };

  const retryGeoVerification = (endpoint?: GeoVerificationEndpoint) => {
    if (!geoVerificationContext) return;
    runGeoVerification(
      geoVerificationContext.dren,
      geoVerificationContext.cisco,
      true,
      endpoint,
    );
  };

  const locateGeoAnomaly = (row: GeoVerificationRow) => {
    const map = mapRef.current;
    if (!map) return;

    if (!geoRowHasValidCoordinates(row)) {
      toast.info("La position de cette anomalie est indisponible.");
      return;
    }

    map.flyTo([Number(row.latitude), Number(row.longitude)], 16);
  };

  // ====================== GESTION DES LAYERS ======================
  const clearEtabLayers = () => {
    const map = mapRef.current;
    for (let n = 0; n < 4; n++) {
      for (let s = 0; s < 2; s++) {
        const etabLayer = etabLayersRef.current[`layer_etabN${n}S${s}`];
        if (map && etabLayer && map.hasLayer(etabLayer)) map.removeLayer(etabLayer);
        etabLayer?.clearLayers();

        const aireLayer = aireLayersRef.current[`aire_etabN${n}S${s}`];
        if (map && aireLayer && map.hasLayer(aireLayer)) map.removeLayer(aireLayer);
        aireLayer?.clearLayers();
      }
    }
  };

  const removeOverLayers = () => {
    const lc = layerControlRef.current;
    if (!lc) return;
    for (let n = 0; n < 4; n++) {
      for (let s = 0; s < 2; s++) {
        const layer = etabLayersRef.current[`layer_etabN${n}S${s}`];
        if (layer) lc.removeLayer(layer);
      }
    }
    if (villageLayerRef.current) lc.removeLayer(villageLayerRef.current);
  };

  const clearBaseShapes = () => {
    const map = mapRef.current;
    if (!map) return;
    Object.keys(shpRef.current).forEach((key) => {
      const layer = shpRef.current[key];
      if (layer && map.hasLayer(layer)) map.removeLayer(layer);
      shpRef.current[key] = null;
    });
  };

  const hideAllSigLayers = () => {
    const map = mapRef.current;
    if (!map) return;
    if (verificationLayerVisibilityRef.current === null) {
      const visibility: Record<string, boolean> = {};
      for (let n = 0; n < 4; n++) {
        for (let s = 0; s < 2; s++) {
          const key = `layer_etabN${n}S${s}`;
          const layer = etabLayersRef.current[key];
          visibility[key] = Boolean(layer && map.hasLayer(layer));
        }
      }
      visibility.villages = map.hasLayer(villageLayerRef.current);
      verificationLayerVisibilityRef.current = visibility;
    }
    for (let n = 0; n < 4; n++) {
      for (let s = 0; s < 2; s++) {
        const layer = etabLayersRef.current[`layer_etabN${n}S${s}`];
        if (layer && map.hasLayer(layer)) map.removeLayer(layer);
      }
    }
    if (map.hasLayer(villageLayerRef.current)) map.removeLayer(villageLayerRef.current);
    syncAireLayerVisibility();
  };

  const showAllSigLayers = () => {
    const map = mapRef.current;
    if (!map) return;
    const visibility = verificationLayerVisibilityRef.current;
    if (!visibility) return;
    for (let n = 0; n < 4; n++) {
      for (let s = 0; s < 2; s++) {
        const key = `layer_etabN${n}S${s}`;
        const layer = etabLayersRef.current[key];
        if (visibility[key] && layer && !map.hasLayer(layer)) layer.addTo(map);
      }
    }
    if (visibility.villages && !map.hasLayer(villageLayerRef.current)) {
      villageLayerRef.current.addTo(map);
    }
    verificationLayerVisibilityRef.current = null;
    syncAireLayerVisibility();
    renderLegendRef.current();
  };

  const clearVerificationMarkers = () => {
    verificationMarkersRef.current.clearLayers();
  };

  const clearTemporaryMarkers = () => {
    const map = mapRef.current;
    if (!map) return;
    tempMarkersRef.current.forEach((m) => {
      try {
        map.removeLayer(m);
      } catch {}
    });
    tempMarkersRef.current = [];
  };

  // ====================== DRAG HANDLERS ======================
  const onDragMarkerStart = (event: any) => {
    positionAvantDeplacementRef.current = event.target.getLatLng();
  };

  // Centralise la vérification d'autorisation de déplacement (mode activé +
  // zoom suffisant) pour les marqueurs établissement et village. Utilise la
  // ref `sigMoveEnabledRef` (toujours à jour) plutôt qu'une lecture directe
  // du DOM ou de l'état React (susceptible d'être obsolète dans la closure
  // du handler `dragend`, attaché une seule fois à la création du marqueur).
  const isMoveAuthorized = (): { ok: boolean; reason?: string } => {
    if (!permsRef.current.canMove || activeHeaderAction !== "DEPLACEMENT") {
      return {
        ok: false,
        reason: "Aucune action Déplacement n'est active pour votre compte",
      };
    }
    if (!sigMoveEnabledRef.current) {
      return {
        ok: false,
        reason: "Activez le mode 'Déplacer' pour pouvoir modifier la position",
      };
    }
    const zoom = mapRef.current?.getZoom() ?? 0;
    if (zoom < MOVE_MIN_ZOOM) {
      return {
        ok: false,
        reason: `Déplacement autorisé uniquement à partir du zoom ${MOVE_MIN_ZOOM}`,
      };
    }
    return { ok: true };
  };

  const onDragEtabEnd = async (event: any) => {
    const { ok, reason } = isMoveAuthorized();

    if (!ok) {
      if (positionAvantDeplacementRef.current) {
        event.target.setLatLng(positionAvantDeplacementRef.current);
      }
      if (reason) toast.warning(reason);
      return;
    }

    const props = event.target.options.properties;
    const code_etab = props?.CODE_ETAB;
    const { lat, lng } = event.target.getLatLng();

    if (!code_etab) return;

    try {
      await djangoPostJSON("/sig/deplacements/update-position-etablissement/", {
        code_etab: Number(code_etab),
        nouveau_lat: lat,
        nouveau_lng: lng,
        // demande_par géré côté serveur (request.user.id = bigint)
      });
      toast.success("Demande de déplacement enregistrée — en attente de validation");
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la mise à jour");
      if (positionAvantDeplacementRef.current) {
        event.target.setLatLng(positionAvantDeplacementRef.current);
      }
    }
  };

  const onDragVillageEnd = async (event: any) => {
    const { ok, reason } = isMoveAuthorized();

    if (!ok) {
      if (positionAvantDeplacementRef.current) {
        event.target.setLatLng(positionAvantDeplacementRef.current);
      }
      if (reason) toast.warning(reason);
      return;
    }

    const props = event.target.options.properties;
    const id = props?.id;
    const { lat, lng } = event.target.getLatLng();

    if (!id) {
      toast.error("Impossible d'identifier ce village (données manquantes) — déplacement annulé");
      if (positionAvantDeplacementRef.current) {
        event.target.setLatLng(positionAvantDeplacementRef.current);
      }
      return;
    }

    try {
      await djangoPostJSON("/sig/deplacements/update-position-village/", {
        id_village: Number(id),
        nouveau_lat: lat,
        nouveau_lng: lng,
        // demande_par géré côté serveur (request.user.id = bigint)
      });
      toast.success("Demande de déplacement enregistrée — en attente de validation");
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la mise à jour");
      if (positionAvantDeplacementRef.current) {
        event.target.setLatLng(positionAvantDeplacementRef.current);
      }
    }
  };

  // ====================== CONTEXT MENU ======================
  const handleContextMenu = (e: any) => {
    const map = mapRef.current;
    if (!map) return;
    e.originalEvent?.preventDefault?.();
    const point = map.latLngToContainerPoint(e.latlng);
    setGeoCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
    setContextMenu({
      x: point.x,
      y: point.y,
      lat: e.latlng.lat,
      lng: e.latlng.lng,
    });
  };

  // ====================== CRÉATION DES MARKERS ÉTABLISSEMENTS ======================
  const createLayerEtab = (data: any[], niveauKey: string) => {
    const map = mapRef.current;
    if (!map) return [];
    const config = NIVEAU_CONFIG[niveauKey];
    const nIdx = niveauKey.replace("n", "");
    const items: SearchItem[] = [];
    // Voronoï construit sur tous les établissements de ce niveau (publics
    // et privés) pour que leurs zones de recrutement se partagent l'espace.
    const validEtabs = data.flatMap((etab) => {
      const lat = parseFloat(etab.latitude);
      const lng = parseFloat(etab.longitude);
      return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
        ? [{ etab, lat, lng }]
        : [];
    });
    const uniqueSites = new Map<string, [number, number]>();
    validEtabs.forEach(({ lat, lng }) => {
      const key = `${lng.toFixed(7)},${lat.toFixed(7)}`;
      if (!uniqueSites.has(key)) {
        uniqueSites.set(key, [lng, lat]);
      }
    });
    const siteKeys = [...uniqueSites.keys()];
    const sites = [...uniqueSites.values()];
    const siteKeyByIndex = new Map(siteKeys.map((key, index) => [index, key]));
    const siteByKey = new Map<string, any>();
    let voronoiCells: ReturnType<typeof turf.voronoi> | null = null;
    if (sites.length >= 2) {
      const radiusKm = config.rayon;
      const maxLat = Math.max(...sites.map(([, lat]) => Math.abs(lat)));
      const latPad = radiusKm / 110.574;
      const lngPad = radiusKm / Math.max(1, 111.32 * Math.cos((maxLat * Math.PI) / 180));
      const bbox: [number, number, number, number] = [
        Math.min(...sites.map(([lng]) => lng)) - lngPad,
        Math.min(...sites.map(([, lat]) => lat)) - latPad,
        Math.max(...sites.map(([lng]) => lng)) + lngPad,
        Math.max(...sites.map(([, lat]) => lat)) + latPad,
      ];
      try {
        // Garder une clé sur chaque point permet d'associer explicitement la
        // cellule au site, même si l'algorithme renvoie des cellules nulles.
        voronoiCells = turf.voronoi(
          turf.featureCollection(sites.map((coordinates, index) =>
            turf.point(coordinates, { siteKey: siteKeyByIndex.get(index) }),
          )),
          { bbox },
        );
        voronoiCells.features.forEach((cell: any) => {
          const key = cell?.properties?.siteKey;
          if (key && cell.geometry?.type === "Polygon") siteByKey.set(key, cell);
        });
      } catch (err) {
        console.warn(`Voronoï failed for ${niveauKey}`, err);
      }
    }
    // Le caractère déplaçable est piloté par applyDraggableState() (droit + mode « Déplacer »).

    data.forEach((dataEtab) => {
      const lat = parseFloat(dataEtab.latitude);
      const lng = parseFloat(dataEtab.longitude);
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return;

      const secteur = Number(dataEtab.SECTEUR) === 0 ? 0 : 1;
      const sectorColor = secteur === 0 ? SECTOR_COLORS.public : SECTOR_COLORS.private;
      const sectorOutline = secteur === 1 ? "stroke:#fff;stroke-width:.75;paint-order:stroke fill;" : "";
      const schoolIconHtml = getSchoolLevelIconHtml(niveauKey, `color:${sectorColor};${sectorOutline}`);
      const iconHtml = schoolIconHtml || `<i class="fas fa-map-marker-alt" aria-hidden="true"></i>`;
      const icon = L.divIcon({
        className: "custom-icon",
        iconSize: [20, 20],
        html: `${iconHtml}<span class="label-etab" style="font-size:${showMarkerNamesRef.current ? "11px" : "0px"};position:absolute;top:10px;left:18px;white-space:nowrap;background:rgba(255,255,255,.88);padding:1px 4px;border-radius:3px;color:#111;">${dataEtab.NOM_ETAB}</span>`,
      });

      const latLng: [number, number] = [lat, lng];
      items.push({
        latLng,
        id: dataEtab.CODE_ETAB,
        name: `${dataEtab.NOM_ETAB} / ${dataEtab.FOKONTANY || ""}`,
      });

      const marker = L.marker(latLng, {
        icon,
        draggable: false,
        properties: dataEtab,
      } as any);

      marker.bindTooltip(`<div class="custom-tooltip">${dataEtab.NOM_ETAB}</div>`, {
        permanent: false,
        opacity: 1,
        direction: "top",
      });

      marker.on("mouseover", () => setHoveredEtab(dataEtab));
      marker.on("mouseout", () => setHoveredEtab(null));
      marker.on("click", () => {
        if (measureDistanceEnabledRef.current) {
          measureMarkerClickRef.current({ latLng: marker.getLatLng(), name: String(dataEtab.NOM_ETAB || "Établissement") });
          return;
        }
        setNiveau(Number(niveauKey.replace("n", "")));
        setSelectedSchool(dataEtab);
      });

      marker.on("dragstart", onDragMarkerStart);
      marker.on("dragend", onDragEtabEnd);

      try {
        const center = turf.point([lng, lat]);
        const siteKey = `${lng.toFixed(7)},${lat.toFixed(7)}`;
        const cell = siteByKey.get(siteKey);
        const disk = turf.circle(center, config.rayon, { steps: 48, units: "kilometers" });
        const area = cell
          ? turf.intersect(turf.featureCollection([disk, cell] as any))
          : sites.length === 1
            ? disk
            : null;
        if (area) {
          const bufferPolygon = L.geoJSON(area as any, {
            style: {
              color: config.aireColor,
              fillColor: config.aireColor,
              weight: 1,
              fillOpacity: 0.05,
            },
          });
          bufferPolygon.eachLayer((layer: any) => {
            layer.on("mouseover", (e: any) =>
              e.target.setStyle({
                weight: 2,
                color: "#ff0000",
                fillOpacity: 0.1,
              }),
            );
            layer.on("mouseout", (e: any) =>
              e.target.setStyle({
                color: config.aireColor,
                fillColor: config.aireColor,
                weight: 1,
                fillOpacity: 0.05,
              }),
            );
          });
          aireLayersRef.current[`aire_etabN${nIdx}S${secteur}`]?.addLayer(bufferPolygon);
        } else if (sites.length > 1) {
          // Une cellule manquante signifie que le site n'a pas pu être
          // récupéré dans le Voronoï; on le signale pour identifier les
          // données géographiques concernées sans dessiner une aire erronée.
          console.warn(`Aire ${niveauKey} sans cellule Voronoï`, {
            code: dataEtab.CODE_ETAB,
            latitude: lat,
            longitude: lng,
          });
        }
      } catch (err) {
        console.warn(`Buffer failed for etab ${dataEtab.CODE_ETAB}`, err);
      }

      etabLayersRef.current[`layer_etabN${nIdx}S${secteur}`]?.addLayer(marker);
    });

    return items;
  };

  // ====================== APPLIQUER LES FILTRES ======================
  const handleApplyFilters = useCallback(async (
    scope?: { dren: number; cisco: number },
  ) => {
    if (activeHeaderAction !== null) {
      toast.warning("Terminez ou annulez l’action SIG en cours avant de modifier les filtres.");
      return;
    }
    const map = mapRef.current;
    const lc = layerControlRef.current;
    if (!map || !lc) return;

    const codeDren = scope?.dren ?? selectedDren;
    const codeCisco = scope?.cisco ?? selectedCisco;

    if (codeDren === 0) {
      toast.error("Veuillez sélectionner une DREN");
      return;
    }

    setLoading(true);
    setShowFilters(false);
    setContextMenu(null);

    try {
      const previousLayerVisibility: Record<string, boolean> = {};
      for (let n = 0; n < 4; n++) {
        for (let s = 0; s < 2; s++) {
          const key = `layer_etabN${n}S${s}`;
          const layer = etabLayersRef.current[key];
          previousLayerVisibility[key] = Boolean(layer && map.hasLayer(layer));
        }
      }
      previousLayerVisibility.villages = map.hasLayer(villageLayerRef.current);
      const previousAireVisibility: Record<string, boolean> = {};
      for (const niveau of [1, 2, 3]) {
        const checkbox = document.getElementById(`aireN${niveau}`) as HTMLInputElement | null;
        previousAireVisibility[`aireN${niveau}`] = Boolean(checkbox?.checked);
      }

      clearBaseShapes();
      clearEtabLayers();
      distanceLayerRef.current.clearLayers();
      removeOverLayers();
      villageLayerRef.current.clearLayers();

      if (ctrlAireRef.current) {
        map.removeControl(ctrlAireRef.current);
        ctrlAireRef.current = null;
      }
      if (moveCtrlRef.current) {
        map.removeControl(moveCtrlRef.current);
        moveCtrlRef.current = null;
      }

      const [
        drenRes,
        ciscoRes,
        communeRes,
        fokontanyRes,
        villagesRes,
        n0Res,
        n1Res,
        n2Res,
        n3Res,
        nonGeoRes,
      ] = await Promise.allSettled([
        djangoGet(`/sig/layer-dren/${codeDren}/`),
        djangoGet(`/sig/layer-cisco/${codeDren}/${codeCisco}/`),
        djangoGet(`/sig/layer-commune/${codeDren}/${codeCisco}/`),
        djangoGet(`/sig/layer-fokontany/${codeDren}/${codeCisco}/`),
        djangoGet(`/sig/layer-villages/${codeDren}/${codeCisco}/`),
        djangoGet(`/sig/layer-etab-n0/${codeDren}/${codeCisco}/`),
        djangoGet(`/sig/layer-etab-n1/${codeDren}/${codeCisco}/`),
        djangoGet(`/sig/layer-etab-n2/${codeDren}/${codeCisco}/`),
        djangoGet(`/sig/layer-etab-n3/${codeDren}/${codeCisco}/`),
        djangoGet(`/sig/etablissements-non-geolocalises/${codeDren}/${codeCisco}/`),
      ]);

      const drenData = drenRes.status === "fulfilled" ? drenRes.value : [];
      const ciscoData = ciscoRes.status === "fulfilled" ? ciscoRes.value : [];
      const communeData = communeRes.status === "fulfilled" ? communeRes.value : [];
      const fktData = fokontanyRes.status === "fulfilled" ? fokontanyRes.value : [];
      const villagesData = villagesRes.status === "fulfilled" ? villagesRes.value : [];
      const n0Data = n0Res.status === "fulfilled" ? n0Res.value : [];
      const n1Data = n1Res.status === "fulfilled" ? n1Res.value : [];
      const n2Data = n2Res.status === "fulfilled" ? n2Res.value : [];
      const n3Data = n3Res.status === "fulfilled" ? n3Res.value : [];

      setEtabNonPointe(nonGeoRes.status === "fulfilled" ? nonGeoRes.value : []);

      if (drenData?.[0]?.shape) {
        shpRef.current.dren = L.geoJSON(drenData[0].shape, {
          style: STYLE_DREN,
        });
      }
      if (ciscoData?.[0]?.shape) {
        shpRef.current.cisco = L.geoJSON(ciscoData[0].shape, {
          style: STYLE_CISCO,
          onEachFeature: (feature, layer) => {
            layer.bindTooltip(`CISCO: ${feature.properties?.name || ""}`, {
              permanent: false,
            });
            layer.on("contextmenu", handleContextMenu);
          },
        });
      }
      if (communeData?.[0]?.shape) {
        shpRef.current.commune = L.geoJSON(communeData[0].shape, {
          style: STYLE_COMMUNE,
        });
      }
      if (fktData?.[0]?.shape) {
        shpRef.current.fokontany = L.geoJSON(fktData[0].shape, {
          style: STYLE_FOKONTANY,
          onEachFeature: (feature, layer) => {
            layer.bindTooltip(`Fokontany: ${feature.properties?.name || ""}`, {
              permanent: false,
            });
            layer.on("contextmenu", handleContextMenu);
          },
        });
      }

      if (shpRef.current.dren) shpRef.current.dren.addTo(map);
      if (shpRef.current.cisco) shpRef.current.cisco.addTo(map);
      if (shpRef.current.commune) shpRef.current.commune.addTo(map);
      if (shpRef.current.fokontany) shpRef.current.fokontany.addTo(map);

      // Le cadrage sera animé après le chargement des marqueurs, pour pouvoir
      // utiliser les limites de la CISCO/DREN demandée ou, à défaut, celles
      // des points réellement retournés par le filtre.
      let filteredZoneBounds: L.LatLngBounds | null = null;
      const targetShape = codeCisco > 0 ? shpRef.current.cisco : shpRef.current.dren;
      try {
        const bounds = targetShape?.getBounds();
        if (bounds?.isValid()) filteredZoneBounds = bounds;
      } catch {
        filteredZoneBounds = null;
      }

      const allSearchItems: SearchItem[] = [];
      allSearchItems.push(...(createLayerEtab(n0Data, "n0") || []));
      allSearchItems.push(...(createLayerEtab(n1Data, "n1") || []));
      allSearchItems.push(...(createLayerEtab(n2Data, "n2") || []));
      allSearchItems.push(...(createLayerEtab(n3Data, "n3") || []));

      villageLayerRef.current.clearLayers();
      const villageItems: SearchItem[] = [];


      (villagesData as any[]).forEach((v: any) => {
        const lat = parseFloat(v.latitude);
        const lng = parseFloat(v.longitude);
        if (isNaN(lat) || isNaN(lng)) return;

        const icon = L.divIcon({
          className: "custom-icon",
          iconSize: [18, 18],
          html: `${getEtablissementIconHtml("village", VILLAGE_CONFIG.aireColor, 18)}<span class="label-village" style="font-size:${showMarkerNamesRef.current ? "11px" : "0px"};position:absolute;top:10px;left:18px;white-space:nowrap;background:rgba(255,255,255,.88);padding:1px 4px;border-radius:3px;color:#111;">${v.name || "Village"}</span>`,
        });

        // ⚠️ Correctif : les propriétés du village doivent être posées dans
        // `options.properties` (comme pour les marqueurs établissement), et
        // non directement sur l'instance (`marker.properties = v`). Sinon
        // `onDragVillageEnd` — qui lit `event.target.options.properties` —
        // ne trouve jamais l'`id` du village et annule silencieusement
        // l'enregistrement de la nouvelle position.
        const marker = L.marker([lat, lng], {
          icon,
          draggable: false,
          properties: v,
        } as any);

        marker.bindTooltip(`Village: ${v.name}`, {
          permanent: false,
          direction: "top",
        });
        marker.on("mouseover", () => setHoveredEtab(v));
        marker.on("mouseout", () => setHoveredEtab(null));
        marker.on("click", () => {
          measureMarkerClickRef.current({ latLng: marker.getLatLng(), name: String(v.name || "Village") });
        });
        marker.on("dragstart", onDragMarkerStart);
        marker.on("dragend", onDragVillageEnd);

        villageLayerRef.current.addLayer(marker);
        villageItems.push({ latLng: [lat, lng], id: v.id, name: v.name });
      });

      allSearchItems.push(...villageItems);
      setSearchItems(allSearchItems);
      applyDraggableState();

      if (!filteredZoneBounds && allSearchItems.length) {
        const bounds = L.latLngBounds(allSearchItems.map((item) => item.latLng));
        if (bounds.isValid()) filteredZoneBounds = bounds;
      }
      if (!filteredZoneBounds && codeCisco > 0) {
        const drenBounds = shpRef.current.dren?.getBounds();
        if (drenBounds?.isValid()) filteredZoneBounds = drenBounds;
      }
      if (filteredZoneBounds?.isValid()) {
        const bounds = filteredZoneBounds;
        window.setTimeout(() => {
          if (mapRef.current !== map) return;
          map.invalidateSize({ animate: false });
          if (bounds.getSouthWest().equals(bounds.getNorthEast())) {
            map.flyTo(bounds.getCenter(), 15, { duration: 1 });
          } else {
            map.flyToBounds(bounds, { padding: [36, 36], maxZoom: 13, duration: 1 });
          }
        }, 320);
      }

      setStats(
        buildSigUniqueEstablishmentStats(
          { n0: n0Data, n1: n1Data, n2: n2Data, n3: n3Data },
          villageItems.length,
        ),
      );

      lc.addOverlay(etabLayersRef.current["layer_etabN0S0"], "PRESCO PUBLIC");
      lc.addOverlay(etabLayersRef.current["layer_etabN0S1"], "PRESCO PRIVÉ");
      lc.addOverlay(etabLayersRef.current["layer_etabN1S0"], "PRIMAIRE PUBLIC");
      lc.addOverlay(etabLayersRef.current["layer_etabN1S1"], "PRIMAIRE PRIVÉ");
      lc.addOverlay(etabLayersRef.current["layer_etabN2S0"], "COLLEGE PUBLIC");
      lc.addOverlay(etabLayersRef.current["layer_etabN2S1"], "COLLEGE PRIVÉ");
      lc.addOverlay(etabLayersRef.current["layer_etabN3S0"], "LYCEE PUBLIC");
      lc.addOverlay(etabLayersRef.current["layer_etabN3S1"], "LYCEE PRIVÉ");
      lc.addOverlay(villageLayerRef.current, "VILLAGES");

      for (let n = 0; n < 4; n++) {
        for (let s = 0; s < 2; s++) {
          const key = `layer_etabN${n}S${s}`;
          const layer = etabLayersRef.current[key];
          if (previousLayerVisibility[key] && layer && !map.hasLayer(layer)) layer.addTo(map);
        }
      }
      if (previousLayerVisibility.villages && !map.hasLayer(villageLayerRef.current)) {
        villageLayerRef.current.addTo(map);
      }

      const aireCtrl = new (L.Control.extend({
        options: { position: "topright" },
      }))();

      aireCtrl.onAdd = () => {
        const div = L.DomUtil.create("div", "control-aire");
        div.innerHTML = `
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin:4px 0;">
            <input id="sig-show-marker-names" type="checkbox" style="width:16px;height:16px;" ${showMarkerNamesRef.current ? "checked" : ""} />
            <span>Afficher les noms sur la carte</span>
          </label>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin:4px 0;">
            <input id="sig-measure-distance" type="checkbox" style="width:16px;height:16px;" ${measureDistanceEnabledRef.current ? "checked" : ""} />
            <span>Mesurer entre deux marqueurs</span>
          </label>
          <hr style="margin:5px 0;border-color:#ccc;" />
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin:4px 0;">
            <input id="aireN1" type="checkbox" style="width:16px;height:16px;" />
            <span>Aire primaire (public/privé)</span>
          </label>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin:4px 0;">
            <input id="aireN2" type="checkbox" style="width:16px;height:16px;" />
            <span>Aire collège (public/privé)</span>
          </label>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin:4px 0;">
            <input id="aireN3" type="checkbox" style="width:16px;height:16px;" />
            <span>Aire lycée (public/privé)</span>
          </label>
        `;

        L.DomEvent.disableClickPropagation(div);

        setTimeout(() => {
          const namesCheckbox = document.getElementById("sig-show-marker-names") as HTMLInputElement | null;
          namesCheckbox?.addEventListener("change", () => {
            showMarkerNamesRef.current = namesCheckbox.checked;
            setShowMarkerNames(namesCheckbox.checked);
          });

          const distanceCheckbox = document.getElementById("sig-measure-distance") as HTMLInputElement | null;
          distanceCheckbox?.addEventListener("change", () => {
            measureDistanceEnabledRef.current = distanceCheckbox.checked;
            distanceFirstMarkerRef.current = null;
            if (!distanceCheckbox.checked) distanceLayerRef.current.clearLayers();
            setMeasureDistanceEnabled(distanceCheckbox.checked);
            toast.info(distanceCheckbox.checked
              ? "Cliquez sur deux marqueurs pour mesurer la distance."
              : "Mesure désactivée.");
          });

          [1, 2, 3].forEach((niveau) => {
            const cb = document.getElementById(`aireN${niveau}`) as HTMLInputElement | null;
            if (!cb) return;

            cb.addEventListener("change", () => {
              const hasVisibleEstablishments = [0, 1].some((secteur) => {
                const etabLayer = etabLayersRef.current[`layer_etabN${niveau}S${secteur}`];
                return Boolean(etabLayer && map.hasLayer(etabLayer));
              });
              if (cb.checked && !hasVisibleEstablishments) {
                cb.checked = false;
                toast.info("Affichez d'abord les établissements de ce niveau.");
                return;
              }
              syncAireLayerVisibility();
            });
          });
        }, 100);

        return div;
      };

      aireCtrl.addTo(map);
      ctrlAireRef.current = aireCtrl;
      if (aireCtrl.getContainer() && toolsPanelHostRef.current) {
        toolsPanelHostRef.current.appendChild(aireCtrl.getContainer()!);
      }
      for (const niveau of [1, 2, 3]) {
        const checkbox = document.getElementById(`aireN${niveau}`) as HTMLInputElement | null;
        if (checkbox) checkbox.checked = previousAireVisibility[`aireN${niveau}`];
      }
      syncAireLayerVisibility();

      toast.success(
        `Chargement terminé : ${n0Data.length + n1Data.length + n2Data.length + n3Data.length} établissements`,
      );
      renderLegendRef.current();
    } catch (err: any) {
      console.error("Erreur handleApplyFilters:", err);
      toast.error("Erreur lors du chargement des données SIG");
    } finally {
      setLoading(false);
    }
  }, [selectedDren, selectedCisco, activeHeaderAction]);

  // ====================== RECHERCHE ======================
  useEffect(() => {
    if (searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }
    const term = searchTerm.toLowerCase();
    setSearchResults(
      searchItems.filter((item) => item.name.toLowerCase().includes(term)).slice(0, 20),
    );
  }, [searchTerm, searchItems]);

  const handleSearchSelect = (item: SearchItem) => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo(item.latLng, 14);
    if (searchMarkerRef.current) searchMarkerRef.current.remove();
    searchMarkerRef.current = L.circle(item.latLng, {
      radius: 500,
      color: "green",
      fillColor: "yellow",
      fillOpacity: 0.3,
    })
      .addTo(map)
      .bindPopup(item.name)
      .openPopup();
    setTimeout(() => {
      searchMarkerRef.current?.remove();
      searchMarkerRef.current = null;
    }, 10000);
    setSearchTerm("");
    setSearchResults([]);
  };

  // ====================== GÉOLOCALISER ======================
  const handleSaveGeoEtab = async () => {
    if (
      !sigConfig.modules.pointage ||
      activeHeaderAction !== "POINTAGE"
    ) {
      toast.error("❌ Le pointage n'est pas autorisé pour votre profil");
      return;
    }
    const etab = selectedEtabGeo;
    if (!etab) {
      toast.warning("Sélectionnez un établissement");
      return;
    }
    if (geoCoords.lat === 0 && geoCoords.lng === 0) {
      toast.error("Erreur de coordonnées.");
      return;
    }
    try {
      await djangoPost("/sig/geolocaliser-etablissement/", {
        code_etab: etab.CODE_ETAB,
        longitude: geoCoords.lng,
        latitude: geoCoords.lat,
      });
      toast.success("Établissement géolocalisé avec succès");
      // L'établissement n'est plus « non pointé » : on le retire de la liste
      // (compteur, modale, sélection) pour éviter un second envoi.
      setEtabNonPointe((prev) => prev.filter((e) => e.CODE_ETAB !== etab.CODE_ETAB));
      setSelectedEtabGeo(null);
      setFilterEtabName("");
      setShowGeoEtab(false);
      const map = mapRef.current;
      if (map) L.marker([geoCoords.lat, geoCoords.lng]).addTo(map).bindPopup(etab.NOM_ETAB).openPopup();
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la géolocalisation");
    }
  };

  const handleSaveGeoVillage = async () => {
    if (
      !sigConfig.modules.pointage ||
      activeHeaderAction !== "POINTAGE"
    ) {
      toast.error("❌ Le pointage n'est pas autorisé pour votre profil");
      return;
    }
    if (!selectedDren || !selectedCisco) {
      toast.warning("Sélectionnez une DREN et une CISCO avant de géolocaliser un village");
      return;
    }
    const normalizedVillageName = villageForm.name.trim().toUpperCase();
    if (normalizedVillageName.length < 4 || normalizedVillageName.length > 200) {
      toast.warning("Nom du village invalide (4 à 200 caractères après nettoyage)");
      return;
    }
    if (
      !Number.isFinite(geoCoords.lat) ||
      !Number.isFinite(geoCoords.lng) ||
      geoCoords.lat < -90 ||
      geoCoords.lat > 90 ||
      geoCoords.lng < -180 ||
      geoCoords.lng > 180
    ) {
      toast.error("Coordonnées invalides.");
      return;
    }
    try {
      await djangoPost("/sig/geolocaliser-village/", {
        name: normalizedVillageName,
        dren: selectedDren,
        cisco: selectedCisco,
        airtel: villageForm.airtel ? 1 : 0,
        orange: villageForm.orange ? 1 : 0,
        telma: villageForm.telma ? 1 : 0,
        elec: villageForm.elec ? 1 : 0,
        eau: villageForm.eau ? 1 : 0,
        latitude: geoCoords.lat,
        longitude: geoCoords.lng,
      });
      toast.success(`Village ${normalizedVillageName} géolocalisé avec succès`);
      setShowGeoVillage(false);
      setVillageForm({
        name: "",
        airtel: false,
        orange: false,
        telma: false,
        elec: false,
        eau: false,
      });
      const map = mapRef.current;
      if (map)
        L.marker([geoCoords.lat, geoCoords.lng]).addTo(map).bindPopup(normalizedVillageName).openPopup();
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la géolocalisation");
    }
  };

  const handleValider = async (item: any) => {
    // ADMIN / CISCO (dans leur périmètre) uniquement. Le serveur re-contrôle
    // le rôle, le module « validation_deplacement » et le périmètre de la cible.
    if (!sigConfig.permissions.valider) {
      toast.error("❌ Validation non autorisée pour votre profil (ou module désactivé)");
      return;
    }

    if (
      !confirm(
        `Voulez-vous vraiment VALIDER le déplacement de ${item.type_objet === "ETAB" ? "l'établissement" : "le village"} ${item.code || ""} ?`,
      )
    ) {
      return;
    }

    try {
      await djangoPostJSON("/sig/deplacements/valider/", {
        type_objet: item.type_objet,
        id: item.id,
      });
      toast.success(
        `✅ Déplacement ${item.type_objet === "ETAB" ? "de l'établissement" : "du village"} ${item.code || ""} validé`,
      );
      await loadDeplacements();
    } catch (error: any) {
      console.error("Erreur validation:", error);
      toast.error(`❌ Erreur : ${error.message || "Veuillez réessayer"}`);
    }
  };

  const handleRejeter = async (item: any) => {
    if (!sigConfig.permissions.rejeter) {
      toast.error("❌ Rejet non autorisé pour votre profil (ou module désactivé)");
      return;
    }

    if (
      !confirm(
        `Voulez-vous vraiment REJETER le déplacement de ${item.type_objet === "ETAB" ? "l'établissement" : "le village"} ${item.code || ""} ?`,
      )
    ) {
      return;
    }

    try {
      await djangoPostJSON("/sig/deplacements/rejeter/", {
        type_objet: item.type_objet,
        id: item.id,
      });
      toast.success(
        `⛔ Déplacement ${item.type_objet === "ETAB" ? "de l'établissement" : "du village"} ${item.code || ""} rejeté`,
      );
      await loadDeplacements();
    } catch (error: any) {
      console.error("Erreur rejet:", error);
      toast.error(`❌ Erreur : ${error.message || "Veuillez réessayer"}`);
    }
  };

  const handleSupprimer = async (item: any) => {
    // ADMIN / CISCO uniquement.
    if (!sigConfig.permissions.supprimer) {
      toast.error("❌ Suppression non autorisée pour votre profil");
      return;
    }

    if (
      !confirm(
        `⚠️ Voulez-vous vraiment SUPPRIMER définitivement le déplacement de ${item.type_objet === "ETAB" ? "l'établissement" : "le village"} ${item.code || ""} ?\n\nCette action est irréversible !`,
      )
    ) {
      return;
    }

    try {
      await djangoPostJSON("/sig/deplacements/supprimer/", {
        type_objet: item.type_objet,
        id: item.id,
      });
      toast.success(
        `🗑️ Déplacement ${item.type_objet === "ETAB" ? "de l'établissement" : "du village"} ${item.code || ""} supprimé`,
      );
      await loadDeplacements();
    } catch (error: any) {
      console.error("Erreur suppression:", error);
      toast.error(`❌ Erreur : ${error.message || "Veuillez réessayer"}`);
    }
  };

  const handleVerifier = (item: any) => {
    if (!sigConfig.permissions.verifier) {
      toast.error("Vérification non autorisée pour votre profil");
      return;
    }

    const map = mapRef.current;
    if (!map) return;

    // Notification avec détails
    const typeLabel = item.type_objet === "ETAB" ? "Établissement" : "Village";
    const message = `🔍 Vérification de ${typeLabel} ${item.code || ""}
  \n📍 Ancienne position : ${item.ancien_lat?.toFixed(6)}, ${item.ancien_lng?.toFixed(6)}
  \n📍 Nouvelle position : ${item.nouveau_lat?.toFixed(6)}, ${item.nouveau_lng?.toFixed(6)}
  ${item.is_duplicate ? "\n⚠️ Attention : Ce déplacement est marqué comme DOUBLON !" : ""}`;

    toast.info(message, { duration: 5000 });

    setShowDeplacementsModal(false);
    setVerifyMode(true);
    setVerifyItem(item);
    hideAllSigLayers();
    clearVerificationMarkers();

    const oldMarker = L.circleMarker([item.ancien_lat, item.ancien_lng], {
      radius: 10,
      color: "green",
      fillColor: "green",
      fillOpacity: 1,
      weight: 2,
    }).bindTooltip("Ancienne position", { permanent: true, direction: "top" });

    const newMarker = L.circleMarker([item.nouveau_lat, item.nouveau_lng], {
      radius: 10,
      color: "red",
      fillColor: "red",
      fillOpacity: 1,
      weight: 2,
    }).bindTooltip("Nouvelle position", { permanent: true, direction: "top" });

    verificationMarkersRef.current.addLayer(oldMarker);
    verificationMarkersRef.current.addLayer(newMarker);
    verificationMarkersRef.current.addTo(map);

    // Ajout d'une ligne de connexion entre les deux points
    const line = L.polyline(
      [
        [item.ancien_lat, item.ancien_lng],
        [item.nouveau_lat, item.nouveau_lng],
      ],
      {
        color: "orange",
        weight: 2,
        dashArray: "5, 5",
        opacity: 0.8,
      },
    ).bindTooltip("Déplacement", { permanent: true, direction: "center" });

    verificationMarkersRef.current.addLayer(line);

    map.fitBounds([
      [item.ancien_lat, item.ancien_lng],
      [item.nouveau_lat, item.nouveau_lng],
    ]);
  };

  const stopVerification = () => {
    setVerifyMode(false);
    setVerifyItem(null);
    clearVerificationMarkers();
    clearTemporaryMarkers();
    showAllSigLayers();
  };

  // ====================== DONNÉES GRAPHIQUES ======================
  const getElevesChartData = (school: any) => {
    if (!school) return [];
    return [
      { annee: "2022", effectif: parseInt(school.eff_2022) || 0 },
      { annee: "2023", effectif: parseInt(school.eff_2023) || 0 },
      { annee: "2024", effectif: parseInt(school.eff_2024) || 0 },
      { annee: "2025", effectif: parseInt(school.eff_2025) || 0 },
    ].filter((d) => d.effectif > 0);
  };

  const filteredEtabNonPointe = etabNonPointe.filter(
    (e) =>
      filterEtabName.length === 0 ||
      (e.NOM_ETAB && e.NOM_ETAB.toLowerCase().includes(filterEtabName.toLowerCase())),
  );

  // Calcul des valeurs uniques pour les filtres dans liste etab Non pointé
  const uniqueDrens = useMemo(() => {
    return [...new Set(etabNonPointe.map((e) => e.DREN).filter(Boolean))].sort();
  }, [etabNonPointe]);

  const uniqueCiscos = useMemo(() => {
    return [...new Set(etabNonPointe.map((e) => e.CISCO).filter(Boolean))].sort();
  }, [etabNonPointe]);

  const uniqueZaps = useMemo(() => {
    return [...new Set(etabNonPointe.map((e) => e.ZAP).filter(Boolean))].sort();
  }, [etabNonPointe]);

  const uniqueSecteurs = useMemo(() => {
    return [...new Set(etabNonPointe.map((e) => String(e.SECTEUR ?? "").trim()))]
      .filter((v) => v !== "")
      .sort();
  }, [etabNonPointe]);

  // Filtrage complet
  const reportEtabNonPointe = useMemo(() => {
    const search = etabNonPointeSearch.trim().toLowerCase();

    return etabNonPointe.filter((etab) => {
      const secteur = String(etab.SECTEUR ?? "").trim();
      const dren = String(etab.DREN ?? "").trim();
      const cisco = String(etab.CISCO ?? "").trim();
      const zap = String(etab.ZAP ?? "").trim();

      const matchesSearch =
        search === "" ||
        String(etab.NOM_ETAB ?? "")
          .toLowerCase()
          .includes(search) ||
        String(etab.CODE_ETAB ?? "").includes(search);

      const matchesDren = modalDrenFilter === "" || dren === modalDrenFilter;

      const matchesCisco = modalCiscoFilter === "" || cisco === modalCiscoFilter;

      const matchesSecteur =
        modalSecteurFilter === "all" || String(etab.SECTEUR ?? "").trim() === modalSecteurFilter;

      const matchesZap = modalZapFilter === "" || zap === modalZapFilter;

      return matchesSearch && matchesDren && matchesCisco && matchesSecteur && matchesZap;
    });
  }, [
    etabNonPointe,
    etabNonPointeSearch,
    modalDrenFilter,
    modalCiscoFilter,
    modalSecteurFilter,
    modalZapFilter,
  ]);

  const etabNonPointeUniqueCount = useMemo(
    () => countUniqueEstablishments(etabNonPointe),
    [etabNonPointe],
  );

  const exportEtabNonPointeCSV = () => {
    if (reportEtabNonPointe.length === 0) return;
    const headers = ["CODE_ETAB", "NOM_ETAB", "SECTEUR", "ZAP"];
    const rows = reportEtabNonPointe.map((e) =>
      [e.CODE_ETAB ?? "", e.NOM_ETAB ?? "", secteurLabel(e.SECTEUR).toUpperCase(), e.ZAP ?? ""]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(";"),
    );
    const csv = [headers.join(";"), ...rows].join("\n");
    const blob = new Blob(["\ufeff" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `etablissements_non_pointes_dren${selectedDren}_cisco${selectedCisco}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const teacherStats = useMemo(() => {
    if (!selectedSchool) return null;
    const niveaux = ["PRÉSCOLAIRE", "PRIMAIRE", "COLLÈGE", "LYCÉE"];
    return {
      niveau: niveaux[niveau] ?? "INCONNU",
      total: Number(selectedSchool.pers_total ?? 0),
      en_classe: Number(selectedSchool.en_classe ?? 0),
      fonctionnaire: Number(selectedSchool.fonctionnaire ?? 0),
      fram_sub: Number(selectedSchool.fram_sub ?? 0),
      fram_nonsub: Number(selectedSchool.fram_nonsub ?? 0),
      autres: Number(selectedSchool.autres ?? 0),
    };
  }, [selectedSchool, niveau]);

  const infraStats = (good: any, bad: any, totalOverride?: any) => {
    const bon = Number(good) || 0;
    const mauvais = Number(bad) || 0;
    return { total: Number(totalOverride ?? bon + mauvais), bon, mauvais };
  };

  const isPositive = (v: any) => Number(v || 0) > 0;

  const latest = useMemo(() => {
    if (!tablesBancs?.length) return null;
    return [...tablesBancs].sort((a, b) => b.ANNEE_SCOLAIRE - a.ANNEE_SCOLAIRE)[0];
  }, [tablesBancs]);

  const tbc = useMemo(() => {
    if (!latest) return { total: 0, bon: 0, mauvais: 0 };
    const bon = sumFields(latest, BE_FIELDS);
    const mauvais = sumFields(latest, ME_FIELDS);
    return { bon, mauvais, total: bon + mauvais };
  }, [latest]);

  const sdc = infraStats(selectedSchool?.sdc_be, selectedSchool?.sdc_me, selectedSchool?.sdc_total);
  const elec = isPositive(selectedSchool?.elec);
  const eau = isPositive(selectedSchool?.point_eau);
  const latrineG = isPositive(selectedSchool?.latrine_g || selectedSchool?.latrince_g);
  const latrineF = isPositive(selectedSchool?.latrine_f || selectedSchool?.latrince_f);
  const latrineC = isPositive(selectedSchool?.latrine);

  const geoVerificationRows = [
    ...(geoVerificationEntry?.establishments.hasData ? geoVerificationEntry.establishments.data : []),
    ...(geoVerificationEntry?.villages.hasData ? geoVerificationEntry.villages.data : []),
  ];
  const geoVerificationCounts = {
    nonGeolocalises: geoVerificationRows.filter((row) => geoAnomalyCategory(row.type_anomalie) === "NON_GEOLOCALISE").length,
    horsZone: geoVerificationRows.filter((row) => geoAnomalyCategory(row.type_anomalie) === "HORS_ZONE").length,
    zoneNonDefinie: geoVerificationRows.filter((row) => geoAnomalyCategory(row.type_anomalie) === "ZONE_NON_DEFINIE").length,
    doublons: geoVerificationRows.filter(geoRowIsDuplicate).length,
  };
  const selectedScopeGeoEntry = selectedDren > 0
    ? geoVerificationCache[`${selectedDren}::${selectedCisco}`]
    : undefined;
  const selectedScopeGeoCount = selectedScopeGeoEntry
    ? [
        ...(selectedScopeGeoEntry.establishments.hasData ? selectedScopeGeoEntry.establishments.data : []),
        ...(selectedScopeGeoEntry.villages.hasData ? selectedScopeGeoEntry.villages.data : []),
      ].length
    : 0;
  const hasGeoVerificationResults = Boolean(
    geoVerificationEntry?.establishments.hasData || geoVerificationEntry?.villages.hasData,
  );

  const geoVerificationStatus = (status: GeoVerificationStage) => {
    if (status === "running") return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    if (status === "done") return <Check className="h-4 w-4 text-emerald-600" />;
    if (status === "error") return <AlertTriangle className="h-4 w-4 text-destructive" />;
    return <span className="h-4 w-4 rounded-full border border-muted-foreground/40" />;
  };

  const renderGeoVerificationRows = (
    title: string,
    endpoint: GeoVerificationEndpoint,
    rows: GeoVerificationRow[],
  ) => {
    const endpointState = geoVerificationEntry?.[endpoint];
    return (
      <section key={`${endpoint}-${title}`} className="rounded-lg border bg-background">
        <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
          <h3 className="text-sm font-semibold">{title}</h3>
          <Badge variant="secondary">{rows.length}</Badge>
        </div>
        {rows.length > 0 ? (
          <div className="max-h-56 overflow-auto divide-y">
            {rows.map((row) => {
              const label = row.nom_etab || row.name || (row.code !== null && row.code !== undefined ? String(row.code) : `Entité ${row.id}`);
              return (
                <button
                  key={`${endpoint}-${row.id}`}
                  type="button"
                  onClick={() => locateGeoAnomaly(row)}
                  className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left hover:bg-muted/60"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      DREN {row.code_dren} · CISCO {row.code_cisco} · {row.type_anomalie || "Anomalie non précisée"}
                    </span>
                    {geoRowIsDuplicate(row) && (
                      <span className="mt-0.5 block text-xs text-amber-700">Doublons signalés : {row.nb_doublons ?? row.type_anomalie}</span>
                    )}
                  </span>
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                </button>
              );
            })}
          </div>
        ) : endpointState?.hasData ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">Aucune anomalie dans cette catégorie.</p>
        ) : endpointState?.error ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">Aucun résultat disponible pour cette catégorie.</p>
        ) : endpointState?.loading ? (
          <p className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Vérification en cours…</p>
        ) : (
          <p className="px-3 py-4 text-sm text-muted-foreground">Aucun résultat disponible.</p>
        )}
      </section>
    );
  };

  // ====================== DOWNLOAD HELPERS ======================
  const collectActiveMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return { etabs: [], villages: [], total: 0, uniqueEtabCount: 0 };

    const etabs: any[] = [];
    const villages: any[] = [];

    Object.keys(etabLayersRef.current).forEach((key) => {
      const layerGroup = etabLayersRef.current[key];
      if (layerGroup && map.hasLayer(layerGroup)) {
        layerGroup.eachLayer((layer: any) => {
          const props = (layer?.options as any)?.properties;
          if (layer instanceof L.Marker && props) {
            etabs.push(props);
          }
        });
      }
    });

    if (villageLayerRef.current && map.hasLayer(villageLayerRef.current)) {
      villageLayerRef.current.eachLayer((layer: any) => {
        const props = (layer?.options as any)?.properties;
        if (layer instanceof L.Marker && props) {
          villages.push(props);
        }
      });
    }

    return {
      etabs,
      villages,
      total: etabs.length + villages.length,
      uniqueEtabCount: countUniqueEstablishments(etabs),
    };
  }, []);

  const downloadData = (format: "csv" | "excel" | "json" | "geojson") => {
    const { etabs, villages, total } = collectActiveMarkers();

    if (total === 0) {
      toast.error("Aucun marqueur actif à exporter");
      return;
    }

    const data: any[] = [];

    etabs.forEach((etab) => {
      data.push({
        TYPE: "ETABLISSEMENT",
        DREN: etab.DREN || "",
        CODE_DREN: selectedDren,
        CISCO: etab.CISCO || "",
        CODE_CISCO: selectedCisco,
        COMMUNE: etab.COMMUNE || "",
        ZAP: etab.ZAP || "",
        FOKONTANY: etab.FOKONTANY || "",
        CODE_ETAB: etab.CODE_ETAB,
        NOM_ETAB: etab.NOM_ETAB,
        SECTEUR: etab.SECTEUR === 0 ? "PUBLIC" : "PRIVÉ",
        LATITUDE: parseFloat(etab.latitude || 0).toFixed(6),
        LONGITUDE: parseFloat(etab.longitude || 0).toFixed(6),
        NIVEAU: NIVEAU_CONFIG[`n${etab.NIVEAU || 1}`]?.label || "",
      });
    });

    villages.forEach((v) => {
      data.push({
        TYPE: "VILLAGE",
        DREN: "",
        CODE_DREN: selectedDren,
        CISCO: "",
        CODE_CISCO: selectedCisco,
        COMMUNE: "",
        ZAP: "",
        FOKONTANY: v.fokontany || "",
        NOM_VILLAGE: v.name,
        POPULATION: v.population || "",
        LATITUDE: parseFloat(v.latitude || 0).toFixed(6),
        LONGITUDE: parseFloat(v.longitude || 0).toFixed(6),
      });
    });

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const baseName = `SIG_${selectedDren || "national"}_${timestamp}`;

    if (format === "csv" || format === "excel") {
      const headers = Object.keys(data[0] || {});
      let csvContent =
        headers.join(",") +
        "\n" +
        data
          .map((row) =>
            headers.map((h) => `"${String(row[h] || "").replace(/"/g, '""')}"`).join(","),
          )
          .join("\n");

      const extension = format === "excel" ? "xlsx" : "csv";
      downloadFile(csvContent, `${baseName}.${extension}`, "text/csv");

      toast.success(`${total} enregistrements exportés (${format.toUpperCase()})`);
    } else if (format === "json") {
      downloadFile(JSON.stringify(data, null, 2), `${baseName}.json`, "application/json");
    } else if (format === "geojson") {
      const features = data.map((item) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [parseFloat(item.LONGITUDE), parseFloat(item.LATITUDE)],
        },
        properties: { ...item },
      }));

      const geojson = {
        type: "FeatureCollection",
        features,
        name: "SIG Markers",
        crs: {
          type: "name",
          properties: { name: "urn:ogc:def:crs:EPSG::4326" },
        },
      };

      downloadFile(JSON.stringify(geojson, null, 2), `${baseName}.geojson`, "application/geo+json");
    }

    setShowDownloadModal(false);
  };

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAllFormats = async () => {
    const { etabs, villages, total } = collectActiveMarkers();

    if (total === 0) {
      toast.error("Aucun marqueur actif à exporter");
      return;
    }

    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const baseName = `SIG_${selectedDren || "national"}_${timestamp}`;

      const data: any[] = [];

      etabs.forEach((etab) => {
        data.push({
          TYPE: "ETABLISSEMENT",
          DREN: etab.DREN || "",
          CODE_DREN: selectedDren,
          CISCO: etab.CISCO || "",
          CODE_CISCO: selectedCisco,
          COMMUNE: etab.COMMUNE || "",
          ZAP: etab.ZAP || "",
          FOKONTANY: etab.FOKONTANY || "",
          CODE_ETAB: etab.CODE_ETAB,
          NOM_ETAB: etab.NOM_ETAB,
          SECTEUR: etab.SECTEUR === 0 ? "PUBLIC" : "PRIVÉ",
          LATITUDE: parseFloat(etab.latitude || 0).toFixed(6),
          LONGITUDE: parseFloat(etab.longitude || 0).toFixed(6),
          NIVEAU: NIVEAU_CONFIG[`n${etab.NIVEAU || 1}`]?.label || "",
        });
      });

      villages.forEach((v) => {
        data.push({
          TYPE: "VILLAGE",
          DREN: "",
          CODE_DREN: selectedDren,
          CISCO: "",
          CODE_CISCO: selectedCisco,
          COMMUNE: "",
          ZAP: "",
          FOKONTANY: v.fokontany || "",
          NOM_VILLAGE: v.name,
          POPULATION: v.population || "",
          LATITUDE: parseFloat(v.latitude || 0).toFixed(6),
          LONGITUDE: parseFloat(v.longitude || 0).toFixed(6),
        });
      });

      const headers = Object.keys(data[0] || {});
      const csvContent =
        headers.join(",") +
        "\n" +
        data
          .map((row) =>
            headers.map((h) => `"${String(row[h] || "").replace(/"/g, '""')}"`).join(","),
          )
          .join("\n");
      zip.file(`${baseName}.csv`, csvContent);

      zip.file(`${baseName}.json`, JSON.stringify(data, null, 2));

      const features = data.map((item) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [parseFloat(item.LONGITUDE), parseFloat(item.LATITUDE)],
        },
        properties: { ...item },
      }));

      const geojson = {
        type: "FeatureCollection",
        features,
        name: "SIG Markers",
        crs: {
          type: "name",
          properties: { name: "urn:ogc:def:crs:EPSG::4326" },
        },
      };
      zip.file(`${baseName}.geojson`, JSON.stringify(geojson, null, 2));

      const blob = await zip.generateAsync({ type: "blob" });
      const { saveAs } = await import("file-saver");

      saveAs(blob, `SIG_Export_Complet_${timestamp}.zip`);

      toast.success(`Archive ZIP créée avec succès (${total} enregistrements)`);
      setShowDownloadModal(false);
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la création du ZIP");
    }
  };

  const captureMapAsPNG = async () => {
    const map = mapRef.current;
    if (!map) return;
    setCapturingMap(true);
    try {
      const date = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      await captureMapPng(map.getContainer(), `SIG_Carte_${date}.png`);
      toast.success("Capture de la carte enregistrée");
    } catch (error) {
      console.error("SIG map capture error:", error);
      toast.error("Impossible de capturer la carte. Vérifiez que les tuiles sont chargées, puis réessayez.");
    } finally {
      setCapturingMap(false);
    }
  };

  // ====================== RENDU ======================
  return (
    <div className="h-[calc(100vh-4rem)] w-full flex flex-col overflow-hidden bg-muted/20">
      {/* En-tête SIG — indépendant du conteneur Leaflet */}

<header className="z-30 shrink-0 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-sm">
  <div className="mx-auto max-w-none px-4 py-3">
    {/* Première ligne : identité du module */}
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 shrink-0">
        <img
          src={logoMen}
          alt="MEN"
          className="h-10 w-10 rounded-md object-contain ring-1 ring-border bg-white p-0.5"
        />
        <img
          src={logoDpe}
          alt="DPE"
          className="h-10 w-10 rounded-md object-contain ring-1 ring-border bg-white p-0.5"
        />
      </div>

      <div className="min-w-0 flex-1">
        <h1 className="text-base sm:text-lg font-bold leading-tight text-foreground">
          Système d'information géographique — SIG
        </h1>
        <p className="text-xs text-muted-foreground">
          Ministère de l'Éducation Nationale · Gestion et consultation des données géographiques
        </p>
      </div>
    </div>

    {/* Deuxième ligne : section et actions */}
    <div className="mt-2 flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-2">
      <div className="text-xs text-foreground">
        Mode : <strong>Consultation générale</strong>
      </div>

      <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[420px]">
        <div className="grid grid-cols-3 gap-2">
          {/* Pointage */}
          <button
            type="button"
            aria-label={`Pointage : ${canStartPointage ? "disponible" : "indisponible"}`}
            aria-pressed={activeHeaderAction === "POINTAGE"}
            disabled={
              !canStartPointage ||
              (activeHeaderAction !== null && activeHeaderAction !== "POINTAGE")
            }
            onClick={() => startHeaderAction("POINTAGE")}
            className={`flex min-w-0 items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-xs font-semibold transition-colors ${
              activeHeaderAction === "POINTAGE"
                ? "border-primary bg-primary text-primary-foreground"
                : canStartPointage
                  ? "border-primary/40 bg-primary/5 text-foreground hover:bg-primary/10"
                  : "border-border bg-muted/40 text-muted-foreground opacity-50 cursor-not-allowed"
            }`}
          >
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">Pointage</span>
            <Badge
              variant={activeHeaderAction === "POINTAGE" ? "secondary" : canStartPointage ? "default" : "secondary"}
              className="px-1.5 py-0 text-[10px]"
            >
              {activeHeaderAction === "POINTAGE" ? "En cours" : canStartPointage ? "Actif" : "Inactif"}
            </Badge>
          </button>

          {/* Déplacement */}
          <button
            type="button"
            aria-label={`Déplacement : ${canStartDeplacement ? "disponible" : "indisponible"}`}
            aria-pressed={activeHeaderAction === "DEPLACEMENT"}
            disabled={
              !canStartDeplacement ||
              (activeHeaderAction !== null && activeHeaderAction !== "DEPLACEMENT")
            }
            onClick={() => startHeaderAction("DEPLACEMENT")}
            className={`flex min-w-0 items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-xs font-semibold transition-colors ${
              activeHeaderAction === "DEPLACEMENT"
                ? "border-primary bg-primary text-primary-foreground"
                : canStartDeplacement
                  ? "border-primary/40 bg-primary/5 text-foreground hover:bg-primary/10"
                  : "border-border bg-muted/40 text-muted-foreground opacity-50 cursor-not-allowed"
            }`}
          >
            <Move className="h-4 w-4 shrink-0" />
            <span className="truncate">Déplacement</span>
            <Badge
              variant={activeHeaderAction === "DEPLACEMENT" ? "secondary" : canStartDeplacement ? "default" : "secondary"}
              className="px-1.5 py-0 text-[10px]"
            >
              {activeHeaderAction === "DEPLACEMENT" ? "En cours" : canStartDeplacement ? "Actif" : "Inactif"}
            </Badge>
          </button>

          {/* Validation */}
          <button
            type="button"
            aria-label={`Validation : ${canStartValidation ? "disponible" : "indisponible"}`}
            aria-pressed={activeHeaderAction === "VALIDATION"}
            disabled={
              !canStartValidation ||
              (activeHeaderAction !== null && activeHeaderAction !== "VALIDATION")
            }
            onClick={openValidationAction}
            className={`flex min-w-0 items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-xs font-semibold transition-colors ${
              activeHeaderAction === "VALIDATION"
                ? "border-primary bg-primary text-primary-foreground"
                : canStartValidation
                  ? "border-primary/40 bg-primary/5 text-foreground hover:bg-primary/10"
                  : "border-border bg-muted/40 text-muted-foreground opacity-50 cursor-not-allowed"
            }`}
          >
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span className="truncate">Validation</span>
            <Badge
              variant={activeHeaderAction === "VALIDATION" ? "secondary" : canStartValidation ? "default" : "secondary"}
              className="px-1.5 py-0 text-[10px]"
            >
              {activeHeaderAction === "VALIDATION" ? "En cours" : canStartValidation ? "Actif" : "Inactif"}
            </Badge>
          </button>
        </div>

        {/* Chronomètre et bouton de fin */}
        {activeHeaderAction !== null && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
            <div className="min-w-0 text-xs">
              <span className="font-semibold">
                {getHeaderActionLabel(activeHeaderAction)} en cours
              </span>
              <span className="ml-2 font-mono tabular-nums">
                {formatActionDuration(actionElapsedSeconds)}
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={finishHeaderAction}
            >
              Terminer
            </Button>
          </div>
        )}

        {/* Récapitulatif temporaire après Terminer */}
        {actionRecap !== null && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-md border bg-muted/40 px-3 py-2 text-xs"
          >
            <p className="font-semibold">
              Action terminée : {getHeaderActionLabel(actionRecap.action)}
            </p>
            <p>Utilisateur : {actionRecap.username}</p>
            <p>Démarrage : {new Date(actionRecap.startedAt).toLocaleString("fr-FR")}</p>
            <p>Durée : {formatActionDuration(actionRecap.durationSeconds)}</p>
          </div>
        )}
      </div>
    </div>
  </div>
</header>


      {/* Espace de travail : panneaux et carte restent hors de l'en-tête */}
      <div className="relative flex min-h-0 w-full flex-1 overflow-hidden bg-muted/20">
      {accessDenied && (
        <div className="absolute inset-0 z-[5000] bg-background/95 flex items-center justify-center">
          <div className="text-center max-w-md p-6">
            <Lock className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-semibold">Accès SIG refusé</p>
            <p className="text-sm text-muted-foreground mt-1">
              Votre compte n'est rattaché à aucun profil SIG valide. Contactez un administrateur.
              Contactez un administrateur.
            </p>
          </div>
        </div>
      )}
      {/* Panneau gauche — filtres, recherche et récapitulatif */}
      <div
        className={`sig-side-panel sig-side-panel-left shrink-0 h-full bg-background/80 backdrop-blur-xl border-r shadow-xl flex flex-col overflow-hidden transition-[width,flex-basis] duration-300 ease-in-out motion-reduce:transition-none ${sidebarOpen ? "sig-side-panel-open" : "sig-side-panel-closed"}`}
      >
        <div className={`sig-side-panel-content sig-side-panel-content-left h-full flex flex-col overflow-y-auto overflow-x-hidden overscroll-contain transition-transform duration-300 ease-in-out motion-reduce:transition-none ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          {/* Bouton Filtres */}
          <div className="px-4 py-3 border-b bg-background/60 backdrop-blur-md flex flex-col gap-3">
            <Button
              onClick={() => setShowFilters(true)}
              disabled={sigActionLocked}
              className="w-full h-10 justify-center shadow-md bg-primary"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filtres Zone Géographique
            </Button>

            {/* Consultation des déplacements en attente pour tous les profils autorisés */}
            {user && sigConfig.permissions.verifier && (
              <Button
                size="sm"
                variant="outline"
                onClick={openValidationAction}
                disabled={sigActionLocked}
                className="w-full h-10 shadow-md"
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <div className="flex items-center gap-2">
                    <Table className="h-4 w-4 flex-shrink-0" />
                    <span>Liste des déplacements</span>
                  </div>
                  {sigRole !== "ADMIN" && (
                    <Badge variant="outline" className="text-[9px] px-1.5">
                      {sigRole === "CISCO" && selectedCisco > 0
                        ? `CISCO ${selectedCisco}`
                        : sigRole === "DREN" && selectedDren > 0
                          ? `DREN ${selectedDren}`
                          : sigRole}
                    </Badge>
                  )}
                </div>
              </Button>
            )}

            {/* Bouton Liste Etab Non Pointé */}
            {sigRole !== "UNKNOWN" && (
              <Button
                variant="outline"
                disabled={sigActionLocked}
                onClick={() => {
                  if (!selectedDren) {
                    toast.error("Veuillez sélectionner un DREN");
                    return;
                  }
                  setEtabNonPointeSearch("");
                  setShowEtabNonPointeModal(true);
                }}
                className="w-full h-10 shadow-md"
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <div className="flex items-center gap-2">
                    <Table className="h-4 w-4 flex-shrink-0" />
                    <span>Liste Etab non pointés</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant="destructive"
                      className="h-5 min-w-5 px-1.5 flex items-center justify-center text-[10px]"
                    >
                      {etabNonPointeUniqueCount}
                    </Badge>
                  </div>
                </div>
              </Button>
            )}

            {isAuthenticated && !isLoading && sigRole !== "UNKNOWN" && (
              <Button
                variant="outline"
                onClick={openGeoVerification}
                disabled={sigActionLocked || selectedDren <= 0 || (sigRole === "CISCO" && selectedCisco <= 0)}
                className="w-full h-10 shadow-md"
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 flex-shrink-0 text-primary" />
                    <span>Vérification géographique</span>
                  </span>
                  {selectedScopeGeoEntry && (
                    <Badge variant={selectedScopeGeoCount > 0 ? "destructive" : "secondary"} className="min-w-5 justify-center px-1.5 text-[10px]">
                      {selectedScopeGeoCount}
                    </Badge>
                  )}
                </div>
              </Button>
            )}

            {/* Récapitulatif */}
            {selectedDren > 0 && stats.total > 0 && (
              <div className="bg-background/70 backdrop-blur-xl border rounded-2xl shadow-lg overflow-hidden">
                <div
                  className={`flex items-center justify-between px-4 py-3 border-b transition-colors ${sigActionLocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-muted/50"}`}
                  onClick={() => {
                    if (!sigActionLocked) setShowRecap(!showRecap);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 flex-shrink-0" />
                    <span className="font-semibold text-sm">Récapitulatif</span>
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={sigActionLocked}>
                    {showRecap ? "−" : "+"}
                  </Button>
                </div>

                {showRecap && (
                  <div className="p-4 text-xs space-y-3">
                    {" "}
                    {/* Zone sélectionnée */}
                    <div className="flex justify-between text-muted-foreground">
                      <span>Zone</span>
                      <strong className="text-foreground text-right">
                        {drens.find((d) => d.CODE_DREN === selectedDren)?.DREN ||
                          `DREN ${selectedDren}`}

                        {selectedCisco > 0 && ciscos.length > 0 && (
                          <>
                            {" "}
                            —{" "}
                            {ciscos.find((c) => c.CODE_CISCO === selectedCisco)?.CISCO ||
                              `CISCO ${selectedCisco}`}
                          </>
                        )}
                      </strong>
                    </div>
                    <hr className="my-2" />
                    {/* Établissements */}
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">Établissements</span>
                      <Badge variant="secondary" className="tabular-nums">
                        {stats.etablissements}
                      </Badge>
                    </div>
                    {/* Public */}
                    <div className="pl-2 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Public</span>
                        <span className="font-medium text-blue-700 tabular-nums">
                          {stats.public?.total || 0}
                        </span>
                      </div>

                      <div className="pl-3 space-y-0.5 text-[10px] text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Préscolaire</span>
                          <span className="tabular-nums">{stats.public?.prescolaire || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Primaire</span>
                          <span className="tabular-nums">{stats.public?.primaire || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Collège</span>
                          <span className="tabular-nums">{stats.public?.college || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Lycée</span>
                          <span className="tabular-nums">{stats.public?.lycee || 0}</span>
                        </div>
                      </div>
                    </div>
                    {/* Privé */}
                    <div className="pl-2 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Privé</span>
                        <span className="font-medium text-amber-700 tabular-nums">
                          {stats.private?.total || 0}
                        </span>
                      </div>

                      <div className="pl-3 space-y-0.5 text-[10px] text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Préscolaire</span>
                          <span className="tabular-nums">{stats.private?.prescolaire || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Primaire</span>
                          <span className="tabular-nums">{stats.private?.primaire || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Collège</span>
                          <span className="tabular-nums">{stats.private?.college || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Lycée</span>
                          <span className="tabular-nums">{stats.private?.lycee || 0}</span>
                        </div>
                      </div>
                    </div>
                    {/* Villages */}
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="font-semibold">Villages</span>
                      <Badge
                        variant="outline"
                        className="bg-emerald-50 text-emerald-700 tabular-nums"
                      >
                        {stats.villages || 0}
                      </Badge>
                    </div>
                    {/* Ratio Établissements non pointés / pointés */}
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="font-semibold">Établissements non pointés</span>
                      <span className="tabular-nums">
                        {etabNonPointeUniqueCount} / {stats.etablissements}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Zone Recherche */}
          <div className="px-4 py-4 space-y-3 border-t bg-background/40">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="écoles ou villages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={sigActionLocked}
                className="pl-10 h-11 bg-background/80 backdrop-blur border shadow-sm rounded-xl"
              />
            </div>
            {searchResults.length > 0 && (
              <div className="mt-1 bg-background border rounded-lg shadow-xl max-h-60 overflow-y-auto">
                {searchResults.map((item, i) => (
                  <button
                    key={`sr-${item.id}-${i}`}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 border-b last:border-b-0 flex items-center gap-2"
                    onClick={() => handleSearchSelect(item)}
                    disabled={sigActionLocked}
                  >
                    <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bouton pour développer / réduire le panneau latéral.*/}
      <button
        type="button"
        onClick={() => {
          const narrow = window.matchMedia("(max-width: 767px)").matches;
          if (narrow && !sidebarOpen) setRightSidebarOpen(false);
          setSidebarOpen((v) => !v);
        }}
        title={sidebarOpen ? "Réduire le panneau" : "Développer le panneau"}
        className="absolute top-1/2 -translate-y-1/2 -ml-4 z-[1500] bg-background border shadow-xl rounded-full w-9 h-9 flex items-center justify-center hover:bg-muted transition-[left] duration-300 ease-in-out motion-reduce:transition-none"
        style={{ left: sidebarOpen ? "var(--sig-left-panel-open-width)" : "0px" }}
      >
        {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {/* Zone MAP */}
      <div className="relative flex-1 min-w-0 overflow-hidden">
        {/* Outils d'administration des données : ADMIN uniquement */}
        {sigRole === "ADMIN" && (
          <div className="absolute top-3 left-3 z-[1000] bg-background/90 backdrop-blur rounded-md shadow-lg px-1.5 py-0.5">
            <DataActionsBar table="sig_etablissement" tableLabel="SIG Établissement" compact />
          </div>
        )}

        {/* Bouton Déplacer - Positionné comme contrôle Leaflet */}
        {user && sigConfig.modules.deplacement && activeHeaderAction === "DEPLACEMENT" && (
          <div className="absolute top-[15px] left-14 z-[999]">
            <div className="leaflet-bar leaflet-control bg-background/95 backdrop-blur border border-border shadow-md rounded-md overflow-hidden">
              <label
                htmlFor="check-move"
                className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium cursor-pointer hover:bg-muted transition-colors select-none"
                title={`Activer le mode déplacement (zoom ≥ ${MOVE_MIN_ZOOM} requis)`}
              >
                <input
                  id="check-move"
                  type="checkbox"
                  className="w-4 h-4 accent-orange-600 cursor-pointer"
                  checked={sigMoveEnabled}
                  onChange={(e) => {
                    const zoom = mapRef.current?.getZoom() || 0;
                    if (e.target.checked && zoom < MOVE_MIN_ZOOM) {
                      toast.warning(
                        `Le mode déplacement nécessite un zoom minimum de ${MOVE_MIN_ZOOM} pour plus de précision.`,
                      );
                      return;
                    }
                    setSigMoveEnabled(e.target.checked);
                  }}
                />
                <span className="flex items-center gap-1.5">
                  <i className="fas fa-arrows-alt text-orange-600"></i>
                  Déplacer
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Bouton pour arrêter le mode vérification coord etab ancien et nouveau*/}
        {verifyMode && (
          <Button className="absolute top-3 right-4 z-[2000]" onClick={stopVerification}>
            Quitter la vérification
          </Button>
        )}

        {/* Modal liste de déplacement */}
        {showDeplacementsModal && (
          <div className="fixed inset-0 z-[2000] bg-black/40 flex items-center justify-center">
            <div className="bg-white w-[95%] max-w-7xl rounded-lg shadow-xl p-4 max-h-[92vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  Liste des déplacements
                  {deplacements.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {deplacements.length} en attente
                    </Badge>
                  )}
                </h2>
                <Button variant="outline" size="sm" onClick={() => setShowDeplacementsModal(false)}>
                  Fermer
                </Button>
              </div>

              {deplacements.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-lg">Aucun déplacement en attente</p>
                  <p className="text-sm mt-2">
                    Pour la zone sélectionnée :{" "}
                    <strong>
                      {selectedDren
                        ? drens.find((d) => d.CODE_DREN === selectedDren)?.DREN ||
                          `DREN ${selectedDren}`
                        : "Aucune DREN sélectionnée"}
                      {selectedCisco > 0 && ciscos.length > 0 && (
                        <>
                          {" "}
                          —{" "}
                          {ciscos.find((c) => c.CODE_CISCO === selectedCisco)?.CISCO ||
                            `CISCO ${selectedCisco}`}
                        </>
                      )}
                    </strong>
                  </p>
                </div>
              ) : (
                <div className="overflow-auto flex-1">
                  <table className="w-full text-sm border">
                    <thead className="sticky top-0 bg-gray-100 z-10">
                      <tr>
                        <th className="p-3 border">Code</th>
                        <th className="p-3 border">Type</th>
                        <th className="p-3 border">Demandé par</th>
                        <th className="p-3 border">Ancienne Position</th>
                        <th className="p-3 border">Nouvelle Position</th>
                        <th className="p-3 border">Date</th>
                        <th className="p-3 border text-center">Doublons</th>
                        <th className="p-3 border text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deplacements.map((item) => {
                        const typeLabel =
                          item.type_objet === "ETAB"
                            ? "Établissement"
                            : item.type_objet === "VILLAGE"
                              ? "Village"
                              : item.type_objet;

                        return (
                          <tr
                            key={`dep-${item.type_objet}-${item.id}`}
                            className="border-t hover:bg-gray-50"
                          >
                            <td className="p-3 border font-medium">{item.code}</td>
                            <td className="p-3 border">
                              <Badge variant="outline">{typeLabel}</Badge>
                            </td>
                            <td className="p-3 border">{item.demande_par || "-"}</td>
                            <td className="p-3 border text-xs font-mono text-muted-foreground">
                              {item.ancien_lat?.toFixed(6)}, {item.ancien_lng?.toFixed(6)}
                            </td>
                            <td className="p-3 border text-xs font-mono text-blue-600">
                              {item.nouveau_lat?.toFixed(6)}, {item.nouveau_lng?.toFixed(6)}
                            </td>
                            <td className="p-3 border text-xs text-muted-foreground">
                              {item.date_demande
                                ? new Date(item.date_demande).toLocaleString("fr-FR")
                                : "-"}
                            </td>
                            <td className="p-3 border text-center">
                              {item.is_duplicate ? (
                                <Badge variant="destructive">Doublon</Badge>
                              ) : (
                                <span className="text-emerald-600">✓ Unique</span>
                              )}
                            </td>
                            <td className="p-3 border">
                              <div className="flex gap-2 flex-wrap justify-center">
                                {sigConfig.modules.validationDeplacement && (
                                  <>
                                    {/* Vérifier - disponible pour tout le monde */}
                                    {sigConfig.permissions.verifier && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleVerifier(item)}
                                        className="hover:bg-blue-50"
                                        title="Vérifier le déplacement sur la carte"
                                      >
                                        <Search className="h-3 w-3 mr-1" />
                                        Vérifier
                                      </Button>
                                    )}

                                    {/* Valider - UNIQUEMENT pour les SuperUsers */}
                                    {sigConfig.permissions.valider && (
                                      <Button
                                        size="sm"
                                        className="bg-green-600 hover:bg-green-700 text-white"
                                        onClick={() => handleValider(item)}
                                        title="Valider ce déplacement"
                                      >
                                        <Check className="h-3 w-3 mr-1" />
                                        Valider
                                      </Button>
                                    )}

                                    {/* Rejeter - UNIQUEMENT pour les SuperUsers */}
                                    {sigConfig.permissions.rejeter && (
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => handleRejeter(item)}
                                        title="Rejeter ce déplacement"
                                      >
                                        <X className="h-3 w-3 mr-1" />
                                        Rejeter
                                      </Button>
                                    )}

                                    {/* Supprimer - disponible pour tout le monde (user et admin) */}
                                    {sigConfig.permissions.supprimer && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-red-600 hover:bg-red-50"
                                        onClick={() => handleSupprimer(item)}
                                        title="Supprimer définitivement"
                                      >
                                        <Trash className="h-3 w-3 mr-1" />
                                        Supprimer
                                      </Button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal liste de déplacement */}
        {showEtabNonPointeModal && (
          <div className="fixed inset-0 z-[2000] bg-black/40 flex items-center justify-center">
            <div className="bg-white w-[95%] max-w-6xl rounded-lg shadow-xl p-4 max-h-[92vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-destructive" />
                  Établissements non pointés
                  <Badge variant="secondary" className="ml-1">
                    {etabNonPointeUniqueCount}
                  </Badge>
                </h2>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={exportEtabNonPointeCSV}
                    disabled={reportEtabNonPointe.length === 0}
                  >
                    <Download className="h-4 w-4 mr-1.5" />
                    Exporter CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEtabNonPointeModal(false)}
                  >
                    Fermer
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground mb-4">
                Zone filtrée :{" "}
                <strong>
                  {selectedDren
                    ? drens.find((d) => d.CODE_DREN === selectedDren)?.DREN ||
                      `DREN ${selectedDren}`
                    : "Aucune DREN sélectionnée"}
                  {selectedCisco > 0 && ciscos.length > 0 && (
                    <>
                      {" "}
                      —{" "}
                      {ciscos.find((c) => c.CODE_CISCO === selectedCisco)?.CISCO ||
                        `CISCO ${selectedCisco}`}
                    </>
                  )}
                </strong>
              </p>

              {/* Filtres */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-4 bg-muted/50 p-4 rounded-xl">
                {/* DREN */}
                <div>
                  <Label className="text-xs">DREN</Label>
                  <Select value={modalDrenFilter} onValueChange={setModalDrenFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Toutes les DREN" />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueDrens.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* CISCO */}
                <div>
                  <Label className="text-xs">CISCO</Label>
                  <Select value={modalCiscoFilter} onValueChange={setModalCiscoFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Toutes les CISCO" />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueCiscos.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* ZAP */}
                <div>
                  <Label className="text-xs">ZAP</Label>
                  <Select value={modalZapFilter} onValueChange={setModalZapFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Tous les ZAP" />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueZaps.map((zap) => (
                        <SelectItem key={zap} value={zap}>
                          {zap}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* SECTEUR */}
                <div>
                  <Label className="text-xs">Secteur</Label>
                  <Select value={modalSecteurFilter} onValueChange={setModalSecteurFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Secteur" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>

                      {uniqueSecteurs.map((secteur) => (
                        <SelectItem key={secteur} value={secteur}>
                          {secteur === "0"
                            ? "Public"
                            : secteur === "1"
                              ? "Privé"
                              : `Secteur ${secteur}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Recherche</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Code ou nom..."
                      value={etabNonPointeSearch}
                      onChange={(e) => setEtabNonPointeSearch(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                </div>
              </div>

              {/* Tableau */}
              {reportEtabNonPointe.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground flex flex-col items-center">
                  <MapPin className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="text-lg">
                    {etabNonPointe.length === 0
                      ? "Aucun établissement non pointé dans cette zone"
                      : "Aucun résultat correspondant aux filtres"}
                  </p>
                </div>
              ) : (
                <div className="flex-1 overflow-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-100 z-10 shadow">
                      <tr>
                        <th className="p-3 text-left">Code</th>
                        <th className="p-3 text-left">Établissement</th>
                        <th className="p-3 text-left">DREN</th>
                        <th className="p-3 text-left">CISCO</th>
                        <th className="p-3 text-left">ZAP</th>
                        <th className="p-3 text-left">Secteur</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportEtabNonPointe.map((etab, i) => (
                        <tr
                          key={`nonpointe-${etab.CODE_ETAB}-${i}`}
                          className="border-t hover:bg-gray-50 transition-colors"
                        >
                          <td className="p-3 font-mono font-medium">{etab.CODE_ETAB}</td>
                          <td className="p-3 font-medium">{etab.NOM_ETAB}</td>
                          <td className="p-3 text-muted-foreground">{etab.DREN}</td>
                          <td className="p-3 text-muted-foreground">{etab.CISCO}</td>
                          <td className="p-3">{etab.ZAP}</td>
                          <td className="p-3">
                            {etab.SECTEUR === 1 ? (
                              <Badge variant="outline" className="text-amber-700">
                                Privé
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-blue-700">
                                Public
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="text-xs text-center text-muted-foreground mt-3">
                {reportEtabNonPointe.length} ligne(s) affichée(s) sur {etabNonPointe.length}
              </p>
            </div>
          </div>
        )}

        <Dialog open={geoVerificationOpen} onOpenChange={setGeoVerificationOpen}>
          <DialogContent className="max-h-[92vh] w-[96vw] max-w-6xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Vérification géographique
              </DialogTitle>
              <DialogDescription>
                {geoVerificationContext ? (
                  <>
                    Périmètre : <strong>{drens.find((dren) => dren.CODE_DREN === geoVerificationContext.dren)?.DREN || `DREN ${geoVerificationContext.dren}`}</strong>
                    {" · "}
                    <strong>{geoVerificationContext.cisco > 0
                      ? ciscos.find((cisco) => cisco.CODE_CISCO === geoVerificationContext.cisco)?.CISCO || `CISCO ${geoVerificationContext.cisco}`
                      : "Toutes les CISCO de la DREN"}</strong>
                  </>
                ) : "Sélectionnez une DREN pour lancer la vérification."}
              </DialogDescription>
            </DialogHeader>

            {geoVerificationEntry && (
              <div className="space-y-5 py-2">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-4">
                  <div className="space-y-2">
                    {([
                      ["Initialisation", geoVerificationEntry.initialization],
                      ["Vérification des établissements", geoVerificationEntry.establishments.status],
                      ["Vérification des villages", geoVerificationEntry.villages.status],
                      ["Consolidation des résultats", geoVerificationEntry.consolidation],
                    ] as [string, GeoVerificationStage][]).map(([label, status], index) => (
                      <div key={label} className="flex items-center gap-2 text-sm">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-background text-[10px] text-muted-foreground">{index + 1}</span>
                        {geoVerificationStatus(status)}
                        <span className={status === "running" ? "font-medium text-foreground" : "text-muted-foreground"}>{label}</span>
                        <span className="text-xs text-muted-foreground">
                          {status === "pending" ? "En attente" : status === "running" ? "En cours" : status === "done" ? "Terminée" : "En erreur"}
                        </span>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => retryGeoVerification()}
                    disabled={geoVerificationEntry.establishments.loading || geoVerificationEntry.villages.loading}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Relancer la vérification
                  </Button>
                </div>

                {(geoVerificationEntry.establishments.error || geoVerificationEntry.villages.error) && (
                  <div className="grid gap-2 md:grid-cols-2">
                    {geoVerificationEntry.establishments.error && (
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                        <span><strong>Établissements :</strong> {geoVerificationEntry.establishments.error}</span>
                        <Button size="sm" variant="outline" onClick={() => retryGeoVerification("establishments")} disabled={geoVerificationEntry.establishments.loading}>
                          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Réessayer
                        </Button>
                      </div>
                    )}
                    {geoVerificationEntry.villages.error && (
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                        <span><strong>Villages :</strong> {geoVerificationEntry.villages.error}</span>
                        <Button size="sm" variant="outline" onClick={() => retryGeoVerification("villages")} disabled={geoVerificationEntry.villages.loading}>
                          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Réessayer
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {hasGeoVerificationResults && (
                  <>
                    {(geoVerificationEntry.establishments.loading || geoVerificationEntry.villages.loading) && (
                      <p className="text-xs text-muted-foreground">
                        Actualisation en cours; les résultats précédemment reçus restent affichés.
                      </p>
                    )}
                    {(geoVerificationEntry.establishments.error || geoVerificationEntry.villages.error) && (
                      <p className="text-xs text-amber-700">
                        Résultats partiels : les compteurs incluent les endpoints ayant fourni des données.
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                      {([
                        ["Non géolocalisés", geoVerificationCounts.nonGeolocalises],
                        ["Hors zone", geoVerificationCounts.horsZone],
                        ["Zone non définie", geoVerificationCounts.zoneNonDefinie],
                        ["Doublons signalés", geoVerificationCounts.doublons],
                      ] as [string, number][]).map(([label, count]) => (
                        <Card key={label} className="shadow-sm">
                          <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">{label}</p>
                            <p className="mt-1 text-2xl font-semibold tabular-nums">{count}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                      {(["establishments", "villages"] as GeoVerificationEndpoint[]).map((endpoint) => {
                        const rows = geoVerificationEntry[endpoint].data;
                        const categorized = (category: string) => rows.filter((row) => geoAnomalyCategory(row.type_anomalie) === category);
                        const noun = endpoint === "establishments" ? "Établissements" : "Villages";
                        return (
                          <div key={endpoint} className="space-y-3">
                            <h2 className="text-base font-semibold">{noun}</h2>
                            {renderGeoVerificationRows(`${noun} non géolocalisés`, endpoint, categorized("NON_GEOLOCALISE"))}
                            {renderGeoVerificationRows(`${noun} hors zone`, endpoint, categorized("HORS_ZONE"))}
                            {renderGeoVerificationRows(`${noun} — zone non définie`, endpoint, categorized("ZONE_NON_DEFINIE"))}
                            {renderGeoVerificationRows(`${noun} — doublons signalés`, endpoint, rows.filter(geoRowIsDuplicate))}
                            {renderGeoVerificationRows(`${noun} — autres anomalies retournées`, endpoint, categorized("AUTRE"))}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setGeoVerificationOpen(false)}>Fermer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showDownloadModal} onOpenChange={setShowDownloadModal}>
          <DialogContent className="sm:max-w-xl z-[10000]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <Download className="h-5 w-5" />
                Exporter les données SIG
              </DialogTitle>
              <DialogDescription>
                Choisissez le format d'export ou téléchargez tout en une fois.
              </DialogDescription>
            </DialogHeader>

            <div className="py-6 space-y-6">
              <div className="bg-muted/50 rounded-xl p-5 text-sm">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-semibold text-primary">
                      {collectActiveMarkers().uniqueEtabCount}
                    </div>
                    <div className="text-xs text-muted-foreground">Codes établissements uniques</div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold text-primary">
                      {collectActiveMarkers().etabs.length}
                    </div>
                    <div className="text-xs text-muted-foreground">Lignes établissement</div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold text-primary">
                      {collectActiveMarkers().villages.length}
                    </div>
                    <div className="text-xs text-muted-foreground">Villages</div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold text-primary">
                      {collectActiveMarkers().total}
                    </div>
                    <div className="text-xs text-muted-foreground">Total</div>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-3">
                  FORMATS INDIVIDUELS
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => downloadData("csv")}
                    variant="outline"
                    className="h-20 justify-start"
                  >
                    <Download className="mr-3 h-5 w-5" />
                    <div className="text-left">
                      <div>CSV</div>
                      <div className="text-xs text-muted-foreground">Tableur</div>
                    </div>
                  </Button>
                  <Button
                    onClick={() => downloadData("excel")}
                    variant="outline"
                    className="h-20 justify-start"
                  >
                    <Download className="mr-3 h-5 w-5" />
                    <div className="text-left">
                      <div>Excel</div>
                      <div className="text-xs text-muted-foreground">.xlsx</div>
                    </div>
                  </Button>
                  <Button
                    onClick={() => downloadData("json")}
                    variant="outline"
                    className="h-20 justify-start"
                  >
                    <Download className="mr-3 h-5 w-5" />
                    <div className="text-left">
                      <div>JSON</div>
                      <div className="text-xs text-muted-foreground">Données brutes</div>
                    </div>
                  </Button>
                  <Button
                    onClick={() => downloadData("geojson")}
                    variant="outline"
                    className="h-20 justify-start"
                  >
                    <Download className="mr-3 h-5 w-5" />
                    <div className="text-left">
                      <div>GeoJSON</div>
                      <div className="text-xs text-muted-foreground">Format cartographique</div>
                    </div>
                  </Button>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-3">ACTIONS GROUPÉES</p>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={downloadAllFormats}
                    variant="default"
                    className="h-20 flex-col gap-1"
                  >
                    <Archive className="h-6 w-6" />
                    Tout télécharger (ZIP)
                  </Button>
                  <Button
                    onClick={captureMapAsPNG}
                    variant="default"
                    className="h-20 flex-col gap-1"
                    disabled={capturingMap}
                  >
                    <FileImage className={`h-6 w-6 ${capturingMap ? "animate-pulse" : ""}`} />
                    {capturingMap ? "Préparation de l’image…" : "Capturer la carte (PNG)"}
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDownloadModal(false)}>
                Fermer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {loading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-[1001] flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Chargement des données SIG...</p>
            </div>
          </div>
        )}

        {contextMenu && (
          <div
            className="absolute z-[2000] bg-white rounded-lg shadow-xl border py-1 min-w-[220px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {sigConfig.modules.pointage &&
              activeHeaderAction === "POINTAGE" &&
              pointageType !== null && (
                <>
                  <button
                    className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 flex items-center gap-2"
                    onClick={() => {
                      if (zoomLevel < MOVE_MIN_ZOOM) {
                        toast.warning(
                          `Le niveau de zoom est trop bas. Le zoom minimum autorisé est de ${MOVE_MIN_ZOOM}.`,
                        );
                        setContextMenu(null);
                        return;
                      }

                      setContextMenu(null);
                      if (pointageType === "ETABLISSEMENT") {
                        setShowGeoEtab(true);
                        djangoGet(`/sig/etablissements-non-geolocalises/${selectedDren}/${selectedCisco}/`)
                          .then((data) => setEtabNonPointe(Array.isArray(data) ? data : []))
                          .catch(() => toast.error("Impossible de charger les établissements non géolocalisés"));
                      } else {
                        setShowGeoVillage(true);
                      }
                    }}
                  >
                    <MapPin className="w-4 h-4" />
                    {pointageType === "ETABLISSEMENT"
                      ? "Géolocaliser un établissement"
                      : "Géolocaliser un village"}
                  </button>
                  <hr className="my-1" />
                </>
              )}
            <button
              className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 flex items-center gap-2"
              onClick={() => {
                mapRef.current?.setZoom((mapRef.current?.getZoom() || 6) + 0.5);
                setContextMenu(null);
              }}
            >
              <ZoomIn className="w-4 h-4" /> Zoom +
            </button>
            <button
              className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 flex items-center gap-2"
              onClick={() => {
                mapRef.current?.zoomOut();
                setContextMenu(null);
              }}
            >
              <ZoomIn className="w-4 h-4 rotate-180" /> Zoom -
            </button>
            <button
              className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 flex items-center gap-2"
              onClick={() => {
                if (contextMenu) mapRef.current?.flyTo([contextMenu.lat, contextMenu.lng], 16);
                setContextMenu(null);
              }}
            >
              <MapPin className="w-4 h-4" /> Aller vers cet endroit
            </button>
          </div>
        )}

        <Dialog open={showFilters} onOpenChange={setShowFilters}>
          <DialogContent className="sm:max-w-lg z-[10000]">
            <DialogHeader>
              <DialogTitle>Paramètres</DialogTitle>
              <DialogDescription>
                Sélectionnez les filtres DREN et CISCO pour afficher les données SIG.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="font-semibold">DREN</Label>
                <Select
                  value={selectedDren === 0 ? "" : String(selectedDren)}
                  onValueChange={(value) => {
                    const dren = Number(value);
                    setSelectedDren(dren);
                    setSelectedCisco(0);
                  }}
                  disabled={sigActionLocked || drens.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une DREN" />
                  </SelectTrigger>
                  <SelectContent>
                    {drens.map((d) => (
                      <SelectItem key={d.CODE_DREN} value={d.CODE_DREN.toString()}>
                        {d.DREN}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">CISCO</Label>
                <Select
                  value={selectedCisco === 0 ? "" : String(selectedCisco)}
                  onValueChange={(value) => setSelectedCisco(Number(value))}
                  disabled={sigActionLocked || selectedDren === 0 || ciscos.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes les CISCO" />
                  </SelectTrigger>
                  <SelectContent>
                    {sigRole !== "CISCO" && <SelectItem value="0">Toutes les CISCO</SelectItem>}
                    {ciscos.map((c) => (
                      <SelectItem key={c.CODE_CISCO} value={c.CODE_CISCO.toString()}>
                        {c.CISCO}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {searchItems.length > 0 && (
                <div className="space-y-2">
                  <Label className="font-semibold">Recherche</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher écoles ou villages..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      disabled={sigActionLocked}
                      className="pl-10"
                    />
                  </div>
                  {searchResults.length > 0 && (
                    <div className="border rounded-lg max-h-48 overflow-y-auto">
                      {searchResults.map((item, i) => (
                        <button
                          key={`modal-sr-${item.id}-${i}`}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 border-b"
                          disabled={sigActionLocked}
                          onClick={() => {
                            handleSearchSelect(item);
                            setShowFilters(false);
                          }}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleApplyFilters} disabled={loading || sigActionLocked}>
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Filter className="w-4 h-4 mr-2" />
                )}
                Appliquer
              </Button>
              <Button variant="outline" onClick={() => setShowFilters(false)}>
                Fermer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div ref={mapContainerRef} className="h-full w-full" />

        <Dialog open={!!selectedSchool} onOpenChange={() => setSelectedSchool(null)}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto z-[10000]">
            <DialogHeader>
              <DialogTitle>Fiche école — {selectedSchool?.NOM_ETAB}</DialogTitle>
              <DialogDescription>
                Informations détaillées de l'établissement scolaire.
              </DialogDescription>
            </DialogHeader>
            {selectedSchool && (
              <div className="space-y-4">
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-sm uppercase mb-3 text-primary">
                      Informations générales
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <tbody>
                          <tr>
                            <td
                              rowSpan={8}
                              className="w-[200px] p-2 align-top border bg-gray-100 rounded"
                            >
                              <div className="w-full h-[150px] flex items-center justify-center bg-gray-100 rounded border border-dashed border-gray-300 overflow-hidden">
                                {selectedSchool.PHOTO_URL && !photoError ? (
                                  <img
                                    key={`${selectedSchool.CODE_ETAB}-${selectedSchool.PHOTO_URL}`}
                                    src={selectedSchool.PHOTO_URL}
                                    alt={`Photo de ${selectedSchool.NOM_ETAB || "l'établissement"}`}
                                    className="w-full h-full object-cover"
                                    onError={() => setPhotoError(true)}
                                  />
                                ) : (
                                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                    <span className="text-5xl mb-2">📷</span>
                                    <span className="text-sm font-medium">Photo indisponible</span>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="border p-2">
                              <strong>CODE ÉTABLISSEMENT :</strong> {selectedSchool.CODE_ETAB}
                            </td>
                          </tr>
                          <tr>
                            <td className="border p-2">
                              <strong>SECTEUR :</strong>{" "}
                              {secteurLabel(selectedSchool.SECTEUR).toUpperCase()}
                            </td>
                          </tr>
                          <tr>
                            <td className="border p-2">
                              <strong>DREN :</strong> {selectedSchool.DREN || "-"}
                            </td>
                          </tr>
                          <tr>
                            <td className="border p-2">
                              <strong>CISCO :</strong> {selectedSchool.CISCO || "-"}
                            </td>
                          </tr>
                          <tr>
                            <td className="border p-2">
                              <strong>COMMUNE :</strong> {selectedSchool.COMMUNE || "-"}
                            </td>
                          </tr>
                          <tr>
                            <td className="border p-2">
                              <strong>ZAP :</strong> {selectedSchool.ZAP || "-"}
                            </td>
                          </tr>
                          <tr>
                            <td className="border p-2">
                              <strong>FOKONTANY :</strong> {selectedSchool.FOKONTANY || "-"}
                            </td>
                          </tr>
                          <tr>
                            <td className="border p-2">
                              <strong>COORDONNÉES GÉO :</strong>{" "}
                              <span className="font-mono text-blue-600">
                                {parseFloat(selectedSchool.latitude || 0).toFixed(6)},{" "}
                                {parseFloat(selectedSchool.longitude || 0).toFixed(6)}
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {getElevesChartData(selectedSchool).length > 0 && (
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-semibold text-sm uppercase mb-3 text-primary">
                        Statistiques sur les élèves
                      </h4>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={getElevesChartData(selectedSchool)}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="annee" fontSize={11} />
                          <YAxis fontSize={11} />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="effectif"
                            stroke="rgb(75,192,192)"
                            strokeWidth={2}
                            name="ELEVES"
                            dot
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {teacherStats && (
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-semibold text-sm uppercase mb-3 text-primary">
                        Statistiques enseignants - {teacherStats.niveau}
                      </h4>
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="border p-1.5">TOTAL</th>
                            <th className="border p-1.5">EN CLASSE</th>
                            <th className="border p-1.5">FONCTIONNAIRES</th>
                            <th className="border p-1.5">FRAM SUB</th>
                            <th className="border p-1.5">FRAM NON SUB</th>
                            <th className="border p-1.5">AUTRES</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="text-center">
                            <td className="border p-1.5 font-semibold">{teacherStats.total}</td>
                            <td className="border p-1.5">{teacherStats.en_classe}</td>
                            <td className="border p-1.5">{teacherStats.fonctionnaire}</td>
                            <td className="border p-1.5">{teacherStats.fram_sub}</td>
                            <td className="border p-1.5">{teacherStats.fram_nonsub}</td>
                            <td className="border p-1.5">{teacherStats.autres}</td>
                          </tr>
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-sm uppercase mb-3 text-primary">
                      Infrastructures scolaires
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="border p-1.5 text-center">Type</th>
                            <th className="border p-1.5 text-center">Total</th>
                            <th className="border p-1.5 text-center">Bon état</th>
                            <th className="border p-1.5 text-center">Mauvais état</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="text-center">
                            <td className="border p-1.5 font-medium">Salles de classe</td>
                            <td className="border p-1.5 font-semibold">{sdc.total}</td>
                            <td className="border p-1.5">{sdc.bon}</td>
                            <td className="border p-1.5">{sdc.mauvais}</td>
                          </tr>
                          <tr className="text-center">
                            <td className="border p-1.5 font-medium">Tables-bancs</td>
                            <td className="border p-1.5 font-semibold">{tbc.total}</td>
                            <td className="border p-1.5">{tbc.bon}</td>
                            <td className="border p-1.5">{tbc.mauvais}</td>
                          </tr>
                          <tr>
                            <td colSpan={4} className="bg-slate-100 font-semibold text-center p-2">
                              Eau, Assainissement et Hygiène (EAH)
                            </td>
                          </tr>
                          <tr>
                            <td className="border p-1.5 font-medium">Électricité</td>
                            <td className="border p-1.5 text-center" colSpan={3}>
                              {elec
                                ? `OUI (${selectedSchool?.TYPE_SOURCE_ELECTRICITE || "-"})`
                                : "NON"}
                            </td>
                          </tr>
                          <tr>
                            <td className="border p-1.5 font-medium">Point d'eau</td>
                            <td className="border p-1.5 text-center" colSpan={3}>
                              {eau ? `OUI (${selectedSchool?.TYPE_SOURCE_EAU || "-"})` : "NON"}
                            </td>
                          </tr>
                          <tr>
                            <td className="border p-1.5 font-medium">Latrine garçons</td>
                            <td className="border p-1.5 text-center" colSpan={3}>
                              {latrineG ? "OUI" : "NON"}
                            </td>
                          </tr>
                          <tr>
                            <td className="border p-1.5 font-medium">Latrine filles</td>
                            <td className="border p-1.5 text-center" colSpan={3}>
                              {latrineF ? "OUI" : "NON"}
                            </td>
                          </tr>
                          <tr>
                            <td className="border p-1.5 font-medium">Latrine commune</td>
                            <td className="border p-1.5 text-center" colSpan={3}>
                              {latrineC ? "OUI" : "NON"}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog
          open={showPointageTypeDialog && sigConfig.modules.pointage && activeHeaderAction === "POINTAGE"}
          onOpenChange={(open) => {
            setShowPointageTypeDialog(open);
            if (!open) setPointageType(null);
          }}
        >
          <DialogContent className="sm:max-w-md z-[10000]">
            <DialogHeader>
              <DialogTitle>Choisir le type de pointage</DialogTitle>
              <DialogDescription>
                Choisissez l'objet à géolocaliser. Vous pourrez ensuite faire un clic droit
                sur la carte pour ouvrir le formulaire correspondant.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-20 flex-col gap-2"
                onClick={() => {
                  setPointageType("ETABLISSEMENT");
                  setShowPointageTypeDialog(false);
                }}
              >
                <MapPin className="h-5 w-5" />
                Établissement
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-20 flex-col gap-2"
                onClick={() => {
                  setPointageType("VILLAGE");
                  setShowPointageTypeDialog(false);
                }}
              >
                <MapPin className="h-5 w-5" />
                Village
              </Button>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowPointageTypeDialog(false);
                  setPointageType(null);
                }}
              >
                Annuler
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showGeoEtab && sigConfig.modules.pointage && activeHeaderAction === "POINTAGE"} onOpenChange={setShowGeoEtab}>
          <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto z-[10000]">
            <DialogHeader>
              <DialogTitle>Géolocaliser un établissement</DialogTitle>
              <DialogDescription>
                Sélectionnez un établissement dans la liste et enregistrez sa position.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Code établissement"
                  value={selectedEtabGeo?.CODE_ETAB || ""}
                  readOnly
                  className="w-1/3"
                />
                <Input
                  placeholder="Rechercher : établissement"
                  value={filterEtabName}
                  onChange={(e) => setFilterEtabName(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleSaveGeoEtab}
                  disabled={!selectedEtabGeo}
                  variant="destructive"
                  size="sm"
                >
                  Enregistrer
                </Button>
              </div>
              <div className="border rounded max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="p-2 text-left">#CODE</th>
                      <th className="p-2 text-left">NOM ÉTABLISSEMENT</th>
                      <th className="p-2 text-left">SECTEUR</th>
                      <th className="p-2 text-left">ZAP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEtabNonPointe.map((etab, i) => (
                      <tr
                        key={`geo-${etab.CODE_ETAB}-${i}`}
                        className={`cursor-pointer hover:bg-muted/50 ${
                          selectedEtabGeo?.CODE_ETAB === etab.CODE_ETAB ? "bg-green-100" : ""
                        }`}
                        onClick={() => {
                          setSelectedEtabGeo(etab);
                          setFilterEtabName(etab.NOM_ETAB);
                        }}
                      >
                        <td className="p-2 border-t">{etab.CODE_ETAB}</td>
                        <td className="p-2 border-t">{etab.NOM_ETAB}</td>
                        <td className="p-2 border-t">{secteurLabel(etab.SECTEUR)}</td>
                        <td className="p-2 border-t">{etab.ZAP}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                Coordonnées: {geoCoords.lat.toFixed(6)}, {geoCoords.lng.toFixed(6)}
              </p>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showGeoVillage && sigConfig.modules.pointage && activeHeaderAction === "POINTAGE"} onOpenChange={setShowGeoVillage}>
          <DialogContent className="sm:max-w-md z-[10000]">
            <DialogHeader>
              <DialogTitle>Géolocaliser un village</DialogTitle>
              <DialogDescription>
                Entrez les informations du village à géolocaliser.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="Nom du village"
                value={villageForm.name}
                onChange={(e) => setVillageForm((prev) => ({ ...prev, name: e.target.value }))}
              />
              <div className="grid grid-cols-3 gap-3">
                {(["airtel", "orange", "telma"] as const).map((field) => (
                  <label key={field} className="flex items-center gap-2 text-sm capitalize">
                    <input
                      type="checkbox"
                      checked={villageForm[field]}
                      onChange={(e) =>
                        setVillageForm((prev) => ({
                          ...prev,
                          [field]: e.target.checked,
                        }))
                      }
                    />
                    {field} ?
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(["elec", "eau"] as const).map((field) => (
                  <label key={field} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={villageForm[field]}
                      onChange={(e) =>
                        setVillageForm((prev) => ({
                          ...prev,
                          [field]: e.target.checked,
                        }))
                      }
                    />
                    {field === "elec" ? "Électricité" : "Eau potable"} ?
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Coordonnées: {geoCoords.lat.toFixed(6)}, {geoCoords.lng.toFixed(6)}
              </p>
            </div>
            <DialogFooter>
              <Button onClick={handleSaveGeoVillage} className="bg-green-600 hover:bg-green-700">
                Enregistrer
              </Button>
              <Button variant="outline" onClick={() => setShowGeoVillage(false)}>
                Annuler
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {hoveredEtab && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/95 backdrop-blur-md border shadow-xl rounded-lg px-6 py-3 text-sm flex items-center gap-4 pointer-events-none">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              <div>
                <div className="font-semibold text-primary truncate max-w-[280px]">
                  {hoveredEtab.NOM_ETAB || hoveredEtab.name}
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  {parseFloat(hoveredEtab.latitude).toFixed(6)},{" "}
                  {parseFloat(hoveredEtab.longitude).toFixed(6)}
                </div>
              </div>
            </div>
            {hoveredEtab.SECTEUR !== undefined && (
              <div className="text-xs text-muted-foreground border-l pl-4">
                {hoveredEtab.SECTEUR === 0 ? "Public" : "Privé"} • {hoveredEtab.FOKONTANY || "—"}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Commande du panneau droit */}
      <button
        type="button"
        onClick={() => {
          const narrow = window.matchMedia("(max-width: 767px)").matches;
          if (narrow && !rightSidebarOpen) setSidebarOpen(false);
          setRightSidebarOpen((open) => !open);
        }}
        title={rightSidebarOpen ? "Réduire le panneau d’affichage" : "Ouvrir le panneau d’affichage"}
        aria-label={rightSidebarOpen ? "Réduire les couches et options" : "Ouvrir les couches et options"}
        className="absolute top-1/2 -translate-y-1/2 -mr-4 z-[1500] bg-background border shadow-xl rounded-full w-9 h-9 flex items-center justify-center hover:bg-muted transition-[right] duration-300 ease-in-out motion-reduce:transition-none"
        style={{ right: rightSidebarOpen ? "var(--sig-right-panel-open-width)" : "0px" }}
      >
        {rightSidebarOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {/* Panneau droit — couches, légende et options SIG */}
      <aside
        aria-label="Légende et options d’affichage SIG"
        aria-hidden={!rightSidebarOpen}
        className={`sig-side-panel sig-side-panel-right shrink-0 h-full bg-background/95 backdrop-blur-xl border-l shadow-xl overflow-hidden transition-[width,flex-basis] duration-300 ease-in-out motion-reduce:transition-none ${rightSidebarOpen ? "sig-side-panel-open" : "sig-side-panel-closed"}`}
      >
        <div className={`sig-side-panel-content sig-side-panel-content-right h-full overflow-y-auto overflow-x-hidden overscroll-contain p-3 space-y-3 transition-transform duration-300 ease-in-out motion-reduce:transition-none ${rightSidebarOpen ? "translate-x-0" : "translate-x-full"}`}>
          <section className="rounded-lg border bg-background p-3">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Layers className="h-4 w-4 text-primary" /> Couches et fonds de carte</h2>
            <div ref={layerPanelHostRef} className="sig-layer-panel-host" />
          </section>
          <section className="rounded-lg border bg-background p-3">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-primary" /> Légende</h2>
            <div ref={legendPanelHostRef} className="sig-legend-panel-host" />
          </section>
          <section className="rounded-lg border bg-background p-3">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Settings className="h-4 w-4 text-primary" /> Aires et outils complémentaires</h2>
            <div ref={toolsPanelHostRef} className="sig-tools-panel-host" />
          </section>
        </div>
      </aside>
      </div>
    </div>
  );
};

export default SIG;
