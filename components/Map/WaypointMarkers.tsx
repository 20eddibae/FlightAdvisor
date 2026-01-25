'use client'

import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import { Waypoint } from '@/lib/geojson'
import { COLORS } from '@/lib/constants'

interface WaypointMarkersProps {
  map: mapboxgl.Map
  waypoints: Waypoint[]
}

export default function WaypointMarkers({ map, waypoints }: WaypointMarkersProps) {
  useEffect(() => {
    // Basic validation
    if (!map || waypoints.length === 0) return

    // Safety check: ensure map container is available
    if (!map.getCanvasContainer()) return

    const markers: mapboxgl.Marker[] = []

    try {
      waypoints.forEach((waypoint) => {
        // Create custom marker element
        const el = document.createElement('div')
        el.className = 'waypoint-marker'

        // Apply styles directly or consider moving to CSS
        Object.assign(el.style, {
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          cursor: 'pointer',
          backgroundColor: COLORS.WAYPOINT_MARKER,
          border: '2px solid white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        })

        // Create popup with waypoint information
        const popup = new mapboxgl.Popup({
          offset: 15,
          closeButton: false,
        }).setHTML(`
          <div style="padding: 4px;">
            <strong>${waypoint.id}</strong><br/>
            ${waypoint.name}<br/>
            <span style="font-size: 11px; color: #666;">
              Type: ${waypoint.type.replace('_', ' ')}<br/>
              ${waypoint.frequency ? `Frequency: ${waypoint.frequency}<br/>` : ''}
              ${waypoint.description || ''}
            </span>
          </div>
        `)

        // Create marker
        const marker = new mapboxgl.Marker(el)
          .setLngLat([waypoint.lon, waypoint.lat])
          .setPopup(popup)
          .addTo(map)

        // Add label to the right of marker
        const labelEl = document.createElement('div')
        labelEl.className = 'waypoint-label'
        labelEl.textContent = waypoint.id

        Object.assign(labelEl.style, {
          position: 'absolute',
          fontWeight: '600',
          fontSize: '10px',
          color: COLORS.WAYPOINT_MARKER,
          textShadow:
            '1px 1px 1px white, -1px -1px 1px white, 1px -1px 1px white, -1px 1px 1px white',
          marginLeft: '20px',
          marginTop: '0px',
          pointerEvents: 'none',
        })

        el.appendChild(labelEl)

        markers.push(marker)
      })
    } catch (err) {
      console.warn('Error creating waypoint markers:', err)
    }

    // Cleanup on unmount
    return () => {
      markers.forEach((marker) => marker.remove())
    }
  }, [map, waypoints])

  return null
}
