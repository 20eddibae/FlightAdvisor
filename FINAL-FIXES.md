# Final Fixes - Reload & Mapbox Errors

## Changes Made

### 1. Eliminated Duplicate Data Loading
**Problem**: Data was being loaded twice on initial page load:
- Once by `handleMapLoad`
- Once by useEffect when cache initialized

**Fix**:
- Removed duplicate useEffect
- Added `hasLoadedDataRef` to track if data has been loaded
- `handleMapLoad` now returns early if cache not ready
- Single useEffect loads data when cache becomes ready

**Before**:
```typescript
handleMapLoad → loadDataForViewport()  // Load #1
useEffect → loadDataForViewport()      // Load #2 (DUPLICATE!)
```

**After**:
```typescript
handleMapLoad → waits for cache, then loadDataForViewport()  // Once
OR
useEffect → loads when cache ready (if map loaded first)     // Once
```

### 2. Fixed Event Listener Cleanup
**Problem**: `this.errorCb is not a function` - event listeners not removed

**Fix**:
- Store handler in `moveEndHandlerRef`
- Remove listener in `handleMapLoad` before adding new one
- Cleanup on unmount
- Try-catch around all map operations
- Check `map.getStyle()` before calling map methods

### 3. Increased Debounce
**Problem**: Too many rapid calls causing issues

**Fix**: Changed from 200ms → 300ms

### 4. Simplified Cleanup
**Problem**: Complex cleanup logic was failing

**Fix**:
- Single useEffect for all cleanup
- Clear refs to null after cleanup
- Clear viewport cache on unmount
- Better error handling (ignore errors when map already destroyed)

### 5. Added Delay to Auto-Selection
**Problem**: AirportSearch auto-selected before cache loaded West Coast

**Fix**: Added 500ms delay to ensure West Coast region loads first

### 6. Added Debug Logging
**Problem**: Hard to diagnose issues

**Fix**: Added render count tracking and clear console messages

## Testing

### Quick Test (2 minutes)

```bash
npm run dev
```

1. **Open browser** → http://localhost:3000
2. **Open console** (F12)
3. **Watch console output**

**Expected output** (in order):
```
🔄 MapContainer render #1
Initializing airport cache provider...
Map loaded, initializing...
Waiting for cache to initialize before loading data...
✓ Cache initialized: X airports from Y regions in Xms
Cache now ready, loading data for existing map
Loading aviation data for visible region...
✓ Showing X cached airports immediately
Auto-selecting airport: KSQL - San Carlos Airport
Auto-selecting airport: KSMF - Sacramento Executive Airport
Map initialization complete
```

**BAD output** (indicates problem):
```
🔄 MapContainer render #1
🔄 MapContainer render #2
🔄 MapContainer render #3  ← Too many renders!
this.errorCb is not a function  ← Mapbox error
```

### Test Plan Route (30 seconds)

1. Wait for airports to auto-select (bottom of controls panel)
2. Click "Plan Route"
3. **Expected**: Route appears on map
4. **Console should show**:
   ```
   🛫 Planning route: KSQL → KSMF
   Looking up airports in cache...
   Cache lookup results: { departure: 'KSQL', arrival: 'KSMF', ... }
   ```

### Test Map Panning (1 minute)

1. Pan map around California
2. **Expected**: Smooth, no glitches, airports update
3. **Console should show**:
   ```
   Loading aviation data for visible region...
   ✓ Showing X cached airports immediately
   ✓ Using cached navaids/airspace for ...
   ```

### Test Cleanup (30 seconds)

1. Close tab or navigate to different page
2. **Console should show**:
   ```
   MapContainer unmounting, cleaning up...
   ✓ Cleaned up moveend listener
   ```
3. **Should NOT show**: `this.errorCb is not a function`

## Expected Performance

| Metric | Target | Acceptable | Bad |
|--------|--------|------------|-----|
| Render count | 1-2 | 3-4 | 5+ |
| Initial load | <1s | <2s | >2s |
| Plan route | <500ms | <1s | >2s |
| Pan response | <300ms | <500ms | >1s |

## If Still Broken

### Diagnostic Checklist

Run through these checks:

- [ ] **Check render count**: Should be 1-2, not 10+
- [ ] **Check cache status**: Bottom-right indicator should disappear after load
- [ ] **Check console errors**: No Mapbox errors
- [ ] **Check Network tab**: No repeated API calls to same endpoint
- [ ] **Check Application tab**: IndexedDB → FlightAdvisorCache should have data

### Common Fixes

**If too many renders:**
```typescript
// Check app/page.tsx - make sure nothing is changing
// that would cause re-mount
```

**If Mapbox errors persist:**
```bash
# Clear everything and start fresh
rm -rf .next node_modules
npm install
npm run dev
```

**If cache not working:**
```typescript
// Temporarily disable to isolate issue
// In lib/constants.ts
export const FEATURE_FLAGS = {
  USE_AIRPORT_CACHE: false,
}
```

**If Plan Route doesn't work:**
```typescript
// Check console for:
console.log('Cache lookup results:', { ... })

// If "NOT FOUND", force reload:
window.location.reload()
```

## Files Modified in This Fix

1. `components/Map/MapContainer.tsx`
   - Removed duplicate data loading effect
   - Fixed event listener cleanup
   - Added render count tracking
   - Improved error handling
   - Increased debounce to 300ms

2. `components/Controls/AirportSearch.tsx`
   - Added 500ms delay to auto-selection
   - Better logging

3. `DEBUG.md` - Created
4. `FINAL-FIXES.md` - This file

## Rollback Instructions

If you need to revert all changes:

```bash
git status  # See what's changed
git diff components/Map/MapContainer.tsx  # Review changes
git checkout HEAD -- components/Map/MapContainer.tsx  # Revert one file
# OR
git reset --hard HEAD~5  # Revert last 5 commits (DANGER!)
```

## Success Criteria

All of these must be true:

- ✅ Render count is 1-2 (not 10+)
- ✅ No `this.errorCb is not a function` errors
- ✅ Map loads within 2 seconds
- ✅ Plan Route button works
- ✅ Panning is smooth (no glitches)
- ✅ Console shows clean cleanup on close
- ✅ No memory leaks after 5 minutes of use

## Next Session Checklist

When you come back to this project:

1. **Clear browser cache**: Cmd+Shift+R (hard refresh)
2. **Kill old dev server**: `pkill -f next-server`
3. **Start fresh**: `npm run dev`
4. **Check console**: Should see clean startup sequence
5. **Test Plan Route**: Should work immediately

If issues persist, see `DEBUG.md` for detailed troubleshooting.
