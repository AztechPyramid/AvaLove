import { useState, useEffect, useMemo, useCallback } from "react";
import { Search, Star, TrendingUp, TrendingDown, ExternalLink, Copy, RefreshCw, CandlestickChart, Loader2, Flame, Shield, BarChart3, Activity, DollarSign, Percent } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import avaxLogo from "@/assets/avax-logo.png";
import avloLogo from "@/assets/avlo-logo.jpg";
import { motion } from "framer-motion";

// Types for DexScreener API
interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
}

interface Liquidity {
  usd: number;
  base: number;
  quote: number;
}

interface PriceChange {
  m5?: number;
  h1?: number;
  h6?: number;
  h24?: number;
}

interface Volume {
  m5?: number;
  h1?: number;
  h6?: number;
  h24?: number;
}

interface Txns {
  m5?: { buys: number; sells: number };
  h1?: { buys: number; sells: number };
  h6?: { buys: number; sells: number };
  h24?: { buys: number; sells: number };
}

interface PairInfo {
  imageUrl?: string;
  header?: string;
  openGraph?: string;
  websites?: { label: string; url: string }[];
  socials?: { type: string; url: string }[];
}

interface PairData {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: TokenInfo;
  quoteToken: TokenInfo;
  priceNative: string;
  priceUsd: string;
  liquidity: Liquidity;
  fdv: number;
  marketCap: number;
  pairCreatedAt: number;
  priceChange: PriceChange;
  volume: Volume;
  txns: Txns;
  info?: PairInfo;
}

type SignalType = 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';

interface TradingSignal {
  type: SignalType;
  label: string;
  color: string;
  bgColor: string;
  reasons: string[];
}

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 60000;
const REQUEST_DELAY = 500;
const MAX_RETRIES = 3;

let lastRequestTime = 0;

const rateLimitedFetch = async (url: string, retries = 0): Promise<any> => {
  const cacheKey = url;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < REQUEST_DELAY) {
    await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();
  
  try {
    const response = await fetch(url);
    
    if (response.status === 429) {
      if (retries < MAX_RETRIES) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        return rateLimitedFetch(url, retries + 1);
      }
      throw new Error('Rate limit exceeded. Please wait and try again.');
    }
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    const data = await response.json();
    cache.set(cacheKey, { data, timestamp: Date.now() });
    
    return data;
  } catch (error: any) {
    if (retries < MAX_RETRIES && error.message?.includes('fetch')) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return rateLimitedFetch(url, retries + 1);
    }
    throw error;
  }
};

const DEFAULT_PAIR = "0x3c5f68d2f72debba4900c60f32eb8629876401f2";

const FALLBACK_PAIRS = [
  "0x3c5f68d2f72debba4900c60f32eb8629876401f2",
  "0xf4003f4efbe8691b60249e6afbd307abe7758adb",
  "0xed8cbd9f0ce3c6986b22002f03c6475ceb7a6256",
  "0xe28984e1ee8d431346d32bec9ec800efb643eef4",
];

const AvaScan = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PairData[]>([]);
  const [selectedPair, setSelectedPair] = useState<PairData | null>(null);
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem("avascan_favorites");
    return saved ? JSON.parse(saved) : [];
  });
  const [favoritePairs, setFavoritePairs] = useState<PairData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [showChart, setShowChart] = useState(true);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const calculateSignal = (pair: PairData | null): TradingSignal => {
    if (!pair) return { type: 'NEUTRAL', label: 'N/A', color: 'text-zinc-400', bgColor: 'bg-zinc-500/20', reasons: [] };

    const reasons: string[] = [];
    let score = 0;

    const h1Change = pair.priceChange?.h1 || 0;
    const h24Change = pair.priceChange?.h24 || 0;
    const m5Change = pair.priceChange?.m5 || 0;

    if (h1Change > 5) { score += 2; reasons.push(`+${h1Change.toFixed(1)}% in 1h`); }
    else if (h1Change > 2) { score += 1; reasons.push(`Positive 1h momentum`); }
    else if (h1Change < -5) { score -= 2; reasons.push(`${h1Change.toFixed(1)}% in 1h`); }
    else if (h1Change < -2) { score -= 1; reasons.push(`Negative 1h momentum`); }

    const volume = pair.volume?.h24 || 0;
    const liquidity = pair.liquidity?.usd || 0;
    const volumeToLiq = liquidity > 0 ? volume / liquidity : 0;

    if (volumeToLiq > 2) { score += 2; reasons.push(`High volume/liquidity ratio`); }
    else if (volumeToLiq > 1) { score += 1; reasons.push(`Good trading activity`); }
    else if (volumeToLiq < 0.1) { score -= 1; reasons.push(`Low trading activity`); }

    const buys = pair.txns?.h24?.buys || 0;
    const sells = pair.txns?.h24?.sells || 0;
    const total = buys + sells;
    const buyRatio = total > 0 ? buys / total : 0.5;

    if (buyRatio > 0.65) { score += 2; reasons.push(`Strong buying pressure (${(buyRatio * 100).toFixed(0)}%)`); }
    else if (buyRatio > 0.55) { score += 1; reasons.push(`More buyers than sellers`); }
    else if (buyRatio < 0.35) { score -= 2; reasons.push(`Heavy selling pressure (${((1-buyRatio) * 100).toFixed(0)}%)`); }
    else if (buyRatio < 0.45) { score -= 1; reasons.push(`More sellers than buyers`); }

    if (liquidity > 1000000) { score += 1; reasons.push(`Strong liquidity`); }
    else if (liquidity < 10000) { score -= 1; reasons.push(`Low liquidity warning`); }

    if (m5Change > 0 && h1Change > 0 && h24Change > 0) { 
      score += 1; 
      reasons.push(`Consistent uptrend`); 
    } else if (m5Change < 0 && h1Change < 0 && h24Change < 0) { 
      score -= 1; 
      reasons.push(`Consistent downtrend`); 
    }

    if (score >= 4) return { type: 'STRONG_BUY', label: 'STRONG BUY', color: 'text-green-400', bgColor: 'bg-green-500/20', reasons };
    if (score >= 2) return { type: 'BUY', label: 'BUY', color: 'text-green-400', bgColor: 'bg-green-500/20', reasons };
    if (score <= -4) return { type: 'STRONG_SELL', label: 'STRONG SELL', color: 'text-red-400', bgColor: 'bg-red-500/20', reasons };
    if (score <= -2) return { type: 'SELL', label: 'SELL', color: 'text-red-400', bgColor: 'bg-red-500/20', reasons };
    return { type: 'NEUTRAL', label: 'NEUTRAL', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', reasons };
  };

  const tradingSignal = useMemo(() => calculateSignal(selectedPair), [selectedPair]);

  useEffect(() => {
    loadPairData(DEFAULT_PAIR);
  }, []);

  useEffect(() => {
    loadFavorites();
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem("avascan_favorites", JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedPair) {
        loadPairData(selectedPair.pairAddress);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedPair]);

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (searchQuery.length >= 2) {
        handleSearch();
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(delayedSearch);
  }, [searchQuery]);

  const loadPairData = async (pairAddress: string) => {
    setLoading(true);
    try {
      const data = await rateLimitedFetch(
        `https://api.dexscreener.com/latest/dex/pairs/avalanche/${pairAddress}`
      );
      
      if (data.pairs && data.pairs.length > 0) {
        setSelectedPair(data.pairs[0]);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error("Error loading pair data:", error);
      toast.error("Failed to load token data");
    } finally {
      setLoading(false);
    }
  };

  const loadFavorites = async () => {
    if (favorites.length === 0) {
      setFavoritePairs([]);
      return;
    }

    const pairs: PairData[] = [];
    for (const address of favorites.slice(0, 10)) {
      try {
        const data = await rateLimitedFetch(
          `https://api.dexscreener.com/latest/dex/pairs/avalanche/${address}`
        );
        if (data.pairs && data.pairs.length > 0) {
          pairs.push(data.pairs[0]);
        }
      } catch (e) {
        console.error("Error fetching favorite:", e);
      }
    }
    setFavoritePairs(pairs);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setSearchLoading(true);
    try {
      const data = await rateLimitedFetch(
        `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(searchQuery)}`
      );
      
      if (data.pairs) {
        const avaxPairs = data.pairs.filter((p: PairData) => p.chainId === "avalanche").slice(0, 10);
        setSearchResults(avaxPairs);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setSearchLoading(false);
    }
  };

  const toggleFavorite = (pairAddress: string) => {
    setFavorites(prev => 
      prev.includes(pairAddress) 
        ? prev.filter(a => a !== pairAddress)
        : [...prev, pairAddress]
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const formatNumber = (num: number | undefined): string => {
    if (num === undefined || num === null) return "N/A";
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const formatPrice = (price: string | number | undefined): string => {
    if (price === undefined || price === null) return "N/A";
    const num = typeof price === 'string' ? parseFloat(price) : price;
    if (num < 0.0001) return `$${num.toExponential(4)}`;
    if (num < 1) return `$${num.toFixed(6)}`;
    return `$${num.toFixed(4)}`;
  };

  const formatPercent = (value: number | undefined): string => {
    if (value === undefined || value === null) return "0.00%";
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const getTokenLogo = (pair: PairData): string | null => {
    if (pair.info?.imageUrl) return pair.info.imageUrl;
    if (pair.baseToken.symbol === 'AVLO') return avloLogo;
    if (pair.baseToken.symbol === 'WAVAX' || pair.baseToken.symbol === 'AVAX') return avaxLogo;
    return null;
  };

  const TokenLogo = ({ pair, size = "md" }: { pair: PairData; size?: "sm" | "md" | "lg" }) => {
    const logoUrl = getTokenLogo(pair);
    const sizeClasses = {
      sm: "w-6 h-6",
      md: "w-8 h-8",
      lg: "w-14 h-14"
    };
    
    if (logoUrl) {
      return (
        <img 
          src={logoUrl} 
          alt={pair.baseToken.symbol}
          className={`${sizeClasses[size]} rounded-full object-cover border-2 border-orange-500/50`}
        />
      );
    }
    
    return (
      <div className={`${sizeClasses[size]} bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center border-2 border-orange-500/50`}>
        <span className={`text-white font-bold ${size === 'sm' ? 'text-[10px]' : size === 'md' ? 'text-xs' : 'text-lg'}`}>
          {pair.baseToken.symbol.slice(0, 2)}
        </span>
      </div>
    );
  };

  const PriceChangeIndicator = ({ value, size = "sm" }: { value: number | undefined; size?: "sm" | "lg" }) => {
    if (value === undefined || value === null) return <span className="text-zinc-500">N/A</span>;
    const isPositive = value >= 0;
    return (
      <span className={`flex items-center gap-0.5 font-mono ${isPositive ? "text-green-400" : "text-red-400"} ${size === "lg" ? "text-xl md:text-2xl font-bold" : "text-xs"}`}>
        {isPositive ? <TrendingUp className={size === "lg" ? "w-5 h-5" : "w-3 h-3"} /> : <TrendingDown className={size === "lg" ? "w-5 h-5" : "w-3 h-3"} />}
        {formatPercent(value)}
      </span>
    );
  };

  const calculateBuySellRatio = (txns: Txns | undefined): number => {
    if (!txns?.h24) return 50;
    const total = (txns.h24.buys || 0) + (txns.h24.sells || 0);
    if (total === 0) return 50;
    return ((txns.h24.buys || 0) / total) * 100;
  };

  const getChartUrl = (pair: PairData | null): string => {
    if (!pair) return '';
    return `https://dexscreener.com/avalanche/${pair.pairAddress}?embed=1&theme=dark&trades=0&info=0`;
  };

  if (loading && !selectedPair) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-3">
          <CandlestickChart className="w-8 h-8 text-orange-500 animate-pulse" />
          <span className="text-xl font-semibold">Loading AvaScan...</span>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-auto bg-black text-white relative">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage: `linear-gradient(rgba(249, 115, 22, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(249, 115, 22, 0.15) 1px, transparent 1px)`,
            backgroundSize: '80px 80px',
          }}
        />
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full blur-[120px] opacity-20 hidden md:block"
          style={{
            background: `radial-gradient(circle, #f97316, transparent 70%)`,
            left: mousePosition.x - 250,
            top: mousePosition.y - 250,
          }}
        />
        <motion.div
          className="absolute top-0 right-0 w-[200px] md:w-[400px] h-[200px] md:h-[400px] rounded-full blur-[100px]"
          animate={{
            background: [
              "radial-gradient(circle, rgba(249, 115, 22, 0.25), transparent 70%)",
              "radial-gradient(circle, rgba(236, 72, 153, 0.25), transparent 70%)",
              "radial-gradient(circle, rgba(249, 115, 22, 0.25), transparent 70%)",
            ],
          }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-0 left-0 w-[150px] md:w-[300px] h-[150px] md:h-[300px] rounded-full blur-[80px]"
          animate={{
            background: [
              "radial-gradient(circle, rgba(6, 182, 212, 0.25), transparent 70%)",
              "radial-gradient(circle, rgba(168, 85, 247, 0.25), transparent 70%)",
              "radial-gradient(circle, rgba(6, 182, 212, 0.25), transparent 70%)",
            ],
          }}
          transition={{ duration: 6, repeat: Infinity }}
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 pt-16 md:pt-20 pb-8 px-4 md:px-6 lg:px-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <motion.div
              className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-orange-500 to-red-600"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <CandlestickChart className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </motion.div>
            <div>
              <span className="text-xl md:text-2xl font-bold tracking-tight">
                AVA<span className="text-orange-500">SCAN</span>
              </span>
              <p className="text-xs text-gray-500">AVALANCHE TERMINAL</p>
            </div>
          </div>
          
          {/* Search */}
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              placeholder="Search tokens..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 bg-white/5 border-orange-500/30 text-white text-sm placeholder:text-zinc-500 focus:border-orange-500"
            />
            
            {(searchResults.length > 0 || searchLoading) && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-orange-500/30 rounded-lg overflow-hidden z-50 shadow-xl">
                {searchLoading ? (
                  <div className="p-3 space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 bg-zinc-800" />)}
                  </div>
                ) : (
                  <ScrollArea className="max-h-[300px]">
                    {searchResults.map((pair) => (
                      <button
                        key={pair.pairAddress}
                        onClick={() => {
                          loadPairData(pair.pairAddress);
                          setSearchQuery("");
                          setSearchResults([]);
                        }}
                        className="w-full flex items-center justify-between p-3 hover:bg-orange-500/10 border-b border-zinc-800 last:border-0"
                      >
                        <div className="flex items-center gap-2">
                          <TokenLogo pair={pair} size="sm" />
                          <div className="text-left">
                            <p className="text-white font-mono text-sm">
                              {pair.baseToken.symbol}<span className="text-zinc-500">/{pair.quoteToken.symbol}</span>
                            </p>
                            <p className="text-zinc-500 text-[10px]">{pair.dexId}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-mono text-sm">{formatPrice(pair.priceUsd)}</p>
                          <PriceChangeIndicator value={pair.priceChange?.h24} />
                        </div>
                      </button>
                    ))}
                  </ScrollArea>
                )}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {lastUpdate && (
              <div className="hidden sm:flex items-center gap-1 text-zinc-500 text-[10px] font-mono">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                {lastUpdate.toLocaleTimeString()}
              </div>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => selectedPair && loadPairData(selectedPair.pairAddress)}
              className="h-8 w-8 p-0 text-orange-500 hover:text-orange-400 hover:bg-orange-500/10"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </motion.div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Token Info */}
          <div className="space-y-4">
            {selectedPair && (
              <>
                {/* Token Header */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 md:p-6 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/10 border border-orange-500/30 relative overflow-hidden"
                >
                  <div className="absolute -right-10 -top-10 w-40 h-40 bg-orange-500/20 rounded-full blur-3xl" />
                  <div className="relative">
                    <div className="flex items-start gap-4 mb-4">
                      <TokenLogo pair={selectedPair} size="lg" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h1 className="text-xl md:text-2xl font-bold">{selectedPair.baseToken.symbol}</h1>
                          <span className="text-gray-500">/ {selectedPair.quoteToken.symbol}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleFavorite(selectedPair.pairAddress)}
                            className={`h-6 w-6 p-0 ${favorites.includes(selectedPair.pairAddress) ? 'text-yellow-500' : 'text-gray-500'}`}
                          >
                            <Star className={`w-4 h-4 ${favorites.includes(selectedPair.pairAddress) ? 'fill-yellow-500' : ''}`} />
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500">{selectedPair.baseToken.name}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge className="bg-zinc-800 text-zinc-300 text-[10px]">{selectedPair.dexId}</Badge>
                          <Badge className={`text-[10px] ${tradingSignal.bgColor} ${tradingSignal.color} border-0`}>
                            {tradingSignal.label}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-end gap-4">
                      <div>
                        <p className="text-3xl md:text-4xl font-black bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
                          {formatPrice(selectedPair.priceUsd)}
                        </p>
                      </div>
                      <PriceChangeIndicator value={selectedPair.priceChange?.h24} size="lg" />
                    </div>
                  </div>
                </motion.div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { label: 'Market Cap', value: formatNumber(selectedPair.marketCap), icon: DollarSign, color: '#f97316' },
                    { label: 'Liquidity', value: formatNumber(selectedPair.liquidity?.usd), icon: Shield, color: '#22c55e' },
                    { label: '24h Volume', value: formatNumber(selectedPair.volume?.h24), icon: BarChart3, color: '#3b82f6' },
                    { label: 'FDV', value: formatNumber(selectedPair.fdv), icon: Activity, color: '#a855f7' },
                  ].map((stat, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.05 }}
                      className="p-3 rounded-xl bg-white/5 border border-white/10"
                    >
                      <stat.icon className="w-4 h-4 mb-1" style={{ color: stat.color }} />
                      <div className="text-sm md:text-base font-bold">{stat.value}</div>
                      <div className="text-[10px] text-gray-500 uppercase">{stat.label}</div>
                    </motion.div>
                  ))}
                </div>

                {/* Price Changes */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="p-4 rounded-2xl bg-white/5 border border-white/10"
                >
                  <h3 className="text-sm font-semibold text-gray-400 mb-3">Price Changes</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: '5m', value: selectedPair.priceChange?.m5 },
                      { label: '1h', value: selectedPair.priceChange?.h1 },
                      { label: '6h', value: selectedPair.priceChange?.h6 },
                      { label: '24h', value: selectedPair.priceChange?.h24 },
                    ].map((item, i) => (
                      <div key={i} className="text-center p-2 rounded-lg bg-white/5">
                        <p className="text-[10px] text-gray-500 mb-1">{item.label}</p>
                        <PriceChangeIndicator value={item.value} />
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Buy/Sell Ratio */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className="p-4 rounded-2xl bg-white/5 border border-white/10"
                >
                  <h3 className="text-sm font-semibold text-gray-400 mb-3">24h Trading Activity</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-green-400">Buys: {selectedPair.txns?.h24?.buys || 0}</span>
                      <span className="text-red-400">Sells: {selectedPair.txns?.h24?.sells || 0}</span>
                    </div>
                    <div className="relative h-3 bg-red-500/30 rounded-full overflow-hidden">
                      <div 
                        className="absolute left-0 top-0 h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all"
                        style={{ width: `${calculateBuySellRatio(selectedPair.txns)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span>{calculateBuySellRatio(selectedPair.txns).toFixed(1)}% Buy Pressure</span>
                      <span>{(100 - calculateBuySellRatio(selectedPair.txns)).toFixed(1)}% Sell Pressure</span>
                    </div>
                  </div>
                </motion.div>

                {/* Contract Address */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 }}
                  className="p-4 rounded-2xl bg-white/5 border border-white/10"
                >
                  <h3 className="text-sm font-semibold text-gray-400 mb-3">Contract Address</h3>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs text-zinc-400 bg-zinc-800/50 p-2 rounded truncate">
                      {selectedPair.baseToken.address}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(selectedPair.baseToken.address)}
                      className="h-8 w-8 p-0 text-zinc-400 hover:text-white"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <a
                      href={selectedPair.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-8 w-8 flex items-center justify-center text-zinc-400 hover:text-orange-400"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </motion.div>
              </>
            )}
          </div>

          {/* Right Column - Chart & Watchlist */}
          <div className="space-y-4">
            {/* Chart */}
            {showChart && selectedPair && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="rounded-2xl overflow-hidden border border-orange-500/30 bg-zinc-900/50"
              >
                <iframe
                  src={getChartUrl(selectedPair)}
                  className="w-full h-[300px] md:h-[400px]"
                  title="DexScreener Chart"
                />
              </motion.div>
            )}

            {/* Watchlist */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="p-4 rounded-2xl bg-white/5 border border-white/10"
            >
              <div className="flex items-center gap-2 mb-4">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                <h3 className="text-sm font-semibold text-gray-400">Watchlist</h3>
              </div>
              
              {favorites.length === 0 ? (
                <p className="text-zinc-500 text-xs text-center py-4">
                  Star tokens to add to your watchlist
                </p>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {favoritePairs.map((pair) => (
                    <button
                      key={pair.pairAddress}
                      onClick={() => loadPairData(pair.pairAddress)}
                      className={`w-full p-3 rounded-xl transition-all flex items-center justify-between ${
                        selectedPair?.pairAddress === pair.pairAddress
                          ? "bg-orange-500/20 border border-orange-500/50"
                          : "bg-white/5 hover:bg-white/10 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <TokenLogo pair={pair} size="sm" />
                        <span className="text-sm font-semibold">{pair.baseToken.symbol}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono">{formatPrice(pair.priceUsd)}</p>
                        <PriceChangeIndicator value={pair.priceChange?.h24} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Trading Signal Analysis */}
            {selectedPair && tradingSignal.reasons.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
                className="p-4 rounded-2xl bg-white/5 border border-white/10"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="w-4 h-4 text-orange-500" />
                  <h3 className="text-sm font-semibold text-gray-400">Signal Analysis</h3>
                </div>
                <div className="space-y-2">
                  {tradingSignal.reasons.map((reason, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <div className={`w-1.5 h-1.5 rounded-full ${tradingSignal.type.includes('BUY') ? 'bg-green-500' : tradingSignal.type.includes('SELL') ? 'bg-red-500' : 'bg-yellow-500'}`} />
                      <span className="text-gray-400">{reason}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* AVLO Token Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
              className="p-4 rounded-2xl bg-gradient-to-r from-zinc-800/80 to-zinc-900/80 border border-orange-500/20 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <img src={avloLogo} alt="AVLO" className="w-10 md:w-12 h-10 md:h-12 rounded-full border-2 border-orange-500/30" />
                <div>
                  <p className="font-bold text-base md:text-lg">AVLO Token</p>
                  <p className="text-[10px] md:text-xs text-gray-500">Native platform currency</p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => loadPairData(DEFAULT_PAIR)}
                className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-500 border border-orange-500/30"
              >
                View
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvaScan;
