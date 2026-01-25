/**
 * Airport Search Component
 * Autocomplete search input with keyboard navigation
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAirportCache } from '@/components/Cache/AirportCacheProvider';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import type { CachedAirport } from '@/lib/cache/types';
import { CACHE_CONFIG } from '@/lib/constants';

interface AirportSearchProps {
  onSelect: (airport: CachedAirport) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  initialValue?: string;
  className?: string;
}

export function AirportSearch({
  onSelect,
  placeholder = 'Search by code or name...',
  disabled = false,
  autoFocus = false,
  initialValue = '',
  className = '',
}: AirportSearchProps) {
  const { searchAirports, getAirportById, isInitialized } = useAirportCache();
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState<CachedAirport[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hasAutoSelectedRef = useRef(false);

  // Initialize with default value if provided and auto-select it
  useEffect(() => {
    // Only run once when cache becomes initialized
    if (!hasAutoSelectedRef.current && initialValue && isInitialized && getAirportById) {
      console.log(`Attempting to auto-select airport: ${initialValue}`);
      
      // Try to find airport immediately
      let airport = getAirportById(initialValue);

      if (airport) {
        console.log(`✓ Auto-selected airport: ${airport.id} - ${airport.name}`);

        // Check if ID is a valid ICAO code or MongoDB ID
        const isICAO = /^[A-Z0-9]{3,5}$/i.test(airport.id);
        const displayText = isICAO ? `${airport.id} - ${airport.name}` : airport.name;

        setQuery(displayText);
        onSelect(airport);
        hasAutoSelectedRef.current = true;
      } else {
        console.log(`Airport ${initialValue} not found immediately, retrying...`);
        // If not found, wait a bit for cache to load regions, then try again
        const timeoutId = setTimeout(() => {
          airport = getAirportById(initialValue);
          if (airport) {
            console.log(`✓ Auto-selected airport (delayed): ${airport.id} - ${airport.name}`);

            const isICAO = /^[A-Z0-9]{3,5}$/i.test(airport.id);
            const displayText = isICAO ? `${airport.id} - ${airport.name}` : airport.name;

            setQuery(displayText);
            onSelect(airport);
          } else {
            console.warn(`⚠ Airport ${initialValue} not found in cache after retry`);
            setQuery(initialValue);
          }
          hasAutoSelectedRef.current = true;
        }, 1500); // Wait 1.5s for regions to load

        return () => clearTimeout(timeoutId);
      }
    } else if (initialValue && !isInitialized) {
      console.log(`Waiting for cache to initialize before auto-selecting ${initialValue}`);
    }
  }, [isInitialized, getAirportById, initialValue, onSelect]); // Include all dependencies

  // Debounced search
  useEffect(() => {
    if (!isInitialized || !query.trim()) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      const searchResults = searchAirports(query, { maxResults: 10 });
      setResults(searchResults);
      setShowDropdown(searchResults.length > 0);
      setSelectedIndex(0);
    }, CACHE_CONFIG.SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [query, searchAirports, isInitialized]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showDropdown) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        handleSelect(results[selectedIndex]);
      } else if (e.key === 'Escape') {
        setShowDropdown(false);
      }
    },
    [showDropdown, results, selectedIndex]
  );

  const handleSelect = useCallback(
    (airport: CachedAirport) => {
      // Check if ID is a MongoDB ObjectId (24 hex characters) vs ICAO code (3-4 letters)
      const isMongoId = airport.id.length === 24 && /^[a-f0-9]{24}$/i.test(airport.id);
      const isICAO = /^[A-Z0-9]{3,5}$/i.test(airport.id);

      // Display format:
      // - If valid ICAO code: "KSQL - San Carlos Airport"
      // - If MongoDB ID: Just "San Carlos Airport" (hide the ugly ID)
      if (isICAO) {
        setQuery(`${airport.id} - ${airport.name}`);
      } else {
        setQuery(airport.name);
      }

      setShowDropdown(false);
      onSelect(airport);
    },
    [onSelect]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // Show dropdown when user starts typing
    if (value.trim() && !showDropdown) {
      setShowDropdown(true);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <Input
        ref={inputRef}
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || !isInitialized}
        autoFocus={autoFocus}
        className="uppercase font-mono"
      />

      {showDropdown && results.length > 0 && (
        <Card
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto border shadow-xl bg-white"
        >
          {results.map((airport, index) => {
            // Check if ID is a valid ICAO code
            const isICAO = /^[A-Z0-9]{3,5}$/i.test(airport.id);

            return (
              <div
                key={airport.id}
                onClick={() => handleSelect(airport)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`px-4 py-3 cursor-pointer transition-colors border-b last:border-b-0 ${
                  index === selectedIndex
                    ? 'bg-blue-50'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="font-semibold text-gray-900">
                  {isICAO ? (
                    <>
                      <span className="font-mono text-blue-600">{airport.id}</span>
                      {' - '}
                      {airport.name}
                    </>
                  ) : (
                    airport.name
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {airport.type === 'towered' ? 'Towered' : 'Non-towered'} • Elevation: {airport.elevation}ft
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {!isInitialized && (
        <div className="text-xs text-muted-foreground mt-1">
          Loading airport database...
        </div>
      )}
    </div>
  );
}
