'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { MAPBOX_CONFIG } from '@/lib/constants'

// Mapbox access token from environment variable
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

interface MapViewProps {
  onMapLoad?: (map: mapboxgl.Map) => void
}

export default function MapView({ onMapLoad }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [isMapLoaded, setIsMapLoaded] = useState(false)

  useEffect(() => {
    if (!MAPBOX_TOKEN) {
      console.error('Mapbox token is missing. Please set NEXT_PUBLIC_MAPBOX_TOKEN in .env.local')
      return
    }

    if (map.current || !mapContainer.current) return

    // Initialize Mapbox map
    mapboxgl.accessToken = MAPBOX_TOKEN

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAPBOX_CONFIG.STYLE,
      center: MAPBOX_CONFIG.CENTER,
      zoom: MAPBOX_CONFIG.ZOOM,
      attributionControl: true,
    })

    // Add navigation controls (zoom in/out, compass)
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

    // Add scale control
    map.current.addControl(
      new mapboxgl.ScaleControl({
        maxWidth: 100,
        unit: 'imperial', // Use nautical miles for aviation
      }),
      'bottom-left'
    )

    // Wait for map to load
    map.current.on('load', () => {
      setIsMapLoaded(true)
      if (onMapLoad && map.current) {
        onMapLoad(map.current)
      }
    })

    // Cleanup on unmount
    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [onMapLoad])

  return (
    <div className="relative w-full h-screen">
      <div ref={mapContainer} className="absolute inset-0" />
      {!isMapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-background">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading map...</p>
          </div>
        </div>
      )}
      {!MAPBOX_TOKEN && (
        <div className="absolute inset-0 flex items-center justify-center bg-background">
          <div className="max-w-md p-6 bg-card rounded-lg border">
            <h2 className="text-lg font-semibold mb-2">Mapbox Token Required</h2>
            <p className="text-sm text-muted-foreground">
              Please set NEXT_PUBLIC_MAPBOX_TOKEN in your .env.local file.
              <br />
              Get your token from:{' '}
              <a
                href="https://account.mapbox.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                https://account.mapbox.com/
              </a>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// Export the map ref type for use in other components
export type MapRef = mapboxgl.Map
