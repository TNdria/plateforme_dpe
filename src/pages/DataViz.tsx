import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Marker,
  Popup,
  Tooltip,
  useMap,
  LayersControl,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2,
  Filter,
  RotateCcw,
  Map,
  MapPin,
  Info,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileJson,
  FileImage,
  BarChart3,
} from "lucide-react";
import { datavizApi, dashboardApi, Dren } from "@/services/api";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import {
  NIVEAUX,
  THEMES,
  getThemesForNiveau,
  type Niveau,
  getSliderDefaults,
  calculateRatio,
  getThematicColor,
  getThemeUnit,
  isPercentageTheme,
  formatThemeValue,
  formatExportValue,
  getIndicator,
  getThemePolarity,
  classifyRatio,
  getLegendLabels,
  STYLE_DREN,
  STYLE_CISCO,
  STYLE_COMMUNE,
} from "./dataviz/dataviz-utils";
import "leaflet/dist/leaflet.css";
import DataActionsBar from "@/components/admin/DataActionsBar";

// ─── Composants carte auxiliaires ───────────────────────────────────────────

const CompassControl = () => {
  const map = useMap();
  useEffect(() => {
    const compassDiv = L.DomUtil.create("div", "leaflet-control");
    compassDiv.id = "compass-control";
    compassDiv.style.cssText = `
      position: absolute;
      top: 8px;
      left: 5px;
      z-index: 1000;
      background: rgba(255, 255, 255, 0.95);
      border: 2px solid #ccc;
      border-radius: 50%;
      padding: 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      pointer-events: none;
      width: 50px;
      height: 50px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    compassDiv.innerHTML = `
      <img
        src="/img/Nord.png"
        alt="Nord"
        style="width: 38px; height: 38px; object-fit: contain;"
        title="Nord"
      />
    `;
    const old = document.getElementById("compass-control");
    if (old) old.remove();
    map.getContainer().appendChild(compassDiv);
    setTimeout(() => {
      const zoomControl = document.querySelector(".leaflet-control-zoom");
      if (zoomControl) {
        (zoomControl as HTMLElement).style.marginTop = "75px";
      }
    }, 300);
    return () => {
      const oldCompass = document.getElementById("compass-control");
      if (oldCompass) oldCompass.remove();
    };
  }, [map]);
  return null;
};

const InvalidateOnResize = ({ trigger }: { trigger: unknown }) => {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 320);
    return () => clearTimeout(t);
  }, [trigger, map]);
  return null;
};

const FitBounds = ({ data }: { data: any }) => {
  const map = useMap();
  useEffect(() => {
    if (!data) return;
    try {
      const layer = L.geoJSON(data);
      const bounds = layer.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] });
    } catch {
      /* ignore invalid geojson */
    }
  }, [data, map]);
  return null;
};

const MapClickHandler = ({ onClose }: { onClose: () => void }) => {
  useMapEvents({
    click: () => onClose(),
    movestart: () => onClose(),
  });
  return null;
};

/** Écoute le changement de fond de carte (OSM / IMAGERY / TOPO / DEFAULT) */
const BaseLayerWatcher = ({ onChange }: { onChange: (name: string) => void }) => {
  useMapEvents({
    baselayerchange: (e: any) => {
      onChange(e?.name || "OSM");
    },
  });
  return null;
};

// ─── Icônes établissements (même FA que SIG) ─────────────────────────────────
// Convention unique : tous les établissements = fa-school (bâtiment), la couleur distingue le niveau
// Couleur = code couleur thématique (blanc / vert / rouge)

const NIVEAU_FA: Record<Niveau, string> = {
  prescolaire: "fas fa-school",
  primaire: "fas fa-school",
  college: "fas fa-school",
  lycee: "fas fa-school",
};

/** Directions de placement du libellé autour du marker (évite le chevauchement) */
const LABEL_OFFSETS = [
  { top: 16, left: 0, tx: "-50%", textAlign: "center" }, // bas
  { top: -22, left: 0, tx: "-50%", textAlign: "center" }, // haut
  { top: 2, left: 18, tx: "0%", textAlign: "left" }, // droite
  { top: 2, left: -18, tx: "-100%", textAlign: "right" }, // gauche
  { top: 16, left: 14, tx: "0%", textAlign: "left" }, // bas-droite
  { top: 16, left: -14, tx: "-100%", textAlign: "right" }, // bas-gauche
  { top: -22, left: 14, tx: "0%", textAlign: "left" }, // haut-droite
  { top: -22, left: -14, tx: "-100%", textAlign: "right" }, // haut-gauche
] as const;

/** Couleur + contour du libellé selon le fond de carte (comme SIG baselayerchange) */
function etabLabelColor(baseMap: string): { color: string; shadow: string } {
  if (baseMap === "IMAGERY" || baseMap === "TOPO" || baseMap === "BING") {
    return {
      color: "#FFFFFF",
      shadow: "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 3px #000",
    };
  }
  return {
    color: "#111111",
    shadow: "-1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff, 0 0 3px #fff",
  };
}

/**
 * Icône établissement style SIG (Font Awesome) + couleur thématique.
 * Libellé optionnel avec placement intelligent (index → direction).
 */
function createEtabIcon(opts: {
  niveau: Niveau;
  fillColor: string;
  label?: string;
  labelColor?: { color: string; shadow: string };
  index?: number;
  total?: number;
}): L.DivIcon {
  const { niveau, fillColor, label, labelColor, index = 0, total = 1 } = opts;
  const fa = NIVEAU_FA[niveau] || "fas fa-map-marker-alt";
  const showLabel = Boolean(label && label.trim());
  const lc = labelColor || etabLabelColor("OSM");
  const safeLabel = (label || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const dirCount = total > 80 ? 8 : total > 30 ? 6 : 4;
  const dir = LABEL_OFFSETS[index % dirCount];
  const fontSize = total > 100 ? 9 : total > 50 ? 10 : 11;

  const labelHtml = showLabel
    ? `<span class="label-etab" style="
          position: absolute;
          top: ${dir.top}px;
          left: ${dir.left}px;
          transform: translateX(${dir.tx});
          text-align: ${dir.textAlign};
          max-width: 110px;
          font-size: ${fontSize}px;
          font-weight: 700;
          line-height: 1.15;
          color: ${lc.color};
          text-shadow: ${lc.shadow};
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          pointer-events: none;
          z-index: 700;
        ">${safeLabel}</span>`
    : "";

  const box = showLabel ? 130 : 22;
  const anchor = Math.round(box / 2);

  return L.divIcon({
    className: "custom-icon etab-marker-icon",
    iconSize: [box, box],
    iconAnchor: [anchor, anchor],
    popupAnchor: [0, -12],
    html: `
      <div style="
        position: relative;
        width: ${box}px;
        height: ${box}px;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
      ">
        <i class="${fa}" style="
          color: ${fillColor};
          font-size: 18px;
          line-height: 1;
          pointer-events: auto;
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.45));
          -webkit-text-stroke: ${fillColor === "#FFFFFF" ? "0.6px #666" : "0"};
        "></i>
        ${labelHtml}
      </div>
    `,
  });
}

// ─── Types ──────────────────────────────────────────────────────────────────

type ActiveLayer = "dren" | "cisco" | "commune";

interface RecapData {
  zone: string;
  total: number;
  /** blanc */
  low: number;
  /** vert */
  medium: number;
  /** rouge */
  high: number;
}

// ─── Helpers export / tooltip ───────────────────────────────────────────────

const themeSlugFor = (label: string) =>
  label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const niveauSlugFor = (niveau: Niveau) => {
  const map: Record<Niveau, string> = {
    prescolaire: "prescolaire",
    primaire: "primaire",
    college: "college",
    lycee: "lycee",
  };
  return map[niveau] ?? niveau;
};

const EXCEL_COLORS = {
  inf: "FFFFFFFF",
  entre: "FF00AA00",
  sup: "FFFF0000",
} as const;

/** Construit le HTML de l'info-bulle (code, nom, champs sources, valeur indicatif) */
function buildTooltipHtml(opts: {
  codeLabel: string;
  code: string | number;
  nameLabel: string;
  name: string;
  themeLabel: string;
  theme: string;
  stat: Record<string, unknown> | null | undefined;
  displayUnit: string;
}): string {
  const { codeLabel, code, nameLabel, name, themeLabel, theme, stat, displayUnit } = opts;
  const ind = getIndicator(theme);
  const ratio = stat && theme !== "0" ? calculateRatio(stat, theme) : null;

  let rows = `
    <div style="font-size:11px;line-height:1.45;min-width:160px">
      <div><span style="color:#666">${codeLabel} :</span> <strong>${code ?? "—"}</strong></div>
      <div><span style="color:#666">${nameLabel} :</span> <strong>${name || "—"}</strong></div>
  `;

  if (stat && ind?.sourceFields?.length) {
    ind.sourceFields.forEach((f) => {
      const label = ind.sourceFieldLabels?.[f] || f;
      const val = stat[f];
      const display =
        val === null || val === undefined || val === ""
          ? "—"
          : typeof val === "number"
            ? Number(val).toLocaleString("fr-FR")
            : String(val);
      rows += `<div><span style="color:#666">${label} :</span> ${display}</div>`;
    });
  }

  if (ratio !== null && Number.isFinite(ratio)) {
    rows += `<div style="margin-top:4px;border-top:1px solid #ddd;padding-top:4px">
      <span style="color:#666">${themeLabel || "Indicateur"} :</span>
      <strong style="font-variant-numeric:tabular-nums">${formatThemeValue(ratio, theme)}${displayUnit}</strong>
    </div>`;
  }

  rows += `</div>`;
  return rows;
}

// ─── Composant principal ────────────────────────────────────────────────────

const DataViz = () => {
  const [drens, setDrens] = useState<Dren[]>([]);
  const [niveau, setNiveau] = useState<Niveau>("primaire");
  const [theme, setTheme] = useState("0");
  const [loading, setLoading] = useState(false);
  const [activeLayer, setActiveLayer] = useState<ActiveLayer>("dren");
  const [showEtab, setShowEtab] = useState(false);
  /** Afficher les noms d'établissements collés aux markers */
  const [showEtabNames, setShowEtabNames] = useState(false);
  /**
   * Filtre markers etab par classe de couleur / statut indicateur
   * all | inf | entre | sup  (ou existe / non-existe pour indicateurs binaires)
   */
  const [etabStatusFilter, setEtabStatusFilter] = useState<"all" | "inf" | "entre" | "sup">("all");
  /** Fond de carte actif (pour couleur des libellés) */
  const [baseMap, setBaseMap] = useState("OSM");

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth >= 768 : true,
  );
  const [rightPanelOpen, setRightPanelOpen] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true,
  );
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  const [sliderRange, setSliderRange] = useState<[number, number]>([0, 100]);
  const [sliderValue, setSliderValue] = useState<[number, number]>([25, 75]);

  const [drenGeoJson, setDrenGeoJson] = useState<any>(null);
  const [ciscoGeoJson, setCiscoGeoJson] = useState<any>(null);
  const [communeGeoJson, setCommuneGeoJson] = useState<any>(null);

  const [dataDren, setDataDren] = useState<any[]>([]);
  const [dataCisco, setDataCisco] = useState<any[]>([]);
  const [dataCommune, setDataCommune] = useState<any[]>([]);
  const [dataEtab, setDataEtab] = useState<any[]>([]);
  const [recap, setRecap] = useState<RecapData>({
    zone: "",
    total: 0,
    low: 0,
    medium: 0,
    high: 0,
  });
  const [showRecap, setShowRecap] = useState(false);

  const [appliedTheme, setAppliedTheme] = useState("0");
  const [appliedBounds, setAppliedBounds] = useState<[number, number]>([25, 75]);

  const [communeCode, setCommuneCode] = useState<number>(0);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    code: number;
    name: string;
    layerBounds: L.LatLngBounds | null;
  } | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Init couches de base
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [drensData, drenLayer, ciscoLayer] = await Promise.all([
          dashboardApi.getDrens(),
          datavizApi.getLayerDren(),
          datavizApi.getLayerCisco(),
        ]);
        setDrens(drensData);
        if (drenLayer?.[0]?.shape) setDrenGeoJson(drenLayer[0].shape);
        if (ciscoLayer?.[0]?.shape) setCiscoGeoJson(ciscoLayer[0].shape);
      } catch (err) {
        console.error("Init error:", err);
        toast.error("Erreur lors du chargement des couches de base");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const availableThemes = useMemo(() => getThemesForNiveau(niveau), [niveau]);

  const getNiveauNumber = (n: Niveau): number => {
    switch (n) {
      case "college":
        return 2;
      case "lycee":
        return 3;
      case "prescolaire":
        return 0;
      default:
        return 1;
    }
  };

  const polarity = useMemo(() => getThemePolarity(appliedTheme), [appliedTheme]);

  const computeRecap = useCallback(
    (items: any[], zone: string) => {
      if (!items?.length || appliedTheme === "0") {
        setRecap({ zone, total: 0, low: 0, medium: 0, high: 0 });
        return;
      }
      let low = 0;
      let medium = 0;
      let high = 0;
      items.forEach((item) => {
        const ratio = calculateRatio(item, appliedTheme);
        const cls = classifyRatio(ratio, appliedBounds[0], appliedBounds[1], polarity);
        if (cls === "inf") low++;
        else if (cls === "sup") high++;
        else medium++;
      });
      setRecap({ zone, total: items.length, low, medium, high });
    },
    [appliedTheme, appliedBounds, polarity],
  );

  useEffect(() => {
    if (!availableThemes.some((t) => t.value === theme)) setTheme("0");
  }, [niveau, availableThemes, theme]);

  useEffect(() => {
    if (theme === "0") return;
    const { range, start } = getSliderDefaults(theme);
    setSliderRange(range);
    setSliderValue(start);
  }, [theme]);

  useEffect(() => {
    if (appliedTheme === "0") return;
    setDataDren([]);
    setDataCisco([]);
    setDataCommune([]);
    setDataEtab([]);
    setAppliedTheme("0");
    setActiveLayer("dren");
    setCommuneGeoJson(null);
    setShowRecap(false);
    setShowEtab(false);
    setShowEtabNames(false);
    setEtabStatusFilter("all");
  }, [niveau]);

  useEffect(() => {
    if (showEtab) return;
    switch (activeLayer) {
      case "dren":
        computeRecap(dataDren, "DREN");
        break;
      case "cisco":
        computeRecap(dataCisco, "CISCO");
        break;
      case "commune":
        computeRecap(dataCommune, "COMMUNE");
        break;
    }
  }, [
    activeLayer,
    appliedTheme,
    appliedBounds,
    dataDren,
    dataCisco,
    dataCommune,
    showEtab,
    computeRecap,
  ]);

  const handleApply = useCallback(async () => {
    if (theme === "0") {
      toast.error("Veuillez choisir un thème");
      return;
    }
    setLoading(true);
    setDataEtab([]);
    setShowEtab(false);
    setShowEtabNames(false);
    setEtabStatusFilter("all");
    setShowRecap(true);
    setRightPanelOpen(true);
    try {
      const niveauIndex = getNiveauNumber(niveau);
      const [dren, cisco] = await Promise.all([
        datavizApi.getDataDren(niveauIndex),
        datavizApi.getDataCisco(niveauIndex),
      ]);
      setDataDren(dren || []);
      setDataCisco(cisco || []);
      setAppliedTheme(theme);
      setAppliedBounds([...sliderValue]);
      setActiveLayer("dren");
      setCommuneGeoJson(null);
      setDataCommune([]);
      toast.success("Carte thématique mise à jour");
    } catch (err) {
      console.error("Apply error:", err);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  }, [theme, sliderValue, niveau]);

  /** Carte par commune : uniquement le CISCO cliqué (couche communes + couleurs) */
  const handleDrillCommune = useCallback(
    async (code: number) => {
      if (appliedTheme === "0" || !drenGeoJson) return;
      const niveauIndex = getNiveauNumber(niveau);
      setLoading(true);
      try {
        const [layer, data] = await Promise.all([
          datavizApi.getLayerCommune(code),
          datavizApi.getDataCommune(code, niveauIndex),
        ]);
        if (layer?.[0]?.shape) setCommuneGeoJson(layer[0].shape);
        setDataCommune(data || []);
        setCommuneCode(code);
        setActiveLayer("commune");
        setShowEtab(false);
        setDataEtab([]);
        setShowEtabNames(false);
        setShowRecap(true);
        setRightPanelOpen(true);
      } catch (err) {
        console.error("Commune drill error:", err);
        toast.error("Erreur lors du chargement des communes");
      } finally {
        setLoading(false);
      }
    },
    [appliedTheme, niveau, drenGeoJson],
  );

  /**
   * Carte des établissements : même CISCO (communes en délimitation SANS couleur thématique)
   * + markers établissements avec couleur thématique et icône selon niveau
   */
  const handleShowEtab = useCallback(
    async (code: number) => {
      if (appliedTheme === "0" || !drenGeoJson) return;
      const niveauIndex = getNiveauNumber(niveau);
      setLoading(true);
      try {
        const [communeLayer, communeData, etabData] = await Promise.all([
          datavizApi.getLayerCommune(code),
          datavizApi.getDataCommune(code, niveauIndex),
          datavizApi.getDataEtab(code, niveauIndex),
        ]);
        if (communeLayer?.[0]?.shape) setCommuneGeoJson(communeLayer[0].shape);
        setDataCommune(communeData || []);
        setCommuneCode(code);
        setActiveLayer("commune");
        setDataEtab(etabData || []);
        setShowEtab(true);
        setShowRecap(true);
        setRightPanelOpen(true);
      } catch (err) {
        console.error("Etab load error:", err);
        toast.error("Erreur lors du chargement des établissements");
      } finally {
        setLoading(false);
      }
    },
    [appliedTheme, niveau, drenGeoJson],
  );

  const handleReset = useCallback(() => {
    setAppliedTheme("0");
    setTheme("0");
    setDataDren([]);
    setDataCisco([]);
    setDataCommune([]);
    setDataEtab([]);
    setCommuneGeoJson(null);
    setShowEtab(false);
    setShowEtabNames(false);
    setEtabStatusFilter("all");
    setActiveLayer("dren");
    setContextMenu(null);
    setShowRecap(false);
    setRecap({ zone: "", total: 0, low: 0, medium: 0, high: 0 });
  }, []);

  const handleCaptureMap = useCallback(async () => {
    const node = mapContainerRef.current;
    if (!node) return;
    setContextMenu(null);
    try {
      const canvas = await html2canvas(node, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        scale: 2,
      });
      const link = document.createElement("a");
      const themeLabel = THEMES.find((t) => t.value === appliedTheme)?.label || "carte";
      const slug = `${themeSlugFor(themeLabel)}_${niveauSlugFor(niveau)}`;
      const date = new Date().toISOString().slice(0, 10);
      link.download = `${slug}_${date}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Carte téléchargée");
    } catch (err) {
      console.error("Capture error:", err);
      toast.error("Impossible de capturer la carte");
    }
  }, [appliedTheme, niveau]);

  // ── Export dataset ──────────────────────────────────────────────────────

  const getZoneCodeKey = (): string => {
    if (showEtab) return "CODE_ETAB";
    if (activeLayer === "commune") return "CODE_COMMUNE";
    if (activeLayer === "cisco") return "CODE_CISCO";
    return "CODE_DREN";
  };

  const getZoneNameKey = (): string | null => {
    if (showEtab) return "NOM_ETAB";
    if (activeLayer === "commune") return "NOM_COMMUNE";
    if (activeLayer === "cisco") return "NOM_CISCO";
    return "NOM_DREN";
  };

  const getZoneCodeHeader = (): string => {
    if (showEtab) return "Code_ETAB";
    if (activeLayer === "commune") return "Code_COMMUNE";
    if (activeLayer === "cisco") return "Code_CISCO";
    return "Code_DREN";
  };

  const getZoneNameHeader = (): string => {
    if (showEtab) return "ETABLISSEMENT";
    if (activeLayer === "commune") return "COMMUNE";
    if (activeLayer === "cisco") return "CISCO";
    return "DREN";
  };

  const activeExportDataset = useMemo(() => {
    type ExportRow = Record<string, string | number | null>;

    const ind = getIndicator(appliedTheme);
    const themeLabel = ind?.label || THEMES.find((t) => t.value === appliedTheme)?.label || "";
    const niveauLabel = NIVEAUX.find((n) => n.value === niveau)?.label || niveau;
    const [minBound, maxBound] = appliedBounds;
    const sourceFields = ind?.sourceFields ?? [];
    const sourceLabels = ind?.sourceFieldLabels ?? {};
    const codeKey = getZoneCodeKey();
    const nameKey = getZoneNameKey();
    const codeHeader = getZoneCodeHeader();
    const nameHeader = getZoneNameHeader();
    const pol = getThemePolarity(appliedTheme);

    const buildRows = (
      raw: any[],
    ): { rows: ExportRow[]; colorClasses: ("inf" | "entre" | "sup")[] } => {
      if (!raw?.length || appliedTheme === "0") {
        return { rows: [], colorClasses: [] };
      }
      const rows: ExportRow[] = [];
      const colorClasses: ("inf" | "entre" | "sup")[] = [];

      raw.forEach((row) => {
        const ratio = calculateRatio(row, appliedTheme);
        const cls = classifyRatio(ratio, minBound, maxBound, pol);
        colorClasses.push(cls);

        const out: ExportRow = {};
        const codeVal =
          row[codeKey] ??
          row.CODE_DREN ??
          row.CODE_CISCO ??
          row.CODE_COMMUNE ??
          row.CODE_ETAB ??
          row.code ??
          "";
        out[codeHeader] = codeVal;

        if (nameKey) {
          const nameVal =
            row[nameKey] ??
            row.NOM_DREN ??
            row.NOM_CISCO ??
            row.NOM_COMMUNE ??
            row.NOM_ETAB ??
            row.NAME ??
            "";
          out[nameHeader] = nameVal ?? "";
        }

        sourceFields.forEach((f) => {
          const label = sourceLabels[f] || f;
          out[label] = row[f] ?? null;
        });

        const exportVal = formatExportValue(ratio, appliedTheme);
        out["Valeur indicatif"] = exportVal;

        rows.push(out);
      });

      return { rows, colorClasses };
    };

    let built: { rows: ExportRow[]; colorClasses: ("inf" | "entre" | "sup")[] };
    let layerLabel: string;

    if (showEtab) {
      built = buildRows(dataEtab);
      layerLabel = "etablissements";
    } else if (activeLayer === "commune") {
      built = buildRows(dataCommune);
      layerLabel = "communes";
    } else if (activeLayer === "cisco") {
      built = buildRows(dataCisco);
      layerLabel = "cisco";
    } else {
      built = buildRows(dataDren);
      layerLabel = "dren";
    }

    return {
      label: layerLabel,
      rows: built.rows,
      colorClasses: built.colorClasses,
      meta: {
        title: `${themeLabel} - ${niveauLabel}`,
        theme: themeLabel,
        theme_code: appliedTheme,
        niveau: niveauLabel,
        niveau_code: niveau,
        borne_min: minBound,
        borne_max: maxBound,
        plage: `Plage : ${minBound} - ${maxBound}`,
        polarity: pol,
      },
    };
  }, [
    showEtab,
    activeLayer,
    dataEtab,
    dataCommune,
    dataCisco,
    dataDren,
    appliedTheme,
    appliedBounds,
    niveau,
  ]);

  const buildExportFilename = (ext: string) => {
    const themeLabel = THEMES.find((t) => t.value === appliedTheme)?.label || "carte";
    return `${themeSlugFor(themeLabel)}_${niveauSlugFor(niveau)}.${ext}`;
  };

  const downloadCSV = () => {
    const { rows, meta } = activeExportDataset;
    if (!rows.length) {
      toast.error("Aucune donnée à exporter");
      return;
    }
    const headers = Object.keys(rows[0]);
    const csv = [
      `"${meta.title}"`,
      `"${meta.plage}"`,
      headers.map((h) => `"${h}"`).join(";"),
      ...rows.map((r) =>
        headers
          .map((h) => {
            const v = (r as Record<string, unknown>)[h];
            if (v === null || v === undefined) return '""';
            return `"${String(v).replace(/"/g, '""')}"`;
          })
          .join(";"),
      ),
    ].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = buildExportFilename("csv");
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export CSV téléchargé");
  };

  const downloadExcel = async () => {
    const { rows, colorClasses, meta } = activeExportDataset;
    if (!rows.length) {
      toast.error("Aucune donnée à exporter");
      return;
    }
    try {
      const ExcelJS = await import("exceljs");
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Données", {
        views: [{ state: "frozen", ySplit: 3 }],
      });

      const headers = Object.keys(rows[0]);
      const colCount = headers.length;

      ws.mergeCells(1, 1, 1, colCount);
      const titleCell = ws.getCell(1, 1);
      titleCell.value = meta.title;
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      titleCell.font = { bold: true, size: 14 };
      ws.getRow(1).height = 24;

      ws.mergeCells(2, 1, 2, colCount);
      const plageCell = ws.getCell(2, 1);
      plageCell.value = meta.plage;
      plageCell.alignment = { horizontal: "center", vertical: "middle" };
      plageCell.font = { italic: true, size: 11 };
      ws.getRow(2).height = 18;

      const headerRow = ws.getRow(3);
      headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
        cell.font = { bold: true };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE0E0E0" },
        };
        cell.alignment = { horizontal: "center", wrapText: true };
        cell.border = {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        };
      });
      headerRow.height = 22;

      const valeurColIdx = headers.indexOf("Valeur indicatif") + 1;

      rows.forEach((r, rowIdx) => {
        const excelRow = ws.getRow(rowIdx + 4);
        headers.forEach((h, colIdx) => {
          const cell = excelRow.getCell(colIdx + 1);
          const v = (r as Record<string, unknown>)[h];
          if (v === null || v === undefined) {
            cell.value = null;
          } else if (typeof v === "number") {
            cell.value = v;
            cell.numFmt = Number.isInteger(v) ? "0" : "0.00";
          } else {
            cell.value = String(v);
          }
          cell.border = {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" },
          };
        });

        if (valeurColIdx > 0) {
          const cls = colorClasses[rowIdx] ?? "inf";
          const argb = EXCEL_COLORS[cls];
          const cell = excelRow.getCell(valeurColIdx);
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb },
          };
          if (cls === "sup" || cls === "entre") {
            cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
          }
        }
      });

      headers.forEach((h, i) => {
        const maxLen = Math.max(
          h.length,
          ...rows.slice(0, 50).map((r) => String((r as Record<string, unknown>)[h] ?? "").length),
        );
        ws.getColumn(i + 1).width = Math.min(Math.max(maxLen + 2, 10), 40);
      });

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = buildExportFilename("xlsx");
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export Excel téléchargé");
    } catch (err) {
      console.error("Excel export error:", err);
      toast.error("Erreur lors de l'export Excel (exceljs requis)");
    }
  };

  const downloadJSON = () => {
    const { rows, meta, colorClasses } = activeExportDataset;
    if (!rows.length) {
      toast.error("Aucune donnée à exporter");
      return;
    }
    const payload = {
      titre: meta.title,
      theme: meta.theme,
      theme_code: meta.theme_code,
      niveau: meta.niveau,
      niveau_code: meta.niveau_code,
      plage: {
        min: meta.borne_min,
        max: meta.borne_max,
      },
      polarite: meta.polarity,
      code_couleur: {
        blanc: "inférieur (ou excellent selon polarité)",
        vert: "dans la plage",
        rouge: "supérieur (ou critique selon polarité)",
      },
      donnees: rows.map((r, i) => ({
        ...r,
        _couleur:
          colorClasses[i] === "inf" ? "blanc" : colorClasses[i] === "sup" ? "rouge" : "vert",
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = buildExportFilename("json");
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export JSON téléchargé");
  };

  // ── Context menu ────────────────────────────────────────────────────────

  const handleContextMenuOnLayer = useCallback(
    (code: number, name: string, e: any) => {
      if (appliedTheme === "0") {
        toast.warning("Veuillez choisir un thème d'abord");
        return;
      }
      e.originalEvent?.preventDefault?.();
      const container = mapContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = e.originalEvent.clientX - rect.left;
      const y = e.originalEvent.clientY - rect.top;
      const bounds = e.target?.getBounds?.() || null;
      setContextMenu({ x, y, code, name, layerBounds: bounds });
    },
    [appliedTheme],
  );

  const handleContextMenuCommune = useCallback(
    (code: number, _name: string) => {
      if (appliedTheme === "0") {
        toast.warning("Veuillez choisir un thème d'abord");
        return;
      }
      setContextMenu(null);
      handleDrillCommune(code);
    },
    [appliedTheme, handleDrillCommune],
  );

  const handleContextMenuEtab = useCallback(
    (code: number) => {
      if (appliedTheme === "0") {
        toast.warning("Veuillez choisir un thème d'abord");
        return;
      }
      setContextMenu(null);
      handleShowEtab(code);
    },
    [appliedTheme, handleShowEtab],
  );

  // ── Styles GeoJSON ──────────────────────────────────────────────────────

  const drenStyle = useCallback(
    (feature: any) => {
      if (appliedTheme === "0" || !dataDren.length) return STYLE_DREN;
      const code = feature?.properties?.CODE;
      const stat = dataDren.find((d: any) => parseInt(d.CODE_DREN) === parseInt(code));
      if (!stat) return STYLE_DREN;
      const ratio = calculateRatio(stat, appliedTheme);
      const color = getThematicColor(ratio, appliedBounds[0], appliedBounds[1], polarity);
      return { ...STYLE_DREN, fillColor: color, fillOpacity: 1 };
    },
    [appliedTheme, dataDren, appliedBounds, polarity],
  );

  const ciscoStyle = useCallback(
    (feature: any) => {
      if (appliedTheme === "0" || !dataCisco.length) return STYLE_CISCO;
      const code = feature?.properties?.CODE;
      const stat = dataCisco.find((d: any) => parseInt(d.CODE_CISCO) === parseInt(code));
      if (!stat) return STYLE_CISCO;
      const ratio = calculateRatio(stat, appliedTheme);
      const color = getThematicColor(ratio, appliedBounds[0], appliedBounds[1], polarity);
      return { ...STYLE_CISCO, fillColor: color, fillOpacity: 1 };
    },
    [appliedTheme, dataCisco, appliedBounds, polarity],
  );

  /**
   * Communes :
   * - mode "carte par commune" → couleur thématique
   * - mode "carte des établissements" → délimitation seule, SANS code couleur indicateur
   */
  const communeStyle = useCallback(
    (feature: any) => {
      // Fond neutre quand on affiche les établissements
      if (showEtab) {
        return {
          ...STYLE_COMMUNE,
          fillColor: "#e8e8e8",
          fillOpacity: 0.15,
          color: "#888",
          weight: 1.5,
        };
      }
      if (appliedTheme === "0" || !dataCommune.length) return STYLE_COMMUNE;
      const code = feature?.properties?.CODE;
      const stat = dataCommune.find((d: any) => parseInt(d.CODE_COMMUNE) === parseInt(code));
      if (!stat) return STYLE_COMMUNE;
      const ratio = calculateRatio(stat, appliedTheme);
      const color = getThematicColor(ratio, appliedBounds[0], appliedBounds[1], polarity);
      return { ...STYLE_COMMUNE, fillColor: color, fillOpacity: 1 };
    },
    [appliedTheme, dataCommune, appliedBounds, polarity, showEtab],
  );

  const ptg = isPercentageTheme(appliedTheme) ? "%" : "";
  const unit = getThemeUnit(appliedTheme);
  const selectedThemeLabel = THEMES.find((t) => t.value === appliedTheme)?.label || "";
  const displayUnit = ptg || unit;

  const legendLabels = useMemo(() => {
    if (appliedTheme === "0") return null;
    return getLegendLabels(
      appliedBounds[0],
      appliedBounds[1],
      polarity,
      (v) => formatThemeValue(v, appliedTheme),
      displayUnit,
    );
  }, [appliedTheme, appliedBounds, polarity, displayUnit]);

  // ── onEachFeature : info-bulles au survol ───────────────────────────────

  const onEachDren = useCallback(
    (feature: any, layer: L.Layer) => {
      const name = feature?.properties?.NAME || "";
      const code = feature?.properties?.CODE;
      const stat = dataDren.find((d: any) => parseInt(d.CODE_DREN) === parseInt(code));
      const html = buildTooltipHtml({
        codeLabel: "Code_DREN",
        code,
        nameLabel: "DREN",
        name,
        themeLabel: selectedThemeLabel,
        theme: appliedTheme,
        stat,
        displayUnit,
      });
      (layer as any).bindTooltip(html, {
        permanent: false,
        direction: "top",
        sticky: true,
        opacity: 0.95,
        className: "dataviz-tooltip",
      });
      (layer as any).on("contextmenu", (e: any) => {
        handleContextMenuOnLayer(parseInt(code), name, e);
      });
    },
    [dataDren, appliedTheme, displayUnit, selectedThemeLabel, handleContextMenuOnLayer],
  );

  const onEachCisco = useCallback(
    (feature: any, layer: L.Layer) => {
      const name = feature?.properties?.NAME || "";
      const code = feature?.properties?.CODE;
      const stat = dataCisco.find((d: any) => parseInt(d.CODE_CISCO) === parseInt(code));
      const html = buildTooltipHtml({
        codeLabel: "Code_CISCO",
        code,
        nameLabel: "CISCO",
        name,
        themeLabel: selectedThemeLabel,
        theme: appliedTheme,
        stat,
        displayUnit,
      });
      (layer as any).bindTooltip(html, {
        permanent: false,
        direction: "top",
        sticky: true,
        opacity: 0.95,
        className: "dataviz-tooltip",
      });
      (layer as any).on("contextmenu", (e: any) => {
        handleContextMenuOnLayer(parseInt(code), name, e);
      });
    },
    [dataCisco, appliedTheme, displayUnit, selectedThemeLabel, handleContextMenuOnLayer],
  );

  const onEachCommune = useCallback(
    (feature: any, layer: L.Layer) => {
      // Si les établissements sont affichés : désactiver les events communes
      // pour que le survol/clic aille aux markers etab
      if (showEtab) {
        (layer as any).off();
        if ((layer as any).unbindTooltip) (layer as any).unbindTooltip();
        if ((layer as any).options) (layer as any).options.interactive = false;
        // Leaflet path
        if (typeof (layer as any).setStyle === "function") {
          try {
            (layer as any).options.interactive = false;
          } catch {
            /* ignore */
          }
        }
        return;
      }

      const name = feature?.properties?.NAME || "";
      const code = feature?.properties?.CODE;
      const stat = dataCommune.find((d: any) => parseInt(d.CODE_COMMUNE) === parseInt(code));
      const html = buildTooltipHtml({
        codeLabel: "Code_COMMUNE",
        code,
        nameLabel: "COMMUNE",
        name,
        themeLabel: selectedThemeLabel,
        theme: appliedTheme,
        stat,
        displayUnit,
      });
      (layer as any).bindTooltip(html, {
        permanent: false,
        direction: "top",
        sticky: true,
        opacity: 0.95,
        className: "dataviz-tooltip",
      });
    },
    [dataCommune, appliedTheme, displayUnit, selectedThemeLabel, showEtab],
  );

  const drenKey = useMemo(
    () => `dren-${appliedTheme}-${appliedBounds.join("-")}-${dataDren.length}-${polarity}`,
    [appliedTheme, appliedBounds, dataDren, polarity],
  );
  const ciscoKey = useMemo(
    () => `cisco-${appliedTheme}-${appliedBounds.join("-")}-${dataCisco.length}-${polarity}`,
    [appliedTheme, appliedBounds, dataCisco, polarity],
  );
  const communeKey = useMemo(
    () =>
      `commune-${appliedTheme}-${appliedBounds.join("-")}-${dataCommune.length}-${polarity}-etab${showEtab ? 1 : 0}`,
    [appliedTheme, appliedBounds, dataCommune, polarity, showEtab],
  );

  // Marqueurs établissements (icône SIG FA + filtre statut + nom optionnel)
  const etabMarkers = useMemo(() => {
    if (!showEtab || !dataEtab.length || appliedTheme === "0") return [];
    const lc = etabLabelColor(baseMap);
    const [minB, maxB] = appliedBounds;

    // 1) Calcul + classification pour chaque etab
    const prepared = dataEtab
      .filter((e: any) => !isNaN(parseFloat(e.latitude)) && !isNaN(parseFloat(e.longitude)))
      .map((etab: any) => {
        const ratio = calculateRatio(etab, appliedTheme);
        const cls = classifyRatio(ratio, minB, maxB, polarity);
        const color = getThematicColor(ratio, minB, maxB, polarity);
        return {
          lat: parseFloat(etab.latitude),
          lng: parseFloat(etab.longitude),
          name: etab.NOM_ETAB || "",
          code: etab.CODE_ETAB ?? etab.code ?? "",
          ratio,
          cls,
          color,
          raw: etab,
        };
      });

    // 2) Filtre par statut (inf / entre / sup)
    const filtered =
      etabStatusFilter === "all" ? prepared : prepared.filter((m) => m.cls === etabStatusFilter);

    // 3) Icônes avec placement intelligent des noms
    const total = filtered.length;
    return filtered.map((m, index) => ({
      ...m,
      icon: createEtabIcon({
        niveau,
        fillColor: m.color,
        label: showEtabNames ? m.name : undefined,
        labelColor: lc,
        index,
        total,
      }),
    }));
  }, [
    showEtab,
    dataEtab,
    appliedTheme,
    appliedBounds,
    polarity,
    niveau,
    showEtabNames,
    baseMap,
    etabStatusFilter,
  ]);

  // Recap sur TOUS les établissements (indépendant du filtre d'affichage)
  useEffect(() => {
    if (!showEtab || !dataEtab.length || appliedTheme === "0") return;
    let low = 0;
    let medium = 0;
    let high = 0;
    let total = 0;
    dataEtab.forEach((etab: any) => {
      if (isNaN(parseFloat(etab.latitude)) || isNaN(parseFloat(etab.longitude))) return;
      total++;
      const ratio = calculateRatio(etab, appliedTheme);
      const cls = classifyRatio(ratio, appliedBounds[0], appliedBounds[1], polarity);
      if (cls === "inf") low++;
      else if (cls === "sup") high++;
      else medium++;
    });
    setRecap({ zone: "ETABLISSEMENTS", total, low, medium, high });
  }, [showEtab, dataEtab, appliedTheme, appliedBounds, polarity]);

  const activeBoundsData =
    activeLayer === "commune"
      ? communeGeoJson
      : activeLayer === "cisco"
        ? ciscoGeoJson
        : drenGeoJson;

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 bg-muted/50 border-b border-border">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-sm font-semibold text-muted-foreground">
            CARTE THEMATIQUE DES INDICATEURS
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowDownloadModal(true)}
              disabled={loading}
            >
              <Download className="w-4 h-4 mr-2" />
              Télécharger
            </Button>
            <DataActionsBar table="sig_etablissement" tableLabel="SIG Établissement" compact />
          </div>
        </div>
      </div>

      <div className="flex-1 relative flex gap-0 overflow-hidden">
        {/* ═══ PANNEAU GAUCHE : Filtres + Guides ═══ */}
        <div
          className={
            (sidebarOpen ? "w-[85vw] max-w-[280px] " : "w-0 ") +
            "shrink-0 h-full bg-background border-r border-border overflow-hidden transition-[width] duration-300 ease-in-out"
          }
        >
          <div className="w-[85vw] max-w-[280px] h-full space-y-3 overflow-y-auto p-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Filtres
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Niveau</Label>
                  <Select value={niveau} onValueChange={(v) => setNiveau(v as Niveau)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NIVEAUX.map((n) => (
                        <SelectItem key={n.value} value={n.value}>
                          {n.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Thème</Label>
                  <Select value={theme} onValueChange={setTheme}>
                    <SelectTrigger>
                      <SelectValue placeholder="--Choisir un thème--" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableThemes.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {theme !== "0" && (
                  <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                    <Label className="text-xs font-medium">Plage de valeurs (Min - Max)</Label>
                    <Slider
                      min={sliderRange[0]}
                      max={sliderRange[1]}
                      step={1}
                      value={sliderValue}
                      onValueChange={(v) => setSliderValue(v as [number, number])}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        Min: <strong className="text-foreground">{sliderValue[0]}</strong>
                      </span>
                      <span>
                        Max: <strong className="text-foreground">{sliderValue[1]}</strong>
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={handleApply}
                    className="flex-1"
                    disabled={loading || theme === "0"}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Filter className="w-4 h-4 mr-2" />
                    )}
                    Appliquer
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleReset} title="Réinitialiser">
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </div>

                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => setShowDownloadModal(true)}
                  disabled={loading}
                  title="Exporter les données ou capturer la carte"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger
                </Button>
              </CardContent>
            </Card>

            {appliedTheme !== "0" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Zone de délimitation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">DREN</Label>
                    <Switch
                      checked={activeLayer === "dren" && !showEtab}
                      onCheckedChange={() => {
                        setActiveLayer("dren");
                        setCommuneGeoJson(null);
                        setShowEtab(false);
                        setDataEtab([]);
                        setShowEtabNames(false);
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">CISCO</Label>
                    <Switch
                      checked={activeLayer === "cisco" && !showEtab}
                      onCheckedChange={() => {
                        setActiveLayer("cisco");
                        setCommuneGeoJson(null);
                        setShowEtab(false);
                        setDataEtab([]);
                        setShowEtabNames(false);
                      }}
                    />
                  </div>
                  {activeLayer === "commune" && (
                    <div className="flex items-center justify-between opacity-70">
                      <Label className="text-xs">{showEtab ? "Établissements" : "Communes"}</Label>
                      <Switch checked disabled />
                    </div>
                  )}
                  <div className="p-2 bg-primary/5 border border-primary/20 rounded-md space-y-1.5">
                    <p className="text-[11px] font-semibold flex items-center gap-1.5 text-primary">
                      <Info className="w-3.5 h-3.5" /> Guide d&apos;utilisation
                    </p>
                    <ul className="text-[10px] text-muted-foreground space-y-1 list-disc list-inside leading-relaxed">
                      <li>
                        Choisissez le <strong>niveau</strong> et le <strong>thème</strong>, puis
                        cliquez sur <em>Appliquer</em>.
                      </li>
                      <li>
                        Basculez entre <strong>DREN</strong> et <strong>CISCO</strong> avec les
                        interrupteurs ci-dessus.
                      </li>
                      <li>
                        <strong>Clic droit</strong> sur une zone pour accéder à la carte par{" "}
                        <em>Commune</em> ou par <em>Établissement</em>.
                      </li>
                      <li>
                        Utilisez <em>Capturer la carte</em> pour télécharger une image PNG de la
                        vue.
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setSidebarOpen((v) => !v)}
          title={sidebarOpen ? "Réduire le panneau gauche" : "Développer le panneau gauche"}
          className="absolute top-1/2 -translate-y-1/2 z-[1500] bg-background border shadow-md rounded-full w-7 h-7 flex items-center justify-center hover:bg-muted transition-[left] duration-300 ease-in-out"
          style={{ left: sidebarOpen ? "clamp(0px, 85vw, 280px)" : "0px" }}
        >
          {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {/* ═══ CENTRE : CARTE ═══ */}
        <div className="flex-1 overflow-hidden relative" ref={mapContainerRef}>
          {loading && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-[1000] flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Chargement des données...</p>
              </div>
            </div>
          )}

          {contextMenu && (
            <div
              className="absolute z-[2000] bg-white rounded-lg shadow-xl border py-1 min-w-[260px]"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              <button
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 flex items-center gap-3 transition-colors"
                onClick={() => {
                  handleContextMenuCommune(contextMenu.code, contextMenu.name);
                }}
              >
                <Map className="w-4 h-4 text-blue-600" />
                <span>Carte par Commune</span>
              </button>
              <hr className="my-0.5 border-gray-200" />
              <button
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 flex items-center gap-3 transition-colors"
                onClick={() => {
                  handleContextMenuEtab(contextMenu.code);
                }}
              >
                <MapPin className="w-4 h-4 text-red-600" />
                <span>Carte des Établissements</span>
              </button>
            </div>
          )}

          <MapContainer
            center={[-18.9189596, 47.5135653]}
            zoom={6}
            className="h-full w-full"
            scrollWheelZoom={false}
            doubleClickZoom={false}
          >
            <MapClickHandler onClose={() => setContextMenu(null)} />
            <CompassControl />
            <InvalidateOnResize trigger={`${sidebarOpen}-${rightPanelOpen}`} />
            <BaseLayerWatcher onChange={setBaseMap} />

            <LayersControl position="topright">
              <LayersControl.BaseLayer name="DEFAULT">
                <TileLayer attribution="© MEN/DPE" url="" maxZoom={24} />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer checked name="OSM">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | © MEN/DPE'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="IMAGERY">
                <TileLayer
                  attribution="&copy; Esri"
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  maxZoom={22}
                />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="TOPO">
                <TileLayer
                  attribution="&copy; OpenTopoMap"
                  url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                  maxZoom={19}
                />
              </LayersControl.BaseLayer>
            </LayersControl>

            {/* DREN : carte MADA entière + délimitation + couleur thématique */}
            {drenGeoJson && (activeLayer === "dren" || appliedTheme === "0") && (
              <GeoJSON
                key={drenKey}
                data={drenGeoJson}
                style={drenStyle}
                onEachFeature={onEachDren}
              />
            )}

            {/* CISCO : carte MADA entière + délimitation + couleur thématique */}
            {ciscoGeoJson && activeLayer === "cisco" && (
              <GeoJSON
                key={ciscoKey}
                data={ciscoGeoJson}
                style={ciscoStyle}
                onEachFeature={onEachCisco}
              />
            )}

            {/* Commune : uniquement le CISCO sélectionné
                - mode commune → couleur thématique
                - mode etab → délimitation neutre, events désactivés */}
            {communeGeoJson && activeLayer === "commune" && (
              <GeoJSON
                key={communeKey}
                data={communeGeoJson}
                style={communeStyle}
                onEachFeature={onEachCommune}
                interactive={!showEtab}
              />
            )}

            {/* Établissements : markers au-dessus, icône selon niveau, couleur thématique */}
            {showEtab &&
              etabMarkers.map((m, i) => (
                <Marker
                  key={`etab-${m.code}-${i}-${etabStatusFilter}-${showEtabNames}-${baseMap}`}
                  position={[m.lat, m.lng]}
                  icon={m.icon}
                >
                  {/* Info-bulle au survol */}
                  <Tooltip direction="top" sticky opacity={0.95} className="dataviz-tooltip">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: buildTooltipHtml({
                          codeLabel: "Code_ETAB",
                          code: m.code,
                          nameLabel: "ÉTABLISSEMENT",
                          name: m.name,
                          themeLabel: selectedThemeLabel,
                          theme: appliedTheme,
                          stat: m.raw,
                          displayUnit,
                        }),
                      }}
                    />
                  </Tooltip>
                  <Popup>
                    <div
                      dangerouslySetInnerHTML={{
                        __html: buildTooltipHtml({
                          codeLabel: "Code_ETAB",
                          code: m.code,
                          nameLabel: "ÉTABLISSEMENT",
                          name: m.name,
                          themeLabel: selectedThemeLabel,
                          theme: appliedTheme,
                          stat: m.raw,
                          displayUnit,
                        }),
                      }}
                    />
                  </Popup>
                </Marker>
              ))}

            <FitBounds data={activeBoundsData} />
          </MapContainer>
        </div>

        <button
          type="button"
          onClick={() => setRightPanelOpen((v) => !v)}
          title={rightPanelOpen ? "Réduire le panneau droit" : "Développer le panneau droit"}
          className="absolute top-1/2 -translate-y-1/2 z-[1500] bg-background border shadow-md rounded-full w-7 h-7 flex items-center justify-center hover:bg-muted transition-[right] duration-300 ease-in-out"
          style={{ right: rightPanelOpen ? "clamp(0px, 85vw, 280px)" : "0px" }}
        >
          {rightPanelOpen ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>

        {/* ═══ PANNEAU DROIT : Légende + option noms + Récapitulatif ═══ */}
        <div
          className={
            (rightPanelOpen ? "w-[85vw] max-w-[280px] " : "w-0 ") +
            "shrink-0 h-full bg-background border-l border-border overflow-hidden transition-[width] duration-300 ease-in-out"
          }
        >
          <div className="w-[85vw] max-w-[280px] h-full space-y-3 overflow-y-auto p-3">
            {/* Légende */}
            {appliedTheme !== "0" && legendLabels ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Légende</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <p className="font-medium leading-snug">{selectedThemeLabel}</p>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-4 h-3 border shrink-0"
                      style={{ backgroundColor: "#FFFFFF" }}
                    />
                    <span className="flex-1 text-right tabular-nums leading-tight">
                      {legendLabels.white}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-3 shrink-0" style={{ backgroundColor: "#00AA00" }} />
                    <span className="flex-1 text-right tabular-nums leading-tight">
                      {legendLabels.green}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-3 shrink-0" style={{ backgroundColor: "#FF0000" }} />
                    <span className="flex-1 text-right tabular-nums leading-tight">
                      {legendLabels.red}
                    </span>
                  </div>
                  <div className="border-t pt-2 mt-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-3 shrink-0" style={{ backgroundColor: "#4e73df" }} />
                      <span>Limite DREN</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-3 shrink-0" style={{ backgroundColor: "#22afbe" }} />
                      <span>Limite CISCO</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-3 shrink-0" style={{ backgroundColor: "#c0c0c0" }} />
                      <span>Limite Commune</span>
                    </div>
                    {showEtab && (
                      <div className="flex items-center gap-2 pt-1">
                        <i
                          className={NIVEAU_FA[niveau]}
                          style={{ color: "#00AA00", fontSize: 14 }}
                        />
                        <span>
                          Établissement ({NIVEAUX.find((n) => n.value === niveau)?.label})
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Légende</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Appliquez un thème pour afficher la légende.
                </CardContent>
              </Card>
            )}

            {/* Bloc établissements uniquement : noms + filtre par statut indicateur */}
            {showEtab && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Options établissements</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Afficher / masquer les noms */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs font-medium leading-snug">
                        Afficher les noms des établissements
                      </Label>
                      <Switch checked={showEtabNames} onCheckedChange={setShowEtabNames} />
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Nom collé au marqueur (contour adapté au fond {baseMap}).
                    </p>
                  </div>

                  {/* Filtre markers par statut de l'indicateur */}
                  <div className="space-y-2 border-t pt-3">
                    <Label className="text-xs font-medium">Filtrer les marqueurs</Label>
                    <div className="space-y-1.5">
                      {(
                        [
                          { value: "all" as const, label: "Tous", color: null },
                          {
                            value: "inf" as const,
                            label:
                              polarity === "higher-better"
                                ? "Excellent / blanc"
                                : "Inférieur / blanc",
                            color: "#FFFFFF",
                          },
                          {
                            value: "entre" as const,
                            label: "Dans la plage / vert",
                            color: "#00AA00",
                          },
                          {
                            value: "sup" as const,
                            label:
                              polarity === "higher-better"
                                ? "Critique / rouge"
                                : "Supérieur / rouge",
                            color: "#FF0000",
                          },
                        ] as const
                      ).map((opt) => (
                        <label
                          key={opt.value}
                          className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5"
                        >
                          <input
                            type="radio"
                            name="etab-status-filter"
                            className="accent-primary"
                            checked={etabStatusFilter === opt.value}
                            onChange={() => setEtabStatusFilter(opt.value)}
                          />
                          {opt.color !== null && (
                            <span
                              className="w-3 h-3 border shrink-0 rounded-sm"
                              style={{ backgroundColor: opt.color }}
                            />
                          )}
                          <span className="flex-1">{opt.label}</span>
                          {opt.value !== "all" && (
                            <span className="tabular-nums text-muted-foreground">
                              {opt.value === "inf"
                                ? recap.low
                                : opt.value === "entre"
                                  ? recap.medium
                                  : recap.high}
                            </span>
                          )}
                          {opt.value === "all" && (
                            <span className="tabular-nums text-muted-foreground">
                              {recap.total}
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Affiche uniquement les établissements correspondant au statut choisi.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Récapitulatif — nombres exacts uniquement */}
            {showRecap && appliedTheme !== "0" && recap.total > 0 ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Récapitulatif {recap.zone}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="flex items-center justify-between font-medium">
                    <span>Nombre total</span>
                    <span className="tabular-nums text-base font-semibold">{recap.total}</span>
                  </div>
                  <div className="border-t pt-2 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 border shrink-0"
                        style={{ backgroundColor: "#FFFFFF" }}
                      />
                      <span className="flex-1">Inférieur</span>
                      <span className="tabular-nums font-semibold">{recap.low}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 shrink-0" style={{ backgroundColor: "#00AA00" }} />
                      <span className="flex-1">Dans la plage</span>
                      <span className="tabular-nums font-semibold">{recap.medium}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 shrink-0" style={{ backgroundColor: "#FF0000" }} />
                      <span className="flex-1">Supérieur</span>
                      <span className="tabular-nums font-semibold">{recap.high}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : appliedTheme !== "0" ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Récapitulatif
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Aucune donnée à résumer pour la couche active.
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </div>

      <Dialog open={showDownloadModal} onOpenChange={setShowDownloadModal}>
        <DialogContent className="sm:max-w-xl z-[10000]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Download className="h-5 w-5" />
              Exporter la carte thématique
            </DialogTitle>
            <DialogDescription>
              Choisissez le format d&apos;export pour les données actuellement affichées.
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 space-y-6">
            <div className="bg-muted/50 rounded-xl p-5 text-sm">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-2xl font-semibold text-primary">
                    {activeExportDataset.rows.length}
                  </div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {activeExportDataset.label}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-primary">
                    {THEMES.find((t) => t.value === appliedTheme)?.label || "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">Thème appliqué</div>
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground mb-3">FORMATS DE DONNÉES</p>
              <div className="grid grid-cols-3 gap-3">
                <Button
                  onClick={downloadCSV}
                  variant="outline"
                  className="h-20 flex-col gap-1"
                  disabled={activeExportDataset.rows.length === 0}
                >
                  <Download className="h-5 w-5" />
                  <span className="text-xs">CSV</span>
                </Button>
                <Button
                  onClick={downloadExcel}
                  variant="outline"
                  className="h-20 flex-col gap-1"
                  disabled={activeExportDataset.rows.length === 0}
                >
                  <FileSpreadsheet className="h-5 w-5" />
                  <span className="text-xs">Excel</span>
                </Button>
                <Button
                  onClick={downloadJSON}
                  variant="outline"
                  className="h-20 flex-col gap-1"
                  disabled={activeExportDataset.rows.length === 0}
                >
                  <FileJson className="h-5 w-5" />
                  <span className="text-xs">JSON</span>
                </Button>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground mb-3">IMAGE DE LA CARTE</p>
              <Button
                onClick={handleCaptureMap}
                variant="default"
                className="w-full h-16 gap-2"
                disabled={loading}
              >
                <FileImage className="h-5 w-5" />
                Capturer la carte (PNG)
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDownloadModal(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DataViz;
