'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import type { MapRef } from './MapView'

interface CloudLayerProps {
  map: MapRef | null
  cloudData: GeoJSON.FeatureCollection | null
}

export default function CloudLayer({ map, cloudData }: CloudLayerProps) {
  const sourceId = 'metar-cloud-overlay'
  const overlayCircleLayerId = 'cloud-coverage-overlay'
  const layerInitialized = useRef(false)

  // NOTE: Green dots and labels are now rendered by AirportMarkers component for UI consistency and searchability

  // 1. Initialization Effect: Add Source & Layer
  useEffect(() => {
    if (!map) return

    const initLayers = () => {
      // Always check state on map directly to be robust
      const sourceExists = map.getSource(sourceId)
      const layerExists = map.getLayer(overlayCircleLayerId)

      if (sourceExists && layerExists) {
        layerInitialized.current = true
        return
      }

      console.log('☁️ CloudLayer: Initializing source and layers')

      // Add empty source if missing
      if (!sourceExists) {
        map.addSource(sourceId, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })
      }

      // Layer: Large semi-transparent circles to create overlay effect
      if (!layerExists) {
        map.addLayer({
          id: overlayCircleLayerId,
          type: 'circle',
          source: sourceId,
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              4, 80,    // At zoom 4, radius 80px (large coverage)
              7, 120,   // At zoom 7, radius 120px
              10, 180,  // At zoom 10, radius 180px (massive coverage)
            ],
            'circle-color': [
              'case',
              // VFR - Very light green/blue tint (rgba(0, 255, 0, 0.1))
              ['==', ['get', 'fltcat'], 'VFR'], 'rgba(198, 198, 198, 0.1)',
              // MVFR - Yellow overlay (rgba(172, 172, 172, 0.25))
              ['==', ['get', 'fltcat'], 'MVFR'], 'rgba(255, 255, 0, 0.25)',
              // IFR - Orange/Red overlay (rgba(149, 149, 149, 0.4))
              ['==', ['get', 'fltcat'], 'IFR'], 'rgba(255, 140, 0, 0.4)',
              // LIFR - Dark red overlay (rgba(107, 107, 107, 0.5))
              ['==', ['get', 'fltcat'], 'LIFR'], 'rgba(53, 53, 53, 0.5)',
              // Unknown - Light gray
              'rgba(128, 128, 128, 0.1)'
            ],
            'circle-opacity': [
              'interpolate',
              ['linear'],
              ['get', 'intensity'],
              0, 0.1,    // Low intensity = nearly transparent
              1, 0.7,    // High intensity = more opaque
            ],
            'circle-blur': 1.5,  // High blur to create smooth gradient overlay
          },
        })
      }

      layerInitialized.current = true
    }

    // Initialize layers
    initLayers()

    // Cleanup on unmount or map change
    return () => {
      // Only remove on unmount if we initialized AND map still exists
      if (map && layerInitialized.current) {
        try {
          if (map.getLayer(overlayCircleLayerId)) {
            map.removeLayer(overlayCircleLayerId)
          }
          if (map.getSource(sourceId)) {
            map.removeSource(sourceId)
          }
          layerInitialized.current = false
          console.log('🧹 Cleaned up cloud overlay layer')
        } catch (e) {
          // Ignore errors during cleanup (map might be destroyed, which is fine)
          console.warn('Values cleaned up, but map might have been destroyed')
        }
      }
    }
  }, [map])

  // 2. Data Update Effect: Update Source Data
  useEffect(() => {
    if (!map || !cloudData || !layerInitialized.current) return

    const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource
    if (!source) return

    console.log(`☁️ CloudLayer: Updating data with ${cloudData.features.length} features`)

    // Process cloud data to add intensity values for visualization
    const processedData = {
      ...cloudData,
      features: cloudData.features.map(feature => {
        const props = feature.properties || {}

        // Calculate cloud intensity based on flight category and coverage
        let intensity = 0
        const fltcat = props.fltcat || 'VFR'
        const cover = props.cover || 'CLR'

        // Intensity based on flight category (0-1 scale)
        switch (fltcat) {
          case 'VFR': intensity = 0.2; break
          case 'MVFR': intensity = 0.5; break
          case 'IFR': intensity = 0.8; break
          case 'LIFR': intensity = 1.0; break
          default: intensity = 0.1
        }

        // Adjust intensity based on cloud coverage
        switch (cover) {
          case 'CLR': case 'SKC': intensity *= 0.3; break
          case 'FEW': intensity *= 0.5; break
          case 'SCT': intensity *= 0.7; break
          case 'BKN': intensity *= 0.9; break
          case 'OVC': intensity *= 1.0; break
        }

        return {
          ...feature,
          properties: {
            ...props,
            intensity
          }
        }
      })
    }

    try {
      source.setData(processedData)
    } catch (e) {
      console.warn('Failed to update cloud layer data:', e)
    }
  }, [map, cloudData]) // Run whenever cloudData changes

  return null
}
