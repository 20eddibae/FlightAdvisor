// Grid resolution for A* pathfinding
export const GRID_SIZE = 100

// Timeout for routing calculations (milliseconds)
export const ROUTING_TIMEOUT = 2000

// Timeout for API calls (milliseconds)
export const API_TIMEOUT = 60000

// Colors for map visualization (neutral gray theme per CLAUDE.md)
export const COLORS = {
  // Airspace colors (increased opacity for better visibility)
  CLASS_B_FILL: 'rgba(34, 197, 94, 0.4)', // Green
  CLASS_B_STROKE: 'rgba(21, 128, 61, 1.0)', // Dark Green
  RESTRICTED_FILL: 'rgba(239, 68, 68, 0.45)', // Red
  RESTRICTED_STROKE: 'rgba(153, 27, 27, 1.0)', // Dark Red

  // Route colors
  ROUTE_LINE: '#2563eb',
  ROUTE_LINE_WIDTH: 3,

  // Marker colors
  AIRPORT_MARKER: '#22c55e', // Green for ALL airports
  VOR_MARKER: '#ef4444', // Red for VOR/VORTAC
  OTHER_WAYPOINT_MARKER: '#3b82f6', // Blue for GPS_FIX, NDB, INTERSECTION, AIRPORT waypoints

  // Legacy (keep for backwards compatibility)
  DEPARTURE_MARKER: '#22c55e',
  ARRIVAL_MARKER: '#ef4444',
  WAYPOINT_MARKER: '#3b82f6',
  WAYPOINT_OTHER_MARKER: '#ef4444',

  // UI colors (matching shadcn neutral theme)
  PRIMARY: 'hsl(0 0% 9%)',
  SECONDARY: 'hsl(0 0% 96.1%)',
  MUTED: 'hsl(0 0% 45.1%)',
}

// Mapbox configuration
export const MAPBOX_CONFIG = {
  STYLE: 'mapbox://styles/mapbox/outdoors-v12',
  CENTER: [-122.2, 37.7] as [number, number], // Bay Area
  ZOOM: 9,
}

// Default bounding box for OpenAIP data (Continental United States)
export const DEFAULT_BOUNDS: [number, number, number, number] = [-125.0, 24.0, -66.0, 49.0]

// US Regional bounds for dense data coverage (7 regions × 100 items = 700 total)
export const US_REGIONS: { name: string; bounds: [number, number, number, number] }[] = [
  { name: 'West Coast', bounds: [-125, 32, -115, 49] }, // CA, OR, WA - FIXED: Must match types.ts (was -114, now -115)
  { name: 'Southwest', bounds: [-115.0, 31.0, -103.0, 42.0] }, // AZ, NV, UT, CO, NM
  { name: 'North Central', bounds: [-111.0, 40.0, -96.0, 49.0] }, // MT, WY, ND, SD, NE, KS
  { name: 'South Central', bounds: [-107.0, 25.0, -88.0, 37.0] }, // TX, OK, LA, AR
  { name: 'Midwest', bounds: [-97.0, 37.0, -80.0, 49.0] }, // MN, IA, WI, IL, IN, MI, OH
  { name: 'Southeast', bounds: [-92.0, 24.0, -75.0, 37.0] }, // MS, AL, GA, FL, SC, NC, TN, KY
  { name: 'Northeast', bounds: [-82.0, 37.0, -66.0, 48.0] }, // VA, WV, MD, DE, NJ, PA, NY, New England
]

// Route calculation constants
export const ROUTE_CONFIG = {
  // Waypoint snapping distance in nautical miles
  SNAP_DISTANCE_NM: 2,

  // Douglas-Peucker simplification tolerance
  SIMPLIFY_TOLERANCE: 0.01,

  // Aircraft groundspeed for time estimation (knots)
  GROUNDSPEED_KNOTS: 120,

  // Cruise altitude (feet MSL)
  CRUISE_ALTITUDE: 5500,
}

// Cache configuration
export const CACHE_CONFIG = {
  // Maximum number of cached routes
  MAX_ROUTES: 10,

  // Maximum number of cached reasoning results
  MAX_REASONING: 5,

  // Airport cache configuration
  AIRPORT_TTL_MS: 24 * 60 * 60 * 1000,  // 24 hours
  SPATIAL_GRID_CELL_SIZE: 0.5,           // Degrees (~35 miles at mid-latitudes)
  MAX_SEARCH_RESULTS: 50,
  SEARCH_DEBOUNCE_MS: 150,
  DB_NAME: 'SkyrisCache',
  DB_VERSION: 1,
  BULK_FETCH_LIMIT: 500,                 // Max airports per API call
}

// Feature flags
export const FEATURE_FLAGS = {
  USE_AIRPORT_CACHE: true,  // Set to false to revert to API calls (fallback for performance issues)
}
