# New Route System - How It Works

## Key Concept
**Every route is always a Supabase database row.** You're always editing a specific route entry, never working "outside" the database.

## User Flow

### 1. Click "+ New Route"
**What happens:**
- ✅ Creates a **blank entry in Supabase** immediately (Route 2, Route 3, etc.)
- ✅ Selects that new route
- ✅ Clears the map
- ✅ Shows "Plan a route to save it here" in info card

**Database state:**
```json
{
  "id": "abc-123",
  "name": "Route 2",
  "departure": "",
  "arrival": "",
  "coordinates": [],
  "distance_nm": 0,
  "estimated_time_min": 0
}
```

### 2. Draw Your Route
**What happens:**
- ✅ As you plan the route, it **updates the current Supabase row**
- ✅ Every change auto-saves to that specific route ID
- ✅ No new routes are created

**Database state (after planning):**
```json
{
  "id": "abc-123",
  "name": "Route 2",
  "departure": "KSQL",
  "arrival": "KSMF",
  "coordinates": [[...], [...]],
  "distance_nm": 87.3,
  "estimated_time_min": 52
}
```

### 3. Switch Between Routes
**What happens:**
- ✅ Click dropdown → Select "Route 1"
- ✅ Loads Route 1 from Supabase onto map
- ✅ Any changes now save to Route 1's database row
- ✅ Click dropdown → Select "Route 2"
- ✅ Loads Route 2 from Supabase onto map
- ✅ Changes now save to Route 2's row

**You're always editing the currently selected route's database row.**

## Dropdown Display

### Blank Routes
```
Route 2
Empty route - plan to save  (italic gray text)
```

### Populated Routes
```
Route 1
KSQL → KSMF (87 nm)
```

### New Route Option
```
➕ New Route  (green, bold, with background)
```

## Key Behaviors

### Auto-Save Logic
```typescript
// When route changes, update the CURRENT selected route
if (selectedFlightId) {
  updateFlight(selectedFlightId, { ...currentRoute })
}
```

### No Orphaned Routes
- Every route you see in dropdown exists in Supabase
- "+ New Route" immediately creates the database entry
- You're never working on an "unsaved" route

### Incremental Naming
- Route 1, Route 2, Route 3, etc.
- Finds highest number and increments
- User can rename to anything using pencil icon

## Database Schema Updates

### New Defaults
```sql
departure TEXT DEFAULT '',         -- Can be empty
arrival TEXT DEFAULT '',           -- Can be empty
coordinates JSONB DEFAULT '[]',    -- Can be empty array
distance_nm NUMERIC DEFAULT 0,     -- Can be zero
estimated_time_min INTEGER DEFAULT 0  -- Can be zero
```

This allows blank route creation.

## Example Session

1. **Open app** → Dropdown shows "New Route" placeholder
2. **Click "+ New Route"** → Creates "Route 1" in DB, blank
3. **Plan KSQL → KSMF** → Updates Route 1 with route data
4. **Click "+ New Route"** → Creates "Route 2" in DB, blank
5. **Plan KOAK → KSAC** → Updates Route 2 with route data
6. **Switch to Route 1** → Loads KSQL → KSMF from DB
7. **Modify Route 1** → Updates Route 1's DB row
8. **Switch to Route 2** → Loads KOAK → KSAC from DB

**Database state:**
```
Route 1: KSQL → KSMF (87 nm)
Route 2: KOAK → KSAC (65 nm)
```

## Benefits

✅ **No lost work** - Everything is in the database immediately
✅ **Clear state** - You always know which route you're editing
✅ **Simple mental model** - Each route = one database row
✅ **Easy switching** - Just select different route from dropdown
✅ **No confusion** - Can't accidentally create duplicate routes

## Technical Implementation

### Create Blank Route
```typescript
const newFlight = await saveFlight({
  name: `Route ${nextNumber}`,
  departure: '',
  arrival: '',
  route_type: 'direct',
  waypoints: [],
  coordinates: [],
  distance_nm: 0,
  estimated_time_min: 0,
})
```

### Update Current Route
```typescript
await updateFlight(selectedFlightId, {
  departure: currentRoute.departure,
  arrival: currentRoute.arrival,
  coordinates: currentRoute.coordinates,
  distance_nm: currentRoute.distance_nm,
  // ... etc
})
```

### Always Track Selected Route
```typescript
const [selectedFlightId, setSelectedFlightId] = useState('')

// Only save to the currently selected route
if (selectedFlightId) {
  updateFlight(selectedFlightId, newData)
}
```

## UI States

### No Route Selected
- Dropdown: "New Route" placeholder
- Info card: Hidden
- Map: Empty

### Blank Route Selected
- Dropdown: "Route 2" selected
- Info card: "Plan a route to save it here"
- Map: Empty, ready for planning

### Populated Route Selected
- Dropdown: "Route 1" selected
- Info card: Full route details
- Map: Route displayed

## Migration Note

If you already have routes in the database without empty string support, run this SQL:

```sql
-- Allow empty strings for blank routes
ALTER TABLE flights ALTER COLUMN departure DROP NOT NULL;
ALTER TABLE flights ALTER COLUMN arrival DROP NOT NULL;
ALTER TABLE flights ALTER COLUMN coordinates SET DEFAULT '[]';
ALTER TABLE flights ALTER COLUMN distance_nm SET DEFAULT 0;
ALTER TABLE flights ALTER COLUMN estimated_time_min SET DEFAULT 0;
```
