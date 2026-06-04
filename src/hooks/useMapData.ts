import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { 
  orsPrimaireApi, 
  orsCollegeApi, 
  orsLyceeApi, 
  dashboardApi,
  fetchDBBatch,
  Dren,
  Cisco,
  Etablissement 
} from '@/services/api';
import { toast } from 'sonner';

export type { Dren as DREN, Cisco as CISCO, Etablissement };

export interface GeoJSONFeature {
  type: string;
  features: Array<{
    type: string;
    properties: {
      name: string;
      code?: string | number;
      code_dren?: number;
      code_cisco?: number;
      population?: number;
      latitude?: number;
      longitude?: number;
    };
    geometry: any;
  }>;
}

export interface Village {
  name: string;
  code_dren: number;
  code_cisco: number;
  population: number;
  longitude: number;
  latitude: number;
}

export type OrsType = 'primaire' | 'college' | 'lycee';

// Cache pour les données fréquemment accédées
const dataCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

function getCachedData<T>(key: string): T | null {
  const cached = dataCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data as T;
  }
  return null;
}

function setCachedData<T>(key: string, data: T): void {
  dataCache.set(key, { data, timestamp: Date.now() });
}

export const useMapData = (type: OrsType = 'primaire') => {
  const [drens, setDrens] = useState<Dren[]>([]);
  const [ciscos, setCiscos] = useState<Cisco[]>([]);
  const [colleges, setColleges] = useState<Etablissement[]>([]);
  const [primaires, setPrimaires] = useState<Etablissement[]>([]);
  const [lycees, setLycees] = useState<Etablissement[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [geoLayers, setGeoLayers] = useState<{
    dren?: GeoJSONFeature;
    cisco?: GeoJSONFeature;
    commune?: GeoJSONFeature;
    fokontany?: GeoJSONFeature;
  }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDren, setSelectedDren] = useState<number>(0);
  const [selectedCisco, setSelectedCisco] = useState<number>(0);
  const [isFiltered, setIsFiltered] = useState(false);
  
  // Ref pour éviter les requêtes en double
  const abortControllerRef = useRef<AbortController | null>(null);

  // Get the appropriate API based on type
  const getApi = useCallback(() => {
    switch (type) {
      case 'college':
        return orsCollegeApi;
      case 'lycee':
        return orsLyceeApi;
      default:
        return orsPrimaireApi;
    }
  }, [type]);

  // Charger les DRENs au démarrage (sans données des établissements)
  useEffect(() => {
    const loadDrens = async () => {
      try {
        const cacheKey = 'drens';
        let drensData = getCachedData<Dren[]>(cacheKey);
        
        if (!drensData) {
          drensData = await dashboardApi.getDrens();
          setCachedData(cacheKey, drensData);
        }
        setDrens(drensData);
      } catch (err) {
        console.error('Error loading DRENs:', err);
        setError('Erreur lors du chargement des DRENs');
      }
    };

    loadDrens();
  }, []);

  // Fonction helper pour charger les données d'une DREN
  const fetchDataForDren = async (codeDren: number, codeCisco: number): Promise<{ colleges: Etablissement[]; primaires: Etablissement[]; lycees: Etablissement[] }> => {
    let newColleges: Etablissement[] = [];
    let newPrimaires: Etablissement[] = [];
    let newLycees: Etablissement[] = [];

    try {
      switch (type) {
        case 'primaire': {
          const besoins = await orsPrimaireApi.getLayerBesoinsN1(codeDren, codeCisco);
          newPrimaires = besoins;
          break;
        }
        case 'college': {
          const [besoins, etabN1] = await Promise.all([
            orsCollegeApi.getLayerBesoinsN2(codeDren, codeCisco),
            orsCollegeApi.getLayerEtabN1(codeDren, codeCisco)
          ]);
          newColleges = besoins;
          newPrimaires = etabN1;
          break;
        }
        case 'lycee': {
          const [besoins, etabN2] = await Promise.all([
            orsLyceeApi.getLayerBesoinsN3(codeDren, codeCisco),
            orsLyceeApi.getLayerEtabN2(codeDren, codeCisco)
          ]);
          newLycees = besoins;
          newColleges = etabN2;
          break;
        }
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    }

    return { colleges: newColleges, primaires: newPrimaires, lycees: newLycees };
  };

  const fetchCiscos = useCallback(async (codeDren: number) => {
    if (codeDren === 0) {
      setCiscos([]);
      return;
    }
    
    const cacheKey = `ciscos_${codeDren}`;
    const cached = getCachedData<Cisco[]>(cacheKey);
    
    if (cached) {
      setCiscos(cached);
      return;
    }

    try {
      const data = await dashboardApi.getCiscos(codeDren);
      setCiscos(data);
      setCachedData(cacheKey, data);
    } catch (err) {
      console.error('Error fetching CISCOs:', err);
      setError('Erreur lors du chargement des CISCOs');
      toast.error('Erreur lors du chargement des CISCOs');
    }
  }, []);

  const fetchEtablissements = useCallback(async (codeDren: number, codeCisco: number) => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const cacheKey = `etab_${type}_${codeDren}_${codeCisco}`;
    const cached = getCachedData<{ colleges: Etablissement[]; primaires: Etablissement[]; lycees: Etablissement[]; villages: Village[]; geoLayers: any }>(cacheKey);
    
    if (cached) {
      setColleges(cached.colleges);
      setPrimaires(cached.primaires);
      setLycees(cached.lycees);
      setVillages(cached.villages || []);
      setGeoLayers(cached.geoLayers || {});
      setIsFiltered(true);
      const total = cached.colleges.length + cached.primaires.length + cached.lycees.length;
      toast.success(`${total} établissements chargés depuis le cache`);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Build batch actions - all queries in ONE connection
      const batchActions: Array<{ key: string; action: string; params?: Record<string, any> }> = [
        { key: 'dren', action: 'getLayerDren', params: { code_dren: codeDren } },
        { key: 'cisco', action: 'getLayerCisco', params: { code_dren: codeDren, code_cisco: codeCisco } },
        { key: 'commune', action: 'getLayerCommune', params: { code_dren: codeDren, code_cisco: codeCisco } },
        { key: 'villages', action: 'getVillages', params: { code_dren: codeDren, code_cisco: codeCisco } },
      ];

      // Add establishment queries based on type
      switch (type) {
        case 'primaire':
          batchActions.push({ key: 'besoins', action: 'getLayerBesoinsN1', params: { code_dren: codeDren, code_cisco: codeCisco } });
          break;
        case 'college':
          batchActions.push(
            { key: 'besoins', action: 'getLayerBesoinsN2', params: { code_dren: codeDren, code_cisco: codeCisco } },
            { key: 'etabN1', action: 'getLayerEtabN1', params: { code_dren: codeDren, code_cisco: codeCisco } }
          );
          break;
        case 'lycee':
          batchActions.push(
            { key: 'besoins', action: 'getLayerBesoinsN3', params: { code_dren: codeDren, code_cisco: codeCisco } },
            { key: 'etabN2', action: 'getLayerN2', params: { code_dren: codeDren, code_cisco: codeCisco } }
          );
          break;
      }

      const batchResult = await fetchDBBatch<Record<string, any>>(batchActions);

      // Parse results
      const layers: any = {};
      if (batchResult.dren?.[0]?.shape) layers.dren = batchResult.dren[0].shape;
      if (batchResult.cisco?.[0]?.shape) layers.cisco = batchResult.cisco[0].shape;
      if (batchResult.commune?.[0]?.shape) layers.commune = batchResult.commune[0].shape;

      const villagesData = (batchResult.villages || []) as Village[];

      let newColleges: Etablissement[] = [];
      let newPrimaires: Etablissement[] = [];
      let newLycees: Etablissement[] = [];

      switch (type) {
        case 'primaire':
          newPrimaires = batchResult.besoins || [];
          break;
        case 'college':
          newColleges = batchResult.besoins || [];
          newPrimaires = batchResult.etabN1 || [];
          break;
        case 'lycee':
          newLycees = batchResult.besoins || [];
          newColleges = batchResult.etabN2 || [];
          break;
      }

      setColleges(newColleges);
      setPrimaires(newPrimaires);
      setLycees(newLycees);
      setVillages(villagesData);
      setGeoLayers(layers);
      setIsFiltered(true);
      
      // Cache the results
      const cacheData = { colleges: newColleges, primaires: newPrimaires, lycees: newLycees, villages: villagesData, geoLayers: layers };
      setCachedData(cacheKey, cacheData);
      
      const total = newColleges.length + newPrimaires.length + newLycees.length;
      if (total > 0) {
        toast.success(`${total} établissements chargés`);
      } else {
        toast.info('Aucun établissement trouvé pour cette sélection');
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return;
      }
      console.error('Error fetching etablissements:', err);
      setError('Erreur lors du chargement des établissements');
      toast.error('Erreur lors du chargement des établissements');
    } finally {
      setLoading(false);
    }
  }, [type]);

  // Réinitialiser les filtres
  const resetFilter = useCallback(() => {
    setIsFiltered(false);
    setSelectedDren(0);
    setSelectedCisco(0);
    setCiscos([]);
    setColleges([]);
    setPrimaires([]);
    setLycees([]);
    setVillages([]);
    setGeoLayers({});
    toast.info('Filtres réinitialisés');
  }, []);

  const handleDrenChange = useCallback((codeDren: number) => {
    setSelectedDren(codeDren);
    setSelectedCisco(0);
    if (codeDren > 0) {
      fetchCiscos(codeDren);
    } else {
      setCiscos([]);
    }
  }, [fetchCiscos]);

  const handleCiscoChange = useCallback((codeCisco: number) => {
    setSelectedCisco(codeCisco);
  }, []);

  const getDownloadUrl = useCallback(() => {
    switch (type) {
      case 'primaire':
        return orsPrimaireApi.downloadCsv(selectedDren, selectedCisco);
      case 'college':
        return orsCollegeApi.downloadCsv(selectedDren, selectedCisco);
      case 'lycee':
        return orsLyceeApi.downloadCsv(selectedDren, selectedCisco);
    }
  }, [type, selectedDren, selectedCisco]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    drens,
    ciscos,
    colleges,
    primaires,
    lycees,
    villages,
    geoLayers,
    loading,
    error,
    selectedDren,
    selectedCisco,
    isFiltered,
    handleDrenChange,
    handleCiscoChange,
    fetchEtablissements,
    resetFilter,
    getDownloadUrl,
  };
};

// Hook for Dashboard data with optimized fetching
export const useDashboardData = () => {
  const [drens, setDrens] = useState<Dren[]>([]);
  const [ciscos, setCiscos] = useState<Cisco[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDren, setSelectedDren] = useState<number>(0);
  const [selectedCisco, setSelectedCisco] = useState<number>(0);
  const [selectedSecteur, setSelectedSecteur] = useState<number>(2); // 2 = tous

  const [statsEtablissements, setStatsEtablissements] = useState<any>(null);
  const [statsElevesN0N1, setStatsElevesN0N1] = useState<any>(null);
  const [statsElevesN2N3, setStatsElevesN2N3] = useState<any>(null);
  const [statsEnseignants, setStatsEnseignants] = useState<any>(null);
  const [statsPlaces, setStatsPlaces] = useState<any>(null);

  // Fetch DRENs on mount with caching
  useEffect(() => {
    const fetchDrens = async () => {
      const cacheKey = 'drens';
      const cached = getCachedData<Dren[]>(cacheKey);
      
      if (cached) {
        setDrens(cached);
        return;
      }

      try {
        setLoading(true);
        const data = await dashboardApi.getDrens();
        setDrens(data);
        setCachedData(cacheKey, data);
      } catch (err) {
        console.error('Error fetching DRENs:', err);
        setError('Erreur lors du chargement des DRENs');
      } finally {
        setLoading(false);
      }
    };
    fetchDrens();
  }, []);

  const fetchCiscos = useCallback(async (codeDren: number) => {
    if (codeDren === 0) {
      setCiscos([]);
      return;
    }
    
    const cacheKey = `ciscos_${codeDren}`;
    const cached = getCachedData<Cisco[]>(cacheKey);
    
    if (cached) {
      setCiscos(cached);
      return;
    }

    try {
      setLoading(true);
      const data = await dashboardApi.getCiscos(codeDren);
      setCiscos(data);
      setCachedData(cacheKey, data);
    } catch (err) {
      console.error('Error fetching CISCOs:', err);
      setError('Erreur lors du chargement des CISCOs');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    const cacheKey = `stats_${selectedDren}_${selectedCisco}_${selectedSecteur}`;
    const cached = getCachedData<any>(cacheKey);
    
    if (cached) {
      setStatsEtablissements(cached.etab);
      setStatsElevesN0N1(cached.elevesN0N1);
      setStatsElevesN2N3(cached.elevesN2N3);
      setStatsEnseignants(cached.enseignants);
      setStatsPlaces(cached.places);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [etab, elevesN0N1, elevesN2N3, enseignants, places] = await Promise.all([
        dashboardApi.getStatsEtablissements(selectedDren, selectedCisco, selectedSecteur),
        dashboardApi.getStatsElevesN0N1(selectedDren, selectedCisco, selectedSecteur).catch(() => [] as any[]),
        dashboardApi.getStatsElevesN2N3(selectedDren, selectedCisco, selectedSecteur).catch(() => [] as any[]),
        dashboardApi.getStatsEnseignants(selectedDren, selectedCisco, selectedSecteur).catch(() => [] as any[]),
        dashboardApi.getStatsPlacesAssises(selectedDren, selectedCisco, selectedSecteur).catch(() => [] as any[]),
      ]);

      const stats = {
        etab: etab[0] || null,
        elevesN0N1: elevesN0N1[0] || null,
        elevesN2N3: elevesN2N3[0] || null,
        enseignants: enseignants[0] || null,
        places: places[0] || null,
      };

      setStatsEtablissements(stats.etab);
      setStatsElevesN0N1(stats.elevesN0N1);
      setStatsElevesN2N3(stats.elevesN2N3);
      setStatsEnseignants(stats.enseignants);
      setStatsPlaces(stats.places);
      
      setCachedData(cacheKey, stats);
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError('Erreur lors du chargement des statistiques');
    } finally {
      setLoading(false);
    }
  }, [selectedDren, selectedCisco, selectedSecteur]);

  const handleDrenChange = useCallback((codeDren: number) => {
    setSelectedDren(codeDren);
    setSelectedCisco(0);
    if (codeDren > 0) {
      fetchCiscos(codeDren);
    } else {
      setCiscos([]);
    }
  }, [fetchCiscos]);

  const handleCiscoChange = useCallback((codeCisco: number) => {
    setSelectedCisco(codeCisco);
  }, []);

  const handleSecteurChange = useCallback((secteur: number) => {
    setSelectedSecteur(secteur);
  }, []);

  return {
    drens,
    ciscos,
    loading,
    error,
    selectedDren,
    selectedCisco,
    selectedSecteur,
    statsEtablissements,
    statsElevesN0N1,
    statsElevesN2N3,
    statsEnseignants,
    statsPlaces,
    handleDrenChange,
    handleCiscoChange,
    handleSecteurChange,
    fetchStats,
  };
};
