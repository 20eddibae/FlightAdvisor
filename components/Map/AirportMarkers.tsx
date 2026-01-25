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

    // Safety check: ensure map container is available
    if (!map.getCanvasContainer()) return

    const markers: mapboxgl.Marker[] = []

    try {
      airports.forEach((airport) => {
        // Create custom marker element
        const el = document.createElement('div')
        el.className = 'airport-marker'

        // Green for departure (KSQL), red for arrival (KSMF)
        const isDeparture = airport.id === 'KSQL'

        Object.assign(el.style, {
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          cursor: 'pointer',
          backgroundColor: isDeparture ? COLORS.DEPARTURE_MARKER : COLORS.ARRIVAL_MARKER,
          border: '2px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
        })

        // Create popup with airport information
        const popup = new mapboxgl.Popup({
          offset: 25,
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
        const marker = new mapboxgl.Marker(el)
          .setLngLat([airport.lon, airport.lat])
          .setPopup(popup)
          .addTo(map)

        // Add label below marker
        const labelEl = document.createElement('div')
        labelEl.className = 'airport-label'
        labelEl.textContent = airport.id

        Object.assign(labelEl.style, {
          position: 'absolute',
          fontWeight: 'bold',
          fontSize: '12px',
          color: isDeparture ? COLORS.DEPARTURE_MARKER : COLORS.ARRIVAL_MARKER,
          textShadow: '1px 1px 2px white, -1px -1px 2px white, 1px -1px 2px white, -1px 1px 2px white',
          marginTop: '28px',
          marginLeft: '-12px',
          pointerEvents: 'none',
        })

        el.appendChild(labelEl)

        markers.push(marker)
      })
    } catch (err) {
      console.warn('Error creating airport markers:', err)
    }

    // Cleanup on unmount
    return () => {
      markers.forEach((marker) => marker.remove())
    }
  }, [map, airports])

  return null
}
