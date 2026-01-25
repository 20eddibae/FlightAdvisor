import { NextRequest, NextResponse } from 'next/server'
import { generateRouteReasoning, RouteReasoningRequest } from '@/lib/api/gemini'

/**
 * POST /api/reasoning
 * Generate AI reasoning for a flight route
 */
export async function POST(request: NextRequest) {
  try {
    const body: RouteReasoningRequest = await request.json()

    // Validate required fields
    if (!body.departure || !body.arrival) {
      return NextResponse.json(
        { error: 'Missing required fields: departure, arrival' },
        { status: 400 }
      )
    }

    // Generate reasoning
    const reasoning = await generateRouteReasoning(body)

    return NextResponse.json({
      reasoning,
      cached: false, // Could track this if needed
    })
  } catch (error) {
    console.error('Reasoning API error:', error)

    return NextResponse.json(
      {
        error: 'Failed to generate route reasoning',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/reasoning
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Route reasoning API is operational',
  })
}
