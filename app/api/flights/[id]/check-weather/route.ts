import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'

/**
 * GET /api/flights/[id]/check-weather
 *
 * Callback endpoint for sim.ai to check if weather has changed for a flight.
 * Returns both baseline and current weather for comparison.
 *
 * Required:
 * - {id} in URL path: The flight ID (UUID)
 *
 * Optional query params:
 * - compare=true: Returns a detailed diff/comparison
 *
 * Example: GET /api/flights/abc-123-def/check-weather?compare=true
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: flightId } = await params
    const searchParams = req.nextUrl.searchParams
    const shouldCompare = searchParams.get('compare') === 'true'

    // Validate flight ID format (should be a UUID)
    if (!flightId || flightId.trim() === '') {
      return NextResponse.json(
        { error: 'Flight ID is required in URL path' },
        { status: 400 }
      )
    }

    console.log(`📋 Checking weather for flight: ${flightId}`)

    const supabase = getSupabaseAdmin()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 503 }
      )
    }

    // Fetch flight from Supabase
    const { data: flight, error } = await supabase
      .from('watched_flights')
      .select('*')
      .eq('id', flightId)
      .single()

    if (error || !flight) {
      console.error(`❌ Flight not found: ${flightId}`, error)
      return NextResponse.json(
        { error: 'Flight not found. Please check the flight ID.' },
        { status: 404 }
      )
    }

    // Check if flight is still active
    if (!flight.is_active) {
      console.warn(`⚠️ Flight ${flightId} is inactive`)
      return NextResponse.json(
        { error: 'Flight is no longer active' },
        { status: 410 } // 410 Gone
      )
    }

    // Get current weather for departure and arrival
    const airports = [flight.departure, flight.arrival].filter(Boolean)
    const idsParam = airports.join(',')

    const weatherUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/weather?ids=${idsParam}`

    console.log(`🌤️ Fetching current weather for flight ${flightId}: ${idsParam}`)

    const weatherResponse = await fetch(weatherUrl)

    if (!weatherResponse.ok) {
      console.error(`Weather API error: ${weatherResponse.status}`)
      return NextResponse.json(
        { error: 'Failed to fetch current weather' },
        { status: 500 }
      )
    }

    const currentWeatherData = await weatherResponse.json()

    // Extract METAR and TAF for each airport for easy access
    const departureWeather = currentWeatherData.stations?.find((s: any) => s.station === flight.departure)
    const arrivalWeather = currentWeatherData.stations?.find((s: any) => s.station === flight.arrival)

    // Prepare response with explicit METAR/TAF data
    const response: any = {
      flight_id: flight.id,
      departure: flight.departure,
      arrival: flight.arrival,
      flight_date: flight.flight_date,

      // Baseline weather (when flight was saved)
      baseline_weather: flight.baseline_weather,

      // Current weather (live data with full structure)
      current_weather: currentWeatherData,

      // Explicit METAR/TAF for easy access by sim.ai
      departure_metar: departureWeather?.metar || null,
      departure_taf: departureWeather?.taf || null,
      arrival_metar: arrivalWeather?.metar || null,
      arrival_taf: arrivalWeather?.taf || null,

      last_checked: new Date().toISOString(),
    }

    // If comparison requested, compute changes
    if (shouldCompare) {
      response.changes = compareWeather(
        flight.baseline_weather,
        currentWeatherData
      )
      response.has_significant_changes = response.changes.length > 0
      response.has_high_severity = response.changes.some((c: any) => c.severity === 'high')
    }

    // Update last_weather_check timestamp in Supabase
    await supabase
      .from('watched_flights')
      .update({
        current_weather: currentWeatherData,
        last_weather_check: new Date().toISOString(),
      })
      .eq('id', flightId)

    return NextResponse.json(response)
  } catch (error) {
    console.error('Check weather error:', error)
    return NextResponse.json(
      {
        error: 'Failed to check weather',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Compare baseline and current weather to detect significant changes
 */
function compareWeather(baseline: any, current: any) {
  const changes: Array<{
    station: string
    field: string
    baseline_value: any
    current_value: any
    severity: 'low' | 'medium' | 'high'
    description: string
  }> = []

  if (!baseline?.stations || !current?.stations) {
    return changes
  }

  // Compare each station
  for (const baseStation of baseline.stations) {
    const currentStation = current.stations.find(
      (s: any) => s.station === baseStation.station
    )

    if (!currentStation?.metar || !baseStation.metar) continue

    const baseMetar = baseStation.metar
    const currMetar = currentStation.metar

    // Check visibility changes (significant if drops below 5 SM)
    if (baseMetar.visibility && currMetar.visibility) {
      const visChange = baseMetar.visibility - currMetar.visibility
      if (Math.abs(visChange) >= 2) {
        changes.push({
          station: baseStation.station,
          field: 'visibility',
          baseline_value: `${baseMetar.visibility} SM`,
          current_value: `${currMetar.visibility} SM`,
          severity: currMetar.visibility < 5 ? 'high' : 'medium',
          description: `Visibility changed from ${baseMetar.visibility} to ${currMetar.visibility} statute miles`,
        })
      }
    }

    // Check ceiling changes (significant if drops below 3000 AGL)
    if (baseMetar.ceiling !== undefined && currMetar.ceiling !== undefined) {
      const ceilChange = Math.abs((baseMetar.ceiling || 9999) - (currMetar.ceiling || 9999))
      if (ceilChange >= 1000) {
        changes.push({
          station: baseStation.station,
          field: 'ceiling',
          baseline_value: baseMetar.ceiling ? `${baseMetar.ceiling} ft` : 'Unlimited',
          current_value: currMetar.ceiling ? `${currMetar.ceiling} ft` : 'Unlimited',
          severity: currMetar.ceiling && currMetar.ceiling < 3000 ? 'high' : 'medium',
          description: `Ceiling changed from ${baseMetar.ceiling || 'unlimited'} to ${currMetar.ceiling || 'unlimited'} feet`,
        })
      }
    }

    // Check wind changes (significant if gusts > 25kt or speed increases >10kt)
    if (baseMetar.windSpeed !== undefined && currMetar.windSpeed !== undefined) {
      const windChange = Math.abs(baseMetar.windSpeed - currMetar.windSpeed)
      if (windChange >= 10 || (currMetar.windGust && currMetar.windGust > 25)) {
        changes.push({
          station: baseStation.station,
          field: 'wind',
          baseline_value: `${baseMetar.windSpeed}kt`,
          current_value: `${currMetar.windSpeed}kt${currMetar.windGust ? ` G${currMetar.windGust}kt` : ''}`,
          severity: currMetar.windGust && currMetar.windGust > 25 ? 'high' : 'medium',
          description: `Wind changed from ${baseMetar.windSpeed}kt to ${currMetar.windSpeed}kt${currMetar.windGust ? ` gusting ${currMetar.windGust}kt` : ''}`,
        })
      }
    }

    // Check for new weather phenomena (TS, RA, SN, etc.)
    const baseRaw = (baseMetar.rawOb || '').toUpperCase()
    const currRaw = (currMetar.rawOb || '').toUpperCase()

    // Check for thunderstorms
    if (!baseRaw.includes('TS') && currRaw.includes('TS')) {
      changes.push({
        station: baseStation.station,
        field: 'weather',
        baseline_value: 'No thunderstorms',
        current_value: 'Thunderstorms present',
        severity: 'high',
        description: 'Thunderstorm activity has developed',
      })
    }

    // Check for precipitation when there wasn't any
    const hasPrecip = (raw: string) =>
      /-(RA|SN|PL|GR|GS|SG|IC|PE|UP)/.test(raw) || /\+(RA|SN|PL|GR|GS|SG|IC|PE|UP)/.test(raw)

    if (!hasPrecip(baseRaw) && hasPrecip(currRaw)) {
      changes.push({
        station: baseStation.station,
        field: 'weather',
        baseline_value: 'No precipitation',
        current_value: 'Precipitation reported',
        severity: 'medium',
        description: 'Precipitation has developed',
      })
    }

    // Check flight category changes (VFR -> MVFR -> IFR -> LIFR)
    if (baseMetar.flightCategory && currMetar.flightCategory) {
      if (baseMetar.flightCategory !== currMetar.flightCategory) {
        const severity =
          currMetar.flightCategory === 'LIFR' ? 'high' :
          currMetar.flightCategory === 'IFR' ? 'high' :
          currMetar.flightCategory === 'MVFR' ? 'medium' : 'low'

        changes.push({
          station: baseStation.station,
          field: 'flight_category',
          baseline_value: baseMetar.flightCategory,
          current_value: currMetar.flightCategory,
          severity,
          description: `Flight category changed from ${baseMetar.flightCategory} to ${currMetar.flightCategory}`,
        })
      }
    }
  }

  return changes
}
