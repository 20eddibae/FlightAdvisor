import { NextRequest, NextResponse } from 'next/server'
import {
  fetchAllAirspace,
  fetchAirports,
  fetchNavaids,
  isOpenAIPConfigured,
} from '@/lib/api/openaip'

/**
 * OpenAIP API Route
 *
 * Fetches aviation data from OpenAIP API based on query parameters.
 *
 * Query Parameters:
 * - type: 'airspace' | 'airports' | 'navaids'
 * - bounds: Comma-separated bounding box "minLon,minLat,maxLon,maxLat"
 *
 * Examples:
 * - /api/openaip?type=airspace&bounds=-123,37,-121,39
 * - /api/openaip?type=airports&bounds=-122.5,37.5,-122,38
 * - /api/openaip?type=navaids&bounds=-123,37,-121,39
 */
export async function GET(request: NextRequest) {
  try {
    // Check if OpenAIP is configured
    if (!isOpenAIPConfigured()) {
      return NextResponse.json(
        {
          error: 'OpenAIP API not configured',
          message: 'Set OPEN_AIP_API_KEY in environment variables',
        },
        { status: 500 }
      )
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') || 'airspace'
    const boundsStr = searchParams.get('bounds')

    // Validate bounds parameter
    if (!boundsStr) {
      return NextResponse.json(
        {
          error: 'Missing bounds parameter',
          message: 'Provide bounds as: ?bounds=minLon,minLat,maxLon,maxLat',
          example: '?bounds=-123,37,-121,39',
        },
        { status: 400 }
      )
    }

    // Parse bounds
    const boundsArray = boundsStr.split(',').map(Number)
    if (boundsArray.length !== 4 || boundsArray.some(isNaN)) {
      return NextResponse.json(
        {
          error: 'Invalid bounds format',
          message: 'Bounds must be: minLon,minLat,maxLon,maxLat',
          example: '-123,37,-121,39',
        },
        { status: 400 }
      )
    }

    const bounds = boundsArray as [number, number, number, number]

    // Fetch data based on type
    switch (type) {
      case 'airspace': {
        const airspace = await fetchAllAirspace(bounds)
        return NextResponse.json({
          success: true,
          type: 'airspace',
          bounds,
          count: airspace.features.length,
          data: airspace,
        })
      }

      case 'airports': {
        const airports = await fetchAirports(bounds)
        return NextResponse.json({
          success: true,
          type: 'airports',
          bounds,
          count: airports.length,
          data: airports,
        })
      }

      case 'navaids': {
        const navaids = await fetchNavaids(bounds)
        return NextResponse.json({
          success: true,
          type: 'navaids',
          bounds,
          count: navaids.length,
          data: navaids,
        })
      }

      default:
        return NextResponse.json(
          {
            error: 'Invalid type parameter',
            message: 'Type must be: airspace, airports, or navaids',
          },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('OpenAIP API route error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch OpenAIP data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Health check endpoint
 */
export async function HEAD() {
  const configured = isOpenAIPConfigured()
  return new NextResponse(null, {
    status: configured ? 200 : 503,
    headers: {
      'X-OpenAIP-Configured': configured.toString(),
    },
  })
}
