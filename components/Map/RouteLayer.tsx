'use client'

import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import { Position } from 'geojson'
import { COLORS } from '@/lib/constants'

interface RouteLayerProps {
  map: mapboxgl.Map
  coordinates: Position[]
}

export default function RouteLayer({ map, coordinates }: RouteLayerProps) {
  useEffect(() => {
    // Check if map is valid and has style (not destroyed)
    const isMapLoaded = map && map.getStyle();
    if (!isMapLoaded || !coordinates || coordinates.length < 2) return

    // Additional safety check: ensure map is fully loaded
    if (!map.getCanvasContainer() || !map.getStyle()) return

    const sourceId = 'route'
    const layerId = 'route-line'

    // Create GeoJSON for the route
    const routeGeoJSON: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates,
      },
    }

    try {
      // Add source if it doesn't exist
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: 'geojson',
          data: routeGeoJSON,
        })
      } else {
        // Update existing source
        const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource
        source.setData(routeGeoJSON)
      }

      // Add layer if it doesn't exist
      if (!map.getLayer(layerId)) {
        map.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': COLORS.ROUTE_LINE,
            'line-width': COLORS.ROUTE_LINE_WIDTH,
            'line-opacity': 0.8,
          },
        })
      }

      // Fit map bounds to show the entire route
      if (coordinates.length > 0) {
        const bounds = new mapboxgl.LngLatBounds()

        coordinates.forEach((coord) => {
          bounds.extend([coord[0], coord[1]])
        })

        // Check bounds validity before fitting
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, {
            padding: 100,
            maxZoom: 10,
            duration: 1000,
          })
        }
      }
    } catch (err) {
      console.warn('Error updating route layer:', err)
    }

    // Cleanup function
    return () => {
      try {
        if (map.getStyle()) {
          if (map.getLayer(layerId)) {
            map.removeLayer(layerId)
          }
          if (map.getSource(sourceId)) {
            map.removeSource(sourceId)
          }
        }
      } catch (err) {
        console.warn('Error removing route layer:', err)
      }
    }
  }, [map, coordinates])

  return null
}
