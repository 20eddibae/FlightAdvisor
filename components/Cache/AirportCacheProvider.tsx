/**
 * Airport Cache Provider - React Context for cache access
 * Provides cache instance and operations to all child components
 */

'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, ReactNode } from 'react';
import { AirportCacheManager } from '@/lib/cache/airportCache';
import type { CachedAirport, CacheStatus, SearchOptions } from '@/lib/cache/types';

interface AirportCacheContextValue {
  cache: AirportCacheManager | null;
  status: CacheStatus;
  getAirportsInViewport: (bounds: [number, number, number, number]) => CachedAirport[];
  searchAirports: (query: string, options?: SearchOptions) => CachedAirport[];
  getAirportById: (id: string) => CachedAirport | null;
  refreshStatus: () => void;
  isInitialized: boolean;
}

const initialStatus: CacheStatus = {
  initialized: false,
  totalAirports: 0,
  cachedRegions: [],
  loadingRegions: [],
  lastUpdated: 0,
};

const AirportCacheContext = createContext<AirportCacheContextValue | undefined>(undefined);

interface AirportCacheProviderProps {
  children: ReactNode;
}

export function AirportCacheProvider({ children }: AirportCacheProviderProps) {
  const [cache, setCache] = useState<AirportCacheManager | null>(null);
  const [status, setStatus] = useState<CacheStatus>(initialStatus);

  useEffect(() => {
    let isMounted = true;

    const initCache = async () => {
      try {
        console.log('Initializing airport cache provider...');

        const cacheInstance = AirportCacheManager.getInstance();
        await cacheInstance.initialize();

        // Only update state if component is still mounted
        // React 18+ automatically batches state updates
        if (isMounted) {
          const currentStatus = cacheInstance.getCacheStatus();
          setCache(cacheInstance);
          setStatus(currentStatus);
          console.log('✓ Cache provider ready');
        }
      } catch (error) {
        console.error('Failed to initialize cache:', error);
        // Set as initialized anyway to allow app to function
        if (isMounted) {
          setStatus((prev) => ({ ...prev, initialized: true }));
        }
      }
    };

    initCache();

    return () => {
      isMounted = false;
    };
  }, []);

  // Manual status refresh - only call when needed (e.g., after loading a region)
  const refreshStatus = useCallback(() => {
    if (cache) {
      const newStatus = cache.getCacheStatus();
      setStatus(newStatus);
    }
  }, [cache]);

  // Memoize bound functions to prevent re-creating them
  const boundFunctions = useMemo(() => {
    if (!cache) {
      return {
        getAirportsInViewport: () => [],
        searchAirports: () => [],
        getAirportById: () => null,
      };
    }
    return {
      getAirportsInViewport: cache.getAirportsInViewport.bind(cache),
      searchAirports: cache.searchAirports.bind(cache),
      getAirportById: cache.getAirportById.bind(cache),
    };
  }, [cache]);

  const value = useMemo<AirportCacheContextValue>(() => {
    return {
      cache,
      status,
      getAirportsInViewport: boundFunctions.getAirportsInViewport,
      searchAirports: boundFunctions.searchAirports,
      getAirportById: boundFunctions.getAirportById,
      refreshStatus,
      isInitialized: status.initialized,
    };
  }, [cache, status, boundFunctions, refreshStatus]);

  return (
    <AirportCacheContext.Provider value={value}>
      {children}
    </AirportCacheContext.Provider>
  );
}

/**
 * Hook to access airport cache
 * Throws error if used outside provider
 */
export function useAirportCache(): AirportCacheContextValue {
  const context = useContext(AirportCacheContext);

  if (!context) {
    throw new Error('useAirportCache must be used within AirportCacheProvider');
  }

  return context;
}
