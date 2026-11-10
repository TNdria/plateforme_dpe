// @ts-nocheck
import { api } from "./demandeApi";

// ============================================================
// DEMANDES D'OUVERTURE / RÉGULARISATION
// ============================================================
export const demandeService = {
  list: () => api.get("/ouverture/demandes/"),
  get: (id) => api.get(`/ouverture/demandes/${id}/`),
  create: (payload) => api.post("/ouverture/demandes/", payload),
  update: (id, payload) => api.patch(`/ouverture/demandes/${id}/`, payload),
  remove: (id) => api.del(`/ouverture/demandes/${id}/`),

  modifierStatut: (id, statut_demande) =>
    api.patch(`/ouverture/demandes/${id}/statut/`, { statut_demande }),

  detailComplet: (id, options = {}) =>
    api.get(`/ouverture/demandes/${id}/detail-complet/`, options),

  listApprouvees: async () => {
    const reponse = await api.get("/ouverture/demandes/approuvees/");
    if (Array.isArray(reponse)) return reponse;
    if (reponse && Array.isArray(reponse.results)) return reponse.results;
    return [];
  },
};

// ============================================================
// DÉCISIONS
// ============================================================
export const decisionService = {
  list: () => api.get("/ouverture/decisions/"),
  get: (id) => api.get(`/ouverture/decisions/${id}/`),
  create: (payload) => api.post("/ouverture/decisions/", payload),
  update: (id, payload) => api.patch(`/ouverture/decisions/${id}/`, payload),
};

// ============================================================
// ATTRIBUTION DE CODE
// ============================================================
export const attributionCodeService = {
  list: () => api.get("/ouverture/attributions-code/"),
  get: (id) => api.get(`/ouverture/attributions-code/${id}/`),
  create: (demandeId, code) =>
    api.post("/ouverture/attributions-code/", {
      demande: demandeId,
      code: code.trim(),
    }),
  update: (id, payload) =>
    api.patch(`/ouverture/attributions-code/${id}/`, payload),
};

// ============================================================
// LOCALISATION
// ============================================================
export const localisationService = {
  list: () => api.get("/ouverture/referentiel/localisations/"),

  options: (params = {}, options = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([cle, valeur]) => {
      if (valeur) query.append(cle, valeur);
    });
    const qs = query.toString();
    return api.get(
      `/ouverture/referentiel/localisations/options/${qs ? `?${qs}` : ""}`,
      options
    );
  },

  proximite: (params = {}, options = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([cle, valeur]) => {
      if (valeur) query.append(cle, valeur);
    });
    const qs = query.toString();
    return api.get(
      `/ouverture/referentiel/localisations/proximite/${qs ? `?${qs}` : ""}`,
      options
    );
  },

  listVillages: (q, options = {}) =>
    api.get(
      `/ouverture/referentiel/villages/${q ? `?q=${encodeURIComponent(q)}` : ""}`,
      options
    ),

  getVillage: (villageId, options = {}) =>
    api.get(
      `/ouverture/referentiel/villages/${encodeURIComponent(String(villageId))}/`,
      options
    ),

  getInfosProximite: (villageId, niveau, options = {}) =>
    api.get(
      `/ouverture/referentiel/villages/${encodeURIComponent(
        String(villageId)
      )}/proximite/?niveau=${encodeURIComponent(niveau)}`,
      options
    ),
};

// ============================================================
// ÉTABLISSEMENTS EXISTANTS
// ============================================================
export const etablissementService = {
  list: (niveau, options = {}) =>
    api.get(
      `/ouverture/referentiel/etablissements/?niveau=${encodeURIComponent(niveau)}`,
      options
    ),

  get: (id, niveau = "primaire", options = {}) =>
    api.get(
      `/ouverture/referentiel/etablissements/${encodeURIComponent(
        String(id)
      )}/?niveau=${encodeURIComponent(niveau)}`,
      options
    ),

  /**
   * ✅ Accepte { signal } pour annuler les recherches obsolètes.
   */
  rechercher: (niveau, q, options = {}) =>
    api.get(
      `/ouverture/referentiel/etablissements/recherche/?niveau=${encodeURIComponent(
        niveau
      )}&q=${encodeURIComponent(q.trim())}`,
      options
    ),

  rechercherParCode: (code, niveau = "primaire", options = {}) =>
    api.get(
      `/ouverture/referentiel/etablissements/recherche/?niveau=${encodeURIComponent(
        niveau
      )}&q=${encodeURIComponent(code.trim())}`,
      options
    ),

  getProximite: (id, niveau = "primaire", options = {}) =>
    api.get(
      `/ouverture/referentiel/etablissements/${encodeURIComponent(
        String(id)
      )}/proximite/?niveau=${encodeURIComponent(niveau)}`,
      options
    ),

  getEvolution: (id, niveau = "primaire", options = {}) =>
    api.get(
      `/ouverture/referentiel/etablissements/${encodeURIComponent(
        String(id)
      )}/evolution/?niveau=${encodeURIComponent(niveau)}`,
      options
    ),
};

// ============================================================
// PIÈCES FOURNIES
// ============================================================
export const pieceFournieService = {
  create: (formData) => api.post("/ouverture/pieces/", formData),
  list: () => api.get("/ouverture/pieces/"),
  get: (id) => api.get(`/ouverture/pieces/${id}/`),
};

// ============================================================
// ÉLIGIBILITÉ VILLAGE
// ============================================================
export const villageEligibleService = {
  verifier: async (params, options = {}) => {
    const { nom_village, code_cisco, code_village, niveau, commune } = params || {};
    const query = new URLSearchParams();
    if (nom_village) query.set("nom_village", nom_village);
    if (code_cisco) query.set("code_cisco", code_cisco);
    if (code_village) query.set("code_village", code_village);
    if (niveau) query.set("niveau", niveau);
    if (commune) query.set("commune", commune);
    const qs = query.toString();
    const reponse = await api.get(
      `/ouverture/referentiel/village-eligible-nouvelle-creation/${
        qs ? `?${qs}` : ""
      }`,
      options
    );
    return reponse?.data ?? reponse;
  },
};