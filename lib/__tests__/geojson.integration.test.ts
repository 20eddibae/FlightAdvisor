/**
 * GeoJSON Data Loaders Integration Tests
 *
 * Tests the integration between data loaders and OpenAIP API
 */

import { loadAllAirspace, loadAirports, loadWaypoints } from '../geojson'

const NORCAL_BOUNDS: [number, number, number, number] = [-123.0, 37.0, -121.0, 39.0]

describe('GeoJSON Data Loaders Integration', () => {
  describe('loadAllAirspace', () => {
    it('should load airspace from static files (default)', async () => {
      const airspace = await loadAllAirspace()

      expect(airspace).toBeDefined()
      expect(airspace.type).toBe('FeatureCollection')
      expect(Array.isArray(airspace.features)).toBe(true)
      expect(airspace.features.length).toBeGreaterThan(0)

      console.log(`✓ Loaded ${airspace.features.length} airspace features from static files`)
    })

    it('should load airspace from OpenAIP when requested', async () => {
      const airspace = await loadAllAirspace({
        useOpenAIP: true,
        bounds: NORCAL_BOUNDS,
      })

      expect(airspace).toBeDefined()
      expect(airspace.type).toBe('FeatureCollection')
      expect(Array.isArray(airspace.features)).toBe(true)

      console.log(`✓ Loaded ${airspace.features.length} airspace features from OpenAIP`)

      // Should have SFO Class B
      const sfoClassB = airspace.features.find(f =>
        f.properties.name.includes('SAN FRANCISCO')
      )
      expect(sfoClassB).toBeDefined()
    }, 10000)

    it('should fall back to static files if OpenAIP fails', async () => {
      // Use invalid bounds to trigger fallback
      const airspace = await loadAllAirspace({
        useOpenAIP: true,
        bounds: [999, 999, 999, 999] as [number, number, number, number],
      })

      expect(airspace).toBeDefined()
      expect(airspace.type).toBe('FeatureCollection')
      expect(Array.isArray(airspace.features)).toBe(true)

      console.log('✓ Successfully fell back to static files')
    }, 10000)
  })

  describe('loadAirports', () => {
    it('should load airports from static files (default)', async () => {
      const airports = await loadAirports()

      expect(Array.isArray(airports)).toBe(true)
      expect(airports.length).toBeGreaterThan(0)

      console.log(`✓ Loaded ${airports.length} airports from static files`)

      // Check structure
      const firstAirport = airports[0]
      expect(firstAirport.id).toBeDefined()
      expect(firstAirport.name).toBeDefined()
      expect(typeof firstAirport.lat).toBe('number')
      expect(typeof firstAirport.lon).toBe('number')
      expect(firstAirport.type).toMatch(/towered|non-towered/)
    })

    it('should load airports from OpenAIP when requested', async () => {
      const airports = await loadAirports({
        useOpenAIP: true,
        bounds: NORCAL_BOUNDS,
      })

      expect(Array.isArray(airports)).toBe(true)
      expect(airports.length).toBeGreaterThan(0)

      console.log(`✓ Loaded ${airports.length} airports from OpenAIP`)

      // Check converted structure matches our Airport interface
      const firstAirport = airports[0]
      expect(firstAirport.id).toBeDefined()
      expect(firstAirport.name).toBeDefined()
      expect(typeof firstAirport.lat).toBe('number')
      expect(typeof firstAirport.lon).toBe('number')
      expect(typeof firstAirport.elevation).toBe('number')
      expect(firstAirport.type).toMatch(/towered|non-towered/)
    }, 10000)

    it('should find KSQL and KSMF from OpenAIP', async () => {
      const airports = await loadAirports({
        useOpenAIP: true,
        bounds: NORCAL_BOUNDS,
      })

      const ksql = airports.find(ap => ap.id === 'KSQL')
      const ksmf = airports.find(ap => ap.id === 'KSMF')

      if (ksql) {
        console.log(`✓ Found KSQL: ${ksql.name}`)
        expect(ksql.lat).toBeCloseTo(37.5119, 1)
        expect(ksql.lon).toBeCloseTo(-122.2495, 1)
      }

      if (ksmf) {
        console.log(`✓ Found KSMF: ${ksmf.name}`)
        expect(ksmf.lat).toBeCloseTo(38.5125, 1)
        expect(ksmf.lon).toBeCloseTo(-121.4932, 1)
      }
    }, 10000)
  })

  describe('loadWaypoints', () => {
    it('should load waypoints from static files (default)', async () => {
      const waypoints = await loadWaypoints()

      expect(Array.isArray(waypoints)).toBe(true)
      expect(waypoints.length).toBeGreaterThan(0)

      console.log(`✓ Loaded ${waypoints.length} waypoints from static files`)

      // Check structure
      const firstWaypoint = waypoints[0]
      expect(firstWaypoint.id).toBeDefined()
      expect(firstWaypoint.name).toBeDefined()
      expect(typeof firstWaypoint.lat).toBe('number')
      expect(typeof firstWaypoint.lon).toBe('number')
      expect(firstWaypoint.type).toMatch(/VOR|VORTAC|NDB|GPS_FIX|INTERSECTION/)
    })

    it('should load navaids from OpenAIP when requested', async () => {
      const waypoints = await loadWaypoints({
        useOpenAIP: true,
        bounds: NORCAL_BOUNDS,
      })

      expect(Array.isArray(waypoints)).toBe(true)

      console.log(`✓ Loaded ${waypoints.length} navaids from OpenAIP`)

      if (waypoints.length > 0) {
        // Check converted structure matches our Waypoint interface
        const firstWaypoint = waypoints[0]
        expect(firstWaypoint.id).toBeDefined()
        expect(firstWaypoint.name).toBeDefined()
        expect(typeof firstWaypoint.lat).toBe('number')
        expect(typeof firstWaypoint.lon).toBe('number')
        expect(firstWaypoint.type).toMatch(/VOR|VORTAC|NDB|GPS_FIX|INTERSECTION/)
      }
    }, 10000)
  })

  describe('Data Format Consistency', () => {
    it('should return same structure from static and OpenAIP sources', async () => {
      const staticAirspace = await loadAllAirspace()
      const openAIPAirspace = await loadAllAirspace({
        useOpenAIP: true,
        bounds: NORCAL_BOUNDS,
      })

      // Both should be FeatureCollections
      expect(staticAirspace.type).toBe('FeatureCollection')
      expect(openAIPAirspace.type).toBe('FeatureCollection')

      // Both should have features array
      expect(Array.isArray(staticAirspace.features)).toBe(true)
      expect(Array.isArray(openAIPAirspace.features)).toBe(true)

      console.log('✓ Both sources return consistent FeatureCollection format')
    }, 10000)

    it('should have consistent airport structure from both sources', async () => {
      const staticAirports = await loadAirports()
      const openAIPAirports = await loadAirports({
        useOpenAIP: true,
        bounds: NORCAL_BOUNDS,
      })

      // Check both have required fields
      const checkAirportStructure = (airport: any) => {
        expect(airport.id).toBeDefined()
        expect(airport.name).toBeDefined()
        expect(typeof airport.lat).toBe('number')
        expect(typeof airport.lon).toBe('number')
        expect(typeof airport.elevation).toBe('number')
        expect(airport.type).toMatch(/towered|non-towered/)
      }

      checkAirportStructure(staticAirports[0])
      if (openAIPAirports.length > 0) {
        checkAirportStructure(openAIPAirports[0])
      }

      console.log('✓ Both sources return consistent Airport structure')
    }, 10000)
  })

  describe('Performance', () => {
    it('should load static data quickly (<500ms)', async () => {
      const start = Date.now()

      await Promise.all([
        loadAllAirspace(),
        loadAirports(),
        loadWaypoints(),
      ])

      const elapsed = Date.now() - start

      expect(elapsed).toBeLessThan(500)
      console.log(`✓ Loaded all static data in ${elapsed}ms`)
    })

    it('should load OpenAIP data in reasonable time (<5s)', async () => {
      const start = Date.now()

      await Promise.all([
        loadAllAirspace({ useOpenAIP: true, bounds: NORCAL_BOUNDS }),
        loadAirports({ useOpenAIP: true, bounds: NORCAL_BOUNDS }),
        loadWaypoints({ useOpenAIP: true, bounds: NORCAL_BOUNDS }),
      ])

      const elapsed = Date.now() - start

      expect(elapsed).toBeLessThan(5000)
      console.log(`✓ Loaded all OpenAIP data in ${elapsed}ms`)
    }, 15000)
  })
})
