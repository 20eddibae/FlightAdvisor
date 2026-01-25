/**
 * Cloud Region Polygons
 * Visualizes weather station groups as semi-transparent overlays across the map
 * Groups stations by flight category and creates convex hull polygons
 */

'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import convex from '@turf/convex'
import { featureCollection, point } from '@turf/helpers'
import type { MapRef } from './MapView'

interface CloudRegionPolygonsProps {
  map: MapRef | null
  cloudData: GeoJSON.FeatureCollection | null
}

export default function CloudRegionPolygons({ map, cloudData }: CloudRegionPolygonsProps) {
  const sourceId = 'cloud-region-polygons'
  const layerId = 'cloud-region-fill'
  const outlineLayerId = 'cloud-region-outline'
  const hasInitialized = useRef(false)

  useEffect(() => {
    if (!map || !cloudData) {
      console.log('⚠️ CloudRegionPolygons: Missing map or cloud data')
      return
    }

    console.log('🌤️ CloudRegionPolygons: Creating weather region polygons from station data')

    // Group stations by flight category and cloud coverage
    const groupedStations: Record<string, any[]> = {
      'LIFR': [],
      'IFR': [],
      'MVFR': [],
      'VFR_POOR': [], // VFR with BKN/OVC
      // VFR with clear/few/scattered gets no polygon
    }

    cloudData.features.forEach((feature: any) => {
      const props = feature.properties
      const coords = feature.geometry?.coordinates

      if (!props || !coords) return

      const fltcat = props.fltcat || 'UNKNOWN'
      const cover = props.cover || 'UNKNOWN'

      // Categorize by severity
      if (fltcat === 'LIFR') {
        groupedStations.LIFR.push(feature)
      } else if (fltcat === 'IFR') {
        groupedStations.IFR.push(feature)
      } else if (fltcat === 'MVFR') {
        groupedStations.MVFR.push(feature)
      } else if (fltcat === 'VFR' && (cover === 'BKN' || cover === 'OVC')) {
        groupedStations.VFR_POOR.push(feature)
      }
      // Skip VFR with clear/few/scattered
    })

    console.log('📊 Station groups:', {
      LIFR: groupedStations.LIFR.length,
      IFR: groupedStations.IFR.length,
      MVFR: groupedStations.MVFR.length,
      VFR_POOR: groupedStations.VFR_POOR.length
    })

    // Create convex hull polygons for each group
    const regionPolygons: any[] = []

    Object.entries(groupedStations).forEach(([category, stations]) => {
      if (stations.length < 3) {
        console.log(`⚠️ ${category} has only ${stations.length} stations, need at least 3 for polygon`)
        return
      }

      // Create points for convex hull
      const points = stations.map((station: any) => {
        const coords = station.geometry.coordinates
        return point(coords)
      })

      // Create convex hull
      const hull = convex(featureCollection(points))

      if (!hull) {
        console.warn(`⚠️ Failed to create convex hull for ${category}`)
        return
      }

      // Add properties
      hull.properties = {
        category,
        stationCount: stations.length,
        // Calculate average ceiling from stations in this group
        averageCeiling: Math.round(
          stations
            .filter((s: any) => s.properties?.ceil)
            .reduce((sum: number, s: any) => sum + (s.properties.ceil || 0), 0) /
          stations.filter((s: any) => s.properties?.ceil).length || 0
        ),
        lowestCeiling: Math.min(
          ...stations
            .map((s: any) => s.properties?.ceil)
            .filter((c: any) => c !== null && c !== undefined)
        )
      }

      regionPolygons.push(hull)
      console.log(`✅ Created ${category} polygon with ${stations.length} stations`)
    })

    if (regionPolygons.length === 0) {
      console.warn('⚠️ No cloud region polygons to display (all conditions are good or insufficient data)')
      return
    }

    const polygonCollection = {
      type: 'FeatureCollection',
      features: regionPolygons
    }

    console.log(`✅ Created ${regionPolygons.length} total weather region polygons`)

    // Initialize layers once
    if (!hasInitialized.current) {
      console.log('🎨 Initializing cloud region polygon layers...')

      // Add source
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: 'geojson',
          data: polygonCollection as any
        })
      }

      // Layer 1: Semi-transparent fill based on category
      if (!map.getLayer(layerId)) {
        map.addLayer({
          id: layerId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': [
              'match',
              ['get', 'category'],
              'VFR_POOR', '#ffff0040',  // Yellow (VFR with broken/overcast)
              'MVFR', '#ff8c0060',      // Orange (moderate visibility)
              'IFR', '#ff0000a0',       // Red (high visibility)
              'LIFR', '#ff0000c0',      // Dark red (very visible)
              '#80808030'               // Default gray
            ],
            'fill-opacity': 0.5  // Fixed 50% opacity - visible but not overwhelming
          }
        })
      }

      // Layer 2: Outline for visual clarity
      if (!map.getLayer(outlineLayerId)) {
        map.addLayer({
          id: outlineLayerId,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': [
              'match',
              ['get', 'category'],
              'VFR_POOR', '#ffff00',
              'MVFR', '#ff8c00',
              'IFR', '#ff0000',
              'LIFR', '#ff0000',
              '#808080'
            ],
            'line-width': 2,
            'line-opacity': 0.8,
            'line-dasharray': [3, 2] // Dashed line
          }
        })
      }

      hasInitialized.current = true
      console.log('✅ Cloud region polygon layers initialized')

      // Add click handler for region info
      map.on('click', layerId, (e) => {
        if (!e.features || e.features.length === 0) return

        const feature = e.features[0]
        const props = feature.properties

        if (!props) return

        const ceilingText = props.averageCeiling && props.averageCeiling > 0
          ? `${props.averageCeiling}ft avg`
          : 'N/A'
        const lowestText = props.lowestCeiling && props.lowestCeiling < 10000
          ? `, lowest ${props.lowestCeiling}ft`
          : ''

        const categoryDisplay: Record<string, { icon: string; name: string; color: string }> = {
          'LIFR': { icon: '⛈️', name: 'Low IFR', color: '#ff0000' },
          'IFR': { icon: '🌧️', name: 'IFR Conditions', color: '#ff0000' },
          'MVFR': { icon: '☁️', name: 'Marginal VFR', color: '#ff8c00' },
          'VFR_POOR': { icon: '⛅', name: 'VFR with Clouds', color: '#ffff00' }
        }

        const info = categoryDisplay[props.category] || { icon: '❓', name: props.category, color: '#808080' }

        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="padding: 8px; font-family: sans-serif; min-width: 220px;">
              <strong style="font-size: 14px; color: ${info.color};">${info.icon} ${info.name}</strong><br/>
              <div style="margin-top: 6px; font-size: 12px;">
                <strong>Region covers ${props.stationCount} weather stations</strong><br/>
                <strong>Ceiling:</strong> ${ceilingText}${lowestText}<br/>
              </div>
              <div style="margin-top: 4px; padding: 4px; background: ${info.color}20; border-left: 3px solid ${info.color}; font-size: 11px;">
                ${props.category === 'LIFR' ? 'VFR flight NOT RECOMMENDED' :
                  props.category === 'IFR' ? 'IFR conditions - VFR at own risk' :
                  props.category === 'MVFR' ? 'Marginal VFR - monitor closely' :
                  'VFR acceptable with caution'}
              </div>
            </div>
          `)
          .addTo(map)
      })

      // Change cursor on hover
      map.on('mouseenter', layerId, () => {
        map.getCanvas().style.cursor = 'pointer'
      })

      map.on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = ''
      })
    } else {
      // Update existing source with new data
      const existingSource = map.getSource(sourceId)
      if (existingSource && existingSource.type === 'geojson') {
        existingSource.setData(polygonCollection as any)
        console.log(`✅ Updated cloud region polygons with ${regionPolygons.length} regions`)
      }
    }

    // Cleanup function
    return () => {
      if (map && hasInitialized.current) {
        try {
          if (map.getLayer(outlineLayerId)) {
            map.removeLayer(outlineLayerId)
          }
          if (map.getLayer(layerId)) {
            map.removeLayer(layerId)
          }
          if (map.getSource(sourceId)) {
            map.removeSource(sourceId)
          }
          hasInitialized.current = false
          console.log('🧹 Cleaned up cloud region polygon layers')
        } catch (e) {
          // Ignore errors during cleanup
        }
      }
    }
  }, [map, cloudData])

  return null
}
