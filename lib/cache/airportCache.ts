/**
 * Airport Cache Manager
 * Orchestrates regional loading, spatial indexing, search, and persistence
 */

import { AirportSpatialIndex } from './spatialIndex';
import { CacheDB } from './indexedDB';
import type {
  CachedAirport,
  RegionCache,
  CacheMetadata,
  CacheStatus,
  SearchOptions,
  RegionDefinition,
} from './types';
import { US_REGIONS } from './types';
import { CACHE_CONFIG } from '../constants';

export class AirportCacheManager {
  private static instance: AirportCacheManager | null = null;

  private spatialIndex: AirportSpatialIndex;
  private metadata: CacheMetadata;
  private db: CacheDB;
  private loadingRegions: Set<string> = new Set();
  private initialized: boolean = false;

  private constructor() {
    this.spatialIndex = new AirportSpatialIndex(CACHE_CONFIG.SPATIAL_GRID_CELL_SIZE);
    this.db = new CacheDB();
    this.metadata = this.createDefaultMetadata();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AirportCacheManager {
    if (!AirportCacheManager.instance) {
      AirportCacheManager.instance = new AirportCacheManager();
    }
    return AirportCacheManager.instance;
  }

  /**
   * Create default metadata structure
   */
  private createDefaultMetadata(): CacheMetadata {
    const regions: CacheMetadata['regions'] = {};

    for (const region of US_REGIONS) {
      regions[region.name] = {
        status: 'empty',
        airportCount: 0,
        cachedAt: 0,
        bounds: region.bounds,
      };
    }

    return {
      version: CACHE_CONFIG.DB_VERSION,
      lastUpdated: Date.now(),
      regions,
    };
  }

  /**
   * Initialize cache from IndexedDB
   * Target: <3 seconds for full restore
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('Initializing airport cache...');
    const startTime = performance.now();

    try {
      // 1. Open IndexedDB
      if (CacheDB.isAvailable()) {
        await this.db.open();

        // 2. Load metadata
        const savedMetadata = await this.db.getMetadata();
        if (savedMetadata) {
          // Check version compatibility
          if (savedMetadata.version === CACHE_CONFIG.DB_VERSION) {
            this.metadata = savedMetadata;
          } else {
            console.warn('Cache version mismatch, clearing old data');
            await this.db.clearAll();
            this.metadata = this.createDefaultMetadata();
          }
        }

        // 3. Restore cached regions from IndexedDB to spatial index
        const regions = await this.db.getAllRegions();
        let totalAirports = 0;

        for (const region of regions) {
          // Check if cache is still valid (within TTL)
          const age = Date.now() - region.cachedAt;
          if (age > CACHE_CONFIG.AIRPORT_TTL_MS) {
            console.log(`Region ${region.regionName} cache expired, will reload`);
            if (this.metadata.regions[region.regionName]) {
              this.metadata.regions[region.regionName].status = 'empty';
            }
            continue;
          }

          // Insert airports into spatial index
          this.spatialIndex.insertBatch(region.airports);
          totalAirports += region.airports.length;

          // Update metadata
          if (this.metadata.regions[region.regionName]) {
            this.metadata.regions[region.regionName].status = 'cached';
            this.metadata.regions[region.regionName].airportCount = region.airports.length;
            this.metadata.regions[region.regionName].cachedAt = region.cachedAt;
          }
        }

        const duration = performance.now() - startTime;
        console.log(
          `✓ Cache initialized: ${totalAirports} airports from ${regions.length} regions in ${duration.toFixed(0)}ms`
        );
      } else {
        console.warn('IndexedDB not available, cache will not persist');
      }

      this.initialized = true;
      this.metadata.lastUpdated = Date.now();

      // Preload West Coast region for demo airports (KSQL, KSMF)
      // Do this in the background, don't wait for it
      this.loadRegion('West Coast').catch(err => {
        console.warn('Failed to preload West Coast region:', err);
      });
    } catch (error) {
      console.error('Failed to initialize cache:', error);
      // Continue without cache - degrade gracefully
      this.initialized = true;
    }
  }

  /**
   * Load a specific region's airports
   */
  async loadRegion(regionName: string, forceRefresh: boolean = false): Promise<void> {
    const regionMeta = this.metadata.regions[regionName];

    if (!regionMeta) {
      console.warn(`Unknown region: ${regionName}`);
      return;
    }

    // Skip if already cached and not forcing refresh
    if (regionMeta.status === 'cached' && !forceRefresh) {
      return;
    }

    // Skip if already loading
    if (this.loadingRegions.has(regionName)) {
      return;
    }

    this.loadingRegions.add(regionName);
    regionMeta.status = 'loading';

    try {
      console.log(`Loading airports for region: ${regionName}`);
      const startTime = performance.now();

      // Fetch from bulk API endpoint
      const response = await fetch(`/api/openaip/bulk?region=${encodeURIComponent(regionName)}`);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success || !data.data) {
        throw new Error('Invalid API response format');
      }

      const airports: CachedAirport[] = data.data;

      // Insert into spatial index (batch for speed)
      this.spatialIndex.insertBatch(airports);

      // Save to IndexedDB
      const regionCache: RegionCache = {
        regionName,
        bounds: regionMeta.bounds,
        airports,
        cachedAt: Date.now(),
        version: CACHE_CONFIG.DB_VERSION,
      };

      if (CacheDB.isAvailable()) {
        await this.db.putRegion(regionCache);
      }

      // Update metadata
      regionMeta.status = 'cached';
      regionMeta.airportCount = airports.length;
      regionMeta.cachedAt = regionCache.cachedAt;
      this.metadata.lastUpdated = Date.now();

      if (CacheDB.isAvailable()) {
        await this.db.putMetadata(this.metadata);
      }

      const duration = performance.now() - startTime;
      console.log(`✓ Loaded ${airports.length} airports for ${regionName} in ${duration.toFixed(0)}ms`);
    } catch (error) {
      console.error(`Failed to load region ${regionName}:`, error);
      regionMeta.status = 'error';
    } finally {
      this.loadingRegions.delete(regionName);
    }
  }

  /**
   * Load all regions that intersect the viewport bounds
   * Automatically triggered on map pan/zoom
   */
  async loadRegionsForViewport(bounds: [number, number, number, number]): Promise<void> {
    const [west, south, east, north] = bounds;

    // Find regions that intersect viewport
    const regionsToLoad: string[] = [];

    for (const region of US_REGIONS) {
      const [rWest, rSouth, rEast, rNorth] = region.bounds;

      // Check for bounding box intersection
      const intersects = !(
        west > rEast ||
        east < rWest ||
        south > rNorth ||
        north < rSouth
      );

      if (intersects) {
        const regionMeta = this.metadata.regions[region.name];
        if (regionMeta && regionMeta.status === 'empty') {
          regionsToLoad.push(region.name);
        }
      }
    }

    // Load regions in parallel
    if (regionsToLoad.length > 0) {
      console.log(`Loading ${regionsToLoad.length} regions for viewport...`);
      await Promise.all(regionsToLoad.map((name) => this.loadRegion(name)));
    }
  }

  /**
   * Get airports within viewport bounds
   * Target: <10ms for 20k airports
   */
  getAirportsInViewport(bounds: [number, number, number, number]): CachedAirport[] {
    if (!this.initialized) {
      console.warn('Cache not initialized yet');
      return [];
    }

    return this.spatialIndex.queryBounds(bounds);
  }

  /**
   * Search airports by ICAO code or name
   * Target: <50ms for 20k airports
   */
  searchAirports(query: string, options?: SearchOptions): CachedAirport[] {
    if (!this.initialized) {
      console.warn('Cache not initialized yet');
      return [];
    }

    const maxResults = options?.maxResults || CACHE_CONFIG.MAX_SEARCH_RESULTS;
    let results = this.spatialIndex.search(query, maxResults);

    // Filter by type if specified
    if (options?.types && options.types.length > 0) {
      results = results.filter((airport) => options.types!.includes(airport.type));
    }

    // Filter by region if specified
    if (options?.region) {
      results = results.filter((airport) => airport._metadata.region === options.region);
    }

    return results;
  }

  /**
   * Get airport by ICAO code
   * O(1) lookup
   */
  getAirportById(id: string): CachedAirport | null {
    if (!this.initialized) {
      return null;
    }

    return this.spatialIndex.getById(id);
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    console.log('Clearing airport cache...');

    this.spatialIndex.clear();
    this.metadata = this.createDefaultMetadata();
    this.loadingRegions.clear();

    if (CacheDB.isAvailable()) {
      await this.db.clearAll();
    }

    console.log('✓ Cache cleared');
  }

  /**
   * Get current cache status
   */
  getCacheStatus(): CacheStatus {
    const cachedRegions: string[] = [];
    const loadingRegions: string[] = Array.from(this.loadingRegions);

    for (const [name, meta] of Object.entries(this.metadata.regions)) {
      if (meta.status === 'cached') {
        cachedRegions.push(name);
      }
    }

    return {
      initialized: this.initialized,
      totalAirports: this.spatialIndex.size(),
      cachedRegions,
      loadingRegions,
      lastUpdated: this.metadata.lastUpdated,
    };
  }

  /**
   * Get detailed statistics for debugging
   */
  getStats() {
    return {
      ...this.getCacheStatus(),
      spatialIndexStats: this.spatialIndex.getStats(),
      metadata: this.metadata,
    };
  }

  /**
   * Check if a region is cached
   */
  isRegionCached(regionName: string): boolean {
    const meta = this.metadata.regions[regionName];
    return meta?.status === 'cached';
  }

  /**
   * Get all cached airports (for debugging/export)
   */
  getAllAirports(): CachedAirport[] {
    return this.spatialIndex.getAll();
  }
}

// Export singleton getter for convenience
export const getAirportCache = () => AirportCacheManager.getInstance();
