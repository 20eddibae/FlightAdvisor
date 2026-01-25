'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface SaveFlightButtonProps {
  departure: string
  arrival: string
  departureName?: string
  arrivalName?: string
  routeData: any // The route data from teammates' code
  weather: any   // The weather data from teammates' code
  disabled?: boolean
}

export default function SaveFlightButton({
  departure,
  arrival,
  departureName,
  arrivalName,
  routeData,
  weather,
  disabled = false,
}: SaveFlightButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [flightDate, setFlightDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!email || !flightDate) {
      setError('Please fill in all required fields')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const payload = {
        pilot_email: email,
        pilot_name: name || undefined,
        departure: departureName || departure,
        arrival: arrivalName || arrival,
        flight_date: new Date(flightDate).toISOString(),
        route_data: {
          ...routeData,
          departure_id: departure,
          arrival_id: arrival,
          departure_name: departureName,
          arrival_name: arrivalName,
        },
        baseline_weather: weather,
      }

      console.log('Saving flight to Supabase:', payload)

      const response = await fetch('/api/watch-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      console.log('API response:', response.status, data)

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save flight')
      }

      console.log('Flight saved successfully:', data.flight?.id)
      setSaved(true)
      // Store email in localStorage for easy retrieval
      localStorage.setItem('flightadvisor_pilot_email', email)
      if (name) localStorage.setItem('flightadvisor_pilot_name', name)
    } catch (err) {
      console.error('Save flight error:', err)
      setError(err instanceof Error ? err.message : 'Failed to save flight')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    // Reset state after a delay to avoid visual flicker
    setTimeout(() => {
      if (saved) {
        setSaved(false)
        setEmail('')
        setFlightDate('')
      }
      setError(null)
    }, 300)
  }

  // Load saved email/name from localStorage on mount
  const handleOpen = () => {
    const savedEmail = localStorage.getItem('flightadvisor_pilot_email')
    const savedName = localStorage.getItem('flightadvisor_pilot_name')
    if (savedEmail) setEmail(savedEmail)
    if (savedName) setName(savedName)
    setIsOpen(true)
  }

  if (!isOpen) {
    return (
      <Button
        onClick={handleOpen}
        disabled={disabled}
        variant="outline"
        className="fixed bottom-20 left-4 z-20 gap-2 bg-white shadow-md"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        Watch Flight
      </Button>
    )
  }

  return (
    <Card className="absolute top-4 right-4 z-20 w-80 bg-white shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            Watch Flight: {departureName || departure} → {arrivalName || arrival}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-6 w-6 p-0"
          >
            ×
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {saved ? (
          <div className="text-center py-4">
            <div className="text-green-600 mb-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mx-auto"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <p className="font-medium">Flight saved!</p>
            <p className="text-sm text-muted-foreground mt-1">
              You'll get an email at <strong>{email}</strong> if weather conditions change.
            </p>
            <Button onClick={handleClose} className="mt-4" size="sm">
              Close
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Get notified if weather changes before your flight.
            </p>

            <div className="space-y-3">
              <div>
                <Label htmlFor="email" className="text-sm">
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="pilot@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="name" className="text-sm">
                  Name (optional)
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="flightDate" className="text-sm">
                  Flight Date/Time <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="flightDate"
                  type="datetime-local"
                  value={flightDate}
                  onChange={(e) => setFlightDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={saving || !email || !flightDate}
                className="flex-1"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Saving...
                  </>
                ) : (
                  'Enable Alerts'
                )}
              </Button>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            </div>

            
          </>
        )}
      </CardContent>
    </Card>
  )
}
