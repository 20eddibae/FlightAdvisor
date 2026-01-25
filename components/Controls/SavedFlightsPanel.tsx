'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface WatchedFlight {
  id: string
  pilot_email: string
  pilot_name?: string
  departure: string
  arrival: string
  flight_date: string
  route_data: any
  baseline_weather: any
  has_alert: boolean
  alert_message?: string
  alert_severity?: 'low' | 'medium' | 'high'
  alert_created_at?: string
  alert_acknowledged: boolean
  is_active: boolean
  created_at: string
}

interface SavedFlightsPanelProps {
  onLoadFlight?: (flight: WatchedFlight) => void
}

export default function SavedFlightsPanel({ onLoadFlight }: SavedFlightsPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [flights, setFlights] = useState<WatchedFlight[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasChecked, setHasChecked] = useState(false)

  const alertCount = flights.filter(f => f.has_alert && !f.alert_acknowledged).length

  const fetchFlights = useCallback(async (emailToFetch: string) => {
    if (!emailToFetch) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/flights?email=${encodeURIComponent(emailToFetch)}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch flights')
      }

      setFlights(data.flights || [])
      setHasChecked(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch flights')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const savedEmail = localStorage.getItem('skyris_pilot_email')
    if (savedEmail) {
      setEmail(savedEmail)
      fetchFlights(savedEmail)
    }
  }, [fetchFlights])

  const handleAcknowledgeAlert = async (flightId: string) => {
    try {
      const response = await fetch(`/api/flights/${flightId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_acknowledged: true }),
      })

      if (response.ok) {
        setFlights(prev =>
          prev.map(f =>
            f.id === flightId ? { ...f, alert_acknowledged: true } : f
          )
        )
      }
    } catch (err) {
      console.error('Failed to acknowledge alert:', err)
    }
  }

  const handleDeleteFlight = async (flightId: string) => {
    try {
      const response = await fetch(`/api/flights/${flightId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setFlights(prev => prev.filter(f => f.id !== flightId))
      }
    } catch (err) {
      console.error('Failed to delete flight:', err)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const getSeverityStyles = (severity?: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-50 border-red-200 ring-1 ring-red-100'
      case 'medium':
        return 'bg-amber-50 border-amber-200 ring-1 ring-amber-100'
      case 'low':
        return 'bg-blue-50 border-blue-200 ring-1 ring-blue-100'
      default:
        return 'bg-white border-gray-200'
    }
  }

  // Plane icon SVG
  const PlaneIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </svg>
  )

  // Floating button when closed
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 z-20 flex items-center gap-2 px-4 py-2.5 bg-white rounded-full shadow-lg border border-gray-200 hover:shadow-xl hover:border-gray-300 transition-all duration-200 group"
      >
        <div className="relative">
          <PlaneIcon className="w-5 h-5 text-gray-600 group-hover:text-blue-600 transition-colors" />
          {alertCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
          )}
        </div>
        <span className="font-medium text-gray-700 group-hover:text-gray-900">My Flights</span>
        {flights.length > 0 && (
          <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">
            {flights.length}
          </span>
        )}
      </button>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-20"
        onClick={() => setIsOpen(false)}
      />

      {/* Panel */}
      <div className="fixed bottom-4 left-4 z-30 w-[380px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <PlaneIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">My Flights</h2>
                <p className="text-xs text-gray-500">
                  {flights.length} saved {flights.length === 1 ? 'flight' : 'flights'}
                  {alertCount > 0 && (
                    <span className="ml-2 text-red-600 font-medium">
                      {alertCount} alert{alertCount > 1 ? 's' : ''}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Email input */}
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 bg-white border-gray-200 focus:border-blue-300 focus:ring-blue-200"
              />
            </div>
            <Button
              onClick={() => {
                localStorage.setItem('skyris_pilot_email', email)
                fetchFlights(email)
              }}
              disabled={loading || !email}
              size="sm"
              className="px-4 bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : 'Load'}
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Empty state */}
          {hasChecked && flights.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="p-4 bg-gray-100 rounded-full mb-4">
                <PlaneIcon className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium mb-1">No flights saved yet</p>
              <p className="text-sm text-gray-400 max-w-[240px]">
                Plan a route and click &quot;Watch Flight&quot; to monitor weather changes
              </p>
            </div>
          )}

          {/* Flights list */}
          <div className="space-y-3">
            {flights.map((flight) => (
              <div
                key={flight.id}
                className={`relative border rounded-xl p-4 transition-all hover:shadow-md ${
                  flight.has_alert && !flight.alert_acknowledged
                    ? getSeverityStyles(flight.alert_severity)
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Alert banner */}
                {flight.has_alert && !flight.alert_acknowledged && (
                  <div className="mb-3 pb-3 border-b border-current/10">
                    <div className="flex items-start gap-2">
                      <div className={`p-1.5 rounded-lg ${
                        flight.alert_severity === 'high' ? 'bg-red-100' :
                        flight.alert_severity === 'medium' ? 'bg-amber-100' : 'bg-blue-100'
                      }`}>
                        <svg className={`w-4 h-4 ${
                          flight.alert_severity === 'high' ? 'text-red-600' :
                          flight.alert_severity === 'medium' ? 'text-amber-600' : 'text-blue-600'
                        }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${
                          flight.alert_severity === 'high' ? 'text-red-700' :
                          flight.alert_severity === 'medium' ? 'text-amber-700' : 'text-blue-700'
                        }`}>
                          Weather Alert
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{flight.alert_message}</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAcknowledgeAlert(flight.id)}
                      className="mt-2 w-full text-xs h-8 bg-white/50"
                    >
                      Dismiss Alert
                    </Button>
                  </div>
                )}

                {/* Flight route */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900 truncate">
                        {flight.route_data?.departure_name || flight.departure}
                      </span>
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                      <span className="font-semibold text-gray-900 truncate">
                        {flight.route_data?.arrival_name || flight.arrival}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>{formatDate(flight.flight_date)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {onLoadFlight && (
                      <button
                        onClick={() => onLoadFlight(flight)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Load route"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteFlight(flight.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete flight"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Acknowledged badge */}
                {flight.has_alert && flight.alert_acknowledged && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Alert acknowledged
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
          <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Weather checked every 30 min
          </p>
        </div>
      </div>
    </>
  )
}
