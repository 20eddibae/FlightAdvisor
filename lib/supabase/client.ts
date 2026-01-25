import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL:', supabaseUrl ? 'set' : 'missing')
  console.error('Supabase Key:', supabaseAnonKey ? 'set' : 'missing')
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
