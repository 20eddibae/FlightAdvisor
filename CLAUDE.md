✈️ Project Vision (The Big Picture)
FlightAdvisor: An intelligent flight planning tool that uses agentic AI reasoning to analyze airspace restrictions, weather conditions, and navigation waypoints to recommend optimal flight paths with transparent explanations. Think "ForeFlight meets Claude's reasoning capabilities."
Key Differentiator: We don't just show data. We explain WHY a route is safe, efficient, and compliant using multi-step reasoning that pilots can understand and trust.
Future Capabilities (NOT MVP — But Architect For These)
Real-time weather integration (METAR/TAF/radar overlay)
Dynamic TFR (Temporary Flight Restriction) alerts
Multi-criteria route optimization (fuel efficiency, time, weather avoidance, terrain clearance)
Predictive weather routing ("What if thunderstorms develop on Thursday?")
Regulatory compliance verification (altitude requirements, Class B clearances, NOTAMs)
Multi-leg flight planning with fuel stops
Aircraft performance integration (climb rates, fuel burn, weight & balance)

Single Route Demo: San Carlos (KSQL) → Sacramento (KSMF)
Core MVP Features:
Interactive Map Display


Full-screen Mapbox GL JS map with VFR sectional overlay
Clearly marked departure (KSQL) and arrival (KSMF) airports
3-5 navigation waypoints along route (SUNOL, VULCAN, VPCCM)
Restricted Airspace Visualization


Load GeoJSON files for Class B airspace and restricted zones
Display restricted areas in neutral gray with clear boundaries
Show SFO Class B overhead warning
Intelligent Route Planning


User clicks "Plan Route" button
System calculates path avoiding restricted airspace
Falls back to A* grid pathfinding if direct route intersects restrictions
Displays route as clear polyline on map
Agentic Reasoning Panel


Side panel with shadcn/ui Card component
Real-time reasoning display: "Analyzing airspace constraints..."
Clear explanation: "Route uses SUNOL waypoint because it provides positive navigation fix while avoiding SFO Class B airspace by 2nm lateral margin"
Interactive: Click any waypoint to see specific reasoning for that segment
Route Controls (shadcn/ui only)


Set Start/End airports (click-to-select on map OR lat/lon input)
"Plan Route" / "Clear Route" buttons
Display route distance and estimated flight time
Status indicator: "Direct Route" vs "Avoiding Restricted Airspace"
What MVP Should NOT Have:
❌ Real-time weather data (hardcode "VFR conditions" for demo)
❌ User authentication / saved routes
❌ Database (use JSON files for all data)
❌ Multiple route options (show one optimal path)
❌ External routing APIs (all logic runs locally)
❌ Mobile optimization (desktop demo only)
❌ Complex LangGraph multi-agent orchestration (single-prompt reasoning for MVP)
Success Criteria:
✅ Map loads in <3 seconds with all data visible
 ✅ Route calculation completes in <2 seconds
 ✅ Reasoning explanation is pilot-appropriate and educational
 ✅ Demo can be completed in 90 seconds
 ✅ Works offline after initial load (no API dependencies except Claude)
 ✅ Zero console errors or TypeScript warnings

🛠 Tech Stack
Confirmed Stack (No Changes Allowed):
Framework: Next.js 14+ (App Router, TypeScript, React Server Components)
Mapping: Mapbox GL JS (NOT MapLibre) — requires NEXT_PUBLIC_MAPBOX_TOKEN
UI Components: shadcn/ui ONLY (neutral gray theme, no other component libraries)
Reasoning Engine: Gemini 3 Thinking API for generating pilot-friendly explanations
Routing Logic: Local A* grid pathfinding (no external APIs)
Geometry: Turf.js for GIS operations (point-in-polygon, intersection detection)
Data Format: GeoJSON for airspace polygons, JSON for waypoints/airports
Deployment: Vercel (optimized for Next.js, free tier, instant HTTPS)
Architecture Principles:
Monolithic Next.js — Use API routes (/app/api) instead of separate backend
Modular Components — Map, Controls, Reasoning Panel are separate, reusable components
Separation of Concerns:
/components — Pure React components (Map, UI, layout)
/lib — Business logic (routing algorithms, geometry utils, API clients)
/data — Static JSON/GeoJSON files
/app — App Router pages and API routes
Client-Side Heavy — Map and routing run in browser, only reasoning uses server API
Type Safety — Strict TypeScript, GeoJSON types, no any types
Zero External Dependencies for core logic — Self-contained routing and geometry

📋 File Structure (Create Exactly This)
flightadvisor/
├── app/
│   ├── page.tsx                    # Main landing page with map
│   ├── layout.tsx                  # Root layout with providers
│   └── api/
│       └── reasoning/
│           └── route.ts            # API route for Claude reasoning calls
│
├── components/
│   ├── Map/
│   │   ├── MapView.tsx             # Mapbox GL wrapper ("use client")
│   │   ├── AirportMarkers.tsx      # Start/End airport pins
│   │   ├── WaypointMarkers.tsx     # Navigation waypoint markers
│   │   ├── AirspaceLayer.tsx       # Restricted zone polygons
│   │   └── RouteLayer.tsx          # Route polyline rendering
│   │
│   ├── Controls/
│   │   ├── RouteControls.tsx       # shadcn Card with inputs/buttons
│   │   └── ReasoningPanel.tsx      # Collapsible panel for AI explanations
│   │
│   └── ui/                          # shadcn/ui primitives (auto-generated)
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       └── ...
│
├── lib/
│   ├── geojson.ts                  # GeoJSON type definitions + loaders
│   ├── geometry.ts                 # Point-in-polygon, line intersections (Turf.js wrappers)
│   ├── routing/
│   │   ├── aStarGrid.ts            # A* pathfinding on occupancy grid
│   │   ├── route.ts                # High-level route builder (direct vs A*)
│   │   └── simplify.ts             # Polyline simplification (Douglas-Peucker)
│   ├── api/
│   │   └── claude.ts               # Claude API client for reasoning
│   └── constants.ts                # Grid resolution, colors, timeouts
│
├── data/
│   ├── airports.json               # KSQL, KSMF coordinates + metadata
│   ├── waypoints.json              # SUNOL, VULCAN, VPCCM + NorCal VORs
│   └── airspace/
│       ├── sfo_class_b.geojson     # SFO Class B airspace polygon
│       └── restricted_zones.geojson # R-2501, R-2502 (example restricted areas)
│
├── public/
│   └── sectional_overlay.png      # Optional VFR sectional chart overlay
│
├── .env.local                      # NEXT_PUBLIC_MAPBOX_TOKEN, ANTHROPIC_API_KEY
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
└── CLAUDE.md                       # This file


📊 Data Structures (Design These Upfront)
airports.json (2 airports for MVP)
{
  "airports": [
    {
      "id": "KSQL",
      "name": "San Carlos Airport",
      "lat": 37.5119,
      "lon": -122.2495,
      "elevation": 5,
      "type": "non-towered",
      "notes": "Class D airspace when tower active; watch SFO Class B overhead"
    },
    {
      "id": "KSMF",
      "name": "Sacramento Executive Airport",
      "lat": 38.5125,
      "lon": -121.4932,
      "elevation": 24,
      "type": "towered",
      "notes": "Class D airspace"
    }
  ]
}

waypoints.json (5 waypoints between KSQL-KSMF)
{
  "waypoints": [
    {
      "id": "SUNOL",
      "name": "Sunol",
      "lat": 37.5931,
      "lon": -121.8872,
      "type": "GPS_FIX",
      "description": "Named GPS waypoint in East Bay"
    },
    {
      "id": "VULCAN",
      "name": "Vulcan",
      "lat": 37.8522,
      "lon": -121.7086,
      "type": "GPS_FIX",
      "description": "Delta region GPS fix"
    },
    {
      "id": "VPCCM",
      "name": "VPC Concord VOR",
      "lat": 37.9897,
      "lon": -122.0569,
      "type": "VOR",
      "frequency": "117.0",
      "description": "Concord VOR navigation aid"
    },
    {
      "id": "PYE",
      "name": "Pyramid VOR",
      "lat": 37.6636,
      "lon": -121.8503,
      "type": "VOR",
      "frequency": "112.2",
      "description": "Pyramid VOR — key nav aid for Central Valley"
    },
    {
      "id": "SAC",
      "name": "Sacramento VORTAC",
      "lat": 38.5108,
      "lon": -121.4936,
      "type": "VORTAC",
      "frequency": "115.2",
      "description": "Sacramento approach/departure nav aid"
    }
  ]
}

route.json (MVP output schema — Generated by routing algorithm)
{
  "departure": "KSQL",
  "arrival": "KSMF",
  "route_type": "avoiding_airspace",
  "waypoints": ["SUNOL", "PYE", "SAC"],
  "coordinates": [
    [37.5119, -122.2495],
    [37.5931, -121.8872],
    [37.6636, -121.8503],
    [38.5108, -121.4936],
    [38.5125, -121.4932]
  ],
  "distance_nm": 87.3,
  "estimated_time_min": 52,
  “cruise_altitude”: 5500,
  "reasoning": {
    "summary": "Route avoids SFO Class B airspace using SUNOL waypoint for positive navigation, then direct to Sacramento VORTAC.",
    "steps": [
      {
        "segment": "KSQL → SUNOL",
        "rationale": "Initial climb heading 070° clears Class B floor (3000' MSL) while providing terrain clearance over East Bay hills.",
        "airspace_notes": "Remains in Class E airspace, no clearance required",
        "alternatives_considered": "Direct route passes through SFO Class B — would require clearance"
      },
      {
        "segment": "SUNOL → PYE",
        "rationale": "Pyramid VOR provides positive navigation fix and backup if GPS fails.",
        "airspace_notes": "Clear of all restricted areas",
        "alternatives_considered": "VPCCM routing adds 12nm"
      },
      {
        "segment": "PYE → SAC → KSMF",
        "rationale": "Direct routing using Sacramento VORTAC for approach alignment.",
        "airspace_notes": "Standard arrival corridor",
        "alternatives_considered": "None — optimal direct path"
      }
    ]
  },
  "weather_assumptions": {
    "conditions": "VFR",
    "visibility": "10+ SM",
    "winds_aloft": "Light and variable"
  }
}

airspace GeoJSON (sfo_class_b.geojson example)
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "name": "SFO Class B",
        "type": "CLASS_B",
        "floor_msl": 3000,
        "ceiling_msl": 10000,
        "notes": "Two-way radio communication and transponder required"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [-122.5, 37.8],
            [-122.3, 37.8],
            [-122.3, 37.4],
            [-122.5, 37.4],
            [-122.5, 37.8]
          ]
        ]
      }
    }
  ]
}

Future-Proofing: When adding weather, extend the route schema:
"weather_factors": {
  "metar_ksql": "KSQL 241753Z 28008KT 10SM FEW050 15/08 A3012",
  "forecast_conditions": "VFR throughout flight",
  "winds_aloft_summary": "260@15kt at 6000'"
}


🧠 Reasoning Layer Design (Your Core Value Prop)
MVP Reasoning (Simple Single-Prompt)
System Prompt to Claude API:
You are an experienced flight instructor and aviation safety expert. Given a proposed VFR flight route with waypoints and airspace information, explain the routing decision in clear, educational language that a student pilot would understand.

Focus on:
1. WHY each waypoint was chosen (navigation, safety, airspace avoidance)
2. What airspace constraints influenced the routing
3. What alternatives were considered and why they were rejected
4. Any safety margins or best practices demonstrated

Keep explanations concise (2-3 sentences per waypoint) and use proper aviation terminology.

MVP Implementation (/app/api/reasoning/route.ts):
// Single API call with route context
const response = await anthropic.messages.create({
  model: "claude-3-5-sonnet-20241022",
  max_tokens: 1024,
  messages: [{
    role: "user",
    content: `Explain this flight route:
    
Departure: ${route.departure} (${departureCoords})
Arrival: ${route.arrival} (${arrivalCoords})
Waypoints: ${route.waypoints.join(" → ")}

Airspace constraints:
- SFO Class B airspace extends from 3000' to 10,000' MSL
- Must maintain VFR cloud clearances

Why is this routing optimal?`
  }]
});

Design Decision: Use a SINGLE modular API call for MVP. Structure the code in /lib/api/claude.ts so you can swap in multi-agent LangGraph orchestration later without rewriting the UI.
Future Reasoning (Multi-Agent) — NOT MVP
Agent 1 (Airspace Analyzer):
  - Identifies all airspace constraints
  - Calculates required altitudes and clearances
  
Agent 2 (Weather Analyst):
  - Evaluates METAR/TAF conditions
  - Flags potential weather hazards
  
Agent 3 (Route Optimizer):
  - Computes fuel efficiency
  - Balances time vs. safety margins
  
Coordinator Agent:
  - Synthesizes all inputs
  - Makes final recommendation with ranked alternatives

🎬 Demo Script (90 Seconds)
Tell Claude you need the demo to work exactly like this:
[00:00-00:15] Introduction
"FlightAdvisor is an AI-powered flight planner that doesn't just show routes — it explains WHY they're safe and efficient using agentic reasoning."

[00:15-00:30] Show the map
- Map loads showing San Carlos and Sacramento airports
- Airspace restrictions visible in gray (SFO Class B highlighted)
- Waypoints marked along potential route

[00:30-00:50] Plan a route
- Click "Plan Route" button
- Watch route calculate in real-time (<2 sec)
- Route appears avoiding SFO Class B airspace
- Uses SUNOL and PYE waypoints

[00:50-01:15] Show reasoning
- Reasoning panel displays: "Analyzing route constraints..."
- Explanation appears: "Route uses SUNOL waypoint to avoid SFO Class B airspace, which requires clearance. Pyramid VOR provides positive navigation fix with GPS backup..."
- Click on SUNOL waypoint → see segment-specific reasoning

[01:15-01:30] Highlight differentiator
"Unlike traditional flight planners, FlightAdvisor teaches pilots WHY each decision was made — turning every flight plan into a learning opportunity."


🏗️ Key Architectural Decisions
Include this section so Claude asks the right questions during planning:
Decisions Made (No Discussion Needed):
✅ Monorepo structure — Single Next.js project (no separate backend)
✅ State management — React Context API for map state (no Redux)
✅ API design — REST endpoints in /app/api (no GraphQL)
✅ Reasoning cache — In-memory Map cache for duplicate route requests
✅ Deployment — Vercel (optimized for Next.js, free tier)
✅ Map library — Mapbox GL JS (better aviation overlays than Leaflet)
Decisions to Clarify During Planning:
❓ Grid resolution for A* — 50x50 (fast but rough) vs 100x100 (slower but smoother)?
Recommendation: 100x100 with 2-second timeout
❓ Airspace simplification — Use exact FAA polygons or simplified shapes?
Recommendation: Simplified for MVP (5-10 vertices per polygon)
❓ Reasoning streaming — Stream Claude's response word-by-word or wait for complete?
Recommendation: Wait for complete response (simpler UI, more polished)
❓ Waypoint selection — Auto-select optimal waypoints or let user choose?
Recommendation: Auto-select for MVP, manual override in Phase 2
❓ Route caching — Cache all routes or just reasoning?
Recommendation: Cache both (route geometry + reasoning text)

⚠️ Critical Development Rules
Context Isolation (STRICT)
Working on Map components? → Do NOT touch API routes or reasoning logic
Working on routing algorithms? → Do NOT modify UI components
Working on data files? → Do NOT change component logic
Modularity (NON-NEGOTIABLE)
Airspace, Waypoints, Routing, Reasoning are separate, self-contained modules
Each module exports a clean interface (no internal details leak out)
Example: /lib/routing/route.ts should work without knowing about React/UI
Dependency Hygiene
Before adding ANY npm package, ask: "Can I build this in 50 lines of vanilla code?"
Required dependencies only: mapbox-gl, @turf/turf, @anthropic-ai/sdk, shadcn/ui
No heavy packages: No D3.js, no Three.js, no ML libraries
Type Safety
Zero any types — Use proper GeoJSON types from @types/geojson
Strict TypeScript — Enable strict: true in tsconfig.json
API contracts — Define types for all API responses
Git Hygiene
One feature per commit — Don't mix UI + routing changes
Commit messages must explain WHY, not just WHAT
❌ "Updated route.ts"
✅ "Use A* fallback when direct route intersects Class B — ensures airspace compliance"

🧪 Testing Strategy
Manual Testing Checklist
[ ] Map loads within 3 seconds on slow 3G
[ ] All airspace zones render correctly
[ ] Click "Plan Route" → route appears in <2 seconds
[ ] Route correctly avoids SFO Class B (visual inspection)
[ ] Reasoning panel shows within 3 seconds of route display
[ ] Click on waypoint → segment reasoning appears
[ ] Clear route → map resets to initial state
[ ] Works in Chrome, Firefox, Safari (desktop only)
Edge Cases to Test
[ ] Direct route is valid (no airspace conflicts)
[ ] Direct route intersects restricted zone → A* activates
[ ] No valid route exists (e.g., airports inside restricted zone) → show error
[ ] Claude API fails → fallback reasoning displays
[ ] Invalid coordinates entered → validation error shown
[ ] Network offline → cached map tiles still work
Performance Benchmarks
Map initial load: <3 seconds (target: <2 seconds)
Route calculation: <2 seconds (target: <1 second)
Reasoning API call: <4 seconds (target: <3 seconds)
Total demo flow: <90 seconds (target: <75 seconds)

🚀 Deployment Checklist
Pre-Deployment
[ ] All console.log() removed or commented out
[ ] Environment variables set in Vercel dashboard:
NEXT_PUBLIC_MAPBOX_TOKEN
ANTHROPIC_API_KEY
[ ] README.md has clear setup instructions
[ ] No hardcoded API keys in codebase
[ ] Build passes locally: npm run build
[ ] TypeScript validation passes: npm run type-check
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Test deployed site
# Visit https://flightadvisor-[random].vercel.app

Post-Deployment Validation
[ ] Map loads on deployed URL
[ ] Routing works end-to-end
[ ] Reasoning API calls succeed (check environment variables)
[ ] No CORS errors in browser console
[ ] Custom domain (optional): flightadvisor.vercel.app
Fallback Plan
If Vercel deployment fails:
Run locally: npm run dev
Use ngrok for temporary public URL: ngrok http 3000
Demo from localhost with screenshare

📚 Key Resources
Required Reading Before Coding
Mapbox GL JS Docs: https://docs.mapbox.com/mapbox-gl-js/guides/
GeoJSON Specification: https://geojson.org/
Turf.js Documentation: https://turfjs.org/docs/
shadcn/ui Components: https://ui.shadcn.com/docs/components
Anthropic API Reference: https://docs.anthropic.com/claude/reference
Aviation References
FAA Airspace Data: https://www.faa.gov/air_traffic/flight_info/aeronav/aero_data/
SkyVector (Chart Reference): https://skyvector.com/
VFR Sectional Charts: https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/vfr/
Algorithm References
A* Pathfinding: https://www.redblobgames.com/pathfinding/a-star/introduction.html
Douglas-Peucker Simplification: https://en.wikipedia.org/wiki/Ramer%E2%80%93Douglas%E2%80%93Peucker_algorithm

💬 Working with Claude Code
Best Practices for AskUserQuestion Tool
When running claude code --plan, expect these clarifying questions:
Question 1: "Which mapping library should I use?"
Your Answer: "Use Mapbox GL JS with next-mapbox-gl wrapper. Do NOT use MapLibre."
Question 2: "How should I structure the GeoJSON loaders?"
Your Answer: "Create /lib/geojson.ts with explicit imports. Combine all airspace files into single FeatureCollection. No dynamic file system access."
Question 3: "What's more important: route accuracy or reasoning quality?"
Your Answer: "Reasoning quality is the differentiator. Route can be approximate, but explanation must be educational and pilot-appropriate."
Question 4: "Should I use real waypoint coordinates?"
Your Answer: "Yes. Use real VOR/GPS fix coordinates from SkyVector. This makes the demo credible."
Question 5: "How should I handle airspace intersections?"
Your Answer: "Check if direct line intersects any polygon. If yes, use A* on 100x100 grid. Simplify result with Douglas-Peucker."
Question 6: "What if Claude API is down during demo?"
Your Answer: "Implement fallback: pre-written reasoning text for KSQL-KSMF route. Store in /lib/fallback-reasoning.ts."
Effective Prompting During Development
Be specific about context:
❌ "Add routing logic"
✅ "In /lib/routing/route.ts, implement direct line test using Turf.js lineIntersect. If intersection found, call A* fallback from aStarGrid.ts."
Reference this file:
❌ "Make it work"
Request modular solutions:
❌ "Build the whole map component"
✅ "Create /components/Map/AirspaceLayer.tsx that accepts FeatureCollection prop and renders polygons. Do NOT modify MapView.tsx."
Ask for deployment guidance:
✅ "How do I configure Mapbox token for Vercel deployment per CLAUDE.md deployment checklist?"

🔧 Common Terminal Commands
Development
# Start development server
npm run dev

# Type checking
npm run type-check

# Build for production
npm run build

# Run production build locally
npm start

Data Management
# Validate GeoJSON files (install geojson-validation)
npx geojsonhint data/airspace/sfo_class_b.geojson

# Pretty-print JSON
cat data/waypoints.json | jq '.'

Deployment
# Deploy to Vercel
vercel --prod

# Check deployment status
vercel ls

# View logs
vercel logs


⚠️ Common Pitfalls to Avoid
❌ DON'T: Mix Concerns
// BAD: Routing logic in UI component
function RouteControls() {
  const calculateRoute = () => {
    // 200 lines of A* algorithm here
  }
}

✅ DO: Separate Concerns
// GOOD: Import pure function from /lib
import { calculateRoute } from '@/lib/routing/route'

function RouteControls() {
  const handlePlanRoute = () => {
    const route = calculateRoute(start, end, airspace)
    setRoute(route)
  }
}

❌ DON'T: Hardcode Production Values
const MAPBOX_TOKEN = "pk.eyJ1IjoiamFpbmFtMTIzIiwi..." // BREAKS DEPLOYMENT

✅ DO: Use Environment Variables
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
if (!MAPBOX_TOKEN) throw new Error("Missing Mapbox token")

❌ DON'T: Block the UI Thread
// BAD: Synchronous A* blocks rendering
const route = calculateAStarSync(start, end) // UI freezes for 2 seconds

✅ DO: Use Async with Loading State
// GOOD: Async with loading indicator
const [loading, setLoading] = useState(false)
const calculateRouteAsync = async () => {
  setLoading(true)
  const route = await calculateAStarAsync(start, end)
  setLoading(false)
}

❌ DON'T: Ignore TypeScript Errors
// @ts-ignore
const coords = route.geometry.coordinates // TYPE UNSAFE

✅ DO: Fix Type Errors Properly
import { LineString } from 'geojson'

const geometry = route.geometry as LineString
const coords = geometry.coordinates // TYPE SAFE


🎯 Success Metrics
Demo Day Checklist
[ ] Demo completes in <90 seconds
[ ] Zero errors in browser console
[ ] Reasoning explanations sound like a flight instructor (not generic AI)
[ ] Route clearly avoids SFO Class B airspace (visually obvious)
[ ] At least 2 judges say "I learned something about aviation"
[ ] Team can explain architecture in <60 seconds if asked
Technical Metrics
[ ] TypeScript: 100% type coverage (no any)
[ ] Performance: Map loads <3 seconds, routing <2 seconds
[ ] Code Quality: No ESLint errors, all functions <50 lines
[ ] Modularity: Can swap reasoning engine (Claude → GPT-4) in <30 minutes

📝 Final Notes
The Golden Rule
"Build for the future, ship for today."


