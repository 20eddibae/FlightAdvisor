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
export async function loadAirports(): Promise<Airport[]> {
  const response = await fetch('/data/airports.json')
  if (!response.ok) {
    throw new Error('Failed to load airports data')
  }
  const data = await response.json()
  return data.airports
}

export async function loadWaypoints(): Promise<Waypoint[]> {
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
export async function loadAllAirspace(): Promise<AirspaceFeatureCollection> {
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
