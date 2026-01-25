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
    if (!map || airports.length === 0) {
      if (!map) {
        console.log('🛑 AirportMarkers: No map instance')
      } else if (airports.length === 0) {
        console.log('🛑 AirportMarkers: No airports to render')
      }
      return
    }

    // Safety check: ensure map container is available
    if (!map.getCanvasContainer()) {
      console.log('🛑 AirportMarkers: Map container not ready')
      return
    }

    // DEBUG: Log what we received
    const toweredAirports = airports.filter(ap => ap.type === 'towered')
    const nonToweredAirports = airports.filter(ap => ap.type === 'non-towered')
    console.log(`🟢 AirportMarkers rendering: ${airports.length} total (${toweredAirports.length} towered, ${nonToweredAirports.length} non-towered)`)
    console.log(`   Zoom level: ${zoom.toFixed(1)}`)

    if (toweredAirports.length > 0) {
      console.log('   Towered airports to render:', toweredAirports.slice(0, 5).map(ap => ap.id).join(', '))
    }
    if (nonToweredAirports.length > 0) {
      console.log('   Non-towered airports to render:', nonToweredAirports.slice(0, 5).map(ap => ap.id).join(', '))
    }

    // Cleanup existing markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    const markers: mapboxgl.Marker[] = []

    // Apply clustering based on zoom level
    // ZOOM-BASED WEATHER STATION FILTERING:
    // Weather stations (green) only show at zoom >= 9, otherwise they "converge" onto blue airports
    const WEATHER_STATION_MIN_ZOOM = 9
    const shouldShowWeatherStations = zoom >= WEATHER_STATION_MIN_ZOOM

    // Filter out weather stations if zoom is too low
    const filteredAirports = shouldShowWeatherStations
      ? airports
      : airports.filter(ap => !ap._metadata?.isWeatherStation)

    console.log(`🌤️ Weather stations ${shouldShowWeatherStations ? 'VISIBLE' : 'HIDDEN'} at zoom ${zoom.toFixed(1)} (threshold: ${WEATHER_STATION_MIN_ZOOM})`)

    // Only exclude departure/destination airports from clustering
    // All other airports (including towered) will cluster at appropriate zoom levels
    const excludeIds = [departureId, destinationId].filter(Boolean) as string[]
    const radiusNM = getClusterRadiusNM(zoom)
    const clusters = clusterAirports(filteredAirports, radiusNM, excludeIds)

    const toweredCount = filteredAirports.filter(ap => ap.type === 'towered').length
    const excludedCount = excludeIds.length
    console.log(`🏢 Clustering ${filteredAirports.length} airports (${toweredCount} towered) with ${radiusNM}nm radius`)
    console.log(`   Excluding ${excludedCount} airports from clustering: ${excludeIds.join(', ') || 'none'}`)

    const clusterCount = clusters.filter(c => c.isCluster).length
    const individualCount = clusters.filter(c => !c.isCluster).length
    if (clusters.length < filteredAirports.length) {
      console.log(`✈️  Clustered: ${filteredAirports.length} airports → ${clusters.length} markers (${clusterCount} clusters, ${individualCount} individual) at zoom ${zoom.toFixed(1)}`)
    } else {
      console.log(`✈️  No clustering needed: all ${filteredAirports.length} airports shown individually at zoom ${zoom.toFixed(1)}`)
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
          .map(ap => {
            const apIdIsMongoId = ap.id.length === 24 && /^[a-f0-9]{24}$/i.test(ap.id)
            const apNameIsMongoId = ap.name.length === 24 && /^[a-f0-9]{24}$/i.test(ap.name)

            // Don't show MongoDB IDs
            if (apIdIsMongoId && apNameIsMongoId) {
              return `<li style="font-size: 10px;">Airport</li>`
            } else if (apIdIsMongoId) {
              return `<li style="font-size: 10px;">${ap.name}</li>`
            } else if (apNameIsMongoId) {
              return `<li style="font-size: 10px;">${ap.id}</li>`
            } else {
              return `<li style="font-size: 10px;">${ap.id} - ${ap.name}</li>`
            }
          })
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
        const isWeatherStation = airport._metadata?.isWeatherStation

        // Create popup with airport information
        // Check for MongoDB IDs to avoid showing ugly hex strings
        const popupIdIsMongoId = airport.id.length === 24 && /^[a-f0-9]{24}$/i.test(airport.id)
        const popupNameIsMongoId = airport.name.length === 24 && /^[a-f0-9]{24}$/i.test(airport.name)

        const displayId = popupIdIsMongoId ? '' : airport.id
        const displayName = popupNameIsMongoId ? `${airport.type === 'towered' ? 'Towered' : 'Non-towered'} Airport` : airport.name

        let popupHTML = `
          <div style="padding: 6px; font-family: sans-serif; min-width: 200px;">
            ${displayId ? `<strong style="font-size: 14px;">${displayId}</strong><br/>` : ''}
            <span style="font-size: ${displayId ? '11px' : '14px'}; ${displayId ? 'color: #666;' : 'font-weight: bold;'}">${displayName}</span><br/>
        `

        if (isWeatherStation && airport._metadata?.metar) {
          // Weather station popup with METAR data
          const metar = airport._metadata.metar
          const fltcat = metar.fltcat || 'UNKNOWN'
          const fltcatColors: Record<string, string> = {
            'VFR': '#00ff00',
            'MVFR': '#ffff00',
            'IFR': '#ff0000',
            'LIFR': '#ff00ff'
          }
          const fltcatColor = fltcatColors[fltcat] || '#808080'
          const ceilingText = metar.ceil ? `${metar.ceil}ft` : metar.cover || 'Unknown'

          popupHTML += `
            <div style="margin-top: 6px; font-size: 11px;">
              <strong style="color: ${fltcatColor};">${fltcat}</strong><br/>
              <strong>Ceiling:</strong> ${ceilingText}<br/>
              <strong>Cover:</strong> ${metar.cover || 'Unknown'}<br/>
              <strong>Visibility:</strong> ${metar.visib || 'Unknown'} SM<br/>
              ${metar.temp !== null && metar.temp !== undefined ? `<strong>Temp:</strong> ${metar.temp}°C<br/>` : ''}
              ${metar.dewp !== null && metar.dewp !== undefined ? `<strong>Dewpoint:</strong> ${metar.dewp}°C<br/>` : ''}
            </div>
            ${metar.rawOb ? `<div style="margin-top: 4px; font-size: 9px; color: #999; font-family: monospace; max-width: 250px; word-wrap: break-word;">${metar.rawOb}</div>` : ''}
          `
        } else {
          // Regular airport popup
          popupHTML += `
            <span style="font-size: 11px; color: #666;">
              Elevation: ${airport.elevation}' MSL<br/>
              ${airport.type === 'towered' ? 'Towered' : 'Non-towered'}<br/>
              ${airport.notes || ''}
            </span>
          `
        }

        popupHTML += `</div>`

        const popup = new mapboxgl.Popup({
          offset: 18,
          closeButton: false,
        }).setHTML(popupHTML)

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
        const nameIsMongoId = airport.name.length === 24 && /^[a-f0-9]{24}$/i.test(airport.name)

        if (nameIsMongoId) {
          // If name is also MongoDB ID, show "Airport" instead
          labelEl.textContent = 'Airport'
        } else if (isMongoId) {
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

    console.log(`✅ AirportMarkers: Created ${markers.length} markers (${clusters.length} clusters/individuals)`)

    // Debug: Check if markers are actually in the DOM
    setTimeout(() => {
      const markerElements = document.querySelectorAll('.airport-marker')
      console.log(`🔍 Airport markers in DOM: ${markerElements.length}`)
      if (markerElements.length === 0) {
        console.warn('⚠️ No airport markers found in DOM after render!')
      }
    }, 100)

    // Cleanup on unmount
    return () => {
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
    }
  }, [map, airports, zoom, departureId, destinationId])

  return null
}
