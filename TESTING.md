# OpenAIP Integration Testing Guide

This guide provides comprehensive instructions for testing the OpenAIP API integration in FlightAdvisor.

## Prerequisites

1. **OpenAIP API Key**: Ensure `OPEN_AIP_API_KEY` is set in `.env.local`
2. **Dependencies**: Run `npm install` to install all dependencies
3. **Dev Server**: Start with `npm run dev` for live testing

## Quick Start

### Enable OpenAIP in Your App

Edit `.env.local`:
```bash
NEXT_PUBLIC_USE_OPENAIP=true  # Use OpenAIP API
# or
NEXT_PUBLIC_USE_OPENAIP=false # Use static files (default)
```

Then restart the dev server:
```bash
npm run dev
```

## Testing Methods

### 1. Browser API Route Testing

With dev server running, open these URLs in your browser:

**Test Airspace:**
```
http://localhost:3000/api/openaip?type=airspace&bounds=-122.5,37.5,-122,38
```

**Test Airports:**
```
http://localhost:3000/api/openaip?type=airports&bounds=-122.5,37.5,-122,38
```

**Test Navaids:**
```
http://localhost:3000/api/openaip?type=navaids&bounds=-123,37,-121,39
```

### What You Should See (Example Responses)

**Airspace** (`type=airspace`, bounds `-122.5,37.5,-122,38`):

- **Top-level**: `success: true`, `type: "airspace"`, `bounds: [-122.5, 37.5, -122, 38]`, `count` (number), `data` (object).
- **Count**: Typically **10–20** features for this Bay Area box. Your **13** is correct (SFO Class B sub-areas A–M and similar).
- **`data`**: A GeoJSON `FeatureCollection`:

```json
{
  "success": true,
  "type": "airspace",
  "bounds": [-122.5, 37.5, -122, 38],
  "count": 13,
  "data": {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "properties": {
          "name": "SAN FRANCISCO CLASS B AREA A",
          "type": "UNKNOWN",
          "icaoClass": 1,
          "floor_msl": 0,
          "ceiling_msl": 10000,
          "activity": 0,
          "notes": ""
        },
        "geometry": {
          "type": "Polygon",
          "coordinates": [[[-122.24694, 37.56472], ...]]
        }
      }
    ]
  }
}
```

- **Feature names**: Include SFO Class B sub-areas (e.g. "SAN FRANCISCO CLASS B AREA A" through "AREA M"). `properties.type` may show `"UNKNOWN"` (OpenAIP type `0` is stored as number); that’s a known quirk, not a failure.
- **Check**: `data.features` is an array of polygons; each has `name`, `floor_msl`, `ceiling_msl`, and `geometry.coordinates`.

**Airports** (`type=airports`, bounds `-122.5,37.5,-122,38`):

- **Top-level**: `success: true`, `type: "airports"`, `bounds: [-122.5, 37.5, -122, 38]`, `count` (number), `data` (array).
- **Count**: Typically **15–25** airports for this Bay Area box (TESTING.md: “15–30”).
- **`data`**: Array of OpenAIP airport objects, **not** GeoJSON features:

```json
{
  "success": true,
  "type": "airports",
  "bounds": [-122.5, 37.5, -122, 38],
  "count": 19,
  "data": [
    {
      "_id": "...",
      "name": "San Carlos Airport",
      "icaoCode": "KSQL",
      "type": 2,
      "geometry": {
        "type": "Point",
        "coordinates": [-122.2495, 37.5119]
      },
      "elevation": { "value": 5, "unit": "ft" },
      "trafficType": ["IFR", "VFR"]
    }
  ]
}
```

- **Check**: Each item has `name`, `icaoCode` (when present), `geometry.coordinates` `[lon, lat]`, and optional `elevation`, `trafficType`. You should see KSQL, KSMF, KOAK, KSFO, etc. in the Bay Area.

**Navaids** (`type=navaids`, bounds `-123,37,-121,39`):

- **Top-level**: `success: true`, `type: "navaids"`, `bounds`, `count`, `data` (array of navaids).
- **`data`**: Array of VOR/NDB-style objects with `name`, `type`, `geometry.coordinates`, `frequency`, etc.
- **Count**: Usually **5–15** for the NorCal bounds.

### 2. Browser Console Testing

Open browser DevTools console on any page:

```javascript
// Test airspace
fetch('/api/openaip?type=airspace&bounds=-122.5,37.5,-122,38')
  .then(r => r.json())
  .then(d => console.log('Airspaces:', d))

// Test airports
fetch('/api/openaip?type=airports&bounds=-122.5,37.5,-122,38')
  .then(r => r.json())
  .then(d => console.log('Airports:', d))

// Test navaids
fetch('/api/openaip?type=navaids&bounds=-123,37,-121,39')
  .then(r => r.json())
  .then(d => console.log('Navaids:', d))
```

### 3. Automated Tests (Jest)

Run the test suite:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run only OpenAIP tests
npm test openaip

# Run only integration tests
npm test integration
```

**Test Files:**
- `/lib/api/__tests__/openaip.test.ts` - Unit tests for OpenAIP client
- `/lib/__tests__/geojson.integration.test.ts` - Integration tests for data loaders

### 4. Manual Test Scripts

#### Quick Test Script

```bash
npx tsx scripts/test-openaip.ts
```

This runs a comprehensive test suite checking:
- API configuration
- Airspace fetching
- Airport fetching
- Navaid fetching
- Data loader integration
- Static data fallback
- Performance

**Expected output:**
```
🧪 OpenAIP Integration Test

1️⃣  Checking configuration...
✅ OpenAIP API key configured

2️⃣  Testing airspace fetching...
✅ All airspace: 24 features
✅ Class B airspace: 8 features
✅ Restricted airspace: 12 features
✅ Found SFO Class B: SAN FRANCISCO CLASS B AREA A

3️⃣  Testing airport fetching...
✅ Fetched 19 airports
✅ Found KSQL: San Carlos Airport at [-122.2495, 37.5119]
✅ Found KSMF: Sacramento Executive Airport at [-121.4932, 38.5125]

...

🎉 All tests passed!
```

#### Data Comparison Script

Compare static data vs OpenAIP data:

```bash
npx tsx scripts/compare-data-sources.ts
```

This shows:
- How many features are in static files vs OpenAIP
- Which static features are found in OpenAIP
- Coverage percentages
- Coordinate comparisons

### 5. Full Stack Application Testing

#### Test with Static Data (Default)

1. Set in `.env.local`:
   ```
   NEXT_PUBLIC_USE_OPENAIP=false
   ```

2. Restart dev server: `npm run dev`

3. Open http://localhost:3000

4. Click "Plan Route"

5. Verify:
   - Map loads with markers
   - Route is calculated
   - SFO Class B airspace visible
   - KSQL and KSMF airports marked

#### Test with OpenAIP Data

1. Set in `.env.local`:
   ```
   NEXT_PUBLIC_USE_OPENAIP=true
   ```

2. Restart dev server: `npm run dev`

3. Open http://localhost:3000

4. Check browser console for:
   ```
   Loading aviation data from OpenAIP API...
   ✓ Loaded 25 airports, 8 waypoints, 35 airspace features
   ```

5. Click "Plan Route"

6. Verify:
   - More airspace zones visible (compared to static)
   - More airports marked
   - Route calculation still works
   - OpenAIP data integrated seamlessly

#### Test Fallback Behavior

1. Set in `.env.local`:
   ```
   NEXT_PUBLIC_USE_OPENAIP=true
   OPEN_AIP_API_KEY=invalid_key
   ```

2. Restart dev server

3. Open http://localhost:3000

4. Check console for:
   ```
   OpenAIP API failed, falling back to static data
   ```

5. Verify app still works with static files

## Testing Checklist

Use this checklist to verify all functionality:

### API Route Tests
- [ ] `/api/openaip?type=airspace` returns 200 OK with features
- [ ] `/api/openaip?type=airports` returns 200 OK with airports
- [ ] `/api/openaip?type=navaids` returns 200 OK with navaids
- [ ] Missing bounds returns 400 error with helpful message
- [ ] Invalid bounds format returns 400 error
- [ ] Missing API key returns 500 error

### Data Loader Tests
- [ ] `loadAllAirspace()` loads static files
- [ ] `loadAllAirspace({ useOpenAIP: true })` loads from OpenAIP
- [ ] `loadAirports({ useOpenAIP: true })` returns airports with correct structure
- [ ] `loadWaypoints({ useOpenAIP: true })` returns waypoints with correct structure
- [ ] Fallback to static files works when OpenAIP fails

### Map Integration Tests
- [ ] Map loads with static data (default)
- [ ] Map loads with OpenAIP data when enabled
- [ ] Airspace polygons render correctly
- [ ] Airport markers appear at correct locations
- [ ] Waypoint markers display correctly
- [ ] Route calculation works with both data sources

### Specific Location Tests
- [ ] Bay Area bounds (-122.5, 37.5, -122, 38) returns data
- [ ] NorCal bounds (-123, 37, -121, 39) includes KSQL and KSMF
- [ ] SFO Class B airspace is present
- [ ] KSQL coordinates match: ~37.51, -122.25
- [ ] KSMF coordinates match: ~38.51, -121.49

### Error Handling Tests
- [ ] Invalid API key triggers fallback
- [ ] Network error triggers fallback
- [ ] Empty result set handled gracefully
- [ ] Malformed bounds rejected
- [ ] Console shows appropriate error messages

### Performance Tests
- [ ] Static data loads in <500ms
- [ ] OpenAIP data loads in <5s
- [ ] Map renders in <1s after data load
- [ ] Route calculation completes in <2s
- [ ] No memory leaks after multiple route calculations

## Common Test Regions

### San Francisco Bay Area
```
Bounds: [-122.6, 37.2, -121.8, 38.0]
Expected: SFO Class B, OAK Class C, 15-25 airports
```

### KSQL to KSMF Route (Demo)
```
Bounds: [-123.0, 37.0, -121.0, 39.0]
Expected: KSQL, KSMF, SFO Class B, 20-30 airports, 5-10 navaids
```

### Sacramento Area
```
Bounds: [-121.8, 38.3, -121.2, 38.8]
Expected: KSMF, SAC VORTAC, Class D airspace
```

### Los Angeles Basin
```
Bounds: [-118.7, 33.5, -117.5, 34.5]
Expected: LAX Class B, many airports, complex airspace
```

## Troubleshooting

### API Returns 404

**Problem:** Base URL missing `/api` suffix

**Fix:** Check `/lib/api/openaip.ts` line 12:
```typescript
const OPENAIP_BASE_URL = 'https://api.core.openaip.net/api' // Must include /api
```

### API Returns 400 Bad Request

**Problem:** Using string type filters instead of numeric codes

**Fix:** Use numeric codes:
```typescript
// ❌ Wrong
fetchAirspaces(bounds, { type: ['TMA', 'CTR'] })

// ✅ Correct
fetchAirspaces(bounds, { type: [0] })
```

### No Data Returned

**Causes:**
1. Bounding box too small or in wrong location
2. Invalid coordinates (lon/lat swapped)
3. API key not configured

**Solutions:**
- Use larger bounds: `[-123, 37, -121, 39]`
- Check coordinate order: `[lon, lat]` not `[lat, lon]`
- Verify `OPEN_AIP_API_KEY` in `.env.local`

### Map Not Loading OpenAIP Data

**Problem:** Environment variable not set or dev server not restarted

**Fix:**
1. Set `NEXT_PUBLIC_USE_OPENAIP=true` in `.env.local`
2. Restart dev server completely (Ctrl+C, then `npm run dev`)
3. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)

### Tests Failing

**Problem:** API key not configured or network issues

**Fix:**
1. Verify `OPEN_AIP_API_KEY` in `.env.local`
2. Check internet connection
3. Run `npx tsx scripts/test-openaip.ts` for detailed diagnostics

## Success Criteria

Your OpenAIP integration is working correctly if:

✅ All API routes return 200 OK with valid data
✅ Automated tests pass (`npm test`)
✅ Manual test script shows "All tests passed"
✅ Map loads with both static and OpenAIP data sources
✅ Route calculation works with OpenAIP data
✅ Fallback to static files works when OpenAIP unavailable
✅ Console shows no errors (except expected warnings)
✅ Performance meets targets (<5s for OpenAIP load)

## Next Steps

Once testing is complete:

1. **Enable OpenAIP by default** - Set `NEXT_PUBLIC_USE_OPENAIP=true`
2. **Add attribution** - Include "Data provided by OpenAIP" in UI
3. **Implement caching** - Cache OpenAIP responses for better performance
4. **Monitor usage** - Track API calls to stay within rate limits
5. **Consider static fallback** - Keep static files for offline/backup scenarios

## Additional Resources

- **OpenAIP Docs:** https://docs.openaip.net/
- **API Schema:** https://api.core.openaip.net/api/system/specs/v1/schema.json
- **GitHub Issues:** Report bugs at your project's GitHub repo
- **Support:** OpenAIP forums at https://groups.google.com/g/openaip
