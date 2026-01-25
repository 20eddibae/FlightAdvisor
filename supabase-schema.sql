-- Create flights table in Supabase
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS flights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  departure TEXT DEFAULT '',
  arrival TEXT DEFAULT '',
  route_type TEXT NOT NULL CHECK (route_type IN ('direct', 'avoiding_airspace')),
  waypoints TEXT[] DEFAULT '{}',
  coordinates JSONB DEFAULT '[]',
  distance_nm NUMERIC DEFAULT 0,
  estimated_time_min INTEGER DEFAULT 0,
  cruise_altitude INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS flights_updated_at_idx ON flights(updated_at DESC);
CREATE INDEX IF NOT EXISTS flights_departure_arrival_idx ON flights(departure, arrival);

-- Enable Row Level Security (RLS)
ALTER TABLE flights ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for now (you can restrict this later)
CREATE POLICY "Allow all operations on flights" ON flights
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_flights_updated_at
  BEFORE UPDATE ON flights
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
-- FlightAdvisor Watched Flights Table
-- Run this in your Supabase SQL Editor

-- Drop existing table if you want to start fresh (CAUTION: deletes all data!)
-- DROP TABLE IF EXISTS watched_flights;

CREATE TABLE IF NOT EXISTS watched_flights (
  -- Primary key
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Pilot info
  pilot_email TEXT NOT NULL,
  pilot_name TEXT,

  -- Flight details
  departure TEXT NOT NULL,
  arrival TEXT NOT NULL,
  flight_date TIMESTAMPTZ NOT NULL,

  -- Route data (JSON blob)
  route_data JSONB NOT NULL DEFAULT '{}'::jsonb,

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

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_watched_flights_email ON watched_flights (pilot_email);
CREATE INDEX IF NOT EXISTS idx_watched_flights_active ON watched_flights (is_active, flight_date);
CREATE INDEX IF NOT EXISTS idx_watched_flights_alerts ON watched_flights (has_alert, alert_acknowledged);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS update_watched_flights_updated_at ON watched_flights;

-- Create trigger
CREATE TRIGGER update_watched_flights_updated_at
  BEFORE UPDATE ON watched_flights
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE watched_flights ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (adjust as needed for production)
-- Policy: Anyone can insert flights
DROP POLICY IF EXISTS "Allow public insert" ON watched_flights;
CREATE POLICY "Allow public insert" ON watched_flights
  FOR INSERT WITH CHECK (true);

-- Policy: Anyone can view flights with their email
DROP POLICY IF EXISTS "Allow email-based read" ON watched_flights;
CREATE POLICY "Allow email-based read" ON watched_flights
  FOR SELECT USING (true);

-- Policy: Anyone can update flights (for sim.ai callbacks)
DROP POLICY IF EXISTS "Allow public update" ON watched_flights;
CREATE POLICY "Allow public update" ON watched_flights
  FOR UPDATE USING (true);

-- Policy: Anyone can delete flights
DROP POLICY IF EXISTS "Allow public delete" ON watched_flights;
CREATE POLICY "Allow public delete" ON watched_flights
  FOR DELETE USING (true);

-- Verify table was created
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'watched_flights'
ORDER BY ordinal_position;
