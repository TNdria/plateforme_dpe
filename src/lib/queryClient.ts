import { QueryClient } from "@tanstack/react-query";

/**
 * Optimized QueryClient for Madagascar context (high latency, 4G)
 * 
 * Configuration rationale:
 * - staleTime: 5 minutes - Data considered fresh, no refetch
 * - gcTime: 30 minutes - Cache kept in memory for instant navigation
 * - retry: 3 with exponential backoff for unstable connections
 * - refetchOnWindowFocus: false - Saves bandwidth on 4G
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data stays fresh for 5 minutes - reduces network calls
      staleTime: 1000 * 60 * 5,
      
      // Cache kept for 30 minutes even after unmount
      gcTime: 1000 * 60 * 30,
      
      // Retry with exponential backoff for unstable 4G
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Don't refetch on window focus to save bandwidth
      refetchOnWindowFocus: false,
      
      // Don't refetch on reconnect automatically
      refetchOnReconnect: 'always',
      
      // Network mode for offline support
      networkMode: 'offlineFirst',
    },
    mutations: {
      // Retry mutations once
      retry: 1,
      retryDelay: 1000,
      networkMode: 'offlineFirst',
    },
  },
});

/**
 * Prefetch helper for hover-based prefetching
 * Use on filter hover to preload next data
 */
export const prefetchOnHover = async (
  queryKey: unknown[],
  queryFn: () => Promise<unknown>
) => {
  // Only prefetch if not already in cache
  const existing = queryClient.getQueryData(queryKey);
  if (!existing) {
    await queryClient.prefetchQuery({
      queryKey,
      queryFn,
      staleTime: 1000 * 60 * 5,
    });
  }
};

/**
 * Invalidate related queries after mutations
 */
export const invalidateQueries = (patterns: string[]) => {
  patterns.forEach(pattern => {
    queryClient.invalidateQueries({ queryKey: [pattern] });
  });
};
