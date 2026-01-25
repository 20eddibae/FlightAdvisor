'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface ReasoningPanelProps {
  reasoning: string | null
  isLoading: boolean
  isVisible: boolean
  onToggle: () => void
}

export default function ReasoningPanel({
  reasoning,
  isLoading,
  isVisible,
  onToggle,
}: ReasoningPanelProps) {
  if (!isVisible && !reasoning && !isLoading) {
    return null
  }

  return (
    <>
      {/* Toggle Button */}
      <Button
        onClick={onToggle}
        className="absolute top-4 right-4 z-20"
        variant={isVisible ? 'secondary' : 'default'}
      >
        {isVisible ? 'Hide' : 'Show'} Reasoning
      </Button>

      {/* Reasoning Panel */}
      {isVisible && (
        <Card className="absolute top-16 right-4 bottom-4 w-96 shadow-lg z-10 overflow-hidden flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Route Reasoning</CardTitle>
            <p className="text-xs text-muted-foreground">
              AI-generated flight instructor explanations
            </p>
          </CardHeader>
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
              <div className="prose prose-sm max-w-none">
                <ReasoningContent content={reasoning} />
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
        </Card>
      )}
    </>
  )
}

/**
 * Component to render formatted reasoning content
 * Supports markdown-like formatting
 */
function ReasoningContent({ content }: { content: string }) {
  // Split content by double newlines to create paragraphs
  const sections = content.split('\n\n').filter(Boolean)

  return (
    <div className="space-y-4 text-sm">
      {sections.map((section, index) => {
        // Check if section is a heading (starts with ##)
        if (section.startsWith('## ')) {
          const headingText = section.replace('## ', '')
          return (
            <h3 key={index} className="font-semibold text-base mt-4 mb-2">
              {headingText}
            </h3>
          )
        }

        // Check if section is a subheading (starts with ###)
        if (section.startsWith('### ')) {
          const subheadingText = section.replace('### ', '')
          return (
            <h4 key={index} className="font-medium text-sm mt-3 mb-1">
              {subheadingText}
            </h4>
          )
        }

        // Check if section is a list (lines start with -)
        if (section.includes('\n-')) {
          const lines = section.split('\n').filter(Boolean)
          const items = lines.filter((line) => line.trim().startsWith('-'))

          return (
            <ul key={index} className="list-disc list-inside space-y-1 ml-2">
              {items.map((item, i) => (
                <li key={i} className="text-sm">
                  {item.replace(/^-\s*/, '')}
                </li>
              ))}
            </ul>
          )
        }

        // Regular paragraph with bold/italic support
        const formattedSection = section
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/\*([^*]+)\*/g, '<em>$1</em>')

        return (
          <p
            key={index}
            className="text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: formattedSection }}
          />
        )
      })}
    </div>
  )
}
