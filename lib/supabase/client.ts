import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null
let _adminClient: SupabaseClient | null = null

/**
 * Client-side Supabase client using anon key.
 * Returns null if env vars are missing (graceful degradation).
 */
export function getSupabase(): SupabaseClient | null {
  if (_client) return _client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    if (typeof window !== 'undefined') {
      console.warn('Supabase not configured - flight saving disabled')
      console.warn('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel')
    }
    return null
  }
  _client = createClient(url, key)
  return _client
}

/**
 * Server-side Supabase client using service role key.
 * Use this in API routes for admin operations that bypass RLS.
 * Returns null if env vars are missing (graceful degradation).
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (_adminClient) return _adminClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.warn('Supabase admin not configured - server operations disabled')
    console.warn('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    return null
  }
  _adminClient = createClient(url, key)
  return _adminClient
}


// Database types
export interface SavedFlight {
  id: string
  name: string
  departure: string // Can be empty string for blank routes
  arrival: string   // Can be empty string for blank routes
  route_type: 'direct' | 'avoiding_airspace'
  waypoints: string[]
  coordinates: [number, number][]
  distance_nm: number
  estimated_time_min: number
  cruise_altitude?: number
  created_at: string
  updated_at: string
}
