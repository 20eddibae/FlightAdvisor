import * as turf from '@turf/turf'
import { Feature, Polygon, MultiPolygon, LineString, Position } from 'geojson'
import { AirspaceFeatureCollection } from './geojson'

/**
 * Check if a line intersects with any airspace polygon
 */
/**
 * Check if a line intersects with any airspace polygon
 */
export function checkAirspaceIntersection(
  start: Position,
  end: Position,
  airspace: AirspaceFeatureCollection
): boolean {
  const line = turf.lineString([start, end])
  // Optimization: Calculate bbox of the line once
  const lineBbox = turf.bbox(line)

  for (const feature of airspace.features) {
    try {
      // Optimization: Check if bounding boxes overlap before expensive intersection
      const featureBbox = turf.bbox(feature)
      if (!doBboxesOverlap(lineBbox, featureBbox)) {
        continue
      }

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
 * Check if two bounding boxes overlap
 * BBox format: [minX, minY, maxX, maxY]
 */
function doBboxesOverlap(a: number[], b: number[]): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]
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
 * Calculate the perpendicular distance from a point to a line segment (in nautical miles)
 */
export function calculateDistanceFromLine(
  point: Position,
  lineStart: Position,
  lineEnd: Position
): number {
  const pt = turf.point(point)
  const line = turf.lineString([lineStart, lineEnd])
  const distanceKm = turf.pointToLineDistance(pt, line, { units: 'kilometers' })

  // Convert to nautical miles
  return distanceKm / 1.852
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
  // [minX, minY, maxX, maxY] - for a point, min=max
  const ptBbox = [point[0], point[1], point[0], point[1]]

  for (const feature of airspace.features) {
    try {
      // Optimization: Check BBox first
      const featureBbox = turf.bbox(feature)
      if (!doBboxesOverlap(ptBbox, featureBbox)) {
        continue
      }

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

/**
 * Subdivide a line segment into smaller segments with maximum length
 */
export function subdivideSegment(
  start: Position,
  end: Position,
  maxSegmentLenNm: number
): Position[] {
  const distanceNm = calculateDistance(start, end)

  if (distanceNm <= maxSegmentLenNm) {
    return [start, end]
  }

  const numSegments = Math.ceil(distanceNm / maxSegmentLenNm)
  const line = turf.lineString([start, end])
  const TotalDistKm = turf.length(line, { units: 'kilometers' })
  const stepKm = TotalDistKm / numSegments

  const points: Position[] = [start]

  for (let i = 1; i < numSegments; i++) {
    const along = turf.along(line, stepKm * i, { units: 'kilometers' })
    points.push(along.geometry.coordinates)
  }

  points.push(end)
  return points
}
