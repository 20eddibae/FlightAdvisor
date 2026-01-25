'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { AirportSearch } from './AirportSearch'
import type { CachedAirport } from '@/lib/cache/types'

interface RouteControlsProps {
  onPlanRoute: (departure: string, destination: string, maxSegmentLength?: number) => void
  onClearRoute: () => void
  isCalculating: boolean
  routeInfo?: {
    distance_nm: number
    estimated_time_min: number
    type: 'direct' | 'avoiding_airspace'
  } | null
}

export default function RouteControls({
  onPlanRoute,
  onClearRoute,
  isCalculating,
  routeInfo,
}: RouteControlsProps) {
  const [departure, setDeparture] = useState<CachedAirport | null>(null)
  const [destination, setDestination] = useState<CachedAirport | null>(null)
  const [maxSegmentLength, setMaxSegmentLength] = useState<string>('')
  const [isVisible, setIsVisible] = useState(true)

  const handlePlanRoute = () => {
    if (!departure || !destination) return
    const maxLen = maxSegmentLength ? parseInt(maxSegmentLength, 10) : undefined
    onPlanRoute(departure.id, destination.id, maxLen)
  }

  return (
    <Card className="absolute w-80 top-4 left-4 z-10 bg-white shadow-lg">
      <CardHeader className="cursor-pointer" onClick={() => setIsVisible(!isVisible)}>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">FlightAdvisor</CardTitle>
            <CardDescription>AI-Powered Flight Planning</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
          >
            <span className={`text-lg transition-transform rotate-90 duration-200 ${isVisible ? '' : 'rotate-270'}`}>
              ›
            </span>
          </Button>
        </div>
      </CardHeader>

      {isVisible && (
        <CardContent className="space-y-4">
        {/* Route Information */}
        {routeInfo && (
          <div className="p-3 bg-secondary rounded-md space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Route:</span>
              <span className="font-medium">
                {routeInfo.type === 'direct' ? 'Direct' : 'Avoiding Airspace'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Distance:</span>
              <span className="font-medium">{routeInfo.distance_nm} nm</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Est. Time:</span>
              <span className="font-medium">{routeInfo.estimated_time_min} min</span>
            </div>
          </div>
        )}

        {/* Airport Search */}
        <div className="space-y-3">
          <div>
            <Label htmlFor="departure" className="text-sm font-medium">
              Departure Airport
            </Label>
            <AirportSearch
              onSelect={setDeparture}
              placeholder="Search by code or name..."
              autoFocus
              initialValue="KSQL"
              className="mt-1"
            />
            {departure && (
              <div className="text-xs text-muted-foreground mt-1">
                Selected: {/^[A-Z0-9]{3,5}$/i.test(departure.id)
                  ? `${departure.id} - ${departure.name}`
                  : departure.name}
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="destination" className="text-sm font-medium">
              Destination Airport
            </Label>
            <AirportSearch
              onSelect={setDestination}
              placeholder="Search by code or name..."
              initialValue="KSMF"
              className="mt-1"
            />
            {destination && (
              <div className="text-xs text-muted-foreground mt-1">
                Selected: {/^[A-Z0-9]{3,5}$/i.test(destination.id)
                  ? `${destination.id} - ${destination.name}`
                  : destination.name}
              </div>
            )}
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="pt-2 border-t">
          <Label htmlFor="maxSegment" className="text-xs text-muted-foreground font-medium mb-1.5 block">
            Max Straight Line Length (NM)
          </Label>
          <div className="flex items-center gap-2">
            <input
              id="maxSegment"
              type="number"
              min="10"
              max="1000"
              value={maxSegmentLength}
              onChange={(e) => setMaxSegmentLength(e.target.value)}
              placeholder="No Limit"
              className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Splits long direct paths into smaller segments.
          </p>
        </div>

        {/* Control Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handlePlanRoute}
            disabled={isCalculating || !departure || !destination}
            className="flex-1"
          >
            {isCalculating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Planning...
              </>
            ) : (
              'Plan Route'
            )}
          </Button>
          <Button
            onClick={onClearRoute}
            variant="outline"
            disabled={isCalculating || !routeInfo}
            className="flex-1"
          >
            Clear
          </Button>
        </div>

        {/* Demo Information */}
        <div className="text-xs text-muted-foreground pt-2 border-t">
          <p className="font-medium mb-1">Available Airports:</p>
          <p>KSQL (San Carlos), KSMF (Sacramento Executive)</p>
        </div>
        </CardContent>
      )}
    </Card>
  )
}
