import { GoogleGenerativeAI } from '@google/generative-ai'
import { API_TIMEOUT } from '../constants'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

// In-memory cache for reasoning results (keyed by route signature)
const reasoningCache = new Map<string, RouteReasoningResponse>()
const MAX_CACHE_SIZE = 5

export interface RouteReasoningRequest {
  departure: string
  arrival: string
  departureCoords: [number, number]
  arrivalCoords: [number, number]
  waypoints: string[]
  waypointCoords?: Array<[number, number]> // Added for heading calculations
  distance_nm: number
  estimated_time_min: number
  route_type: 'direct' | 'avoiding_airspace'
}

export interface RouteReasoningResponse {
  Altitude: number
  Issues: string
  Segment_Analysis: string[]
  Mag_Heading: number[]
  Go_NoGo: boolean
  Go_NoGo_Reasoning: string
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

You MUST respond with valid JSON only. No markdown, no explanation outside the JSON structure.

When analyzing flight routes, consider:
1. Magnetic heading hemispheric altitude rule (0-179° = odd thousand + 500, 180-359° = even thousand + 500)
2. Airspace constraints (Class B/C/D requirements, restricted areas)
3. Terrain clearance (minimum 500-1000' AGL over obstacles)
4. Weather and visibility requirements for VFR
5. Aircraft performance limitations
6. Navigation aid availability
7. Emergency landing options along route

Return ONLY a JSON object with this exact structure:
{
  "Altitude": number (cruise altitude in feet MSL based on magnetic heading),
  "Issues": "string describing potential problems with this route",
  "Segment_Analysis": ["array of strings", "one per waypoint describing specific concerns"],
  "Mag_Heading": [array of numbers, magnetic heading for each leg],
  "Go_NoGo": boolean (true if route is safe to fly, false if significant risks),
  "Go_NoGo_Reasoning": "string explaining the go/no-go decision"
}`

/**
 * Calculate magnetic heading between two points (lat/lon)
 */
function calculateMagneticHeading(
  from: [number, number],
  to: [number, number]
): number {
  const [lon1, lat1] = from
  const [lon2, lat2] = to

  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const lat1Rad = (lat1 * Math.PI) / 180
  const lat2Rad = (lat2 * Math.PI) / 180

  const y = Math.sin(dLon) * Math.cos(lat2Rad)
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon)

  let heading = (Math.atan2(y, x) * 180) / Math.PI

  // Convert to 0-360 range
  heading = (heading + 360) % 360

  // Apply magnetic variation for California (approximately 13° East)
  heading = (heading + 13) % 360

  return Math.round(heading)
}

/**
 * Calculate appropriate VFR cruise altitude based on magnetic heading
 * Hemispheric rule: 0-179° = odd thousands + 500, 180-359° = even thousands + 500
 */

/**
 * Generate route reasoning using Gemini 3 Thinking API
 */
export async function generateRouteReasoning(
  request: RouteReasoningRequest
): Promise<RouteReasoningResponse> {
  // Check cache first
  const cacheKey = generateCacheKey(request)
  const cached = reasoningCache.get(cacheKey)
  if (cached) {
    return cached
  }

  // Calculate magnetic headings for each leg
  const magHeadings = calculateMagneticHeadings(request)
  const avgHeading =
    magHeadings.reduce((sum, h) => sum + h, 0) / magHeadings.length

  // Check if API key is available
  if (!GEMINI_API_KEY) {
    console.warn('Gemini API key not found, using fallback reasoning')
    return generateFallbackReasoning(request, magHeadings)
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
    const prompt = buildPrompt(request, magHeadings)

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

    // Parse JSON response
    let parsedResponse: RouteReasoningResponse
    try {
      // Remove markdown code blocks if present
      const jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      parsedResponse = JSON.parse(jsonText)
    } catch (parseError) {
      console.error('Failed to parse Gemini JSON response:', parseError)
      return generateFallbackReasoning(request, magHeadings)
    }

    // Cache the result
    if (reasoningCache.size >= MAX_CACHE_SIZE) {
      // Remove oldest entry
      const firstKey = reasoningCache.keys().next().value
      if (firstKey) {
        reasoningCache.delete(firstKey)
      }
    }
    reasoningCache.set(cacheKey, parsedResponse)

    return parsedResponse
  } catch (error) {
    console.error('Gemini API error:', error)
    // Fall back to pre-written reasoning
    return generateFallbackReasoning(request, magHeadings)
  }
}

/**
 * Calculate magnetic headings for all legs in the route
 */
function calculateMagneticHeadings(request: RouteReasoningRequest): number[] {
  const headings: number[] = []

  // Build coordinate array
  const coords: Array<[number, number]> = [request.departureCoords]

  if (request.waypointCoords && request.waypointCoords.length > 0) {
    coords.push(...request.waypointCoords)
  }

  coords.push(request.arrivalCoords)

  // Calculate heading for each leg
  for (let i = 0; i < coords.length - 1; i++) {
    const heading = calculateMagneticHeading(coords[i], coords[i + 1])
    headings.push(heading)
  }

  return headings
}

/**
 * Generate fallback reasoning when API is unavailable
 */
function generateFallbackReasoning(
  request: RouteReasoningRequest,
  magHeadings: number[],
): RouteReasoningResponse {
  const segmentAnalysis: string[] = []

  // Departure segment
  segmentAnalysis.push(
    `Departure from ${request.departure}: Initial climb on heading ${magHeadings[0]}°. Monitor traffic pattern and local airspace. Ensure proper clearance from Class B airspace overhead.`
  )

  // Waypoint segments
  if (request.waypoints.length > 0) {
    request.waypoints.forEach((wp, index) => {
      segmentAnalysis.push(
        `${wp} waypoint (heading ${magHeadings[index + 1] || magHeadings[index]}°): Provides positive navigation fix. Verify position using GPS and pilotage. Monitor terrain clearance.`
      )
    })
  }

  // Arrival segment
  segmentAnalysis.push(
    `Arrival at ${request.arrival}: Begin descent planning 10-15nm out. Contact tower for landing clearance. Brief approach and pattern procedures.`
  )

  const issues =
    request.route_type === 'avoiding_airspace'
      ? 'Route avoids SFO Class B airspace. Monitor GPS position to maintain lateral separation. Higher terrain in East Bay hills requires careful altitude management. Weather patterns from the Bay can affect VFR conditions.'
      : 'Direct route may require Class B clearance. Monitor ATC frequencies and ensure transponder is operational. Be prepared for potential rerouting.'

  return {
    Altitude: cruiseAltitude,
    Issues: issues,
    Segment_Analysis: segmentAnalysis,
    Mag_Heading: magHeadings,
    Go_NoGo: true,
    Go_NoGo_Reasoning:
      'Route is viable for VFR flight under normal conditions. Verify current weather, NOTAMs, and TFRs before departure. Ensure aircraft performance is adequate for terrain clearance.',
  }
}

/**
 * Build prompt for Gemini based on route details
 */
function buildPrompt(
  request: RouteReasoningRequest,
  magHeadings: number[],
): string {
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

  let prompt = `Analyze this VFR flight route and return ONLY valid JSON (no markdown, no extra text):

**Route Overview:**
- Departure: ${departure} (${departureCoords[1].toFixed(4)}°N, ${Math.abs(departureCoords[0]).toFixed(4)}°W)
- Arrival: ${arrival} (${arrivalCoords[1].toFixed(4)}°N, ${Math.abs(arrivalCoords[0]).toFixed(4)}°W)
- Distance: ${distance_nm.toFixed(1)} nautical miles
- Estimated Time: ${estimated_time_min} minutes (assuming 120 knots groundspeed)
- Route Type: ${route_type === 'direct' ? 'Direct Route' : 'Routing to Avoid Airspace'}
- Calculated Magnetic Headings: ${magHeadings.join('°, ')}°
- Recommended Cruise Altitude: follow MSL (hemispheric rule)

`

  if (waypoints.length > 0) {
    prompt += `**Waypoints Used:**
${waypoints.map((wp, i) => `- ${wp} (heading ${magHeadings[i]}°)`).join('\n')}

`
  }

  prompt += `**Airspace Considerations:**
- SFO Class B airspace extends from 3,000' to 10,000' MSL over this region
- Class B requires ATC clearance, two-way radio, and Mode C transponder
- East Bay hills reach 2,000-3,000' MSL - terrain clearance critical
- Sacramento Class D airspace at destination

**Your Task:**
Analyze this route for safety and provide a go/no-go recommendation. Consider:
1. Terrain clearance (especially East Bay hills)
2. Airspace restrictions and required clearances
3. Navigation challenges at each waypoint
4. Weather vulnerability (coastal fog, valley inversions)
5. Emergency landing options
6. Aircraft performance requirements

Return ONLY this JSON structure (no other text):
{
  "Altitude": INT,
  "Issues": "string - describe potential problems: terrain, airspace, weather, navigation challenges",
  "Segment_Analysis": [
    "Segment 1: ${departure} to ${waypoints[0] || arrival} - describe terrain, climb requirements, airspace",
    ${waypoints.map((wp, i) => `"Segment ${i + 2}: ${wp} to ${waypoints[i + 1] || arrival} - analyze terrain, navigation, weather exposure"`).join(',\n    ')}
  ],
  "Mag_Heading": [${magHeadings.join(', ')}],
  "Go_NoGo": true or false (based on safety analysis),
  "Go_NoGo_Reasoning": "string - explain the decision with specific safety factors"
}

Be specific about real hazards: mention East Bay hills terrain, SFO Class B proximity, valley weather, etc.`

  return prompt
}

/**
 * Clear the reasoning cache (useful for testing)
 */
export function clearReasoningCache(): void {
  reasoningCache.clear()
}
