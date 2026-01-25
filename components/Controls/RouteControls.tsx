'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { AirportSearch } from './AirportSearch'
import type { CachedAirport } from '@/lib/cache/types'
import {
  PlaneTakeoff,
  PlaneLanding,
  Settings2,
  Navigation,
  Trash2,
  Info,
  Clock,
  ArrowRight,
  Cloud,
  CloudOff,
  Wind,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface RouteControlsProps {
  onPlanRoute: (departure: string, destination: string, maxSegmentLength?: number) => void
  onClearRoute: () => void
  isCalculating: boolean
  routeInfo?: {
    distance_nm: number
    estimated_time_min: number
    type: 'direct' | 'avoiding_airspace'
  } | null
  showCloudLayer: boolean
  onToggleCloudLayer: () => void
  showWindLayer: boolean
  onToggleWindLayer: () => void
}

export default function RouteControls({
  onPlanRoute,
  onClearRoute,
  isCalculating,
  routeInfo,
  showCloudLayer,
  onToggleCloudLayer,
  showWindLayer,
  onToggleWindLayer,
}: RouteControlsProps) {
  const [departure, setDeparture] = useState<CachedAirport | null>(null)
  const [destination, setDestination] = useState<CachedAirport | null>(null)
  const [maxSegmentLength, setMaxSegmentLength] = useState<string>('')
  const [showSettings, setShowSettings] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const [initialDeparture, setInitialDeparture] = useState('KSQL')
  const [initialDestination, setInitialDestination] = useState('KSMF')

  const handlePlanRoute = () => {
    if (!departure || !destination) return
    const maxLen = maxSegmentLength ? parseInt(maxSegmentLength, 10) : undefined
    onPlanRoute(departure.id, destination.id, maxLen)
  }

  const handleClearAll = () => {
    setDeparture(null)
    setDestination(null)
    setInitialDeparture('')
    setInitialDestination('')
    setResetKey(prev => prev + 1)
    onClearRoute()
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-[95vw] sm:max-w-3xl px-4 pointer-events-none">
      <div className="flex flex-col gap-3 pointer-events-auto">
        {/* Route Info Popup - Solid background for visibility */}
        {routeInfo && (
          <div className="flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-white shadow-2xl rounded-2xl px-6 py-3 flex items-center gap-6 text-sm font-bold text-black/80 border border-white/60">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-black/80" />
                <span>{routeInfo.distance_nm} NM</span>
              </div>
              <div className="w-px h-4 bg-black/80" />
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-black/80" />
                <span>{routeInfo.estimated_time_min} MIN</span>
              </div>
              <div className="w-px h-4 bg-black/80" />
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-black/80" />
                <span className="capitalize">{routeInfo.type.replace('_', ' ')}</span>
              </div>
            </div>
          </div>
        )}

        {/* Main Control Bar - Solid white for contrast */}
        <Card className="border border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.2)] rounded-[2rem] p-2 bg-white/70 backdrop-blur-sm relative">
          <CardContent className="p-0">
            <div className="p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Departure */}
                <div className="flex-1 relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-slate-400 group-focus-within:text-primary transition-colors">
                    <PlaneTakeoff className="w-4 h-4 text-black/80" />
                  </div>
                  <AirportSearch
                    key={`dep-${resetKey}`}
                    onSelect={setDeparture}
                    placeholder="Departure"
                    initialValue={initialDeparture}
                    className="pl-9 [&_input]:h-12 [&_input]:rounded-2xl [&_input]:bg-slate-50 [&_input]:border-slate-200 [&_input]:placeholder:text-slate-400"
                  />
                </div>

                {/* Icon Separator */}
                <div className="hidden sm:flex items-center justify-center text-black/80 ml-2">
                  <ArrowRight className="w-4 h-4" />
                </div>

                {/* Destination */}
                <div className="flex-1 relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-slate-400 group-focus-within:text-primary transition-colors">
                    <PlaneLanding className="w-4 h-4 text-black/80" />
                  </div>
                  <AirportSearch
                    key={`dest-${resetKey}`}
                    onSelect={setDestination}
                    placeholder="Destination"
                    initialValue={initialDestination}
                    className="pl-9 [&_input]:h-12 [&_input]:rounded-2xl [&_input]:bg-slate-50 [&_input]:border-slate-200 [&_input]:placeholder:text-slate-400"
                  />
                </div>

                {/* Actions Bar */}
                <div className="flex items-center gap-2 pt-2 sm:pt-0">
                  <Button
                    variant="outline"
                    size="icon"
                    className={cn(
                      "h-12 w-12 rounded-2xl transition-all duration-300",
                      showCloudLayer ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-400"
                    )}
                    onClick={onToggleCloudLayer}
                    title={showCloudLayer ? "Hide Cloud Layer" : "Show Cloud Layer"}
                  >
                    {showCloudLayer ? <Cloud className="w-5 h-5" /> : <CloudOff className="w-5 h-5" />}
                  </Button>

                  <Button
                    variant="outline"
                    size="icon"
                    className={cn(
                      "h-12 w-12 rounded-2xl transition-all duration-300",
                      showWindLayer ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-400"
                    )}
                    onClick={onToggleWindLayer}
                    title={showWindLayer ? "Hide Wind Barbs" : "Show Wind Barbs"}
                  >
                    <Wind className="w-5 h-5" />
                  </Button>

                  <Button
                    variant="outline"
                    size="icon"
                    className={cn(
                      "h-12 w-12 rounded-2xl transition-all duration-300",
                      showSettings ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 hover:bg-slate-50"
                    )}
                    onClick={() => setShowSettings(!showSettings)}
                  >
                    <Settings2 className="w-5 h-5" />
                  </Button>

                  {routeInfo && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-12 w-12 rounded-2xl bg-white border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                      onClick={handleClearAll}
                      disabled={isCalculating}
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  )}

                  {!routeInfo && (
                    <Button
                      onClick={handlePlanRoute}
                      disabled={isCalculating || !departure || !destination || departure.id === destination.id}
                      className="h-12 px-8 rounded-2xl font-bold bg-green-500/80 hover:bg-green-600/80 text-white border-green-500/40 hover:border-green-600/40 shadow-lg active:scale-95 transition-all"
                    >
                      {isCalculating ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                          <span>Planning...</span>
                        </div>
                      ) : (
                        <span>Plan Route</span>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {/* Settings Panel */}
              <div className={cn(
                "grid transition-all duration-300 ease-in-out",
                showSettings ? "grid-rows-[1fr] opacity-100 mt-4" : "grid-rows-[0fr] opacity-0"
              )}>
                <div className="overflow-hidden">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="maxSegment" className="text-sm font-bold text-slate-700">
                        Max Segment Length
                      </Label>
                      <span className="text-xs font-bold text-primary bg-white px-3 py-1 rounded-full border border-slate-200">
                        {maxSegmentLength || 'Default'} NM
                      </span>
                    </div>
                    <input
                      id="maxSegment"
                      type="range"
                      min="10"
                      max="500"
                      step="10"
                      value={maxSegmentLength || ''}
                      onChange={(e) => setMaxSegmentLength(e.target.value)}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
