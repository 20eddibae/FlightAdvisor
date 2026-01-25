#!/bin/bash

# Test script for sim.ai integration
# This demonstrates the complete flow of checking weather for a flight

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   FlightAdvisor Sim.ai Integration Test${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Configuration
APP_URL="${APP_URL:-http://localhost:3000}"
FLIGHT_ID="${1}"

if [ -z "$FLIGHT_ID" ]; then
  echo -e "${RED}❌ Error: Flight ID is required${NC}"
  echo ""
  echo "Usage:"
  echo "  $0 <flight_id>"
  echo ""
  echo "Example:"
  echo "  $0 abc-123-def-456"
  echo ""
  echo "To get a flight ID:"
  echo "  1. Open FlightAdvisor app"
  echo "  2. Plan a route (e.g., KSQL → KSMF)"
  echo "  3. Click 'Watch Flight' button"
  echo "  4. Enter email and date, click 'Enable Alerts'"
  echo "  5. Check browser console for flight_id"
  echo ""
  exit 1
fi

echo -e "${YELLOW}Configuration:${NC}"
echo "  App URL: $APP_URL"
echo "  Flight ID: $FLIGHT_ID"
echo ""

# Test 1: Get Flight Details
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Test 1: Get Flight Details${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Endpoint: GET /api/flights/$FLIGHT_ID"
echo ""

FLIGHT_RESPONSE=$(curl -s "$APP_URL/api/flights/$FLIGHT_ID")
FLIGHT_ERROR=$(echo "$FLIGHT_RESPONSE" | jq -r '.error // empty')

if [ -n "$FLIGHT_ERROR" ]; then
  echo -e "${RED}❌ Error: $FLIGHT_ERROR${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Flight found${NC}"
DEPARTURE=$(echo "$FLIGHT_RESPONSE" | jq -r '.flight.departure')
ARRIVAL=$(echo "$FLIGHT_RESPONSE" | jq -r '.flight.arrival')
PILOT_EMAIL=$(echo "$FLIGHT_RESPONSE" | jq -r '.flight.pilot_email')
echo "  Route: $DEPARTURE → $ARRIVAL"
echo "  Pilot: $PILOT_EMAIL"
echo ""

# Test 2: Check Weather (without comparison)
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Test 2: Check Weather (Basic)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Endpoint: GET /api/flights/$FLIGHT_ID/check-weather"
echo ""

WEATHER_BASIC=$(curl -s "$APP_URL/api/flights/$FLIGHT_ID/check-weather")
WEATHER_ERROR=$(echo "$WEATHER_BASIC" | jq -r '.error // empty')

if [ -n "$WEATHER_ERROR" ]; then
  echo -e "${RED}❌ Error: $WEATHER_ERROR${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Weather fetched${NC}"
BASELINE_COUNT=$(echo "$WEATHER_BASIC" | jq '.baseline_weather.stations | length')
CURRENT_COUNT=$(echo "$WEATHER_BASIC" | jq '.current_weather.stations | length')
echo "  Baseline weather: $BASELINE_COUNT station(s)"
echo "  Current weather: $CURRENT_COUNT station(s)"
echo ""

# Test 3: Check Weather with Comparison
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Test 3: Check Weather with Comparison${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Endpoint: GET /api/flights/$FLIGHT_ID/check-weather?compare=true"
echo ""

WEATHER_COMPARE=$(curl -s "$APP_URL/api/flights/$FLIGHT_ID/check-weather?compare=true")
COMPARE_ERROR=$(echo "$WEATHER_COMPARE" | jq -r '.error // empty')

if [ -n "$COMPARE_ERROR" ]; then
  echo -e "${RED}❌ Error: $COMPARE_ERROR${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Comparison completed${NC}"
CHANGES_COUNT=$(echo "$WEATHER_COMPARE" | jq '.changes | length')
echo "  Changes detected: $CHANGES_COUNT"
echo ""

if [ "$CHANGES_COUNT" -gt 0 ]; then
  echo "  Changes:"
  echo "$WEATHER_COMPARE" | jq -r '.changes[] | "    • [\(.severity | ascii_upcase)] \(.station) - \(.description)"'
  echo ""

  # Check if any high-severity changes
  HIGH_SEVERITY=$(echo "$WEATHER_COMPARE" | jq '[.changes[] | select(.severity == "high")] | length')

  if [ "$HIGH_SEVERITY" -gt 0 ]; then
    echo -e "${RED}  ⚠️ High-severity changes detected! Alert recommended.${NC}"
  fi
else
  echo -e "${GREEN}  ✓ No significant weather changes detected${NC}"
fi
echo ""

# Test 4: Update Flight with Alert (optional - only if changes detected)
if [ "$CHANGES_COUNT" -gt 0 ]; then
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}Test 4: Update Flight with Alert${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "Endpoint: PATCH /api/flights/$FLIGHT_ID"
  echo ""

  read -p "Do you want to create a test alert? (y/N) " -n 1 -r
  echo ""

  if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Create alert message from changes
    ALERT_MSG=$(echo "$WEATHER_COMPARE" | jq -r '[.changes[] | .description] | join(". ") + "."')
    SEVERITY="medium"

    if [ "$HIGH_SEVERITY" -gt 0 ]; then
      SEVERITY="high"
    fi

    ALERT_PAYLOAD=$(cat <<EOF
{
  "has_alert": true,
  "alert_message": "Weather changes detected: $ALERT_MSG",
  "alert_severity": "$SEVERITY"
}
EOF
)

    UPDATE_RESPONSE=$(curl -s -X PATCH "$APP_URL/api/flights/$FLIGHT_ID" \
      -H "Content-Type: application/json" \
      -d "$ALERT_PAYLOAD")

    UPDATE_ERROR=$(echo "$UPDATE_RESPONSE" | jq -r '.error // empty')

    if [ -n "$UPDATE_ERROR" ]; then
      echo -e "${RED}❌ Error: $UPDATE_ERROR${NC}"
    else
      echo -e "${GREEN}✓ Alert created successfully${NC}"
      echo "  Severity: $SEVERITY"
      echo "  Message: $ALERT_MSG"
      echo ""
      echo -e "${GREEN}  → Check the app - you should see an alert banner!${NC}"
    fi
  else
    echo "Skipped."
  fi
  echo ""
fi

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ All tests completed successfully!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Summary:"
echo "  Flight ID: $FLIGHT_ID"
echo "  Route: $DEPARTURE → $ARRIVAL"
echo "  Weather changes: $CHANGES_COUNT"
echo ""
echo "Next steps for sim.ai integration:"
echo "  1. Store flight_id from webhook"
echo "  2. Poll /check-weather?compare=true every 30 min"
echo "  3. If changes.length > 0 and severity=high:"
echo "     → Send PATCH request with alert"
echo "     → Send email to pilot"
echo ""
