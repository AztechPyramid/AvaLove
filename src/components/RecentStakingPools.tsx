import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, Zap, Flame, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface TopStaker {
  user_id: string;
  avatar_url: string | null;
  username: string | null;
}

interface StakingPool {
  id: string;
  title: string;
  stake_token_logo: string | null;
  reward_per_block: string | null;
  created_at: string;
  boost_amount: number;
  boosted_at: string | null;
  active_boost_amount?: number;
  boost_expires_at?: string | null;
  topStakers?: TopStaker[];
  isBoosted?: boolean;
  isRecent?: boolean;
}

export const RecentStakingPools = () => {
  const navigate = useNavigate();
  const [pools, setPools] = useState<StakingPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    fetchPools();
  }, []);

  // Auto-slide every 4 seconds
  useEffect(() => {
    if (pools.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % pools.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [pools.length]);

  const fetchPools = async () => {
    try {
      const now = new Date().toISOString();

      // Fetch the most recent APPROVED pool only
      const { data: recentPool } = await supabase
        .from('staking_pools')
        .select('id, title, stake_token_logo, reward_per_block, created_at, boost_amount, boosted_at, created_by')
        .eq('is_active', true)
        .eq('is_rejected', false)
        .eq('created_by', 'admin')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Fetch pools with active boosts (sum of active boost amounts)
      const { data: activeBoosts } = await supabase
        .from('staking_pool_boosts')
        .select('pool_id, amount, expires_at')
        .gt('expires_at', now);

      // Calculate active boost amounts per pool
      const poolBoostMap: Record<string, { total: number; latestExpiry: string }> = {};
      if (activeBoosts) {
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

      // Get top 3 boosted pool IDs sorted by total boost amount
      const topBoostedPoolIds = Object.entries(poolBoostMap)
        .sort(([, a], [, b]) => b.total - a.total)
        .slice(0, 3)
        .map(([poolId]) => poolId);

      // Fetch the top boosted pools - ALL active pools (not just admin-created)
      let boostedPools: StakingPool[] = [];
      if (topBoostedPoolIds.length > 0) {
        const { data: boostedPoolsData } = await supabase
          .from('staking_pools')
          .select('id, title, stake_token_logo, reward_per_block, created_at, boost_amount, boosted_at, created_by')
          .eq('is_active', true)
          .eq('is_rejected', false)
          .in('id', topBoostedPoolIds);

        if (boostedPoolsData) {
          boostedPools = boostedPoolsData.map(pool => ({
            ...pool,
            boost_amount: Number(pool.boost_amount) || 0,
            active_boost_amount: poolBoostMap[pool.id]?.total || 0,
            boost_expires_at: poolBoostMap[pool.id]?.latestExpiry || null,
            isBoosted: true
          }));
          // Sort by active boost amount (highest first)
          boostedPools.sort((a, b) => (b.active_boost_amount || 0) - (a.active_boost_amount || 0));
        }
      }

      // Combine pools: recent first (if not already in boosted), then boosted
      const finalPools: StakingPool[] = [];
      
      if (recentPool && !topBoostedPoolIds.includes(recentPool.id)) {
        finalPools.push({
          ...recentPool,
          boost_amount: Number(recentPool.boost_amount) || 0,
          isRecent: true,
          isBoosted: false
        });
      }

      finalPools.push(...boostedPools);

      // Fetch top stakers for each pool
      const poolsWithStakers = await Promise.all(
        finalPools.map(async (pool) => {
          const { data: stakersData } = await supabase
            .from('staking_transactions')
            .select(`
              user_id,
              profiles:user_id (
                avatar_url,
                username
              )
            `)
            .eq('pool_id', pool.id)
            .eq('transaction_type', 'deposit')
            .limit(10);

          const uniqueStakers: TopStaker[] = [];
          const seenUsers = new Set<string>();
          
          if (stakersData) {
            for (const tx of stakersData) {
              if (!seenUsers.has(tx.user_id) && uniqueStakers.length < 3) {
                seenUsers.add(tx.user_id);
                const profile = tx.profiles as any;
                uniqueStakers.push({
                  user_id: tx.user_id,
                  avatar_url: profile?.avatar_url || null,
                  username: profile?.username || null,
                });
              }
            }
          }

          return { ...pool, topStakers: uniqueStakers };
        })
      );

      setPools(poolsWithStakers);
    } catch (err) {
      console.error('Error fetching pools:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || pools.length === 0) return null;

  const currentPool = pools[currentIndex];
  const rewardPerBlock = currentPool.reward_per_block 
    ? parseFloat(currentPool.reward_per_block).toFixed(2)
    : null;

  const formatBoostAmount = (amount: number) => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`;
    return amount.toFixed(0);
  };

  return (
    <div className="w-full">
      {/* Pool Card Carousel */}
      <div className="overflow-hidden rounded-lg">
        <AnimatePresence mode="wait">
          <motion.button
            key={currentPool.id}
            initial={{ opacity: 0, x: 80 }}
            animate={{ 
              opacity: 1, 
              x: 0,
              transition: {
                type: "spring",
                stiffness: 300,
                damping: 20
              }
            }}
            exit={{ opacity: 0, x: -80 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(`/staking?pool=${currentPool.id}`)}
            className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl border shadow-[0_0_15px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.15)] transition-all group backdrop-blur-sm ${
              currentPool.isBoosted 
                ? 'bg-gradient-to-r from-purple-950/80 via-zinc-900 to-purple-950/80 border-purple-500/40 hover:border-purple-400/60' 
                : 'bg-gradient-to-r from-black via-zinc-900 to-black border-white/10 hover:border-white/20'
            }`}
          >
            {/* Token Logo */}
            <div className="relative flex-shrink-0">
              {currentPool.stake_token_logo ? (
                <img
                  src={currentPool.stake_token_logo}
                  alt={currentPool.title}
                  className={`w-9 h-9 rounded-full object-cover ring-1 transition-all ${
                    currentPool.isBoosted 
                      ? 'ring-purple-400/50 group-hover:ring-purple-400' 
                      : 'ring-white/20 group-hover:ring-emerald-400/50'
                  }`}
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center ring-1 ring-white/20">
                  <Coins className="w-4 h-4 text-white" />
                </div>
              )}
              {/* Live/Boost indicator */}
              {currentPool.isBoosted ? (
                <motion.div 
                  className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-purple-500 rounded-full border border-black flex items-center justify-center shadow-[0_0_6px_rgba(168,85,247,0.8)]"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Flame className="w-2 h-2 text-white" />
                </motion.div>
              ) : (
                <motion.div 
                  className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border border-black shadow-[0_0_6px_rgba(52,211,153,0.6)]"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
            </div>

            {/* Pool Info */}
            <div className="flex-1 text-left min-w-0">
              <div className="flex items-center gap-1.5">
                <h4 className={`text-xs font-semibold truncate transition-colors ${
                  currentPool.isBoosted 
                    ? 'text-white group-hover:text-purple-300' 
                    : 'text-white group-hover:text-emerald-300'
                }`}>
                  {currentPool.title}
                </h4>
                {currentPool.isBoosted && (
                  <span className="flex-shrink-0 px-1.5 py-0.5 bg-purple-500 text-[8px] font-bold text-white rounded uppercase shadow-[0_0_8px_rgba(168,85,247,0.5)]">
                    Boosted
                  </span>
                )}
                {currentPool.isRecent && !currentPool.isBoosted && (
                  <span className="flex-shrink-0 px-1.5 py-0.5 bg-emerald-500 text-[8px] font-bold text-white rounded uppercase">
                    New
                  </span>
                )}
              </div>
              
              {/* Reward per block or boost info */}
              {currentPool.isBoosted && currentPool.active_boost_amount ? (
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex items-center gap-1">
                    <Flame className="w-2.5 h-2.5 text-purple-400" />
                    <span className="text-[9px] text-purple-300">{formatBoostAmount(currentPool.active_boost_amount)} AVLO</span>
                  </div>
                  {currentPool.boost_expires_at && (
                    <div className="flex items-center gap-0.5">
                      <Clock className="w-2 h-2 text-purple-400/60" />
                      <span className="text-[8px] text-purple-300/60">
                        {formatDistanceToNow(new Date(currentPool.boost_expires_at), { addSuffix: false })}
                      </span>
                    </div>
                  )}
                </div>
              ) : rewardPerBlock && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Zap className="w-2.5 h-2.5 text-yellow-400" />
                  <span className="text-[9px] text-yellow-400/80">{rewardPerBlock}/block</span>
                </div>
              )}
            </div>

            {/* Top Stakers */}
            {currentPool.topStakers && currentPool.topStakers.length > 0 && (
              <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                <div className="flex -space-x-1.5">
                  {currentPool.topStakers.map((staker, idx) => (
                    <div
                      key={staker.user_id}
                      className="w-5 h-5 rounded-full border border-black overflow-hidden bg-zinc-800"
                      style={{ zIndex: 3 - idx }}
                    >
                      {staker.avatar_url ? (
                        <img
                          src={staker.avatar_url}
                          alt={staker.username || 'Staker'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-zinc-600 to-zinc-700" />
                      )}
                    </div>
                  ))}
                </div>
                <span className="text-[8px] text-white/40">staked</span>
              </div>
            )}

            {/* Dots Indicator (inline) */}
            {pools.length > 1 && (
              <div className="flex flex-col items-center gap-0.5 flex-shrink-0 ml-1">
                {pools.map((pool, index) => (
                  <div
                    key={index}
                    className={`w-1 h-1 rounded-full transition-all ${
                      index === currentIndex 
                        ? pool.isBoosted 
                          ? 'bg-purple-400 h-2 shadow-[0_0_4px_rgba(168,85,247,0.5)]'
                          : 'bg-emerald-400 h-2 shadow-[0_0_4px_rgba(52,211,153,0.5)]'
                        : 'bg-white/20'
                    }`}
                  />
                ))}
              </div>
            )}
          </motion.button>
        </AnimatePresence>
      </div>
    </div>
  );
};