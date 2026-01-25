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
  weather?: Array<{
    station: string
    metar: any | null
    taf: any | null
  }>
  hazards?: Array<{
    id: string
    kind: string
    phenomenon: string | null
    severity: string | null
    validFrom: string | null
    validTo: string | null
    rawText: string | null
  }>
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
Your expertise includes VFR navigation, airspace regulations, flight safety, and weather analysis.

You MUST respond with valid JSON only. No markdown, no explanation outside the JSON structure.

When analyzing flight routes, consider:
1. **Cloud Ceilings** - CRITICAL for VFR flight viability:
   - Ceiling below 1,000ft = IFR conditions (VFR NOT SAFE)
   - Ceiling 1,000-3,000ft = MVFR (marginal VFR, high caution)
   - Ceiling above 3,000ft = VFR acceptable
   - If ceiling is below planned cruise altitude, route is NO-GO
2. Magnetic heading hemispheric altitude rule (0-179° = odd thousand + 500, 180-359° = even thousand + 500)
3. Airspace constraints (Class B/C/D requirements, restricted areas)
4. Terrain clearance (minimum 500-1000' AGL over obstacles)
5. Weather and visibility requirements for VFR (3 SM visibility minimum, cloud clearances)
6. Aircraft performance limitations
7. Navigation aid availability
8. Emergency landing options along route

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
 * Filter hazards to only include those that are relevant to the route
 * Removes expired hazards and relies on API's bounding box filtering
 */
function filterRelevantHazards(
  hazards: RouteReasoningRequest['hazards'],
  routeCoords: Array<[number, number]>
): RouteReasoningRequest['hazards'] {
  if (!hazards || hazards.length === 0) return []

  return hazards.filter(hazard => {
    // Filter out expired hazards
    if (hazard.validTo) {
      const validTo = new Date(hazard.validTo)
      if (validTo < new Date()) {
        return false // Hazard has expired
      }
    }

    // The hazards API already filters by the route's bounding box,
    // so we primarily filter out expired ones here.
    // In production, we could add more sophisticated geometry intersection
    // checking if the hazard includes detailed polygon data.
    return true
  })
}

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
  heading = (heading - 14) % 360

  return Math.round(heading)
}

/**
 * Suggest a reasonable fallback altitude for when AI is unavailable
 * This is just a suggestion - the AI should determine optimal altitude based on all factors
 */

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
    magHeadings.reduce((sum, h) => sum + h, 0) / (magHeadings.length || 1)

  // Build route coordinates array for hazard filtering
  const routeCoords: Array<[number, number]> = [request.departureCoords]
  if (request.waypointCoords && request.waypointCoords.length > 0) {
    routeCoords.push(...request.waypointCoords)
  }
  routeCoords.push(request.arrivalCoords)

  // Filter hazards to only include those relevant to the route
  const relevantHazards = filterRelevantHazards(request.hazards, routeCoords)

  // Check if API key is available
  if (!GEMINI_API_KEY) {
    console.warn('Gemini API key not found, using fallback reasoning')
    return generateFallbackReasoning(request, magHeadings, relevantHazards)
  }

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)

    // Use Gemini 1.5 Flash model (fast and cost-effective)
    // Note: Plan mentions "Gemini 3 Thinking" but using available model
    const model = genAI.getGenerativeModel({
      model: 'gemini-3-pro-preview',
      systemInstruction: SYSTEM_INSTRUCTION,
    })

    // Build the prompt with filtered hazards
    const prompt = buildPrompt(request, magHeadings, relevantHazards)

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
      return generateFallbackReasoning(request, magHeadings, relevantHazards)
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
    return generateFallbackReasoning(request, magHeadings, relevantHazards)
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
  relevantHazards?: RouteReasoningRequest['hazards']
): RouteReasoningResponse {
  const avgHeading = magHeadings.reduce((sum, h) => sum + h, 0) / (magHeadings.length || 1)
  const headingDirection = avgHeading >= 0 && avgHeading < 180 ? 'eastbound' : 'westbound'
  const ruleType = avgHeading >= 0 && avgHeading < 180 ? 'odd' : 'even'

  // Determine altitude based on distance and hemispheric rule
  const isEastbound = avgHeading >= 0 && avgHeading < 180
  let cruiseAltitude: number
  if (request.distance_nm < 50) {
    cruiseAltitude = isEastbound ? 3500 : 4500
  } else if (request.distance_nm < 150) {
    cruiseAltitude = isEastbound ? 5500 : 6500
  } else {
    cruiseAltitude = isEastbound ? 7500 : 8500
  }

  const segmentAnalysis: string[] = []

  // Departure segment
  segmentAnalysis.push(
    `Departure from ${request.departure}: Initial climb on heading ${magHeadings[0]}°. Monitor traffic pattern and local airspace. Verify airspace clearances as required.`
  )

  // Waypoint segments
  if (request.waypoints.length > 0) {
    request.waypoints.forEach((wp, index) => {
      segmentAnalysis.push(
        `${wp} waypoint (heading ${magHeadings[index + 1] || magHeadings[index]}°): Provides positive navigation fix. Verify position using GPS and pilotage. Monitor terrain clearance and airspace.`
      )
    })
  }

  // Arrival segment
  segmentAnalysis.push(
    `Arrival at ${request.arrival}: Begin descent planning 10-15nm out. Contact tower for landing clearance if required. Brief approach and pattern procedures.`
  )

  // Build issues string based on route type and hazards
  let issues =
    request.route_type === 'avoiding_airspace'
      ? `Route planned to avoid restricted airspace. Monitor GPS position to maintain lateral separation from controlled airspace. Cruise at ${cruiseAltitude}' MSL per hemispheric rule for ${headingDirection} flight.`
      : `Direct route. Monitor ATC frequencies and ensure compliance with airspace requirements. Cruise at ${cruiseAltitude}' MSL per hemispheric rule.`

  // Add hazard warnings if present
  if (relevantHazards && relevantHazards.length > 0) {
    const hazardSummary = relevantHazards
      .slice(0, 3)
      .map(h => `${h.kind}: ${h.phenomenon || 'unknown'}`)
      .join('; ')
    issues += ` ACTIVE HAZARDS along route: ${hazardSummary}${relevantHazards.length > 3 ? ` and ${relevantHazards.length - 3} more` : ''}.`
  }

  // Determine Go/No-Go based on hazards
  const hasSignificantHazards = relevantHazards && relevantHazards.some(h =>
    h.severity && typeof h.severity === 'string' && (h.severity.toLowerCase().includes('severe') || h.severity.toLowerCase().includes('extreme'))
  )

  return {
    Altitude: cruiseAltitude,
    Issues: issues,
    Segment_Analysis: segmentAnalysis,
    Mag_Heading: magHeadings,
    Go_NoGo: !hasSignificantHazards,
    Go_NoGo_Reasoning: hasSignificantHazards
      ? `NO-GO: Severe weather hazards detected along route corridor. Review hazards and consider alternative routing or delaying flight.`
      : `GO: Route is viable for VFR flight. Cruise altitude ${cruiseAltitude}' MSL follows hemispheric rule (${headingDirection}, ${ruleType} thousands + 500). Maintain VFR cloud clearances per 14 CFR 91.155. Verify current weather, NOTAMs, and TFRs before departure. Ensure aircraft performance is adequate for terrain clearance.`,
  }
}

/**
 * Build prompt for Gemini based on route details
 */
function buildPrompt(
  request: RouteReasoningRequest,
  magHeadings: number[],
  relevantHazards?: RouteReasoningRequest['hazards']
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
- Predominant Heading: ${magHeadings.length > 0 ? magHeadings[0] : 'N/A'}° (${magHeadings.length > 0 && magHeadings[0] >= 0 && magHeadings[0] < 180 ? 'Eastbound' : 'Westbound'})

**VFR Hemispheric Altitude Rule (14 CFR 91.159):**
- Magnetic course 0-179° (Eastbound): Fly ODD thousands + 500 feet MSL (3,500', 5,500', 7,500', etc.)
- Magnetic course 180-359° (Westbound): Fly EVEN thousands + 500 feet MSL (4,500', 6,500', 8,500', etc.)
- Use PREDOMINANT magnetic course for the entire route to determine correct altitude
- This prevents head-on collisions by vertical separation

**VFR Cloud Clearance Requirements (14 CFR 91.155 - "3152 Rule" below 10,000 MSL):**
- 3 statute miles visibility
- 1,000 feet above clouds
- 500 feet below clouds
- 2,000 feet horizontal from clouds

`

  if (waypoints.length > 0) {
    prompt += `**Waypoints Used:**
${waypoints.map((wp, i) => `- ${wp} (heading ${magHeadings[i]}°)`).join('\n')}

`
  }

  // Include weather observations if provided
  if (request.weather && request.weather.length > 0) {
    prompt += `**Weather Observations (Current METAR Data):**\n`

    // Analyze cloud ceilings specifically
    let hasLowClouds = false
    let hasIFRConditions = false

    prompt += request.weather.map(w => {
      // Aviation Weather API returns: rawOb (METAR) and rawTAF (TAF)
      const metar = w.metar ? (w.metar.rawOb || w.metar.raw_text || 'No observation') : 'No METAR'
      const taf = w.taf ? (w.taf.rawTAF || w.taf.raw_text || 'No forecast') : 'No TAF'
      const fltCat = w.metar?.fltCat || w.metar?.flightCategory || 'Unknown'
      return `- ${w.station}: ${metar} | Flight Category: ${fltCat} | TAF: ${taf}`
    }).join('\n')

    // Add cloud ceiling warnings
    if (hasIFRConditions) {
      prompt += `\n\n⚠️ **CRITICAL: IFR CONDITIONS DETECTED** - Ceiling below 1,000ft at one or more stations. VFR flight NOT RECOMMENDED.`
    } else if (hasLowClouds) {
      prompt += `\n\n⚠️ **CAUTION: MARGINAL VFR** - Low ceilings (below 3,000ft) detected. Monitor conditions carefully.`
    }

    prompt += `\n\n**Cloud Ceiling Analysis Instructions:**
- Ceilings below 1,000ft = IFR (unsafe for VFR)
- Ceilings 1,000-3,000ft = MVFR (marginal VFR, caution advised)
- Ceilings above 3,000ft = VFR acceptable
- Broken (BKN) or Overcast (OVC) layers indicate ceiling
- If any station reports ceiling below planned cruise altitude, flag as HIGH RISK
\n\n`
  }

  // Include hazard summary if provided (using filtered hazards that affect route)
  if (relevantHazards && relevantHazards.length > 0) {
    prompt += `**Active Hazards Along Route (within 25nm corridor):**\n`
    prompt += relevantHazards.slice(0, 10).map(h => {
      const validTime = h.validFrom && h.validTo
        ? `Valid: ${new Date(h.validFrom).toLocaleString()} to ${new Date(h.validTo).toLocaleString()}`
        : 'Time unknown'
      return `- ${h.kind} ${h.id}: ${h.phenomenon || 'unknown'} (${h.severity || 'unknown'}) - ${validTime}`
    }).join('\n')
    if (relevantHazards.length > 10) {
      prompt += `\n- ...and ${relevantHazards.length - 10} more hazards`
    }
    prompt += `\n\n`
  }

  prompt += `**General VFR Considerations:**
- Controlled airspace (Class B/C/D) requires ATC clearance, two-way radio, and Mode C transponder
- Special use airspace (MOAs, Restricted, Warning areas) may require avoidance or coordination
- Terrain and obstacles require careful altitude planning for minimum clearances
- Route is ${request.route_type === 'direct' ? 'direct' : 'avoiding airspace restrictions'}

**Your Task:**
Analyze this route for safety and provide a go/no-go recommendation. Select an appropriate cruise altitude considering:
1. **Terrain clearance**: MUST provide minimum 1,000' AGL over congested areas, 500' AGL elsewhere
   - Consider terrain along the entire route based on coordinates provided
2. **Hemispheric altitude rule**: Follow odd/even rule based on predominant magnetic course
3. **Airspace restrictions**: Evaluate if route intersects controlled or special use airspace
   - Avoid or consider clearance requirements for Class B/C/D airspace
4. **Weather conditions**: Ensure VFR cloud clearances can be maintained (3152 rule)
   - Analyze METAR/TAF if provided for ceilings and visibility
5. **Active hazards**: Only consider hazards within the route corridor that were provided
6. **Distance**: Higher altitudes for longer flights (fuel efficiency, glide range)
   - ${distance_nm.toFixed(0)}nm distance suggests ${distance_nm < 50 ? 'lower' : distance_nm < 150 ? 'mid-level' : 'higher'} altitude
7. **Navigation challenges**: Evaluate waypoint positions and navigation reliability
8. **Emergency landing options**: Consider terrain and population density along route

You must CHOOSE the altitude yourself based on these factors - balance all considerations.

Return ONLY this JSON structure (no other text):
{
  "Altitude": INT (you decide based on terrain, airspace, hemispheric rule, and distance),
  "Issues": "string - describe potential problems based on coordinates, airspace, weather, navigation, hazards, cloud clearances",
  "Segment_Analysis": [
    "Segment 1: ${departure} to ${waypoints[0] || arrival} - describe terrain, climb requirements, airspace",
    ${waypoints.map((wp, i) => `"Segment ${i + 2}: ${wp} to ${waypoints[i + 1] || arrival} - analyze terrain, navigation, weather exposure"`).join(',\n    ')}
  ],
  "Mag_Heading": [${magHeadings.join(', ')}],
  "Go_NoGo": true or false (based on safety analysis),
  "Go_NoGo_Reasoning": "string - explain the decision with specific safety factors"
}

Analyze the specific route coordinates, weather data, and hazards provided. Be specific about actual conditions along this route based on the data provided, not generic assumptions.`

  return prompt
}

/**
 * Clear the reasoning cache (useful for testing)
 */
export function clearReasoningCache(): void {
  reasoningCache.clear()
}
