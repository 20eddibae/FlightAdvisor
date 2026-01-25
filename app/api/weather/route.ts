import { NextRequest, NextResponse } from 'next/server';

/**
 * Aviation Weather API Route
 *
 * Two modes:
 * 1. Station-specific (ids): Fetches METAR and TAF for any airports (e.g., ?ids=KSQL,KSMF,KLAX,KJFK)
 * 2. GeoJSON mode (bbox): Fetches GeoJSON METARs for map display (e.g., ?bbox=-122,37,-121,38)
 *    - Optional: Can specify airports with &ids=KSQL,KSMF,KSFO
 *    - If no ids provided, fetches comprehensive list of major US airports nationwide
 *
 * Features:
 * - Supports ANY valid ICAO airport identifier worldwide (not limited to specific regions)
 * - Returns normalized weather data with both METAR (current conditions) and TAF (forecast) information
 * - GeoJSON format includes geographic coordinates for map overlay
 * - Comprehensive nationwide airport coverage when ids not specified (250+ major airports)
 * - Covers all US regions: West Coast, East Coast, Midwest, South, and Mountain states
 *
 * Examples:
 * - Single airport: /api/weather?ids=KSQL
 * - Multiple airports (any): /api/weather?ids=KSQL,KJFK,KORD,KATL
 * - Map overlay (auto, nationwide): /api/weather?bbox=-122,37,-121,38
 * - Map overlay (specific): /api/weather?bbox=-122,37,-121,38&ids=KSQL,KSMF,KSFO
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const idsParam = searchParams.get('ids');
    const bboxParam = searchParams.get('bbox');
    const formatParam = searchParams.get('format');

    // MODE 1: Area-based GeoJSON fetch for map overlay
    if (bboxParam) {
      // AWC API doesn't support direct bbox queries for GeoJSON
      // We fetch weather for a comprehensive list of airports
      // The GeoJSON response includes coordinates, so client can filter by bbox

      let stationIds: string[];

      if (idsParam) {
        // If specific IDs provided, use those
        stationIds = idsParam.split(',').map(id => id.trim().toUpperCase());
      } else {
        // Otherwise, fetch comprehensive list of major US airports
        // This replaces the hardcoded regional logic with a broader approach
        stationIds = [
          // California - Bay Area
          'KSFO', 'KOAK', 'KSJC', 'KSQL', 'KPAO', 'KHWD', 'KLVK', 'KCCR', 'KNUQ', 'KHAF',
          // California - Sacramento/North
          'KSMF', 'KSAC', 'KMHR', 'KAUN', 'KLHM', 'KVCB', 'KBAB', 'KRDD', 'KCIC',
          // California - Central Valley
          'KMOD', 'KFAT', 'KMER', 'KVIS', 'KFCH', 'KMAE', 'KOVE',
          // California - Southern
          'KLAX', 'KBUR', 'KSNA', 'KLGB', 'KVNY', 'KSMO', 'KONT', 'KSAN', 'KMYF', 'KCRQ',
          'KSBA', 'KSLO', 'KSBP', 'KPRB', 'KWVI', 'KPSP', 'KTRM',
          // Nevada
          'KLAS', 'KRNO', 'KVGT', 'KHND', 'KBVU',
          // Arizona
          'KPHX', 'KSDL', 'KIWA', 'KDVT', 'KGEU', 'KTUS', 'KFLG', 'KPRC',
          // Oregon
          'KPDX', 'KHIO', 'KEUG', 'KRDM', 'KOTH', 'KMFR', 'KLMT',
          // Washington
          'KSEA', 'KBFI', 'KPAE', 'KGEG', 'KOLM', 'KTIW', 'KBLI',
          // Idaho
          'KBOI', 'KSUN', 'KIDA', 'KPIH',
          // Montana
          'KBIL', 'KGPI', 'KMSO', 'KGTF',
          // Wyoming
          'KJAC', 'KCPR', 'KRIW',
          // Utah
          'KSLC', 'KOGD', 'KPVU', 'KCNY', 'KSGU',
          // Colorado
          'KDEN', 'KAPA', 'KBJC', 'KCOS', 'KASE', 'KGJT', 'KBDU',
          // New Mexico
          'KABQ', 'KSAF', 'KLRU', 'KROW',
          // Texas
          'KDFW', 'KDAL', 'KFTW', 'KHOU', 'KIAH', 'KAUS', 'KSAT', 'KELP', 'KAMA',
          // Florida
          'KMIA', 'KFLL', 'KPBI', 'KTPA', 'KMCO', 'KJAX', 'KTLH', 'KRSW', 'KSFB', 'KFXE',
          // Georgia
          'KATL', 'KPDK', 'KFTY', 'KSAV', 'KAGS', 'KMCN',
          // North Carolina
          'KCLT', 'KRDU', 'KGSO', 'KAVL', 'KILM', 'KFAY',
          // South Carolina
          'KCHS', 'KCAE', 'KGSP', 'KMYR',
          // Virginia
          'KIAD', 'KDCA', 'KRIC', 'KNGU', 'KORF', 'KCHO', 'KROA',
          // Maryland
          'KBWI', 'KADW', 'KDMW',
          // Delaware
          'KILG', 'KDOV',
          // New Jersey
          'KEWR', 'KTEB', 'KCDW', 'KMMU', 'KACY',
          // New York
          'KJFK', 'KLGA', 'KISP', 'KHPN', 'KALB', 'KBUF', 'KROC', 'KSYR', 'KBGM',
          // Pennsylvania
          'KPHL', 'KPIT', 'KABE', 'KAVP', 'KERI', 'KLBE',
          // Connecticut
          'KBDL', 'KHVN', 'KBDR', 'KOXC',
          // Rhode Island
          'KPVD', 'KUUU',
          // Massachusetts
          'KBOS', 'KBED', 'KORH', 'KHYA', 'KACK', 'KMVY',
          // New Hampshire
          'KMHT', 'KPSM',
          // Vermont
          'KBTV', 'KRUT',
          // Maine
          'KPWM', 'KBGR', 'KAUG',
          // Ohio
          'KCLE', 'KCMH', 'KCVG', 'KDAY', 'KTOL',
          // Indiana
          'KIND', 'KFWA', 'KSBN', 'KEVV',
          // Illinois
          'KORD', 'KMDW', 'KPWK', 'KDPA', 'KPIA', 'KSPI',
          // Michigan
          'KDTW', 'KGRR', 'KLAN', 'KFNT', 'KMKG',
          // Wisconsin
          'KMKE', 'KMSN', 'KGRB', 'KATW',
          // Minnesota
          'KMSP', 'KDLH', 'KRST',
          // Tennessee
          'KBNA', 'KMEM', 'KTYS', 'KTRI', 'KCHA',
          // Kentucky
          'KSDF', 'KLEX', 'KCVG',
          // Alabama
          'KBHM', 'KMOB', 'KHSV', 'KMGM',
          // Mississippi
          'KJAN', 'KGPT', 'KGTR',
          // Louisiana
          'KMSY', 'KBTR', 'KLFT', 'KSHV',
          // Arkansas
          'KLIT', 'KXNA', 'KFSM',
          // Missouri
          'KMCI', 'KSTL', 'KSGF',
          // Iowa
          'KDSM', 'KCID', 'KDBQ',
          // Kansas
          'KMCI', 'KICT', 'KSLN',
          // Nebraska
          'KOMA', 'KLNK', 'KGRI',
          // Oklahoma
          'KOKC', 'KTUL', 'KLAW',
          // South Dakota
          'KFSD', 'KRAP', 'KABR',
          // North Dakota
          'KFAR', 'KBIS', 'KGFK',
        ];
        console.log(`Using comprehensive nationwide airport list (${stationIds.length} airports across all US regions) for bbox query`);
      }

      if (stationIds.length === 0) {
        return NextResponse.json(
          { error: 'No valid station IDs provided' },
          { status: 400 }
        );
      }

      // Fetch METARs as GeoJSON for these stations
      const metarUrl = `https://aviationweather.gov/api/data/metar?ids=${stationIds.join(',')}&format=geojson`;

      console.log(`Fetching weather data for ${stationIds.length} airport(s): ${stationIds.join(', ')}`);

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

      console.log(`✓ Received ${geojson.features?.length || 0} METAR report(s)`);

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
