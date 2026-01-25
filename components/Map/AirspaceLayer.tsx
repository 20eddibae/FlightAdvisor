'use client'

import { useEffect, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { AirspaceFeatureCollection } from '@/lib/geojson'
import { COLORS } from '@/lib/constants'

interface AirspaceLayerProps {
  map: mapboxgl.Map
  airspace: AirspaceFeatureCollection
}

export default function AirspaceLayer({ map, airspace }: AirspaceLayerProps) {
  const [popup] = useState(
    new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
    })
  )

  useEffect(() => {
    if (!map || !airspace || airspace.features.length === 0) return

    const sourceId = 'airspace'
    const fillLayerId = 'airspace-fill'
    const outlineLayerId = 'airspace-outline'

    const handleMouseMove = (e: mapboxgl.MapLayerMouseEvent) => {
      if (e.features && e.features.length > 0) {
        const feature = e.features[0]
        const props = feature.properties

        if (props) {
          map.getCanvas().style.cursor = 'pointer'

          popup
            .setLngLat(e.lngLat)
            .setHTML(
              `
              <div style="padding: 4px;">
                <strong>${props.name}</strong><br/>
                <span style="font-size: 11px; color: #666;">
                  Type: ${props.type.replace('_', ' ')}<br/>
                  Floor: ${props.floor_msl.toLocaleString()}' MSL<br/>
                  Ceiling: ${props.ceiling_msl.toLocaleString()}' MSL<br/>
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
      map.getCanvas().style.cursor = ''
      popup.remove()
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
      map.once('load', addLayers)
    }

    // Cleanup on unmount
    return () => {
      map.off('mousemove', fillLayerId, handleMouseMove)
      map.off('mouseleave', fillLayerId, handleMouseLeave)

      if (map.getLayer(outlineLayerId)) {
        map.removeLayer(outlineLayerId)
      }
      if (map.getLayer(fillLayerId)) {
        map.removeLayer(fillLayerId)
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId)
      }

      popup.remove()
    }
  }, [map, airspace, popup])

  return null
}
