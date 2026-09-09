import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

// Minimal heatmap implementation using canvas overlay
// Replaces leaflet.heat for React compatibility
interface HeatmapLayerProps {
  points: [number, number, number][]; // [lat, lng, intensity]
  radius?: number;
  blur?: number;
  maxZoom?: number;
}

const HeatmapLayer = ({ points, radius = 10, blur = 5, maxZoom = 18 }: HeatmapLayerProps) => {
  const map = useMap();
  const layerRef = useRef<L.CircleMarker[]>([]);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!points.length) return;

    // Clean up previous layer
    if (layerGroupRef.current) {
      map.removeLayer(layerGroupRef.current);
    }

    // Create efficient canvas-based circle markers for heatmap effect
    const group = L.layerGroup();
    const markers: L.CircleMarker[] = [];

    points.forEach(([lat, lng, intensity]) => {
      const marker = L.circleMarker([lat, lng], {
        radius: radius / 2,
        fillColor: `rgba(0, 0, 255, ${Math.max(intensity * 0.6, 0.1)})`,
        color: 'transparent',
        fillOpacity: Math.max(intensity * 0.7, 0.15),
        weight: 0,
        interactive: false,
      });
      markers.push(marker);
      group.addLayer(marker);
    });

    group.addTo(map);
    layerGroupRef.current = group;
    layerRef.current = markers;

    // Fit bounds
    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map(([lat, lng]) => [lat, lng] as [number, number]));
      map.fitBounds(bounds);
    }

    return () => {
      if (layerGroupRef.current) {
        map.removeLayer(layerGroupRef.current);
        layerGroupRef.current = null;
      }
    };
  }, [points, map, radius, blur, maxZoom]);

  return null;
};

export default HeatmapLayer;
