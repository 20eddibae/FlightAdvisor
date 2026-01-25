'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import MapView from './MapView'
import RouteControls from '../Controls/RouteControls'
import ReasoningPanel from '../Controls/ReasoningPanel'
import ErrorDisplay from '../Controls/ErrorDisplay'
import type { Airport, Waypoint, AirspaceFeatureCollection } from '@/lib/geojson'
import { calculateRouteAsync, RouteResult } from '@/lib/routing/route'
import type { MapRef } from './MapView'
import type { RouteReasoningResponse } from '@/lib/api/gemini'

// Dynamically import map layers to avoid SSR issues with Mapbox GL
const AirportMarkers = dynamic(() => import('./AirportMarkers'), { ssr: false })
const WaypointMarkers = dynamic(() => import('./WaypointMarkers'), { ssr: false })
const AirspaceLayer = dynamic(() => import('./AirspaceLayer'), { ssr: false })
const RouteLayer = dynamic(() => import('./RouteLayer'), { ssr: false })


export default function MapContainer() {
  const [map, setMap] = useState<MapRef | null>(null)
  const [airports, setAirports] = useState<Airport[]>([])
  const [waypoints, setWaypoints] = useState<Waypoint[]>([])
  const [airspace, setAirspace] = useState<AirspaceFeatureCollection | null>(null)

  const [route, setRoute] = useState<RouteResult | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [reasoning, setReasoning] = useState<RouteReasoningResponse | null>(null)
  const [isLoadingReasoning, setIsLoadingReasoning] = useState(false)
  const [showReasoning, setShowReasoning] = useState(false)

  const [error, setError] = useState<{ title: string; message: string } | null>(null)

  const handleMapLoad = useCallback(async (loadedMap: MapRef) => {
    setMap(loadedMap)

    // NorCal bounds for OpenAIP queries (KSQL to KSMF region)
    const bounds = '-123,37,-121,39'

    // Load aviation data from API routes
    try {
      console.log('Loading aviation data from OpenAIP API...')

      const [airportsRes, navaidsRes, airspaceRes] = await Promise.all([
        fetch(`/api/openaip?type=airports&bounds=${bounds}`),
        fetch(`/api/openaip?type=navaids&bounds=${bounds}`),
        fetch(`/api/openaip?type=airspace&bounds=${bounds}`),
      ])

      if (!airportsRes.ok || !navaidsRes.ok || !airspaceRes.ok) {
        throw new Error('Failed to fetch aviation data from OpenAIP API')
      }

      const [airportsData, navaidsData, airspaceData] = await Promise.all([
        airportsRes.json(),
        navaidsRes.json(),
        airspaceRes.json(),
      ])

      // Convert API response to internal format
      const airports: Airport[] = airportsData.data.map((ap: any) => ({
        id: ap.icaoCode || ap._id,
        name: ap.name,
        lat: ap.geometry.coordinates[1],
        lon: ap.geometry.coordinates[0],
        elevation: ap.elevation?.value || 0,
        type: ap.trafficType?.includes(0) ? 'towered' : 'non-towered', // 0 = IFR
        notes: `Type: ${ap.type}`,
      }))

      const waypoints: Waypoint[] = navaidsData.data.map((navaid: any) => ({
        id: navaid._id,
        name: navaid.name,
        lat: navaid.geometry.coordinates[1],
        lon: navaid.geometry.coordinates[0],
        type: navaid.type === 4 ? 'VOR' : navaid.type === 3 ? 'NDB' : 'GPS_FIX', // Simplified type mapping
        frequency: navaid.frequency
          ? `${navaid.frequency.value} ${navaid.frequency.unit}`
          : undefined,
        description: `Type ${navaid.type} navigation aid`,
      }))

      const airspace: AirspaceFeatureCollection = airspaceData.data

      setAirports(airports)
      setWaypoints(waypoints)
      setAirspace(airspace)

      console.log(
        `✓ Loaded ${airports.length} airports, ${waypoints.length} waypoints, ${airspace.features.length} airspace features`
      )
    } catch (error) {
      console.error('Failed to load aviation data:', error)
      setError({
        title: 'Data Loading Error',
        message:
          'Failed to load aviation data from OpenAIP. Ensure OPEN_AIP_API_KEY is set in .env.local and restart the dev server.',
      })
    }
  }, [])

  const handlePlanRoute = useCallback(async (departureCode: string, destinationCode: string) => {
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
      const departure = airports.find((a) => a.id === departureCode)
      const arrival = airports.find((a) => a.id === destinationCode)

      if (!departure || !arrival) {
        setError({
          title: 'Airport Not Found',
          message: `Could not find ${!departure ? departureCode : destinationCode} airport in the data. Please check the airport code.`,
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
        // Extract waypoint coordinates from route
        const waypointCoords = routeResult.coordinates.slice(1, -1) as Array<[number, number]>

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
            waypointCoords: waypointCoords,
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
          onRetry={undefined}
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
