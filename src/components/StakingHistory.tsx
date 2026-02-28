import { useRef, useCallback, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowDownToLine, ArrowUpFromLine, Gift, ExternalLink, Loader2 } from "lucide-react";
import { useStakingHistoryPaginated } from "@/hooks/useStakingHistoryPaginated";
import { formatDistance } from "date-fns";
import arenaLogo from "@/assets/arena-token-logo.jpg";
import avloLogo from "@/assets/avlo-logo.jpg";
import { useAvloPrice } from "@/hooks/useAvloPrice";

export const StakingHistory = () => {
  const { transactions, loading, loadingMore, hasMore, loadMore } = useStakingHistoryPaginated();
  const { formatAvloWithUsd } = useAvloPrice();
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Intersection observer for infinite scroll
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const [entry] = entries;
    if (entry.isIntersecting && hasMore && !loadingMore) {
      loadMore();
    }
  }, [hasMore, loadingMore, loadMore]);

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: '100px',
      threshold: 0.1
    });

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [handleObserver]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'deposit':
      case 'stake':
        return <ArrowDownToLine className="w-4 h-4 text-primary" />;
      case 'withdraw':
      case 'unstake':
        return <ArrowUpFromLine className="w-4 h-4 text-orange-500" />;
      case 'claim':
        return <Gift className="w-4 h-4 text-green-500" />;
      default:
        return null;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'deposit':
      case 'stake':
        return <Badge className="bg-primary/10 text-primary border-primary/20">Stake</Badge>;
      case 'withdraw':
      case 'unstake':
        return <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20">Unstake</Badge>;
      case 'claim':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Claim</Badge>;
      default:
        return null;
    }
  };

  const formatAmount = (amount: string) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return "0.00";
    return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  };

  if (loading) {
    return (
      <Card className="bg-card/95 backdrop-blur-sm border-border/60 p-6">
        <h3 className="text-xl font-bold mb-4">Transaction History</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted/50 animate-pulse rounded-lg" />
          ))}
        </div>
      </Card>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card className="bg-card/95 backdrop-blur-sm border-border/60 p-6">
        <h3 className="text-xl font-bold mb-4">Transaction History</h3>
        <div className="text-center py-8 text-muted-foreground">
          <p>No transactions yet</p>
          <p className="text-sm mt-1">Your staking activity will appear here</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-card/95 backdrop-blur-sm border-border/60 p-6">
      <h3 className="text-xl font-bold mb-4">Transaction History</h3>
      <ScrollArea className="max-h-[400px]" ref={scrollRef}>
        <div className="space-y-2 pr-2">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border/40 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="relative w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  {getTypeIcon(tx.transaction_type)}
                  <img 
                    src={tx.pool_logo || (tx.token_symbol === "ARENA" ? arenaLogo : avloLogo)} 
                    alt={tx.token_symbol} 
                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full object-cover border-2 border-card"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getTypeBadge(tx.transaction_type)}
                    <span className="font-semibold truncate">
                      {formatAmount(tx.amount)} {tx.token_symbol}
                    </span>
                    {tx.token_symbol === 'AVLO' && (
                      <span className="text-xs text-green-400">({formatAvloWithUsd(parseFloat(tx.amount) || 0).usd})</span>
                    )}
                  </div>
                  {tx.pool_title && (
                    <p className="text-xs text-zinc-400 truncate mt-0.5">{tx.pool_title}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistance(new Date(tx.created_at), new Date(), { addSuffix: true })}
                  </p>
                </div>
              </div>
              {tx.tx_hash && (
                <a
                  href={`https://snowtrace.io/tx/${tx.tx_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80 transition-colors flex-shrink-0 ml-2"
                  title="View on Snowtrace"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          ))}
          
          {/* Load more trigger */}
          <div ref={loadMoreRef} className="py-2">
            {loadingMore && (
              <div className="flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            )}
            {hasMore && !loadingMore && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={loadMore}
                className="w-full text-muted-foreground hover:text-foreground"
              >
                Load more
              </Button>
            )}
          </div>
        </div>
      </ScrollArea>
    </Card>
  );
};
