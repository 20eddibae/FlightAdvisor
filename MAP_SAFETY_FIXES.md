# Map Component Safety Fixes

## Error Fixed

**Error Message:**
```
Runtime TypeError
Cannot read properties of undefined (reading 'appendChild')
components/Map/WaypointMarkers.tsx (51:10)
```

## Root Cause

The error occurred because map markers were trying to be added to a Mapbox GL map instance that was either:
1. Not fully loaded yet
2. Being unmounted/destroyed during component cleanup
3. Invalid due to rapid re-renders

When `.addTo(map)` was called on a marker, it tried to access the map's canvas container which no longer existed, causing the `appendChild` error.

## Solution

Added **multiple layers of safety checks** to prevent accessing invalid or destroyed map instances.

## Safety Checks Added

### 1. Early Return Check (All Map Components)

Added at the beginning of each `useEffect` to prevent any operations on invalid maps:

```typescript
// Additional safety check: ensure map is fully loaded
if (!map.getCanvasContainer()) return
```

**Applied to:**
- ✅ `AirportMarkers.tsx` (line 18)
- ✅ `WaypointMarkers.tsx` (line 18)
- ✅ `RouteLayer.tsx` (line 18)

### 2. Per-Marker Safety Check (Marker Components)

Added before each individual marker creation to handle cases where map becomes invalid during loop:

```typescript
// Safety check: ensure map is still valid for marker addition
if (!map.getCanvasContainer()) return
```

**Applied to:**
- ✅ `AirportMarkers.tsx` (line 52)
- ✅ `WaypointMarkers.tsx` (line 49)

### 3. Style Check (Layer Components)

For components that add Mapbox layers/sources, also check if the map style is loaded:

```typescript
if (!map.getCanvasContainer() || !map.getStyle()) return
```

**Applied to:**
- ✅ `AirspaceLayer.tsx` (line 28 - uses `map.getStyle()`)
- ✅ `RouteLayer.tsx` (line 18)

## How Safety Checks Work

### Check 1: `map.getCanvasContainer()`

```typescript
if (!map.getCanvasContainer()) return
```

**What it checks:**
- Returns the DOM element containing the map canvas
- Returns `undefined` if map is destroyed or not initialized

**When to use:**
- Before any map operations
- Before adding markers
- Before accessing map DOM elements

### Check 2: `map.getStyle()`

```typescript
if (!map.getStyle()) return
```

**What it checks:**
- Returns the map's current style object
- Returns `undefined` if style not loaded or map destroyed

**When to use:**
- Before adding/removing layers
- Before adding/removing sources
- When working with map style data

## Component-Specific Fixes

### AirportMarkers.tsx

**Added:**
1. Early check at useEffect start (line 18)
2. Per-marker check before `.addTo()` (line 52)

**Flow:**
```typescript
useEffect(() => {
  if (!map || airports.length === 0) return
  if (!map.getCanvasContainer()) return  // ← Early exit

  const markers: mapboxgl.Marker[] = []

  airports.forEach((airport) => {
    // ... create marker element and popup

    if (!map.getCanvasContainer()) return  // ← Per-marker check
    const marker = new mapboxgl.Marker(el).addTo(map)

    // ... add label and push marker
  })

  return () => markers.forEach(m => m.remove())
}, [map, airports])
```

### WaypointMarkers.tsx

**Added:**
1. Early check at useEffect start (line 18)
2. Per-marker check before `.addTo()` (line 49)

**Flow:**
```typescript
useEffect(() => {
  if (!map || waypoints.length === 0) return
  if (!map.getCanvasContainer()) return  // ← Early exit

  const markers: mapboxgl.Marker[] = []

  waypoints.forEach((waypoint) => {
    // ... create marker element and popup

    if (!map.getCanvasContainer()) return  // ← Per-marker check
    const marker = new mapboxgl.Marker(el).addTo(map)

    // ... add label and push marker
  })

  return () => markers.forEach(m => m.remove())
}, [map, waypoints])
```

### RouteLayer.tsx

**Added:**
1. Early check with both `getCanvasContainer()` and `getStyle()` (line 18)

**Flow:**
```typescript
useEffect(() => {
  if (!map || !coordinates || coordinates.length < 2) return
  if (!map.getCanvasContainer() || !map.getStyle()) return  // ← Combined check

  const sourceId = 'route'
  const layerId = 'route-line'

  // ... add source and layer

  return () => {
    if (map.getLayer(layerId)) map.removeLayer(layerId)
    if (map.getSource(sourceId)) map.removeSource(sourceId)
  }
}, [map, coordinates])
```

### AirspaceLayer.tsx

**Already had:**
- Style check: `const isMapLoaded = map && map.getStyle()`
- No changes needed (already protected)

## Why Multiple Checks Are Needed

### Early Check (Top of useEffect)
- **Purpose:** Prevent entire effect from running if map is invalid
- **Benefit:** Saves CPU cycles, avoids unnecessary work
- **Catches:** Map not loaded yet, component unmounting

### Per-Item Check (Inside loops)
- **Purpose:** Handle map becoming invalid during iteration
- **Benefit:** Gracefully exits if map destroyed mid-loop
- **Catches:** Rapid re-renders, concurrent unmounting

### Style Check (For layers)
- **Purpose:** Ensure map style is fully initialized before layer operations
- **Benefit:** Prevents errors when accessing style-dependent features
- **Catches:** Style not loaded, style changes in progress

## Testing the Fix

### 1. Normal Operation
```bash
npm run dev
# Open http://localhost:3000
# Map should load without errors
# Markers should appear correctly
```

**Expected:**
- ✅ No console errors
- ✅ Airport markers with names
- ✅ Waypoint markers with names
- ✅ All labels visible

### 2. Rapid Navigation
```
1. Load page
2. Immediately refresh (before map fully loads)
3. Repeat several times
```

**Expected:**
- ✅ No appendChild errors
- ✅ No undefined access errors
- ✅ Graceful handling of incomplete loads

### 3. Component Unmounting
```
1. Load page
2. Navigate away while map is loading
3. Return to page
```

**Expected:**
- ✅ Clean unmount
- ✅ No errors in cleanup
- ✅ Fresh load on return

## Error Prevention Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│ Level 1: Component Props Check                             │
│   if (!map || data.length === 0) return                    │
│   ↓ Catches: Missing props, empty data                     │
└─────────────────────────────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Level 2: Map Canvas Check                                  │
│   if (!map.getCanvasContainer()) return                    │
│   ↓ Catches: Destroyed map, uninitialized canvas           │
└─────────────────────────────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Level 3: Map Style Check (for layers)                      │
│   if (!map.getStyle()) return                               │
│   ↓ Catches: Style not loaded, style changing              │
└─────────────────────────────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Level 4: Per-Item Check (in loops)                         │
│   forEach(item => {                                         │
│     if (!map.getCanvasContainer()) return                   │
│   })                                                        │
│   ↓ Catches: Mid-loop invalidation                         │
└─────────────────────────────────────────────────────────────┘
                          ▼
                   ✅ Safe Operations
```

## Best Practices Applied

1. **Defensive Programming:** Always check before accessing map
2. **Early Returns:** Exit fast if preconditions not met
3. **Multiple Layers:** Different checks for different scenarios
4. **Graceful Degradation:** Fail silently rather than crash
5. **Cleanup Safety:** Remove markers/layers safely in cleanup

## Files Modified

- ✅ `/components/Map/AirportMarkers.tsx` - Added 2 safety checks
- ✅ `/components/Map/WaypointMarkers.tsx` - Added 2 safety checks
- ✅ `/components/Map/RouteLayer.tsx` - Added 1 safety check
- ✅ `/components/Map/AirspaceLayer.tsx` - Already had checks (verified)

## Future Considerations

If similar errors occur in the future:

1. **Check component lifecycle:** Is useEffect racing with unmount?
2. **Add more checks:** Use `map.getCanvasContainer()` liberally
3. **Test rapid operations:** Refresh, navigate away, resize window
4. **Monitor cleanup:** Ensure all markers/layers removed properly

## Summary

The error was caused by accessing a map instance that was no longer valid. By adding multiple layers of safety checks:

- ✅ Early returns prevent unnecessary work
- ✅ Per-item checks handle mid-operation failures
- ✅ Style checks ensure map is fully initialized
- ✅ All map components now protected from invalid access

**Status:** ✅ Fixed and tested
**Risk Level:** Low (multiple redundant safety checks)
**Performance Impact:** Negligible (early returns are fast)

---

**Fixed:** 2026-01-25
**Error:** Cannot read properties of undefined (reading 'appendChild')
**Solution:** Added `map.getCanvasContainer()` safety checks
