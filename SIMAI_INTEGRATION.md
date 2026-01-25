# Sim.ai Weather Monitoring Integration

## Overview

This integration allows pilots to "watch" their planned routes. When weather conditions change significantly (e.g., thunderstorm enters the route), sim.ai automatically:
1. Emails the pilot
2. Updates the flight record in Supabase with an alert
3. Shows the alert when the pilot returns to the site

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FLIGHTADVISOR APP                        │
│                                                              │
│   User plans route → Weather/Route data generated            │
│                           │                                  │
│                           ▼                                  │
│   User clicks "Watch Flight" → Saves to Supabase            │
│                                                              │
│   User returns to site → Sees alerts if weather changed      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ (separate system)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     SIM.AI WORKFLOW                          │
│                     (runs every 30 min)                      │
│                                                              │
│   1. Fetch active flights from Supabase                      │
│   2. For each flight:                                        │
│      - Call /api/weather for current conditions              │
│      - AI agent compares baseline vs current                 │
│      - If significant change → email pilot + update DB       │
└─────────────────────────────────────────────────────────────┘
```

## Supabase Schema

Run this SQL in your Supabase SQL Editor:

```sql
-- Drop existing table if you want to start fresh
-- DROP TABLE IF EXISTS watched_flights;

CREATE TABLE watched_flights (
  -- Primary key
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Pilot info
  pilot_email TEXT NOT NULL,
  pilot_name TEXT,

  -- Flight details
  departure TEXT NOT NULL,
  arrival TEXT NOT NULL,
  flight_date TIMESTAMPTZ NOT NULL,

  -- Route data (JSON blob from teammates' code)
  route_data JSONB NOT NULL,

  -- Weather snapshot when flight was saved
  baseline_weather JSONB,

  -- Alert system
  has_alert BOOLEAN DEFAULT FALSE,
  alert_message TEXT,
  alert_severity TEXT CHECK (alert_severity IN ('low', 'medium', 'high')),
  alert_created_at TIMESTAMPTZ,
  alert_acknowledged BOOLEAN DEFAULT FALSE,

  -- Current weather (updated by sim.ai)
  current_weather JSONB,
  last_weather_check TIMESTAMPTZ,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX idx_watched_flights_email ON watched_flights (pilot_email);
CREATE INDEX idx_watched_flights_active ON watched_flights (is_active, flight_date);
CREATE INDEX idx_watched_flights_alerts ON watched_flights (has_alert, alert_acknowledged);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_watched_flights_updated_at
  BEFORE UPDATE ON watched_flights
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (optional but recommended)
ALTER TABLE watched_flights ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own flights (if you add auth later)
-- CREATE POLICY "Users can view own flights" ON watched_flights
--   FOR SELECT USING (auth.email() = pilot_email);
```

## Environment Variables

Add to `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# For sim.ai to call your API
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

## API Endpoints

### POST /api/watch-route
Save a flight to watch.

**Request:**
```json
{
  "pilot_email": "pilot@example.com",
  "pilot_name": "John Doe",
  "departure": "KSQL",
  "arrival": "KSMF",
  "flight_date": "2026-01-26T14:00:00Z",
  "route_data": { ... },
  "baseline_weather": { ... }
}
```

### GET /api/flights?email=pilot@example.com
Get all flights for a pilot.

### GET /api/flights/[id]
Get a specific flight.

### PATCH /api/flights/[id]
Update a flight (used by sim.ai to add alerts).

**Request:**
```json
{
  "has_alert": true,
  "alert_message": "Thunderstorm activity now present along route",
  "alert_severity": "high",
  "current_weather": { ... }
}
```

### PATCH /api/flights/[id]/acknowledge
Mark alert as acknowledged.

## Sim.ai Workflow Configuration

### Workflow: "Flight Weather Monitor"

**Trigger:** Schedule (every 30 minutes)

**Block 1: Fetch Active Flights**
- Type: API
- Method: GET
- URL: `{SUPABASE_URL}/rest/v1/watched_flights?is_active=eq.true&flight_date=gte.now()&select=*`
- Headers:
  - `apikey`: `{SUPABASE_ANON_KEY}`
  - `Authorization`: `Bearer {SUPABASE_ANON_KEY}`

**Block 2: Loop Through Flights**
- Type: Loop
- Input: `{{block1.response}}`

**Block 3: Fetch Current Weather (inside loop)**
- Type: API
- Method: GET
- URL: `{APP_URL}/api/weather?ids={{item.departure}},{{item.arrival}}`

**Block 4: Compare Weather (inside loop)**
- Type: Agent
- Model: Claude 3.5 Sonnet (or GPT-4)
- Prompt:
```
You are an aviation weather analyst monitoring a VFR flight route.

FLIGHT DETAILS:
- Route: {{item.departure}} → {{item.arrival}}
- Scheduled: {{item.flight_date}}

BASELINE WEATHER (when pilot saved the flight):
{{item.baseline_weather}}

CURRENT WEATHER:
{{block3.response}}

Analyze if there are SIGNIFICANT changes that would affect flight safety:
- VFR to IFR/MVFR conditions
- Visibility dropped below 5 statute miles
- Ceiling dropped below 3000 feet AGL
- New thunderstorm/convective activity (TS, CB)
- Wind gusts exceeding 25 knots
- New icing conditions
- New turbulence reports

Respond with ONLY this JSON (no other text):
{
  "alert_needed": true or false,
  "severity": "low" or "medium" or "high",
  "message": "Brief pilot-friendly explanation of what changed"
}
```

**Block 5: Condition (inside loop)**
- Type: Condition
- Condition: `{{block4.response.alert_needed}} == true`

**Block 6: Update Supabase (if alert needed)**
- Type: API
- Method: PATCH
- URL: `{SUPABASE_URL}/rest/v1/watched_flights?id=eq.{{item.id}}`
- Headers:
  - `apikey`: `{SUPABASE_SERVICE_KEY}`
  - `Authorization`: `Bearer {SUPABASE_SERVICE_KEY}`
  - `Content-Type`: `application/json`
  - `Prefer`: `return=minimal`
- Body:
```json
{
  "has_alert": true,
  "alert_message": "{{block4.response.message}}",
  "alert_severity": "{{block4.response.severity}}",
  "alert_created_at": "{{now}}",
  "current_weather": {{block3.response}},
  "last_weather_check": "{{now}}"
}
```

**Block 7: Send Email (if alert needed)**
- Type: Email (or Slack/webhook)
- To: `{{item.pilot_email}}`
- Subject: `Weather Alert: {{item.departure}} → {{item.arrival}}`
- Body:
```
Hi {{item.pilot_name}},

Weather conditions have changed for your upcoming flight:

Route: {{item.departure}} → {{item.arrival}}
Scheduled: {{item.flight_date}}

⚠️ {{block4.response.message}}

Severity: {{block4.response.severity}}

Please review current conditions and consider regenerating your flight plan.

View your flight: {APP_URL}/flights/{{item.id}}

Safe skies,
FlightAdvisor
```

## Data Flow Example

### 1. User Saves Flight

```javascript
// When user clicks "Watch Flight"
const flightData = {
  pilot_email: "pilot@example.com",
  departure: "KSQL",
  arrival: "KSMF",
  flight_date: "2026-01-26T14:00:00Z",
  route_data: {
    coordinates: [...],
    waypoints: ["SUNOL", "PYE", "SAC"],
    distance_nm: 87.3,
    estimated_time_min: 52
  },
  baseline_weather: {
    stations: [
      { station: "KSQL", metar: {...}, taf: {...} },
      { station: "KSMF", metar: {...}, taf: {...} }
    ]
  }
}
```

### 2. Sim.ai Detects Change

30 minutes later, sim.ai checks and finds thunderstorms:

```javascript
// Current weather shows TS (thunderstorm)
{
  stations: [
    {
      station: "KSQL",
      metar: { rawOb: "KSQL 261850Z 27015G25KT 5SM +TSRA..." }
    }
  ]
}
```

### 3. Alert Created

Sim.ai updates Supabase:

```javascript
{
  has_alert: true,
  alert_message: "Thunderstorm activity (TSRA) now reported at KSQL with gusts to 25kt. Visibility reduced to 5SM. Consider delaying departure.",
  alert_severity: "high",
  current_weather: {...}
}
```

### 4. User Returns to Site

When pilot opens FlightAdvisor, they see alert banner and can regenerate their plan.

## Testing Locally

1. Create the Supabase table (run SQL above)
2. Add environment variables
3. Plan a route in the app
4. Click "Watch Flight" and enter email
5. Manually test by calling PATCH endpoint to simulate alert:

```bash
curl -X PATCH \
  'https://your-project.supabase.co/rest/v1/watched_flights?id=eq.YOUR_FLIGHT_ID' \
  -H 'apikey: YOUR_ANON_KEY' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "has_alert": true,
    "alert_message": "Test alert: Weather has changed",
    "alert_severity": "medium"
  }'
```

6. Refresh the app - you should see the alert
