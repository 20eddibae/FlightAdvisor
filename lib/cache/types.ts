/**
 * Type definitions for airport caching system
 */

export interface CachedAirport {
  id: string              // ICAO code
  name: string
  lat: number
  lon: number
  elevation: number
  type: 'towered' | 'non-towered'
  notes?: string
  _metadata: {
    region: string        // From US_REGIONS
    cachedAt: number
    source: 'openaip'
  }
}

export interface RegionCache {
  regionName: string
  bounds: [number, number, number, number]  // [west, south, east, north]
  airports: CachedAirport[]
  cachedAt: number
  version: number
}

export interface CacheMetadata {
  version: number         // Schema version (current: 1)
  lastUpdated: number
  regions: {
    [key: string]: {
      status: 'empty' | 'loading' | 'cached' | 'error'
      airportCount: number
      cachedAt: number
      bounds: [number, number, number, number]
    }
  }
}

export interface CacheStatus {
  initialized: boolean
  totalAirports: number
  cachedRegions: string[]
  loadingRegions: string[]
  lastUpdated: number
}

export interface SearchOptions {
  maxResults?: number
  types?: Array<'towered' | 'non-towered'>
  region?: string
}

export interface RegionDefinition {
  name: string
  bounds: [number, number, number, number]  // [west, south, east, north]
  description?: string
}

// US Regions for chunked loading
export const US_REGIONS: RegionDefinition[] = [
  {
    name: 'West Coast',
    bounds: [-125, 32, -115, 49],
    description: 'California, Oregon, Washington'
  },
  {
    name: 'Southwest',
    bounds: [-115, 31, -103, 42],
    description: 'Nevada, Utah, Arizona, New Mexico'
  },
  {
    name: 'Mountain',
    bounds: [-111, 37, -102, 49],
    description: 'Montana, Wyoming, Colorado, Idaho'
  },
  {
    name: 'Midwest',
    bounds: [-104, 37, -84, 49],
    description: 'North Dakota, South Dakota, Nebraska, Kansas, Minnesota, Iowa, Missouri'
  },
  {
    name: 'Great Lakes',
    bounds: [-93, 37, -75, 49],
    description: 'Wisconsin, Michigan, Illinois, Indiana, Ohio'
  },
  {
    name: 'Northeast',
    bounds: [-80, 38, -66, 48],
    description: 'New York, Pennsylvania, Vermont, New Hampshire, Maine, Massachusetts'
  },
  {
    name: 'Southeast',
    bounds: [-92, 24, -75, 40],
    description: 'North Carolina, South Carolina, Georgia, Florida, Alabama, Mississippi, Tennessee, Kentucky'
  },
  {
    name: 'South Central',
    bounds: [-107, 25, -88, 37],
    description: 'Texas, Oklahoma, Arkansas, Louisiana'
  },
];
