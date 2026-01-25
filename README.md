# Skyris

An intelligent flight planning tool that uses AI reasoning to analyze airspace restrictions, weather conditions, and navigation waypoints to recommend optimal flight paths with transparent explanations.

## Demo Route

**San Carlos (KSQL) → Sacramento Executive (KSMF)**

## Features

- **Interactive Map**: Mapbox GL JS with VFR sectional overlay
- **Airspace Visualization**: Class B and restricted zones with hover information
- **Intelligent Routing**:
  - Direct route when clear
  - Waypoint routing through VORs/GPS fixes
  - A* pathfinding on 100x100 grid for complex scenarios
- **AI Reasoning**: Gemini API generates pilot-appropriate explanations
- **Route Information**: Distance (nm), estimated time, airspace avoidance status

## Tech Stack

- **Framework**: Next.js 14 (App Router, TypeScript)
- **Mapping**: Mapbox GL JS
- **UI**: shadcn/ui (neutral theme)
- **AI**: Google Gemini 1.5 Flash API
- **Routing**: Custom A* pathfinding with Turf.js geometry
- **Deployment**: Vercel

## Prerequisites

1. **Node.js** 18+ and npm
2. **Mapbox Access Token**: Get from https://account.mapbox.com/
3. **Gemini API Key**: Get from https://ai.google.dev/
4. **OpenAIP API Key**: Get from https://www.openaip.net/ (aviation data: airports, waypoints, airspace)

## Setup Instructions

### 1. Install Dependencies

\`\`\`bash
npm install
\`\`\`

### 2. Configure Environment Variables

Create a \`.env.local\` file in the project root:

\`\`\`bash
# Mapbox (client-side safe, starts with "pk.")
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token_here

# Gemini (server-side only, starts with "AIza")
GEMINI_API_KEY=your_gemini_api_key_here

# OpenAIP (aviation data: airports, waypoints, airspace)
OPEN_AIP_API_KEY=your_openaip_api_key_here
\`\`\`

### 3. Run Development Server

\`\`\`bash
npm run dev
\`\`\`

Open http://localhost:3000

### 4. Build for Production

\`\`\`bash
npm run build
npm start
\`\`\`

## Usage

1. **View Map**: The application loads with San Carlos (KSQL) and Sacramento (KSMF) airports marked
2. **Click "Plan Route"**: Calculates optimal route avoiding SFO Class B airspace
3. **View Reasoning**: AI explains WHY each routing decision was made
4. **Explore Airspace**: Hover over gray airspace zones to see details
5. **Click Markers**: View airport and waypoint information

## Project Directory Structure


\`\`\`
/app                    - Next.js App Router pages
  /api/reasoning       - Gemini API endpoint
/components
  /Map                 - Mapbox components
  /Controls            - UI controls (route planning, reasoning)
  /ui                  - shadcn/ui primitives
/lib
  /api                 - Gemini API client
  /routing             - A* pathfinding, route calculation
  geometry.ts          - Turf.js geometry utilities
  geojson.ts           - Data loaders
  constants.ts         - Configuration
  fallback-reasoning.ts - Pre-written reasoning (API fallback)
/data
  airports.json        - KSQL, KSMF coordinates
  waypoints.json       - SUNOL, PYE, CCR, SAC waypoints
  /airspace            - GeoJSON polygons for Class B and restricted zones
\`\`\`

## Aviation Data

- **Airports**: Real coordinates from AirNav
- **Waypoints**: Actual VOR/VORTAC/GPS fixes in Northern California
- **Airspace**: Simplified GeoJSON polygons (8-vertex Class B, example restricted zones)

## Performance Targets

- Map loads: <3 seconds
- Route calculation: <2 seconds
- AI reasoning: <4 seconds (with 3.5s timeout + fallback)

## Demo Script (90 seconds)

1. **[0:00-0:15]** Introduction: "Skyris explains WHY routes are safe"
2. **[0:15-0:30]** Show map with airports, waypoints, and airspace
3. **[0:30-0:50]** Click "Plan Route" - watch route avoid Class B
4. **[0:50-1:15]** Display AI reasoning panel - educational explanations
5. **[1:15-1:30]** Highlight: "Every flight plan becomes a learning opportunity"

## API Endpoints

### POST /api/reasoning

Generate AI reasoning for a flight route.

**Request Body:**
\`\`\`json
{
  "departure": "KSQL",
  "arrival": "KSMF",
  "departureCoords": [-122.2495, 37.5119],
  "arrivalCoords": [-121.4932, 38.5125],
  "waypoints": ["SUNOL"],
  "distance_nm": 87.3,
  "estimated_time_min": 44,
  "route_type": "avoiding_airspace"
}
\`\`\`

**Response:**
\`\`\`json
{
  "reasoning": "Route avoids SFO Class B airspace using SUNOL waypoint...",
  "cached": false
}
\`\`\`

## Deployment

### Vercel (using .env.local)

1. Add to `.env.local`:
   ```
   VERCEL_TOKEN=your_token_from_vercel_dashboard
   ```
   Create a token at [Vercel → Settings → Tokens](https://vercel.com/account/tokens).

2. Install deps and deploy:
   ```bash
   npm install
   npm run deploy
   ```
   The deploy script loads `VERCEL_TOKEN` from `.env.local` and runs `vercel --prod`.

3. Set environment variables in the Vercel project dashboard:
   - `NEXT_PUBLIC_MAPBOX_TOKEN`
   - `GEMINI_API_KEY`

## Key Design Decisions

- **Gemini 1.5 Flash**: Fast, cost-effective model for reasoning
- **100x100 Grid**: Balance between routing precision and performance
- **Fallback Reasoning**: Pre-written explanations if API fails
- **Waypoint Snapping**: Routes prefer named fixes for pilot familiarity
- **Douglas-Peucker Simplification**: Smooth A* paths (tolerance: 0.01)

## Future Enhancements (Not MVP)

- Real-time weather integration (METAR/TAF)
- TFR alerts
- Multi-leg routes
- User authentication
- Saved routes
- Mobile optimization

## License

MIT

## Credits

Built with Claude Code using:
- Next.js 14
- Mapbox GL JS
- Google Gemini API
- shadcn/ui
- Turf.js
