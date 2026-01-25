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
  const [loadError, setLoadError] = useState<string | null>(null)

  // Store event handlers in refs so they persist across renders
  const handleLoadRef = useRef<(() => void) | null>(null)
  const handleErrorRef = useRef<((e: any) => void) | null>(null)

  useEffect(() => {
    if (!MAPBOX_TOKEN) {
      console.error('Mapbox token is missing. Please set NEXT_PUBLIC_MAPBOX_TOKEN')
      setLoadError('Mapbox token is missing')
      return
    }

    if (map.current || !mapContainer.current) return

    try {
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

      // Create event handlers
      const handleLoad = () => {
        setIsMapLoaded(true)
        map.current?.resize() // Force resize check
        if (onMapLoad && map.current) {
          onMapLoad(map.current)
        }
      }

      const handleError = (e: any) => {
        console.error('Mapbox error:', e)
        if (!isMapLoaded) {
          // Only set error if we haven't successfully loaded yet
          setLoadError(`Map error: ${e.error?.message || 'Unknown error'}`)
        }
      }

      // Store handlers in refs for cleanup
      handleLoadRef.current = handleLoad
      handleErrorRef.current = handleError

      // Handle load event
      map.current.on('load', handleLoad)

      // Handle errors
      map.current.on('error', handleError)

    } catch (err) {
      console.error('Failed to initialize map:', err)
      setLoadError('Failed to initialize map')
    }

    // Cleanup on unmount
    return () => {
      if (map.current) {
        // Remove event listeners before destroying map
        try {
          if (handleLoadRef.current) {
            map.current.off('load', handleLoadRef.current)
          }
          if (handleErrorRef.current) {
            map.current.off('error', handleErrorRef.current)
          }
        } catch (e) {
          // Ignore errors if map is already destroyed
        }
        map.current.remove()
        map.current = null
      }
    }
  }, [onMapLoad, isMapLoaded])

  return (
    <div className="relative w-full h-full min-h-screen bg-gray-100">
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

      {(!isMapLoaded || loadError) && (
        <div className="absolute inset-0 flex items-center justify-center bg-background z-50">
          <div className="text-center p-6 bg-card rounded-lg border shadow-lg max-w-md">
            {loadError ? (
              <>
                <div className="text-red-500 mb-2 font-bold">Error Loading Map</div>
                <p className="text-sm text-muted-foreground mb-4">{loadError}</p>
                {!MAPBOX_TOKEN && (
                  <div className="text-xs text-left bg-gray-50 p-2 rounded border">
                    <p><strong>Token Missing:</strong> Add NEXT_PUBLIC_MAPBOX_TOKEN to .env.local</p>
                    <a href="https://account.mapbox.com/" target="_blank" className="text-blue-500 underline mt-1 block">
                      Get Token
                    </a>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading navigation charts...</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Export the map ref type for use in other components
export type MapRef = mapboxgl.Map
