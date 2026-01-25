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

    // Additional safety check: ensure map is fully loaded
    if (!map.getCanvasContainer()) return

    const markers: mapboxgl.Marker[] = []

    try {
      waypoints.forEach((waypoint) => {
        // Create custom marker element
        const el = document.createElement('div')
        el.className = 'waypoint-marker'
        el.style.width = '14px' // Slightly smaller for waypoints
        el.style.height = '14px'
        el.style.borderRadius = '2px' // Square with slight roundness for VOR/Waypoint look
        el.style.transform = 'rotate(45deg)' // Diamond shape
        el.style.cursor = 'pointer'
        el.style.backgroundColor = COLORS.WAYPOINT_MARKER
        el.style.border = '1px solid white'
        el.style.boxShadow = '0 1px 2px rgba(0,0,0,0.3)'

        // Create popup with waypoint information
        const popup = new mapboxgl.Popup({
          offset: 12,
          closeButton: false,
        }).setHTML(`
          <div style="padding: 4px; font-family: sans-serif;">
            <strong style="color: ${COLORS.WAYPOINT_MARKER}">${waypoint.id}</strong><br/>
            <span style="font-size: 11px;">${waypoint.name}</span><br/>
            <span style="font-size: 10px; color: #666;">
              Type: ${waypoint.type}<br/>
              ${waypoint.frequency ? `Freq: ${waypoint.frequency}<br/>` : ''}
            </span>
          </div>
        `)

        // Create marker
        const marker = new mapboxgl.Marker(el)
          .setLngLat([waypoint.lon, waypoint.lat])
          .setPopup(popup)
          .addTo(map)

        // Create label element that appears on hover
        const labelEl = document.createElement('div')
        labelEl.className = 'waypoint-label'
        labelEl.textContent = waypoint.name
        labelEl.style.position = 'absolute'
        labelEl.style.fontWeight = '600'
        labelEl.style.fontSize = '10px'
        labelEl.style.color = COLORS.WAYPOINT_MARKER
        labelEl.style.textShadow = '1px 1px 0px white, -1px -1px 0px white, 1px -1px 0px white, -1px 1px 0px white'
        labelEl.style.marginLeft = '18px'
        labelEl.style.marginTop = '-8px'
        labelEl.style.transform = 'rotate(-45deg)' // Counter-rotate so text is upright
        labelEl.style.whiteSpace = 'nowrap'
        labelEl.style.pointerEvents = 'none'
        labelEl.style.display = 'none'
        labelEl.style.opacity = '0'
        labelEl.style.transition = 'opacity 0.2s ease'

        // Add hover interaction
        el.addEventListener('mouseenter', () => {
          labelEl.style.display = 'block'
          // Small delay to trigger transition
          setTimeout(() => {
            if (labelEl) labelEl.style.opacity = '1'
          }, 0)
        })

        el.addEventListener('mouseleave', () => {
          if (labelEl) labelEl.style.opacity = '0'
          setTimeout(() => {
            if (labelEl) labelEl.style.display = 'none'
          }, 200)
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
