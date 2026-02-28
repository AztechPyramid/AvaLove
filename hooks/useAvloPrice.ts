import { useState, useEffect } from 'react';

const AVLO_ADDRESS = '0x54eEeB249E3AE445f21eb006DEbB33eFa2B4b3Bb';
const GECKO_BASE = 'https://api.geckoterminal.com/api/v2';
const CACHE_DURATION = 300000; // 5 minute cache (was 1 min)

interface PriceCache {
  price: number;
  timestamp: number;
}

let priceCache: PriceCache | null = null;

export const useAvloPrice = () => {
  const [price, setPrice] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPrice = async () => {
    // Check cache first
    if (priceCache && Date.now() - priceCache.timestamp < CACHE_DURATION) {
      setPrice(priceCache.price);
      setIsLoading(false);
      return;
    }

    try {
      // Use GeckoTerminal simple price endpoint for AVLO on Avalanche
      const response = await fetch(
        `${GECKO_BASE}/simple/networks/avax/token_price/${AVLO_ADDRESS}`,
        { headers: { 'Accept': 'application/json;version=20230203' } }
      );
      
      if (!response.ok) throw new Error('Failed to fetch price');
      
      const data = await response.json();
      const prices = data?.data?.attributes?.token_prices || {};
      const priceStr = prices[AVLO_ADDRESS.toLowerCase()] || prices[AVLO_ADDRESS];
      
      if (priceStr) {
        const priceUsd = parseFloat(priceStr);
        priceCache = { price: priceUsd, timestamp: Date.now() };
        setPrice(priceUsd);
      }
    } catch (error) {
      console.error('Error fetching AVLO price:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrice();
    
    // Refresh price every minute
    const interval = setInterval(fetchPrice, CACHE_DURATION);
    return () => clearInterval(interval);
  }, []);

  // Format AVLO amount with commas
  const formatAvlo = (amount: number | string): string => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return '0';
    return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  // Format AVLO with USD value
  const formatAvloWithUsd = (amount: number | string): { avlo: string; usd: string } => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return { avlo: '0', usd: '$0.00' };
    
    const avloFormatted = num.toLocaleString('en-US', { maximumFractionDigits: 0 });
    const usdValue = num * price;
    
    let usdFormatted: string;
    if (usdValue >= 1000000) {
      usdFormatted = `$${(usdValue / 1000000).toFixed(2)}M`;
    } else if (usdValue >= 1000) {
      usdFormatted = `$${(usdValue / 1000).toFixed(2)}K`;
    } else if (usdValue >= 0.01) {
      usdFormatted = `$${usdValue.toFixed(2)}`;
    } else if (usdValue > 0) {
      usdFormatted = `$${usdValue.toFixed(6)}`;
    } else {
      usdFormatted = '$0.00';
    }
    
    return { avlo: avloFormatted, usd: usdFormatted };
  };

  return {
    price,
    isLoading,
    formatAvlo,
    formatAvloWithUsd,
    refetch: fetchPrice,
  };
};

// Standalone format function for use without hook
export const formatAvloAmount = (amount: number | string): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0';
  return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
};
