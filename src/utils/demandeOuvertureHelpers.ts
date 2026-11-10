// @ts-nocheck
import { NIVEAU_COLONNES_EFFECTIF, NIVEAU_CONFIG, KEY_TO_NIVEAU_LABEL } from "@/constants/demandeOuvertureConfig";

// ============================================================
// NUMÉRIQUE
// ============================================================

export const toNum = (v) => Number(v) || 0;

export const lireDistanceKm = (valeur) => {
  if (valeur === null || valeur === undefined || valeur === "") return null;
  const distance = Number(String(valeur).trim().replace(",", "."));
  return Number.isFinite(distance) && distance >= 0 ? distance : null;
};

export const calculerTotalEvolutionLigne = (ligne, niveauKey) => {
  const colonnes = NIVEAU_COLONNES_EFFECTIF[niveauKey] || [];
  return colonnes.reduce((somme, col) => {
    const n = Number(ligne?.[col.key]);
    return somme + (Number.isFinite(n) ? n : 0);
  }, 0);
};

// ============================================================
// NIVEAU
// ============================================================

export const niveauToKey = (niveau) =>
  niveau === "Lycée" ? "lycee"
  : niveau === "Collège" ? "college"
  : niveau === "Préscolaire" ? "prescolaire"
  : "primaire";

// ============================================================
// DATES
// ============================================================

export const formatDateForInput = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const isoMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) return isoMatch[1];
  }
  const date = new Date(value);
  if (isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const ressembleAUneDate = (valeur) => {
  if (!valeur) return false;
  const s = String(valeur).trim();
  if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(s)) return true;
  if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(s)) return true;
  return false;
};

export const convertirDateFrVersIso = (valeur) => {
  if (!valeur) return "";
  const s = String(valeur).trim();
  if (!s) return "";

  const isoMatch = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (isoMatch) {
    const [, a, m, j] = isoMatch;
    return `${a}-${String(m).padStart(2, "0")}-${String(j).padStart(2, "0")}`;
  }

  const frMatch = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (frMatch) {
    let [, j, m, a] = frMatch;
    if (a.length === 2) {
      const anneeNum = Number(a);
      a = anneeNum > 50 ? `19${a}` : `20${a}`;
    }
    return `${a}-${String(m).padStart(2, "0")}-${String(j).padStart(2, "0")}`;
  }
  return "";
};

export const extraireDateEntree = (p) => {
  const candidats = [
    p?.agent_etat_entree_administration,
    p?.premiere_prise_service_admin,
    p?.date_entree_administrative,
    p?.date_entree_enseignante,
    p?.prise_service_poste_actuel,
    p?.date_entree_admin,
    p?.date_entree_administration,
    p?.date_entree,
  ];
  const brute = candidats.find((v) => ressembleAUneDate(v)) || "";
  return convertirDateFrVersIso(brute);
};

// ============================================================
// PERSONNEL
// ============================================================

export const construireLignesPersonnel = (personnelBrut) => {
  if (!Array.isArray(personnelBrut)) return [];
  return personnelBrut.map((p) => ({
    annee_scolaire: p?.annee_scolaire ?? p?.annee ?? "",
    code_etab: p?.code_etab ?? "",
    nombre_enseignants: toNum(p?.nombre_enseignants ?? p?.nombre_enseignant),
    nombre_personnel_total: toNum(p?.nombre_personnel_total ?? p?.personnel_total),
    nombre_fonctionnaire: toNum(p?.nombre_fonctionnaire ?? p?.fonctionnaire ?? p?.nombre_enseignant_fonctionnaire),
    nombre_non_salarie: toNum(p?.nombre_non_salarie ?? p?.fram_non_subventionne ?? p?.nombre_enseignant_non_salarie),
    nombre_subventionne: toNum(p?.nombre_subventionne ?? p?.fram_subventionne ?? p?.nombre_enseignant_subventionne),
    nombre_litteraire: toNum(p?.nombre_litteraire ?? p?.litteraire),
    nombre_scientifique: toNum(p?.nombre_scientifique ?? p?.scientifique),
  }));
};

export const lignesPersonnelDepuis = (src) => {
  const lignes = construireLignesPersonnel(src?.personnel);
  if (lignes.length > 0) return lignes;
  return construireLignesPersonnel(src?.personnel_detaille);
};

export const construirePersonnelDetail = (src) => {
  const brut = Array.isArray(src?.personnel_enseignant_detail)
    ? src.personnel_enseignant_detail
    : Array.isArray(src?.personnel_detail)
      ? src.personnel_detail
      : [];

  return brut.map((p) => ({
    nom_prenoms: p?.nom_prenoms ?? p?.nom_prenom ?? p?.nom ?? "",
    fonction: p?.fonction ?? "",
    date_entree: extraireDateEntree(p),
    diplome_pedagogique: p?.diplome_pedagogique ?? "",
    matiere_enseignee_1: p?.matiere_enseignee_1 ?? p?.matiere_enseignee ?? p?.matiere ?? "",
    diplome_academique: p?.diplome_academique ?? "",
  }));
};

// ============================================================
// AIRE DE RECRUTEMENT
// ============================================================

export const construireAireListe = (analyse, niveau, fokontanyDefaut = "") => {
  const seuilKm = NIVEAU_CONFIG[niveau]?.seuilProximite;
  if (!Number.isFinite(seuilKm)) return [];

  if (niveau === "college" || niveau === "lycee") {
    const references = Array.isArray(analyse?.etablissements_reference)
      ? analyse.etablissements_reference
      : [];

    return references
      .map((item) => {
        const distanceBrute = item.distance_km ?? item.distance_future;
        const distance = lireDistanceKm(distanceBrute);
        return {
          fokontany: item.fokontany || fokontanyDefaut || "",
          code_inferieur: item.code || item.code_etab || item.CODE_ETAB || "",
          nom_inferieur: item.nom || item.nom_etab || item.NOM_ETAB || "",
          distance_future: distance === null ? "" : distance,
          distance_proche: item.distance_proche ?? "",
          effectif_t5: item.effectif_t5 ?? item.effectif ?? "",
          effectif_t9: item.effectif_t9 ?? item.effectif ?? "",
          _distanceKm: distance,
        };
      })
      .filter((item) => item._distanceKm !== null && item._distanceKm <= seuilKm)
      .map(({ _distanceKm, ...item }) => item);
  }

  const villages = Array.isArray(analyse?.aire_recrutement)
    ? analyse.aire_recrutement
    : [];

  return villages
    .map((item) => {
      const distanceBrute = item.distance_future ?? item.distance_km;
      const distance = lireDistanceKm(distanceBrute);
      return {
        fokontany: item.fokontany || fokontanyDefaut || "",
        nom_village: item.nom_village || item.nom || item.name || "",
        distance_future: distance === null ? "" : distance,
        distance_proche: item.distance_proche ?? "",
        population: item.population ?? "",
        _distanceKm: distance,
      };
    })
    .filter((item) => item._distanceKm !== null && item._distanceKm <= seuilKm)
    .map(({ _distanceKm, ...item }) => item);
};

// ============================================================
// LOCALISATION
// ============================================================

export const fusionnerLocalisation = (src, prev) => ({
  ...prev,
  village:
    src?.village_ors_nom ??
    src?.village_implantation_detail?.nom ??
    src?.village_implantation ??
    src?.village ??
    src?.VILLAGE ??
    src?.nom_village ??
    prev.village,
  fokontany: src?.fokontany ?? src?.FOKONTANY ?? prev.fokontany,
  commune: src?.commune ?? src?.COMMUNE ?? src?.code_commune ?? prev.commune,
  zap: src?.zap ?? src?.ZAP ?? prev.zap,
  cisco: src?.cisco ?? src?.CISCO ?? src?.code_cisco ?? prev.cisco,
  dren: src?.dren ?? src?.DREN ?? src?.code_dren ?? prev.dren,
});

export const deriveStatutJuridique = (etab, fallback) => {
  if (etab?.statut_juridique) return etab.statut_juridique;
  if (etab?.secteur === "Public" || etab?.secteur === "Privé") return etab.secteur;
  const codeSecteur = etab?.secteur_code ?? etab?.secteur;
  if (codeSecteur === 0 || codeSecteur === "0" || codeSecteur === "PUBLIC") return "Public";
  if (codeSecteur === 1 || codeSecteur === "1" || codeSecteur === "PRIVE") return "Privé";
  return fallback;
};

export const lireLatrines = (src) => {
  const f = Number(src?.latrine_f) || 0;
  const g = Number(src?.latrine_g) || 0;
  const total = Number(src?.latrine_total) || 0;
  return {
    f, g, total,
    separee: src?.latrine_separee === true || (f > 0 && g > 0),
  };
};

export const makeEmptyRow = (columns) =>
  columns.reduce((acc, col) => ({ ...acc, [col.key]: "" }), {});

// ============================================================
// VALIDATION
// ============================================================

export const isEmpty = (v) =>
  v === undefined || v === null || String(v).trim() === "";

export const validateTable = (rowsToCheck, columns, tableLabel, requireAtLeastOne = false) => {
  const errors = [];

  if (requireAtLeastOne && rowsToCheck.length === 0) {
    errors.push({ message: `Le tableau « ${tableLabel} » doit contenir au moins une ligne.` });
    return errors;
  }

  for (let i = 0; i < rowsToCheck.length; i++) {
    for (const col of columns) {
      if (col.key === "nature_obstacle") {
        const obstacleValue = rowsToCheck[i]?.obstacle || "";
        if (obstacleValue === "Non" || obstacleValue === "") continue;
      }
      if (isEmpty(rowsToCheck[i][col.key])) {
        errors.push({
          field: col.key,
          rowIndex: i,
          message: `Le champ « ${col.label} » est obligatoire (ligne ${i + 1}).`,
        });
      }
    }
  }
  return errors;
};

export const validerEtape = (stepId, state) => {
  const { form, localisationDetail, locSelection, nouvelleCreation, regularisation, ressources, pieces, cfg, villageLoading } = state;
  const errors = [];

  switch (stepId) {
    case "general": {
      if (isEmpty(form.nom_demandeur)) errors.push({ field: "nom_demandeur", message: "Le nom du demandeur est obligatoire." });
      if (isEmpty(form.telephone_demandeur)) errors.push({ field: "telephone_demandeur", message: "Le numéro de téléphone du demandeur est obligatoire." });
      if (isEmpty(form.email_demandeur)) errors.push({ field: "email_demandeur", message: "L'adresse email du demandeur est obligatoire." });
      else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(String(form.email_demandeur).trim())) errors.push({ field: "email_demandeur", message: "Veuillez saisir une adresse email valide." });
      }
      if (isEmpty(form.nom_etab)) errors.push({ field: "nom_etab", message: "Le nom de l'établissement est obligatoire." });
      if (isEmpty(form.niveau_etab)) errors.push({ field: "niveau_etab", message: "Le niveau est obligatoire." });
      if (isEmpty(form.type_demande)) errors.push({ field: "type_demande", message: "Le type de demande est obligatoire." });
      return errors;
    }

    case "localisation": {
      if (form.type_demande === "Régularisation") {
        if (isEmpty(localisationDetail.fokontany)) errors.push({ field: "village", message: "Recherchez d'abord l'établissement à régulariser (étape « Informations générales ») pour récupérer sa localisation." });
      } else {
        if (isEmpty(localisationDetail.village)) errors.push({ field: "village", message: "Le village est obligatoire." });
        const champsLoc = [
          ["dren", "Le DREN est obligatoire."],
          ["cisco", "Le CISCO est obligatoire."],
          ["zap", "Le ZAP est obligatoire."],
          ["commune", "La commune est obligatoire."],
          ["fokontany", "Le fokontany est obligatoire."],
        ];
        for (const [key, message] of champsLoc) {
          if (isEmpty(locSelection[key])) errors.push({ field: key, message });
        }
      }
      return errors;
    }

    case "nouvelle_creation": {
      const champs = [
        ["nombre_tablebanc_prevus", "Nombre de table-bancs"],
        ["surface_terrain_prevu", "Surface de terrain doté par la communauté"],
        ["type_batiment_prevu", "Type de bâtiment prévu"],
        ["nombre_salle_prevu", "Nombre de salles de classe prévues"],
        ["latrine_f", "Nombre de latrines Filles"],
        ["latrine_g", "Nombre de latrines Garçons"],
      ];
      for (const [key, label] of champs) {
        if (isEmpty(nouvelleCreation[key])) errors.push({ field: key, message: `Le champ « ${label} » est obligatoire.` });
      }
      errors.push(...validateTable(ressources.enseignants, cfg.colonnesEnseignant, "Liste des enseignants", true));
      return errors;
    }

    case "regularisation": {
      const champs = [
        ["nbr_salle", "Nombre de salle de classe"],
        ["date_ouverture", "Date d'ouverture"],
        ["nbr_tablebanc", "Nombre de table-bancs"],
      ];
      for (const [key, label] of champs) {
        if (isEmpty(regularisation[key])) errors.push({ field: key, message: `Le champ « ${label} » est obligatoire. Recherchez l'établissement par son code à l'étape « Informations générales ».` });
      }
      const nbAnnees = Number(regularisation.nombre_annee) || 0;
      if (nbAnnees < 3 && regularisation.nombre_annee !== "") {
        errors.push({ field: "nombre_annee", message: `Le nombre d'années d'existant (${nbAnnees}) est inférieur à 3 ans. La régularisation nécessite au moins 3 ans d'existence.` });
      }
      return errors;
    }

    case "recrutement": {
      if (form.type_demande === "Régularisation") {
        if (isEmpty(localisationDetail.fokontany)) errors.push({ field: "aire_recrutement", message: "Recherchez d'abord l'établissement à régulariser pour récupérer son aire de recrutement." });
      } else {
        if (isEmpty(locSelection.fokontany)) errors.push({ field: "fokontany", message: "Sélectionnez d'abord un fokontany dans le lieu d'implantation." });
        if (locSelection.fokontany && villageLoading) errors.push({ field: "aire_recrutement", message: "Les données ORS de l'aire de recrutement sont encore en cours de chargement." });
      }
      return errors;
    }

    case "pieces": {
      for (let i = 0; i < pieces.length; i++) {
        if (!pieces[i].fichier) errors.push({ field: `piece.${i}`, message: `La pièce « ${pieces[i].nom} » est obligatoire.` });
      }
      return errors;
    }

    default:
      return errors;
  }
};