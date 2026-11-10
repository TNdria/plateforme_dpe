// @ts-nocheck
import L from "leaflet";

// ============================================================
// HELPERS GÉNÉRIQUES
// ============================================================

export const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const n = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export const toNum = (v) => {
  const n = toNumber(v);
  return n === null ? 0 : n;
};

export const firstArray = (demande, keys) => {
  for (const k of keys) {
    if (Array.isArray(demande?.[k])) return demande[k];
  }
  return [];
};

export const normaliserTexte = (v) =>
  String(v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export const mapNiveau = (n) => {
  if (!n) return "—";
  const s = String(n).trim();
  if (["Préscolaire", "Primaire", "Collège", "Lycée"].includes(s)) return s;
  return NIVEAU_LABELS[s.toLowerCase()] || s;
};

export const niveauToKey = (n) => {
  const s = String(n || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (s.startsWith("presco") || s.startsWith("matern") || s.includes("maternel")) {
    return "prescolaire";
  }
  if (s.startsWith("lyc")) return "lycee";
  if (s.startsWith("col") || s.startsWith("ceg")) return "college";
  if (s.startsWith("prim") || s.startsWith("epp")) return "primaire";

  return "primaire";
};

export const formatDate = (v) => {
  if (!v) return "—";
  if (typeof v === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(v)) return v;
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  } catch { return String(v); }
};

export const getDemandeur = (item) => {
  if (!item) return "—";
  if (typeof item.nom_demandeur === "string" && item.nom_demandeur.trim()) return item.nom_demandeur;
  if (typeof item.demandeur === "string" && item.demandeur.trim()) return item.demandeur;
  if (item.demandeur && typeof item.demandeur === "object") {
    return item.demandeur.username || item.demandeur.nom || item.demandeur.name || "—";
  }
  return "—";
};

// ============================================================
// SOUS-TYPE / TYPE DEMANDE
// ============================================================

export const estTypeNouvelleCreation = (typeDemande) => {
  const t = normaliserTexte(typeDemande).replace(/_/g, " ");
  return t === "nouvelle creation" || t === "creation";
};

export const getSousTypeKey = (item, avecDefaut = true) => {
  if (!item) return null;
  if (!estTypeNouvelleCreation(item?.type_demande)) return null;

  const brut = normaliserTexte(
    item?.sous_type ?? item?.sous_type_demande ?? item?.nature_demande ??
    item?.nouvelle_creation?.sous_type ?? ""
  );

  if (brut.includes("provisoire")) return "provisoire";
  if (brut === "creation" || brut.includes("nouvelle") || brut.includes("creation")) return "creation";

  if (item?.nouvelle_creation?.date_ouverture_fait) return "provisoire";
  if (Array.isArray(item?.evolution_effectifs) && item.evolution_effectifs.length > 0) return "provisoire";

  return avecDefaut ? "creation" : null;
};

export const getLibelleTypeDemande = (typeDemande, sousTypeKey) => {
  const base = typeDemande || "—";
  if (!sousTypeKey || !SOUS_TYPE_LABELS[sousTypeKey]) return base;
  return `${base} (${SOUS_TYPE_LABELS[sousTypeKey]})`;
};

// ============================================================
// LOCALISATION
// ============================================================

export const getNestedLocalisationObjects = (item) => {
  if (!item) return [];
  const values = [];
  const pushObject = (value) => {
    if (value && typeof value === "object" && !Array.isArray(value) && !values.includes(value)) {
      values.push(value);
    }
  };

  pushObject(item);
  pushObject(item.localisation_detail);
  pushObject(item.localisation);
  pushObject(item.localisationDetail);
  pushObject(item.village_implantation_detail);
  pushObject(item.lieu_implantation);
  pushObject(item.lieuImplantation);
  pushObject(item.info_complementaire);

  const roots = [...values];
  for (const root of roots) {
    pushObject(root.localisation_detail);
    pushObject(root.localisation);
    pushObject(root.village_detail);
    pushObject(root.villageDetail);
    pushObject(root.village);
    pushObject(root.fokontany_detail);
    pushObject(root.commune_detail);
    pushObject(root.zap_detail);
    pushObject(root.cisco_detail);
    pushObject(root.dren_detail);
    pushObject(root.coordonnees);
    pushObject(root.coordinates);
    pushObject(root.gps);
    pushObject(root.position);
  }
  return values;
};

const LOC_ALIASES = {
  village: ["village", "nom_village", "village_nom", "nomVillage", "libelle_village"],
  fokontany: ["fokontany", "nom_fokontany", "fokontany_nom", "nomFokontany", "libelle_fokontany"],
  commune: ["commune", "nom_commune", "commune_nom", "nomCommune", "libelle_commune"],
  zap: ["zap", "nom_zap", "zap_nom", "nomZap", "code_zap", "codeZap", "libelle_zap"],
  cisco: ["cisco", "nom_cisco", "cisco_nom", "nomCisco", "code_cisco", "codeCisco", "libelle_cisco"],
  dren: ["dren", "nom_dren", "dren_nom", "nomDren", "code_dren", "codeDren", "libelle_dren"],
};

export const getLocalisationValue = (item, champ) => {
  if (!item) return "—";
  for (const source of getNestedLocalisationObjects(item)) {
    for (const key of LOC_ALIASES[champ] || []) {
      const value = source?.[key];
      if (value === null || value === undefined || String(value).trim() === "") continue;
      if (typeof value === "object") {
        return String(
          value.nom ?? value.name ?? value.libelle ?? value.nom_village ?? value.nom_fokontany ??
            value.nom_commune ?? value.nom_zap ?? value.nom_cisco ?? value.nom_dren ?? "—"
        );
      }
      return String(value);
    }
  }
  return "—";
};

export const getLocalisationCode = (item, champ) => {
  if (!item) return "";

  const keys = {
    cisco: [
      "code_cisco", "cisco_code", "CODE_CISCO", "CISCO_CODE",
      "id_cisco", "cisco_id", "ID_CISCO", "CISCO_ID",
      "codeCisco", "ciscoCode", "cisco",
    ],
    dren: [
      "code_dren", "dren_code", "CODE_DREN", "DREN_CODE",
      "id_dren", "dren_id", "ID_DREN", "DREN_ID",
      "codeDren", "drenCode", "dren",
    ],
  }[champ] || [];

  for (const source of getNestedLocalisationObjects(item)) {
    for (const key of keys) {
      const value = source?.[key];
      if (value !== null && value !== undefined && String(value).trim() !== "") {
        if (typeof value === "object") {
          const codeObj = value?.code ?? value?.id ?? value?.code_cisco ?? value?.code_dren;
          if (codeObj !== null && codeObj !== undefined && String(codeObj).trim() !== "") {
            return String(codeObj).trim();
          }
          continue;
        }
        const str = String(value).trim();
        if (/^\d+$/.test(str)) return str;
        const match = str.match(/\d+/);
        if (match) return match[0];
        return str;
      }
    }
  }
  return "";
};

// ============================================================
// COORDONNÉES
// ============================================================

const LAT_KEYS = [
  "latitude", "lat", "latitude_implantation", "latitude_village",
  "latitude_etab", "lat_village", "lat_etab", "coord_latitude",
  "coord_lat", "lat_coord", "y",
];
const LNG_KEYS = [
  "longitude", "lng", "lon", "longitude_implantation", "longitude_village",
  "longitude_etab", "long_village", "lon_village", "lng_etab",
  "coord_longitude", "coord_lng", "lon_coord", "x",
];

const findCoord = (item, keys, limit) => {
  if (!item) return null;
  for (const source of getNestedLocalisationObjects(item)) {
    for (const key of keys) {
      const value = toNumber(source?.[key]);
      if (value !== null && Math.abs(value) <= limit) return value;
    }
  }
  return null;
};

export const getLatitude = (item) => findCoord(item, LAT_KEYS, 90);
export const getLongitude = (item) => findCoord(item, LNG_KEYS, 180);

export const getPosition = (item) => {
  const lat = getLatitude(item);
  const lng = getLongitude(item);
  if (lat === null || lng === null) return null;
  if (lat === 0 && lng === 0) return null;
  return [lat, lng];
};

// ============================================================
// MAPPING DEMANDE LISTE (CORRIGÉ POUR GARDER LES RELATIONS)
// ============================================================

export const mapDemande = (item) => {
  const typeDemande = item?.type_demande || "—";
  const sousType = getSousTypeKey({ ...item, type_demande: typeDemande }, false);

  const codeCisco = getLocalisationCode(item, "cisco");
  const codeDren = getLocalisationCode(item, "dren");

  const statutDecision =
    item?.decision_detail?.decision ||
    item?.decision?.decision ||
    "";

  return {
    id: item?.id_demande ?? item?.id ?? Math.random(),
    reference: item?.reference || item?.numero_demande ||
      `${String(item?.id_demande ?? item?.id ?? "").padStart(6, "0")}`,
    nom_etab: item?.nom_etab || item?.nom_etablissement || "—",
    niveau: mapNiveau(item?.niveau_etab || item?.niveau),
    type_demande: typeDemande,
    sous_type: sousType,
    type_demande_label: getLibelleTypeDemande(typeDemande, sousType),
    demandeur: getDemandeur(item),
    date_depot: formatDate(item?.date_depot),
    statut: statutDecision || "—",
    commune: getLocalisationValue(item, "commune"),
    cisco: getLocalisationValue(item, "cisco"),
    dren: getLocalisationValue(item, "dren"),
    code_cisco: codeCisco,
    code_dren: codeDren,

    // ✅ TRÈS IMPORTANT : On garde toutes les relations pour que l'analyse fonctionne
    enseignants: item?.enseignants || [],
    evolution_effectifs: item?.evolution_effectifs || [],
    nouvelle_creation: item?.nouvelle_creation || item?.nouvelle_creation_detail || null,
    regularisation: item?.regularisation || item?.regularisation_detail || null,
    aire_recrutement: item?.aire_recrutement || [],
    etablissements_proches: item?.etablissements_proches || [],
    info_complementaire: item?.info_complementaire || {},
    personnel_existant: item?.personnel_existant || [],
    pieces: item?.pieces || item?.pieces_fournies || [],
    ressources: item?.ressources || {},
    localisation_detail: item?.localisation_detail || {},
    zone_proposee: item?.zone_proposee || {},
    village_non_eligible: item?.village_non_eligible || {},
  };
};

// ============================================================
// ANALYSE — COLLECTE
// ============================================================

export const getEnseignantsAnalyse = (d) =>
  firstArray(d, ["enseignants", "personnel_existant", "personnel"]);

export const getInfoComplementaireAnalyse = (d) => ({
  ...(d?.info_complementaire || {}),
  ...(d?.information_complementaire_detail || {}),
});

export const getEtablissementsProchesAnalyse = (d) => {
  const direct = firstArray(d, [
    "etablissements_proches", "etablissements_proches_liste",
    "proximite", "etablissements_proximite",
  ]);
  if (direct.length) return direct;
  const info = getInfoComplementaireAnalyse(d);
  return firstArray(info, ["etablissements_proches", "etablissements_proches_liste", "proximite"]);
};

export const getEvolutionEffectifsAnalyse = (d) =>
  firstArray(d, ["evolution_effectifs", "evolutionEffectifs", "evolution"]);

export const getPiecesAnalyse = (d) => firstArray(d, ["pieces", "pieces_fournies"]);

export const getPersonnelDetailAnalyse = (d) => {
  const cles = [
    "enseignants", "personnel_enseignant_detail", "personnel_detail",
    "personnel", "personnel_existant", "liste_enseignants", "liste_personnel",
  ];
  for (const cle of cles) {
    const valeur = d?.[cle];
    if (Array.isArray(valeur) && valeur.length > 0) return valeur;
  }
  return [];
};

// ============================================================
// NORMALISATION AIRE
// ============================================================

export const normaliserNiveauItem = (item) => {
  const valeur = String(
    item?.niveau_etab ?? item?.niveau ?? item?.type_niveau ??
    item?.niveau_etablissement ?? item?.niveauEtab ?? ""
  )
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (valeur.startsWith("presco") || valeur.includes("matern")) return "prescolaire";
  if (valeur.startsWith("prim") || valeur.includes("epp")) return "primaire";
  if (valeur.startsWith("col") || valeur.includes("ceg")) return "college";
  if (valeur.startsWith("lyc")) return "lycee";
  return "";
};

export const getAireCandidateArrays = (d) => {
  const candidates = [];
  const ajouter = (value) => {
    if (Array.isArray(value) && value.length) candidates.push(value);
  };

  [
    "aire_recrutement", "aires_recrutement", "aireRecrutement",
    "recrutement", "zone_recrutement", "zoneRecrutement",
    "villages_alimentants", "villages_alimentant",
    "villages_recrutement", "villages_recrutement_liste",
    "ecoles_alimentantes", "ecoles_alimentant",
    "etablissements_alimentants", "etablissements_alimentant",
    "etablissements_recrutement", "ecoles_rattachement",
    "etablissements_rattachement",
  ].forEach((key) => ajouter(d?.[key]));

  const info = getInfoComplementaireAnalyse(d);
  [
    "aire_recrutement", "aires_recrutement", "recrutement",
    "zone_recrutement", "villages_alimentants",
    "ecoles_alimentantes", "etablissements_alimentants",
  ].forEach((key) => ajouter(info?.[key]));

  return candidates;
};

export const normaliserAireItem = (item, niveauKey) => {
  if (!item || typeof item !== "object") return item;

  const nom =
    item?.nom_village ?? item?.village_nom ?? item?.nom_inferieur ??
    item?.nom_ecole ?? item?.nom_etab ?? item?.nom_etablissement ??
    item?.nom ?? item?.libelle ?? item?.village?.nom ??
    item?.etablissement?.nom ?? "—";

  const code =
    item?.code_inferieur ?? item?.code_ecole ?? item?.code_etab ??
    item?.code_etablissement ?? item?.code ?? item?.etablissement?.code ?? "";

  const lat = toNumber(
    item?.latitude ?? item?.lat ?? item?.latitude_village ??
    item?.coord_latitude ?? item?.y ??
    item?.village?.latitude ?? item?.etablissement?.latitude
  );

  const lng = toNumber(
    item?.longitude ?? item?.lng ?? item?.lon ?? item?.longitude_village ??
    item?.coord_longitude ?? item?.x ??
    item?.village?.longitude ?? item?.etablissement?.longitude
  );

  const effet =
    item?.effectif_t9 ?? item?.effectif_t5 ?? item?.effectif_t1 ??
    item?.effectif ?? item?.effectif_total ??
    item?.population_scolarisable ?? item?.population ?? null;

  const base = {
    ...item,
    latitude: lat !== null ? lat : (item?.latitude ?? null),
    longitude: lng !== null ? lng : (item?.longitude ?? null),
    distance_future:
      item?.distance_future ?? item?.distance_km ?? item?.distance ?? null,
    distance_proche: item?.distance_proche ?? null,
  };

  if (niveauKey === "primaire" || niveauKey === "prescolaire") {
    base.nom_village = item?.nom_village ?? nom;
    base.population = item?.population ?? effet;
    base.population_scolarisable = item?.population_scolarisable ?? null;

    delete base.effectif_t5;
    delete base.effectif_t9;
    delete base.nom_inferieur;
    delete base.code_inferieur;
  } else if (niveauKey === "college") {
    base.nom_inferieur = item?.nom_inferieur ?? nom;
    base.code_inferieur = item?.code_inferieur ?? code;
    base.nom_ecole = item?.nom_ecole ?? nom;
    base.effectif_t5 = item?.effectif_t5 ?? effet;

    delete base.effectif_t9;
    delete base.nom_village;
    delete base.population;
    delete base.population_scolarisable;
  } else if (niveauKey === "lycee") {
    base.nom_inferieur = item?.nom_inferieur ?? nom;
    base.code_inferieur = item?.code_inferieur ?? code;
    base.nom_ecole = item?.nom_ecole ?? nom;
    base.effectif_t9 = item?.effectif_t9 ?? effet;

    delete base.effectif_t5;
    delete base.nom_village;
    delete base.population;
    delete base.population_scolarisable;
  }

  return base;
};

export const getAireRecrutementAnalyse = (d) => {
  const niveauKey = niveauToKey(d?.niveau_etab || d?.niveau);

  const candidates = getAireCandidateArrays(d);
  if (candidates.length) {
    return candidates[0].map((item) => normaliserAireItem(item, niveauKey));
  }

  const info = getInfoComplementaireAnalyse(d);
  const depuisInfo = [
    info?.aire_recrutement, info?.villages_alimentants,
    info?.ecoles_alimentantes, info?.etablissements_alimentants,
  ].find((v) => Array.isArray(v) && v.length);

  if (depuisInfo) {
    return depuisInfo.map((item) => normaliserAireItem(item, niveauKey));
  }

  if (niveauKey === "primaire" || niveauKey === "prescolaire") return [];

  const reference = Array.isArray(d?.etablissements_reference)
    ? d.etablissements_reference
    : [];

  if (reference.length) {
    return reference.map((item) => normaliserAireItem(item, niveauKey));
  }

  const proches = getEtablissementsProchesAnalyse(d);
  if (!proches.length) return [];

  const niveauInferieurAttendu = niveauKey === "lycee" ? "college" : "primaire";
  const derives = proches.filter((item) =>
    normaliserNiveauItem(item) === niveauInferieurAttendu
  );

  return derives.map((item) => normaliserAireItem(item, niveauKey));
};

export const getEtablissementsProchesPourNiveau = (d) => {
  const niveauKey = niveauToKey(d?.niveau_etab || d?.niveau);
  const proches = getEtablissementsProchesAnalyse(d);
  if (!proches.length) return [];

  const pertinents = proches.filter((item) => {
    const n = normaliserNiveauItem(item);
    if (niveauKey === "lycee") return n === "lycee";
    if (niveauKey === "college") return n === "college";
    if (niveauKey === "primaire") return n === "primaire";
    if (niveauKey === "prescolaire") return n === "prescolaire";
    return true;
  });

  return pertinents.length ? pertinents : proches;
};

export const getNomAireItem = (item) => {
  if (!item) return "—";
  const candidats = [
    item?.nom_village, item?.village_nom, item?.nom_inferieur, item?.nom_ecole,
    item?.nom_etab, item?.nom_etablissement, item?.nom, item?.libelle,
    item?.name, item?.NOM_ETAB, item?.NOM_ETABLISSEMENT, item?.NOM_ECOLE,
    item?.VILLAGE, item?.NAME, item?.LIBELLE,
    item?.village?.nom, item?.village?.name, item?.village?.libelle, item?.village?.VILLAGE,
    item?.etablissement?.nom, item?.etablissement?.name,
    item?.etablissement?.nom_etab, item?.etablissement?.NOM_ETAB,
    item?.ecole?.nom, item?.ecole?.name, item?.ecole?.nom_etab, item?.ecole?.NOM_ETAB,
  ];

  const nom = candidats.find((v) => v !== null && v !== undefined && String(v).trim() !== "");
  if (nom !== undefined) return String(nom).trim();

  const fkt = [item?.fokontany, item?.nom_fokontany, item?.FOKONTANY,
    item?.fokontany?.nom, item?.fokontany?.name]
    .find((v) => v !== null && v !== undefined && String(v).trim() !== "");
  if (fkt !== undefined) return `Fokontany : ${String(fkt).trim()}`;

  return "Lieu sans nom fourni par l'API";
};

export const getCodeAireItem = (item) =>
  item?.code_inferieur ?? item?.code_ecole ?? item?.code_etab ??
  item?.code_etablissement ?? item?.code ?? item?.etablissement?.code ?? "—";

// ============================================================
// ÉVOLUTION / EFFECTIFS
// ============================================================

const sommeChamps = (objet, cles) => {
  return cles.reduce((total, cle) => {
    const n = Number(objet?.[cle]);
    return total + (Number.isFinite(n) ? n : 0);
  }, 0);
};

export const normaliserEvolutionPourAffichage = (d) => {
  const niveauKey = niveauToKey(d?.niveau_etab || d?.niveau);
  const evolution = getEvolutionEffectifsAnalyse(d);

  return evolution.map((e) => {
    const row = { ...e };

    if (niveauKey === "prescolaire") {
      row.eff_ps = toNumber(e?.eff_ps) ?? toNumber(e?.ps) ?? toNumber(e?.PS) ?? sommeChamps(e, ["ps_g", "ps_f", "PS_G", "PS_F"]);
      row.eff_ms = toNumber(e?.eff_ms) ?? toNumber(e?.ms) ?? toNumber(e?.MS) ?? sommeChamps(e, ["ms_g", "ms_f", "MS_G", "MS_F"]);
      row.eff_gs = toNumber(e?.eff_gs) ?? toNumber(e?.gs) ?? toNumber(e?.GS) ?? sommeChamps(e, ["gs_g", "gs_f", "GS_G", "GS_F"]);
    }

    if (niveauKey === "primaire") {
      ["t1", "t2", "t3", "t4", "t5"].forEach((niveau) => {
        const key = `eff_${niveau}`;
        if (row[key] === undefined) {
          row[key] = e?.[niveau] ?? e?.[niveau.toUpperCase()] ?? 0;
        }
      });
    }

    if (niveauKey === "college") {
      ["t6", "t7", "t8", "t9"].forEach((niveau) => {
        const key = `eff_${niveau}`;
        if (row[key] === undefined) {
          row[key] = e?.[niveau] ?? e?.[niveau.toUpperCase()] ?? 0;
        }
      });
    }

    if (niveauKey === "lycee") {
      row._2nde = e?._2nde ?? e?.["2nde"] ?? e?.seconde ?? 0;
      row._1re = e?._1re ?? e?.["1ere"] ?? e?.["1ère"] ?? e?.premiere ?? 0;
      row.tle = e?.tle ?? e?.["Tle"] ?? e?.terminale ?? 0;
    }

    if (row.effectif_total === undefined || row.effectif_total === null) {
      if (niveauKey === "prescolaire") {
        row.effectif_total = Number(row.eff_ps || 0) + Number(row.eff_ms || 0) + Number(row.eff_gs || 0);
      } else if (niveauKey === "primaire") {
        row.effectif_total = sommeChamps(row, ["eff_t1", "eff_t2", "eff_t3", "eff_t4", "eff_t5"]);
      } else if (niveauKey === "college") {
        row.effectif_total = sommeChamps(row, ["eff_t6", "eff_t7", "eff_t8", "eff_t9"]);
      } else {
        row.effectif_total = sommeChamps(row, ["_2nde", "_1re", "tle"]);
      }
    }

    return row;
  });
};

export const calculerDernierEffectifConnu = (demande) => {
  const evolution = normaliserEvolutionPourAffichage(demande);
  if (!Array.isArray(evolution) || evolution.length === 0) return 0;

  const triee = [...evolution].sort((a, b) =>
    String(b?.annee ?? b?.annee_scolaire ?? "").localeCompare(
      String(a?.annee ?? a?.annee_scolaire ?? ""), undefined, { numeric: true }
    )
  );

  const derniere = triee[0];
  if (!derniere) return 0;

  const totalDirect = Number(derniere?.effectif_total ?? derniere?.effectif ?? derniere?.total ?? 0);
  if (Number.isFinite(totalDirect) && totalDirect > 0) return totalDirect;

  let somme = 0;
  Object.entries(derniere).forEach(([cle, val]) => {
    if (
      cle.startsWith("eff_") ||
      cle === "_2nde" || cle === "_1re" || cle === "tle" ||
      ["ps", "ms", "gs", "ps_g", "ps_f", "ms_g", "ms_f", "gs_g", "gs_f",
       "PS_G", "PS_F", "MS_G", "MS_F", "GS_G", "GS_F"].includes(cle)
    ) {
      const n = Number(val);
      if (Number.isFinite(n)) somme += n;
    }
  });
  return somme;
};

// ============================================================
// CODE / ACCESSIBILITÉ / DISTANCE
// ============================================================

export const getCodeProvisoireMen = (demande) => {
  const candidats = [
    demande?.code_etab,
    demande?.regularisation?.code_etablissement,
    demande?.etablissement_existant_id,
  ];
  for (const c of candidats) {
    const v = String(c ?? "").trim();
    if (v) return v;
  }
  return "";
};

export const getAccessibiliteSite = (demande) => {
  const info = getInfoComplementaireAnalyse(demande);
  if (typeof info?.accessibilite_site === "boolean") return info.accessibilite_site;
  if (typeof info?.accessibilite === "boolean") return info.accessibilite;
  const lat = getLatitude(demande);
  const lng = getLongitude(demande);
  if (lat !== null && lng !== null) return true;
  return null;
};

export const getDistancePlusProche = (demande) => {
  const info = getInfoComplementaireAnalyse(demande);
  const directe = Number(info?.distance_plus_proche);
  if (Number.isFinite(directe) && directe > 0) return directe;

  const proches = getEtablissementsProchesAnalyse(demande);
  if (!Array.isArray(proches) || proches.length === 0) return null;

  const distances = proches
    .map((p) => Number(p?.distance_km ?? p?.distance ?? NaN))
    .filter((n) => Number.isFinite(n));

  if (distances.length === 0) return null;
  return Math.min(...distances);
};

// ============================================================
// GÉOMÉTRIE / CONTOURS / CARTE
// ============================================================

export const extraireContour = (demande, type) => {
  for (const candidate of getGeometryCandidates(demande, type)) {
    const anneau = convertirGeometryEnAnneau(candidate);
    if (anneau && anneau.length >= 3) return anneau;
  }
  return null;
};

export const getGeometryCandidates = (demande, type) => {
  if (!demande) return [];
  const info = getInfoComplementaireAnalyse(demande);
  const localisation = demande?.localisation_detail ?? demande?.localisation ?? {};
  const commune = demande?.commune_detail ?? localisation?.commune_detail ?? demande?.commune ?? {};
  const fokontany = demande?.fokontany_detail ?? localisation?.fokontany_detail ?? demande?.fokontany ?? {};

  if (type === "commune") {
    return [
      demande?.limite_commune,
      demande?.commune_geometry,
      demande?.commune_contour,
      demande?.contour_commune,
      demande?.geojson_commune,
      commune?.contour,
      commune?.limite,
      commune?.geometry,
      commune?.geojson,
      localisation?.limite_commune,
      localisation?.commune_contour,
      localisation?.commune_geometry,
      localisation?.commune?.contour,
      localisation?.commune?.limite,
      info?.limite_commune,
      info?.commune_contour,
      info?.contour_commune,
      info?.geometry_commune,
    ].filter(Boolean);
  }
  return [
    demande?.limite_fokontany,
    demande?.fokontany_geometry,
    demande?.fokontany_contour,
    demande?.contour_fokontany,
    demande?.geojson_fokontany,
    fokontany?.contour,
    fokontany?.limite,
    fokontany?.geometry,
    fokontany?.geojson,
    localisation?.limite_fokontany,
    localisation?.fokontany_contour,
    localisation?.fokontany_geometry,
    localisation?.fokontany?.contour,
    localisation?.fokontany?.limite,
    info?.limite_fokontany,
    info?.fokontany_contour,
    info?.contour_fokontany,
    info?.geometry_fokontany,
  ].filter(Boolean);
};

export const convertirGeometryEnAnneau = (candidate) => {
  if (!candidate) return null;
  if (candidate?.type === "Feature") return convertirGeometryEnAnneau(candidate.geometry);
  if (candidate?.type === "FeatureCollection" && Array.isArray(candidate.features)) {
    let meilleur = null;
    for (const feature of candidate.features) {
      const anneau = convertirGeometryEnAnneau(feature);
      if (anneau && anneau.length >= 3) if (!meilleur || anneau.length > meilleur.length) meilleur = anneau;
    }
    return meilleur;
  }
  if (candidate?.type === "Polygon" && Array.isArray(candidate.coordinates?.[0])) {
    const points = candidate.coordinates[0].map((p) => {
      if (!Array.isArray(p) || p.length < 2) return null;
      const lng = Number(p[0]); const lat = Number(p[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return [lat, lng];
    }).filter((p) => Boolean(p));
    return points.length >= 3 ? points : null;
  }
  if (candidate?.type === "MultiPolygon" && Array.isArray(candidate.coordinates)) {
    let meilleur = null;
    for (const poly of candidate.coordinates) {
      if (!Array.isArray(poly?.[0])) continue;
      const points = poly[0].map((p) => {
        if (!Array.isArray(p) || p.length < 2) return null;
        const lng = Number(p[0]); const lat = Number(p[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return [lat, lng];
      }).filter((p) => Boolean(p));
      if (points.length >= 3) if (!meilleur || points.length > meilleur.length) meilleur = points;
    }
    return meilleur;
  }
  if (Array.isArray(candidate) && candidate.length >= 3) {
    const points = candidate.map((p) => {
      if (Array.isArray(p) && p.length >= 2) {
        const a = Number(p[0]); const b = Number(p[1]);
        if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
        return (Math.abs(a) <= 90 ? [a, b] : [b, a]);
      }
      if (p && typeof p === "object") {
        const lat = Number(p.lat ?? p.latitude ?? p.y);
        const lng = Number(p.lng ?? p.lon ?? p.longitude ?? p.x);
        if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
      }
      return null;
    }).filter((p) => Boolean(p));
    return points.length >= 3 ? points : null;
  }
  if (candidate?.coordinates) return convertirGeometryEnAnneau({ type: candidate.type || "Polygon", coordinates: candidate.coordinates });
  return null;
};

export const estEtablissementNiveau = (item, niveauKey) =>
  normaliserNiveauItem(item) === niveauKey;

export const getRayonCarteKm = (niveauKey) => {
  switch (niveauKey) {
    case "prescolaire": case "primaire": return 3;
    case "college": return 8;
    case "lycee": return 25;
    default: return 5;
  }
};

export const getRayonRecrutementKm = (niveauKey) => {
  switch (niveauKey) {
    case "prescolaire": return 0.8;
    case "primaire": return 2;
    case "college": return 5;
    case "lycee": return 20;
    default: return 5;
  }
};

export const getDistanceKmItem = (item, origine) => {
  const valeurs = [item?.distance_km, item?.distance, item?.distance_future, item?.distance_au_nouveau, item?.distance_nouveau];
  for (const valeur of valeurs) {
    const n = toNumber(valeur);
    if (n !== null && n >= 0) return n;
  }
  if (!origine) return null;
  const position = getPosition(item);
  if (!position) return null;
  const metres = L.latLng(origine).distanceTo(L.latLng(position));
  return Number.isFinite(metres) ? metres / 1000 : null;
};

export const estDansRayonAnalyse = (item, origine, rayonKm) => {
  const distance = getDistanceKmItem(item, origine);
  if (distance === null) {
    const position = getPosition(item);
    return Boolean(position);
  }
  return distance <= rayonKm + 0.05;
};

export const calculerMaxBounds = (contourCommune, contourFokontany, futurePosition, rayonKm = 0) => {
  let pts = null;
  let minZoom = 10;
  if (contourCommune && contourCommune.length >= 3) { pts = contourCommune; minZoom = 10; }
  else if (contourFokontany && contourFokontany.length >= 3) { pts = contourFokontany; minZoom = 12; }
  else if (futurePosition) {
    const [lat, lng] = futurePosition;
    const delta = 0.05;
    pts = [[lat - delta, lng - delta], [lat + delta, lng + delta]];
    minZoom = 11;
  }
  if (pts && futurePosition && rayonKm > 0) {
    const [lat, lng] = futurePosition;
    const dLat = rayonKm / 111;
    const dLng = rayonKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
    pts = [...pts, [lat - dLat, lng - dLng], [lat + dLat, lng + dLng]];
    minZoom = rayonKm > 5 ? Math.min(minZoom, 9) : Math.min(minZoom, 10);
  }
  if (!pts || pts.length === 0) return { bounds: null, minZoom: 5 };
  const ptsValides = pts.filter(([lat, lng]) =>
    typeof lat === "number" && typeof lng === "number" && lat >= -26 && lat <= -11 && lng >= 42 && lng <= 52
  );
  if (ptsValides.length === 0) return { bounds: null, minZoom: 5 };
  try {
    const bounds = L.latLngBounds(ptsValides);
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const padLat = (ne.lat - sw.lat) * 0.15;
    const padLng = (ne.lng - sw.lng) * 0.15;
    const boundsAvecMarge = L.latLngBounds(
      [sw.lat - padLat, sw.lng - padLng],
      [ne.lat + padLat, ne.lng + padLng],
    );
    return { bounds: boundsAvecMarge, minZoom };
  } catch (e) { return { bounds: null, minZoom: 5 }; }
};

export const convexHull = (points) => {
  const uniques = Array.from(new Map(points.map((p) => [`${p[0].toFixed(8)},${p[1].toFixed(8)}`, p])).values());
  if (uniques.length <= 2) return uniques;
  const pts = [...uniques].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const cross = (o, a, b) => (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop(); upper.pop();
  return lower.concat(upper);
};

// ============================================================
// UTILITAIRES DIVERS
// ============================================================

export const fmtFr = (v, fallback = "NÉANT") => {
  if (v === null || v === undefined || v === "") return fallback;
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  return String(v);
};

export const esc = (v) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const fmtMilliers = (v) => {
  const n = toNumber(v);
  if (n === null) return v === null || v === undefined || v === "" ? "—" : String(v);
  const [ent, dec] = String(n).split(".");
  return ent.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0") + (dec ? "," + dec : "");
};

export const fmtDistanceFiche = (v) => {
  const n = toNumber(v);
  if (n === null) return "—";
  if (n < 1) return `${Math.round(n * 1000)} m`;
  const txt = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
  return `${txt.replace(".", ",")} km`;
};

export const premierNonVide = (...valeurs) => {
  for (const v of valeurs) {
    if (v !== null && v !== undefined && String(v).trim() !== "") return v;
  }
  return null;
};

export const valeurOuiNon = (v) => {
  if (v === null || v === undefined || String(v).trim() === "") return "—";
  const s = String(v).trim().toLowerCase();
  if (v === true || s === "true" || s === "1" || s.startsWith("oui")) return "Oui";
  if (v === false || s === "false" || s === "0" || s.startsWith("non")) return "Non";
  return String(v);
};

export const texteObstacle = (p) => {
  const nature = p?.nature_obstacle ?? p?.nature;
  if (nature !== null && nature !== undefined && String(nature).trim() !== "") return String(nature);
  const ob = p?.obstacle;
  if (typeof ob === "boolean") return ob ? "Oui" : "Non";
  if (ob !== null && ob !== undefined && String(ob).trim() !== "") return String(ob);
  return "—";
};

export const estPayeParEtat = (statut) => {
  const s = String(statut ?? "").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!s) return false;
  if (s.includes("non subvention") || s.includes("non fonction")) return false;
  return s.includes("fonction") || s.includes("subvention") ||
    s.includes("ecd") || s.includes("etat");
};

export const estDiplomeSuperieur = (diplome) => {
  const s = String(diplome ?? "").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return /bacc\s*\+\s*([3-9])|licence|master|doctorat|maitrise|dea|dess|ingenieur/.test(s);
};

// ============================================================
// DATES / ANNÉES SCOLAIRES
// ============================================================

const MOIS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export const dateLongueFr = (v) => {
  if (!v) return "—";
  const s = String(v).trim();
  let d = null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  else {
    const t = new Date(s);
    if (!isNaN(t.getTime())) d = t;
  }
  if (!d) return s;
  const jour = d.getDate() === 1 ? "1er" : String(d.getDate());
  return `${jour} ${MOIS_FR[d.getMonth()]} ${d.getFullYear()}`;
};

export const anneeScolaireCourante = () => {
  const d = new Date();
  const y = d.getFullYear();
  return d.getMonth() >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
};

export const anneeScolaireDepuisDate = (v) => {
  if (!v) return "—";
  const s = String(v).trim();
  if (/^\d{4}\s*[-_/]\s*\d{4}$/.test(s)) return s.replace(/\s*[_/]\s*/g, "-").replace(/\s/g, "");
  let d = null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  else {
    const t = new Date(s);
    if (!isNaN(t.getTime())) d = t;
  }
  if (!d) return s;
  const y = d.getFullYear();
  return d.getMonth() >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
};

export const normaliserAnneeLabel = (a) =>
  a === null || a === undefined ? "" : String(a).trim().replace(/[_/]/g, "-");

export const CLES_SERIES_EFFECTIFS = [
  "effectifs_par_annee", "effectifs_annuels", "historique_effectifs",
  "evolution_effectifs", "evolution",
];

export const extraireSerieEffectifs = (item) => {
  const out = {};
  const ajouter = (annee, val) => {
    const label = normaliserAnneeLabel(annee);
    const n = toNumber(val);
    if (label && n !== null) out[label] = n;
  };

  for (const cle of CLES_SERIES_EFFECTIFS) {
    const v = item?.[cle];
    if (Array.isArray(v)) {
      v.forEach((e) =>
        ajouter(
          e?.annee ?? e?.annee_scolaire,
          e?.effectif ?? e?.effectif_total ?? e?.total ??
          e?.effectif_t9 ?? e?.effectif_t5 ??
          e?.eff_ps ?? e?.eff_ms ?? e?.eff_gs ??
          e?.eff_t5 ?? e?.eff_t9 ?? null
        )
      );
    } else if (v && typeof v === "object") {
      Object.entries(v).forEach(([a, val]) => ajouter(a, val));
    }
  }

  Object.entries(item || {}).forEach(([k, val]) => {
    const m = k.match(/(20\d{2})[_-]?(20\d{2})/);
    if (m && /^(eff|effectif|ps|ms|gs)/i.test(k) && typeof val !== "object") {
      ajouter(`${m[1]}-${m[2]}`, val);
    }
  });

  return out;
};

// ============================================================
// LABELS
// ============================================================

export const NIVEAU_LABELS = {
  prescolaire: "Préscolaire",
  primaire: "Primaire",
  college: "Collège",
  lycee: "Lycée",
};

export const SOUS_TYPE_LABELS = {
  creation: "Nouvelle",
  provisoire: "Ouverture provisoire",
};

// ============================================================
// ✅ NOUVELLE CRÉATION : village non éligible + zone proposée
// ============================================================

const _extrairePoint = (obj) => {
  if (!obj || typeof obj !== "object") return null;
  const lat = toNumber(obj.latitude ?? obj.lat);
  const lng = toNumber(obj.longitude ?? obj.lng ?? obj.lon);
  if (lat === null || lng === null) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
};

const _normaliserPointNouvelleCreation = (brut, defautNom = "") => {
  if (!brut || typeof brut !== "object") return null;
  const pt = _extrairePoint(brut);
  if (!pt) return null;

  const nom = String(
    brut.nom ?? brut.nom_village ?? brut.village ?? defautNom ?? ""
  ).trim();

  // ✅ Récupération de la distance — km prioritaire, sinon m converti
  let distance_km = toNumber(
    brut.distance_km ??
    brut.distance ??
    brut.distance_future ??
    brut.distance_au_nouveau ??
    brut.distance_nouveau
  );

  const distance_m = toNumber(brut.distance_m);

  if (distance_km === null && distance_m !== null) {
    distance_km = distance_m / 1000;
  }

  return {
    nom,
    aUnNom: nom !== "",
    code_village:
      brut.code_village ?? brut.village_id ?? brut.id_village ?? null,
    commune: String(brut.commune ?? "").trim(),
    fokontany: String(brut.fokontany ?? "").trim(),
    latitude: pt.lat,
    longitude: pt.lng,
    // ✅ Distance conservée
    distance_km: distance_km,
    distance_m: distance_m,
  };
};

/**
 * Récupère le village sélectionné initialement mais NON ÉLIGIBLE.
 */
export const getVillageNonEligible = (demande) => {
  if (!demande) return null;
  const sources = [
    demande?.village_non_eligible,
    demande?.detail_complet?.village_non_eligible,
    demande?.info_complementaire?.village_non_eligible,
    demande?.nouvelle_creation?.village_non_eligible,
  ];
  const brut = sources.find((s) => s && typeof s === "object");
  return _normaliserPointNouvelleCreation(brut);
};

/**
 * Récupère la zone éligible PROPOSÉE (sélectionnée en remplacement).
 */
export const getZoneProposee = (demande) => {
  if (!demande) return null;
  const sources = [
    demande?.zone_proposee,
    demande?.detail_complet?.zone_proposee,
    demande?.info_complementaire?.zone_proposee,
    demande?.nouvelle_creation?.zone_proposee,
  ];
  const brut = sources.find((s) => s && typeof s === "object");
  return _normaliserPointNouvelleCreation(brut);
};

/**
 * Calcule les points à afficher sur la carte pour une nouvelle création.
 */
export const getPointsNouvelleCreation = (demande) => {
  const village = getVillageNonEligible(demande);
  const zone = getZoneProposee(demande);

  if (!zone) {
    return {
      pointPrincipal: null,
      pointSecondaire: null,
      villageNonEligible: village,
      zoneProposee: null,
      remplaceVillage: false,
    };
  }

  if (zone.aUnNom) {
    return {
      pointPrincipal: zone,
      pointSecondaire: null,
      villageNonEligible: village,
      zoneProposee: zone,
      remplaceVillage: true,
    };
  }

  return {
    pointPrincipal: zone,
    pointSecondaire: village,
    villageNonEligible: village,
    zoneProposee: zone,
    remplaceVillage: false,
  };
};