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
export function getClusterRadiusNM(zoom: number): number {
  if (zoom >= 9) return 0        // Show all (1:500,000 scale ~ 50nm view)
  if (zoom >= 7) return 10       // Regional (1:1,000,000 scale ~ 200nm view)
  if (zoom >= 5) return 25       // State level (1:2,000,000 scale ~ 500nm view)
  if (zoom >= 3) return 50       // Multi-state (1:4,000,000 scale ~ 1000nm view)
  return 100                     // National (1:8,000,000+ scale ~ 2000nm+ view)
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
  points.forEach(point => {
    if (processed.has(point.id)) return

    // Start new cluster with this point
    const cluster: T[] = [point]
    processed.add(point.id)

    // Find nearby points to add to cluster
    points.forEach(other => {
      if (processed.has(other.id)) return

      const dist = distanceNM(point.lat, point.lon, other.lat, other.lon)
      if (dist <= radiusNM) {
        cluster.push(other)
        processed.add(other.id)
      }
    })

    // Calculate cluster center (average position)
    const centerLat = cluster.reduce((sum, pt) => sum + pt.lat, 0) / cluster.length
    const centerLon = cluster.reduce((sum, pt) => sum + pt.lon, 0) / cluster.length

    clusters.push({
      id: cluster.length === 1 ? cluster[0].id : `cluster_${clusters.length}`,
      lat: centerLat,
      lon: centerLon,
      points: cluster,
      isCluster: cluster.length > 1,
    })
  })

  return clusters
}

/**
 * Cluster waypoints based on proximity
 * All waypoints cluster together regardless of type (blue clusters)
 */
export function clusterWaypoints(waypoints: Waypoint[], radiusNM: number): WaypointCluster[] {
  return clusterPoints(waypoints, radiusNM).map(cluster => ({
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
