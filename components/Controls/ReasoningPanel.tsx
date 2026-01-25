'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { RouteReasoningResponse } from '@/lib/api/gemini'

interface ReasoningPanelProps {
  reasoning: RouteReasoningResponse | null
  isLoading: boolean
  isVisible: boolean
  onToggle: () => void
  weather?: Array<{
    station: string
    metar: any | null
    taf: any | null
  }>
}

export default function ReasoningPanel({
  reasoning,
  isLoading,
  isVisible,
  onToggle,
  weather,
}: ReasoningPanelProps) {
  return (
    <Card className="absolute top-0 right-0 z-10 bg-white shadow-lg w-96 max-h-[calc(100vh-2rem)] flex flex-col rounded-none">
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Route Reasoning</CardTitle>
            <p className="text-xs text-muted-foreground">
              AI-generated flight instructor analysis
            </p>
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
        <CardContent className="flex-1 overflow-y-auto">
            {isLoading && (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                <p className="text-sm text-muted-foreground">
                  Analyzing route constraints...
                </p>
              </div>
            )}

            {!isLoading && reasoning && (
              <div className="space-y-4">
                <StructuredReasoningDisplay reasoning={reasoning} weather={weather} />
              </div>
            )}

            {!isLoading && !reasoning && (
              <div className="flex items-center justify-center h-full text-center">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Plan a route to see AI reasoning
                  </p>
                  <p className="text-xs text-muted-foreground">
                    The system will explain why each routing decision was made
                  </p>
                </div>
              </div>
            )}
        </CardContent>
      )}
    </Card>
  )
}

/**
 * Component to display structured reasoning response
 */
function StructuredReasoningDisplay({
  reasoning,
  weather
}: {
  reasoning: RouteReasoningResponse
  weather?: Array<{
    station: string
    metar: any | null
    taf: any | null
  }>
}) {
  const { Altitude, Issues, Segment_Analysis, Mag_Heading, Go_NoGo, Go_NoGo_Reasoning } = reasoning

  return (
    <div className="space-y-4 text-sm">
      {/* Go/No-Go Decision */}
      <div className={`p-3 rounded-lg ${Go_NoGo ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-base">Go / No-Go Decision</h3>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${Go_NoGo ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
            {Go_NoGo ? 'GO' : 'NO-GO'}
          </span>
        </div>
        <p className="text-sm leading-relaxed">{Go_NoGo_Reasoning}</p>
      </div>

      {/* Cruise Altitude */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-sm mb-1">Recommended Cruise Altitude</h3>
        <p className="text-2xl font-bold text-blue-700">{Altitude.toLocaleString()}' MSL</p>
        <p className="text-xs text-muted-foreground mt-1">
          Based on hemispheric altitude rule (VFR)
        </p>
      </div>

      {/* Weather Section */}
      {weather && weather.length > 0 && (
        <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <span className="text-sky-600">☁️</span>
            Weather Observations
          </h3>
          <div className="space-y-3">
            {weather.map((station, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs bg-sky-200 px-2 py-1 rounded">
                    {station.station}
                  </span>
                </div>

                {/* METAR Display */}
                {station.metar ? (
                  <div className="bg-white p-2 rounded border border-sky-100">
                    <p className="text-xs font-semibold text-sky-700 mb-1">METAR</p>
                    <p className="text-xs font-mono text-gray-700 leading-relaxed">
                      {station.metar.rawOb || station.metar.raw_text || 'No data available'}
                    </p>
                    {station.metar.flightCategory && (
                      <div className="mt-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          station.metar.flightCategory === 'VFR' ? 'bg-green-100 text-green-700' :
                          station.metar.flightCategory === 'MVFR' ? 'bg-yellow-100 text-yellow-700' :
                          station.metar.flightCategory === 'IFR' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {station.metar.flightCategory}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-50 p-2 rounded border border-gray-200">
                    <p className="text-xs text-gray-500">No METAR available</p>
                  </div>
                )}

                {/* TAF Display */}
                {station.taf ? (
                  <div className="bg-white p-2 rounded border border-sky-100">
                    <p className="text-xs font-semibold text-sky-700 mb-1">TAF (Forecast)</p>
                    <p className="text-xs font-mono text-gray-700 leading-relaxed">
                      {station.taf.rawTAF || station.taf.raw_text || 'No data available'}
                    </p>
                  </div>
                ) : (
                  <div className="bg-gray-50 p-2 rounded border border-gray-200">
                    <p className="text-xs text-gray-500">No TAF available</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Magnetic Headings */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
        <h3 className="font-semibold text-sm mb-2">Magnetic Headings</h3>
        <div className="flex flex-wrap gap-2">
          {Mag_Heading.map((heading, idx) => (
            <div key={idx} className="flex items-center gap-1">
              <span className="px-2 py-1 bg-slate-200 rounded text-xs font-mono font-semibold">
                {heading.toString().padStart(3, '0')}°
              </span>
              {idx < Mag_Heading.length - 1 && (
                <span className="text-muted-foreground text-xs">→</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Segment Analysis */}
      <div className="space-y-2">
        <h3 className="font-semibold text-base">Segment Analysis</h3>
        {Segment_Analysis.map((segment, idx) => (
          <div key={idx} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-start gap-2">
              <span className="flex-shrink-0 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold">
                {idx + 1}
              </span>
              <p className="text-sm leading-relaxed flex-1">{segment}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Issues and Considerations */}
      {Issues && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <span className="text-amber-600">⚠️</span>
            Potential Issues & Considerations
          </h3>
          <p className="text-sm leading-relaxed">{Issues}</p>
        </div>
      )}
    </div>
  )
}
