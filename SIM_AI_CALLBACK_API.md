# Sim.ai Callback API Documentation

This document explains the callback API endpoints that sim.ai can use to monitor watched flights and send alerts.

## Quick Test

To test the integration, use the provided test script:

```bash
# 1. Create a flight in the app (Watch Flight button)
# 2. Copy the flight ID from browser console
# 3. Run test script:
./test-sim-integration.sh abc-123-def-456
```

The script will:
- ✅ Verify flight exists
- ✅ Fetch baseline weather
- ✅ Check current weather
- ✅ Compare and detect changes
- ✅ Optionally create test alert

## Architecture Flow

```
┌──────────────────────────────────────────────────────────────┐
│                     User Saves Flight                         │
│                           │                                   │
│                           ▼                                   │
│    POST /api/watch-route                                     │
│      ├─→ Saves to Supabase (generates flight_id: UUID)      │
│      └─→ Sends webhook to sim.ai                            │
│                                                               │
│    Webhook Payload:                                          │
│    {                                                         │
│      "flight_id": "abc-123-def-456",  ← STORE THIS!         │
│      "pilot_email": "pilot@example.com",                     │
│      "departure": "KSQL",                                    │
│      "arrival": "KSMF",                                      │
│      "baseline_weather": {...}                               │
│    }                                                         │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                  Sim.ai Periodic Check                        │
│                  (every 30 minutes)                           │
│                                                               │
│  1. Use stored flight_id from webhook:                       │
│     GET /api/flights/abc-123-def-456/check-weather?compare=true
│          ────────────────┬────────────                        │
│                          │                                    │
│                   REQUIRED: Flight ID                         │
│                                                               │
│  2. API returns:                                              │
│     • Baseline weather (when saved)                          │
│     • Current weather (live METAR)                           │
│     • changes[] array with severity                          │
│                                                               │
│  3. If high-severity changes:                                │
│     PATCH /api/flights/abc-123-def-456                       │
│          ────────────────┬────────────                        │
│                          │                                    │
│                   REQUIRED: Flight ID                         │
│                                                               │
│     Body: {                                                  │
│       "has_alert": true,                                     │
│       "alert_message": "Thunderstorms developing..."         │
│     }                                                        │
│                                                               │
│  4. Send email to pilot                                      │
│                                                               │
│  5. User returns to app → sees alert                         │
└──────────────────────────────────────────────────────────────┘
```

## Quick Start: Flight ID Usage

**When a flight is created:**
```json
// Webhook sent to sim.ai
{
  "flight_id": "abc-123-def-456",  // ← SAVE THIS ID
  "departure": "KSQL",
  "arrival": "KSMF",
  ...
}
```

**To check weather for that flight:**
```bash
# Use the flight_id in the URL path
GET /api/flights/abc-123-def-456/check-weather?compare=true
                └──────┬──────┘
                  Flight ID (required)
```

**To update with an alert:**
```bash
# Use the same flight_id
PATCH /api/flights/abc-123-def-456
                   └──────┬──────┘
                     Flight ID (required)
```

## API Endpoints

### 1. Check Weather Changes (Primary Callback)

**Endpoint:** `GET /api/flights/{flight_id}/check-weather`

**Description:** Fetches current weather and compares it with baseline weather saved when flight was created.

**Required Parameters:**
- `{flight_id}` (in URL path): The UUID of the flight to check
  - This is returned when you create a flight via webhook
  - Format: UUID (e.g., `abc123-def456-ghi789`)

**Optional Query Parameters:**
- `compare=true`: Returns a detailed comparison with detected changes and severity levels

**Example Requests:**
```bash
# Basic check (returns baseline + current weather)
curl https://your-app.vercel.app/api/flights/abc-123-def/check-weather

# With comparison (recommended - includes automatic diff)
curl https://your-app.vercel.app/api/flights/abc-123-def/check-weather?compare=true
```

**Error Responses:**
- `400 Bad Request`: Flight ID is missing or invalid
- `404 Not Found`: Flight ID doesn't exist in database
- `410 Gone`: Flight exists but is no longer active
- `500 Internal Server Error`: Server error fetching weather

**Example Response (with compare=true):**
```json
{
  "flight_id": "abc123",
  "departure": "KSQL",
  "arrival": "KSMF",
  "flight_date": "2026-01-26T14:00:00Z",
  "baseline_weather": {
    "stations": [
      {
        "station": "KSQL",
        "metar": {
          "rawOb": "KSQL 251853Z 28008KT 10SM FEW050 15/08 A3012",
          "windSpeed": 8,
          "windDir": 280,
          "visibility": 10,
          "ceiling": null,
          "flightCategory": "VFR"
        }
      }
    ]
  },
  "current_weather": {
    "stations": [
      {
        "station": "KSQL",
        "metar": {
          "rawOb": "KSQL 251953Z 27015G25KT 5SM +TSRA BKN020 14/12 A3008",
          "windSpeed": 15,
          "windGust": 25,
          "windDir": 270,
          "visibility": 5,
          "ceiling": 2000,
          "flightCategory": "IFR"
        }
      }
    ]
  },
  "last_checked": "2026-01-25T19:53:00Z",
  "changes": [
    {
      "station": "KSQL",
      "field": "visibility",
      "baseline_value": "10 SM",
      "current_value": "5 SM",
      "severity": "high",
      "description": "Visibility changed from 10 to 5 statute miles"
    },
    {
      "station": "KSQL",
      "field": "wind",
      "baseline_value": "8kt",
      "current_value": "15kt G25kt",
      "severity": "high",
      "description": "Wind changed from 8kt to 15kt gusting 25kt"
    },
    {
      "station": "KSQL",
      "field": "weather",
      "baseline_value": "No thunderstorms",
      "current_value": "Thunderstorms present",
      "severity": "high",
      "description": "Thunderstorm activity has developed"
    },
    {
      "station": "KSQL",
      "field": "flight_category",
      "baseline_value": "VFR",
      "current_value": "IFR",
      "severity": "high",
      "description": "Flight category changed from VFR to IFR"
    }
  ]
}
```

**What Gets Compared:**
- ✅ **Visibility** (alerts if drops ≥2 SM or below 5 SM)
- ✅ **Ceiling** (alerts if changes ≥1000 ft or below 3000 ft AGL)
- ✅ **Wind** (alerts if speed changes ≥10kt or gusts >25kt)
- ✅ **Weather phenomena** (alerts on new TS, precipitation)
- ✅ **Flight category** (alerts on VFR→MVFR→IFR→LIFR changes)

**Severity Levels:**
- `high`: Immediate safety concern (IFR, thunderstorms, gusts >25kt)
- `medium`: Marginal VFR or moderate changes
- `low`: Minor changes within acceptable limits

---

### 2. Update Flight with Alert (Write Back)

**Endpoint:** `PATCH /api/flights/{flight_id}`

**Description:** Updates a flight record with alert information. Use this after detecting significant weather changes.

**Example Request:**
```bash
curl -X PATCH https://your-app.vercel.app/api/flights/abc123 \
  -H 'Content-Type: application/json' \
  -d '{
    "has_alert": true,
    "alert_message": "Thunderstorm activity (TSRA) now reported at KSQL with gusts to 25kt. Visibility reduced to 5SM. Flight category degraded to IFR. Consider delaying departure or filing IFR.",
    "alert_severity": "high",
    "current_weather": { ...current weather object... }
  }'
```

**Request Body:**
```json
{
  "has_alert": true,
  "alert_message": "Human-readable alert message",
  "alert_severity": "low" | "medium" | "high",
  "current_weather": { /* latest weather data */ }
}
```

**Response:**
```json
{
  "success": true,
  "flight": {
    "id": "abc123",
    "has_alert": true,
    "alert_message": "...",
    "alert_severity": "high",
    "alert_created_at": "2026-01-25T19:53:00Z",
    ...
  }
}
```

---

### 3. Get Flight Details

**Endpoint:** `GET /api/flights/{flight_id}`

**Description:** Retrieves full flight details including baseline weather and any existing alerts.

**Example Request:**
```bash
curl https://your-app.vercel.app/api/flights/abc123
```

**Response:**
```json
{
  "flight": {
    "id": "abc123",
    "pilot_email": "pilot@example.com",
    "pilot_name": "John Doe",
    "departure": "KSQL",
    "arrival": "KSMF",
    "flight_date": "2026-01-26T14:00:00Z",
    "route_data": { /* route geometry, waypoints */ },
    "baseline_weather": { /* weather at save time */ },
    "current_weather": { /* latest weather */ },
    "has_alert": false,
    "alert_message": null,
    "alert_severity": null,
    "is_active": true,
    "created_at": "2026-01-25T18:00:00Z",
    "last_weather_check": "2026-01-25T19:53:00Z"
  }
}
```

---

## Sim.ai Workflow Configuration

### Recommended Workflow (Every 30 Minutes)

**Step 1: Fetch Active Flights from Supabase**
```javascript
// Supabase REST API
GET https://mbbkzftkrsksjlpknfvo.supabase.co/rest/v1/watched_flights
  ?is_active=eq.true
  &flight_date=gte.now()
  &select=*

Headers:
  apikey: {SUPABASE_ANON_KEY}
  Authorization: Bearer {SUPABASE_ANON_KEY}
```

**Step 2: For Each Flight, Check Weather Changes**
```javascript
GET https://your-app.vercel.app/api/flights/{flight.id}/check-weather?compare=true
```

**Step 3: Analyze Changes**

Use the `changes` array from the response. If any changes have `severity: "high"` or `severity: "medium"`:

```javascript
const hasSignificantChanges = response.changes.some(
  change => change.severity === 'high' || change.severity === 'medium'
)
```

**Step 4: Create Alert Message**

Example with AI agent:
```
You are an aviation weather analyst. Based on these weather changes, create a concise alert message for a pilot:

Changes detected:
${JSON.stringify(response.changes, null, 2)}

Flight details:
- Route: ${response.departure} → ${response.arrival}
- Scheduled: ${response.flight_date}

Generate a pilot-friendly alert message (2-3 sentences) explaining:
1. What changed
2. Flight safety impact
3. Recommended action (delay, file IFR, etc.)
```

**Step 5: Update Flight with Alert**
```javascript
PATCH https://your-app.vercel.app/api/flights/{flight.id}
Body: {
  has_alert: true,
  alert_message: "Generated alert message",
  alert_severity: "high",
  current_weather: response.current_weather
}
```

**Step 6: Send Email to Pilot**
```
To: ${flight.pilot_email}
Subject: ⚠️ Weather Alert: ${flight.departure} → ${flight.arrival}

Hi ${flight.pilot_name},

Weather conditions have changed for your upcoming flight:

Route: ${flight.departure} → ${flight.arrival}
Scheduled: ${flight.flight_date}

Alert: ${alert_message}

Severity: ${alert_severity}

View your flight: https://your-app.vercel.app/flights/${flight.id}

Review current conditions and consider regenerating your flight plan.

Safe skies,
FlightAdvisor
```

---

## Testing the Integration

### 1. Create a Test Flight
```bash
# Plan a route in the app and click "Watch Flight"
# This will create a flight and send webhook to sim.ai
```

### 2. Manually Check Weather Changes
```bash
curl "https://your-app.vercel.app/api/flights/YOUR_FLIGHT_ID/check-weather?compare=true"
```

### 3. Simulate an Alert
```bash
curl -X PATCH "https://your-app.vercel.app/api/flights/YOUR_FLIGHT_ID" \
  -H 'Content-Type: application/json' \
  -d '{
    "has_alert": true,
    "alert_message": "Test alert: Thunderstorms developing along route",
    "alert_severity": "high"
  }'
```

### 4. Verify in App
Refresh the FlightAdvisor app - you should see an alert banner for the flight.

---

## Environment Variables

**In sim.ai workflow, you'll need:**
```env
FLIGHTADVISOR_APP_URL=https://your-app.vercel.app
SUPABASE_URL=https://mbbkzftkrsksjlpknfvo.supabase.co
SUPABASE_ANON_KEY=sb_publishable_nya1KNlaDpWOKkRlCtRiYg_hvh4xkjW
```

---

## Rate Limiting Considerations

- **Check weather endpoint:** Safe to call every 30 minutes per flight
- **METAR updates:** Typically updated hourly, more frequently in changing conditions
- **Recommended:** Check active flights every 30 minutes, or 1 hour for stable conditions

---

## Error Handling

All endpoints return standard HTTP status codes:

- `200 OK`: Success
- `400 Bad Request`: Invalid parameters
- `404 Not Found`: Flight not found
- `500 Internal Server Error`: Server error

**Example Error Response:**
```json
{
  "error": "Flight not found"
}
```

---

## Data Retention

- Flights remain active until:
  - `flight_date` has passed
  - User deletes the flight
  - `is_active` is set to false

- Recommended: Auto-deactivate flights 24 hours after scheduled departure time

---

## Security Notes

- All endpoints use Supabase service role key for authentication
- No user authentication required for callback endpoints
- Flight IDs are UUIDs (hard to guess)
- Consider adding API key authentication if needed for production

---

## Support

For issues or questions about the API, check:
- GitHub: https://github.com/your-repo/flightadvisor/issues
- Email: support@flightadvisor.app
