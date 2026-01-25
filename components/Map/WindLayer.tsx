'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { createRoot } from 'react-dom/client'
import { WindBarb } from './WindBarb'
import { getAirportCache } from '@/lib/cache/airportCache'
import type { MapRef } from './MapView'
import { point } from '@turf/turf'

interface WindLayerProps {
  map: MapRef | null
  visible: boolean
}

interface WindStation {
  id: string
  lat: number
  lon: number
  windSpeed: number
  windDir: number
  raw: any
}

export default function WindLayer({ map, visible }: WindLayerProps) {
  const markersRef = useRef<{ [key: string]: mapboxgl.Marker }>({})
  const [stations, setStations] = useState<WindStation[]>([])
  const abortControllerRef = useRef<AbortController | null>(null)

  // Clear markers helper
  const clearMarkers = () => {
    Object.values(markersRef.current).forEach(marker => marker.remove())
    markersRef.current = {}
  }

  // Fetch and update data
  const updateWindData = async () => {
    if (!map) return
    
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    try {
      const bounds = map.getBounds()
      if (!bounds) return

      const bbox: [number, number, number, number] = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth()
      ]

      // 1. Get candidate airports from cache
      const cache = getAirportCache()
      // Ensure cache is initialized for this region (auto-handled by cache manager usually, but good to trigger)
      // We assume MapView or something triggers `loadRegionsForViewport`. 
      // If not, we might miss data initially.
      
      let candidates = cache.getAirportsInViewport(bbox)

      // 2. Filter/Cluster to ~25 items
      // Grid based clustering
      const cols = 5
      const rows = 5
      const latStep = (bbox[3] - bbox[1]) / rows
      const lonStep = (bbox[2] - bbox[0]) / cols
      
      const selectedIds: string[] = []
      const gridUsed = new Set<string>()

      // Sort candidates by priority (Towered > Non-Towered) to pick best in cell
      candidates.sort((a, b) => {
        if (a.type === 'towered' && b.type !== 'towered') return -1;
        if (a.type !== 'towered' && b.type === 'towered') return 1;
        return 0;
      })

      for (const airport of candidates) {
        if (selectedIds.length >= 25) break;

        const col = Math.floor((airport.lon - bbox[0]) / lonStep)
        const row = Math.floor((airport.lat - bbox[1]) / latStep)
        const key = `${row},${col}`

        if (!gridUsed.has(key)) {
          gridUsed.add(key)
          selectedIds.push(airport.id)
        }
      }

      if (selectedIds.length === 0) {
        setStations([])
        return
      }

      // 3. Fetch Weather
      // Use existing weather API which supports IDs
      const response = await fetch(`/api/weather?ids=${selectedIds.join(',')}`, {
        signal: abortControllerRef.current.signal
      })
      
      if (!response.ok) throw new Error('Weather fetch failed')
      
      const data = await response.json()
      
      // 4. Process Data
      const newStations: WindStation[] = []
      
      if (data.stations) {
        for (const st of data.stations) {
          if (st.metar) {
            // Find lat/lon from candidates (API might not return lat/lon for stations, usually does if normalized, but let's use our cache)
            const airport = candidates.find(c => c.id === st.station)
            if (airport && st.metar.windSpeed !== undefined && st.metar.windDir !== undefined) {
              newStations.push({
                id: st.station,
                lat: airport.lat,
                lon: airport.lon,
                windSpeed: st.metar.windSpeed, // kts
                windDir: st.metar.windDir, // degrees
                raw: st.metar
              })
            }
          }
        }
      }
      
      setStations(newStations)

    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Error updating wind layer:', err)
      }
    }
  }

  // Effect: Bind events and initial load
  useEffect(() => {
    if (!map) return

    const handleMoveEnd = () => {
      if (visible) updateWindData()
    }

    map.on('moveend', handleMoveEnd)
    
    // Initial load
    if (visible) updateWindData()

    return () => {
      map.off('moveend', handleMoveEnd)
      if (abortControllerRef.current) abortControllerRef.current.abort()
    }
  }, [map, visible])

  // Effect: Render markers
  useEffect(() => {
    if (!map) return

    // Diff markers
    const newMarkerIds = new Set(stations.map(s => s.id))
    const currentMarkerIds = Object.keys(markersRef.current)

    // Remove old
    currentMarkerIds.forEach(id => {
      if (!newMarkerIds.has(id)) {
        markersRef.current[id].remove()
        delete markersRef.current[id]
      }
    })

    if (!visible) {
      clearMarkers()
      return
    }

    // Add/Update new
    stations.forEach(station => {
      if (!markersRef.current[station.id]) {
        // Create new marker
        const el = document.createElement('div')
        el.className = 'wind-barb-marker'
        
        // Render React component into it
        const root = createRoot(el)
        root.render(<WindBarb speed={station.windSpeed} direction={station.windDir} />)
        
        const marker = new mapboxgl.Marker({
          element: el,
          anchor: 'center'
        })
        .setLngLat([station.lon, station.lat])
        .addTo(map)

        markersRef.current[station.id] = marker
      } 
      // Note: We don't update existing markers' content here for simplicity 
      // (React root on same element might need care). 
      // Since specific station data doesn't change fast, valid to just keep it.
      // If wind changes, we usually get a new object or we can force re-render.
    })

  }, [map, visible, stations])

  return null
}
