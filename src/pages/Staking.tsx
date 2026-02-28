import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Coins, TrendingUp, Wallet, ArrowDownToLine, ArrowUpFromLine, Gift, Loader2, Search, ChevronLeft, ChevronRight, Calendar, Clock, User, BadgeCheck, FileText, Database, Banknote, Vault, LayoutDashboard, Trophy, ChevronDown, Info, Flame, Send, Sparkles } from "lucide-react";
import { CopyableAddress } from "@/components/CopyableAddress";
import { AnimatedAvatar } from "@/components/AnimatedAvatar";
import { useStaking } from "@/hooks/useStaking";
import { toast } from "sonner";
import { useWeb3Auth } from "@/hooks/useWeb3Auth";
import { TransactionProgress } from "@/components/TransactionProgress";
import { supabase } from "@/integrations/supabase/client";
import CreateStakingPoolDialog from "@/components/staking/CreateStakingPoolDialog";
import { StakingPoolLeaderboard } from "@/components/staking/StakingPoolLeaderboard";
import { UserStakingOverview } from "@/components/staking/UserStakingOverview";
import { BoostPoolButton } from "@/components/staking/BoostPoolButton";
import { PoolBoostInfo } from "@/components/staking/PoolBoostInfo";
import { PoolCountdown } from "@/components/staking/PoolCountdown";
import { StakingTutorialDialog } from "@/components/staking/StakingTutorialDialog";
import { cn } from "@/lib/utils";
import { ArenaVerifiedBadge } from "@/components/ArenaVerifiedBadge";
import { useIsMobile } from "@/hooks/use-mobile";
import { Contract, JsonRpcProvider, formatUnits } from "ethers";
import { STAKING_ABI } from "@/config/staking";
import { useStakingChat } from "@/components/FloatingChat";
import { usePendingStakingTx } from "@/hooks/usePendingStakingTx";
import { calculateBulkPoolAPYs, calculateAPY } from "@/hooks/usePoolAPY";
import { useStakingPoolsPagination, StakingPool } from "@/hooks/useStakingPoolsPagination";

// Helper to check if URL is a video
const isVideoUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
  const lowerUrl = url.toLowerCase();
  return videoExtensions.some(ext => lowerUrl.includes(ext));
};

// CreatorProfile interface is defined in the hook

const Staking = () => {
  const { walletAddress, isConnected, isArena } = useWeb3Auth();
  const isMobile = useIsMobile();
  const stakingChatContext = useStakingChat();
  const [searchParams] = useSearchParams();
  const poolIdFromUrl = searchParams.get('pool');
  const [selectedPool, setSelectedPool] = useState<StakingPool | null>(null);
  const [showOverview, setShowOverview] = useState(!poolIdFromUrl); // Show overview if no pool in URL
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true); // Start collapsed, will adjust on mount
  const [poolActiveBoosts, setPoolActiveBoosts] = useState<Record<string, number>>({});
  const [currentBlock, setCurrentBlock] = useState<number>(0);
  const [poolsRefreshTrigger, setPoolsRefreshTrigger] = useState(0);
  const [poolAPYs, setPoolAPYs] = useState<Record<string, { apy: number; type: 'usd' | 'token' | 'rate' | 'none' }>>({});
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

  // Use paginated pools hook
  const {
    displayedPools: filteredPools,
    allPools: pools,
    loading: poolsLoading,
    loadingMore,
    hasMore,
    loadMore,
    refresh: refreshPools,
    poolTotalStaked,
    poolRewardRates,
    totalCount
  } = useStakingPoolsPagination(searchQuery, walletAddress, currentBlock, poolActiveBoosts);

  // Pending TX recovery hook - polls every 30 seconds for orphaned transactions
  usePendingStakingTx(walletAddress, () => setPoolsRefreshTrigger(prev => prev + 1));

  // Refresh pools when trigger changes
  useEffect(() => {
    if (poolsRefreshTrigger > 0) {
      refreshPools();
    }
  }, [poolsRefreshTrigger, refreshPools]);

  // Constants
  const TOTAL_TOKEN_SUPPLY = 10_000_000_000;

  // Fetch current block on mount
  useEffect(() => {
    const fetchCurrentBlock = async () => {
      try {
        const provider = new JsonRpcProvider('https://api.avax.network/ext/bc/C/rpc');
        const block = await provider.getBlockNumber();
        setCurrentBlock(block);
      } catch (err) {
        console.log("Could not fetch current block:", err);
      }
    };
    fetchCurrentBlock();
    // Refresh every 30 seconds
    const interval = setInterval(fetchCurrentBlock, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch active boosts
  useEffect(() => {
    const fetchActiveBoosts = async () => {
      const now = new Date().toISOString();
      const { data: activeBoosts } = await supabase
        .from('staking_pool_boosts')
        .select('pool_id, amount')
        .gt('expires_at', now);

      const boostMap: Record<string, number> = {};
      if (activeBoosts) {
        for (const boost of activeBoosts) {
          boostMap[boost.pool_id] = (boostMap[boost.pool_id] || 0) + Number(boost.amount);
        }
      }
      setPoolActiveBoosts(boostMap);
    };
    fetchActiveBoosts();
  }, [poolsRefreshTrigger]);

  // Check if pool has ended
  const isPoolEnded = (pool: StakingPool): boolean => {
    if (!pool.end_block || !currentBlock) return false;
    return currentBlock > pool.end_block;
  };

  // Set sidebar collapsed based on mobile on mount
  useEffect(() => {
    setSidebarCollapsed(isMobile);
  }, [isMobile]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !searchQuery.trim()) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreTriggerRef.current) {
      observer.observe(loadMoreTriggerRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadMore, searchQuery]);

  // Select first pool when pools are loaded
  useEffect(() => {
    if (pools.length > 0 && !selectedPool) {
      if (poolIdFromUrl) {
        // Try to find by pool ID first, then by staking contract address
        const targetPool = pools.find(p => p.id === poolIdFromUrl || p.staking_contract_address?.toLowerCase() === poolIdFromUrl.toLowerCase());
        if (targetPool) {
          setSelectedPool(targetPool);
          setShowOverview(false);
          return;
        }
      }
      // Select pool with highest total staked
      const sortedByStake = [...pools].sort((a, b) => {
        const aStake = poolTotalStaked[a.id] || BigInt(0);
        const bStake = poolTotalStaked[b.id] || BigInt(0);
        if (bStake > aStake) return 1;
        if (bStake < aStake) return -1;
        return 0;
      });
      if (sortedByStake.length > 0) {
        setSelectedPool(sortedByStake[0]);
      }
    }
  }, [pools.length, poolIdFromUrl, poolTotalStaked]);


  // Fetch staking chat room when selectedPool changes and update global chat context
  useEffect(() => {
    let isMounted = true;
    
    const fetchStakingChatRoom = async () => {
      if (!selectedPool || showOverview) {
        if (isMounted) {
          stakingChatContext?.setStakingRoom(null, null);
        }
        return;
      }
      
      try {
        // Chat rooms use pool ID as reference_id
        const { data: room } = await supabase
          .from('chat_rooms')
          .select('id')
          .eq('room_type', 'staking')
          .eq('reference_id', selectedPool.id)
          .single();
        
        if (isMounted) {
          if (room) {
            stakingChatContext?.setStakingRoom(room.id, selectedPool.title);
          } else {
            // Create room if it doesn't exist or just show global
            stakingChatContext?.setStakingRoom(null, selectedPool.title);
          }
        }
      } catch (err) {
        console.log('Could not fetch staking chat room:', err);
        if (isMounted) {
          stakingChatContext?.setStakingRoom(null, null);
        }
      }
    };
    
    fetchStakingChatRoom();
    
    return () => {
      isMounted = false;
    };
  }, [selectedPool?.id, showOverview]);
  
  // Cleanup only when leaving the staking page entirely
  useEffect(() => {
    return () => {
      stakingChatContext?.setStakingRoom(null, null);
    };
  }, []);

  // Fetch APYs for all pools using centralized calculation
  const fetchAllPoolAPYs = useCallback(async (poolList: StakingPool[]) => {
    if (currentBlock === 0) return;
    
    try {
      const poolsForAPY = poolList.map(p => ({
        id: p.id,
        stakeTokenAddress: p.stake_token_address,
        rewardTokenAddress: p.reward_token_address,
        rewardPoolAddress: p.reward_pool_address,
        stakingContractAddress: p.staking_contract_address,
        endBlock: p.end_block
      }));
      
      const apys = await calculateBulkPoolAPYs(
        poolsForAPY,
        currentBlock,
        poolTotalStaked,
        poolRewardRates
      );
      
      setPoolAPYs(apys);
    } catch (e) {
      console.log('Error fetching pool APYs:', e);
    }
  }, [currentBlock, poolTotalStaked, poolRewardRates]);

  // Re-fetch APYs when dependencies change
  useEffect(() => {
    if (pools.length > 0 && currentBlock > 0) {
      fetchAllPoolAPYs(pools);
    }
  }, [pools.length, currentBlock, Object.keys(poolTotalStaked).length, Object.keys(poolRewardRates).length, fetchAllPoolAPYs]);

  // Get APY for a pool from cached results
  const getPoolAPY = (pool: StakingPool): number => {
    return poolAPYs[pool.id]?.apy || 0;
  };

  if (!isConnected) {
    return (
      <>
        <header className="sr-only">
          <h1>Staking v1 Earn</h1>
        </header>
        <main className="min-h-[60vh] flex items-center justify-center bg-black px-4 py-10">
          <Card className="max-w-md w-full bg-zinc-900 border-zinc-800 rounded-3xl shadow-2xl p-8 text-center space-y-4">
            <Wallet className="w-16 h-16 mx-auto text-orange-500" />
            <h2 className="text-2xl font-bold text-white">Connect Wallet</h2>
            <p className="text-zinc-400">
              Please connect your wallet to access staking features
            </p>
          </Card>
        </main>
      </>
    );
  }

  if (pools.length === 0 && !poolsLoading) {
    return (
      <>
        <header className="sr-only">
          <h1>Staking v1 Earn</h1>
        </header>
        <main className="min-h-[60vh] flex items-center justify-center bg-black px-4 py-10">
          <Card className="max-w-md w-full bg-zinc-900 border-zinc-800 rounded-3xl shadow-2xl p-8 text-center space-y-4">
            <Coins className="w-16 h-16 mx-auto text-orange-500" />
            <h2 className="text-2xl font-bold text-white">No Staking Pools Available</h2>
            <p className="text-zinc-400">
              There are no active staking pools at the moment
            </p>
            <CreateStakingPoolDialog onPoolCreated={refreshPools} />
          </Card>
        </main>
      </>
    );
  }

  // Handler to select a pool from overview
  const handleSelectPoolFromOverview = (poolId: string) => {
    const pool = pools.find(p => p.id === poolId);
    if (pool) {
      setSelectedPool(pool);
      setShowOverview(false);
    }
  };

  // Handler to browse all pools
  const handleBrowseAllPools = () => {
    setShowOverview(false);
    if (!selectedPool && pools.length > 0) {
      // Select pool with highest stake
      const sortedByStake = [...pools].sort((a, b) => {
        const aStake = poolTotalStaked[a.id] || BigInt(0);
        const bStake = poolTotalStaked[b.id] || BigInt(0);
        if (bStake > aStake) return 1;
        if (bStake < aStake) return -1;
        return 0;
      });
      setSelectedPool(sortedByStake[0]);
    }
  };

  // Use sidebar state directly - user controls it
  const effectiveSidebarCollapsed = sidebarCollapsed;

  return (
    <>
      <header className="sr-only">
        <h1>Staking {"{Multi Earn}"}</h1>
      </header>
      <main className="min-h-screen bg-black flex">
        {/* Sidebar */}
        <aside 
          className={cn(
            "bg-zinc-950 border-r border-zinc-800 flex flex-col transition-all duration-300 relative overflow-hidden flex-shrink-0",
            effectiveSidebarCollapsed ? "w-16" : "w-72 max-w-[85vw]"
          )}
        >
          {/* Collapse Toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="absolute right-1 top-6 z-10 w-7 h-7 bg-zinc-800 border border-zinc-700 rounded-full flex items-center justify-center hover:bg-zinc-700 transition-colors shadow-lg"
          >
            {effectiveSidebarCollapsed ? (
              <ChevronRight className="w-4 h-4 text-zinc-400" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-zinc-400" />
            )}
          </button>

          {/* Sidebar Header */}
          <div className={cn("p-4 border-b border-zinc-800", effectiveSidebarCollapsed && "px-2")}>
            {!effectiveSidebarCollapsed && (
              <>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Coins className="w-5 h-5 text-orange-500" />
                  Staking Pools
                </h2>
                <p className="text-xs text-zinc-500 mt-1">{pools.length} active pools</p>
              </>
            )}
            {effectiveSidebarCollapsed && (
              <Coins className="w-6 h-6 text-orange-500 mx-auto" />
            )}
          </div>

          {!effectiveSidebarCollapsed && (
            <div className="p-3 border-b border-zinc-800 space-y-3">
              <Button
                onClick={() => setShowOverview(true)}
                variant="outline"
                className="w-full bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20 hover:text-orange-300"
              >
                <LayoutDashboard className="w-4 h-4 mr-2" />
                My Dashboard
              </Button>
              <CreateStakingPoolDialog onPoolCreated={refreshPools} />
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input
                  placeholder="Search pools..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 h-9"
                />
              </div>
            </div>
          )}
          
          {effectiveSidebarCollapsed && (
            <div className="p-2 border-b border-zinc-800">
              <button
                onClick={() => setShowOverview(true)}
                className="w-full p-2 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 transition-colors"
                title="My Dashboard"
              >
                <LayoutDashboard className="w-5 h-5 text-orange-500 mx-auto" />
              </button>
            </div>
          )}

          {/* Pool List */}
          <ScrollArea className="flex-1 w-full">
            <div className={cn("p-2 space-y-1 w-full", effectiveSidebarCollapsed ? "p-1" : "pr-4")}>
              {/* Approved Pools Section */}
              {filteredPools.some(p => p.is_featured) && !effectiveSidebarCollapsed && (
                <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
                  <BadgeCheck className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Approved</span>
                </div>
              )}
              
              {filteredPools.filter(p => p.is_featured).map((pool) => {
                const ended = isPoolEnded(pool);
                const isBoosted = (poolActiveBoosts[pool.id] || 0) > 0;
                return (
                  <button
                    key={pool.id}
                    onClick={() => {
                      setSelectedPool(pool);
                      setShowOverview(false);
                    }}
                    className={cn(
                      "w-full max-w-full rounded-lg transition-all duration-200 group border-2 relative overflow-hidden box-border",
                      effectiveSidebarCollapsed ? "p-2" : "p-2.5",
                      ended 
                        ? "border-red-500/40 bg-red-500/5" 
                        : isBoosted
                          ? "border-purple-500/60 bg-gradient-to-br from-purple-900/30 via-pink-900/20 to-purple-900/30"
                          : "border-green-500/60 bg-green-500/5",
                      selectedPool?.id === pool.id && !showOverview && "ring-2 ring-orange-500/50"
                    )}
                  >
                    {/* Boosted flame effect */}
                    {isBoosted && !ended && (
                      <div className="absolute inset-0 pointer-events-none rounded-[inherit] overflow-hidden">
                        <div className="absolute -top-2 -left-2 w-8 h-8 bg-purple-500/20 rounded-full blur-xl animate-pulse" />
                        <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-pink-500/20 rounded-full blur-lg animate-pulse delay-300" />
                      </div>
                    )}
                    {effectiveSidebarCollapsed ? (
                      <div className="relative">
                        <img
                          src={pool.stake_token_logo}
                          alt={pool.title}
                          className={cn(
                            "w-8 h-8 rounded-full object-cover mx-auto ring-2",
                            ended ? "ring-red-500" : isBoosted ? "ring-purple-500" : "ring-green-500"
                          )}
                        />
                        {isBoosted && !ended ? (
                          <Flame className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 text-purple-400" />
                        ) : (
                          <span className={cn(
                            "absolute -bottom-1 left-1/2 -translate-x-1/2 text-[6px] font-bold px-1 rounded",
                            ended ? "bg-red-500 text-white" : "bg-green-500 text-black"
                          )}>
                            {ended ? "END" : "LIVE"}
                          </span>
                        )}
                        {/* Featured badge when collapsed */}
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                          <BadgeCheck className="w-3 h-3 text-white fill-blue-500" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 relative z-10">
                        <div className="relative flex-shrink-0">
                          <img
                            src={pool.stake_token_logo}
                            alt={pool.title}
                            className={cn(
                              "w-9 h-9 rounded-full object-cover",
                              isBoosted && !ended && "ring-2 ring-purple-500/60"
                            )}
                          />
                          <img
                            src={pool.reward_token_logo}
                            alt="Reward"
                            className="w-4 h-4 rounded-full object-cover absolute -bottom-0.5 -right-0.5 ring-2 ring-zinc-950"
                          />
                        </div>
                        <div className="flex-1 text-left min-w-0 overflow-hidden">
                          <div className="flex items-center gap-1.5 max-w-full overflow-hidden">
                            <p className={cn(
                              "font-medium truncate text-xs flex-shrink min-w-0",
                              selectedPool?.id === pool.id ? "text-orange-400" : "text-white"
                            )}>
                              {pool.title}
                            </p>
                            {/* Live/Ended/Boosted Badge */}
                            {isBoosted && !ended ? (
                              <Badge 
                                variant="outline" 
                                className="text-[9px] px-1.5 py-0 h-4 font-bold flex-shrink-0 border-purple-500 bg-gradient-to-r from-purple-500/30 to-pink-500/30 text-purple-300 gap-0.5"
                              >
                                <Flame className="w-2.5 h-2.5" />
                                BOOSTED
                              </Badge>
                            ) : (
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-[9px] px-1.5 py-0 h-4 font-bold flex-shrink-0",
                                  ended 
                                    ? "border-red-500 bg-red-500/20 text-red-400" 
                                    : "border-green-500 bg-green-500/20 text-green-400"
                                )}
                              >
                                {ended ? "ENDED" : "Live"}
                              </Badge>
                            )}
                            {/* Featured Badge - Blue filled */}
                            <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                              <BadgeCheck className="w-4 h-4 text-white fill-blue-500" />
                            </div>
                          </div>
                        {/* APY Row */}
                        <div className="flex items-center gap-2 mt-1">
                          {/* APY */}
                          {(() => {
                            const apy = getPoolAPY(pool);
                            if (apy > 0) {
                              return (
                                <span className="text-[10px] text-purple-400 font-bold bg-purple-500/10 px-1.5 py-0.5 rounded">
                                  {apy >= 1000 ? `${(apy / 1000).toFixed(1)}K%` : `${apy.toFixed(0)}%`} APY
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        {/* Reward Per Block with token logo */}
                        {poolRewardRates[pool.id] && parseFloat(poolRewardRates[pool.id]) > 0 && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <img 
                              src={pool.reward_token_logo} 
                              alt="Reward" 
                              className="w-3.5 h-3.5 rounded-full object-cover"
                            />
                            <span className="text-[10px] text-green-400 font-medium">
                              {parseFloat(poolRewardRates[pool.id]).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}/block
                            </span>
                          </div>
                        )}
                        {/* Creator Info */}
                        {pool.creator_profile ? (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <AnimatedAvatar
                              userId={pool.creator_profile.id}
                              avatarUrl={pool.creator_profile.avatar_url}
                              username={pool.creator_profile.username}
                              displayName={pool.creator_profile.display_name}
                              className="w-4 h-4"
                              fallbackClassName="text-[8px]"
                            />
                            <span className="text-xs text-zinc-400 truncate max-w-[100px]">
                              {pool.creator_profile.arena_verified && pool.creator_profile.arena_username 
                                ? pool.creator_profile.arena_username 
                                : (pool.creator_profile.display_name || pool.creator_profile.username)?.startsWith('0x') && (pool.creator_profile.display_name || pool.creator_profile.username)?.length > 20
                                  ? `${(pool.creator_profile.display_name || pool.creator_profile.username).slice(0, 6)}...${(pool.creator_profile.display_name || pool.creator_profile.username).slice(-4)}`
                                  : pool.creator_profile.display_name || pool.creator_profile.username}
                            </span>
                            {pool.creator_profile.arena_verified && (
                              <ArenaVerifiedBadge size="sm" username={pool.creator_profile.arena_username || undefined} />
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-zinc-500 truncate">
                            {pool.staking_contract_address.slice(0, 8)}...
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  </button>
                );
              })}

              {/* Separator between approved and my pools */}
              {filteredPools.some(p => p.is_featured) && filteredPools.some(p => !p.is_featured && walletAddress && p.creator_wallet?.toLowerCase() === walletAddress.toLowerCase()) && (
                <div className={cn("my-3", effectiveSidebarCollapsed && "my-2")}>
                  {!effectiveSidebarCollapsed ? (
                    <div className="relative py-2">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t-2 border-dashed border-zinc-500/40" />
                      </div>
                      <div className="relative flex justify-center">
                        <span className="bg-zinc-950 px-3 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider rounded-full border border-zinc-500/30">
                          My Pools
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="w-8 mx-auto border-t-2 border-dashed border-zinc-500/40" />
                  )}
                </div>
              )}

              {/* My Pools Section Header (when no featured pools but has own pools) */}
              {!filteredPools.some(p => p.is_featured) && filteredPools.some(p => walletAddress && p.creator_wallet?.toLowerCase() === walletAddress.toLowerCase()) && !effectiveSidebarCollapsed && (
                <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
                  <User className="w-4 h-4 text-zinc-400" />
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">My Pools</span>
                </div>
              )}

              {/* User's Own Pools (Gray) */}
              {filteredPools.filter(p => !p.is_featured && walletAddress && p.creator_wallet?.toLowerCase() === walletAddress.toLowerCase()).map((pool) => {
                const ended = isPoolEnded(pool);
                const isBoosted = (poolActiveBoosts[pool.id] || 0) > 0;
                const isPendingApproval = pool.pending_approval && !ended;
                return (
                  <button
                    key={pool.id}
                    onClick={() => {
                      setSelectedPool(pool);
                      setShowOverview(false);
                    }}
                    className={cn(
                      "w-full max-w-full rounded-lg transition-all duration-200 group border-2 relative overflow-hidden box-border",
                      effectiveSidebarCollapsed ? "p-2" : "p-2.5",
                      ended 
                        ? "border-red-500/40 bg-red-500/5" 
                        : "border-zinc-500/60 bg-zinc-800/50",
                      selectedPool?.id === pool.id && !showOverview && "ring-2 ring-orange-500/50"
                    )}
                  >
                    {effectiveSidebarCollapsed ? (
                      <div className="relative">
                        <img
                          src={pool.stake_token_logo}
                          alt={pool.title}
                          className={cn(
                            "w-8 h-8 rounded-full object-cover mx-auto ring-2",
                            ended ? "ring-red-500" : "ring-zinc-500"
                          )}
                        />
                        <span className={cn(
                          "absolute -bottom-1 left-1/2 -translate-x-1/2 text-[6px] font-bold px-1 rounded",
                          ended ? "bg-red-500 text-white" : "bg-zinc-500 text-white"
                        )}>
                          {ended ? "END" : "MINE"}
                        </span>
                        {isPendingApproval && (
                          <Sparkles className="absolute -top-1 -right-1 w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 relative z-10">
                        <div className="relative flex-shrink-0">
                          <img
                            src={pool.stake_token_logo}
                            alt={pool.title}
                            className="w-9 h-9 rounded-full object-cover ring-2 ring-zinc-500/60"
                          />
                          <img
                            src={pool.reward_token_logo}
                            alt="Reward"
                            className="w-4 h-4 rounded-full object-cover absolute -bottom-0.5 -right-0.5 ring-2 ring-zinc-950"
                          />
                        </div>
                        <div className="flex-1 text-left min-w-0 overflow-hidden">
                          <div className="flex items-center gap-1.5 max-w-full overflow-hidden">
                            <p className={cn(
                              "font-medium truncate text-xs flex-shrink min-w-0",
                              selectedPool?.id === pool.id ? "text-orange-400" : "text-white"
                            )}>
                              {pool.title}
                            </p>
                            {/* My Pool Badge - Gray */}
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-[9px] px-1.5 py-0 h-4 font-bold flex-shrink-0 border-zinc-500 bg-zinc-600/30 text-zinc-300 gap-0.5",
                                isPendingApproval && "border-cyan-500/50"
                              )}
                            >
                              <User className="w-2.5 h-2.5" />
                              MINE
                            </Badge>
                            {isPendingApproval && (
                              <Badge 
                                variant="outline" 
                                className="text-[9px] px-1.5 py-0 h-4 font-bold flex-shrink-0 border-cyan-500 bg-gradient-to-r from-cyan-500/30 to-blue-500/30 text-cyan-300 gap-0.5 animate-pulse"
                              >
                                <Sparkles className="w-2.5 h-2.5" />
                                PENDING
                              </Badge>
                            )}
                            {ended && (
                              <Badge 
                                variant="outline" 
                                className="text-[9px] px-1.5 py-0 h-4 font-bold flex-shrink-0 border-red-500 bg-red-500/20 text-red-400"
                              >
                                ENDED
                              </Badge>
                            )}
                          </div>
                          {/* APY Row */}
                          <div className="flex items-center gap-2 mt-1">
                            {(() => {
                              const apy = getPoolAPY(pool);
                              if (apy > 0) {
                                return (
                                  <span className="text-[10px] text-purple-400 font-bold bg-purple-500/10 px-1.5 py-0.5 rounded">
                                    {apy >= 1000 ? `${(apy / 1000).toFixed(1)}K%` : `${apy.toFixed(0)}%`} APY
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                          {/* Reward Per Block */}
                          {poolRewardRates[pool.id] && parseFloat(poolRewardRates[pool.id]) > 0 && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <img 
                                src={pool.reward_token_logo} 
                                alt="Reward" 
                                className="w-3.5 h-3.5 rounded-full object-cover"
                              />
                              <span className="text-[10px] text-green-400 font-medium">
                                {parseFloat(poolRewardRates[pool.id]).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}/block
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}

              {/* Separator between my pools and pending pools */}
              {filteredPools.some(p => walletAddress && p.creator_wallet?.toLowerCase() === walletAddress.toLowerCase() && !p.is_featured) && 
               filteredPools.some(p => !p.is_featured && !(walletAddress && p.creator_wallet?.toLowerCase() === walletAddress.toLowerCase())) && (
                <div className={cn("my-3", effectiveSidebarCollapsed && "my-2")}>
                  {!effectiveSidebarCollapsed ? (
                    <div className="relative py-2">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t-2 border-dashed border-amber-500/40" />
                      </div>
                      <div className="relative flex justify-center">
                        <span className="bg-zinc-950 px-3 py-1 text-[10px] font-semibold text-amber-400 uppercase tracking-wider rounded-full border border-amber-500/30">
                          Pending Approval
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="w-8 mx-auto border-t-2 border-dashed border-amber-500/40" />
                  )}
                </div>
              )}

              {/* Separator between approved and pending pools (when no own pools) */}
              {filteredPools.some(p => p.is_featured) && 
               !filteredPools.some(p => walletAddress && p.creator_wallet?.toLowerCase() === walletAddress.toLowerCase() && !p.is_featured) &&
               filteredPools.some(p => !p.is_featured) && (
                <div className={cn("my-3", effectiveSidebarCollapsed && "my-2")}>
                  {!effectiveSidebarCollapsed ? (
                    <div className="relative py-2">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t-2 border-dashed border-amber-500/40" />
                      </div>
                      <div className="relative flex justify-center">
                        <span className="bg-zinc-950 px-3 py-1 text-[10px] font-semibold text-amber-400 uppercase tracking-wider rounded-full border border-amber-500/30">
                          Pending Approval
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="w-8 mx-auto border-t-2 border-dashed border-amber-500/40" />
                  )}
                </div>
              )}

              {/* Pending (Non-Featured, Non-Own) Pools */}
              {filteredPools.filter(p => !p.is_featured && !(walletAddress && p.creator_wallet?.toLowerCase() === walletAddress.toLowerCase())).map((pool) => {
                const ended = isPoolEnded(pool);
                const isBoosted = (poolActiveBoosts[pool.id] || 0) > 0;
                const isPendingApproval = pool.pending_approval && !ended;
                return (
                  <button
                    key={pool.id}
                    onClick={() => {
                      setSelectedPool(pool);
                      setShowOverview(false);
                    }}
                    className={cn(
                      "w-full max-w-full rounded-lg transition-all duration-200 group border-2 relative overflow-hidden box-border",
                      effectiveSidebarCollapsed ? "p-2" : "p-2.5",
                      ended 
                        ? "border-red-500/40 bg-red-500/5" 
                        : isPendingApproval
                          ? "border-cyan-500/60 bg-gradient-to-br from-cyan-900/20 via-blue-900/10 to-cyan-900/20"
                          : isBoosted
                            ? "border-purple-500/60 bg-gradient-to-br from-purple-900/30 via-pink-900/20 to-purple-900/30"
                            : "border-amber-500/40 bg-amber-500/5",
                      selectedPool?.id === pool.id && !showOverview && "ring-2 ring-orange-500/50"
                    )}
                  >
                    {/* Pending approval pulsing blue glow effect */}
                    {isPendingApproval && (
                      <div className="absolute inset-0 pointer-events-none rounded-[inherit] overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/20 to-cyan-500/10 animate-pulse" />
                        <div className="absolute -top-4 -left-4 w-12 h-12 bg-cyan-400/30 rounded-full blur-2xl animate-[pulse_1.5s_ease-in-out_infinite]" />
                        <div className="absolute -bottom-4 -right-4 w-10 h-10 bg-blue-400/25 rounded-full blur-xl animate-[pulse_2s_ease-in-out_infinite_0.5s]" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-cyan-500/10 rounded-full blur-2xl animate-[pulse_1.8s_ease-in-out_infinite_0.3s]" />
                      </div>
                    )}
                    {/* Boosted flame effect */}
                    {isBoosted && !ended && !isPendingApproval && (
                      <div className="absolute inset-0 pointer-events-none rounded-[inherit] overflow-hidden">
                        <div className="absolute -top-2 -left-2 w-8 h-8 bg-purple-500/20 rounded-full blur-xl animate-pulse" />
                        <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-pink-500/20 rounded-full blur-lg animate-pulse delay-300" />
                      </div>
                    )}
                    {effectiveSidebarCollapsed ? (
                      <div className="relative">
                        <img
                          src={pool.stake_token_logo}
                          alt={pool.title}
                          className={cn(
                            "w-8 h-8 rounded-full object-cover mx-auto ring-2",
                            ended ? "ring-red-500" : isPendingApproval ? "ring-cyan-500 animate-[pulse_1.5s_ease-in-out_infinite]" : isBoosted ? "ring-purple-500" : "ring-amber-500"
                          )}
                        />
                        {isPendingApproval ? (
                          <Sparkles className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 text-cyan-400 animate-pulse" />
                        ) : isBoosted && !ended ? (
                          <Flame className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 text-purple-400" />
                        ) : (
                          <span className={cn(
                            "absolute -bottom-1 left-1/2 -translate-x-1/2 text-[6px] font-bold px-1 rounded",
                            ended ? "bg-red-500 text-white" : "bg-amber-500 text-black"
                          )}>
                            {ended ? "END" : "NEW"}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 relative z-10">
                        <div className="relative flex-shrink-0">
                          <img
                            src={pool.stake_token_logo}
                            alt={pool.title}
                            className={cn(
                              "w-9 h-9 rounded-full object-cover",
                              isPendingApproval && "ring-2 ring-cyan-500/80 animate-[pulse_1.5s_ease-in-out_infinite]",
                              isBoosted && !ended && !isPendingApproval && "ring-2 ring-purple-500/60"
                            )}
                          />
                          <img
                            src={pool.reward_token_logo}
                            alt="Reward"
                            className="w-4 h-4 rounded-full object-cover absolute -bottom-0.5 -right-0.5 ring-2 ring-zinc-950"
                          />
                        </div>
                        <div className="flex-1 text-left min-w-0 overflow-hidden">
                          <div className="flex items-center gap-1.5 max-w-full overflow-hidden">
                            <p className={cn(
                              "font-medium truncate text-xs flex-shrink min-w-0",
                              selectedPool?.id === pool.id ? "text-orange-400" : "text-white"
                            )}>
                              {pool.title}
                            </p>
                            {/* Badge for status */}
                            {isPendingApproval ? (
                              <Badge 
                                variant="outline" 
                                className="text-[9px] px-1.5 py-0 h-4 font-bold flex-shrink-0 border-cyan-500 bg-gradient-to-r from-cyan-500/30 to-blue-500/30 text-cyan-300 gap-0.5 animate-pulse"
                              >
                                <Sparkles className="w-2.5 h-2.5" />
                                REVIEW
                              </Badge>
                            ) : isBoosted && !ended ? (
                              <Badge 
                                variant="outline" 
                                className="text-[9px] px-1.5 py-0 h-4 font-bold flex-shrink-0 border-purple-500 bg-gradient-to-r from-purple-500/30 to-pink-500/30 text-purple-300 gap-0.5"
                              >
                                <Flame className="w-2.5 h-2.5" />
                                BOOSTED
                              </Badge>
                            ) : (
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-[9px] px-1.5 py-0 h-4 font-bold flex-shrink-0",
                                  ended 
                                    ? "border-red-500 bg-red-500/20 text-red-400" 
                                    : "border-amber-500 bg-amber-500/20 text-amber-400"
                                )}
                              >
                                {ended ? "ENDED" : "Pending"}
                              </Badge>
                            )}
                          </div>
                        {/* APY Row */}
                        <div className="flex items-center gap-2 mt-1">
                          {/* APY */}
                          {(() => {
                            const apy = getPoolAPY(pool);
                            if (apy > 0) {
                              return (
                                <span className="text-[10px] text-purple-400 font-bold bg-purple-500/10 px-1.5 py-0.5 rounded">
                                  {apy >= 1000 ? `${(apy / 1000).toFixed(1)}K%` : `${apy.toFixed(0)}%`} APY
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        {/* Reward Per Block with token logo */}
                        {poolRewardRates[pool.id] && parseFloat(poolRewardRates[pool.id]) > 0 && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <img 
                              src={pool.reward_token_logo} 
                              alt="Reward" 
                              className="w-3.5 h-3.5 rounded-full object-cover"
                            />
                            <span className="text-[10px] text-green-400 font-medium">
                              {parseFloat(poolRewardRates[pool.id]).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}/block
                            </span>
                          </div>
                        )}
                        {/* Creator Info */}
                        {pool.creator_profile ? (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <AnimatedAvatar
                              userId={pool.creator_profile.id}
                              avatarUrl={pool.creator_profile.avatar_url}
                              username={pool.creator_profile.username}
                              displayName={pool.creator_profile.display_name}
                              className="w-4 h-4"
                              fallbackClassName="text-[8px]"
                            />
                            <span className="text-xs text-zinc-400 truncate max-w-[100px]">
                              {pool.creator_profile.arena_verified && pool.creator_profile.arena_username 
                                ? pool.creator_profile.arena_username 
                                : (pool.creator_profile.display_name || pool.creator_profile.username)?.startsWith('0x') && (pool.creator_profile.display_name || pool.creator_profile.username)?.length > 20
                                  ? `${(pool.creator_profile.display_name || pool.creator_profile.username).slice(0, 6)}...${(pool.creator_profile.display_name || pool.creator_profile.username).slice(-4)}`
                                  : pool.creator_profile.display_name || pool.creator_profile.username}
                            </span>
                            {pool.creator_profile.arena_verified && (
                              <ArenaVerifiedBadge size="sm" username={pool.creator_profile.arena_username || undefined} />
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-zinc-500 truncate">
                            {pool.staking_contract_address.slice(0, 8)}...
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  </button>
                );
              })}

              {/* Load more trigger */}
              {!searchQuery.trim() && hasMore && (
                <div ref={loadMoreTriggerRef} className="py-4 flex justify-center">
                  {loadingMore ? (
                    <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                  ) : (
                    <span className="text-xs text-zinc-500">Scroll to load more...</span>
                  )}
                </div>
              )}

              {filteredPools.length === 0 && !poolsLoading && (
                <div className="text-center py-8">
                  <Search className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                  <p className="text-sm text-zinc-500">No pools found</p>
                </div>
              )}

              {poolsLoading && filteredPools.length === 0 && (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 text-orange-500 mx-auto mb-2 animate-spin" />
                  <p className="text-sm text-zinc-500">Loading pools...</p>
                </div>
              )}
            </div>
          </ScrollArea>

        </aside>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          {showOverview ? (
            <UserStakingOverview 
              onSelectPool={handleSelectPoolFromOverview}
              onBrowseAllPools={handleBrowseAllPools}
            />
          ) : (
            <div className="max-w-5xl mx-auto px-4 py-6">
              {/* Header */}
              <div className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
                  <Coins className="w-8 h-8 text-orange-500" />
                  Staking <span className="text-orange-500">{"{Multi Earn}"}</span>
                </h1>
                <p className="text-zinc-400 text-sm mt-1">
                  Stake tokens and earn rewards
                </p>
              </div>

              {/* Selected Pool Content */}
              {selectedPool && (
                <StakingPoolContent 
                  key={selectedPool.id} 
                  pool={selectedPool}
                />
              )}

              {/* Info */}
              <Card className="bg-zinc-900/50 border-zinc-800/40 p-4 mt-6">
                <p className="text-xs text-zinc-500 text-center">
                  {walletAddress && (
                    <>
                      Wallet: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)} • 
                    </>
                  )}
                  {isArena && <span className="text-orange-500 font-semibold"> Connected via The Arena • </span>}
                  Connected to Avalanche C-Chain
                </p>
              </Card>
            </div>
          )}
        </div>

        {/* Staking chat is now handled by the global FloatingChat via context */}
      </main>
    </>
  );
};

// Pool Content Component
interface StakingPoolContentProps {
  pool: StakingPool;
}

function StakingPoolContent({ pool }: StakingPoolContentProps) {
  const {
    stakeTokenBalance,
    stakedBalance,
    totalSupply,
    pendingRewards,
    allowance,
    deposit,
    withdraw,
    claimRewards,
    isApproving,
    isDepositing,
    isWithdrawing,
    isClaiming,
    approveSuccess,
    depositSuccess,
    withdrawSuccess,
    claimSuccess,
    txProgress,
    setTxProgress,
    rewardVaultAddress,
    rewardVaultBalance,
    poolStartBlock,
    poolEndBlock,
    currentBlock,
    rewardPerBlock,
  } = useStaking(pool);

  const [stakeAmount, setStakeAmount] = useState("");
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [stakeTokenPrice, setStakeTokenPrice] = useState<number>(0);
  const [rewardTokenPrice, setRewardTokenPrice] = useState<number>(0);

  // Constants for market cap calculation (10 billion total supply)
  const TOTAL_TOKEN_SUPPLY = 10_000_000_000;
  
  // Calculate Market Cap (10B tokens * price)
  const stakeTokenMarketCap = stakeTokenPrice * TOTAL_TOKEN_SUPPLY;
  const rewardTokenMarketCap = rewardTokenPrice * TOTAL_TOKEN_SUPPLY;

  // Calculate APY using centralized function with fallbacks
  const poolAPY = useMemo(() => {
    if (!poolEndBlock || !currentBlock || !poolStartBlock) return 0;
    if (currentBlock >= poolEndBlock) return 0; // Pool ended
    
    const remainingBlocks = poolEndBlock - currentBlock;
    const totalStakedNum = parseFloat(totalSupply);
    const remainingRewardsNum = parseFloat(rewardVaultBalance);
    const rewardPerBlockNum = parseFloat(rewardPerBlock);
    
    const { apy } = calculateAPY({
      totalStaked: totalStakedNum,
      remainingRewards: remainingRewardsNum,
      remainingBlocks,
      stakeTokenPrice,
      rewardTokenPrice,
      isSameToken: pool.stake_token_address.toLowerCase() === pool.reward_token_address.toLowerCase(),
      rewardPerBlock: rewardPerBlockNum
    });
    
    return apy;
  }, [poolEndBlock, currentBlock, poolStartBlock, totalSupply, rewardVaultBalance, rewardPerBlock, stakeTokenPrice, rewardTokenPrice, pool.stake_token_address, pool.reward_token_address]);

  // Fetch token prices - NO liquidity filter to ensure all tokens get prices
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        // Fetch stake token price from GeckoTerminal
        const stakeRes = await fetch(
          `https://api.geckoterminal.com/api/v2/simple/networks/avax/token_price/${pool.stake_token_address}`,
          { headers: { 'Accept': 'application/json;version=20230203' } }
        );
        const stakeData = await stakeRes.json();
        const stakePrices = stakeData?.data?.attributes?.token_prices || {};
        const stakePriceStr = stakePrices[pool.stake_token_address.toLowerCase()] || stakePrices[pool.stake_token_address];
        if (stakePriceStr) {
          setStakeTokenPrice(parseFloat(stakePriceStr));
        }

        // Fetch reward token price (skip if same token)
        if (pool.stake_token_address.toLowerCase() !== pool.reward_token_address.toLowerCase()) {
          const rewardRes = await fetch(
            `https://api.geckoterminal.com/api/v2/simple/networks/avax/token_price/${pool.reward_token_address}`,
            { headers: { 'Accept': 'application/json;version=20230203' } }
          );
          const rewardData = await rewardRes.json();
          const rewardPrices = rewardData?.data?.attributes?.token_prices || {};
          const rewardPriceStr = rewardPrices[pool.reward_token_address.toLowerCase()] || rewardPrices[pool.reward_token_address];
          if (rewardPriceStr) {
            setRewardTokenPrice(parseFloat(rewardPriceStr));
          }
        } else {
          setRewardTokenPrice(stakeTokenPrice);
        }
      } catch (e) {
        console.log("Could not fetch token prices:", e);
      }
    };
    fetchPrices();
  }, [pool.stake_token_address, pool.reward_token_address]);

  // Update reward token price if same token
  useEffect(() => {
    if (pool.stake_token_address.toLowerCase() === pool.reward_token_address.toLowerCase()) {
      setRewardTokenPrice(stakeTokenPrice);
    }
  }, [stakeTokenPrice, pool.stake_token_address, pool.reward_token_address]);

  // Check if same token staking (stake token = reward token)
  const isSameTokenPool = pool.stake_token_address.toLowerCase() === pool.reward_token_address.toLowerCase();

  // Format USD value
  const formatUSD = (value: number) => {
    if (value >= 1000000000) return '$' + (value / 1000000000).toFixed(2) + 'B';
    if (value >= 1000000) return '$' + (value / 1000000).toFixed(2) + 'M';
    if (value >= 1000) return '$' + (value / 1000).toFixed(2) + 'K';
    if (value >= 1) return '$' + value.toFixed(2);
    if (value > 0) return '$' + value.toFixed(4);
    return '$0.00';
  };

  // Convert block to estimated date (Avalanche ~2 seconds per block)
  const blockToDate = (targetBlock: number | null, currentBlockNum: number | null) => {
    if (!targetBlock || !currentBlockNum) return null;
    const blockDiff = targetBlock - currentBlockNum;
    const secondsDiff = blockDiff * 2; // ~2 seconds per block on Avalanche
    return new Date(Date.now() + secondsDiff * 1000);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "—";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getPoolStatus = () => {
    if (!currentBlock || !poolStartBlock || !poolEndBlock) return "loading";
    if (currentBlock < poolStartBlock) return "upcoming";
    if (currentBlock > poolEndBlock) return "ended";
    return "active";
  };

  const poolStatus = getPoolStatus();
  const startDate = blockToDate(poolStartBlock, currentBlock);
  const endDate = blockToDate(poolEndBlock, currentBlock);

  // Show success toasts
  useEffect(() => {
    if (approveSuccess) {
      toast.success("Token approval successful!");
    }
  }, [approveSuccess]);

  useEffect(() => {
    if (depositSuccess) {
      toast.success("Stake successful!");
      setStakeAmount("");
    }
  }, [depositSuccess]);

  useEffect(() => {
    if (withdrawSuccess) {
      toast.success("Unstake successful!");
      setUnstakeAmount("");
    }
  }, [withdrawSuccess]);

  useEffect(() => {
    if (claimSuccess) {
      toast.success("Rewards claimed successfully!");
    }
  }, [claimSuccess]);

  const handleStake = async () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (parseFloat(stakeAmount) > parseFloat(stakeTokenBalance)) {
      toast.error("Insufficient balance");
      return;
    }

    try {
      await deposit(stakeAmount);
      toast.dismiss('stake-tx');
    } catch (error: any) {
      toast.error(error?.message || "Transaction failed", { id: 'stake-tx' });
    }
  };

  const handleUnstake = async () => {
    if (!unstakeAmount || parseFloat(unstakeAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (parseFloat(unstakeAmount) > parseFloat(stakedBalance)) {
      toast.error("Insufficient staked balance");
      return;
    }

    try {
      await withdraw(unstakeAmount);
      toast.dismiss('unstake-tx');
    } catch (error: any) {
      toast.error(error?.message || "Transaction failed", { id: 'unstake-tx' });
    }
  };

  const handleClaim = async () => {
    if (parseFloat(pendingRewards) <= 0) {
      toast.error("No rewards to claim");
      return;
    }
    
    try {
      await claimRewards();
      toast.dismiss('claim-tx');
    } catch (error: any) {
      toast.error(error?.message || "Transaction failed", { id: 'claim-tx' });
    }
  };

  const formatNumber = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return "0.00";
    return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  };

  return (
    <>
      <TransactionProgress
        isOpen={txProgress.isOpen}
        status={txProgress.status}
        message={txProgress.message}
        txHash={txProgress.txHash}
        tokenLogo={txProgress.tokenLogo || pool?.stake_token_logo}
        tokenSymbol={txProgress.tokenSymbol || 'TOKEN'}
        successTitle={txProgress.successTitle || 'Staked! 🎉'}
        onClose={() => setTxProgress({ isOpen: false, status: "waiting", message: "", txHash: null, tokenLogo: null, tokenSymbol: 'TOKEN', successTitle: 'Staked! 🎉' })}
      />

      {/* Pool Header - Pitch Style */}
      <div className="relative mb-6 rounded-2xl overflow-hidden">
        {/* Gradient border effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 via-zinc-800/50 to-zinc-900 rounded-2xl" />
        <div className="absolute inset-[1px] bg-zinc-950 rounded-2xl" />
        
        <div className="relative p-6">
          {/* Top Section - Title & Status */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/30 to-transparent rounded-full blur-lg" />
                <img
                  src={pool.stake_token_logo}
                  alt={pool.title}
                  className="relative w-16 h-16 rounded-full object-cover ring-2 ring-zinc-700/50"
                />
                <img
                  src={pool.reward_token_logo}
                  alt="Reward"
                  className="w-6 h-6 rounded-full object-cover absolute -bottom-0.5 -right-0.5 ring-2 ring-zinc-950"
                />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{pool.title}</h2>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge 
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 border-0",
                      poolStatus === "active" && "bg-green-500/20 text-green-400",
                      poolStatus === "upcoming" && "bg-blue-500/20 text-blue-400",
                      poolStatus === "ended" && "bg-zinc-700/50 text-zinc-400"
                    )}
                  >
                    {poolStatus === "active" && "Active"}
                    {poolStatus === "upcoming" && "Upcoming"}
                    {poolStatus === "ended" && "Ended"}
                    {poolStatus === "loading" && "..."}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Reward Rate Badge & Boost Button */}
            <div className="flex items-center gap-2 flex-wrap">
              {parseFloat(rewardPerBlock) > 0 && (
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500/10 to-green-500/5 border border-green-500/20 rounded-full px-4 py-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm font-bold text-green-400">
                    {parseFloat(rewardPerBlock).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                  </span>
                  <span className="text-xs text-green-500/70">/ block</span>
                </div>
              )}
              {poolStatus === "active" && (
                <BoostPoolButton 
                  poolId={pool.id} 
                  poolTitle={pool.title}
                />
              )}
            </div>
          </div>

          {/* Creator Info */}
          {(pool.creator_profile || pool.creator_wallet) && (
            <div className="flex items-center gap-3 flex-wrap mb-5 py-3 border-y border-zinc-800/50">
              <span className="text-xs text-zinc-500 font-medium">Created by:</span>
              {pool.creator_profile ? (
                <div className="flex items-center gap-2">
                  <AnimatedAvatar
                    userId={pool.creator_profile.id}
                    avatarUrl={pool.creator_profile.avatar_url}
                    username={pool.creator_profile.username}
                    displayName={pool.creator_profile.display_name}
                    className="w-7 h-7 ring-2 ring-orange-500/30"
                    fallbackClassName="text-xs"
                  />
                  <span className="text-sm text-white font-semibold">
                    {pool.creator_profile.display_name || pool.creator_profile.username}
                  </span>
                  {pool.creator_profile.arena_verified && pool.creator_profile.arena_username && (
                    <div className="flex items-center gap-1.5 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-full">
                      <span className="text-xs text-purple-400 font-medium">@{pool.creator_profile.arena_username}</span>
                      <ArenaVerifiedBadge size="sm" username={pool.creator_profile.arena_username} />
                    </div>
                  )}
                </div>
              ) : (
                <User className="w-5 h-5 text-zinc-600" />
              )}
              {pool.creator_wallet && (
                <CopyableAddress label="Creator" address={pool.creator_wallet} className="text-[11px] py-1 px-2" />
              )}
            </div>
          )}

          {/* Market Cap & APY Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {/* Stake Token Market Cap */}
            <div className="bg-gradient-to-br from-orange-500/10 to-zinc-900/50 border border-orange-500/20 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <img src={pool.stake_token_logo} alt="" className="w-4 h-4 rounded-full" />
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Market Cap</span>
              </div>
              <p className="text-sm sm:text-base text-orange-400 font-bold">
                {stakeTokenMarketCap > 0 ? formatUSD(stakeTokenMarketCap) : '—'}
              </p>
              {stakeTokenPrice > 0 && (
                <p className="text-[10px] text-zinc-500 mt-0.5">${stakeTokenPrice.toFixed(8)}/token</p>
              )}
            </div>

            {/* Reward Token Market Cap (if different) */}
            {pool.stake_token_address.toLowerCase() !== pool.reward_token_address.toLowerCase() && (
              <div className="bg-gradient-to-br from-green-500/10 to-zinc-900/50 border border-green-500/20 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <img src={pool.reward_token_logo} alt="" className="w-4 h-4 rounded-full" />
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Market Cap</span>
                </div>
                <p className="text-sm sm:text-base text-green-400 font-bold">
                  {rewardTokenMarketCap > 0 ? formatUSD(rewardTokenMarketCap) : '—'}
                </p>
                {rewardTokenPrice > 0 && (
                  <p className="text-[10px] text-zinc-500 mt-0.5">${rewardTokenPrice.toFixed(8)}/token</p>
                )}
              </div>
            )}

            {/* APY */}
            <div className="bg-gradient-to-br from-purple-500/10 to-zinc-900/50 border border-purple-500/20 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-purple-400" />
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Est. APY</span>
              </div>
              <p className="text-sm sm:text-base text-purple-400 font-bold">
                {poolAPY > 0 ? (
                  poolAPY >= 1000 
                    ? `${(poolAPY / 1000).toFixed(1)}K%`
                    : `${poolAPY.toFixed(2)}%`
                ) : '—'}
              </p>
              {poolAPY > 0 && (
                <p className="text-[10px] text-zinc-500 mt-0.5">Based on current TVL</p>
              )}
            </div>

            {/* TVL */}
            <div className="bg-gradient-to-br from-blue-500/10 to-zinc-900/50 border border-blue-500/20 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <Database className="w-4 h-4 text-blue-400" />
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">TVL</span>
              </div>
              <p className="text-sm sm:text-base text-blue-400 font-bold">
                {stakeTokenPrice > 0 ? formatUSD(parseFloat(totalSupply) * stakeTokenPrice) : '—'}
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">{formatNumber(totalSupply)} staked</p>
            </div>

            {/* Security Guide Card */}
            <div className="bg-gradient-to-br from-cyan-500/10 to-zinc-900/50 border border-cyan-500/20 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <Info className="w-4 h-4 text-cyan-400" />
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Guide</span>
              </div>
              <StakingTutorialDialog
                stakingContractAddress={pool.staking_contract_address}
                stakeTokenAddress={pool.stake_token_address}
                rewardTokenAddress={pool.reward_token_address}
                poolTitle={pool.title}
              />
              <p className="text-[10px] text-zinc-500 mt-0.5">Safety tips</p>
            </div>
          </div>

          {/* Countdown Timer - Tech Pitch Style */}
          {poolStatus !== "ended" && endDate && (
            <PoolCountdown endDate={endDate} poolStatus={poolStatus} startDate={startDate} />
          )}

          {/* Dates Row */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-3.5 h-3.5 text-green-500" />
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Start</span>
              </div>
              <p className="text-sm sm:text-base text-white font-semibold">{formatDate(startDate)}</p>
              {poolStartBlock && <p className="text-[10px] text-zinc-600 mt-0.5">Block {poolStartBlock.toLocaleString()}</p>}
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-3.5 h-3.5 text-red-500" />
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">End</span>
              </div>
              <p className="text-sm sm:text-base text-white font-semibold">{formatDate(endDate)}</p>
              {poolEndBlock && <p className="text-[10px] text-zinc-600 mt-0.5">Block {poolEndBlock.toLocaleString()}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Boost Info - component handles its own visibility based on active boosts */}
      <div className="mb-4">
        <PoolBoostInfo poolId={pool.id} />
      </div>

      {/* Leaderboard Dropdown */}
      <Collapsible className="mb-4">
        <CollapsibleTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-white"
          >
            <span className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-orange-500" />
              Pool Leaderboard
            </span>
            <ChevronDown className="w-4 h-4 text-zinc-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
            <StakingPoolLeaderboard
              poolId={pool.id}
              stakingContractAddress={pool.staking_contract_address}
              stakeTokenLogo={pool.stake_token_logo}
              stakeTokenAddress={pool.stake_token_address}
            />
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Contract Addresses Dropdown */}
      <Collapsible className="mb-6">
        <CollapsibleTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-white"
          >
            <span className="flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-500" />
              Contract Addresses
            </span>
            <ChevronDown className="w-4 h-4 text-zinc-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <Card className="bg-zinc-900/80 border-zinc-800 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <CopyableAddress
                label="Staking Contract"
                address={pool.staking_contract_address}
                icon={<FileText className="w-4 h-4 text-orange-500 shrink-0" />}
              />
              <CopyableAddress
                label="Stake Token"
                address={pool.stake_token_address}
                icon={<Database className="w-4 h-4 text-blue-500 shrink-0" />}
              />
              <CopyableAddress
                label="Earn Token"
                address={pool.reward_token_address}
                icon={<Banknote className="w-4 h-4 text-green-500 shrink-0" />}
              />
              <CopyableAddress
                label="Reward Pool"
                address={pool.reward_pool_address}
                icon={<Vault className="w-4 h-4 text-purple-500 shrink-0" />}
              />
            </div>
            {/* Creation TX Hash */}
            {pool.creation_tx_hash && (
              <div className="mt-3 pt-3 border-t border-zinc-800">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-zinc-500">Creation TX:</span>
                  <a
                    href={`https://snowtrace.io/tx/${pool.creation_tx_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 px-2 py-1 rounded-md transition-colors"
                  >
                    {pool.creation_tx_hash.slice(0, 10)}...{pool.creation_tx_hash.slice(-8)}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            )}
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="bg-zinc-900 border-zinc-800 p-4 sm:p-5 overflow-hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Wallet className="w-4 h-4 shrink-0" />
                  <span className="text-xs">Your Balance</span>
                </div>
                <p className="text-base sm:text-xl font-bold text-white truncate">{formatNumber(stakeTokenBalance)}</p>
                {stakeTokenPrice > 0 && parseFloat(stakeTokenBalance) > 0 && (
                  <p className="text-xs sm:text-sm text-zinc-400">{formatUSD(parseFloat(stakeTokenBalance) * stakeTokenPrice)}</p>
                )}
              </div>
              <img src={pool.stake_token_logo} alt="Token" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover shrink-0" />
            </div>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800 p-4 sm:p-5 overflow-hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 text-zinc-400">
                  <TrendingUp className="w-4 h-4 shrink-0" />
                  <span className="text-xs">Your Staked</span>
                </div>
                <p className="text-base sm:text-xl font-bold text-orange-500 truncate">{formatNumber(stakedBalance)}</p>
                {stakeTokenPrice > 0 && parseFloat(stakedBalance) > 0 && (
                  <p className="text-xs sm:text-sm text-orange-400/70">{formatUSD(parseFloat(stakedBalance) * stakeTokenPrice)}</p>
                )}
              </div>
              <img src={pool.stake_token_logo} alt="Token" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover shrink-0" />
            </div>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800 p-4 sm:p-5 overflow-hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Gift className="w-4 h-4 shrink-0" />
                  <span className="text-xs">Pending Rewards</span>
                </div>
                <p className="text-base sm:text-xl font-bold text-green-500 truncate">{formatNumber(pendingRewards)}</p>
                {rewardTokenPrice > 0 && parseFloat(pendingRewards) > 0 && (
                  <p className="text-xs sm:text-sm text-green-400/70">{formatUSD(parseFloat(pendingRewards) * rewardTokenPrice)}</p>
                )}
              </div>
              <img src={pool.reward_token_logo} alt="Reward" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover shrink-0" />
            </div>
          </Card>
        </div>

        {/* Total Staked & Treasury */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="bg-zinc-900 border-zinc-800 p-4 sm:p-5 overflow-hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-zinc-400">Total Staked in Protocol</p>
                <p className="text-lg sm:text-2xl font-bold mt-1 text-white truncate">{formatNumber(totalSupply)}</p>
                {stakeTokenPrice > 0 && (
                  <p className="text-xs sm:text-sm text-orange-400 mt-0.5">
                    {formatUSD(parseFloat(totalSupply) * stakeTokenPrice)}
                  </p>
                )}
              </div>
              <img src={pool.stake_token_logo} alt="Token" className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover shrink-0" />
            </div>
          </Card>

          <Card className="bg-zinc-900 border-orange-500/30 border p-4 sm:p-5 overflow-hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-orange-400 shrink-0" />
                  <p className="text-xs text-zinc-400">Remaining Rewards</p>
                </div>
                <p className="text-lg sm:text-2xl font-bold text-orange-500 truncate">{formatNumber(rewardVaultBalance)}</p>
                {rewardTokenPrice > 0 && (
                  <p className="text-xs sm:text-sm text-green-400">
                    {formatUSD(parseFloat(rewardVaultBalance) * rewardTokenPrice)}
                  </p>
                )}
                <code className="text-[10px] text-zinc-500 bg-black/50 px-1.5 py-0.5 rounded inline-block">
                  {(rewardVaultAddress || pool.reward_pool_address).slice(0, 6)}...{(rewardVaultAddress || pool.reward_pool_address).slice(-4)}
                </code>
              </div>
              <img src={pool.reward_token_logo} alt="Reward" className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover ring-2 ring-orange-400/30 shrink-0" />
            </div>
          </Card>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Stake Card */}
          <Card className="bg-zinc-900 border-zinc-800 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-orange-500/10 flex items-center justify-center">
                <ArrowDownToLine className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Stake</h3>
                <p className="text-xs text-zinc-400">Deposit tokens to earn</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    className="flex-1 bg-zinc-800 border-zinc-700 text-white"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStakeAmount(stakeTokenBalance)}
                    className="border-zinc-700"
                  >
                    Max
                  </Button>
                </div>
                <p className="text-xs text-zinc-500">
                  Available: {formatNumber(stakeTokenBalance)}
                </p>
              </div>

              <Button
                className="w-full bg-orange-500 hover:bg-orange-600"
                onClick={handleStake}
                disabled={isApproving || isDepositing}
              >
                {isApproving ? (
                  <><Loader2 className="animate-spin mr-2" size={16} /> Confirming...</>
                ) : isDepositing ? (
                  <><Loader2 className="animate-spin mr-2" size={16} /> Processing...</>
                ) : (
                  <><ArrowDownToLine size={16} className="mr-2" />
                    {parseFloat(allowance) < parseFloat(stakeAmount || "0") ? "Approve & Stake" : "Stake"}
                  </>
                )}
              </Button>
            </div>
          </Card>

          {/* Unstake Card */}
          <Card className="bg-zinc-900 border-zinc-800 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-orange-500/10 flex items-center justify-center">
                <ArrowUpFromLine className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Unstake</h3>
                <p className="text-xs text-zinc-400">Withdraw your tokens</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={unstakeAmount}
                    onChange={(e) => setUnstakeAmount(e.target.value)}
                    className="flex-1 bg-zinc-800 border-zinc-700 text-white"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setUnstakeAmount(stakedBalance)}
                    className="border-zinc-700"
                  >
                    Max
                  </Button>
                </div>
                <p className="text-xs text-zinc-500">
                  Staked: {formatNumber(stakedBalance)}
                </p>
              </div>

              <Button
                variant="outline"
                className="w-full border-zinc-700 hover:bg-zinc-800"
                onClick={handleUnstake}
                disabled={isWithdrawing}
              >
                {isWithdrawing ? (
                  <><Loader2 className="animate-spin mr-2" size={16} /> Processing...</>
                ) : (
                  <><ArrowUpFromLine size={16} className="mr-2" /> Unstake</>
                )}
              </Button>
            </div>
          </Card>
        </div>

        {/* Claim Rewards */}
        <Card className="bg-gradient-to-r from-zinc-800 to-zinc-900 border-green-500/30 p-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <Gift className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-zinc-400">Claimable Rewards</p>
                <p className="text-2xl font-bold text-green-500">{formatNumber(pendingRewards)}</p>
              </div>
            </div>
            <Button
              className="bg-green-500 hover:bg-green-600 text-white px-8"
              onClick={handleClaim}
              disabled={isClaiming || parseFloat(pendingRewards) <= 0}
            >
              {isClaiming ? (
                <><Loader2 className="animate-spin mr-2" size={16} /> Claiming...</>
              ) : (
                <><Gift size={16} className="mr-2" /> Claim Rewards</>
              )}
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}

export default Staking;
