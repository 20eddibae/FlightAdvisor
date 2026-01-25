# Debug Guide - Reload & ErrorCb Issues

## Current Issues

1. **Keeps reloading without working** - Page reloads continuously
2. **`this.errorCb is not a function`** - Mapbox GL JS error

## Debugging Steps

### Step 1: Check What's Causing Reloads

Open browser console and look for these messages in order:

**Normal startup sequence:**
```
1. Initializing airport cache provider...
2. Map loaded, initializing...
3. Waiting for cache to initialize before loading data...
4. ✓ Cache initialized: X airports from Y regions
5. Cache now ready, loading data for existing map
6. Loading aviation data for visible region...
7. ✓ Showing X cached airports immediately
```

**BAD - If you see this repeating:**
```
Map loaded, initializing...
Map loaded, initializing...
Map loaded, initializing...
```
This means the map component is remounting repeatedly.

### Step 2: Check for Mapbox Errors

Look for these errors:
- `this.errorCb is not a function`
- `Cannot read property 'getStyle' of undefined`
- `Map has already been removed`

These indicate event listener cleanup issues.

### Step 3: Check Cache Status

In console, type:
```javascript
// Check if cache is working
window.__DEBUG_CACHE__ = true
```

Then refresh page and look for:
```
Cache lookup results: {
  departure: 'KSQL',
  arrival: 'KSMF',
  cacheInitialized: true,
  totalAirports: 500
}
```

## Common Problems & Fixes

### Problem: Map Keeps Remounting

**Symptom**: "Map loaded, initializing..." appears multiple times

**Causes**:
1. Parent component re-rendering
2. State changes causing unmount/remount
3. React Strict Mode in development

**Fix**:
Check `app/page.tsx` - make sure MapContainer isn't wrapped in anything that changes:
```typescript
// GOOD
<AirportCacheProvider>
  <MapContainer />
</AirportCacheProvider>

// BAD - don't do this
<AirportCacheProvider key={someState}>
  <MapContainer />
</AirportCacheProvider>
```

### Problem: errorCb Not a Function

**Symptom**: Console error `this.errorCb is not a function`

**Cause**: Mapbox event listener not properly removed before map destruction

**Current Fix Applied**:
- Event handler stored in ref
- Cleanup on unmount
- Try-catch around all map operations

**If still happening**:
1. Check if multiple MapView components exist
2. Check if map is being destroyed elsewhere
3. Look for duplicate event listeners

### Problem: Plan Route Doesn't Work

**Symptom**: Clicking "Plan Route" does nothing or shows error

**Debug**:
1. Check console for: "🛫 Planning route: KSQL → KSMF"
2. Check if airports found: "Cache lookup results: { departure: 'KSQL', ... }"
3. If "NOT FOUND", check: "totalAirports" - should be > 0

**Fix**:
Wait longer for cache to load, or click again after a few seconds.

## Emergency Rollback

If nothing works, disable cache temporarily:

### Option 1: Disable Cache Only
```typescript
// In lib/constants.ts
export const FEATURE_FLAGS = {
  USE_AIRPORT_CACHE: false,  // DISABLE CACHE
}
```

### Option 2: Use Fallback API
Delete these files temporarily:
```bash
rm components/Cache/AirportCacheProvider.tsx
rm app/page.tsx
```

Then recreate `app/page.tsx`:
```typescript
import MapContainer from '@/components/Map/MapContainer'

export default function Home() {
  return (
    <main className="relative w-full h-screen">
      <MapContainer />
    </main>
  )
}
```

And update `MapContainer.tsx` to remove cache hooks.

## Performance Testing

### Test 1: Check Render Count
Add to MapContainer.tsx (top of component):
```typescript
const renderCount = useRef(0)
renderCount.current++
console.log('MapContainer render count:', renderCount.current)
```

**Expected**: 1-2 renders on initial load
**Bad**: 5+ renders, or continuously increasing

### Test 2: Check Memory Leaks
1. Open Chrome DevTools → Memory
2. Take heap snapshot
3. Pan map for 1 minute
4. Take another snapshot
5. Compare sizes

**Expected**: <5MB difference
**Bad**: >20MB difference (indicates leak)

### Test 3: Check Event Listeners
In console:
```javascript
// Get map instance (when page is loaded)
const map = window.__mapboxglMap__  // We need to expose this
getEventListeners(map._canvas)
```

Look for `moveend` listeners count.
**Expected**: 1 listener
**Bad**: Multiple listeners (indicates leak)

## Known Issues & Workarounds

### Issue 1: React Strict Mode
**Symptom**: Double mounting in development
**Fix**: Ignore in dev, test in production build

### Issue 2: Hot Module Reload
**Symptom**: Map errors after file save
**Fix**: Hard refresh browser (Cmd+Shift+R)

### Issue 3: IndexedDB Quota
**Symptom**: Cache fails to save
**Check**:
```javascript
navigator.storage.estimate().then(console.log)
```
**Fix**: Clear browser data

## Collecting Debug Info

If issues persist, collect this info:

```bash
# 1. Browser console logs (full output)
# Save to file: Right-click console → Save as...

# 2. React DevTools Profiler
# Record a session while reproducing the issue

# 3. Network tab
# Check for repeated API calls

# 4. Application tab
# IndexedDB → FlightAdvisorCache → regions
# Should have entries

# 5. System info
echo "Browser: Chrome/Safari/Firefox"
echo "OS: macOS/Windows/Linux"
echo "Node version: $(node -v)"
echo "Next.js: 16.1.4"
```

## Contact Info

If you're still stuck:
1. Share console logs (full output)
2. Share Network tab screenshot
3. Describe exact steps to reproduce
4. Mention when it started (after which change)
