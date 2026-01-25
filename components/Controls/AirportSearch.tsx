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
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

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
      let airport = getAirportById(initialValue);

      if (airport) {
        const isICAO = /^[A-Z0-9]{3,5}$/i.test(airport.id);
        const displayText = isICAO ? `${airport.id} - ${airport.name}` : airport.name;

        setQuery(displayText);
        onSelect(airport);
        hasAutoSelectedRef.current = true;
      } else {
        const timeoutId = setTimeout(() => {
          airport = getAirportById(initialValue);
          if (airport) {
            const isICAO = /^[A-Z0-9]{3,5}$/i.test(airport.id);
            const displayText = isICAO ? `${airport.id} - ${airport.name}` : airport.name;

            setQuery(displayText);
            onSelect(airport);
          } else {
            setQuery(initialValue);
          }
          hasAutoSelectedRef.current = true;
        }, 1500);

        return () => clearTimeout(timeoutId);
      }
    } else if (initialValue && !isInitialized) {
      // Waiting for initialization
    }
  }, [isInitialized, getAirportById, initialValue, onSelect]);

  // Debounced search
  useEffect(() => {
    if (!isInitialized || !query.trim()) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      const searchResults = searchAirports(query, { maxResults: 50 });
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
      const isICAO = /^[A-Z0-9]{3,5}$/i.test(airport.id);

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

    if (value.trim() && !showDropdown) {
      setShowDropdown(true);
    }
  };

  return (
    <div className={cn("relative z-[60]", className)}>
      {showDropdown && results.length > 0 && (
        <Card
          ref={dropdownRef}
          className="absolute bottom-full left-0 sm:left-auto sm:right-0 sm:min-w-[400px] w-full mb-3 max-h-80 overflow-y-auto border border-slate-200 shadow-2xl bg-white rounded-2xl p-2 animate-in fade-in slide-in-from-bottom-2 duration-300 z-[100]"
        >
          {results.map((airport, index) => {
            const isICAO = /^[A-Z0-9]{3,5}$/i.test(airport.id);

            return (
              <div
                key={airport.id}
                onClick={() => handleSelect(airport)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={cn(
                  "px-4 py-3 cursor-pointer transition-colors duration-200 rounded-xl mb-1 last:mb-0",
                  index === selectedIndex
                    ? 'bg-black/10'
                    : 'hover:bg-black/5 text-slate-700'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg",
                    index === selectedIndex ? "bg-black/5" : "bg-slate-100"
                  )}>
                    <MapPin className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold flex items-start gap-2">
                      {isICAO && (
                        <span className={cn(
                          "font-mono text-[10px] px-1.5 py-0.5 rounded shrink-0 mt-0.5",
                          index === selectedIndex ? "bg-slate-200" : "bg-slate-100 text-slate-600"
                        )}>
                          {airport.id}
                        </span>
                      )}
                      <span className="text-sm text-slate-900 break-words leading-tight">{airport.name}</span>
                    </div>
                    <div className={cn(
                      "text-[10px] mt-0.5 font-bold",
                      index === selectedIndex ? "text-slate-600" : "text-slate-400"
                    )}>
                      {airport.type === 'towered' ? 'Towered' : 'Non-towered'} • Elev: {airport.elevation}ft
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      <Input
        ref={inputRef}
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || !isInitialized}
        autoFocus={autoFocus}
        className={cn(
          "uppercase font-bold transition-all duration-300",
          "bg-white border-slate-200 hover:bg-black/5 focus:bg-white",
          "shadow-sm focus:shadow-md h-12 rounded-2xl",
          "placeholder:text-slate-400 text-slate-700"
        )}
      />

      {!isInitialized && query.trim() && (
        <div className="absolute top-full left-0 mt-2 px-3 py-1.5 bg-white shadow-lg rounded-full border text-[10px] font-bold text-slate-500 flex items-center gap-2 z-10">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
          DATABASE LOADING...
        </div>
      )}
    </div>
  );
}
