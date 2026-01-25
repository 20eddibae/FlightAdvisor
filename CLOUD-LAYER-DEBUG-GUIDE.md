# Cloud Layer Debugging Guide

## Dual Visualization Design

The cloud layer now shows **TWO visualizations simultaneously**:

### 1. Large Colored Overlay Circles (Background)
- **Purpose**: Show cloud coverage patterns across the map
- **Size**: 80-180px radius (scales with zoom)
- **Colors**:
  - 🟢 VFR: Very light green (nearly transparent)
  - 🟡 MVFR: Yellow overlay
  - 🟠 IFR: Orange/red overlay
  - 🔴 LIFR: Dark red overlay
- **Effect**: Smooth gradient blend between stations (high blur)
- **Component**: CloudLayer.tsx (WebGL layer)

### 2. Green Airport Markers (Foreground)
- **Purpose**: Precise station locations with full weather info
- **Size**: 16px radius (same as regular airports)
- **Color**: Green (#00ff00) with white border
- **Interactive**: Click to see detailed weather popup
- **Component**: AirportMarkers.tsx (DOM markers)
- **Searchable**: Weather stations appear in airport search and can be used as departure/destination

### 3. Station Labels (Top)
- **Visible**: When zoomed in (zoom level 8+)
- **Shows**: "KSQL\nVFR CLR"
- **Color**: Matches flight category
- **Component**: CloudLayer.tsx (WebGL layer)

## Changes Made

### 1. Added Toggle Button
- **Location**: RouteControls panel (left side of screen)
- **Button Text**: "☁️ Show Weather" / "☁️ Hide Weather"
- **Status Text**: Shows "Weather stations visible" or "Weather stations hidden"

### 2. Weather Station Integration
- Weather stations are converted to Airport objects when fetched
- Merged into the airports state for consistent rendering
- Rendered by AirportMarkers component (same 16px green circles)
- Fully searchable in airport search fields
- Can be selected as departure/destination
- Weather data stored in `_metadata.metar` field

### 3. Enhanced Debugging
Added comprehensive console logging at every step:

#### MapContainer Logs:
```
🌤️ updateCloudData called - Shows cache status
🌐 Fetching METAR cloud data for bbox: ... - When API call starts
📦 Received weather data - Shows feature count
✅ Setting cloudData state - Confirms state update
🌡️ Converting N weather stations to airport objects - Conversion process
✅ Merged airports: X regular + Y weather stations = Z total - Final count
☁️ Cloud layer toggled - When button clicked
```

#### CloudLayer Logs:
```
🌤️ CloudLayer component rendered - Component lifecycle
CloudLayer useEffect triggered - Effect execution
✅ CloudLayer: Rendering N stations - Processing features
📊 CloudLayer sample data - First feature details
✅ Cloud overlay layers initialized (2 layers: overlay circles, labels)
   Green dots are rendered by AirportMarkers component for consistency
```

#### AirportMarkers Logs:
```
🟢 AirportMarkers rendering: N total (X towered, Y non-towered)
   Zoom level: Z.Z
🔍 Airport markers in DOM: N
```

## How to Debug

### Step 1: Open Browser Console
1. Start dev server: `npm run dev`
2. Open `http://localhost:3000`
3. Open DevTools Console (F12 or Cmd+Option+I)

### Step 2: Check Initial Load
Look for this sequence:
```
🌤️ updateCloudData called { cacheAge: ..., willFetch: true }
🌐 Fetching METAR cloud data for bbox: -122.5,37.5,-121.5,38.5
📦 Received weather data: { type: 'FeatureCollection', featureCount: 14 }
✅ Setting cloudData state with 14 features
✓ Loaded 14 METAR stations with cloud data
   Sample: KSQL - CLR, ceil=none
```

Then:
```
🌤️ CloudLayer component rendered with props: { hasMap: true, hasCloudData: true, featureCount: 14 }
CloudLayer useEffect triggered: { hasMap: true, hasCloudData: true, featureCount: 14 }
✅ CloudLayer: Rendering 14 METAR stations as green dots
📊 CloudLayer sample data: { id: 'KSQL', cover: 'CLR', ceil: null, coords: [...] }
🔨 Creating markers for 14 stations...
   Creating marker 1: KSQL at [-122.24829, 37.51192]
   Creating marker 2: KSFO at [...]
   ...
✓ CloudLayer: Added 14 METAR station markers
```

### Step 3: Verify Markers on Map
After logs appear:
1. Look for **green dots** at airports (KSQL, KSFO, KOAK, etc.)
2. Green dots should be 16px circles with white borders
3. Click a green dot to see weather popup

### Step 4: Test Toggle Button
1. Click **"☁️ Hide Weather"** button in RouteControls panel
2. Console should show: `☁️ Cloud layer toggled: false`
3. Green weather dots should **disappear**
4. Click **"☁️ Show Weather"** to bring them back
5. Console should show: `☁️ Cloud layer toggled: true`

## Common Issues & Solutions

### Issue 1: "No cloud data" in console
**Symptom:**
```
❌ CloudLayer: No cloud data
```

**Causes:**
1. API fetch failed
2. Empty feature array returned
3. cloudData state not set

**Check:**
- Look for `📦 Received weather data` log - does it show features?
- Look for `✅ Setting cloudData state` - is it being set?
- Check network tab - is `/api/weather?bbox=...` returning data?

**Test API directly:**
```bash
curl "http://localhost:3000/api/weather?bbox=-122.5,37.5,-121.5,38.5" | jq
```

Should return:
```json
{
  "fetchedAt": "...",
  "type": "FeatureCollection",
  "features": [ ... 14 features ... ]
}
```

### Issue 2: "Cache preventing fetch"
**Symptom:**
```
⏭️ Skipping cloud fetch - still within cache window
```

**Solution:**
- Wait 5 minutes
- Or restart dev server
- Or modify code to set `const CLOUD_CACHE_TTL = 0` temporarily

### Issue 3: Markers created but not visible
**Symptom:**
```
✓ CloudLayer: Added 14 METAR station markers
```
But no green dots on map.

**Possible Causes:**
1. **Z-index issue** - Markers behind other layers
2. **Coordinates wrong** - Markers outside viewport
3. **Map container issue** - Map not fully initialized

**Verify:**
```javascript
// In browser console:
document.querySelectorAll('.metar-station').length
// Should return 14 if markers exist in DOM
```

**Fix z-index:**
Check if markers are behind airspace polygons. CloudLayer should render AFTER AirspaceLayer but BEFORE RouteLayer.

### Issue 4: Toggle button not appearing
**Symptom:** No "Show Weather" button in RouteControls

**Check:**
1. Is `onToggleCloudLayer` prop being passed?
2. Look in MapContainer.tsx line 852:
```tsx
onToggleCloudLayer={handleToggleCloudLayer}
```

### Issue 5: Features array empty
**Symptom:**
```
📦 Received weather data: { type: 'FeatureCollection', featureCount: 0 }
```

**Causes:**
1. Viewport bbox doesn't match any region
2. Region detection logic failing
3. AWC API not returning data for those stations

**Check region detection:**
```
Bay Area: west <= -121 && east >= -123 && south <= 38.5 && north >= 36.5
```

Current San Francisco bbox: `-122.5,37.5,-121.5,38.5`
- west: -122.5 (YES <= -121)
- east: -121.5 (NO >= -123) ❌ **PROBLEM HERE**

**Fix:** Adjust region detection in `/api/weather/route.ts`:
```typescript
// Bay Area stations
if (west <= -121.5 && east >= -123.5 && south <= 38.5 && north >= 36.5) {
  // Should be more inclusive
}
```

## Expected Visual Result

When working correctly, you should see:
1. **Green dots** at these locations (approximate):
   - KSQL (San Carlos) - Peninsula
   - KSFO (San Francisco) - By the bay
   - KOAK (Oakland) - East Bay
   - KSJC (San Jose) - South Bay
   - KSMF (Sacramento) - North
   - KMHR (Mather) - East of Sacramento

2. **Popup on click** showing:
```
KSQL
San Carlos Arpt, CA, US

VFR
Ceiling: CLR
Cover: CLR
Visibility: 10+ SM
Temp: 6°C
Dewpoint: 1°C

METAR KSQL 251235Z AUTO 00000KT 10SM CLR 06/01 A3012 RMK A01
```

3. **Toggle functionality**:
   - Click "Hide Weather" → green dots disappear
   - Click "Show Weather" → green dots reappear

## Next Steps if Still Not Working

If you still don't see markers after checking all of the above:

1. **Share console output** - Copy entire console log
2. **Check Network tab** - Show response from `/api/weather?bbox=...`
3. **Inspect DOM** - Run `document.querySelectorAll('.metar-station')` in console
4. **Screenshot** - Show map with console open

Then I can provide more specific guidance based on what's actually happening.
