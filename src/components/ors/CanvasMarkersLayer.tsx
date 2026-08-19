import { useEffect, useMemo } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

export interface CanvasPoint {
  id: string | number;
  lat: number;
  lng: number;
  color: string;
  fillColor: string;
  radius: number;
  fillOpacity?: number;
  weight?: number;
  /** Lazy popup HTML builder — only invoked on click */
  popupHtml?: () => string;
  /** Lazy click handler */
  onClick?: () => void;
  /** Handlers used by the optional establishment information panel. */
  onMouseOver?: () => void;
  onMouseOut?: () => void;
  /** SVG marker for establishment levels; villages keep the lightweight circle. */
  iconHtml?: string;
}

interface Props {
  points: CanvasPoint[];
  /** Visible by default */
  visible?: boolean;
}

/**
 * High-performance marker layer that renders thousands of points on a single
 * shared Leaflet canvas using imperative API (NO React VDOM per marker, NO
 * pre-rendered <Popup>). Popups are built lazily at click time.
 *
 * This avoids the "Page Unresponsive" freeze caused by mounting 5k+ React
 * components for <CircleMarker><Popup>...</Popup></CircleMarker>.
 */
export const CanvasMarkersLayer = ({ points, visible = true }: Props) => {
  const map = useMap();

  const renderer = useMemo(() => L.canvas({ padding: 0.5 }), []);

  useEffect(() => {
    if (!visible) return;
    const group = L.layerGroup();

    // Build markers in chunks to keep the main thread responsive on huge datasets
    const CHUNK = 800;
    let i = 0;
    let cancelled = false;

    const addChunk = () => {
      if (cancelled) return;
      const end = Math.min(i + CHUNK, points.length);
      for (; i < end; i++) {
        const p = points[i];
        const marker = p.iconHtml
          ? L.marker([p.lat, p.lng], {
              icon: L.divIcon({
                className: "ors-etablissement-marker",
                html: p.iconHtml,
                iconSize: [28, 28],
                iconAnchor: [14, 14],
              }),
              keyboard: false,
            })
          : L.circleMarker([p.lat, p.lng], {
              radius: p.radius,
              color: p.color,
              fillColor: p.fillColor,
              fillOpacity: p.fillOpacity ?? 0.75,
              weight: p.weight ?? 1,
              renderer,
            });
        // Fix #4 (audit du 19/08/2026) : un point avec un onClick (les
        // établissements, qui ouvrent la Dialog complète côté React) ne doit
        // PAS en plus recevoir un popup Leaflet natif — le clic gauche
        // ouvrait auparavant deux surfaces d'info redondantes en même temps
        // (popup HTML + Dialog). Les points sans onClick (les villages)
        // gardent leur popup natif comme unique surface d'info.
        if (p.popupHtml && !p.onClick) {
          marker.bindPopup(() => p.popupHtml!(), { maxWidth: 320 });
        }
        if (p.onClick) marker.on("click", p.onClick);
        if (p.onMouseOver) {
          marker.on("mouseover", p.onMouseOver);
          marker.on("mouseenter", p.onMouseOver);
        }
        if (p.onMouseOut) {
          marker.on("mouseout", p.onMouseOut);
          marker.on("mouseleave", p.onMouseOut);
        }
        marker.addTo(group);
      }
      if (i < points.length) {
        // Schedule next chunk; idle callback if available
        if (typeof (window as any).requestIdleCallback === "function") {
          (window as any).requestIdleCallback(addChunk, { timeout: 50 });
        } else {
          setTimeout(addChunk, 0);
        }
      }
    };

    group.addTo(map);
    addChunk();

    return () => {
      cancelled = true;
      map.removeLayer(group);
    };
  }, [points, renderer, map, visible]);

  return null;
};

export default CanvasMarkersLayer;
