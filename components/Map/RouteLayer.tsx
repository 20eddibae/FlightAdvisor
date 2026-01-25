'use client'

import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import { Position } from 'geojson'
import { COLORS } from '@/lib/constants'
import { RouteResult } from '@/lib/routing/route'

interface RouteLayerProps {
  map: mapboxgl.Map
  route: RouteResult | null
  coordinates?: Position[] // Fallback for simple display if needed
}

export default function RouteLayer({ map, route }: RouteLayerProps) {
  useEffect(() => {
    const isMapLoaded = map && map.getStyle();
    if (!isMapLoaded || !route || (!route.segments && (!route.coordinates || route.coordinates.length < 2))) return

    const sourceId = 'route-source'
    const lineLayerId = 'route-line-layer'
    const labelLayerId = 'route-label-layer'

    // Construct FeatureCollection from segments if available
    // If not (e.g. legacy route or no segments provided), fall back to single LineString
    let routeGeoJSON: GeoJSON.FeatureCollection<GeoJSON.LineString>

    if (route.segments) {
      const features: GeoJSON.Feature<GeoJSON.LineString>[] = route.segments.map((seg, index) => ({
        type: 'Feature',
        properties: {
          id: index,
          distance: seg.distance,
          exceedsLimit: seg.exceedsLimit
        },
        geometry: {
          type: 'LineString',
          coordinates: [seg.start, seg.end]
        }
      }))
      routeGeoJSON = {
        type: 'FeatureCollection',
        features
      }
    } else {
      // Fallback for simple coordinate list
      routeGeoJSON = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: {
            distance: route.distance_nm,
            exceedsLimit: false
          },
          geometry: {
            type: 'LineString',
            coordinates: route.coordinates || []
          }
        }]
      }
    }

    try {
      // Add/Update Source
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: 'geojson',
          data: routeGeoJSON,
        })
      } else {
        const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource
        source.setData(routeGeoJSON)
      }

      // Add Line Layer
      if (!map.getLayer(lineLayerId)) {
        map.addLayer({
          id: lineLayerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            // Use Red if exceeds limit, otherwise standard blue
            'line-color': [
              'case',
              ['get', 'exceedsLimit'],
              '#ef4444', // Red
              COLORS.ROUTE_LINE // Blue
            ],
            'line-width': COLORS.ROUTE_LINE_WIDTH,
            'line-opacity': 0.8,
          },
        })
      }

      // Add Label Layer
      if (!map.getLayer(labelLayerId)) {
        map.addLayer({
          id: labelLayerId,
          type: 'symbol',
          source: sourceId,
          layout: {
            'symbol-placement': 'line-center',
            'text-field': ['concat', ['to-string', ['round', ['get', 'distance']]], ' nm'],
            'text-size': 12, // Fixed size, does not scale with zoom (zoom-independent)
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-offset': [0, 1], // Offset slightly above line
            'text-allow-overlap': false,
            'text-ignore-placement': false
          },
          paint: {
            'text-color': '#1f2937', // Gray-800
            'text-halo-color': '#ffffff',
            'text-halo-width': 2
          }
        })
      }

      // Fit bounds
      const allCoords = route.coordinates || []
      if (allCoords.length > 0) {
        const bounds = new mapboxgl.LngLatBounds()
        allCoords.forEach((coord) => bounds.extend([coord[0], coord[1]]))

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

    return () => {
      try {
        if (map.getStyle()) {
          if (map.getLayer(labelLayerId)) map.removeLayer(labelLayerId)
          if (map.getLayer(lineLayerId)) map.removeLayer(lineLayerId)
          if (map.getSource(sourceId)) map.removeSource(sourceId)
        }
      } catch (err) {
        console.warn('Error removing route layer:', err)
      }
    }
  }, [map, route])

  return null
}
