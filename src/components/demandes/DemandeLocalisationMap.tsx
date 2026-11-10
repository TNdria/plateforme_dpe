// @ts-nocheck
import { Fragment, useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, Polygon, Polyline, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { AlertTriangle } from "lucide-react";

import {
  getLocalisationValue, getPosition, getNomAireItem,
  normaliserAireItem, niveauToKey, mapNiveau,
  getRayonCarteKm, getRayonRecrutementKm, getDistanceKmItem,
  estDansRayonAnalyse, estEtablissementNiveau, normaliserNiveauItem,
  extraireContour, calculerMaxBounds, getEtablissementsProchesAnalyse,
  getVillageNonEligible, getZoneProposee, getPointsNouvelleCreation,
} from "@/utils/demandeHelpers";

const escapeMapText = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
}[c] || c));

export const COULEUR_ECOLE_NOUVELLE = "#facc15";
export const COULEUR_ECOLE_EXISTANTE = "#1d8fd1";
export const COULEUR_COUVERT = "#8a8a8a";
export const COULEUR_HORS_ZONE = "#e53935";
export const COULEUR_RAYON = "#1f2937";
export const COULEUR_LIGNE_INTERSECTION = "#000000";
export const COULEUR_VILLAGE_NON_ELIGIBLE = "#dc2626";
export const COULEUR_ZONE_PROPOSEE = "#16a34a";

const calculerLignesIntersection = (centres, rKm) => {
  if (!Array.isArray(centres) || centres.length < 2 || !(rKm > 0)) return [];

  const KM_PAR_DEG_LAT = 110.574;
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

        if (fa < 0) {
          t0 = Math.max(t0, fa / (fa - fb));
        } else if (fb < 0) {
          t1 = Math.min(t1, fa / (fa - fb));
        }
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

  const glyph =
    shape === "school"
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${sz}" height="${sz}"
           style="position:absolute;left:0;top:${iconTop}px;z-index:2;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.45));">
           <path d="M12 2 1.5 10h21z" fill="${background}"/>
           <rect x="3.5" y="10" width="17" height="11" fill="${background}"/>
           <rect x="10" y="14" width="4" height="7" fill="#ffffff"/>
           <rect x="5.5" y="12.5" width="3" height="3" fill="#ffffff"/>
           <rect x="15.5" y="12.5" width="3" height="3" fill="#ffffff"/>
         </svg>`
      : shape === "flag"
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${sz}" height="${sz}"
           style="position:absolute;left:0;top:${iconTop}px;z-index:2;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.45));">
           <path d="M5 2 L5 22" stroke="${background}" stroke-width="2.5" stroke-linecap="round"/>
           <path d="M5 3 L19 3 L15 8 L19 13 L5 13 Z" fill="${background}"/>
         </svg>`
      : shape === "none"
      ? ""
      : `<div style="position:absolute;left:0;top:${iconTop}px;width:${sz}px;height:${sz}px;
           border-radius:50%;background:${background};
           box-shadow:0 1px 2px rgba(0,0,0,.45);z-index:2;"></div>`;

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

function SuivreVue({ vueRef }) {
  const map = useMap();
  useEffect(() => {
    const enregistrer = () => {
      const c = map.getCenter();
      const s = map.getSize();
      vueRef.current = { center: [c.lat, c.lng], zoom: map.getZoom(), size: { x: s.x, y: s.y } };
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
  }, [map, vueRef]);
  return null;
}

function SuivreZoom({ onZoomChange }) {
  const map = useMap();
  useEffect(() => {
    const maj = () => onZoomChange(map.getZoom());
    maj();
    map.on("zoomend", maj);
    return () => { map.off("zoomend", maj); };
  }, [map, onZoomChange]);
  return null;
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
}) {
  const [zoomCourant, setZoomCourant] = useState(null);

  const niveauKey = niveauToKey(demande?.niveau_etab || demande?.niveau);
  const niveauLabel = mapNiveau(demande?.niveau_etab || demande?.niveau);
  const rayonCarte = getRayonCarteKm(niveauKey);
  const futurePosition = getPosition(demande);

  const pointsNouvelleCreation = useMemo(
    () => getPointsNouvelleCreation(demande),
    [demande]
  );
  const villageNonEligible = pointsNouvelleCreation.villageNonEligible;
  const zoneProposee = pointsNouvelleCreation.zoneProposee;
  const remplaceVillage = pointsNouvelleCreation.remplaceVillage;

  const prochesEffectifs = (Array.isArray(etablissementsProches) && etablissementsProches.length > 0)
    ? etablissementsProches
    : getEtablissementsProchesAnalyse(demande);

  const echelleTexte = avecCapture
    ? Math.max(0.5, (captureSize?.w ?? 1160) / LARGEUR_REFERENCE_PX)
    : 1;
  const k = echelleTexte;
  const poids = (n) => (avecCapture ? n * k : n);
  const tirets = (s) => (avecCapture ? s.split(" ").map((x) => Number(x) * k).join(" ") : s);

  const vueFigee =
    avecCapture &&
    (!vueInitiale || (vueInitiale?.center && Number.isFinite(vueInitiale?.zoom)));

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

  const nearbySource = candidatsProximite.filter((item) =>
    estDansRayonAnalyse(item, futurePosition, rayonCarte)
  );

  const recrutementAvecCoord = recrutement.filter((item) => Boolean(getPosition(item)));
  const nearby = withPosition(nearbySource);
  const feedersBruts = withPosition(recrutementAvecCoord);

  const feeders = futurePosition
    ? feedersBruts.filter(({ position }) => {
        const [latF, lngF] = position;
        const [latN, lngN] = futurePosition;
        const memeLat = Math.abs(latF - latN) < 0.0001;
        const memeLng = Math.abs(lngF - lngN) < 0.0001;
        return !(memeLat && memeLng);
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

  const lignesIntersection = useMemo(() => {
    if (masquerAireVoisins) return [];

    const centres = [];

    if (futurePosition) {
      centres.push({
        pos: futurePosition,
        nom: demande?.nom_etab || "Nouvel établissement",
      });
    }

    nearby.forEach(({ item, position }) => {
      centres.push({ pos: position, nom: getNomAireItem(item) });
    });

    return calculerLignesIntersection(centres, rayonNormeKm);
  }, [
    masquerAireVoisins,
    futurePosition ? futurePosition.join(",") : "",
    nearby.map(({ position }) => position.join(",")).join("|"),
    rayonNormeKm,
    demande?.nom_etab,
  ]);

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
    if (!masquerAireVoisins) {
      voisins.forEach(({ position }) => {
        const [la, lo] = position;
        const dLat = rayonNormeKm / 111;
        const dLng = rayonNormeKm / (111 * Math.max(0.2, Math.cos((la * Math.PI) / 180)));
        cerclesVoisins.push([la - dLat, lo - dLng], [la + dLat, lo + dLng]);
      });
    }

    const pointsVillageNonEligible = villageNonEligible
      ? [[villageNonEligible.latitude, villageNonEligible.longitude]]
      : [];
    const pointsZoneProposee = zoneProposee
      ? [[zoneProposee.latitude, zoneProposee.longitude]]
      : [];

    return [
      ...(futurePosition ? [futurePosition] : []),
      ...nearbyPoints,
      ...feederPoints,
      ...cercle,
      ...cerclesVoisins,
      ...pointsVillageNonEligible,
      ...pointsZoneProposee,
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

  const afficherFuturePosition = Boolean(futurePosition) && !remplaceVillage;

  return (
    <div className="space-y-3">
      <div
        ref={mapRef}
        data-capture-carte={avecCapture ? "true" : undefined}
        className="rounded-lg border overflow-hidden relative"
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
          zoomControl={!avecCapture}
          zoomAnimation={!avecCapture}
          fadeAnimation={!avecCapture}
          markerZoomAnimation={!avecCapture}
          style={{ height: avecCapture ? `${(captureSize?.h ?? 500)}px` : "500px", width: "100%" }}
          attributionControl={!avecCapture}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            crossOrigin="anonymous"
          />
          {!avecCapture && !vueFigee && <RecenterMap points={pointsPourCadrage} />}
          {mapInstanceRef && <ExposerCarte instanceRef={mapInstanceRef} />}
          {!avecCapture && vueRef && <SuivreVue vueRef={vueRef} />}
          {!avecCapture && <ForceMinZoom minZoom={minZoomCarte} />}
          {!avecCapture && <SuivreZoom onZoomChange={setZoomCourant} />}

          {contourCommune && contourCommune.length >= 3 && (
            <Polygon
              positions={contourCommune}
              pathOptions={{ color: "#1e3a8a", weight: poids(3), opacity: 0.9, fillColor: "#3b82f6", fillOpacity: 0.08 }}
            >
              <Tooltip sticky><strong>Commune : {nomCommune}</strong></Tooltip>
            </Polygon>
          )}

          {contourFokontany && contourFokontany.length >= 3 && (
            <Polygon
              positions={contourFokontany}
              pathOptions={{ color: "#7c3aed", fillColor: "#ede9fe", fillOpacity: 0.10, weight: poids(2.5), dashArray: tirets("6 4") }}
            >
              <Tooltip sticky><strong>Fokontany : {nomFokontany}</strong></Tooltip>
            </Polygon>
          )}

          {voisins.map(({ item, position, points }, index) => (
            <Fragment key={`voisin-zone-${index}`}>
              {!masquerAireVoisins && (
                <Circle
                  center={position}
                  radius={rayonNorme}
                  pathOptions={{ color: COULEUR_RAYON, weight: poids(1.6), opacity: 0.9, dashArray: tirets("8 6"), fill: false, fillOpacity: 0 }}
                >
                  <Tooltip sticky><strong>Rayon réglementaire ({rayonLabel}) : {getNomAireItem(item)}</strong></Tooltip>
                </Circle>
              )}

              {!masquerAireVoisins && points.map((pt, i) => {
                const nomLieu =
                  pt.info?.nom_inferieur ||
                  pt.info?.nom_village ||
                  pt.info?.nom ||
                  pt.info?.nom_etab ||
                  "Point";
                return (
                  <Marker
                    key={`voisin-pt-${index}-${i}`}
                    position={pt.pos}
                    zIndexOffset={50}
                    icon={createLabeledMapIcon(
                      COULEUR_COUVERT, null, "",
                      nomLieu,
                      "", 5, 180, "dot",
                      avecCapture, echelleTexte
                    )}
                  >
                    <Tooltip direction="top">
                      <div className="text-xs">
                        <strong>{nomLieu}</strong><br />
                        Aire de : {getNomAireItem(item)}<br />
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
              pathOptions={{ color: COULEUR_RAYON, weight: poids(1.6), opacity: 0.9, dashArray: tirets("8 6"), fill: false, fillOpacity: 0 }}
            >
              <Tooltip sticky><strong>Rayon réglementaire : {rayonLabel}</strong></Tooltip>
            </Circle>
          )}

          {!masquerAireVoisins && lignesIntersection.map((ligne, index) => (
            <Polyline
              key={`intersection-${index}`}
              positions={ligne.positions}
              pathOptions={{ color: COULEUR_LIGNE_INTERSECTION, weight: poids(2), opacity: 0.9 }}
            >
              <Tooltip sticky>
                <strong>Ligne d'intersection</strong><br />
                {ligne.noms[0]} ↔ {ligne.noms[1]}
              </Tooltip>
            </Polyline>
          ))}

          {/* ✅ Marqueur principal (nouvel établissement) */}
          {afficherFuturePosition && (
            <Marker
              position={futurePosition}
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
                <div className="space-y-1 min-w-[230px]">
                  <div className="font-bold text-amber-600">Nouvel établissement</div>
                  <div><strong>Nom :</strong> {demande?.nom_etab || "—"}</div>
                  <div><strong>Niveau :</strong> {niveauLabel}</div>
                  <div><strong>Village :</strong> {getLocalisationValue(demande, "village")}</div>
                  <div><strong>Fokontany :</strong> {getLocalisationValue(demande, "fokontany")}</div>
                  <div><strong>Commune :</strong> {getLocalisationValue(demande, "commune")}</div>
                  <div><strong>CISCO :</strong> {getLocalisationValue(demande, "cisco")}</div>
                </div>
              </Popup>
            </Marker>
          )}

          {/* ✅ Zone proposée (point vert — petite taille "12" comme les autres points) */}
          {zoneProposee && (
            <Marker
              position={[zoneProposee.latitude, zoneProposee.longitude]}
              zIndexOffset={1000}
              icon={createLabeledMapIcon(
                COULEUR_ZONE_PROPOSEE, null, "",
                zoneProposee.nom || `Zone proposée (${demande?.nom_etab || "Nouvel établissement"})`,
                remplaceVillage ? "Zone éligible (remplace le village)" : "Zone éligible proposée",
                12, 280, "dot", avecCapture, echelleTexte,
                true
              )}
            >
              <Popup>
                <div className="space-y-1 min-w-[230px]">
                  <div className="font-bold text-green-700">Zone éligible proposée</div>
                  <div><strong>Nom :</strong> {zoneProposee.nom || "— (sans nom)"}</div>
                  <div><strong>Fokontany :</strong> {zoneProposee.fokontany || "—"}</div>
                  <div><strong>Commune :</strong> {zoneProposee.commune || "—"}</div>
                  {remplaceVillage && (
                    <div className="text-xs text-green-700 font-semibold pt-1 border-t">
                      Cette zone remplace le village non éligible.
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          )}

          {/* ✅ Village non éligible (drapeau rouge) */}
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
                <div className="space-y-1 min-w-[230px]">
                  <div className="font-bold text-red-600">Village non éligible</div>
                  <div><strong>Nom :</strong> {villageNonEligible.nom || "—"}</div>
                  <div><strong>Fokontany :</strong> {villageNonEligible.fokontany || "—"}</div>
                  <div><strong>Commune :</strong> {villageNonEligible.commune || "—"}</div>
                </div>
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
                  <div className="space-y-1 min-w-[230px]">
                    <div className="font-bold text-blue-700">Établissement existant</div>
                    <div><strong>Nom :</strong> {getNomAireItem(item)}</div>
                    <div><strong>Fokontany :</strong> {item?.fokontany ?? "—"}</div>
                    <div><strong>Commune :</strong> {item?.commune ?? demandeContext.commune}</div>
                    <div><strong>Distance :</strong> {item?.distance_km ?? item?.distance ?? "—"} km</div>
                    <div><strong>Effectif :</strong> {item?.effectif ?? item?.effectif_total ?? "—"}</div>
                    <div><strong>Aire de recrutement :</strong> {Array.isArray(item?.aire_recrutement) ? item.aire_recrutement.length : 0}</div>
                    <div className={hors ? "font-bold text-red-600" : "font-bold text-green-700"}>
                      {hors ? `Hors du rayon (> ${rayonLabel})` : `Dans le rayon (≤ ${rayonLabel})`}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {feeders.map(({ item, position }, index) => {
            const isSchool = niveauKey === "college" || niveauKey === "lycee";
            const label = getMapPointLabel(item, niveauKey, "alimentant", demandeContext);
            const hors = estHorsRayon(item);
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
                  <div className="space-y-1 min-w-[240px]">
                    <div className="font-bold text-gray-700">
                      {isSchool ? "École alimentante" : "Village alimentant"}
                    </div>
                    <div><strong>Nom :</strong> {getNomAireItem(item)}</div>
                    <div><strong>Fokontany :</strong> {item?.fokontany ?? "—"}</div>
                    <div><strong>Commune :</strong> {item?.commune ?? demandeContext.commune}</div>
                    {niveauKey === "college" && (
                      <div><strong>Effectif T5 :</strong> {item?.effectif_t5 ?? item?.effectif ?? "—"}</div>
                    )}
                    {niveauKey === "lycee" && (
                      <div><strong>Effectif T9 :</strong> {item?.effectif_t9 ?? item?.effectif ?? "—"}</div>
                    )}
                    {(niveauKey === "primaire" || niveauKey === "prescolaire") && (
                      <>
                        <div><strong>Population :</strong> {item?.population ?? "—"}</div>
                        <div><strong>Population scolarisable :</strong> {item?.population_scolarisable ?? "—"}</div>
                      </>
                    )}
                    <div><strong>Distance :</strong> {item?.distance_future ?? item?.distance_km ?? item?.distance ?? "—"} km</div>
                    <div className={hors ? "font-bold text-red-600" : "font-bold text-green-700"}>
                      {hors ? `Hors du rayon (> ${rayonLabel})` : `Dans le rayon (≤ ${rayonLabel})`}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        <div
          className="absolute left-3 top-3 z-[1000] bg-white/95 border border-slate-700 px-3 py-1.5 shadow-sm text-center"
          style={{
            pointerEvents: "none",
            ...(avecCapture ? { transform: `scale(${echelleTexte})`, transformOrigin: "top left" } : {}),
          }}
        >
          <div className="text-xs md:text-sm font-black uppercase leading-tight">
            Analyse spatiale de l'implantation du nouveau {niveauLabel}
          </div>
          <div className="text-[11px] md:text-xs font-bold uppercase">
            {zoneProposee && zoneProposee.aUnNom
              ? zoneProposee.nom
              : (demande?.nom_etab || "Établissement")}
          </div>
        </div>

        <style>{`
          .fiche-labeled-marker { background: transparent !important; border: 0 !important; overflow: visible !important; width: auto !important; height: auto !important; }
          .fiche-labeled-marker > div { overflow: visible !important; }
        `}</style>

        <div
          className="absolute right-3 top-3 z-[1000] bg-white/90 border rounded px-2 py-1 text-base font-bold"
          style={{
            pointerEvents: "none",
            ...(avecCapture ? { transform: `scale(${echelleTexte})`, transformOrigin: "top right" } : {}),
          }}
        >
          N ↑
        </div>

        {!avecCapture && zoomCourant != null && (
          <div
            className="absolute right-3 top-12 z-[1000] bg-white/95 border border-slate-700 rounded px-2 py-1 text-xs font-bold text-slate-900 shadow-sm"
            style={{ pointerEvents: "none" }}
          >
            Zoom {zoomCourant}×
          </div>
        )}

        <div
          className="absolute left-3 bottom-3 z-[1000] bg-white/96 border border-slate-500 rounded p-2 text-[10px] leading-4 shadow-md min-w-[220px]"
          style={{
            pointerEvents: "none",
            ...(avecCapture
              ? { transform: `scale(${echelleTexte})`, transformOrigin: "bottom left" }
              : {}),
          }}
        >
          <div className="font-bold mb-1 text-slate-900 text-[11px]">Légende</div>
          <div className="flex items-center gap-1.5">
            <SchoolGlyph color={COULEUR_ECOLE_NOUVELLE} size={14} />
            Nouveau {niveauLabel}
          </div>
          <div className="flex items-center gap-1.5">
            <SchoolGlyph color={COULEUR_ECOLE_EXISTANTE} size={14} />
            {niveauLabel} existant
          </div>

          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: COULEUR_COUVERT }} />
            {niveauKey === "lycee"
              ? "CEG / village couvert (dans le rayon)"
              : niveauKey === "college"
              ? "EPP / village couvert (dans le rayon)"
              : "Village couvert (dans le rayon)"}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: COULEUR_HORS_ZONE }} />
            Hors zone (hors du rayon)
          </div>

          {!masquerAireVoisins && (
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full border border-dashed" style={{ borderColor: COULEUR_RAYON }} />
              Rayon réglementaire ({rayonLabel})
            </div>
          )}
          {!masquerAireVoisins && lignesIntersection.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-1" style={{ background: COULEUR_LIGNE_INTERSECTION }} />
              Ligne d'intersection ({lignesIntersection.length})
            </div>
          )}
          {contourCommune && (
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-3 border-2 border-blue-900 bg-blue-100/40" />
              Limite de la commune
            </div>
          )}
          {contourFokontany && (
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-3 border-2 border-violet-600 border-dashed bg-violet-100/40" />
              Limite du fokontany
            </div>
          )}

          {zoneProposee && (
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: COULEUR_ZONE_PROPOSEE }} />
              Zone éligible proposée{zoneProposee.aUnNom ? " (remplace le village)" : ""}
            </div>
          )}
          {villageNonEligible && !remplaceVillage && (
            <div className="flex items-center gap-1.5">
              <FlagGlyph color={COULEUR_VILLAGE_NON_ELIGIBLE} size={14} />
              Village non éligible
            </div>
          )}
        </div>
      </div>

      {!futurePosition && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <strong> Les coordonnées GPS du nouvel établissement sont introuvables.</strong>
            </div>
          </div>
        </div>
      )}

      {/* ❌ Bandeau d'information vert SUPPRIMÉ (demandé) */}
    </div>
  );
}

export { createLabeledMapIcon, SchoolGlyph, FlagGlyph };