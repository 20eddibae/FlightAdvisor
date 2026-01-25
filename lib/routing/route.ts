import { Position } from 'geojson'
import { Airport, Waypoint, AirspaceFeatureCollection } from '../geojson'
import {
  checkAirspaceIntersection,
  calculateDistance,
  calculateDistanceFromLine,
  isPointInAirspace,
  calculateBearing
} from '../geometry'
import { ROUTE_CONFIG } from '../constants'

/** --- Types & Interfaces --- */

type NodeKind = 'start' | 'end' | 'wp'
type NodeId = string

/**
 * Represents a node in the routing graph.
 */
interface Node {
  id: NodeId
  kind: NodeKind
  pos: Position
  wpId?: string // only for kind 'wp'
}

/**
 * Standard route result interface expected by the UI.
 */
export interface RouteResult {
  type: 'direct' | 'avoiding_airspace'
  coordinates: Position[]
  waypoints: string[]
  distance_nm: number
  estimated_time_min: number
  segments?: {
    start: Position
    end: Position
    distance: number
    exceedsLimit: boolean
  }[]
}

/**
 * Input request for route calculation.
 */
export interface RouteRequest {
  departure: Airport
  arrival: Airport
  airspace: AirspaceFeatureCollection
  waypoints: Waypoint[]
  maxSegmentLength?: number
}

/** --- Helper Math & Geometry --- */

const R_EARTH_M = 6371000
const NM_TO_M = 1852

function toRad(d: number) { return (d * Math.PI) / 180 }
function toDeg(r: number) { return (r * 180) / Math.PI }

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n))
}

function getAngleDiff(a: number, b: number) {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

/** --- Spatial Indexing --- */

/**
 * Simple spatial hash for fast neighbor lookups.
 * Buckets nodes into grid cells defined by `cellSizeDeg`.
 */
class SpatialHash {
  private cellSizeDeg: number
  private buckets = new Map<string, number[]>()

  constructor(private nodes: Node[], maxSegNm: number) {
    // 1 deg lat ~ 60 nm. Choose cell size slightly smaller than max segment 
    // to ensure we only check relevant buckets, but not too small to fragment.
    const cell = isFinite(maxSegNm) ? clamp((maxSegNm / 60) * 0.9, 0.2, 5) : 2
    this.cellSizeDeg = cell

    nodes.forEach((n, idx) => {
      const key = this.keyFor(n.pos)
      const arr = this.buckets.get(key)
      if (arr) arr.push(idx)
      else this.buckets.set(key, [idx])
    })
  }

  private keyFor(p: Position) {
    const [lon, lat] = p
    const x = Math.floor((lon + 180) / this.cellSizeDeg)
    const y = Math.floor((lat + 90) / this.cellSizeDeg)
    return `${x},${y}`
  }

  queryRadius(center: Position, radiusNm: number, hardLimit = 10000): number[] {
    const [lon, lat] = center
    const rDeg = radiusNm / 60
    const minLon = lon - rDeg, maxLon = lon + rDeg
    const minLat = lat - rDeg, maxLat = lat + rDeg

    const x0 = Math.floor((minLon + 180) / this.cellSizeDeg)
    const x1 = Math.floor((maxLon + 180) / this.cellSizeDeg)
    const y0 = Math.floor((minLat + 90) / this.cellSizeDeg)
    const y1 = Math.floor((maxLat + 90) / this.cellSizeDeg)

    const results: number[] = []
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const key = `${x},${y}`
        const bucket = this.buckets.get(key)
        if (!bucket) continue
        for (const idx of bucket) {
          results.push(idx)
          if (results.length >= hardLimit) return results
        }
      }
    }
    return results
  }
}

/** --- Priority Queue (MinHeap) --- */

class MinHeap<T> {
  private a: T[] = []
  constructor(private score: (x: T) => number) { }
  push(x: T) { this.a.push(x); this.bubbleUp(this.a.length - 1) }
  pop(): T | undefined {
    if (this.a.length === 0) return undefined
    const top = this.a[0]
    const end = this.a.pop()!
    if (this.a.length) { this.a[0] = end; this.bubbleDown(0) }
    return top
  }
  get size() { return this.a.length } // Fix: Use size instead of length to match standard
  get length() { return this.a.length }

  private bubbleUp(i: number) {
    const s = this.score
    while (i > 0) {
      const p = (i - 1) >> 1
      if (s(this.a[i]) >= s(this.a[p])) break
        ;[this.a[i], this.a[p]] = [this.a[p], this.a[i]]
      i = p
    }
  }
  private bubbleDown(i: number) {
    const s = this.score
    const n = this.a.length
    while (true) {
      const l = i * 2 + 1
      const r = l + 1
      let m = i
      if (l < n && s(this.a[l]) < s(this.a[m])) m = l
      if (r < n && s(this.a[r]) < s(this.a[m])) m = r
      if (m === i) break
        ;[this.a[i], this.a[m]] = [this.a[m], this.a[i]]
      i = m
    }
  }
}

/** --- A* Pathfinding Logic --- */

interface AStarOptions {
  maxSegNm: number
  corridorNm: number
  maxExpansions: number
  deviationPenalty: number
  coneHalfAngle: number
  // Map of "id1|id2" -> penalty multiplier
  penalizedEdges: Map<string, number>
}

/**
 * A* search to find a path through waypoints.
 * Modified to support penalized edges for finding alternative routes.
 */
function aStarRoute(
  nodes: Node[],
  startId: NodeId,
  endId: NodeId,
  airspace: AirspaceFeatureCollection,
  opts: AStarOptions
): NodeId[] | null {
  const byId = new Map(nodes.map(n => [n.id, n]))
  const start = byId.get(startId)!
  const goal = byId.get(endId)!

  const spatial = new SpatialHash(nodes, opts.maxSegNm)

  // gScore: Cost from start to node
  const gScore = new Map<NodeId, number>([[startId, 0]])
  const cameFrom = new Map<NodeId, NodeId>()

  // Cache expensive geometry checks
  const segOK = new Map<string, boolean>()
  // Helper to generate consistent edge keys
  const segKey = (a: NodeId, b: NodeId) => (a < b ? `${a}|${b}` : `${b}|${a}`)

  // Heuristic: Straight line distance to goal
  const h = (n: Node) => calculateDistance(n.pos, goal.pos)

  // fScore = gScore + h
  const f = (id: NodeId) => (gScore.get(id) ?? Infinity) + h(byId.get(id)!)

  const open = new MinHeap<NodeId>(f)
  open.push(startId)

  const closed = new Set<NodeId>()
  let expansions = 0

  while (open.size > 0 && expansions < opts.maxExpansions) {
    const currentId = open.pop()!
    if (closed.has(currentId)) continue
    closed.add(currentId)
    expansions++

    // Goal reached?
    if (currentId === endId) {
      const path: NodeId[] = [currentId]
      let cur = currentId
      while (cameFrom.has(cur)) {
        cur = cameFrom.get(cur)!
        path.push(cur)
      }
      path.reverse()
      return path
    }

    const current = byId.get(currentId)!
    // Find neighbors within range
    const neighborIdxs = spatial.queryRadius(current.pos, opts.maxSegNm, 400)

    for (const idx of neighborIdxs) {
      const nb = nodes[idx]
      if (nb.id === currentId) continue
      if (closed.has(nb.id)) continue

      // 1. Airspace Point Check (Fastest fail)
      if (isPointInAirspace(nb.pos, airspace)) continue

      // 2. Constraints Check (Direction & Corridor)
      // Skip for Start/End to ensure connectivity
      if (nb.kind !== 'start' && nb.kind !== 'end') {
        const bearingToGoal = calculateBearing(current.pos, goal.pos)
        const bearingToNb = calculateBearing(current.pos, nb.pos)

        // Cone check
        if (getAngleDiff(bearingToGoal, bearingToNb) > opts.coneHalfAngle) continue

        // Corridor check
        const dev = calculateDistanceFromLine(nb.pos, start.pos, goal.pos)
        if (dev > opts.corridorNm) continue
      }

      // 3. Max Segment Length Check
      const d = calculateDistance(current.pos, nb.pos)
      if (d > opts.maxSegNm) continue

      // 4. Airspace Line Check (Most expensive, cached)
      const k = segKey(currentId, nb.id)
      let ok = segOK.get(k)
      if (ok === undefined) {
        ok = !checkAirspaceIntersection(current.pos, nb.pos, airspace)
        segOK.set(k, ok)
      }
      if (!ok) continue

      // COST CALCULATION
      // Base cost = distance
      // Penalty: Edge penalty (from finding previous routes) + Deviation penalty
      const penaltyMult = opts.penalizedEdges.get(k) || 1.0

      const dev = calculateDistanceFromLine(nb.pos, start.pos, goal.pos)

      // Cost function:
      // g(n) = g(current) + (distance * edgePenalty) + (deviation * deviationPenalty)
      const tentative = (gScore.get(currentId) ?? Infinity)
        + (d * penaltyMult)
        + (opts.deviationPenalty * dev)

      if (tentative < (gScore.get(nb.id) ?? Infinity)) {
        cameFrom.set(nb.id, currentId)
        gScore.set(nb.id, tentative)
        open.push(nb.id)
      }
    }
  }

  return null
}

/** --- Main Calculation Function --- */

export async function calculateRouteAsync(request: RouteRequest): Promise<RouteResult[]> {
  const { departure, arrival, airspace, waypoints, maxSegmentLength } = request

  // Prepare start/end
  const startPos: Position = [departure.lon, departure.lat]
  const endPos: Position = [arrival.lon, arrival.lat]

  // Filter airspace: Class B is NOT restricted (traversable), others (Restricted, Prohibited, Default) are restricted.
  // We create a new FeatureCollection containing only the airspace types that should BLOCK the route.
  const restrictedAirspace: AirspaceFeatureCollection = {
    ...airspace,
    features: airspace.features.filter(f => f.properties.type !== 'CLASS_B')
  }

  // Safety checks - use restrictedAirspace instead of airspace
  if (isPointInAirspace(startPos, restrictedAirspace)) {
    throw new Error('Departure airport is located inside restricted airspace. Unable to plan departure.')
  }
  if (isPointInAirspace(endPos, restrictedAirspace)) {
    throw new Error('Arrival airport is located inside restricted airspace. Unable to plan arrival.')
  }

  const MAX_SEG = maxSegmentLength || 10000

  // 0. Check Direct Route First
  // If direct route is valid, it is always the best (shortest) route.
  // The user wants 3 routes, but if direct is possible, others are just zig-zags for no reason.
  // HOWEVER, if the user specifically requested multiple options, we should try to provide them
  // unless they are trivial. But typically "Direct" is just one option.
  // We'll proceed to finding alternatives even if direct is valid, to give options.

  // 1. Prepare Graph Nodes
  const wpNodes: Node[] = waypoints.map(wp => ({
    id: `wp:${wp.id}`,
    kind: 'wp',
    pos: [wp.lon, wp.lat],
    wpId: wp.id
  }))

  const nodes: Node[] = [
    { id: 'start', kind: 'start', pos: startPos },
    ...wpNodes,
    { id: 'end', kind: 'end', pos: endPos }
  ]

  // 2. Find Candidates (Iterative Penalty Method)
  // We want to find up to 50 distinct routes.

  const candidates: { pathIds: string[], distance: number }[] = []
  const uniquePathKeys = new Set<string>()
  const penalizedEdges = new Map<string, number>() // "idA|idB" -> penalty multiplier

  const segKey = (a: NodeId, b: NodeId) => (a < b ? `${a}|${b}` : `${b}|${a}`)

  const corridorBase = clamp(MAX_SEG * 2, 50, 400)

  // Base options
  const baseOpts: AStarOptions = {
    maxSegNm: MAX_SEG,
    corridorNm: corridorBase * 3,
    maxExpansions: 20000,
    deviationPenalty: 0.1,
    coneHalfAngle: 90,
    penalizedEdges: penalizedEdges
  }

  // Loop to find multiple routes
  for (let i = 0; i < 20; i++) {
    // We add slight variations to the parameters to encourage diversity 
    // in case penalties aren't enough or we're stuck in a local optimum.
    const iterationOpts = {
      ...baseOpts,
      deviationPenalty: 0.1 + (i * 0.05), // Slowly increase deviation penalty
      // Vary corridor slightly
      corridorNm: baseOpts.corridorNm * (1 + (i % 5) * 0.2),
      // Add randomness to cone to explore different directions
      coneHalfAngle: 90 + (i % 3 === 0 ? 30 : 0)
    }

    const pathIds = aStarRoute(nodes, 'start', 'end', restrictedAirspace, iterationOpts)

    if (!pathIds) {
      // If we can't find a route even with current penalties, we might have exhausted options
      // or the constraints are too tight.
      // Break early if we have enough.
      if (candidates.length >= 3) break
      continue
    }

    const key = pathIds.join('->')
    if (!uniquePathKeys.has(key)) {
      // New distinct route found!

      // Calculate TRUE distance (without penalties) for the candidate
      const byId = new Map(nodes.map(n => [n.id, n]))
      let dist = 0
      for (let k = 0; k < pathIds.length - 1; k++) {
        dist += calculateDistance(byId.get(pathIds[k])!.pos, byId.get(pathIds[k + 1])!.pos)
      }

      candidates.push({ pathIds, distance: dist })
      uniquePathKeys.add(key)
    }

    // Penalize edges of this path for the next iteration
    // This forces A* to look for a different path next time.
    for (let k = 0; k < pathIds.length - 1; k++) {
      const kKey = segKey(pathIds[k], pathIds[k + 1])
      const currentPenalty = penalizedEdges.get(kKey) || 1.0
      // Increase penalty. 1.2 means 20% more expensive.
      // Accumulating it ensures we really avoid frequently used highways.
      penalizedEdges.set(kKey, currentPenalty * 1.5)
    }
  }

  // 3. Selection
  // Sort candidates by actual distance (ascending)
  candidates.sort((a, b) => a.distance - b.distance)

  // Take top 3
  const topCandidates = candidates.slice(0, 3)

  // If we found NO routes (e.g. all blocked), try a desperate "Emergency" search
  if (topCandidates.length === 0) {
    const fallbackIds = aStarRoute(nodes, 'start', 'end', restrictedAirspace, {
      ...baseOpts,
      corridorNm: 10000,
      deviationPenalty: 0,
      coneHalfAngle: 180,
      penalizedEdges: new Map() // clear penalties
    })
    if (fallbackIds) {
      // Recalculate dist
      const byId = new Map(nodes.map(n => [n.id, n]))
      let dist = 0
      for (let k = 0; k < fallbackIds.length - 1; k++) {
        dist += calculateDistance(byId.get(fallbackIds[k])!.pos, byId.get(fallbackIds[k + 1])!.pos)
      }
      topCandidates.push({ pathIds: fallbackIds, distance: dist })
    }
  }

  // 4. Transform to Result Format
  const byId = new Map(nodes.map(n => [n.id, n]))

  return topCandidates.map(cand => {
    const routeCoordinates = cand.pathIds.map(id => byId.get(id)!.pos)
    const routeWaypoints = cand.pathIds
      .map(id => byId.get(id)!)
      .filter(n => n.kind === 'wp')
      .map(n => n.wpId!)

    const segments: { start: Position; end: Position; distance: number; exceedsLimit: boolean }[] = []
    let totalDistance = 0

    for (let i = 0; i < routeCoordinates.length - 1; i++) {
      const start = routeCoordinates[i]
      const end = routeCoordinates[i + 1]
      const dist = calculateDistance(start, end)
      totalDistance += dist

      segments.push({
        start,
        end,
        distance: Math.round(dist * 10) / 10,
        exceedsLimit: dist > MAX_SEG
      })
    }

    const estimatedTime = (totalDistance / ROUTE_CONFIG.GROUNDSPEED_KNOTS) * 60

    return {
      type: 'avoiding_airspace',
      coordinates: routeCoordinates,
      waypoints: routeWaypoints,
      distance_nm: Math.round(totalDistance * 10) / 10,
      estimated_time_min: Math.round(estimatedTime),
      segments
    }
  })
}
