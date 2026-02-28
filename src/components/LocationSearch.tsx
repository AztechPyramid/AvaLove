import { useState, useEffect, useRef } from 'react';
import { MapPin, Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LocationResult {
  display_name: string;
  lat: string;
  lon: string;
  address: {
    country?: string;
    state?: string;
    city?: string;
    town?: string;
    county?: string;
    suburb?: string;
  };
}

interface LocationSearchProps {
  value?: string;
  onLocationSelect: (location: string, latitude: number, longitude: number) => void;
  disabled?: boolean;
  className?: string;
}

export const LocationSearch = ({ value, onLocationSelect, disabled, className }: LocationSearchProps) => {
  const [searchQuery, setSearchQuery] = useState(value || '');
  const [results, setResults] = useState<LocationResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchQuery.length < 3) {
      setResults([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?` +
          `q=${encodeURIComponent(searchQuery)}` +
          `&format=json` +
          `&addressdetails=1` +
          `&limit=5`,
          {
            headers: {
              'Accept-Language': 'en',
            },
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          setResults(data);
          setShowResults(true);
        }
      } catch (error) {
        console.error('Location search error:', error);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const formatDisplayName = (result: LocationResult): string => {
    const parts = [];
    const addr = result.address;
    
    if (addr.suburb) parts.push(addr.suburb);
    if (addr.city || addr.town) parts.push(addr.city || addr.town);
    if (addr.state) parts.push(addr.state);
    if (addr.country) parts.push(addr.country);
    
    return parts.join(', ') || result.display_name;
  };

  const handleSelect = (result: LocationResult) => {
    const displayName = formatDisplayName(result);
    setSearchQuery(displayName);
    setShowResults(false);
    onLocationSelect(displayName, parseFloat(result.lat), parseFloat(result.lon));
  };

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder="Search: Country, City, District..."
          disabled={disabled}
          className="pl-10 pr-10 bg-black border-zinc-700 text-white placeholder:text-zinc-500"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {!isSearching && searchQuery && (
          <MapPin className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {showResults && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-black border border-zinc-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {results.map((result, index) => (
            <button
              key={index}
              onClick={() => handleSelect(result)}
              className="w-full px-4 py-3 text-left hover:bg-zinc-900 transition-colors flex items-start gap-2 border-b border-zinc-800 last:border-0"
            >
              <MapPin className="h-4 w-4 mt-1 flex-shrink-0 text-orange-500" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-white truncate">
                  {formatDisplayName(result)}
                </div>
                <div className="text-xs text-zinc-500 truncate">
                  {result.display_name}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {searchQuery.length > 0 && searchQuery.length < 3 && (
        <p className="text-xs text-muted-foreground mt-1">
          Type at least 3 characters to search
        </p>
      )}
    </div>
  );
};
