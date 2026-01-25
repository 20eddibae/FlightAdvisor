'use client'

import { useEffect, useState, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { Airport } from '@/lib/geojson'
import { COLORS } from '@/lib/constants'
import { clusterAirports, getClusterRadiusNM, AirportCluster } from '@/lib/utils/clustering'

interface AirportMarkersProps {
  map: mapboxgl.Map
  airports: Airport[]
  departureId?: string
  destinationId?: string
}

export default function AirportMarkers({ map, airports, departureId, destinationId }: AirportMarkersProps) {
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const [zoom, setZoom] = useState<number>(9)

  // Track zoom level for re-clustering
  useEffect(() => {
    if (!map) return

    const currentZoom = map.getZoom()
    setZoom(currentZoom)

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
    if (!map || airports.length === 0) return

    // Safety check: ensure map container is available
    if (!map.getCanvasContainer()) return

    // Cleanup existing markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    const markers: mapboxgl.Marker[] = []

    // Apply clustering based on zoom level
    // Never cluster departure/destination airports
    const excludeIds = [departureId, destinationId].filter(Boolean) as string[]
    const radiusNM = getClusterRadiusNM(zoom)
    const clusters = clusterAirports(airports, radiusNM, excludeIds)

    if (zoom < 9 && clusters.length < airports.length) {
      console.log(`✈️  Clustering airports at zoom ${zoom.toFixed(1)}: ${airports.length} → ${clusters.length} (${radiusNM}nm radius)`)
    }

    clusters.forEach((cluster) => {
      if (cluster.isCluster) {
        // Create cluster marker
        const clusterEl = document.createElement('div')
        clusterEl.className = 'airport-cluster-marker'
        clusterEl.textContent = cluster.airports.length.toString()
        clusterEl.style.minWidth = '28px'
        clusterEl.style.height = '28px'
        clusterEl.style.borderRadius = '50%'
        clusterEl.style.cursor = 'pointer'
        clusterEl.style.backgroundColor = COLORS.OTHER_WAYPOINT_MARKER // Blue for all clusters
        clusterEl.style.border = '2px solid white'
        clusterEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.4)'
        clusterEl.style.display = 'flex'
        clusterEl.style.alignItems = 'center'
        clusterEl.style.justifyContent = 'center'
        clusterEl.style.color = 'white'
        clusterEl.style.fontWeight = 'bold'
        clusterEl.style.fontSize = '12px'
        clusterEl.style.padding = '0 6px'

        // Cluster popup showing airport list
        const airportList = cluster.airports
          .slice(0, 10)
          .map(ap => `<li style="font-size: 10px;">${ap.id} - ${ap.name}</li>`)
          .join('')

        const hasMore = cluster.airports.length > 10

        const clusterPopup = new mapboxgl.Popup({
          offset: 18,
          closeButton: false,
          maxWidth: '300px',
        }).setHTML(`
          <div style="padding: 6px; font-family: sans-serif;">
            <strong style="color: ${COLORS.OTHER_WAYPOINT_MARKER};">${cluster.airports.length} Airports</strong><br/>
            <span style="font-size: 10px; color: #666;">Zoom in to see details</span><br/>
            <ul style="margin: 4px 0 0 0; padding-left: 16px;">
              ${airportList}
              ${hasMore ? `<li style="font-size: 10px; color: #999;">...and ${cluster.airports.length - 10} more</li>` : ''}
            </ul>
          </div>
        `)

        const marker = new mapboxgl.Marker(clusterEl)
          .setLngLat([cluster.lon, cluster.lat])
          .setPopup(clusterPopup)
          .addTo(map)

        markers.push(marker)
      } else {
        // Create individual airport marker
        const airport = cluster.airports[0]
        // Create custom marker element
        const el = document.createElement('div')
        el.className = 'airport-marker'
        el.style.width = '16px'
        el.style.height = '16px'
        el.style.borderRadius = '50%'
        el.style.cursor = 'pointer'

        // All airports are green
        el.style.backgroundColor = COLORS.AIRPORT_MARKER // Green
        el.style.border = '2px solid white'
        el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)'

        // Check if this is a major airport (towered)
        const isMajorAirport = airport.type === 'towered'
        const isDeparture = departureId && airport.id === departureId
        const isDestination = destinationId && airport.id === destinationId

        // Create popup with airport information
        const popup = new mapboxgl.Popup({
          offset: 18,
          closeButton: false,
        }).setHTML(`
          <div style="padding: 4px;">
            <strong>${airport.id}</strong><br/>
            ${airport.name}<br/>
            <span style="font-size: 11px; color: #666;">
              Elevation: ${airport.elevation}' MSL<br/>
              ${airport.type === 'towered' ? 'Towered' : 'Non-towered'}<br/>
              ${airport.notes || ''}
            </span>
          </div>
        `)

        // Safety check: ensure map is still valid for marker addition
        if (!map.getCanvasContainer()) return

        const marker = new mapboxgl.Marker(el)
          .setLngLat([airport.lon, airport.lat])
          .setPopup(popup)
          .addTo(map)

        // Create label element - show on hover only
        const labelEl = document.createElement('div')
        labelEl.className = 'airport-label'

        // Detect MongoDB ObjectId and use name instead
        const isMongoId = airport.id.length === 24 && /^[a-f0-9]{24}$/i.test(airport.id)
        const isICAO = /^[A-Z0-9]{3,5}$/i.test(airport.id)

        if (isMongoId) {
          labelEl.textContent = airport.name // Show name for MongoDB IDs
        } else if (isICAO) {
          labelEl.textContent = airport.id // Show ICAO code
        } else {
          labelEl.textContent = airport.name // Fallback to name
        }
        labelEl.style.position = 'absolute'
        labelEl.style.fontWeight = 'bold'
        labelEl.style.fontSize = '10px'
        labelEl.style.color = COLORS.AIRPORT_MARKER // Green
        labelEl.style.textShadow = '1px 1px 2px white, -1px -1px 2px white, 1px -1px 2px white, -1px 1px 2px white'
        labelEl.style.left = '50%'
        labelEl.style.top = '18px' // Below the marker
        labelEl.style.transform = 'translateX(-50%)' // Center horizontally
        labelEl.style.whiteSpace = 'nowrap'
        labelEl.style.pointerEvents = 'none'
        labelEl.style.maxWidth = '200px'
        labelEl.style.overflow = 'hidden'
        labelEl.style.textOverflow = 'ellipsis'
        labelEl.style.display = 'none'
        labelEl.style.opacity = '0'
        labelEl.style.transition = 'opacity 0.2s ease'

        // Show on hover only
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

        el.appendChild(labelEl)

        markers.push(marker)
      }
    })

    markersRef.current = markers

    // Cleanup on unmount
    return () => {
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
    }
  }, [map, airports, zoom, departureId, destinationId])

  return null
}
