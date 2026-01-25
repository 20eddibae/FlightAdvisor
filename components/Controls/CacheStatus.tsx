/**
 * Cache Status Indicator
 * Shows loading progress for cache initialization and regional loading
 * Only displays during active operations to avoid constant re-renders
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useAirportCache } from '@/components/Cache/AirportCacheProvider';

export function CacheStatus() {
  const { status, refreshStatus } = useAirportCache();
  const [showIndicator, setShowIndicator] = useState(false);
  const [displayMessage, setDisplayMessage] = useState('');
  const prevLoadingRef = useRef(false);

  // Only show indicator during initialization or loading
  const isLoading = !status.initialized || status.loadingRegions.length > 0;

  useEffect(() => {
    // Only update display when loading state actually changes
    if (isLoading !== prevLoadingRef.current) {
      prevLoadingRef.current = isLoading;

      if (isLoading) {
        setShowIndicator(true);

        // Update display message
        if (!status.initialized) {
          setDisplayMessage('Initializing airport database...');
        } else if (status.loadingRegions.length > 0) {
          setDisplayMessage(`Loading ${status.loadingRegions[0]}...`);
        }

        // Refresh status only while loading, every 3 seconds (reduced frequency)
        const intervalId = setInterval(() => {
          refreshStatus();
        }, 3000);

        return () => clearInterval(intervalId);
      } else {
        // Hide after a short delay once loading completes
        if (status.totalAirports > 0) {
          setDisplayMessage(`✓ ${status.totalAirports.toLocaleString()} airports ready`);
        }
        const timeoutId = setTimeout(() => setShowIndicator(false), 2000);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [isLoading, status.initialized, status.loadingRegions, status.totalAirports, refreshStatus]);

  if (!showIndicator) return null;

  return (
    <div className="absolute bottom-4 right-4 z-10">
      <Card className="bg-white/70 backdrop-blur shadow-lg">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            {isLoading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
            )}
            <span className="text-sm">{displayMessage}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
