/**
 * Cloud Layer - Displays METAR stations as green airport dots
 * Matches the same visual style as AirportMarkers for consistency
 */

'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { COLORS } from '@/lib/constants'
import type { MapRef } from './MapView'

interface CloudLayerProps {
  map: MapRef | null
  cloudData: GeoJSON.FeatureCollection | null
}

export default function CloudLayer({ map, cloudData }: CloudLayerProps) {
  const markersRef = useRef<mapboxgl.Marker[]>([])

  useEffect(() => {
    if (!map || !cloudData) {
      if (!map) console.log('CloudLayer: No map')
      if (!cloudData) console.log('CloudLayer: No cloud data')
      return
    }

    console.log(`CloudLayer: Rendering ${cloudData.features?.length || 0} METAR stations as green dots`)

    // Debug: Show sample of data
    if (cloudData.features && cloudData.features.length > 0) {
      const sample = cloudData.features[0]
      console.log('CloudLayer sample data:', {
        id: sample.properties?.id,
        cover: sample.properties?.cover,
        ceil: sample.properties?.ceil,
        coords: sample.geometry?.coordinates
      })
    }

    // Cleanup existing markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    const markers: mapboxgl.Marker[] = []

    // Create green dot marker for each METAR station
    cloudData.features.forEach((feature) => {
      const props = feature.properties
      const coords = feature.geometry?.coordinates

      if (!props || !coords || coords.length < 2) return

      // Create marker element (same style as AirportMarkers)
      const el = document.createElement('div')
      el.className = 'airport-marker metar-station'
      el.style.width = '16px'
      el.style.height = '16px'
      el.style.borderRadius = '50%'
      el.style.cursor = 'pointer'
      el.style.backgroundColor = COLORS.AIRPORT_MARKER // Green (same as airports)
      el.style.border = '2px solid white'
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)'

      // Format cloud ceiling info
      const ceilingText = props.ceil
        ? `${props.ceil}ft`
        : props.cover || 'Unknown'

      // Get flight category color indicator
      const fltcat = props.fltcat || 'UNKNOWN'
      const fltcatColors: Record<string, string> = {
        'VFR': '#00ff00',
        'MVFR': '#ffff00',
        'IFR': '#ff0000',
        'LIFR': '#ff00ff'
      }
      const fltcatColor = fltcatColors[fltcat] || '#808080'

      // Create popup with weather information
      const popup = new mapboxgl.Popup({
        offset: 18,
        closeButton: false,
      }).setHTML(`
        <div style="padding: 6px; font-family: sans-serif;">
          <strong style="font-size: 14px;">${props.id || 'Unknown'}</strong><br/>
          <span style="font-size: 11px; color: #666;">${props.site || ''}</span><br/>
          <div style="margin-top: 6px; font-size: 11px;">
            <strong style="color: ${fltcatColor};">${fltcat}</strong><br/>
            <strong>Ceiling:</strong> ${ceilingText}<br/>
            <strong>Cover:</strong> ${props.cover || 'Unknown'}<br/>
            <strong>Visibility:</strong> ${props.visib || 'Unknown'} SM<br/>
            ${props.temp !== null && props.temp !== undefined ? `<strong>Temp:</strong> ${props.temp}°C<br/>` : ''}
            ${props.dewp !== null && props.dewp !== undefined ? `<strong>Dewpoint:</strong> ${props.dewp}°C<br/>` : ''}
          </div>
          <div style="margin-top: 4px; font-size: 10px; color: #999; font-family: monospace;">
            ${props.rawOb || ''}
          </div>
        </div>
      `)

      // Safety check: ensure map is still valid
      if (!map.getCanvasContainer()) return

      const marker = new mapboxgl.Marker(el)
        .setLngLat([coords[0], coords[1]])
        .setPopup(popup)
        .addTo(map)

      markers.push(marker)
    })

    markersRef.current = markers

    console.log(`✓ CloudLayer: Added ${markers.length} METAR station markers`)

    // Cleanup function
    return () => {
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
    }
  }, [map, cloudData])

  return null
}
