import type { Etablissement, Village } from "@/hooks/useMapData";
import { AIRE_RECRUTEMENT_RADIUS, isPublicSecteur } from "./orsColors";

/**
 * ============================================================================
 *  NOUVELLE CRÉATION — mode de calcul unique (règles validées)
 * ============================================================================
 * Étapes (identiques pour les 3 niveaux, seul le critère change) :
 *   1. Appliquer l'aire de recrutement de chaque établissement EXISTANT du
 *      niveau (primaire 2 km, collège 5 km, lycée 20 km).
 *   2. Village HORS ZONE = village situé hors de TOUTES ces aires.
 *   3. Pour CHAQUE village hors zone (boucle), on pose une aire de même rayon
 *      centrée sur lui, puis :
 *        - Primaire : somme de la POPULATION des villages (hors zone) de l'aire
 *        - Collège  : somme des effectifs T5 des EPP de l'aire
 *        - Lycée    : somme des effectifs 3e des CEG de l'aire
 *      Si somme > seuil → le village centre est ÉLIGIBLE à la nouvelle création.
 *
 * Tous les seuils / rayons / champs lus sont PARAMÉTRABLES ci-dessous.
 */

export type NcNiveau = "primaire" | "college" | "lycee";

// ----------------------------------------------------------------------------
//  PARAMÈTRES MÉTIER (modifier ici uniquement)
// ----------------------------------------------------------------------------
/** Primaire : somme de population (villages) STRICTEMENT supérieure à ce seuil. */
export const NC_SEUIL_POPULATION_PRIMAIRE = 50;
/** Collège : somme des effectifs T5 des EPP STRICTEMENT supérieure à ce seuil. */
export const NC_SEUIL_EFFECTIF_T5_COLLEGE = 150;
/** Lycée : somme des effectifs 3e des CEG STRICTEMENT supérieure à ce seuil. */
export const NC_SEUIL_EFFECTIF_3E_LYCEE = 150;

export interface NcConfig {
  /** Rayon de l'aire de recrutement (mètres). */
  aireMeters: number;
  /** Seuil de comparaison (somme > seuil ⇒ éligible). */
  seuil: number;
  /** "population" = somme de villages ; "effectif" = somme d'effectifs d'établissements de référence. */
  critere: "population" | "effectif";
  /** Champs (dans l'ordre de priorité) lus sur les établissements de référence. */
  effectifKeys: string[];
  critereLabel: string;
  valeurUnite: string;
  /** Libellé de ce qu'on créerait ("école primaire", "CEG", "lycée"). */
  uniteCreation: string;
  /** Établissements privés comptés comme "existants" (couverture + affichage). */
  existantsPrives: boolean;
  /** Établissements privés comptés dans les effectifs de référence. */
  refsPrives: boolean;
  /** Primaire : villages sommés = "hors_zone" (défaut) ou "tous" les villages de l'aire. */
  satellites: "hors_zone" | "tous";
}

export const NC_CONFIG: Record<NcNiveau, NcConfig> = {
  primaire: {
    aireMeters: AIRE_RECRUTEMENT_RADIUS.primaire,
    seuil: NC_SEUIL_POPULATION_PRIMAIRE,
    critere: "population",
    effectifKeys: [],
    critereLabel: "Population cumulée des villages hors zone",
    valeurUnite: "habitants",
    uniteCreation: "école primaire",
    existantsPrives: false, // primaire : PUBLIC seulement
    refsPrives: false,
    satellites: "hors_zone",
  },
  college: {
    aireMeters: AIRE_RECRUTEMENT_RADIUS.college,
    seuil: NC_SEUIL_EFFECTIF_T5_COLLEGE,
    critere: "effectif",
    effectifKeys: ["eff_t5"],
    critereLabel: "Effectif T5 cumulé des EPP",
    valeurUnite: "élèves T5",
    uniteCreation: "CEG",
    existantsPrives: true, // collège : PUBLIC + PRIVÉ
    refsPrives: true,
    satellites: "hors_zone",
  },
  lycee: {
    aireMeters: AIRE_RECRUTEMENT_RADIUS.lycee,
    seuil: NC_SEUIL_EFFECTIF_3E_LYCEE,
    critere: "effectif",
    // La vue de référence des CEG expose eff_t9 (classe terminale du collège).
    effectifKeys: ["eff_t9"],
    critereLabel: "Effectif 3e cumulé des CEG",
    valeurUnite: "élèves 3e",
    uniteCreation: "lycée",
    existantsPrives: true, // lycée : PUBLIC + PRIVÉ
    refsPrives: true,
    satellites: "hors_zone",
  },
};

// ----------------------------------------------------------------------------
//  Utilitaires
// ----------------------------------------------------------------------------
const toNum = (x: unknown): number => {
  if (x === null || x === undefined || x === "") return Number.NaN;
  if (typeof x === "number") return x;
  return Number(String(x).trim().replace(",", "."));
};

/** Coordonnées valides ou null (NaN, vide, ou 0/0 écartés). */
export const getCoords = (o: {
  latitude?: unknown;
  longitude?: unknown;
}): { lat: number; lng: number } | null => {
  const lat = toNum(o.latitude);
  const lng = toNum(o.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
};

const EARTH_KM = 6371.0088;
export const isWithinRecruitmentRadius = (distanceKm: number, radiusKm: number): boolean =>
  distanceKm <= radiusKm;

const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
};

/** Garde les établissements publics (+ privés si autorisé). Même liste si privés autorisés. */
export function filtrerSecteur<T extends { SECTEUR?: unknown }>(
  list: T[],
  allowPrive: boolean,
): T[] {
  return allowPrive ? list : list.filter((e) => isPublicSecteur(e));
}

interface GridEntry<T> {
  item: T;
  lat: number;
  lng: number;
}

/** Grille spatiale (cellules en km) + filtre exact haversine. */
class KmGrid<T> {
  private readonly cells = new Map<string, GridEntry<T>[]>();
  private readonly cellKm: number;
  private readonly kx: number;
  private static readonly KY = 110.574;

  constructor(entries: GridEntry<T>[], radiusKm: number) {
    this.cellKm = Math.max(radiusKm, 0.001) * 1.1;
    const latRef = entries.length ? entries.reduce((s, e) => s + e.lat, 0) / entries.length : 0;
    this.kx = 111.32 * Math.cos((latRef * Math.PI) / 180);
    for (const e of entries) {
      const k = `${this.cx(e.lng)}|${this.cy(e.lat)}`;
      const bucket = this.cells.get(k);
      if (bucket) bucket.push(e);
      else this.cells.set(k, [e]);
    }
  }

  private cx(lng: number) {
    return Math.floor((lng * this.kx) / this.cellKm);
  }
  private cy(lat: number) {
    return Math.floor((lat * KmGrid.KY) / this.cellKm);
  }

  within(lat: number, lng: number, radiusKm: number): Array<GridEntry<T> & { distanceKm: number }> {
    const cx = this.cx(lng);
    const cy = this.cy(lat);
    const out: Array<GridEntry<T> & { distanceKm: number }> = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = this.cells.get(`${cx + dx}|${cy + dy}`);
        if (!bucket) continue;
        for (const e of bucket) {
          const d = haversineKm(lat, lng, e.lat, e.lng);
          if (isWithinRecruitmentRadius(d, radiusKm)) out.push({ ...e, distanceKm: d });
        }
      }
    }
    return out;
  }
}

// ----------------------------------------------------------------------------
//  Types de résultat
// ----------------------------------------------------------------------------
export interface NcVillageResult {
  village: Village;
  lat: number;
  lng: number;
  population: number;
  /** Hors de toutes les aires des établissements existants. */
  horsZone: boolean;
  nbExistantsDansAire: number;
  /** Établissement retenu par proximité; les effectifs ne départagent que les ex æquo exacts. */
  etablissementAttribue: Etablissement | null;
  /** Distance de l'existant le plus proche, UNIQUEMENT s'il est dans l'aire (sinon null). */
  distExistantKm: number | null;
  /** Somme (population ou effectifs) dans l'aire centrée sur le village — 0 si village couvert. */
  total: number;
  nbContributeurs: number;
  eligible: boolean;
}

export interface NcStats {
  villagesTotal: number;
  couverts: number;
  horsZone: number;
  eligibles: number;
  /** Tout village non éligible (couverts + hors zone insuffisants). */
  nonEligibles: number;
}

export interface VillageAnalysisResult {
  village: { name: string; population: number; lat: number; lng: number };
  niveau: NcNiveau;
  uniteCreation: string;
  horsZone: boolean;
  critereLabel: string;
  valeurUnite: string;
  total: number;
  seuil: number;
  existantsDansAire: Array<{ name: string; distanceKm: number; lat: number; lng: number }>;
  contributeurs: Array<{
    name: string;
    value: number;
    distanceKm: number;
    lat: number;
    lng: number;
    isCentre: boolean;
  }>;
  eligible: boolean;
  reason: string;
  radiusMeters: number;
}

export interface NcAnalysis {
  niveau: NcNiveau;
  config: NcConfig;
  results: NcVillageResult[];
  byVillage: Map<Village, NcVillageResult>;
  stats: NcStats;
  /** Établissements de référence (collège/lycée) sans effectif renseigné (comptés 0). */
  refsSansDonnee: number;
  refsTotal: number;
  detail: (village: Village) => {
    existants: VillageAnalysisResult["existantsDansAire"];
    contributeurs: VillageAnalysisResult["contributeurs"];
  } | null;
}

interface Contrib {
  ref: unknown;
  name: string;
  value: number;
}

/** Sélectionne le plus proche dans le rayon; effectifs puis code servent uniquement aux ex æquo exacts. */
export function choisirEtablissementAttribue<T extends Etablissement>(
  candidats: Array<GridEntry<T> & { distanceKm: number }>,
): (GridEntry<T> & { distanceKm: number }) | null {
  if (!candidats.length) return null;
  return candidats.reduce((best, candidate) => {
    if (candidate.distanceKm < best.distanceKm) return candidate;
    if (candidate.distanceKm > best.distanceKm) return best;

    const effectif = (item: T) => {
      const record = item as unknown as Record<string, unknown>;
      for (const key of ["effectifs", "eff_total", "eff_2025", "eff_2024", "eff_2023", "eff_2022"]) {
        const value = toNum(record[key]);
        if (Number.isFinite(value)) return value;
      }
      return Number.NEGATIVE_INFINITY;
    };
    const candidateEffectif = effectif(candidate.item);
    const bestEffectif = effectif(best.item);
    if (candidateEffectif > bestEffectif) return candidate;
    if (candidateEffectif < bestEffectif) return best;

    const codeComparison = String(candidate.item.CODE_ETAB).localeCompare(String(best.item.CODE_ETAB), "fr", { numeric: true });
    if (codeComparison < 0) return candidate;
    if (codeComparison > 0) return best;
    const nameComparison = String(candidate.item.NOM_ETAB ?? "").localeCompare(String(best.item.NOM_ETAB ?? ""), "fr");
    return nameComparison < 0 ? candidate : best;
  });
}

const fmt = (n: number) => n.toLocaleString("fr-FR");

export function describeResult(r: NcVillageResult, cfg: NcConfig): string {
  const km = cfg.aireMeters / 1000;
  if (!r.horsZone) {
    return `Village couvert : ${r.nbExistantsDansAire} établissement(s) existant(s) dans l'aire de ${km} km.`;
  }
  if (r.eligible) {
    return `Critère rempli : ${cfg.critereLabel.toLowerCase()} = ${fmt(r.total)} > seuil ${fmt(cfg.seuil)} (aire ${km} km).`;
  }
  return `Village hors zone mais ${cfg.critereLabel.toLowerCase()} = ${fmt(r.total)} ≤ seuil ${fmt(cfg.seuil)} (aire ${km} km).`;
}

// ----------------------------------------------------------------------------
//  Calcul principal
// ----------------------------------------------------------------------------
export function analyserNouvelleCreation(params: {
  niveau: NcNiveau;
  /** Établissements existants du niveau (CEG pour collège, lycées pour lycée…). */
  existants: Etablissement[];
  /** Établissements de référence (EPP pour collège, CEG pour lycée) — [] pour primaire. */
  refs: Etablissement[];
  villages: Village[];
  /** Surcharge ponctuelle des paramètres (seuil, rayon, champs…). */
  config?: Partial<NcConfig>;
}): NcAnalysis {
  const { niveau, villages } = params;
  const cfg: NcConfig = { ...NC_CONFIG[niveau], ...(params.config ?? {}) };
  const aireKm = cfg.aireMeters / 1000;

  // --- Étape 1 : aires des établissements existants -------------------------
  const existantsPts: GridEntry<Etablissement>[] = [];
  for (const e of filtrerSecteur(params.existants, cfg.existantsPrives)) {
    const c = getCoords(e);
    if (c) existantsPts.push({ item: e, ...c });
  }
  const gridExistants = new KmGrid(existantsPts, aireKm);

  const villagesPts: GridEntry<Village>[] = [];
  for (const v of villages) {
    const c = getCoords(v);
    if (c) villagesPts.push({ item: v, ...c });
  }

  // --- Étape 2 : villages hors zone ----------------------------------------
  const couverture = new Map<Village, {
    count: number;
    nearest: number | null;
    assigned: Etablissement | null;
  }>();
  const horsZoneEntries: GridEntry<Village>[] = [];
  for (const p of villagesPts) {
    const near = gridExistants.within(p.lat, p.lng, aireKm);
    const assigned = choisirEtablissementAttribue(near);
    const nearest = assigned?.distanceKm ?? null;
    couverture.set(p.item, { count: near.length, nearest, assigned: assigned?.item ?? null });
    if (near.length === 0) horsZoneEntries.push(p);
  }

  // --- Étape 3 : contributeurs (population ou effectifs) -------------------
  let refsSansDonnee = 0;
  let refsTotal = 0;
  const contribEntries: GridEntry<Contrib>[] = [];

  if (cfg.critere === "population") {
    const source = cfg.satellites === "hors_zone" ? horsZoneEntries : villagesPts;
    for (const p of source) {
      const pop = toNum(p.item.population);
      contribEntries.push({
        item: { ref: p.item, name: p.item.name ?? "Village", value: Number.isFinite(pop) ? pop : 0 },
        lat: p.lat,
        lng: p.lng,
      });
    }
  } else {
    for (const e of filtrerSecteur(params.refs, cfg.refsPrives)) {
      const c = getCoords(e);
      if (!c) continue;
      refsTotal++;
      const rec = e as unknown as Record<string, unknown>;
      let value: number | null = null;
      for (const key of cfg.effectifKeys) {
        const n = toNum(rec[key]);
        if (Number.isFinite(n)) {
          value = n;
          break;
        }
      }
      if (value === null) refsSansDonnee++;
      contribEntries.push({
        item: { ref: e, name: e.NOM_ETAB || "Inconnu", value: value ?? 0 },
        ...c,
      });
    }
  }
  const gridContrib = new KmGrid(contribEntries, aireKm);

  // --- Boucle : action A pour CHAQUE village (hors zone) -------------------
  const results: NcVillageResult[] = [];
  const byVillage = new Map<Village, NcVillageResult>();
  for (const p of villagesPts) {
    const cov = couverture.get(p.item)!;
    const horsZone = cov.count === 0;
    let total = 0;
    let nb = 0;
    if (horsZone) {
      const near = gridContrib.within(p.lat, p.lng, aireKm);
      nb = near.length;
      total = near.reduce((s, n) => s + n.item.value, 0);
    }
    const pop = toNum(p.item.population);
    const r: NcVillageResult = {
      village: p.item,
      lat: p.lat,
      lng: p.lng,
      population: Number.isFinite(pop) ? pop : 0,
      horsZone,
      nbExistantsDansAire: cov.count,
      etablissementAttribue: cov.assigned,
      distExistantKm: cov.nearest,
      total,
      nbContributeurs: nb,
      eligible: horsZone && total > cfg.seuil,
    };
    results.push(r);
    byVillage.set(p.item, r);
  }

  const horsZoneCount = results.filter((r) => r.horsZone).length;
  const eligibles = results.filter((r) => r.eligible).length;

  return {
    niveau,
    config: cfg,
    results,
    byVillage,
    stats: {
      villagesTotal: results.length,
      couverts: results.length - horsZoneCount,
      horsZone: horsZoneCount,
      eligibles,
      nonEligibles: results.length - eligibles,
    },
    refsSansDonnee,
    refsTotal,
    detail: (village) => {
      const r = byVillage.get(village);
      if (!r) return null;
      const existants = gridExistants
        .within(r.lat, r.lng, aireKm)
        .map((n) => ({
          name: n.item.NOM_ETAB || "Inconnu",
          distanceKm: n.distanceKm,
          lat: n.lat,
          lng: n.lng,
        }))
        .sort((a, b) => a.distanceKm - b.distanceKm);
      const contributeurs = r.horsZone
        ? gridContrib
            .within(r.lat, r.lng, aireKm)
            .map((n) => ({
              name: n.item.name,
              value: n.item.value,
              distanceKm: n.distanceKm,
              lat: n.lat,
              lng: n.lng,
              isCentre: n.item.ref === village,
            }))
            .sort((a, b) => a.distanceKm - b.distanceKm)
        : [];
      return { existants, contributeurs };
    },
  };
}

/** Résultat détaillé d'un village pour la fenêtre d'analyse (clic droit). */
export function analyseVillage(nc: NcAnalysis, village: Village): VillageAnalysisResult | null {
  const r = nc.byVillage.get(village);
  const d = nc.detail(village);
  if (!r || !d) return null;
  return {
    village: { name: village.name ?? "Village", population: r.population, lat: r.lat, lng: r.lng },
    niveau: nc.niveau,
    uniteCreation: nc.config.uniteCreation,
    horsZone: r.horsZone,
    critereLabel: nc.config.critereLabel,
    valeurUnite: nc.config.valeurUnite,
    total: r.total,
    seuil: nc.config.seuil,
    existantsDansAire: d.existants,
    contributeurs: d.contributeurs,
    eligible: r.eligible,
    reason: describeResult(r, nc.config),
    radiusMeters: nc.config.aireMeters,
  };
}
