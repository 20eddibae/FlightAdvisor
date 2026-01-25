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
    if (!map || !coordinates || coordinates.length < 2) return

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

      map.fitBounds(bounds, {
        padding: 100,
        maxZoom: 10,
        duration: 1000,
      })
    }

    // Cleanup function
    return () => {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId)
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId)
      }
    }
  }, [map, coordinates])

  return null
}
