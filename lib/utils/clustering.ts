/**
 * Map Point Clustering Utilities
 * Implements zoom-based clustering for aviation map features using standard parameters
 */

import { Waypoint, Airport } from '@/lib/geojson'

/**
 * Calculate distance between two coordinates in nautical miles
 */
function distanceNM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065 // Earth radius in nautical miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Get clustering radius based on zoom level (aviation standard)
 * Based on typical VFR sectional chart scales and pilot visibility expectations
 */
// ... (imports remain)

/**
 * Get clustering radius based on zoom level (aviation standard)
 * Optimized for better visual decluttering at lower zoom levels
 */
export function getClusterRadiusNM(zoom: number): number {
  if (zoom >= 12) return 0       // Show all details (very high zoom)
  if (zoom >= 10) return 5       // Terminal area (high zoom)
  if (zoom >= 8) return 20       // Approach/Departure (medium-high)
  if (zoom >= 6) return 50       // Enroute Low (medium)
  if (zoom >= 4) return 100      // Enroute High (medium-low)
  if (zoom >= 3) return 200      // Regional (low)
  return 400                     // Global (very low)
}

export interface WaypointCluster {
  id: string
  lat: number
  lon: number
  waypoints: Waypoint[]
  isCluster: boolean
}

export interface AirportCluster {
  id: string
  lat: number
  lon: number
  airports: Airport[]
  isCluster: boolean
}

/**
 * Generic clustering interface for any map point
 */
interface ClusterablePoint {
  id: string
  lat: number
  lon: number
}

/**
 * Generic clustering function
 * Uses a greedy approach: pick a point, find all neighbors within radius, form cluster.
 */
function clusterPoints<T extends ClusterablePoint>(
  points: T[],
  radiusNM: number,
  excludeIds: Set<string> = new Set()
): { id: string; lat: number; lon: number; points: T[]; isCluster: boolean }[] {
  // If radius is 0, no clustering - return all points individually
  if (radiusNM === 0) {
    return points.map(pt => ({
      id: pt.id,
      lat: pt.lat,
      lon: pt.lon,
      points: [pt],
      isCluster: false,
    }))
  }

  const clusters: { id: string; lat: number; lon: number; points: T[]; isCluster: boolean }[] = []
  const processed = new Set<string>()

  // First, add excluded points as individual clusters
  points.forEach(point => {
    if (excludeIds.has(point.id)) {
      clusters.push({
        id: point.id,
        lat: point.lat,
        lon: point.lon,
        points: [point],
        isCluster: false,
      })
      processed.add(point.id)
    }
  })

  // Then cluster remaining points
  // We iterate through points in order. The first available point becomes the "seed" for the cluster.
  for (let i = 0; i < points.length; i++) {
    const point = points[i]
    if (processed.has(point.id)) continue

    // Start new cluster with this point
    const cluster: T[] = [point]
    processed.add(point.id)

    // Find nearby points to add to cluster
    // Optimization: Only check points that haven't been processed yet
    for (let j = i + 1; j < points.length; j++) {
      const other = points[j]
      if (processed.has(other.id)) continue

      const dist = distanceNM(point.lat, point.lon, other.lat, other.lon)
      if (dist <= radiusNM) {
        cluster.push(other)
        processed.add(other.id)
      }
    }

    // Use the seed point's location as the cluster center
    // This prevents the cluster from "drifting" as points are added/removed or zoom changes slightly
    // It also ensures that if we prioritize important waypoints (by sorting inputs), the cluster sits on the important one
    clusters.push({
      id: cluster.length === 1 ? cluster[0].id : `cluster_${point.id}_${cluster.length}`,
      lat: point.lat,
      lon: point.lon,
      points: cluster,
      isCluster: cluster.length > 1,
    })
  }

  return clusters
}

/**
 * Cluster waypoints based on proximity
 * Sorts waypoints by priority (VOR > others) before clustering so VORs become cluster centers
 */
export function clusterWaypoints(waypoints: Waypoint[], radiusNM: number): WaypointCluster[] {
  // Sort waypoints so important ones are processed first (become seeds)
  const sortedWaypoints = [...waypoints].sort((a, b) => {
    const aIsVor = a.type === 'VOR' || a.type === 'VORTAC'
    const bIsVor = b.type === 'VOR' || b.type === 'VORTAC'
    if (aIsVor && !bIsVor) return -1
    if (!aIsVor && bIsVor) return 1
    return 0
  })

  return clusterPoints(sortedWaypoints, radiusNM).map(cluster => ({
    ...cluster,
    waypoints: cluster.points,
  }))
}

/**
 * Cluster airports based on proximity
 * Excludes specific airports (e.g., departure/destination) from clustering
 */
export function clusterAirports(
  airports: Airport[],
  radiusNM: number,
  excludeIds: string[] = []
): AirportCluster[] {
  const excludeSet = new Set(excludeIds)
  return clusterPoints(airports, radiusNM, excludeSet).map(cluster => ({
    ...cluster,
    airports: cluster.points,
  }))
}

/**
 * Sort clusters by priority:
 * 1. Individual waypoints first (more important)
 * 2. Smaller clusters before larger ones
 * 3. VOR/VORTAC before GPS fixes
 */
export function sortClustersByPriority(clusters: WaypointCluster[]): WaypointCluster[] {
  return clusters.sort((a, b) => {
    // Individual waypoints first
    if (!a.isCluster && b.isCluster) return -1
    if (a.isCluster && !b.isCluster) return 1

    // If both clusters, smaller first
    if (a.isCluster && b.isCluster) {
      return a.waypoints.length - b.waypoints.length
    }

    // If both individual, prioritize VOR/VORTAC
    const aType = a.waypoints[0].type
    const bType = b.waypoints[0].type
    const aPriority = (aType === 'VOR' || aType === 'VORTAC') ? 0 : 1
    const bPriority = (bType === 'VOR' || bType === 'VORTAC') ? 0 : 1
    return aPriority - bPriority
  })
}
