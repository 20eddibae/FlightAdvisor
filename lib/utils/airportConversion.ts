/**
 * Shared Airport Conversion Utilities
 * Ensures consistent conversion between OpenAIP format and internal format
 */

import type { OpenAIPAirport } from '@/lib/api/openaip'
import type { CachedAirport } from '@/lib/cache/types'
import type { Airport } from '@/lib/geojson'

/**
 * Detect if an airport is towered based on ICAO code
 * Only reliable indicator: 4-letter K-prefixed ICAO codes
 *
 * @param airport - OpenAIP airport data
 * @returns true if airport is towered
 */
export function isToweredAirport(airport: Pick<OpenAIPAirport, 'icaoCode'>): boolean {
  return !!(
    airport.icaoCode &&
    airport.icaoCode.length === 4 &&
    airport.icaoCode.startsWith('K')
  )
}

/**
 * Map OpenAIP numeric type code to human-readable name
 *
 * @param typeCode - OpenAIP type code
 * @returns Human-readable type name
 */
export function getAirportTypeName(typeCode: number): string {
  const typeNames: Record<number, string> = {
    2: 'Airport',  // Generic airport (NOT size-specific)
    3: 'Seaplane Base',
    4: 'Glider Site',
    5: 'Closed',
    6: 'Heliport',
    7: 'Military/Restricted',
    8: 'Ultralight'
  }
  return typeNames[typeCode] || `Type ${typeCode}`
}

/**
 * Convert OpenAIP airport to internal Airport format
 *
 * @param ap - OpenAIP airport data
 * @returns Airport in internal format
 */
export function toAirport(ap: OpenAIPAirport): Airport {
  const towered = isToweredAirport(ap)
  return {
    id: ap.icaoCode || ap._id,
    name: ap.name,
    lat: ap.geometry.coordinates[1],
    lon: ap.geometry.coordinates[0],
    elevation: ap.elevation?.value ?? 0,
    type: towered ? 'towered' : 'non-towered',
    notes: getAirportTypeName(ap.type),
  }
}

/**
 * Convert OpenAIP airport to CachedAirport format
 *
 * @param airport - OpenAIP airport data
 * @param regionName - US region name
 * @returns Airport in cache format
 */
export function toCachedAirport(
  airport: OpenAIPAirport,
  regionName: string
): CachedAirport {
  const towered = isToweredAirport(airport)
  const typeName = getAirportTypeName(airport.type)
  const trafficName = airport.trafficType === 1 ? 'IFR' : 'VFR'

  return {
    id: airport.icaoCode || airport._id,
    name: airport.name,
    lat: airport.geometry.coordinates[1],
    lon: airport.geometry.coordinates[0],
    elevation: airport.elevation?.value || 0,
    type: towered ? 'towered' : 'non-towered',
    notes: `${typeName} | Traffic: ${trafficName}`,
    _metadata: {
      region: regionName,
      cachedAt: Date.now(),
      source: 'openaip',
    },
  }
}

/**
 * Validate OpenAIP airport data
 *
 * @param airport - Airport data to validate
 * @returns true if valid
 */
export function isValidAirport(airport: any): airport is OpenAIPAirport {
  return !!(
    airport &&
    airport._id &&
    airport.name &&
    airport.geometry?.coordinates &&
    Array.isArray(airport.geometry.coordinates) &&
    airport.geometry.coordinates.length === 2 &&
    typeof airport.type === 'number'
  )
}

/**
 * Count towered vs non-towered airports
 *
 * @param airports - Array of OpenAIP airports
 * @returns Object with counts
 */
export function countAirportTypes(airports: OpenAIPAirport[]): {
  total: number
  towered: number
  nonTowered: number
  heliports: number
} {
  const towered = airports.filter(isToweredAirport).length
  const heliports = airports.filter(ap => ap.type === 6).length

  return {
    total: airports.length,
    towered,
    nonTowered: airports.length - towered,
    heliports,
  }
}
