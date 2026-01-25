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
    if (!isMapLoaded || !airspace || airspace.features.length === 0) return

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

    const addLayers = () => {
      // Add GeoJSON source
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: 'geojson',
          data: airspace,
        })
      }

      // Add fill layer for airspace polygons
      if (!map.getLayer(fillLayerId)) {
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
            'fill-opacity': 0.6,
          },
        })
      }

      // Add outline layer for airspace polygons
      if (!map.getLayer(outlineLayerId)) {
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
      }

      // Add hover effects
      map.on('mousemove', fillLayerId, handleMouseMove)
      map.on('mouseleave', fillLayerId, handleMouseLeave)
    }

    // Check if map style is loaded
    if (map.isStyleLoaded()) {
      addLayers()
    } else {
      // Use once() - it automatically removes itself after firing
      map.once('load', addLayers)
    }

    // Cleanup on unmount
    return () => {
      // Check if map is still valid before trying to remove layers/listeners
      // Using try-catch because accessing map properties on a destroyed map can throw
      try {
        // Always remove event listeners first
        map.off('mousemove', fillLayerId, handleMouseMove)
        map.off('mouseleave', fillLayerId, handleMouseLeave)

        // Only remove layers/sources if the map style is still loaded
        // This prevents "undefined is not an object (evaluating 'this.style.getOwnLayer')"
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
  }, [map, airspace]) // Removed popup from dependency array as it's a ref

  return null
}
