# FlightAdvisor Setup Guide

Quick start guide for getting FlightAdvisor up and running on your machine.

## Prerequisites

- **Node.js 18+** and npm installed
- A **Mapbox account** (free tier) - https://account.mapbox.com/
- A **Google AI Studio account** (free tier) - https://ai.google.dev/

## Step 1: Get API Keys

### Mapbox Access Token

1. Go to https://account.mapbox.com/
2. Sign up or log in
3. Navigate to "Access Tokens"
4. Copy your **default public token** (starts with `pk.`)
5. Or create a new token with these scopes:
   - `styles:read`
   - `fonts:read`
   - `datasets:read`

### Gemini API Key

1. Go to https://ai.google.dev/
2. Sign in with your Google account
3. Click "Get API Key" in Google AI Studio
4. Create a new API key
5. Copy the key (starts with `AIza`)

## Step 2: Configure Environment

1. Open the `.env.local` file in the project root
2. Replace the placeholder values:

```bash
# Mapbox (client-side safe, starts with "pk.")
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1IjoieW91cnVzZXJuYW1lIiwiYSI6ImNrMTIzNDU2Nzg5MGFiY2RlZmdoaWprbG1ub3BxcnN0In0.abcd1234efgh5678ijkl9012mnop3456

# Gemini (server-side only, starts with "AIza")
GEMINI_API_KEY=AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890
```

3. Save the file

## Step 3: Install and Run

```bash
# Install dependencies (if not already done)
npm install

# Run development server
npm run dev
```

The application will be available at http://localhost:3000

## Step 4: Test the Demo

1. **Wait for map to load** - Should take <3 seconds
2. **Verify markers are visible**:
   - Green marker: KSQL (San Carlos)
   - Red marker: KSMF (Sacramento Executive)
   - Blue markers: Waypoints (SUNOL, PYE, CCR, SAC)
3. **Check airspace layers**:
   - Gray polygons should be visible
   - Hover over them to see details (Class B, restricted zones)
4. **Test route planning**:
   - Click "Plan Route" button
   - Route should appear in <2 seconds
   - Route should avoid the gray SFO Class B airspace
5. **View AI reasoning**:
   - Click "Show Reasoning" button (top right)
   - Reasoning should load in <4 seconds
   - Should see educational explanations of route decisions

## Troubleshooting

### Map doesn't load

- **Check Mapbox token**: Make sure it starts with `pk.` and is set as `NEXT_PUBLIC_MAPBOX_TOKEN`
- **Check browser console**: Look for error messages
- **Verify environment**: Restart dev server after changing `.env.local`

### Reasoning doesn't load

- **Check Gemini API key**: Should start with `AIza`
- **Check API quota**: Free tier has 1,500 requests/day
- **Fallback reasoning**: App will show pre-written reasoning if API fails (this is expected behavior)

### Route calculation fails

- **Check data files**: Make sure all files in `/data` are present
- **Check airspace data**: Verify GeoJSON files are valid
- **Check browser console**: Look for error messages

### Build errors

```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Try building again
npm run build
```

## Production Build

To test the production build locally:

```bash
# Build for production
npm run build

# Run production server
npm start
```

Open http://localhost:3000

## Performance Benchmarks

Expected performance (measured on first load):

- **Map initial load**: <3 seconds
- **Route calculation**: <2 seconds (direct or waypoint routing)
- **A* pathfinding**: <2 seconds (if needed for complex routing)
- **AI reasoning API**: <4 seconds (includes 3.5s timeout)
- **Total demo flow**: <10 seconds (map load + route + reasoning)

## API Limits (Free Tier)

### Mapbox
- **50,000 map loads/month**
- **Unlimited** API requests for geocoding
- More than sufficient for development and demos

### Google Gemini
- **1,500 requests/day** (free tier)
- **10 requests/minute** rate limit
- App includes caching (5 most recent routes)
- Fallback reasoning used if API fails or rate limited

## Demo Script

For a 90-second demo:

1. **[0:00-0:15]** Introduction
   - "FlightAdvisor uses AI to explain flight routing decisions"

2. **[0:15-0:30]** Show the interface
   - Point out airports, waypoints, and airspace zones
   - Hover over gray Class B zone to show details

3. **[0:30-0:50]** Plan the route
   - Click "Plan Route"
   - Watch route calculate and avoid Class B airspace
   - Point out route uses SUNOL waypoint

4. **[0:50-1:15]** Show AI reasoning
   - Click "Show Reasoning"
   - Scroll through explanation
   - Highlight educational tone: "This is like having a flight instructor explain the route"

5. **[1:15-1:30]** Key differentiator
   - "Unlike traditional flight planners that just show routes, FlightAdvisor teaches pilots WHY each decision was made"

## Next Steps

After successful setup:

1. **Test edge cases**:
   - Click "Plan Route" multiple times
   - Test with/without Gemini API key
   - Test "Clear Route" functionality

2. **Explore the code**:
   - `/lib/routing/route.ts` - Routing logic
   - `/lib/routing/aStarGrid.ts` - A* pathfinding
   - `/lib/api/gemini.ts` - AI reasoning
   - `/components/Map/` - Map visualization

3. **Deploy to Vercel** (see DEPLOY.md)

## Support

If you encounter issues:

1. Check this guide's troubleshooting section
2. Review the main README.md
3. Check browser console for errors
4. Verify all environment variables are set correctly

## Common Issues

### "Mapbox token is missing"
- Token not set in `.env.local`
- Token variable name incorrect (must be `NEXT_PUBLIC_MAPBOX_TOKEN`)
- Server not restarted after setting token

### "Failed to load aviation data"
- Data files missing from `/data` directory
- JSON files have syntax errors
- Fetch requests blocked by browser

### "Route calculation timeout"
- A* pathfinding taking too long (>2 seconds)
- Try clearing route and planning again
- Check if airspace data is overly complex

### "Reasoning API timeout"
- Gemini API taking >3.5 seconds
- App will automatically use fallback reasoning
- This is expected behavior and demo will continue working
