/**
 * Bulk airport loading API endpoint
 * Fetches all airports for a specific US region in one call
 */

import { NextRequest, NextResponse } from 'next/server';
import { US_REGIONS, type CachedAirport } from '@/lib/cache/types';
import { CACHE_CONFIG } from '@/lib/constants';
import { toCachedAirport, countAirportTypes } from '@/lib/utils/airportConversion';

// Import OpenAIPAirport from shared types to ensure consistency
import type { OpenAIPAirport } from '@/lib/api/openaip';

/**
 * Fetch airports from OpenAIP with pagination support
 */
async function fetchAirportsFromOpenAIP(
  bounds: [number, number, number, number],
  limit: number = CACHE_CONFIG.BULK_FETCH_LIMIT
): Promise<OpenAIPAirport[]> {
  const [west, south, east, north] = bounds;
  const bbox = `${west},${south},${east},${north}`;

  // Use header-based authentication (matches individual API)
  const url = `https://api.core.openaip.net/api/airports?bbox=${bbox}&limit=${limit}`;

  const response = await fetch(url, {
    headers: {
      'x-openaip-api-key': process.env.OPEN_AIP_API_KEY!,
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

// REMOVED: Use shared utility from lib/utils/airportConversion.ts instead

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

    // Convert to CachedAirport format using shared utility
    const cachedAirports: CachedAirport[] = openAIPAirports.map((airport) =>
      toCachedAirport(airport, regionName)
    );

    // Count airport types using shared utility
    const counts = countAirportTypes(openAIPAirports);

    console.log(`✓ Fetched ${counts.total} airports for ${regionName}`);
    console.log(`   → ${counts.towered} towered (ICAO-coded), ${counts.nonTowered} non-towered, ${counts.heliports} heliports`);

    // Show sample towered airports
    const sampleTowered = cachedAirports.filter(ap => ap.type === 'towered').slice(0, 3);
    if (sampleTowered.length > 0) {
      console.log(`   → Sample towered:`, sampleTowered.map(ap => ap.id).join(', '));
    } else {
      console.warn(`   ⚠️  NO TOWERED AIRPORTS FOUND - ICAO detection may be broken!`);
    }

    return NextResponse.json({
      success: true,
      region: regionName,
      count: counts.total,
      towered: counts.towered,
      nonTowered: counts.nonTowered,
      heliports: counts.heliports,
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
