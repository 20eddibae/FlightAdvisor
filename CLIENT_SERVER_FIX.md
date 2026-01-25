# Client-Server Environment Variable Fix

## Problem

The application was showing the error:
```
Data Loading Error
OpenAIP API not configured. Set OPEN_AIP_API_KEY in .env.local and restart the dev server.
```

Even though `OPEN_AIP_API_KEY` was present in `.env.local`.

## Root Cause

The issue was a **client-server environment variable access problem**:

1. `OPEN_AIP_API_KEY` is a **server-side only** environment variable (no `NEXT_PUBLIC_` prefix)
2. The `MapContainer` component is a **client component** (`'use client'`)
3. Client components tried to call `loadAirports()`, `loadWaypoints()`, and `loadAllAirspace()` directly
4. These functions imported the OpenAIP client, which checks `process.env.OPEN_AIP_API_KEY`
5. **Client-side code cannot access server-side environment variables!**

## Solution

Changed the data loading flow to use API routes instead of direct OpenAIP client calls:

### Before (Broken)
```typescript
// MapContainer.tsx (client component)
const [airportsData, waypointsData, airspaceData] = await Promise.all([
  loadAirports(),        // ❌ Tries to access OPEN_AIP_API_KEY from client
  loadWaypoints(),       // ❌ Tries to access OPEN_AIP_API_KEY from client
  loadAllAirspace(),     // ❌ Tries to access OPEN_AIP_API_KEY from client
])
```

### After (Fixed)
```typescript
// MapContainer.tsx (client component)
const [airportsRes, navaidsRes, airspaceRes] = await Promise.all([
  fetch(`/api/openaip?type=airports&bounds=${bounds}`),   // ✅ Calls server API route
  fetch(`/api/openaip?type=navaids&bounds=${bounds}`),    // ✅ Calls server API route
  fetch(`/api/openaip?type=airspace&bounds=${bounds}`),   // ✅ Calls server API route
])
```

## How It Works Now

```
┌─────────────────────────────────────────────────────────────┐
│ Client (Browser)                                            │
│                                                              │
│  MapContainer.tsx                                           │
│  └─> fetch('/api/openaip?type=airports')                   │
│      fetch('/api/openaip?type=navaids')                    │
│      fetch('/api/openaip?type=airspace')                   │
│          │                                                   │
└──────────┼───────────────────────────────────────────────────┘
           │
           │ HTTP Request
           ▼
┌─────────────────────────────────────────────────────────────┐
│ Server (Next.js API Route)                                  │
│                                                              │
│  /app/api/openaip/route.ts                                 │
│  └─> Has access to OPEN_AIP_API_KEY                        │
│      └─> fetchAirports(bounds)                             │
│          fetchNavaids(bounds)                               │
│          fetchAllAirspace(bounds)                           │
│              │                                               │
└──────────────┼───────────────────────────────────────────────┘
               │
               │ HTTPS Request
               ▼
┌─────────────────────────────────────────────────────────────┐
│ OpenAIP API                                                 │
│                                                              │
│  https://api.core.openaip.net/api/airports                 │
│  https://api.core.openaip.net/api/navaids                  │
│  https://api.core.openaip.net/api/airspaces                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Changes Made

### 1. Updated `MapContainer.tsx`

**File:** `/components/Map/MapContainer.tsx`

**Changes:**
- ✅ Removed direct calls to `loadAirports()`, `loadWaypoints()`, `loadAllAirspace()`
- ✅ Added API route calls using `fetch()`
- ✅ Added data transformation from API response to internal format
- ✅ Removed unused imports

**Before:**
```typescript
import { loadAirports, loadWaypoints, loadAllAirspace, Airport, Waypoint, AirspaceFeatureCollection } from '@/lib/geojson'
```

**After:**
```typescript
import type { Airport, Waypoint, AirspaceFeatureCollection } from '@/lib/geojson'
```

### 2. Data Transformation in Client

The client now transforms API responses to the internal format:

```typescript
// Airports
const airports: Airport[] = airportsData.data.map((ap: any) => ({
  id: ap.icaoCode || ap._id,
  name: ap.name,
  lat: ap.geometry.coordinates[1],
  lon: ap.geometry.coordinates[0],
  elevation: ap.elevation?.value || 0,
  type: ap.trafficType?.includes(0) ? 'towered' : 'non-towered',
  notes: `Type: ${ap.type}`,
}))

// Waypoints (from navaids)
const waypoints: Waypoint[] = navaidsData.data.map((navaid: any) => ({
  id: navaid._id,
  name: navaid.name,
  lat: navaid.geometry.coordinates[1],
  lon: navaid.geometry.coordinates[0],
  type: navaid.type === 4 ? 'VOR' : navaid.type === 3 ? 'NDB' : 'GPS_FIX',
  frequency: navaid.frequency ? `${navaid.frequency.value} ${navaid.frequency.unit}` : undefined,
  description: `Type ${navaid.type} navigation aid`,
}))

// Airspace (already in correct format)
const airspace: AirspaceFeatureCollection = airspaceData.data
```

## Testing

### Test the API Routes Work

```bash
# Test airports
curl "http://localhost:3000/api/openaip?type=airports&bounds=-123,37,-121,39"
# Should return: Success: True, Count: 100

# Test navaids
curl "http://localhost:3000/api/openaip?type=navaids&bounds=-123,37,-121,39"
# Should return: Success: True, Count: 9

# Test airspace
curl "http://localhost:3000/api/openaip?type=airspace&bounds=-123,37,-121,39"
# Should return: Success: True, Count: 65
```

### Test the UI

1. Open http://localhost:3000
2. Map should load without errors
3. Check browser console for:
   ```
   Loading aviation data from OpenAIP API...
   ✓ Loaded 100 airports, 9 waypoints, 65 airspace features
   ```
4. Click "Plan Route"
5. Route should be calculated successfully

## Environment Variables

### Server-Side Only (No `NEXT_PUBLIC_` prefix)
These are only accessible in server-side code (API routes, server components):

```bash
OPEN_AIP_API_KEY=f4b375fe81de1e578c19a57febb0004d
GEMINI_API_KEY=your_gemini_api_key_here
```

### Client-Side (With `NEXT_PUBLIC_` prefix)
These are accessible in both client and server:

```bash
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1IjoicmF5ZWVldiIsImEiOiJjbWt0OGJyNTcxcTVtM2ZvZjlpOGphY2FuIn0.vXmxv0K3EXv6GYL8r97j_w
NEXT_PUBLIC_USE_OPENAIP=true  # Optional toggle (removed in final version)
```

## Key Takeaways

1. **Never access server-side env vars from client components**
   - Server-side: `VARIABLE_NAME`
   - Client-side: `NEXT_PUBLIC_VARIABLE_NAME`

2. **Use API routes as the bridge between client and server**
   - Client → API Route → External API
   - API routes run on the server and have access to server-side env vars

3. **Always restart dev server after changing `.env.local`**
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```

4. **Check which side code runs on**
   - `'use client'` → Runs in browser (client-side)
   - `'use server'` or no directive → Runs on server (server-side)
   - API routes (`/app/api/**`) → Always server-side

## Status

✅ **Fixed** - All aviation data now loads correctly through API routes
✅ **Tested** - API routes return data successfully
✅ **Working** - Application loads without errors

## Next Steps

If you encounter similar issues in the future:

1. Check if you're trying to access server-side env vars from client code
2. Use API routes to bridge client ↔ server
3. Always verify which side code runs on (`'use client'` vs server components)
4. Test API routes independently before testing the full UI

---

**Fixed:** 2026-01-25
**Issue:** Client-side code accessing server-side environment variables
**Solution:** Use API routes as intermediary
