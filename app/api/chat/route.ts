import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

const SYSTEM_INSTRUCTION = `You are an experienced FAA-certified flight instructor and weather briefing specialist with 20+ years of experience.
Your role is to help pilots make informed go/no-go decisions based on weather conditions, route analysis, and safety considerations.

Key responsibilities:
1. Analyze weather conditions (METAR/TAF) in pilot-friendly language
2. Explain go/no-go decisions with clear reasoning
3. Identify potential weather hazards and suggest alternatives
4. Help pilots understand VFR minimums and safety margins
5. Recommend route changes when weather conditions warrant

Communication style:
- Use clear, concise aviation terminology
- Be direct about safety concerns - never sugarcoat risks
- Provide educational explanations that help pilots learn
- Reference specific regulations (14 CFR) when relevant
- Keep responses conversational but professional (2-4 sentences typically)

Remember: Safety is paramount. If conditions are marginal or unsafe, be clear and firm in your recommendation.`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, context, history } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Invalid message' },
        { status: 400 }
      )
    }

    // Check if API key is available
    if (!GEMINI_API_KEY) {
      console.warn('Gemini API key not found, using fallback response')
      return NextResponse.json({
        response: getFallbackResponse(message, context),
        suggestReroute: false
      })
    }

    // Build context message for the AI
    let contextPrompt = buildContextPrompt(context)

    // Build conversation history
    let conversationHistory = ''
    if (history && Array.isArray(history) && history.length > 0) {
      conversationHistory = '\n\nRecent conversation:\n' +
        history.map((msg: any) => `${msg.role === 'user' ? 'Pilot' : 'Instructor'}: ${msg.content}`).join('\n')
    }

    const fullPrompt = `${contextPrompt}${conversationHistory}

Pilot asks: "${message}"

Provide a helpful, concise response (2-4 sentences). Focus on safety and education. If the pilot asks about rerouting or if conditions are unsafe, explain what changes would help.`

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
      const model = genAI.getGenerativeModel({
        model: 'gemini-3-pro-preview',
        systemInstruction: SYSTEM_INSTRUCTION,
      })

      const result = await model.generateContent(fullPrompt)
      const response = result.response.text()

      // Check if response suggests rerouting
      const suggestReroute = /reroute|alternative route|different path|avoid|change route/i.test(response)

      return NextResponse.json({
        response: response.trim(),
        suggestReroute
      })
    } catch (apiError) {
      console.error('Gemini API error:', apiError)
      return NextResponse.json({
        response: getFallbackResponse(message, context),
        suggestReroute: false
      })
    }
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    )
  }
}

/**
 * Build context prompt from route and weather data
 */
function buildContextPrompt(context: any): string {
  if (!context) {
    return 'The pilot is asking a general aviation question.'
  }

  let prompt = '**Current Flight Planning Context:**\n\n'

  // Add route information
  if (context.route) {
    prompt += `Route: ${context.route.departure} → ${context.route.arrival}\n`
    prompt += `Distance: ${context.route.distance_nm} NM\n`
    prompt += `Estimated Time: ${context.route.estimated_time_min} minutes\n\n`
  }

  // Add reasoning/analysis
  if (context.reasoning) {
    const { Go_NoGo, Go_NoGo_Reasoning, Altitude, Issues } = context.reasoning
    prompt += `**Current Analysis:**\n`
    prompt += `Go/No-Go: ${Go_NoGo ? 'GO' : 'NO-GO'}\n`
    prompt += `Reasoning: ${Go_NoGo_Reasoning}\n`
    prompt += `Recommended Altitude: ${Altitude}' MSL\n`
    if (Issues) {
      prompt += `Issues: ${Issues}\n`
    }
    prompt += '\n'
  }

  // Add weather observations
  if (context.weather && Array.isArray(context.weather) && context.weather.length > 0) {
    prompt += `**Weather Observations:**\n`
    context.weather.forEach((station: any) => {
      const metar = station.metar?.rawOb || station.metar?.raw_text || 'No METAR'
      const fltCat = station.metar?.fltCat || station.metar?.flightCategory || 'Unknown'
      prompt += `${station.station}: ${metar} (${fltCat})\n`
    })
    prompt += '\n'
  }

  return prompt
}

/**
 * Fallback response when AI is unavailable
 */
function getFallbackResponse(message: string, context: any): string {
  const msgLower = message.toLowerCase()

  // Safety check questions
  if (msgLower.includes('safe') || msgLower.includes('go') || msgLower.includes('no-go')) {
    if (context?.reasoning?.Go_NoGo === false) {
      return 'Based on the current analysis, this is a NO-GO. The primary concerns are weather-related. Review the METAR/TAF data carefully and consider delaying your flight or choosing an alternative route.'
    } else {
      return 'The route appears viable for VFR flight based on current conditions. However, always verify weather, NOTAMs, and TFRs immediately before departure. Monitor conditions throughout your flight.'
    }
  }

  // Weather explanation
  if (msgLower.includes('weather') || msgLower.includes('conditions')) {
    if (context?.weather && context.weather.length > 0) {
      const station = context.weather[0]
      const fltCat = station.metar?.fltCat || station.metar?.flightCategory
      if (fltCat === 'VFR') {
        return 'Current weather shows VFR conditions with good visibility and adequate ceiling. Maintain awareness of changing conditions and have a plan B if weather deteriorates.'
      } else if (fltCat === 'MVFR') {
        return 'Conditions are MVFR (Marginal VFR). Visibility or ceiling is reduced. Exercise caution and consider your personal minimums. Be prepared to divert if conditions worsen.'
      } else {
        return 'Weather data shows sub-VFR conditions. This flight would require an IFR flight plan and appropriate ratings. Do not attempt VFR flight in these conditions.'
      }
    }
    return 'Weather observations are being analyzed. Check METAR and TAF data for your departure and arrival airports, plus conditions along the route.'
  }

  // Reroute questions
  if (msgLower.includes('reroute') || msgLower.includes('alternative') || msgLower.includes('different')) {
    return 'If rerouting is needed due to weather, consider flying at a different time when conditions improve, or choosing waypoints that avoid the weather hazards. Always maintain VFR cloud clearances and visibility minimums.'
  }

  // Concerns questions
  if (msgLower.includes('concern') || msgLower.includes('worry') || msgLower.includes('issue')) {
    if (context?.reasoning?.Issues) {
      return `Main concerns: ${context.reasoning.Issues.substring(0, 200)}... Review the full analysis above for details.`
    }
    return 'Primary concerns include airspace compliance, weather minimums, terrain clearance, and navigation. Review the segment analysis for specific details about each portion of your route.'
  }

  // Generic helpful response
  return "I'm here to help with weather analysis and go/no-go decisions. Ask me about current conditions, safety concerns, or route alternatives. What specific aspect would you like me to address?"
}
