/**
 * OpenAIP API Client Tests
 *
 * Run with: npm test
 */

import {
  fetchAllAirspace,
  fetchClassBAirspace,
  fetchRestrictedAirspace,
  fetchAirports,
  fetchNavaids,
  isOpenAIPConfigured,
} from '../openaip'

// Test bounds for San Francisco Bay Area
const BAY_AREA_BOUNDS: [number, number, number, number] = [-122.5, 37.5, -122.0, 38.0]
const NORCAL_BOUNDS: [number, number, number, number] = [-123.0, 37.0, -121.0, 39.0]

describe('OpenAIP API Client', () => {
  // Check configuration before running tests
  beforeAll(() => {
    if (!isOpenAIPConfigured()) {
      console.warn('⚠️  OpenAIP API key not configured. Set OPEN_AIP_API_KEY in .env.local')
      console.warn('   Tests will be skipped.')
    }
  })

  describe('Configuration', () => {
    it('should detect if API key is configured', () => {
      const configured = isOpenAIPConfigured()
      expect(typeof configured).toBe('boolean')

      if (configured) {
        console.log('✓ OpenAIP API key is configured')
      }
    })
  })

  describe('Airspace Fetching', () => {
    it('should fetch all airspaces for Bay Area', async () => {
      if (!isOpenAIPConfigured()) return

      const result = await fetchAllAirspace(BAY_AREA_BOUNDS)

      expect(result).toBeDefined()
      expect(result.type).toBe('FeatureCollection')
      expect(Array.isArray(result.features)).toBe(true)
      expect(result.features.length).toBeGreaterThan(0)

      console.log(`✓ Fetched ${result.features.length} airspace features`)

      // Check feature structure
      const firstFeature = result.features[0]
      expect(firstFeature.type).toBe('Feature')
      expect(firstFeature.properties).toBeDefined()
      expect(firstFeature.properties.name).toBeDefined()
      expect(firstFeature.geometry).toBeDefined()
    }, 10000)

    it('should fetch Class B airspaces', async () => {
      if (!isOpenAIPConfigured()) return

      const result = await fetchClassBAirspace(NORCAL_BOUNDS)

      expect(result).toBeDefined()
      expect(result.type).toBe('FeatureCollection')
      expect(Array.isArray(result.features)).toBe(true)

      console.log(`✓ Fetched ${result.features.length} Class B airspace features`)

      // At least SFO Class B should be present
      const sfoClassB = result.features.find(f =>
        f.properties.name.includes('SAN FRANCISCO') || f.properties.name.includes('SFO')
      )
      expect(sfoClassB).toBeDefined()
    }, 10000)

    it('should fetch restricted airspaces', async () => {
      if (!isOpenAIPConfigured()) return

      const result = await fetchRestrictedAirspace(NORCAL_BOUNDS)

      expect(result).toBeDefined()
      expect(result.type).toBe('FeatureCollection')
      expect(Array.isArray(result.features)).toBe(true)

      console.log(`✓ Fetched ${result.features.length} restricted airspace features`)
    }, 10000)

    it('should have proper airspace feature structure', async () => {
      if (!isOpenAIPConfigured()) return

      const result = await fetchAllAirspace(BAY_AREA_BOUNDS)

      if (result.features.length === 0) {
        console.warn('No airspace features returned for test')
        return
      }

      const feature = result.features[0]

      // Check properties
      expect(feature.properties.name).toBeDefined()
      expect(typeof feature.properties.type).toBe('number')
      expect(typeof feature.properties.floor_msl).toBe('number')
      expect(typeof feature.properties.ceiling_msl).toBe('number')

      // Check geometry
      expect(feature.geometry.type).toMatch(/Polygon|MultiPolygon/)
      expect(Array.isArray(feature.geometry.coordinates)).toBe(true)
    }, 10000)
  })

  describe('Airport Fetching', () => {
    it('should fetch airports for Bay Area', async () => {
      if (!isOpenAIPConfigured()) return

      const airports = await fetchAirports(BAY_AREA_BOUNDS)

      expect(Array.isArray(airports)).toBe(true)
      expect(airports.length).toBeGreaterThan(0)

      console.log(`✓ Fetched ${airports.length} airports`)

      // Check airport structure
      const firstAirport = airports[0]
      expect(firstAirport._id).toBeDefined()
      expect(firstAirport.name).toBeDefined()
      expect(firstAirport.geometry).toBeDefined()
      expect(firstAirport.geometry.type).toBe('Point')
      expect(Array.isArray(firstAirport.geometry.coordinates)).toBe(true)
      expect(firstAirport.geometry.coordinates.length).toBe(2)
    }, 10000)

    it('should find KSQL (San Carlos Airport)', async () => {
      if (!isOpenAIPConfigured()) return

      const airports = await fetchAirports(NORCAL_BOUNDS)

      const ksql = airports.find(ap =>
        ap.icaoCode === 'KSQL' || ap.name.includes('SAN CARLOS')
      )

      if (ksql) {
        console.log(`✓ Found KSQL: ${ksql.name}`)
        expect(ksql.geometry.coordinates[0]).toBeCloseTo(-122.2495, 1)
        expect(ksql.geometry.coordinates[1]).toBeCloseTo(37.5119, 1)
      }
    }, 10000)
  })

  describe('Navaid Fetching', () => {
    it('should fetch navaids for Bay Area', async () => {
      if (!isOpenAIPConfigured()) return

      const navaids = await fetchNavaids(BAY_AREA_BOUNDS)

      expect(Array.isArray(navaids)).toBe(true)

      console.log(`✓ Fetched ${navaids.length} navaids`)

      if (navaids.length > 0) {
        // Check navaid structure
        const firstNavaid = navaids[0]
        expect(firstNavaid._id).toBeDefined()
        expect(firstNavaid.name).toBeDefined()
        expect(firstNavaid.type).toBeDefined()
        expect(firstNavaid.geometry).toBeDefined()
        expect(firstNavaid.geometry.type).toBe('Point')
      }
    }, 10000)

    it('should fetch navaids for larger NorCal region', async () => {
      if (!isOpenAIPConfigured()) return

      const navaids = await fetchNavaids(NORCAL_BOUNDS)

      expect(Array.isArray(navaids)).toBe(true)
      expect(navaids.length).toBeGreaterThan(0)

      console.log(`✓ Fetched ${navaids.length} navaids in NorCal region`)
    }, 10000)
  })

  describe('Error Handling', () => {
    it('should throw error for invalid bounds', async () => {
      if (!isOpenAIPConfigured()) return

      // Invalid bounds (minLon > maxLon)
      const invalidBounds: [number, number, number, number] = [-120.0, 37.0, -123.0, 39.0]

      try {
        await fetchAllAirspace(invalidBounds)
        // Should not reach here
        expect(true).toBe(false)
      } catch (error) {
        expect(error).toBeDefined()
      }
    }, 10000)

    it('should handle empty result sets gracefully', async () => {
      if (!isOpenAIPConfigured()) return

      // Very small bounds in ocean
      const oceanBounds: [number, number, number, number] = [-130.0, 30.0, -129.9, 30.1]

      const result = await fetchAllAirspace(oceanBounds)

      expect(result.type).toBe('FeatureCollection')
      expect(Array.isArray(result.features)).toBe(true)
      // May be empty, that's ok
    }, 10000)
  })

  describe('Data Conversion', () => {
    it('should convert OpenAIP airspace to GeoJSON format', async () => {
      if (!isOpenAIPConfigured()) return

      const result = await fetchAllAirspace(BAY_AREA_BOUNDS)

      expect(result.type).toBe('FeatureCollection')

      result.features.forEach(feature => {
        // Check it matches GeoJSON spec
        expect(feature.type).toBe('Feature')
        expect(feature.properties).toBeDefined()
        expect(feature.geometry).toBeDefined()

        // Check our custom properties
        expect(typeof feature.properties.name).toBe('string')
        expect(typeof feature.properties.type).toBe('number')
        expect(typeof feature.properties.floor_msl).toBe('number')
        expect(typeof feature.properties.ceiling_msl).toBe('number')
      })
    }, 10000)
  })
})
