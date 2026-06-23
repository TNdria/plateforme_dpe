import { supabase } from "@/integrations/supabase/client";

const DEFAULT_DJANGO_BACKEND_URL = "https://dpe-men.mg";

function normalizeDjangoBackendUrl(url: string) {
  const cleaned = url.trim().replace(/\/$/, "");
  return cleaned.replace(/^https?:\/\/102\.16\.234\.114$/, DEFAULT_DJANGO_BACKEND_URL);
}

const DJANGO_BACKEND_URL = normalizeDjangoBackendUrl(
  import.meta.env.VITE_API_URL || DEFAULT_DJANGO_BACKEND_URL,
);

// Construct Supabase URL from project ID to avoid stale .env issues
const getSupabaseUrl = () => {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  if (projectId) return `https://${projectId}.supabase.co`;
  return import.meta.env.VITE_SUPABASE_URL;
};

// Helper function for direct database API calls via edge function
async function fetchDB<T>(action: string, params: Record<string, string | number> = {}): Promise<T> {
  const supabaseUrl = getSupabaseUrl();
  
  // Build query string with action and params
  const queryParams = new URLSearchParams({ action });
  Object.entries(params).forEach(([key, value]) => {
    queryParams.append(key, String(value));
  });
  
  const dbQueryUrl = `${supabaseUrl}/functions/v1/db-query?${queryParams.toString()}`;
  
  try {
    const response = await fetch(dbQueryUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`DB API Error ${response.status}:`, errorText);
      throw new Error(`API Error: ${response.status} - ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON response`);
    }
  } catch (error) {
    console.error(`Error fetching ${action}:`, error);
    throw error;
  }
}

// Batch fetch - multiple queries in one DB connection (massive perf improvement)
export async function fetchDBBatch<T = Record<string, any[]>>(
  actions: Array<{ key: string; action: string; params?: Record<string, any> }>,
  timeoutMs = 60000
): Promise<T> {
  const supabaseUrl = getSupabaseUrl();
  const dbQueryUrl = `${supabaseUrl}/functions/v1/db-query?action=batch`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(dbQueryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ actions }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Batch API Error ${response.status}:`, errorText);
      throw new Error(`API Error: ${response.status}`);
    }
    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

// Helper for POST requests to edge function
async function fetchDBPost<T>(action: string, body: Record<string, any>): Promise<T> {
  const supabaseUrl = getSupabaseUrl();
  const dbQueryUrl = `${supabaseUrl}/functions/v1/db-query?action=${action}`;
  
  const response = await fetch(dbQueryUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error: ${response.status} - ${errorText}`);
  }
  return response.json();
}

// Legacy proxy function for other endpoints (fallback)
async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const proxyUrl = `${DJANGO_BACKEND_URL}${endpoint}`;

  try {
    const response = await fetch(proxyUrl, {
      method: options?.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: options?.body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error ${response.status}:`, errorText);
      throw new Error(`API Error: ${response.status} - ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON response`);
    }
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error);
    throw error;
  }
}

// Direct fetch for downloads (bypass proxy for file downloads)
function getDirectUrl(endpoint: string): string {
  return `${DJANGO_BACKEND_URL}${endpoint}`;
}

// Types based on Django models and views
export interface Dren {
  CODE_DREN: number;
  DREN: string;
}

export interface Cisco {
  CODE_CISCO: number;
  CODE_DREN?: number;
  CISCO: string;
}

export interface Zap {
  CODE_ZAP: number;
  CODE_CISCO?: number;
  CODE_DREN?: number;
  ZAP: string;
  CISCO?: string;
}

export interface Etablissement {
  CODE_ETAB: number | string;
  NOM_ETAB: string;
  SECTEUR?: number;
  CODE_DREN: number;
  CODE_CISCO: number;
  ZAP?: string;
  COMMUNE?: string;
  FOKONTANY?: string;
  latitude: number;
  longitude: number;
  effectifs?: number;
  sdc_be?: number;
  sdc_me?: number;
  sdc_requis?: number;
  places?: number;
  eligible_reconstruction?: number;
  eligible_rehabilitation?: number;
  gp_sections?: number;
  eff_t5?: number;
  eff_2024?: number;
  ANNEE_SCOLAIRE?: number;
  CATEGORIE_COMMUNE?: string;
}

export interface GeoJSONFeatureCollection {
  type: string;
  features: Array<{
    type: string;
    properties: {
      name: string;
      code?: number | string;
      code_dren?: number;
      code_cisco?: number;
      population?: number;
      latitude?: number;
      longitude?: number;
    };
    geometry: any;
  }>;
}

export interface StatsData {
  [key: string]: number | undefined;
}

// Referentiel API - Based on src/referentiel/urls.py
export const referentielApi = {
  // GET /referentiel/dren/ - Returns list of DRENs
  getDrens: () => fetchDB<Dren[]>('getDrens'),
  // GET /referentiel/cisco/<code_dren>/ - Returns CISCOs for a DREN
  getCiscos: (codeDren: number) => fetchDB<Cisco[]>('getCiscos', { code_dren: codeDren }),
  // GET /referentiel/zap/<code_dren>/ - Returns ZAPs for a DREN (if exists)
  getZapsByDren: (codeDren: number) => fetchAPI<Zap[]>(`/referentiel/zap/${codeDren}/`),
  getZapsByCisco: (codeCisco: number) => fetchAPI<Zap[]>(`/referentiel/zap/cisco/${codeCisco}/`),
};

// ORS Primaire API - Uses direct database connection
export const orsPrimaireApi = {
  getDrens: () => fetchDB<Dren[]>('getDrens'),
  getCiscos: (codeDren: number) => fetchDB<Cisco[]>('getCiscos', { code_dren: codeDren }),
  getLayerEtabN0: (codeDren: number, codeCisco: number) =>
    fetchDB<Etablissement[]>('getLayerEtabN0', { code_dren: codeDren, code_cisco: codeCisco }),
  getLayerEtabN1: (codeDren: number, codeCisco: number) =>
    fetchDB<Etablissement[]>('getLayerEtabN1', { code_dren: codeDren, code_cisco: codeCisco }),
  getLayerEtabN2: (codeDren: number, codeCisco: number) =>
    fetchDB<Etablissement[]>('getLayerEtabN2', { code_dren: codeDren, code_cisco: codeCisco }),
  getLayerEtabN3: (codeDren: number, codeCisco: number) =>
    fetchDB<Etablissement[]>('getLayerEtabN3', { code_dren: codeDren, code_cisco: codeCisco }),
  getLayerBesoinsN1: (codeDren: number, codeCisco: number) =>
    fetchDB<Etablissement[]>('getLayerBesoinsN1', { code_dren: codeDren, code_cisco: codeCisco }),
  getVillages: (codeDren: number, codeCisco: number) =>
    fetchDB<any[]>('getVillages', { code_dren: codeDren, code_cisco: codeCisco }),
  getLayerDren: (codeDren: number) =>
    fetchDB<Array<{ shape: GeoJSONFeatureCollection }>>('getLayerDren', { code_dren: codeDren }),
  getLayerCisco: (codeDren: number, codeCisco: number) =>
    fetchDB<Array<{ shape: GeoJSONFeatureCollection }>>('getLayerCisco', { code_dren: codeDren, code_cisco: codeCisco }),
  getLayerCommune: (codeDren: number, codeCisco: number) =>
    fetchDB<Array<{ shape: GeoJSONFeatureCollection }>>('getLayerCommune', { code_dren: codeDren, code_cisco: codeCisco }),
  getLayerFokontany: (codeDren: number, codeCisco: number) =>
    fetchDB<Array<{ shape: GeoJSONFeatureCollection }>>('getLayerFokontany', { code_dren: codeDren, code_cisco: codeCisco }),
  downloadCsv: (codeDren: number, codeCisco: number) =>
    `${getSupabaseUrl()}/functions/v1/db-query?action=downloadCsv&code_dren=${codeDren}&code_cisco=${codeCisco}&type=primaire`,
  downloadNationalCsv: () => `${getSupabaseUrl()}/functions/v1/db-query?action=downloadNationalCsv&type=primaire`,
  getNouvelleCreation: () => fetchDB<any[]>('getNouvelleCreation'),
  getVillagesExclus: (codeDren: number, codeCisco: number) =>
    fetchDB<Array<{ shape: GeoJSONFeatureCollection }>>('getVillagesExclus', { code_dren: codeDren, code_cisco: codeCisco }),
};

// ORS College API - Uses direct database connection
export const orsCollegeApi = {
  getDrens: () => fetchDB<Dren[]>('getDrens'),
  getCiscos: (codeDren: number) => fetchDB<Cisco[]>('getCiscos', { code_dren: codeDren }),
  getLayerEtabN1: (codeDren: number, codeCisco: number) =>
    fetchDB<Etablissement[]>('getLayerEtabN1', { code_dren: codeDren, code_cisco: codeCisco }),
  getLayerEtabN2: (codeDren: number, codeCisco: number) =>
    fetchDB<Etablissement[]>('getLayerEtabN2', { code_dren: codeDren, code_cisco: codeCisco }),
  getLayerBesoinsN2: (codeDren: number, codeCisco: number) =>
    fetchDB<Etablissement[]>('getLayerBesoinsN2', { code_dren: codeDren, code_cisco: codeCisco }),
  getVillages: (codeDren: number, codeCisco: number) =>
    fetchDB<any[]>('getVillages', { code_dren: codeDren, code_cisco: codeCisco }),
  getLayerDren: (codeDren: number) =>
    fetchDB<Array<{ shape: GeoJSONFeatureCollection }>>('getLayerDren', { code_dren: codeDren }),
  getLayerCisco: (codeDren: number, codeCisco: number) =>
    fetchDB<Array<{ shape: GeoJSONFeatureCollection }>>('getLayerCisco', { code_dren: codeDren, code_cisco: codeCisco }),
  getLayerCommune: (codeDren: number, codeCisco: number) =>
    fetchDB<Array<{ shape: GeoJSONFeatureCollection }>>('getLayerCommune', { code_dren: codeDren, code_cisco: codeCisco }),
  downloadCsv: (codeDren: number, codeCisco: number) =>
    `${getSupabaseUrl()}/functions/v1/db-query?action=downloadCsv&code_dren=${codeDren}&code_cisco=${codeCisco}&type=college`,
};

// ORS Lycee API - Uses direct database connection
export const orsLyceeApi = {
  getDrens: () => fetchDB<Dren[]>('getDrens'),
  getCiscos: (codeDren: number) => fetchDB<Cisco[]>('getCiscos', { code_dren: codeDren }),
  getLayerEtabN2: (codeDren: number, codeCisco: number) =>
    fetchDB<Etablissement[]>('getLayerN2', { code_dren: codeDren, code_cisco: codeCisco }),
  getLayerEtabN3: (codeDren: number, codeCisco: number) =>
    fetchDB<Etablissement[]>('getLayerN3', { code_dren: codeDren, code_cisco: codeCisco }),
  getLayerBesoinsN3: (codeDren: number, codeCisco: number) =>
    fetchDB<Etablissement[]>('getLayerBesoinsN3', { code_dren: codeDren, code_cisco: codeCisco }),
  getVillages: (codeDren: number, codeCisco: number) =>
    fetchDB<any[]>('getVillages', { code_dren: codeDren, code_cisco: codeCisco }),
  getLayerDren: (codeDren: number) =>
    fetchDB<Array<{ shape: GeoJSONFeatureCollection }>>('getLayerDren', { code_dren: codeDren }),
  getLayerCisco: (codeDren: number, codeCisco: number) =>
    fetchDB<Array<{ shape: GeoJSONFeatureCollection }>>('getLayerCisco', { code_dren: codeDren, code_cisco: codeCisco }),
  getLayerCommune: (codeDren: number, codeCisco: number) =>
    fetchDB<Array<{ shape: GeoJSONFeatureCollection }>>('getLayerCommune', { code_dren: codeDren, code_cisco: codeCisco }),
  getNouvelleCreation: () => fetchDB<any[]>('getNouvelleCreationN3'),
  getVillagesExclus: (codeDren: number, codeCisco: number) =>
    fetchDB<Array<{ shape: GeoJSONFeatureCollection }>>('getVillagesExclusN3', { code_dren: codeDren, code_cisco: codeCisco }),
  downloadCsv: (codeDren: number, codeCisco: number) =>
    `${getSupabaseUrl()}/functions/v1/db-query?action=downloadCsv&code_dren=${codeDren}&code_cisco=${codeCisco}&type=lycee`,
};

// Dashboard API - Uses direct database connection
export const dashboardApi = {
  getDrens: () => fetchDB<Dren[]>('getDrens'),
  getCiscos: (codeDren: number) => fetchDB<Cisco[]>('getCiscos', { code_dren: codeDren }),
  // Stats endpoints - code_dren=0 for national, code_cisco=0 for all ciscos in dren
  getStatsEtablissements: (codeDren: number, codeCisco: number, secteur: number) =>
    fetchDB<StatsData[]>('getStatsEtablissements', { code_dren: codeDren, code_cisco: codeCisco, secteur }),
  getStatsElevesN0N1: (codeDren: number, codeCisco: number, secteur: number) =>
    fetchDB<StatsData[]>('getStatsElevesN0N1', { code_dren: codeDren, code_cisco: codeCisco, secteur }),
  getStatsElevesN2N3: (codeDren: number, codeCisco: number, secteur: number) =>
    fetchDB<StatsData[]>('getStatsElevesN2N3', { code_dren: codeDren, code_cisco: codeCisco, secteur }),
  getStatsEnseignants: (codeDren: number, codeCisco: number, secteur: number) =>
    fetchDB<StatsData[]>('getStatsEnseignants', { code_dren: codeDren, code_cisco: codeCisco, secteur }),
  getStatsPlacesAssises: (codeDren: number, codeCisco: number, secteur: number) =>
    fetchDB<StatsData[]>('getStatsPlacesAssises', { code_dren: codeDren, code_cisco: codeCisco, secteur }),
  getStatsDiplomes: (codeDren: number, codeCisco: number, secteur: number) =>
    fetchDB<any[]>('getStatsDiplomes', { code_dren: codeDren, code_cisco: codeCisco, secteur }),
  getZapCount: () => fetchDB<any[]>('getZapCount'),
  getAvailableYears: () => fetchDB<Array<{ annee: number }>>('getAvailableYears'),
};

// TDB API - Uses direct database connection to avoid SSL issues
export const tdbApi = {
  getNbrStdDren: async (codeDren: number) => {
    const data = await fetchDB<Array<{ cisco: any[]; zap: any[] }>>('getTdbNbrStdDren', { code_dren: codeDren });
    return data[0] || { cisco: [], zap: [] };
  },
  getTdb111: (codeDren: number) => fetchDB<any[]>('getTdb111', { code_dren: codeDren }),
  getCiscos: (codeDren: number) => 
    fetchDB<Cisco[]>('getCiscos', { code_dren: codeDren }),
  getZaps: (codeCisco: number) => 
    fetchDB<Zap[]>('getTdbZapsByCisco', { code_cisco: codeCisco }),
  getTdbZapData: (codeZap: number, codeCisco: number, codeDren: number, annee: number = 2025) =>
    fetchDB<any>('getTdbZapData', { code_zap: codeZap, code_cisco: codeCisco, code_dren: codeDren, annee }),
  getTdbCiscoData: (codeCisco: number, codeDren: number, annee: number = 2025) =>
    fetchDB<any>('getTdbCiscoData', { code_cisco: codeCisco, code_dren: codeDren, annee }),
  getTdbDrenData: (codeDren: number, annee: number = 2025) =>
    fetchDB<any>('getTdbDrenData', { code_dren: codeDren, annee }),
 getEcolesByZap: (codeZap: number, annee: number = 2025, niveau: 'primaire' | 'college' | 'lycee' = 'primaire') =>
   fetchDB<Array<{ CODE_ETAB: number; NOM_ETAB: string; SECTEUR: number }>>('getEcolesByZap', { code_zap: codeZap, annee, niveau }),
  getTdbEcoleData: (codeEtab: number, codeZap: number, codeCisco: number, codeDren: number, annee: number = 2025, niveau: 'primaire' | 'college' | 'lycee' = 'primaire') =>
    fetchDB<any>('getTdbEcoleData', { code_etab: codeEtab, code_zap: codeZap, code_cisco: codeCisco, code_dren: codeDren, annee, niveau }),
  // ---- Snapshot getters: read latest imported CSV row from Lovable Cloud tdb_* tables ----
  getTdbMadaSnapshot: () =>
    fetchDB<any>('getTdbMadaSnapshot', {}),
  getTdbDrenSnapshot: (codeDren: number) =>
    fetchDB<any>('getTdbDrenSnapshot', { code_dren: codeDren }),
  getTdbCiscoSnapshot: (codeCisco: number, codeDren: number) =>
    fetchDB<any>('getTdbCiscoSnapshot', { code_cisco: codeCisco, code_dren: codeDren }),
  getTdbZapSnapshot: (codeZap: number, codeCisco: number, codeDren: number) =>
    fetchDB<any>('getTdbZapSnapshot', { code_zap: codeZap, code_cisco: codeCisco, code_dren: codeDren }),
  getTdbEcoleSnapshot: (codeEtab: number, codeZap: number, codeCisco: number, codeDren: number) =>
    fetchDB<any>('getTdbEcoleSnapshot', { code_etab: codeEtab, code_zap: codeZap, code_cisco: codeCisco, code_dren: codeDren }),
  getListePdfs: async (dren: string, cisco: string, zap: string) => {
    try {
      return await fetchAPI<{ pdfs: Array<{ name: string; url: string }> }>(
        `/tdb/liste_pdfs/?dren=${encodeURIComponent(dren)}&cisco=${encodeURIComponent(cisco)}&zap=${encodeURIComponent(zap)}`
      );
    } catch (error) {
      console.error('Error fetching PDFs:', error);
      return { pdfs: [] };
    }
  },
};

// SIG API - Using direct database connection
/*export const sigApi = {
  getDrens: () => fetchDB<Dren[]>('getDrens'),
  getCiscos: (codeDren: number) => fetchDB<Cisco[]>('getCiscos', { code_dren: codeDren }),
  // Configuration
  getConfig: (key: string) => 
    fetchDB<any>('getConfig', { key }),
  setConfig: (key: string, value: any) => 
    fetchDBPost('setConfig', { key, value }),
  // -------------
  getLayerEtabN0: (codeDren: number, codeCisco: number) =>
    fetchDB<Etablissement[]>('getLayerEtabN0', { code_dren: codeDren, code_cisco: codeCisco }),
  getLayerEtabN1: (codeDren: number, codeCisco: number) =>
    fetchDB<Etablissement[]>('getLayerEtabN1', { code_dren: codeDren, code_cisco: codeCisco }),
  getLayerEtabN2: (codeDren: number, codeCisco: number) =>
    fetchDB<Etablissement[]>('getLayerEtabN2', { code_dren: codeDren, code_cisco: codeCisco }),
  getLayerEtabN3: (codeDren: number, codeCisco: number) =>
    fetchDB<Etablissement[]>('getLayerEtabN3', { code_dren: codeDren, code_cisco: codeCisco }),
  getVillages: (codeDren: number, codeCisco: number) =>
    fetchDB<any[]>('getSigVillages', { code_dren: codeDren, code_cisco: codeCisco }),
  getLayerDren: (codeDren: number) =>
    fetchDB<Array<{ shape: GeoJSONFeatureCollection }>>('getSigLayerDren', { code_dren: codeDren }),
  getLayerCisco: (codeDren: number, codeCisco: number) =>
    fetchDB<Array<{ shape: GeoJSONFeatureCollection }>>('getSigLayerCisco', { code_dren: codeDren, code_cisco: codeCisco }),
  getLayerCommune: (codeDren: number, codeCisco: number) =>
    fetchDB<Array<{ shape: GeoJSONFeatureCollection }>>('getSigLayerCommune', { code_dren: codeDren, code_cisco: codeCisco }),
  getLayerFokontany: (codeDren: number, codeCisco: number) =>
    fetchDB<Array<{ shape: GeoJSONFeatureCollection }>>('getSigLayerFokontany', { code_dren: codeDren, code_cisco: codeCisco }),
  getEtabNonGeolocalise: (codeDren: number, codeCisco: number) =>
    fetchDB<any[]>('getSigEtabNonGeolocalise', { code_dren: codeDren, code_cisco: codeCisco }),
  geolocaliserEtab: (codeEtab: number, longitude: number, latitude: number) =>
    fetchDBPost('sigGeolocaliserEtab', { code_etab: codeEtab, longitude, latitude }),
  updatePositionEtab: (codeEtab: number, longitude: number, latitude: number) =>
    fetchDBPost('sigUpdatePositionEtab', { code_etab: codeEtab, longitude, latitude }),
  geolocaliserVillage: (data: { name: string; dren: number; cisco: number; population: number; airtel: boolean; orange: boolean; telma: boolean; elec: boolean; eau: boolean; latitude: number; longitude: number }) =>
    fetchDBPost('sigGeolocaliserVillage', data),
  updatePositionVillage: (id: number, longitude: number, latitude: number) =>
    fetchDBPost('sigUpdatePositionVillage', { id, longitude, latitude }),
};*/
// ====================== SIG API - Django Direct ======================
export const sigApi = {
  getDrens: () => 
    fetchAPI<Dren[]>('/sig/dren/'),

  getCiscos: (codeDren: number) => 
    fetchAPI<Cisco[]>(`/sig/cisco/${codeDren}/`),

  // ====================== COUCHES ÉTABLISSEMENTS ======================
  getLayerEtabN0: (codeDren: number, codeCisco: number) =>
    fetchAPI<Etablissement[]>(`/sig/etab/n0/${codeDren}/${codeCisco}/`),

  getLayerEtabN1: (codeDren: number, codeCisco: number) =>
    fetchAPI<Etablissement[]>(`/sig/etab/n1/${codeDren}/${codeCisco}/`),

  getLayerEtabN2: (codeDren: number, codeCisco: number) =>
    fetchAPI<Etablissement[]>(`/sig/etab/n2/${codeDren}/${codeCisco}/`),

  getLayerEtabN3: (codeDren: number, codeCisco: number) =>
    fetchAPI<Etablissement[]>(`/sig/etab/n3/${codeDren}/${codeCisco}/`),

  // ====================== VILLAGES & NON GÉOLOCALISÉS ======================
  getVillages: (codeDren: number, codeCisco: number) =>
    fetchAPI<any[]>(`/sig/village/${codeDren}/${codeCisco}/`),

  getEtabNonGeolocalise: (codeDren: number, codeCisco: number) =>
    fetchAPI<any[]>(`/sig/etab/non-geolocalise/${codeDren}/${codeCisco}/`),

  // ====================== SHAPES (GeoJSON) ======================
  getLayerDren: (codeDren: number) =>
    fetchAPI<Array<{ shape: GeoJSONFeatureCollection }>>(`/sig/shape/dren/${codeDren}/`),

  getLayerCisco: (codeDren: number, codeCisco: number) =>
    fetchAPI<Array<{ shape: GeoJSONFeatureCollection }>>(`/sig/shape/cisco/${codeDren}/${codeCisco}/`),

  getLayerCommune: (codeDren: number, codeCisco: number) =>
    fetchAPI<Array<{ shape: GeoJSONFeatureCollection }>>(`/sig/shape/commune/${codeDren}/${codeCisco}/`),

  getLayerFokontany: (codeDren: number, codeCisco: number) =>
    fetchAPI<Array<{ shape: GeoJSONFeatureCollection }>>(`/sig/shape/fokontany/${codeDren}/${codeCisco}/`),

  // ====================== ACTIONS (Géolocalisation) ======================
  geolocaliserEtab: (codeEtab: number, longitude: number, latitude: number) =>
    fetchAPI<any>('/sig/geolocaliser/etablissement/', {
      method: 'POST',
      body: JSON.stringify({ code_etab: codeEtab, longitude, latitude }),
    }),

  updatePositionEtab: (codeEtab: number, longitude: number, latitude: number) =>
    fetchAPI<any>('/sig/update/etablissement/', {
      method: 'POST',
      body: JSON.stringify({ code_etab: codeEtab, longitude, latitude }),
    }),

  geolocaliserVillage: (data: {
    name: string;
    dren: number;
    cisco: number;
    population: number;
    airtel: boolean;
    orange: boolean;
    telma: boolean;
    elec: boolean;
    eau: boolean;
    latitude: number;
    longitude: number;
  }) =>
    fetchAPI<any>('/sig/geolocaliser/village/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updatePositionVillage: (id: number, longitude: number, latitude: number) =>
    fetchAPI<any>('/sig/update/village/', {
      method: 'POST',
      body: JSON.stringify({ id, longitude, latitude }),
    }),

  // Configuration SIG (si encore utilisée)
  getConfig: (key: string) => 
    fetchAPI<any>(`/api/config/${key}/`),        // À adapter si tu as un endpoint spécifique

  setConfig: (key: string, value: any) => 
    fetchAPI<any>('/api/config/', {
      method: 'POST',
      body: JSON.stringify({ key, value }),
    }),
};

// Auth API - Based on src/login/urls.py
export const authApi = {
  login: async (username: string, password: string) => {
    return fetchAPI<any>('/login/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },
  logout: () => fetchAPI<any>('/login/logout/', { method: 'POST' }),
};

// DataViz API - Uses Lovable Cloud edge function (db-query)
export const datavizApi = {
  getHeatmapN0: () => fetchDB<any[]>('getHeatmapN0'),
  getHeatmapN1: () => fetchDB<any[]>('getHeatmapN1'),
  getHeatmapN2: () => fetchDB<any[]>('getHeatmapN2'),
  getHeatmapN3: () => fetchDB<any[]>('getHeatmapN3'),
  getLayerDren: () => fetchDB<any[]>('getDatavizLayerDren'),
  getLayerCisco: () => fetchDB<any[]>('getDatavizLayerCisco'),
  getLayerCommune: (code: number) => fetchDB<any[]>('getDatavizLayerCommune', { code }),
  getDataDren: (niveau: number) => fetchDB<any[]>('getDatavizDataDren', { niveau }),
  getDataCisco: (niveau: number) => fetchDB<any[]>('getDatavizDataCisco', { niveau }),
  getDataCommune: (code: number, niveau: number) => fetchDB<any[]>('getDatavizDataCommune', { code, niveau }),
  getDataEtab: (code: number, niveau: number) => fetchDB<any[]>('getDatavizDataEtab', { code, niveau }),
};

// Donnees API - Uses direct database connection
export const donneesApi = {
  getDrens: () => fetchDB<Dren[]>('getDrens'),
  getCiscos: (codeDren: number) => fetchDB<Cisco[]>('getCiscos', { code_dren: codeDren }),
  getZaps: (codeDren: number, codeCisco: number, codeCommune: number = 0) =>
    fetchDB<Zap[]>('getZaps', { code_dren: codeDren, code_cisco: codeCisco, code_commune: codeCommune }),
  getCommunes: (codeDren: number, codeCisco: number, codeZap: number = 0) =>
    fetchDB<any[]>('getCommunes', { code_dren: codeDren, code_cisco: codeCisco, code_zap: codeZap }),
  // Données par niveau
  getEtabN0: (codeDren: number, codeCisco: number, codeCommune: number, codeZap: number, secteur: number) =>
    fetchDB<any[]>('getDataPrescolaire', { code_dren: codeDren, code_cisco: codeCisco, code_commune: codeCommune, code_zap: codeZap, secteur }),
  getEtabN1: (codeDren: number, codeCisco: number, codeCommune: number, codeZap: number, secteur: number) =>
    fetchDB<any[]>('getDataPrimaire', { code_dren: codeDren, code_cisco: codeCisco, code_commune: codeCommune, code_zap: codeZap, secteur }),
  getEtabN2: (codeDren: number, codeCisco: number, codeCommune: number, codeZap: number, secteur: number) =>
    fetchDB<any[]>('getDataCollege', { code_dren: codeDren, code_cisco: codeCisco, code_commune: codeCommune, code_zap: codeZap, secteur }),
  getEtabN3: (codeDren: number, codeCisco: number, codeCommune: number, codeZap: number, secteur: number) =>
    fetchDB<any[]>('getDataLycee', { code_dren: codeDren, code_cisco: codeCisco, code_commune: codeCommune, code_zap: codeZap, secteur }),
};

// Besoins API - jointure besoins_<niveau> ↔ fpe_a1
export const besoinsApi = {
  getDrens: () => fetchDB<Dren[]>('getDrens'),
  getCiscos: (codeDren: number) => fetchDB<Cisco[]>('getCiscos', { code_dren: codeDren }),
  getZaps: (codeDren: number, codeCisco: number) =>
    fetchDB<Zap[]>('getZaps', { code_dren: codeDren, code_cisco: codeCisco, code_commune: 0 }),
  getBesoinsPrimaire: (codeDren = 0, codeCisco = 0, codeZap = 0, annee = 2025) =>
    fetchDB<any[]>('getBesoinsPrimaire', { code_dren: codeDren, code_cisco: codeCisco, code_zap: codeZap, annee }),
  getBesoinsCollege: (codeDren = 0, codeCisco = 0, codeZap = 0, annee = 2025) =>
    fetchDB<any[]>('getBesoinsCollege', { code_dren: codeDren, code_cisco: codeCisco, code_zap: codeZap, annee }),
  getBesoinsLycee: (codeDren = 0, codeCisco = 0, codeZap = 0, annee = 2025) =>
    fetchDB<any[]>('getBesoinsLycee', { code_dren: codeDren, code_cisco: codeCisco, code_zap: codeZap, annee }),
};

// Diagnostic API - Based on src/diagnostic/urls.py
export const diagnosticApi = {
  getDrens: () => fetchDB<Dren[]>('getDrens'),
  getCiscos: (codeDren: number) => fetchDB<Cisco[]>('getCiscos', { code_dren: codeDren }),
  getDiagnostic: (codeDren: number, codeCisco: number) =>
    fetchAPI<any[]>(`/diagnostic/data/${codeDren}/${codeCisco}`),
};

// EAGER API - Based on src/eager/urls.py
export const eagerApi = {
  getDashboard: () => fetchAPI<any>('/eager/dashboard/'),
  getData: () => fetchAPI<any[]>('/eager/data/'),
  checkData: (params: any) => fetchAPI<any>('/eager/datachecking/', {
    method: 'POST',
    body: JSON.stringify(params),
  }),
  generateUniqueId: (params: any) => fetchAPI<any>('/eager/generate_unique_id/', {
    method: 'POST',
    body: JSON.stringify(params),
  }),
};

// Users API - Based on src/utilisateurs/urls.py
export const usersApi = {
  getUsers: () => fetchAPI<any[]>('/utilisateurs/'),
  createUser: async (data: {
    username: string;
    password: string;
    first_name: string;
    last_name: string;
  }) => fetchAPI<any>('/utilisateurs/', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateProfile: async (data: {
    username?: string;
    password: string;
    first_name?: string;
    last_name?: string;
    new_password?: string;
    confirm_password?: string;
  }) => fetchAPI<any>('/utilisateurs/profil/', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

// Export all APIs
export default {
  referentiel: referentielApi,
  orsPrimaire: orsPrimaireApi,
  orsCollege: orsCollegeApi,
  orsLycee: orsLyceeApi,
  dashboard: dashboardApi,
  tdb: tdbApi,
  sig: sigApi,
  dataviz: datavizApi,
  donnees: donneesApi,
  diagnostic: diagnosticApi,
  eager: eagerApi,
  auth: authApi,
  users: usersApi,
};
