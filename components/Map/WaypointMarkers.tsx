'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { Waypoint } from '@/lib/geojson'
import { COLORS } from '@/lib/constants'
import { clusterWaypoints, getClusterRadiusNM, WaypointCluster } from '@/lib/utils/clustering'

interface WaypointMarkersProps {
  map: mapboxgl.Map
  waypoints: Waypoint[]
}

// Base marker styles (color will be set per waypoint type)
const BASE_MARKER_STYLES = {
  width: '14px',
  height: '14px',
  borderRadius: '2px', // Square with slight roundness
  transform: 'rotate(45deg)', // Diamond shape
  cursor: 'pointer',
  border: '1px solid white',
  boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
}

// Get marker color based on waypoint type
// Memoize this function to avoid repeated lookups
const getWaypointColor = (type: Waypoint['type']): string => {
  // VOR and VORTAC are red
  if (type === 'VOR' || type === 'VORTAC') {
    return COLORS.VOR_MARKER // Red
  }
  // AIRPORT type should be green (but airports should use AirportMarkers, not WaypointMarkers)
  // This is a fallback in case airports accidentally get into waypoints
  if (type === 'AIRPORT') {
    return COLORS.AIRPORT_MARKER // Green
  }
  // Everything else (GPS_FIX, NDB, INTERSECTION) is blue
  return COLORS.OTHER_WAYPOINT_MARKER // Blue
}

// Pre-compile regex patterns for performance (outside component)
const MONGO_ID_REGEX = /^[a-f0-9]{24}$/i
const ICAO_REGEX = /^[A-Z0-9]{3,5}$/i

// Cache for ID type detection (memoization)
const idTypeCache = new Map<string, { isMongoId: boolean; isICAO: boolean }>()

// Memoize ID type detection to avoid repeated regex tests
const detectIdType = (id: string): { isMongoId: boolean; isICAO: boolean } => {
  // Check cache first
  if (idTypeCache.has(id)) {
    return idTypeCache.get(id)!
  }
  
  // Compute and cache
  const isMongoId = id.length === 24 && MONGO_ID_REGEX.test(id)
  const isICAO = ICAO_REGEX.test(id)
  const result = { isMongoId, isICAO }
  idTypeCache.set(id, result)
  
  // Limit cache size to prevent memory leaks (keep last 1000)
  if (idTypeCache.size > 1000) {
    const firstEntry = idTypeCache.entries().next().value
    if (firstEntry) {
      idTypeCache.delete(firstEntry[0])
    }
  }
  
  return result
}

// Cluster marker styles - always blue
const CLUSTER_MARKER_STYLES = {
  minWidth: '24px',
  height: '24px',
  borderRadius: '50%', // Circle for clusters
  cursor: 'pointer',
  backgroundColor: COLORS.OTHER_WAYPOINT_MARKER, // Always blue for all clusters
  border: '2px solid white',
  boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'white',
  fontWeight: 'bold',
  fontSize: '11px',
  padding: '0 6px',
}

// Base label styles (color will be set per waypoint type)
const BASE_LABEL_STYLES = {
  position: 'absolute',
  fontWeight: '600',
  fontSize: '10px',
  textShadow: '1px 1px 0px white, -1px -1px 0px white, 1px -1px 0px white, -1px 1px 0px white',
  left: '50%',
  top: '18px', // Below the marker
  transform: 'translateX(-50%)', // Center horizontally
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  display: 'none',
  opacity: '0',
  transition: 'opacity 0.2s ease',
}

export default function WaypointMarkers({ map, waypoints }: WaypointMarkersProps) {
  // Use a ref to track markers for cleanup, independent of render cycle
  const markersRef = useRef<mapboxgl.Marker[]>([])

  // Track current zoom level to trigger re-clustering
  const [zoom, setZoom] = useState<number>(9)

  useEffect(() => {
    // Basic validation
    if (!map || waypoints.length === 0) return
    if (!map.getCanvasContainer()) return

    // Get current zoom level
    const currentZoom = map.getZoom()
    setZoom(currentZoom)

    // Set up zoom event listener for re-clustering
    const handleZoomEnd = () => {
      const newZoom = map.getZoom()
      setZoom(newZoom)
    }

    map.on('zoomend', handleZoomEnd)

    return () => {
      map.off('zoomend', handleZoomEnd)
    }
  }, [map])

  useEffect(() => {
    // Basic validation
    if (!map || waypoints.length === 0) return
    if (!map.getCanvasContainer()) return

    // Cleanup existing markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    // Filter out AIRPORT type waypoints - they're rendered by AirportMarkers component
    // This prevents duplicate/conflicting markers and color switching issues
    const navWaypoints = waypoints.filter(wp => wp.type !== 'AIRPORT')

    if (navWaypoints.length === 0) {
      console.log('⚠️ No navigation waypoints to display (all filtered out as AIRPORT type)')
      return
    }

    console.log(`📍 Rendering ${navWaypoints.length} navigation waypoints at zoom ${zoom.toFixed(1)}`)

    // Apply clustering based on zoom level
    const radiusNM = getClusterRadiusNM(zoom)
    const clusters = clusterWaypoints(navWaypoints, radiusNM)

    if (zoom < 9 && clusters.length < navWaypoints.length) {
      const vorCount = navWaypoints.filter(w => w.type === 'VOR' || w.type === 'VORTAC').length
      const otherCount = navWaypoints.length - vorCount
      console.log(`🔵 Clustering waypoints at zoom ${zoom.toFixed(1)}: ${navWaypoints.length} → ${clusters.length} (${radiusNM}nm radius) [VOR: ${vorCount}, Other: ${otherCount}]`)
    }

    const createIndividualMarkerElement = (waypoint: Waypoint) => {
      const el = document.createElement('div')
      el.className = 'waypoint-marker'

      // Apply base styles
      Object.assign(el.style, BASE_MARKER_STYLES)

      // Set color based on waypoint type
      el.style.backgroundColor = getWaypointColor(waypoint.type)

      // Hover Interaction - ALL labels show on hover only
      const labelEl = document.createElement('div')
      labelEl.className = 'waypoint-label'

      // Detect ID type (memoized regex for performance)
      const { isMongoId, isICAO } = detectIdType(waypoint.id)

      // Determine label text (optimized logic)
      let labelText: string
      if (isMongoId) {
        labelText = waypoint.name // Use name instead of ugly MongoDB ID
      } else if (waypoint.type === 'AIRPORT' && isICAO) {
        labelText = waypoint.id // Show ICAO code for airports
      } else {
        labelText = waypoint.name // Show name for everything else
      }
      labelEl.textContent = labelText
      Object.assign(labelEl.style, BASE_LABEL_STYLES)
      // Set label color to match marker color
      labelEl.style.color = getWaypointColor(waypoint.type)
      el.appendChild(labelEl)

      // Show on hover for all waypoints (including airports)
      el.addEventListener('mouseenter', () => {
        labelEl.style.display = 'block'
        requestAnimationFrame(() => {
          labelEl.style.opacity = '1'
        })
      })

      el.addEventListener('mouseleave', () => {
        labelEl.style.opacity = '0'
        setTimeout(() => {
          if (labelEl.style.opacity === '0') {
            labelEl.style.display = 'none'
          }
        }, 200)
      })

      return el
    }

    const createClusterMarkerElement = (cluster: WaypointCluster) => {
      const el = document.createElement('div')
      el.className = 'waypoint-cluster-marker'
      el.textContent = cluster.waypoints.length.toString()

      // Apply cluster styles (always blue)
      Object.assign(el.style, CLUSTER_MARKER_STYLES)

      return el
    }

    const individualPopupHTML = (w: Waypoint) => {
      const color = getWaypointColor(w.type)
      const { isMongoId, isICAO } = detectIdType(w.id)

      // Only show ID if it's a valid ICAO code, otherwise skip it
      const showId = isICAO && !isMongoId

      return `
        <div style="padding: 4px; font-family: sans-serif;">
          ${showId ? `<strong style="color: ${color}">${w.id}</strong><br/>` : ''}
          <strong style="color: ${color}; ${showId ? 'font-size: 11px;' : ''}">${w.name}</strong><br/>
          <span style="font-size: 10px; color: #666;">
            Type: ${w.type}<br/>
            ${w.frequency ? `Freq: ${w.frequency}<br/>` : ''}
          </span>
        </div>
      `
    }

    const clusterPopupHTML = (cluster: WaypointCluster) => {
      const waypointList = cluster.waypoints
        .slice(0, 10) // Limit to first 10
        .map(w => {
          const color = getWaypointColor(w.type)
          const { isMongoId, isICAO } = detectIdType(w.id)
          const displayText = (isICAO && !isMongoId) ? `${w.id} - ${w.name}` : w.name
          return `<li style="font-size: 10px;"><span style="color: ${color};">${displayText}</span></li>`
        })
        .join('')

      const hasMore = cluster.waypoints.length > 10

      return `
        <div style="padding: 6px; font-family: sans-serif;">
          <strong style="color: ${COLORS.OTHER_WAYPOINT_MARKER};">${cluster.waypoints.length} Waypoints</strong><br/>
          <span style="font-size: 10px; color: #666;">Zoom in to see details</span><br/>
          <ul style="margin: 4px 0 0 0; padding-left: 16px;">
            ${waypointList}
            ${hasMore ? `<li style="font-size: 10px; color: #999;">...and ${cluster.waypoints.length - 10} more</li>` : ''}
          </ul>
        </div>
      `
    }

    // Batch creation
    const newMarkers: mapboxgl.Marker[] = []

    clusters.forEach(cluster => {
      let el: HTMLElement
      let popup: mapboxgl.Popup

      if (cluster.isCluster) {
        // Create cluster marker
        el = createClusterMarkerElement(cluster)
        popup = new mapboxgl.Popup({
          offset: 15,
          closeButton: false,
          maxWidth: '250px',
        }).setHTML(clusterPopupHTML(cluster))
      } else {
        // Create individual marker
        el = createIndividualMarkerElement(cluster.waypoints[0])
        popup = new mapboxgl.Popup({
          offset: 12,
          closeButton: false,
        }).setHTML(individualPopupHTML(cluster.waypoints[0]))
      }

      const marker = new mapboxgl.Marker(el)
        .setLngLat([cluster.lon, cluster.lat])
        .setPopup(popup)
        .addTo(map)

      newMarkers.push(marker)
    })

    markersRef.current = newMarkers

    // Cleanup function
    return () => {
      markersRef.current.forEach(marker => marker.remove())
      markersRef.current = []
    }
  }, [map, waypoints, zoom]) // Keep waypoints in deps - filtering happens inside

  return null
}
