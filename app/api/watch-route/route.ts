import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'

/**
 * POST /api/watch-route
 * Save a flight to be monitored by sim.ai for weather changes
 */
export async function POST(req: NextRequest) {
  console.log('🟢 /api/watch-route HIT - Request received')

  try {
    const body = await req.json()
    console.log('📦 Request body:', body)

    // Validate required fields
    if (!body.pilot_email || !body.departure || !body.arrival || !body.flight_date) {
      console.log('❌ Validation failed - missing required fields')
      return NextResponse.json(
        { error: 'Missing required fields: pilot_email, departure, arrival, flight_date' },
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
      console.error('❌ Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('✅ Flight saved to Supabase with ID:', data.id)

    // Send to sim.ai webhook for monitoring
    const webhookUrl = process.env.SIM_WEBHOOK_URL
    console.log('🔍 Checking webhook URL:', webhookUrl ? 'FOUND' : 'NOT FOUND')

    if (webhookUrl) {
      try {
        console.log('📤 Sending flight data to sim.ai webhook:', webhookUrl)

        const webhookPayload = {
          event: 'flight_watch_created',
          flight_id: data.id,
          pilot_email: data.pilot_email,
          pilot_name: data.pilot_name,
          departure: data.departure,
          arrival: data.arrival,
          flight_date: data.flight_date,
          route_data: data.route_data,
          baseline_weather: data.baseline_weather,
          created_at: data.created_at,
          // Include app URL for sim.ai to call back
          callback_url: process.env.NEXT_PUBLIC_APP_URL || 'https://flightadvisor.vercel.app',
        }

        console.log('📦 Webhook payload:', JSON.stringify(webhookPayload, null, 2))

        const webhookResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookPayload),
        })

        console.log('📥 Webhook response status:', webhookResponse.status)

        if (webhookResponse.ok) {
          const responseText = await webhookResponse.text()
          console.log('✅ Flight data sent to sim.ai webhook successfully. Response:', responseText)
        } else {
          const errorText = await webhookResponse.text()
          console.error('⚠️ Sim.ai webhook returned error:', webhookResponse.status, errorText)
          // Don't fail the whole request if webhook fails - flight is still saved in Supabase
        }
      } catch (webhookError) {
        console.error('⚠️ Failed to send to sim.ai webhook (non-fatal):', webhookError)
        // Continue - flight is still saved in Supabase even if webhook fails
      }
    } else {
      console.warn('⚠️ SIM_WEBHOOK_URL not configured - skipping webhook notification')
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
