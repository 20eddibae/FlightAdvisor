'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { RouteReasoningResponse } from '@/lib/api/gemini'

export interface AnalysisMessage {
  id: string
  question: string
  answer: string
  timestamp: Date
}

interface WeatherChatBotProps {
  reasoning: RouteReasoningResponse | null
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
  onMessageSent: (message: AnalysisMessage) => void
  onLoadingChange?: (isLoading: boolean) => void
}

export default function WeatherChatBot({
  reasoning,
  weather,
  route,
  onMessageSent,
  onLoadingChange
}: WeatherChatBotProps) {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return

    const question = input.trim()
    setInput('')
    setIsLoading(true)
    onLoadingChange?.(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: question,
          context: {
            reasoning,
            weather,
            route,
          },
          history: [], // No history needed since it's visible above
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const analysisMessage: AnalysisMessage = {
          id: Date.now().toString(),
          question: question,
          answer: data.response,
          timestamp: new Date()
        }
        onMessageSent(analysisMessage)
      } else {
        throw new Error('Failed to get response')
      }
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage: AnalysisMessage = {
        id: Date.now().toString(),
        question: question,
        answer: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }
      onMessageSent(errorMessage)
    } finally {
      setIsLoading(false)
      onLoadingChange?.(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="border-t-2 border-blue-200 bg-blue-50 p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
        <h4 className="text-xs font-semibold text-gray-800">Ask Questions</h4>
      </div>

      <p className="text-[10px] text-gray-600 mb-2">
        Your questions and answers will appear as analysis boxes above
      </p>

      {/* Quick action buttons */}
      <div className="flex flex-wrap gap-1 mb-2">
        <button
          onClick={() => setInput('Is it safe to fly this route?')}
          disabled={isLoading}
          className="text-[10px] px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded border border-blue-300 disabled:opacity-50"
        >
          Safety check
        </button>
        <button
          onClick={() => setInput('Explain the weather conditions')}
          disabled={isLoading}
          className="text-[10px] px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded border border-blue-300 disabled:opacity-50"
        >
          Weather details
        </button>
        <button
          onClick={() => setInput('What are the main concerns?')}
          disabled={isLoading}
          className="text-[10px] px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded border border-blue-300 disabled:opacity-50"
        >
          Main concerns
        </button>
      </div>

      {/* Input area */}
      <div className="flex gap-2">
        <Input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about weather, safety, or alternatives..."
          disabled={isLoading}
          className="text-xs h-8 bg-white"
        />
        <Button
          onClick={handleSendMessage}
          disabled={!input.trim() || isLoading}
          size="sm"
          className="h-8 px-3 text-xs"
        >
          {isLoading ? (
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
          ) : (
            'Ask'
          )}
        </Button>
      </div>
    </div>
  )
}
