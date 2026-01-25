// Grid resolution for A* pathfinding
export const GRID_SIZE = 100

// Timeout for routing calculations (milliseconds)
export const ROUTING_TIMEOUT = 2000

// Timeout for API calls (milliseconds)
export const API_TIMEOUT = 3500

// Colors for map visualization (neutral gray theme per CLAUDE.md)
export const COLORS = {
  // Airspace colors
  CLASS_B_FILL: 'rgba(128, 128, 128, 0.3)',
  CLASS_B_STROKE: 'rgba(64, 64, 64, 0.8)',
  RESTRICTED_FILL: 'rgba(128, 128, 128, 0.25)',
  RESTRICTED_STROKE: 'rgba(64, 64, 64, 0.7)',

  // Route colors
  ROUTE_LINE: '#2563eb',
  ROUTE_LINE_WIDTH: 3,

  // Marker colors
  DEPARTURE_MARKER: '#22c55e',
  ARRIVAL_MARKER: '#ef4444',
  WAYPOINT_MARKER: '#3b82f6',

  // UI colors (matching shadcn neutral theme)
  PRIMARY: 'hsl(0 0% 9%)',
  SECONDARY: 'hsl(0 0% 96.1%)',
  MUTED: 'hsl(0 0% 45.1%)',
}

// Mapbox configuration
export const MAPBOX_CONFIG = {
  STYLE: 'mapbox://styles/mapbox/outdoors-v12',
  CENTER: [-121.9, 38.0] as [number, number], // Midpoint between KSQL and KSMF
  ZOOM: 8,
}

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
}
