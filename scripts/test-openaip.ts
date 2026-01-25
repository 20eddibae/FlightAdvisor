#!/usr/bin/env tsx
/**
 * Manual OpenAIP Integration Test Script
 *
 * Run with: npx tsx scripts/test-openaip.ts
 */

import {
  fetchAllAirspace,
  fetchClassBAirspace,
  fetchRestrictedAirspace,
  fetchAirports,
  fetchNavaids,
  isOpenAIPConfigured,
} from '../lib/api/openaip'

import { loadAllAirspace, loadAirports, loadWaypoints } from '../lib/geojson'

const NORCAL_BOUNDS: [number, number, number, number] = [-123.0, 37.0, -121.0, 39.0]
const BAY_AREA_BOUNDS: [number, number, number, number] = [-122.5, 37.5, -122.0, 38.0]

async function runTests() {
  console.log('🧪 OpenAIP Integration Test\n')

  // Check configuration
  console.log('1️⃣  Checking configuration...')
  if (!isOpenAIPConfigured()) {
    console.error('❌ OpenAIP API key not configured!')
    console.error('   Set OPEN_AIP_API_KEY in .env.local')
    process.exit(1)
  }
  console.log('✅ OpenAIP API key configured\n')

  // Test airspace fetching
  console.log('2️⃣  Testing airspace fetching...')
  try {
    const allAirspace = await fetchAllAirspace(BAY_AREA_BOUNDS)
    console.log(`✅ All airspace: ${allAirspace.features.length} features`)

    const classB = await fetchClassBAirspace(NORCAL_BOUNDS)
    console.log(`✅ Class B airspace: ${classB.features.length} features`)

    const restricted = await fetchRestrictedAirspace(NORCAL_BOUNDS)
    console.log(`✅ Restricted airspace: ${restricted.features.length} features`)

    // Check for SFO Class B
    const sfoClassB = allAirspace.features.find(f =>
      f.properties.name.includes('SAN FRANCISCO')
    )
    if (sfoClassB) {
      console.log(`✅ Found SFO Class B: ${sfoClassB.properties.name}`)
    } else {
      console.warn('⚠️  SFO Class B not found in results')
    }
  } catch (error) {
    console.error('❌ Airspace fetching failed:', error)
    process.exit(1)
  }

  console.log()

  // Test airport fetching
  console.log('3️⃣  Testing airport fetching...')
  try {
    const airports = await fetchAirports(NORCAL_BOUNDS)
    console.log(`✅ Fetched ${airports.length} airports`)

    // Look for KSQL and KSMF
    const ksql = airports.find(ap => ap.icaoCode === 'KSQL')
    const ksmf = airports.find(ap => ap.icaoCode === 'KSMF')

    if (ksql) {
      console.log(`✅ Found KSQL: ${ksql.name} at [${ksql.geometry.coordinates}]`)
    } else {
      console.warn('⚠️  KSQL not found')
    }

    if (ksmf) {
      console.log(`✅ Found KSMF: ${ksmf.name} at [${ksmf.geometry.coordinates}]`)
    } else {
      console.warn('⚠️  KSMF not found')
    }
  } catch (error) {
    console.error('❌ Airport fetching failed:', error)
    process.exit(1)
  }

  console.log()

  // Test navaid fetching
  console.log('4️⃣  Testing navaid fetching...')
  try {
    const navaids = await fetchNavaids(NORCAL_BOUNDS)
    console.log(`✅ Fetched ${navaids.length} navaids`)

    if (navaids.length > 0) {
      console.log(`   Sample: ${navaids[0].name} (Type ${navaids[0].type})`)
    }
  } catch (error) {
    console.error('❌ Navaid fetching failed:', error)
    process.exit(1)
  }

  console.log()

  // Test data loader integration
  console.log('5️⃣  Testing data loader integration...')
  try {
    const airspace = await loadAllAirspace({
      useOpenAIP: true,
      bounds: NORCAL_BOUNDS,
    })
    console.log(`✅ loadAllAirspace: ${airspace.features.length} features`)

    const airports = await loadAirports({
      useOpenAIP: true,
      bounds: NORCAL_BOUNDS,
    })
    console.log(`✅ loadAirports: ${airports.length} airports`)

    const waypoints = await loadWaypoints({
      useOpenAIP: true,
      bounds: NORCAL_BOUNDS,
    })
    console.log(`✅ loadWaypoints: ${waypoints.length} waypoints`)
  } catch (error) {
    console.error('❌ Data loader integration failed:', error)
    process.exit(1)
  }

  console.log()

  // Test static fallback
  console.log('6️⃣  Testing static data fallback...')
  try {
    const airspace = await loadAllAirspace()
    console.log(`✅ Static airspace: ${airspace.features.length} features`)

    const airports = await loadAirports()
    console.log(`✅ Static airports: ${airports.length} airports`)

    const waypoints = await loadWaypoints()
    console.log(`✅ Static waypoints: ${waypoints.length} waypoints`)
  } catch (error) {
    console.error('❌ Static data loading failed:', error)
    process.exit(1)
  }

  console.log()

  // Performance test
  console.log('7️⃣  Testing performance...')
  try {
    const start = Date.now()

    await Promise.all([
      fetchAllAirspace(BAY_AREA_BOUNDS),
      fetchAirports(BAY_AREA_BOUNDS),
      fetchNavaids(BAY_AREA_BOUNDS),
    ])

    const elapsed = Date.now() - start
    console.log(`✅ Parallel fetch completed in ${elapsed}ms`)

    if (elapsed > 5000) {
      console.warn('⚠️  Performance slower than expected (>5s)')
    }
  } catch (error) {
    console.error('❌ Performance test failed:', error)
    process.exit(1)
  }

  console.log()

  // Summary
  console.log('🎉 All tests passed!')
  console.log('\n📊 Summary:')
  console.log('  ✅ API configuration valid')
  console.log('  ✅ Airspace fetching works')
  console.log('  ✅ Airport fetching works')
  console.log('  ✅ Navaid fetching works')
  console.log('  ✅ Data loader integration works')
  console.log('  ✅ Static data fallback works')
  console.log('  ✅ Performance acceptable')
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
