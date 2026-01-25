import { FeatureCollection, Feature, Polygon, MultiPolygon } from 'geojson'
import { DEFAULT_BOUNDS } from './constants'

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

  return openAIPAirports.map((ap) => ({
    id: ap.icaoCode || ap._id,
    name: ap.name,
    lat: ap.geometry.coordinates[1],
    lon: ap.geometry.coordinates[0],
    elevation: ap.elevation?.value ?? 0,
    type: ap.trafficType?.includes('IFR') ? 'towered' : 'non-towered',
    notes: `Type: ${ap.type}`,
  }))
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
