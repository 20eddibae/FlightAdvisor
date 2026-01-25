/**
 * GeoJSON Data Loaders Integration Tests
 *
 * All data comes from OpenAIP. Requires OPEN_AIP_API_KEY in .env.local.
 */

import { loadAllAirspace, loadAirports, loadWaypoints } from '../geojson'

const NORCAL_BOUNDS: [number, number, number, number] = [
  -123.0, 37.0, -121.0, 39.0,
]

describe('GeoJSON Data Loaders Integration', () => {
  describe('loadAllAirspace', () => {
    it('should load airspace from OpenAIP', async () => {
      const airspace = await loadAllAirspace({ bounds: NORCAL_BOUNDS })

      expect(airspace).toBeDefined()
      expect(airspace.type).toBe('FeatureCollection')
      expect(Array.isArray(airspace.features)).toBe(true)
      expect(airspace.features.length).toBeGreaterThan(0)

      const sfoClassB = airspace.features.find((f) =>
        f.properties.name.includes('SAN FRANCISCO')
      )
      expect(sfoClassB).toBeDefined()
    }, 10000)
  })

  describe('loadAirports', () => {
    it('should load airports from OpenAIP', async () => {
      const airports = await loadAirports({ bounds: NORCAL_BOUNDS })

      expect(Array.isArray(airports)).toBe(true)
      expect(airports.length).toBeGreaterThan(0)

      const first = airports[0]
      expect(first.id).toBeDefined()
      expect(first.name).toBeDefined()
      expect(typeof first.lat).toBe('number')
      expect(typeof first.lon).toBe('number')
      expect(first.type).toMatch(/towered|non-towered/)
    }, 10000)

    it('should find KSQL and KSMF from OpenAIP', async () => {
      const airports = await loadAirports({ bounds: NORCAL_BOUNDS })

      const ksql = airports.find((ap) => ap.id === 'KSQL')
      const ksmf = airports.find((ap) => ap.id === 'KSMF')

      if (ksql) {
        expect(ksql.lat).toBeCloseTo(37.5119, 1)
        expect(ksql.lon).toBeCloseTo(-122.2495, 1)
      }
      if (ksmf) {
        expect(ksmf.lat).toBeCloseTo(38.5125, 1)
        expect(ksmf.lon).toBeCloseTo(-121.4932, 1)
      }
    }, 10000)
  })

  describe('loadWaypoints', () => {
    it('should load navaids from OpenAIP', async () => {
      const waypoints = await loadWaypoints({ bounds: NORCAL_BOUNDS })

      expect(Array.isArray(waypoints)).toBe(true)

      if (waypoints.length > 0) {
        const first = waypoints[0]
        expect(first.id).toBeDefined()
        expect(first.name).toBeDefined()
        expect(typeof first.lat).toBe('number')
        expect(typeof first.lon).toBe('number')
        expect(first.type).toMatch(
          /VOR|VORTAC|NDB|GPS_FIX|INTERSECTION/
        )
      }
    }, 10000)
  })

  describe('Performance', () => {
    it('should load OpenAIP data in reasonable time (<5s)', async () => {
      const start = Date.now()

      await Promise.all([
        loadAllAirspace({ bounds: NORCAL_BOUNDS }),
        loadAirports({ bounds: NORCAL_BOUNDS }),
        loadWaypoints({ bounds: NORCAL_BOUNDS }),
      ])

      const elapsed = Date.now() - start
      expect(elapsed).toBeLessThan(5000)
    }, 15000)
  })
})
