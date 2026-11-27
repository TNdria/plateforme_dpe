// @ts-nocheck
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  MapContainer, TileLayer, Marker, Popup, Circle, Polygon, Polyline, Tooltip, useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { AlertTriangle, Eye, EyeOff, MapPin, Layers, ChevronDown } from "lucide-react";

import {
  getLocalisationValue, getPosition, getNomAireItem,
  normaliserAireItem, niveauToKey, mapNiveau,
  getRayonCarteKm, getRayonRecrutementKm, getDistanceKmItem,
  estDansRayonAnalyse, estEtablissementNiveau, normaliserNiveauItem,
  extraireContour, calculerMaxBounds, getEtablissementsProchesAnalyse,
  getVillageNonEligible, getZoneProposee, getPointsNouvelleCreation,
} from "@/utils/demandeHelpers";
import { ORS_COLORS } from "@/components/ors/orsColors";

const escapeMapText = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
}[c] || c));

export const COULEUR_ECOLE_NOUVELLE = "#facc15";
export const COULEUR_ECOLE_EXISTANTE = ORS_COLORS.default;
export const COULEUR_COUVERT = ORS_COLORS.villageCouvert;
export const COULEUR_HORS_ZONE = ORS_COLORS.villageHorsZone;
export const COULEUR_RAYON = "#6b7280";
export const COULEUR_LIGNE_INTERSECTION = "#000000";
export const COULEUR_VILLAGE_NON_ELIGIBLE = ORS_COLORS.nonEligible;
export const COULEUR_ZONE_PROPOSEE = ORS_COLORS.eligible;

const STYLE_COMMUNE = {
  fillColor: ORS_COLORS.limiteDren,
  color: ORS_COLORS.limiteDren,
  weight: 2,
  opacity: 0.8,
  fillOpacity: 0.03,
};
const STYLE_FOKONTANY = {
  fillColor: "#22afbe",
  color: "#22afbe",
  weight: 2,
  opacity: 0.9,
  fillOpacity: 0.03,
};

const MAPBOX_TOKEN =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_MAPBOX_TOKEN) ||
  "pk.eyJ1IjoidG9reSIsImEiOiJjbTE4djVndXIxNmQwMmxzam1nY3JzcWU0In0.KtMOpNhicsXZkbmcFtVd8w";

const URL_MAPBOX_IMAGERY = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`;
const URL_MAPBOX_STREETS = `https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`;

const KM_PAR_DEG_LAT = 110.574;

const calculerLignesIntersection = (centres, rKm) => {
  if (!Array.isArray(centres) || centres.length < 2 || !(rKm > 0)) return [];
  const latRef = centres.reduce((s, c) => s + c.pos[0], 0) / centres.length;
  const kmParDegLng = 111.320 * Math.cos((latRef * Math.PI) / 180);
  if (!kmParDegLng) return [];
  const lat0 = centres[0].pos[0];
  const lng0 = centres[0].pos[1];
  const pts = centres.map((c) => ({
    x: (c.pos[1] - lng0) * kmParDegLng,
    y: (c.pos[0] - lat0) * KM_PAR_DEG_LAT,
  }));
  const versLatLng = (x, y) => [lat0 + y / KM_PAR_DEG_LAT, lng0 + x / kmParDegLng];
  const lignes = [];

  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const pi = pts[i];
      const pj = pts[j];
      const dx = pj.x - pi.x;
      const dy = pj.y - pi.y;
      const d = Math.hypot(dx, dy);
      if (!d || d >= 2 * rKm) continue;
      const h = Math.sqrt(Math.max(0, rKm * rKm - (d / 2) * (d / 2)));
      const mx = (pi.x + pj.x) / 2;
      const my = (pi.y + pj.y) / 2;
      const ux = -dy / d;
      const uy = dx / d;
      const a = { x: mx - h * ux, y: my - h * uy };
      const b = { x: mx + h * ux, y: my + h * uy };
      let t0 = 0;
      let t1 = 1;

      for (let k = 0; k < pts.length; k++) {
        if (k === i || k === j) continue;
        const pk = pts[k];
        const f = (p) =>
          (pk.x * pk.x + pk.y * pk.y) - (pi.x * pi.x + pi.y * pi.y)
          - 2 * (p.x * (pk.x - pi.x) + p.y * (pk.y - pi.y));
        const fa = f(a);
        const fb = f(b);
        if (fa < 0 && fb < 0) { t0 = 1; t1 = 0; break; }
        if (fa < 0) t0 = Math.max(t0, fa / (fa - fb));
        else if (fb < 0) t1 = Math.min(t1, fa / (fa - fb));
      }

      if (t1 - t0 <= 1e-6) continue;
      const p0 = { x: a.x + t0 * (b.x - a.x), y: a.y + t0 * (b.y - a.y) };
      const p1 = { x: a.x + t1 * (b.x - a.x), y: a.y + t1 * (b.y - a.y) };
      lignes.push({
        positions: [versLatLng(p0.x, p0.y), versLatLng(p1.x, p1.y)],
        noms: [centres[i].nom, centres[j].nom],
      });
    }
  }
  return lignes;
};

const clipDemiPlan = (poly, a, b, c) => {
  const out = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const P = poly[i];
    const Q = poly[(i + 1) % n];
    const fp = a * P.x + b * P.y - c;
    const fq = a * Q.x + b * Q.y - c;
    if (fp <= 0) out.push(P);
    if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) {
      const t = fp / (fp - fq);
      out.push({ x: P.x + t * (Q.x - P.x), y: P.y + t * (Q.y - P.y) });
    }
  }
  return out;
};

const analyserVoronoi = (centres, pointsBruts, rKm) => {
  if (!Array.isArray(centres) || centres.length < 2 || !(rKm > 0)) return null;
  const latRef = centres.reduce((s, c) => s + c.pos[0], 0) / centres.length;
  const kmParDegLng = 111.320 * Math.cos((latRef * Math.PI) / 180);
  if (!kmParDegLng) return null;
  const lat0 = centres[0].pos[0];
  const lng0 = centres[0].pos[1];
  const versXY = (p) => ({ x: (p[1] - lng0) * kmParDegLng, y: (p[0] - lat0) * KM_PAR_DEG_LAT });
  const versLatLng = (x, y) => [lat0 + y / KM_PAR_DEG_LAT, lng0 + x / kmParDegLng];
  const xy = centres.map((c) => versXY(c.pos));

  const lignes = [];
  centres.forEach((c, i) => {
    let poly = Array.from({ length: 72 }, (_, k) => {
      const t = (2 * Math.PI * k) / 72;
      return { x: xy[i].x + rKm * Math.cos(t), y: xy[i].y + rKm * Math.sin(t) };
    });
    for (let j = 0; j < centres.length; j++) {
      if (j === i) continue;
      const dx = xy[j].x - xy[i].x;
      const dy = xy[j].y - xy[i].y;
      if (Math.hypot(dx, dy) < 1e-6) continue;
      const cst = (xy[j].x ** 2 + xy[j].y ** 2 - xy[i].x ** 2 - xy[i].y ** 2) / 2;
      poly = clipDemiPlan(poly, dx, dy, cst);
      if (!poly.length) break;
    }
    for (let a = 0; a < poly.length; a++) {
      const P = poly[a];
      const Q = poly[(a + 1) % poly.length];
      const dist = (p) => Math.hypot(p.x - xy[i].x, p.y - xy[i].y);
      const M = { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 };
      const surCercle = Math.abs(dist(P) - rKm) < 1e-3 && Math.abs(dist(Q) - rKm) < 1e-3 && Math.abs(dist(M) - rKm) < 0.02 * rKm;
      if (surCercle) continue;
      if (Math.hypot(P.x - Q.x, P.y - Q.y) < 1e-6) continue;
      lignes.push({
        positions: [versLatLng(P.x, P.y), versLatLng(Q.x, Q.y)],
        noms: [c.nom],
      });
    }
  });

  const comptes = centres.map(() => 0);
  const alimente = new Map();
  (pointsBruts || []).forEach((pb) => {
    if (!pb?.pos) return;
    const q = versXY(pb.pos);
    let best = -1;
    let bd = Infinity;
    xy.forEach((c, i) => {
      const d = Math.hypot(q.x - c.x, q.y - c.y);
      if (d < bd) { bd = d; best = i; }
    });
    if (best < 0) return;
    const cle = `${pb.pos[0].toFixed(5)}|${pb.pos[1].toFixed(5)}`;
    if (alimente.has(cle)) return;
    alimente.set(cle, { owner: best, nomOwner: centres[best].nom, distanceKm: bd });
    if (bd <= rKm + 0.05) comptes[best] += 1;
  });

  return { lignes, comptes, alimente };
};

const LARGEUR_REFERENCE_PX = 800;
const TAILLE_NOM_NORMAL = 8;
const TAILLE_NOM_NOUVEAU = 11;

const createLabeledMapIcon = (
  background, border, symbol, label,
  secondary = "", size = 14, labelWidth = 230, shape = "dot",
  avecCapture = false,
  echelleTexte = 1,
  emphase = false,
) => {
  const safeLabel = escapeMapText(label || "Lieu non renseigné");
  const safeSecondary = escapeMapText(secondary);
  const k = avecCapture ? echelleTexte : 1;
  const sz = Math.max(2, Math.round(size * k));
  const lw = Math.round(labelWidth * k);
  const baseFont = emphase ? TAILLE_NOM_NOUVEAU : TAILLE_NOM_NORMAL;
  const fontSizeMain = Math.max(5, Math.round(baseFont * k));
  const fontWeightMain = emphase ? 900 : 700;
  const colorMain = emphase ? "#000000" : "#111827";
  const fontSizeSecondary = Math.max(5, fontSizeMain - 2);
  const boxHeight = avecCapture
    ? Math.max(Math.round(20 * k), sz + Math.round(4 * k), Math.ceil(fontSizeMain * 1.4))
    : Math.max(20, size + 4, emphase ? Math.ceil(fontSizeMain * 1.4) : 0);
  const iconTop = Math.round((boxHeight - sz) / 2);
  const topMain = Math.max(0, Math.round((boxHeight - fontSizeMain * 1.2) / 2));
  const topSecondary = topMain + fontSizeMain + 1;
  const e = Math.max(1, Math.round(k));
  const ombre = `-${e}px -${e}px 0 rgba(255,255,255,.95),${e}px -${e}px 0 rgba(255,255,255,.95),-${e}px ${e}px 0 rgba(255,255,255,.95),${e}px ${e}px 0 rgba(255,255,255,.95),0 0 ${3 * e}px rgba(255,255,255,.9)`;
  const ombreSec = `-${e}px -${e}px 0 rgba(255,255,255,.95),${e}px -${e}px 0 rgba(255,255,255,.95),-${e}px ${e}px 0 rgba(255,255,255,.95),${e}px ${e}px 0 rgba(255,255,255,.95)`;

  const pointHtml = "";

  const glyph =
    shape === "school"
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${sz}" height="${sz}"
           style="position:absolute;left:0;top:${iconTop}px;z-index:2;filter:drop-shadow(0 1px 2px rgba(15,23,42,.35));">
           <path d="M12 2 1.5 10h21z" fill="${background}"/>
           <rect x="3.5" y="10" width="17" height="11" fill="${background}"/>
           <rect x="10" y="14" width="4" height="7" fill="#ffffff"/>
           <rect x="5.5" y="12.5" width="3" height="3" fill="#ffffff"/>
           <rect x="15.5" y="12.5" width="3" height="3" fill="#ffffff"/>
         </svg>`
      : shape === "flag"
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${sz}" height="${sz}"
           style="position:absolute;left:0;top:${iconTop}px;z-index:2;filter:drop-shadow(0 1px 2px rgba(15,23,42,.35));">
           <path d="M5 2 L5 22" stroke="${background}" stroke-width="2.5" stroke-linecap="round"/>
           <path d="M5 3 L19 3 L15 8 L19 13 L5 13 Z" fill="${background}"/>
         </svg>`
      : shape === "none"
      ? ""
      : pointHtml
      ? `<div style="position:absolute;left:0;top:${iconTop}px;width:${sz}px;height:${sz}px;z-index:2;display:flex;align-items:center;justify-content:center;">${pointHtml}</div>`
      : `<div style="position:absolute;left:0;top:${iconTop}px;width:${sz}px;height:${sz}px;
           border-radius:50%;background:${background};border:1px solid #fff;
           box-shadow:0 1px 2px rgba(15,23,42,.35);z-index:2;"></div>`;

  const decalageTexte = shape === "none" ? 0 : sz + Math.round(5 * k);
  const largeurBoite = lw + Math.round(20 * k);

  return L.divIcon({
    className: "fiche-labeled-marker",
    html: `
      <div style="position:relative;width:${largeurBoite}px;height:${boxHeight}px;overflow:visible;">
        ${glyph}
        <div style="position:absolute;left:${decalageTexte}px;top:${topMain}px;
          color:${shape === "none" ? background : colorMain};font-family:Arial,sans-serif;font-size:${fontSizeMain}px;font-weight:${fontWeightMain};
          line-height:1.2;white-space:nowrap;
          text-shadow:${ombre};
          z-index:3;">${safeLabel}</div>
        ${safeSecondary ? `<div style="position:absolute;left:${decalageTexte}px;top:${topSecondary}px;
                 color:#475569;font-family:Arial,sans-serif;font-size:${fontSizeSecondary}px;font-weight:600;
                 line-height:1.1;white-space:nowrap;
                 text-shadow:${ombreSec};
                 z-index:3;">${safeSecondary}</div>` : ""}
      </div>`,
    iconSize: [largeurBoite, boxHeight],
    iconAnchor: [shape === "none" ? 0 : sz / 2, Math.round(boxHeight / 2)],
    popupAnchor: [0, -Math.round(boxHeight / 2)],
  });
};

function SchoolGlyph({ color, size = 14 }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12 2 1.5 10h21z" fill={color} />
      <rect x="3.5" y="10" width="17" height="11" fill={color} />
      <rect x="10" y="14" width="4" height="7" fill="#ffffff" />
      <rect x="5.5" y="12.5" width="3" height="3" fill="#ffffff" />
      <rect x="15.5" y="12.5" width="3" height="3" fill="#ffffff" />
    </svg>
  );
}

function FlagGlyph({ color, size = 14 }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M5 2 L5 22" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M5 3 L19 3 L15 8 L19 13 L5 13 Z" fill={color} />
    </svg>
  );
}

function PopupTable({ titre, couleur = "#4e73df", lignes = [], pied = null }) {
  return (
    <div style={{ minWidth: 240 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: couleur, color: "white" }}>
            <th colSpan={2} style={{ padding: 6, textAlign: "center" }}>{titre}</th>
          </tr>
        </thead>
        <tbody>
          {lignes.filter(Boolean).map(([label, valeur], i) => (
            <tr key={i}>
              <th style={{ padding: 4, textAlign: "left" }}>{label}</th>
              <td style={{ textAlign: "right", padding: 4 }}>{valeur}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {pied}
    </div>
  );
}

function PiedRayon({ hors, rayonLabel }) {
  return (
    <div
      style={{
        marginTop: 4, padding: 3, textAlign: "center", fontWeight: "bold", fontSize: 11, borderRadius: 4,
        background: hors ? "#fee2e2" : "#dcfce7",
        color: hors ? "#b91c1c" : "#15803d",
      }}
    >
      {hors ? `Hors du rayon (> ${rayonLabel})` : `Dans le rayon (≤ ${rayonLabel})`}
    </div>
  );
}

const TOPLEFT_STACK_GAP = 6;

function MapTopLeftControls({ resetCenter, resetZoom }) {
  const map = useMap();

  useEffect(() => {
    const Ctrl = L.Control.extend({
      options: { position: "topleft" },
      onAdd() {
        const container = L.DomUtil.create("div", "ors-topleft-stack");
        container.style.cssText = `display:flex;flex-direction:column;align-items:center;gap:${TOPLEFT_STACK_GAP}px;`;
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);

        const compass = L.DomUtil.create("div", "leaflet-control", container);
        compass.style.cssText =
          "margin:0;background:rgba(255,255,255,0.95);border:2px solid #d1d5db;border-radius:50%;padding:5px;box-shadow:0 2px 8px rgba(0,0,0,0.18);width:42px;height:42px;display:flex;align-items:center;justify-content:center;pointer-events:none;";
        compass.innerHTML = `<img src="/img/Nord.png" alt="Nord" style="width:32px;height:32px;object-fit:contain;" title="Nord" />`;

        const zoomBar = L.DomUtil.create("div", "leaflet-bar leaflet-control leaflet-control-zoom", container);
        zoomBar.style.margin = "0";
        const zoomIn = L.DomUtil.create("a", "leaflet-control-zoom-in", zoomBar);
        zoomIn.href = "#";
        zoomIn.title = "Zoom avant";
        zoomIn.innerHTML = "+";
        const zoomOut = L.DomUtil.create("a", "leaflet-control-zoom-out", zoomBar);
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

        const reset = L.DomUtil.create("a", "leaflet-bar leaflet-control leaflet-control-custom", container);
        reset.href = "#";
        reset.title = "Réinitialiser la vue";
        reset.style.cssText =
          "margin:0;background:#fff;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:14px;text-decoration:none;color:#1f2937;border:1px solid #d1d5db;border-radius:4px;box-shadow:0 1px 6px rgba(0,0,0,0.15);";
        reset.innerHTML = "⟲";
        L.DomEvent.on(reset, "click", (e) => {
          L.DomEvent.preventDefault(e);
          if (resetCenter) map.flyTo(resetCenter, resetZoom ?? map.getZoom());
        });

        const badge = L.DomUtil.create("div", "", container);
        badge.id = "ors-zoom-indicator";
        badge.style.cssText =
          "margin:0;background:rgba(39,39,42,0.78);color:#fff;border-radius:4px;padding:4px 10px;font-size:12px;line-height:1.2;box-shadow:0 1px 6px rgba(0,0,0,0.18);pointer-events:none;";
        const updateBadge = () => {
          badge.innerHTML = `Niveau de Zoom: ${Number(map.getZoom().toFixed(1))}`;
        };
        updateBadge();

        const onZoomEnd = () => {
          updateZoomButtons();
          updateBadge();
        };
        updateZoomButtons();
        map.on("zoomend", onZoomEnd);
        container._orsCleanup = () => map.off("zoomend", onZoomEnd);

        return container;
      },
      onRemove() {
        this._container?._orsCleanup?.();
      },
    });

    const ctrl = new Ctrl();
    ctrl.addTo(map);
    return () => { ctrl.remove(); };
  }, [map, resetCenter ? resetCenter.join(",") : "", resetZoom]);

  return null;
}

function MapScaleControl() {
  const map = useMap();
  useEffect(() => {
    const scale = L.control.scale({ imperial: false, position: "bottomright" }).addTo(map);
    return () => { scale.remove(); };
  }, [map]);
  return null;
}

function MapSizeUpdater() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const updateSize = () => map.invalidateSize({ animate: false, pan: false, debounceMoveend: true });
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);
    updateSize();
    return () => resizeObserver.disconnect();
  }, [map]);
  return null;
}

function MapGlobalStyles() {
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
  }, []);
  return null;
}

function RecenterMap({ points }) {
  const map = useMap();
  const signature = points.map((p) => p.join(",")).join("|");

  useEffect(() => {
    const timers = [50, 300, 700].map((ms) => setTimeout(() => map.invalidateSize(), ms));
    const timer = setTimeout(() => {
      if (!points.length) return;
      const pointsValides = points.filter(([lat, lng]) => {
        const okLat = typeof lat === "number" && lat >= -26 && lat <= -11;
        const okLng = typeof lng === "number" && lng >= 42 && lng <= 52;
        return okLat && okLng;
      });
      if (pointsValides.length === 0) return;
      if (pointsValides.length === 1) { map.setView(pointsValides[0], 12, { animate: false }); return; }
      try {
        const bounds = L.latLngBounds(pointsValides);
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const spanLat = Math.abs(ne.lat - sw.lat);
        const spanLng = Math.abs(ne.lng - sw.lng);
        if (spanLat > 1.5 || spanLng > 1.5) { map.setView(pointsValides[0], 11, { animate: false }); return; }
        map.fitBounds(bounds.pad(0.15), { animate: false, maxZoom: 13 });
      } catch (e) { map.setView(pointsValides[0], 11, { animate: false }); }
    }, 350);
    return () => { timers.forEach(clearTimeout); clearTimeout(timer); };
  }, [map, signature]);

  return null;
}

function ForceMinZoom({ minZoom }) {
  const map = useMap();
  useEffect(() => {
    const appliquer = () => { if (map.getZoom() < minZoom) map.setZoom(minZoom, { animate: false }); };
    appliquer();
    map.on("zoomend", appliquer);
    return () => { map.off("zoomend", appliquer); };
  }, [map, minZoom]);
  return null;
}

function ExposerCarte({ instanceRef }) {
  const map = useMap();
  useEffect(() => {
    if (instanceRef) instanceRef.current = map;
    return () => { if (instanceRef) instanceRef.current = null; };
  }, [map, instanceRef]);
  return null;
}

function SuivreVue({ vueRef, fondKey, afficherAnalyseSpatiale }) {
  const map = useMap();
  useEffect(() => {
    const enregistrer = () => {
      const c = map.getCenter();
      const s = map.getSize();
      vueRef.current = {
        center: [c.lat, c.lng],
        zoom: map.getZoom(),
        size: { x: s.x, y: s.y },
        fondKey,
        afficherAnalyseSpatiale,
      };
    };
    map.on("moveend", enregistrer);
    map.on("zoomend", enregistrer);
    map.on("resize", enregistrer);
    enregistrer();
    return () => {
      map.off("moveend", enregistrer);
      map.off("zoomend", enregistrer);
      map.off("resize", enregistrer);
    };
  }, [map, vueRef, fondKey, afficherAnalyseSpatiale]);
  return null;
}

const FONDS_CARTE = [
  { key: "default", label: "DEFAULT", url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "&copy; OpenStreetMap contributors", maxZoom: 19, mapbox: false },
  { key: "imagery", label: "IMAGERY", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attribution: "&copy; Esri", maxZoom: 22, mapbox: false },
  { key: "mapbox", label: "MAPBOX", url: URL_MAPBOX_STREETS, attribution: "&copy; Mapbox", maxZoom: 22, mapbox: true },
  { key: "mapbox_imagery", label: "MAPBOX IMAGERY", url: URL_MAPBOX_IMAGERY, attribution: "&copy; Mapbox", maxZoom: 22, mapbox: true },
];

function FondTuiles({ fondKey, avecCapture }) {
  const fond = FONDS_CARTE.find((f) => f.key === fondKey) || FONDS_CARTE[0];
  return (
    <TileLayer
      key={fond.key}
      attribution={fond.attribution}
      url={fond.url}
      maxZoom={fond.maxZoom}
      {...(fond.mapbox ? { tileSize: 512, zoomOffset: -1 } : {})}
      crossOrigin="anonymous"
    />
  );
}

const getMapPointLabel = (item, niveauKey, type, demandeContext = {}) => {
  if (type === "nouveau") {
    const main = getNomAireItem({
      ...item,
      nom_etab: item?.nom_etab ?? item?.NOM_ETAB ?? item?.nom_etablissement,
    });
    return {
      main: main === "Lieu sans nom fourni par l'API" ? "Nouvel établissement" : main,
      secondary: "",
    };
  }
  return { main: getNomAireItem(item), secondary: "" };
};

const positionPointAire = (a, niveauKey) => {
  let pos = null;
  try { pos = getPosition(normaliserAireItem(a, niveauKey)); } catch (e) { pos = null; }
  if (pos) return pos;
  try { pos = getPosition(a); } catch (e) { pos = null; }
  if (pos) return pos;
  const lat = Number(a?.latitude ?? a?.lat);
  const lng = Number(a?.longitude ?? a?.lng ?? a?.lon);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
};

const nomPointAire = (info) =>
  info?.nom_inferieur || info?.nom_village || info?.nom || info?.nom_etab || "Point";

const estNouvelleCreationDemande = (demande) => {
  const t = String(demande?.type_demande || demande?.type_demande_label || "")
    .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (t.includes("regularisation")) return false;
  return t.includes("nouvelle") || (!t && !!demande?.nouvelle_creation);
};

export default function DemandeLocalisationMap({
  demande,
  etablissementsProches,
  aireRecrutement,
  aireSansCoord = [],
  mapRef,
  avecCapture = false,
  vueRef = null,
  mapInstanceRef = null,
  captureSize = null,
  masquerAireVoisins = false,
  vueInitiale = null,
  modeVoronoi: modeVoronoiProp = null,
  fondKeyInitial = "default",
  afficherAnalyseSpatialeInitiale = false,
}) {
  const [afficherAnalyseSpatiale, setAfficherAnalyseSpatiale] = useState(
    Boolean(afficherAnalyseSpatialeInitiale)
  );
  const [fondKey, setFondKey] = useState(fondKeyInitial || "default");
  const [panneauOuvert, setPanneauOuvert] = useState(true);

  useEffect(() => {
    if (avecCapture) {
      setFondKey(fondKeyInitial || "default");
      setAfficherAnalyseSpatiale(Boolean(afficherAnalyseSpatialeInitiale));
    }
  }, [avecCapture, fondKeyInitial, afficherAnalyseSpatialeInitiale]);

  const niveauKey = niveauToKey(demande?.niveau_etab || demande?.niveau);
  const niveauLabel = mapNiveau(demande?.niveau_etab || demande?.niveau);
  const rayonCarte = getRayonCarteKm(niveauKey);

  const pointsNouvelleCreation = useMemo(() => getPointsNouvelleCreation(demande), [demande]);
  const villageNonEligible = pointsNouvelleCreation.villageNonEligible;
  const zoneProposee = pointsNouvelleCreation.zoneProposee;
  const remplaceVillage = pointsNouvelleCreation.remplaceVillage;

  const positionDemande = getPosition(demande);
  const positionZone = (() => {
    const la = Number(zoneProposee?.latitude);
    const lo = Number(zoneProposee?.longitude);
    return zoneProposee && Number.isFinite(la) && Number.isFinite(lo) ? [la, lo] : null;
  })();
  const futurePosition = positionZone || positionDemande;

  const estNouvelleCreation = estNouvelleCreationDemande(demande);
  const modeVoronoi = modeVoronoiProp === null ? estNouvelleCreation : Boolean(modeVoronoiProp);

  const voisinsVisibles = afficherAnalyseSpatiale;
  const afficherAnneauxVoisins = afficherAnalyseSpatiale;
  const afficherLignes = afficherAnalyseSpatiale;

  const prochesEffectifs = (Array.isArray(etablissementsProches) && etablissementsProches.length > 0)
    ? etablissementsProches
    : getEtablissementsProchesAnalyse(demande);

  const echelleTexte = avecCapture ? Math.max(0.5, (captureSize?.w ?? 1160) / LARGEUR_REFERENCE_PX) : 1;
  const k = echelleTexte;
  const poids = (n) => (avecCapture ? n * k : n);
  const tirets = (s) => (avecCapture ? s.split(" ").map((x) => Number(x) * k).join(" ") : s);

  const vueFigee = avecCapture && (!vueInitiale || (vueInitiale?.center && Number.isFinite(vueInitiale?.zoom)));

  const demandeContext = {
    commune: getLocalisationValue(demande, "commune"),
    cisco: getLocalisationValue(demande, "cisco"),
    fokontany: getLocalisationValue(demande, "fokontany"),
    village: getLocalisationValue(demande, "village"),
  };

  const withPosition = (list) =>
    (Array.isArray(list) ? list : [])
      .map((item) => ({ item, position: getPosition(item) }))
      .filter((x) => Boolean(x.position));

  const recrutement = (Array.isArray(aireRecrutement) ? aireRecrutement : [])
    .map((item) => normaliserAireItem(item, niveauKey));

  const nearbyAll = prochesEffectifs;
  const nearbyFiltered = nearbyAll.filter((item) => estEtablissementNiveau(item, niveauKey));
  const candidatsProximite = nearbyFiltered.length
    ? nearbyFiltered
    : nearbyAll.filter((item) => !normaliserNiveauItem(item));

  const nearbySource = candidatsProximite.filter((item) => estDansRayonAnalyse(item, futurePosition, rayonCarte));

  const recrutementAvecCoord = recrutement.filter((item) => Boolean(getPosition(item)));
  const nearby = withPosition(nearbySource);
  const feedersBruts = withPosition(recrutementAvecCoord);

  const feeders = futurePosition
    ? feedersBruts.filter(({ position }) => {
        const [latF, lngF] = position;
        const [latN, lngN] = futurePosition;
        return !(Math.abs(latF - latN) < 0.0001 && Math.abs(lngF - lngN) < 0.0001);
      })
    : feedersBruts;

  const feederPoints = feeders.map(({ position }) => position);
  const nearbyPoints = nearby.map(({ position }) => position);

  const rayonNorme = getRayonRecrutementKm(niveauKey) * 1000;
  const rayonNormeKm = getRayonRecrutementKm(niveauKey);
  const rayonLabel = rayonNormeKm < 1 ? `${Math.round(rayonNormeKm * 1000)} m` : `${rayonNormeKm} km`;
  const estHorsRayon = (item) => {
    const d = getDistanceKmItem(item, futurePosition);
    return d !== null && d > rayonNormeKm + 0.05;
  };

  const voisins = nearby.map(({ item, position }) => {
    const liste = Array.isArray(item?.aire_recrutement) ? item.aire_recrutement : [];
    const pointsAire = liste
      .map((a) => ({ info: a, pos: positionPointAire(a, niveauKey) }))
      .filter((p) => Boolean(p.pos));
    return { item, position, points: pointsAire, nbAire: liste.length };
  });

  const nomNouveau = zoneProposee?.aUnNom ? zoneProposee.nom : (demande?.nom_etab || "Nouvel établissement");

  const voronoi = useMemo(() => {
    if (!modeVoronoi || !futurePosition || !afficherAnalyseSpatiale) return null;
    const centres = [{ pos: futurePosition, nom: nomNouveau }];
    nearby.forEach(({ item, position }) => centres.push({ pos: position, nom: getNomAireItem(item) }));

    const pointsBruts = [];
    feeders.forEach(({ position }) => pointsBruts.push({ pos: position }));
    voisins.forEach(({ points }) => points.forEach((pt) => pointsBruts.push({ pos: pt.pos })));

    return analyserVoronoi(centres, pointsBruts, rayonNormeKm);
  }, [
    modeVoronoi,
    futurePosition ? futurePosition.join(",") : "",
    nearby.map(({ item, position }) => `${getNomAireItem(item)}@${position.join(",")}`).join("|"),
    feeders.map(({ position }) => position.join(",")).join("|"),
    voisins.map(({ points }) => points.length).join(","),
    rayonNormeKm, nomNouveau,
    afficherAnalyseSpatiale,
  ]);

  const infoAlimente = (pos) => {
    if (!voronoi || !pos) return null;
    return voronoi.alimente.get(`${pos[0].toFixed(5)}|${pos[1].toFixed(5)}`) || null;
  };

  const lignesIntersection = useMemo(() => {
    if (modeVoronoi || !voisinsVisibles) return [];
    const centres = [];
    if (futurePosition) centres.push({ pos: futurePosition, nom: nomNouveau });
    nearby.forEach(({ item, position }) => centres.push({ pos: position, nom: getNomAireItem(item) }));
    return calculerLignesIntersection(centres, rayonNormeKm);
  }, [
    modeVoronoi, voisinsVisibles,
    futurePosition ? futurePosition.join(",") : "",
    nearby.map(({ position }) => position.join(",")).join("|"),
    rayonNormeKm, nomNouveau,
  ]);

  const lignesAffichees = voronoi ? voronoi.lignes : lignesIntersection;

  const contourCommune = extraireContour(demande, "commune");
  const contourFokontany = extraireContour(demande, "fokontany");

  const pointsPourCadrage = (() => {
    if (contourCommune && contourCommune.length >= 3) return contourCommune;
    if (contourFokontany && contourFokontany.length >= 3) return contourFokontany;

    const cercle = [];
    if (futurePosition) {
      const [la, lo] = futurePosition;
      const dLat = rayonNormeKm / 111;
      const dLng = rayonNormeKm / (111 * Math.max(0.2, Math.cos((la * Math.PI) / 180)));
      cercle.push([la - dLat, lo - dLng], [la + dLat, lo + dLng]);
    }

    const cerclesVoisins = [];
    if (voisinsVisibles) {
      voisins.forEach(({ position }) => {
        const [la, lo] = position;
        const dLat = rayonNormeKm / 111;
        const dLng = rayonNormeKm / (111 * Math.max(0.2, Math.cos((la * Math.PI) / 180)));
        cerclesVoisins.push([la - dLat, lo - dLng], [la + dLat, lo + dLng]);
      });
    }

    return [
      ...(futurePosition ? [futurePosition] : []),
      ...nearbyPoints,
      ...feederPoints,
      ...cercle,
      ...cerclesVoisins,
      ...(villageNonEligible ? [[villageNonEligible.latitude, villageNonEligible.longitude]] : []),
      ...(zoneProposee ? [[zoneProposee.latitude, zoneProposee.longitude]] : []),
    ];
  })();

  const { bounds: maxBounds, minZoom: minZoomCarte } = useMemo(
    () => calculerMaxBounds(contourCommune, contourFokontany, futurePosition, rayonNormeKm),
    [
      contourCommune ? contourCommune.length : 0,
      contourFokontany ? contourFokontany.length : 0,
      futurePosition ? futurePosition.join(",") : "",
      rayonNormeKm,
    ]
  );

  const center = vueFigee ? vueInitiale.center : (pointsPourCadrage[0] || [-18.8792, 47.5079]);
  const zoomInitial = vueFigee ? vueInitiale.zoom : 12;
  const nomCommune = getLocalisationValue(demande, "commune");
  const nomFokontany = getLocalisationValue(demande, "fokontany");

  const afficherFuturePosition = Boolean(positionDemande) && !remplaceVillage;

  return (
    <div className="space-y-3">
      <div
        ref={mapRef}
        data-capture-carte={avecCapture ? "true" : undefined}
        className="relative w-full rounded-lg overflow-hidden border border-border"
        style={{ background: "#ffffff", ...(avecCapture ? { width: `${(captureSize?.w ?? 1160) + 2}px` } : {}) }}
      >
        <MapContainer
          center={center}
          zoom={zoomInitial}
          minZoom={avecCapture ? 5 : minZoomCarte}
          maxZoom={18}
          zoomSnap={0.1}
          zoomDelta={0.5}
          maxBounds={avecCapture ? undefined : (maxBounds ?? undefined)}
          maxBoundsViscosity={1.0}
          scrollWheelZoom={!avecCapture}
          zoomControl={false}
          zoomAnimation={!avecCapture}
          fadeAnimation={!avecCapture}
          markerZoomAnimation={!avecCapture}
          style={{ height: avecCapture ? `${(captureSize?.h ?? 500)}px` : "500px", width: "100%" }}
          attributionControl={!avecCapture}
        >
          <FondTuiles fondKey={fondKey} avecCapture={avecCapture} />

          {!avecCapture && <MapSizeUpdater />}
          {!avecCapture && <MapTopLeftControls resetCenter={center} resetZoom={zoomInitial} />}
          {!avecCapture && <MapScaleControl />}
          <MapGlobalStyles />

          {!avecCapture && !vueFigee && <RecenterMap points={pointsPourCadrage} />}
          {mapInstanceRef && <ExposerCarte instanceRef={mapInstanceRef} />}
          {!avecCapture && vueRef && (
            <SuivreVue
              vueRef={vueRef}
              fondKey={fondKey}
              afficherAnalyseSpatiale={afficherAnalyseSpatiale}
            />
          )}
          {!avecCapture && <ForceMinZoom minZoom={minZoomCarte} />}

          {contourCommune && contourCommune.length >= 3 && (
            <Polygon
              positions={contourCommune}
              pathOptions={{ ...STYLE_COMMUNE, weight: poids(STYLE_COMMUNE.weight + 1) }}
            >
              <Tooltip sticky><strong>Commune : {nomCommune}</strong></Tooltip>
            </Polygon>
          )}

          {contourFokontany && contourFokontany.length >= 3 && (
            <Polygon
              positions={contourFokontany}
              pathOptions={{ ...STYLE_FOKONTANY, weight: poids(STYLE_FOKONTANY.weight + 0.5), dashArray: tirets("6 4") }}
            >
              <Tooltip sticky><strong>Fokontany : {nomFokontany}</strong></Tooltip>
            </Polygon>
          )}

          {voisins.map(({ item, position, points }, index) => (
            <Fragment key={`voisin-zone-${index}`}>
              {afficherAnneauxVoisins && (
                <Circle
                  center={position}
                  radius={rayonNorme}
                  pathOptions={{ color: COULEUR_RAYON, weight: poids(1.6), opacity: 0.9, dashArray: tirets("4 3"), fill: false, fillOpacity: 0 }}
                >
                  <Tooltip sticky><strong>Rayon réglementaire ({rayonLabel}) : {getNomAireItem(item)}</strong></Tooltip>
                </Circle>
              )}

              {voisinsVisibles && points.map((pt, i) => {
                const nomLieu = nomPointAire(pt.info);
                const al = infoAlimente(pt.pos);
                const hors = al ? al.distanceKm > rayonNormeKm + 0.05 : false;
                return (
                  <Marker
                    key={`voisin-pt-${index}-${i}`}
                    position={pt.pos}
                    zIndexOffset={50}
                    icon={createLabeledMapIcon(
                      hors ? COULEUR_HORS_ZONE : COULEUR_COUVERT, null, "",
                      nomLieu, "", 5, 180, "dot", avecCapture, echelleTexte
                    )}
                  >
                    <Tooltip direction="top">
                      <div className="text-xs">
                        <strong>{nomLieu}</strong><br />
                        Aire de : {getNomAireItem(item)}<br />
                        {al && <>Alimente : {al.nomOwner}<br /></>}
                        Distance : {pt.info?.distance_future ?? "—"} km
                      </div>
                    </Tooltip>
                  </Marker>
                );
              })}
            </Fragment>
          ))}

          {futurePosition && (
            <Circle
              center={futurePosition}
              radius={rayonNorme}
              pathOptions={{ color: COULEUR_RAYON, weight: poids(1.6), opacity: 0.9, dashArray: tirets("4 3"), fill: false, fillOpacity: 0 }}
            >
              <Tooltip sticky><strong>Rayon réglementaire : {rayonLabel}</strong></Tooltip>
            </Circle>
          )}

          {afficherLignes && lignesAffichees.map((ligne, index) => (
            <Polyline
              key={`intersection-${index}`}
              positions={ligne.positions}
              pathOptions={{ color: COULEUR_LIGNE_INTERSECTION, weight: poids(2), opacity: 0.9 }}
            >
              <Tooltip sticky>
                {voronoi ? (
                  <strong>Limite d'influence (Voronoi)</strong>
                ) : (
                  <>
                    <strong>Ligne d'intersection</strong><br />
                    {ligne.noms[0]} ↔ {ligne.noms[1]}
                  </>
                )}
              </Tooltip>
            </Polyline>
          ))}

          {afficherFuturePosition && (
            <Marker
              position={positionDemande}
              zIndexOffset={1000}
              icon={createLabeledMapIcon(
                COULEUR_ECOLE_NOUVELLE, null, "",
                getMapPointLabel(demande, niveauKey, "nouveau", demandeContext).main,
                getMapPointLabel(demande, niveauKey, "nouveau", demandeContext).secondary,
                22, 260, "school", avecCapture, echelleTexte,
                true
              )}
            >
              <Popup>
                <PopupTable
                  titre="Nouvel établissement"
                  couleur="#ca8a04"
                  lignes={[
                    ["NOM", demande?.nom_etab || "—"],
                    ["NIVEAU", niveauLabel],
                    ["VILLAGE", getLocalisationValue(demande, "village")],
                    ["FOKONTANY", getLocalisationValue(demande, "fokontany")],
                    ["COMMUNE", getLocalisationValue(demande, "commune")],
                    ["CISCO", getLocalisationValue(demande, "cisco")],
                  ]}
                />
              </Popup>
            </Marker>
          )}

          {zoneProposee && (
            <Marker
              position={[zoneProposee.latitude, zoneProposee.longitude]}
              zIndexOffset={1000}
              icon={createLabeledMapIcon(
                COULEUR_ZONE_PROPOSEE, null, "",
                zoneProposee.nom || `Zone proposée (${demande?.nom_etab || "Nouvel établissement"})`,
                remplaceVillage ? "Zone éligible" : "Zone éligible proposée",
                12, 280, "dot", avecCapture, echelleTexte,
                true
              )}
            >
              <Popup>
                <PopupTable
                  titre="Zone éligible proposée"
                  couleur={ORS_COLORS.eligible}
                  lignes={[
                    ["NOM", zoneProposee.nom || "— (sans nom)"],
                    ["FOKONTANY", zoneProposee.fokontany || "—"],
                    ["COMMUNE", zoneProposee.commune || "—"],
                  ]}
                  pied={remplaceVillage ? (
                    <div style={{ marginTop: 4, padding: 3, textAlign: "center", fontSize: 11, fontWeight: "bold", color: "#15803d", borderTop: "1px solid #e5e7eb" }}>
                      Cette zone remplace le village non éligible.
                    </div>
                  ) : null}
                />
              </Popup>
            </Marker>
          )}

          {villageNonEligible && !remplaceVillage && (
            <Marker
              position={[villageNonEligible.latitude, villageNonEligible.longitude]}
              zIndexOffset={950}
              icon={createLabeledMapIcon(
                COULEUR_VILLAGE_NON_ELIGIBLE, null, "",
                villageNonEligible.nom || "Village non éligible",
                "Non éligible",
                14, 240, "flag", avecCapture, echelleTexte
              )}
            >
              <Popup>
                <PopupTable
                  titre="Village non éligible"
                  couleur={ORS_COLORS.nonEligible}
                  lignes={[
                    ["NOM", villageNonEligible.nom || "—"],
                    ["FOKONTANY", villageNonEligible.fokontany || "—"],
                    ["COMMUNE", villageNonEligible.commune || "—"],
                  ]}
                />
              </Popup>
            </Marker>
          )}

          {nearby.map(({ item, position }, index) => {
            const label = getMapPointLabel(item, niveauKey, "existant", demandeContext);
            const hors = estHorsRayon(item);
            return (
              <Marker
                key={`proche-${index}`}
                position={position}
                icon={
                  hors
                    ? createLabeledMapIcon(COULEUR_HORS_ZONE, null, "", label.main, label.secondary, 9, 200, "dot", avecCapture, echelleTexte)
                    : createLabeledMapIcon(COULEUR_ECOLE_EXISTANTE, null, "", label.main, label.secondary, 16, 200, "school", avecCapture, echelleTexte)
                }
              >
                <Popup>
                  <PopupTable
                    titre="Établissement existant"
                    lignes={[
                      ["NOM", getNomAireItem(item)],
                      ["FOKONTANY", item?.fokontany ?? "—"],
                      ["COMMUNE", item?.commune ?? demandeContext.commune],
                      ["DISTANCE", `${item?.distance_km ?? item?.distance ?? "—"} km`],
                      ["EFFECTIF", item?.effectif ?? item?.effectif_total ?? "—"],
                      ["AIRE DE RECRUTEMENT", Array.isArray(item?.aire_recrutement) ? item.aire_recrutement.length : 0],
                    ]}
                    pied={<PiedRayon hors={hors} rayonLabel={rayonLabel} />}
                  />
                </Popup>
              </Marker>
            );
          })}

          {feeders.map(({ item, position }, index) => {
            const isSchool = niveauKey === "college" || niveauKey === "lycee";
            const label = getMapPointLabel(item, niveauKey, "alimentant", demandeContext);
            const hors = estHorsRayon(item);
            const al = infoAlimente(position);
            return (
              <Marker
                key={`alimentant-${index}`}
                position={position}
                icon={createLabeledMapIcon(
                  hors ? COULEUR_HORS_ZONE : COULEUR_COUVERT,
                  null, "", label.main, label.secondary, 9, 200, "dot", avecCapture, echelleTexte
                )}
              >
                <Popup>
                  <PopupTable
                    titre={isSchool ? "École alimentante" : "Village alimentant"}
                    couleur="#6b7280"
                    lignes={[
                      ["NOM", getNomAireItem(item)],
                      ["FOKONTANY", item?.fokontany ?? "—"],
                      ["COMMUNE", item?.commune ?? demandeContext.commune],
                      niveauKey === "college" && ["EFFECTIF T5", item?.effectif_t5 ?? item?.effectif ?? "—"],
                      niveauKey === "lycee" && ["EFFECTIF T9", item?.effectif_t9 ?? item?.effectif ?? "—"],
                      (niveauKey === "primaire" || niveauKey === "prescolaire") && ["POPULATION", item?.population ?? "—"],
                      (niveauKey === "primaire" || niveauKey === "prescolaire") && ["POPULATION SCOLARISABLE", item?.population_scolarisable ?? "—"],
                      al && ["ALIMENTE", al.nomOwner],
                      ["DISTANCE", `${item?.distance_future ?? item?.distance_km ?? item?.distance ?? "—"} km`],
                    ]}
                    pied={<PiedRayon hors={hors} rayonLabel={rayonLabel} />}
                  />
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        <div
          className={`absolute top-3 z-[1000] bg-card/95 backdrop-blur-sm rounded-xl border border-border shadow-lg px-3 py-1.5 text-center pointer-events-none ${avecCapture ? "left-3" : "left-16"}`}
          style={{ ...(avecCapture ? { transform: `scale(${echelleTexte})`, transformOrigin: "top left" } : {}) }}
        >
          <div className="text-xs md:text-sm font-black uppercase leading-tight text-foreground">Analyse spatiale de l'implantation du nouveau {niveauLabel}</div>
          <div className="text-[11px] md:text-xs font-bold uppercase text-muted-foreground">{zoneProposee && zoneProposee.aUnNom ? zoneProposee.nom : (demande?.nom_etab || "Établissement")}</div>
        </div>

        <style>{`
          .fiche-labeled-marker { background: transparent !important; border: 0 !important; overflow: visible !important; width: auto !important; height: auto !important; }
          .fiche-labeled-marker > div { overflow: visible !important; }
        `}</style>

        {avecCapture && (
          <div className="absolute right-3 top-3 z-[1000] bg-white/90 border rounded px-2 py-1 text-base font-bold pointer-events-none" style={{ transform: `scale(${echelleTexte})`, transformOrigin: "top right" }}>
            N ↑
          </div>
        )}

        {!avecCapture && (
          <div className="absolute right-3 top-3 z-[1000] w-[230px] rounded-xl border border-border bg-card/95 backdrop-blur-sm shadow-lg">
            <button
              type="button"
              onClick={() => setPanneauOuvert(!panneauOuvert)}
              aria-expanded={panneauOuvert}
              className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left"
            >
              <span className="flex items-center gap-2 text-sm font-semibold leading-tight text-foreground">
                <Layers className="h-4 w-4 shrink-0 text-primary" />
                Choix de carte et délimitations
              </span>
              <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${panneauOuvert ? "rotate-180" : ""}`} />
            </button>

            {panneauOuvert && (
              <div className="border-t border-border px-3 py-2.5 space-y-2.5">
                <div className="space-y-1.5" role="radiogroup" aria-label="Fond de carte">
                  {FONDS_CARTE.map((f) => (
                    <label key={f.key} className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
                      <input
                        type="radio"
                        name="fond-carte-demande"
                        checked={fondKey === f.key}
                        onChange={() => setFondKey(f.key)}
                        className="h-3.5 w-3.5 accent-[#2f4a8a]"
                      />
                      {f.label}
                    </label>
                  ))}
                </div>

                <div className="border-t border-border pt-2.5">
                  <button
                    type="button"
                    onClick={() => setAfficherAnalyseSpatiale(!afficherAnalyseSpatiale)}
                    className={`flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                      afficherAnalyseSpatiale
                        ? "bg-[#2f4a8a] text-white hover:bg-[#1e3a8a]"
                        : "bg-card text-foreground hover:bg-muted/50 border border-border"
                    }`}
                  >
                    {afficherAnalyseSpatiale ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    {afficherAnalyseSpatiale ? "Masquer l'analyse spatiale" : "Afficher l'analyse spatiale"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div
          className="absolute left-3 bottom-3 z-[1000] bg-card/95 backdrop-blur-sm rounded-xl shadow-lg border border-border min-w-[220px] max-w-[280px] pointer-events-none"
          style={{ ...(avecCapture ? { transform: `scale(${echelleTexte})`, transformOrigin: "bottom left" } : {}) }}
        >
          <div className="px-3 py-2 border-b border-border bg-primary/5 rounded-t-xl">
            <h4 className="font-semibold text-xs text-foreground flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              Légende
            </h4>
          </div>

          <div className="p-2.5 space-y-1.5 text-[11px] leading-4 text-foreground">
            <div className="flex items-center gap-2"><SchoolGlyph color={COULEUR_ECOLE_NOUVELLE} size={14} /> Nouveau {niveauLabel}</div>
            <div className="flex items-center gap-2"><SchoolGlyph color={COULEUR_ECOLE_EXISTANTE} size={14} /> {niveauLabel} existant</div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ background: COULEUR_COUVERT }} />
              {niveauKey === "lycee" ? "CEG / village couvert (dans le rayon)" : niveauKey === "college" ? "EPP / village couvert (dans le rayon)" : "Village couvert (dans le rayon)"}
            </div>
            <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ background: COULEUR_HORS_ZONE }} /> Hors zone (hors du rayon)</div>

            {afficherAnalyseSpatiale && afficherAnneauxVoisins && (
              <div className="flex items-center gap-2 border-t border-border pt-1.5"><span className="inline-block w-3 h-3 rounded-full border border-dashed shrink-0" style={{ borderColor: COULEUR_RAYON }} /> Rayon réglementaire ({rayonLabel})</div>
            )}
            {afficherAnalyseSpatiale && afficherLignes && lignesAffichees.length > 0 && (
              <div className="flex items-center gap-2"><span className="inline-block w-3 h-1 shrink-0" style={{ background: COULEUR_LIGNE_INTERSECTION }} /> {voronoi ? `Frontières de Voronoi (${lignesAffichees.length})` : `Ligne d'intersection (${lignesAffichees.length})`}</div>
            )}

            {contourCommune && <div className="flex items-center gap-2 border-t border-border pt-1.5"><span className="inline-block h-3 w-4 shrink-0 border-2 bg-transparent" style={{ borderColor: STYLE_COMMUNE.color }} /> Limite de la commune</div>}
            {contourFokontany && <div className="flex items-center gap-2"><span className="inline-block h-3 w-4 shrink-0 border-2 border-dashed bg-transparent" style={{ borderColor: STYLE_FOKONTANY.color }} /> Limite du fokontany</div>}

            {zoneProposee && <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ background: COULEUR_ZONE_PROPOSEE }} /> Zone éligible proposée</div>}
            {villageNonEligible && !remplaceVillage && <div className="flex items-center gap-2"><FlagGlyph color={COULEUR_VILLAGE_NON_ELIGIBLE} size={14} /> Village non éligible</div>}
          </div>
        </div>
      </div>

      {!futurePosition && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div><strong> Les coordonnées GPS du nouvel établissement sont introuvables.</strong></div>
          </div>
        </div>
      )}
    </div>
  );
}

export { createLabeledMapIcon, SchoolGlyph, FlagGlyph };