import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

/**
 * POST /api/watch-route
 * Save a flight to be monitored by sim.ai for weather changes
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Validate required fields
    if (!body.pilot_email || !body.departure || !body.arrival || !body.flight_date) {
      return NextResponse.json(
        { error: 'Missing required fields: pilot_email, departure, arrival, flight_date' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('watched_flights')
      .insert({
        pilot_email: body.pilot_email,
        pilot_name: body.pilot_name || null,
        departure: body.departure,
        arrival: body.arrival,
        flight_date: body.flight_date,
        route_data: body.route_data || {},
        baseline_weather: body.baseline_weather || null,
        is_active: true,
        has_alert: false,
      })
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, flight: data })
  } catch (error) {
    console.error('Watch route error:', error)
    return NextResponse.json(
      { error: 'Failed to save flight' },
      { status: 500 }
    )
  }
}
