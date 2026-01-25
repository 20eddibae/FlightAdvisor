# Flight Selector - Auto-Save Route System

## Overview
The Flight Selector automatically saves all routes to Supabase with zero manual intervention. Routes are auto-named "Route 1", "Route 2", etc., and can be renamed using the pencil icon.

## How It Works

### Auto-Save Behavior
1. **Plan a route** → Automatically saved as "Route N" (next available number)
2. **Modify a selected route** → Automatically updates the existing route
3. **No manual save button** → Everything saves in real-time

### UI Components

#### Dropdown Selector
- **Location**: Top-left panel, below header
- **Options**:
  - ➕ **New Route** (green) - Clears map and starts fresh
  - All existing saved routes with preview info

#### Pencil Icon (Rename)
- **When visible**: Only when a route is selected
- **Click to rename**: Dropdown transforms into input field
- **Actions**:
  - ✅ Check mark - Save new name
  - ❌ X mark - Cancel rename
  - Enter key - Save
  - Escape key - Cancel

#### Route Info Card
- Displays when a route is selected
- Shows: Name, Route (KSQL → KSMF), Distance, Time, Altitude
- Trash icon in top-right to delete route

## User Flow

### Creating a New Route
1. Click dropdown → Select **"➕ New Route"**
2. Map clears
3. Plan your route using map controls
4. Route auto-saves as "Route 1" (or next number)

### Switching Routes
1. Click dropdown → Select any existing route
2. Route loads onto map
3. Weather and reasoning recalculate
4. Map zooms to route bounds

### Renaming a Route
1. Select a route from dropdown
2. Click **pencil icon** (📝) next to dropdown
3. Dropdown becomes text input
4. Type new name
5. Press Enter or click ✅ to save
6. Press Escape or click ❌ to cancel

### Deleting a Route
1. Select a route
2. Click **trash icon** (🗑️) in route info card
3. Confirm deletion
4. Map clears automatically

### Modifying a Route
1. Select an existing route
2. Make changes using map controls
3. Changes auto-save to the same route (no new route created)

## Technical Details

### Auto-Save Logic
```typescript
// Creates signature to detect route changes
const routeSignature = `${departure}-${arrival}-${distance}`

// Only saves if route is genuinely different
if (routeSignature !== lastSavedRoute) {
  autoSaveRoute()
}
```

### Route Naming
- **Pattern**: `Route 1`, `Route 2`, `Route 3`, etc.
- **Auto-increment**: Finds highest existing number and adds 1
- **Custom names**: User can rename to anything (e.g., "Morning Commute")
- **Preserved on rename**: Route number isn't enforced after manual rename

### Database Operations
- **Create**: New route planned → `saveFlight()`
- **Update**: Existing route modified → `updateFlight()`
- **Read**: Dropdown opened → `getAllFlights()`
- **Delete**: Trash clicked → `deleteFlight()`

## Features

✅ **Zero-click saving** - Routes save automatically
✅ **Smart naming** - Auto-increments route numbers
✅ **In-place renaming** - Pencil icon transforms dropdown
✅ **Route switching** - One click to load different routes
✅ **Prevent duplicates** - Updates existing route if already selected
✅ **Visual feedback** - "Saving..." indicator during operations
✅ **Keyboard shortcuts** - Enter/Escape during rename

## UI/UX Design

### Matches Existing Style
- **Card design**: Same as ReasoningPanel, RouteControls
- **Color scheme**: Neutral gray, primary blue accents
- **Typography**: Small bold uppercase labels
- **Icons**: Lucide React (Plane, Pencil, Trash, Plus, Route)
- **Borders**: Subtle slate-200 borders

### Interactive States
- **Idle**: Dropdown + Pencil button
- **Renaming**: Input + Check/Cancel buttons
- **Loading**: "Saving..." indicator
- **Empty**: "New Route" placeholder

## Removed Features

❌ **Manual save button** - Auto-save replaced it
❌ **Save dialog** - No longer needed
❌ **Watch flights** - Removed (separate feature)
❌ **Email-based filtering** - Routes are global for now

## Database Schema

Uses the `flights` table in Supabase:
- `id` - UUID primary key
- `name` - Route name (e.g., "Route 1")
- `departure` - ICAO code (e.g., "KSQL")
- `arrival` - ICAO code (e.g., "KSMF")
- `route_type` - "direct" or "avoiding_airspace"
- `waypoints` - Array of waypoint names
- `coordinates` - JSON array of [lon, lat] pairs
- `distance_nm` - Nautical miles
- `estimated_time_min` - Flight time
- `cruise_altitude` - MSL altitude
- `created_at` - Timestamp
- `updated_at` - Auto-updated timestamp

## Future Enhancements

- **Route categories** (Personal, Work, Training)
- **Color coding** routes
- **Duplicate route** function
- **Export to GPX/KML**
- **Share route** via link
- **Route templates** (common patterns)
- **User authentication** (private routes)
