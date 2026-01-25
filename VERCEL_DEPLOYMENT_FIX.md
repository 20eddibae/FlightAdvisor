# Vercel Deployment Fix - Client-Side Exception

## Problem
"Application error: a client-side exception has occurred" on `skyris.vercel.app`

## Root Cause
Missing environment variables in Vercel dashboard. The app requires these to be set in Vercel's environment variables, not just in `.env.local`.

## Solution: Set Environment Variables in Vercel

### Steps:
1. Go to: https://vercel.com/eddie-baes-projects/skyris/settings/environment-variables
2. Add each variable below
3. Select **all environments** (Production, Preview, Development)
4. Click **Save**
5. **Redeploy** the application

### Required Environment Variables:

#### Client-Side (NEXT_PUBLIC_*)
```
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1IjoicmF5ZWVldiIsImEiOiJjbWt0OGJyNTcxcTVtM2ZvZjlpOGphY2FuIn0.vXmxv0K3EXv6GYL8r97j_w
NEXT_PUBLIC_SUPABASE_URL=https://mbbkzftkrsksjlpknfvo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_nya1KNlaDpWOKkRlCtRiYg_hvh4xkjW
```

#### Server-Side (No NEXT_PUBLIC_ prefix)
```
OPEN_AIP_API_KEY=f4b375fe81de1e578c19a57febb0004d
GEMINI_API_KEY=AIzaSyBRKesTEPBgKTKY3H_lA4ItUQ0MTshYaBQ
```

### After Setting Variables:
1. Go to: https://vercel.com/eddie-baes-projects/skyris/deployments
2. Click the **three dots** (⋯) on the latest deployment
3. Click **Redeploy**
4. Wait for deployment to complete
5. Test: https://skyris.vercel.app

## What Was Fixed in Code

1. ✅ **Supabase graceful degradation** - App won't crash if Supabase env vars are missing
2. ✅ **Null checks** - All Supabase functions handle missing client gracefully
3. ✅ **Error handling** - API routes return proper errors instead of crashing

## Verification

After redeploying, check:
- ✅ App loads without "Application error"
- ✅ Map displays (requires `NEXT_PUBLIC_MAPBOX_TOKEN`)
- ✅ Airports load (requires `OPEN_AIP_API_KEY`)
- ✅ Route planning works (requires `GEMINI_API_KEY`)
- ⚠️ Flight saving disabled if Supabase vars missing (graceful degradation)

## Common Issues

### "Still getting error after setting vars"
- **Solution**: Make sure you selected "Production" environment when adding vars
- **Solution**: Redeploy after adding vars (they don't apply to existing deployments)

### "Map loads but no airports"
- **Check**: `OPEN_AIP_API_KEY` is set correctly
- **Check**: Browser console for API errors

### "Route planning doesn't work"
- **Check**: `GEMINI_API_KEY` is set correctly
- **Check**: Browser console for API errors
