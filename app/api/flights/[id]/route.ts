import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

/**
 * GET /api/flights/[id]
 * Get a specific flight by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { data, error } = await supabase
      .from('watched_flights')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Flight not found' }, { status: 404 })
      }
      console.error('Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ flight: data })
  } catch (error) {
    console.error('Get flight error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch flight' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/flights/[id]
 * Update a flight (used by sim.ai to add alerts, or user to acknowledge)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()

    // Build update object with only provided fields
    const updateData: Record<string, any> = {}

    // Alert fields (set by sim.ai)
    if (body.has_alert !== undefined) updateData.has_alert = body.has_alert
    if (body.alert_message !== undefined) updateData.alert_message = body.alert_message
    if (body.alert_severity !== undefined) updateData.alert_severity = body.alert_severity
    if (body.has_alert === true) updateData.alert_created_at = new Date().toISOString()

    // Weather update (set by sim.ai)
    if (body.current_weather !== undefined) {
      updateData.current_weather = body.current_weather
      updateData.last_weather_check = new Date().toISOString()
    }

    // User actions
    if (body.alert_acknowledged !== undefined) updateData.alert_acknowledged = body.alert_acknowledged
    if (body.is_active !== undefined) updateData.is_active = body.is_active

    const { data, error } = await supabase
      .from('watched_flights')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Flight not found' }, { status: 404 })
      }
      console.error('Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, flight: data })
  } catch (error) {
    console.error('Update flight error:', error)
    return NextResponse.json(
      { error: 'Failed to update flight' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/flights/[id]
 * Delete a watched flight
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { error } = await supabase
      .from('watched_flights')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete flight error:', error)
    return NextResponse.json(
      { error: 'Failed to delete flight' },
      { status: 500 }
    )
  }
}
