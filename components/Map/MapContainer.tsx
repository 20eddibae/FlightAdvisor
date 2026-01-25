'use client'

import { useState, useCallback } from 'react'
import MapView from './MapView'
import AirportMarkers from './AirportMarkers'
import WaypointMarkers from './WaypointMarkers'
import AirspaceLayer from './AirspaceLayer'
import RouteLayer from './RouteLayer'
import RouteControls from '../Controls/RouteControls'
import ReasoningPanel from '../Controls/ReasoningPanel'
import ErrorDisplay from '../Controls/ErrorDisplay'
import { loadAirports, loadWaypoints, loadAllAirspace, Airport, Waypoint, AirspaceFeatureCollection } from '@/lib/geojson'
import { calculateRouteAsync, RouteResult } from '@/lib/routing/route'
import type { MapRef } from './MapView'

export default function MapContainer() {
  const [map, setMap] = useState<MapRef | null>(null)
  const [airports, setAirports] = useState<Airport[]>([])
  const [waypoints, setWaypoints] = useState<Waypoint[]>([])
  const [airspace, setAirspace] = useState<AirspaceFeatureCollection | null>(null)

  const [route, setRoute] = useState<RouteResult | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [reasoning, setReasoning] = useState<string | null>(null)
  const [isLoadingReasoning, setIsLoadingReasoning] = useState(false)
  const [showReasoning, setShowReasoning] = useState(false)

  const [error, setError] = useState<{ title: string; message: string } | null>(null)

  const handleMapLoad = useCallback(async (loadedMap: MapRef) => {
    setMap(loadedMap)

    // Load aviation data
    try {
      const [airportsData, waypointsData, airspaceData] = await Promise.all([
        loadAirports(),
        loadWaypoints(),
        loadAllAirspace(),
      ])

      setAirports(airportsData)
      setWaypoints(waypointsData)
      setAirspace(airspaceData)
    } catch (error) {
      console.error('Failed to load aviation data:', error)
      setError({
        title: 'Data Loading Error',
        message: 'Failed to load aviation data. Please check that all data files are present and try refreshing the page.',
      })
    }
  }, [])

  const handlePlanRoute = useCallback(async () => {
    // Clear any previous errors
    setError(null)

    if (!airspace || airports.length < 2) {
      setError({
        title: 'Missing Data',
        message: 'Aviation data is still loading. Please wait a moment and try again.',
      })
      return
    }

    setIsCalculating(true)
    setShowReasoning(true)

    try {
      // Find departure and arrival airports
      const departure = airports.find((a) => a.id === 'KSQL')
      const arrival = airports.find((a) => a.id === 'KSMF')

      if (!departure || !arrival) {
        setError({
          title: 'Airport Not Found',
          message: 'Could not find KSQL or KSMF airports in the data. Please check the airport data files.',
        })
        setIsCalculating(false)
        return
      }

      // Calculate route
      const routeResult = await calculateRouteAsync({
        departure,
        arrival,
        airspace,
        waypoints,
      })

      if (!routeResult) {
        setError({
          title: 'Route Calculation Failed',
          message: 'Unable to find a valid route between the airports. This may be due to airspace restrictions.',
        })
        setIsCalculating(false)
        return
      }

      setRoute(routeResult)

      // Fetch reasoning from API
      setIsLoadingReasoning(true)
      setReasoning(null)

      try {
        const response = await fetch('/api/reasoning', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            departure: departure.id,
            arrival: arrival.id,
            departureCoords: [departure.lon, departure.lat],
            arrivalCoords: [arrival.lon, arrival.lat],
            waypoints: routeResult.waypoints,
            distance_nm: routeResult.distance_nm,
            estimated_time_min: routeResult.estimated_time_min,
            route_type: routeResult.type,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          if (data.reasoning) {
            setReasoning(data.reasoning)
          } else {
            console.warn('Reasoning API returned empty response')
          }
        } else {
          console.error('Failed to fetch reasoning:', response.status)
          // Don't show error for reasoning failure - it will use fallback
        }
      } catch (error) {
        console.error('Error fetching reasoning:', error)
        // Don't show error - reasoning panel will handle loading state
      } finally {
        setIsLoadingReasoning(false)
      }
    } catch (error) {
      console.error('Error calculating route:', error)
      setError({
        title: 'Routing Error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred while calculating the route.',
      })
    } finally {
      setIsCalculating(false)
    }
  }, [airspace, airports, waypoints])

  const handleClearRoute = useCallback(() => {
    setRoute(null)
    setReasoning(null)
    setShowReasoning(false)
  }, [])

  const handleToggleReasoning = useCallback(() => {
    setShowReasoning((prev) => !prev)
  }, [])

  const handleDismissError = useCallback(() => {
    setError(null)
  }, [])

  return (
    <>
      <MapView onMapLoad={handleMapLoad} />
      {map && airspace && <AirspaceLayer map={map} airspace={airspace} />}
      {map && airports.length > 0 && <AirportMarkers map={map} airports={airports} />}
      {map && waypoints.length > 0 && <WaypointMarkers map={map} waypoints={waypoints} />}
      {map && route && <RouteLayer map={map} coordinates={route.coordinates} />}

      {error && (
        <ErrorDisplay
          title={error.title}
          message={error.message}
          onRetry={error.title.includes('Route') ? handlePlanRoute : undefined}
          onDismiss={handleDismissError}
        />
      )}

      <RouteControls
        onPlanRoute={handlePlanRoute}
        onClearRoute={handleClearRoute}
        isCalculating={isCalculating}
        routeInfo={route ? {
          distance_nm: route.distance_nm,
          estimated_time_min: route.estimated_time_min,
          type: route.type,
        } : null}
      />

      <ReasoningPanel
        reasoning={reasoning}
        isLoading={isLoadingReasoning}
        isVisible={showReasoning}
        onToggle={handleToggleReasoning}
      />
    </>
  )
}
