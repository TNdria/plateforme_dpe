import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import * as turf from '@turf/turf';
import { Etablissement, Village } from '@/hooks/useMapData';

/**
 * Couche d'interactions impératives sur la carte ORS, portage du Django original :
 *  - Clic droit sur un établissement → menu (Centrer / Voir l'aire / Analyse proximité)
 *  - Clic droit sur un village → menu (Centrer / Analyser éligibilité)
 *  - Affichage d'un buffer (cercle) + lignes vers villages dans l'aire (auto-effacé 12s)
 *  - Émet un évènement `ors:village-analysis` avec le résultat (le parent ouvre la modal)
 *
 * On reste 100 % impératif (pas de VDOM par marqueur) pour éviter tout freeze sur 5k+ items.
 */

export interface VillageAnalysisResult {
  village: { name: string; population: number; lat: number; lng: number };
  /** Établissement le plus proche (peut être absent) */
  nearestEtab?: { name: string; distanceKm: number };
  /** Établissements à <= rayon (km) */
  nearbyEtabs: Array<{ name: string; distanceKm: number }>;
  /** Villages satellites à <= rayon */
  satelliteVillages: Array<{ name: string; population: number; distanceKm: number }>;
  /** Population scolarisable cumulée (village + satellites) */
  totalPopulation: number;
  /** Verdict d'éligibilité Nouvelle Création (seuil pop. 300, aucune école dans le rayon) */
  eligible: boolean;
  reason: string;
  radiusMeters: number;
}

interface Props {
  etablissements: Etablissement[];
  villages: Village[];
  /** Rayon en mètres (slider) */
  radius: number;
  onVillageAnalysis?: (r: VillageAnalysisResult) => void;
}

const TURF_OPTS = { units: 'kilometers' as const };

export const MapInteractions = ({ etablissements, villages, radius, onVillageAnalysis }: Props) => {
  const map = useMap();
  const tempLayerRef = useRef<L.LayerGroup | null>(null);
  const onAnalysisRef = useRef(onVillageAnalysis);
  onAnalysisRef.current = onVillageAnalysis;

  // Build a hidden marker layer just to attach contextmenu to invisible hit-targets.
  // Reason: CanvasMarkersLayer paints points but cannot host per-marker contextmenu cheaply.
  // We attach a `map.on('contextmenu')` handler that finds the nearest item.
  useEffect(() => {
    const tempLayer = L.layerGroup().addTo(map);
    tempLayerRef.current = tempLayer;

    const etabsWithCoords = etablissements.filter(e => e.latitude && e.longitude);
    const villagesWithCoords = villages.filter(v => v.latitude && v.longitude);

    const findNearest = (lat: number, lng: number) => {
      const p1 = turf.point([lng, lat]);
      let bestEtab: { etab: Etablissement; d: number } | null = null;
      for (const e of etabsWithCoords) {
        const d = turf.distance(p1, turf.point([e.longitude!, e.latitude!]), TURF_OPTS);
        if (!bestEtab || d < bestEtab.d) bestEtab = { etab: e, d };
      }
      let bestVlg: { v: Village; d: number } | null = null;
      for (const v of villagesWithCoords) {
        const d = turf.distance(p1, turf.point([v.longitude, v.latitude]), TURF_OPTS);
        if (!bestVlg || d < bestVlg.d) bestVlg = { v, d };
      }
      // Pick whichever is closest in screen space (~50 m tolerance via degrees)
      const tolKm = Math.max(0.05, map.getZoom() < 12 ? 1 : 0.2);
      const candEtab = bestEtab && bestEtab.d <= tolKm ? bestEtab : null;
      const candVlg = bestVlg && bestVlg.d <= tolKm ? bestVlg : null;
      if (candEtab && (!candVlg || candEtab.d <= candVlg.d)) {
        return { kind: 'etab' as const, item: candEtab.etab };
      }
      if (candVlg) return { kind: 'village' as const, item: candVlg.v };
      return null;
    };

    const showAire = (lat: number, lng: number, label: string, color: string) => {
      tempLayer.clearLayers();
      L.circle([lat, lng], { radius, color, fillOpacity: 0.15, weight: 2 }).addTo(tempLayer);
      const p1 = turf.point([lng, lat]);
      const radiusKm = radius / 1000;
      // Draw lines to villages within radius
      for (const v of villagesWithCoords) {
        const d = turf.distance(p1, turf.point([v.longitude, v.latitude]), TURF_OPTS);
        if (d <= radiusKm && d > 0) {
          L.polyline([[lat, lng], [v.latitude, v.longitude]], { color: '#facc15', weight: 1.5, opacity: 0.8 }).addTo(tempLayer);
        }
      }
      // Draw lines to other etabs within radius
      for (const e of etabsWithCoords) {
        const d = turf.distance(p1, turf.point([e.longitude!, e.latitude!]), TURF_OPTS);
        if (d <= radiusKm && d > 0) {
          L.polyline([[lat, lng], [e.latitude!, e.longitude!]], { color: '#ef4444', weight: 1, opacity: 0.6, dashArray: '4 3' }).addTo(tempLayer);
        }
      }
      L.popup({ closeOnClick: true, autoClose: true })
        .setLatLng([lat, lng])
        .setContent(`<div style="font-weight:600">Aire de couverture</div><div style="font-size:11px">${label} — rayon ${(radius / 1000).toFixed(1)} km</div>`)
        .openOn(map);
      // Auto-clear after 12s
      setTimeout(() => { tempLayer.clearLayers(); }, 12000);
    };

    const analyseVillage = (v: Village) => {
      const radiusKm = radius / 1000;
      const p1 = turf.point([v.longitude, v.latitude]);
      const nearbyEtabs: Array<{ name: string; distanceKm: number }> = [];
      let nearest: { name: string; distanceKm: number } | undefined;
      for (const e of etabsWithCoords) {
        const d = turf.distance(p1, turf.point([e.longitude!, e.latitude!]), TURF_OPTS);
        if (!nearest || d < nearest.distanceKm) nearest = { name: e.NOM_ETAB || 'Inconnu', distanceKm: d };
        if (d <= radiusKm) nearbyEtabs.push({ name: e.NOM_ETAB || 'Inconnu', distanceKm: d });
      }
      const satellites: Array<{ name: string; population: number; distanceKm: number }> = [];
      for (const vv of villagesWithCoords) {
        if (vv === v) continue;
        const d = turf.distance(p1, turf.point([vv.longitude, vv.latitude]), TURF_OPTS);
        if (d <= radiusKm) satellites.push({ name: vv.name, population: vv.population || 0, distanceKm: d });
      }
      const totalPop = (v.population || 0) + satellites.reduce((s, x) => s + x.population, 0);
      let eligible = false;
      let reason = '';
      if (nearbyEtabs.length > 0) {
        reason = `Une école existe déjà à proximité (< ${radiusKm} km). Renforcer l'école existante.`;
      } else if (totalPop < 300) {
        reason = `Population scolarisable insuffisante (${totalPop} habitants, seuil 300).`;
      } else {
        eligible = true;
        reason = `Critères remplis : aucune école dans un rayon de ${radiusKm} km, population de ${totalPop}.`;
      }

      // Visual overlay
      tempLayer.clearLayers();
      L.circle([v.latitude, v.longitude], { radius, color: '#facc15', fillOpacity: 0.15, weight: 2 }).addTo(tempLayer);
      for (const s of satellites) {
        const sv = villagesWithCoords.find(x => x.name === s.name);
        if (sv) L.polyline([[v.latitude, v.longitude], [sv.latitude, sv.longitude]], { color: '#facc15', weight: 1.5 }).addTo(tempLayer);
      }
      for (const e of etabsWithCoords) {
        const d = turf.distance(p1, turf.point([e.longitude!, e.latitude!]), TURF_OPTS);
        if (d <= radiusKm) L.polyline([[v.latitude, v.longitude], [e.latitude!, e.longitude!]], { color: '#ef4444', weight: 1.2 }).addTo(tempLayer);
      }

      onAnalysisRef.current?.({
        village: { name: v.name, population: v.population || 0, lat: v.latitude, lng: v.longitude },
        nearestEtab: nearest,
        nearbyEtabs,
        satelliteVillages: satellites,
        totalPopulation: totalPop,
        eligible,
        reason,
        radiusMeters: radius,
      });
    };

    const buildMenu = (e: L.LeafletMouseEvent, hit: ReturnType<typeof findNearest>) => {
      const items: Array<{ label: string; action: () => void }> = [
        { label: '🎯 Centrer ici', action: () => map.flyTo(e.latlng, Math.max(map.getZoom(), 14)) },
        { label: '🔍 Zoom +', action: () => map.setZoom(map.getZoom() + 1) },
        { label: '🔎 Zoom -', action: () => map.setZoom(map.getZoom() - 1) },
      ];
      if (hit?.kind === 'etab') {
        const etab = hit.item;
        items.unshift({
          label: `📍 Voir l'aire de "${(etab.NOM_ETAB || '').slice(0, 28)}"`,
          action: () => showAire(etab.latitude!, etab.longitude!, etab.NOM_ETAB || '', '#16a34a'),
        });
      } else if (hit?.kind === 'village') {
        const v = hit.item;
        items.unshift(
          { label: `🏘️ Voir aire — ${(v.name || '').slice(0, 28)}`, action: () => showAire(v.latitude, v.longitude, v.name, '#facc15') },
          { label: `🧪 Analyser éligibilité Nouvelle Création`, action: () => analyseVillage(v) },
        );
      }
      items.push({ label: '🧹 Effacer les overlays', action: () => tempLayer.clearLayers() });

      const html = `<div style="min-width:220px;padding:4px 0">
        ${items.map((it, i) => `<a data-idx="${i}" href="#" class="ors-ctx-item" style="display:block;padding:6px 12px;color:#1f2937;text-decoration:none;font-size:13px">${it.label}</a>`).join('')}
      </div>`;
      const popup = L.popup({ closeButton: false, className: 'ors-context-popup', autoPan: false, maxWidth: 280 })
        .setLatLng(e.latlng)
        .setContent(html)
        .openOn(map);
      const node = (popup as any)._contentNode as HTMLElement | undefined;
      node?.querySelectorAll('.ors-ctx-item').forEach((a) => {
        a.addEventListener('click', (ev) => {
          ev.preventDefault();
          const idx = parseInt((a as HTMLElement).dataset.idx || '-1');
          map.closePopup(popup);
          items[idx]?.action();
        });
      });
    };

    const onContext = (e: L.LeafletMouseEvent) => {
      L.DomEvent.preventDefault(e.originalEvent);
      const hit = findNearest(e.latlng.lat, e.latlng.lng);
      buildMenu(e, hit);
    };

    map.on('contextmenu', onContext);
    return () => {
      map.off('contextmenu', onContext);
      tempLayer.remove();
    };
  }, [map, etablissements, villages, radius]);

  return null;
};

export default MapInteractions;