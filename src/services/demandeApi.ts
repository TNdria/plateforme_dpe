// @ts-nocheck
const BASE_URL =
  (import.meta as any)?.env?.VITE_API_URL || "http://127.0.0.1:8000/api";

const BASE_URL_NORMALISEE = (() => {
  const base = String(BASE_URL).trim().replace(/\/+$/, "");
  return /\/api$/i.test(base) ? base : `${base}/api`;
})();

function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * ✅ Timeout par défaut : 30 secondes.
 * Au-delà, on annule la requête → l'UI ne reste plus bloquée.
 */
const DEFAULT_TIMEOUT_MS = 30_000;

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;

  const headers = {
    Accept: "application/json",
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...((options.headers) || {}),
  };

  const csrfToken = getCsrfToken();
  if (csrfToken) headers["X-CSRFToken"] = csrfToken;

  const chemin = path.startsWith("/") ? path : `/${path}`;
  const url = `${BASE_URL_NORMALISEE}${chemin}`;

  // ✅ Combiner le signal externe (AbortController du composant) + timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(new Error("Timeout de la requête")),
    options.timeout ?? DEFAULT_TIMEOUT_MS
  );

  const externalSignal = options.signal;
  const onExternalAbort = () => controller.abort(externalSignal.reason);
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort(externalSignal.reason);
    else externalSignal.addEventListener("abort", onExternalAbort, { once: true });
  }

  try {
    const response = await fetch(url, {
      credentials: "include",
      ...options,
      signal: controller.signal,
      headers,
    });

    if (!response.ok) {
      const responseText = await response.text();
      let detail = "";
      if (responseText) {
        try {
          const data = JSON.parse(responseText);
          detail =
            data?.detail || data?.error || data?.message || JSON.stringify(data);
        } catch {
          detail = responseText;
        }
      }
      throw new Error(detail || `Erreur ${response.status} sur ${url}`);
    }

    if (response.status === 204) return undefined;

    const responseText = await response.text();
    if (!responseText) return undefined;

    try {
      return JSON.parse(responseText);
    } catch {
      throw new Error(`La réponse du serveur n'est pas un JSON valide pour ${url}`);
    }
  } finally {
    clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }
}

export const api = {
  get: (path, options = {}) =>
    request(path, { ...options, method: "GET" }),

  post: (path, body, options = {}) =>
    request(path, {
      ...options,
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    }),

  patch: (path, body, options = {}) =>
    request(path, {
      ...options,
      method: "PATCH",
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    }),

  del: (path, options = {}) =>
    request(path, { ...options, method: "DELETE" }),
};

export function asList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.results)) return response.results;
  return [];
}

/**
 * ✅ Éligibilité village — accepte options (signal).
 */
export async function verifierEligibiliteVillage(params, options = {}) {
  const usp = new URLSearchParams();
  if (params.nom_village) usp.set("nom_village", params.nom_village);
  if (params.code_village != null && params.code_village !== "")
    usp.set("code_village", String(params.code_village));
  if (params.code_cisco != null && params.code_cisco !== "")
    usp.set("code_cisco", String(params.code_cisco));
  if (params.niveau) usp.set("niveau", params.niveau);
  if (params.commune) usp.set("commune", params.commune);

  return api.get(
    `/ouverture/referentiel/villages/eligible-nouvelle-creation/?${usp.toString()}`,
    options
  );
}