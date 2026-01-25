/**
 * Cloud Region Analysis
 * Aggregates METAR point data into regional weather summaries for flight planning
 */

import buffer from '@turf/buffer'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { featureCollection, point, lineString } from '@turf/helpers'
import along from '@turf/along'
import length from '@turf/length'
import distance from '@turf/distance'

export interface CloudRegionSummary {
  regionName: string
  startPoint: [number, number]
  endPoint: [number, number]
  distanceNM: number
  stationCount: number
  dominantCondition: 'CLEAR' | 'SCATTERED' | 'CEILING_RESTRICTED' | 'IFR'
  averageCeiling: number | null // feet MSL
  lowestCeiling: number | null
  percentBrokenOrOvercast: number
  flightCategory: 'VFR' | 'MVFR' | 'IFR' | 'LIFR'
  stations: Array<{
    id: string
    cover: string
    ceil: number | null
    fltcat: string
  }>
  humanReadable: string
}

export interface RegionalCloudAnalysis {
  departure: CloudRegionSummary
  enRoute: CloudRegionSummary[]
  arrival: CloudRegionSummary
  overallRisk: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'
  summary: string
}

/**
 * Analyze cloud conditions by region along a flight route
 *
 * @param metarGeoJSON - METAR data from AWC API
 * @param routeCoordinates - Flight route as [lon, lat] array
 * @param departureId - Departure airport ICAO
 * @param arrivalId - Arrival airport ICAO
 * @returns Regional cloud analysis summary
 */
export function analyzeCloudRegions(
  metarGeoJSON: GeoJSON.FeatureCollection,
  routeCoordinates: Array<[number, number]>,
  departureId: string,
  arrivalId: string
): RegionalCloudAnalysis {
  // Create flight corridor (20nm wide buffer around route)
  const route = lineString(routeCoordinates)
  const corridor = buffer(route, 20, { units: 'miles' })

  // Filter METAR points to only those within the corridor
  const pointsInCorridor = metarGeoJSON.features.filter(feature => {
    if (feature.geometry.type !== 'Point') return false
    const pt = point(feature.geometry.coordinates as [number, number])
    return booleanPointInPolygon(pt, corridor)
  })

  console.log(`🌤️ Cloud Analysis: ${pointsInCorridor.length} weather stations within 20nm corridor`)

  // Calculate route length
  const routeLengthNM = length(route, { units: 'miles' })

  // Define regions:
  // - Departure: First 15% of route
  // - En-route: Middle 70% (can be subdivided)
  // - Arrival: Last 15% of route

  const departureRegion = analyzeSegment(
    pointsInCorridor,
    route,
    0,
    0.15,
    `Departure (${departureId})`,
    routeLengthNM
  )

  const arrivalRegion = analyzeSegment(
    pointsInCorridor,
    route,
    0.85,
    1.0,
    `Arrival (${arrivalId})`,
    routeLengthNM
  )

  // Divide en-route into segments (every 50nm or 3 segments max)
  const enRouteSegments = divideEnRoute(pointsInCorridor, route, routeLengthNM)

  // Determine overall risk level
  const allRegions = [departureRegion, ...enRouteSegments, arrivalRegion]
  const overallRisk = calculateOverallRisk(allRegions)

  // Generate human-readable summary
  const summary = generateSummary(departureRegion, enRouteSegments, arrivalRegion, overallRisk)

  return {
    departure: departureRegion,
    enRoute: enRouteSegments,
    arrival: arrivalRegion,
    overallRisk,
    summary
  }
}

/**
 * Analyze a segment of the route
 */
function analyzeSegment(
  allPoints: any[],
  route: GeoJSON.Feature<GeoJSON.LineString>,
  startFraction: number,
  endFraction: number,
  regionName: string,
  totalDistanceNM: number
): CloudRegionSummary {
  // Get start and end points of segment
  const startDist = totalDistanceNM * startFraction
  const endDist = totalDistanceNM * endFraction
  const startPt = along(route, startDist, { units: 'miles' })
  const endPt = along(route, endDist, { units: 'miles' })
  const startCoords = startPt.geometry.coordinates as [number, number]
  const endCoords = endPt.geometry.coordinates as [number, number]

  // Find all stations within this segment (within 20nm of segment midpoint)
  const midDist = totalDistanceNM * ((startFraction + endFraction) / 2)
  const midPt = along(route, midDist, { units: 'miles' })

  const stationsInSegment = allPoints.filter(feature => {
    const stationPt = point(feature.geometry.coordinates)
    const dist = distance(stationPt, midPt, { units: 'miles' })
    return dist <= 30 // Within 30nm of segment center
  })

  // Extract station data
  const stations = stationsInSegment.map(f => ({
    id: f.properties?.id || 'UNKNOWN',
    cover: f.properties?.cover || 'UNKNOWN',
    ceil: f.properties?.ceil || null,
    fltcat: f.properties?.fltcat || 'UNKNOWN'
  }))

  // Calculate statistics
  const ceilings = stations
    .map(s => s.ceil)
    .filter(c => c !== null && c !== undefined) as number[]

  const averageCeiling = ceilings.length > 0
    ? Math.round(ceilings.reduce((sum, c) => sum + c, 0) / ceilings.length)
    : null

  const lowestCeiling = ceilings.length > 0
    ? Math.min(...ceilings)
    : null

  // Count BKN/OVC stations
  const brokenOrOvercast = stations.filter(s =>
    s.cover === 'BKN' || s.cover === 'OVC'
  ).length

  const percentBrokenOrOvercast = stations.length > 0
    ? (brokenOrOvercast / stations.length) * 100
    : 0

  // Determine dominant condition
  let dominantCondition: CloudRegionSummary['dominantCondition'] = 'CLEAR'
  if (percentBrokenOrOvercast > 60) {
    dominantCondition = 'CEILING_RESTRICTED'
  } else if (percentBrokenOrOvercast > 30) {
    dominantCondition = 'SCATTERED'
  } else if (lowestCeiling && lowestCeiling < 1000) {
    dominantCondition = 'IFR'
  }

  // Determine flight category for region (worst-case among stations)
  const fltCategories = stations.map(s => s.fltcat)
  let flightCategory: 'VFR' | 'MVFR' | 'IFR' | 'LIFR' = 'VFR'
  if (fltCategories.includes('LIFR')) flightCategory = 'LIFR'
  else if (fltCategories.includes('IFR')) flightCategory = 'IFR'
  else if (fltCategories.includes('MVFR')) flightCategory = 'MVFR'

  // Generate human-readable summary
  const humanReadable = generateRegionSummary(
    regionName,
    stations.length,
    dominantCondition,
    averageCeiling,
    lowestCeiling,
    flightCategory
  )

  return {
    regionName,
    startPoint: startCoords,
    endPoint: endCoords,
    distanceNM: endDist - startDist,
    stationCount: stations.length,
    dominantCondition,
    averageCeiling,
    lowestCeiling,
    percentBrokenOrOvercast,
    flightCategory,
    stations,
    humanReadable
  }
}

/**
 * Divide en-route portion into manageable segments
 */
function divideEnRoute(
  allPoints: any[],
  route: GeoJSON.Feature<GeoJSON.LineString>,
  routeLengthNM: number
): CloudRegionSummary[] {
  const enRouteStart = 0.15
  const enRouteEnd = 0.85
  const enRouteDistanceNM = routeLengthNM * (enRouteEnd - enRouteStart)

  // Create 2-3 segments depending on route length
  const segmentCount = enRouteDistanceNM > 100 ? 3 : enRouteDistanceNM > 50 ? 2 : 1
  const segments: CloudRegionSummary[] = []

  for (let i = 0; i < segmentCount; i++) {
    const segmentStart = enRouteStart + (i / segmentCount) * (enRouteEnd - enRouteStart)
    const segmentEnd = enRouteStart + ((i + 1) / segmentCount) * (enRouteEnd - enRouteStart)
    const regionName = segmentCount === 1 ? 'En-route' : `En-route Segment ${i + 1}`

    segments.push(analyzeSegment(allPoints, route, segmentStart, segmentEnd, regionName, routeLengthNM))
  }

  return segments
}

/**
 * Generate human-readable summary for a region
 */
function generateRegionSummary(
  regionName: string,
  stationCount: number,
  condition: CloudRegionSummary['dominantCondition'],
  avgCeiling: number | null,
  lowestCeiling: number | null,
  fltcat: string
): string {
  if (stationCount === 0) {
    return `${regionName}: No weather data available`
  }

  const conditionText = {
    'CLEAR': 'mostly clear skies',
    'SCATTERED': 'scattered clouds',
    'CEILING_RESTRICTED': 'consistent cloud ceilings',
    'IFR': 'IFR conditions'
  }[condition]

  const ceilingText = avgCeiling
    ? `average ceiling ${avgCeiling}ft`
    : 'ceiling information unavailable'

  const lowestText = lowestCeiling && lowestCeiling < 3000
    ? `, lowest ${lowestCeiling}ft`
    : ''

  return `${regionName}: ${conditionText} (${fltcat}), ${ceilingText}${lowestText} [${stationCount} stations]`
}

/**
 * Calculate overall risk level
 */
function calculateOverallRisk(regions: CloudRegionSummary[]): 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' {
  // CRITICAL: Any region is LIFR or has ceiling below 1000ft
  if (regions.some(r => r.flightCategory === 'LIFR' || (r.lowestCeiling && r.lowestCeiling < 1000))) {
    return 'CRITICAL'
  }

  // HIGH: Any region is IFR or multiple regions are ceiling restricted
  const ifrRegions = regions.filter(r => r.flightCategory === 'IFR')
  const restrictedRegions = regions.filter(r => r.dominantCondition === 'CEILING_RESTRICTED')
  if (ifrRegions.length > 0 || restrictedRegions.length >= 2) {
    return 'HIGH'
  }

  // MODERATE: Any region is MVFR or one region is ceiling restricted
  const mvfrRegions = regions.filter(r => r.flightCategory === 'MVFR')
  if (mvfrRegions.length > 0 || restrictedRegions.length === 1) {
    return 'MODERATE'
  }

  return 'LOW'
}

/**
 * Generate overall summary
 */
function generateSummary(
  departure: CloudRegionSummary,
  enRoute: CloudRegionSummary[],
  arrival: CloudRegionSummary,
  risk: string
): string {
  const parts = [
    `RISK LEVEL: ${risk}`,
    departure.humanReadable,
    ...enRoute.map(r => r.humanReadable),
    arrival.humanReadable
  ]

  return parts.join(' | ')
}
