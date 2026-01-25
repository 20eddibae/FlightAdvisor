'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { RouteReasoningResponse } from '@/lib/api/gemini'
import WeatherChatBot, { type AnalysisMessage } from './WeatherChatBot'
import { Activity, MessageSquare, Cloud } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  onSegmentSelect?: (index: number | null) => void
}

export default function ReasoningPanel({
  reasoning,
  isLoading,
  weather,
  route,
  onSegmentSelect,
}: ReasoningPanelProps) {
  const [chatMessages, setChatMessages] = useState<AnalysisMessage[]>([])
  const [isChatLoading, setIsChatLoading] = useState(false)

  const handleMessageSent = (message: AnalysisMessage) => {
    setChatMessages(prev => [...prev, message])
  }

  const handleLoadingChange = (loading: boolean) => {
    setIsChatLoading(loading)
  }

  return (
    <Card className={cn(
      "fixed top-0 right-0 z-40 flex flex-col overflow-hidden border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-none",
      "bg-white w-90 h-screen"
    )}>
      <>
        <CardHeader className="p-6 pb-4 border-b border-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl text-primary">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">Route Analysis</CardTitle>
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">AI Flight Intelligence</p>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-0 px-6 scrollbar-none">
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-64">
              <div className="relative w-12 h-12 mb-4">
                <div className="absolute inset-0 border-4 border-primary/20 rounded-full" />
                <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-sm font-medium text-slate-600">Analyzing route constraints...</p>
              <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-tighter">Powered by Gemini AI</p>
            </div>
          )}

          {!isLoading && reasoning && (
            <div className="space-y-6 pb-6">
              <StructuredReasoningDisplay
                reasoning={reasoning}
                weather={weather}
                onSegmentSelect={onSegmentSelect}
              />

              {/* Display chat messages as analysis boxes */}
              {chatMessages.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-slate-400">
                    <MessageSquare className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Analysis History</span>
                  </div>
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className="space-y-2 animate-in fade-in slide-in-from-top-2">
                      {/* Question box */}
                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                        <div className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">Q</div>
                          <p className="text-sm text-slate-700 font-medium">{msg.question}</p>
                        </div>
                      </div>

                      {/* Answer box */}
                      <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">A</div>
                          <p className="text-sm text-slate-600 leading-relaxed">{msg.answer}</p>
                        </div>
                        <p className="text-[10px] text-slate-300 mt-3 font-medium text-right">
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Thinking indicator */}
              {isChatLoading && (
                <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
                    </div>
                    <p className="text-xs text-primary font-bold uppercase tracking-wider">AI is processing...</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {!isLoading && !reasoning && (
            <div className="flex flex-col items-center justify-center h-64 text-center px-4">
              <div className="p-4 bg-slate-50 rounded-3xl mb-4">
                <Activity className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">Waiting for Route</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Plan a route to see real-time AI reasoning about airspace, weather, and safety constraints.
              </p>
            </div>
          )}
        </CardContent>
      </>

      {/* Weather Chatbot area - solid background */}
      {!isLoading && reasoning && (
        <div className="p-4 bg-slate-50 border-t border-slate-100">
          <WeatherChatBot
            reasoning={reasoning}
            weather={weather}
            route={route}
            onMessageSent={handleMessageSent}
            onLoadingChange={handleLoadingChange}
          />
        </div>
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
  weather,
  onSegmentSelect,
}: {
  reasoning: RouteReasoningResponse
  weather?: Array<{
    station: string
    metar: any | null
    taf: any | null
  }>
  onSegmentSelect?: (index: number | null) => void
}) {
  const [selectedSegment, setSelectedSegment] = useState<number | null>(null)
  const { Altitude, Issues, Segment_Analysis, Mag_Heading, Go_NoGo, Go_NoGo_Reasoning } = reasoning

  const handleSegmentClick = (idx: number | null) => {
    setSelectedSegment(idx)
    if (onSegmentSelect) {
      onSegmentSelect(idx)
    }
  }

  // Parse Go/No-Go reasoning into bullet points
  const goNoGoBullets = Go_NoGo_Reasoning.split(/[.;]/).filter(s => s.trim().length > 10).slice(0, 4)

  // Extract segment labels (waypoint names) from segment analysis
  const getSegmentLabel = (segmentText: string, index: number): { from: string; to: string } => {
    // Override last segment to be called "Landing"
    if (index === Segment_Analysis.length - 1) {
      return { from: 'Landing', to: '' }
    }

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
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-white">
        <h3 className="font-bold text-xs uppercase tracking-widest text-slate-400 mb-2">Recommended Cruise</h3>
        <p className="text-3xl font-black text-blue-400">{Altitude?.toLocaleString() ?? 'N/A'}' MSL</p>
        <p className="text-[10px] text-slate-400 mt-2 font-medium">
          Hemispheric VFR Rule
        </p>
      </div>

      {/* Weather Section */}
      {weather && weather.length > 0 ? (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
          <h3 className="font-bold text-xs uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
            <Cloud className="w-3.5 h-3.5" />
            Weather Observations
          </h3>
          <div className="space-y-4">
            {weather.map((station, idx) => {
              const isValidICAO = /^K[A-Z]{3}$/.test(station.station) || /^[A-Z]{4}$/.test(station.station)

              return (
                <div key={idx} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-xs bg-slate-900 text-white px-2 py-1 rounded">
                      {station.station}
                    </span>
                    {!isValidICAO && (
                      <span className="text-[10px] font-bold text-amber-600">⚠ NON-ICAO</span>
                    )}
                  </div>

                  {/* METAR Display */}
                  {station.metar && (
                    <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-2">METAR</p>
                      <p className="text-xs font-mono font-bold text-slate-700 leading-relaxed">
                        {station.metar.rawOb || station.metar.raw_text}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

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
                onClick={() => handleSegmentClick(selectedSegment === idx ? null : idx)}
                className={`flex-shrink-0 py-2 px-2 rounded-lg font-semibold text-sm transition-all ${selectedSegment === idx
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
