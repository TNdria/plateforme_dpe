import { useCallback } from 'react';
import { queryClient } from '@/lib/queryClient';
import { referentielApi, donneesApi, dashboardApi } from '@/services/api';

/**
 * Hook for prefetching data on hover
 * Improves perceived performance by loading data before user clicks
 */
export const usePrefetch = () => {
  /**
   * Prefetch CISCOs when user hovers over a DREN option
   */
  const prefetchCiscos = useCallback((codeDren: number) => {
    if (!codeDren) return;
    
    const queryKey = ['ciscos', codeDren];
    const existing = queryClient.getQueryData(queryKey);
    
    if (!existing) {
      queryClient.prefetchQuery({
        queryKey,
        queryFn: () => referentielApi.getCiscos(codeDren),
        staleTime: 1000 * 60 * 5, // 5 minutes
      });
    }
  }, []);

  /**
   * Prefetch ZAPs when user hovers over CISCO option
   */
  const prefetchZaps = useCallback((codeDren: number, codeCisco: number, codeCommune: number = 0) => {
    if (!codeDren || !codeCisco) return;
    
    const queryKey = ['zaps', codeDren, codeCisco, codeCommune];
    const existing = queryClient.getQueryData(queryKey);
    
    if (!existing) {
      queryClient.prefetchQuery({
        queryKey,
        queryFn: () => donneesApi.getZaps(codeDren, codeCisco, codeCommune),
        staleTime: 1000 * 60 * 5,
      });
    }
  }, []);

  /**
   * Prefetch dashboard stats when user hovers over filter
   */
  const prefetchDashboardStats = useCallback((codeDren: number, codeCisco: number = 0, secteur: number = 2) => {
    const baseKey = ['dashboard-stats', codeDren, codeCisco, secteur];
    
    // Prefetch all stat types
    const statTypes = [
      { key: 'etablissements', fn: dashboardApi.getStatsEtablissements },
      { key: 'eleves-n0n1', fn: dashboardApi.getStatsElevesN0N1 },
      { key: 'eleves-n2n3', fn: dashboardApi.getStatsElevesN2N3 },
      { key: 'enseignants', fn: dashboardApi.getStatsEnseignants },
    ];

    statTypes.forEach(({ key, fn }) => {
      const queryKey = [...baseKey, key];
      if (!queryClient.getQueryData(queryKey)) {
        queryClient.prefetchQuery({
          queryKey,
          queryFn: () => fn(codeDren, codeCisco, secteur),
          staleTime: 1000 * 60 * 5,
        });
      }
    });
  }, []);

  /**
   * Prefetch page data when user hovers over navigation link
   */
  const prefetchPageData = useCallback((page: string) => {
    switch (page) {
      case 'dashboard':
        // Prefetch national stats
        prefetchDashboardStats(0, 0, 2);
        break;
      case 'donnees':
        // Prefetch DRENs list
        if (!queryClient.getQueryData(['drens'])) {
          queryClient.prefetchQuery({
            queryKey: ['drens'],
            queryFn: referentielApi.getDrens,
            staleTime: 1000 * 60 * 30, // 30 minutes for reference data
          });
        }
        break;
    }
  }, [prefetchDashboardStats]);

  return {
    prefetchCiscos,
    prefetchZaps,
    prefetchDashboardStats,
    prefetchPageData,
  };
};

export default usePrefetch;
