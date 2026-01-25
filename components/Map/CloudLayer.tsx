/**
 * Cloud Layer - Displays cloud conditions as a visual overlay across the map
 * Shows cloud coverage patterns and ceiling heights as colored regions
 */

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
  const labelLayerId = 'cloud-station-labels'
  const hasInitialized = useRef(false)

  // NOTE: Green dots are now rendered by AirportMarkers component for UI consistency and searchability

  console.log('🌤️ CloudLayer component rendered with props:', {
    hasMap: !!map,
    hasCloudData: !!cloudData,
    featureCount: cloudData?.features?.length || 0
  })

  useEffect(() => {
    console.log('CloudLayer useEffect triggered:', {
      hasMap: !!map,
      hasCloudData: !!cloudData,
      featureCount: cloudData?.features?.length || 0
    })

    if (!map || !cloudData) {
      if (!map) console.log('❌ CloudLayer: No map')
      if (!cloudData) console.log('❌ CloudLayer: No cloud data')
      return
    }

    console.log(`✅ CloudLayer: Rendering ${cloudData.features?.length || 0} METAR stations as overlay + green dots`)

    // Debug: Show sample of data
    if (cloudData.features && cloudData.features.length > 0) {
      const sample = cloudData.features[0]
      console.log('📊 CloudLayer sample data:', {
        id: sample.properties?.id,
        cover: sample.properties?.cover,
        fltcat: sample.properties?.fltcat,
        ceil: sample.properties?.ceil,
        coords: sample.geometry?.coordinates
      })
    } else {
      console.warn('⚠️ CloudLayer: cloudData.features is empty or undefined')
      return
    }

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
          case 'VFR':
            intensity = 0.2
            break
          case 'MVFR':
            intensity = 0.5
            break
          case 'IFR':
            intensity = 0.8
            break
          case 'LIFR':
            intensity = 1.0
            break
          default:
            intensity = 0.1
        }

        // Adjust intensity based on cloud coverage
        switch (cover) {
          case 'CLR':
          case 'SKC':
            intensity *= 0.3
            break
          case 'FEW':
            intensity *= 0.5
            break
          case 'SCT':
            intensity *= 0.7
            break
          case 'BKN':
            intensity *= 0.9
            break
          case 'OVC':
            intensity *= 1.0
            break
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

    // Initialize source and layers once
    if (!hasInitialized.current) {
      console.log('🎨 Initializing cloud overlay layers...')

      // Add source
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: 'geojson',
          data: processedData,
        })
      }

      // Layer 1: Large semi-transparent circles to create overlay effect
      if (!map.getLayer(overlayCircleLayerId)) {
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
              // VFR - Very light green/blue tint
              ['==', ['get', 'fltcat'], 'VFR'],
              '#00ff0015',
              // MVFR - Yellow overlay
              ['==', ['get', 'fltcat'], 'MVFR'],
              '#ffff0040',
              // IFR - Orange/Red overlay
              ['==', ['get', 'fltcat'], 'IFR'],
              '#ff8c0060',
              // LIFR - Dark red overlay
              ['==', ['get', 'fltcat'], 'LIFR'],
              '#ff000080',
              // Unknown - Light gray
              '#80808020'
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

      // Layer 2: Labels showing station ID and conditions
      if (!map.getLayer(labelLayerId)) {
        map.addLayer({
          id: labelLayerId,
          type: 'symbol',
          source: sourceId,
          layout: {
            'text-field': [
              'concat',
              ['get', 'id'],
              '\n',
              ['get', 'fltcat'],
              ' ',
              ['get', 'cover']
            ],
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            'text-size': 10,
            'text-anchor': 'top',
            'text-offset': [0, 1.2],  // Position below the airport marker
            'text-allow-overlap': false,
            'text-ignore-placement': false,
          },
          paint: {
            'text-color': [
              'case',
              ['==', ['get', 'fltcat'], 'VFR'],
              '#00ff00',
              ['==', ['get', 'fltcat'], 'MVFR'],
              '#ffff00',
              ['==', ['get', 'fltcat'], 'IFR'],
              '#ff8c00',
              ['==', ['get', 'fltcat'], 'LIFR'],
              '#ff0000',
              '#808080'
            ],
            'text-halo-color': '#ffffff',
            'text-halo-width': 2,
            'text-halo-blur': 1,
          },
          minzoom: 8, // Only show labels when zoomed in closer
        })
      }

      hasInitialized.current = true
      console.log('✅ Cloud overlay layers initialized (2 layers: overlay circles, labels)')
      console.log('   Green dots are rendered by AirportMarkers component for consistency')
    }

    // Update data when cloudData changes
    const existingSource = map.getSource(sourceId)
    if (existingSource && existingSource.type === 'geojson') {
      existingSource.setData(processedData)
      console.log(`✅ Updated cloud overlay with ${processedData.features.length} stations`)
    }

    // Cleanup function
    return () => {
      // Only remove on unmount if map still exists
      if (map && hasInitialized.current) {
        try {
          if (map.getLayer(labelLayerId)) {
            map.removeLayer(labelLayerId)
          }
          if (map.getLayer(overlayCircleLayerId)) {
            map.removeLayer(overlayCircleLayerId)
          }
          if (map.getSource(sourceId)) {
            map.removeSource(sourceId)
          }
          hasInitialized.current = false
          console.log('🧹 Cleaned up cloud overlay layers')
        } catch (e) {
          // Ignore errors during cleanup (map might be destroyed)
        }
      }
    }
  }, [map, cloudData])

  return null
}
