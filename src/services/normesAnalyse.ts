// @ts-nocheck
// src/services/normesAnalyse.ts

export const STATUT = {
  OK: "ok",
  DEROG: "derog",
  KO: "ko",
  NV: "nv",
  NA: "na", // ✅ Non applicable (ex : obstacle physique)
  INFO: "info",
};

export const CAT = {
  OUVERTURE: "Ouverture",
  PEDAGO: "Pédagogie",
  DOSSIER: "Dossier",
  ADMIN: "Administration",
};

// Rayon réglementaire (km) par niveau
export const SEUILS_KM = { prescolaire: 0.8, primaire: 2, college: 5, lycee: 20 };

// ✅ NOUVEAU : norme de surface terrain (m²) — identique pour tous les niveaux
export const SURFACE_TERRAIN_MIN_M2 = 2000;

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
const txt = (v: any) =>
  String(v ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const num = (v: any) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const first = (o: any, keys: string[]) => {
  for (const k of keys) {
    if (o && o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k];
  }
  return undefined;
};

const bool = (v: any) => {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;
  const s = txt(v);
  if (["oui", "yes", "true", "vrai", "1", "present", "disponible", "central", "centrale"].includes(s)) return true;
  if (["non", "no", "false", "faux", "0", "absent", "indisponible"].includes(s)) return false;
  return null;
};

const niveau = (v: any) => {
  const s = txt(v);
  if (s.includes("lycee")) return "lycee";
  if (s.includes("college") || s.includes("ceg")) return "college";
  if (s.includes("presco")) return "prescolaire";
  return "primaire";
};

const nouvelleCreation = (v: any) => {
  const s = txt(v);
  return s === "nouvelle creation" || s === "nouvelle_creation" || s === "creation" || s.includes("nouvelle creation");
};

const regularisation = (v: any) => txt(v).includes("regularisation");

// ✅ NOUVEAU : détecter le sous-type (creation vs provisoire)
const estSousTypeProvisoire = (details: any) => {
  const st = txt(details?.sous_type);
  return st === "provisoire" || st.includes("provisoire");
};

const estSousTypeCreation = (details: any) => {
  const st = txt(details?.sous_type);
  return st === "creation" || st === "" || st.includes("nouvelle creation") || st.includes("creation");
};

const item = (id: string, categorie: string, libelle: string, norme: string, valeur: any, statut: string, detail: string) => ({ id, categorie, libelle, norme, valeur, statut, detail });

// ✅ Extrait une année numérique quel que soit le format.
function extraireAnnee(ligne: any): number {
  if (!ligne) return 0;

  const raw = first(ligne, [
    "annee",
    "annee_scolaire",
    "year",
    "ANNEE",
    "ANNEE_SCOLAIRE",
    "anneeScolaire",
    "Annee",
  ]);

  if (raw === undefined || raw === null || raw === "") return 0;

  const direct = Number(raw);
  if (Number.isFinite(direct)) return direct;

  const s = String(raw);

  const matchPlage = s.match(/(\d{4})\s*[-/]\s*(\d{4})/);
  if (matchPlage) return Number(matchPlage[2]);

  const matchSimple = s.match(/(\d{4})/);
  if (matchSimple) return Number(matchSimple[1]);

  return 0;
}

// ------------------------------------------------------------
// Extraction des données du dossier
// ------------------------------------------------------------
function effectifT5(x: any) {
  return num(first(x, ["effectif_t5", "eff_t5", "t5", "effectifT5", "total_t5"]));
}

function effectifT9(x: any) {
  return num(first(x, ["effectif_t9", "eff_t9", "t9", "effectifT9", "total_t9"]));
}

function populationScolarisable(x: any) {
  return num(first(x, [
    "population_scolarisable", "pop_scolarisable", "population_3_5",
    "population_6_10", "population_5_9", "population_cible",
  ]));
}

function populationTotale(x: any) {
  return num(first(x, ["population", "population_totale", "habitants", "nb_habitants"]));
}

function totalPopulationScolarisable(a: any[]) {
  if (!Array.isArray(a) || !a.length) return null;
  let total = 0;
  let found = false;
  for (const x of a) {
    const n = populationScolarisable(x);
    if (n !== null) { total += n; found = true; }
  }
  return found ? total : null;
}

function totalPopulation(a: any[]) {
  if (!Array.isArray(a) || !a.length) return null;
  let total = 0;
  let found = false;
  for (const x of a) {
    const n = populationTotale(x);
    if (n !== null) { total += n; found = true; }
  }
  return found ? total : null;
}

function totalT5(a: any[]) {
  if (!Array.isArray(a) || !a.length) return null;
  let total = 0;
  let found = false;
  for (const x of a) {
    const n = effectifT5(x);
    if (n !== null) { total += n; found = true; }
  }
  return found ? total : null;
}

function totalT9(a: any[]) {
  if (!Array.isArray(a) || !a.length) return null;
  let total = 0;
  let found = false;
  for (const x of a) {
    const n = effectifT9(x);
    if (n !== null) { total += n; found = true; }
  }
  return found ? total : null;
}

function distance(x: any) {
  return num(first(x, ["distance_km", "distance", "distance_etablissement", "distance_etab", "distance_proche"]));
}

function distanceM(x: any) {
  const d = num(first(x, ["distance_m", "distance_metre", "distance_metres"]));
  if (d !== null) return d;
  const km = distance(x);
  return km !== null ? km * 1000 : null;
}

function minDistance(a: any[]) {
  if (!Array.isArray(a) || !a.length) return null;
  const d = a.map(distance).filter((x) => x !== null && x > 0);
  return d.length ? Math.min(...d) : null;
}

function minDistanceM(a: any[]) {
  if (!Array.isArray(a) || !a.length) return null;
  const d = a.map(distanceM).filter((x) => x !== null && x > 0);
  return d.length ? Math.min(...d) : null;
}

function distancePlusProche(info: any, proches: any[]) {
  const d = num(first(info, ["distance_plus_proche"]));
  if (d !== null && d > 0) return d;

  const m = minDistance(proches);
  if (m !== null && m > 0) return m;

  if (d !== null) return d;
  return m;
}

function distancePlusProcheM(info: any, proches: any[]) {
  const d = num(first(info, ["distance_plus_proche_m", "distance_plus_proche_metres"]));
  if (d !== null && d > 0) return d;

  const dKm = num(first(info, ["distance_plus_proche"]));
  if (dKm !== null && dKm > 0) return dKm * 1000;

  const m = minDistanceM(proches);
  if (m !== null && m > 0) return m;

  if (dKm !== null) return dKm * 1000;
  return m;
}

function aucunProche(info: any, d: number | null) {
  return (d === null || d === 0) && bool(first(info, ["existe_proche"])) === false;
}

function central(details: any, info: any, aire: any[], proches: any[]) {
  const keys = ["position_centrale", "est_central", "est_centrale", "central", "centrale"];
  for (const source of [info, details, ...aire, ...proches]) {
    const b = bool(first(source, keys));
    if (b !== null) return b;
  }
  return null;
}

function ors(details: any, info: any, aire: any[]) {
  const keys = ["present_ors", "figure_ors", "dans_ors", "presence_ors", "eligible_ors", "ors_valide", "ors_conforme", "resultat_ors"];
  for (const source of [info, details]) {
    const b = bool(first(source, keys));
    if (b !== null) return b;
  }
  return Array.isArray(aire) && aire.length > 0 ? true : null;
}

function salles(details: any, info: any) {
  const sources = [
    details, info, details?.nouvelle_creation, details?.ressources, details?.ressource,
    details?.nouvelle_creation?.ressources, details?.regularisation,
  ];
  const keys = [
    "nombre_salle", "nb_salle", "nb_salles", "nombre_salles", "nb_salle_classe",
    "nombre_salle_classe", "nombre_salle_prevu", "nb_salles_classe", "salles", "salles_classe",
    "nbr_salle",
  ];
  for (const source of sources) {
    const n = num(first(source, keys));
    if (n !== null) return n;
  }
  return null;
}

// ✅ NOUVEAU : extraction de la surface du terrain (m²)
function surfaceTerrain(details: any, info: any) {
  const sources = [
    details,
    info,
    details?.nouvelle_creation,
    details?.regularisation,
    details?.ressources,
    details?.ressource,
    details?.nouvelle_creation?.ressources,
  ];
  const keys = [
    "surface_terrain",
    "surface_terrain_prevu",
    "superficie_terrain",
    "superficie",
    "surface",
    "surface_domaine",
    "superficie_domaine",
    "surface_totale",
    "superficie_totale",
    "terrain_surface",
  ];
  for (const source of sources) {
    const n = num(first(source, keys));
    if (n !== null && n > 0) {
      // ✅ Si la valeur semble être en hectares (< 100), on convertit en m²
      return n < 100 ? n * 10000 : n;
    }
  }
  return null;
}

function latrine(details: any, info: any) {
  const sources = [details, info, details?.nouvelle_creation, details?.ressources, details?.regularisation];
  const keys = [
    "latrine_separee", "latrines_separees", "latrine_separe", "latrines_separe",
    "latrine", "latrines", "toilettes_separees", "sanitaires_separes",
    "wc_separes", "latrine_filles_garcons", "latrine_fille_garcon",
  ];
  for (const source of sources) {
    const value = first(source, keys);
    const b = bool(value);
    if (b !== null) return b;
    if (typeof value === "string") {
      const t = txt(value);
      if (t.includes("separe")) return true;
      if (t.includes("sans latrine") || t.includes("absent")) return false;
    }
  }

  const sourcesFilles = [details, info, details?.nouvelle_creation, details?.regularisation, details?.ressources];
  let f = null, g = null;
  for (const s of sourcesFilles) {
    const vf = num(first(s, ["latrine_f", "latrines_f", "nb_latrine_filles"]));
    const vg = num(first(s, ["latrine_g", "latrines_g", "nb_latrine_garcons"]));
    if (vf !== null) f = vf;
    if (vg !== null) g = vg;
  }
  if (f !== null && g !== null) return f > 0 && g > 0;
  if (f !== null && f > 0) return true;
  if (g !== null && g > 0) return true;

  return null;
}

function domaineScolaire(details: any, info: any) {
  const sources = [details, info, details?.nouvelle_creation, details?.regularisation, details?.ressources];
  const keys = [
    "domaine_scolaire", "a_domaine_scolaire", "dispose_domaine_scolaire",
    "domaine_scolaire_disponible", "terrain_domaine_scolaire",
  ];
  for (const s of sources) {
    const b = bool(first(s, keys));
    if (b !== null) return b;
  }
  return null;
}

function espaceAdequat(details: any, info: any) {
  const sources = [details, info, details?.nouvelle_creation, details?.regularisation];
  const keys = [
    "espace_adequat", "espace_disponible", "a_espace_adequat",
    "dispose_espace_adequat", "terrain_disponible",
  ];
  for (const s of sources) {
    const b = bool(first(s, keys));
    if (b !== null) return b;
  }
  return null;
}

function educateur(details: any, info: any, enseignants: any[]) {
  const liste = Array.isArray(enseignants) ? enseignants : [];
  if (liste.length > 0) return true;

  const sources = [details, info, details?.nouvelle_creation, details?.regularisation];
  const keys = [
    "a_educateur", "dispose_educateur", "nombre_educateur", "nb_educateur",
    "nb_educateurs", "nombre_educateurs",
  ];
  for (const s of sources) {
    const v = first(s, keys);
    if (v === undefined || v === null || v === "") continue;
    const n = num(v);
    if (n !== null) return n >= 1;
    const b = bool(v);
    if (b !== null) return b;
  }
  return null;
}

function eppRattachement(details: any, info: any) {
  const sources = [details, info, details?.nouvelle_creation, details?.regularisation];
  const keys = [
    "epp_rattachement", "epp_de_rattachement", "dans_domaine_epp",
    "implantation_domaine_epp", "dans_domaine_scolaire_epp",
  ];
  for (const s of sources) {
    const b = bool(first(s, keys));
    if (b !== null) return b;
  }
  return null;
}

function villageSansEpp(details: any, info: any) {
  const sources = [details, info, details?.nouvelle_creation, details?.regularisation];
  const keys = [
    "village_sans_epp", "sans_epp", "village_depourvu_epp",
    "aucune_epp_village", "depourvu_epp",
  ];
  for (const s of sources) {
    const b = bool(first(s, keys));
    if (b !== null) return b;
  }
  return null;
}

function nombreEnfants(details: any, info: any, aire: any[], evolution: any[]) {
  const direct = num(first(details, [
    "nombre_enfants", "effectif_total", "effectif", "nombre_eleves",
    "effectif_prescolaire", "nombre_enfants_prescolaire",
  ]));
  if (direct !== null) return direct;

  const directReg = num(first(details?.regularisation, [
    "nombre_enfants", "effectif_total", "effectif", "nombre_eleves",
  ]));
  if (directReg !== null) return directReg;

  const directInfo = num(first(info, [
    "nombre_enfants", "effectif_total", "effectif", "nombre_eleves",
  ]));
  if (directInfo !== null) return directInfo;

  const popScol = totalPopulationScolarisable(aire);
  if (popScol !== null) return popScol;

  if (Array.isArray(evolution) && evolution.length) {
    const triee = [...evolution].sort((a, b) => extraireAnnee(b) - extraireAnnee(a));
    const last = triee[0];
    const t = num(first(last, ["effectif_total", "total", "effectif"]));
    if (t !== null) return t;
  }
  return null;
}

function isEtat(e: any) {
  const v = first(e, [
    "remunere_etat", "remunere_par_etat", "paye_par_etat", "pris_en_charge_etat",
    "fonctionnaire", "est_fonctionnaire", "etat", "salarie_etat",
    "statut_enseignant", "statut", "nombre_fonctionnaire", "nombre_enseignant_fonctionnaire",
  ]);
  const b = bool(v);
  if (b !== null) return b;
  const s = txt(v);
  return s.includes("fonctionnaire") || s.includes("etat") || s.includes("public") || s.includes("titulaire");
}

const profil = (e: any) => txt(first(e, ["type", "categorie", "discipline", "matiere", "matiere_enseignee_1", "specialite", "profil", "corps"]));

function scientifique(e: any) {
  const s = profil(e);
  return s.includes("scient") || s.includes("math") || s.includes("phys") || s.includes("chim") || s.includes("svt");
}

function litteraire(e: any) {
  const s = profil(e);
  return (
    s.includes("litter") || s.includes("franc") || s.includes("malg") ||
    s.includes("histo") || s.includes("geo") || s.includes("philo") || s.includes("langue")
  );
}

const MATIERES_LYCEE = [
  { code: "math", keys: ["math", "maths", "mathematique"], label: "Mathématiques" },
  { code: "phys", keys: ["phys", "physique"], label: "Physique" },
  { code: "svt", keys: ["svt", "science vie", "biologie"], label: "SVT" },
  { code: "franc", keys: ["franc", "francais"], label: "Français" },
  { code: "malg", keys: ["malg", "malgache"], label: "Malagasy" },
  { code: "histo", keys: ["histo", "histoire"], label: "Histoire" },
  { code: "geo", keys: ["geo", "geographie"], label: "Géographie" },
  { code: "philo", keys: ["philo", "philosophie"], label: "Philosophie" },
  { code: "anglais", keys: ["anglais", "angl"], label: "Anglais" },
];

function matiereCorrespond(profilTxt: string, keys: string[]) {
  return keys.some((k) => profilTxt.includes(k));
}

function couvertureMatieres(enseignants: any[]) {
  const liste = Array.isArray(enseignants) ? enseignants : [];
  const etat = liste.filter(isEtat);
  const resultats = [];
  let toutesCouvertes = true;

  for (const m of MATIERES_LYCEE) {
    const couverte = etat.some((e) => matiereCorrespond(profil(e), m.keys));
    if (!couverte) toutesCouvertes = false;
    resultats.push({ ...m, couverte });
  }
  return { toutesCouvertes, resultats };
}

function framQualifies(enseignants: any[]) {
  const liste = Array.isArray(enseignants) ? enseignants : [];
  return liste.filter((e) => {
    const s = txt(first(e, ["statut", "statut_enseignant", "type", "corps", "categorie"]));
    const estFram = s.includes("fram") || s.includes("non salarie") || s.includes("non_salarie") || s.includes("non fonctionnaire");
    if (!estFram) return false;
    const diplome = txt(first(e, ["diplome", "diplome_academique", "niveau_etude", "qualification", "grade"]));
    const aDiplome = diplome.includes("licence") || diplome.includes("master") || diplome.includes("bac") || diplome.length > 0;
    const aExperience = bool(first(e, ["a_exerce", "experience_public", "deja_exerce"])) === true;
    return aDiplome && aExperience;
  }).length;
}

function estEnseignantEtatLigne(e: any): boolean {
  if (!e) return false;

  const b = bool(first(e, [
    "remunere_etat", "remunere_par_etat", "paye_par_etat", "pris_en_charge_etat",
    "fonctionnaire", "est_fonctionnaire", "salarie_etat",
  ]));
  if (b === true) return true;
  if (b === false) return false;

  const s = txt(first(e, [
    "statut", "statut_enseignant", "type", "corps", "categorie", "etat",
  ]));

  if (s.includes("non fonctionnaire") || s.includes("non-fonctionnaire")) return false;
  if (s.includes("fram") || s.includes("non salarie") || s.includes("non_salarie")) return false;
  if (s.includes("prive") || s.includes("privee")) return false;

  if (
    s.includes("fonctionnaire") ||
    s.includes("etat") ||
    s.includes("public") ||
    s.includes("titulaire") ||
    s.includes("contractuel")
  ) {
    return true;
  }

  return false;
}

function enseignantsAnalyse(enseignants: any[], details: any) {
  const listeEnseignantsPrevus = Array.isArray(enseignants) ? enseignants : [];

  const personnelExistant = Array.isArray(details?.personnel_existant) ? details.personnel_existant : [];
  const personnelDetail = Array.isArray(details?.personnel_detail) ? details.personnel_detail : [];
  const personnelStats = Array.isArray(details?.personnel) ? details.personnel : [];

  let nombreTotal = null;
  let nombreEtat = null;

  if (listeEnseignantsPrevus.length > 0) {
    nombreTotal = listeEnseignantsPrevus.length;
    const etatLignes = listeEnseignantsPrevus.filter(estEnseignantEtatLigne);
    nombreEtat = etatLignes.length;
  }

  if (nombreEtat === null && personnelExistant.length > 0) {
    const trie = [...personnelExistant].sort((a, b) => extraireAnnee(b) - extraireAnnee(a));
    for (const ligne of trie) {
      const n = num(first(ligne, [
        "nombre_fonctionnaire", "nombre_enseignant_fonctionnaire",
        "fonctionnaire", "nombre_enseignants_etat",
      ]));
      if (n !== null) { nombreEtat = n; break; }
    }
  }

  if (nombreEtat === null && personnelDetail.length > 0) {
    nombreEtat = personnelDetail.filter(isEtat).length;
  }

  if (nombreEtat === null && personnelStats.length > 0) {
    const trie = [...personnelStats].sort((a, b) => extraireAnnee(b) - extraireAnnee(a));
    for (const ligne of trie) {
      const n = num(first(ligne, [
        "nombre_fonctionnaire", "nombre_enseignant_fonctionnaire", "fonctionnaire",
      ]));
      if (n !== null) { nombreEtat = n; break; }
    }
  }

  if (nombreTotal === null && personnelExistant.length > 0) {
    const trie = [...personnelExistant].sort((a, b) => extraireAnnee(b) - extraireAnnee(a));
    const n = num(first(trie[0], ["nombre_enseignants", "nombre_enseignant", "personnel_total", "nombre_personnel_total"]));
    if (n !== null) nombreTotal = n;
  }
  if (nombreTotal === null && personnelStats.length > 0) {
    const trie = [...personnelStats].sort((a, b) => extraireAnnee(b) - extraireAnnee(a));
    const n = num(first(trie[0], ["nombre_enseignants", "nombre_enseignant", "personnel_total", "nombre_personnel_total"]));
    if (n !== null) nombreTotal = n;
  }

  let sci = listeEnseignantsPrevus.some(scientifique);
  let lit = listeEnseignantsPrevus.some(litteraire);

  if (!sci || !lit) {
    const etatListe = listeEnseignantsPrevus.filter(estEnseignantEtatLigne);
    if (!sci) sci = etatListe.some(scientifique);
    if (!lit) lit = etatListe.some(litteraire);
  }

  if (!sci || !lit) {
    const ligneS = personnelExistant.length > 0
      ? personnelExistant[0]
      : personnelStats.length > 0
      ? personnelStats[0]
      : null;
    if (ligneS) {
      const nSci = num(first(ligneS, ["nombre_scientifique", "scientifique"]));
      const nLit = num(first(ligneS, ["nombre_litteraire", "litteraire"]));
      if (nSci !== null && nSci > 0) sci = true;
      if (nLit !== null && nLit > 0) lit = true;
    }
  }

  if (!sci || !lit) {
    for (const p of personnelDetail) {
      if (!sci && scientifique(p)) sci = true;
      if (!lit && litteraire(p)) lit = true;
    }
  }

  if (!sci) sci = Boolean(bool(first(details, ["enseignant_scientifique", "presence_enseignant_scientifique", "scientifique"])));
  if (!lit) lit = Boolean(bool(first(details, ["enseignant_litteraire", "presence_enseignant_litteraire", "litteraire"])));

  return {
    nombreEtat,
    nombreTotal,
    scientifique: sci,
    litteraire: lit,
  };
}

// ------------------------------------------------------------
// Helpers régularisation / ouverture définitive
// ------------------------------------------------------------

function effectifTotal(details: any, info: any, evolution: any[]) {
  const direct = num(first(details, [
    "effectif_total", "effectif", "nombre_eleves", "effectif_eleves",
    "effectif_etablissement", "total_eleves",
  ]));
  if (direct !== null && direct > 0) return direct;

  const reg = details?.regularisation;
  const directReg = num(first(reg, ["effectif_total", "effectif", "nombre_eleves", "effectif_eleves"]));
  if (directReg !== null && directReg > 0) return directReg;

  const directInfo = num(first(info, ["effectif_total", "effectif", "nombre_eleves", "effectif_eleves"]));
  if (directInfo !== null && directInfo > 0) return directInfo;

  if (Array.isArray(evolution) && evolution.length > 0) {
    const triee = [...evolution].sort((a, b) => extraireAnnee(b) - extraireAnnee(a));
    const derniere = triee[0];
    if (!derniere) return null;

    const total = num(first(derniere, ["effectif_total", "total", "effectif", "TOTAL"]));
    if (total !== null && total > 0) return total;

    let sum = 0;
    let found = false;
    for (const [k, v] of Object.entries(derniere || {})) {
      if (/^eff_|^_2nde$|^_1re$|^tle$/.test(k)) {
        const n = num(v);
        if (n !== null) { sum += n; found = true; }
      }
    }
    if (found && sum > 0) return sum;
  }

  return null;
}

function codeProvisoire(details: any, info: any) {
  const sources = [
    details,
    info,
    details?.regularisation,
    details?.ressources,
    details?.nouvelle_creation,
  ];

  const keys = [
    "code_provisoire",
    "code_provisoire_men",
    "numero_code_provisoire",
    "code_men",
    "code_etab_provisoire",
    "code_etab",
    "code_etablissement",
    "etablissement_existant_id",
    "a_code_provisoire",
    "dispose_code_provisoire",
  ];

  for (const s of sources) {
    const v = first(s, keys);
    if (v !== undefined && v !== null && v !== "") {
      const b = bool(v);
      if (b === true) return true;
      if (b === false) continue;
      const t = String(v).trim();
      if (t.length > 0 && txt(t) !== "non") return true;
    }
  }
  return null;
}

function evolutionPositive(evolution: any[]) {
  if (!Array.isArray(evolution) || evolution.length < 3) {
    return { stable: null, positif: null, details: "Moins de 3 années renseignées" };
  }

  const triee = [...evolution].sort((a, b) => extraireAnnee(a) - extraireAnnee(b));
  const last3 = triee.slice(-3);

  const totals = last3.map((e) => {
    const t = num(first(e, ["effectif_total", "total", "effectif"]));
    if (t !== null && t > 0) return t;
    let sum = 0, found = false;
    for (const [k, v] of Object.entries(e || {})) {
      if (/^eff_|^_2nde$|^_1re$|^tle$/.test(k)) {
        const n = num(v);
        if (n !== null) { sum += n; found = true; }
      }
    }
    return found ? sum : null;
  });

  if (totals.some((t) => t === null)) {
    return { stable: null, positif: null, details: "Effectifs incomplets sur 3 ans" };
  }

  const [a, b, c] = totals as number[];
  const stable = c >= Math.min(a, b) * 0.9;
  const positif = c > a && c >= b;

  return {
    stable,
    positif,
    details: `Effectifs : ${a} → ${b} → ${c}`,
    totals,
  };
}

function etabsSatures(proches: any[], niveauCible: string, seuilPct: number, rayonKm: number) {
  if (!Array.isArray(proches) || !proches.length) return null;

  const cibles = proches.filter((p) => {
    const d = distance(p);
    const niv = txt(first(p, ["niveau", "niveau_etab", "type"]));
    const matchNiveau =
      niveauCible === "college"
        ? (niv.includes("college") || niv.includes("ceg") || niv === "")
        : (niv.includes("lycee") || niv === "");
    return d !== null && d < rayonKm && matchNiveau;
  });

  const nomNiveau = niveauCible === "college" ? "CEG" : "Lycée";

  if (!cibles.length) return { aucun: true, satures: false, details: `Aucun ${nomNiveau} à moins de ${rayonKm} km` };

  let tousSatures = true;
  const details: string[] = [];
  const seuil = seuilPct / 100;

  for (const c of cibles) {
    const capacite = num(first(c, ["capacite", "capacite_accueil", "capacite_totale"]));
    const effectif = num(first(c, ["effectif", "effectif_total", "nombre_eleves"]));
    const salles = num(first(c, ["nombre_salle", "nb_salle", "salles"]));
    const nom = first(c, ["nom", "nom_etab"]) || nomNiveau;

    if (capacite && effectif) {
      const taux = effectif / capacite;
      if (taux < seuil) tousSatures = false;
      details.push(`${nom} : ${(taux * 100).toFixed(1)}%`);
    } else if (salles && effectif) {
      const taux = effectif / (salles * 50);
      if (taux < seuil) tousSatures = false;
      details.push(`${nom} : ${(taux * 100).toFixed(1)}%`);
    } else {
      tousSatures = false;
      details.push(`${nom} : données manquantes`);
    }
  }

  const extensionPossible = cibles.some((c) => bool(first(c, ["extension_possible", "possibilite_extension"])) === true);
  if (extensionPossible) tousSatures = false;

  return { aucun: false, satures: tousSatures, details: details.join(" ; ") };
}

function cegSatures(proches: any[]) {
  return etabsSatures(proches, "college", 98, 5);
}

function lyceeSatures(proches: any[]) {
  return etabsSatures(proches, "lycee", 90, 20);
}

function accessibilite(details: any, info: any, aire: any[], proches: any[]) {
  const sources = [info, details, ...aire, ...proches];
  const keys = [
    "accessible", "accessibilite", "site_accessible", "acces_facile",
    "facilement_accessible", "presence_route", "route_praticable",
    "obstacle", "nature_obstacle",
  ];
  for (const s of sources) {
    const v = first(s, keys);
    if (v === undefined || v === null || v === "") continue;
    const b = bool(v);
    if (b !== null) return b;
    const t = txt(v);
    if (t.includes("non accessible") || t.includes("inaccessible") || t.includes("obstacle")) return false;
    if (t.includes("accessible") || t.includes("facile")) return true;
  }
  return null;
}

function sallesAppartenance(details: any, info: any) {
  const sources = [details, info, details?.regularisation, details?.ressources];
  const keys = [
    "nombre_salle_appartenance", "salles_appartenance", "nb_salles_propres",
    "salles_propres", "nombre_salle_propre",
  ];
  for (const s of sources) {
    const n = num(first(s, keys));
    if (n !== null) return n;
  }
  return salles(details, info);
}

function obstaclesPhysiques(details: any, info: any, proches: any[]) {
  const MOTS_OBSTACLES = [
    "riviere", "rivière", "fleuve", "foret dense", "forêt dense",
    "falaise", "montagne", "ravin", "lac", "marais", "zone inondee",
    "zone inondée", "obstacle physique", "obstacle naturel",
    "cours d'eau", "cours d eau", "torrent", "vallee profonde",
    "riviere d antsahaparasy", "mahajamba",
  ];

  const sources = [
    info,
    details,
    ...(Array.isArray(proches) ? proches : []),
  ];

  const keysObstacleBool = ["obstacle", "obstacle_physique", "presence_obstacle", "a_obstacle"];

  for (const s of sources) {
    for (const k of keysObstacleBool) {
      if (!s || s[k] === undefined || s[k] === null || s[k] === "") continue;

      const b = bool(s[k]);
      if (b === true) return true;
    }
  }

  const keysNature = [
    "nature_obstacle",
    "type_obstacle",
    "obstacle_naturel",
    "description_obstacle",
  ];

  for (const s of sources) {
    for (const k of keysNature) {
      const v = s?.[k];
      if (v === undefined || v === null || v === "") continue;

      const t = txt(v);
      if (MOTS_OBSTACLES.some((mot) => t.includes(txt(mot)))) return true;
    }
  }

  return false;
}

function zoneVulnerable(details: any, info: any) {
  const sources = [info, details];

  const keys = [
    "zone_vulnerable",
    "zone_enclavee",
    "zone_eloignee",
    "zone_isolee",
    "enclave",
    "site_vulnerable",
    "site_enclave",
    "site_isole",
    "tres_eloigne",
    "eloignement_important",
    "localite_vulnerable",
    "commune_vulnerable",
    "zone_rouge",
    "zone_prioritaire",
    "peu_accessibles",
    "enclavement",
  ];

  for (const s of sources) {
    for (const k of keys) {
      const v = s?.[k];
      if (v === undefined || v === null || v === "") continue;

      const b = bool(v);
      if (b === true) return true;
      if (b === false) continue;

      const t = txt(v);
      if (
        t.includes("vulnerable") ||
        t.includes("enclav") ||
        t.includes("isole") ||
        t.includes("isolee") ||
        t.includes("eloigne") ||
        t.includes("eloignee") ||
        t.includes("prioritaire") ||
        t.includes("rouge")
      ) {
        return true;
      }
    }
  }

  return false;
}

// ------------------------------------------------------------
// Contexte d'analyse
// ------------------------------------------------------------
export function buildAnalyseContext({
  details,
  enseignants = [],
  infoComplementaire = {},
  etablissementsProches = [],
  aireRecrutement = [],
  evolutionEffectifs = [],
  pieces = [],
  niveauKey,
}: any) {
  const d = details || {};
  const info = infoComplementaire || {};
  const proches = Array.isArray(etablissementsProches) ? etablissementsProches : [];
  const aire = Array.isArray(aireRecrutement) ? aireRecrutement : [];
  const evolution = Array.isArray(evolutionEffectifs) ? evolutionEffectifs : [];

  const ensListe = Array.isArray(enseignants) ? enseignants : [];
  const ens = enseignantsAnalyse(ensListe, d);
  const dist = distancePlusProche(info, proches);
  const distM = distancePlusProcheM(info, proches);
  const evo = evolutionPositive(evolution);
  const couverture = couvertureMatieres(ensListe);

  // ✅ NOUVEAU : détection du sous-type
  const sousTypeProvisoire = estSousTypeProvisoire(d);
  const sousTypeCreation = estSousTypeCreation(d);
  const estNouvelleCreation = nouvelleCreation(d.type_demande);
  const estRegularisation = regularisation(d.type_demande);

  return {
    details: d,
    enseignants: ensListe,
    infoComplementaire: info,
    etablissementsProches: proches,
    aireRecrutement: aire,
    evolutionEffectifs: evolution,
    pieces: Array.isArray(pieces) ? pieces : [],
    niveauKey: niveauKey || niveau(d.niveau_etab || d.niveau),
    typeDemande: String(d.type_demande || "").trim(),
    nouvelleCreation: estNouvelleCreation,
    regularisation: estRegularisation,

    // ✅ NOUVEAU : sous-type
    sousType: d.sous_type || "creation",
    estSousTypeProvisoire: estNouvelleCreation && sousTypeProvisoire,
    estSousTypeCreation: estNouvelleCreation && sousTypeCreation,

    totalT5: totalT5(aire),
    totalT9: totalT9(aire),
    totalPopulationScolarisable: totalPopulationScolarisable(aire),
    totalPopulation: totalPopulation(aire),
    distancePlusProche: dist,
    distancePlusProcheM: distM,
    aucunProche: aucunProche(info, dist),
    nombreSalles: salles(d, info),

    // ✅ NOUVEAU : surface terrain
    surfaceTerrain: surfaceTerrain(d, info),

    latrineSeparee: latrine(d, info),
    nombreEnseignantsEtat: ens.nombreEtat,
    nombreEnseignantsTotal: ens.nombreTotal,
    scientifique: ens.scientifique,
    litteraire: ens.litteraire,
    positionCentrale: central(d, info, aire, proches),
    presenceORS: ors(d, info, aire),

    effectifTotal: effectifTotal(d, info, evolution),
    nombreEnfants: nombreEnfants(d, info, aire, evolution),
    codeProvisoire: codeProvisoire(d, info),
    evolutionPositive: evo.positif,
    evolutionStable: evo.stable,
    evolutionDetails: evo.details,
    accessibilite: accessibilite(d, info, aire, proches),
    cegSatures: cegSatures(proches),
    lyceeSatures: lyceeSatures(proches),
    nombreSallesAppartenance: sallesAppartenance(d, info),
    framQualifies: framQualifies(ensListe),
    couvertureMatieres: couverture,
    domaineScolaire: domaineScolaire(d, info),
    espaceAdequat: espaceAdequat(d, info),
    educateur: educateur(d, info, ensListe),
    eppRattachement: eppRattachement(d, info),
    villageSansEpp: villageSansEpp(d, info),

    obstaclesPhysiques: obstaclesPhysiques(d, info, proches),
    zoneVulnerable: zoneVulnerable(d, info),
  };
}

export function detectPhase(c: any) {
  // ✅ Nouvelle création → toujours "provisoire" (le sous-type est géré séparément)
  return c?.nouvelleCreation ? "provisoire" : "definitive";
}

// ------------------------------------------------------------
// Critère distance générique (km)
// ------------------------------------------------------------
function critereDistance(c: any) {
  const seuil = SEUILS_KM[c?.niveauKey] ?? 5;
  const d = c.distancePlusProche;

  if (c?.obstaclesPhysiques === true) {
    return item(
      "critere-distance",
      CAT.OUVERTURE,
      "Distance de l'établissement le plus proche",
      `L'établissement le plus proche doit être situé à plus de ${seuil} km.`,
      "Obstacle physique détecté",
      STATUT.NA,
      "Des obstacles physiques (rivière, forêt dense, falaise, etc.) séparent le nouvel établissement des établissements environnants : la norme de distance ne s'applique pas."
    );
  }

  let statut = STATUT.KO;
  let valeur = "Non renseignée";
  let detail = "La distance de l'établissement le plus proche n'est pas renseignée : l'analyse est non validée.";

  if (d !== null && d > 0) {
    valeur = `${d.toFixed(2)} km`;
    if (d > seuil) {
      statut = STATUT.OK;
      detail = `La distance (${d.toFixed(2)} km) est supérieure à ${seuil} km.`;
    } else {
      detail = `La distance est de ${d.toFixed(2)} km, donc inférieure ou égale à ${seuil} km.`;
    }
  } else if (c.aucunProche) {
    statut = STATUT.OK;
    valeur = `Aucun établissement proche (> ${seuil} km)`;
    detail = `Aucun établissement du même niveau n'a été trouvé dans la zone : la distance dépasse ${seuil} km.`;
  }

  return item(
    "critere-distance",
    CAT.OUVERTURE,
    "Distance de l'établissement le plus proche",
    `L'établissement le plus proche doit être situé à plus de ${seuil} km.`,
    valeur,
    statut,
    detail
  );
}

// ✅ NOUVEAU : critère surface du terrain ≥ 2000 m²
function critereSurfaceTerrain(c: any) {
  const s = c.surfaceTerrain;
  const seuil = SURFACE_TERRAIN_MIN_M2;
  return item(
    "critere-surface-terrain",
    CAT.OUVERTURE,
    "Superficie du terrain",
    `La superficie du terrain doit être d'au moins ${seuil} m².`,
    s === null ? "Non renseignée" : `${s.toLocaleString("fr-FR")} m²`,
    s !== null && s >= seuil ? STATUT.OK : STATUT.KO,
    s === null
      ? "La superficie du terrain n'est pas renseignée : l'analyse est non validée."
      : s >= seuil
      ? `La superficie (${s.toLocaleString("fr-FR")} m²) respecte la norme de ${seuil} m².`
      : `La superficie (${s.toLocaleString("fr-FR")} m²) est inférieure à la norme de ${seuil} m².`
  );
}

// ============================================================
// PRÉSCOLAIRE
// ============================================================

function prescolaireCommuns(c: any): any[] {
  const a: any[] = [];

  const n = c.nombreEnfants;
  a.push(item(
    "critere-enfants",
    CAT.OUVERTURE,
    "Effectif des enfants",
    "L'établissement doit avoir au moins 25 enfants.",
    n === null ? "Non renseigné" : `${n} enfant(s)`,
    n !== null && n >= 25 ? STATUT.OK : STATUT.KO,
    n === null
      ? "Effectif des enfants non renseigné : l'analyse est non validée."
      : n >= 25
      ? "Le seuil minimal de 25 enfants est atteint."
      : `Le seuil minimal de 25 enfants n'est pas atteint (${n} enfants).`
  ));

  const dom = c.domaineScolaire;
  a.push(item(
    "critere-domaine-scolaire",
    CAT.OUVERTURE,
    "Domaine scolaire",
    "L'établissement doit disposer d'un domaine scolaire.",
    dom === true ? "Oui" : dom === false ? "Non" : "Non renseigné",
    dom === true ? STATUT.OK : STATUT.KO,
    dom === true
      ? "Le domaine scolaire est disponible."
      : dom === false
      ? "L'établissement ne dispose pas de domaine scolaire : l'analyse est non validée."
      : "Le domaine scolaire n'est pas renseigné : l'analyse est non validée."
  ));

  const s = c.nombreSalles;
  a.push(item(
    "critere-salle",
    CAT.PEDAGO,
    "Au moins une salle de classe conforme aux normes",
    "L'établissement doit disposer d'au moins une salle de classe conforme aux normes.",
    s === null ? "Non renseigné" : `${s} salle(s)`,
    s !== null && s >= 1 ? STATUT.OK : STATUT.KO,
    s === null
      ? "Le nombre de salles n'est pas renseigné : l'analyse est non validée."
      : s >= 1
      ? "Au moins une salle de classe est disponible."
      : "Aucune salle de classe n'est renseignée : l'analyse est non validée."
  ));

  const e = c.educateur;
  a.push(item(
    "critere-educateur",
    CAT.PEDAGO,
    "Au moins un éducateur",
    "L'établissement doit disposer d'au moins un éducateur.",
    e === true ? "Oui" : e === false ? "Non" : "Non renseigné",
    e === true ? STATUT.OK : STATUT.KO,
    e === true
      ? "Au moins un éducateur est présent."
      : e === false
      ? "Aucun éducateur n'est présent : l'analyse est non validée."
      : "La présence d'un éducateur n'est pas renseignée : l'analyse est non validée."
  ));

  const epp = c.eppRattachement;
  a.push(item(
    "critere-epp-rattachement",
    CAT.OUVERTURE,
    "Implantation dans le domaine scolaire de l'EPP de rattachement",
    "L'implantation doit être dans le domaine scolaire de l'EPP de rattachement.",
    epp === true ? "Oui" : epp === false ? "Non" : "Non renseigné",
    epp === true ? STATUT.OK : STATUT.KO,
    epp === true
      ? "L'implantation est dans le domaine scolaire de l'EPP de rattachement."
      : epp === false
      ? "L'implantation n'est pas dans le domaine scolaire de l'EPP de rattachement : l'analyse est non validée."
      : "L'implantation dans le domaine scolaire de l'EPP de rattachement n'est pas renseignée : l'analyse est non validée."
  ));

  const sansEpp = c.villageSansEpp;
  a.push(item(
    "critere-village-sans-epp",
    CAT.OUVERTURE,
    "Le village est dépourvu d'EPP",
    "Le village doit être dépourvu d'EPP.",
    sansEpp === true ? "Oui" : sansEpp === false ? "Non" : "Non renseigné",
    sansEpp === true ? STATUT.OK : STATUT.KO,
    sansEpp === true
      ? "Le village est bien dépourvu d'EPP."
      : sansEpp === false
      ? "Le village dispose déjà d'une EPP : l'analyse est non validée."
      : "L'absence d'EPP dans le village n'est pas renseignée : l'analyse est non validée."
  ));

  const dM = c.distancePlusProcheM;
  const seuilM = 800;

  if (c.obstaclesPhysiques === true) {
    a.push(item(
      "critere-distance-800m",
      CAT.OUVERTURE,
      "Distance de l'EPP la plus proche",
      `L'EPP la plus proche doit être située à plus de ${seuilM} m.`,
      "Obstacle physique détecté",
      STATUT.NA,
      "Des obstacles physiques (rivière, forêt dense, falaise, etc.) séparent le nouvel établissement des EPP environnantes : la norme de distance ne s'applique pas."
    ));
  } else {
    let statutDist = STATUT.KO;
    let valeurDist = "Non renseignée";
    let detailDist = "La distance de l'EPP la plus proche n'est pas renseignée : l'analyse est non validée.";

    if (dM !== null && dM > 0) {
      valeurDist = `${Math.round(dM)} m`;
      if (dM > seuilM) {
        statutDist = STATUT.OK;
        detailDist = `La distance (${Math.round(dM)} m) est supérieure à ${seuilM} m : conforme.`;
      } else {
        detailDist = `La distance (${Math.round(dM)} m) est inférieure ou égale à ${seuilM} m : non conforme.`;
      }
    } else if (c.aucunProche) {
      statutDist = STATUT.OK;
      valeurDist = `Aucune EPP proche (< ${seuilM} m)`;
      detailDist = `Aucune EPP n'a été trouvée dans la zone : conforme.`;
    }

    a.push(item(
      "critere-distance-800m",
      CAT.OUVERTURE,
      "Distance de l'EPP la plus proche",
      `L'EPP la plus proche doit être située à plus de ${seuilM} m.`,
      valeurDist,
      statutDist,
      detailDist
    ));
  }

  const acc = c.accessibilite;
  a.push(item(
    "critere-accessibilite",
    CAT.OUVERTURE,
    "Site d'implantation facilement accessible par les enfants",
    "Le site d'implantation doit être facilement accessible par les enfants.",
    acc === true ? "Oui" : acc === false ? "Non" : "Non renseigné",
    acc === true ? STATUT.OK : STATUT.KO,
    acc === true
      ? "Le site est facilement accessible par les enfants."
      : acc === false
      ? "Le site n'est pas facilement accessible : l'analyse est non validée."
      : "L'accessibilité du site n'est pas renseignée : l'analyse est non validée."
  ));

  const esp = c.espaceAdequat;
  a.push(item(
    "critere-espace-adequat",
    CAT.OUVERTURE,
    "Espace adéquat pour l'implantation",
    "L'espace adéquat pour l'implantation doit être disponible.",
    esp === true ? "Oui" : esp === false ? "Non" : "Non renseigné",
    esp === true ? STATUT.OK : STATUT.KO,
    esp === true
      ? "L'espace adéquat pour l'implantation est disponible."
      : esp === false
      ? "L'espace adéquat pour l'implantation n'est pas disponible : l'analyse est non validée."
      : "La disponibilité de l'espace adéquat n'est pas renseignée : l'analyse est non validée."
  ));

  // ✅ NOUVEAU : critère surface terrain
  a.push(critereSurfaceTerrain(c));

  return a;
}

function prescolaireProvisoire(c: any) {
  const a = prescolaireCommuns(c);

  const popScol = c.totalPopulationScolarisable;
  a.unshift(item(
    "critere-population-scolarisable",
    CAT.OUVERTURE,
    "Total de la population scolarisable dans l'aire de recrutement",
    "Le total de la population scolarisable dans la liste des villages alimentant le futur établissement doit être d'au moins 25.",
    popScol === null ? "Non renseigné" : `${popScol} enfant(s) scolarisable(s)`,
    popScol !== null && popScol >= 25 ? STATUT.OK : STATUT.KO,
    popScol === null
      ? "La population scolarisable n'est pas renseignée : l'analyse est non validée."
      : popScol >= 25
      ? "Le seuil minimal de 25 enfants scolarisables est atteint."
      : `Le seuil minimal de 25 enfants scolarisables n'est pas atteint (${popScol}).`
  ));

  return a;
}

function prescolaireDefinitif(c: any) {
  return prescolaireCommuns(c);
}

// ============================================================
// PRIMAIRE
// ============================================================

function primaireNouvelleCreation(c: any) {
  const a: any[] = [];

  // ① 50 ménages ou 300 habitants minimum
  const popScol = c.totalPopulationScolarisable;
  const popTot = c.totalPopulation;
  const okPopScol = popScol !== null && popScol >= 50;
  const okPopTot = popTot !== null && popTot >= 300;
  const okPop = okPopScol || okPopTot;

  a.push(item(
    "critere-population",
    CAT.OUVERTURE,
    "Population de l'aire de recrutement",
    "Le nombre d'habitants de l'aire de recrutement : 50 ménages ou 300 habitants minimum.",
    `Population scolarisable : ${popScol ?? "?"} ; Population totale : ${popTot ?? "?"}`,
    okPop ? STATUT.OK : STATUT.KO,
    okPop
      ? "Le seuil de population est atteint (50 scolarisables ou 300 habitants)."
      : popScol === null && popTot === null
      ? "La population de l'aire de recrutement n'est pas renseignée : l'analyse est non validée."
      : `Le seuil n'est pas atteint (scolarisable : ${popScol ?? "?"} / 50 ; total : ${popTot ?? "?"} / 300).`
  ));

  // ② Village facilement accessible
  const acc = c.accessibilite;
  a.push(item(
    "critere-accessibilite",
    CAT.OUVERTURE,
    "Village d'implantation facilement accessible",
    "Le village d'implantation est facilement accessible par rapport à l'aire de recrutement.",
    acc === true ? "Oui" : acc === false ? "Non" : "Non renseigné",
    acc === true ? STATUT.OK : STATUT.KO,
    acc === true
      ? "Le village est facilement accessible."
      : acc === false
      ? "Le village n'est pas facilement accessible : l'analyse est non validée."
      : "L'accessibilité du village n'est pas renseignée : l'analyse est non validée."
  ));

  // ③ Site dans ORS
  const o = c.presenceORS;
  a.push(item(
    "critere-ors",
    CAT.OUVERTURE,
    "Présence dans les résultats ORS",
    "Les sites d'implantation figurent dans les résultats de l'organisation du réseau scolaire (ORS).",
    o === true ? "Oui" : o === false ? "Non" : "Non renseignée",
    o === true ? STATUT.OK : STATUT.KO,
    o === true
      ? "Le site figure dans les résultats ORS."
      : "Le résultat ORS n'est pas renseigné ou le site n'y figure pas : l'analyse est non validée."
  ));

  // ✅ NOUVEAU : ④ Superficie du terrain ≥ 2000 m²
  a.push(critereSurfaceTerrain(c));

  return a;
}

function primaireOuvertureProvisoire(c: any) {
  const a: any[] = [];

  // ① Effectif total ≥ 50 élèves
  const eff = c.effectifTotal;
  a.push(item(
    "critere-effectif-total",
    CAT.OUVERTURE,
    "Effectif total des élèves",
    "L'effectif total des élèves doit être au minimum 50.",
    eff === null ? "Non renseigné" : `${eff} élèves`,
    eff !== null && eff >= 50 ? STATUT.OK : STATUT.KO,
    eff === null
      ? "Effectif total non renseigné : l'analyse est non validée."
      : eff >= 50
      ? "Le seuil minimal de 50 élèves est atteint."
      : `Le seuil minimal de 50 élèves n'est pas atteint (${eff} élèves).`
  ));

  // ② Distance > 2 km (écoles privées incluses)
  const seuil = SEUILS_KM.primaire;
  const d = c.distancePlusProche;

  if (c.obstaclesPhysiques === true) {
    a.push(item(
      "critere-distance",
      CAT.OUVERTURE,
      "Distance de l'établissement le plus proche",
      `L'établissement le plus proche doit se situer à plus de ${seuil} km en prenant en compte les écoles privées.`,
      "Obstacle physique détecté",
      STATUT.NA,
      "Des obstacles physiques (rivière, forêt dense, falaise, etc.) séparent le nouvel établissement des établissements environnants : la norme de distance ne s'applique pas."
    ));
  } else {
    let statutDist = STATUT.KO;
    let valeurDist = "Non renseignée";
    let detailDist = "La distance n'est pas renseignée : l'analyse est non validée.";

    if (d !== null && d > seuil) {
      statutDist = STATUT.OK;
      valeurDist = `${d.toFixed(2)} km`;
      detailDist = `La distance (${d.toFixed(2)} km) est supérieure à ${seuil} km : conforme.`;
    } else if (d !== null && d <= seuil) {
      statutDist = STATUT.KO;
      valeurDist = `${d.toFixed(2)} km`;
      detailDist = `L'établissement le plus proche (écoles privées incluses) est à ${d.toFixed(2)} km ≤ ${seuil} km : non conforme.`;
    } else if (d === null && c.aucunProche) {
      statutDist = STATUT.OK;
      valeurDist = `Aucun établissement proche (> ${seuil} km)`;
      detailDist = `Aucun établissement n'a été trouvé dans la zone : conforme.`;
    }

    a.push(item(
      "critere-distance",
      CAT.OUVERTURE,
      "Distance de l'établissement le plus proche",
      `L'établissement le plus proche doit se situer à plus de ${seuil} km en prenant en compte les écoles privées.`,
      valeurDist,
      statutDist,
      detailDist
    ));
  }

  // ③ Au moins 2 salles équipées + latrine séparée
  const s = c.nombreSalles;
  const l = c.latrineSeparee;
  const okLocaux = s !== null && s >= 2 && l === true;
  a.push(item(
    "critere-locaux",
    CAT.PEDAGO,
    "Salles de classe équipées et latrine séparée",
    "L'existence d'au moins 2 salles de classe équipées et de latrines séparées.",
    `${s === null ? "Salles non renseignées" : `${s} salle(s)`} ; latrine séparée : ${l === true ? "Oui" : l === false ? "Non" : "Non renseignée"}`,
    okLocaux ? STATUT.OK : STATUT.KO,
    okLocaux
      ? "Les infrastructures demandées sont conformes."
      : s === null
      ? "Le nombre de salles n'est pas renseigné : l'analyse est non validée."
      : s < 2
      ? `Seulement ${s} salle(s) ; au moins 2 sont nécessaires.`
      : "La latrine séparée n'est pas présente ou n'est pas renseignée : l'analyse est non validée."
  ));

  // ④ Au moins 1 enseignant payé par l'État
  const ne = c.nombreEnseignantsEtat;
  a.push(item(
    "critere-enseignants-etat",
    CAT.PEDAGO,
    "Enseignant rémunéré par l'État",
    "L'établissement dispose d'au moins un enseignant rémunéré par l'État.",
    ne === null ? "Non renseigné" : `${ne} enseignant(s) État`,
    ne !== null && ne >= 1 ? STATUT.OK : STATUT.KO,
    ne === null
      ? "Le nombre d'enseignants État n'est pas renseigné : l'analyse est non validée."
      : ne >= 1
      ? "Au moins un enseignant État est présent."
      : "Aucun enseignant État n'est présent : l'analyse est non validée."
  ));

  // ✅ NOUVEAU : ⑤ Superficie du terrain ≥ 2000 m²
  a.push(critereSurfaceTerrain(c));

  return a;
}

function primaireDefinitif(c: any) {
  const a: any[] = [];

  const eff = c.effectifTotal;
  a.push(item(
    "critere-effectif-total",
    CAT.OUVERTURE,
    "Effectif total des élèves",
    "L'effectif total des élèves doit être d'au minimum 100.",
    eff === null ? "Non renseigné" : `${eff} élèves`,
    eff !== null && eff >= 100 ? STATUT.OK : STATUT.KO,
    eff === null
      ? "Effectif total non renseigné : l'analyse est non validée."
      : eff >= 100
      ? "Le seuil minimal de 100 élèves est atteint."
      : `Le seuil minimal de 100 élèves n'est pas atteint (${eff} élèves).`
  ));

  const ne = c.nombreEnseignantsEtat;
  a.push(item(
    "critere-enseignants-etat",
    CAT.PEDAGO,
    "Enseignants rémunérés par l'État",
    "L'établissement dispose d'enseignants rémunérés par l'État.",
    ne === null ? "Non renseigné" : `${ne} enseignant(s) État`,
    ne !== null && ne >= 1 ? STATUT.OK : STATUT.KO,
    ne === null
      ? "Le nombre d'enseignants État n'est pas renseigné : l'analyse est non validée."
      : ne >= 1
      ? "Au moins un enseignant État est présent."
      : "Aucun enseignant État n'est présent : l'analyse est non validée."
  ));

  const acc = c.accessibilite;
  a.push(item(
    "critere-accessibilite",
    CAT.OUVERTURE,
    "Village d'implantation facilement accessible",
    "Le village d'implantation est facilement accessible par rapport à l'aire de recrutement.",
    acc === true ? "Oui" : acc === false ? "Non" : "Non renseigné",
    acc === true ? STATUT.OK : STATUT.KO,
    acc === true
      ? "Le village est facilement accessible."
      : acc === false
      ? "Le village n'est pas facilement accessible : l'analyse est non validée."
      : "L'accessibilité du village n'est pas renseignée : l'analyse est non validée."
  ));

  const s = c.nombreSallesAppartenance ?? c.nombreSalles;
  a.push(item(
    "critere-salles-appartenance",
    CAT.PEDAGO,
    "Salles de classe équipées appartenant à l'établissement",
    "L'existence d'au moins 2 salles de classe équipées appartenant à l'établissement et de latrines séparées conformes aux normes ergonomiques.",
    s === null ? "Non renseigné" : `${s} salle(s)`,
    s !== null && s >= 2 ? STATUT.OK : STATUT.KO,
    s === null
      ? "Le nombre de salles n'est pas renseigné : l'analyse est non validée."
      : s >= 2
      ? "Les salles de classe équipées sont conformes (≥ 2)."
      : `Seulement ${s} salle(s) ; au moins 2 sont nécessaires.`
  ));

  const l = c.latrineSeparee;
  a.push(item(
    "critere-latrines",
    CAT.PEDAGO,
    "Latrines séparées conformes aux normes ergonomiques",
    "L'établissement dispose de latrines séparées conformes aux normes ergonomiques.",
    l === true ? "Oui" : l === false ? "Non" : "Non renseignée",
    l === true ? STATUT.OK : STATUT.KO,
    l === true
      ? "Les latrines séparées sont conformes."
      : "Les latrines séparées ne sont pas présentes ou ne sont pas renseignées : l'analyse est non validée."
  ));

  const cp = c.codeProvisoire;
  a.push(item(
    "critere-code-provisoire",
    CAT.ADMIN,
    "Code provisoire délivré par le MEN",
    "L'établissement dispose d'un code provisoire délivré par le MEN.",
    cp === true ? "Oui" : cp === false ? "Non" : "Non renseigné",
    cp === true ? STATUT.OK : STATUT.KO,
    cp === true
      ? "Le code provisoire MEN est présent."
      : cp === false
      ? "L'établissement ne dispose pas de code provisoire MEN : l'analyse est non validée."
      : "Le code provisoire MEN n'est pas renseigné : l'analyse est non validée."
  ));

  const stable = c.evolutionStable;
  const positif = c.evolutionPositive;
  const okEvo = stable === true && positif === true;
  a.push(item(
    "critere-evolution",
    CAT.DOSSIER,
    "Stabilité et évolution positive sur 3 ans",
    "Avant la délivrance de l'Autorisation d'Ouverture définitive, l'effectif des élèves doit rester stable et montrer une évolution positive au cours des 3 dernières années scolaires.",
    `${c.evolutionDetails || "Non renseigné"} ; stable : ${stable === true ? "Oui" : stable === false ? "Non" : "?"} ; positive : ${positif === true ? "Oui" : positif === false ? "Non" : "?"}`,
    okEvo ? STATUT.OK : STATUT.KO,
    okEvo
      ? "L'évolution des effectifs est stable et positive sur 3 ans."
      : "L'évolution des effectifs n'est pas stable ou positive sur 3 ans : l'analyse est non validée."
  ));

  // ✅ NOUVEAU : critère surface terrain
  a.push(critereSurfaceTerrain(c));

  return a;
}

// ============================================================
// COLLÈGE
// ============================================================

function collegeNouvelleCreation(c: any) {
  const a: any[] = [];

  // ① T5 ≥ 150 (65%)
  const t5 = c.totalT5;
  const seuilT5 = 150;
  a.push(item(
    "critere-t5",
    CAT.OUVERTURE,
    "Effectif total T5 dans l'aire de recrutement",
    "L'effectif des élèves de T5 dans les EPP situés dans l'aire de recrutement atteint au minimum de 150 (65%).",
    t5 === null ? "Non renseigné" : `${t5} élèves`,
    t5 !== null && t5 >= seuilT5 ? STATUT.OK : STATUT.KO,
    t5 === null
      ? "Effectif T5 non renseigné : l'analyse est non validée."
      : t5 >= seuilT5
      ? `Le seuil minimal de ${seuilT5} élèves est atteint.`
      : `Le seuil minimal de ${seuilT5} élèves n'est pas atteint (${t5} élèves).`
  ));

  // ② Position centrale
  const pc = c.positionCentrale;
  a.push(item(
    "critere-central",
    CAT.OUVERTURE,
    "Position centrale du nouveau CEG",
    "Le nouveau CEG est en position centrale par rapport aux établissements de recrutements.",
    pc === true ? "Oui" : pc === false ? "Non" : "Non renseignée",
    pc === true ? STATUT.OK : STATUT.KO,
    pc === true
      ? "La position centrale est conforme."
      : pc === false
      ? "Le nouveau CEG n'est pas en position centrale : l'analyse est non validée."
      : "La position centrale n'a pas pu être déterminée : l'analyse est non validée."
  ));

  // ③ Présence ORS
  const o = c.presenceORS;
  a.push(item(
    "critere-ors",
    CAT.OUVERTURE,
    "Présence dans les résultats ORS",
    "Le nouveau CEG figure dans les résultats de l'organisation du réseau scolaire (ORS).",
    o === true ? "Oui" : o === false ? "Non" : "Non renseignée",
    o === true ? STATUT.OK : STATUT.KO,
    o === true
      ? "Le futur CEG figure dans les résultats ORS."
      : "Le résultat ORS n'est pas renseigné ou le futur CEG n'y figure pas : l'analyse est non validée."
  ));

  // ✅ NOUVEAU : ④ Superficie du terrain ≥ 2000 m²
  a.push(critereSurfaceTerrain(c));

  return a;
}

function collegeOuvertureProvisoire(c: any) {
  const a: any[] = [];

  // ① T5 ≥ 100
  const t5 = c.totalT5;
  a.push(item(
    "critere-t5",
    CAT.OUVERTURE,
    "Effectif total T5 dans l'aire de recrutement",
    "L'effectif des élèves de T5 dans les EPP situés dans l'aire de recrutement atteint au minimum de 100.",
    t5 === null ? "Non renseigné" : `${t5} élèves`,
    t5 !== null && t5 >= 100 ? STATUT.OK : STATUT.KO,
    t5 === null
      ? "Effectif T5 non renseigné : l'analyse est non validée."
      : t5 >= 100
      ? "Le seuil minimal de 100 élèves est atteint."
      : `Le seuil minimal de 100 élèves n'est pas atteint (${t5} élèves).`
  ));

  // ② Au moins 2 enseignants État (1 scientifique + 1 littéraire)
  const ne = c.nombreEnseignantsEtat;
  const sci = c.scientifique === true;
  const lit = c.litteraire === true;
  const okEns = ne !== null && ne >= 2 && sci && lit;
  a.push(item(
    "critere-enseignants",
    CAT.PEDAGO,
    "Enseignants rémunérés par l'État",
    "L'établissement dispose au moins deux enseignants (1 scientifique et 1 littéraire) rémunérés par l'État.",
    `${ne === null ? "Nombre non renseigné" : `${ne} enseignant(s) État`} ; scientifique : ${sci ? "Oui" : "Non"} ; littéraire : ${lit ? "Oui" : "Non"}`,
    okEns ? STATUT.OK : STATUT.KO,
    okEns
      ? "Les conditions relatives aux enseignants sont conformes."
      : "Le nombre d'enseignants État ou les profils ne sont pas conformes : l'analyse est non validée."
  ));

  // ③ 3 ou 4 salles équipées + latrine séparée
  const s = c.nombreSalles;
  const l = c.latrineSeparee;
  const okLocaux = s !== null && s >= 3 && l === true;
  a.push(item(
    "critere-locaux",
    CAT.PEDAGO,
    "Salles de classe équipées et latrine séparée",
    "L'existence de 3 ou 4 salles de classe équipées au minimum et de latrines séparées.",
    `${s === null ? "Salles non renseignées" : `${s} salle(s)`} ; latrine séparée : ${l === true ? "Oui" : l === false ? "Non" : "Non renseignée"}`,
    okLocaux ? STATUT.OK : STATUT.KO,
    okLocaux
      ? "Les infrastructures demandées sont conformes."
      : s === null
      ? "Le nombre de salles n'est pas renseigné : l'analyse est non validée."
      : s < 3
      ? `Seulement ${s} salle(s) ; au moins 3 sont nécessaires.`
      : "La latrine séparée n'est pas présente ou n'est pas renseignée : l'analyse est non validée."
  ));

  // ④ Distance > 5 km
  const seuil = SEUILS_KM.college;
  const d = c.distancePlusProche;

  if (c.obstaclesPhysiques === true) {
    a.push(item(
      "critere-distance",
      CAT.OUVERTURE,
      "Distance de l'établissement le plus proche",
      `L'établissement le plus proche doit se situer à plus de ${seuil} km.`,
      "Obstacle physique détecté",
      STATUT.NA,
      "Des obstacles physiques (rivière, forêt dense, falaise, etc.) séparent le nouveau CEG des CEG environnants : la norme de distance ne s'applique pas."
    ));
  } else {
    let statutDist = STATUT.KO;
    let valeurDist = "Non renseignée";
    let detailDist = "La distance n'est pas renseignée : l'analyse est non validée.";

    if (d !== null && d > seuil) {
      statutDist = STATUT.OK;
      valeurDist = `${d.toFixed(2)} km`;
      detailDist = `La distance (${d.toFixed(2)} km) est supérieure à ${seuil} km : conforme.`;
    } else if (d !== null && d <= seuil) {
      statutDist = STATUT.KO;
      valeurDist = `${d.toFixed(2)} km`;
      detailDist = `Distance ${d.toFixed(2)} km ≤ ${seuil} km : non conforme.`;
    } else if (d === null && c.aucunProche) {
      statutDist = STATUT.OK;
      valeurDist = `Aucun établissement proche (> ${seuil} km)`;
      detailDist = `Aucun CEG n'a été trouvé dans la zone : conforme.`;
    }

    a.push(item(
      "critere-distance",
      CAT.OUVERTURE,
      "Distance de l'établissement le plus proche",
      `L'établissement le plus proche doit se situer à plus de ${seuil} km.`,
      valeurDist,
      statutDist,
      detailDist
    ));
  }

  // ✅ NOUVEAU : ⑤ Superficie du terrain ≥ 2000 m²
  a.push(critereSurfaceTerrain(c));

  return a;
}

function collegeDefinitif(c: any) {
  const a: any[] = [];

  const eff = c.effectifTotal;
  a.push(item(
    "critere-effectif-total",
    CAT.OUVERTURE,
    "Effectif total des élèves",
    "L'effectif total des élèves doit être de 150 au minimum.",
    eff === null ? "Non renseigné" : `${eff} élèves`,
    eff !== null && eff >= 150 ? STATUT.OK : STATUT.KO,
    eff === null
      ? "Effectif total non renseigné : l'analyse est non validée."
      : eff >= 150
      ? "Le seuil minimal de 150 élèves est atteint."
      : `Le seuil minimal de 150 élèves n'est pas atteint (${eff} élèves).`
  ));

  const ne = c.nombreEnseignantsEtat;
  const sci = c.scientifique === true;
  const lit = c.litteraire === true;
  const okEns = ne !== null && ne >= 2 && sci && lit;
  a.push(item(
    "critere-enseignants",
    CAT.PEDAGO,
    "Enseignants rémunérés par l'État",
    "L'établissement dispose d'enseignants scientifiques et littéraires rémunérés par l'État.",
    `${ne === null ? "Nombre non renseigné" : `${ne} enseignant(s) État`} ; scientifique : ${sci ? "Oui" : "Non"} ; littéraire : ${lit ? "Oui" : "Non"}`,
    okEns ? STATUT.OK : STATUT.KO,
    okEns
      ? "Les conditions relatives aux enseignants sont conformes."
      : "Le nombre d'enseignants État ou les profils ne sont pas conformes : l'analyse est non validée."
  ));

  const acc = c.accessibilite;
  a.push(item(
    "critere-accessibilite",
    CAT.OUVERTURE,
    "Accessibilité du site d'implantation",
    "Le site d'implantation est facilement accessible par rapport à l'aire de recrutement.",
    acc === true ? "Oui" : acc === false ? "Non" : "Non renseignée",
    acc === true ? STATUT.OK : STATUT.KO,
    acc === true
      ? "Le site est facilement accessible."
      : acc === false
      ? "Le site n'est pas facilement accessible : l'analyse est non validée."
      : "L'accessibilité du site n'est pas renseignée : l'analyse est non validée."
  ));

  const s = c.nombreSallesAppartenance ?? c.nombreSalles;
  a.push(item(
    "critere-salles-appartenance",
    CAT.PEDAGO,
    "Salles de classe équipées appartenant à l'établissement",
    "L'établissement dispose d'au moins 3 ou 4 salles de classe équipées lui appartenant.",
    s === null ? "Non renseigné" : `${s} salle(s)`,
    s !== null && s >= 3 ? STATUT.OK : STATUT.KO,
    s === null
      ? "Le nombre de salles n'est pas renseigné : l'analyse est non validée."
      : s >= 3
      ? "Les salles de classe équipées sont conformes (≥ 3)."
      : `Seulement ${s} salle(s) ; au moins 3 sont nécessaires.`
  ));

  const l = c.latrineSeparee;
  a.push(item(
    "critere-latrines",
    CAT.PEDAGO,
    "Latrines séparées conformes aux normes ergonomiques",
    "L'établissement dispose de latrines séparées conformes aux normes ergonomiques.",
    l === true ? "Oui" : l === false ? "Non" : "Non renseignée",
    l === true ? STATUT.OK : STATUT.KO,
    l === true
      ? "Les latrines séparées sont conformes."
      : "Les latrines séparées ne sont pas présentes ou ne sont pas renseignées : l'analyse est non validée."
  ));

  const cp = c.codeProvisoire;
  a.push(item(
    "critere-code-provisoire",
    CAT.ADMIN,
    "Code provisoire délivré par le MEN",
    "L'établissement dispose d'un code provisoire délivré par le MEN.",
    cp === true ? "Oui" : cp === false ? "Non" : "Non renseigné",
    cp === true ? STATUT.OK : STATUT.KO,
    cp === true
      ? "Le code provisoire MEN est présent."
      : cp === false
      ? "L'établissement ne dispose pas de code provisoire MEN : l'analyse est non validée."
      : "Le code provisoire MEN n'est pas renseigné : l'analyse est non validée."
  ));

  const stable = c.evolutionStable;
  const positif = c.evolutionPositive;
  const okEvo = stable === true && positif === true;
  a.push(item(
    "critere-evolution",
    CAT.DOSSIER,
    "Stabilité et évolution positive sur 3 ans",
    "L'établissement doit rester stable et montrer une évolution positive au cours des 3 dernières années scolaires.",
    `${c.evolutionDetails || "Non renseigné"} ; stable : ${stable === true ? "Oui" : stable === false ? "Non" : "?"} ; positive : ${positif === true ? "Oui" : positif === false ? "Non" : "?"}`,
    okEvo ? STATUT.OK : STATUT.KO,
    okEvo
      ? "L'évolution des effectifs est stable et positive sur 3 ans."
      : "L'évolution des effectifs n'est pas stable ou positive sur 3 ans : l'analyse est non validée."
  ));

  const seuil = SEUILS_KM[c.niveauKey] ?? 5;
  const d = c.distancePlusProche;
  const sat = c.cegSatures;

  if (c.obstaclesPhysiques === true) {
    a.push(item(
      "critere-distance",
      CAT.OUVERTURE,
      "Distance de l'établissement le plus proche",
      `L'établissement de Collège d'Enseignement Général à moins de ${seuil} km est acceptable sous conditions (dérogations).`,
      "Obstacle physique détecté",
      STATUT.NA,
      "Des obstacles physiques (rivière, forêt dense, falaise, etc.) séparent le nouveau CEG des CEG environnants : la norme de distance ne s'applique pas."
    ));
  } else {
    let statutDist = STATUT.KO;
    let valeurDist = "Non renseignée";
    let detailDist = "La distance n'est pas renseignée : l'analyse est non validée.";

    if (d !== null && d > seuil) {
      statutDist = STATUT.OK;
      valeurDist = `${d.toFixed(2)} km`;
      detailDist = `La distance (${d.toFixed(2)} km) est supérieure à ${seuil} km : conforme.`;
    } else if (d !== null && d <= seuil) {
      const communeSansCeg =
        bool(first(c.infoComplementaire, ["commune_sans_ceg", "sans_ceg", "aucun_ceg_commune"])) === true ||
        (sat?.aucun === true);
      const tousSatures = sat?.satures === true;

      const zoneVuln = c.zoneVulnerable === true;
      const effSuffisant = eff !== null && eff >= 90;
      const derogZoneVuln = zoneVuln && effSuffisant;

      if (communeSansCeg) {
        statutDist = STATUT.DEROG;
        valeurDist = `${d.toFixed(2)} km (dérogation)`;
        detailDist = `Distance ${d.toFixed(2)} km < ${seuil} km mais la commune ne dispose pas encore de CEG : dérogation accordée.`;
      } else if (tousSatures) {
        statutDist = STATUT.DEROG;
        valeurDist = `${d.toFixed(2)} km (dérogation)`;
        detailDist = `Distance ${d.toFixed(2)} km < ${seuil} km mais tous les CEG proches sont saturés (≥ 98%) sans extension possible : dérogation accordée.${sat?.details ? " (" + sat.details + ")" : ""}`;
      } else if (derogZoneVuln) {
        statutDist = STATUT.DEROG;
        valeurDist = `${d.toFixed(2)} km (dérogation)`;
        detailDist = `Distance ${d.toFixed(2)} km < ${seuil} km mais l'établissement est situé dans une zone vulnérable et très éloignée des établissements existants, avec un effectif de ${eff} élèves (≥ 90) : dérogation accordée.`;
      } else {
        statutDist = STATUT.KO;
        valeurDist = `${d.toFixed(2)} km`;
        detailDist = `Distance ${d.toFixed(2)} km ≤ ${seuil} km sans condition de dérogation remplie.`;
      }
    } else if (d === null && c.aucunProche) {
      statutDist = STATUT.OK;
      valeurDist = `Aucun établissement proche (> ${seuil} km)`;
      detailDist = `Aucun CEG n'a été trouvé dans la zone : conforme.`;
    }

    a.push(item(
      "critere-distance",
      CAT.OUVERTURE,
      "Distance de l'établissement le plus proche",
      `L'établissement de Collège d'Enseignement Général à moins de ${seuil} km est acceptable sous conditions : (a) la commune ne dispose pas encore de CEG ; (b) tous les CEG < ${seuil} km sont saturés à 98% sans extension possible ; (c) des obstacles physiques (rivière, forêt dense, falaise…) séparent le nouveau CEG des CEG environnants ; (d) l'établissement est en zone vulnérable et très éloignée avec effectif ≥ 90.`,
      valeurDist,
      statutDist,
      detailDist
    ));
  }

  // ✅ NOUVEAU : critère surface terrain
  a.push(critereSurfaceTerrain(c));

  return a;
}

// ============================================================
// LYCÉE
// ============================================================

function lyceeNouvelleCreation(c: any) {
  const a: any[] = [];

  // ① T9 ≥ 250 (60%)
  const t9 = c.totalT9;
  const seuilT9 = 250;
  a.push(item(
    "critere-t9",
    CAT.OUVERTURE,
    "Effectif total T9 dans l'aire de recrutement",
    "L'effectif des élèves de T9 dans les CEG situés dans l'aire de recrutement atteint au minimum de 250 (60%).",
    t9 === null ? "Non renseigné" : `${t9} élèves`,
    t9 !== null && t9 >= seuilT9 ? STATUT.OK : STATUT.KO,
    t9 === null
      ? "Effectif T9 non renseigné : l'analyse est non validée."
      : t9 >= seuilT9
      ? `Le seuil minimal de ${seuilT9} élèves est atteint.`
      : `Le seuil minimal de ${seuilT9} élèves n'est pas atteint (${t9} élèves).`
  ));

  // ② Position centrale de la commune
  const pc = c.positionCentrale;
  a.push(item(
    "critere-central",
    CAT.OUVERTURE,
    "Position centrale du nouveau Lycée",
    "La commune d'implantation est en position centrale, pour les lycées autres que ceux qui se trouvent au chef-lieu de District, par rapport à l'aire de recrutement.",
    pc === true ? "Oui" : pc === false ? "Non" : "Non renseignée",
    pc === true ? STATUT.OK : STATUT.KO,
    pc === true
      ? "La commune d'implantation est en position centrale."
      : pc === false
      ? "La commune d'implantation n'est pas en position centrale : l'analyse est non validée."
      : "La position centrale n'a pas pu être déterminée : l'analyse est non validée."
  ));

  // ③ Présence ORS
  const o = c.presenceORS;
  a.push(item(
    "critere-ors",
    CAT.OUVERTURE,
    "Présence dans les résultats ORS",
    "Le nouveau Lycée figure dans les résultats de l'organisation du réseau scolaire (ORS).",
    o === true ? "Oui" : o === false ? "Non" : "Non renseignée",
    o === true ? STATUT.OK : STATUT.KO,
    o === true
      ? "Le futur Lycée figure dans les résultats ORS."
      : "Le résultat ORS n'est pas renseigné ou le futur Lycée n'y figure pas : l'analyse est non validée."
  ));

  // ✅ NOUVEAU : ④ Superficie du terrain ≥ 2000 m²
  a.push(critereSurfaceTerrain(c));

  return a;
}

function lyceeOuvertureProvisoire(c: any) {
  const a: any[] = [];

  // ① Effectif total ≥ 150 élèves
  const eff = c.effectifTotal;
  a.push(item(
    "critere-effectif-total",
    CAT.OUVERTURE,
    "Effectif total des élèves",
    "L'effectif total doit être au moins 150 élèves.",
    eff === null ? "Non renseigné" : `${eff} élèves`,
    eff !== null && eff >= 150 ? STATUT.OK : STATUT.KO,
    eff === null
      ? "Effectif total non renseigné : l'analyse est non validée."
      : eff >= 150
      ? "Le seuil minimal de 150 élèves est atteint."
      : `Le seuil minimal de 150 élèves n'est pas atteint (${eff} élèves).`
  ));

  // ② Au moins 10 enseignants dont 4 État + FRAM qualifiés pour les restants
  const neTotal = c.nombreEnseignantsTotal;
  const neEtat = c.nombreEnseignantsEtat;
  const fram = c.framQualifies ?? 0;

  const okTotal = neTotal !== null && neTotal >= 10;
  const okEtat = neEtat !== null && neEtat >= 4;
  const okRenfort = (neTotal ?? 0) - (neEtat ?? 0) <= fram;

  a.push(item(
    "critere-enseignants-total",
    CAT.PEDAGO,
    "Nombre total d'enseignants",
    "L'établissement doit compter au minimum 10 enseignants.",
    neTotal === null ? "Non renseigné" : `${neTotal} enseignant(s)`,
    okTotal ? STATUT.OK : STATUT.KO,
    neTotal === null
      ? "Le nombre total d'enseignants n'est pas renseigné : l'analyse est non validée."
      : okTotal
      ? "Le seuil minimal de 10 enseignants est atteint."
      : `Seulement ${neTotal} enseignant(s) ; au moins 10 sont nécessaires.`
  ));

  a.push(item(
    "critere-enseignants-etat",
    CAT.PEDAGO,
    "Enseignants rémunérés par l'État",
    "Au minimum 4 enseignants rémunérés par l'État, pour assurer un enseignant par matière.",
    neEtat === null ? "Non renseigné" : `${neEtat} enseignant(s) État`,
    okEtat ? STATUT.OK : STATUT.KO,
    neEtat === null
      ? "Le nombre d'enseignants État n'est pas renseigné : l'analyse est non validée."
      : okEtat
      ? "Le seuil minimal de 4 enseignants État est atteint."
      : `Seulement ${neEtat} enseignant(s) État ; au moins 4 sont nécessaires.`
  ));

  a.push(item(
    "critere-enseignants-fram",
    CAT.PEDAGO,
    "Enseignants FRAM qualifiés pour les postes restants",
    "Les autres enseignants doivent être issus des enseignants FRAM ayant déjà exercé dans des établissements publics et posséder les diplômes requis pour enseigner au Lycée.",
    `FRAM qualifiés : ${fram} ; postes restants : ${neTotal !== null && neEtat !== null ? Math.max(0, neTotal - neEtat) : "?"}`,
    okRenfort && fram > 0 ? STATUT.OK : STATUT.KO,
    okRenfort
      ? "Les enseignants FRAM qualifiés couvrent les postes restants."
      : "Le nombre de FRAM qualifiés est insuffisant pour couvrir les postes restants : l'analyse est non validée."
  ));

  // ③ 3 ou 4 salles équipées + latrine séparée
  const s = c.nombreSalles;
  const l = c.latrineSeparee;
  const okLocaux = s !== null && s >= 3 && l === true;
  a.push(item(
    "critere-locaux",
    CAT.PEDAGO,
    "Salles de classe équipées et latrine séparée",
    "L'existence de 3 ou 4 salles de classe équipées au minimum et de latrines séparées.",
    `${s === null ? "Salles non renseignées" : `${s} salle(s)`} ; latrine séparée : ${l === true ? "Oui" : l === false ? "Non" : "Non renseignée"}`,
    okLocaux ? STATUT.OK : STATUT.KO,
    okLocaux
      ? "Les infrastructures demandées sont conformes."
      : s === null
      ? "Le nombre de salles n'est pas renseigné : l'analyse est non validée."
      : s < 3
      ? `Seulement ${s} salle(s) ; au moins 3 sont nécessaires.`
      : "La latrine séparée n'est pas présente ou n'est pas renseignée : l'analyse est non validée."
  ));

  // ④ Distance minimale entre deux lycées ≥ 20 km
  const seuil = SEUILS_KM.lycee;
  const d = c.distancePlusProche;

  if (c.obstaclesPhysiques === true) {
    a.push(item(
      "critere-distance-lycee",
      CAT.OUVERTURE,
      "Distance minimale entre deux lycées",
      `La distance minimale entre deux lycées doit être de ${seuil} km au minimum.`,
      "Obstacle physique détecté",
      STATUT.NA,
      "Des obstacles physiques (rivière, forêt dense, falaise, etc.) séparent le nouveau Lycée des Lycées environnants : la norme de distance ne s'applique pas."
    ));
  } else {
    let statutDist = STATUT.KO;
    let valeurDist = "Non renseignée";
    let detailDist = "La distance n'est pas renseignée : l'analyse est non validée.";

    if (d !== null && d >= seuil) {
      statutDist = STATUT.OK;
      valeurDist = `${d.toFixed(2)} km`;
      detailDist = `La distance (${d.toFixed(2)} km) est supérieure ou égale à ${seuil} km : conforme.`;
    } else if (d !== null && d < seuil) {
      statutDist = STATUT.KO;
      valeurDist = `${d.toFixed(2)} km`;
      detailDist = `La distance entre deux lycées doit être de ${seuil} km au minimum (constaté : ${d.toFixed(2)} km).`;
    } else if (d === null && c.aucunProche) {
      statutDist = STATUT.OK;
      valeurDist = `Aucun lycée proche (> ${seuil} km)`;
      detailDist = `Aucun lycée n'a été trouvé dans la zone : conforme.`;
    }

    a.push(item(
      "critere-distance-lycee",
      CAT.OUVERTURE,
      "Distance minimale entre deux lycées",
      `La distance minimale entre deux lycées doit être de ${seuil} km au minimum.`,
      valeurDist,
      statutDist,
      detailDist
    ));
  }

  // ⑤ Code provisoire MEN
  const cp = c.codeProvisoire;
  a.push(item(
    "critere-code-provisoire",
    CAT.ADMIN,
    "Code provisoire délivré par le MEN",
    "L'établissement doit disposer d'un code provisoire délivré par le MEN.",
    cp === true ? "Oui" : cp === false ? "Non" : "Non renseigné",
    cp === true ? STATUT.OK : STATUT.KO,
    cp === true
      ? "Le code provisoire MEN est présent."
      : cp === false
      ? "L'établissement ne dispose pas de code provisoire MEN : l'analyse est non validée."
      : "Le code provisoire MEN n'est pas renseigné : l'analyse est non validée."
  ));

  // ✅ NOUVEAU : ⑥ Superficie du terrain ≥ 2000 m²
  a.push(critereSurfaceTerrain(c));

  return a;
}

function lyceeDefinitif(c: any) {
  const a: any[] = [];

  const eff = c.effectifTotal;
  a.push(item(
    "critere-effectif-total",
    CAT.OUVERTURE,
    "Effectif total des élèves",
    "L'effectif total doit être d'au moins 250 élèves.",
    eff === null ? "Non renseigné" : `${eff} élèves`,
    eff !== null && eff >= 250 ? STATUT.OK : STATUT.KO,
    eff === null
      ? "Effectif total non renseigné : l'analyse est non validée."
      : eff >= 250
      ? "Le seuil minimal de 250 élèves est atteint."
      : `Le seuil minimal de 250 élèves n'est pas atteint (${eff} élèves).`
  ));

  const neEtat = c.nombreEnseignantsEtat;
  const couverture = c.couvertureMatieres;
  const matieresNonCouvertes = couverture?.resultats?.filter((m: any) => !m.couverte) || [];
  const toutesCouvertes = couverture?.toutesCouvertes === true;
  const okEns = neEtat !== null && neEtat >= 1 && toutesCouvertes;

  a.push(item(
    "critere-enseignants-etat",
    CAT.PEDAGO,
    "Enseignants rémunérés par l'État (au moins un par matière)",
    "L'établissement dispose d'enseignants rémunérés par l'État, avec au moins un enseignant par matière.",
    `${neEtat === null ? "Nombre non renseigné" : `${neEtat} enseignant(s) État`} ; matières couvertes : ${
      couverture?.resultats?.filter((m: any) => m.couverte).length || 0
    }/${couverture?.resultats?.length || 0}${
      matieresNonCouvertes.length
        ? ` (manquantes : ${matieresNonCouvertes.map((m: any) => m.label).join(", ")})`
        : ""
    }`,
    okEns ? STATUT.OK : STATUT.KO,
    okEns
      ? "Les enseignants État couvrent toutes les matières obligatoires."
      : neEtat === null
      ? "Le nombre d'enseignants État n'est pas renseigné : l'analyse est non validée."
      : !toutesCouvertes
      ? `Certaines matières ne sont pas couvertes par un enseignant État : ${matieresNonCouvertes.map((m: any) => m.label).join(", ")}.`
      : "Les conditions relatives aux enseignants État ne sont pas conformes : l'analyse est non validée."
  ));

  const seuil = SEUILS_KM.lycee;
  const d = c.distancePlusProche;
  const sat = c.lyceeSatures;

  if (c.obstaclesPhysiques === true) {
    a.push(item(
      "critere-distance",
      CAT.OUVERTURE,
      "Distance minimale entre deux lycées",
      `La distance minimale entre deux lycées est de ${seuil} km, sauf dérogation.`,
      "Obstacle physique détecté",
      STATUT.NA,
      "Des obstacles physiques (rivière, forêt dense, falaise, etc.) séparent le nouveau Lycée des Lycées environnants : la norme de distance ne s'applique pas."
    ));
  } else {
    let statutDist = STATUT.KO;
    let valeurDist = "Non renseignée";
    let detailDist = "La distance n'est pas renseignée : l'analyse est non validée.";

    if (d !== null && d >= seuil) {
      statutDist = STATUT.OK;
      valeurDist = `${d.toFixed(2)} km`;
      detailDist = `La distance (${d.toFixed(2)} km) est supérieure ou égale à ${seuil} km : conforme.`;
    } else if (d !== null && d < seuil) {
      const districtSansLycee =
        bool(first(c.infoComplementaire, ["district_sans_lycee", "sans_lycee", "aucun_lycee_district"])) === true ||
        (sat?.aucun === true);
      const tousSatures = sat?.satures === true;

      if (districtSansLycee || tousSatures) {
        statutDist = STATUT.DEROG;
        valeurDist = `${d.toFixed(2)} km (dérogation)`;
        detailDist = districtSansLycee
          ? `Distance ${d.toFixed(2)} km < ${seuil} km mais le district ne dispose pas encore de Lycée : dérogation accordée.`
          : `Distance ${d.toFixed(2)} km < ${seuil} km mais tous les Lycées proches sont saturés (≥ 90%) sans extension possible : dérogation accordée.${sat?.details ? " (" + sat.details + ")" : ""}`;
      } else {
        statutDist = STATUT.KO;
        valeurDist = `${d.toFixed(2)} km`;
        detailDist = `Distance ${d.toFixed(2)} km < ${seuil} km sans condition de dérogation remplie.`;
      }
    } else if (d === null && c.aucunProche) {
      statutDist = STATUT.OK;
      valeurDist = `Aucun lycée proche (> ${seuil} km)`;
      detailDist = `Aucun lycée n'a été trouvé dans la zone : conforme.`;
    }

    a.push(item(
      "critere-distance",
      CAT.OUVERTURE,
      "Distance minimale entre deux lycées",
      `La distance minimale entre deux lycées est de ${seuil} km, sauf dérogation (district sans Lycée ou Lycées saturés à 90% sans extension).`,
      valeurDist,
      statutDist,
      detailDist
    ));
  }

  const s = c.nombreSallesAppartenance ?? c.nombreSalles;
  a.push(item(
    "critere-salles-appartenance",
    CAT.PEDAGO,
    "Salles de classe équipées appartenant à l'établissement",
    "L'établissement dispose d'au moins 3 ou 4 salles de classe équipées lui appartenant.",
    s === null ? "Non renseigné" : `${s} salle(s)`,
    s !== null && s >= 3 ? STATUT.OK : STATUT.KO,
    s === null
      ? "Le nombre de salles n'est pas renseigné : l'analyse est non validée."
      : s >= 3
      ? "Les salles de classe équipées sont conformes (≥ 3)."
      : `Seulement ${s} salle(s) ; au moins 3 sont nécessaires.`
  ));

  const l = c.latrineSeparee;
  a.push(item(
    "critere-latrines",
    CAT.PEDAGO,
    "Latrines séparées conformes aux normes ergonomiques",
    "L'établissement dispose de latrines séparées conformes aux normes ergonomiques.",
    l === true ? "Oui" : l === false ? "Non" : "Non renseignée",
    l === true ? STATUT.OK : STATUT.KO,
    l === true
      ? "Les latrines séparées sont conformes."
      : "Les latrines séparées ne sont pas présentes ou ne sont pas renseignées : l'analyse est non validée."
  ));

  const cp = c.codeProvisoire;
  a.push(item(
    "critere-code-provisoire",
    CAT.ADMIN,
    "Code provisoire délivré par le MEN",
    "L'établissement dispose d'un code provisoire délivré par le MEN.",
    cp === true ? "Oui" : cp === false ? "Non" : "Non renseigné",
    cp === true ? STATUT.OK : STATUT.KO,
    cp === true
      ? "Le code provisoire MEN est présent."
      : cp === false
      ? "L'établissement ne dispose pas de code provisoire MEN : l'analyse est non validée."
      : "Le code provisoire MEN n'est pas renseigné : l'analyse est non validée."
  ));

  const stable = c.evolutionStable;
  const positif = c.evolutionPositive;
  const okEvo = stable === true && positif === true;
  a.push(item(
    "critere-evolution",
    CAT.DOSSIER,
    "Stabilité et évolution positive sur 3 ans",
    "Avant la délivrance de l'Autorisation d'Ouverture définitive, l'effectif des élèves de l'établissement doit rester stable et montrer une évolution positive au cours des 3 dernières années scolaires.",
    `${c.evolutionDetails || "Non renseigné"} ; stable : ${stable === true ? "Oui" : stable === false ? "Non" : "?"} ; positive : ${positif === true ? "Oui" : positif === false ? "Non" : "?"}`,
    okEvo ? STATUT.OK : STATUT.KO,
    okEvo
      ? "L'évolution des effectifs est stable et positive sur 3 ans."
      : "L'évolution des effectifs n'est pas stable ou positive sur 3 ans : l'analyse est non validée."
  ));

  // ✅ NOUVEAU : critère surface terrain
  a.push(critereSurfaceTerrain(c));

  return a;
}

// ============================================================
// Verdict
// ============================================================
function buildVerdict(phase: any, items: any[]): any {
  const ok = items.filter((x) => x.statut === STATUT.OK).length;
  const derog = items.filter((x) => x.statut === STATUT.DEROG).length;
  const na = items.filter((x) => x.statut === STATUT.NA).length;

  const ko = items.filter(
    (x) =>
      x.statut !== STATUT.OK &&
      x.statut !== STATUT.DEROG &&
      x.statut !== STATUT.NA
  ).length;

  const validee = items.length > 0 && ko === 0;

  const messageValidee = () => {
    if (derog > 0 && na > 0) {
      return `ANALYSE VALIDÉE : tous les critères obligatoires sont conformes (${derog} dérogation(s), ${na} critère(s) non applicable(s)).`;
    }
    if (derog > 0) {
      return `ANALYSE VALIDÉE : tous les critères obligatoires sont conformes (${derog} dérogation(s) appliquée(s)).`;
    }
    if (na > 0) {
      return `ANALYSE VALIDÉE : tous les critères obligatoires sont conformes (${na} critère(s) non applicable(s)).`;
    }
    return "ANALYSE VALIDÉE : tous les critères obligatoires sont conformes.";
  };

  return {
    phase,
    verdict: validee ? "validee" : "non_conforme",
    message: validee
      ? messageValidee()
      : `ANALYSE NON VALIDÉE : ${ko} critère(s) absent(s) ou non conforme(s) sur ${items.length}.`,
    summary: { total: items.length, ok, derog, na, ko, nv: 0 },
    items,
  };
}

// ------------------------------------------------------------
// Point d'entrée
// ------------------------------------------------------------
export function analyserNormes(c: any, phase: any) {
  // ✅ Si c'est une Régularisation → normes INCHANGÉES (definitive)
  if (c?.regularisation) {
    if (c.niveauKey === "prescolaire") return buildVerdict("definitive", prescolaireDefinitif(c));
    if (c.niveauKey === "primaire") return buildVerdict("definitive", primaireDefinitif(c));
    if (c.niveauKey === "college") return buildVerdict("definitive", collegeDefinitif(c));
    if (c.niveauKey === "lycee") return buildVerdict("definitive", lyceeDefinitif(c));
    return buildVerdict("definitive", []);
  }

  // ✅ Si c'est une Nouvelle création → dépend du sous-type
  if (c?.nouvelleCreation) {
    const estProvisoire = c.estSousTypeProvisoire === true;

    if (c.niveauKey === "prescolaire") {
      return buildVerdict(
        estProvisoire ? "provisoire" : "definitive",
        estProvisoire ? prescolaireProvisoire(c) : prescolaireDefinitif(c)
      );
    }
    if (c.niveauKey === "primaire") {
      return buildVerdict(
        estProvisoire ? "provisoire" : "creation",
        estProvisoire ? primaireOuvertureProvisoire(c) : primaireNouvelleCreation(c)
      );
    }
    if (c.niveauKey === "college") {
      return buildVerdict(
        estProvisoire ? "provisoire" : "creation",
        estProvisoire ? collegeOuvertureProvisoire(c) : collegeNouvelleCreation(c)
      );
    }
    if (c.niveauKey === "lycee") {
      return buildVerdict(
        estProvisoire ? "provisoire" : "creation",
        estProvisoire ? lyceeOuvertureProvisoire(c) : lyceeNouvelleCreation(c)
      );
    }
    return buildVerdict(estProvisoire ? "provisoire" : "creation", [critereDistance(c)]);
  }

  // Fallback (ne devrait pas arriver)
  if (c.niveauKey === "prescolaire") return buildVerdict(phase, prescolaireDefinitif(c));
  if (c.niveauKey === "primaire") return buildVerdict(phase, primaireDefinitif(c));
  if (c.niveauKey === "college") return buildVerdict(phase, collegeDefinitif(c));
  if (c.niveauKey === "lycee") return buildVerdict(phase, lyceeDefinitif(c));

  return buildVerdict(phase, [
    item(
      "critere-non-configure",
      CAT.DOSSIER,
      "Normes applicables à ce type de demande",
      "Aucune norme automatique n'est configurée pour ce type de demande.",
      c?.typeDemande || "Non renseigné",
      STATUT.KO,
      "Vérification manuelle requise : l'analyse ne peut pas être validée automatiquement."
    ),
  ]);
}

// ------------------------------------------------------------
// Motif de décision
// ------------------------------------------------------------
export function genererMotifDecision(analyse: any) {
  if (!analyse) return "";

  if (analyse.verdict === "validee") {
    const derog = (analyse.items || []).filter((x) => x.statut === STATUT.DEROG);
    const na = (analyse.items || []).filter((x) => x.statut === STATUT.NA);

    if (derog.length || na.length) {
      const lines = ["ANALYSE VALIDÉE", ""];

      if (derog.length) {
        lines.push("Critères dérogatoires :");
        derog.forEach((x) => lines.push(`- ${x.libelle} : ${x.detail}`));
        lines.push("");
      }

      if (na.length) {
        lines.push("Critères non applicables :");
        na.forEach((x) => lines.push(`- ${x.libelle} : ${x.detail}`));
      }

      return lines.join("\n").trim();
    }

    return "ANALYSE VALIDÉE\n\nTous les critères obligatoires sont conformes.";
  }

  const ko = (analyse.items || []).filter(
    (x) =>
      x.statut !== STATUT.OK &&
      x.statut !== STATUT.DEROG &&
      x.statut !== STATUT.NA
  );

  const lines = ["ANALYSE NON VALIDÉE", "", "Critères absents ou non conformes :"];
  ko.forEach((x) => lines.push(`- ${x.libelle} : ${x.detail}`));
  return lines.join("\n");
}