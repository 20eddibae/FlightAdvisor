import { Position } from 'geojson'
import { Airport, Waypoint, AirspaceFeatureCollection } from '../geojson'
import {
  checkAirspaceIntersection,
  calculateDistance,
  createBoundingBox,
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
}

interface PathNode {
  id: string
  position: Position
  g: number // Cost from start
  h: number // Heuristic cost to end
  f: number // Total cost (g + h)
  parent: PathNode | null
}

/**
 * Calculate a route from departure to arrival airport using A* pathfinding on waypoints
 * Uses iterative deepening on the search radius to optimize performance
 */
export async function calculateRouteAsync(request: RouteRequest): Promise<RouteResult> {
  const { departure, arrival, airspace, waypoints } = request

  const startPos: Position = [departure.lon, departure.lat]
  const endPos: Position = [arrival.lon, arrival.lat]

  // Validation: Check if start or end points are inherently invalid
  if (isPointInAirspace(startPos, airspace)) {
    throw new Error('Departure airport is located inside restricted airspace. Unable to plan departure.')
  }

  if (isPointInAirspace(endPos, airspace)) {
    throw new Error('Arrival airport is located inside restricted airspace. Unable to plan arrival.')
  }

  // Optimization: Iteratively expand the search area
  // We start small (tight to the direct line) for performance and efficiency.
  // If no path is found, we widen the net to allow for larger detours around massive obstacles.
  const searchPaddings = [0.5, 1.0, 1.5, 2.0, 3.0, 5.0]

  for (const padding of searchPaddings) {
    // Filter waypoints to the current bounding box
    const bbox = createBoundingBox(startPos, endPos, padding)
    const relevantWaypoints = waypoints.filter(w =>
      w.lon >= bbox[0] && w.lat >= bbox[1] &&
      w.lon <= bbox[2] && w.lat <= bbox[3]
    )

    const result = findOptimalPath(startPos, endPos, relevantWaypoints, airspace)

    if (result) {
      return result
    }
  }

  // If we exhaust all padding levels and still find no path
  throw new Error('Unable to find a valid route. The restricted airspace may be too large or blocking all paths to the destination.')
}

/**
 * Core A* pathfinding logic
 * Returns null if no path is found
 */
function findOptimalPath(
  startPos: Position,
  endPos: Position,
  waypoints: Waypoint[],
  airspace: AirspaceFeatureCollection
): RouteResult | null {
  // Initialize A* structures
  const openSet: PathNode[] = []
  const closedSet = new Set<string>()
  const nodeMap = new Map<string, PathNode>()

  // Create start node
  const startNode: PathNode = {
    id: 'START',
    position: startPos,
    g: 0,
    h: calculateDistance(startPos, endPos),
    f: calculateDistance(startPos, endPos),
    parent: null
  }

  openSet.push(startNode)
  nodeMap.set('START', startNode)

  const goalId = 'END'

  // Main A* Loop
  while (openSet.length > 0) {
    // Get node with lowest f score
    openSet.sort((a, b) => a.f - b.f)
    const current = openSet.shift()!

    // If we reached the destination
    if (current.id === goalId) {
      return reconstructPath(current)
    }

    closedSet.add(current.id)

    // Identify neighbors: All provided waypoints + End destination
    const potentialNeighbors: Array<{ id: string, position: Position }> = [
      ...waypoints.map(w => ({ id: w.id, position: [w.lon, w.lat] as Position })),
      { id: goalId, position: endPos }
    ]

    for (const neighborData of potentialNeighbors) {
      if (closedSet.has(neighborData.id)) continue
      if (neighborData.id === current.id) continue

      // Check intersection (expensive check)
      const isClear = !checkAirspaceIntersection(
        current.position,
        neighborData.position,
        airspace
      )

      if (!isClear) continue

      // Calculate scores
      const dist = calculateDistance(current.position, neighborData.position)
      const tentativeG = current.g + dist

      let neighborNode = nodeMap.get(neighborData.id)

      if (!neighborNode) {
        neighborNode = {
          id: neighborData.id,
          position: neighborData.position,
          g: Infinity,
          h: calculateDistance(neighborData.position, endPos),
          f: Infinity,
          parent: null
        }
        nodeMap.set(neighborData.id, neighborNode)
      }

      if (tentativeG < neighborNode.g) {
        neighborNode.parent = current
        neighborNode.g = tentativeG
        neighborNode.f = neighborNode.g + neighborNode.h

        if (!openSet.includes(neighborNode)) {
          openSet.push(neighborNode)
        }
      }
    }
  }

  return null
}

function reconstructPath(endNode: PathNode): RouteResult {
  const coordinates: Position[] = []
  const waypoints: string[] = []
  let current: PathNode | null = endNode

  while (current !== null) {
    coordinates.unshift(current.position)
    if (current.id !== 'START' && current.id !== 'END') {
      waypoints.unshift(current.id)
    }
    current = current.parent
  }

  // Recalculate full distance accurately along the path
  let totalDistance = 0
  for (let i = 0; i < coordinates.length - 1; i++) {
    totalDistance += calculateDistance(coordinates[i], coordinates[i + 1])
  }

  const estimatedTime = (totalDistance / ROUTE_CONFIG.GROUNDSPEED_KNOTS) * 60

  return {
    type: waypoints.length > 0 ? 'avoiding_airspace' : 'direct',
    coordinates,
    waypoints,
    distance_nm: Math.round(totalDistance * 10) / 10,
    estimated_time_min: Math.round(estimatedTime),
    needs_astar: false
  }
}
