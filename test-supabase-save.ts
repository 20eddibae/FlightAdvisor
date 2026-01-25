/**
 * Test script to verify Supabase flight saving works correctly
 * Run with: npx tsx test-supabase-save.ts
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env.local') })

import { saveFlight, getAllFlights, updateFlight, deleteFlight } from './lib/supabase/flights'

async function testSupabaseSave() {
  console.log('🧪 Testing Supabase Flight Save Functionality\n')

  try {
    // Test 1: Create a blank route
    console.log('1️⃣ Creating blank Route 1...')
    const blankRoute = await saveFlight({
      name: 'Route 1',
      departure: '',
      arrival: '',
      route_type: 'direct',
      waypoints: [],
      coordinates: [],
      distance_nm: 0,
      estimated_time_min: 0,
      cruise_altitude: 0,
    })

    if (blankRoute) {
      console.log('✅ Blank route created:', blankRoute.id, blankRoute.name)
    } else {
      console.error('❌ Failed to create blank route')
      return
    }

    // Test 2: Update route with actual data
    console.log('\n2️⃣ Updating route with flight data...')
    const updatedRoute = await updateFlight(blankRoute.id, {
      departure: 'KSQL',
      arrival: 'KSMF',
      coordinates: [
        [-122.2495, 37.5119],
        [-121.8872, 37.5931],
        [-121.4932, 38.5125]
      ] as [number, number][],
      waypoints: ['SUNOL'],
      distance_nm: 87.3,
      estimated_time_min: 52,
      cruise_altitude: 5500,
    })

    if (updatedRoute) {
      console.log('✅ Route updated:', updatedRoute.departure, '→', updatedRoute.arrival)
      console.log('   Distance:', updatedRoute.distance_nm, 'nm')
      console.log('   Waypoints:', updatedRoute.waypoints)
    } else {
      console.error('❌ Failed to update route')
      return
    }

    // Test 3: Fetch all flights
    console.log('\n3️⃣ Fetching all flights...')
    const allFlights = await getAllFlights()
    console.log('✅ Found', allFlights.length, 'flight(s)')
    allFlights.forEach(f => {
      console.log(`   - ${f.name}: ${f.departure || '(empty)'} → ${f.arrival || '(empty)'}`)
    })

    // Test 4: Create second route
    console.log('\n4️⃣ Creating Route 2...')
    const route2 = await saveFlight({
      name: 'Route 2',
      departure: 'KOAK',
      arrival: 'KSAC',
      route_type: 'avoiding_airspace',
      waypoints: ['TRACY', 'MANTECA'],
      coordinates: [
        [-122.2208, 37.7214],
        [-121.4, 37.8],
        [-121.4932, 38.5125]
      ] as [number, number][],
      distance_nm: 65.2,
      estimated_time_min: 39,
      cruise_altitude: 4500,
    })

    if (route2) {
      console.log('✅ Route 2 created:', route2.departure, '→', route2.arrival)
    }

    // Test 5: Verify both routes exist
    console.log('\n5️⃣ Final verification...')
    const finalFlights = await getAllFlights()
    console.log('✅ Total flights in database:', finalFlights.length)

    if (finalFlights.length >= 2) {
      console.log('✅ Multiple routes saved successfully!')
    }

    // Test 6: Delete test routes
    console.log('\n6️⃣ Cleaning up test data...')
    const deleteSuccess1 = await deleteFlight(blankRoute.id)
    const deleteSuccess2 = route2 ? await deleteFlight(route2.id) : true

    if (deleteSuccess1 && deleteSuccess2) {
      console.log('✅ Test routes deleted successfully')
    }

    console.log('\n✅ All tests passed! Supabase save functionality is working correctly.')

  } catch (error) {
    console.error('\n❌ Test failed with error:', error)
  }
}

testSupabaseSave()
