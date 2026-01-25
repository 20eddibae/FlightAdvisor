import { NextRequest, NextResponse } from 'next/server';

/**
 * Aviation Weather API Route
 *
 * Two modes:
 * 1. Station-specific (ids): Fetches METAR and TAF for specific airports (e.g., ?ids=KSQL,KSMF)
 * 2. Area-based (bbox): Fetches GeoJSON METARs for map display (e.g., ?bbox=-122,37,-121,38&format=geojson)
 *
 * Returns normalized weather data with both METAR (current conditions) and TAF (forecast) information.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const idsParam = searchParams.get('ids');
    const bboxParam = searchParams.get('bbox');
    const formatParam = searchParams.get('format');

    // MODE 1: Area-based GeoJSON fetch for map overlay
    if (bboxParam) {
      const bbox = bboxParam.trim();

      // Validate bbox format (minLon,minLat,maxLon,maxLat)
      const bboxParts = bbox.split(',').map(Number);
      if (bboxParts.length !== 4 || bboxParts.some(isNaN)) {
        return NextResponse.json(
          { error: 'Invalid bbox format. Expected: minLon,minLat,maxLon,maxLat' },
          { status: 400 }
        );
      }

      const [west, south, east, north] = bboxParts;

      // AWC API doesn't support bbox for GeoJSON - use major California airports
      // Filter based on rough regions to avoid fetching all stations every time
      let stationIds: string[] = [];

      // Bay Area stations
      if (west <= -121 && east >= -123 && south <= 38.5 && north >= 36.5) {
        stationIds.push('KSFO', 'KOAK', 'KSJC', 'KSQL', 'KPAO', 'KHWD', 'KLVK', 'KCCR');
      }

      // Sacramento area
      if (west <= -120.5 && east >= -122.5 && south <= 39 && north >= 37.5) {
        stationIds.push('KSMF', 'KSAC', 'KMHR', 'KAUN', 'KLHM', 'KVCB');
      }

      // Central Valley
      if (west <= -119 && east >= -122 && south <= 37.5 && north >= 35.5) {
        stationIds.push('KMOD', 'KFAT', 'KMER', 'KVIS');
      }

      // Southern California (LA area)
      if (west <= -117 && east >= -119 && south <= 34.5 && north >= 33) {
        stationIds.push('KLAX', 'KBUR', 'KSNA', 'KLGB', 'KVNY', 'KSMO');
      }

      // Remove duplicates
      stationIds = [...new Set(stationIds)];

      if (stationIds.length === 0) {
        console.log('No relevant stations for bbox:', bbox);
        return NextResponse.json({
          fetchedAt: new Date().toISOString(),
          type: 'FeatureCollection',
          features: [],
        });
      }

      // Fetch METARs as GeoJSON for these stations
      const metarUrl = `https://aviationweather.gov/api/data/metar?ids=${stationIds.join(',')}&format=geojson`;

      console.log(`Fetching cloud data for ${stationIds.length} stations: ${stationIds.join(', ')}`);

      const response = await fetch(metarUrl, {
        headers: { 'Accept': 'application/geo+json' },
        cache: 'no-store', // Always get fresh weather data
      });

      if (!response.ok) {
        console.error(`AWC METAR GeoJSON API error: ${response.status}`);
        return NextResponse.json(
          { error: `AWC API returned ${response.status}` },
          { status: response.status }
        );
      }

      const geojson = await response.json();

      console.log(`✓ Received ${geojson.features?.length || 0} METAR reports`);

      // Add timestamp for cache management
      return NextResponse.json({
        fetchedAt: new Date().toISOString(),
        type: 'FeatureCollection',
        features: geojson.features || [],
      });
    }

    // MODE 2: Station-specific fetch (original behavior)
    if (!idsParam) {
      return NextResponse.json(
        { error: 'Missing required query parameter: ids or bbox' },
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
