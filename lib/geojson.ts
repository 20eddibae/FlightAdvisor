import { FeatureCollection, Feature, Polygon, MultiPolygon } from 'geojson'
import { DEFAULT_BOUNDS } from './constants'
import simplify from '@turf/simplify'

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
  type: 'VOR' | 'VORTAC' | 'NDB' | 'GPS_FIX' | 'INTERSECTION' | 'AIRPORT'
  frequency?: string
  description?: string
}

// Type aliases for GeoJSON features
export type AirspaceFeature = Feature<Polygon | MultiPolygon, AirspaceProperties>
export type AirspaceFeatureCollection = FeatureCollection<Polygon | MultiPolygon, AirspaceProperties>

// Data loader functions — always use OpenAIP; no static fallback
export async function loadAirports(
  options?: { bounds?: [number, number, number, number] }
): Promise<Airport[]> {
  const { fetchAirports, isOpenAIPConfigured } = await import('./api/openaip')

  if (!isOpenAIPConfigured()) {
    throw new Error(
      'OpenAIP API not configured. Set OPEN_AIP_API_KEY in .env.local'
    )
  }

  const bounds = options?.bounds ?? DEFAULT_BOUNDS
  const openAIPAirports = await fetchAirports(bounds)

  return openAIPAirports.map((ap) => {
    // FIXED: OpenAIP type codes don't indicate airport size
    // Type 2 includes everything from KSMF (major) to private strips
    // Only reliable indicator: 4-letter K-prefixed ICAO codes = towered airports
    const hasValidICAO = ap.icaoCode && ap.icaoCode.length === 4 && ap.icaoCode.startsWith('K')
    const isTowered = hasValidICAO  // Only ICAO-coded airports are considered towered

    // Map type codes to readable names
    const typeNames: Record<number, string> = {
      2: 'Large Airport',
      3: 'Medium Airport',
      4: 'Small Airport',
      5: 'Closed',
      6: 'Heliport',
      7: 'Military/Restricted'
    }
    const typeName = typeNames[ap.type] || `Type ${ap.type}`

    return {
      id: ap.icaoCode || ap._id,
      name: ap.name,
      lat: ap.geometry.coordinates[1],
      lon: ap.geometry.coordinates[0],
      elevation: ap.elevation?.value ?? 0,
      type: isTowered ? 'towered' : 'non-towered',
      notes: typeName,
    }
  })
}

export async function loadWaypoints(
  options?: { bounds?: [number, number, number, number] }
): Promise<Waypoint[]> {
  const { fetchNavaids, isOpenAIPConfigured } = await import('./api/openaip')

  if (!isOpenAIPConfigured()) {
    throw new Error(
      'OpenAIP API not configured. Set OPEN_AIP_API_KEY in .env.local'
    )
  }

  const bounds = options?.bounds ?? DEFAULT_BOUNDS
  const openAIPNavaids = await fetchNavaids(bounds)

  return openAIPNavaids.map((navaid) => ({
    id: navaid._id,
    name: navaid.name,
    lat: navaid.geometry.coordinates[1],
    lon: navaid.geometry.coordinates[0],
    type: navaid.type as
      | 'VOR'
      | 'VORTAC'
      | 'NDB'
      | 'GPS_FIX'
      | 'INTERSECTION',
    frequency: navaid.frequency
      ? `${navaid.frequency.value} ${navaid.frequency.unit}`
      : undefined,
    description: `${navaid.type} navigation aid`,
  }))
}

export async function loadAirspace(
  filename: string
): Promise<AirspaceFeatureCollection> {
  const response = await fetch(`/data/airspace/${filename}`)
  if (!response.ok) {
    throw new Error(`Failed to load airspace data: ${filename}`)
  }
  return response.json()
}

// Load all airspace from OpenAIP only
export async function loadAllAirspace(
  options?: { bounds?: [number, number, number, number] }
): Promise<AirspaceFeatureCollection> {
  const { fetchAllAirspace, isOpenAIPConfigured } = await import(
    './api/openaip'
  )

  if (!isOpenAIPConfigured()) {
    throw new Error(
      'OpenAIP API not configured. Set OPEN_AIP_API_KEY in .env.local'
    )
  }

  const bounds = options?.bounds ?? DEFAULT_BOUNDS
  const openAIPData = await fetchAllAirspace(bounds)
  return openAIPData as AirspaceFeatureCollection
}

// Utility function to convert lat/lon to GeoJSON Point
export function createPoint(lon: number, lat: number): [number, number] {
  return [lon, lat]
}

// Utility function to get coordinates from Airport or Waypoint
export function getCoordinates(
  location: Airport | Waypoint
): [number, number] {
  return [location.lon, location.lat]
}

/**
 * Simplify airspace polygons for better rendering performance
 * Uses Turf.js simplify with Douglas-Peucker algorithm
 *
 * @param airspace - Airspace feature collection to simplify
 * @param tolerance - Simplification tolerance in degrees (default: 0.001 ≈ 110m)
 * @returns Simplified airspace feature collection
 */
export function simplifyAirspace(
  airspace: AirspaceFeatureCollection,
  tolerance: number = 0.001
): AirspaceFeatureCollection {
  const startTime = performance.now()

  try {
    const simplified = simplify(airspace, {
      tolerance,
      highQuality: false, // Faster, good enough for map display
      mutate: false, // Don't modify original
    }) as AirspaceFeatureCollection

    const endTime = performance.now()

    // Count vertices before and after
    const countVertices = (fc: AirspaceFeatureCollection) => {
      return fc.features.reduce((sum, feature) => {
        if (feature.geometry.type === 'Polygon') {
          return sum + feature.geometry.coordinates[0].length
        } else if (feature.geometry.type === 'MultiPolygon') {
          return sum + feature.geometry.coordinates.reduce(
            (s, poly) => s + poly[0].length,
            0
          )
        }
        return sum
      }, 0)
    }

    const beforeVertices = countVertices(airspace)
    const afterVertices = countVertices(simplified)
    const reduction = ((beforeVertices - afterVertices) / beforeVertices * 100).toFixed(1)

    console.log(
      `🎯 Simplified ${airspace.features.length} airspace features: ` +
      `${beforeVertices} → ${afterVertices} vertices (${reduction}% reduction) ` +
      `in ${(endTime - startTime).toFixed(2)}ms`
    )

    return simplified
  } catch (error) {
    console.warn('Failed to simplify airspace, using original:', error)
    return airspace
  }
}
