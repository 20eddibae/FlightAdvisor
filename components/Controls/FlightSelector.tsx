'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Plane, Trash2, Plus, Route as RouteIcon, Pencil, Check, X } from 'lucide-react'
import { getAllFlights, saveFlight, deleteFlight, updateFlight, SavedFlight } from '@/lib/supabase/flights'

interface FlightSelectorProps {
  currentRoute?: {
    departure: string
    arrival: string
    distance_nm: number
    estimated_time_min: number
    type: 'direct' | 'avoiding_airspace'
    waypoints?: string[]
    coordinates?: [number, number][]
    cruise_altitude?: number
  }
  onLoadFlight: (flight: SavedFlight) => void
  onNewRoute: () => void
}

const NEW_ROUTE_VALUE = '__NEW_ROUTE__'

export default function FlightSelector({ currentRoute, onLoadFlight, onNewRoute }: FlightSelectorProps) {
  const [flights, setFlights] = useState<SavedFlight[]>([])
  const [selectedFlightId, setSelectedFlightId] = useState<string>('')
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const lastSavedRouteRef = useRef<string>('')

  // Load flights on mount and create Route 1 if none exist
  useEffect(() => {
    loadFlightsAndInitialize()
  }, [])

  const loadFlightsAndInitialize = async () => {
    setIsLoading(true)
    const data = await getAllFlights()
    setFlights(data)

    // If no routes exist, create Route 1 automatically
    if (data.length === 0) {
      console.log('📝 No routes found, creating Route 1...')
      await createNewBlankRoute()
    } else {
      // Select the first route by default
      const firstRoute = data[0]
      setSelectedFlightId(firstRoute.id)
      if (firstRoute.departure && firstRoute.arrival) {
        onLoadFlight(firstRoute)
      }
      console.log('✅ Loaded', data.length, 'routes, selected:', firstRoute.name)
    }

    setIsLoading(false)
  }

  // Auto-save when route changes
  useEffect(() => {
    if (currentRoute) {
      const routeSignature = `${currentRoute.departure}-${currentRoute.arrival}-${currentRoute.distance_nm.toFixed(1)}`

      // Only save if this is a new/different route
      if (routeSignature !== lastSavedRouteRef.current) {
        lastSavedRouteRef.current = routeSignature
        autoSaveRoute()
      }
    } else {
      lastSavedRouteRef.current = ''
    }
  }, [currentRoute])

  // Focus rename input when renaming starts
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [isRenaming])

  const loadFlights = async () => {
    setIsLoading(true)
    const data = await getAllFlights()
    setFlights(data)
    setIsLoading(false)
  }

  const autoSaveRoute = async () => {
    if (!currentRoute) {
      console.log('⏭️ Auto-save skipped: no current route')
      return
    }

    console.log('💾 Auto-saving route...', {
      selectedId: selectedFlightId,
      departure: currentRoute.departure,
      arrival: currentRoute.arrival
    })

    // Always update the currently selected route
    if (selectedFlightId && selectedFlightId !== NEW_ROUTE_VALUE) {
      setIsLoading(true)
      try {
        const updated = await updateFlight(selectedFlightId, {
          departure: currentRoute.departure,
          arrival: currentRoute.arrival,
          route_type: currentRoute.type,
          waypoints: currentRoute.waypoints || [],
          coordinates: currentRoute.coordinates || [],
          distance_nm: currentRoute.distance_nm,
          estimated_time_min: currentRoute.estimated_time_min,
          cruise_altitude: currentRoute.cruise_altitude,
        })

        if (updated) {
          console.log('✅ Updated route:', selectedFlightId, 'with', currentRoute.departure, '→', currentRoute.arrival)
        } else {
          console.error('❌ Failed to update route - updateFlight returned null')
        }

        await loadFlights()
      } catch (error) {
        console.error('❌ Error updating route:', error)
      } finally {
        setIsLoading(false)
      }
      return
    }

    // If no route selected, we shouldn't be here (should have been created in handleSelectFlight)
    console.warn('⚠️ Auto-save called without selected route ID')
  }

  const handleStartRename = () => {
    const selectedFlight = flights.find(f => f.id === selectedFlightId)
    if (selectedFlight) {
      setRenameValue(selectedFlight.name)
      setIsRenaming(true)
    }
  }

  const handleSaveRename = async () => {
    if (!selectedFlightId || !renameValue.trim()) {
      setIsRenaming(false)
      return
    }

    setIsLoading(true)
    const updated = await updateFlight(selectedFlightId, { name: renameValue.trim() })
    if (updated) {
      await loadFlights()
    }
    setIsRenaming(false)
    setIsLoading(false)
  }

  const handleCancelRename = () => {
    setIsRenaming(false)
    setRenameValue('')
  }

  const handleDeleteFlight = async () => {
    if (!selectedFlightId || selectedFlightId === NEW_ROUTE_VALUE) return
    if (!confirm('Are you sure you want to delete this route?')) return

    setIsLoading(true)
    const success = await deleteFlight(selectedFlightId)
    if (success) {
      await loadFlights()
      setSelectedFlightId('')
      onNewRoute() // Clear the map
    }
    setIsLoading(false)
  }

  const handleSelectFlight = (value: string) => {
    if (value === NEW_ROUTE_VALUE) {
      // Create a new blank route in Supabase immediately
      createNewBlankRoute()
      return
    }

    setSelectedFlightId(value)
    const flight = flights.find(f => f.id === value)
    if (flight) {
      onLoadFlight(flight)
    }
  }

  const createNewBlankRoute = async () => {
    console.log('🆕 Creating new blank route...')

    // Calculate next route number
    const routeNumbers = flights
      .map(f => {
        const match = f.name.match(/^Route (\d+)$/)
        return match ? parseInt(match[1]) : 0
      })
      .filter(n => n > 0)

    const nextNumber = routeNumbers.length > 0 ? Math.max(...routeNumbers) + 1 : 1
    const defaultName = `Route ${nextNumber}`

    console.log('📝 Next route name:', defaultName)

    setIsLoading(true)

    try {
      // Create blank route entry
      const newFlight = await saveFlight({
        name: defaultName,
        departure: '',
        arrival: '',
        route_type: 'direct',
        waypoints: [],
        coordinates: [],
        distance_nm: 0,
        estimated_time_min: 0,
        cruise_altitude: 0,
      })

      if (newFlight) {
        console.log('✅ Created new blank route:', defaultName, 'ID:', newFlight.id)
        await loadFlights()
        setSelectedFlightId(newFlight.id)
        lastSavedRouteRef.current = ''
        onNewRoute() // Clear the map
      } else {
        console.error('❌ Failed to create new route - saveFlight returned null')
      }
    } catch (error) {
      console.error('❌ Error creating new route:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const selectedFlight = flights.find(f => f.id === selectedFlightId)

  return (
    <Card className="fixed top-4 left-4 z-40 w-80 shadow-lg border border-slate-200 bg-white/70 backdrop-blur-sm rounded-2xl">
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <RouteIcon className="w-4 h-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold">Flight Routes</CardTitle>
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
              Auto-Saved
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        {/* Route Selector with Rename */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-600">Select Route</label>

          {isRenaming ? (
            /* Rename Input */
            <div className="flex gap-1">
              <Input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveRename()
                  if (e.key === 'Escape') handleCancelRename()
                }}
                className="text-sm h-10"
                placeholder="Route name..."
              />
              <Button
                onClick={handleSaveRename}
                size="sm"
                className="h-10 w-10 p-0"
                disabled={!renameValue.trim()}
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button
                onClick={handleCancelRename}
                size="sm"
                variant="outline"
                className="h-10 w-10 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            /* Dropdown + Rename Button */
            <div className="flex gap-1">
              <Select
                value={selectedFlightId}
                onValueChange={handleSelectFlight}
                disabled={isLoading}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Loading routes..." />
                </SelectTrigger>
                <SelectContent>
                  {/* Existing Routes */}
                  {flights.map((flight) => {
                    const isBlank = !flight.departure && !flight.arrival
                    return (
                      <SelectItem key={flight.id} value={flight.id}>
                        <div className="flex flex-col">
                          <div className="font-semibold text-xs">{flight.name}</div>
                          <div className="text-[10px] text-slate-500">
                            {isBlank ? (
                              <span className="italic">Empty route - plan to save</span>
                            ) : (
                              <>{flight.departure} → {flight.arrival} ({flight.distance_nm.toFixed(0)} nm)</>
                            )}
                          </div>
                        </div>
                      </SelectItem>
                    )
                  })}

                  {/* New Route Option at the bottom */}
                  <SelectItem value={NEW_ROUTE_VALUE} className="bg-green-50 border-t-2 border-green-200 mt-1">
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-green-700 font-bold" />
                      <span className="font-bold text-green-700">New Route</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Rename Button */}
              {selectedFlightId && selectedFlightId !== NEW_ROUTE_VALUE && (
                <Button
                  onClick={handleStartRename}
                  size="sm"
                  variant="outline"
                  className="h-10 w-10 p-0"
                  disabled={isLoading}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Selected Flight Info */}
        {selectedFlight && (
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Plane className="w-4 h-4 text-primary" />
                <span className="font-bold text-sm">{selectedFlight.name}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteFlight}
                className="h-6 w-6 p-0 hover:bg-red-100"
              >
                <Trash2 className="w-3 h-3 text-red-600" />
              </Button>
            </div>
            {selectedFlight.departure && selectedFlight.arrival ? (
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Route:</span>
                  <span className="font-semibold">{selectedFlight.departure} → {selectedFlight.arrival}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Distance:</span>
                  <span className="font-semibold">{selectedFlight.distance_nm.toFixed(1)} nm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Time:</span>
                  <span className="font-semibold">{selectedFlight.estimated_time_min} min</span>
                </div>
                {selectedFlight.cruise_altitude && selectedFlight.cruise_altitude > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Altitude:</span>
                    <span className="font-semibold">{selectedFlight.cruise_altitude}' MSL</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-400 italic py-2">
                Plan a route to save it here
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="pt-2 border-t border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{flights.length} saved route{flights.length !== 1 ? 's' : ''}</span>
            {isLoading && <span className="text-primary font-semibold">Saving...</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
