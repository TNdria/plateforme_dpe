import {
  Fragment,
  useEffect,
  useRef,
  useMemo,
  useState,
  useCallback,
} from 'react';
import {
  MapContainer,
  TileLayer,
  Circle,
  Marker,
  Popup,
  LayersControl,
  useMap,
  GeoJSON,
  LayerGroup,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Etablissement, Village, GeoJSONFeature } from '@/hooks/useMapData';
import { MapLegend } from './MapLegend';
import { SpatialGrid } from '@/lib/spatialGrid';
import { CanvasMarkersLayer, CanvasPoint } from './CanvasMarkersLayer';
import { MapInteractions, VillageAnalysisResult } from './MapInteractions';

// Fix for default markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const MAPBOX_TOKEN =
  'pk.eyJ1IjoidG9reSIsImEiOiJjbTE4djVndXIxNmQwMmxzam1nY3JzcWU0In0.KtMOpNhicsXZkbmcFtVd8w';

// Styles matching original jQuery
const STYLE_DREN = {
  fillColor: '#4e73df',
  color: '#4e73df',
  weight: 4,
  opacity: 1,
  fillOpacity: 0.03,
};
const STYLE_CISCO = {
  fillColor: '#22afbe',
  color: '#22afbe',
  weight: 3,
  opacity: 0.9,
  fillOpacity: 0.03,
};
const STYLE_COMMUNE = {
  fillColor: '#c0c0c0',
  color: '#c0c0c0',
  weight: 2,
  opacity: 0.8,
  fillOpacity: 0.03,
};

interface ORSMapProps {
  colleges: Etablissement[];
  primaires: Etablissement[];
  radius: number;
  type: 'primaire' | 'college' | 'lycee';
  onMarkerClick?: (etablissement: Etablissement) => void;
  center?: [number, number];
  zoom?: number;
  categoryFilter?: string;
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
}

const MapCenterUpdater = ({
  center,
  zoom,
}: {
  center: [number, number];
  zoom: number;
}) => {
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

/** Adds a small "Reset view" + scale control once on mount. Native Leaflet, zero React VDOM. */
const MapEnhancements = () => {
  const map = useMap();
  useEffect(() => {
    const scale = L.control.scale({ imperial: false }).addTo(map);
    // Reset / fit world bounds button (top-left, below zoom)
    const ResetCtrl = L.Control.extend({
      options: { position: 'topleft' as L.ControlPosition },
      onAdd: () => {
        const btn = L.DomUtil.create(
          'a',
          'leaflet-bar leaflet-control leaflet-control-custom'
        );
        btn.href = '#';
        btn.title = 'Réinitialiser la vue';
        btn.style.cssText =
          'background:#fff;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:14px;text-decoration:none;color:#1f2937';
        btn.innerHTML = '⟲';
        L.DomEvent.on(btn, 'click', (e) => {
          L.DomEvent.preventDefault(e);
          map.flyTo([-18.91891771052786, 47.51385211944581], 6);
        });
        return btn;
      },
    });
    const reset = new ResetCtrl().addTo(map);
    return () => {
      scale.remove();
      reset.remove();
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

// Couleurs distinctes par type d'intervention (recommandation Validation Technique)
// Nouvelle création: violet, Reconstruction: rouge, Extension: orange, Réhabilitation: jaune doré, Conforme: vert
const ORS_COLORS = {
  nouvelle_creation: '#8b5cf6',
  reconstruction: '#dc2626',
  extension: '#f97316',
  rehabilitation: '#eab308',
  tablebanc: '#0ea5e9',
  conforme: '#16a34a',
  default: '#36b9cc',
} as const;

type EtablissementIconType = 'primaire' | 'college' | 'lycee';

// Même configuration que SIG : les pictogrammes sont volontairement les
// classes Font Awesome déjà utilisées dans ce module.
const ETABLISSEMENT_ICON_CLASSES: Record<EtablissementIconType, string> = {
  primaire: 'fas fa-book-open',
  college: 'fas fa-school',
  lycee: 'fas fa-building',
};

const createEtablissementIcon = (
  iconType: EtablissementIconType,
  color: string
) => {
  const html = `<i class="${ETABLISSEMENT_ICON_CLASSES[iconType]}" style="color:${color};font-size:20px;line-height:28px;text-shadow:0 1px 2px rgba(15,23,42,.35)" aria-hidden="true"></i>`;

  return L.divIcon({
    className: 'ors-etablissement-marker',
    html,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

const createEtablissementIconHtml = (
  iconType: EtablissementIconType,
  color: string
) => createEtablissementIcon(iconType, color).options.html as string;

// Get category color for an establishment
function getCategoryColor(etab: Etablissement, categoryFilter: string): string {
  switch (categoryFilter) {
    case 'extension':
      return getExtensions(etab) > 0
        ? ORS_COLORS.extension
        : ORS_COLORS.conforme;
    case 'reconstruction':
      return etab.eligible_reconstruction
        ? ORS_COLORS.reconstruction
        : ORS_COLORS.conforme;
    case 'rehabilitation':
      return etab.eligible_rehabilitation
        ? ORS_COLORS.rehabilitation
        : ORS_COLORS.conforme;
    case 'tablebanc':
      return (etab.places || 0) < (etab.effectifs || 0)
        ? ORS_COLORS.tablebanc
        : ORS_COLORS.conforme;
    case 'nouvelle_creation':
      return ORS_COLORS.nouvelle_creation;
    default:
      return ORS_COLORS.default;
  }
}

// Build detailed popup HTML for ORS establishments
function buildOrsPopup(
  etab: Etablissement,
  categoryFilter: string,
  type: ORSMapProps['type']
): string {
  const is_reconst = etab.eligible_reconstruction ? 'OUI' : 'NON';
  const is_rehab = etab.eligible_rehabilitation ? 'OUI' : 'NON';
  const extensions = getExtensions(etab);
  const tableBancs = getTableBancsNeed(etab);

  const highlightStyle = (field: string) =>
    categoryFilter === field ? 'background:#ddd;font-weight:bold' : '';

  const eligibilityRows =
    type === 'primaire'
      ? `<tr><th style="padding:4px;text-align:left">EFFECTIF T5</th><td style="text-align:right;padding:4px">${etab.eff_t5 ?? '-'}</td></tr>
         <tr><th style="padding:4px;text-align:left">EFFECTIF 2024</th><td style="text-align:right;padding:4px">${etab.eff_2024 ?? '-'}</td></tr>`
      : `<tr><th style="padding:4px;text-align:left">RECONSTRUCTION</th><td style="text-align:right;padding:4px">${is_reconst}</td></tr>
         <tr><th style="padding:4px;text-align:left">RÉHABILITATION</th><td style="text-align:right;padding:4px">${is_rehab}</td></tr>`;

  return `<div style="min-width:240px">
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="background:#4e73df;color:white"><th colspan="2" style="padding:6px;text-align:center">${etab.NOM_ETAB}</th></tr></thead>
      <tbody>
        <tr><th style="padding:4px;text-align:left">CODE</th><td style="text-align:right;padding:4px">${etab.CODE_ETAB ?? '-'}</td></tr>
        <tr><th style="padding:4px;text-align:left">SECTEUR</th><td style="text-align:right;padding:4px">${etab.SECTEUR === 0 ? 'PUBLIC' : 'PRIVÉ'}</td></tr>
        <tr><th style="padding:4px;text-align:left">COMMUNE</th><td style="text-align:right;padding:4px">${etab.COMMUNE ?? '-'}</td></tr>
        <tr><th style="padding:4px;text-align:left">FOKONTANY</th><td style="text-align:right;padding:4px">${etab.FOKONTANY ?? '-'}</td></tr>
        <tr><th style="padding:4px;text-align:left">EFFECTIFS</th><td style="text-align:right;padding:4px">${etab.effectifs || '-'}</td></tr>
        ${eligibilityRows}
        <tr><th style="padding:4px;text-align:left">SALLE BON ETAT</th><td style="text-align:right;padding:4px;${(etab.sdc_be || 0) === 0 ? 'color:red;font-weight:bold' : ''}">${etab.sdc_be ?? '-'}</td></tr>
        <tr><th style="padding:4px;text-align:left">SALLE MAUVAIS ETAT</th><td style="text-align:right;padding:4px">${etab.sdc_me ?? '-'}</td></tr>
        <tr><th style="padding:4px;text-align:left">SALLE REQUIS</th><td style="text-align:right;padding:4px">${etab.sdc_requis ?? '-'}</td></tr>
        <tr><th style="padding:4px;text-align:left">PLACES ASSISES</th><td style="text-align:right;padding:4px;${(etab.places || 0) === 0 ? 'color:red;font-weight:bold' : ''}">${etab.places ?? '-'}</td></tr>
        <tr style="${highlightStyle('extension')}"><th style="padding:4px;text-align:left">BESOIN EXTENSIONS</th><td style="text-align:right;padding:4px">${extensions}</td></tr>
        <tr style="${highlightStyle('tablebanc')}"><th style="padding:4px;text-align:left">TABLE-BANCS 2PL</th><td style="text-align:right;padding:4px">${tableBancs}</td></tr>
      </tbody>
    </table>
  </div>`;
}

export const ORSMap = ({
  colleges,
  primaires,
  radius,
  type,
  center = [-18.9189596, 47.5135653],
  zoom = 6,
  categoryFilter = 'aucune',
  geoLayers = {},
  villages = [],
  onVillageAnalysis,
  showLegend = true,
}: ORSMapProps) => {
  const [leafletMap, setLeafletMap] = useState<L.Map | null>(null);
  const [etabInfoLayer, setEtabInfoLayer] = useState<L.LayerGroup | null>(
    null
  );
  const etabInfoEnabledRef = useRef(false);
  const [etabInfoEnabled, setEtabInfoEnabled] = useState(false);
  const [hoveredEtablissement, setHoveredEtablissement] =
    useState<Etablissement | null>(null);

  useEffect(() => {
    if (!leafletMap || !etabInfoLayer) return;

    const syncInfoLayer = () => {
      const enabled = leafletMap.hasLayer(etabInfoLayer);
      etabInfoEnabledRef.current = enabled;
      setEtabInfoEnabled(enabled);
      if (!enabled) setHoveredEtablissement(null);
    };

    leafletMap.on('overlayadd', syncInfoLayer);
    leafletMap.on('overlayremove', syncInfoLayer);
    syncInfoLayer();

    return () => {
      leafletMap.off('overlayadd', syncInfoLayer);
      leafletMap.off('overlayremove', syncInfoLayer);
    };
  }, [leafletMap, etabInfoLayer]);

  const showEtablissementInfo = useCallback((etablissement: Etablissement) => {
    if (etabInfoEnabledRef.current) {
      setHoveredEtablissement(etablissement);
    }
  }, []);

  const collegesWithCoords = useMemo(
    () => colleges.filter((etab) => etab.latitude && etab.longitude),
    [colleges]
  );

  const primairesWithCoords = useMemo(
    () => primaires.filter((etab) => etab.latitude && etab.longitude),
    [primaires]
  );

  // Calcule si une école primaire est exclue (hors zone d'un collège) — grille spatiale O(N)
  const getPrimaireExcluded = useMemo(() => {
    const exclusionMap = new Map<string | number, boolean>();
    if (type !== 'college' || collegesWithCoords.length === 0)
      return exclusionMap;
    const grid = new SpatialGrid(
      collegesWithCoords as Array<{ latitude: number; longitude: number }>,
      radius
    );
    for (const primaire of primairesWithCoords) {
      if (primaire.SECTEUR !== 0) {
        exclusionMap.set(primaire.CODE_ETAB, false);
        continue;
      }
      const isExcluded = !grid.hasNeighborWithin(
        primaire.latitude!,
        primaire.longitude!,
        radius
      );
      exclusionMap.set(primaire.CODE_ETAB, isExcluded);
    }
    return exclusionMap;
  }, [primairesWithCoords, collegesWithCoords, radius, type]);

  // Villages avec distance à l'école la plus proche (grille spatiale, ~50× plus rapide)
  const villagesWithDistance = useMemo(() => {
    if (
      type !== 'primaire' ||
      villages.length === 0 ||
      primairesWithCoords.length === 0
    )
      return [];
    const ecolesPub = primairesWithCoords.filter(
      (e) => e.SECTEUR === 0
    ) as Array<{ latitude: number; longitude: number }>;
    const grid = new SpatialGrid(ecolesPub, radius * 2);
    return villages
      .filter((v) => v.latitude && v.longitude)
      .map((v) => ({
        ...v,
        distToNearestSchool: grid.nearestDistance(
          v.latitude,
          v.longitude,
          radius * 4
        ),
      }));
  }, [type, villages, primairesWithCoords, radius]);

  const getMainColor = () => {
    switch (type) {
      case 'lycee':
        return '#8b5cf6';
      case 'college':
        return 'green';
      default:
        return '#36b9cc';
    }
  };

  // GeoJSON styles
  const geoJsonStyle = (layerType: string) => {
    switch (layerType) {
      case 'dren':
        return STYLE_DREN;
      case 'cisco':
        return STYLE_CISCO;
      case 'commune':
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
        direction: 'top',
      });
    }
  };

  // Determine main establishments (colleges for college type, lycees for lycee type)
  const mainEstablishments = useMemo(() => {
    if (type === 'college') return collegesWithCoords;
    if (type === 'lycee') return primairesWithCoords; // lycees are passed as primaires in ORSLycee
    return [];
  }, [type, collegesWithCoords, primairesWithCoords]);

  // Secondary establishments
  const secondaryEstablishments = useMemo(() => {
    if (type === 'college') return primairesWithCoords;
    if (type === 'lycee') return collegesWithCoords;
    if (type === 'primaire') return primairesWithCoords;
    return [];
  }, [type, collegesWithCoords, primairesWithCoords]);

  // Pre-compute lightweight point arrays for the canvas layer (no React VDOM per marker)
  const secondaryPoints = useMemo<CanvasPoint[]>(() => {
    return secondaryEstablishments.map((etab) => {
      const isPublic = etab.SECTEUR === 0;
      const isExcluded =
        type === 'college'
          ? getPrimaireExcluded.get(etab.CODE_ETAB) || false
          : false;
      let fillColor: string;
      if (type === 'primaire' && categoryFilter !== 'aucune') {
        fillColor = getCategoryColor(etab, categoryFilter);
      } else if (type === 'primaire') {
        fillColor = isPublic ? '#36b9cc' : '#f6c23e';
      } else {
        fillColor = isPublic ? '#36b9cc' : '#ffffcc';
      }
      const pixelRadius = type === 'lycee' ? 7 : 5;
      const useCustomPopup = type === 'primaire' && categoryFilter !== 'aucune';
      const iconType: EtablissementIconType =
        type === 'lycee' ? 'college' : 'primaire';
      return {
        id: etab.CODE_ETAB,
        lat: etab.latitude!,
        lng: etab.longitude!,
        color: isExcluded ? '#dc2626' : fillColor,
        fillColor,
        fillOpacity: isExcluded ? 0.95 : 0.75,
        weight: isExcluded ? 2 : 1,
        radius: pixelRadius,
        iconHtml: createEtablissementIconHtml(
          iconType,
          isExcluded ? '#dc2626' : fillColor
        ),
        popupHtml: () =>
          useCustomPopup
            ? buildOrsPopup(etab, categoryFilter, type)
            : buildOrsPopup(etab, 'aucune', type),
        onMouseOver: () => showEtablissementInfo(etab),
        onMouseOut: () => setHoveredEtablissement(null),
      };
    });
  }, [
    secondaryEstablishments,
    type,
    categoryFilter,
    getPrimaireExcluded,
    showEtablissementInfo,
  ]);

  const privatePoints = useMemo<CanvasPoint[]>(() => {
    if (type === 'primaire') return [];
    return secondaryEstablishments
      .filter((e) => e.SECTEUR === 1)
      .map((etab) => ({
        id: `priv-${etab.CODE_ETAB}`,
        lat: etab.latitude!,
        lng: etab.longitude!,
        color: '#ffffcc',
        fillColor: '#ffffcc',
        fillOpacity: 0.7,
        weight: 1,
        radius: 5,
        iconHtml: createEtablissementIconHtml(
          type === 'lycee' ? 'college' : 'primaire',
          '#ffffcc'
        ),
        popupHtml: () => buildOrsPopup(etab, 'aucune', type),
        onMouseOver: () => showEtablissementInfo(etab),
        onMouseOut: () => setHoveredEtablissement(null),
      }));
  }, [
    secondaryEstablishments,
    type,
    showEtablissementInfo,
  ]);

  const villagePointsPrimaire = useMemo<CanvasPoint[]>(() => {
    if (type !== 'primaire') return [];
    return villagesWithDistance.map((v, idx) => {
      const isOutsideRadius = v.distToNearestSchool > radius;
      return {
        id: `vlg-${idx}`,
        lat: v.latitude,
        lng: v.longitude,
        color: isOutsideRadius ? '#FF0000' : '#888',
        fillColor: isOutsideRadius ? '#FF0000' : '#FFFFFF',
        fillOpacity: isOutsideRadius ? 0.85 : 0.4,
        weight: 1,
        radius: isOutsideRadius ? 5 : 3,
        popupHtml: () => `<div style="padding:6px;min-width:150px">
            <b style="font-size:12px">${v.name ?? ''}</b>
            <p style="font-size:11px;margin:2px 0">Population: ${v.population || 0}</p>
            <p style="font-size:11px;margin:2px 0">Dist. école: ${(v.distToNearestSchool / 1000).toFixed(1)} km</p>
            ${isOutsideRadius ? '<div style="margin-top:4px;padding:3px;background:#fee2e2;color:#b91c1c;font-weight:bold;font-size:11px;text-align:center;border-radius:4px">HORS ZONE</div>' : ''}
          </div>`,
      };
    });
  }, [type, villagesWithDistance, radius]);

  const villagePointsOther = useMemo<CanvasPoint[]>(() => {
    if (type === 'primaire') return [];
    return villages
      .filter((v) => v.latitude && v.longitude)
      .map((v, idx) => ({
        id: `vlg-${idx}`,
        lat: v.latitude,
        lng: v.longitude,
        color: '#e74a3b',
        fillColor: '#e74a3b',
        fillOpacity: 0.5,
        weight: 1,
        radius: 3,
        popupHtml: () =>
          `<div style="padding:4px"><b style="font-size:12px">${v.name ?? ''}</b><p style="font-size:11px;margin:2px 0">Pop: ${v.population || 0}</p></div>`,
      }));
  }, [type, villages]);

  return (
    <div className="relative w-full h-full min-h-[600px] rounded-lg overflow-hidden border border-border">
      <MapContainer
        center={center}
        zoom={zoom}
        className="w-full h-full"
        ref={setLeafletMap}
        scrollWheelZoom={true}
        zoomControl={true}
        zoomDelta={0.5}
        zoomSnap={0.5}
      >
        <MapCenterUpdater center={center} zoom={zoom} />
        <MapSizeUpdater />
        <MapEnhancements />
        <MapInteractions
          etablissements={[...mainEstablishments, ...secondaryEstablishments]}
          villages={villages}
          radius={radius}
          onVillageAnalysis={onVillageAnalysis}
        />

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
                style={() => geoJsonStyle('dren')}
                onEachFeature={onEachFeature}
              />
            </LayersControl.Overlay>
          )}
          {geoLayers.cisco && (
            <LayersControl.Overlay checked name="CISCO">
              <GeoJSON
                key="geo-cisco"
                data={geoLayers.cisco as any}
                style={() => geoJsonStyle('cisco')}
                onEachFeature={onEachFeature}
              />
            </LayersControl.Overlay>
          )}
          {geoLayers.commune && (
            <LayersControl.Overlay name="COMMUNE">
              <GeoJSON
                key="geo-commune"
                data={geoLayers.commune as any}
                style={() => geoJsonStyle('commune')}
                onEachFeature={onEachFeature}
              />
            </LayersControl.Overlay>
          )}

          {/* Même contrôle Leaflet que les couches DREN / CISCO / COMMUNE.
              Son état active le bandeau au survol des établissements. */}
          <LayersControl.Overlay name="INFOS ÉTAB.">
            <LayerGroup
              ref={setEtabInfoLayer}
            />
          </LayersControl.Overlay>

          {/* Cercles de rayon (en mètres) — peu nombreux: SVG OK pour les "main" établissements */}
          {type !== 'primaire' && mainEstablishments.length > 0 && (
            <LayersControl.Overlay
              checked
              name={type === 'lycee' ? 'LYCEES' : 'COLLEGES EXISTANTS'}
            >
              <>
                {mainEstablishments.map((etab) => {
                  const color =
                    categoryFilter !== 'aucune'
                      ? getCategoryColor(etab, categoryFilter)
                      : getMainColor();
                  const popupHtml =
                    categoryFilter !== 'aucune'
                    ? buildOrsPopup(etab, categoryFilter, type)
                    : buildOrsPopup(etab, 'aucune', type);
                  return (
                    <Fragment key={`main-${etab.CODE_ETAB}`}>
                      <Circle
                        center={[etab.latitude!, etab.longitude!]}
                        radius={radius}
                        pathOptions={{
                          color,
                          fillColor: color,
                          fillOpacity: 0.15,
                          weight: 2,
                        }}
                      />
                      <Marker
                        position={[etab.latitude!, etab.longitude!]}
                        icon={createEtablissementIcon(type, color)}
                        eventHandlers={{
                          mouseover: () => showEtablissementInfo(etab),
                          mouseout: () => setHoveredEtablissement(null),
                        }}
                      >
                        <Popup>
                          <div dangerouslySetInnerHTML={{ __html: popupHtml }} />
                        </Popup>
                      </Marker>
                    </Fragment>
                  );
                })}
              </>
            </LayersControl.Overlay>
          )}

          {/* ─── COUCHE LOURDE: établissements (souvent 1000+) ───
              Layer Leaflet natif (1 seul groupe), markers ajoutés en chunks via
              requestIdleCallback pour ne JAMAIS bloquer le thread. Popup lazy au clic. */}
          {secondaryPoints.length > 0 && (
            <LayersControl.Overlay
              checked
              name={
                type === 'primaire'
                  ? 'ECOLES PUBLIQUES'
                  : type === 'college'
                    ? 'ECOLES PRIMAIRES'
                    : 'COLLEGES EXISTANTS'
              }
            >
              <CanvasMarkersLayer points={secondaryPoints} />
            </LayersControl.Overlay>
          )}

          {/* Écoles privées (canvas) */}
          {privatePoints.length > 0 && (
            <LayersControl.Overlay
              name={type === 'college' ? 'ECOLES PRIVEES' : 'COLLEGES PRIVES'}
            >
              <CanvasMarkersLayer points={privatePoints} />
            </LayersControl.Overlay>
          )}

          {/* Villages (canvas) — primaire */}
          {type === 'primaire' && villagePointsPrimaire.length > 0 && (
            <LayersControl.Overlay name="VILLAGES">
              <CanvasMarkersLayer points={villagePointsPrimaire} />
            </LayersControl.Overlay>
          )}

          {/* Villages (canvas) — collège/lycée */}
          {villagePointsOther.length > 0 && (
            <LayersControl.Overlay name="VILLAGES">
              <CanvasMarkersLayer points={villagePointsOther} />
            </LayersControl.Overlay>
          )}
        </LayersControl>
      </MapContainer>


      {showLegend !== false && (
        <MapLegend type={type} categoryFilter={categoryFilter} />
      )}
    </div>
  );
};
