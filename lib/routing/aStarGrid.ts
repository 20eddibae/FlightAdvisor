import { Position } from 'geojson'
import { AirspaceFeatureCollection } from '../geojson'
import { isPointInAirspace } from '../geometry'
import { GRID_SIZE, ROUTING_TIMEOUT } from '../constants'

interface GridNode {
  x: number
  y: number
  g: number // Cost from start
  h: number // Heuristic cost to end
  f: number // Total cost (g + h)
  parent: GridNode | null
  blocked: boolean
}

/**
 * Create a grid of nodes for A* pathfinding
 */
function createGrid(
  bounds: [number, number, number, number],
  airspace: AirspaceFeatureCollection
): GridNode[][] {
  const [minLon, minLat, maxLon, maxLat] = bounds
  const grid: GridNode[][] = []

  const lonStep = (maxLon - minLon) / GRID_SIZE
  const latStep = (maxLat - minLat) / GRID_SIZE

  for (let i = 0; i < GRID_SIZE; i++) {
    grid[i] = []
    for (let j = 0; j < GRID_SIZE; j++) {
      const lon = minLon + j * lonStep
      const lat = minLat + i * latStep

      // Check if this cell is in restricted airspace
      const point: Position = [lon, lat]
      const blocked = isPointInAirspace(point, airspace)

      grid[i][j] = {
        x: i,
        y: j,
        g: Infinity,
        h: 0,
        f: Infinity,
        parent: null,
        blocked,
      }
    }
  }

  return grid
}

/**
 * Convert lat/lon coordinates to grid coordinates
 */
function coordsToGrid(
  position: Position,
  bounds: [number, number, number, number]
): [number, number] {
  const [minLon, minLat, maxLon, maxLat] = bounds
  const [lon, lat] = position

  const x = Math.floor(((lat - minLat) / (maxLat - minLat)) * GRID_SIZE)
  const y = Math.floor(((lon - minLon) / (maxLon - minLon)) * GRID_SIZE)

  // Clamp to grid bounds
  return [
    Math.max(0, Math.min(GRID_SIZE - 1, x)),
    Math.max(0, Math.min(GRID_SIZE - 1, y)),
  ]
}

/**
 * Convert grid coordinates back to lat/lon
 */
function gridToCoords(
  gridX: number,
  gridY: number,
  bounds: [number, number, number, number]
): Position {
  const [minLon, minLat, maxLon, maxLat] = bounds

  const lat = minLat + (gridX / GRID_SIZE) * (maxLat - minLat)
  const lon = minLon + (gridY / GRID_SIZE) * (maxLon - minLon)

  return [lon, lat]
}

/**
 * Calculate Euclidean distance heuristic
 */
function heuristic(node1: GridNode, node2: GridNode): number {
  const dx = node1.x - node2.x
  const dy = node1.y - node2.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Get neighbors of a node (8-directional movement)
 */
function getNeighbors(node: GridNode, grid: GridNode[][]): GridNode[] {
  const neighbors: GridNode[] = []
  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1],
  ]

  for (const [dx, dy] of directions) {
    const newX = node.x + dx
    const newY = node.y + dy

    if (
      newX >= 0 &&
      newX < GRID_SIZE &&
      newY >= 0 &&
      newY < GRID_SIZE &&
      !grid[newX][newY].blocked
    ) {
      neighbors.push(grid[newX][newY])
    }
  }

  return neighbors
}

/**
 * Reconstruct path from end node to start node
 */
function reconstructPath(
  endNode: GridNode,
  bounds: [number, number, number, number]
): Position[] {
  const path: Position[] = []
  let current: GridNode | null = endNode

  while (current !== null) {
    path.unshift(gridToCoords(current.x, current.y, bounds))
    current = current.parent
  }

  return path
}

/**
 * A* pathfinding algorithm with timeout
 */
export async function findPathAStar(
  start: Position,
  end: Position,
  bounds: [number, number, number, number],
  airspace: AirspaceFeatureCollection
): Promise<Position[] | null> {
  const startTime = Date.now()

  // Create grid
  const grid = createGrid(bounds, airspace)

  // Convert start and end positions to grid coordinates
  const [startX, startY] = coordsToGrid(start, bounds)
  const [endX, endY] = coordsToGrid(end, bounds)

  const startNode = grid[startX][startY]
  const endNode = grid[endX][endY]

  // Check if start or end is blocked
  if (startNode.blocked || endNode.blocked) {
    return null
  }

  // Initialize start node
  startNode.g = 0
  startNode.h = heuristic(startNode, endNode)
  startNode.f = startNode.h

  // Open and closed sets
  const openSet: GridNode[] = [startNode]
  const closedSet = new Set<GridNode>()

  while (openSet.length > 0) {
    // Check timeout
    if (Date.now() - startTime > ROUTING_TIMEOUT) {
      console.warn('A* pathfinding timeout')
      return null
    }

    // Find node with lowest f score
    openSet.sort((a, b) => a.f - b.f)
    const current = openSet.shift()!

    // Check if we reached the end
    if (current === endNode) {
      return reconstructPath(endNode, bounds)
    }

    closedSet.add(current)

    // Check neighbors
    const neighbors = getNeighbors(current, grid)

    for (const neighbor of neighbors) {
      if (closedSet.has(neighbor)) {
        continue
      }

      // Calculate movement cost (diagonal = 1.414, straight = 1)
      const dx = Math.abs(neighbor.x - current.x)
      const dy = Math.abs(neighbor.y - current.y)
      const movementCost = dx + dy === 2 ? 1.414 : 1

      const tentativeG = current.g + movementCost

      if (!openSet.includes(neighbor)) {
        openSet.push(neighbor)
      } else if (tentativeG >= neighbor.g) {
        continue
      }

      // This is a better path
      neighbor.parent = current
      neighbor.g = tentativeG
      neighbor.h = heuristic(neighbor, endNode)
      neighbor.f = neighbor.g + neighbor.h
    }
  }

  // No path found
  return null
}

/**
 * High-level function to calculate route with A* if needed
 */
export async function calculateRouteWithAStar(
  start: Position,
  end: Position,
  airspace: AirspaceFeatureCollection
): Promise<Position[] | null> {
  // Create bounding box with padding
  const minLon = Math.min(start[0], end[0]) - 0.2
  const minLat = Math.min(start[1], end[1]) - 0.2
  const maxLon = Math.max(start[0], end[0]) + 0.2
  const maxLat = Math.max(start[1], end[1]) + 0.2

  const bounds: [number, number, number, number] = [minLon, minLat, maxLon, maxLat]

  try {
    const path = await findPathAStar(start, end, bounds, airspace)
    return path
  } catch (error) {
    console.error('A* pathfinding error:', error)
    return null
  }
}
