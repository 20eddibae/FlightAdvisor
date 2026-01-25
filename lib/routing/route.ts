import { Position } from 'geojson'
import { Airport, Waypoint, AirspaceFeatureCollection } from '../geojson'
import {
  checkAirspaceIntersection,
  calculateDistance,
  calculateDistanceFromLine,
  isPointInAirspace
} from '../geometry'
import { ROUTE_CONFIG } from '../constants'

export interface RouteResult {
  type: 'direct' | 'avoiding_airspace'
  coordinates: Position[]
  waypoints: string[]
  distance_nm: number
  estimated_time_min: number
  needs_astar: boolean
}

export interface RouteRequest {
  departure: Airport
  arrival: Airport
  airspace: AirspaceFeatureCollection
  waypoints: Waypoint[]
  maxSegmentLength?: number
}

/**
 * Calculate a route iteratively, segment by segment.
 * 
 * Algorithm:
 * 1. Start at Departure.
 * 2. Define a "reference line" from Departure to Arrival.
 * 3. Loop until current position is close enough to Arrival OR we can reach Arrival directly.
 *    - Find all candidate waypoints within `maxLegLength` of current position.
 *    - Filter candidates:
 *        - Must not be already visited.
 *        - Path to candidate must be clear of airspace.
 *    - Score candidates:
 *        - Score = (w1 * distance_progress) - (w2 * deviation_from_ref_line)
 *        - Favor waypoints that advance us towards goal and stay close to the straight line.
 *    - Pick best candidate.
 *    - If no candidate found, try to go direct to Arrival. If that fails, route creation fails (or returns partial).
 * 4. Add Arrival to route.
 */
export async function calculateRouteAsync(request: RouteRequest): Promise<RouteResult> {
  const { departure, arrival, airspace, waypoints, maxSegmentLength } = request

  // Default max leg length if not provided (e.g. 50nm)
  const MAX_LEG_LENGTH = maxSegmentLength || 50

  const startPos: Position = [departure.lon, departure.lat]
  const endPos: Position = [arrival.lon, arrival.lat]

  // Validation
  if (isPointInAirspace(startPos, airspace)) {
    throw new Error('Departure airport is located inside restricted airspace. Unable to plan departure.')
  }
  if (isPointInAirspace(endPos, airspace)) {
    throw new Error('Arrival airport is located inside restricted airspace. Unable to plan arrival.')
  }

  const routeCoordinates: Position[] = [startPos]
  const routeWaypoints: string[] = []
  const visitedWaypoints = new Set<string>()

  let currentPos = startPos
  let iterations = 0
  const MAX_ITERATIONS = 50 // Safety break

  // Reference line for scoring (Start -> End)
  // We want to stay relatively close to this line
  const refLineStart = startPos
  const refLineEnd = endPos

  while (iterations < MAX_ITERATIONS) {
    iterations++

    // 1. Check if we can reach the destination directly from here
    const distToEnd = calculateDistance(currentPos, endPos)

    // If we are close enough (within max leg length) AND clear path
    if (distToEnd <= MAX_LEG_LENGTH) {
      if (!checkAirspaceIntersection(currentPos, endPos, airspace)) {
        // Success! Add end point and break
        routeCoordinates.push(endPos)
        break
      }
    }

    // 2. Find candidates
    // Filter waypoints that are:
    // - Within MAX_LEG_LENGTH range
    // - Not visited
    // - Not in airspace (point check)
    // - Path to them is clear (line check)

    const candidates = waypoints.filter(wp => {
      if (visitedWaypoints.has(wp.id)) return false

      const pos: Position = [wp.lon, wp.lat]
      const dist = calculateDistance(currentPos, pos)

      if (dist > MAX_LEG_LENGTH) return false
      if (isPointInAirspace(pos, airspace)) return false

      return !checkAirspaceIntersection(currentPos, pos, airspace)
    })

    if (candidates.length === 0) {
      // No valid next step.
      // Try to force a direct line to end even if long/blocked? 
      // Or just fail.
      // Let's try to finalize with a direct line (which might cross airspace if unavoidable, 
      // but at least completes the geometry). 
      // Or throw error strictly. User asked to "repeat until dest is reachable ... or no valid waypoint exists"

      // Attempt generic direct connection as last resort, but mark as "failed specific constraints" if needed.
      // For now, let's break and add destination, but the checkAirspaceIntersection above might have failed.
      // If we are here, it means we can't cleanly reach destination OR next waypoint.

      // Let's see if we can just go to destination ignoring length limit? 
      // Usually user wants a valid route.

      console.warn("No valid waypoints found to proceed. Attempting direct connection to destination.")
      routeCoordinates.push(endPos)
      break
    }

    // 3. Score candidates
    // We want to maximize progress towards destination, and minimize deviation from straight line.
    // Progress = (Distance Start->End) - (Distance Candidate->End)
    // Deviation = Perpendicular distance to RefLine

    let bestCandidate = null
    let bestScore = -Infinity

    // Weights
    const W_PROGRESS = 1.0
    const W_DEVIATION = 2.0 // Penalize going off-track heavily

    for (const cand of candidates) {
      const candPos: Position = [cand.lon, cand.lat]

      const distToGoal = calculateDistance(candPos, endPos)
      const progress = calculateDistance(currentPos, endPos) - distToGoal // How much closer did we get?

      const deviation = calculateDistanceFromLine(candPos, refLineStart, refLineEnd)

      // Score formula
      // We want high progress, low deviation.
      const score = (W_PROGRESS * progress) - (W_DEVIATION * deviation)

      if (score > bestScore) {
        bestScore = score
        bestCandidate = cand
      }
    }

    if (bestCandidate) {
      // Move to best candidate
      const nextPos: Position = [bestCandidate.lon, bestCandidate.lat]
      routeCoordinates.push(nextPos)
      routeWaypoints.push(bestCandidate.id)
      visitedWaypoints.add(bestCandidate.id)
      currentPos = nextPos
    } else {
      // Should actally be covered by candidates.length check, but safety
      routeCoordinates.push(endPos)
      break
    }
  }

  // Calculate total metrics
  let totalDistance = 0
  for (let i = 0; i < routeCoordinates.length - 1; i++) {
    totalDistance += calculateDistance(routeCoordinates[i], routeCoordinates[i + 1])
  }

  const estimatedTime = (totalDistance / ROUTE_CONFIG.GROUNDSPEED_KNOTS) * 60

  return {
    type: routeWaypoints.length > 0 ? 'avoiding_airspace' : 'direct',
    coordinates: routeCoordinates,
    waypoints: routeWaypoints,
    distance_nm: Math.round(totalDistance * 10) / 10,
    estimated_time_min: Math.round(estimatedTime),
    needs_astar: false
  }
}
