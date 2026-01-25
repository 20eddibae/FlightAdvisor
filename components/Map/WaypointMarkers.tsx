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

    waypoints.forEach((waypoint) => {
      // Create custom marker element
      const el = document.createElement('div')
      el.className = 'waypoint-marker'
      el.style.width = '20px'
      el.style.height = '20px'
      el.style.borderRadius = '50%'
      el.style.cursor = 'pointer'
      el.style.backgroundColor = COLORS.WAYPOINT_MARKER
      el.style.border = '2px solid white'
      el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)'

      // Create popup with waypoint information
      const popup = new mapboxgl.Popup({
        offset: 18,
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
      // Safety check: ensure map is still valid for marker addition
      if (!map.getCanvasContainer()) return

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
      labelEl.style.textShadow = '1px 1px 1px white, -1px -1px 1px white, 1px -1px 1px white, -1px 1px 1px white'
      labelEl.style.marginLeft = '24px'
      labelEl.style.marginTop = '2px'
      labelEl.style.whiteSpace = 'nowrap'
      labelEl.style.maxWidth = '150px'
      labelEl.style.overflow = 'hidden'
      labelEl.style.textOverflow = 'ellipsis'
      labelEl.style.pointerEvents = 'none'
      labelEl.style.display = 'none' // Hidden by default
      labelEl.style.transition = 'opacity 0.2s ease'

      // Add hover interaction
      el.addEventListener('mouseenter', () => {
        labelEl.style.display = 'block'
        labelEl.style.opacity = '1'
      })

      el.addEventListener('mouseleave', () => {
        labelEl.style.opacity = '0'
        setTimeout(() => {
          labelEl.style.display = 'none'
        }, 200) // Match transition duration
      })

      el.appendChild(labelEl)

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
