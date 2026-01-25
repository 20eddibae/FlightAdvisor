'use client'

import { useEffect, useRef } from 'react'
import { COLORS } from '@/lib/constants'
import { RouteResult } from '@/lib/routing/route'

interface RouteLayerProps {
  map: mapboxgl.Map
  routes: RouteResult[]
  selectedIndex: number
  highlightedSegmentIndex: number | null
  onRouteSelect: (index: number) => void
}

export default function RouteLayer({
  map,
  routes,
  selectedIndex,
  highlightedSegmentIndex,
  onRouteSelect
}: RouteLayerProps) {
  // Use ref to keep track of handler for cleanup without re-binding on every render
  const onRouteSelectRef = useRef(onRouteSelect)
  useEffect(() => { onRouteSelectRef.current = onRouteSelect }, [onRouteSelect])

  useEffect(() => {
    const isMapLoaded = map && map.getStyle();
    if (!isMapLoaded || !routes || routes.length === 0) return

    const sourceId = 'route-source'
    const lineLayerId = 'route-line-layer'
    const labelLayerId = 'route-label-layer'
    const clickLayerId = 'route-click-layer' // Invisible wide layer for easier clicking

    // Construct FeatureCollection from ALL routes
    const features: GeoJSON.Feature<GeoJSON.LineString>[] = []

    routes.forEach((route, routeIdx) => {
      const isSelected = routeIdx === selectedIndex

      if (route.segments) {
        route.segments.forEach((seg, segIdx) => {
          const isHighlighted = isSelected && segIdx === highlightedSegmentIndex

          features.push({
            type: 'Feature',
            properties: {
              routeIndex: routeIdx,
              segmentIndex: segIdx,
              distance: seg.distance,
              exceedsLimit: seg.exceedsLimit,
              isSelected,
              isHighlighted,
              // Sort key to ensure selected route renders ON TOP
              sortKey: isSelected ? (isHighlighted ? 2 : 1) : 0
            },
            geometry: {
              type: 'LineString',
              coordinates: [seg.start, seg.end]
            }
          })
        })
      } else {
        // Fallback for simple coordinate list
        features.push({
          type: 'Feature',
          properties: {
            routeIndex: routeIdx,
            segmentIndex: 0,
            distance: route.distance_nm,
            exceedsLimit: false,
            isSelected,
            isHighlighted: false,
            sortKey: isSelected ? 1 : 0
          },
          geometry: {
            type: 'LineString',
            coordinates: route.coordinates || []
          }
        })
      }
    })

    const routeGeoJSON: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
      type: 'FeatureCollection',
      features
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

      // 1. Invisible Click Target Layer (wider for easier clicking)
      if (!map.getLayer(clickLayerId)) {
        map.addLayer({
          id: clickLayerId,
          type: 'line',
          source: sourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-width': 20,
            'line-opacity': 0
          }
        })

        // Add Click Handler
        map.on('click', clickLayerId, (e) => {
          if (e.features && e.features[0]) {
            const rIdx = e.features[0].properties?.routeIndex
            if (typeof rIdx === 'number') {
              onRouteSelectRef.current(rIdx)
            }
          }
        })

        // Add Cursor Pointer
        map.on('mouseenter', clickLayerId, () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', clickLayerId, () => { map.getCanvas().style.cursor = '' })
      }

      // 2. Visible Line Layer
      if (!map.getLayer(lineLayerId)) {
        map.addLayer({
          id: lineLayerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
            'line-sort-key': ['get', 'sortKey'] // Render selected routes on top
          },
          paint: {
            'line-color': [
              'case',
              ['boolean', ['get', 'isHighlighted'], false],
              '#ef4444', // Red (Highlighted Segment)

              ['boolean', ['get', 'exceedsLimit'], false],
              '#ef4444', // Red (Limit Exceeded)

              // Both Selected and Unselected are now Blue, just diff opacity
              COLORS.ROUTE_LINE,
            ],
            'line-width': [
              'case',
              ['get', 'isSelected'],
              COLORS.ROUTE_LINE_WIDTH + 1, // Thicker for selected
              3 // Slightly wider for unselected so they are visible with opacity
            ],
            'line-opacity': [
              'case',
              ['boolean', ['get', 'isHighlighted'], false],
              1.0, // Highlighted segment always full opacity

              ['get', 'isSelected'],
              1.0, // Selected route full opacity

              0.6 // Unselected routes 60% opacity
            ],
          },
        })
      }

      // 3. Label Layer (Only for selected route)
      if (!map.getLayer(labelLayerId)) {
        map.addLayer({
          id: labelLayerId,
          type: 'symbol',
          source: sourceId,
          filter: ['==', 'isSelected', true], // Only show labels for selected route
          layout: {
            'symbol-placement': 'line-center',
            'text-field': ['concat', ['to-string', ['round', ['get', 'distance']]], ' nm'],
            'text-size': 12,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-offset': [0, 1],
            'text-allow-overlap': false,
            'text-ignore-placement': false
          },
          paint: {
            'text-color': '#1f2937',
            'text-halo-color': '#ffffff',
            'text-halo-width': 2
          }
        })
      } else {
        // Update filter if layer already exists (to handle selection changes)
        map.setFilter(labelLayerId, ['==', 'isSelected', true])
      }

    } catch (err) {
      console.warn('Error updating route layer:', err)
    }

    return () => {
      try {
        if (map.getStyle()) {
          if (map.getLayer(labelLayerId)) map.removeLayer(labelLayerId)
          if (map.getLayer(lineLayerId)) map.removeLayer(lineLayerId)
          if (map.getLayer(clickLayerId)) map.removeLayer(clickLayerId)
          if (map.getSource(sourceId)) map.removeSource(sourceId)
        }
      } catch (err) {
        // Ignored
      }
    }
  }, [map, routes, selectedIndex, highlightedSegmentIndex])

  return null
}
