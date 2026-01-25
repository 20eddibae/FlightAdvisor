'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { AirspaceFeatureCollection } from '@/lib/geojson'
import { COLORS } from '@/lib/constants'

interface AirspaceLayerProps {
  map: mapboxgl.Map
  airspace: AirspaceFeatureCollection
}

export default function AirspaceLayer({ map, airspace }: AirspaceLayerProps) {
  // Use a ref for the popup to ensure we don't create multiple instances or lose track
  const popupRef = useRef<mapboxgl.Popup | null>(null)

  // Track if listeners have been added to prevent duplicates
  const listenersAddedRef = useRef(false)

  useEffect(() => {
    if (!popupRef.current) {
      popupRef.current = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
      })
    }
  }, [])

  useEffect(() => {
    // Check if map is valid and has style (not destroyed)
    const isMapLoaded = map && map.getStyle();
    if (!isMapLoaded || !airspace || airspace.features.length === 0) {
      console.log('Airspace layer: waiting for map or data...', {
        hasMap: !!map,
        hasStyle: map ? !!map.getStyle() : false,
        hasAirspace: !!airspace,
        featureCount: airspace?.features.length || 0
      })
      return
    }

    console.log(`✓ Rendering ${airspace.features.length} airspace features`)

    const sourceId = 'airspace'
    const fillLayerId = 'airspace-fill'
    const outlineLayerId = 'airspace-outline'

    const handleMouseMove = (e: mapboxgl.MapLayerMouseEvent) => {
      // Safety check: ensure map and style are still valid
      if (!map || !map.getStyle()) return;

      if (e.features && e.features.length > 0) {
        const feature = e.features[0]
        const props = feature.properties

        // Robust check for properties
        if (props) {
          map.getCanvas().style.cursor = 'pointer'

          const floor = props.floor_msl !== undefined && props.floor_msl !== null
            ? Number(props.floor_msl).toLocaleString()
            : 'N/A';

          const ceiling = props.ceiling_msl !== undefined && props.ceiling_msl !== null
            ? Number(props.ceiling_msl).toLocaleString()
            : 'N/A';

          const type = props.type && typeof props.type === 'string'
            ? props.type.replace('_', ' ')
            : 'Unknown';
          const name = props.name || 'Unknown Airspace';

          popupRef.current
            ?.setLngLat(e.lngLat)
            .setHTML(
              `
              <div style="padding: 4px;">
                <strong>${name}</strong><br/>
                <span style="font-size: 11px; color: #666;">
                  Type: ${type}<br/>
                  Floor: ${floor}' MSL<br/>
                  Ceiling: ${ceiling}' MSL<br/>
                  ${props.notes ? `<br/>${props.notes}` : ''}
                </span>
              </div>
            `
            )
            .addTo(map)
        }
      }
    }

    const handleMouseLeave = () => {
      if (map && map.getStyle()) {
        map.getCanvas().style.cursor = ''
      }
      popupRef.current?.remove()
    }

    const updateLayers = () => {
      // Add or update GeoJSON source
      const existingSource = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined
      if (existingSource) {
        // Update existing source with new data - this is instant and doesn't remove layers
        existingSource.setData(airspace)
        console.log(`⚡ Updated airspace source (${airspace.features.length} features) - no layer re-creation`)
        return // Don't need to re-add layers if they already exist
      }

      console.log(`🎨 Creating airspace layers for ${airspace.features.length} features...`)
      const startTime = performance.now()

      // Source doesn't exist - add it and the layers
      map.addSource(sourceId, {
        type: 'geojson',
        data: airspace,
        // Performance optimization: set tolerance to simplify polygons at lower zoom levels
        // Set to 0 to ensure visibility at all zoom levels as requested
        tolerance: 0,
        buffer: 128, // Default is 128, lower = less memory but more updates
      })

      // Add fill layer for airspace polygons
      map.addLayer({
        id: fillLayerId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': [
            'match',
            ['get', 'type'],
            'CLASS_B',
            COLORS.CLASS_B_FILL,
            'RESTRICTED',
            COLORS.RESTRICTED_FILL,
            COLORS.RESTRICTED_FILL, // default
          ],
          'fill-opacity': 0.8,
        },
      })

      // Add outline layer for airspace polygons
      map.addLayer({
        id: outlineLayerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': [
            'match',
            ['get', 'type'],
            'CLASS_B',
            COLORS.CLASS_B_STROKE,
            'RESTRICTED',
            COLORS.RESTRICTED_STROKE,
            COLORS.RESTRICTED_STROKE, // default
          ],
          'line-width': 2,
          'line-dasharray': [2, 2],
        },
      })

      // Add hover effects - only add ONCE when layers are created
      if (!listenersAddedRef.current) {
        map.on('mousemove', fillLayerId, handleMouseMove)
        map.on('mouseleave', fillLayerId, handleMouseLeave)
        listenersAddedRef.current = true
        console.log('✓ Added hover event listeners')
      }

      const endTime = performance.now()
      console.log(`✓ Airspace layers created in ${(endTime - startTime).toFixed(2)}ms`)
    }

    // Check if map style is loaded
    if (map.isStyleLoaded()) {
      updateLayers()
    } else {
      // Use once() - it automatically removes itself after firing
      map.once('load', () => {
        if (map.getStyle()) {
          updateLayers()
        }
      })
    }

    // Cleanup ONLY on actual unmount (not on every re-render)
    return () => {
      // Check if map is still valid before trying to remove layers/listeners
      try {
        // Remove event listeners only if they were added
        if (listenersAddedRef.current) {
          map.off('mousemove', fillLayerId, handleMouseMove)
          map.off('mouseleave', fillLayerId, handleMouseLeave)
          listenersAddedRef.current = false
        }

        // Only remove layers/sources if the map style is still loaded
        if (map.getStyle()) {
          if (map.getLayer(outlineLayerId)) {
            map.removeLayer(outlineLayerId)
          }
          if (map.getLayer(fillLayerId)) {
            map.removeLayer(fillLayerId)
          }
          if (map.getSource(sourceId)) {
            map.removeSource(sourceId)
          }
        }
      } catch (err) {
        console.warn('Error during airspace cleanup:', err)
      }

      popupRef.current?.remove()
    }
  }, [map, airspace])

  return null
}
