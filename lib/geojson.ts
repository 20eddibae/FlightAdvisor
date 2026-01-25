import { FeatureCollection, Feature, Polygon, MultiPolygon } from 'geojson'

// Airspace property types
export interface AirspaceProperties {
  name: string
  type: 'CLASS_B' | 'CLASS_C' | 'CLASS_D' | 'RESTRICTED' | 'MOA' | 'PROHIBITED'
  floor_msl: number
  ceiling_msl: number
  notes?: string
}

// Airport type
export interface Airport {
  id: string
  name: string
  lat: number
  lon: number
  elevation: number
  type: 'towered' | 'non-towered'
  notes?: string
}

// Waypoint type
export interface Waypoint {
  id: string
  name: string
  lat: number
  lon: number
  type: 'VOR' | 'VORTAC' | 'NDB' | 'GPS_FIX' | 'INTERSECTION'
  frequency?: string
  description?: string
}

// Type aliases for GeoJSON features
export type AirspaceFeature = Feature<Polygon | MultiPolygon, AirspaceProperties>
export type AirspaceFeatureCollection = FeatureCollection<Polygon | MultiPolygon, AirspaceProperties>

// Data loader functions
export async function loadAirports(
  options?: { useOpenAIP?: boolean; bounds?: [number, number, number, number] }
): Promise<Airport[]> {
  // Try OpenAIP API if requested and configured
  if (options?.useOpenAIP) {
    try {
      const { fetchAirports, isOpenAIPConfigured } = await import('./api/openaip')

      if (isOpenAIPConfigured()) {
        const bounds = options.bounds || [-123.0, 37.0, -121.0, 39.0]
        const openAIPAirports = await fetchAirports(bounds)

        // Convert OpenAIP format to our Airport format
        return openAIPAirports.map(ap => ({
          id: ap.icaoCode || ap._id,
          name: ap.name,
          lat: ap.geometry.coordinates[1],
          lon: ap.geometry.coordinates[0],
          elevation: ap.elevation?.value || 0,
          type: ap.trafficType?.includes('IFR') ? 'towered' : 'non-towered',
          notes: `Type: ${ap.type}`,
        }))
      }
    } catch (error) {
      console.warn('OpenAIP API failed, falling back to static data:', error)
    }
  }

  // Default: Use static JSON file
  const response = await fetch('/data/airports.json')
  if (!response.ok) {
    throw new Error('Failed to load airports data')
  }
  const data = await response.json()
  return data.airports
}

export async function loadWaypoints(
  options?: { useOpenAIP?: boolean; bounds?: [number, number, number, number] }
): Promise<Waypoint[]> {
  // Try OpenAIP API if requested and configured
  if (options?.useOpenAIP) {
    try {
      const { fetchNavaids, isOpenAIPConfigured } = await import('./api/openaip')

      if (isOpenAIPConfigured()) {
        const bounds = options.bounds || [-123.0, 37.0, -121.0, 39.0]
        // Fetch all navaids (VOR, VORTAC, NDB, etc.)
        const openAIPNavaids = await fetchNavaids(bounds)

        // Convert OpenAIP format to our Waypoint format
        return openAIPNavaids.map(navaid => ({
          id: navaid._id,
          name: navaid.name,
          lat: navaid.geometry.coordinates[1],
          lon: navaid.geometry.coordinates[0],
          type: navaid.type as 'VOR' | 'VORTAC' | 'NDB' | 'GPS_FIX' | 'INTERSECTION',
          frequency: navaid.frequency
            ? `${navaid.frequency.value} ${navaid.frequency.unit}`
            : undefined,
          description: `${navaid.type} navigation aid`,
        }))
      }
    } catch (error) {
      console.warn('OpenAIP API failed, falling back to static data:', error)
    }
  }

  // Default: Use static JSON file
  const response = await fetch('/data/waypoints.json')
  if (!response.ok) {
    throw new Error('Failed to load waypoints data')
  }
  const data = await response.json()
  return data.waypoints
}

export async function loadAirspace(filename: string): Promise<AirspaceFeatureCollection> {
  const response = await fetch(`/data/airspace/${filename}`)
  if (!response.ok) {
    throw new Error(`Failed to load airspace data: ${filename}`)
  }
  return response.json()
}

// Helper to load all airspace data
// Optionally uses OpenAIP API if configured
export async function loadAllAirspace(
  options?: { useOpenAIP?: boolean; bounds?: [number, number, number, number] }
): Promise<AirspaceFeatureCollection> {
  // Try OpenAIP API if requested and configured
  if (options?.useOpenAIP) {
    try {
      // Dynamic import to avoid bundling OpenAIP API client if not needed
      const { fetchAllAirspace, isOpenAIPConfigured } = await import('./api/openaip')

      if (isOpenAIPConfigured()) {
        const bounds = options.bounds || [-123.0, 37.0, -121.0, 39.0] // Default: NorCal region
        const openAIPData = await fetchAllAirspace(bounds)

        // Convert OpenAIP format to our AirspaceFeatureCollection format
        return openAIPData as AirspaceFeatureCollection
      }
    } catch (error) {
      console.warn('OpenAIP API failed, falling back to static data:', error)
      // Fall through to static files
    }
  }

  // Default: Use static GeoJSON files (works offline, faster for MVP)
  const [classB, restricted] = await Promise.all([
    loadAirspace('sfo_class_b.geojson'),
    loadAirspace('restricted_zones.geojson'),
  ])

  // Combine all features into a single FeatureCollection
  return {
    type: 'FeatureCollection',
    features: [...classB.features, ...restricted.features],
  }
}

// Utility function to convert lat/lon to GeoJSON Point
export function createPoint(lon: number, lat: number): [number, number] {
  return [lon, lat]
}

// Utility function to get coordinates from Airport or Waypoint
export function getCoordinates(location: Airport | Waypoint): [number, number] {
  return [location.lon, location.lat]
}
