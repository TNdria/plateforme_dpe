
// @ts-nocheck

const DEFAULT_DJANGO_BACKEND_URL = "https://dpe-men.mg";

function normalizeDjangoBackendUrl(url: string) {
  const cleaned = String(url || DEFAULT_DJANGO_BACKEND_URL)
    .trim()
    .replace(/\/+$/, "");

  // Remplacement de l'adresse IP uniquement pour le module Ouverture.
  // Les autres modules continuent d'utiliser leur configuration habituelle.
  return cleaned.replace(
    /^https?:\/\/102\.16\.234\.114(?::\d+)?$/i,
    DEFAULT_DJANGO_BACKEND_URL
  );
}

const BASE_URL_NORMALISEE = normalizeDjangoBackendUrl(
  (import.meta as any)?.env?.VITE_API_URL ||
    DEFAULT_DJANGO_BACKEND_URL
);

// ============================================================
// TOKEN CSRF DJANGO
// ============================================================

function getCsrfToken() {
  if (typeof document === "undefined") {
    return null;
  }

  const match = document.cookie.match(
    /(?:^|;\s*)csrftoken=([^;]+)/
  );

  return match ? decodeURIComponent(match[1]) : null;
}

// ============================================================
// FONCTION PRINCIPALE DE REQUÊTE
// ============================================================

async function request(path, options = {}) {
  const isFormData =
    typeof FormData !== "undefined" &&
    options.body instanceof FormData;

  const headers = {
    Accept: "application/json",

    ...(isFormData
      ? {}
      : { "Content-Type": "application/json" }),

    ...(options.headers || {}),
  };

  const csrfToken = getCsrfToken();

  if (csrfToken) {
    headers["X-CSRFToken"] = csrfToken;
  }

  const chemin = path.startsWith("/")
    ? path
    : `/${path}`;

  // Aucun préfixe /api ajouté automatiquement.
  const url = `${BASE_URL_NORMALISEE}${chemin}`;

  try {
    const response = await fetch(url, {
      credentials: "include",
      ...options,
      headers,
    });

    // ========================================================
    // GESTION DES ERREURS HTTP
    // ========================================================

    if (!response.ok) {
      const responseText = await response.text();

      let detail = "";

      if (responseText) {
        try {
          const data = JSON.parse(responseText);

          detail =
            data?.detail ||
            data?.error ||
            data?.message ||
            JSON.stringify(data);
        } catch {
          detail = responseText;
        }
      }

      const error = new Error(
        detail || `Erreur ${response.status} sur ${url}`
      );

      error.status = response.status;
      error.url = url;

      throw error;
    }

    // ========================================================
    // RÉPONSE SANS CONTENU
    // ========================================================

    if (response.status === 204) {
      return undefined;
    }

    const responseText = await response.text();

    if (!responseText) {
      return undefined;
    }

    // ========================================================
    // CONVERSION JSON
    // ========================================================

    try {
      return JSON.parse(responseText);
    } catch {
      throw new Error(
        `La réponse du serveur n'est pas un JSON valide pour ${url}`
      );
    }
  } catch (error) {
    // Conserver le comportement d'annulation AbortController.
    if (error?.name === "AbortError") {
      throw error;
    }

    console.error(
      `[API Ouverture] Erreur lors de la requête : ${url}`,
      error
    );

    throw error;
  }
}

// ============================================================
// MÉTHODES API
// ============================================================

export const api = {
  get: (path, options = {}) =>
    request(path, {
      ...options,
      method: "GET",
    }),

  post: (path, body, options = {}) =>
    request(path, {
      ...options,
      method: "POST",
      body:
        typeof FormData !== "undefined" &&
        body instanceof FormData
          ? body
          : JSON.stringify(body ?? {}),
    }),

  patch: (path, body, options = {}) =>
    request(path, {
      ...options,
      method: "PATCH",
      body:
        typeof FormData !== "undefined" &&
        body instanceof FormData
          ? body
          : JSON.stringify(body ?? {}),
    }),

  del: (path, options = {}) =>
    request(path, {
      ...options,
      method: "DELETE",
    }),
};

// ============================================================
// CONVERSION D'UNE RÉPONSE API EN LISTE
// ============================================================

export function asList(response) {
  if (!response) {
    return [];
  }

  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.results)) {
    return response.results;
  }

  return [];
}

// ============================================================
// VÉRIFICATION DE L'ÉLIGIBILITÉ D'UN VILLAGE
// ============================================================

export async function verifierEligibiliteVillage(
  params,
  options = {}
) {
  const usp = new URLSearchParams();

  if (params?.nom_village) {
    usp.set("nom_village", params.nom_village);
  }

  if (
    params?.code_village != null &&
    params.code_village !== ""
  ) {
    usp.set("code_village", String(params.code_village));
  }

  if (
    params?.code_cisco != null &&
    params.code_cisco !== ""
  ) {
    usp.set("code_cisco", String(params.code_cisco));
  }

  if (params?.niveau) {
    usp.set("niveau", params.niveau);
  }

  if (params?.commune) {
    usp.set("commune", params.commune);
  }

  const query = usp.toString();

  const path =
    "/ouverture/referentiel/villages/eligible-nouvelle-creation/";

  return api.get(
    query ? `${path}?${query}` : path,
    options
  );
}
