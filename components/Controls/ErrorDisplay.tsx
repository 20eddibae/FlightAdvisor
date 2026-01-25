'use client'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

interface ErrorDisplayProps {
  title: string
  message: string
  onRetry?: () => void
  onDismiss?: () => void
}

export default function ErrorDisplay({
  title,
  message,
  onRetry,
  onDismiss,
}: ErrorDisplayProps) {
  return (
    <div className="absolute top-4  left-1/2 transform -translate-x-1/2 w-96 z-20">
      <Alert className='bg-white/70 backdrop-blur-sm' variant="destructive">
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>
          <p className="mb-3">{message}</p>
          <div className="flex gap-2">
            {onRetry && (
              <Button
                onClick={onRetry}
                variant="outline"
                size="sm"
                className="bg-background"
              >
                Retry
              </Button>
            )}
            {onDismiss && (
              <Button
                onClick={onDismiss}
                variant="outline"
                size="sm"
                className="bg-background"
              >
                Dismiss
              </Button>
            )}
          </div>
        </AlertDescription>
      </Alert>
    </div>
  )
}
