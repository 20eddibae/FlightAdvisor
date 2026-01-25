import * as turf from '@turf/turf'
import { Feature, Polygon, MultiPolygon, LineString, Position } from 'geojson'
import { AirspaceFeatureCollection } from './geojson'

/**
 * Check if a line intersects with any airspace polygon
 */
export function checkAirspaceIntersection(
  start: Position,
  end: Position,
  airspace: AirspaceFeatureCollection
): boolean {
  const line = turf.lineString([start, end])

  for (const feature of airspace.features) {
    try {
      const intersection = turf.lineIntersect(line, feature as Feature<Polygon | MultiPolygon>)
      if (intersection.features.length > 0) {
        return true
      }
    } catch (error) {
      console.warn('Error checking intersection:', error)
      continue
    }
  }

  return false
}

/**
 * Calculate the distance between two points in nautical miles
 */
export function calculateDistance(start: Position, end: Position): number {
  const from = turf.point(start)
  const to = turf.point(end)
  const distanceKm = turf.distance(from, to, { units: 'kilometers' })

  // Convert km to nautical miles (1 nm = 1.852 km)
  return distanceKm / 1.852
}

/**
 * Calculate the bearing from one point to another (in degrees)
 */
export function calculateBearing(start: Position, end: Position): number {
  return turf.bearing(start, end)
}

/**
 * Create a bounding box around two points with optional padding (in degrees)
 */
export function createBoundingBox(
  start: Position,
  end: Position,
  padding: number = 0.1
): [number, number, number, number] {
  const minLon = Math.min(start[0], end[0]) - padding
  const minLat = Math.min(start[1], end[1]) - padding
  const maxLon = Math.max(start[0], end[0]) + padding
  const maxLat = Math.max(start[1], end[1]) + padding

  return [minLon, minLat, maxLon, maxLat]
}

/**
 * Check if a point is inside any restricted airspace
 */
export function isPointInAirspace(
  point: Position,
  airspace: AirspaceFeatureCollection
): boolean {
  const pt = turf.point(point)

  for (const feature of airspace.features) {
    try {
      if (turf.booleanPointInPolygon(pt, feature as Feature<Polygon | MultiPolygon>)) {
        return true
      }
    } catch (error) {
      console.warn('Error checking point in polygon:', error)
      continue
    }
  }

  return false
}

/**
 * Simplify a line using Douglas-Peucker algorithm
 */
export function simplifyLine(
  coordinates: Position[],
  tolerance: number = 0.01
): Position[] {
  if (coordinates.length < 3) {
    return coordinates
  }

  const line = turf.lineString(coordinates)
  const simplified = turf.simplify(line, { tolerance, highQuality: true })

  return simplified.geometry.coordinates
}

/**
 * Find the closest waypoint to a given point (within threshold distance in nm)
 */
export function findClosestWaypoint(
  point: Position,
  waypoints: Array<{ lon: number; lat: number; id: string }>,
  thresholdNm: number = 2
): { lon: number; lat: number; id: string } | null {
  let closest: { lon: number; lat: number; id: string } | null = null
  let minDistance = Infinity

  for (const waypoint of waypoints) {
    const distance = calculateDistance(point, [waypoint.lon, waypoint.lat])
    if (distance < minDistance && distance <= thresholdNm) {
      minDistance = distance
      closest = waypoint
    }
  }

  return closest
}

/**
 * Convert a GeoJSON LineString to an array of Position tuples
 */
export function lineStringToPositions(lineString: Feature<LineString>): Position[] {
  return lineString.geometry.coordinates
}

/**
 * Calculate intermediate points along a line (useful for route display)
 */
export function interpolateLine(
  start: Position,
  end: Position,
  numPoints: number = 10
): Position[] {
  const line = turf.lineString([start, end])
  const length = turf.length(line, { units: 'kilometers' })
  const step = length / (numPoints - 1)

  const points: Position[] = [start]

  for (let i = 1; i < numPoints - 1; i++) {
    const along = turf.along(line, step * i, { units: 'kilometers' })
    points.push(along.geometry.coordinates)
  }

  points.push(end)

  return points
}
