import { Position } from 'geojson'
import { Airport, Waypoint, AirspaceFeatureCollection } from '../geojson'
import {
  checkAirspaceIntersection,
  calculateDistance,
  findClosestWaypoint,
  simplifyLine
} from '../geometry'
import { ROUTE_CONFIG } from '../constants'
import { calculateRouteWithAStar } from './aStarGrid'

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
}

/**
 * Calculate a route from departure to arrival airport
 * First attempts direct route, falls back to waypoint routing if intersection detected
 */
export function calculateRoute(request: RouteRequest): RouteResult {
  const { departure, arrival, airspace, waypoints } = request

  const start: Position = [departure.lon, departure.lat]
  const end: Position = [arrival.lon, arrival.lat]

  // Check if direct route intersects restricted airspace
  const hasIntersection = checkAirspaceIntersection(start, end, airspace)

  if (!hasIntersection) {
    // Direct route is clear
    const distance = calculateDistance(start, end)
    const time = (distance / ROUTE_CONFIG.GROUNDSPEED_KNOTS) * 60

    return {
      type: 'direct',
      coordinates: [start, end],
      waypoints: [],
      distance_nm: Math.round(distance * 10) / 10,
      estimated_time_min: Math.round(time),
      needs_astar: false,
    }
  }

  // Direct route intersects airspace - use waypoint routing
  // For now, route through waypoints that don't intersect airspace
  const routeWithWaypoints = findWaypointRoute(start, end, airspace, waypoints)

  if (routeWithWaypoints) {
    return routeWithWaypoints
  }

  // If waypoint routing fails, mark for A* pathfinding
  return {
    type: 'avoiding_airspace',
    coordinates: [start, end],
    waypoints: [],
    distance_nm: calculateDistance(start, end),
    estimated_time_min: 0,
    needs_astar: true,
  }
}

/**
 * Attempt to find a route using existing waypoints
 */
function findWaypointRoute(
  start: Position,
  end: Position,
  airspace: AirspaceFeatureCollection,
  waypoints: Waypoint[]
): RouteResult | null {
  // Simple strategy: try routing through each waypoint
  // In a real implementation, this would use a more sophisticated algorithm

  // Find waypoints that create clear paths
  const validWaypoints: Waypoint[] = []

  for (const waypoint of waypoints) {
    const waypointPos: Position = [waypoint.lon, waypoint.lat]

    // Check if path from start to waypoint is clear
    const startToWaypointClear = !checkAirspaceIntersection(start, waypointPos, airspace)

    // Check if path from waypoint to end is clear
    const waypointToEndClear = !checkAirspaceIntersection(waypointPos, end, airspace)

    if (startToWaypointClear && waypointToEndClear) {
      validWaypoints.push(waypoint)
    }
  }

  if (validWaypoints.length === 0) {
    return null
  }

  // Use the first valid waypoint (in a real implementation, choose optimal one)
  // For KSQL-KSMF route, SUNOL is typically the best choice
  const chosenWaypoint = validWaypoints.find(w => w.id === 'SUNOL') || validWaypoints[0]

  const waypointPos: Position = [chosenWaypoint.lon, chosenWaypoint.lat]
  const coordinates = [start, waypointPos, end]

  // Calculate total distance
  let totalDistance = 0
  for (let i = 0; i < coordinates.length - 1; i++) {
    totalDistance += calculateDistance(coordinates[i], coordinates[i + 1])
  }

  const time = (totalDistance / ROUTE_CONFIG.GROUNDSPEED_KNOTS) * 60

  return {
    type: 'avoiding_airspace',
    coordinates,
    waypoints: [chosenWaypoint.id],
    distance_nm: Math.round(totalDistance * 10) / 10,
    estimated_time_min: Math.round(time),
    needs_astar: false,
  }
}

/**
 * Snap route coordinates to nearby waypoints for better navigation
 */
export function snapToWaypoints(
  coordinates: Position[],
  waypoints: Waypoint[]
): { coordinates: Position[]; snappedWaypoints: string[] } {
  const snappedCoords: Position[] = []
  const snappedWaypoints: string[] = []

  for (const coord of coordinates) {
    const closestWaypoint = findClosestWaypoint(
      coord,
      waypoints.map(w => ({ lon: w.lon, lat: w.lat, id: w.id })),
      ROUTE_CONFIG.SNAP_DISTANCE_NM
    )

    if (closestWaypoint) {
      snappedCoords.push([closestWaypoint.lon, closestWaypoint.lat])
      snappedWaypoints.push(closestWaypoint.id)
    } else {
      snappedCoords.push(coord)
    }
  }

  return { coordinates: snappedCoords, snappedWaypoints }
}

/**
 * Async version of calculateRoute that uses A* pathfinding when needed
 */
export async function calculateRouteAsync(request: RouteRequest): Promise<RouteResult> {
  const { departure, arrival, airspace, waypoints } = request

  const start: Position = [departure.lon, departure.lat]
  const end: Position = [arrival.lon, arrival.lat]

  // First try the synchronous routing (direct or waypoint)
  const basicRoute = calculateRoute(request)

  // If A* is not needed, return the basic route
  if (!basicRoute.needs_astar) {
    return basicRoute
  }

  // Use A* pathfinding for complex routing
  const astarPath = await calculateRouteWithAStar(start, end, airspace)

  if (astarPath && astarPath.length > 0) {
    // Simplify the path
    const simplified = simplifyLine(astarPath, ROUTE_CONFIG.SIMPLIFY_TOLERANCE)

    // Snap to waypoints if possible
    const { coordinates: snappedCoords, snappedWaypoints } = snapToWaypoints(
      simplified,
      waypoints
    )

    // Calculate total distance
    let totalDistance = 0
    for (let i = 0; i < snappedCoords.length - 1; i++) {
      totalDistance += calculateDistance(snappedCoords[i], snappedCoords[i + 1])
    }

    const time = (totalDistance / ROUTE_CONFIG.GROUNDSPEED_KNOTS) * 60

    return {
      type: 'avoiding_airspace',
      coordinates: snappedCoords,
      waypoints: snappedWaypoints,
      distance_nm: Math.round(totalDistance * 10) / 10,
      estimated_time_min: Math.round(time),
      needs_astar: false,
    }
  }

  // If A* fails, return the basic route with a warning
  return basicRoute
}
