import { GoogleGenerativeAI } from '@google/generative-ai'
import { API_TIMEOUT } from '../constants'
import { generateFallbackReasoningText } from '../fallback-reasoning'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

// In-memory cache for reasoning results (keyed by route signature)
const reasoningCache = new Map<string, string>()
const MAX_CACHE_SIZE = 5

export interface RouteReasoningRequest {
  departure: string
  arrival: string
  departureCoords: [number, number]
  arrivalCoords: [number, number]
  waypoints: string[]
  distance_nm: number
  estimated_time_min: number
  route_type: 'direct' | 'avoiding_airspace'
}

/**
 * Generate a cache key from route request
 */
function generateCacheKey(request: RouteReasoningRequest): string {
  return `${request.departure}-${request.arrival}-${request.waypoints.join('-')}`
}

/**
 * System prompt for Gemini - FAA-certified flight instructor persona
 */
const SYSTEM_INSTRUCTION = `You are an experienced FAA-certified flight instructor with 20+ years of experience teaching student pilots.
Your expertise includes VFR navigation, airspace regulations, and flight safety.

When explaining flight routes, focus on:
1. WHY each waypoint or routing decision was made (safety, navigation, airspace avoidance)
2. What airspace constraints influenced the routing
3. Practical aviation terminology that student pilots understand
4. Educational value - turn every explanation into a learning opportunity
5. Safety margins and best practices demonstrated in the route

Keep explanations concise but educational. Use 2-3 sentences per waypoint.
Always explain in terms of:
- Navigation aids (VORs, GPS fixes)
- Airspace classes and requirements
- Safety considerations (terrain, traffic, weather)
- Alternatives that were considered and why they were rejected

Be encouraging and educational, like a patient flight instructor in the right seat.`

/**
 * Generate route reasoning using Gemini 3 Thinking API
 */
export async function generateRouteReasoning(
  request: RouteReasoningRequest
): Promise<string> {
  // Check cache first
  const cacheKey = generateCacheKey(request)
  const cached = reasoningCache.get(cacheKey)
  if (cached) {
    return cached
  }

  // Check if API key is available
  if (!GEMINI_API_KEY) {
    console.warn('Gemini API key not found, using fallback reasoning')
    return generateFallbackReasoningText()
  }

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)

    // Use Gemini 1.5 Flash model (fast and cost-effective)
    // Note: Plan mentions "Gemini 3 Thinking" but using available model
    const model = genAI.getGenerativeModel({
      model: 'gemini-3-pro-preview',
      systemInstruction: SYSTEM_INSTRUCTION,
    })

    // Build the prompt
    const prompt = buildPrompt(request)

    // Set up timeout
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini API timeout')), API_TIMEOUT)
    )

    // Race between API call and timeout
    const result = await Promise.race([
      model.generateContent(prompt),
      timeoutPromise,
    ])

    const response = result.response
    const text = response.text()

    // Cache the result
    if (reasoningCache.size >= MAX_CACHE_SIZE) {
      // Remove oldest entry
      const firstKey = reasoningCache.keys().next().value
      if (firstKey) {
        reasoningCache.delete(firstKey)
      }
    }
    reasoningCache.set(cacheKey, text)

    return text
  } catch (error) {
    console.error('Gemini API error:', error)
    // Fall back to pre-written reasoning
    return generateFallbackReasoningText()
  }
}

/**
 * Build prompt for Gemini based on route details
 */
function buildPrompt(request: RouteReasoningRequest): string {
  const {
    departure,
    arrival,
    departureCoords,
    arrivalCoords,
    waypoints,
    distance_nm,
    estimated_time_min,
    route_type,
  } = request

  let prompt = `Explain this VFR flight route from a flight instructor's perspective:

**Route Overview:**
- Departure: ${departure} (${departureCoords[1].toFixed(4)}°N, ${Math.abs(departureCoords[0]).toFixed(4)}°W)
- Arrival: ${arrival} (${arrivalCoords[1].toFixed(4)}°N, ${Math.abs(arrivalCoords[0]).toFixed(4)}°W)
- Distance: ${distance_nm} nautical miles
- Estimated Time: ${estimated_time_min} minutes (assuming 120 knots groundspeed)
- Route Type: ${route_type === 'direct' ? 'Direct Route' : 'Routing to Avoid Airspace'}

`

  if (waypoints.length > 0) {
    prompt += `**Waypoints Used:**
${waypoints.map((wp) => `- ${wp}`).join('\n')}

`
  }

  prompt += `**Airspace Considerations:**
- SFO Class B airspace extends from 3,000' to 10,000' MSL over this region
- Class B requires ATC clearance, two-way radio, and Mode C transponder
- Alternative routing avoids Class B to maintain VFR flexibility

**Your Task:**
Explain WHY this routing was chosen, focusing on:
1. Why each waypoint provides value (navigation, safety, airspace avoidance)
2. What airspace constraints influenced the route
3. What alternatives were considered and why this route is optimal
4. Safety margins and best practices demonstrated

Format your response as a structured explanation with:
- A brief summary paragraph
- Segment-by-segment analysis (2-3 sentences each)
- Safety considerations
- Educational takeaways for a student pilot

Keep the tone educational and encouraging, like you're sitting next to a student pilot explaining the flight plan.`

  return prompt
}

/**
 * Clear the reasoning cache (useful for testing)
 */
export function clearReasoningCache(): void {
  reasoningCache.clear()
}
