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

interface Node {
  id: NodeId
  kind: NodeKind
  pos: Position
  wpId?: string // only for kind 'wp'
}

export interface RouteResult {
  type: 'direct' | 'avoiding_airspace'
  coordinates: Position[]
  waypoints: string[]
  distance_nm: number
  estimated_time_min: number
  // Track segment status for UI
  segments?: {
    start: Position
    end: Position
    distance: number
    exceedsLimit: boolean
  }[]
}

export interface RouteRequest {
  departure: Airport
  arrival: Airport
  airspace: AirspaceFeatureCollection
  waypoints: Waypoint[]
  maxSegmentLength?: number
}

/** --- Helper Math --- */
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n))
}

const R_EARTH_M = 6371000
const NM_TO_M = 1852

function toRad(d: number) { return (d * Math.PI) / 180 }
function toDeg(r: number) { return (r * 180) / Math.PI }

function greatCircleInterpolate(a: Position, b: Position, t: number): Position {
  const [lon1, lat1] = a.map(toRad) as [number, number]
  const [lon2, lat2] = b.map(toRad) as [number, number]

  const sinLat1 = Math.sin(lat1), cosLat1 = Math.cos(lat1)
  const sinLat2 = Math.sin(lat2), cosLat2 = Math.cos(lat2)

  const dLon = lon2 - lon1
  const cosD = sinLat1 * sinLat2 + cosLat1 * cosLat2 * Math.cos(dLon)
  const d = Math.acos(clamp(cosD, -1, 1))

  if (d === 0) return a

  const A = Math.sin((1 - t) * d) / Math.sin(d)
  const B = Math.sin(t * d) / Math.sin(d)

  const x = A * cosLat1 * Math.cos(lon1) + B * cosLat2 * Math.cos(lon2)
  const y = A * cosLat1 * Math.sin(lon1) + B * cosLat2 * Math.sin(lon2)
  const z = A * sinLat1 + B * sinLat2

  const lat = Math.atan2(z, Math.sqrt(x * x + y * y))
  const lon = Math.atan2(y, x)

  return [toDeg(lon), toDeg(lat)]
}

function initialBearingDeg(a: Position, b: Position): number {
  const [lon1, lat1] = a.map(toRad) as [number, number]
  const [lon2, lat2] = b.map(toRad) as [number, number]
  const dLon = lon2 - lon1

  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  const brng = Math.atan2(y, x)
  return (toDeg(brng) + 360) % 360
}

function destinationPoint(a: Position, bearingDeg: number, distNm: number): Position {
  const distM = distNm * NM_TO_M
  const brng = toRad(bearingDeg)

  const [lon1, lat1] = a.map(toRad) as [number, number]
  const angDist = distM / R_EARTH_M

  const sinLat1 = Math.sin(lat1), cosLat1 = Math.cos(lat1)
  const sinAng = Math.sin(angDist), cosAng = Math.cos(angDist)

  const sinLat2 = sinLat1 * cosAng + cosLat1 * sinAng * Math.cos(brng)
  const lat2 = Math.asin(clamp(sinLat2, -1, 1))

  const y = Math.sin(brng) * sinAng * cosLat1
  const x = cosAng - sinLat1 * Math.sin(lat2)
  const lon2 = lon1 + Math.atan2(y, x)

  return [((toDeg(lon2) + 540) % 360) - 180, toDeg(lat2)]
}

/** --- Simple spatial hash index (fast neighbor queries) --- */
class SpatialHash {
  private cellSizeDeg: number
  private buckets = new Map<string, number[]>()

  constructor(private nodes: Node[], maxSegNm: number) {
    // 1 deg lat ~ 60 nm, choose slightly smaller than max to keep bucket sizes sane
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

  queryRadius(center: Position, radiusNm: number, hardLimit = 400): number[] {
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

/** --- Min-heap for A* --- */
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
  get size() { return this.a.length }
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

/** --- A* core (implicit graph) --- */
interface AStarOptions {
  maxSegNm: number
  corridorNm: number
  maxExpansions: number
  deviationPenalty: number // keep route near reference line
  coneHalfAngle: number // +/- degrees relative to destination bearing
}

function getAngleDiff(a: number, b: number) {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

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

  const gScore = new Map<NodeId, number>([[startId, 0]])
  const cameFrom = new Map<NodeId, NodeId>()

  // cache expensive segment checks
  const segOK = new Map<string, boolean>()
  const segKey = (a: NodeId, b: NodeId) => (a < b ? `${a}|${b}` : `${b}|${a}`)

  const h = (n: Node) => calculateDistance(n.pos, goal.pos) // admissible
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

    if (currentId === endId) {
      // reconstruct
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
    const neighborIdxs = spatial.queryRadius(current.pos, opts.maxSegNm, 400)

    for (const idx of neighborIdxs) {
      const nb = nodes[idx]
      if (nb.id === currentId) continue
      if (closed.has(nb.id)) continue

      // 1. Airspace Point Check
      if (isPointInAirspace(nb.pos, airspace)) continue

      // 2. Directional Cone Optimization
      // Don't apply to Start/End nodes to ensure we can initially move and finally connect
      if (nb.kind !== 'start' && nb.kind !== 'end') {
        // Check if neighbor is roughly in the direction of the final goal
        // Calculate bearing from Current -> Goal
        const bearingToGoal = calculateBearing(current.pos, goal.pos)

        // Calculate bearing from Current -> Neighbor
        const bearingToNb = calculateBearing(current.pos, nb.pos)

        // If angle diff exceeds cone, skip
        const diff = getAngleDiff(bearingToGoal, bearingToNb)
        if (diff > opts.coneHalfAngle) continue

        // Also apply Corridor constraint (distance from direct line)
        const dev = calculateDistanceFromLine(nb.pos, start.pos, goal.pos)
        if (dev > opts.corridorNm) continue
      }

      // 3. Max Segment Length Check
      const d = calculateDistance(current.pos, nb.pos)
      if (d > opts.maxSegNm) continue

      // 4. Airspace Line Check (Cached)
      const k = segKey(currentId, nb.id)
      let ok = segOK.get(k)
      if (ok === undefined) {
        ok = !checkAirspaceIntersection(current.pos, nb.pos, airspace)
        segOK.set(k, ok)
      }
      if (!ok) continue

      // cost: distance + deviation penalty (keeps route sane)
      const dev = calculateDistanceFromLine(nb.pos, start.pos, goal.pos)
      const tentative = (gScore.get(currentId) ?? Infinity) + d + opts.deviationPenalty * dev

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
export async function calculateRouteAsync(request: RouteRequest): Promise<RouteResult> {
  const { departure, arrival, airspace, waypoints, maxSegmentLength } = request

  // Default max leg length if not provided. Use large value if unspecified.
  const MAX_SEG = maxSegmentLength || 10000

  const startPos: Position = [departure.lon, departure.lat]
  const endPos: Position = [arrival.lon, arrival.lat]

  if (isPointInAirspace(startPos, airspace)) {
    throw new Error('Departure airport is located inside restricted airspace. Unable to plan departure.')
  }
  if (isPointInAirspace(endPos, airspace)) {
    throw new Error('Arrival airport is located inside restricted airspace. Unable to plan arrival.')
  }

  // 0) Direct if possible
  const directDist = calculateDistance(startPos, endPos)
  const isDirectLengthOK = !maxSegmentLength || directDist <= maxSegmentLength

  if (isDirectLengthOK && !checkAirspaceIntersection(startPos, endPos, airspace)) {
    const totalDistance = directDist
    const estimatedTime = (totalDistance / ROUTE_CONFIG.GROUNDSPEED_KNOTS) * 60
    return {
      type: 'direct',
      coordinates: [startPos, endPos],
      waypoints: [],
      distance_nm: Math.round(totalDistance * 10) / 10,
      estimated_time_min: Math.round(estimatedTime),
      segments: [{
        start: startPos,
        end: endPos,
        distance: Math.round(totalDistance * 10) / 10,
        exceedsLimit: false
      }]
    }
  }

  // 1) Build graph nodes (Only real waypoints + start/end)
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

  // 2) Configure Cone & Corridor
  // "More route distance = less degrees"
  // Example: 100nm -> 60deg, 1000nm -> 20deg
  // Linear scale: Clamp inputs
  const coneHalfAngle = clamp(90 - (directDist / 20), 20, 90)

  const corridorBase = clamp(MAX_SEG * 2, 50, 400)
  const corridorAttempts = [corridorBase, corridorBase * 3]

  let pathIds: string[] | null = null

  // Try with cone constraint
  for (const corridorNm of corridorAttempts) {
    pathIds = aStarRoute(nodes, 'start', 'end', airspace, {
      maxSegNm: MAX_SEG,
      corridorNm,
      maxExpansions: 5000,
      deviationPenalty: 0.1,
      coneHalfAngle
    })
    if (pathIds) break
  }

  // Fallback: If strict cone search failed, try opening up the cone (widen search)
  // This honors the "optimization" request but ensures robustness
  if (!pathIds) {
    // Retry with 180 degrees (no cone check effectively)
    pathIds = aStarRoute(nodes, 'start', 'end', airspace, {
      maxSegNm: MAX_SEG,
      corridorNm: corridorBase * 5,
      maxExpansions: 8000,
      deviationPenalty: 0.1,
      coneHalfAngle: 180
    })
  }

  if (!pathIds) {
    throw new Error(
      `No legal route found within max leg ${MAX_SEG}nm. ` +
      `Try adding waypoints or increasing max leg length.`
    )
  }

  // 3) Reconstruct
  const byId = new Map(nodes.map(n => [n.id, n]))
  const routeCoordinates: Position[] = pathIds.map(id => byId.get(id)!.pos)

  const routeWaypoints: string[] = pathIds
    .map(id => byId.get(id)!)
    .filter(n => n.kind === 'wp')
    .map(n => n.wpId!)

  // Build segments
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
}
