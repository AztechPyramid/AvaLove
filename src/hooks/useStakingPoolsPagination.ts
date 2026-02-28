import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Contract, JsonRpcProvider, formatUnits } from 'ethers';
import { STAKING_ABI } from '@/config/staking';

interface CreatorProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  arena_username: string | null;
  arena_verified: boolean | null;
}

export interface StakingPool {
  id: string;
  title: string;
  staking_contract_address: string;
  stake_token_address: string;
  reward_token_address: string;
  reward_pool_address: string;
  stake_token_logo: string;
  reward_token_logo: string;
  is_active: boolean;
  is_featured?: boolean;
  pending_approval?: boolean;
  pending_submitted_at?: string;
  display_order: number;
  start_block?: number;
  end_block?: number;
  creator_wallet?: string;
  creator_profile?: CreatorProfile | null;
  boost_amount?: number;
  boosted_at?: string;
  creation_tx_hash?: string;
}

const POOLS_PER_PAGE = 10;

export const useStakingPoolsPagination = (
  searchQuery: string,
  walletAddress: string | null,
  currentBlock: number,
  poolActiveBoosts: Record<string, number>
) => {
  const [allPools, setAllPools] = useState<StakingPool[]>([]);
  const [displayedPools, setDisplayedPools] = useState<StakingPool[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [poolTotalStaked, setPoolTotalStaked] = useState<Record<string, bigint>>({});
  const [poolRewardRates, setPoolRewardRates] = useState<Record<string, string>>({});
  const [creatorProfiles, setCreatorProfiles] = useState<Record<string, CreatorProfile | null>>({});
  
  // Track which pools we've already fetched on-chain data for
  const fetchedOnChainRef = useRef<Set<string>>(new Set());
  const providerRef = useRef<JsonRpcProvider | null>(null);

  // Get or create provider
  const getProvider = useCallback(() => {
    if (!providerRef.current) {
      providerRef.current = new JsonRpcProvider('https://api.avax.network/ext/bc/C/rpc');
    }
    return providerRef.current;
  }, []);

  // Check if pool has ended
  const isPoolEnded = useCallback((pool: StakingPool): boolean => {
    if (!pool.end_block || !currentBlock) return false;
    return currentBlock > pool.end_block;
  }, [currentBlock]);

  // Sort pools based on criteria
  const sortPools = useCallback((pools: StakingPool[]): StakingPool[] => {
    return [...pools].sort((a, b) => {
      const aEnded = isPoolEnded(a);
      const bEnded = isPoolEnded(b);
      const aIsOwn = walletAddress && a.creator_wallet?.toLowerCase() === walletAddress.toLowerCase() && !a.is_featured;
      const bIsOwn = walletAddress && b.creator_wallet?.toLowerCase() === walletAddress.toLowerCase() && !b.is_featured;
      
      // Ended pools always at bottom
      if (aEnded && !bEnded) return 1;
      if (!aEnded && bEnded) return -1;
      
      // Featured pools always at top
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      
      // User's own pools come after featured but before others
      if (aIsOwn && !bIsOwn) return -1;
      if (!aIsOwn && bIsOwn) return 1;
      
      // Within non-featured pools: pending_approval pools come first
      if (!a.is_featured && !b.is_featured && !aIsOwn && !bIsOwn) {
        const aPending = a.pending_approval || false;
        const bPending = b.pending_approval || false;
        if (aPending && !bPending) return -1;
        if (!aPending && bPending) return 1;
        
        // Both pending: sort by pending_submitted_at (most recent first)
        if (aPending && bPending) {
          const aTime = a.pending_submitted_at ? new Date(a.pending_submitted_at).getTime() : 0;
          const bTime = b.pending_submitted_at ? new Date(b.pending_submitted_at).getTime() : 0;
          return bTime - aTime;
        }
      }
      
      // Sort by active boost amount
      const aBoost = poolActiveBoosts[a.id] || 0;
      const bBoost = poolActiveBoosts[b.id] || 0;
      if (bBoost !== aBoost) return bBoost - aBoost;
      
      return 0;
    });
  }, [isPoolEnded, walletAddress, poolActiveBoosts]);

  // Filter pools by search query
  const filterPools = useCallback((pools: StakingPool[], query: string): StakingPool[] => {
    if (!query.trim()) return pools;
    
    const lowerQuery = query.toLowerCase();
    return pools.filter(pool => {
      if (pool.title.toLowerCase().includes(lowerQuery)) return true;
      if (pool.stake_token_address.toLowerCase().includes(lowerQuery)) return true;
      if (pool.reward_token_address.toLowerCase().includes(lowerQuery)) return true;
      if (pool.creator_profile) {
        if (pool.creator_profile.username.toLowerCase().includes(lowerQuery)) return true;
        if (pool.creator_profile.display_name?.toLowerCase().includes(lowerQuery)) return true;
        if (pool.creator_profile.arena_username?.toLowerCase().includes(lowerQuery)) return true;
      }
      return false;
    });
  }, []);

  // Fetch on-chain data for specific pools (lazy loading)
  const fetchOnChainDataForPools = useCallback(async (pools: StakingPool[]) => {
    const poolsToFetch = pools.filter(p => !fetchedOnChainRef.current.has(p.id));
    if (poolsToFetch.length === 0) return;

    const provider = getProvider();
    
    // Fetch total staked and reward rates in parallel
    const results = await Promise.allSettled(
      poolsToFetch.map(async (pool) => {
        let totalStaked = BigInt(0);
        let rewardRate = '';
        
        try {
          const stakingContract = new Contract(pool.staking_contract_address, STAKING_ABI, provider);
          
          // Fetch both in parallel
          const [supply, rewardInfo] = await Promise.all([
            stakingContract.totalSupply().catch(() => BigInt(0)),
            stakingContract.rewardTokenInfos(0).catch(() => null)
          ]);
          
          totalStaked = supply;
          if (rewardInfo && rewardInfo[4]) {
            rewardRate = formatUnits(rewardInfo[4], 18);
          }
        } catch (e) {
          console.log(`Could not fetch on-chain data for ${pool.title}:`, e);
        }
        
        return { poolId: pool.id, totalStaked, rewardRate };
      })
    );

    // Update state with fetched data
    const newStaked: Record<string, bigint> = {};
    const newRates: Record<string, string> = {};
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const { poolId, totalStaked, rewardRate } = result.value;
        newStaked[poolId] = totalStaked;
        if (rewardRate) newRates[poolId] = rewardRate;
        fetchedOnChainRef.current.add(poolId);
      }
    });

    setPoolTotalStaked(prev => ({ ...prev, ...newStaked }));
    setPoolRewardRates(prev => ({ ...prev, ...newRates }));
  }, [getProvider]);

  // Fetch creator profiles for pools
  const fetchCreatorProfiles = useCallback(async (pools: StakingPool[]) => {
    const wallets = pools
      .map(p => p.creator_wallet?.toLowerCase())
      .filter((w): w is string => !!w && !creatorProfiles[w]);
    
    if (wallets.length === 0) return;

    const uniqueWallets = [...new Set(wallets)];
    
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, arena_username, arena_verified, wallet_address")
      .in("wallet_address", uniqueWallets);

    if (profiles) {
      const profileMap: Record<string, CreatorProfile> = {};
      profiles.forEach(p => {
        if (p.wallet_address) {
          profileMap[p.wallet_address.toLowerCase()] = {
            id: p.id,
            username: p.username,
            display_name: p.display_name,
            avatar_url: p.avatar_url,
            arena_username: p.arena_username,
            arena_verified: p.arena_verified
          };
        }
      });
      setCreatorProfiles(prev => ({ ...prev, ...profileMap }));
    }
  }, [creatorProfiles]);

  // Fetch initial pools from database (lightweight, no on-chain data)
  const fetchAllPools = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("staking_pools")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) {
        console.error("Error fetching pools:", error);
        return;
      }

      const pools = (data || []) as StakingPool[];
      setAllPools(pools);
      
      // Fetch creator profiles for all pools (lightweight DB query)
      await fetchCreatorProfiles(pools);
    } finally {
      setLoading(false);
    }
  };

  // Add creator profiles to pools
  const poolsWithProfiles = useMemo(() => {
    return allPools.map(pool => ({
      ...pool,
      creator_profile: pool.creator_wallet 
        ? creatorProfiles[pool.creator_wallet.toLowerCase()] || null 
        : null
    }));
  }, [allPools, creatorProfiles]);

  // Memoized filtered and sorted pools
  const processedPools = useMemo(() => {
    const filtered = filterPools(poolsWithProfiles, searchQuery);
    return sortPools(filtered);
  }, [poolsWithProfiles, searchQuery, filterPools, sortPools]);

  // Update displayed pools when search changes or on initial load
  useEffect(() => {
    if (searchQuery.trim()) {
      // When searching, show all matching results immediately
      setDisplayedPools(processedPools);
      setHasMore(false);
    } else {
      // When not searching, paginate
      const initialPools = processedPools.slice(0, POOLS_PER_PAGE);
      setDisplayedPools(initialPools);
      setHasMore(processedPools.length > POOLS_PER_PAGE);
      setPage(1);
    }
  }, [processedPools, searchQuery]);

  // Fetch on-chain data only for displayed pools (lazy loading)
  useEffect(() => {
    if (displayedPools.length > 0) {
      fetchOnChainDataForPools(displayedPools);
    }
  }, [displayedPools, fetchOnChainDataForPools]);

  // Load more pools
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || searchQuery.trim()) return;
    
    setLoadingMore(true);
    const nextPage = page + 1;
    const endIndex = nextPage * POOLS_PER_PAGE;
    const newPools = processedPools.slice(0, endIndex);
    
    setDisplayedPools(newPools);
    setPage(nextPage);
    setHasMore(endIndex < processedPools.length);
    setLoadingMore(false);
  }, [page, hasMore, loadingMore, processedPools, searchQuery]);

  // Refresh pools
  const refresh = useCallback(() => {
    // Clear cached on-chain data
    fetchedOnChainRef.current.clear();
    setPoolTotalStaked({});
    setPoolRewardRates({});
    fetchAllPools();
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchAllPools();
  }, []);

  return {
    displayedPools,
    allPools: poolsWithProfiles,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    refresh,
    poolTotalStaked,
    poolRewardRates,
    totalCount: allPools.length,
    filteredCount: processedPools.length
  };
};
