import { getSupabase, SavedFlight } from './client'

export type { SavedFlight }

/**
 * Fetch all saved flights from Supabase
 */
export async function getAllFlights(): Promise<SavedFlight[]> {
  const supabase = getSupabase()
  if (!supabase) {
    console.warn('Supabase not configured - returning empty flights list')
    return []
  }
  const { data, error } = await supabase
    .from('flights')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Error fetching flights:', error)
    return []
  }

  return data || []
}

/**
 * Get a single flight by ID
 */
export async function getFlightById(id: string): Promise<SavedFlight | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('flights')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching flight:', error)
    return null
  }

  return data
}

/**
 * Save a new flight to Supabase
 */
export async function saveFlight(flight: Omit<SavedFlight, 'id' | 'created_at' | 'updated_at'>): Promise<SavedFlight | null> {
  const supabase = getSupabase()
  if (!supabase) {
    console.warn('Supabase not configured - cannot save flight')
    return null
  }
  const { data, error } = await supabase
    .from('flights')
    .insert([flight])
    .select()
    .single()

  if (error) {
    console.error('Error saving flight:', error)
    return null
  }

  return data
}

/**
 * Update an existing flight
 */
export async function updateFlight(id: string, updates: Partial<Omit<SavedFlight, 'id' | 'created_at'>>): Promise<SavedFlight | null> {
  const supabase = getSupabase()
  if (!supabase) {
    console.warn('Supabase not configured - cannot update flight')
    return null
  }
  const { data, error } = await supabase
    .from('flights')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating flight:', error)
    return null
  }

  return data
}

/**
 * Delete a flight by ID
 */
export async function deleteFlight(id: string): Promise<boolean> {
  const supabase = getSupabase()
  if (!supabase) {
    console.warn('Supabase not configured - cannot delete flight')
    return false
  }
  const { error } = await supabase
    .from('flights')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting flight:', error)
    return false
  }

  return true
}
