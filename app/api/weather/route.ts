import { NextRequest, NextResponse } from 'next/server';

/**
 * Aviation Weather API Route
 *
 * Fetches METAR and TAF data from Aviation Weather Center for specified airport stations.
 * Accepts comma-separated ICAO codes via the 'ids' query parameter (e.g., ?ids=KSQL,KSMF)
 *
 * Returns normalized weather data with both METAR (current conditions) and TAF (forecast) information.
 */
export async function GET(request: NextRequest) {
  try {
    // Extract station IDs from query parameters
    const searchParams = request.nextUrl.searchParams;
    const idsParam = searchParams.get('ids');

    if (!idsParam) {
      return NextResponse.json(
        { error: 'Missing required query parameter: ids' },
        { status: 400 }
      );
    }

    const ids = idsParam.split(',').map(id => id.trim().toUpperCase());

    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'No valid station IDs provided' },
        { status: 400 }
      );
    }

    // Fetch METAR and TAF data in parallel
    const [metarResponse, tafResponse] = await Promise.all([
      fetch(
        `https://aviationweather.gov/api/data/metar?ids=${ids.join(',')}&format=json`,
        {
          headers: { 'Accept': 'application/json' },
          cache: 'no-store' // Ensure fresh weather data
        }
      ),
      fetch(
        `https://aviationweather.gov/api/data/taf?ids=${ids.join(',')}&format=json`,
        {
          headers: { 'Accept': 'application/json' },
          cache: 'no-store' // Ensure fresh weather data
        }
      )
    ]);

    // Handle API errors
    if (!metarResponse.ok) {
      console.error(`METAR API error: ${metarResponse.status}`);
    }
    if (!tafResponse.ok) {
      console.error(`TAF API error: ${tafResponse.status}`);
    }

    // Parse responses (handle potential failures gracefully)
    const metarData = metarResponse.ok ? await metarResponse.json() : [];
    const tafData = tafResponse.ok ? await tafResponse.json() : [];

    // Normalize data into required format
    const stations = ids.map(stationId => {
      // Find matching METAR and TAF for this station
      const metar = Array.isArray(metarData)
        ? metarData.find((m: any) => m.icaoId === stationId || m.stationId === stationId)
        : null;

      const taf = Array.isArray(tafData)
        ? tafData.find((t: any) => t.icaoId === stationId || t.stationId === stationId)
        : null;

      return {
        station: stationId,
        metar: metar || null,
        taf: taf || null
      };
    });

    return NextResponse.json({
      fetchedAt: new Date().toISOString(),
      ids,
      stations
    });

  } catch (error) {
    console.error('Weather API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch weather data',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
