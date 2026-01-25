# How to Verify Supabase Save Functionality

## Pre-requisites
1. Supabase project created
2. `flights` table created using `supabase-schema.sql`
3. Environment variables set in `.env.local`

## Manual Verification Steps

### 1. Open the App
```bash
npm run dev
```
Navigate to `http://localhost:3000`

### 2. Check Browser Console
Open DevTools Console (F12) - you should see:
```
✅ Loaded 0 routes, creating Route 1...
📝 Next route name: Route 1
✅ Created new blank route: Route 1 ID: abc-123-xyz
```

### 3. Verify Dropdown Shows "Route 1"
- Left panel should show dropdown with "Route 1" selected
- Info card shows: "Plan a route to save it here"

### 4. Plan a Route
1. Click "Plan Route" button in RouteControls
2. Enter departure (e.g., KSQL) and arrival (e.g., KSMF)
3. Click "Calculate Route"

**Expected Console Logs:**
```
💾 Auto-saving route... { selectedId: 'abc-123', departure: 'KSQL', arrival: 'KSMF' }
✅ Updated route: abc-123 with KSQL → KSMF
```

### 5. Verify in Supabase Dashboard
1. Open Supabase Dashboard → Table Editor
2. Select `flights` table
3. You should see one row:
   ```
   id: abc-123-xyz
   name: Route 1
   departure: KSQL
   arrival: KSMF
   distance_nm: 87.3
   waypoints: [...]
   coordinates: [[...], [...]]
   ```

### 6. Test "+ New Route"
1. Click dropdown → Select "+ New Route" (green, at bottom)
2. Map clears

**Expected Console Logs:**
```
🆕 Creating new blank route...
📝 Next route name: Route 2
✅ Created new blank route: Route 2 ID: def-456-xyz
```

**Expected Behavior:**
- Dropdown now shows "Route 2" selected
- Info card shows: "Plan a route to save it here"
- Supabase has 2 rows now

### 7. Plan Second Route
1. Plan a different route (e.g., KOAK → KSAC)

**Expected Console Logs:**
```
💾 Auto-saving route... { selectedId: 'def-456', departure: 'KOAK', arrival: 'KSAC' }
✅ Updated route: def-456 with KOAK → KSAC
```

### 8. Switch Between Routes
1. Click dropdown → Select "Route 1"
2. Map should load KSQL → KSMF route

**Expected Console Logs:**
```
📥 Loading saved flight: Route 1
```

3. Click dropdown → Select "Route 2"
4. Map should load KOAK → KSAC route

### 9. Test Rename
1. With Route 2 selected, click pencil icon (📝)
2. Type "Oakland to Sacramento"
3. Press Enter

**Expected:**
- Dropdown shows "Oakland to Sacramento"
- Supabase row updated with new name

### 10. Test Delete
1. Select Route 2
2. Click trash icon (🗑️) in info card
3. Confirm deletion

**Expected:**
- Route 2 removed from dropdown
- Only Route 1 remains
- Supabase only has 1 row

## Common Issues & Solutions

### Issue: "Missing Supabase environment variables"
**Solution:**
- Check `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Restart dev server after adding env vars

### Issue: Dropdown empty or not working
**Solution:**
- Open browser console for errors
- Check Supabase RLS policies allow read access
- Verify `flights` table exists

### Issue: Routes not saving
**Console shows:** `❌ Failed to update route - updateFlight returned null`

**Solution:**
- Check Supabase RLS policies allow insert/update
- Verify table schema matches (run migration again)
- Check browser network tab for 401/403 errors

### Issue: Blank routes have errors
**Console shows:** `Error: null value in column "departure" violates not-null constraint`

**Solution:**
- Run updated schema that allows empty strings:
```sql
ALTER TABLE flights ALTER COLUMN departure DROP NOT NULL;
ALTER TABLE flights ALTER COLUMN arrival DROP NOT NULL;
```

## Expected Database State After Tests

```
flights table:
┌─────────────┬────────────┬───────────┬─────────┬─────────────┬──────────┐
│ id          │ name       │ departure │ arrival │ distance_nm │ ...      │
├─────────────┼────────────┼───────────┼─────────┼─────────────┼──────────┤
│ abc-123     │ Route 1    │ KSQL      │ KSMF    │ 87.3        │ ...      │
└─────────────┴────────────┴───────────┴─────────┴─────────────┴──────────┘
```

## Console Log Reference

### Successful Flow
```
✅ Loaded 0 routes, creating Route 1...
🆕 Creating new blank route...
📝 Next route name: Route 1
✅ Created new blank route: Route 1 ID: abc-123
💾 Auto-saving route... { selectedId: 'abc-123', departure: 'KSQL', arrival: 'KSMF' }
✅ Updated route: abc-123 with KSQL → KSMF
```

### Error Indicators
```
❌ Failed to create new route - saveFlight returned null
❌ Error creating new route: [error details]
❌ Failed to update route - updateFlight returned null
⚠️ Auto-save called without selected route ID
```

## Verification Checklist

- [ ] Build completes without errors
- [ ] App loads and creates Route 1 automatically
- [ ] Route 1 appears in dropdown
- [ ] Planning a route saves to Supabase
- [ ] "+ New Route" creates Route 2
- [ ] Can switch between routes
- [ ] Rename functionality works
- [ ] Delete functionality works
- [ ] Supabase table reflects all changes
- [ ] Console shows success logs, no errors

## Quick Test Script

```bash
# 1. Start dev server
npm run dev

# 2. Open browser to localhost:3000
# 3. Open DevTools Console (F12)
# 4. Plan a route
# 5. Check Supabase table has the route
# 6. Create "+ New Route"
# 7. Verify Route 2 appears in Supabase
```

Success = All routes persist in Supabase and can be loaded/edited/deleted! ✅
