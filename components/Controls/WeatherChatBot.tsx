'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { RouteReasoningResponse } from '@/lib/api/gemini'
import { Sparkles, Send, ShieldCheck, CloudSun, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

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
          history: [],
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
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <h4 className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Intelligent Analysis</h4>
      </div>

      {/* Quick action buttons */}
      <div className="flex flex-wrap gap-2">
        {[
          { icon: ShieldCheck, label: 'Safety Check', query: 'Is it safe to fly this route?' },
          { icon: CloudSun, label: 'Weather Details', query: 'Explain the weather conditions' },
          { icon: AlertTriangle, label: 'Main Concerns', query: 'What are the main concerns?' },
        ].map((item) => (
          <button
            key={item.label}
            onClick={() => setInput(item.query)}
            disabled={isLoading}
            className="flex items-center gap-2 text-[10px] font-bold px-3 py-1.5 bg-white border border-slate-100 rounded-full text-slate-600 hover:border-primary/30 hover:bg-primary/5 transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            <item.icon className="w-3 h-3 text-slate-400" />
            {item.label}
          </button>
        ))}
      </div>

      {/* Input area */}
      <div className="flex gap-2 p-1.5 bg-white border border-slate-100 rounded-2xl shadow-inner focus-within:border-primary/30 transition-colors">
        <Input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask AI about this route..."
          disabled={isLoading}
          className="border-none bg-transparent focus-visible:ring-0 shadow-none text-xs h-9 placeholder:text-slate-300"
        />
        <Button
          onClick={handleSendMessage}
          disabled={!input.trim() || isLoading}
          size="sm"
          className="h-9 w-9 rounded-xl p-0 flex-shrink-0"
        >
          {isLoading ? (
            <div className="animate-spin rounded-full h-3 w-3 border-2 border-black/30 border-t-black" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  )
}
