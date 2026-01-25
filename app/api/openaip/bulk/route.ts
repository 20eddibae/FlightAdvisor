/**
 * Bulk airport loading API endpoint
 * Fetches all airports for a specific US region in one call
 */

import { NextRequest, NextResponse } from 'next/server';
import { US_REGIONS, type CachedAirport } from '@/lib/cache/types';
import { CACHE_CONFIG } from '@/lib/constants';

interface OpenAIPAirport {
  _id: string;
  name: string;
  icaoCode?: string;
  type: number;
  geometry: {
    type: string;
    coordinates: [number, number];
  };
  elevation?: {
    value: number;
    unit: string;
    referenceDatum: string;
  };
  trafficType?: number[];
}

/**
 * Fetch airports from OpenAIP with pagination support
 */
async function fetchAirportsFromOpenAIP(
  bounds: [number, number, number, number],
  limit: number = CACHE_CONFIG.BULK_FETCH_LIMIT
): Promise<OpenAIPAirport[]> {
  const [west, south, east, north] = bounds;
  const bbox = `${west},${south},${east},${north}`;

  const url = `https://api.core.openaip.net/api/airports?bbox=${bbox}&limit=${limit}&apiKey=${process.env.OPEN_AIP_API_KEY}`;

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`OpenAIP API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // OpenAIP returns { items: [...] }
  return data.items || [];
}

/**
 * Convert OpenAIP airport to CachedAirport format
 */
function convertToCachedAirport(
  airport: OpenAIPAirport,
  regionName: string
): CachedAirport {
  return {
    id: airport.icaoCode || airport._id,
    name: airport.name,
    lat: airport.geometry.coordinates[1],
    lon: airport.geometry.coordinates[0],
    elevation: airport.elevation?.value || 0,
    type: airport.trafficType?.includes(0) ? 'towered' : 'non-towered',
    notes: `Type: ${airport.type}`,
    _metadata: {
      region: regionName,
      cachedAt: Date.now(),
      source: 'openaip',
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    // Check if API key is configured
    if (!process.env.OPEN_AIP_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'OpenAIP API not configured',
          message: 'Set OPEN_AIP_API_KEY in .env.local and restart the dev server',
        },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const regionName = searchParams.get('region');

    if (!regionName) {
      return NextResponse.json(
        { success: false, error: 'Missing region parameter' },
        { status: 400 }
      );
    }

    // Find region bounds
    const region = US_REGIONS.find((r) => r.name === regionName);

    if (!region) {
      return NextResponse.json(
        { success: false, error: `Unknown region: ${regionName}` },
        { status: 400 }
      );
    }

    console.log(`Fetching airports for region: ${regionName} (${region.bounds.join(', ')})`);

    // Fetch airports from OpenAIP
    const openAIPAirports = await fetchAirportsFromOpenAIP(region.bounds);

    // Convert to CachedAirport format
    const cachedAirports: CachedAirport[] = openAIPAirports.map((airport) =>
      convertToCachedAirport(airport, regionName)
    );

    console.log(`✓ Fetched ${cachedAirports.length} airports for ${regionName}`);

    return NextResponse.json({
      success: true,
      region: regionName,
      count: cachedAirports.length,
      data: cachedAirports,
    });
  } catch (error) {
    console.error('Bulk airport fetch error:', error);

    // Provide detailed error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isAPIError = errorMessage.includes('OpenAIP API error');

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        hint: isAPIError
          ? 'Check that OPEN_AIP_API_KEY is valid and has sufficient quota'
          : 'Check server logs for details',
      },
      { status: 500 }
    );
  }
}
