/**
 * OpenAIP API Client
 *
 * Integrates with OpenAIP APIs to fetch real-time aviation data (airports, airspaces, navaids).
 *
 * API Documentation: https://docs.openaip.net/
 * Base URL: https://api.core.openaip.net/api
 *
 * Note: Requires OPEN_AIP_API_KEY environment variable
 */

const OPENAIP_BASE_URL = 'https://api.core.openaip.net/api'
const OPENAIP_API_KEY = process.env.OPEN_AIP_API_KEY

/**
 * GeoJSON Feature for airspace data
 */
export interface OpenAIPAirspaceFeature {
  type: 'Feature'
  properties: {
    name: string
    type: string
    icaoClass?: string
    floor_msl?: number
    ceiling_msl?: number
    activity?: string
    notes?: string
  }
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: number[][][] | number[][][][]
  }
}

/**
 * GeoJSON FeatureCollection for airspace data
 */
export interface OpenAIPAirspaceResponse {
  type: 'FeatureCollection'
  features: OpenAIPAirspaceFeature[]
}

/**
 * Airport data from OpenAIP
 *
 * Type codes (numeric):
 * - 2 = Large airport (commercial service)
 * - 3 = Medium airport (regional)
 * - 4 = Small airport (general aviation)
 * - 5 = Closed airport
 * - 6 = Heliport (civilian)
 * - 7 = Military/restricted
 *
 * Traffic type codes (numeric):
 * - 0 = VFR only
 * - 1 = IFR available
 */
export interface OpenAIPAirport {
  _id: string
  name: string
  icaoCode?: string
  type: number  // FIXED: OpenAIP returns numeric codes, not strings
  geometry: {
    type: 'Point' | string  // Allow string for bulk API compatibility
    coordinates: [number, number] // [lon, lat]
  }
  elevation?: {
    value: number
    unit: string
    referenceDatum?: string  // Optional field from bulk API
  }
  trafficType?: number  // FIXED: OpenAIP returns single number, not array
}

/**
 * Navaid (VOR, NDB, etc.) data from OpenAIP
 */
export interface OpenAIPNavaid {
  _id: string
  name: string
  type: string // VOR, NDB, DME, TACAN, VORTAC
  geometry: {
    type: 'Point'
    coordinates: [number, number] // [lon, lat]
  }
  frequency?: {
    value: number
    unit: string
  }
  elevation?: {
    value: number
    unit: string
  }
}

/**
 * Get authentication headers for OpenAIP API requests
 */
function getAuthHeaders(): HeadersInit {
  if (!OPENAIP_API_KEY) {
    throw new Error('OpenAIP API key not configured. Set OPEN_AIP_API_KEY environment variable.')
  }

  return {
    'x-openaip-api-key': OPENAIP_API_KEY,
    'Accept': 'application/json',
  }
}

/**
 * Convert bounding box to OpenAIP format: "minLon,minLat,maxLon,maxLat"
 */
function formatBBox(bounds: [number, number, number, number]): string {
  return bounds.join(',')
}

/**
 * Fetch airspaces within a bounding box
 *
 * @param bounds - Bounding box [minLon, minLat, maxLon, maxLat]
 * @param filters - Optional filters for airspace type and ICAO class
 * @returns Airspace data as GeoJSON FeatureCollection
 *
 * Type codes: 0=Controlled (CTR/TMA), 1=Restricted/Prohibited/Danger, 2=Special use
 * ICAO Class codes: 1=B, 2=C, 3=D, 4=E, 8=G/Other
 */
export async function fetchAirspaces(
  bounds: [number, number, number, number],
  filters?: {
    type?: number[] // 0=Controlled, 1=Restricted/Prohibited/Danger, 2=Special use
    icaoClass?: number[] // 1=B, 2=C, 3=D, 4=E, 8=G/Other
  }
): Promise<OpenAIPAirspaceResponse> {
  const bbox = formatBBox(bounds)
  const params = new URLSearchParams({
    bbox,
    limit: '500', // Increased from 100 to capture all airspace in dense regions
  })

  // Add type filter if provided (numeric codes)
  if (filters?.type && filters.type.length > 0) {
    filters.type.forEach(t => params.append('type', t.toString()))
  }

  // Add ICAO class filter if provided (numeric codes)
  if (filters?.icaoClass && filters.icaoClass.length > 0) {
    filters.icaoClass.forEach(c => params.append('icaoClass', c.toString()))
  }

  const url = `${OPENAIP_BASE_URL}/airspaces?${params.toString()}`

  try {
    const response = await fetch(url, {
      headers: getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error(`OpenAIP API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    // Convert OpenAIP response to GeoJSON FeatureCollection
    return convertAirspacesToGeoJSON(data.items || [])
  } catch (error) {
    console.error('Failed to fetch airspaces from OpenAIP API:', error)
    throw error
  }
}

/**
 * Convert OpenAIP airspace data to GeoJSON FeatureCollection
 */
function convertAirspacesToGeoJSON(airspaces: any[]): OpenAIPAirspaceResponse {
  const features: OpenAIPAirspaceFeature[] = airspaces.map(airspace => {
    // Extract altitude values (convert to MSL feet if needed)
    const lowerLimit = airspace.lowerLimit?.value || 0
    const upperLimit = airspace.upperLimit?.value || 99999

    return {
      type: 'Feature',
      properties: {
        name: airspace.name || 'Unnamed Airspace',
        type: airspace.type || 'UNKNOWN',
        icaoClass: airspace.icaoClass,
        floor_msl: lowerLimit,
        ceiling_msl: upperLimit,
        activity: airspace.activity,
        notes: airspace.remarks || '',
      },
      geometry: airspace.geometry,
    }
  })

  return {
    type: 'FeatureCollection',
    features,
  }
}

/**
 * Fetch Class B equivalent airspaces (Class B, TMA, CTR)
 *
 * @param bounds - Bounding box [minLon, minLat, maxLon, maxLat]
 * @returns Airspace FeatureCollection
 */
export async function fetchClassBAirspace(
  bounds: [number, number, number, number]
): Promise<OpenAIPAirspaceResponse> {
  return fetchAirspaces(bounds, {
    icaoClass: [1], // Class B
    type: [0], // Controlled airspace (includes TMA, CTR)
  })
}

/**
 * Fetch restricted airspaces (Prohibited, Restricted, Danger)
 *
 * @param bounds - Bounding box [minLon, minLat, maxLon, maxLat]
 * @returns Airspace FeatureCollection
 */
export async function fetchRestrictedAirspace(
  bounds: [number, number, number, number]
): Promise<OpenAIPAirspaceResponse> {
  return fetchAirspaces(bounds, {
    type: [1], // Restricted/Prohibited/Danger areas
  })
}

/**
 * Fetch all relevant airspace types for a region
 *
 * @param bounds - Bounding box [minLon, minLat, maxLon, maxLat]
 * @returns Combined airspace FeatureCollection
 */
export async function fetchAllAirspace(
  bounds: [number, number, number, number]
): Promise<OpenAIPAirspaceResponse> {
  try {
    // Fetch Class B-like airspaces and restricted zones in parallel
    const [classB, restricted] = await Promise.all([
      fetchClassBAirspace(bounds),
      fetchRestrictedAirspace(bounds),
    ])

    // Combine features
    return {
      type: 'FeatureCollection',
      features: [...classB.features, ...restricted.features],
    }
  } catch (error) {
    console.error('Failed to fetch airspace from OpenAIP API:', error)
    throw error
  }
}

/**
 * Fetch airports within a bounding box
 *
 * @param bounds - Bounding box [minLon, minLat, maxLon, maxLat]
 * @param filters - Optional filters for airport type
 * @returns Array of airport objects
 *
 * Type codes: 2=Major airport, 7=Heliport, etc. (use numeric codes)
 */
export async function fetchAirports(
  bounds: [number, number, number, number],
  filters?: {
    type?: number[] // Airport type codes (numeric)
  }
): Promise<OpenAIPAirport[]> {
  const bbox = formatBBox(bounds)
  const params = new URLSearchParams({
    bbox,
    limit: '500', // Increased from 100 to match BULK_FETCH_LIMIT - ensures major airports are included
  })

  if (filters?.type && filters.type.length > 0) {
    filters.type.forEach(t => params.append('type', t.toString()))
  }

  const url = `${OPENAIP_BASE_URL}/airports?${params.toString()}`

  try {
    const response = await fetch(url, {
      headers: getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error(`OpenAIP API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data.items || []
  } catch (error) {
    console.error('Failed to fetch airports from OpenAIP API:', error)
    throw error
  }
}

/**
 * Fetch navaids (VOR, NDB, etc.) within a bounding box
 *
 * @param bounds - Bounding box [minLon, minLat, maxLon, maxLat]
 * @param filters - Optional filters for navaid type
 * @returns Array of navaid objects
 *
 * Type codes: 4=VOR, etc. (use numeric codes)
 */
export async function fetchNavaids(
  bounds: [number, number, number, number],
  filters?: {
    type?: number[] // Navaid type codes (numeric)
  }
): Promise<OpenAIPNavaid[]> {
  const bbox = formatBBox(bounds)
  const params = new URLSearchParams({
    bbox,
    limit: '500', // Increased from 100 to ensure all navaids in dense regions are loaded
  })

  if (filters?.type && filters.type.length > 0) {
    filters.type.forEach(t => params.append('type', t.toString()))
  }

  const url = `${OPENAIP_BASE_URL}/navaids?${params.toString()}`

  try {
    const response = await fetch(url, {
      headers: getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error(`OpenAIP API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data.items || []
  } catch (error) {
    console.error('Failed to fetch navaids from OpenAIP API:', error)
    throw error
  }
}

/**
 * Check if OpenAIP API credentials are configured
 */
export function isOpenAIPConfigured(): boolean {
  return !!OPENAIP_API_KEY
}
