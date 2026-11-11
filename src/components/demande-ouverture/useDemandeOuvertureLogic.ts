// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  demandeService,
  pieceFournieService,
  etablissementService,
} from "@/services/demandeService";
import { asList, api, verifierEligibiliteVillage } from "@/services/demandeApi";

import {
  NIVEAU_CONFIG, NIVEAU_COLONNES_EFFECTIF, KEY_TO_NIVEAU_LABEL, ORDRE_LOC,
  empty, emptyLocalisationDetail, emptyLocSelection, emptyLocOptions,
  emptyNouvelleCreation, emptyRegularisation, piecesInitiales,
  emptyInfoComplementaire, emptyRessources,
} from "@/constants/demandeOuvertureConfig";

import {
  niveauToKey, calculerTotalEvolutionLigne, construireAireListe,
  fusionnerLocalisation, deriveStatutJuridique, lireLatrines,
  lignesPersonnelDepuis, construirePersonnelDetail, formatDateForInput,
  validerEtape,
} from "@/utils/demandeOuvertureHelpers";

/* ============================================================ */
/* ✅ NOUVEAU : calcul du nombre d'années d'existant            */
/* ============================================================ */
function calculerNombreAnnees(dateOuverture) {
  if (!dateOuverture) return "";
  const match = String(dateOuverture).match(/^(\d{4})/);
  if (!match) return "";
  const anneeOuvr = parseInt(match[1], 10);
  if (!Number.isFinite(anneeOuvr) || anneeOuvr < 1900 || anneeOuvr > 2100) return "";
  const anneeCourante = new Date().getFullYear();
  const diff = anneeCourante - anneeOuvr;
  return diff >= 0 ? String(diff) : "";
}

function normalise(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function estNouvelleCreationDefinitive(type_demande, sous_type) {
  return (
    normalise(type_demande) === "nouvelle creation" &&
    !normalise(sous_type).includes("provisoir")
  );
}

function estNiveauAvecEligibiliteVillage(type_demande, sous_type, niveau_etab) {
  if (!estNouvelleCreationDefinitive(type_demande, sous_type)) return false;
  const n = normalise(niveau_etab);
  return n === "prescolaire" || n === "primaire";
}

const CODE_INVALIDE = new Set(["", "0", "null", "undefined", "nan"]);
function codeValide(valeur) {
  if (valeur === null || valeur === undefined) return false;
  return !CODE_INVALIDE.has(String(valeur).trim().toLowerCase());
}

/* ============================================================ */

export function useDemandeOuvertureLogic() {
  const { user } = useAuth();

  // États formulaire
  const [form, setForm] = useState(empty);
  const [nouvelleCreation, setNouvelleCreation] = useState(emptyNouvelleCreation);
  const [regularisation, setRegularisation] = useState(emptyRegularisation);
  const [pieces, setPieces] = useState(piecesInitiales);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);
  const [localisationDetail, setLocalisationDetail] = useState(emptyLocalisationDetail);
  const [infoComplementaire, setInfoComplementaire] = useState(emptyInfoComplementaire);
  const [champsZapValeurs, setChampsZapValeurs] = useState({});
  const [tableProche, setTableProche] = useState([]);
  const [aireListe, setAireListe] = useState([]);
  const [villageLoading, setVillageLoading] = useState(false);
  const [evolutionRecuperee, setEvolutionRecuperee] = useState([]);
  const [evolutionSaisie, setEvolutionSaisie] = useState([]);
  const [personnelExistant, setPersonnelExistant] = useState([]);
  const [personnelDetail, setPersonnelDetail] = useState([]);
  const [ressources, setRessources] = useState(emptyRessources);
  const [currentStep, setCurrentStep] = useState(0);
  const [validationErrors, setValidationErrors] = useState({});
  const [locSelection, setLocSelection] = useState(emptyLocSelection);
  const [locOptions, setLocOptions] = useState(emptyLocOptions);
  const [villagesFokontany, setVillagesFokontany] = useState([]);
  const [villagesFokontanyLoading, setVillagesFokontanyLoading] = useState(false);
  const [rechercheEtabStatut, setRechercheEtabStatut] = useState("idle");
  const [etablissementsTrouves, setEtablissementsTrouves] = useState([]);
  const [etablissementSelectionne, setEtablissementSelectionne] = useState(null);

  // Éligibilité
  const [eligibiliteVillageErreur, setEligibiliteVillageErreur] = useState("");
  const [villagesAlternatifsProposes, setVillagesAlternatifsProposes] = useState([]);
  const [eligibiliteStatut, setEligibiliteStatut] = useState("idle");
  const [codeVillageSelectionne, setCodeVillageSelectionne] = useState("");
  const [zoneProposeeSelectionnee, setZoneProposeeSelectionnee] = useState(null);

  // Modal sécurité
  const [modalSecuriteOuvert, setModalSecuriteOuvert] = useState(false);
  const [modalSecuriteMessage, setModalSecuriteMessage] = useState("");
  const [codeEtabInvalide, setCodeEtabInvalide] = useState("");

  const [nomDren, setNomDren] = useState("");
  const [nomCisco, setNomCisco] = useState("");

  // Réfs AbortController
  const rechercheAbortRef = useRef(null);
  const proxAbortRef = useRef(null);
  const villagesAbortRef = useRef(null);
  const optionsAbortRef = useRef(null);
  const eligibiliteAbortRef = useRef(null);
  const detailEtabAbortRef = useRef(null);

  const derniereSelectionRef = useRef("");
  const ignorerResetNiveauRef = useRef(false);
  const typeDemandePrecedentRef = useRef(form.type_demande);
  const eligibiliteRequestRef = useRef(0);

  const niveauKey = niveauToKey(form.niveau_etab);
  const cfg = NIVEAU_CONFIG[niveauKey];

  // Clés de dépendance
  const optionsKey = `${locSelection.dren || ""}|${locSelection.cisco || ""}|${locSelection.zap || ""}|${locSelection.commune || ""}`;
  const villagesKey = `${locSelection.fokontany || ""}|${niveauKey}`;
  const locCompleteKey = [
    locSelection.dren, locSelection.cisco, locSelection.zap,
    locSelection.commune, locSelection.fokontany,
    localisationDetail.village,
  ].join("|");

  // ============================================================
  // RÔLES
  // 🔧 MODIFIÉ : DPE = ADMIN (droits complets, aucune restriction
  //    DREN/CISCO). Seuls DREN et CISCO restent limités à leur périmètre.
  // ============================================================
  const isAdminBase = !!user?.is_superuser || !!user?.is_staff;
  const hasCisco = codeValide(user?.cisco);
  const hasDren = codeValide(user?.dren);
  const isCISCO = !isAdminBase && hasCisco;
  const isDREN = !isAdminBase && !isCISCO && hasDren;
  const isDPE = !isAdminBase && !isCISCO && !isDREN;
  // 🔧 DPE est traité comme admin partout dans le formulaire
  const isAdmin = isAdminBase || isDPE;

  const codeCiscoUser = isCISCO ? String(user.cisco).trim() : null;
  const codeDrenUser = isDREN ? String(user.dren).trim() : null;

  const eligibiliteActive = estNiveauAvecEligibiliteVillage(
    form.type_demande,
    form.sous_type,
    form.niveau_etab
  );

  // 🔧 AJOUT : valeurs DREN/CISCO imposées par l'utilisateur connecté
  const locSelectionInitiale = () => {
    if (isCISCO) {
      return {
        ...emptyLocSelection,
        dren: nomDren || String(user?.dren || ""),
        cisco: nomCisco || String(user?.cisco || ""),
      };
    }
    if (isDREN) {
      return {
        ...emptyLocSelection,
        dren: nomDren || String(user?.dren || ""),
      };
    }
    return emptyLocSelection;
  };

  // 🔧 AJOUT : contrôle que DREN/CISCO choisis = ceux de l'utilisateur
  const verifierLocalisationUtilisateur = () => {
    if (isAdmin) return "";
    if (form.type_demande !== "Nouvelle création") return "";
    const drenAttendu = nomDren || String(user?.dren || "");
    const ciscoAttendu = nomCisco || String(user?.cisco || "");
    if (isCISCO) {
      if (locSelection.dren !== drenAttendu || locSelection.cisco !== ciscoAttendu) {
        return "Vous ne pouvez soumettre une demande que pour votre propre CISCO.";
      }
    }
    if (isDREN && locSelection.dren !== drenAttendu) {
      return "Vous ne pouvez soumettre une demande que pour votre propre DREN.";
    }
    return "";
  };

  const resetEligibilite = () => {
    setEligibiliteVillageErreur("");
    setVillagesAlternatifsProposes([]);
    setEligibiliteStatut("idle");
    setZoneProposeeSelectionnee(null);
    if (eligibiliteAbortRef.current) eligibiliteAbortRef.current.abort();
  };

  // ============================================================
  // EFFET 1 — PROXIMITÉ
  // ============================================================
  useEffect(() => {
    if (form.type_demande !== "Nouvelle création") return;

    if (eligibiliteActive && eligibiliteStatut !== "eligible") {
      setTableProche([]);
      setAireListe([]);
      setInfoComplementaire(emptyInfoComplementaire);
      setChampsZapValeurs({});
      setVillageLoading(false);
      return;
    }

    const localisationComplete =
      locSelection.dren && locSelection.cisco && locSelection.zap &&
      locSelection.commune && locSelection.fokontany && localisationDetail.village;

    if (!localisationComplete) {
      setTableProche([]);
      setAireListe([]);
      setChampsZapValeurs({});
      if (!localisationDetail.village) {
        setInfoComplementaire(emptyInfoComplementaire);
      }
      return;
    }

    if (proxAbortRef.current) proxAbortRef.current.abort();
    const controller = new AbortController();
    proxAbortRef.current = controller;

    const timeoutId = setTimeout(async () => {
      if (controller.signal.aborted) return;
      setVillageLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        params.append("niveau", niveauKey);
        Object.entries(locSelection).forEach(([k, v]) => { if (v) params.append(k, v); });
        params.append("village", localisationDetail.village);

        const analyse = await api.get(
          `/ouverture/referentiel/localisations/proximite/?${params.toString()}`,
          { signal: controller.signal }
        );

        if (controller.signal.aborted) return;

        setLocalisationDetail((prev) => ({
          village: prev.village,
          fokontany: analyse?.localisation?.fokontany || locSelection.fokontany || "",
          commune: analyse?.localisation?.commune || locSelection.commune || "",
          zap: analyse?.localisation?.zap || locSelection.zap || "",
          cisco: analyse?.localisation?.cisco || locSelection.cisco || "",
          dren: analyse?.localisation?.dren || locSelection.dren || "",
        }));

        setInfoComplementaire((prev) => ({
          ...prev,
          distance_zap: analyse?.distance_zap ?? "",
          distance_cisco: analyse?.distance_cisco ?? "",
          distance_dren: analyse?.distance_dren ?? "",
          existe_proche: Boolean(analyse?.existe_proche),
          distance_plus_proche: analyse?.distance_plus_proche ?? "",
        }));

        setChampsZapValeurs(analyse?.champs_zap || {});
        setTableProche(
          Array.isArray(analyse?.etablissements_proches)
            ? analyse.etablissements_proches
            : []
        );
        setAireListe(construireAireListe(analyse, niveauKey, locSelection.fokontany));
      } catch (e) {
        if (e?.name === "AbortError") return;
        if (!controller.signal.aborted) {
          setError(e?.message || "Erreur de proximité.");
          setAireListe([]);
        }
      } finally {
        if (!controller.signal.aborted) setVillageLoading(false);
      }
    }, 500);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [
    locCompleteKey,
    niveauKey,
    form.type_demande,
    form.sous_type,
    eligibiliteActive,
    eligibiliteStatut,
  ]);

  // ============================================================
  // EFFET 2 — NOMS DREN/CISCO selon rôle
  // (DPE = admin → pas de pré-remplissage, sélection libre)
  // 🔧 MODIFIÉ : résolution code → nom PAR PLUSIEURS CHEMINS EN PARALLÈLE :
  //    (a) nom déduit du nom du compte (ex "CISCO 326 VOHIBATO" → "VOHIBATO")
  //        puis requête par NOM (déjà supportée par l'API existante)
  //    (b) requête par CODE (si le backend a été mis à jour)
  //    Les codes s'affichent immédiatement, remplacés par les noms ensuite.
  // ============================================================
  useEffect(() => {
    if (isAdmin) return;
    let actif = true;

    const unique = (arr) =>
      [...new Set((Array.isArray(arr) ? arr : []).filter(Boolean).map((v) => String(v).trim()).filter(Boolean))];
    const contientCode = (code) => {
      const c = String(code || "").trim();
      if (!c) return () => false;
      const re = new RegExp("(^|\\D)" + c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(\\D|$)");
      return (opt) => re.test(String(opt));
    };
    const choisir = (liste, code) => {
      const l = unique(liste);
      if (l.length === 1) return l[0];
      return l.find(contientCode(code)) || "";
    };
    const unSeul = (liste) => {
      const l = unique(liste);
      return l.length === 1 ? l[0] : "";
    };
    const avecTimeout = (promesse, ms) =>
      Promise.race([
        promesse,
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
      ]);
    const lireOptions = async (params, ms = 8000) => {
      const data = await avecTimeout(
        api.get(`/ouverture/referentiel/localisations/options/?${params.toString()}`),
        ms
      );
      return data?.options || {};
    };
    // "CISCO 326 VOHIBATO" -> "VOHIBATO" (retire CISCO/DREN et le code)
    const devinerNom = (code) => {
      const brut = [user?.first_name, user?.last_name].filter(Boolean).join(" ");
      return brut
        .split(/\s+/)
        .filter((t) => t && !/^(cisco|dren)$/i.test(t) && t.trim() !== String(code).trim())
        .join(" ")
        .trim();
    };

    // ---------------- CISCO ----------------
    if (isCISCO && user?.cisco) {
      const codeC = String(user.cisco).trim();
      const codeD = String(user.dren || "").trim();

      const appliquer = (d, c) => {
        if (!actif) return;
        setNomDren(d);
        setNomCisco(c);
        setLocSelection((prev) => {
          const change = prev.dren !== d || prev.cisco !== c;
          return {
            ...prev, dren: d, cisco: c,
            ...(change ? { zap: "", commune: "", fokontany: "" } : {}),
          };
        });
        setLocalisationDetail((prev) => ({ ...prev, dren: d, cisco: c }));
      };

      appliquer(codeD, codeC);

      (async () => {
        let nomC = "";
        let nomD = "";
        const devine = devinerNom(codeC);

        const requetes = [];
        if (devine) requetes.push(lireOptions(new URLSearchParams({ cisco: devine })));
        requetes.push(lireOptions(new URLSearchParams({ code_cisco: codeC })));
        const resultats = await Promise.allSettled(requetes);

        for (const r of resultats) {
          if (r.status !== "fulfilled") {
            console.warn("Résolution DREN/CISCO : requête en échec :", r.reason?.message);
            continue;
          }
          const opts = r.value;
          if (!nomC) nomC = choisir(opts.cisco, codeC);
          if (!nomD) nomD = unSeul(opts.dren);
        }
        if (nomC || nomD) appliquer(nomD || codeD, nomC || codeC);

        // Repli : déduire le DREN depuis le CISCO trouvé (requête légère par nom)
        if (actif && nomC && !nomD) {
          try {
            const o2 = await lireOptions(new URLSearchParams({ cisco: nomC }));
            nomD = unSeul(o2.dren) || choisir(o2.dren, codeD);
          } catch (e) {
            console.warn("Repli DREN via CISCO indisponible :", e?.message);
          }
        }

        if (!actif) return;
        console.info("[Demande ouverture] DREN/CISCO résolus :", { nomD, nomC, codeD, codeC, devine });
        appliquer(nomD || codeD, nomC || codeC);
      })();

      return () => { actif = false; };
    }

    // ---------------- DREN ----------------
    if (isDREN && user?.dren) {
      const codeD = String(user.dren).trim();

      const appliquer = (d) => {
        if (!actif) return;
        setNomDren(d);
        setNomCisco("");
        setLocSelection((prev) => {
          const change = prev.dren !== d;
          return {
            ...prev, dren: d,
            ...(change ? { cisco: "", zap: "", commune: "", fokontany: "" } : {}),
          };
        });
        setLocalisationDetail((prev) => ({ ...prev, dren: d }));
      };

      appliquer(codeD);

      (async () => {
        let nomD = "";
        const devine = devinerNom(codeD);

        const requetes = [];
        if (devine) requetes.push(lireOptions(new URLSearchParams({ dren: devine })));
        requetes.push(lireOptions(new URLSearchParams({ code_dren: codeD })));
        const resultats = await Promise.allSettled(requetes);

        for (const r of resultats) {
          if (r.status !== "fulfilled") {
            console.warn("Résolution DREN : requête en échec :", r.reason?.message);
            continue;
          }
          if (!nomD) nomD = choisir(r.value.dren, codeD);
        }

        if (!actif) return;
        console.info("[Demande ouverture] DREN résolu :", { nomD, codeD, devine });
        appliquer(nomD || codeD);
      })();

      return () => { actif = false; };
    }

    return () => { actif = false; };
  }, [user, isAdmin, isCISCO, isDREN]);

  // ============================================================
  // VÉRIFICATION APPARTENANCE CISCO / DREN
  // ============================================================
  const verifierAppartenanceCisco = (etab, niveauCible = null) => {
    // 🔧 Admin ET DPE (isAdmin inclut DPE) : tout est autorisé
    if (isAdmin) return { valide: true };
    const niveauDemande = niveauCible || etab?.niveau_etab || form.niveau_etab;
    const estLycee = String(niveauDemande || "").toLowerCase().includes("lyc");

    if (isDPE) return { valide: true };

    if (isDREN) {
      if (estLycee) {
        return { valide: false, message: "Un DREN ne peut pas créer ou régulariser une demande d'ouverture pour un Lycée. Seul le DPE est habilité à traiter les demandes de niveau Lycée." };
      }
      if (form.type_demande === "Nouvelle création") return { valide: true };
      if (etab) {
        const codeDrenEtab = String(etab?.code_dren ?? etab?.dren_code ?? etab?.DREN_CODE ?? etab?.codeDren ?? "").trim();
        if (codeDrenEtab && codeDrenEtab !== codeDrenUser) {
          return { valide: false, message: `Cet établissement appartient au DREN ${codeDrenEtab}. Vous êtes connecté en tant que DREN ${codeDrenUser}.`, codeDrenEtab };
        }
      }
      return { valide: true };
    }

    if (isCISCO) {
      if (estLycee) {
        return { valide: false, message: "Un CISCO ne peut pas créer une demande d'ouverture pour un Lycée. Seul le DPE est habilité à traiter les demandes de niveau Lycée." };
      }
      if (form.type_demande === "Nouvelle création") return { valide: true };
      if (etab) {
        const ciscoEtab = String(etab?.code_cisco ?? etab?.cisco_code ?? etab?.CISCO_CODE ?? etab?.codeCisco ?? "").trim();
        if (ciscoEtab && ciscoEtab !== codeCiscoUser) {
          return { valide: false, message: `Cet établissement appartient au CISCO ${ciscoEtab}. Vous êtes connecté en tant que CISCO ${codeCiscoUser}.`, codeCiscoEtab: ciscoEtab };
        }
      }
      return { valide: true };
    }
    return { valide: true };
  };

  const getNiveauxAutorises = () => {
    // 🔧 isAdmin inclut DPE → les 4 niveaux (dont Lycée)
    if (isAdmin) return ["Préscolaire", "Primaire", "Collège", "Lycée"];
    if (isDPE) return ["Lycée"];
    if (isDREN) return ["Préscolaire", "Primaire", "Collège"];
    if (isCISCO) return ["Préscolaire", "Primaire", "Collège"];
    return [];
  };

  // ============================================================
  // RESET AU CHANGEMENT DE TYPE
  // ============================================================
  useEffect(() => {
    if (typeDemandePrecedentRef.current === form.type_demande) return;
    typeDemandePrecedentRef.current = form.type_demande;

    setNouvelleCreation(emptyNouvelleCreation);
    setRegularisation(emptyRegularisation);
    setEvolutionSaisie([]);
    setEvolutionRecuperee([]);
    setPersonnelExistant([]);
    setPersonnelDetail([]);
    setRessources(emptyRessources);
    setValidationErrors({});
    setPieces(piecesInitiales.map((p) => ({ ...p, fichier: null })));

    setLocalisationDetail(emptyLocalisationDetail);
    setInfoComplementaire(emptyInfoComplementaire);
    setChampsZapValeurs({});
    setTableProche([]);
    setAireListe([]);
    setEligibiliteVillageErreur("");
    setVillagesAlternatifsProposes([]);
    setEligibiliteStatut("idle");
    setCodeVillageSelectionne("");
    setZoneProposeeSelectionnee(null);

    setVillagesFokontany([]);
    setVillagesFokontanyLoading(false);

    setEtablissementSelectionne(null);
    setEtablissementsTrouves([]);
    setRechercheEtabStatut("idle");
    derniereSelectionRef.current = "";

    setForm((prev) => ({ ...prev, code_etab: "", nom_etab: "", statut_juridique: "" }));

    if (isCISCO) {
      setLocSelection((prev) => ({
        ...prev,
        dren: nomDren || String(user?.dren || ""),
        cisco: nomCisco || String(user?.cisco || ""),
        zap: "", commune: "", fokontany: "",
      }));
    } else if (isDREN) {
      setLocSelection((prev) => ({
        ...prev,
        dren: nomDren || String(user?.dren || ""),
        cisco: "", zap: "", commune: "", fokontany: "",
      }));
    } else {
      setLocSelection(emptyLocSelection);
    }

    setCurrentStep(0);
  }, [form.type_demande, isAdmin, isCISCO, isDREN, nomDren, nomCisco, user]);

  // ============================================================
  // EFFET 3 — OPTIONS DE LOCALISATION (fusion, pas d'écrasement)
  // 🔧 MODIFIÉ : DREN/CISCO verrouillés sur l'utilisateur connecté
  // ============================================================
  useEffect(() => {
    if (form.type_demande !== "Nouvelle création") return;

    // 🔧 AJOUT : DREN/CISCO ne chargent rien tant que leur périmètre
    //    n'est pas connu (évite de récupérer la liste de TOUS les DREN/CISCO)
    if (isDREN && !locSelection.dren) return;
    if (isCISCO && (!locSelection.dren || !locSelection.cisco)) return;

    if (optionsAbortRef.current) optionsAbortRef.current.abort();
    const controller = new AbortController();
    optionsAbortRef.current = controller;

    (async () => {
      try {
        const params = new URLSearchParams();
        // 🔧 AJOUT : si le nom n'a pas pu être résolu (valeur = code utilisateur),
        //    on interroge l'API par code plutôt que par nom
        const drenEstCode = (isDREN || isCISCO) && locSelection.dren &&
          locSelection.dren === String(user?.dren || "").trim();
        const ciscoEstCode = isCISCO && locSelection.cisco &&
          locSelection.cisco === String(user?.cisco || "").trim();
        if (locSelection.dren && !ciscoEstCode) {
          params.append(drenEstCode ? "code_dren" : "dren", locSelection.dren);
        }
        if (locSelection.cisco) params.append(ciscoEstCode ? "code_cisco" : "cisco", locSelection.cisco);
        if (locSelection.zap) params.append("zap", locSelection.zap);
        if (locSelection.commune) params.append("commune", locSelection.commune);

        const data = await api.get(
          `/ouverture/referentiel/localisations/options/?${params.toString()}`,
          { signal: controller.signal }
        );
        if (controller.signal.aborted) return;

        setLocOptions((prev) => {
          const next = {
            dren: (data?.options?.dren?.length > 0) ? data.options.dren : prev.dren,
            cisco: (data?.options?.cisco?.length > 0) ? data.options.cisco : prev.cisco,
            zap: (data?.options?.zap?.length > 0) ? data.options.zap : prev.zap,
            commune: (data?.options?.commune?.length > 0) ? data.options.commune : prev.commune,
            fokontany: (data?.options?.fokontany?.length > 0) ? data.options.fokontany : prev.fokontany,
          };
          // 🔧 AJOUT : DREN/CISCO limités à leur propre périmètre
          if ((isDREN || isCISCO) && locSelection.dren) {
            next.dren = [locSelection.dren];
          }
          if (isCISCO && locSelection.cisco) {
            next.cisco = [locSelection.cisco];
          }
          return next;
        });
      } catch (e) {
        if (e?.name === "AbortError") return;
        console.error("Erreur options localisation :", e);
      }
    })();

    return () => controller.abort();
  }, [optionsKey, form.type_demande]);

  // ============================================================
  // EFFET 4 — VILLAGES (chargé seulement si fokontany choisi)
  // ============================================================
  useEffect(() => {
    if (form.type_demande !== "Nouvelle création") return;
    if (!locSelection.fokontany) {
      setVillagesFokontany([]);
      setVillagesFokontanyLoading(false);
      return;
    }

    if (villagesAbortRef.current) villagesAbortRef.current.abort();
    const controller = new AbortController();
    villagesAbortRef.current = controller;

    setVillagesFokontanyLoading(true);
    const timeoutId = setTimeout(async () => {
      if (controller.signal.aborted) return;
      try {
        const params = new URLSearchParams();
        Object.entries(locSelection).forEach(([k, v]) => { if (v) params.append(k, v); });
        const data = await api.get(
          `/ouverture/referentiel/villages/localisation/?${params.toString()}`,
          { signal: controller.signal }
        );
        if (controller.signal.aborted) return;
        setVillagesFokontany(asList(data));
      } catch (e) {
        if (e?.name === "AbortError") return;
        console.error(e);
        if (!controller.signal.aborted) setVillagesFokontany([]);
      } finally {
        if (!controller.signal.aborted) setVillagesFokontanyLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [villagesKey, form.type_demande]);

  // ============================================================
  // EFFET 5 — RECHERCHE ÉTABLISSEMENT (régularisation)
  // ============================================================
  useEffect(() => {
    if (form.type_demande !== "Régularisation") {
      setRechercheEtabStatut("idle");
      setEtablissementsTrouves([]);
      setEtablissementSelectionne(null);
      derniereSelectionRef.current = "";
      return;
    }

    const codeBrut = String(form.code_etab ?? "").trim();
    const nomBrut = String(form.nom_etab ?? "").trim();

    if (`${codeBrut}|${nomBrut}` === derniereSelectionRef.current) return;

    const terme = codeBrut || nomBrut;
    if (terme.length < 3) {
      setRechercheEtabStatut("idle");
      setEtablissementsTrouves([]);
      setEtablissementSelectionne(null);
      return;
    }

    if (rechercheAbortRef.current) rechercheAbortRef.current.abort();
    const controller = new AbortController();
    rechercheAbortRef.current = controller;

    const timeout = setTimeout(async () => {
      if (controller.signal.aborted) return;
      setRechercheEtabStatut("loading");
      try {
        const reponses = await Promise.all(
          Object.keys(NIVEAU_CONFIG).map((niv) =>
            etablissementService
              .rechercher(niv, terme, { signal: controller.signal })
              .then((r) => ({ niveau: niv, liste: asList(r) }))
              .catch((err) => {
                if (err?.name === "AbortError") throw err;
                return { niveau: niv, liste: [] };
              })
          )
        );
        if (controller.signal.aborted) return;

        const codeDe = (e) => String(e?.code_etab ?? e?.code_etablissement ?? e?.CODE_ETAB ?? e?.id ?? "").trim().toLowerCase();
        const nomDe = (e) => String(e?.nom_etab ?? e?.NOM_ETAB ?? "").toLowerCase();

        const tous = reponses.flatMap(({ niveau, liste }) => liste.map((etab) => ({ ...etab, __niveau: niveau })));
        const code = codeBrut.toLowerCase();
        const nomEtab = nomBrut.toLowerCase();
        const resultats = codeBrut ? tous.filter((e) => codeDe(e).includes(code)) : tous.filter((e) => nomDe(e).includes(nomEtab));
        resultats.sort((a, b) => Number(codeDe(b) === code) - Number(codeDe(a) === code));

        if (resultats.length === 0) {
          setRechercheEtabStatut("notfound");
          setEtablissementsTrouves([]);
          setEtablissementSelectionne(null);
          return;
        }

        const exacts = codeBrut ? resultats.filter((e) => codeDe(e) === code) : [];
        if (exacts.length === 1) {
          const verification = verifierAppartenanceCisco(exacts[0], exacts[0].__niveau);
          if (!verification.valide) {
            setRechercheEtabStatut("error");
            setEtablissementsTrouves([]);
            setEtablissementSelectionne(null);
            setCodeEtabInvalide(codeDe(exacts[0]));
            setModalSecuriteMessage(verification.message);
            setModalSecuriteOuvert(true);
            return;
          }
          selectionnerEtablissement(exacts[0], exacts[0].__niveau);
          return;
        }

        setRechercheEtabStatut("multiple");
        setEtablissementsTrouves(resultats.slice(0, 20));
        setEtablissementSelectionne(null);
      } catch (err) {
        if (err?.name === "AbortError") return;
        if (!controller.signal.aborted) {
          console.error(err);
          setRechercheEtabStatut("error");
          setEtablissementsTrouves([]);
        }
      }
    }, codeBrut ? 700 : 900);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [form.type_demande, form.nom_etab, form.code_etab]);

  // Reset sur changement niveau
  useEffect(() => {
    if (ignorerResetNiveauRef.current) { ignorerResetNiveauRef.current = false; return; }
    setChampsZapValeurs({});
    setTableProche([]);
    setAireListe([]);
    setEvolutionRecuperee([]);
    setPersonnelExistant([]);
    setPersonnelDetail([]);
    setRessources(emptyRessources);
    setValidationErrors({});
    setEligibiliteVillageErreur("");
    setVillagesAlternatifsProposes([]);
    setEligibiliteStatut("idle");
    setCodeVillageSelectionne("");
    setZoneProposeeSelectionnee(null);
  }, [niveauKey]);

  // ============================================================
  // STEPS
  // ============================================================
  const steps = useMemo(() => {
    const s = [
      { id: "general", label: "Informations générales" },
      { id: "localisation", label: "Lieu d'implantation" },
      { id: "complementaire", label: "Informations complémentaires" },
      { id: "recrutement", label: "Aire de recrutement" },
      { id: "pieces", label: "Pièces jointes" },
    ];
    if (form.type_demande === "Nouvelle création") {
      s.splice(2, 0, { id: "nouvelle_creation", label: form.sous_type === "provisoire" ? "Ouverture provisoire" : "Nouvelle création" });
    }
    if (form.type_demande === "Régularisation") {
      s.splice(2, 0, { id: "regularisation", label: "Régularisation" });
      s.splice(5, 0, { id: "evolution", label: "Évolution des effectifs" });
    }
    return s;
  }, [form.type_demande, form.sous_type]);

  const clearFieldError = (...keys) => {
    const stepId = steps[currentStep]?.id;
    if (!stepId) return;
    setValidationErrors((prev) => {
      if (!prev[stepId]) return prev;
      const restantes = prev[stepId].filter((e) => !keys.includes(e.field));
      const next = { ...prev };
      if (restantes.length === 0) delete next[stepId];
      else next[stepId] = restantes;
      return next;
    });
  };

  const change = (key, value) => { setForm((f) => ({ ...f, [key]: value })); clearFieldError(key); };
  const changeNouvelleCreation = (key, value) => { setNouvelleCreation((f) => ({ ...f, [key]: value })); clearFieldError(key); };
  const changeInfoComplementaire = (key, value) => { setInfoComplementaire((f) => ({ ...f, [key]: value })); clearFieldError(key); };
  const changeChampZap = (key, value) => { setChampsZapValeurs((f) => ({ ...f, [key]: value })); clearFieldError(key); };
  const changeEnseignants = (newRows) => { setRessources((r) => ({ ...r, enseignants: newRows })); clearFieldError("enseignants"); };
  const changePiece = (index, file) => {
    setPieces((liste) => liste.map((piece, i) => (i === index ? { ...piece, fichier: file } : piece)));
    clearFieldError(`piece.${index}`);
  };

  // ============================================================
  // ÉLIGIBILITÉ VILLAGE
  // ============================================================
  const verifierVillageSelectionne = (nomVillage, codeCisco, codeVillage, commune) => {
    if (!eligibiliteActive) {
      setEligibiliteStatut("eligible");
      setEligibiliteVillageErreur("");
      setVillagesAlternatifsProposes([]);
      return;
    }

    if (eligibiliteAbortRef.current) eligibiliteAbortRef.current.abort();
    const controller = new AbortController();
    eligibiliteAbortRef.current = controller;

    setEligibiliteStatut("checking");
    setEligibiliteVillageErreur("");
    setVillagesAlternatifsProposes([]);

    const requestId = ++eligibiliteRequestRef.current;

    verifierEligibiliteVillage(
      {
        nom_village: nomVillage,
        code_cisco: codeCisco,
        code_village: codeVillage,
        niveau: niveauKey,
        commune,
      },
      { signal: controller.signal }
    )
      .then((data) => {
        if (requestId !== eligibiliteRequestRef.current) return;
        if (controller.signal.aborted) return;

        if (data?.eligible === false) {
          setEligibiliteStatut("non_eligible");
          setEligibiliteVillageErreur(
            data.detail || `Le village « ${nomVillage} » n'est pas éligible pour une nouvelle création.`
          );
          setVillagesAlternatifsProposes(Array.isArray(data.alternatives) ? data.alternatives : []);
        } else {
          setEligibiliteStatut("eligible");
          setEligibiliteVillageErreur("");
          setVillagesAlternatifsProposes([]);
        }
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        if (requestId !== eligibiliteRequestRef.current) return;
        console.warn("Vérification éligibilité échouée", e);
        setEligibiliteStatut("eligible");
      });
  };

  const changeLocalisationDetail = (key, value, villageId) => {
    setLocalisationDetail((f) => ({ ...f, [key]: value }));
    clearFieldError(key);

    if (key !== "village") return;

    resetEligibilite();
    setTableProche([]);
    setAireListe([]);
    setInfoComplementaire(emptyInfoComplementaire);
    setChampsZapValeurs({});

    if (!value) {
      setCodeVillageSelectionne("");
      return;
    }

    const villageObjet =
      (villageId != null && villageId !== ""
        ? villagesFokontany.find((v) => String(v?.id ?? v?.code ?? "") === String(villageId))
        : villagesFokontany.find((v) => (v?.nom ?? v?.name ?? v?.nom_village ?? "") === value)) || null;

    const codeCisco = locSelection.code_cisco || localisationDetail.code_cisco || undefined;
    const codeVillage = villageId ?? villageObjet?.id ?? undefined;
    setCodeVillageSelectionne(codeVillage != null ? String(codeVillage) : "");

    const commune = localisationDetail.commune || locSelection.commune || undefined;
    verifierVillageSelectionne(value, codeCisco, codeVillage, commune);
  };

  const choisirVillageAlternatif = (alt) => {
    if (!alt) return;
    const aUnNom = Boolean(alt.nom);
    const codeAlt = alt.code_village != null && alt.code_village !== "" ? String(alt.code_village) : "";
    const aCoords = alt.latitude != null && alt.longitude != null;
    if (!aUnNom && !codeAlt && !aCoords) return;

    const distance_m = alt.distance_m != null ? Number(alt.distance_m) : null;
    let distance_km = alt.distance_km != null ? Number(alt.distance_km) : null;
    if (!Number.isFinite(distance_km) && Number.isFinite(distance_m)) distance_km = distance_m / 1000;

    if (!aUnNom) {
      setZoneProposeeSelectionnee({
        nom: "", code_village: codeAlt || null,
        commune: alt.commune || locSelection.commune || "",
        fokontany: alt.fokontany || locSelection.fokontany || "",
        latitude: alt.latitude ?? null, longitude: alt.longitude ?? null,
        distance_km: Number.isFinite(distance_km) ? distance_km : null,
        distance_m: Number.isFinite(distance_m) ? distance_m : null,
        source: "zone_proposee_centroide",
      });
      setEligibiliteVillageErreur("");
      setEligibiliteStatut("eligible");
      setTableProche([]);
      setAireListe([]);
      setInfoComplementaire(emptyInfoComplementaire);
      setChampsZapValeurs({});
      return;
    }

    const nomAlt = alt.nom;
    setVillagesFokontany((prev) => {
      const existe = prev.some(
        (v) =>
          (codeAlt && String(v?.id ?? v?.code ?? v?.code_village ?? "") === codeAlt) ||
          (v?.nom ?? v?.name ?? v?.nom_village ?? "") === nomAlt
      );
      return existe ? prev : [...prev, {
        id: codeAlt || `propose:${nomAlt}`,
        nom: nomAlt,
        latitude: alt.latitude, longitude: alt.longitude,
        distance_km: Number.isFinite(distance_km) ? distance_km : undefined,
        fokontany: alt.fokontany || "", commune: alt.commune || "",
      }];
    });

    setZoneProposeeSelectionnee({
      nom: nomAlt, code_village: codeAlt || null,
      commune: alt.commune || locSelection.commune || "",
      fokontany: alt.fokontany || locSelection.fokontany || "",
      latitude: alt.latitude ?? null, longitude: alt.longitude ?? null,
      distance_km: Number.isFinite(distance_km) ? distance_km : null,
      distance_m: Number.isFinite(distance_m) ? distance_m : null,
      source: "village_propose",
    });

    setLocalisationDetail((prev) => ({
      ...prev,
      village: nomAlt,
      fokontany: alt.fokontany || prev.fokontany,
      commune: alt.commune || prev.commune,
    }));
    setCodeVillageSelectionne(codeAlt);
    setEligibiliteVillageErreur("");
    setEligibiliteStatut("checking");
    setVillagesAlternatifsProposes([]);
    setTableProche([]);
    setAireListe([]);
    setInfoComplementaire(emptyInfoComplementaire);
    setChampsZapValeurs({});

    verifierVillageSelectionne(
      nomAlt,
      locSelection.code_cisco || localisationDetail.code_cisco || undefined,
      codeAlt || undefined,
      alt.commune || localisationDetail.commune || locSelection.commune || undefined
    );
  };

  const changeLocSelection = (key, value) => {
    // 🔧 AJOUT : DREN/CISCO verrouillés pour les utilisateurs restreints
    //    (DREN : son DREN ; CISCO : son DREN et son CISCO). Admin/DPE : libre.
    if (!isAdmin && key === "dren") return;
    if (isCISCO && key === "cisco") return;

    setLocSelection((prev) => {
      const nouveau = { ...prev, [key]: value };
      const index = ORDRE_LOC.indexOf(key);
      if (index !== -1) for (let i = index + 1; i < ORDRE_LOC.length; i++) nouveau[ORDRE_LOC[i]] = "";
      return nouveau;
    });
    if (ORDRE_LOC.includes(key)) {
      setLocalisationDetail((f) => ({ ...f, village: "" }));
      resetEligibilite();
      setCodeVillageSelectionne("");
      setTableProche([]);
      setAireListe([]);
    }
    clearFieldError(key, "village", "aire_recrutement");
  };

  const appliquerLatrines = (l, ecraser) => {
    setRegularisation((prev) => ({
      ...prev,
      latrine_f: ecraser ? l.f : l.f || prev.latrine_f,
      latrine_g: ecraser ? l.g : l.g || prev.latrine_g,
      latrine_total: ecraser ? l.total : l.total || prev.latrine_total,
      latrine_separee: ecraser ? l.separee : l.separee || prev.latrine_separee,
    }));
    setNouvelleCreation((prev) => ({
      ...prev,
      latrine_f: ecraser ? l.f : l.f || prev.latrine_f,
      latrine_g: ecraser ? l.g : l.g || prev.latrine_g,
    }));
  };

  const chargerEvolutionEtablissement = async (codeEtab, niveauCible, options = {}) => {
    if (!codeEtab || form.type_demande !== "Régularisation") { setEvolutionRecuperee([]); return; }
    const niveauEvolution = niveauCible || niveauKey;
    const colonnesEffectif = NIVEAU_COLONNES_EFFECTIF[niveauEvolution] || [];
    try {
      const data = await etablissementService.getEvolution(codeEtab, niveauEvolution, options);
      const valeurs = Array.isArray(data) ? data
        : Array.isArray(data?.effectifs) ? data.effectifs
        : Array.isArray(data?.evolution) ? data.evolution
        : [];
      const lignes = valeurs.map((item, index) => {
        const ligne = {
          annee: item.annee ?? item.annee_scolaire ?? item.label ?? item.ANNEE ?? `Année ${index + 1}`,
          effectif_total: item.effectif ?? item.effectif_total ?? item.total ?? item.EFFECTIF ?? 0,
        };
        colonnesEffectif.forEach((colonne) => { ligne[colonne.key] = Number(item[colonne.key]) || 0; });
        return ligne;
      });
      const triees = [...lignes].sort((a, b) => String(a.annee).localeCompare(String(b.annee)));
      setEvolutionRecuperee(triees.slice(-3));
    } catch (e) {
      if (e?.name !== "AbortError") {
        console.error(e);
        setEvolutionRecuperee([]);
      }
    }
  };

  const appliquerDetailEtablissement = async (etab, niveauCible) => {
    const niveauUtilise = niveauCible || niveauKey;
    const code = etab?.code_etab ?? etab?.code_etablissement ?? etab?.CODE_ETAB ?? etab?.id ?? "";
    const nom = etab?.nom_etab ?? etab?.NOM_ETAB ?? "";

    appliquerLatrines(lireLatrines(etab), true);

    // ✅ CALCUL DU NOMBRE D'ANNÉES D'EXISTANT
    const dateOuvrInitiale = formatDateForInput(etab?.date_ouverture ?? etab?.date_ouverture_etablissement);
    const nombreAnneesInitial = calculerNombreAnnees(dateOuvrInitiale);

    setRegularisation((prev) => ({
      ...prev,
      nbr_salle: etab?.nombre_salle != null ? String(etab.nombre_salle) : prev.nbr_salle,
      nbr_tablebanc: etab?.nombre_table_banc != null ? String(etab.nombre_table_banc) : prev.nbr_tablebanc,
      date_ouverture: dateOuvrInitiale || prev.date_ouverture,
      nombre_annee: nombreAnneesInitial || prev.nombre_annee,
    }));
    setPersonnelExistant(lignesPersonnelDepuis(etab));
    setPersonnelDetail(construirePersonnelDetail(etab));
    setLocalisationDetail((prev) => fusionnerLocalisation(etab, prev));
    setForm((prev) => ({
      ...prev,
      code_etab: code || prev.code_etab,
      nom_etab: nom || prev.nom_etab,
      statut_juridique: deriveStatutJuridique(etab, prev.statut_juridique),
    }));

    if (!code) { setEvolutionRecuperee([]); return; }

    if (detailEtabAbortRef.current) detailEtabAbortRef.current.abort();
    const controller = new AbortController();
    detailEtabAbortRef.current = controller;

    const pDetail = etablissementService.get(code, niveauUtilise, { signal: controller.signal }).catch((e) => {
      if (e?.name === "AbortError") throw e;
      return null;
    });
    const pProx = etablissementService.getProximite(code, niveauUtilise, { signal: controller.signal }).catch((e) => {
      if (e?.name === "AbortError") throw e;
      return null;
    });
    const pEvolution = chargerEvolutionEtablissement(code, niveauUtilise, { signal: controller.signal });

    try {
      const [respDetail, respProx] = await Promise.all([pDetail, pProx]);
      if (controller.signal.aborted) return;

      if (respDetail) {
        const data = respDetail?.data ?? respDetail;
        const detail = data?.etablissement ?? data?.etab ?? data;
        if (detail) {
          appliquerLatrines(lireLatrines(detail), false);
          const dateOuvrDetail = formatDateForInput(detail?.date_ouverture ?? detail?.DATE_OUVERTURE);
          const nombreAnneesDetail = calculerNombreAnnees(dateOuvrDetail);
          setRegularisation((prev) => ({
            ...prev,
            nbr_salle: detail?.nombre_salle ?? detail?.nbr_salle ?? detail?.NB_SALLE ?? prev.nbr_salle,
            nbr_tablebanc: detail?.nombre_tablebanc ?? detail?.nbr_tablebanc ?? detail?.NB_TABLE_BANC ?? prev.nbr_tablebanc,
            date_ouverture: dateOuvrDetail || prev.date_ouverture,
            nombre_annee: nombreAnneesDetail || prev.nombre_annee,
            type_batiment: detail?.type_batiment ?? detail?.TYPE_BATIMENT ?? prev.type_batiment,
            surface_terrain: detail?.surface_terrain ?? detail?.SURFACE_TERRAIN ?? prev.surface_terrain,
            nbr_batiment: detail?.nombre_batiment ?? detail?.nbr_batiment ?? detail?.NB_BATIMENT ?? prev.nbr_batiment,
          }));
          setLocalisationDetail((prev) => fusionnerLocalisation(detail, prev));
          const lignes = lignesPersonnelDepuis(detail);
          if (lignes.length > 0) setPersonnelExistant(lignes);
          const details = construirePersonnelDetail(detail);
          if (details.length > 0) setPersonnelDetail(details);
        }
      }

      if (respProx) {
        const data = respProx?.data ?? respProx;
        const detail = data?.etablissement ?? null;
        if (detail) {
          appliquerLatrines(lireLatrines(detail), false);
          setLocalisationDetail((prev) => fusionnerLocalisation(detail, prev));
          const lignes = lignesPersonnelDepuis(detail);
          if (lignes.length > 0) setPersonnelExistant(lignes);
          const details = construirePersonnelDetail(detail);
          if (details.length > 0) setPersonnelDetail(details);
        }
        setInfoComplementaire((prev) => ({
          ...prev,
          distance_zap: data?.distance_zap ?? prev.distance_zap,
          distance_cisco: data?.distance_cisco ?? prev.distance_cisco,
          distance_dren: data?.distance_dren ?? prev.distance_dren,
          existe_proche: Boolean(data?.existe_proche),
          distance_plus_proche: data?.distance_plus_proche ?? prev.distance_plus_proche,
        }));
        setChampsZapValeurs(data?.champs_zap || {});
        setTableProche(Array.isArray(data?.etablissements_proches) ? data.etablissements_proches : []);
        setAireListe(construireAireListe(data, niveauUtilise, detail?.fokontany || etab?.fokontany || ""));
      }

      await pEvolution;
    } catch (e) {
      if (e?.name !== "AbortError") console.error(e);
    }
  };

  const selectionnerEtablissement = (etab, niveauTrouve) => {
    const verification = verifierAppartenanceCisco(etab, niveauTrouve);
    if (!verification.valide) {
      setCodeEtabInvalide(String(etab?.code_etab ?? etab?.code_etablissement ?? etab?.CODE_ETAB ?? ""));
      setModalSecuriteMessage(verification.message);
      setModalSecuriteOuvert(true);
      setRechercheEtabStatut("error");
      setEtablissementsTrouves([]);
      setEtablissementSelectionne(null);
      return;
    }

    setEtablissementSelectionne(etab);
    setEtablissementsTrouves([]);
    setRechercheEtabStatut("found");

    const code = String(etab?.code_etab ?? etab?.code_etablissement ?? etab?.CODE_ETAB ?? etab?.id ?? "").trim();
    const nom = String(etab?.nom_etab ?? etab?.NOM_ETAB ?? "").trim();
    derniereSelectionRef.current = `${code}|${nom}`;

    const niveauFinal = niveauTrouve || niveauKey;
    const labelNiveauFinal = KEY_TO_NIVEAU_LABEL[niveauFinal];

    if (labelNiveauFinal && labelNiveauFinal !== form.niveau_etab) {
      if (niveauToKey(form.niveau_etab) !== niveauFinal) ignorerResetNiveauRef.current = true;
      change("niveau_etab", labelNiveauFinal);
    }
    appliquerDetailEtablissement(etab, niveauFinal);
  };

  const validationEligibiliteBloquante = () => {
    if (!estNiveauAvecEligibiliteVillage(form.type_demande, form.sous_type, form.niveau_etab)) return false;
    if (zoneProposeeSelectionnee) return false;
    return Boolean(eligibiliteVillageErreur);
  };

  const validateStep = (stepId) => {
    const errors = validerEtape(stepId, {
      form, localisationDetail, locSelection, nouvelleCreation,
      regularisation, ressources, pieces, cfg, villageLoading,
    });
    if (stepId === "localisation" && validationEligibiliteBloquante()) {
      errors.push({ field: "village", message: eligibiliteVillageErreur });
    }
    // 🔧 AJOUT : un CISCO / DREN ne peut agir que sur son propre périmètre
    if (stepId === "localisation") {
      const violation = verifierLocalisationUtilisateur();
      if (violation) {
        errors.push({ field: isCISCO ? "cisco" : "dren", message: violation });
      }
    }
    if (etablissementSelectionne && form.type_demande === "Régularisation") {
      const verification = verifierAppartenanceCisco(etablissementSelectionne, form.niveau_etab);
      if (!verification.valide) errors.push({ field: "code_etab", message: verification.message });
    }
    return errors;
  };

  const goToNext = () => {
    const stepId = steps[currentStep].id;
    if (stepId === "localisation" && validationEligibiliteBloquante()) return;
    const errors = validateStep(stepId);
    if (errors.length > 0) {
      setValidationErrors({ [stepId]: errors });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setValidationErrors({});
    if (currentStep < steps.length - 1) setCurrentStep(currentStep + 1);
  };

  const goToPrev = () => {
    setValidationErrors({});
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const submit = async (e) => {
    e.preventDefault();
    setValidationErrors({});
    setError("");
    setOk("");

    if (validationEligibiliteBloquante()) {
      setError(eligibiliteVillageErreur);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (etablissementSelectionne && form.type_demande === "Régularisation") {
      const verification = verifierAppartenanceCisco(etablissementSelectionne, form.niveau_etab);
      if (!verification.valide) {
        setModalSecuriteMessage(verification.message);
        setModalSecuriteOuvert(true);
        return;
      }
    }

    let allErrors = [];
    let firstErrorStep = -1;
    const erreursParEtape = {};
    for (let i = 0; i < steps.length; i++) {
      const errors = validateStep(steps[i].id);
      if (errors.length > 0) {
        allErrors = [...allErrors, ...errors];
        erreursParEtape[steps[i].id] = errors;
        if (firstErrorStep === -1) firstErrorStep = i;
      }
    }
    if (allErrors.length > 0) {
      setValidationErrors(erreursParEtape);
      if (firstErrorStep !== -1) setCurrentStep(firstErrorStep);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setLoading(true);
    try {
      const payloadBase = {
        nom_demandeur: form.nom_demandeur.trim(),
        telephone_demandeur: form.telephone_demandeur.trim(),
        email_demandeur: form.email_demandeur.trim(),
        nom_etab: form.nom_etab,
        code_etab: form.code_etab,
        niveau_etab: form.niveau_etab,
        statut_juridique: form.statut_juridique,
        type_demande: form.type_demande,
        sous_type: form.sous_type,
        localisation: Number(form.localisation) || null,
        village_implantation: localisationDetail.village,
        localisation_detail: localisationDetail,
        info_complementaire: { ...infoComplementaire, ...champsZapValeurs },
        etablissements_proches: infoComplementaire.existe_proche === true ? tableProche : [],
        aire_recrutement: aireListe,
        ressources: {
          nb_salle_classe: ressources.nb_salle_classe,
          type_batiment: ressources.type_batiment,
          nb_tablebanc: ressources.nb_tablebanc,
          surface_terrain: ressources.surface_terrain,
          latrine_f: Number(nouvelleCreation.latrine_f) || Number(regularisation.latrine_f) || 0,
          latrine_g: Number(nouvelleCreation.latrine_g) || Number(regularisation.latrine_g) || 0,
          latrine_total: regularisation.latrine_total || 0,
        },
        enseignants: ressources.enseignants,
        zone_proposee: zoneProposeeSelectionnee || null,
      };

      if (zoneProposeeSelectionnee && !zoneProposeeSelectionnee.nom) {
        payloadBase.village_non_eligible = {
          nom: localisationDetail.village || "",
          code_village: codeVillageSelectionne || "",
          commune: locSelection.commune || "",
          fokontany: locSelection.fokontany || "",
          source: "village_non_eligible_conserve",
        };
      }
      if (form.type_demande === "Nouvelle création" && codeVillageSelectionne) {
        payloadBase.code_village = codeVillageSelectionne;
      }
      payloadBase.code_dren = locSelection.dren || null;
      payloadBase.code_cisco = locSelection.cisco || null;

      if (form.type_demande === "Nouvelle création") {
        payloadBase.nouvelle_creation = nouvelleCreation;
        if (form.sous_type === "provisoire") {
          payloadBase.evolution_effectifs = evolutionSaisie.map((ligne) => ({
            ...ligne,
            effectif_total: calculerTotalEvolutionLigne(ligne, niveauKey),
          }));
        }
      } else if (form.type_demande === "Régularisation") {
        payloadBase.regularisation = regularisation;
        payloadBase.personnel_existant = personnelExistant;
        payloadBase.personnel_detail = personnelDetail;
        payloadBase.evolution_effectifs = evolutionRecuperee;
      }

      const demande = await demandeService.create(payloadBase);
      const demandeCreee = demande?.data || demande;
      const demandeId = demandeCreee?.id_demande;

      if (demandeId) {
        for (const piece of pieces) {
          if (piece.fichier) {
            const formData = new FormData();
            formData.append("demande", demandeId);
            formData.append("nom_piece", piece.nom);
            formData.append("fichier", piece.fichier);
            formData.append("fourni", true);
            await pieceFournieService.create(formData);
          }
        }
      }

      setOk("Demande créée avec succès, avec toutes les pièces jointes.");

      derniereSelectionRef.current = "";
      ignorerResetNiveauRef.current = false;
      setForm(empty);
      setNouvelleCreation(emptyNouvelleCreation);
      setRegularisation(emptyRegularisation);
      setPieces(piecesInitiales.map((piece) => ({ ...piece, fichier: null })));
      setLocalisationDetail(emptyLocalisationDetail);
      setVillageLoading(false);
      setInfoComplementaire(emptyInfoComplementaire);
      setChampsZapValeurs({});
      setTableProche([]);
      setAireListe([]);
      setEvolutionRecuperee([]);
      setEvolutionSaisie([]);
      setPersonnelExistant([]);
      setPersonnelDetail([]);
      setRessources(emptyRessources);
      setCurrentStep(0);
      setValidationErrors({});
      setRechercheEtabStatut("idle");
      setEtablissementsTrouves([]);
      setEtablissementSelectionne(null);
      // 🔧 MODIFIÉ : on conserve DREN/CISCO automatiques pour CISCO/DREN
      setLocSelection(locSelectionInitiale());
      setLocOptions(emptyLocOptions);
      setVillagesFokontany([]);
      setVillagesFokontanyLoading(false);
      setEligibiliteVillageErreur("");
      setVillagesAlternatifsProposes([]);
      setEligibiliteStatut("idle");
      setCodeVillageSelectionne("");
      setZoneProposeeSelectionnee(null);
    } catch (e) {
      console.error(e);
      const msg = e?.message || "Erreur lors de la création.";
      if (String(msg).toLowerCase().includes("eligible") || String(msg).toLowerCase().includes("éligible")) {
        setEligibiliteVillageErreur(msg);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return {
    form, setForm,
    nouvelleCreation, setNouvelleCreation,
    regularisation, setRegularisation,
    pieces, setPieces,
    error, ok, loading,
    localisationDetail, setLocalisationDetail,
    infoComplementaire, setInfoComplementaire,
    champsZapValeurs, setChampsZapValeurs,
    tableProche, setTableProche,
    aireListe, setAireListe,
    villageLoading,
    evolutionRecuperee, setEvolutionRecuperee,
    evolutionSaisie, setEvolutionSaisie,
    personnelExistant, setPersonnelExistant,
    personnelDetail, setPersonnelDetail,
    ressources, setRessources,
    currentStep, setCurrentStep,
    validationErrors, setValidationErrors,
    locSelection, setLocSelection,
    locOptions, setLocOptions,
    villagesFokontany, villagesFokontanyLoading,
    rechercheEtabStatut, etablissementsTrouves, etablissementSelectionne,
    niveauKey, cfg, steps,
    isAdmin, isCISCO, isDPE, isDREN, getNiveauxAutorises,
    nomDren, nomCisco,
    modalSecuriteOuvert, setModalSecuriteOuvert,
    modalSecuriteMessage, setModalSecuriteMessage,
    codeEtabInvalide, setCodeEtabInvalide,
    eligibiliteVillageErreur,
    setEligibiliteVillageErreur,
    villagesAlternatifsProposes,
    eligibiliteStatut,
    codeVillageSelectionne,
    zoneProposeeSelectionnee,
    change, changeNouvelleCreation, changeInfoComplementaire, changeChampZap,
    changeEnseignants, changePiece, changeLocalisationDetail, changeLocSelection,
    choisirVillageAlternatif,
    selectionnerEtablissement, goToNext, goToPrev, submit,
    validateStep, clearFieldError,
  };
}