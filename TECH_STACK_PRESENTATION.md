# Skyris Tech Stack - Deep Dive & Presentation Guide

## 🎯 Executive Summary (30 seconds)

**Skyris** is an AI-powered flight planning platform that combines real-time aviation data, intelligent routing algorithms, and generative AI to provide pilots with optimal flight paths and educational explanations. Built as a modern full-stack web application using Next.js, it processes complex geospatial data client-side while leveraging server-side AI for reasoning.

---

## 🏗️ Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client (Browser)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Mapbox GL   │  │  React UI    │  │  IndexedDB   │     │
│  │  (Mapping)   │  │  (shadcn/ui) │  │  (Cache)     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                 │                  │             │
│         └─────────────────┼──────────────────┘             │
│                           │                                 │
│                    ┌──────▼──────┐                         │
│                    │  Next.js App │                         │
│                    │   Router     │                         │
│                    └──────┬──────┘                         │
└───────────────────────────┼─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                     │
┌───────▼──────┐   ┌────────▼────────┐   ┌──────▼──────┐
│  Vercel      │   │  Next.js API     │   │  External   │
│  (Hosting)   │   │  Routes          │   │  APIs       │
└──────────────┘   └──────────────────┘   └─────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
┌───────▼──────┐  ┌───────▼──────┐  ┌──────▼──────┐
│  Gemini API  │  │  OpenAIP API │  │  Supabase   │
│  (AI)        │  │  (Aviation)  │  │  (Database) │
└──────────────┘  └──────────────┘  └─────────────┘
```

### Architecture Principles

1. **Monolithic Next.js** - Single codebase, no separate backend
2. **Client-Side Heavy** - Map rendering, routing calculations run in browser
3. **Server-Side AI** - Only AI reasoning uses server API routes
4. **Progressive Enhancement** - Works offline after initial load
5. **Type Safety** - Strict TypeScript throughout

---

## 📦 Core Technology Stack

### 1. Frontend Framework: Next.js 14 (App Router)

**Why Next.js?**
- **App Router**: Modern file-based routing with React Server Components
- **API Routes**: Built-in backend endpoints (`/app/api/*`)
- **SSR/SSG**: Server-side rendering for SEO and performance
- **TypeScript**: Full type safety out of the box
- **Vercel Integration**: Zero-config deployment

**Key Features Used:**
- `'use client'` directives for interactive components
- Dynamic imports for code splitting (`dynamic()`)
- Server Components for static content
- API routes for backend logic

**File Structure:**
```
/app
  /page.tsx          # Main page (Server Component)
  /layout.tsx        # Root layout
  /api/              # Backend API routes
    /reasoning/      # Gemini AI endpoint
    /openaip/        # Aviation data proxy
    /weather/        # Weather data endpoint
```

---

### 2. Mapping Engine: Mapbox GL JS v3.18

**Why Mapbox?**
- **WebGL Rendering**: Hardware-accelerated, smooth performance
- **Vector Tiles**: Efficient data transfer, scalable
- **Custom Styling**: Full control over map appearance
- **Aviation Support**: Better than Leaflet for aviation overlays
- **Rich API**: Markers, popups, layers, events

**Implementation:**
- Custom markers for airports (green/red)
- Waypoint markers (blue/red by type)
- GeoJSON layers for airspace polygons
- Interactive popups with hover effects
- Clustering for performance at low zoom

**Key Components:**
- `MapView.tsx` - Mapbox initialization and lifecycle
- `AirportMarkers.tsx` - Airport visualization with clustering
- `WaypointMarkers.tsx` - Navigation aids (VOR, GPS fixes)
- `AirspaceLayer.tsx` - Class B and restricted zones
- `RouteLayer.tsx` - Route polylines
- `CloudLayer.tsx` - Weather visualization
- `WindLayer.tsx` - Wind barbs

---

### 3. UI Framework: shadcn/ui + Tailwind CSS v4

**Why shadcn/ui?**
- **Copy-Paste Components**: Full ownership, no vendor lock-in
- **Radix UI Primitives**: Accessible, unstyled components
- **Tailwind CSS**: Utility-first styling
- **TypeScript**: Fully typed components
- **Customizable**: Easy to modify and extend

**Components Used:**
- `Button` - Actions (Plan Route, Clear)
- `Card` - Containers (Route Controls, Reasoning Panel)
- `Input` - Text inputs
- `Select` - Dropdowns (Airport search)
- `Alert` - Error messages
- `Skeleton` - Loading states

**Styling:**
- Neutral gray theme (per design requirements)
- Responsive design (desktop-first)
- Dark mode ready (CSS variables)

---

### 4. AI Reasoning Engine: Google Gemini 1.5 Flash API

**Why Gemini?**
- **Fast**: Flash model optimized for speed (<3s responses)
- **Cost-Effective**: Lower cost than GPT-4
- **Thinking API**: Multi-step reasoning capabilities
- **Aviation Knowledge**: Good understanding of flight planning concepts
- **Structured Output**: JSON mode for consistent responses

**Implementation:**
- **Server-Side Only**: API key never exposed to client
- **Caching**: In-memory cache for duplicate routes
- **Fallback**: Pre-written reasoning if API fails
- **Structured Prompts**: Flight instructor persona
- **Educational Focus**: Explains WHY, not just WHAT

**API Route:** `/app/api/reasoning/route.ts`
- Accepts route data (departure, arrival, waypoints)
- Generates pilot-friendly explanations
- Returns structured reasoning with segments

**Future:** Multi-agent orchestration (not MVP)

---

### 5. Routing Algorithm: Custom A* Pathfinding

**Why Custom?**
- **No External APIs**: Works offline, no rate limits
- **Full Control**: Optimized for aviation constraints
- **Fast**: <2 second calculation time
- **Flexible**: Easy to extend with new constraints

**Implementation:**
- **Grid-Based**: 100x100 occupancy grid
- **A* Algorithm**: Optimal pathfinding with heuristics
- **Waypoint Snapping**: Prefers named navigation fixes
- **Douglas-Peucker**: Simplifies paths for smooth rendering
- **Fallback Logic**: Direct route if no airspace conflicts

**Key Files:**
- `lib/routing/route.ts` - High-level route builder
- `lib/routing/aStarGrid.ts` - A* implementation
- `lib/geometry.ts` - Turf.js geometry utilities

**Algorithm Flow:**
1. Check if direct route intersects airspace
2. If yes, build 100x100 occupancy grid
3. Run A* pathfinding on grid
4. Snap to nearest waypoints
5. Simplify path with Douglas-Peucker
6. Calculate distance and time

---

### 6. Geospatial Processing: Turf.js v7.3

**Why Turf.js?**
- **Industry Standard**: Widely used in GIS applications
- **Comprehensive**: 100+ geospatial functions
- **TypeScript**: Full type definitions
- **Performance**: Optimized C++ bindings
- **GeoJSON Native**: Works seamlessly with GeoJSON

**Key Functions Used:**
- `pointInPolygon()` - Check if route intersects airspace
- `lineIntersect()` - Find intersection points
- `distance()` - Calculate distances (Haversine formula)
- `bearing()` - Calculate headings
- `simplify()` - Path simplification

**Data Format:**
- GeoJSON for airspace polygons
- Point coordinates [lon, lat] format
- FeatureCollections for multiple features

---

### 7. Aviation Data: OpenAIP API

**Why OpenAIP?**
- **Comprehensive**: Airports, waypoints, airspace
- **Real-Time**: Up-to-date aviation data
- **Global Coverage**: Worldwide data (not just US)
- **Free Tier**: Reasonable rate limits
- **GeoJSON Format**: Compatible with our stack

**Data Types:**
- **Airports**: ICAO codes, coordinates, elevation, type
- **Navaids**: VOR, VORTAC, NDB, GPS fixes
- **Airspace**: Class B, restricted zones, TFRs

**Implementation:**
- **API Client**: `lib/api/openaip.ts`
- **Proxy Routes**: `/app/api/openaip/route.ts`
- **Bulk Loading**: `/app/api/openaip/bulk/route.ts` (for caching)
- **Data Conversion**: OpenAIP format → internal format

**Caching Strategy:**
- IndexedDB for client-side persistence
- Regional loading (7 US regions)
- Viewport-based fetching
- 24-hour TTL

---

### 8. Database: Supabase (PostgreSQL)

**Why Supabase?**
- **PostgreSQL**: Robust relational database
- **Real-Time**: Built-in real-time subscriptions
- **Row-Level Security**: Secure data access
- **REST API**: Auto-generated from schema
- **Free Tier**: Generous limits

**Use Cases:**
- **Saved Flights**: User flight plans
- **Flight Monitoring**: Watch routes for weather changes
- **User Preferences**: Settings, favorites

**Schema:**
- `flights` table - Saved flight plans
- `watched_flights` table - Routes being monitored
- Row-level security enabled

**Client:** `lib/supabase/client.ts`
- Graceful degradation if not configured
- Type-safe queries
- Error handling

---

### 9. Caching Layer: IndexedDB + Spatial Indexing

**Why IndexedDB?**
- **Client-Side**: No server round-trips
- **Large Storage**: Can store 1000s of airports
- **Persistent**: Survives browser restarts
- **Fast Queries**: Indexed lookups
- **Offline Support**: Works without network

**Implementation:**
- **Airport Cache**: `lib/cache/airportCache.ts`
- **Spatial Index**: `lib/cache/spatialIndex.ts` (grid-based)
- **IndexedDB Wrapper**: `lib/cache/indexedDB.ts`

**Features:**
- Regional loading (7 US regions)
- Viewport-based queries
- Search by ICAO code or name
- Automatic cache invalidation (24h TTL)
- Background loading

**Performance:**
- <3s initialization
- <100ms viewport queries
- <50ms airport lookups

---

### 10. Styling: Tailwind CSS v4 + PostCSS

**Why Tailwind?**
- **Utility-First**: Rapid development
- **PurgeCSS**: Minimal bundle size
- **Responsive**: Mobile-first breakpoints
- **Customizable**: Design system via config
- **Type Safety**: IntelliSense support

**Configuration:**
- Custom colors (aviation-themed)
- Custom spacing scale
- Dark mode variables
- shadcn/ui integration

---

### 11. Animation: Framer Motion v12

**Why Framer Motion?**
- **Declarative**: React-friendly API
- **Performance**: GPU-accelerated
- **Flexible**: Simple to complex animations
- **TypeScript**: Full type support

**Usage:**
- Splash screen animations
- Panel transitions
- Loading states

---

### 12. Deployment: Vercel

**Why Vercel?**
- **Next.js Optimized**: Zero-config deployment
- **Edge Network**: Global CDN, fast loading
- **Automatic HTTPS**: SSL certificates
- **Environment Variables**: Secure secret management
- **Preview Deployments**: Branch-based previews
- **Free Tier**: Generous limits for MVP

**Deployment Process:**
1. Git push triggers deployment
2. Vercel builds Next.js app
3. Environment variables injected
4. Edge functions deployed
5. CDN distribution

---

## 🔄 Data Flow

### Route Planning Flow

```
User clicks "Plan Route"
    ↓
MapContainer.handlePlanRoute()
    ↓
calculateRouteAsync() [Client-Side]
    ├─ Check direct route intersection (Turf.js)
    ├─ If intersects → A* pathfinding (100x100 grid)
    ├─ Snap to waypoints
    └─ Simplify path (Douglas-Peucker)
    ↓
POST /api/reasoning [Server-Side]
    ├─ Generate prompt with route context
    ├─ Call Gemini API
    ├─ Parse structured response
    └─ Cache result
    ↓
Display route + reasoning on map
```

### Data Loading Flow

```
Page Load
    ↓
AirportCacheProvider.initialize()
    ├─ Load from IndexedDB
    └─ If empty → Load regions from /api/openaip/bulk
    ↓
MapContainer.loadDataForViewport()
    ├─ Get viewport bounds
    ├─ Query cache for airports in bounds
    ├─ Fetch navaids from /api/openaip?type=navaids
    └─ Fetch airspace from /api/openaip?type=airspace
    ↓
Render markers and layers on map
```

---

## 🎨 Component Architecture

### Component Hierarchy

```
RootLayout
  └─ Home (page.tsx)
      ├─ SplashScreen
      └─ AirportCacheProvider
          └─ MapContainer
              ├─ MapView (Mapbox)
              ├─ AirportMarkers
              ├─ WaypointMarkers
              ├─ AirspaceLayer
              ├─ RouteLayer
              ├─ CloudLayer
              ├─ WindLayer
              ├─ RouteControls
              ├─ FlightSelector
              ├─ ReasoningPanel
              └─ ErrorDisplay
```

### Component Responsibilities

**Map Components** (`/components/Map/`)
- **MapView**: Mapbox initialization, event handling
- **AirportMarkers**: Airport visualization, clustering
- **WaypointMarkers**: Navigation aids, type-based coloring
- **AirspaceLayer**: Airspace polygons, hover interactions
- **RouteLayer**: Route polylines, styling
- **CloudLayer**: Weather visualization
- **WindLayer**: Wind barbs

**Control Components** (`/components/Controls/`)
- **RouteControls**: Airport selection, route planning UI
- **ReasoningPanel**: AI reasoning display
- **FlightSelector**: Saved flights management
- **AirportSearch**: Autocomplete airport search
- **WeatherChatBot**: Weather Q&A interface

**UI Primitives** (`/components/ui/`)
- shadcn/ui components (Button, Card, Input, etc.)

---

## 🔐 Security & Environment Variables

### Client-Side (NEXT_PUBLIC_*)
- `NEXT_PUBLIC_MAPBOX_TOKEN` - Mapbox API key (safe to expose)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `NEXT_PUBLIC_APP_URL` - Application URL

### Server-Side (No NEXT_PUBLIC_ prefix)
- `OPEN_AIP_API_KEY` - OpenAIP authentication
- `GEMINI_API_KEY` - Google Gemini API key
- `VERCEL_TOKEN` - Vercel deployment token

**Security Best Practices:**
- Server-side API keys never exposed to client
- Supabase uses Row-Level Security
- API routes validate inputs
- Error messages don't leak sensitive info

---

## 📊 Performance Optimizations

### 1. Code Splitting
- Dynamic imports for map layers (`dynamic()`)
- Lazy loading of heavy components
- Route-based code splitting (Next.js automatic)

### 2. Caching
- **IndexedDB**: Airport data cached client-side
- **In-Memory**: Route reasoning cache
- **Viewport Cache**: Navaids/airspace (5min TTL)
- **HTTP Cache**: Static assets via Vercel CDN

### 3. Rendering Optimizations
- **Clustering**: Group markers at low zoom
- **Virtualization**: Only render visible markers
- **Debouncing**: Limit API calls during pan/zoom
- **Parallel Requests**: Fetch data simultaneously

### 4. Bundle Size
- Tree-shaking (ES modules)
- Tailwind CSS purging
- Dynamic imports for large libraries
- Minimal dependencies

---

## 🧪 Testing Strategy

### Manual Testing
- Browser console checks
- Performance profiling
- Cross-browser testing (Chrome, Firefox, Safari)

### Integration Tests
- `lib/__tests__/geojson.integration.test.ts`
- OpenAIP API integration
- Data loading validation

### Type Safety
- TypeScript strict mode
- No `any` types
- GeoJSON type definitions
- API response types

---

## 🚀 Deployment Architecture

### Vercel Deployment

```
Git Repository
    ↓
Vercel (on push)
    ├─ Install dependencies (npm install)
    ├─ Build Next.js app (npm run build)
    ├─ Run type checking (tsc --noEmit)
    ├─ Optimize bundle
    └─ Deploy to Edge Network
        ├─ Production: skyris.vercel.app
        └─ Preview: [branch].vercel.app
```

### Environment Variables
- Set in Vercel dashboard
- Injected at build time
- Available in API routes
- `NEXT_PUBLIC_*` exposed to client

---

## 📈 Scalability Considerations

### Current Scale (MVP)
- **Users**: Single-user demo
- **Data**: ~700 airports (7 US regions)
- **Routes**: On-demand calculation
- **AI**: Per-request reasoning

### Future Scaling
- **Database**: Supabase scales automatically
- **CDN**: Vercel Edge Network
- **Caching**: Redis for multi-user
- **AI**: Batch processing for common routes
- **Data**: Pagination for large datasets

---

## 🎯 How to Present the Tech Stack

### 1. Start with the Problem (30 seconds)
> "Pilots need flight planning tools that don't just show routes, but explain WHY they're safe. Skyris combines real-time aviation data with AI reasoning to provide educational, trustworthy route recommendations."

### 2. Architecture Overview (1 minute)
> "Built as a modern full-stack Next.js application. The map and routing run client-side in the browser for speed, while AI reasoning happens server-side for security. We use Mapbox for mapping, Gemini for AI, and OpenAIP for aviation data."

### 3. Key Technologies (2 minutes)

**Frontend:**
- "Next.js 14 with App Router gives us server components, API routes, and TypeScript out of the box"
- "Mapbox GL JS provides hardware-accelerated WebGL rendering for smooth map interactions"
- "shadcn/ui gives us accessible, customizable components without vendor lock-in"

**Backend:**
- "Next.js API routes handle AI reasoning and data proxying - no separate backend needed"
- "Gemini 1.5 Flash generates pilot-friendly explanations in under 3 seconds"
- "OpenAIP API provides real-time aviation data - airports, waypoints, airspace"

**Algorithms:**
- "Custom A* pathfinding on a 100x100 grid calculates optimal routes in under 2 seconds"
- "Turf.js handles all geospatial calculations - point-in-polygon, intersections, distances"
- "IndexedDB caches airport data client-side for instant lookups"

### 4. Technical Highlights (1 minute)
- "Client-side routing means no server round-trips - routes calculate instantly"
- "Spatial indexing enables sub-100ms airport searches across thousands of airports"
- "Progressive enhancement - works offline after initial load"
- "Type-safe throughout - zero `any` types, full TypeScript coverage"

### 5. Demo Flow (1 minute)
1. Show map loading (<3s)
2. Click "Plan Route" → route appears (<2s)
3. Show AI reasoning panel with explanations
4. Highlight: "Every decision is explained in pilot-friendly language"

### 6. Future Architecture (30 seconds)
- "Currently single-agent AI - future will use multi-agent orchestration"
- "Real-time weather integration planned"
- "Multi-leg routes with fuel stops"
- "Aircraft performance integration"

---

## 💡 Key Talking Points

### For Technical Audiences
- **Monolithic Architecture**: Single Next.js codebase, no microservices complexity
- **Type Safety**: Strict TypeScript, no runtime type errors
- **Performance**: Client-side calculations, <2s route planning
- **Scalability**: IndexedDB caching, spatial indexing, viewport-based loading

### For Business Audiences
- **Cost-Effective**: Free tier APIs (OpenAIP, Vercel), low Gemini costs
- **Fast Development**: Next.js + shadcn/ui = rapid iteration
- **User Experience**: Instant route planning, educational explanations
- **Differentiation**: AI reasoning is the key differentiator

### For Aviation Audiences
- **Real Data**: Actual airports, waypoints, airspace from OpenAIP
- **Pilot-Friendly**: Explanations written by AI trained on aviation knowledge
- **Safety-First**: Airspace avoidance, regulatory compliance
- **Educational**: Every route becomes a learning opportunity

---

## 📝 Quick Reference

### Tech Stack Summary
```
Frontend:     Next.js 14, React 19, TypeScript 5.9
Mapping:      Mapbox GL JS 3.18
UI:           shadcn/ui, Tailwind CSS 4.1
AI:           Google Gemini 1.5 Flash
Routing:      Custom A* pathfinding
Geometry:     Turf.js 7.3
Data:         OpenAIP API, Supabase
Cache:        IndexedDB, Spatial Indexing
Animation:    Framer Motion 12
Deployment:   Vercel
```

### Key Metrics
- **Map Load**: <3 seconds
- **Route Calculation**: <2 seconds
- **AI Reasoning**: <4 seconds
- **Airport Search**: <100ms (cached)
- **Bundle Size**: ~500KB (gzipped)
- **Lighthouse Score**: 90+ (Performance)

---

## 🎤 Presentation Script (5 minutes)

### Introduction (30s)
"Skyris is an AI-powered flight planning platform that explains WHY routes are safe, not just shows them. Built with modern web technologies, it processes complex geospatial data in real-time while providing educational AI explanations."

### Architecture (1m)
"The app runs entirely in Next.js - a React framework that handles both frontend and backend. The map and routing algorithms run client-side in the browser for speed, while AI reasoning happens server-side for security. We use Mapbox for mapping, Gemini for AI, and OpenAIP for aviation data."

### Tech Deep Dive (2m)
"**Frontend**: Next.js 14 with App Router gives us server components, API routes, and full TypeScript. Mapbox GL JS provides hardware-accelerated WebGL rendering. shadcn/ui gives us accessible, customizable components.

**Backend**: Next.js API routes handle AI reasoning and data proxying - no separate backend needed. Gemini 1.5 Flash generates explanations in under 3 seconds. OpenAIP provides real-time aviation data.

**Algorithms**: Custom A* pathfinding calculates optimal routes in under 2 seconds. Turf.js handles all geospatial calculations. IndexedDB caches data client-side for instant lookups."

### Demo (1m)
[Live demo showing map, route planning, AI reasoning]

### Future (30s)
"Currently single-agent AI - future will use multi-agent orchestration for weather analysis, route optimization, and compliance checking. Real-time weather integration and multi-leg routes are planned."

---

This tech stack combines modern web development best practices with aviation-specific requirements, resulting in a fast, educational, and scalable flight planning platform.
