import { useState, useEffect } from 'react';
import { TrendingUp, Users, DollarSign, Loader2, RefreshCw, BarChart3, Wallet, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ShareStats {
  userId?: string;
  totalShares?: number;
  sharePrice?: number;
  marketCap?: number;
  holderCount?: number;
  volume24h?: number;
  priceChange24h?: number;
  allTimeHigh?: number;
  allTimeLow?: number;
}

interface Holder {
  id: string;
  holderId: string;
  holder?: {
    id: string;
    handle: string;
    userName: string;
    profilePicture?: string;
  };
  shareCount: number;
  totalValue: number;
  purchasedAt: string;
}

interface HolderAddress {
  userId: string;
  address: string;
  shareCount: number;
  handle: string;
}

interface Earnings {
  totalEarnings: number;
  sharesSold: number;
  tips: number;
  otherRevenue: number;
  breakdown?: Array<{
    date: string;
    sharesSold: number;
    tips: number;
    total: number;
  }>;
}

interface AgentSharesTabProps {
  agentId: string;
}

export const AgentSharesTab = ({ agentId }: AgentSharesTabProps) => {
  const [stats, setStats] = useState<ShareStats | null>(null);
  const [holders, setHolders] = useState<Holder[]>([]);
  const [holdings, setHoldings] = useState<any[]>([]);
  const [holderAddresses, setHolderAddresses] = useState<HolderAddress[]>([]);
  const [showAddresses, setShowAddresses] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSharesData();
  }, [agentId]);

  const fetchSharesData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const results = await Promise.allSettled([
        supabase.functions.invoke('arena-agent', {
          body: { action: 'get_shares_stats', agentId }
        }),
        supabase.functions.invoke('arena-agent', {
          body: { action: 'get_share_holders', agentId }
        }),
        supabase.functions.invoke('arena-agent', {
          body: { action: 'get_earnings_breakdown', agentId }
        }),
        supabase.functions.invoke('arena-agent', {
          body: { action: 'get_holdings', agentId }
        })
      ]);

      if (results[0].status === 'fulfilled' && results[0].value?.data?.stats) {
        setStats(results[0].value.data.stats);
      } else {
        setStats({ totalShares: 0, sharePrice: 0, marketCap: 0, holderCount: 0 });
      }

      if (results[1].status === 'fulfilled' && results[1].value?.data?.holders) {
        setHolders(results[1].value.data.holders);
      } else {
        setHolders([]);
      }

      if (results[2].status === 'fulfilled' && results[2].value?.data?.earnings) {
        setEarnings(results[2].value.data.earnings);
      } else {
        setEarnings(null);
      }

      if (results[3].status === 'fulfilled' && results[3].value?.data?.holdings) {
        setHoldings(results[3].value.data.holdings);
      } else {
        setHoldings([]);
      }
    } catch (error) {
      setError('Failed to load shares data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHolderAddresses = async () => {
    if (showAddresses) { setShowAddresses(false); return; }
    try {
      const { data } = await supabase.functions.invoke('arena-agent', {
        body: { action: 'get_holder_addresses', agentId }
      });
      setHolderAddresses(data?.addresses || []);
      setShowAddresses(true);
    } catch {
      toast.error('Failed to load addresses');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-400 mb-4">{error}</p>
        <Button variant="outline" onClick={fetchSharesData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">Shares & Holdings</h3>
        <Button variant="ghost" size="sm" onClick={fetchSharesData}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-zinc-500">Share Price</p>
                <p className="text-sm font-bold text-white truncate">
                  {(stats?.sharePrice || 0).toFixed(4)} AVAX
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                <BarChart3 className="w-4 h-4 text-purple-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-zinc-500">Market Cap</p>
                <p className="text-sm font-bold text-white truncate">
                  {(stats?.marketCap || 0).toFixed(2)} AVAX
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-pink-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-zinc-500">Holders</p>
                <p className="text-sm font-bold text-white">{stats?.holderCount || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
                <DollarSign className="w-4 h-4 text-green-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-zinc-500">24h Volume</p>
                <p className="text-sm font-bold text-white truncate">
                  {(stats?.volume24h || 0).toFixed(2)} AVAX
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Price Change */}
      {stats && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">24h Change</span>
              <Badge
                className={
                  (stats.priceChange24h || 0) >= 0
                    ? 'bg-green-500/20 text-green-400 text-xs'
                    : 'bg-red-500/20 text-red-400 text-xs'
                }
              >
                {(stats.priceChange24h || 0) >= 0 ? '+' : ''}
                {(stats.priceChange24h || 0).toFixed(2)}%
              </Badge>
            </div>
            {(stats.allTimeHigh || stats.allTimeLow) && (
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="text-zinc-500">ATH: </span>
                  <span className="text-white">{(stats.allTimeHigh || 0).toFixed(4)}</span>
                </div>
                <div>
                  <span className="text-zinc-500">ATL: </span>
                  <span className="text-white">{(stats.allTimeLow || 0).toFixed(4)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Earnings */}
      {earnings && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-400" />
              Earnings (30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-xs text-zinc-500">Total</p>
                <p className="text-sm font-bold text-white">{(earnings.totalEarnings || 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Shares</p>
                <p className="text-sm font-bold text-white">{(earnings.sharesSold || 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Tips</p>
                <p className="text-sm font-bold text-white">{(earnings.tips || 0).toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Holders */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="p-3 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-pink-400" />
              Top Holders
            </CardTitle>
            {holders.length > 0 && (
              <Button variant="ghost" size="sm" onClick={fetchHolderAddresses} className="text-xs text-zinc-400 h-7">
                <Wallet className="w-3 h-3 mr-1" />
                {showAddresses ? 'Hide' : 'Addresses'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          {holders.length === 0 ? (
            <p className="text-center text-zinc-500 py-4 text-sm">No holders yet</p>
          ) : (
            <div className="space-y-2">
              {holders.slice(0, 5).map((holder, index) => (
                <div key={holder.id || index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-zinc-500 w-4">#{index + 1}</span>
                    <Avatar className="w-6 h-6">
                      {holder.holder?.profilePicture && (
                        <AvatarImage src={holder.holder.profilePicture} />
                      )}
                      <AvatarFallback className="bg-zinc-700 text-xs">
                        {holder.holder?.userName?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white truncate">
                        {holder.holder?.userName || 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium text-white">{holder.shareCount}</p>
                    <p className="text-xs text-zinc-500">{(holder.totalValue || 0).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Holder Addresses */}
      {showAddresses && holderAddresses.length > 0 && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <Wallet className="w-4 h-4 text-cyan-400" />
              Holder Addresses
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="space-y-2">
              {holderAddresses.map((ha, i) => (
                <div key={ha.userId || i} className="flex items-center justify-between bg-zinc-800/50 rounded px-2 py-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-white truncate">@{ha.handle}</p>
                    <p className="text-xs text-zinc-500 font-mono truncate">{ha.address}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-xs text-zinc-400">{ha.shareCount}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-6 h-6"
                      onClick={() => {
                        navigator.clipboard.writeText(ha.address);
                        setCopiedAddr(ha.address);
                        setTimeout(() => setCopiedAddr(null), 1500);
                      }}
                    >
                      {copiedAddr === ha.address ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-zinc-500" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Holdings */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Wallet className="w-4 h-4 text-orange-400" />
            Portfolio (Holdings)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          {holdings.length === 0 ? (
            <p className="text-center text-zinc-500 py-4 text-sm">No holdings yet</p>
          ) : (
            <div className="space-y-2">
              {holdings.slice(0, 5).map((holding, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar className="w-6 h-6">
                      {holding.profilePicture && (
                        <AvatarImage src={holding.profilePicture} />
                      )}
                      <AvatarFallback className="bg-zinc-700 text-xs">
                        {holding.userName?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white truncate">
                        {holding.userName || 'Unknown'}
                      </p>
                      <p className="text-[10px] text-zinc-500 truncate">
                        {holding.shareCount} keys
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium text-white">
                      {(holding.totalValue || 0).toFixed(2)} AVAX
                    </p>
                    <p className={`text-[10px] ${holding.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {holding.profitLoss >= 0 ? '+' : ''}{(holding.profitLoss || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
