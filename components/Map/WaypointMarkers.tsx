'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { Waypoint } from '@/lib/geojson'
import { COLORS } from '@/lib/constants'

interface WaypointMarkersProps {
  map: mapboxgl.Map
  waypoints: Waypoint[]
}

// Styles constants for cleaner code
const MARKER_STYLES = {
  width: '14px',
  height: '14px',
  borderRadius: '2px', // Square with slight roundness
  transform: 'rotate(45deg)', // Diamond shape
  cursor: 'pointer',
  backgroundColor: COLORS.WAYPOINT_MARKER,
  border: '1px solid white',
  boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
}

const LABEL_STYLES = {
  position: 'absolute',
  fontWeight: '600',
  fontSize: '10px',
  color: COLORS.WAYPOINT_MARKER,
  textShadow: '1px 1px 0px white, -1px -1px 0px white, 1px -1px 0px white, -1px 1px 0px white',
  marginLeft: '18px',
  marginTop: '-8px',
  transform: 'rotate(-45deg)', // Counter-rotate so text is upright
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  display: 'none',
  opacity: '0',
  transition: 'opacity 0.2s ease',
}

export default function WaypointMarkers({ map, waypoints }: WaypointMarkersProps) {
  // Use a ref to track markers for cleanup, independent of render cycle
  const markersRef = useRef<mapboxgl.Marker[]>([])

  useEffect(() => {
    // Basic validation
    if (!map || waypoints.length === 0) return
    if (!map.getCanvasContainer()) return

    // Cleanup existing markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    const createMarkerElement = (waypoint: Waypoint) => {
      const el = document.createElement('div')
      el.className = 'waypoint-marker'

      // Apply styles
      Object.assign(el.style, MARKER_STYLES)

      // Hover Interaction
      const labelEl = document.createElement('div')
      labelEl.className = 'waypoint-label'
      labelEl.textContent = waypoint.name
      Object.assign(labelEl.style, LABEL_STYLES)
      el.appendChild(labelEl)

      el.addEventListener('mouseenter', () => {
        labelEl.style.display = 'block'
        requestAnimationFrame(() => {
          labelEl.style.opacity = '1'
        })
      })

      el.addEventListener('mouseleave', () => {
        labelEl.style.opacity = '0'
        setTimeout(() => {
          // Check if it's still hidden before setting display none (simple debounce)
          if (labelEl.style.opacity === '0') {
            labelEl.style.display = 'none'
          }
        }, 200)
      })

      return el
    }

    const popupHTML = (w: Waypoint) => `
      <div style="padding: 4px; font-family: sans-serif;">
        <strong style="color: ${COLORS.WAYPOINT_MARKER}">${w.id}</strong><br/>
        <span style="font-size: 11px;">${w.name}</span><br/>
        <span style="font-size: 10px; color: #666;">
          Type: ${w.type}<br/>
          ${w.frequency ? `Freq: ${w.frequency}<br/>` : ''}
        </span>
      </div>
    `

    // Batch creation
    const newMarkers: mapboxgl.Marker[] = []

    waypoints.forEach(waypoint => {
      const el = createMarkerElement(waypoint)

      const popup = new mapboxgl.Popup({
        offset: 12,
        closeButton: false,
      }).setHTML(popupHTML(waypoint))

      const marker = new mapboxgl.Marker(el)
        .setLngLat([waypoint.lon, waypoint.lat])
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
  }, [map, waypoints])

  return null
}
