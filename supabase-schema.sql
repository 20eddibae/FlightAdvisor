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
