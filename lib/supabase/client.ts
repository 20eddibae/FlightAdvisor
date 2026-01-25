import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

/**
 * Lazily initialized Supabase client. Never throws at module load (build-safe).
 * Returns null if env vars are missing (graceful degradation).
 */
export function getSupabase(): SupabaseClient | null {
  if (_client) return _client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    if (typeof window !== 'undefined') {
      // Only log in browser (not during SSR/build)
      console.warn('Supabase not configured - flight saving disabled')
      console.warn('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel')
    }
    return null
  }
  _client = createClient(url, key)
  return _client
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
