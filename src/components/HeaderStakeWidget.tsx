import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, ChevronRight, Flame } from 'lucide-react';

interface StakingPool {
  id: string;
  title: string;
  stake_token_logo: string | null;
  active_boost_amount?: number;
  boost_expires_at?: string | null;
}

export const HeaderStakeWidget = () => {
  const navigate = useNavigate();
  const [pools, setPools] = useState<StakingPool[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApprovedPools();
  }, []);

  // Auto-rotate every 5 seconds (only when multiple pools)
  useEffect(() => {
    if (pools.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % pools.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [pools.length]);

  const fetchApprovedPools = async () => {
    try {
      const now = new Date().toISOString();

      // Fetch active boosts
      const { data: activeBoosts } = await supabase
        .from('staking_pool_boosts')
        .select('pool_id, amount, expires_at')
        .gt('expires_at', now);

      // Calculate active boost amounts per pool
      const poolBoostMap: Record<string, { total: number; latestExpiry: string }> = {};
      if (activeBoosts && activeBoosts.length > 0) {
        for (const boost of activeBoosts) {
          if (!poolBoostMap[boost.pool_id]) {
            poolBoostMap[boost.pool_id] = { total: 0, latestExpiry: boost.expires_at };
          }
          poolBoostMap[boost.pool_id].total += Number(boost.amount);
          if (boost.expires_at > poolBoostMap[boost.pool_id].latestExpiry) {
            poolBoostMap[boost.pool_id].latestExpiry = boost.expires_at;
          }
        }
      }

      // Find the highest boosted pool
      const boostedPoolIds = Object.keys(poolBoostMap);
      
      if (boostedPoolIds.length > 0) {
        // Sort by boost amount and get the highest one
        const topBoostedPoolId = boostedPoolIds.sort(
          (a, b) => poolBoostMap[b].total - poolBoostMap[a].total
        )[0];

        // Fetch only the top boosted pool
        const { data: topPool } = await supabase
          .from('staking_pools')
          .select('id, title, stake_token_logo')
          .eq('id', topBoostedPoolId)
          .single();

        if (topPool) {
          setPools([{
            ...topPool,
            active_boost_amount: poolBoostMap[topPool.id]?.total || 0,
            boost_expires_at: poolBoostMap[topPool.id]?.latestExpiry || null,
          }]);
          setLoading(false);
          return;
        }
      }

      // No boosted pools - fetch approved pools (not rejected, not pending approval)
      const { data: approvedPools, error } = await supabase
        .from('staking_pools')
        .select('id, title, stake_token_logo')
        .or('is_rejected.is.null,is_rejected.eq.false')
        .or('pending_approval.is.null,pending_approval.eq.false')
        .eq('is_active', true)
        .limit(20);
      
      if (error) throw error;

      if (approvedPools && approvedPools.length > 0) {
        // Shuffle and pick up to 8 for rotation
        const shuffled = approvedPools.sort(() => Math.random() - 0.5).slice(0, 8);
        
        const poolsData = shuffled.map(pool => ({
          ...pool,
          active_boost_amount: 0,
          boost_expires_at: null,
        }));

        setPools(poolsData);
      }
    } catch (err) {
      console.error('Error fetching pools:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatBoostAmount = (amount: number) => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`;
    return amount.toFixed(0);
  };

  if (loading || pools.length === 0) return null;

  const currentPool = pools[currentIndex];

  return (
    <AnimatePresence mode="wait">
      <motion.button
        key={currentPool.id}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.3 }}
        onClick={() => navigate(`/staking?pool=${currentPool.id}`)}
        className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-1 rounded-lg bg-gradient-to-r from-emerald-950/60 to-emerald-900/40 border border-emerald-500/30 hover:border-emerald-400/50 transition-all group flex-shrink-0"
      >
        {/* Token Logo */}
        <div className="relative flex-shrink-0">
          {currentPool.stake_token_logo ? (
            <img
              src={currentPool.stake_token_logo}
              alt={currentPool.title}
              className="w-5 h-5 rounded-full object-cover ring-1 ring-emerald-500/30 group-hover:ring-emerald-400/60 transition-all"
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
              <Coins className="w-2.5 h-2.5 text-white" />
            </div>
          )}
        </div>

        {/* STAKE text - always visible */}
        <span className="text-[9px] sm:text-[10px] font-bold text-emerald-300 uppercase tracking-wide">
          STAKE
        </span>

        {/* Desktop: Pool Title */}
        <span className="hidden lg:inline text-[10px] font-medium text-white/70 max-w-[60px] xl:max-w-[100px] truncate">
          {currentPool.title}
        </span>

        {/* Boost info if available and greater than 0 - desktop only */}
        {currentPool.active_boost_amount !== undefined && currentPool.active_boost_amount > 0 && (
          <div className="hidden xl:flex items-center gap-0.5 px-1 py-0.5 bg-purple-500/20 rounded border border-purple-500/30">
            <Flame className="w-2 h-2 text-purple-400" />
            <span className="text-[8px] text-purple-300 font-medium">
              {formatBoostAmount(currentPool.active_boost_amount)}
            </span>
          </div>
        )}

        {/* Arrow */}
        <ChevronRight className="w-3 h-3 text-emerald-400 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />

        {/* Pool indicator dots - only when multiple random pools */}
        {pools.length > 1 && (
          <div className="hidden sm:flex items-center gap-0.5">
            {pools.map((_, idx) => (
              <div
                key={idx}
                className={`w-1 h-1 rounded-full transition-all ${
                  idx === currentIndex 
                    ? 'bg-emerald-400 w-1.5' 
                    : 'bg-white/20'
                }`}
              />
            ))}
          </div>
        )}
      </motion.button>
    </AnimatePresence>
  );
};
