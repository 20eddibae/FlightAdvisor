'use client'

import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import { Airport } from '@/lib/geojson'
import { COLORS } from '@/lib/constants'

interface AirportMarkersProps {
  map: mapboxgl.Map
  airports: Airport[]
}

export default function AirportMarkers({ map, airports }: AirportMarkersProps) {
  useEffect(() => {
    if (!map || airports.length === 0) return

    // Additional safety check: ensure map is fully loaded
    if (!map.getCanvasContainer()) return

    const markers: mapboxgl.Marker[] = []

    airports.forEach((airport) => {
      // Create custom marker element
      const el = document.createElement('div')
      el.className = 'airport-marker'
      el.style.width = '16px'
      el.style.height = '16px'
      el.style.borderRadius = '50%'
      el.style.cursor = 'pointer'

      // Green for departure (KSQL), red for arrival (KSMF)
      const isDeparture = airport.id === 'KSQL'
      el.style.backgroundColor = isDeparture ? COLORS.DEPARTURE_MARKER : COLORS.ARRIVAL_MARKER
      el.style.border = '2px solid white'
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)'

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

      // Create marker
      // Safety check: ensure map is still valid for marker addition
      if (!map.getCanvasContainer()) return;

      const marker = new mapboxgl.Marker(el)
        .setLngLat([airport.lon, airport.lat])
        .setPopup(popup)
        .addTo(map)

      // Create label element that appears on hover
      const labelEl = document.createElement('div')
      labelEl.className = 'airport-label'
      labelEl.textContent = airport.name
      labelEl.style.position = 'absolute'
      labelEl.style.fontWeight = 'bold'
      labelEl.style.fontSize = '11px'
      labelEl.style.color = isDeparture ? COLORS.DEPARTURE_MARKER : COLORS.ARRIVAL_MARKER
      labelEl.style.textShadow = '1px 1px 2px white, -1px -1px 2px white, 1px -1px 2px white, -1px 1px 2px white'
      labelEl.style.marginTop = '20px'
      labelEl.style.marginLeft = '8px'
      labelEl.style.transform = 'translateX(-50%)'
      labelEl.style.whiteSpace = 'nowrap'
      labelEl.style.pointerEvents = 'none'
      labelEl.style.maxWidth = '200px'
      labelEl.style.overflow = 'hidden'
      labelEl.style.textOverflow = 'ellipsis'
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

      markers.push(marker)
    })

    // Cleanup on unmount
    return () => {
      markers.forEach((marker) => marker.remove())
    }
  }, [map, airports])

  return null
}
