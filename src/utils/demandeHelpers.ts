type MaybeRecord = Record<string, any> | null | undefined;

function firstArray(demande: MaybeRecord, keys: string[]) {
  if (!demande || typeof demande !== "object") return [];
  for (const key of keys) {
    const value = (demande as Record<string, any>)[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

export function niveauToKey(value: unknown) {
  const raw = String(value ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (!raw) return "autre";
  if (raw.includes("presco") || raw.includes("matern")) return "prescolaire";
  if (raw.includes("primaire") || raw.includes("epp")) return "primaire";
  if (raw.includes("college") || raw.includes("ceg")) return "college";
  if (raw.includes("lycee") || raw.includes("lycée")) return "lycee";
  return "autre";
}

export function premierNonVide(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    return value;
  }
  return null;
}

export function mapDemande(item: MaybeRecord) {
  if (!item || typeof item !== "object") return { id: 0, reference: "", nom_etab: "", niveau: "", type_demande: "", statut: "" };

  return {
    id: item.id_demande ?? item.id ?? 0,
    reference: item.reference ?? item.numero_demande ?? String(item.id_demande ?? item.id ?? ""),
    nom_etab: item.nom_etab ?? item.nom_etablissement ?? "—",
    niveau: item.niveau_etab ?? item.niveau ?? "—",
    type_demande: item.type_demande ?? "—",
    sous_type: item.sous_type ?? "",
    statut: item.statut_demande ?? item.statut ?? "En attente",
    commune: item.commune ?? item.nom_commune ?? "—",
    cisco: item.cisco ?? item.nom_cisco ?? "—",
  };
}

export function getEnseignantsAnalyse(demande: MaybeRecord) {
  return firstArray(demande, ["enseignants", "personnel_existant", "personnel"]);
}

export function getInfoComplementaireAnalyse(demande: MaybeRecord) {
  if (!demande || typeof demande !== "object") return {};
  return {
    ...(demande.info_complementaire ?? {}),
    ...(demande.information_complementaire_detail ?? {}),
  };
}

export function getEtablissementsProchesAnalyse(demande: MaybeRecord) {
  return firstArray(demande, [
    "etablissements_proches",
    "etablissements_proches_liste",
    "proximite",
    "etablissements_proximite",
  ]);
}

export function getAireRecrutementAnalyse(demande: MaybeRecord) {
  return firstArray(demande, [
    "aire_recrutement",
    "aires_recrutement",
    "zone_recrutement",
    "villages_alimentants",
    "ecoles_alimentantes",
    "etablissements_alimentants",
  ]);
}

export function getEvolutionEffectifsAnalyse(demande: MaybeRecord) {
  return firstArray(demande, ["evolution_effectifs", "evolutionEffectifs", "evolution"]);
}

export function getPiecesAnalyse(demande: MaybeRecord) {
  return firstArray(demande, ["pieces", "pieces_fournies"]);
}

export function calculerDernierEffectifConnu(demande: MaybeRecord) {
  const evolution = getEvolutionEffectifsAnalyse(demande);
  if (!Array.isArray(evolution) || evolution.length === 0) return 0;

  const last = evolution[evolution.length - 1] as Record<string, any> | undefined;
  const direct = Number(last?.effectif_total ?? last?.effectif ?? last?.total ?? 0);
  if (Number.isFinite(direct) && direct > 0) return direct;

  return 0;
}

export function getCodeProvisoireMen(demande: MaybeRecord) {
  return premierNonVide(
    demande?.code_etab,
    demande?.regularisation?.code_etablissement,
    demande?.etablissement_existant_id,
  ) ?? "";
}

export function getAccessibiliteSite(demande: MaybeRecord) {
  const info = getInfoComplementaireAnalyse(demande);
  if (typeof info?.accessibilite_site === "boolean") return info.accessibilite_site;
  if (typeof info?.accessibilite === "boolean") return info.accessibilite;
  return null;
}

export function getDistancePlusProche(demande: MaybeRecord) {
  const info = getInfoComplementaireAnalyse(demande);
  const direct = Number(info?.distance_plus_proche);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const proches = getEtablissementsProchesAnalyse(demande);
  if (!Array.isArray(proches) || proches.length === 0) return null;

  const distances = proches
    .map((item) => Number((item as Record<string, any>)?.distance_km ?? (item as Record<string, any>)?.distance ?? NaN))
    .filter((value) => Number.isFinite(value));

  return distances.length > 0 ? Math.min(...distances) : null;
}

export default {
  niveauToKey,
  mapDemande,
  getEnseignantsAnalyse,
  getInfoComplementaireAnalyse,
  getEtablissementsProchesAnalyse,
  getAireRecrutementAnalyse,
  getEvolutionEffectifsAnalyse,
  getPiecesAnalyse,
  calculerDernierEffectifConnu,
  getCodeProvisoireMen,
  getAccessibiliteSite,
  getDistancePlusProche,
  premierNonVide,
};
