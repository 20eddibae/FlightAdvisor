import { NextRequest, NextResponse } from 'next/server';

/**
 * Aviation Hazards API Route
 *
 * Fetches G-AIRMET and SIGMET hazardous weather advisories from Aviation Weather Center.
 * Uses GeoJSON format endpoints to get real geometry data.
 *
 * Endpoints used:
 * - G-AIRMET (CONUS): https://aviationweather.gov/api/data/gairmet?format=geojson
 * - CONUS SIGMET: https://aviationweather.gov/api/data/airsigmet?format=geojson
 * - International SIGMET: https://aviationweather.gov/api/data/isigmet?format=geojson
 *
 * Query param: bounds=minLon,minLat,maxLon,maxLat (e.g., ?bounds=-123,37,-121,39)
 *
 * Returns normalized hazard data with GeoJSON geometry for map rendering.
 */

interface Bounds {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

interface HazardItem {
  id: string;
  kind: 'AIRMET' | 'SIGMET';
  phenomenon: string | null;
  severity: string | null;
  validFrom: string | null;
  validTo: string | null;
  rawText: string | null;
  geometry: GeoJSON.Geometry | null;
}

interface HazardResponse {
  fetchedAt: string;
  bounds: [number, number, number, number];
  hazards: HazardItem[];
  warnings?: string[];
}

/**
 * Parse and validate bounds query parameter
 */
function parseBounds(boundsParam: string | null): Bounds | null {
  if (!boundsParam) {
    return null;
  }

  const parts = boundsParam.split(',').map(p => parseFloat(p.trim()));

  if (parts.length !== 4 || parts.some(isNaN)) {
    return null;
  }

  const [minLon, minLat, maxLon, maxLat] = parts;

  if (minLon < -180 || minLon > 180 || maxLon < -180 || maxLon > 180) {
    return null;
  }
  if (minLat < -90 || minLat > 90 || maxLat < -90 || maxLat > 90) {
    return null;
  }
  if (minLon >= maxLon || minLat >= maxLat) {
    return null;
  }

  return { minLon, minLat, maxLon, maxLat };
}

/**
 * Compute bounding box of a GeoJSON geometry
 */
function computeGeometryBbox(geometry: GeoJSON.Geometry): [number, number, number, number] | null {
  const coords: Array<[number, number]> = [];

  function extractCoords(arr: any): void {
    if (Array.isArray(arr)) {
      if (arr.length >= 2 && typeof arr[0] === 'number' && typeof arr[1] === 'number') {
        coords.push([arr[0], arr[1]]);
      } else {
        arr.forEach(extractCoords);
      }
    }
  }

  if ('coordinates' in geometry) {
    extractCoords(geometry.coordinates);
  } else if (geometry.type === 'GeometryCollection' && 'geometries' in geometry) {
    geometry.geometries.forEach(g => {
      if ('coordinates' in g) extractCoords(g.coordinates);
    });
  }

  if (coords.length === 0) return null;

  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  for (const [lon, lat] of coords) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return [minLon, minLat, maxLon, maxLat];
}

/**
 * Check if two bounding boxes intersect
 */
function bboxIntersects(
  a: [number, number, number, number],
  b: [number, number, number, number]
): boolean {
  // a and b are [minLon, minLat, maxLon, maxLat]
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

/**
 * Check if a hazard's geometry intersects with bounds.
 * If geometry is null, we KEEP the item (cannot determine location, include for safety).
 */
function hazardIntersectsBounds(hazard: HazardItem, bounds: Bounds): boolean {
  if (!hazard.geometry) {
    // Keep items without geometry - we cannot filter them by location
    return true;
  }

  const geomBbox = computeGeometryBbox(hazard.geometry);
  if (!geomBbox) {
    return true; // Keep if we can't compute bbox
  }

  const boundsBbox: [number, number, number, number] = [
    bounds.minLon,
    bounds.minLat,
    bounds.maxLon,
    bounds.maxLat
  ];

  return bboxIntersects(geomBbox, boundsBbox);
}

/**
 * Generate a deterministic unique ID from GeoJSON feature properties.
 * Prefers stable upstream IDs, falls back to deterministic hash from properties.
 */
function generateFeatureId(
  properties: Record<string, any> | null,
  kind: 'AIRMET' | 'SIGMET',
  index: number
): string {
  const props = properties || {};

  // Try stable upstream ID fields
  if (props.id) return String(props.id);
  if (props.prodId) return String(props.prodId);
  if (props.seriesId) return String(props.seriesId);
  if (props.airsigmetId) return String(props.airsigmetId);
  if (props.airSigmetId) return String(props.airSigmetId);
  if (props.hazardId) return String(props.hazardId);

  // Build deterministic fallback from available properties
  const timeField =
    props.validTimeFrom ||
    props.validFrom ||
    props.issueTime ||
    props.issuance ||
    props.startTime ||
    '';
  const phenomenonField =
    props.hazard ||
    props.phenomenon ||
    props.type ||
    props.airsigmetType ||
    props.hazardType ||
    'UNK';
  const region = props.region || props.firId || props.firName || props.area || '';

  // Clean time string for ID use
  const cleanTime = String(timeField).replace(/[^a-zA-Z0-9]/g, '');

  return `${kind}-${cleanTime}-${phenomenonField}-${region}-${index}`.replace(/--+/g, '-');
}

/**
 * Normalize a GeoJSON feature into our HazardItem format
 */
function normalizeFeature(
  feature: GeoJSON.Feature,
  kind: 'AIRMET' | 'SIGMET',
  index: number
): HazardItem {
  const props = feature.properties || {};

  const id = generateFeatureId(props, kind, index);

  // Extract phenomenon/hazard type
  const phenomenon =
    props.hazard ||
    props.phenomenon ||
    props.airsigmetType ||
    props.hazardType ||
    props.type ||
    null;

  // Extract severity
  const severity =
    props.severity ||
    props.intensityChange ||
    props.intensity ||
    null;

  // Extract valid times
  const validFrom =
    props.validTimeFrom ||
    props.validFrom ||
    props.startTime ||
    props.issueTime ||
    props.issuance ||
    null;

  const validTo =
    props.validTimeTo ||
    props.validTo ||
    props.endTime ||
    props.expireTime ||
    null;

  // Extract raw text if present
  const rawText =
    props.rawText ||
    props.rawAirSigmet ||
    props.rawAIRMET ||
    props.rawSIGMET ||
    props.text ||
    props.raw ||
    null;

  // Use geometry directly from feature
  const geometry = feature.geometry || null;

  return {
    id,
    kind,
    phenomenon,
    severity,
    validFrom,
    validTo,
    rawText,
    geometry
  };
}

/**
 * Fetch a GeoJSON feed and return features with metadata
 */
async function fetchGeoJsonFeed(
  url: string,
  feedName: string
): Promise<{ features: GeoJSON.Feature[]; warning: string | null }> {
  console.log(`[Hazards] Fetching ${feedName} from:`, url);

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });

    console.log(`[Hazards] ${feedName} status:`, response.status);

    if (!response.ok) {
      const warning = `${feedName} fetch failed: HTTP ${response.status}`;
      console.error(`[Hazards] ${warning}`);
      return { features: [], warning };
    }

    const contentType = response.headers.get('content-type') || '';
    console.log(`[Hazards] ${feedName} content-type:`, contentType);

    const text = await response.text();
    console.log(`[Hazards] ${feedName} response length:`, text.length);

    if (text.length === 0) {
      console.log(`[Hazards] ${feedName} returned empty response`);
      return { features: [], warning: null };
    }

    // Check if it looks like JSON
    const trimmed = text.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      const warning = `${feedName} returned non-JSON response`;
      console.warn(`[Hazards] ${warning}:`, trimmed.slice(0, 200));
      return { features: [], warning };
    }

    let data: any;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      const warning = `${feedName} JSON parse failed: ${parseError instanceof Error ? parseError.message : 'unknown'}`;
      console.error(`[Hazards] ${warning}`);
      return { features: [], warning };
    }

    // Handle GeoJSON FeatureCollection
    if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
      console.log(`[Hazards] ${feedName} parsed as FeatureCollection, count:`, data.features.length);

      // Log first feature structure for debugging
      if (data.features.length > 0) {
        const first = data.features[0];
        const propKeys = first.properties ? Object.keys(first.properties) : [];
        const geomType = first.geometry?.type || 'null';
        console.log(`[Hazards] ${feedName} first feature property keys:`, propKeys);
        console.log(`[Hazards] ${feedName} first feature geometry.type:`, geomType);
      }

      return { features: data.features, warning: null };
    }

    // Handle plain array of features
    if (Array.isArray(data)) {
      console.log(`[Hazards] ${feedName} parsed as array, count:`, data.length);

      // Check if items look like features
      const features = data.filter(
        (item: any) => item && (item.type === 'Feature' || item.geometry)
      );

      if (features.length > 0) {
        const first = features[0];
        const propKeys = first.properties ? Object.keys(first.properties) : [];
        const geomType = first.geometry?.type || 'null';
        console.log(`[Hazards] ${feedName} first feature property keys:`, propKeys);
        console.log(`[Hazards] ${feedName} first feature geometry.type:`, geomType);
      }

      return { features, warning: null };
    }

    // Unexpected format
    console.log(`[Hazards] ${feedName} unexpected format, keys:`, Object.keys(data));
    return { features: [], warning: `${feedName} returned unexpected format` };

  } catch (error) {
    const warning = `${feedName} fetch error: ${error instanceof Error ? error.message : 'unknown'}`;
    console.error(`[Hazards] ${warning}`);
    return { features: [], warning };
  }
}

export async function GET(request: NextRequest) {
  const warnings: string[] = [];

  try {
    // Parse and validate bounds parameter
    const searchParams = request.nextUrl.searchParams;
    const boundsParam = searchParams.get('bounds');

    const bounds = parseBounds(boundsParam);
    if (!bounds) {
      return NextResponse.json(
        {
          error: 'Invalid or missing bounds parameter',
          expected: 'bounds=minLon,minLat,maxLon,maxLat',
          example: 'bounds=-123,37,-121,39'
        },
        { status: 400 }
      );
    }

    // Define endpoints for GeoJSON feeds
    const gairmetUrl = 'https://aviationweather.gov/api/data/gairmet?format=geojson';
    const airsigmetUrl = 'https://aviationweather.gov/api/data/airsigmet?format=geojson';
    const isigmetUrl = 'https://aviationweather.gov/api/data/isigmet?format=geojson';

    // Fetch all feeds in parallel
    const [gairmetResult, airsigmetResult, isigmetResult] = await Promise.all([
      fetchGeoJsonFeed(gairmetUrl, 'G-AIRMET'),
      fetchGeoJsonFeed(airsigmetUrl, 'CONUS-SIGMET'),
      fetchGeoJsonFeed(isigmetUrl, 'INTL-SIGMET')
    ]);

    // Collect warnings
    if (gairmetResult.warning) warnings.push(gairmetResult.warning);
    if (airsigmetResult.warning) warnings.push(airsigmetResult.warning);
    if (isigmetResult.warning) warnings.push(isigmetResult.warning);

    // Normalize features into hazards
    const gairmetHazards = gairmetResult.features.map((f, i) =>
      normalizeFeature(f, 'AIRMET', i)
    );

    const conusSigmetHazards = airsigmetResult.features.map((f, i) =>
      normalizeFeature(f, 'SIGMET', i)
    );

    const intlSigmetHazards = isigmetResult.features.map((f, i) =>
      normalizeFeature(f, 'SIGMET', i + 10000) // Offset index to avoid ID collisions
    );

    console.log('[Hazards] Normalized G-AIRMETs:', gairmetHazards.length);
    console.log('[Hazards] Normalized CONUS SIGMETs:', conusSigmetHazards.length);
    console.log('[Hazards] Normalized INTL SIGMETs:', intlSigmetHazards.length);

    // Log sample normalized hazards
    if (gairmetHazards.length > 0) {
      console.log('[Hazards] First G-AIRMET:', JSON.stringify(gairmetHazards[0], null, 2).slice(0, 500));
    }
    if (conusSigmetHazards.length > 0) {
      console.log('[Hazards] First CONUS SIGMET:', JSON.stringify(conusSigmetHazards[0], null, 2).slice(0, 500));
    }

    // Combine all hazards
    const allHazards = [...gairmetHazards, ...conusSigmetHazards, ...intlSigmetHazards];

    // Filter by bounds
    const filteredHazards = allHazards.filter(hazard =>
      hazardIntersectsBounds(hazard, bounds)
    );

    console.log('[Hazards] Total hazards:', allHazards.length);
    console.log('[Hazards] After bounds filter:', filteredHazards.length);

    const response: HazardResponse = {
      fetchedAt: new Date().toISOString(),
      bounds: [bounds.minLon, bounds.minLat, bounds.maxLon, bounds.maxLat],
      hazards: filteredHazards
    };

    // Include warnings if any
    if (warnings.length > 0) {
      response.warnings = warnings;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('[Hazards] API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch hazard data',
        message: error instanceof Error ? error.message : 'Unknown error',
        warnings
      },
      { status: 500 }
    );
  }
}
