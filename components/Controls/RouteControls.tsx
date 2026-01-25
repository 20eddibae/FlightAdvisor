'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface RouteControlsProps {
  onPlanRoute: () => void
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
  return (
    <Card className="absolute top-4 left-4 w-80 shadow-lg z-10">
      <CardHeader>
        <CardTitle className="text-lg">FlightAdvisor</CardTitle>
        <CardDescription>AI-Powered Flight Planning</CardDescription>
      </CardHeader>
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

        {/* Control Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={onPlanRoute}
            disabled={isCalculating}
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
          <p className="font-medium mb-1">Demo Route:</p>
          <p>KSQL (San Carlos) → KSMF (Sacramento Executive)</p>
        </div>
      </CardContent>
    </Card>
  )
}
