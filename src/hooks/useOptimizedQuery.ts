import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { useMemo } from 'react';

/**
 * Optimized query hook with built-in caching strategies
 * Provides placeholderData from cache for instant loading
 */
export function useOptimizedQuery<TData, TError = Error>(
  queryKey: unknown[],
  queryFn: () => Promise<TData>,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) {
  const query = useQuery({
    queryKey,
    queryFn,
    // Default optimizations for Madagascar latency
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...options,
  });

  // Memoize data to prevent unnecessary re-renders
  const memoizedData = useMemo(() => query.data, [query.data]);

  return {
    ...query,
    data: memoizedData,
  };
}

/**
 * Hook for reference data (DRENs, CISCOs, etc.)
 * Longer cache time since this data rarely changes
 */
export function useReferenceData<TData>(
  queryKey: unknown[],
  queryFn: () => Promise<TData>,
  options?: Omit<UseQueryOptions<TData, Error>, 'queryKey' | 'queryFn'>
) {
  return useOptimizedQuery(queryKey, queryFn, {
    staleTime: 1000 * 60 * 30, // 30 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
    refetchOnMount: false,
    ...options,
  });
}

/**
 * Hook for frequently changing data
 * Shorter cache but still optimized for 4G
 */
export function useLiveData<TData>(
  queryKey: unknown[],
  queryFn: () => Promise<TData>,
  options?: Omit<UseQueryOptions<TData, Error>, 'queryKey' | 'queryFn'>
) {
  return useOptimizedQuery(queryKey, queryFn, {
    staleTime: 1000 * 60 * 1, // 1 minute
    gcTime: 1000 * 60 * 10, // 10 minutes
    refetchInterval: 1000 * 60 * 5, // Refetch every 5 minutes
    ...options,
  });
}

export default useOptimizedQuery;
