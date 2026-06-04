import { useState, useEffect, useCallback, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import * as turf from "@turf/turf";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Settings, Search, Loader2, Filter, MapPin, ZoomIn } from "lucide-react";
import { toast } from "sonner";
import { sigApi, dashboardApi, fetchDBBatch, Dren, Cisco } from "@/services/api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import DataActionsBar from "@/components/admin/DataActionsBar";

// Fix default markers
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Styles matching Django sig.js
const STYLE_DREN = { fillColor: '#4e73df', color: '#4e73df', weight: 4, opacity: 1, fillOpacity: 0.03 };
const STYLE_CISCO = { fillColor: '#22afbe', color: '#22afbe', weight: 3, opacity: 0.9, fillOpacity: 0.03 };
const STYLE_COMMUNE = { fillColor: '#c0c0c0', color: '#c0c0c0', weight: 2, opacity: 0.8, fillOpacity: 0.03 };
const STYLE_FOKONTANY = { fillColor: '#55ff00', color: '#55ff00', weight: 0.6, opacity: 0.5, fillOpacity: 0.03 };

const MAPBOX_TOKEN = "pk.eyJ1IjoidG9reSIsImEiOiJjbTE4djVndXIxNmQwMmxzam1nY3JzcWU0In0.KtMOpNhicsXZkbmcFtVd8w";
const BING_KEY = "AuhiCJHlGzhg93IqUH_oCpl_-ZUrIE6SPftlyGYUvr9Amx5nzA-WqGcPquyFZl4L";

// Marker icon configs per level
const NIVEAU_CONFIG: Record<string, { fa: string; label: string; aireColor: string; rayon: number }> = {
  n0: { fa: 'fa fa-bullseye', label: 'PRESCO', aireColor: 'green', rayon: 2 },
  n1: { fa: 'fa fa-bullseye', label: 'PRIMAIRE', aireColor: 'green', rayon: 2 },
  n2: { fa: 'fas fa-circle', label: 'COLLEGE', aireColor: 'blue', rayon: 5 },
  n3: { fa: 'fas fa-certificate', label: 'LYCEE', aireColor: 'yellow', rayon: 20 },
};

interface SearchItem {
  latLng: [number, number];
  id: string | number;
  name: string;
}

const SIG = () => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const layerControlRef = useRef<L.Control.Layers | null>(null);

  // Layer groups refs
  const etabLayersRef = useRef<Record<string, L.LayerGroup>>({});
  const aireLayersRef = useRef<Record<string, L.LayerGroup>>({});
  const shpRef = useRef<Record<string, L.GeoJSON | null>>({ dren: null, cisco: null, commune: null, fokontany: null });
  const villageLayerRef = useRef<L.LayerGroup>(new L.LayerGroup());
  const ctrlAireRef = useRef<L.Control | null>(null);
  const moveCtrlRef = useRef<L.Control | null>(null);
  const searchMarkerRef = useRef<L.Circle | null>(null);
  const positionAvantDeplacementRef = useRef<L.LatLng | null>(null);

  // State
  const [drens, setDrens] = useState<Dren[]>([]);
  const [ciscos, setCiscos] = useState<Cisco[]>([]);
  const [selectedDren, setSelectedDren] = useState<number>(0);
  const [selectedCisco, setSelectedCisco] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true); // Open by default on load
  const [zoomLevel, setZoomLevel] = useState(6);
  const [searchItems, setSearchItems] = useState<SearchItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);

  // Fiche école
  const [selectedSchool, setSelectedSchool] = useState<any | null>(null);

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; lat: number; lng: number } | null>(null);

  // Geolocalisation modals
  const [showGeoEtab, setShowGeoEtab] = useState(false);
  const [showGeoVillage, setShowGeoVillage] = useState(false);
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number }>({ lat: 0, lng: 0 });
  const [etabNonPointe, setEtabNonPointe] = useState<any[]>([]);
  const [selectedEtabGeo, setSelectedEtabGeo] = useState<any | null>(null);
  const [filterEtabName, setFilterEtabName] = useState("");
  const [villageForm, setVillageForm] = useState({ name: '', population: '', airtel: false, orange: false, telma: false, elec: false, eau: false });

  // Stats
  const [stats, setStats] = useState({ total: 0, publicCount: 0, privateCount: 0, villages: 0 });

  // Init map
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomDelta: 0.5,
      zoomSnap: 0.5,
      scrollWheelZoom: false, // Disabled by default like sig.js
    }).setView([-18.9189596, 47.5135653], 6);

    L.control.scale().addTo(map);

    // Base layers - matching sig.js
    const DEFAULT_LAYER = L.tileLayer('', { maxZoom: 24, attribution: '© MEN/DPE' });
    const OSM_LAYER = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 22, attribution: '© OpenStreetMap' }).addTo(map);
    const IMAGERY_LAYER = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 22, attribution: '&copy; Esri' });
    const MAP_BOX = L.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`, {
      maxZoom: 24, tileSize: 512, zoomOffset: -1, attribution: '&copy; Mapbox',
    });

    // BING layer via Virtual Earth tiles
    const BING_LAYER = L.tileLayer('https://ecn.t{s}.tiles.virtualearth.net/tiles/a{z}{x}{y}.jpeg?g=587&n=z&key=' + BING_KEY, {
      maxZoom: 19,
      attribution: '&copy; Microsoft Bing',
      subdomains: ['0', '1', '2', '3'],
    } as any);

    const BASE_LAYERS: Record<string, L.TileLayer> = {
      "DEFAULT": DEFAULT_LAYER,
      "OSM": OSM_LAYER,
      "IMAGERY": IMAGERY_LAYER,
      "BING": BING_LAYER,
      "MAPBOX": MAP_BOX,
    };

    // Layer control
    const layerControl = L.control.layers(BASE_LAYERS, {}, { position: 'topright', collapsed: false });
    layerControl.addTo(map);
    layerControlRef.current = layerControl;

    // Reset button
    const ResetControl = L.Control.extend({
      options: { position: 'topleft' as L.ControlPosition },
      onAdd: () => {
        const btn = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        btn.innerHTML = '<a href="#" title="Réinitialiser" style="font-size:16px;line-height:30px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;"><i class="fas fa-redo-alt"></i></a>';
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

    // Fullscreen button
    const FullscreenControl = L.Control.extend({
      options: { position: 'topleft' as L.ControlPosition },
      onAdd: () => {
        const btn = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        btn.innerHTML = '<a href="#" title="Plein écran" style="font-size:16px;line-height:30px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;"><i class="fas fa-expand"></i></a>';
        btn.onclick = (e) => {
          e.preventDefault();
          const container = map.getContainer();
          if (!document.fullscreenElement) {
            container.requestFullscreen?.();
          } else {
            document.exitFullscreen?.();
          }
        };
        return btn;
      },
    });
    new FullscreenControl().addTo(map);

    // Legend - matching sig.js exactly
    const legend = new (L.Control.extend({ options: { position: 'bottomleft' } }))();
    legend.onAdd = () => {
      const div = L.DomUtil.create('div', 'legend');
      div.style.cssText = 'background:rgba(255,255,255,0.92);padding:10px 14px;border-radius:8px;font-size:12px;line-height:1.8;box-shadow:0 2px 12px rgba(0,0,0,0.15);';
      div.innerHTML = `
        <p style="font-size:14px;margin:0 0 4px"><strong><u>Légende</u></strong></p>
        <i class="fa fa-square text-primary"></i>&nbsp;Secteur Public<br/>
        <i class="fa fa-square text-warning"></i>&nbsp;Secteur Privé<br/>
        <i class="fa fa-bullseye"></i>&nbsp;Présco et Primaire<br/>
        <i class="fas fa-circle"></i>&nbsp;Collège<br/>
        <i class="fas fa-certificate"></i>&nbsp;Lycée<br/>
        <i class="fas fa-caret-up text-danger"></i>&nbsp;Villages<br/>
        <hr style="margin:4px 0"/>
        <i class="fa fa-square" style="color:#4e73df"></i>&nbsp;Limite DREN<br/>
        <i class="fa fa-square" style="color:#22afbe"></i>&nbsp;Limite CISCO<br/>
        <i class="fa fa-square" style="color:#c0c0c0"></i>&nbsp;Limite Commune<br/>
        <i class="fa fa-square" style="color:#55ff00"></i>&nbsp;Limite Fokontany
      `;
      L.DomEvent.disableClickPropagation(div);
      return div;
    };
    legend.addTo(map);

    // Zoom indicator
    const zoomCtrl = new (L.Control.extend({ options: { position: 'topleft' } }))();
    zoomCtrl.onAdd = () => {
      const div = L.DomUtil.create('div', '');
      div.style.cssText = 'background:rgba(255,255,255,0.7);padding:4px 10px;font-size:12px;border-radius:4px;';
      div.id = 'zoom-indicator';
      div.innerHTML = `Niveau de Zoom: ${map.getZoom()}`;
      return div;
    };
    zoomCtrl.addTo(map);

    // Zoom events - label sizing & zoom indicator
    map.on('zoomend', () => {
      const z = map.getZoom();
      setZoomLevel(z);
      const el = document.getElementById('zoom-indicator');
      if (el) el.innerHTML = `Niveau de Zoom: ${z}`;

      const labelEtab = document.querySelectorAll('.label-etab') as NodeListOf<HTMLElement>;
      const labelVillage = document.querySelectorAll('.label-village') as NodeListOf<HTMLElement>;
      let fontSize = '0px';
      if (z > 16) fontSize = '13px';
      else if (z > 14) fontSize = '10px';
      else if (z > 12) fontSize = '8px';
      labelEtab.forEach(el => el.style.fontSize = fontSize);
      labelVillage.forEach(el => el.style.fontSize = fontSize);

      // Disable move checkbox if zoom too low
      const moveCheckbox = document.getElementById('check-move') as HTMLInputElement;
      if (moveCheckbox?.checked && z < 16) {
        moveCheckbox.checked = false;
      }
    });

    // Base layer change - adjust label color
    map.on('baselayerchange', (e: any) => {
      const z = map.getZoom();
      const isDark = e.name !== 'DEFAULT' && e.name !== 'OSM';
      const color = isDark ? 'white' : 'black';
      if (z > 12) {
        document.querySelectorAll<HTMLElement>('.label-etab').forEach(el => el.style.color = color);
        document.querySelectorAll<HTMLElement>('.label-village').forEach(el => el.style.color = color);
      }
    });

    // Close context menu on map click
    map.on('click', () => setContextMenu(null));

    // Init layer groups
    for (let n = 0; n < 4; n++) {
      for (let s = 0; s < 2; s++) {
        etabLayersRef.current[`layer_etabN${n}S${s}`] = new L.LayerGroup();
        aireLayersRef.current[`aire_etabN${n}S${s}`] = new L.LayerGroup();
      }
    }

    mapRef.current = map;
    dashboardApi.getDrens().then(setDrens).catch(console.error);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // DREN change
  const handleDrenChange = async (value: number) => {
    setSelectedDren(value);
    setSelectedCisco(0);
    setCiscos([]);
    if (value > 0) {
      try {
        const data = await sigApi.getCiscos(value);
        setCiscos(data);
      } catch (err) { console.error(err); }
    }
  };

  const clearEtabLayers = () => {
    for (let n = 0; n < 4; n++) {
      for (let s = 0; s < 2; s++) {
        etabLayersRef.current[`layer_etabN${n}S${s}`]?.clearLayers();
        aireLayersRef.current[`aire_etabN${n}S${s}`]?.clearLayers();
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
    const vl = villageLayerRef.current;
    if (vl) lc.removeLayer(vl);
  };

  const clearBaseShapes = () => {
    const map = mapRef.current;
    if (!map) return;
    Object.keys(shpRef.current).forEach(key => {
      const layer = shpRef.current[key];
      if (layer && map.hasLayer(layer)) map.removeLayer(layer);
      shpRef.current[key] = null;
    });
  };

  // Drag handlers for markers
  const onDragMarkerStart = (event: any) => {
    positionAvantDeplacementRef.current = event.target.getLatLng();
  };

  const onDragEtabEnd = (event: any) => {
    const moveCheckbox = document.getElementById('check-move') as HTMLInputElement;
    const map = mapRef.current;
    if (moveCheckbox?.checked && map && map.getZoom() >= 13) {
      event.target.setLatLng(event.target.getLatLng());
      const props = event.target.options.properties;
      const code_etab = props.CODE_ETAB;
      const lng = event.target.getLatLng().lng;
      const lat = event.target.getLatLng().lat;
      sigApi.updatePositionEtab(code_etab, lng, lat)
        .then(() => toast.success("Déplacement de l'établissement effectué avec succès !"))
        .catch(() => toast.error("Erreur lors du déplacement"));
    } else {
      if (positionAvantDeplacementRef.current) {
        event.target.setLatLng(positionAvantDeplacementRef.current);
      }
    }
  };

  const onDragVillageEnd = (event: any) => {
    const moveCheckbox = document.getElementById('check-move') as HTMLInputElement;
    const map = mapRef.current;
    if (moveCheckbox?.checked && map && map.getZoom() >= 13) {
      event.target.setLatLng(event.target.getLatLng());
      const props = event.target.options.properties;
      const id = props.id;
      const lng = event.target.getLatLng().lng;
      const lat = event.target.getLatLng().lat;
      sigApi.updatePositionVillage(id, lng, lat)
        .then(() => toast.success("Déplacement du village effectué avec succès !"))
        .catch(() => toast.error("Erreur lors du déplacement"));
    } else {
      if (positionAvantDeplacementRef.current) {
        event.target.setLatLng(positionAvantDeplacementRef.current);
      }
    }
  };

  // Context menu handler for shapes
  const handleContextMenu = (e: any) => {
    const map = mapRef.current;
    if (!map) return;
    e.originalEvent?.preventDefault?.();
    const point = map.latLngToContainerPoint(e.latlng);
    setGeoCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
    setContextMenu({ x: point.x, y: point.y, lat: e.latlng.lat, lng: e.latlng.lng });
  };

  // Create establishment markers
  const createLayerEtab = (data: any[], niveau: string) => {
    const map = mapRef.current;
    if (!map) return;
    const config = NIVEAU_CONFIG[niveau];
    const nIdx = niveau.replace('n', '');
    const items: SearchItem[] = [];

    data.forEach(dataEtab => {
      if (!dataEtab.latitude || !dataEtab.longitude) return;
      const cls = dataEtab.SECTEUR === 0 ? 'text-primary' : 'text-warning';
      const icon = L.divIcon({
        className: 'custom-icon',
        iconSize: [20, 20],
        html: `<i class="${config.fa} ${cls}"></i><span class="label-etab" style="font-size:0px;position:absolute;top:10px;white-space:nowrap;">${dataEtab.NOM_ETAB}</span>`,
      });

      const latLng: [number, number] = [parseFloat(dataEtab.latitude), parseFloat(dataEtab.longitude)];
      items.push({ latLng, id: dataEtab.CODE_ETAB, name: `${dataEtab.NOM_ETAB} / ${dataEtab.FOKONTANY || ''}` });

      const marker = L.marker(latLng, {
        icon,
        draggable: true, // Draggable but controlled by checkbox
        // @ts-ignore
        properties: dataEtab,
      });

      marker.bindTooltip(`<div class="custom-tooltip">${dataEtab.NOM_ETAB}</div>`, {
        permanent: false, opacity: 1, direction: 'top',
      });

      marker.on('click', () => setSelectedSchool(dataEtab));
      marker.on('dragstart', onDragMarkerStart);
      marker.on('dragend', onDragEtabEnd);

      // Create buffer/aire with turf
      const airePoint = turf.point([dataEtab.longitude, dataEtab.latitude]);
      const buffer = turf.buffer(airePoint, config.rayon, { units: 'kilometers' });
      if (buffer) {
        const bufferPolygon = L.geoJSON(buffer as any, {
          style: { color: config.aireColor, fillColor: config.aireColor, weight: 1, fillOpacity: 0.05 },
        });
        bufferPolygon.eachLayer((layer: any) => {
          layer.on('mouseover', (e: any) => { e.target.setStyle({ weight: 2, color: '#ff0000', fillOpacity: 0.1 }); });
          layer.on('mouseout', (e: any) => { e.target.setStyle({ color: config.aireColor, fillColor: config.aireColor, weight: 1, fillOpacity: 0.05 }); });
        });
        aireLayersRef.current[`aire_etabN${nIdx}S${dataEtab.SECTEUR}`]?.addLayer(bufferPolygon);
      }

      etabLayersRef.current[`layer_etabN${nIdx}S${dataEtab.SECTEUR}`]?.addLayer(marker);
    });

    return items;
  };

  // Apply filters
  const handleApplyFilters = useCallback(async () => {
    const map = mapRef.current;
    const lc = layerControlRef.current;
    if (!map || !lc) return;
    if (selectedDren === 0) { toast.error('Veuillez sélectionner une DREN'); return; }

    setLoading(true);
    setShowFilters(false);
    setContextMenu(null);

    try {
      clearBaseShapes();
      clearEtabLayers();
      removeOverLayers();
      villageLayerRef.current.clearLayers();
      if (ctrlAireRef.current) { map.removeControl(ctrlAireRef.current); ctrlAireRef.current = null; }
      if (moveCtrlRef.current) { map.removeControl(moveCtrlRef.current); moveCtrlRef.current = null; }

      // Cache key for this DREN/CISCO selection
      const cacheKey = `sig_${selectedDren}_${selectedCisco}`;
      const cached = (window as any).__sigCache?.[cacheKey];
      const isCacheFresh = cached && (Date.now() - cached.ts < 10 * 60 * 1000);

      // Split into parallel smaller batches to avoid 60s timeout on heavy queries.
      // - Group A: light geo shapes (dren/cisco/commune) + villages
      // - Group B: heavy fokontany + N0/N1 (presco/primaire — usually largest)
      // - Group C: N2/N3 (collège/lycée)
      const params = { code_dren: selectedDren, code_cisco: selectedCisco };
      let batchA: any, batchB: any, batchC: any;
      if (isCacheFresh) {
        batchA = cached.a; batchB = cached.b; batchC = cached.c;
      } else {
        const results = await Promise.allSettled([
          fetchDBBatch<Record<string, any>>([
            { key: 'dren', action: 'getSigLayerDren', params: { code_dren: selectedDren } },
            { key: 'cisco', action: 'getSigLayerCisco', params },
            { key: 'commune', action: 'getSigLayerCommune', params },
            { key: 'villages', action: 'getSigVillages', params },
          ], 45000),
          fetchDBBatch<Record<string, any>>([
            { key: 'fokontany', action: 'getSigLayerFokontany', params },
            { key: 'n0', action: 'getLayerEtabN0', params },
            { key: 'n1', action: 'getLayerEtabN1', params },
          ], 60000),
          fetchDBBatch<Record<string, any>>([
            { key: 'n2', action: 'getLayerEtabN2', params },
            { key: 'n3', action: 'getLayerEtabN3', params },
          ], 45000),
        ]);
        batchA = results[0].status === 'fulfilled' ? results[0].value : {};
        batchB = results[1].status === 'fulfilled' ? results[1].value : {};
        batchC = results[2].status === 'fulfilled' ? results[2].value : {};
        const failedGroups = results.filter(r => r.status === 'rejected');
        if (failedGroups.length) {
          console.warn('[SIG] Some batch groups failed:', failedGroups);
          toast.warning(`${failedGroups.length} groupe(s) de données n'ont pas pu être chargés (timeout)`);
        }
        if (results.some(r => r.status === 'fulfilled')) {
          (window as any).__sigCache = (window as any).__sigCache || {};
          (window as any).__sigCache[cacheKey] = { a: batchA, b: batchB, c: batchC, ts: Date.now() };
        }
      }

      const batchResult: Record<string, any> = { ...batchA, ...batchB, ...batchC };

      // Defensive: if a sub-action errored server-side it returns { error: "..." } instead of an array
      const safeArray = (v: any) => (Array.isArray(v) ? v : []);
      const drenData = safeArray(batchResult.dren);
      const ciscoData = safeArray(batchResult.cisco);
      const communeData = safeArray(batchResult.commune);
      const fktData = safeArray(batchResult.fokontany);
      const n0Data = safeArray(batchResult.n0);
      const n1Data = safeArray(batchResult.n1);
      const n2Data = safeArray(batchResult.n2);
      const n3Data = safeArray(batchResult.n3);
      const villagesData = safeArray(batchResult.villages);

      // Surface per-action errors in the console for debugging
      const failed = Object.entries(batchResult).filter(([, v]: any) => v && !Array.isArray(v) && v.error);
      if (failed.length) console.warn('[SIG] Some batch actions failed:', failed);

      // Process geo shapes
      if (drenData?.[0]?.shape) {
        shpRef.current.dren = L.geoJSON(drenData[0].shape, { style: STYLE_DREN });
      }
      if (ciscoData?.[0]?.shape) {
        shpRef.current.cisco = L.geoJSON(ciscoData[0].shape, {
          style: STYLE_CISCO,
          onEachFeature: (feature, layer) => {
            layer.bindTooltip(`CISCO ${feature.properties?.name || ''}`, { permanent: false, opacity: 1, direction: 'top' });
            layer.on('contextmenu', handleContextMenu);
          },
        });
      }
      if (communeData?.[0]?.shape) {
        shpRef.current.commune = L.geoJSON(communeData[0].shape, {
          style: STYLE_COMMUNE,
          onEachFeature: (feature, layer) => {
            layer.bindTooltip(`Commune ${feature.properties?.name || ''}`, { permanent: false, opacity: 1 });
          },
        });
      }
      if (fktData?.[0]?.shape) {
        shpRef.current.fokontany = L.geoJSON(fktData[0].shape, {
          style: STYLE_FOKONTANY,
          onEachFeature: (feature, layer) => {
            layer.bindTooltip(`Fokontany ${feature.properties?.name || ''}`, { permanent: false, opacity: 1, direction: 'top' });
            layer.on('contextmenu', handleContextMenu);
          },
        });
      }

      // Add shapes to map
      if (selectedCisco >= 101 && shpRef.current.cisco) {
        shpRef.current.cisco.addTo(map);
        map.fitBounds(shpRef.current.cisco.getBounds());
      } else {
        if (shpRef.current.dren) shpRef.current.dren.addTo(map);
        if (shpRef.current.cisco) shpRef.current.cisco.addTo(map);
        if (shpRef.current.dren) map.fitBounds(shpRef.current.dren.getBounds());
      }
      if (shpRef.current.commune) shpRef.current.commune.addTo(map);
      if (shpRef.current.fokontany) shpRef.current.fokontany.addTo(map);

      const allSearchItems: SearchItem[] = [];
      const items0 = createLayerEtab(n0Data || [], 'n0') || [];
      const items1 = createLayerEtab(n1Data || [], 'n1') || [];
      const items2 = createLayerEtab(n2Data || [], 'n2') || [];
      const items3 = createLayerEtab(n3Data || [], 'n3') || [];
      allSearchItems.push(...items0, ...items1, ...items2, ...items3);

      // Add overlays matching Django labels
      lc.addOverlay(etabLayersRef.current['layer_etabN0S0'], "PRESCO PUBLIC");
      lc.addOverlay(etabLayersRef.current['layer_etabN0S1'], "PRESCO PRIVE");
      lc.addOverlay(etabLayersRef.current['layer_etabN1S0'], "PRIMAIRE PUBLIC");
      lc.addOverlay(etabLayersRef.current['layer_etabN1S1'], "PRIMAIRE PRIVE");
      lc.addOverlay(etabLayersRef.current['layer_etabN2S0'], "COLLEGE PUBLIC");
      lc.addOverlay(etabLayersRef.current['layer_etabN2S1'], "COLLEGE PRIVE");
      lc.addOverlay(etabLayersRef.current['layer_etabN3S0'], "LYCEE PUBLIC");
      lc.addOverlay(etabLayersRef.current['layer_etabN3S1'], "LYCEE PRIVE");

      // Add all layers to map
      for (let n = 0; n < 4; n++) {
        for (let s = 0; s < 2; s++) {
          etabLayersRef.current[`layer_etabN${n}S${s}`]?.addTo(map);
        }
      }

      // Villages
      villageLayerRef.current.clearLayers();
      (villagesData || []).forEach((v: any) => {
        if (!v.latitude || !v.longitude) return;
        const icon = L.divIcon({
          className: 'custom-icon',
          iconSize: [20, 20],
          html: `<i class="fa fa-solid fa-caret-up text-danger"></i><span class="label-village" style="font-size:0px;position:absolute;top:10px;white-space:nowrap;">${v.name}</span>`,
        });
        const marker = L.marker([parseFloat(v.latitude), parseFloat(v.longitude)], {
          icon,
          draggable: true,
          // @ts-ignore
          properties: { id: v.id, nom: v.name },
        });
        marker.bindTooltip(`<b>${v.name}</b>`, { permanent: false, opacity: 1, direction: 'top' });
        marker.on('dragstart', onDragMarkerStart);
        marker.on('dragend', onDragVillageEnd);
        villageLayerRef.current.addLayer(marker);
        allSearchItems.push({ latLng: [parseFloat(v.latitude), parseFloat(v.longitude)], id: v.id, name: `Village ${v.name}` });
      });
      lc.addOverlay(villageLayerRef.current, "VILLAGES");

      // Aire control - matching sig.js exactly
      const aireCtrl = new (L.Control.extend({ options: { position: 'topright' } }))();
      aireCtrl.onAdd = () => {
        const div = L.DomUtil.create('div', 'control-aire');
        div.style.cssText = 'padding:6px 8px;background:rgba(255,255,255,0.8);font-size:12px;box-shadow:0 0 15px rgba(0,0,0,0.2);border:2px solid #999;border-radius:5px;line-height:2.2;';
        div.innerHTML = `
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer;margin:0;">
            <input id="N1S0" class="ctrl_aire_etab" type="checkbox" style="width:15px;height:15px;" />
            &nbsp;Aire EPP
          </label>
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer;margin:0;">
            <input id="N2S0" class="ctrl_aire_etab" type="checkbox" style="width:15px;height:15px;" />
            &nbsp;Aire CEG
          </label>
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer;margin:0;">
            <input id="N3S0" class="ctrl_aire_etab" type="checkbox" style="width:15px;height:15px;" />
            &nbsp;Aire LYCEE
          </label>
        `;
        L.DomEvent.disableClickPropagation(div);
        setTimeout(() => {
          ['N1S0', 'N2S0', 'N3S0'].forEach(id => {
            const cb = document.getElementById(id) as HTMLInputElement;
            if (cb) {
              cb.addEventListener('change', () => {
                const aireLayer = aireLayersRef.current[`aire_etab${id}`];
                const etabLayer = etabLayersRef.current[`layer_etab${id}`];
                if (cb.checked && etabLayer && map.hasLayer(etabLayer)) {
                  aireLayer?.addTo(map);
                } else if (!cb.checked) {
                  aireLayer?.remove();
                } else {
                  toast.warning("Veuillez afficher le groupe d'établissement correspondant");
                  cb.checked = false;
                }
              });
            }
          });
        }, 100);
        return div;
      };
      aireCtrl.addTo(map);
      ctrlAireRef.current = aireCtrl;

      // Deplacer control - matching sig.js exactly
      const moveCtrl = new (L.Control.extend({ options: { position: 'topleft' } }))();
      moveCtrl.onAdd = () => {
        const div = L.DomUtil.create('div', 'control-move');
        div.style.cssText = 'background:rgba(255,255,255,0.8);padding:6px 10px;border-radius:6px;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,0.12);display:flex;align-items:center;gap:6px;';
        div.innerHTML = `
          <input id="check-move" type="checkbox" style="appearance:auto;-webkit-appearance:auto;width:30px;height:30px;background-color:#e9efeafc;border-radius:15px;border:2px solid #000;cursor:pointer;accent-color:#e09c35;margin:0;"/>
          <i class="fas fa-arrows-alt"></i>
          <label id="lbl-chkmv" for="check-move" style="margin:0;cursor:pointer;font-weight:600;">Déplacer</label>
        `;
        L.DomEvent.disableClickPropagation(div);
        setTimeout(() => {
          const cb = document.getElementById('check-move') as HTMLInputElement;
          if (cb) {
            cb.addEventListener('click', () => {
              if (map.getZoom() <= 13) {
                toast.warning("Le niveau de zoom est trop faible pour déplacer");
                cb.checked = false;
              }
            });
          }
        }, 100);
        return div;
      };
      moveCtrl.addTo(map);
      moveCtrlRef.current = moveCtrl;

      // Unique search items
      const uniqueMap = new Map<string | number, SearchItem>();
      allSearchItems.forEach(item => { if (!uniqueMap.has(item.id)) uniqueMap.set(item.id, item); });
      setSearchItems(Array.from(uniqueMap.values()));

      // Stats
      const allData = [...(n0Data || []), ...(n1Data || []), ...(n2Data || []), ...(n3Data || [])];
      const total = allData.length;
      const pub = allData.filter(d => d.SECTEUR === 0).length;
      setStats({ total, publicCount: pub, privateCount: total - pub, villages: (villagesData || []).length });

      toast.success(`${total} établissement(s), ${(villagesData || []).length} village(s) chargés`);

      // Load non-geolocalized
      sigApi.getEtabNonGeolocalise(selectedDren, selectedCisco)
        .then(data => setEtabNonPointe(data || []))
        .catch(() => {});

    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  }, [selectedDren, selectedCisco]);

  // Search
  useEffect(() => {
    if (searchTerm.length < 2) { setSearchResults([]); return; }
    const term = searchTerm.toLowerCase();
    setSearchResults(searchItems.filter(item => item.name.toLowerCase().includes(term)).slice(0, 20));
  }, [searchTerm, searchItems]);

  const handleSearchSelect = (item: SearchItem) => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo(item.latLng, 14);
    if (searchMarkerRef.current) searchMarkerRef.current.remove();
    searchMarkerRef.current = L.circle(item.latLng, {
      radius: 500, color: 'green', fillColor: 'yellow', fillOpacity: 0.3,
    }).addTo(map).bindPopup(item.name).openPopup();
    setTimeout(() => {
      if (searchMarkerRef.current) { searchMarkerRef.current.remove(); searchMarkerRef.current = null; }
    }, 10000);
    setSearchTerm('');
    setSearchResults([]);
  };

  // Geolocaliser etablissement
  const handleSaveGeoEtab = async () => {
    if (!selectedEtabGeo) { toast.warning("Sélectionnez un établissement"); return; }
    if (geoCoords.lat === 0 && geoCoords.lng === 0) { toast.error("Erreur de coordonnées. Veuillez réessayer."); return; }
    try {
      await sigApi.geolocaliserEtab(selectedEtabGeo.CODE_ETAB, geoCoords.lng, geoCoords.lat);
      toast.success("Établissement géolocalisé avec succès");
      setShowGeoEtab(false);
      const map = mapRef.current;
      if (map) L.marker([geoCoords.lat, geoCoords.lng]).addTo(map).bindPopup(selectedEtabGeo.NOM_ETAB).openPopup();
    } catch (err) { toast.error("Erreur lors de la géolocalisation"); }
  };

  // Geolocaliser village
  const handleSaveGeoVillage = async () => {
    if (villageForm.name.length < 4) { toast.warning("Nom du village invalide (min 4 caractères)"); return; }
    const pop = parseInt(villageForm.population);
    if (isNaN(pop) || pop < 10) { toast.warning("Population invalide (min 10)"); return; }
    if (geoCoords.lat === 0 && geoCoords.lng === 0) { toast.error("Erreur de coordonnées. Veuillez réessayer."); return; }
    try {
      await sigApi.geolocaliserVillage({
        name: villageForm.name, dren: selectedDren, cisco: selectedCisco,
        population: pop, airtel: villageForm.airtel, orange: villageForm.orange,
        telma: villageForm.telma, elec: villageForm.elec, eau: villageForm.eau,
        latitude: geoCoords.lat, longitude: geoCoords.lng,
      });
      toast.success(`Village ${villageForm.name} géolocalisé avec succès`);
      setShowGeoVillage(false);
      const map = mapRef.current;
      if (map) L.marker([geoCoords.lat, geoCoords.lng]).addTo(map).bindPopup(villageForm.name).openPopup();
    } catch (err) { toast.error("Erreur lors de la géolocalisation"); }
  };

  // Chart data
  const getElevesChartData = (school: any) => {
    if (!school) return [];
    return [
      { annee: '2022', effectif: parseInt(school.eff_2022) || 0 },
      { annee: '2023', effectif: parseInt(school.eff_2023) || 0 },
      { annee: '2024', effectif: parseInt(school.eff_2024) || 0 },
      { annee: '2025', effectif: parseInt(school.eff_2025) || 0 },
    ].filter(d => d.effectif > 0);
  };

  const filteredEtabNonPointe = etabNonPointe.filter(e =>
    filterEtabName.length === 0 || e.NOM_ETAB?.toLowerCase().includes(filterEtabName.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-4rem)] relative">
      {/* Top bar */}
      <div className="absolute top-3 left-14 z-[1000] flex gap-2 flex-wrap">
        <Button onClick={() => setShowFilters(true)} size="sm" className="shadow-lg">
          <Filter className="h-4 w-4 mr-2" /> Filtres
        </Button>
        {stats.total > 0 && (
          <Badge variant="secondary" className="shadow-lg text-xs py-1.5">
            {stats.publicCount} publics, {stats.privateCount} privés, {stats.villages} villages — Total: {stats.total}
          </Badge>
        )}
        <div className="bg-background/90 backdrop-blur rounded-md shadow-lg px-1.5 py-0.5">
          <DataActionsBar table="sig_etablissement" tableLabel="SIG Établissement" compact />
        </div>
      </div>

      {/* Search bar */}
      {searchItems.length > 0 && (
        <div className="absolute top-14 left-14 z-[1000] w-80">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher écoles ou villages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background shadow-lg"
            />
          </div>
          {searchResults.length > 0 && (
            <div className="mt-1 bg-background border rounded-lg shadow-xl max-h-60 overflow-y-auto">
              {searchResults.map((item, i) => (
                <button
                  key={`sr-${item.id}-${i}`}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 border-b last:border-b-0 flex items-center gap-2"
                  onClick={() => handleSearchSelect(item)}
                >
                  <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="truncate">{item.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-[1001] flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Chargement des données SIG...</p>
          </div>
        </div>
      )}

      {/* Context Menu - right click */}
      {contextMenu && (
        <div
          className="absolute z-[2000] bg-white rounded-lg shadow-xl border py-1 min-w-[220px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 flex items-center gap-2"
            onClick={() => {
              if (zoomLevel < 15) {
                toast.warning("Le niveau de zoom est trop bas. Le zoom minimum autorisé est de 16.");
                setContextMenu(null);
                return;
              }
              setShowGeoEtab(true);
              setContextMenu(null);
              // Refresh non-geolocalized list
              sigApi.getEtabNonGeolocalise(selectedDren, selectedCisco)
                .then(data => setEtabNonPointe(data || []))
                .catch(() => {});
            }}
          >
            <MapPin className="w-4 h-4" /> Géolocaliser Établissement
          </button>
          <button
            className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 flex items-center gap-2"
            onClick={() => {
              if (zoomLevel < 15) {
                toast.warning("Le niveau de zoom est trop bas. Le zoom minimum autorisé est de 16.");
                setContextMenu(null);
                return;
              }
              setShowGeoVillage(true);
              setContextMenu(null);
            }}
          >
            <MapPin className="w-4 h-4" /> Géolocaliser Village
          </button>
          <hr className="my-1" />
          <button
            className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 flex items-center gap-2"
            onClick={() => { mapRef.current?.setZoom((mapRef.current?.getZoom() || 6) + 0.5); setContextMenu(null); }}
          >
            <ZoomIn className="w-4 h-4" /> Zoom +
          </button>
          <button
            className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 flex items-center gap-2"
            onClick={() => { mapRef.current?.zoomOut(); setContextMenu(null); }}
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

      {/* Filters Modal */}
      <Dialog open={showFilters} onOpenChange={setShowFilters}>
        <DialogContent className="sm:max-w-lg z-[10000]">
          <DialogHeader>
            <DialogTitle>Paramètres</DialogTitle>
            <DialogDescription>Sélectionnez les filtres DREN et CISCO pour afficher les données SIG.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="font-semibold">Filtres</Label>
              <Select value={selectedDren.toString()} onValueChange={(v) => handleDrenChange(Number(v))}>
                <SelectTrigger><SelectValue placeholder="Toutes les DREN" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Toutes les DREN</SelectItem>
                  {drens.map(d => (
                    <SelectItem key={d.CODE_DREN} value={d.CODE_DREN.toString()}>{d.DREN}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Select value={selectedCisco.toString()} onValueChange={(v) => setSelectedCisco(Number(v))} disabled={selectedDren === 0}>
                <SelectTrigger><SelectValue placeholder="Toutes les CISCO" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Toutes les CISCO</SelectItem>
                  {ciscos.map(c => (
                    <SelectItem key={c.CODE_CISCO} value={c.CODE_CISCO.toString()}>{c.CISCO}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {searchItems.length > 0 && (
              <div className="space-y-2">
                <Label className="font-semibold">Recherche</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Rechercher écoles ou villages..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                </div>
                {searchResults.length > 0 && (
                  <div className="border rounded-lg max-h-48 overflow-y-auto">
                    {searchResults.map((item, i) => (
                      <button
                        key={`modal-sr-${item.id}-${i}`}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 border-b"
                        onClick={() => { handleSearchSelect(item); setShowFilters(false); }}
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
            <Button onClick={handleApplyFilters} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Filter className="w-4 h-4 mr-2" />}
              Appliquer
            </Button>
            <Button variant="outline" onClick={() => setShowFilters(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Map container */}
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Fiche École Modal */}
      <Dialog open={!!selectedSchool} onOpenChange={() => setSelectedSchool(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto z-[10000]">
          <DialogHeader>
            <DialogTitle>Fiche école — {selectedSchool?.NOM_ETAB}</DialogTitle>
            <DialogDescription>Informations détaillées de l'établissement scolaire.</DialogDescription>
          </DialogHeader>
          {selectedSchool && (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4">
                  <h4 className="font-semibold text-sm uppercase mb-3 text-primary">Informations générales</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <tbody>
                        <tr>
                          <td rowSpan={4} className="w-[200px] p-2 align-top border">
                            <img
                              src="/img/etablissements/000000000.jpeg"
                              alt="Photo de l'établissement"
                              className="w-full h-auto rounded"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200x150?text=Photo+indisponible';
                              }}
                            />
                          </td>
                          <td className="border p-2"><strong>CODE ÉTABLISSEMENT :</strong> {selectedSchool.CODE_ETAB}</td>
                        </tr>
                        <tr>
                          <td className="border p-2"><strong>SECTEUR :</strong> {selectedSchool.SECTEUR === 0 ? 'PUBLIQUE' : 'PRIVÉE'}</td>
                        </tr>
                        <tr>
                          <td className="border p-2"><strong>ADRESSE :</strong> {selectedSchool.FOKONTANY || '-'}</td>
                        </tr>
                        <tr>
                          <td className="border p-2"><strong>ZONE :</strong> {selectedSchool.CATEGORIE_COMMUNE?.startsWith?.('U') ? 'URBAINE' : 'RURALE'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {getElevesChartData(selectedSchool).length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-sm uppercase mb-3 text-primary">Statistiques sur les élèves</h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={getElevesChartData(selectedSchool)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="annee" fontSize={11} />
                        <YAxis fontSize={11} />
                        <Tooltip />
                        <Line type="monotone" dataKey="effectif" stroke="rgb(75, 192, 192)" strokeWidth={2} name="ELEVES" dot />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="p-4">
                  <h4 className="font-semibold text-sm uppercase mb-3 text-primary">Statistiques sur les enseignants</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-muted"><th colSpan={6} className="border p-2 text-center font-semibold uppercase">Nombre d'enseignants par statut</th></tr>
                        <tr className="bg-muted/50">
                          <th className="border p-1.5 text-center">TOTAL</th>
                          <th className="border p-1.5 text-center">EN CLASSE</th>
                          <th className="border p-1.5 text-center">FONCTIONNAIRE ET CONTRACTUEL</th>
                          <th className="border p-1.5 text-center">FRAM SUB</th>
                          <th className="border p-1.5 text-center">FRAM NON SUB</th>
                          <th className="border p-1.5 text-center">AUTRES</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="text-center">
                          <td className="border p-1.5 font-semibold">{selectedSchool.pers_total || '-'}</td>
                          <td className="border p-1.5">{selectedSchool.en_classe || '-'}</td>
                          <td className="border p-1.5">{selectedSchool.fonctionnaire || '-'}</td>
                          <td className="border p-1.5">{selectedSchool.fram_sub || '-'}</td>
                          <td className="border p-1.5">{selectedSchool.fram_nonsub || '-'}</td>
                          <td className="border p-1.5">{selectedSchool.autres || '-'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="overflow-x-auto mt-4">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-muted"><th colSpan={5} className="border p-2 text-center font-semibold uppercase">Nombre d'enseignants par diplômes</th></tr>
                        <tr className="bg-muted/50">
                          <th className="border p-1.5 text-center">BEPC</th>
                          <th className="border p-1.5 text-center">BAC</th>
                          <th className="border p-1.5 text-center">LICENCE</th>
                          <th className="border p-1.5 text-center">BAC+5 ET PLUS</th>
                          <th className="border p-1.5 text-center">QUALIFIÉE</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="text-center">
                          <td className="border p-1.5">{selectedSchool.bepc || '-'}</td>
                          <td className="border p-1.5">{selectedSchool.bacc || '-'}</td>
                          <td className="border p-1.5">{selectedSchool.licence || '-'}</td>
                          <td className="border p-1.5">{selectedSchool.bacp5plus || '-'}</td>
                          <td className="border p-1.5 font-semibold">{selectedSchool.qualifiee || '-'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <h4 className="font-semibold text-sm uppercase mb-3 text-primary">Salles de classe et EAH</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="border p-1.5 text-center">SdC bon état</th>
                          <th className="border p-1.5 text-center">SdC mauvais état</th>
                          <th className="border p-1.5 text-center">Électrifié</th>
                          <th className="border p-1.5 text-center">Point d'eau</th>
                          <th className="border p-1.5 text-center">Latrine garçons</th>
                          <th className="border p-1.5 text-center">Latrine filles</th>
                          <th className="border p-1.5 text-center">Latrine commune</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="text-center">
                          <td className="border p-1.5">{selectedSchool.sdc_be || '-'}</td>
                          <td className="border p-1.5">{selectedSchool.sdc_me || '-'}</td>
                          <td className="border p-1.5">{parseInt(selectedSchool.elec) > 0 ? `OUI (${selectedSchool.TYPE_SOURCE_ELECTRICITE || ''})` : 'NON'}</td>
                          <td className="border p-1.5">{parseInt(selectedSchool.point_eau) > 0 ? `OUI (${selectedSchool.TYPE_SOURCE_EAU || ''})` : 'NON'}</td>
                          <td className="border p-1.5">{parseInt(selectedSchool.latrince_g || selectedSchool.latrine_g || 0) > 0 ? 'OUI' : 'NON'}</td>
                          <td className="border p-1.5">{parseInt(selectedSchool.latrince_f || selectedSchool.latrine_f || 0) > 0 ? 'OUI' : 'NON'}</td>
                          <td className="border p-1.5">{parseInt(selectedSchool.latrine || 0) > 0 ? 'OUI' : 'NON'}</td>
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

      {/* Géolocaliser Établissement Modal */}
      <Dialog open={showGeoEtab} onOpenChange={setShowGeoEtab}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto z-[10000]">
          <DialogHeader>
            <DialogTitle>Géolocaliser un établissement</DialogTitle>
            <DialogDescription>Sélectionnez un établissement dans la liste et enregistrez sa position.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input placeholder="Code établissement" value={selectedEtabGeo?.CODE_ETAB || ''} readOnly className="w-1/3" />
              <Input placeholder="Rechercher : établissement" value={filterEtabName} onChange={(e) => setFilterEtabName(e.target.value)} className="flex-1" />
              <Button onClick={handleSaveGeoEtab} disabled={!selectedEtabGeo} variant="destructive" size="sm">Enregistrer</Button>
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
                      className={`cursor-pointer hover:bg-muted/50 ${selectedEtabGeo?.CODE_ETAB === etab.CODE_ETAB ? 'bg-green-100' : ''}`}
                      onClick={() => { setSelectedEtabGeo(etab); setFilterEtabName(etab.NOM_ETAB); }}
                    >
                      <td className="p-2 border-t">{etab.CODE_ETAB}</td>
                      <td className="p-2 border-t">{etab.NOM_ETAB}</td>
                      <td className="p-2 border-t">{etab.SECTEUR === 1 ? 'Privée' : 'Public'}</td>
                      <td className="p-2 border-t">{etab.ZAP}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">Coordonnées: {geoCoords.lat.toFixed(6)}, {geoCoords.lng.toFixed(6)}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Géolocaliser Village Modal */}
      <Dialog open={showGeoVillage} onOpenChange={setShowGeoVillage}>
        <DialogContent className="sm:max-w-md z-[10000]">
          <DialogHeader>
            <DialogTitle>Géolocaliser un village</DialogTitle>
            <DialogDescription>Entrez les informations du village à géolocaliser.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nom du village" value={villageForm.name} onChange={(e) => setVillageForm(prev => ({ ...prev, name: e.target.value }))} />
            <Input placeholder="Population du village" type="number" min="10" value={villageForm.population} onChange={(e) => setVillageForm(prev => ({ ...prev, population: e.target.value }))} />
            <div className="grid grid-cols-3 gap-3">
              {['airtel', 'orange', 'telma'].map(field => (
                <label key={field} className="flex items-center gap-2 text-sm capitalize">
                  <input type="checkbox" checked={villageForm[field as keyof typeof villageForm] as boolean} onChange={(e) => setVillageForm(prev => ({ ...prev, [field]: e.target.checked }))} />
                  {field} ?
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {['elec', 'eau'].map(field => (
                <label key={field} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={villageForm[field as keyof typeof villageForm] as boolean} onChange={(e) => setVillageForm(prev => ({ ...prev, [field]: e.target.checked }))} />
                  {field === 'elec' ? 'Électricité' : 'Eau potable'} ?
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Coordonnées: {geoCoords.lat.toFixed(6)}, {geoCoords.lng.toFixed(6)}</p>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveGeoVillage} className="bg-green-600 hover:bg-green-700">Enregistrer</Button>
            <Button variant="outline" onClick={() => setShowGeoVillage(false)}>Annuler</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SIG;
