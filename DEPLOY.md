# Deployment Guide - FlightAdvisor

Step-by-step guide for deploying FlightAdvisor to Vercel.

## Prerequisites

- Completed setup (see SETUP_GUIDE.md)
- Verified app works locally
- Mapbox and Gemini API keys ready
- GitHub account (optional, for automatic deployments)

## Option 1: Deploy with Vercel CLI (Recommended)

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 2: Login to Vercel

```bash
vercel login
```

Follow the prompts to authenticate.

### Step 3: Deploy

From the project root directory:

```bash
# Deploy to production
vercel --prod
```

The CLI will:
1. Ask you to set up the project (choose defaults)
2. Build the application
3. Deploy to Vercel
4. Give you a deployment URL

### Step 4: Configure Environment Variables

After deployment, set the environment variables in Vercel dashboard:

1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to "Settings" → "Environment Variables"
4. Add these variables:

**Variable 1:**
- Name: `NEXT_PUBLIC_MAPBOX_TOKEN`
- Value: Your Mapbox token (starts with `pk.`)
- Environments: Production, Preview, Development

**Variable 2:**
- Name: `GEMINI_API_KEY`
- Value: Your Gemini API key (starts with `AIza`)
- Environments: Production, Preview, Development

5. Click "Save"
6. Go to "Deployments" tab
7. Click the three dots on the latest deployment → "Redeploy"

### Step 5: Verify Deployment

Visit your deployment URL (e.g., `https://flightadvisor-abc123.vercel.app`)

Test:
- Map loads correctly
- Airports and waypoints visible
- Airspace layers display
- "Plan Route" works
- AI reasoning generates

## Option 2: Deploy with GitHub Integration

### Step 1: Push to GitHub

```bash
# Initialize git repository (if not already done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial FlightAdvisor implementation"

# Create repository on GitHub and push
git remote add origin https://github.com/your-username/flightadvisor.git
git branch -M main
git push -u origin main
```

### Step 2: Import to Vercel

1. Go to https://vercel.com/new
2. Click "Import Git Repository"
3. Select your GitHub repository
4. Configure project:
   - **Framework Preset**: Next.js
   - **Root Directory**: ./
   - **Build Command**: `npm run build`
   - **Output Directory**: Leave default

5. Add environment variables (same as Option 1, Step 4)
6. Click "Deploy"

### Step 3: Automatic Deployments

Now every push to `main` branch will automatically deploy to production!

## Custom Domain (Optional)

### Step 1: Add Domain in Vercel

1. Go to project settings
2. Click "Domains"
3. Enter your domain (e.g., `flightadvisor.yourdomain.com`)
4. Click "Add"

### Step 2: Configure DNS

Vercel will show you DNS records to add. Add these to your domain provider:

**For subdomain:**
```
Type: CNAME
Name: flightadvisor
Value: cname.vercel-dns.com
```

**For apex domain:**
```
Type: A
Name: @
Value: 76.76.21.21
```

Wait for DNS propagation (can take up to 48 hours, usually <1 hour).

## Deployment Checklist

Before deploying:

- [ ] App builds successfully: `npm run build`
- [ ] No TypeScript errors: `npm run type-check`
- [ ] No console errors in browser
- [ ] Map loads and displays correctly
- [ ] Route planning works
- [ ] AI reasoning generates (or uses fallback)
- [ ] All data files are in `/public/data` or `/data`
- [ ] `.env.local` is in `.gitignore` (never commit API keys!)
- [ ] README.md is up to date

After deploying:

- [ ] Deployment URL accessible
- [ ] Map loads within 3 seconds
- [ ] All markers visible
- [ ] Airspace layers render
- [ ] Route planning works (<2 seconds)
- [ ] AI reasoning loads (<4 seconds)
- [ ] No errors in browser console
- [ ] Test on mobile (if needed)

## Vercel Configuration

### next.config.js

Current configuration (already set up):

```javascript
module.exports = {
  turbopack: {},
};
```

### Deployment Settings

Recommended settings in Vercel dashboard:

- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`
- **Development Command**: `npm run dev`
- **Node.js Version**: 18.x (automatic)

## Monitoring

### Vercel Analytics (Optional)

Enable Vercel Analytics for free:

1. Go to project settings
2. Click "Analytics"
3. Enable "Web Analytics"

Tracks:
- Page views
- Performance (Web Vitals)
- User geography

### Function Logs

View API logs:

1. Go to project dashboard
2. Click "Logs" tab
3. Filter by `/api/reasoning` to see AI API calls

## Performance Optimization

### Edge Functions

The `/api/reasoning` route runs as a serverless function. Current configuration is optimal for the demo.

### Caching

Currently using in-memory caching for 5 most recent routes. This resets on function cold starts but is sufficient for demo purposes.

For production, consider:
- Redis caching (Vercel KV)
- Longer cache TTL
- CDN caching for static assets

### Build Optimization

Already optimized:
- Tree-shaking enabled
- Code splitting automatic
- Image optimization (if using Next.js Image)
- CSS minification

## Troubleshooting

### Build fails on Vercel

**Check build logs:**
1. Go to "Deployments"
2. Click failed deployment
3. Check "Building" section for errors

**Common issues:**
- Missing dependencies in `package.json`
- TypeScript errors
- Environment variables not set
- Data files not accessible

### Map doesn't load on deployed site

**Check:**
1. `NEXT_PUBLIC_MAPBOX_TOKEN` is set in Vercel
2. Token has correct prefix: `pk.`
3. Token is valid (not expired)
4. Check browser console for errors

### API reasoning fails

**Check:**
1. `GEMINI_API_KEY` is set (without `NEXT_PUBLIC_` prefix)
2. Key is valid
3. Not hitting rate limits (1,500/day)
4. Fallback reasoning should still work

### Data files not found (404)

Ensure data files are in correct location:
- `/data/airports.json`
- `/data/waypoints.json`
- `/data/airspace/*.geojson`

Next.js should automatically serve these from the root.

## Rollback Deployment

If something goes wrong:

1. Go to "Deployments"
2. Find previous working deployment
3. Click three dots → "Promote to Production"

## Update Deployment

After making changes:

```bash
# Option 1: Automatic (with GitHub integration)
git add .
git commit -m "Update description"
git push

# Option 2: Manual (with Vercel CLI)
vercel --prod
```

## Cost Estimate

**Free Tier Limits:**
- 100 GB bandwidth/month
- Unlimited API requests
- 100 GB-hrs serverless function execution
- 6,000 build minutes/year

**For this demo:** Well within free tier limits.

**Scaling:** If you exceed limits, Vercel Pro is $20/month with significantly higher limits.

## Security Checklist

- [ ] `.env.local` not committed to git
- [ ] API keys stored in Vercel environment variables only
- [ ] `GEMINI_API_KEY` does NOT have `NEXT_PUBLIC_` prefix
- [ ] No sensitive data in client-side code
- [ ] HTTPS enabled (automatic on Vercel)

## Post-Deployment

### Share Your Demo

Your deployed URL: `https://your-project.vercel.app`

Share with:
- Demo viewers
- Teammates
- Portfolio

### Monitor Performance

Check Vercel dashboard for:
- Response times
- Function invocations
- Bandwidth usage
- Error rate

### Iterate

Make improvements:
1. Update code locally
2. Test with `npm run dev`
3. Build with `npm run build`
4. Deploy with `vercel --prod` or `git push`

## Support

**Vercel Documentation:** https://vercel.com/docs
**Vercel Status:** https://www.vercel-status.com/
**Community:** https://github.com/vercel/vercel/discussions
