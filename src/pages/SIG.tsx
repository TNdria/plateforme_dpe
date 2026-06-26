import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as turf from '@turf/turf';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Settings,
  Search,
  Loader2,
  Filter,
  MapPin,
  ZoomIn,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import DataActionsBar from '@/components/admin/DataActionsBar';
import { sumFields, BE_FIELDS, ME_FIELDS } from '../utils/sig';

// ====================== CONFIG ======================
const DJANGO_BASE_URL = 'https://dpe-men.mg';

async function djangoGet<T = any>(path: string): Promise<T> {
  const url = `${DJANGO_BASE_URL}${path.startsWith('/') ? path : '/' + path}`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`Django GET ${path} → ${res.status}`);
  return res.json();
}

async function djangoPost<T = any>(
  path: string,
  data: Record<string, any>
): Promise<T> {
  const url = `${DJANGO_BASE_URL}${path.startsWith('/') ? path : '/' + path}`;
  const formData = new FormData();
  Object.entries(data).forEach(([k, v]) => formData.append(k, String(v)));
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!res.ok) throw new Error(`Django POST ${path} → ${res.status}`);
  return res.json();
}

// Pour les endpoints qui attendent json.loads(request.body) côté Django
async function djangoPostJSON<T = any>(
  path: string,
  data: Record<string, any>
): Promise<T> {
  const url = `${DJANGO_BASE_URL}${path.startsWith('/') ? path : '/' + path}`;
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Django POST JSON ${path} → ${res.status}`);
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

type SigConfig = {
  modules: {
    pointage: boolean;
    deplacement: boolean;
    validationDeplacement: boolean;
  };
  permissions: {
    valider: boolean;
    rejeter: boolean;
    supprimer: boolean;
    verifier: boolean;
  };
};

// ====================== FIX DEFAULT MARKERS ======================
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })
  ._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// ====================== STYLES COUCHES ======================
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
const STYLE_FOKONTANY = {
  fillColor: '#55ff00',
  color: '#55ff00',
  weight: 0.6,
  opacity: 0.5,
  fillOpacity: 0.03,
};

const MAPBOX_TOKEN =
  'pk.eyJ1IjoidG9reSIsImEiOiJjbTE4djVndXIxNmQwMmxzam1nY3JzcWU0In0.KtMOpNhicsXZkbmcFtVd8w';
const BING_KEY =
  'AuhiCJHlGzhg93IqUH_oCpl_-ZUrIE6SPftlyGYUvr9Amx5nzA-WqGcPquyFZl4L';

const NIVEAU_CONFIG: Record<
  string,
  { fa: string; label: string; aireColor: string; rayon: number }
> = {
  n0: { fa: 'fas fa-book-open', label: 'PRESCO', aireColor: 'green', rayon: 2 },
  n1: {
    fa: 'fas fa-book-open',
    label: 'PRIMAIRE',
    aireColor: 'green',
    rayon: 2,
  },
  n2: { fa: 'fas fa-school', label: 'COLLEGE', aireColor: 'blue', rayon: 5 },
  n3: { fa: 'fas fa-building', label: 'LYCEE', aireColor: 'yellow', rayon: 20 },
};

const VILLAGE_CONFIG = {
  fa: 'fas fa-home',
  label: 'Village',
  aireColor: '#a35b08',
  rayon: 5,
};

// ====================== COMPOSANT PRINCIPAL ======================
const SIG = () => {
  const { user } = useAuth();
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const layerControlRef = useRef<L.Control.Layers | null>(null);

  const etabLayersRef = useRef<Record<string, L.LayerGroup>>({});
  const aireLayersRef = useRef<Record<string, L.LayerGroup>>({});
  const shpRef = useRef<Record<string, L.GeoJSON | null>>({
    dren: null,
    cisco: null,
    commune: null,
    fokontany: null,
  });
  const villageLayerRef = useRef<L.LayerGroup>(new L.LayerGroup());
  const ctrlAireRef = useRef<L.Control | null>(null);
  const moveCtrlRef = useRef<L.Control | null>(null);
  const searchMarkerRef = useRef<L.Circle | null>(null);
  const positionAvantDeplacementRef = useRef<L.LatLng | null>(null);
  const verificationMarkersRef = useRef<L.LayerGroup>(new L.LayerGroup());
  const markersRef = useRef<any[]>([]);
  const tempMarkersRef = useRef<any[]>([]);

  // ====================== STATE ======================
  const [drens, setDrens] = useState<Dren[]>([]);
  const [ciscos, setCiscos] = useState<Cisco[]>([]);
  const [selectedDren, setSelectedDren] = useState<number>(0);
  const [selectedCisco, setSelectedCisco] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(6);
  const [sigMoveEnabled, setSigMoveEnabled] = useState(false);
  const [searchItems, setSearchItems] = useState<SearchItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
  const [sigConfig, setSigConfig] = useState<SigConfig>({
    modules: {
      pointage: true,
      deplacement: false,
      validationDeplacement: false,
    },
    permissions: {
      valider: false,
      rejeter: false,
      supprimer: false,
      verifier: true,
    },
  });
  const [showDeplacementsModal, setShowDeplacementsModal] = useState(false);
  const [verifyMode, setVerifyMode] = useState(false);
  const [verifyItem, setVerifyItem] = useState<any>(null);
  const [deplacements, setDeplacements] = useState<any[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<any | null>(null);
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
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number }>({
    lat: 0,
    lng: 0,
  });
  const [etabNonPointe, setEtabNonPointe] = useState<any[]>([]);
  const [selectedEtabGeo, setSelectedEtabGeo] = useState<any | null>(null);
  const [filterEtabName, setFilterEtabName] = useState('');
  const [villageForm, setVillageForm] = useState({
    name: '',
    population: '',
    airtel: false,
    orange: false,
    telma: false,
    elec: false,
    eau: false,
  });
  const [stats, setStats] = useState({
    total: 0,
    publicCount: 0,
    privateCount: 0,
    villages: 0,
  });

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
        position: 'bottomright',
        metric: true,
        imperial: false,
        maxWidth: 160,
      })
      .addTo(map);

    setTimeout(() => {
      const sc = document.querySelector(
        '.leaflet-control-scale'
      ) as HTMLElement;
      if (sc)
        Object.assign(sc.style, {
          backgroundColor: 'rgba(255,255,255,0.96)',
          border: '1px solid #d1d5db',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          padding: '5px 10px',
          fontSize: '12px',
          fontWeight: '500',
          color: '#1f2937',
          marginBottom: '14px',
          marginRight: '14px',
        });
      const sl = document.querySelector(
        '.leaflet-control-scale-line'
      ) as HTMLElement;
      if (sl)
        Object.assign(sl.style, {
          border: '2.5px solid #374151',
          borderTop: 'none',
          borderRadius: '3px',
          padding: '3px 7px',
          background: 'rgba(255,255,255,0.9)',
          fontWeight: '700',
        });
    }, 400);

    // Boussole
    const compassDiv = L.DomUtil.create('div', 'leaflet-control');
    compassDiv.id = 'compass-control';
    compassDiv.style.cssText = `
      position:relative;top:10px;left:5px;z-index:1000;
      background:rgba(255,255,255,0.95);border:2px solid #ccc;border-radius:50px;
      padding:6px;box-shadow:0 2px 8px rgba(0,0,0,0.2);pointer-events:none;
      width:45px;height:45px;display:flex;align-items:center;justify-content:center;
    `;
    compassDiv.innerHTML = `<img src="/img/Nord.png" alt="Nord" style="width:36px;height:36px;object-fit:contain;" title="Nord"/>`;
    document.getElementById('compass-control')?.remove();
    map.getContainer().appendChild(compassDiv);
    setTimeout(() => {
      const zc = document.querySelector('.leaflet-control-zoom') as HTMLElement;
      if (zc) zc.style.marginTop = '65px';
    }, 200);

    // Fonds de carte
    const DEFAULT_LAYER = L.tileLayer('', {
      maxZoom: 24,
      attribution: '© MEN/DPE',
    });
    const OSM_LAYER = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 22,
        attribution: '© OpenStreetMap',
      }
    ).addTo(map);
    const IMAGERY_LAYER = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 22, attribution: '&copy; Esri' }
    );
    const MAP_BOX = L.tileLayer(
      `https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`,
      {
        maxZoom: 24,
        tileSize: 512,
        zoomOffset: -1,
        attribution: '&copy; Mapbox',
      }
    );
    const BING_LAYER = L.tileLayer(
      'https://ecn.t{s}.tiles.virtualearth.net/tiles/a{z}{x}{y}.jpeg?g=587&n=z&key=' +
        BING_KEY,
      {
        maxZoom: 19,
        attribution: '&copy; Microsoft Bing',
        subdomains: ['0', '1', '2', '3'],
      } as any
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
      { position: 'topright', collapsed: false }
    );
    layerControl.addTo(map);
    layerControlRef.current = layerControl;

    // Bouton Reset
    const ResetControl = L.Control.extend({
      options: { position: 'topleft' as L.ControlPosition },
      onAdd: () => {
        const btn = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        btn.innerHTML =
          '<a href="#" title="Réinitialiser" style="font-size:16px;line-height:30px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;"><i class="fas fa-redo-alt"></i></a>';
        btn.onclick = (e) => {
          e.preventDefault();
          const drenShp = shpRef.current.dren;
          const ciscoShp = shpRef.current.cisco;
          if (drenShp && map.hasLayer(drenShp))
            map.fitBounds(drenShp.getBounds());
          else if (ciscoShp && map.hasLayer(ciscoShp))
            map.fitBounds(ciscoShp.getBounds());
          else map.setView([-18.9189596, 47.5135653], 6);
        };
        return btn;
      },
    });
    new ResetControl().addTo(map);

    // Bouton Plein écran
    const FullscreenControl = L.Control.extend({
      options: { position: 'topleft' as L.ControlPosition },
      onAdd: () => {
        const btn = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
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

    // Légende
    const legend = new (L.Control.extend({
      options: { position: 'bottomleft' },
    }))();
    legend.onAdd = () => {
      const div = L.DomUtil.create('div', 'legend');
      div.style.cssText =
        'background:rgba(255,255,255,0.92);padding:10px 14px;border-radius:8px;font-size:12px;line-height:1.8;box-shadow:0 2px 12px rgba(0,0,0,0.15);';
      div.innerHTML = `
        <p style="font-size:14px;margin:0 0 4px"><strong><u>Légende</u></strong></p>
        <i class="fa fa-square text-primary"></i>&nbsp;Secteur Public<br/>
        <i class="fa fa-square text-warning"></i>&nbsp;Secteur Privé<br/>
        <i class="${NIVEAU_CONFIG.n1.fa}"></i>&nbsp;Présco et Primaire<br/>
        <i class="${NIVEAU_CONFIG.n2.fa}"></i>&nbsp;Collège<br/>
        <i class="${NIVEAU_CONFIG.n3.fa}"></i>&nbsp;Lycée<br/>
        <i class="${VILLAGE_CONFIG.fa}"></i>&nbsp;Villages<br/>
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

    setTimeout(() => {
      const scale = document.querySelector(
        '.leaflet-control-scale'
      ) as HTMLElement;
      if (scale) {
        scale.style.marginLeft = '20px';
        scale.style.marginBottom = '8px';
      }
    }, 400);

    // Indicateur de zoom
    const zoomCtrl = new (L.Control.extend({
      options: { position: 'topleft' },
    }))();
    zoomCtrl.onAdd = () => {
      const div = L.DomUtil.create('div', '');
      div.style.cssText =
        'background:#272729af;padding:4px 10px;font-size:12px;color:#fff;border-radius:4px;';
      div.id = 'zoom-indicator';
      div.innerHTML = `Niveau de Zoom: ${map.getZoom()}`;
      return div;
    };
    zoomCtrl.addTo(map);

    map.on('zoomend', () => {
      const z = map.getZoom();
      setZoomLevel(z);
      const el = document.getElementById('zoom-indicator');
      if (el) el.innerHTML = `Niveau de Zoom: ${z}`;
      let fontSize = '0px';
      if (z > 16) fontSize = '13px';
      else if (z > 14) fontSize = '10px';
      else if (z > 12) fontSize = '8px';
      document
        .querySelectorAll<HTMLElement>('.label-etab')
        .forEach((el) => (el.style.fontSize = fontSize));
      document
        .querySelectorAll<HTMLElement>('.label-village')
        .forEach((el) => (el.style.fontSize = fontSize));
      const moveCheckbox = document.getElementById(
        'check-move'
      ) as HTMLInputElement;
      if (moveCheckbox?.checked && z < 16) moveCheckbox.checked = false;
    });

    map.on('baselayerchange', (e: any) => {
      const z = map.getZoom();
      const isDark = e.name !== 'DEFAULT' && e.name !== 'OSM';
      const color = isDark ? 'white' : 'black';
      if (z > 12) {
        document
          .querySelectorAll<HTMLElement>('.label-etab')
          .forEach((el) => (el.style.color = color));
        document
          .querySelectorAll<HTMLElement>('.label-village')
          .forEach((el) => (el.style.color = color));
      }
    });

    map.on('click', () => setContextMenu(null));

    // Init layer groups
    for (let n = 0; n < 4; n++) {
      for (let s = 0; s < 2; s++) {
        etabLayersRef.current[`layer_etabN${n}S${s}`] = new L.LayerGroup();
        aireLayersRef.current[`aire_etabN${n}S${s}`] = new L.LayerGroup();
      }
    }

    mapRef.current = map;

    // Charger les DREN — route kebab-case conforme à urls.py
    djangoGet<Dren[]>('/sig/dren/').then(setDrens).catch(console.error);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

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
        // Utilise DJANGO_BASE_URL pour rester cohérent avec les autres appels
        const data = await djangoGet(`/sig/tables-bancs/?${params}`);
        if (!cancelled) setTablesBancs(data);
      } catch (err) {
        if (!cancelled) console.error('Erreur tables-bancs:', err);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [selectedSchool, niveau]);

  // ====================== CHARGER CONFIG SIG ======================
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await djangoGet('/sig/config/');
        const modules = res?.modules || {};
        const permissions = res?.permissions || {};

        // Normalisation robuste pour gérer les différentes conventions de nommage
        const getModule = (key: string): boolean => {
          return Boolean(
            modules[key] ??
            modules[key.replace(/([A-Z])/g, '_$1').toLowerCase()] ?? // camelCase → snake_case
            modules[key.toLowerCase()] ??
            false
          );
        };

        setSigConfig({
          modules: {
            pointage: getModule('pointage'),
            deplacement: getModule('deplacement'),
            validationDeplacement:
              getModule('validationDeplacement') ||
              getModule('validation_deplacement'),
          },
          permissions: {
            valider: Boolean(permissions.valider),
            rejeter: Boolean(permissions.rejeter),
            supprimer: Boolean(permissions.supprimer),
            verifier: Boolean(permissions.verifier ?? true), // fallback sécurisé
          },
        });

        // Debug temporaire (à supprimer après vérification)
        /*console.log('✅ Config SIG chargée :', {
          validationDeplacement:
            getModule('validationDeplacement') ||
            getModule('validation_deplacement'),
          rawModules: modules,
        });*/
      } catch (err) {
        //console.warn('❌ Erreur chargement config SIG → fallback', err);
        setSigConfig({
          modules: {
            pointage: true,
            deplacement: false,
            validationDeplacement: false,
          },
          permissions: {
            valider: false,
            rejeter: false,
            supprimer: false,
            verifier: true,
          },
        });
      }
    };

    loadConfig();
  }, []);

  // ====================== GESTION CISCO PAR RAPPORT DREN SELECTIONNE======================
  useEffect(() => {
    const load = async () => {
      if (selectedDren === 0) {
        setCiscos([]);
        setSelectedCisco(0);
        return;
      }

      try {
        const data = await djangoGet<Cisco[]>(
          `/sig/liste-cisco/${selectedDren}/`
        );

        setCiscos(Array.isArray(data) ? data : []);
        setSelectedCisco(0);
      } catch {
        setCiscos([]);
        setSelectedCisco(0);
        toast.error('Erreur chargement CISCO');
      }
    };

    load();
  }, [selectedDren]);

  // ====================== GESTION DES LAYERS ======================
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
    for (let n = 0; n < 4; n++) {
      for (let s = 0; s < 2; s++) {
        const layer = etabLayersRef.current[`layer_etabN${n}S${s}`];
        if (layer && map.hasLayer(layer)) map.removeLayer(layer);
      }
    }
    if (map.hasLayer(villageLayerRef.current))
      map.removeLayer(villageLayerRef.current);
  };

  const showAllSigLayers = () => {
    const map = mapRef.current;
    if (!map) return;
    for (let n = 0; n < 4; n++) {
      for (let s = 0; s < 2; s++) {
        const layer = etabLayersRef.current[`layer_etabN${n}S${s}`];
        if (layer) layer.addTo(map);
      }
    }
    villageLayerRef.current.addTo(map);
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

  // updatePositionEtablissement attend json.loads(request.body) côté Django
  const onDragEtabEnd = async (e: any, etab: any) => {
    if (!sigConfig.modules.deplacement) return;
    const { lat, lng } = e.target.getLatLng();
    try {
      await djangoPostJSON('/sig/deplacements/update-position-etablissement/', {
        code_etab: etab.CODE_ETAB,
        nouveau_lat: lat,
        nouveau_lng: lng,
        demande_par: user?.username || 'system',
      });
      toast.info('Demande de déplacement envoyée');
    } catch {
      toast.error('Erreur lors du déplacement');
    }
  };

  // updatePositionVillage attend json.loads(request.body) côté Django
  const onDragVillageEnd = async (e: L.LeafletEvent) => {
    if (!sigConfig.modules.deplacement) return;
    const marker = e.target as any;
    const village = marker.properties;
    const { lat, lng } = (marker as L.Marker).getLatLng();
    try {
      await djangoPostJSON('/sig/deplacements/update-position-village/', {
        id_village: village.id,
        nouveau_lat: lat,
        nouveau_lng: lng,
        demande_par: user?.username || 'system',
      });
    } catch {
      toast.error('Erreur lors du déplacement du village');
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
    const nIdx = niveauKey.replace('n', '');
    const items: SearchItem[] = [];

    data.forEach((dataEtab) => {
      const lat = parseFloat(dataEtab.latitude);
      const lng = parseFloat(dataEtab.longitude);
      if (
        isNaN(lat) ||
        isNaN(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      )
        return;

      const cls = dataEtab.SECTEUR === 0 ? 'text-primary' : 'text-warning';
      const icon = L.divIcon({
        className: 'custom-icon',
        iconSize: [20, 20],
        html: `<i class="${config.fa} ${cls}"></i><span class="label-etab" style="font-size:0px;position:absolute;top:10px;white-space:nowrap;">${dataEtab.NOM_ETAB}</span>`,
      });

      const latLng: [number, number] = [lat, lng];
      items.push({
        latLng,
        id: dataEtab.CODE_ETAB,
        name: `${dataEtab.NOM_ETAB} / ${dataEtab.FOKONTANY || ''}`,
      });

      const marker = L.marker(latLng, {
        icon,
        draggable: true,
        properties: dataEtab,
      } as any);

      marker.bindTooltip(
        `<div class="custom-tooltip">${dataEtab.NOM_ETAB}</div>`,
        {
          permanent: false,
          opacity: 1,
          direction: 'top',
        }
      );
      marker.on('mouseover', () => setHoveredEtab(dataEtab));
      marker.on('mouseout', () => setHoveredEtab(null));
      marker.on('click', () => {
        setNiveau(Number(niveauKey.replace('n', '')));
        setSelectedSchool(dataEtab);
      });
      marker.on('dragstart', onDragMarkerStart);
      marker.on('dragend', (e) => {
        void onDragEtabEnd(e, dataEtab);
      });

      try {
        const buffer = turf.buffer(turf.point([lng, lat]), config.rayon, {
          units: 'kilometers',
        });
        if (buffer) {
          const bufferPolygon = L.geoJSON(buffer as any, {
            style: {
              color: config.aireColor,
              fillColor: config.aireColor,
              weight: 1,
              fillOpacity: 0.05,
            },
          });
          bufferPolygon.eachLayer((layer: any) => {
            layer.on('mouseover', (e: any) =>
              e.target.setStyle({
                weight: 2,
                color: '#ff0000',
                fillOpacity: 0.1,
              })
            );
            layer.on('mouseout', (e: any) =>
              e.target.setStyle({
                color: config.aireColor,
                fillColor: config.aireColor,
                weight: 1,
                fillOpacity: 0.05,
              })
            );
          });
          aireLayersRef.current[
            `aire_etabN${nIdx}S${dataEtab.SECTEUR}`
          ]?.addLayer(bufferPolygon);
        }
      } catch (err) {
        console.warn(`Buffer failed for etab ${dataEtab.CODE_ETAB}`, err);
      }

      etabLayersRef.current[`layer_etabN${nIdx}S${dataEtab.SECTEUR}`]?.addLayer(
        marker
      );
    });

    return items;
  };

  // ====================== APPLIQUER LES FILTRES ======================
  const handleApplyFilters = useCallback(async () => {
    const map = mapRef.current;
    const lc = layerControlRef.current;
    if (!map || !lc) return;

    if (selectedDren === 0) {
      toast.error('Veuillez sélectionner une DREN');
      return;
    }

    setLoading(true);
    setShowFilters(false);
    setContextMenu(null);

    try {
      clearBaseShapes();
      clearEtabLayers();
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

      const codeDren = selectedDren;
      const codeCisco = selectedCisco;

      // Routes conformes à urls.py (kebab-case)
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
        djangoGet(
          `/sig/etablissements-non-geolocalises/${codeDren}/${codeCisco}/`
        ),
      ]);

      const drenData = drenRes.status === 'fulfilled' ? drenRes.value : [];
      const ciscoData = ciscoRes.status === 'fulfilled' ? ciscoRes.value : [];
      const communeData =
        communeRes.status === 'fulfilled' ? communeRes.value : [];
      const fktData =
        fokontanyRes.status === 'fulfilled' ? fokontanyRes.value : [];
      const villagesData =
        villagesRes.status === 'fulfilled' ? villagesRes.value : [];
      const n0Data = n0Res.status === 'fulfilled' ? n0Res.value : [];
      const n1Data = n1Res.status === 'fulfilled' ? n1Res.value : [];
      const n2Data = n2Res.status === 'fulfilled' ? n2Res.value : [];
      const n3Data = n3Res.status === 'fulfilled' ? n3Res.value : [];

      setEtabNonPointe(nonGeoRes.status === 'fulfilled' ? nonGeoRes.value : []);

      // ── SHAPES GÉOGRAPHIQUES ──
      // get_layer_dren retourne [{shape: FeatureCollection}]
      if (drenData?.[0]?.shape) {
        shpRef.current.dren = L.geoJSON(drenData[0].shape, {
          style: STYLE_DREN,
        });
      }
      if (ciscoData?.[0]?.shape) {
        shpRef.current.cisco = L.geoJSON(ciscoData[0].shape, {
          style: STYLE_CISCO,
          onEachFeature: (feature, layer) => {
            layer.bindTooltip(`CISCO: ${feature.properties?.name || ''}`, {
              permanent: false,
            });
            layer.on('contextmenu', handleContextMenu);
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
            layer.bindTooltip(`Fokontany: ${feature.properties?.name || ''}`, {
              permanent: false,
            });
            layer.on('contextmenu', handleContextMenu);
          },
        });
      }

      if (shpRef.current.dren) shpRef.current.dren.addTo(map);
      if (shpRef.current.cisco) shpRef.current.cisco.addTo(map);
      if (shpRef.current.commune) shpRef.current.commune.addTo(map);
      if (shpRef.current.fokontany) shpRef.current.fokontany.addTo(map);

      if (codeCisco > 0 && shpRef.current.cisco) {
        map.fitBounds(shpRef.current.cisco.getBounds());
      } else if (shpRef.current.dren) {
        map.fitBounds(shpRef.current.dren.getBounds());
      }

      // ── MARQUEURS ÉTABLISSEMENTS ──
      const allSearchItems: SearchItem[] = [];
      allSearchItems.push(...(createLayerEtab(n0Data, 'n0') || []));
      allSearchItems.push(...(createLayerEtab(n1Data, 'n1') || []));
      allSearchItems.push(...(createLayerEtab(n2Data, 'n2') || []));
      allSearchItems.push(...(createLayerEtab(n3Data, 'n3') || []));

      // ── VILLAGES ──
      // get_layer_village retourne [{id, name, code_dren, code_cisco, longitude, latitude}]
      villageLayerRef.current.clearLayers();
      const villageItems: SearchItem[] = [];

      (villagesData as any[]).forEach((v: any) => {
        const lat = parseFloat(v.latitude);
        const lng = parseFloat(v.longitude);
        if (isNaN(lat) || isNaN(lng)) return;

        const icon = L.divIcon({
          className: 'custom-icon',
          iconSize: [18, 18],
          html: `<i class="${VILLAGE_CONFIG.fa}" style="color:${VILLAGE_CONFIG.aireColor}; font-size:18px;"></i>`,
        });

        const marker = L.marker([lat, lng], { icon, draggable: true });
        (marker as any).properties = v;

        marker.bindTooltip(`Village: ${v.name}`, {
          permanent: false,
          direction: 'top',
        });
        marker.on('mouseover', () => setHoveredEtab(v));
        marker.on('mouseout', () => setHoveredEtab(null));
        marker.on('dragstart', onDragMarkerStart);
        marker.on('dragend', onDragVillageEnd);

        villageLayerRef.current.addLayer(marker);
        villageItems.push({ latLng: [lat, lng], id: v.id, name: v.name });
      });

      allSearchItems.push(...villageItems);
      setSearchItems(allSearchItems);

      // Statistiques
      const publicCount =
        n0Data.length + n1Data.length + n2Data.length + n3Data.length;
      setStats({
        total: publicCount + villageItems.length,
        publicCount: [...n0Data, ...n1Data, ...n2Data, ...n3Data].filter(
          (e: any) => e.SECTEUR === 0
        ).length,
        privateCount: [...n0Data, ...n1Data, ...n2Data, ...n3Data].filter(
          (e: any) => e.SECTEUR !== 0
        ).length,
        villages: villageItems.length,
      });

      // ── OVERLAYS DANS LE LAYER CONTROL ──
      lc.addOverlay(etabLayersRef.current['layer_etabN0S0'], 'PRESCO PUBLIC');
      lc.addOverlay(etabLayersRef.current['layer_etabN0S1'], 'PRESCO PRIVÉ');
      lc.addOverlay(etabLayersRef.current['layer_etabN1S0'], 'PRIMAIRE PUBLIC');
      lc.addOverlay(etabLayersRef.current['layer_etabN1S1'], 'PRIMAIRE PRIVÉ');
      lc.addOverlay(etabLayersRef.current['layer_etabN2S0'], 'COLLEGE PUBLIC');
      lc.addOverlay(etabLayersRef.current['layer_etabN2S1'], 'COLLEGE PRIVÉ');
      lc.addOverlay(etabLayersRef.current['layer_etabN3S0'], 'LYCEE PUBLIC');
      lc.addOverlay(etabLayersRef.current['layer_etabN3S1'], 'LYCEE PRIVÉ');
      lc.addOverlay(villageLayerRef.current, 'VILLAGES');

      // ── CONTRÔLE AIRES ──
      const aireCtrl = new (L.Control.extend({
        options: { position: 'topright' },
      }))();
      aireCtrl.onAdd = () => {
        const div = L.DomUtil.create('div', 'control-aire');
        div.style.cssText =
          'padding:6px 8px;background:rgba(255,255,255,0.8);font-size:12px;box-shadow:0 0 15px rgba(0,0,0,0.2);border:2px solid #999;border-radius:5px;line-height:2.2;';
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
          ['N1S0', 'N2S0', 'N3S0'].forEach((id) => {
            const cb = document.getElementById(id) as HTMLInputElement;
            if (!cb) return;
            cb.addEventListener('change', () => {
              const aireLayer = aireLayersRef.current[`aire_etab${id}`];
              const etabLayer = etabLayersRef.current[`layer_etab${id}`];
              if (cb.checked && etabLayer && map.hasLayer(etabLayer)) {
                aireLayer?.addTo(map);
              } else if (!cb.checked) {
                aireLayer?.remove();
              } else {
                toast.warning(
                  "Veuillez afficher le groupe d'établissement correspondant"
                );
                cb.checked = false;
              }
            });
          });
        }, 100);
        return div;
      };
      aireCtrl.addTo(map);
      ctrlAireRef.current = aireCtrl;

      toast.success(
        `Chargement terminé : ${n0Data.length + n1Data.length + n2Data.length + n3Data.length} établissements`
      );
    } catch (err: any) {
      console.error('Erreur handleApplyFilters:', err);
      toast.error('Erreur lors du chargement des données SIG');
    } finally {
      setLoading(false);
    }
  }, [selectedDren, selectedCisco]);

  // ====================== RECHERCHE ======================
  useEffect(() => {
    if (searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }
    const term = searchTerm.toLowerCase();
    setSearchResults(
      searchItems
        .filter((item) => item.name.toLowerCase().includes(term))
        .slice(0, 20)
    );
  }, [searchTerm, searchItems]);

  const handleSearchSelect = (item: SearchItem) => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo(item.latLng, 14);
    if (searchMarkerRef.current) searchMarkerRef.current.remove();
    searchMarkerRef.current = L.circle(item.latLng, {
      radius: 500,
      color: 'green',
      fillColor: 'yellow',
      fillOpacity: 0.3,
    })
      .addTo(map)
      .bindPopup(item.name)
      .openPopup();
    setTimeout(() => {
      searchMarkerRef.current?.remove();
      searchMarkerRef.current = null;
    }, 10000);
    setSearchTerm('');
    setSearchResults([]);
  };

  // ====================== GÉOLOCALISER ÉTABLISSEMENT ======================
  const handleSaveGeoEtab = async () => {
    if (!selectedEtabGeo) {
      toast.warning('Sélectionnez un établissement');
      return;
    }
    if (geoCoords.lat === 0 && geoCoords.lng === 0) {
      toast.error('Erreur de coordonnées.');
      return;
    }
    try {
      // Route conforme à urls.py : /sig/geolocaliser-etablissement/
      await djangoPost('/sig/geolocaliser-etablissement/', {
        code_etab: selectedEtabGeo.CODE_ETAB,
        longitude: geoCoords.lng,
        latitude: geoCoords.lat,
      });
      toast.success('Établissement géolocalisé avec succès');
      setShowGeoEtab(false);
      const map = mapRef.current;
      if (map)
        L.marker([geoCoords.lat, geoCoords.lng])
          .addTo(map)
          .bindPopup(selectedEtabGeo.NOM_ETAB)
          .openPopup();
    } catch {
      toast.error('Erreur lors de la géolocalisation');
    }
  };

  // ====================== GÉOLOCALISER VILLAGE ======================
  const handleSaveGeoVillage = async () => {
    if (villageForm.name.length < 4) {
      toast.warning('Nom du village invalide (min 4 caractères)');
      return;
    }
    const pop = parseInt(villageForm.population);
    if (isNaN(pop) || pop < 10) {
      toast.warning('Population invalide (min 10)');
      return;
    }
    if (geoCoords.lat === 0 && geoCoords.lng === 0) {
      toast.error('Erreur de coordonnées.');
      return;
    }
    try {
      // Route conforme à urls.py : /sig/geolocaliser-village/
      await djangoPost('/sig/geolocaliser-village/', {
        name: villageForm.name,
        dren: selectedDren,
        cisco: selectedCisco,
        population: pop,
        airtel: villageForm.airtel ? 1 : 0,
        orange: villageForm.orange ? 1 : 0,
        telma: villageForm.telma ? 1 : 0,
        elec: villageForm.elec ? 1 : 0,
        eau: villageForm.eau ? 1 : 0,
        latitude: geoCoords.lat,
        longitude: geoCoords.lng,
      });
      toast.success(`Village ${villageForm.name} géolocalisé avec succès`);
      setShowGeoVillage(false);
      setVillageForm({
        name: '',
        population: '',
        airtel: false,
        orange: false,
        telma: false,
        elec: false,
        eau: false,
      });
      const map = mapRef.current;
      if (map)
        L.marker([geoCoords.lat, geoCoords.lng])
          .addTo(map)
          .bindPopup(villageForm.name)
          .openPopup();
    } catch {
      toast.error('Erreur lors de la géolocalisation');
    }
  };

  // ====================== DÉPLACEMENTS ======================
  const loadDeplacements = async () => {
  try {
    if (!selectedDren) {
      toast.error("DREN obligatoire");
      return;
    }

    const url =
      selectedCisco > 0
        ? `/sig/deplacements/non-valides/?dren=${selectedDren}&cisco=${selectedCisco}`
        : `/sig/deplacements/non-valides/?dren=${selectedDren}`;

    const response = await djangoGet(url);

    setDeplacements(
      Array.isArray(response?.data) ? response.data : []
    );
  } catch (e) {
    console.error(e);
    toast.error("Impossible de charger les déplacements");
    setDeplacements([]);
  }
};

  // valider_deplacement attend json.loads(request.body) avec {type_objet, id}
  const handleValider = async (item: any) => {
    try {
      await djangoPostJSON('/sig/deplacements/valider/', {
        type_objet: item.type_objet,
        id: item.id,
      });
      toast.success('Déplacement validé');
      await loadDeplacements();
    } catch {
      toast.error('Erreur lors de la validation');
    }
  };

  // rejeter_deplacement attend json.loads(request.body) avec {type_objet, id}
  const handleRejeter = async (item: any) => {
    try {
      await djangoPostJSON('/sig/deplacements/rejeter/', {
        type_objet: item.type_objet,
        id: item.id,
      });
      toast.success('Déplacement rejeté');
      await loadDeplacements();
    } catch {
      toast.error('Erreur lors du rejet');
    }
  };

  // supprimer_deplacement attend json.loads(request.body) avec {type_objet, id}
  const handleSupprimer = async (item: any) => {
    if (!confirm('Supprimer définitivement ?')) return;
    try {
      await djangoPostJSON('/sig/deplacements/supprimer/', {
        type_objet: item.type_objet,
        id: item.id,
      });
      toast.success('Déplacement supprimé');
      await loadDeplacements();
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  // ====================== VÉRIFICATION DÉPLACEMENT ======================
  const handleVerifier = (item: any) => {
    const map = mapRef.current;
    if (!map) return;

    setShowDeplacementsModal(false);
    setVerifyMode(true);
    setVerifyItem(item);
    hideAllSigLayers();
    clearVerificationMarkers();

    const oldMarker = L.circleMarker([item.ancien_lat, item.ancien_lng], {
      radius: 10,
      color: 'green',
      fillColor: 'green',
      fillOpacity: 1,
      weight: 2,
    }).bindTooltip('Ancienne position', { permanent: true, direction: 'top' });

    const newMarker = L.circleMarker([item.nouveau_lat, item.nouveau_lng], {
      radius: 10,
      color: 'red',
      fillColor: 'red',
      fillOpacity: 1,
      weight: 2,
    }).bindTooltip('Nouvelle position', { permanent: true, direction: 'top' });

    verificationMarkersRef.current.addLayer(oldMarker);
    verificationMarkersRef.current.addLayer(newMarker);
    verificationMarkersRef.current.addTo(map);

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
      { annee: '2022', effectif: parseInt(school.eff_2022) || 0 },
      { annee: '2023', effectif: parseInt(school.eff_2023) || 0 },
      { annee: '2024', effectif: parseInt(school.eff_2024) || 0 },
      { annee: '2025', effectif: parseInt(school.eff_2025) || 0 },
    ].filter((d) => d.effectif > 0);
  };

  const filteredEtabNonPointe = etabNonPointe.filter(
    (e) =>
      filterEtabName.length === 0 ||
      e.NOM_ETAB?.toLowerCase().includes(filterEtabName.toLowerCase())
  );

  // ====================== STATS ENSEIGNANTS ======================
  const teacherStats = useMemo(() => {
    if (!selectedSchool) return null;
    const niveaux = ['PRÉSCOLAIRE', 'PRIMAIRE', 'COLLÈGE', 'LYCÉE'];
    return {
      niveau: niveaux[niveau] ?? 'INCONNU',
      total: Number(selectedSchool.pers_total ?? 0),
      en_classe: Number(selectedSchool.en_classe ?? 0),
      fonctionnaire: Number(selectedSchool.fonctionnaire ?? 0),
      fram_sub: Number(selectedSchool.fram_sub ?? 0),
      fram_nonsub: Number(selectedSchool.fram_nonsub ?? 0),
      autres: Number(selectedSchool.autres ?? 0),
    };
  }, [selectedSchool, niveau]);

  // ====================== INFRA ======================
  const infraStats = (good: any, bad: any, totalOverride?: any) => {
    const bon = Number(good) || 0;
    const mauvais = Number(bad) || 0;
    return { total: Number(totalOverride ?? bon + mauvais), bon, mauvais };
  };

  const isPositive = (v: any) => Number(v || 0) > 0;

  // ── Tables-bancs ──
  const latest = useMemo(() => {
    if (!tablesBancs?.length) return null;
    return [...tablesBancs].sort(
      (a, b) => b.ANNEE_SCOLAIRE - a.ANNEE_SCOLAIRE
    )[0];
  }, [tablesBancs]);

  const tbc = useMemo(() => {
    if (!latest) return { total: 0, bon: 0, mauvais: 0 };
    const bon = sumFields(latest, BE_FIELDS);
    const mauvais = sumFields(latest, ME_FIELDS);
    return { bon, mauvais, total: bon + mauvais };
  }, [latest]);

  const sdc = infraStats(
    selectedSchool?.sdc_be,
    selectedSchool?.sdc_me,
    selectedSchool?.sdc_total
  );
  const elec = isPositive(selectedSchool?.elec);
  const eau = isPositive(selectedSchool?.point_eau);
  const latrineG = isPositive(
    selectedSchool?.latrine_g || selectedSchool?.latrince_g
  );
  const latrineF = isPositive(
    selectedSchool?.latrine_f || selectedSchool?.latrince_f
  );
  const latrineC = isPositive(selectedSchool?.latrine);

  // ====================== RENDU ======================
  return (
    <div className="h-[calc(100vh-4rem)] relative">
      {/* ── Barre supérieure ── */}
      <div className="absolute top-3 left-14 z-[1000] flex flex-col gap-2">
        {/* ==================== Ligne 1 ==================== */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => setShowFilters(true)}
            size="sm"
            className="shadow-lg"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtres
          </Button>

          {stats.total > 0 && (
            <Badge variant="secondary" className="shadow-lg text-xs py-1.5">
              {stats.publicCount} publics, {stats.privateCount} privés,{' '}
              {stats.villages} villages — Total : {stats.total}
            </Badge>
          )}

          <div className="bg-background/90 backdrop-blur rounded-md shadow-lg px-1.5 py-0.5">
            <DataActionsBar
              table="sig_etablissement"
              tableLabel="SIG Établissement"
              compact
            />
          </div>
        </div>

        {/* ==================== Ligne 2 ==================== */}
        <div className="flex items-center gap-3 flex-wrap">
          {sigConfig.modules.validationDeplacement && (
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                if (!selectedDren) {
                  toast.error('Veuillez sélectionner un DREN');
                  return;
                }

                await loadDeplacements();
                setShowDeplacementsModal(true);
              }}
            >
              Liste des déplacements
            </Button>
          )}

          {sigConfig.modules.deplacement && (
            <div className="flex items-center gap-2 bg-background/90 backdrop-blur rounded-md shadow-lg px-3 py-1.5 border border-border">
              <input
                id="check-move"
                type="checkbox"
                className="w-5 h-5 accent-orange-500 cursor-pointer"
                checked={sigMoveEnabled}
                onChange={(e) => {
                  const zoom = mapRef.current?.getZoom() || 0;

                  if (e.target.checked && zoom <= 13) {
                    toast.warning('Zoom minimum 14 requis pour déplacer');
                    return;
                  }

                  setSigMoveEnabled(e.target.checked);
                }}
              />

              <label
                htmlFor="check-move"
                className="flex items-center gap-1.5 text-sm font-medium cursor-pointer select-none"
              >
                <i className="fas fa-arrows-alt text-orange-600"></i>
                Déplacer
              </label>
            </div>
          )}
        </div>

        {/* ==================== Ligne 3 ==================== */}
        <div className="w-80">
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
      </div>

      {/* Bouton arrêt vérification */}
      {verifyMode && (
        <Button
          className="absolute top-20 right-4 z-[2000]"
          onClick={stopVerification}
        >
          Quitter la vérification
        </Button>
      )}

      {/* Modal Déplacements */}
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeplacementsModal(false)}
              >
                Fermer
              </Button>
            </div>

            {/* Message contextuel */}
            {deplacements.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg">Aucun déplacement en attente</p>
                <p className="text-sm mt-2">
                  Pour la zone sélectionnée :{' '}
                  <strong>
                    {selectedDren
                      ? drens.find((d) => d.CODE_DREN === selectedDren)?.DREN ||
                        `DREN ${selectedDren}`
                      : 'Toutes les DREN'}
                    {selectedCisco > 0 && ciscos.length > 0 && (
                      <>
                        {' '}
                        —{' '}
                        {ciscos.find((c) => c.CODE_CISCO === selectedCisco)
                          ?.CISCO || `CISCO ${selectedCisco}`}
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
                        item.type_objet === 'ETAB'
                          ? 'Établissement'
                          : item.type_objet === 'VILLAGE'
                            ? 'Village'
                            : item.type_objet;

                      return (
                        <tr
                          key={`dep-${item.type_objet}-${item.id}`}
                          className="border-t hover:bg-gray-50"
                        >
                          <td className="p-3 border font-medium">
                            {item.code}
                          </td>
                          <td className="p-3 border">
                            <Badge variant="outline">{typeLabel}</Badge>
                          </td>
                          <td className="p-3 border">
                            {item.demande_par || '-'}
                          </td>

                          {/* Ancienne Position */}
                          <td className="p-3 border text-xs font-mono text-muted-foreground">
                            {item.ancien_lat?.toFixed(6)},{' '}
                            {item.ancien_lng?.toFixed(6)}
                          </td>

                          {/* Nouvelle Position */}
                          <td className="p-3 border text-xs font-mono text-blue-600">
                            {item.nouveau_lat?.toFixed(6)},{' '}
                            {item.nouveau_lng?.toFixed(6)}
                          </td>

                          <td className="p-3 border text-xs text-muted-foreground">
                            {item.date_demande
                              ? new Date(item.date_demande).toLocaleString(
                                  'fr-FR'
                                )
                              : '-'}
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
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleVerifier(item)}
                                  >
                                    Vérifier
                                  </Button>

                                  <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                    onClick={() => handleValider(item)}
                                  >
                                    Valider
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleRejeter(item)}
                                  >
                                    Rejeter
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-600 hover:bg-red-50"
                                    onClick={() => handleSupprimer(item)}
                                  >
                                    Supprimer
                                  </Button>
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

      {/* Chargement */}
      {loading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-[1001] flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Chargement des données SIG...
            </p>
          </div>
        </div>
      )}

      {/* Menu contextuel */}
      {contextMenu && (
        <div
          className="absolute z-[2000] bg-white rounded-lg shadow-xl border py-1 min-w-[220px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 flex items-center gap-2"
            onClick={() => {
              if (zoomLevel < 15) {
                toast.warning(
                  'Le niveau de zoom est trop bas. Le zoom minimum autorisé est de 16.'
                );
                setContextMenu(null);
                return;
              }
              setShowGeoEtab(true);
              setContextMenu(null);
              // Rafraîchir la liste des établissements non géolocalisés
              djangoGet(
                `/sig/etablissements-non-geolocalises/${selectedDren}/${selectedCisco}/`
              )
                .then((data) =>
                  setEtabNonPointe(Array.isArray(data) ? data : [])
                )
                .catch(() => {});
            }}
          >
            <MapPin className="w-4 h-4" /> Géolocaliser Établissement
          </button>
          <button
            className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 flex items-center gap-2"
            onClick={() => {
              if (zoomLevel < 15) {
                toast.warning(
                  'Le niveau de zoom est trop bas. Le zoom minimum autorisé est de 16.'
                );
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
              if (contextMenu)
                mapRef.current?.flyTo([contextMenu.lat, contextMenu.lng], 16);
              setContextMenu(null);
            }}
          >
            <MapPin className="w-4 h-4" /> Aller vers cet endroit
          </button>
        </div>
      )}

      {/* Modal Filtres */}
      <Dialog open={showFilters} onOpenChange={setShowFilters}>
        <DialogContent className="sm:max-w-lg z-[10000]">
          <DialogHeader>
            <DialogTitle>Paramètres</DialogTitle>
            <DialogDescription>
              Sélectionnez les filtres DREN et CISCO pour afficher les données
              SIG.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="font-semibold">Filtres</Label>
              <Select
                value={selectedDren === 0 ? '' : String(selectedDren)}
                onValueChange={(value) => {
                  const dren = Number(value);
                  setSelectedDren(dren);
                  setSelectedCisco(0); // reset obligatoire
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Toutes les DREN" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Toutes les DREN</SelectItem>
                  {drens.map((d) => (
                    <SelectItem
                      key={d.CODE_DREN}
                      value={d.CODE_DREN.toString()}
                    >
                      {d.DREN}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Select
                value={selectedCisco === 0 ? '' : String(selectedCisco)}
                onValueChange={(value) => setSelectedCisco(Number(value))}
                disabled={selectedDren === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Toutes les CISCO" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Toutes les CISCO</SelectItem>
                  {ciscos.map((c) => (
                    <SelectItem
                      key={c.CODE_CISCO}
                      value={c.CODE_CISCO.toString()}
                    >
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
                    className="pl-10"
                  />
                </div>
                {searchResults.length > 0 && (
                  <div className="border rounded-lg max-h-48 overflow-y-auto">
                    {searchResults.map((item, i) => (
                      <button
                        key={`modal-sr-${item.id}-${i}`}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 border-b"
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
            <Button onClick={handleApplyFilters} disabled={loading}>
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

      {/* Carte Leaflet */}
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Modal Fiche École */}
      <Dialog
        open={!!selectedSchool}
        onOpenChange={() => setSelectedSchool(null)}
      >
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
                              <img
                                src="/img/etablissements/000000000.jpeg"
                                alt="Photo de l'établissement"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent)
                                    parent.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-gray-400"><span class="text-5xl mb-2">📷</span><span class="text-sm font-medium">Photo indisponible</span></div>`;
                                }}
                              />
                            </div>
                          </td>
                          <td className="border p-2">
                            <strong>CODE ÉTABLISSEMENT :</strong>{' '}
                            {selectedSchool.CODE_ETAB}
                          </td>
                        </tr>
                        <tr>
                          <td className="border p-2">
                            <strong>SECTEUR :</strong>{' '}
                            {selectedSchool.SECTEUR === 0
                              ? 'PUBLIQUE'
                              : 'PRIVÉE'}
                          </td>
                        </tr>
                        <tr>
                          <td className="border p-2">
                            <strong>DREN :</strong> {selectedSchool.DREN || '-'}
                          </td>
                        </tr>
                        <tr>
                          <td className="border p-2">
                            <strong>CISCO :</strong>{' '}
                            {selectedSchool.CISCO || '-'}
                          </td>
                        </tr>
                        <tr>
                          <td className="border p-2">
                            <strong>COMMUNE :</strong>{' '}
                            {selectedSchool.COMMUNE || '-'}
                          </td>
                        </tr>
                        <tr>
                          <td className="border p-2">
                            <strong>ZAP :</strong> {selectedSchool.ZAP || '-'}
                          </td>
                        </tr>
                        <tr>
                          <td className="border p-2">
                            <strong>FOKONTANY :</strong>{' '}
                            {selectedSchool.FOKONTANY || '-'}
                          </td>
                        </tr>
                        <tr>
                          <td className="border p-2">
                            <strong>COORDONNÉES GÉO :</strong>{' '}
                            <span className="font-mono text-blue-600">
                              {parseFloat(selectedSchool.latitude || 0).toFixed(
                                6
                              )}
                              ,{' '}
                              {parseFloat(
                                selectedSchool.longitude || 0
                              ).toFixed(6)}
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
                          <td className="border p-1.5 font-semibold">
                            {teacherStats.total}
                          </td>
                          <td className="border p-1.5">
                            {teacherStats.en_classe}
                          </td>
                          <td className="border p-1.5">
                            {teacherStats.fonctionnaire}
                          </td>
                          <td className="border p-1.5">
                            {teacherStats.fram_sub}
                          </td>
                          <td className="border p-1.5">
                            {teacherStats.fram_nonsub}
                          </td>
                          <td className="border p-1.5">
                            {teacherStats.autres}
                          </td>
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
                          <th className="border p-1.5 text-center">
                            Mauvais état
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="text-center">
                          <td className="border p-1.5 font-medium">
                            Salles de classe
                          </td>
                          <td className="border p-1.5 font-semibold">
                            {sdc.total}
                          </td>
                          <td className="border p-1.5">{sdc.bon}</td>
                          <td className="border p-1.5">{sdc.mauvais}</td>
                        </tr>
                        <tr className="text-center">
                          <td className="border p-1.5 font-medium">
                            Tables-bancs
                          </td>
                          <td className="border p-1.5 font-semibold">
                            {tbc.total}
                          </td>
                          <td className="border p-1.5">{tbc.bon}</td>
                          <td className="border p-1.5">{tbc.mauvais}</td>
                        </tr>
                        <tr>
                          <td
                            colSpan={4}
                            className="bg-slate-100 font-semibold text-center p-2"
                          >
                            Eau, Assainissement et Hygiène (EAH)
                          </td>
                        </tr>
                        <tr>
                          <td className="border p-1.5 font-medium">
                            Électricité
                          </td>
                          <td className="border p-1.5 text-center" colSpan={3}>
                            {elec
                              ? `OUI (${selectedSchool?.TYPE_SOURCE_ELECTRICITE || '-'})`
                              : 'NON'}
                          </td>
                        </tr>
                        <tr>
                          <td className="border p-1.5 font-medium">
                            Point d'eau
                          </td>
                          <td className="border p-1.5 text-center" colSpan={3}>
                            {eau
                              ? `OUI (${selectedSchool?.TYPE_SOURCE_EAU || '-'})`
                              : 'NON'}
                          </td>
                        </tr>
                        <tr>
                          <td className="border p-1.5 font-medium">
                            Latrine garçons
                          </td>
                          <td className="border p-1.5 text-center" colSpan={3}>
                            {latrineG ? 'OUI' : 'NON'}
                          </td>
                        </tr>
                        <tr>
                          <td className="border p-1.5 font-medium">
                            Latrine filles
                          </td>
                          <td className="border p-1.5 text-center" colSpan={3}>
                            {latrineF ? 'OUI' : 'NON'}
                          </td>
                        </tr>
                        <tr>
                          <td className="border p-1.5 font-medium">
                            Latrine commune
                          </td>
                          <td className="border p-1.5 text-center" colSpan={3}>
                            {latrineC ? 'OUI' : 'NON'}
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

      {/* Modal Géolocaliser Établissement */}
      <Dialog open={showGeoEtab} onOpenChange={setShowGeoEtab}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto z-[10000]">
          <DialogHeader>
            <DialogTitle>Géolocaliser un établissement</DialogTitle>
            <DialogDescription>
              Sélectionnez un établissement dans la liste et enregistrez sa
              position.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Code établissement"
                value={selectedEtabGeo?.CODE_ETAB || ''}
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
                        selectedEtabGeo?.CODE_ETAB === etab.CODE_ETAB
                          ? 'bg-green-100'
                          : ''
                      }`}
                      onClick={() => {
                        setSelectedEtabGeo(etab);
                        setFilterEtabName(etab.NOM_ETAB);
                      }}
                    >
                      <td className="p-2 border-t">{etab.CODE_ETAB}</td>
                      <td className="p-2 border-t">{etab.NOM_ETAB}</td>
                      <td className="p-2 border-t">
                        {etab.SECTEUR === 1 ? 'Privée' : 'Public'}
                      </td>
                      <td className="p-2 border-t">{etab.ZAP}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Coordonnées: {geoCoords.lat.toFixed(6)},{' '}
              {geoCoords.lng.toFixed(6)}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Géolocaliser Village */}
      <Dialog open={showGeoVillage} onOpenChange={setShowGeoVillage}>
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
              onChange={(e) =>
                setVillageForm((prev) => ({ ...prev, name: e.target.value }))
              }
            />
            <Input
              placeholder="Population du village"
              type="number"
              min="10"
              value={villageForm.population}
              onChange={(e) =>
                setVillageForm((prev) => ({
                  ...prev,
                  population: e.target.value,
                }))
              }
            />
            <div className="grid grid-cols-3 gap-3">
              {(['airtel', 'orange', 'telma'] as const).map((field) => (
                <label
                  key={field}
                  className="flex items-center gap-2 text-sm capitalize"
                >
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
              {(['elec', 'eau'] as const).map((field) => (
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
                  {field === 'elec' ? 'Électricité' : 'Eau potable'} ?
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Coordonnées: {geoCoords.lat.toFixed(6)},{' '}
              {geoCoords.lng.toFixed(6)}
            </p>
          </div>
          <DialogFooter>
            <Button
              onClick={handleSaveGeoVillage}
              className="bg-green-600 hover:bg-green-700"
            >
              Enregistrer
            </Button>
            <Button variant="outline" onClick={() => setShowGeoVillage(false)}>
              Annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info survol établissement */}
      {hoveredEtab && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/95 backdrop-blur-md border shadow-xl rounded-lg px-6 py-3 text-sm flex items-center gap-4 pointer-events-none">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            <div>
              <div className="font-semibold text-primary truncate max-w-[280px]">
                {hoveredEtab.NOM_ETAB || hoveredEtab.name}
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                {parseFloat(hoveredEtab.latitude).toFixed(6)},{' '}
                {parseFloat(hoveredEtab.longitude).toFixed(6)}
              </div>
            </div>
          </div>
          {hoveredEtab.SECTEUR !== undefined && (
            <div className="text-xs text-muted-foreground border-l pl-4">
              {hoveredEtab.SECTEUR === 0 ? 'Public' : 'Privé'} •{' '}
              {hoveredEtab.FOKONTANY || '—'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SIG;
