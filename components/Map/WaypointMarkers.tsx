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
    if (!map || waypoints.length === 0) return

    const markers: mapboxgl.Marker[] = []

    waypoints.forEach((waypoint) => {
      // Create custom marker element
      const el = document.createElement('div')
      el.className = 'waypoint-marker'
      el.style.width = '16px'
      el.style.height = '16px'
      el.style.borderRadius = '50%'
      el.style.cursor = 'pointer'
      el.style.backgroundColor = COLORS.WAYPOINT_MARKER
      el.style.border = '2px solid white'
      el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)'

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
      labelEl.style.position = 'absolute'
      labelEl.style.fontWeight = '600'
      labelEl.style.fontSize = '10px'
      labelEl.style.color = COLORS.WAYPOINT_MARKER
      labelEl.style.textShadow = '1px 1px 1px white, -1px -1px 1px white, 1px -1px 1px white, -1px 1px 1px white'
      labelEl.style.marginLeft = '20px'
      labelEl.style.marginTop = '0px'
      labelEl.style.pointerEvents = 'none'
      el.appendChild(labelEl)

      markers.push(marker)
    })

    // Cleanup on unmount
    return () => {
      markers.forEach((marker) => marker.remove())
    }
  }, [map, waypoints])

  return null
}
