'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { RouteReasoningResponse } from '@/lib/api/gemini'
import WeatherChatBot, { type AnalysisMessage } from './WeatherChatBot'

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
  route?: {
    departure: string
    arrival: string
    distance_nm: number
    estimated_time_min: number
  }
}

export default function ReasoningPanel({
  reasoning,
  isLoading,
  isVisible,
  onToggle,
  weather,
  route,
}: ReasoningPanelProps) {
  const [chatMessages, setChatMessages] = useState<AnalysisMessage[]>([])
  const [isChatLoading, setIsChatLoading] = useState(false)

  console.log('🎯 ReasoningPanel render - weather:', weather, 'reasoning:', reasoning ? 'present' : 'null', 'isVisible:', isVisible)

  const handleMessageSent = (message: AnalysisMessage) => {
    setChatMessages(prev => [...prev, message])
  }

  const handleLoadingChange = (loading: boolean) => {
    setIsChatLoading(loading)
  }

  return (
    <Card className="absolute top-0 right-0 z-10 bg-white shadow-lg w-96 max-h-[calc(100vh-2rem)] flex flex-col rounded-none">
      <CardHeader className="cursor-pointer flex-shrink-0" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Route Analysis</CardTitle>
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
        <>
          <CardContent className="flex-1 overflow-y-auto min-h-0">
              {isLoading && (
                <div className="flex flex-col items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                  <p className="text-sm text-muted-foreground">
                    Analyzing route constraints...
                  </p>
                </div>
              )}

              {!isLoading && reasoning && (
                <div className="space-y-4 pb-4">
                  <StructuredReasoningDisplay reasoning={reasoning} weather={weather} />

                  {/* Display chat messages as analysis boxes */}
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className="space-y-2">
                      {/* Question box */}
                      <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <span className="text-indigo-600 font-semibold text-xs mt-0.5">Q:</span>
                          <p className="text-sm text-indigo-900 flex-1">{msg.question}</p>
                        </div>
                      </div>

                      {/* Answer box */}
                      <div className="p-3 bg-white border border-gray-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <span className="text-green-600 font-semibold text-xs mt-0.5">A:</span>
                          <p className="text-sm text-gray-800 flex-1 leading-relaxed">{msg.answer}</p>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2 text-right">
                          {msg.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Thinking indicator */}
                  {isChatLoading && (
                    <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                        <p className="text-xs text-blue-700 font-medium">Analyzing your question...</p>
                      </div>
                    </div>
                  )}
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

          {/* Weather Chatbot - only show when reasoning is available */}
          {!isLoading && reasoning && (
            <div className="flex-shrink-0">
              <WeatherChatBot
                reasoning={reasoning}
                weather={weather}
                route={route}
                onMessageSent={handleMessageSent}
                onLoadingChange={handleLoadingChange}
              />
            </div>
          )}
        </>
      )}
    </Card>
  )
}

function formatWind(metar: { wdir?: number | null; wspd?: number | null; wgst?: number | null }): string {
  const wspd = metar.wspd ?? 0
  const wdir = metar.wdir ?? 0
  if (wspd === 0) return 'Calm'
  const dir = typeof wdir === 'number' && !Number.isNaN(wdir) ? `${String(wdir).padStart(3, '0')}°` : 'VRB'
  const gust = typeof metar.wgst === 'number' && !Number.isNaN(metar.wgst) && metar.wgst > wspd
    ? ` gust ${metar.wgst}`
    : ''
  return `${dir} at ${wspd} kt${gust}`
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
  const [selectedSegment, setSelectedSegment] = useState<number | null>(null)
  const { Altitude, Issues, Segment_Analysis, Mag_Heading, Go_NoGo, Go_NoGo_Reasoning } = reasoning

  // Debug: Log weather prop
  console.log('🌤️ StructuredReasoningDisplay weather prop:', weather)

  // Parse Go/No-Go reasoning into bullet points
  const goNoGoBullets = Go_NoGo_Reasoning.split(/[.;]/).filter(s => s.trim().length > 10).slice(0, 4)

  // Extract segment labels (waypoint names) from segment analysis
  const getSegmentLabel = (segmentText: string, index: number): { from: string; to: string } => {
    // Try to match patterns like "KSQL to SUNOL", "Segment 1: KSQL to SUNOL", etc.
    const toPattern = /\b([A-Z]{3,5})\s+(?:to|→|-)\s+([A-Z]{3,5})\b/i
    const match = segmentText.match(toPattern)

    if (match) {
      return { from: match[1], to: match[2] }
    }

    // Fallback: try to find any airport codes
    const codes = segmentText.match(/\b[A-Z]{3,5}\b/g) || []
    if (codes.length >= 2 && codes[0] && codes[1]) {
      return { from: codes[0], to: codes[1] }
    }

    // Last resort: use segment number
    return { from: `Seg ${index + 1}`, to: '' }
  }

  // Function to highlight airports and waypoints in text
  const highlightText = (text: string) => {
    // Match airport codes (K + 3 letters) and waypoint names
    const parts = text.split(/(\b[A-Z]{3,5}\b|\d+['']?\s*(?:MSL|AGL|nm|NM|ft|FT))/g)
    return parts.map((part, idx) => {
      if (/^[A-Z]{3,5}$/.test(part)) {
        return <span key={idx} className="font-bold text-blue-700 bg-blue-100 px-1 rounded">{part}</span>
      } else if (/\d+['']?\s*(?:MSL|AGL|nm|NM|ft|FT)/.test(part)) {
        return <span key={idx} className="font-semibold text-amber-700">{part}</span>
      }
      return <span key={idx}>{part}</span>
    })
  }

  return (
    <div className="space-y-4 text-sm">
      {/* Go/No-Go Decision - Compact with bullets */}
      <div className={`p-3 rounded-lg ${Go_NoGo ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">Go / No-Go</h3>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${Go_NoGo ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
            {Go_NoGo ? 'GO' : 'NO-GO'}
          </span>
        </div>
        <ul className="space-y-1 text-xs">
          {goNoGoBullets.map((bullet, idx) => (
            <li key={idx} className="flex gap-2">
              <span className={Go_NoGo ? 'text-green-600' : 'text-red-600'}>•</span>
              <span className="flex-1">{highlightText(bullet.trim())}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Cruise Altitude */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-sm mb-1">Recommended Cruise Altitude</h3>
        <p className="text-2xl font-bold text-blue-700">{Altitude?.toLocaleString() ?? 'N/A'}' MSL</p>
        <p className="text-xs text-muted-foreground mt-1">
          Based on hemispheric altitude rule (VFR)
        </p>
      </div>

      {/* Weather Section */}
      {weather && weather.length > 0 ? (
        <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <span className="text-sky-600">☁️</span>
            Weather Observations ({weather.length} stations)
          </h3>
          <div className="space-y-3">
            {weather.map((station, idx) => {
              // Check if station ID looks like a valid ICAO code
              const isValidICAO = /^K[A-Z]{3}$/.test(station.station) || /^[A-Z]{4}$/.test(station.station)

              return (
              <div key={idx} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs bg-sky-200 px-2 py-1 rounded">
                    {station.station}
                  </span>
                  {!isValidICAO && (
                    <span className="text-xs text-amber-600">⚠️ Non-ICAO ID</span>
                  )}
                </div>

                {/* METAR Display */}
                {station.metar ? (
                  <div className="bg-white p-2 rounded border border-sky-100">
                    <p className="text-xs font-semibold text-sky-700 mb-1">METAR</p>
                    <p className="text-xs font-mono text-gray-700 leading-relaxed">
                      {station.metar.rawOb || station.metar.raw_text || 'No data available'}
                    </p>
                    {(station.metar.fltCat || station.metar.flightCategory) && (
                      <div className="mt-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          (station.metar.fltCat || station.metar.flightCategory) === 'VFR' ? 'bg-green-100 text-green-700' :
                          (station.metar.fltCat || station.metar.flightCategory) === 'MVFR' ? 'bg-yellow-100 text-yellow-700' :
                          (station.metar.fltCat || station.metar.flightCategory) === 'IFR' ? 'bg-red-100 text-red-700' :
                          (station.metar.fltCat || station.metar.flightCategory) === 'LIFR' ? 'bg-purple-100 text-purple-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {station.metar.fltCat || station.metar.flightCategory}
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
            )
            })}
          </div>
        </div>
      ) : (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-xs text-gray-500">
            Weather data: {weather ? `Array with ${weather.length} items` : 'undefined/null'}
          </p>
        </div>
      )}

      {/* Segment Analysis - Interactive GUI */}
      <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <h3 className="font-semibold text-sm mb-3">Route Segments</h3>

        {/* Segment Navigator */}
        <div className="flex gap-2 mb-3 pb-3 border-b border-gray-300 overflow-x-auto">
          {Segment_Analysis.map((segment, idx) => {
            const label = getSegmentLabel(segment, idx)
            return (
              <button
                key={idx}
                onClick={() => setSelectedSegment(selectedSegment === idx ? null : idx)}
                className={`flex-shrink-0 py-2 px-2 rounded-lg font-semibold text-sm transition-all ${
                  selectedSegment === idx
                    ? 'bg-blue-600 text-white shadow-lg scale-105'
                    : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-blue-400 hover:bg-blue-50'
                }`}
              >
                <div className="flex flex-col items-center min-w-[60px]">
                  <div className="text-[10px] font-bold leading-tight text-center">
                    {label.from}
                    {label.to && (
                      <>
                        <div className="text-[8px] opacity-60">→</div>
                        <div>{label.to}</div>
                      </>
                    )}
                  </div>
                  {Mag_Heading[idx] !== undefined && (
                    <span className="text-[9px] opacity-75 mt-0.5">{Mag_Heading[idx]}°</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Selected Segment Details */}
        {selectedSegment !== null ? (
          <div className="bg-white p-3 rounded-lg border border-blue-200 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                {selectedSegment + 1}
              </div>
              <div className="text-xs text-gray-500">
                Heading: <span className="font-bold text-gray-700">{Mag_Heading[selectedSegment]}°</span>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-gray-800">
              {highlightText(Segment_Analysis[selectedSegment])}
            </p>
          </div>
        ) : (
          <div className="text-center py-4 text-xs text-gray-500">
            Click a segment number above to view details
          </div>
        )}
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
