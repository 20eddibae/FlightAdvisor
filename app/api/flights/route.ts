import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'

/**
 * GET /api/flights?email=pilot@example.com
 * Get all watched flights for a pilot
 */
export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get('email')

    if (!email) {
      return NextResponse.json(
        { error: 'Missing required query parameter: email' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 503 }
      )
    }
    const { data, error } = await supabase
      .from('watched_flights')
      .select('*')
      .eq('pilot_email', email)
      .order('flight_date', { ascending: true })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Separate active flights with alerts for easy access
    const flights = data || []
    const activeFlights = flights.filter(f => f.is_active && new Date(f.flight_date) >= new Date())
    const alertFlights = activeFlights.filter(f => f.has_alert && !f.alert_acknowledged)

    return NextResponse.json({
      flights,
      activeFlights,
      alertFlights,
      totalAlerts: alertFlights.length,
    })
  } catch (error) {
    console.error('Get flights error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch flights' },
      { status: 500 }
    )
  }
}
