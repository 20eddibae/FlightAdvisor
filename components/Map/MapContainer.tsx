'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import MapView from './MapView'
import RouteControls from '../Controls/RouteControls'
import ReasoningPanel from '../Controls/ReasoningPanel'
import ErrorDisplay from '../Controls/ErrorDisplay'
import { CacheStatus } from '../Controls/CacheStatus'
import type { Airport, Waypoint, AirspaceFeatureCollection } from '@/lib/geojson'
import { calculateRouteAsync, RouteResult } from '@/lib/routing/route'
import type { MapRef } from './MapView'
import { US_REGIONS, FEATURE_FLAGS } from '@/lib/constants'
import type { RouteReasoningResponse } from '@/lib/api/gemini'
import { useAirportCache } from '../Cache/AirportCacheProvider'

// Dynamically import map layers to avoid SSR issues with Mapbox GL
const AirportMarkers = dynamic(() => import('./AirportMarkers'), { ssr: false })
const WaypointMarkers = dynamic(() => import('./WaypointMarkers'), { ssr: false })
const AirspaceLayer = dynamic(() => import('./AirspaceLayer'), { ssr: false })
const RouteLayer = dynamic(() => import('./RouteLayer'), { ssr: false })


export default function MapContainer() {
  const { cache, getAirportsInViewport, getAirportById, isInitialized } = useAirportCache()

  const [map, setMap] = useState<MapRef | null>(null)
  const [airports, setAirports] = useState<Airport[]>([])
  const [waypoints, setWaypoints] = useState<Waypoint[]>([])
  const [airspace, setAirspace] = useState<AirspaceFeatureCollection | null>(null)

  // Debug: Track render count
  const renderCount = useRef(0)
  renderCount.current++
  console.log(`🔄 MapContainer render #${renderCount.current}`)

  const [route, setRoute] = useState<RouteResult | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [reasoning, setReasoning] = useState<RouteReasoningResponse | null>(null)
  const [isLoadingReasoning, setIsLoadingReasoning] = useState(false)
  const [showReasoning, setShowReasoning] = useState(false)
  const [weather, setWeather] = useState<Array<{
    station: string
    metar: any | null
    taf: any | null
  }> | undefined>(undefined)

  const [error, setError] = useState<{ title: string; message: string } | null>(null)

  // Debounce timer for viewport updates
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Viewport cache for navaids and airspace (5 minute TTL)
  const viewportCacheRef = useRef<Map<string, {
    navaids: Waypoint[]
    airspace: AirspaceFeatureCollection
    timestamp: number
  }>>(new Map())

  // Store event handler reference for proper cleanup
  const moveEndHandlerRef = useRef<(() => void) | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('MapContainer unmounting, cleaning up...')

      // Clear debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }

      // Remove map event listener
      if (map && moveEndHandlerRef.current) {
        try {
          map.off('moveend', moveEndHandlerRef.current)
          console.log('✓ Cleaned up moveend listener')
        } catch (e) {
          // Ignore - map might already be destroyed
        }
        moveEndHandlerRef.current = null
      }

      // Clear viewport cache
      viewportCacheRef.current.clear()
    }
  }, [map])

  const loadDataForViewport = useCallback(async (mapInstance: MapRef) => {
    try {
      // Get current viewport bounds
      const bounds = mapInstance.getBounds()
      if (!bounds) return

      const sw = bounds.getSouthWest()
      const ne = bounds.getNorthEast()
      const bbox = `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`
      const boundsArray: [number, number, number, number] = [sw.lng, sw.lat, ne.lng, ne.lat]
      const cacheKey = bbox // Use bbox as cache key for navaids/airspace

      console.log('Loading aviation data for visible region...')

      // Wait for cache to be ready if using cache
      if (FEATURE_FLAGS.USE_AIRPORT_CACHE && !isInitialized) {
        console.log('Cache not ready yet, will load data once initialized')
        return // Skip loading until cache is ready
      }

      // === FIX 1: Non-blocking airport cache load ===
      // Show cached airports IMMEDIATELY, load missing regions in background
      let airports: Airport[] = []

      if (FEATURE_FLAGS.USE_AIRPORT_CACHE && isInitialized && cache) {
        // Get what we have NOW (even if incomplete)
        const cachedAirports = getAirportsInViewport(boundsArray)

        // Convert and display immediately
        airports = cachedAirports
          .filter(ap => ap && ap.id && ap.name)
          .map(ap => ({
            id: ap.id,
            name: ap.name,
            lat: ap.lat,
            lon: ap.lon,
            elevation: ap.elevation || 0,
            type: ap.type || 'non-towered',
            notes: ap.notes || undefined,
          }))

        // Render cached airports NOW
        setAirports(airports)
        console.log(`✓ Showing ${airports.length} cached airports immediately`)

        // Load missing regions in BACKGROUND (non-blocking)
        cache.loadRegionsForViewport(boundsArray).then(() => {
          // Update with fresh data when ready
          const updated = getAirportsInViewport(boundsArray)
            .filter(ap => ap && ap.id && ap.name)
            .map(ap => ({
              id: ap.id,
              name: ap.name,
              lat: ap.lat,
              lon: ap.lon,
              elevation: ap.elevation || 0,
              type: ap.type || 'non-towered',
              notes: ap.notes || undefined,
            }))

          // Only update if we got more airports
          if (updated.length > airports.length) {
            setAirports(updated)
            console.log(`✓ Updated to ${updated.length} airports after background load`)
          }
        }).catch(err => {
          console.warn('Background region load failed:', err)
          // Don't show error - cached data is already displayed
        })
      } else {
        // Fallback to API if cache disabled or not initialized
        const airportsRes = await fetch(`/api/openaip?type=airports&bounds=${bbox}`)
        if (!airportsRes.ok) {
          console.warn('Failed to fetch airports from API, continuing with other data')
        } else {
          const airportsData = await airportsRes.json()
          airports = airportsData.data.map((ap: any) => ({
            id: ap.icaoCode || ap._id,
            name: ap.name,
            lat: ap.geometry.coordinates[1],
            lon: ap.geometry.coordinates[0],
            elevation: ap.elevation?.value || 0,
            type: ap.trafficType?.includes(0) ? 'towered' : 'non-towered',
            notes: `Type: ${ap.type}`,
          }))
          setAirports(airports)
        }
      }

      // === FIX 2: Cache navaids and airspace ===
      const viewportCache = viewportCacheRef.current
      const cached = viewportCache.get(cacheKey)
      const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

      if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        // Use cached navaids and airspace
        setWaypoints(cached.navaids)
        setAirspace(cached.airspace)
        console.log(`✓ Using cached navaids/airspace for ${cacheKey}`)
      } else {
        // Fetch navaids and airspace (in parallel)
        try {
          const [navaidsRes, airspaceRes] = await Promise.all([
            fetch(`/api/openaip?type=navaids&bounds=${bbox}`),
            fetch(`/api/openaip?type=airspace&bounds=${bbox}`),
          ])

          // Handle partial failures gracefully
          let waypoints: Waypoint[] = []
          let airspace: AirspaceFeatureCollection = { type: 'FeatureCollection', features: [] }

          if (navaidsRes.ok) {
            const navaidsData = await navaidsRes.json()
            waypoints = navaidsData.data.map((navaid: any) => ({
              id: navaid._id,
              name: navaid.name,
              lat: navaid.geometry.coordinates[1],
              lon: navaid.geometry.coordinates[0],
              type: navaid.type === 4 ? 'VOR' : navaid.type === 3 ? 'NDB' : 'GPS_FIX',
              frequency: navaid.frequency
                ? `${navaid.frequency.value} ${navaid.frequency.unit}`
                : undefined,
              description: `Type ${navaid.type} navigation aid`,
            }))
          } else {
            console.warn('Failed to fetch navaids, using empty set')
          }

          if (airspaceRes.ok) {
            const airspaceData = await airspaceRes.json()
            airspace = airspaceData.data
          } else {
            console.warn('Failed to fetch airspace, using empty set')
          }

          // Update state
          setWaypoints(waypoints)
          setAirspace(airspace)

          // Cache for future use
          viewportCache.set(cacheKey, {
            navaids: waypoints,
            airspace,
            timestamp: Date.now()
          })

          console.log(
            `✓ Loaded ${waypoints.length} waypoints, ${airspace.features.length} airspace features`
          )
        } catch (error) {
          console.warn('Error loading navaids/airspace:', error)
          // Don't show error - airports are already displayed
          // Use empty sets
          setWaypoints([])
          setAirspace({ type: 'FeatureCollection', features: [] })
        }
      }
    } catch (error) {
      console.error('Critical error loading aviation data:', error)
      // Show error only for critical failures
      setError({
        title: 'Data Loading Error',
        message: 'Failed to load aviation data. Please check your connection and try again.',
      })
    }
  }, [cache, isInitialized, getAirportsInViewport])

  // Load data once cache is ready (if map loaded before cache was ready)
  const hasLoadedDataRef = useRef(false)
  useEffect(() => {
    if (isInitialized && map && !hasLoadedDataRef.current) {
      console.log('Cache now ready, loading data for existing map')
      hasLoadedDataRef.current = true
      loadDataForViewport(map)
    }
  }, [isInitialized, map, loadDataForViewport])

  const handleMapLoad = useCallback(async (loadedMap: MapRef) => {
    console.log('Map loaded, initializing...')
    setMap(loadedMap)

    // Only load data if cache is ready
    if (FEATURE_FLAGS.USE_AIRPORT_CACHE && !isInitialized) {
      console.log('Waiting for cache to initialize before loading data...')
      // Don't load yet, wait for cache
      // Data will load when cache becomes ready (see useEffect below)
      return
    }

    // Load initial data for viewport
    console.log('Loading initial viewport data...')
    await loadDataForViewport(loadedMap)

    // Remove old event listener if exists
    if (moveEndHandlerRef.current) {
      try {
        loadedMap.off('moveend', moveEndHandlerRef.current)
      } catch (e) {
        // Ignore errors from removing non-existent listeners
      }
    }

    // Reload data when map stops moving (pan/zoom complete)
    // Debounce to prevent excessive calls during rapid panning
    const handleMoveEnd = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      debounceTimerRef.current = setTimeout(() => {
        // Check if map is still valid before calling
        try {
          if (loadedMap && loadedMap.getStyle()) {
            loadDataForViewport(loadedMap)
          }
        } catch (e) {
          console.warn('Map no longer valid:', e)
        }
      }, 300) // 300ms debounce
    }

    // Store reference for cleanup
    moveEndHandlerRef.current = handleMoveEnd

    // Add event listener
    loadedMap.on('moveend', handleMoveEnd)
    console.log('Map initialization complete')
  }, [loadDataForViewport, isInitialized])

  const handlePlanRoute = useCallback(async (departureCode: string, destinationCode: string, maxSegmentLength?: number) => {
    console.log('🛫 Planning route:', departureCode, '→', destinationCode, maxSegmentLength ? `(Max Segment: ${maxSegmentLength} NM)` : '')
    // Clear any previous errors
    setError(null)

    if (!airspace) {
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
      // Use cache if available to find airports anywhere in the US, not just in viewport
      let departure: Airport | undefined
      let arrival: Airport | undefined

      if (FEATURE_FLAGS.USE_AIRPORT_CACHE && isInitialized && getAirportById && cache) {
        console.log('Looking up airports in cache...')
        let cachedDep = getAirportById(departureCode)
        let cachedArr = getAirportById(destinationCode)

        console.log('Cache lookup results:', {
          departure: cachedDep ? cachedDep.id : 'NOT FOUND',
          arrival: cachedArr ? cachedArr.id : 'NOT FOUND',
          cacheInitialized: isInitialized,
          totalAirports: cache.getAllAirports().length
        })

        // If airports not found, force-load West Coast region (contains KSQL, KSMF)
        if (!cachedDep || !cachedArr) {
          console.log('Airports not in cache, loading West Coast region...')
          try {
            await cache.loadRegion('West Coast')
            // Try lookup again
            cachedDep = getAirportById(departureCode)
            cachedArr = getAirportById(destinationCode)
            console.log('After loading West Coast:', {
              departure: cachedDep ? cachedDep.id : 'STILL NOT FOUND',
              arrival: cachedArr ? cachedArr.id : 'STILL NOT FOUND'
            })
          } catch (err) {
            console.error('Failed to load West Coast region:', err)
          }
        }

        if (cachedDep) {
          departure = {
            id: cachedDep.id,
            name: cachedDep.name,
            lat: cachedDep.lat,
            lon: cachedDep.lon,
            elevation: cachedDep.elevation,
            type: cachedDep.type,
            notes: cachedDep.notes,
          }
        }

        if (cachedArr) {
          arrival = {
            id: cachedArr.id,
            name: cachedArr.name,
            lat: cachedArr.lat,
            lon: cachedArr.lon,
            elevation: cachedArr.elevation,
            type: cachedArr.type,
            notes: cachedArr.notes,
          }
        }
      } else {
        // Fallback to viewport airports
        departure = airports.find((a) => a.id === departureCode)
        arrival = airports.find((a) => a.id === destinationCode)
      }

      if (!departure || !arrival) {
        setError({
          title: 'Airport Not Found',
          message: `Could not find ${!departure ? departureCode : destinationCode} airport. Please check the airport code and try again.`,
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
        maxSegmentLength,
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

        // Compute bounding box for hazards fetching
        const lons = routeResult.coordinates.map(c => c[0])
        const lats = routeResult.coordinates.map(c => c[1])
        const minLon = Math.min(...lons)
        const maxLon = Math.max(...lons)
        const minLat = Math.min(...lats)
        const maxLat = Math.max(...lats)
        const bounds = `${minLon},${minLat},${maxLon},${maxLat}`

        // Fetch weather (METAR/TAF for departure & arrival) and hazards in parallel
        const weatherIds = [departure.id, arrival.id].join(',')

        const [weatherRes, hazardsRes] = await Promise.all([
          fetch(`/api/weather?ids=${encodeURIComponent(weatherIds)}`),
          fetch(`/api/hazards?bounds=${encodeURIComponent(bounds)}`),
        ])

        let weatherData: any = null
        let hazardsData: any = null

        if (weatherRes && weatherRes.ok) {
          try {
            weatherData = await weatherRes.json()
            // Store weather data in state for the reasoning panel
            if (weatherData?.stations) {
              setWeather(weatherData.stations)
            }
          } catch (e) {
            console.warn('Failed parsing weather response', e)
          }
        }

        if (hazardsRes && hazardsRes.ok) {
          try { hazardsData = await hazardsRes.json() } catch (e) { console.warn('Failed parsing hazards response', e) }
        }

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
            weather: weatherData?.stations || undefined,
            hazards: hazardsData?.hazards || undefined,
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
  }, [airspace, airports, waypoints, isInitialized, getAirportById, cache])

  const handleClearRoute = useCallback(() => {
    setRoute(null)
    setReasoning(null)
    setShowReasoning(false)
    setWeather(undefined)
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
          distance_nm: Math.round(route.distance_nm),
          estimated_time_min: route.estimated_time_min,
          type: route.type,
        } : null}
      />

      <ReasoningPanel
        reasoning={reasoning}
        isLoading={isLoadingReasoning}
        isVisible={showReasoning}
        onToggle={handleToggleReasoning}
        weather={weather}
      />

      <CacheStatus />
    </>
  )
}
