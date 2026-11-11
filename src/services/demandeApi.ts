type JsonValue = string | number | boolean | null | undefined | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

function normalizeResponse(data: unknown): unknown {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];

  const candidate = (data as Record<string, unknown>).data ?? (data as Record<string, unknown>).results ?? (data as Record<string, unknown>).items;
  if (Array.isArray(candidate)) return candidate;

  const values = Object.values(data as Record<string, unknown>);
  const firstArray = values.find(Array.isArray);
  if (Array.isArray(firstArray)) return firstArray;

  return [];
}

export function asList<T = Record<string, unknown>>(response: unknown): T[] {
  const value = normalizeResponse(response);
  return Array.isArray(value) ? (value as T[]) : [];
}

async function request<T>(method: string, url: string, body?: JsonObject | unknown): Promise<T> {
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    credentials: "include",
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status}: ${text || response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json() as Promise<T>;
  }

  return undefined as T;
}

export const api = {
  get: <T = unknown>(url: string) => request<T>("GET", url),
  post: <T = unknown>(url: string, body?: JsonObject | unknown) => request<T>("POST", url, body),
  put: <T = unknown>(url: string, body?: JsonObject | unknown) => request<T>("PUT", url, body),
  patch: <T = unknown>(url: string, body?: JsonObject | unknown) => request<T>("PATCH", url, body),
  delete: <T = unknown>(url: string, body?: JsonObject | unknown) => request<T>("DELETE", url, body),
};

export async function verifierEligibiliteVillage(_payload: Record<string, unknown>) {
  return {
    eligible: true,
    villages: [],
    message: "",
  };
}

export default api;
