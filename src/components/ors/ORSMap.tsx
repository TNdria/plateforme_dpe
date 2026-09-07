import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Circle,
  Marker,
  LayersControl,
  useMap,
  GeoJSON,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { Etablissement, Village, GeoJSONFeature } from "@/hooks/useMapData";
import { MapLegend } from "./MapLegend";
import { SpatialGrid } from "@/lib/spatialGrid";
import { CanvasMarkersLayer, CanvasPoint } from "./CanvasMarkersLayer";
import { MapInteractions, VillageAnalysisResult } from "./MapInteractions";
import type { LayerVisibility, TableBancFilter } from "@/components/ors/MapFilters";
import { ETABLISSEMENT_ICON_CLASSES, type EtablissementIconType } from "@/lib/etablissementIcons";

// Fix for default markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const MAPBOX_TOKEN =
  "pk.eyJ1IjoidG9reSIsImEiOiJjbTE4djVndXIxNmQwMmxzam1nY3JzcWU0In0.KtMOpNhicsXZkbmcFtVd8w";

// Styles matching original jQuery
// NB: ces deux hex doivent rester synchronisés avec ORS_COLORS.limiteDren /
// ORS_COLORS.limiteCisco (déclarées plus bas) — la légende (ORS.tsx) importe
// ORS_COLORS pour ces mêmes couleurs de limite administrative.
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

interface ORSMapProps {
  colleges: Etablissement[];
  primaires: Etablissement[];
  radius: number;
  type: "primaire" | "college" | "lycee";
  onMarkerClick?: (etablissement: Etablissement) => void;
  center?: [number, number];
  zoom?: number;
  categoryFilter?: string;
  /** Filtre éligibles / non-éligibles quand un critère est actif (règles du
   * 03/09/2026) — sans effet si categoryFilter === "aucune". */
  eligibiliteFilter?: EligibiliteFilter;
  geoLayers?: {
    dren?: GeoJSONFeature;
    cisco?: GeoJSONFeature;
    commune?: GeoJSONFeature;
    fokontany?: GeoJSONFeature;
  };
  villages?: Village[];
  /** Callback quand l'utilisateur lance une analyse village via le clic droit */
  onVillageAnalysis?: (r: VillageAnalysisResult) => void;
  showLegend?: boolean;
  /** Visibilité des couches (déjà pré-filtrée côté ORS, utile pour cohérence / overlays). */
  layerVisibility?: LayerVisibility;
  /** Filtre table-bancs : tous | suffisant | insuffisant (college / lycée). */
  tableBancFilter?: TableBancFilter;
  /** Active les infos établissement sur la carte. */
  etabInfoVisible?: boolean;
}

const MapCenterUpdater = ({ center, zoom }: { center: [number, number]; zoom: number }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom, { duration: 0.5 });
    }
  }, [center, zoom, map]);
  return null;
};

/**
 * Leaflet calcule sa taille au montage seulement. Quand les panneaux ORS sont
 * repliés/dépliés, la zone centrale change de largeur sans remonter de resize
 * window : on observe donc directement le conteneur de la carte pour qu'elle
 * utilise toujours tout l'espace qui lui est attribué.
 */
const MapSizeUpdater = () => {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const updateSize = () => {
      map.invalidateSize({ animate: false, pan: false, debounceMoveend: true });
    };

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);
    updateSize();

    return () => resizeObserver.disconnect();
  }, [map]);

  return null;
};

// Espacement (en px) entre chaque élément du bloc de contrôles "topleft"
// (boussole / zoom / reset / badge de niveau de zoom). Un seul nombre, une
// seule source de vérité — avant cette correction, ces 4 éléments étaient 3
// composants Leaflet indépendants empilés via des `marginTop` codés en dur
// et accumulés (58px, puis +34px, puis +76px), ce qui donnait des
// espacements inégaux et impossibles à corriger proprement (cf. capture
// d'écran du 26/08/2026).
const TOPLEFT_STACK_GAP = 6;

/** Bloc unique de contrôles "topleft" : boussole, zoom +/-, reset, badge de
 * niveau de zoom — un seul <L.Control>, une seule colonne flex, un seul gap
 * partagé (TOPLEFT_STACK_GAP). Remplace les 3 composants précédents
 * (CompassControl, ZoomIndicatorControl, et le bouton reset de
 * MapEnhancements) qui s'empilaient indépendamment avec des décalages en
 * pixels devinés à la main. Le zoom natif de MapContainer est désactivé
 * (zoomControl={false}) : les boutons +/- sont reconstruits ici avec les
 * mêmes classes CSS Leaflet (look natif identique, état désactivé au
 * zoom min/max) pour pouvoir vivre dans la même colonne que le reste. */
const MapTopLeftControls = () => {
  const map = useMap();

  useEffect(() => {
    const Ctrl = L.Control.extend({
      options: { position: "topleft" as L.ControlPosition },
      onAdd() {
        const container = L.DomUtil.create("div", "ors-topleft-stack");
        container.style.cssText = `display:flex;flex-direction:column;align-items:center;gap:${TOPLEFT_STACK_GAP}px;`;
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);

        // 1. Boussole (décorative)
        const compass = L.DomUtil.create("div", "leaflet-control", container);
        compass.style.cssText =
          "margin:0;background:rgba(255,255,255,0.95);border:2px solid #d1d5db;border-radius:50%;padding:5px;box-shadow:0 2px 8px rgba(0,0,0,0.18);width:42px;height:42px;display:flex;align-items:center;justify-content:center;pointer-events:none;";
        compass.innerHTML = `<img src="/img/Nord.png" alt="Nord" style="width:32px;height:32px;object-fit:contain;" title="Nord" />`;

        // 2. Zoom +/- (reconstruit avec les classes natives Leaflet pour un
        //    rendu et un comportement identiques au contrôle natif : état
        //    "disabled" correct au zoom min/max)
        const zoomBar = L.DomUtil.create(
          "div",
          "leaflet-bar leaflet-control leaflet-control-zoom",
          container,
        );
        zoomBar.style.margin = "0";
        const zoomIn = L.DomUtil.create(
          "a",
          "leaflet-control-zoom-in",
          zoomBar,
        ) as HTMLAnchorElement;
        zoomIn.href = "#";
        zoomIn.title = "Zoom avant";
        zoomIn.innerHTML = "+";
        const zoomOut = L.DomUtil.create(
          "a",
          "leaflet-control-zoom-out",
          zoomBar,
        ) as HTMLAnchorElement;
        zoomOut.href = "#";
        zoomOut.title = "Zoom arrière";
        zoomOut.innerHTML = "−";
        const updateZoomButtons = () => {
          zoomIn.classList.toggle("leaflet-disabled", map.getZoom() >= map.getMaxZoom());
          zoomOut.classList.toggle("leaflet-disabled", map.getZoom() <= map.getMinZoom());
        };
        L.DomEvent.on(zoomIn, "click", (e) => {
          L.DomEvent.preventDefault(e);
          if (!zoomIn.classList.contains("leaflet-disabled")) map.zoomIn();
        });
        L.DomEvent.on(zoomOut, "click", (e) => {
          L.DomEvent.preventDefault(e);
          if (!zoomOut.classList.contains("leaflet-disabled")) map.zoomOut();
        });

        // 3. Reset (recentrage sur Madagascar)
        const reset = L.DomUtil.create(
          "a",
          "leaflet-bar leaflet-control leaflet-control-custom",
          container,
        ) as HTMLAnchorElement;
        reset.href = "#";
        reset.title = "Réinitialiser la vue";
        reset.style.cssText =
          "margin:0;background:#fff;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:14px;text-decoration:none;color:#1f2937;border:1px solid #d1d5db;border-radius:4px;box-shadow:0 1px 6px rgba(0,0,0,0.15);";
        reset.innerHTML = "⟲";
        L.DomEvent.on(reset, "click", (e) => {
          L.DomEvent.preventDefault(e);
          map.flyTo([-18.91891771052786, 47.51385211944581], 6);
        });

        // 4. Badge "Niveau de zoom"
        const badge = L.DomUtil.create("div", "", container);
        badge.id = "ors-zoom-indicator";
        badge.style.cssText =
          "margin:0;background:rgba(39,39,42,0.78);color:#fff;border-radius:4px;padding:4px 10px;font-size:12px;line-height:1.2;box-shadow:0 1px 6px rgba(0,0,0,0.18);";
        const updateBadge = () => {
          badge.innerHTML = `Niveau de Zoom: ${map.getZoom()}`;
        };
        updateBadge();

        const onZoomEnd = () => {
          updateZoomButtons();
          updateBadge();
        };
        updateZoomButtons();
        map.on("zoomend", onZoomEnd);
        (container as any)._orsCleanup = () => map.off("zoomend", onZoomEnd);

        return container;
      },
      onRemove() {
        (this as any)._container?._orsCleanup?.();
      },
    });

    const ctrl = new Ctrl();
    ctrl.addTo(map);
    return () => {
      ctrl.remove();
    };
  }, [map]);

  return null;
};

/** Injecte une feuille de style globale, une seule fois, pour :
 * 1) le sous-menu (clic droit) : Leaflet plafonne le "popupPane" à
 *    z-index 700 dans son propre CSS, sous nos contrôles ("leaflet-top" est
 *    à z-index 1000) — le sous-menu contextuel pouvait donc apparaître
 *    partiellement SOUS le bloc boussole/zoom/reset ou le panneau de
 *    couches. On remonte tout le popupPane au-dessus de 1000.
 * 2) une garde-fou générique pour toute future popup Leaflet du module ORS. */
const MapGlobalStyles = () => {
  useEffect(() => {
    const STYLE_ID = "ors-map-global-styles";
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .leaflet-popup-pane { z-index: 1200 !important; }
      .ors-context-popup .leaflet-popup-content-wrapper { padding: 2px; }
    `;
    document.head.appendChild(style);
    // Volontairement jamais retiré : cette feuille de style est partagée par
    // toutes les instances de la carte (id unique évite les doublons).
  }, []);
  return null;
};

/** Barre d'échelle Leaflet (bottom-left par défaut) — séparée du bloc
 * "topleft" ci-dessus, elle vivait avant dans MapEnhancements aux côtés du
 * bouton reset, qui a migré dans MapTopLeftControls. */
const MapScaleControl = () => {
  const map = useMap();
  useEffect(() => {
    const scale = L.control.scale({ imperial: false }).addTo(map);
    return () => {
      scale.remove();
    };
  }, [map]);
  return null;
};

// Helper: compute extensions value
function getExtensions(etab: Etablissement): number {
  const sdc_requis = etab.sdc_requis || 0;
  const sdc_be = etab.sdc_be || 0;
  const sdc_me = etab.sdc_me || 0;
  return Math.max(sdc_requis - (sdc_be + sdc_me), 0);
}

// Helper: get table-bancs need
function getTableBancsNeed(etab: Etablissement): number {
  const eff = etab.effectifs || 0;
  const places = etab.places || 0;
  return Math.ceil(Math.max(eff - places, 0) / 2);
}

/** true si places assises suffisantes pour les effectifs */
function hasSufficientTableBancs(etab: Etablissement): boolean {
  return (etab.places || 0) >= (etab.effectifs || 0);
}

/** Filtre table-bancs appliqué aux établissements (college / lycée). */
function matchesTableBancFilter(etab: Etablissement, filter: TableBancFilter | undefined): boolean {
  if (!filter || filter === "tous") return true;
  const ok = hasSufficientTableBancs(etab);
  return filter === "suffisant" ? ok : !ok;
}

// Couleurs : voir "./orsColors" — module neutre, sans dépendance, réexporté
// ici pour que les imports existants (`from "@/components/ors/ORSMap"`)
// continuent de fonctionner sans changement. Ce fichier ne redéclare plus
// les couleurs lui-même : ça évite un import circulaire avec MapLegend.tsx,
// qui a lui aussi besoin de ces constantes (cf. audit du 19/08/2026).
export {
  ORS_COLORS,
  NIVEAU_MAIN_COLOR,
  isPublicSecteur,
  isPrivateSecteur,
  secteurLabel,
} from "./orsColors";
import {
  ORS_COLORS,
  NIVEAU_MAIN_COLOR,
  AIRE_RECRUTEMENT_RADIUS,
  isPublicSecteur,
  isPrivateSecteur,
  secteurLabel,
} from "./orsColors";

const createEtablissementIcon = (iconType: EtablissementIconType, color: string) => {
  const html = `<i class="${ETABLISSEMENT_ICON_CLASSES[iconType]}" style="color:${color};font-size:20px;line-height:28px;text-shadow:0 1px 2px rgba(15,23,42,.35)" aria-hidden="true"></i>`;

  return L.divIcon({
    className: "ors-etablissement-marker",
    html,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

const createEtablissementIconHtml = (iconType: EtablissementIconType, color: string) =>
  createEtablissementIcon(iconType, color).options.html as string;

// Icône village (règles du 05/09/2026) : "fas fa-home", pas un simple point,
// cohérent avec la légende. Taille réduite par rapport aux établissements
// pour rester lisible malgré la densité potentiellement élevée de villages.
const createVillageIconHtml = (color: string) =>
  `<i class="fas fa-home" style="color:${color};font-size:16px;line-height:22px;text-shadow:0 1px 2px rgba(15,23,42,.35)" aria-hidden="true"></i>`;

// Éligibilité (booléenne) d'un établissement pour le critère actif — sert à
// la fois à la couleur (getCategoryColor) et au nouveau filtre
// éligibles/non-éligibles (règles du 03/09/2026).
function isEtabEligible(etab: Etablissement, categoryFilter: string): boolean {
  switch (categoryFilter) {
    case "extension":
      return getExtensions(etab) > 0;
    case "reconstruction":
      return !!etab.eligible_reconstruction;
    case "rehabilitation":
      return !!etab.eligible_rehabilitation;
    case "tablebanc":
      return !hasSufficientTableBancs(etab);
    default:
      return true;
  }
}

// Couleur d'un établissement selon le critère actif — schéma binaire
// éligible (#00a638) / non éligible (#fa2328), règles validées le
// 03/09/2026. "nouvelle_creation" ne concerne plus les établissements (ils
// sont masqués dans ce mode) : pas de cas dédié ici.
function getCategoryColor(etab: Etablissement, categoryFilter: string): string {
  if (categoryFilter === "aucune") return ORS_COLORS.default;
  return isEtabEligible(etab, categoryFilter) ? ORS_COLORS.eligible : ORS_COLORS.nonEligible;
}

export type EligibiliteFilter = "tous" | "eligible" | "non_eligible";

function matchesEligibiliteFilter(
  etab: Etablissement,
  categoryFilter: string,
  eligibiliteFilter: EligibiliteFilter | undefined,
): boolean {
  if (!eligibiliteFilter || eligibiliteFilter === "tous") return true;
  const eligible = isEtabEligible(etab, categoryFilter);
  return eligibiliteFilter === "eligible" ? eligible : !eligible;
}

// Un critère "établissement" (par opposition à nouvelle_creation, qui cible
// les villages) est actif.
const isEtabCriterionActive = (categoryFilter: string) =>
  categoryFilter !== "aucune" && categoryFilter !== "nouvelle_creation";

// Build detailed popup HTML for ORS establishments
function buildOrsPopup(
  etab: Etablissement,
  categoryFilter: string,
  type: ORSMapProps["type"],
): string {
  const is_reconst = etab.eligible_reconstruction ? "OUI" : "NON";
  const is_rehab = etab.eligible_rehabilitation ? "OUI" : "NON";
  const extensions = getExtensions(etab);
  const tableBancs = getTableBancsNeed(etab);

  const highlightStyle = (field: string) =>
    categoryFilter === field ? "background:#ddd;font-weight:bold" : "";

  const eligibilityRows =
    type === "primaire"
      ? `<tr><th style="padding:4px;text-align:left">EFFECTIF T5</th><td style="text-align:right;padding:4px">${etab.eff_t5 ?? "-"}</td></tr>
         <tr><th style="padding:4px;text-align:left">EFFECTIF 2024</th><td style="text-align:right;padding:4px">${etab.eff_2024 ?? "-"}</td></tr>`
      : `<tr><th style="padding:4px;text-align:left">RECONSTRUCTION</th><td style="text-align:right;padding:4px">${is_reconst}</td></tr>
         <tr><th style="padding:4px;text-align:left">RÉHABILITATION</th><td style="text-align:right;padding:4px">${is_rehab}</td></tr>`;

  return `<div style="min-width:240px">
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="background:#4e73df;color:white"><th colspan="2" style="padding:6px;text-align:center">${etab.NOM_ETAB}</th></tr></thead>
      <tbody>
        <tr><th style="padding:4px;text-align:left">CODE</th><td style="text-align:right;padding:4px">${etab.CODE_ETAB ?? "-"}</td></tr>
        <tr><th style="padding:4px;text-align:left">SECTEUR</th><td style="text-align:right;padding:4px">${secteurLabel(etab)}</td></tr>
        <tr><th style="padding:4px;text-align:left">COMMUNE</th><td style="text-align:right;padding:4px">${etab.COMMUNE ?? "-"}</td></tr>
        <tr><th style="padding:4px;text-align:left">FOKONTANY</th><td style="text-align:right;padding:4px">${etab.FOKONTANY ?? "-"}</td></tr>
        <tr><th style="padding:4px;text-align:left">EFFECTIFS</th><td style="text-align:right;padding:4px">${etab.effectifs || "-"}</td></tr>
        ${eligibilityRows}
        <tr><th style="padding:4px;text-align:left">SALLE BON ETAT</th><td style="text-align:right;padding:4px;${(etab.sdc_be || 0) === 0 ? "color:red;font-weight:bold" : ""}">${etab.sdc_be ?? "-"}</td></tr>
        <tr><th style="padding:4px;text-align:left">SALLE MAUVAIS ETAT</th><td style="text-align:right;padding:4px">${etab.sdc_me ?? "-"}</td></tr>
        <tr><th style="padding:4px;text-align:left">SALLE REQUIS</th><td style="text-align:right;padding:4px">${etab.sdc_requis ?? "-"}</td></tr>
        <tr><th style="padding:4px;text-align:left">PLACES ASSISES</th><td style="text-align:right;padding:4px;${(etab.places || 0) === 0 ? "color:red;font-weight:bold" : ""}">${etab.places ?? "-"}</td></tr>
        <tr style="${highlightStyle("extension")}"><th style="padding:4px;text-align:left">BESOIN EXTENSIONS</th><td style="text-align:right;padding:4px">${extensions}</td></tr>
        <tr style="${highlightStyle("tablebanc")}"><th style="padding:4px;text-align:left">TABLE-BANCS 2PL</th><td style="text-align:right;padding:4px">${tableBancs}</td></tr>
      </tbody>
    </table>
  </div>`;
}

export const ORSMap = ({
  colleges,
  primaires,
  radius,
  type,
  onMarkerClick,
  center = [-18.9189596, 47.5135653],
  zoom = 6,
  categoryFilter = "aucune",
  eligibiliteFilter = "tous",
  geoLayers = {},
  villages = [],
  onVillageAnalysis,
  showLegend = true,
  layerVisibility,
  tableBancFilter = "tous",
  etabInfoVisible = true,
}: ORSMapProps) => {
  const [leafletMap, setLeafletMap] = useState<L.Map | null>(null);
  const [hoveredEtablissement, setHoveredEtablissement] = useState<Etablissement | null>(null);
  // Aires de recrutement (règles du 03/09/2026) : quand renseigné, seule
  // l'aire de cet établissement est dessinée (clic droit → "Voir aire de
  // recrutement"). Réinitialisé quand la couche est désactivée.
  const [isolatedAireEtabId, setIsolatedAireEtabId] = useState<string | number | null>(null);

  const isSectorLayerActive =
    Boolean(layerVisibility?.publiques ?? true) || Boolean(layerVisibility?.prives ?? true);

  // Interférence événementielle (audit) : tant que la couche "Aires de
  // recrutement" est visible (toggle général ou isolation via clic droit),
  // l'événement info-bulle sur les marqueurs doit rester désactivé — les
  // deux ne doivent jamais se déclencher en même temps sur la même zone.
  const airesActive = Boolean(layerVisibility?.aires) || isolatedAireEtabId != null;

  const matchesLayerVisibility = useCallback(
    (etab: Etablissement) => {
      const publicVisible = layerVisibility?.publiques ?? true;
      const privateVisible = layerVisibility?.prives ?? true;

      if (isPublicSecteur(etab)) return publicVisible;
      if (isPrivateSecteur(etab)) return privateVisible;
      return publicVisible || privateVisible;
    },
    [layerVisibility],
  );

  const showEtablissementInfo = useCallback(
    (etablissement: Etablissement) => {
      if (airesActive) {
        // Sortie immédiate : aucune entrée d'event info-bulle tant que les
        // aires sont affichées.
        setHoveredEtablissement(null);
        return;
      }
      if (!etabInfoVisible) {
        setHoveredEtablissement(null);
        return;
      }
      if (!isSectorLayerActive || !matchesLayerVisibility(etablissement)) {
        setHoveredEtablissement(null);
        return;
      }
      setHoveredEtablissement(etablissement);
    },
    [airesActive, etabInfoVisible, isSectorLayerActive, matchesLayerVisibility],
  );

  const clearHoveredEtablissement = useCallback(() => {
    setHoveredEtablissement(null);
  }, []);

  useEffect(() => {
    if (!etabInfoVisible) {
      setHoveredEtablissement(null);
    }
  }, [etabInfoVisible]);

  // Sortie forcée de l'event info-bulle dès que les aires de recrutement
  // s'affichent (toggle ou isolation) — pas seulement bloquée à la prochaine
  // entrée, une info-bulle déjà ouverte au moment du toggle doit disparaître
  // immédiatement.
  useEffect(() => {
    if (airesActive) {
      setHoveredEtablissement(null);
    }
  }, [airesActive]);

  const bindEtablissementHover = useCallback(
    (etab: Etablissement) => ({
      mouseover: () => showEtablissementInfo(etab),
      mouseout: () => clearHoveredEtablissement(),
    }),
    [showEtablissementInfo, clearHoveredEtablissement],
  );

  const handleMarkerClick = useCallback(
    (etab: Etablissement) => {
      onMarkerClick?.(etab);
    },
    [onMarkerClick],
  );

  const collegesWithCoords = useMemo(
    () => colleges.filter((etab) => etab.latitude && etab.longitude),
    [colleges],
  );

  const primairesWithCoords = useMemo(
    () => primaires.filter((etab) => etab.latitude && etab.longitude),
    [primaires],
  );

  // Calcule si un établissement "secondaire" (référence) est hors zone de son
  // "principal" — grille spatiale O(N). Généralisé pour couvrir collège ET
  // lycée (auparavant câblé en dur sur `type === "college"`, ce qui faisait
  // que la page Lycée n'affichait JAMAIS de collège en rouge alors que
  // ORSAnalysisPanel comptait bien des "CEG hors zone" dans son panneau —
  // incohérence carte / chiffres corrigée ici).
  //
  // Contrat ORS : pour "college", le principal est le CEG (collegesWithCoords)
  // et on évalue les EPP (primairesWithCoords). Pour "lycee", les lycées sont
  // portés par le slot "primaires" (cf. commentaire plus haut sur le contrat
  // ORS), le principal est donc primairesWithCoords et on évalue les collèges
  // (collegesWithCoords).
  const getSecondaryExcluded = useMemo(() => {
    const exclusionMap = new Map<string | number, boolean>();
    if (type === "primaire") return exclusionMap;

    const gridSource = type === "college" ? collegesWithCoords : primairesWithCoords;
    const evaluated = type === "college" ? primairesWithCoords : collegesWithCoords;

    if (gridSource.length === 0) return exclusionMap;
    // Rayon FIXE d'aire de recrutement (2/5/20 km) — primaire / collège / lycée.
    // Aligné sur la couverture villages ; indépendant du slider.
    const aire = AIRE_RECRUTEMENT_RADIUS[type];
    const grid = new SpatialGrid(
      gridSource as Array<{ latitude: number; longitude: number }>,
      aire,
    );
    for (const item of evaluated) {
      // Seuls les établissements publics sont évalués pour l'exclusion hors zone
      if (!isPublicSecteur(item)) {
        exclusionMap.set(item.CODE_ETAB, false);
        continue;
      }
      const isExcluded = !grid.hasNeighborWithin(item.latitude!, item.longitude!, aire);
      exclusionMap.set(item.CODE_ETAB, isExcluded);
    }
    return exclusionMap;
  }, [type, primairesWithCoords, collegesWithCoords]);

  // Fix (règles du 03/09/2026) : la couverture village par aire de
  // recrutement s'applique désormais aux 3 niveaux (avant : primaire
  // seulement), avec un rayon FIXE par niveau au lieu du rayon ajustable par
  // slider (qui reste utilisé ailleurs : clic droit générique "Voir l'aire",
  // analyse détaillée d'un village).
  const aireRadius = AIRE_RECRUTEMENT_RADIUS[type];
  // Après filtre DREN/CISCO : les villages passés ici sont déjà ceux de la
  // zone (via useMapData). Leur affichage dépend UNIQUEMENT de
  // layerVisibility.villages (ORS.tsx → filteredVillages). Couleurs :
  //   - couvert   : dist ≤ aire de recrutement fixe (2/5/20 km selon niveau)
  //   - hors zone : dist > aire  → ORS_COLORS.villageHorsZone
  // Si aucune école publique de référence dans la zone, tous les villages
  // sont traités hors zone (distance = Infinity), pas masqués.
  const villagesWithDistance = useMemo(() => {
    if (villages.length === 0) return [];
    const source = type === "college" ? collegesWithCoords : primairesWithCoords;
    const ecolesPub = source.filter((e) => isPublicSecteur(e)) as Array<{
      latitude: number;
      longitude: number;
    }>;
    const withCoords = villages.filter((v) => v.latitude && v.longitude);
    if (ecolesPub.length === 0) {
      return withCoords.map((v) => ({ ...v, distToNearestSchool: Number.POSITIVE_INFINITY }));
    }
    const grid = new SpatialGrid(ecolesPub, aireRadius * 2);
    return withCoords.map((v) => ({
      ...v,
      distToNearestSchool: grid.nearestDistance(v.latitude, v.longitude, aireRadius * 4),
    }));
  }, [type, villages, primairesWithCoords, collegesWithCoords, aireRadius]);

  const getMainColor = () => {
    switch (type) {
      case "lycee":
        return NIVEAU_MAIN_COLOR.lycee;
      case "college":
        return NIVEAU_MAIN_COLOR.college;
      default:
        return ORS_COLORS.default;
    }
  };

  // GeoJSON styles
  const geoJsonStyle = (layerType: string) => {
    switch (layerType) {
      case "dren":
        return STYLE_DREN;
      case "cisco":
        return STYLE_CISCO;
      case "commune":
        return STYLE_COMMUNE;
      default:
        return STYLE_COMMUNE;
    }
  };

  const onEachFeature = (feature: any, layer: L.Layer) => {
    if (feature.properties?.name) {
      (layer as L.Path).bindTooltip(feature.properties.name, {
        permanent: false,
        opacity: 1,
        direction: "top",
      });
    }
  };

  // Determine main establishments (colleges for college type, lycees for lycee type)
  // Contrat ORS : pour le lycée, les lycées transitent via le slot "primaires".
  //
  // Bug métier corrigé (audit du 19/08/2026) : cette liste n'était filtrée ni
  // par secteur ni par la couche "publiques", alors que la légende annonce
  // explicitement "CEG public" / "Lycée public" et que chaque élément reçoit
  // un cercle de rayon de couverture. Un CEG/Lycée PRIVÉ s'affichait donc à
  // tort comme "institution publique de référence" avec sa propre zone de
  // couverture. On restreint désormais mainEstablishments aux établissements
  // publics ET visibles (layerVisibility.publiques) ; les CEG/Lycées privés
  // (s'il en existe) basculent dans privatePoints, traités comme les autres
  // établissements privés (marqueur simple, sans cercle de rayon).
  const mainEstablishments = useMemo(() => {
    let list: Etablissement[] = [];
    if (type === "college") list = collegesWithCoords;
    else if (type === "lycee") list = primairesWithCoords;
    list = list.filter((e) => isPublicSecteur(e) && (layerVisibility?.publiques ?? true));
    // Filtre table-bancs sur les établissements principaux (college / lycée)
    if (type !== "primaire") {
      list = list.filter((e) => matchesTableBancFilter(e, tableBancFilter));
    }
    return list;
  }, [type, collegesWithCoords, primairesWithCoords, tableBancFilter, layerVisibility]);

  // Secondary establishments
  const secondaryEstablishments = useMemo(() => {
    let list: Etablissement[] = [];
    if (type === "college") list = primairesWithCoords;
    else if (type === "lycee") list = collegesWithCoords;
    else if (type === "primaire") list = primairesWithCoords;
    return list.filter((etab) => matchesLayerVisibility(etab));
  }, [type, collegesWithCoords, primairesWithCoords, matchesLayerVisibility]);

  // Pre-compute lightweight point arrays for the canvas layer (no React VDOM per marker)
  // College / lycée : couche secondaire = établissements publics uniquement
  // (les privés sont dans privatePoints pour éviter la double affichage).
  const secondaryPoints = useMemo<CanvasPoint[]>(() => {
    // Nouvelle Création (primaire uniquement) : établissements masqués.
    if (categoryFilter === "nouvelle_creation") return [];

    const source =
      type === "primaire"
        ? secondaryEstablishments
        : secondaryEstablishments.filter((e) => isPublicSecteur(e));

    const isEtabCriterion = isEtabCriterionActive(categoryFilter);
    const filteredSource = isEtabCriterion
      ? source.filter((etab) => matchesEligibiliteFilter(etab, categoryFilter, eligibiliteFilter))
      : source;

    return filteredSource.map((etab) => {
      const isPublic = isPublicSecteur(etab);
      const isExcluded =
        type !== "primaire" && !isEtabCriterion
          ? getSecondaryExcluded.get(etab.CODE_ETAB) || false
          : false;
      let fillColor: string;
      if (isEtabCriterion) {
        // Extension / Reconstruction / Réhabilitation / Table-bancs :
        // couleur uniquement par éligibilité, public et privé confondus.
        fillColor = getCategoryColor(etab, categoryFilter);
      } else {
        fillColor = isPublic ? ORS_COLORS.default : ORS_COLORS.prive;
      }
      const pixelRadius = type === "lycee" ? 7 : 5;
      const useCustomPopup = categoryFilter !== "aucune";
      const iconType: EtablissementIconType = type === "lycee" ? "college" : "primaire";
      return {
        id: etab.CODE_ETAB,
        lat: etab.latitude!,
        lng: etab.longitude!,
        color: isExcluded ? ORS_COLORS.nonEligible : fillColor,
        fillColor,
        fillOpacity: isExcluded ? 0.95 : 0.75,
        weight: isExcluded ? 2 : 1,
        radius: pixelRadius,
        iconHtml: createEtablissementIconHtml(
          iconType,
          isExcluded ? ORS_COLORS.nonEligible : fillColor,
        ),
        popupHtml: () =>
          useCustomPopup
            ? buildOrsPopup(etab, categoryFilter, type)
            : buildOrsPopup(etab, "aucune", type),
        onClick: () => handleMarkerClick(etab),
        onMouseOver: () => showEtablissementInfo(etab),
        onMouseOut: () => clearHoveredEtablissement(),
      };
    });
  }, [
    secondaryEstablishments,
    type,
    categoryFilter,
    eligibiliteFilter,
    getSecondaryExcluded,
    showEtablissementInfo,
    clearHoveredEtablissement,
    handleMarkerClick,
  ]);

  const privatePoints = useMemo<CanvasPoint[]>(() => {
    if (type === "primaire") return [];
    // Nouvelle Création (primaire uniquement) : sans objet ici puisque
    // privatePoints est déjà vide en primaire, mais gardé par cohérence.
    if (categoryFilter === "nouvelle_creation") return [];
    // Fix : utiliser bien la couche "privés".
    const privateVisible = layerVisibility?.prives ?? true;

    // Établissements "secondaires" privés (EPP privées pour la vue collège,
    // collèges privés pour la vue lycée) — logique déjà existante.
    const privateSecondary = secondaryEstablishments.filter(
      (e) => isPrivateSecteur(e) && privateVisible,
    );

    // CEG/Lycées privés (le "principal" du niveau) — auparavant absorbés à
    // tort dans mainEstablishments (cf. fix ci-dessus) ou tout simplement
    // invisibles pour le lycée. Ils rejoignent ici le même traitement visuel
    // que les autres établissements privés (marqueur simple, sans cercle).
    const mainSource = type === "college" ? collegesWithCoords : primairesWithCoords;
    const privateMain = mainSource.filter((e) => isPrivateSecteur(e) && privateVisible);

    const withIconType = [
      ...privateSecondary.map((etab) => ({
        etab,
        iconType: (type === "lycee" ? "college" : "primaire") as EtablissementIconType,
      })),
      ...privateMain.map((etab) => ({
        etab,
        iconType: type as EtablissementIconType,
      })),
    ].filter(({ etab }) =>
      isEtabCriterionActive(categoryFilter)
        ? matchesEligibiliteFilter(etab, categoryFilter, eligibiliteFilter)
        : true,
    );

    return withIconType.map(({ etab, iconType }) => {
      const color = isEtabCriterionActive(categoryFilter)
        ? getCategoryColor(etab, categoryFilter)
        : ORS_COLORS.prive;
      return {
        id: `priv-${etab.CODE_ETAB}`,
        lat: etab.latitude!,
        lng: etab.longitude!,
        color,
        fillColor: color,
        fillOpacity: 0.75,
        weight: 1,
        radius: 5,
        iconHtml: createEtablissementIconHtml(iconType, color),
        popupHtml: () => buildOrsPopup(etab, categoryFilter, type),
        onClick: () => handleMarkerClick(etab),
        onMouseOver: () => showEtablissementInfo(etab),
        onMouseOut: () => clearHoveredEtablissement(),
      };
    });
  }, [
    secondaryEstablishments,
    collegesWithCoords,
    primairesWithCoords,
    type,
    categoryFilter,
    eligibiliteFilter,
    layerVisibility,
    showEtablissementInfo,
    clearHoveredEtablissement,
    handleMarkerClick,
  ]);

  // Source des cercles "aires de recrutement" : mêmes établissements de
  // référence que la couverture village (primairesWithCoords publics pour
  // primaire/lycée — les lycées transitent par le slot "primaires", cf.
  // contrat ORS —, collegesWithCoords publics pour collège).
  const aireSourceEtablissements = useMemo(() => {
    const source = type === "college" ? collegesWithCoords : primairesWithCoords;
    return source.filter((e) => isPublicSecteur(e));
  }, [type, collegesWithCoords, primairesWithCoords]);

  // NB : l'isolation (isolatedAireEtabId) n'est PAS liée au toggle général
  // layerVisibility.aires — le clic droit "Voir aire de recrutement" doit
  // fonctionner même si la couche générale est désactivée.

  const villagePoints = useMemo<CanvasPoint[]>(() => {
    // Extension / Reconstruction / Réhabilitation / Table-bancs : villages
    // masqués (règles du 03/09/2026).
    if (isEtabCriterionActive(categoryFilter)) return [];

    const isNouvelleCreation = categoryFilter === "nouvelle_creation";

    const withEligibility = villagesWithDistance.map((v) => {
      const isOutsideAire = v.distToNearestSchool > aireRadius;
      const popSuffisante = (v.population || 0) >= 300;
      const eligible = isOutsideAire && popSuffisante;
      return { v, isOutsideAire, eligible };
    });

    const filtered =
      isNouvelleCreation && eligibiliteFilter !== "tous"
        ? withEligibility.filter(({ eligible }) =>
            eligibiliteFilter === "eligible" ? eligible : !eligible,
          )
        : withEligibility;

    return filtered.map(({ v, isOutsideAire, eligible }, idx) => {
      if (isNouvelleCreation) {
        const popSuffisante = (v.population || 0) >= 300;
        const color = eligible ? ORS_COLORS.eligible : ORS_COLORS.nonEligible;
        const reason = !isOutsideAire
          ? "Une école existe déjà à proximité"
          : !popSuffisante
            ? `Population insuffisante (seuil 300, aire ${(aireRadius / 1000).toFixed(1)} km)`
            : `Critères remplis (aire ${(aireRadius / 1000).toFixed(1)} km)`;
        return {
          id: `vlg-${idx}`,
          lat: v.latitude,
          lng: v.longitude,
          color,
          fillColor: color,
          fillOpacity: 0.85,
          weight: 1,
          radius: 5,
          iconHtml: createVillageIconHtml(color),
          popupHtml: () => `<div style="padding:6px;min-width:170px">
              <b style="font-size:12px">${v.name ?? ""}</b>
              <p style="font-size:11px;margin:2px 0">Population: ${v.population || 0}</p>
              <p style="font-size:11px;margin:2px 0">${reason}</p>
              <div style="margin-top:4px;padding:3px;background:${eligible ? "#dcfce7" : "#fee2e2"};color:${eligible ? "#166534" : "#b91c1c"};font-weight:bold;font-size:11px;text-align:center;border-radius:4px">
                ${eligible ? "ÉLIGIBLE — NOUVELLE CRÉATION" : "NON ÉLIGIBLE"}
              </div>
            </div>`,
        };
      }

      // État par défaut ("aucune") : couverture par aire de recrutement.
      const defaultColor = isOutsideAire ? ORS_COLORS.villageHorsZone : ORS_COLORS.villageCouvert;
      return {
        id: `vlg-${idx}`,
        lat: v.latitude,
        lng: v.longitude,
        color: defaultColor,
        fillColor: defaultColor,
        fillOpacity: isOutsideAire ? 0.85 : 0.6,
        weight: 1,
        radius: isOutsideAire ? 5 : 3,
        iconHtml: createVillageIconHtml(defaultColor),
        popupHtml: () => `<div style="padding:6px;min-width:150px">
            <b style="font-size:12px">${v.name ?? ""}</b>
            <p style="font-size:11px;margin:2px 0">Population: ${v.population || 0}</p>
            <p style="font-size:11px;margin:2px 0">Dist. établissement le plus proche: ${(v.distToNearestSchool / 1000).toFixed(1)} km</p>
            ${isOutsideAire ? '<div style="margin-top:4px;padding:3px;background:#fee2e2;color:#b91c1c;font-weight:bold;font-size:11px;text-align:center;border-radius:4px">HORS ZONE</div>' : ""}
          </div>`,
      };
    });
  }, [categoryFilter, eligibiliteFilter, villagesWithDistance, aireRadius]);

  return (
    <div className="relative w-full h-full min-h-[600px] rounded-lg overflow-hidden border border-border">
      <MapContainer
        center={center}
        zoom={zoom}
        className="w-full h-full"
        ref={setLeafletMap}
        scrollWheelZoom={true}
        zoomControl={false}
        zoomDelta={0.5}
        zoomSnap={0.5}
      >
        <MapCenterUpdater center={center} zoom={zoom} />
        <MapSizeUpdater />
        <MapTopLeftControls />
        <MapScaleControl />
        <MapGlobalStyles />
        <MapInteractions
          etablissements={[...mainEstablishments, ...secondaryEstablishments]}
          villages={villages}
          radius={radius}
          niveau={type}
          onVillageAnalysis={onVillageAnalysis}
          onShowAireRecrutement={(etab) => setIsolatedAireEtabId(etab.CODE_ETAB)}
        />
        {/* NB : secondaryEstablissements et villages sont deja filtres en amont
            par layerVisibility (matchesLayerVisibility / filteredVillages dans
            ORS.tsx) : le clic droit respecte deja les couches
            publiques/privees/villages masquees. Seule la couche "principale"
            CEG/Lycee (mainEstablishments) reste hors de cet etat React - elle
            n'est pilotee que par son propre interrupteur Leaflet natif
            ("LYCEES"/"COLLEGES EXISTANTS" plus bas), sans equivalent React ; un
            clic droit peut donc encore atteindre un CEG/Lycee masque via ce
            seul interrupteur. Limite connue et acceptee, hors perimetre de
            cette correction (demanderait de remonter cette couche dans
            layerVisibility). */}

        <LayersControl position="topright">
          <LayersControl.BaseLayer name="DEFAULT">
            <TileLayer attribution="© MEN/DPE" url="" maxZoom={24} />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer checked name="OSM">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={22}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="IMAGERY">
            <TileLayer
              attribution="&copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={22}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="MAPBOX">
            <TileLayer
              attribution="&copy; Mapbox"
              url={`https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`}
              maxZoom={24}
              tileSize={512}
              zoomOffset={-1}
            />
          </LayersControl.BaseLayer>

          {/* GeoJSON Boundary Layers — keys are STABLE references to avoid expensive re-stringify */}
          {geoLayers.dren && (
            <LayersControl.Overlay checked name="DREN">
              <GeoJSON
                key="geo-dren"
                data={geoLayers.dren as any}
                style={() => geoJsonStyle("dren")}
                onEachFeature={onEachFeature}
              />
            </LayersControl.Overlay>
          )}
          {geoLayers.cisco && (
            <LayersControl.Overlay checked name="CISCO">
              <GeoJSON
                key="geo-cisco"
                data={geoLayers.cisco as any}
                style={() => geoJsonStyle("cisco")}
                onEachFeature={onEachFeature}
              />
            </LayersControl.Overlay>
          )}
          {geoLayers.commune && (
            <LayersControl.Overlay name="COMMUNE">
              <GeoJSON
                key="geo-commune"
                data={geoLayers.commune as any}
                style={() => geoJsonStyle("commune")}
                onEachFeature={onEachFeature}
              />
            </LayersControl.Overlay>
          )}

          {/* NOTE (unification des couches — cf. audit) :
              L'ancienne entrée "INFOS ÉTAB." ci-dessus enveloppait un
              <LayerGroup /> VIDE : la cocher/décocher ne déclenchait aucun
              évènement vers l'état React `etabInfoVisible` (aucun listener
              overlayadd/overlayremove posé). C'était une case à cocher
              décorative, doublon non fonctionnel de la VRAIE case "INFOS
              ÉTAB." du panneau latéral (ORS.tsx, carte "Couches à
              afficher"), qui pilote réellement `etabInfoVisible`. Supprimée.

              Idem pour les couches "ECOLES PUBLIQUES/PRIMAIRES", "ECOLES
              PRIVEES/COLLEGES PRIVES" et "VILLAGES" : elles étaient
              enveloppées dans un second <LayersControl.Overlay> natif Leaflet
              totalement DÉCONNECTÉ de l'état React `layerVisibility` du
              panneau latéral (deux interrupteurs indépendants pour la même
              couche, pouvant afficher des états contradictoires). Les
              tableaux de points (secondaryPoints / privatePoints /
              villagePoints*) sont déjà filtrés en amont par
              `layerVisibility` (matchesLayerVisibility côté établissements,
              `filteredVillages` côté villages dans ORS.tsx) : le panneau
              latéral est donc la SEULE source de vérité désormais, et ces
              couches sont rendues directement, sans second interrupteur
              Leaflet redondant.

              Le `LayersControl` natif ne garde que ce qui n'a pas
              d'équivalent côté état React : les fonds de carte, les limites
              administratives (GeoJSON) et la couche "principale" CEG/Lycée
              (qui n'a pas de doublon de filtrage — un seul interrupteur =
              pas d'ambiguïté). */}

          {/* */}
          {type !== "primaire" && mainEstablishments.length > 0 && (
            <LayersControl.Overlay
              checked
              name={type === "lycee" ? "LYCEES" : "COLLEGES EXISTANTS"}
            >
              <>
                {mainEstablishments.map((etab) => {
                  const color =
                    categoryFilter !== "aucune"
                      ? getCategoryColor(etab, categoryFilter)
                      : getMainColor();
                  return (
                    <Marker
                      key={`main-${etab.CODE_ETAB}`}
                      position={[etab.latitude!, etab.longitude!]}
                      icon={createEtablissementIcon(type, color)}
                      eventHandlers={{
                        click: () => handleMarkerClick(etab),
                        ...bindEtablissementHover(etab),
                      }}
                    />
                  );
                })}
              </>
            </LayersControl.Overlay>
          )}
        </LayersControl>

        {/* Aires de recrutement (règles du 03/09/2026) : cercles à rayon
            FIXE par niveau (2/5/20 km), désactivés par défaut. Si
            `isolatedAireEtabId` est renseigné (clic droit → "Voir aire de
            recrutement"), seule l'aire de cet établissement est dessinée. */}
        {(layerVisibility?.aires || isolatedAireEtabId != null) && (
          <>
            {aireSourceEtablissements
              .filter((e) => isolatedAireEtabId == null || e.CODE_ETAB === isolatedAireEtabId)
              .map((e) => (
                <Circle
                  key={`aire-${e.CODE_ETAB}`}
                  center={[e.latitude!, e.longitude!]}
                  radius={aireRadius}
                  pathOptions={{
                    color: "#6b7280",
                    fillColor: "#6b7280",
                    fillOpacity: 0.06,
                    weight: 1,
                    dashArray: "4 3",
                    // Jamais interactif : ce cercle ne doit capter aucun
                    // event (hover/click) qui interférerait avec les
                    // marqueurs qu'il recouvre.
                    interactive: false,
                  }}
                />
              ))}
          </>
        )}

        {/* Secondary points (canvas) */}
        {secondaryPoints.length > 0 && <CanvasMarkersLayer points={secondaryPoints} />}

        {/* Écoles privées (canvas) — college / lycée uniquement */}
        {privatePoints.length > 0 && <CanvasMarkersLayer points={privatePoints} />}

        {/* Villages (canvas) — 3 niveaux, couverture par aire fixe ou
            éligibilité Nouvelle Création selon le critère actif. */}
        {villagePoints.length > 0 && <CanvasMarkersLayer points={villagePoints} />}
      </MapContainer>

      {/* Info popup for hovered establishment */}
      {etabInfoVisible && hoveredEtablissement && (
        <div className="absolute bottom-3 left-1/2 z-[1000] w-[min(90%,360px)] -translate-x-1/2 rounded-lg border border-border bg-background/95 px-2.5 py-2 shadow-md backdrop-blur text-[11px]">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-primary/20 bg-primary/5 text-primary text-[10px]">
              📍
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="truncate font-semibold text-[12px] text-foreground">
                  {hoveredEtablissement.NOM_ETAB}
                </div>
                <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                  {secteurLabel(hoveredEtablissement)}
                </span>
              </div>

              <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                <span className="truncate">{hoveredEtablissement.COMMUNE ?? "-"}</span>
                <span className="shrink-0 font-mono text-[9px] text-slate-600">
                  {hoveredEtablissement.latitude != null && hoveredEtablissement.longitude != null
                    ? `${Number(hoveredEtablissement.latitude).toFixed(5)}, ${Number(hoveredEtablissement.longitude).toFixed(5)}`
                    : "-"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLegend !== false && <MapLegend type={type} categoryFilter={categoryFilter} />}
    </div>
  );
};
