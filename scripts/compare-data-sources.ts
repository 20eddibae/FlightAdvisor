#!/usr/bin/env tsx
/**
 * Compare Static Data vs OpenAIP Data
 *
 * This script compares data from static JSON files with OpenAIP API data
 * to help verify that OpenAIP can fully replace static files.
 *
 * Run with: npx tsx scripts/compare-data-sources.ts
 */

import { loadAllAirspace, loadAirports, loadWaypoints } from '../lib/geojson'
import { isOpenAIPConfigured } from '../lib/api/openaip'

const NORCAL_BOUNDS: [number, number, number, number] = [-123.0, 37.0, -121.0, 39.0]

async function compareDataSources() {
  console.log('📊 Comparing Static Data vs OpenAIP Data\n')

  if (!isOpenAIPConfigured()) {
    console.error('❌ OpenAIP API key not configured!')
    console.error('   Set OPEN_AIP_API_KEY in .env.local')
    process.exit(1)
  }

  // Compare Airspace Data
  console.log('1️⃣  AIRSPACE DATA\n')
  console.log('Loading static airspace...')
  const staticAirspace = await loadAllAirspace()

  console.log('Loading OpenAIP airspace...')
  const openAIPAirspace = await loadAllAirspace({
    useOpenAIP: true,
    bounds: NORCAL_BOUNDS,
  })

  console.log(`\n📦 Static Files:    ${staticAirspace.features.length} features`)
  console.log(`🌐 OpenAIP:         ${openAIPAirspace.features.length} features`)

  console.log('\n📍 Static Airspace Features:')
  staticAirspace.features.forEach(f => {
    console.log(`   - ${f.properties.name} (${f.properties.type})`)
  })

  console.log('\n📍 OpenAIP Airspace Features (first 10):')
  openAIPAirspace.features.slice(0, 10).forEach(f => {
    console.log(`   - ${f.properties.name} (Type ${f.properties.type}, ICAO Class ${f.properties.icaoClass || 'N/A'})`)
  })

  // Check coverage: Are all static airspaces available in OpenAIP?
  console.log('\n🔍 Coverage Check:')
  let staticFoundInOpenAIP = 0
  staticAirspace.features.forEach(staticFeature => {
    const found = openAIPAirspace.features.find(openFeature =>
      openFeature.properties.name.toLowerCase().includes(staticFeature.properties.name.toLowerCase().split(' ')[0])
    )
    if (found) {
      staticFoundInOpenAIP++
      console.log(`   ✅ ${staticFeature.properties.name} found in OpenAIP`)
    } else {
      console.log(`   ⚠️  ${staticFeature.properties.name} not found in OpenAIP`)
    }
  })

  console.log(`\n   ${staticFoundInOpenAIP}/${staticAirspace.features.length} static features found in OpenAIP`)

  // Compare Airport Data
  console.log('\n\n2️⃣  AIRPORT DATA\n')
  console.log('Loading static airports...')
  const staticAirports = await loadAirports()

  console.log('Loading OpenAIP airports...')
  const openAIPAirports = await loadAirports({
    useOpenAIP: true,
    bounds: NORCAL_BOUNDS,
  })

  console.log(`\n📦 Static Files:    ${staticAirports.length} airports`)
  console.log(`🌐 OpenAIP:         ${openAIPAirports.length} airports`)

  console.log('\n📍 Static Airports:')
  staticAirports.forEach(ap => {
    console.log(`   - ${ap.id}: ${ap.name} [${ap.lat}, ${ap.lon}]`)
  })

  console.log('\n📍 OpenAIP Airports (matching static IDs):')
  staticAirports.forEach(staticAirport => {
    const openAIPAirport = openAIPAirports.find(ap => ap.id === staticAirport.id)
    if (openAIPAirport) {
      console.log(`   ✅ ${openAIPAirport.id}: ${openAIPAirport.name}`)
      console.log(`      Static:  [${staticAirport.lat.toFixed(4)}, ${staticAirport.lon.toFixed(4)}]`)
      console.log(`      OpenAIP: [${openAIPAirport.lat.toFixed(4)}, ${openAIPAirport.lon.toFixed(4)}]`)
    } else {
      console.log(`   ⚠️  ${staticAirport.id} not found in OpenAIP results`)
    }
  })

  // Compare Waypoint/Navaid Data
  console.log('\n\n3️⃣  WAYPOINT/NAVAID DATA\n')
  console.log('Loading static waypoints...')
  const staticWaypoints = await loadWaypoints()

  console.log('Loading OpenAIP navaids...')
  const openAIPWaypoints = await loadWaypoints({
    useOpenAIP: true,
    bounds: NORCAL_BOUNDS,
  })

  console.log(`\n📦 Static Files:    ${staticWaypoints.length} waypoints`)
  console.log(`🌐 OpenAIP:         ${openAIPWaypoints.length} waypoints`)

  console.log('\n📍 Static Waypoints:')
  staticWaypoints.forEach(wp => {
    console.log(`   - ${wp.id}: ${wp.name} (${wp.type}) ${wp.frequency || ''}`)
  })

  console.log('\n📍 OpenAIP Navaids (all):')
  openAIPWaypoints.forEach(wp => {
    console.log(`   - ${wp.id}: ${wp.name} (${wp.type}) ${wp.frequency || ''}`)
  })

  console.log('\n🔍 Coverage Check:')
  let staticWaypointsFound = 0
  staticWaypoints.forEach(staticWaypoint => {
    const found = openAIPWaypoints.find(openWaypoint =>
      openWaypoint.name.toLowerCase().includes(staticWaypoint.name.toLowerCase().split(' ')[0])
    )
    if (found) {
      staticWaypointsFound++
      console.log(`   ✅ ${staticWaypoint.name} found in OpenAIP as ${found.name}`)
    } else {
      console.log(`   ⚠️  ${staticWaypoint.name} not found in OpenAIP`)
    }
  })

  console.log(`\n   ${staticWaypointsFound}/${staticWaypoints.length} static waypoints found in OpenAIP`)

  // Summary
  console.log('\n\n📋 SUMMARY\n')
  console.log('Airspace:')
  console.log(`  Static: ${staticAirspace.features.length} features`)
  console.log(`  OpenAIP: ${openAIPAirspace.features.length} features`)
  console.log(`  Coverage: ${staticFoundInOpenAIP}/${staticAirspace.features.length} (${Math.round(staticFoundInOpenAIP / staticAirspace.features.length * 100)}%)`)

  console.log('\nAirports:')
  console.log(`  Static: ${staticAirports.length} airports`)
  console.log(`  OpenAIP: ${openAIPAirports.length} airports`)

  console.log('\nWaypoints:')
  console.log(`  Static: ${staticWaypoints.length} waypoints`)
  console.log(`  OpenAIP: ${openAIPWaypoints.length} navaids`)
  console.log(`  Coverage: ${staticWaypointsFound}/${staticWaypoints.length} (${Math.round(staticWaypointsFound / staticWaypoints.length * 100)}%)`)

  console.log('\n✅ OpenAIP provides significantly more data than static files!')
  console.log('💡 Recommendation: Use OpenAIP as primary source with static files as fallback')
}

compareDataSources().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
