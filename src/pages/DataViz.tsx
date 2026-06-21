import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  CircleMarker,
  Popup,
  useMap,
  LayersControl,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Loader2,
  Filter,
  RotateCcw,
  Map,
  MapPin,
  Camera,
  Info,
} from 'lucide-react';
import { datavizApi, dashboardApi, Dren } from '@/services/api';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import {
  THEMES,
  NIVEAUX,
  getThemesForNiveau,
  type Niveau,
  getSliderDefaults,
  calculateRatio,
  getThematicColor,
  getThemeUnit,
  isPercentageTheme,
  formatThemeValue,
  STYLE_DREN,
  STYLE_CISCO,
  STYLE_COMMUNE,
} from './dataviz/dataviz-utils';
import HeatmapLayer from './dataviz/HeatmapLayer';
import 'leaflet/dist/leaflet.css';
import DataActionsBar from '@/components/admin/DataActionsBar';

// Composant Boussole Statique pour react-leaflet
const CompassControl = () => {
  const map = useMap();
  useEffect(() => {
    const compassDiv = L.DomUtil.create('div', 'leaflet-control');
    compassDiv.id = 'compass-control';
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

    // Éviter les doublons
    const old = document.getElementById('compass-control');
    if (old) old.remove();

    map.getContainer().appendChild(compassDiv);

    // Décaler le contrôle de zoom
    setTimeout(() => {
      const zoomControl = document.querySelector('.leaflet-control-zoom');
      if (zoomControl) {
        (zoomControl as HTMLElement).style.marginTop = '75px';
      }
    }, 300);

    return () => {
      const oldCompass = document.getElementById('compass-control');
      if (oldCompass) oldCompass.remove();
    };
  }, [map]);

  return null;
};

// Fit map to GeoJSON bounds
const FitBounds = ({ data }: { data: any }) => {
  const map = useMap();
  useEffect(() => {
    if (!data) return;
    try {
      const layer = L.geoJSON(data);
      const bounds = layer.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds);
    } catch {
      /* ignore invalid geojson */
    }
  }, [data, map]);
  return null;
};

// Component to handle context menu closing on map click
const MapClickHandler = ({ onClose }: { onClose: () => void }) => {
  useMapEvents({
    click: () => onClose(),
    movestart: () => onClose(),
  });
  return null;
};

type ActiveLayer = 'dren' | 'cisco' | 'commune';

interface RecapData {
  zone: string;
  total: number;
  low: number;
  medium: number;
  high: number;
}

const DataViz = () => {
  const [drens, setDrens] = useState<Dren[]>([]);
  const [niveau, setNiveau] = useState<Niveau>('primaire');
  const [theme, setTheme] = useState('0');
  const [loading, setLoading] = useState(false);
  const [activeLayer, setActiveLayer] = useState<ActiveLayer>('dren');
  const [showEtab, setShowEtab] = useState(false);

  // Slider state
  const [sliderRange, setSliderRange] = useState<[number, number]>([0, 100]);
  const [sliderValue, setSliderValue] = useState<[number, number]>([25, 75]);

  // GeoJSON shapes
  const [drenGeoJson, setDrenGeoJson] = useState<any>(null);
  const [ciscoGeoJson, setCiscoGeoJson] = useState<any>(null);
  const [communeGeoJson, setCommuneGeoJson] = useState<any>(null);

  // Stats data from views
  const [dataDren, setDataDren] = useState<any[]>([]);
  const [dataCisco, setDataCisco] = useState<any[]>([]);
  const [dataCommune, setDataCommune] = useState<any[]>([]);
  const [dataEtab, setDataEtab] = useState<any[]>([]);
  const [recap, setRecap] = useState<RecapData>({
    zone: '',
    total: 0,
    low: 0,
    medium: 0,
    high: 0,
  });
  const [showRecap, setShowRecap] = useState(false);
  // Heatmap
  const [heatmapPoints, setHeatmapPoints] = useState<
    [number, number, number][]
  >([]);
  const [isHeatmapActive, setIsHeatmapActive] = useState(false);

  // Applied theme (for rendering)
  const [appliedTheme, setAppliedTheme] = useState('0');
  const [appliedBounds, setAppliedBounds] = useState<[number, number]>([
    25, 75,
  ]);

  // Commune drill-down state
  const [communeCode, setCommuneCode] = useState<number>(0);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    code: number;
    name: string;
    layerBounds: L.LatLngBounds | null;
  } | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Load DRENs and base layers on mount
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
        console.error('Init error:', err);
        toast.error('Erreur lors du chargement des couches de base');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const availableThemes = useMemo(() => getThemesForNiveau(niveau), [niveau]);

  const getNiveauNumber = (niveau: Niveau): number => {
    switch (niveau) {
      case 'college':
        return 2;
      case 'lycee':
        return 3;
      default:
        return 1;
    }
  };

  // Compute recap stats for a given set of items and zone type
  const computeRecap = (items: any[], zone: string) => {
    if (!items?.length || appliedTheme === '0') {
      setRecap({
        zone,
        total: 0,
        low: 0,
        medium: 0,
        high: 0,
      });
      return;
    }

    let low = 0;
    let medium = 0;
    let high = 0;

    items.forEach((item) => {
      const ratio = calculateRatio(item, appliedTheme);

      if (isNaN(ratio) || ratio < appliedBounds[0]) {
        low++;
      } else if (ratio > appliedBounds[1]) {
        high++;
      } else {
        medium++;
      }
    });

    setRecap({
      zone,
      total: items.length,
      low,
      medium,
      high,
    });
  };
  // Reset theme when niveau changes if current theme not available
  useEffect(() => {
    if (!availableThemes.some((t) => t.value === theme)) setTheme('0');
  }, [niveau, availableThemes, theme]);

  // Update slider when theme changes
  useEffect(() => {
    if (theme === '0') return;
    const { range, start } = getSliderDefaults(theme);
    setSliderRange(range);
    setSliderValue(start);
  }, [theme]);

  // Reset data when niveau changes to prevent stale data display
  useEffect(() => {
    if (appliedTheme === '0') return;
    // Clear data when level changes to prevent showing old niveau's data
    setDataDren([]);
    setDataCisco([]);
    setDataCommune([]);
    setDataEtab([]);
    setIsHeatmapActive(false);
    setHeatmapPoints([]);
    setAppliedTheme('0');
    setActiveLayer('dren');
    setCommuneGeoJson(null);
  }, [niveau]);

  // Compute recap stats for sidebar display based on active layer and theme
  useEffect(() => {
    if (isHeatmapActive) {
      setRecap({
        zone: 'HEATMAP',
        total: heatmapPoints.length,
        low: 0,
        medium: heatmapPoints.length,
        high: 0,
      });
      return;
    }

    switch (activeLayer) {
      case 'dren':
        computeRecap(dataDren, 'DREN');
        break;

      case 'cisco':
        computeRecap(dataCisco, 'CISCO');
        break;

      case 'commune':
        computeRecap(dataCommune, 'COMMUNE');
        break;
    }
  }, [
    activeLayer,
    appliedTheme,
    appliedBounds,
    dataDren,
    dataCisco,
    dataCommune,
    heatmapPoints,
    isHeatmapActive,
  ]);

  // Apply filter
  const handleApply = useCallback(async () => {
    if (theme === '0') {
      toast.error('Veuillez choisir un thème');
      return;
    }

    setLoading(true);
    setIsHeatmapActive(false);
    setDataEtab([]);
    setShowEtab(false);
    setShowRecap(true);

    try {
      const niveauIndex = getNiveauNumber(niveau);
      if (theme === 'hm') {
        const data = await (niveauIndex === 2
          ? datavizApi.getHeatmapN2()
          : niveauIndex === 3
            ? datavizApi.getHeatmapN3()
            : datavizApi.getHeatmapN1());
        const points: [number, number, number][] = [];
        (data || []).forEach((etab: any) => {
          const lat = parseFloat(etab.latitude);
          const lng = parseFloat(etab.longitude);
          if (!isNaN(lat) && !isNaN(lng)) {
            points.push([lat, lng, 1.0]);
          }
        });
        setHeatmapPoints(points);
        setIsHeatmapActive(true);
        setAppliedTheme(theme);
        toast.success(
          `${points.length.toLocaleString()} établissements affichés`
        );
      } else {
        const [dren, cisco] = await Promise.all([
          datavizApi.getDataDren(niveauIndex),
          datavizApi.getDataCisco(niveauIndex),
        ]);
        setDataDren(dren || []);
        setDataCisco(cisco || []);
        setAppliedTheme(theme);
        setAppliedBounds([...sliderValue]);
        setActiveLayer('dren');
        setCommuneGeoJson(null);
        setDataCommune([]);
        toast.success('Carte thématique mise à jour');
      }
    } catch (err) {
      console.error('Apply error:', err);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  }, [theme, sliderValue, niveau]);

  // Drill down to commune level
  const handleDrillCommune = useCallback(
    async (code: number) => {
      if (appliedTheme === '0' || appliedTheme === 'hm' || !drenGeoJson) return;
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
        setActiveLayer('commune');
      } catch (err) {
        console.error('Commune drill error:', err);
        toast.error('Erreur lors du chargement des communes');
      } finally {
        setLoading(false);
      }
    },
    [appliedTheme, niveau]
  );

  // Load establishment markers for a zone
  const handleShowEtab = useCallback(
    async (code: number) => {
      if (appliedTheme === '0' || appliedTheme === 'hm' || !drenGeoJson) return;
      const niveauIndex = getNiveauNumber(niveau);
      setLoading(true);
      try {
        // First load commune layer, then load etab data
        const [communeLayer, communeData, etabData] = await Promise.all([
          datavizApi.getLayerCommune(code),
          datavizApi.getDataCommune(code, niveauIndex),
          datavizApi.getDataEtab(code, niveauIndex),
        ]);
        if (communeLayer?.[0]?.shape) setCommuneGeoJson(communeLayer[0].shape);
        setDataCommune(communeData || []);
        setCommuneCode(code);
        setActiveLayer('commune');
        setDataEtab(etabData || []);
        setShowEtab(true);
      } catch (err) {
        console.error('Etab load error:', err);
      } finally {
        setLoading(false);
      }
    },
    [appliedTheme, niveau]
  );

  // Reset map
  const handleReset = useCallback(() => {
    setAppliedTheme('0');
    setTheme('0');
    setIsHeatmapActive(false);
    setHeatmapPoints([]);
    setDataDren([]);
    setDataCisco([]);
    setDataCommune([]);
    setDataEtab([]);
    setCommuneGeoJson(null);
    setShowEtab(false);
    setActiveLayer('dren');
    setContextMenu(null);
    setShowRecap(false);
    setRecap({
      zone: '',
      total: 0,
      low: 0,
      medium: 0,
      high: 0,
    });
  }, []);

  // Capture & download the map as PNG
  const handleCaptureMap = useCallback(async () => {
    const node = mapContainerRef.current;
    if (!node) return;
    setContextMenu(null);
    try {
      // Hide leaflet controls in capture to keep it clean (optional)
      const canvas = await html2canvas(node, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        scale: 2,
      });
      const link = document.createElement('a');
      const themeSlug = (
        THEMES.find((t) => t.value === appliedTheme)?.label || 'carte'
      )
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const date = new Date().toISOString().slice(0, 10);
      link.download = `carte-thematique-${themeSlug}-${date}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('Carte téléchargée');
    } catch (err) {
      console.error('Capture error:', err);
      toast.error('Impossible de capturer la carte');
    }
  }, [appliedTheme]);

  // Context menu handlers
  const handleContextMenuOnLayer = useCallback(
    (code: number, name: string, e: any) => {
      if (appliedTheme === '0') {
        toast.warning("Veuillez choisir un thème d'abord");
        return;
      }
      // Prevent default browser context menu
      e.originalEvent?.preventDefault?.();

      // Get container position
      const container = mapContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = e.originalEvent.clientX - rect.left;
      const y = e.originalEvent.clientY - rect.top;

      const bounds = e.target?.getBounds?.() || null;

      setContextMenu({ x, y, code, name, layerBounds: bounds });
    },
    [appliedTheme]
  );

  const handleContextMenuCommune = useCallback(
    (code: number, name: string) => {
      if (appliedTheme === '0') {
        toast.warning("Veuillez choisir un thème d'abord");
        return;
      }
      setContextMenu(null);
      handleDrillCommune(code);
    },
    [appliedTheme, handleDrillCommune]
  );

  const handleContextMenuEtab = useCallback(
    (code: number) => {
      if (appliedTheme === '0') {
        toast.warning("Veuillez choisir un thème d'abord");
        return;
      }
      setContextMenu(null);
      handleShowEtab(code);
    },
    [appliedTheme, handleShowEtab]
  );

  // Style function for DREN GeoJSON
  const drenStyle = useCallback(
    (feature: any) => {
      if (appliedTheme === '0' || appliedTheme === 'hm' || !dataDren.length)
        return STYLE_DREN;
      const code = feature?.properties?.CODE;
      const stat = dataDren.find(
        (d: any) => parseInt(d.CODE_DREN) === parseInt(code)
      );
      if (!stat) return STYLE_DREN;
      const ratio = calculateRatio(stat, appliedTheme);
      const color = getThematicColor(ratio, appliedBounds[0], appliedBounds[1]);
      return { ...STYLE_DREN, fillColor: color, fillOpacity: 1 };
    },
    [appliedTheme, dataDren, appliedBounds]
  );

  // Style function for CISCO GeoJSON
  const ciscoStyle = useCallback(
    (feature: any) => {
      if (appliedTheme === '0' || appliedTheme === 'hm' || !dataCisco.length)
        return STYLE_CISCO;
      const code = feature?.properties?.CODE;
      const stat = dataCisco.find(
        (d: any) => parseInt(d.CODE_CISCO) === parseInt(code)
      );
      if (!stat) return STYLE_CISCO;
      const ratio = calculateRatio(stat, appliedTheme);
      const color = getThematicColor(ratio, appliedBounds[0], appliedBounds[1]);
      return { ...STYLE_CISCO, fillColor: color, fillOpacity: 1 };
    },
    [appliedTheme, dataCisco, appliedBounds]
  );

  // Style for commune GeoJSON
  const communeStyle = useCallback(
    (feature: any) => {
      if (appliedTheme === '0' || appliedTheme === 'hm' || !dataCommune.length)
        return STYLE_COMMUNE;
      const code = feature?.properties?.CODE;
      const stat = dataCommune.find(
        (d: any) => parseInt(d.CODE_COMMUNE) === parseInt(code)
      );
      if (!stat) return STYLE_COMMUNE;
      const ratio = calculateRatio(stat, appliedTheme);
      const color = getThematicColor(ratio, appliedBounds[0], appliedBounds[1]);
      return { ...STYLE_COMMUNE, fillColor: color, fillOpacity: 1 };
    },
    [appliedTheme, dataCommune, appliedBounds]
  );

  const ptg = isPercentageTheme(appliedTheme) ? '%' : '';
  const unit = getThemeUnit(appliedTheme);
  const selectedThemeLabel =
    THEMES.find((t) => t.value === appliedTheme)?.label || '';

  // GeoJSON onEachFeature handlers
  const onEachDren = useCallback(
    (feature: any, layer: L.Layer) => {
      const name = feature?.properties?.NAME || '';
      const code = feature?.properties?.CODE;
      const stat = dataDren.find(
        (d: any) => parseInt(d.CODE_DREN) === parseInt(code)
      );

      if (stat && appliedTheme !== '0' && appliedTheme !== 'hm') {
        const ratio = calculateRatio(stat, appliedTheme);
        const valueHtml = `<span style="display:inline-block;min-width:80px;text-align:right;font-variant-numeric:tabular-nums;font-weight:600">${formatThemeValue(ratio, appliedTheme)}${ptg ? ptg : unit}</span>`;
        const text = `<div style="font-size:12px"><strong>${name}</strong><br/>${selectedThemeLabel} : ${valueHtml}</div>`;
        (layer as any).bindTooltip(text, {
          permanent: false,
          direction: 'top',
        });
        (layer as any).bindPopup(text);
      } else {
        (layer as any).bindTooltip(`DREN ${name}`, {
          permanent: false,
          direction: 'top',
        });
      }

      // Right-click context menu
      (layer as any).on('contextmenu', (e: any) => {
        handleContextMenuOnLayer(parseInt(code), name, e);
      });
    },
    [
      dataDren,
      appliedTheme,
      ptg,
      unit,
      selectedThemeLabel,
      handleContextMenuOnLayer,
    ]
  );

  // Similar onEachFeature for CISCO with context menu
  const onEachCisco = useCallback(
    (feature: any, layer: L.Layer) => {
      const name = feature?.properties?.NAME || '';
      const code = feature?.properties?.CODE;
      const stat = dataCisco.find(
        (d: any) => parseInt(d.CODE_CISCO) === parseInt(code)
      );

      if (stat && appliedTheme !== '0' && appliedTheme !== 'hm') {
        const ratio = calculateRatio(stat, appliedTheme);
        const valueHtml = `<span style="display:inline-block;min-width:80px;text-align:right;font-variant-numeric:tabular-nums;font-weight:600">${formatThemeValue(ratio, appliedTheme)}${ptg ? ptg : unit}</span>`;
        const text = `<div style="font-size:12px"><strong>${name}</strong><br/>${selectedThemeLabel} : ${valueHtml}</div>`;
        (layer as any).bindTooltip(text, {
          permanent: false,
          direction: 'top',
        });
        (layer as any).bindPopup(text);
      } else {
        (layer as any).bindTooltip(`CISCO ${name}`, {
          permanent: false,
          direction: 'top',
        });
      }

      // Right-click context menu
      (layer as any).on('contextmenu', (e: any) => {
        handleContextMenuOnLayer(parseInt(code), name, e);
      });
    },
    [
      dataCisco,
      appliedTheme,
      ptg,
      unit,
      selectedThemeLabel,
      handleContextMenuOnLayer,
    ]
  );

  // Commune onEachFeature with drilldown on click
  const onEachCommune = useCallback(
    (feature: any, layer: L.Layer) => {
      const name = feature?.properties?.NAME || '';
      const code = feature?.properties?.CODE;
      const stat = dataCommune.find(
        (d: any) => parseInt(d.CODE_COMMUNE) === parseInt(code)
      );

      if (stat && appliedTheme !== '0' && appliedTheme !== 'hm') {
        const ratio = calculateRatio(stat, appliedTheme);
        const valueHtml = `<span style="display:inline-block;min-width:80px;text-align:right;font-variant-numeric:tabular-nums;font-weight:600">${formatThemeValue(ratio, appliedTheme)}${ptg ? ptg : unit}</span>`;
        const text = `<div style="font-size:12px"><strong>${name}</strong><br/>${selectedThemeLabel} : ${valueHtml}</div>`;
        (layer as any).bindTooltip(text, {
          permanent: false,
          direction: 'top',
        });
        (layer as any).bindPopup(text);
      } else {
        (layer as any).bindTooltip(`COMMUNE ${name}`, {
          permanent: false,
          direction: 'top',
        });
      }
    },
    [dataCommune, appliedTheme, ptg, unit, selectedThemeLabel]
  );

  // GeoJSON keys for forced re-render
  const drenKey = useMemo(
    () => `dren-${appliedTheme}-${appliedBounds.join('-')}-${dataDren.length}`,
    [appliedTheme, appliedBounds, dataDren]
  );
  const ciscoKey = useMemo(
    () =>
      `cisco-${appliedTheme}-${appliedBounds.join('-')}-${dataCisco.length}`,
    [appliedTheme, appliedBounds, dataCisco]
  );
  const communeKey = useMemo(
    () =>
      `commune-${appliedTheme}-${appliedBounds.join('-')}-${dataCommune.length}`,
    [appliedTheme, appliedBounds, dataCommune]
  );

  // Etab markers with color based on ratio
  const etabMarkers = useMemo(() => {
    if (
      !showEtab ||
      !dataEtab.length ||
      appliedTheme === '0' ||
      appliedTheme === 'hm'
    )
      return [];
    return dataEtab
      .filter(
        (e: any) =>
          !isNaN(parseFloat(e.latitude)) && !isNaN(parseFloat(e.longitude))
      )
      .map((etab: any) => {
        const ratio = calculateRatio(etab, appliedTheme);
        const color = getThematicColor(
          ratio,
          appliedBounds[0],
          appliedBounds[1]
        );
        return {
          lat: parseFloat(etab.latitude),
          lng: parseFloat(etab.longitude),
          name: etab.NOM_ETAB || '',
          ratio,
          color,
        };
      });
  }, [showEtab, dataEtab, appliedTheme, appliedBounds]);

  // Compute recap stats for establishments
  useEffect(() => {
    if (!showEtab) return;

    let low = 0;
    let medium = 0;
    let high = 0;

    etabMarkers.forEach((m) => {
      if (m.ratio < appliedBounds[0]) {
        low++;
      } else if (m.ratio > appliedBounds[1]) {
        high++;
      } else {
        medium++;
      }
    });

    setRecap({
      zone: 'ETABLISSEMENTS',
      total: etabMarkers.length,
      low,
      medium,
      high,
    });
  }, [showEtab, etabMarkers, appliedBounds]);

  // Active geojson to fit bounds to
  const activeBoundsData =
    activeLayer === 'commune'
      ? communeGeoJson
      : activeLayer === 'cisco'
        ? ciscoGeoJson
        : drenGeoJson;

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 bg-muted/50 border-b border-border">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-sm font-semibold text-muted-foreground">
            SYSTEME D'INFORMATION GEOGRAPHIQUE / CARTE THEMATIQUE DES
            INDICATEURS
          </span>
          <DataActionsBar
            table="sig_etablissement"
            tableLabel="SIG Établissement"
            compact
          />
        </div>
      </div>

      <div className="flex-1 flex gap-0 overflow-hidden">
        {/* Filters Panel */}
        <div className="w-72 flex-shrink-0 space-y-3 overflow-y-auto p-3 border-r border-border">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filtres
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Theme */}
              {/* Niveau */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Niveau</Label>
                <Select
                  value={niveau}
                  onValueChange={(v) => setNiveau(v as Niveau)}
                >
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

              {/* Slider */}
              {theme !== '0' && theme !== 'hm' && (
                <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                  <Label className="text-xs font-medium">
                    Plage de valeurs (Min - Max)
                  </Label>
                  <Slider
                    min={sliderRange[0]}
                    max={sliderRange[1]}
                    step={1}
                    value={sliderValue}
                    onValueChange={(v) => setSliderValue(v as [number, number])}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      Min:{' '}
                      <strong className="text-foreground">
                        {sliderValue[0]}
                      </strong>
                    </span>
                    <span>
                      Max:{' '}
                      <strong className="text-foreground">
                        {sliderValue[1]}
                      </strong>
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleApply}
                  className="flex-1"
                  disabled={loading || theme === '0'}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Filter className="w-4 h-4 mr-2" />
                  )}
                  Appliquer
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleReset}
                  title="Réinitialiser"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>

              {/* Capture / téléchargement de la carte */}
              <Button
                variant="secondary"
                className="w-full"
                onClick={handleCaptureMap}
                disabled={loading}
                title="Capturer et télécharger la carte en image PNG"
              >
                <Camera className="w-4 h-4 mr-2" />
                Capturer la carte (PNG)
              </Button>
            </CardContent>
          </Card>

          {/* Layer Controls — uniquement DREN / CISCO */}
          {appliedTheme !== '0' && appliedTheme !== 'hm' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Zone de délimitation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">DREN</Label>
                  <Switch
                    checked={activeLayer === 'dren'}
                    onCheckedChange={() => {
                      setActiveLayer('dren');
                      setCommuneGeoJson(null);
                      setShowEtab(false);
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">CISCO</Label>
                  <Switch
                    checked={activeLayer === 'cisco'}
                    onCheckedChange={() => {
                      setActiveLayer('cisco');
                      setCommuneGeoJson(null);
                      setShowEtab(false);
                    }}
                  />
                </div>
                <div className="p-2 bg-primary/5 border border-primary/20 rounded-md space-y-1.5">
                  <p className="text-[11px] font-semibold flex items-center gap-1.5 text-primary">
                    <Info className="w-3.5 h-3.5" /> Guide d'utilisation
                  </p>
                  <ul className="text-[10px] text-muted-foreground space-y-1 list-disc list-inside leading-relaxed">
                    <li>
                      Choisissez le <strong>niveau</strong> et le{' '}
                      <strong>thème</strong>, puis cliquez sur{' '}
                      <em>Appliquer</em>.
                    </li>
                    <li>
                      Basculez entre <strong>DREN</strong> et{' '}
                      <strong>CISCO</strong> avec les interrupteurs ci-dessus.
                    </li>
                    <li>
                      <strong>Clic droit</strong> sur une zone pour accéder à la
                      carte par <em>Commune</em> ou par <em>Établissement</em>.
                    </li>
                    <li>
                      Utilisez <em>Capturer la carte</em> pour télécharger une
                      image PNG de la vue.
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Legend */}
          {appliedTheme !== '0' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Légende</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <p className="font-medium">{selectedThemeLabel}</p>
                {appliedTheme === 'hm' ? (
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: 'rgba(0,0,255,0.6)' }}
                    />
                    <span>Densité des établissements</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-4 h-3 border"
                        style={{ backgroundColor: '#FFFFFF' }}
                      />
                      <span className="flex-1 text-right tabular-nums">
                        Inférieur à{' '}
                        {formatThemeValue(appliedBounds[0], appliedTheme)}
                        {ptg ? ptg : unit}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-4 h-3"
                        style={{ backgroundColor: '#00AA00' }}
                      />
                      <span className="flex-1 text-right tabular-nums">
                        [{formatThemeValue(appliedBounds[0], appliedTheme)} –{' '}
                        {formatThemeValue(appliedBounds[1], appliedTheme)}]
                        {ptg ? ptg : unit}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-4 h-3"
                        style={{ backgroundColor: '#FF0000' }}
                      />
                      <span className="flex-1 text-right tabular-nums">
                        Supérieur à{' '}
                        {formatThemeValue(appliedBounds[1], appliedTheme)}
                        {ptg ? ptg : unit}
                      </span>
                    </div>
                  </>
                )}
                <div className="border-t pt-2 mt-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-4 h-3"
                      style={{ backgroundColor: '#4e73df' }}
                    />
                    <span>Limite DREN</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-4 h-3"
                      style={{ backgroundColor: '#22afbe' }}
                    />
                    <span>Limite CISCO</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-4 h-3"
                      style={{ backgroundColor: '#c0c0c0' }}
                    />
                    <span>Limite Commune</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

        </div>

        {/* Map */}
        <div className="flex-1 overflow-hidden relative" ref={mapContainerRef}>
          {loading && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-[1000] flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Chargement des données...
                </p>
              </div>
            </div>
          )}

          {/* Context Menu - right click */}
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

            {/* DREN layer */}
            {drenGeoJson &&
              (activeLayer === 'dren' ||
                (!isHeatmapActive && appliedTheme === '0')) && (
                <GeoJSON
                  key={drenKey}
                  data={drenGeoJson}
                  style={drenStyle}
                  onEachFeature={onEachDren}
                />
              )}

            {/* CISCO layer */}
            {ciscoGeoJson && activeLayer === 'cisco' && (
              <GeoJSON
                key={ciscoKey}
                data={ciscoGeoJson}
                style={ciscoStyle}
                onEachFeature={onEachCisco}
              />
            )}

            {/* Commune layer */}
            {communeGeoJson && activeLayer === 'commune' && (
              <GeoJSON
                key={communeKey}
                data={communeGeoJson}
                style={communeStyle}
                onEachFeature={onEachCommune}
              />
            )}

            {/* Heatmap */}
            {isHeatmapActive && heatmapPoints.length > 0 && (
              <HeatmapLayer points={heatmapPoints} radius={10} blur={5} />
            )}

            {/* Establishment markers */}
            {showEtab &&
              etabMarkers.map((m, i) => (
                <CircleMarker
                  key={`etab-${i}`}
                  center={[m.lat, m.lng]}
                  radius={5}
                  pathOptions={{
                    color: m.color,
                    fillColor: m.color,
                    fillOpacity: 0.9,
                    weight: 1,
                  }}
                >
                  <Popup>
                    <div className="text-sm">
                      <strong>{m.name}</strong>
                      <div className="mt-1 text-right tabular-nums">
                        {selectedThemeLabel}:{' '}
                        <strong>
                          {formatThemeValue(m.ratio, appliedTheme)}
                          {ptg ? ptg : unit}
                        </strong>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}

            <FitBounds data={activeBoundsData} />
          </MapContainer>
        </div>
      </div>
    </div>
  );
};

export default DataViz;
