import { useNavigate, useLocation } from 'react-router-dom';
import { useContext, useState, useEffect } from 'react';
import { WalletAuthContext } from '@/contexts/WalletAuthContext';
import { Button } from '@/components/ui/button';
import logo from '@/assets/avalove-logo.jpg';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { NotificationCenter } from '@/components/NotificationCenter';
import { useSoundContext } from '@/contexts/SoundContext';
import { useNotifications } from '@/hooks/useNotifications';
import { useOnlineUsersContext } from '@/contexts/OnlineUsersContext';
import { useSidebar } from '@/components/ui/sidebar';
import { Users, Wallet, ChevronRight, Sparkles, X, Trophy, Gamepad2, TrendingUp, Crown, Coins, Copy, ExternalLink, Clock, Mail } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getAvatarUrl } from '@/lib/defaultAvatars';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PlatformTutorial } from '@/components/PlatformTutorial';
import { useTokenBalances } from '@/hooks/useTokenBalances';
import { usePaymentTokens } from '@/hooks/usePaymentTokens';
import { useAvloPrice } from '@/hooks/useAvloPrice';
import { Contract, JsonRpcProvider, formatUnits } from 'ethers';
import { ERC20_ABI } from '@/config/staking';
import avloLogo from '@/assets/avlo-logo.jpg';
import arenaLogo from '@/assets/arena-logo.png';
import { motion } from 'framer-motion';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { HeaderStakeWidget } from '@/components/HeaderStakeWidget';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LiveTimeIndicator } from '@/components/LiveTimeIndicator';
import { TimePopup } from '@/components/TimePopup';


const AVALANCHE_RPC = "https://api.avax.network/ext/bc/C/rpc";

interface TokenBalance {
  symbol: string;
  balance: string;
  logo: string;
  usd?: string;
}

interface StakingPosition {
  id: string;
  title: string;
  stake_token_logo: string | null;
  stakedAmount: string;
  tokenSymbol: string;
}

interface RecentActivity {
  id: string;
  type: 'stake' | 'unstake' | 'game' | 'video' | 'swipe' | 'match';
  title: string;
  amount?: number;
  created_at: string;
}

export const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const walletAuth = useContext(WalletAuthContext);
  
  useSoundContext();
  const { notifications: allNotifications } = useNotifications();
  const { onlineCount } = useOnlineUsersContext();
  const { avloBalance, arenaBalance } = useTokenBalances();
  const { tokens } = usePaymentTokens();
  const { formatAvloWithUsd } = useAvloPrice();
  const [customBalances, setCustomBalances] = useState<TokenBalance[]>([]);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isTimePopupOpen, setIsTimePopupOpen] = useState(false);
  const [stakingPositions, setStakingPositions] = useState<StakingPosition[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  
  const [userStats, setUserStats] = useState<{
    totalSwipes: number;
    totalMatches: number;
    totalMessages: number;
    gamesPlayed: number;
    videosWatched: number;
    totalEarned: number;
    remainingSeconds: number;
    userScore: number;
  }>({ totalSwipes: 0, totalMatches: 0, totalMessages: 0, gamesPlayed: 0, videosWatched: 0, totalEarned: 0, remainingSeconds: 0, userScore: 0 });
  
  // Get sidebar state - wrap in try/catch in case we're outside SidebarProvider
  let sidebarState = "collapsed";
  try {
    const sidebar = useSidebar();
    sidebarState = sidebar.state;
  } catch {
    // Outside SidebarProvider, default to collapsed
  }

  // Fetch custom token balances
  useEffect(() => {
    const fetchCustomBalances = async () => {
      if (!walletAuth?.walletAddress || tokens.length === 0) return;
      
      try {
        const provider = new JsonRpcProvider(AVALANCHE_RPC);
        const balances: TokenBalance[] = [];

        for (const token of tokens) {
          if (token.token_symbol.toUpperCase() === 'AVLO' || token.token_symbol.toUpperCase() === 'ARENA') continue;
          
          try {
            const contract = new Contract(token.token_address, ERC20_ABI, provider);
            const rawBalance = await contract.balanceOf(walletAuth.walletAddress);
            const formatted = formatUnits(rawBalance, token.decimals);
            
            if (parseFloat(formatted) > 0) {
              balances.push({
                symbol: token.token_symbol,
                balance: formatted,
                logo: token.logo_url || '',
              });
            }
          } catch (err) {
            console.error(`Error fetching balance for ${token.token_symbol}:`, err);
          }
        }

        setCustomBalances(balances);
      } catch (error) {
        console.error('Error fetching custom token balances:', error);
      }
    };

    fetchCustomBalances();
  }, [walletAuth?.walletAddress, tokens]);

  // Format number with K, M, B suffixes
  const formatCompactNumber = (num: number): string => {
    if (num >= 1_000_000_000) {
      return (num / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
    }
    if (num >= 1_000_000) {
      return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1_000) {
      return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return num.toFixed(0);
  };

  // Fetch user stats for the profile panel
  useEffect(() => {
    const fetchUserStats = async () => {
      if (!walletAuth?.profile?.id) return;
      
      try {
        const userId = walletAuth.profile.id;
        
        // Fetch stats in parallel - skip empty tables (matches, messages have 0 rows)
        const [swipesRes, gamesRes] = await Promise.all([
          supabase.from('swipes').select('id', { count: 'exact', head: true }).eq('swiper_id', userId),
          supabase.from('embedded_game_sessions').select('reward_earned, play_time_seconds, started_at').eq('user_id', userId),
        ]);

        // Skip watch_video_views and music_track_listens queries - both tables have 0 rows
        // This saves ~90K+ unnecessary scans
        const videosRes = { data: [] as any[] };
        const musicRes = { data: [] as any[] };

        // Use cached AVLO token ID instead of querying dao_tokens every time
        const { getAvloTokenId } = await import('@/lib/avloTokenCache');
        const avloTokenId = await getAvloTokenId();

        const scoreRowRes = avloTokenId
          ? await supabase
              .from('user_scores')
              .select('token_id, total_score, updated_at')
              .eq('user_id', userId)
              .eq('token_id', avloTokenId)
              .maybeSingle()
          : ({ data: null } as any);

        const periodRes = await supabase
          .from('game_config')
          .select('config_value')
          .eq('config_key', 'limit_period')
          .maybeSingle();

        const totalGameEarned = (gamesRes.data || []).reduce((sum, s) => sum + (s.reward_earned || 0), 0);
        const totalVideoEarned = (videosRes.data || []).reduce((sum, s) => sum + (s.reward_earned || 0), 0);
        const totalMusicEarned = (musicRes.data || []).reduce((sum, s) => sum + (s.reward_earned || 0), 0);

        // Determine period start based on limit_period config
        const periodConfig = periodRes.data?.config_value;
        const period = typeof periodConfig === 'string' ? periodConfig : (periodConfig as any)?.value || 'daily';

        const periodStart = new Date();
        if (period === 'weekly') {
          const dayOfWeek = periodStart.getUTCDay();
          periodStart.setUTCDate(periodStart.getUTCDate() - dayOfWeek);
        } else if (period === 'monthly') {
          periodStart.setUTCDate(1);
        } else if (period === 'yearly') {
          periodStart.setUTCMonth(0, 1);
        }
        periodStart.setUTCHours(0, 0, 0, 0);
        const periodStartISO = periodStart.toISOString();

        // Period used time - skip empty tables (watch_video_views, music_track_listens have 0 rows)
        const [{ data: periodGames }] = await Promise.all([
          supabase.from('embedded_game_sessions').select('play_time_seconds').eq('user_id', userId).gte('started_at', periodStartISO),
        ]);

        const periodUsedSeconds =
          (periodGames || []).reduce((sum, s) => sum + (s.play_time_seconds || 0), 0);

        // Score → allowed seconds (1 score = 1 minute)
        let userScore = scoreRowRes.data?.total_score;
        if (typeof userScore !== 'number') {
          const { data: effectiveScore } = await supabase.rpc('get_effective_score', { p_user_id: userId });
          userScore = (effectiveScore as any)?.total_score ?? 0;
        }

        const allowedSeconds = userScore * 60;
        const remainingSeconds = Math.max(0, allowedSeconds - periodUsedSeconds);

        setUserStats({
          totalSwipes: swipesRes.count || 0,
          totalMatches: 0, // matches table is empty - skip query
          totalMessages: 0, // messages table is empty - skip query
          gamesPlayed: gamesRes.data?.length || 0,
          videosWatched: videosRes.data?.length || 0,
          totalEarned: totalGameEarned + totalVideoEarned + totalMusicEarned,
          remainingSeconds,
          userScore: typeof userScore === 'number' ? userScore : 0,
        });
      } catch (error) {
        console.error('Error fetching user stats:', error);
      }
    };

    if (isProfileOpen) {
      fetchUserStats();
      fetchStakingPositions();
      fetchRecentActivities();
    }
  }, [isProfileOpen, walletAuth?.profile?.id]);

  // Fetch staking positions
  const fetchStakingPositions = async () => {
    if (!walletAuth?.walletAddress || !walletAuth?.profile?.id) return;
    
    try {
      // Get pools where user has staked
      const { data: transactions } = await supabase
        .from('staking_transactions')
        .select('pool_id')
        .eq('user_id', walletAuth.profile.id)
        .eq('transaction_type', 'stake');
      
      if (!transactions || transactions.length === 0) {
        setStakingPositions([]);
        return;
      }

      const uniquePoolIds = [...new Set(transactions.map(t => t.pool_id))];
      
      const { data: pools } = await supabase
        .from('staking_pools')
        .select('id, title, stake_token_logo, stake_token_address')
        .in('id', uniquePoolIds)
        .eq('is_active', true);

      if (!pools) return;

      const provider = new JsonRpcProvider(AVALANCHE_RPC);
      const positions: StakingPosition[] = [];

      for (const pool of pools.slice(0, 5)) {
        try {
          const stakingContract = new Contract(pool.id, ERC20_ABI, provider);
          const balance = await stakingContract.balanceOf(walletAuth.walletAddress);
          const formatted = formatUnits(balance, 18);
          
          if (parseFloat(formatted) > 0.01) {
            const tokenContract = new Contract(pool.stake_token_address, ERC20_ABI, provider);
            const symbol = await tokenContract.symbol().catch(() => 'TOKEN');
            
            positions.push({
              id: pool.id,
              title: pool.title,
              stake_token_logo: pool.stake_token_logo,
              stakedAmount: formatted,
              tokenSymbol: symbol
            });
          }
        } catch (err) {
          console.error('Error fetching position for pool:', pool.id, err);
        }
      }

      setStakingPositions(positions);
    } catch (error) {
      console.error('Error fetching staking positions:', error);
    }
  };

  // Fetch recent activities
  const fetchRecentActivities = async () => {
    if (!walletAuth?.profile?.id) return;
    
    try {
      const userId = walletAuth.profile.id;
      
      // Fetch recent activities from different sources in parallel
      const [stakingRes, gamesRes, videosRes, matchesRes] = await Promise.all([
        supabase
          .from('staking_transactions')
          .select('id, transaction_type, amount, created_at, staking_pools!inner(title)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('embedded_game_sessions')
          .select('id, game_title, reward_earned, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('watch_video_views')
          .select('id, reward_earned, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('matches')
          .select('id, created_at')
          .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
          .order('created_at', { ascending: false })
          .limit(2),
      ]);

      const activities: RecentActivity[] = [];
      
      // Add staking transactions
      (stakingRes.data || []).forEach(tx => {
        activities.push({
          id: tx.id,
          type: tx.transaction_type === 'stake' ? 'stake' : 'unstake',
          title: `${tx.transaction_type === 'stake' ? 'Staked in' : 'Unstaked from'} ${(tx.staking_pools as any)?.title || 'Pool'}`,
          amount: parseFloat(tx.amount) || 0,
          created_at: tx.created_at
        });
      });

      // Add game sessions
      (gamesRes.data || []).forEach(game => {
        activities.push({
          id: game.id,
          type: 'game',
          title: `Played ${game.game_title}`,
          amount: game.reward_earned,
          created_at: game.created_at
        });
      });

      // Add video views
      (videosRes.data || []).forEach(video => {
        activities.push({
          id: video.id,
          type: 'video',
          title: 'Watched video',
          amount: video.reward_earned,
          created_at: video.created_at
        });
      });

      // Add matches
      (matchesRes.data || []).forEach(match => {
        activities.push({
          id: match.id,
          type: 'match',
          title: 'New match!',
          created_at: match.created_at
        });
      });

      // Sort by date and take top 10
      activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRecentActivities(activities.slice(0, 10));
    } catch (error) {
      console.error('Error fetching recent activities:', error);
    }
  };

  // Format time ago
  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Copy wallet address
  const copyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      toast.success('Address copied!');
    }
  };


  // Don't render if context is not available or on connect page
  if (!walletAuth || !walletAuth.isConnected || location.pathname === '/connect') {
    return null;
  }

  const { profile, walletAddress } = walletAuth;
  
  // Hide logo when sidebar is expanded (to avoid duplicate)
  const showLogo = sidebarState === "collapsed";

  const avloFormatted = formatAvloWithUsd(avloBalance);
  const hasAvloBalance = parseFloat(avloBalance) > 0;
  const hasArenaBalance = parseFloat(arenaBalance) > 0;

  // Collect all tokens with balance for display
  const allTokensWithBalance: TokenBalance[] = [];
  if (hasAvloBalance) {
    allTokensWithBalance.push({
      symbol: 'AVLO',
      balance: avloBalance,
      logo: avloLogo,
      usd: avloFormatted.usd
    });
  }
  if (hasArenaBalance) {
    allTokensWithBalance.push({
      symbol: 'ARENA',
      balance: arenaBalance,
      logo: arenaLogo
    });
  }
  allTokensWithBalance.push(...customBalances);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-black border-zinc-800 text-white backdrop-blur-sm overflow-x-hidden max-w-full">
      <Sonner position="top-center" offset="180px" />
        <div className="container flex h-14 sm:h-16 items-center justify-between px-2 sm:px-4 max-w-full overflow-hidden bg-black">
        {/* Mobile Logo - hidden when sidebar is expanded */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink-0">
          {showLogo && (
            <div className="flex items-center gap-1.5 cursor-pointer md:hidden" onClick={() => navigate('/')}>
              <img src={logo} alt="AvaLove" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full shadow-glow animate-pulse-slow" />
              <span className="text-lg sm:text-xl font-black text-transparent bg-gradient-love bg-clip-text tracking-tight">
                AvaLove
              </span>
            </div>
          )}
        </div>

        {/* Wallet Info & Actions */}
        <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-shrink-0 ml-auto">
          {profile && (
            <>
              {/* Messages Button */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 py-1 hover:bg-zinc-800 flex items-center gap-1 relative"
                      onClick={() => navigate('/matches')}
                    >
                      <Mail className="w-5 h-5 text-orange-500" />
                      {(() => {
                        const unreadMessages = allNotifications?.filter(n => !n.read && n.type === 'message').length || 0;
                        return unreadMessages > 0 ? (
                          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 bg-orange-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                            {unreadMessages > 9 ? '9+' : unreadMessages}
                          </span>
                        ) : null;
                      })()}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Messages</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Live Time Indicator - Desktop full, Mobile compact with popup */}
              <div className="hidden sm:block">
                <LiveTimeIndicator 
                  userId={profile.id} 
                  showDetails={true}
                  onClick={() => setIsTimePopupOpen(true)}
                />
              </div>
              <div className="sm:hidden">
                <LiveTimeIndicator 
                  userId={profile.id} 
                  showDetails={false}
                  onClick={() => setIsTimePopupOpen(true)}
                />
              </div>
              
              <TimePopup 
                open={isTimePopupOpen} 
                onOpenChange={setIsTimePopupOpen} 
              />

              {/* Stake Widget - Responsive */}
              <HeaderStakeWidget />

              {/* Platform Tutorial Guide - hidden on mobile */}
              <div className="hidden sm:block">
                <PlatformTutorial />
              </div>

              {/* Online Users */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 py-1 hover:bg-zinc-800 flex items-center gap-1"
                      onClick={() => navigate('/active-users')}
                    >
                      <Users className="w-4 h-4 text-green-500" />
                      <span className="text-xs text-white font-semibold">{onlineCount}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Active Users</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Network Map Button - hidden on mobile */}
              <div className="hidden sm:block">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-zinc-900 relative group overflow-hidden"
                        onClick={() => navigate('/network-map')}
                      >
                        {/* Neon glow effect */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <div className="absolute inset-0 bg-white/5 rounded-md" />
                          <div className="absolute inset-[-2px] bg-gradient-to-r from-white/20 via-transparent to-white/20 rounded-md blur-sm animate-pulse" />
                        </div>
                        
                        <div className="relative w-5 h-5 flex items-center justify-center">
                          {/* Inner neon ring */}
                          <div className="absolute inset-0 border border-zinc-600 rounded group-hover:border-white/60 group-hover:shadow-[0_0_8px_rgba(255,255,255,0.3)] transition-all duration-300" />
                          
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            className="w-4 h-4 relative"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            {/* Center node */}
                            <circle cx="12" cy="12" r="2.5" className="fill-zinc-400 group-hover:fill-white stroke-zinc-300 group-hover:stroke-white transition-all duration-300" strokeWidth="0.5" />
                            
                            {/* Corner nodes */}
                            <circle cx="5" cy="5" r="1.5" className="fill-zinc-500 group-hover:fill-white stroke-zinc-400 group-hover:stroke-white transition-all duration-300" strokeWidth="0.5" />
                            <circle cx="19" cy="5" r="1.5" className="fill-zinc-500 group-hover:fill-white stroke-zinc-400 group-hover:stroke-white transition-all duration-300" strokeWidth="0.5" />
                            <circle cx="5" cy="19" r="1.5" className="fill-zinc-500 group-hover:fill-white stroke-zinc-400 group-hover:stroke-white transition-all duration-300" strokeWidth="0.5" />
                            <circle cx="19" cy="19" r="1.5" className="fill-zinc-500 group-hover:fill-white stroke-zinc-400 group-hover:stroke-white transition-all duration-300" strokeWidth="0.5" />
                            
                            {/* Connection lines */}
                            <line x1="12" y1="9.5" x2="6.5" y2="6.5" className="stroke-zinc-600 group-hover:stroke-white/80 transition-all duration-300" strokeWidth="1" />
                            <line x1="12" y1="9.5" x2="17.5" y2="6.5" className="stroke-zinc-600 group-hover:stroke-white/80 transition-all duration-300" strokeWidth="1" />
                            <line x1="12" y1="14.5" x2="6.5" y2="17.5" className="stroke-zinc-600 group-hover:stroke-white/80 transition-all duration-300" strokeWidth="1" />
                            <line x1="12" y1="14.5" x2="17.5" y2="17.5" className="stroke-zinc-600 group-hover:stroke-white/80 transition-all duration-300" strokeWidth="1" />
                          </svg>
                        </div>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Network Map</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>


              <NotificationCenter isPostsPage={true} />

              {/* Profile Avatar Button - Opens Slide-in Panel */}
              <Sheet open={isProfileOpen} onOpenChange={setIsProfileOpen}>
                <SheetTrigger asChild>
                  <button className="flex-shrink-0 focus:outline-none rounded-full relative group">
                    {/* Glow ring on hover */}
                    <div className="absolute inset-[-3px] rounded-full bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 opacity-0 group-hover:opacity-100 blur-sm transition-opacity duration-300" />
                    <Avatar className="w-8 h-8 border-2 border-orange-500/50 hover:border-orange-500 transition-colors cursor-pointer relative">
                      {(() => {
                        const avatarSrc = getAvatarUrl(profile.avatar_url, profile.username || profile.id);
                        const isVideo = avatarSrc.match(/\.(mp4|webm)$/i);
                        
                        if (isVideo) {
                          return (
                            <video
                              src={avatarSrc}
                              autoPlay
                              loop
                              muted
                              playsInline
                              className="w-full h-full object-cover rounded-full"
                            />
                          );
                        }
                        return <AvatarImage src={avatarSrc} alt={profile.username || 'Profile'} />;
                      })()}
                      <AvatarFallback className="bg-gradient-to-br from-orange-500 to-pink-500 text-white text-xs font-bold">
                        {profile.username?.charAt(0).toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </SheetTrigger>
                <SheetContent 
                  side="right" 
                  className="w-[340px] sm:w-[400px] p-0 bg-black/98 backdrop-blur-xl border-l border-zinc-800/50 flex flex-col h-full overflow-hidden"
                >
                  {/* Subtle tech background */}
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,165,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,165,0,0.02)_1px,transparent_1px)] bg-[size:32px_32px]" />
                  <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-orange-500/5 to-transparent" />
                  
                  {/* Header with Close Only */}
                  <div className="relative flex items-center justify-between px-4 py-3 border-b border-zinc-800/50">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-orange-400" />
                      <span className="text-sm font-semibold text-white">Overview</span>
                    </div>
                    <button 
                      onClick={() => setIsProfileOpen(false)}
                      className="w-8 h-8 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 flex items-center justify-center transition-colors border border-zinc-800"
                    >
                      <X className="w-4 h-4 text-zinc-400" />
                    </button>
                  </div>

                  {/* Compact Profile Info */}
                  <div className="relative px-4 py-4 flex items-center gap-4">
                    <div className="relative flex-shrink-0">
                      <div className="absolute inset-[-2px] rounded-full bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 opacity-60" />
                      <Avatar className="w-14 h-14 border-2 border-black relative">
                        {(() => {
                          const avatarSrc = getAvatarUrl(profile.avatar_url, profile.username || profile.id);
                          const isVideo = avatarSrc.match(/\.(mp4|webm)$/i);
                          if (isVideo) {
                            return (
                              <video src={avatarSrc} autoPlay loop muted playsInline className="w-full h-full object-cover rounded-full" />
                            );
                          }
                          return <AvatarImage src={avatarSrc} alt={profile.username || 'Profile'} />;
                        })()}
                        <AvatarFallback className="bg-gradient-to-br from-orange-500 to-pink-500 text-white text-lg font-bold">
                          {profile.username?.charAt(0).toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-black" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-base font-bold text-white truncate">{profile.display_name || profile.username || 'Anonymous'}</h3>
                        <Sparkles className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                      </div>
                      <p className="text-xs text-zinc-500">@{profile.username || 'user'}</p>
                    </div>
                    {walletAddress && (
                      <div className="flex items-center gap-1">
                        <button onClick={copyAddress} className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors" title="Copy Address">
                          <Copy className="w-3.5 h-3.5 text-zinc-500 hover:text-white" />
                        </button>
                        <button onClick={() => window.open(`https://snowtrace.io/address/${walletAddress}`, '_blank')} className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors" title="View on Explorer">
                          <ExternalLink className="w-3.5 h-3.5 text-zinc-500 hover:text-white" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Stats - Earned & Daily Time Only */}
                  <div className="px-4 pb-3">
                    <div className="grid grid-cols-2 gap-2">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="rounded-xl p-3 text-center bg-gradient-to-br from-orange-500/10 to-pink-500/10 border border-orange-500/20"
                      >
                        <Crown className="w-5 h-5 text-orange-400 mx-auto mb-1" />
                        <div className="text-lg font-bold text-orange-400">{formatCompactNumber(userStats.totalEarned)}</div>
                        <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Total Earned</div>
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.05 }}
                        className="rounded-xl p-3 text-center bg-zinc-900/60 border border-zinc-800/50"
                      >
                        <Clock className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
                        <div className="text-lg font-bold text-white">
                          {userStats.userScore}m
                        </div>
                        <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Score (1=1min)</div>
                      </motion.div>
                    </div>
                  </div>

                  {/* Assets - Vertical Scroll with fixed height */}
                  {allTokensWithBalance.length > 0 && (
                    <div className="px-4 py-2.5 border-t border-zinc-800/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Wallet className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="text-[10px] uppercase tracking-wider text-zinc-600 font-semibold">Assets</span>
                      </div>
                      <ScrollArea className="h-[180px] pr-2 touch-pan-y overscroll-contain">
                        <div className="space-y-1.5 pr-1">
                          {allTokensWithBalance.map((token, index) => (
                            <motion.div
                              key={token.symbol}
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.02 }}
                              className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-900/60 border border-zinc-800/50"
                            >
                              <div className="flex items-center gap-2.5">
                                <img src={token.logo} alt={token.symbol} className="w-6 h-6 rounded-full" onError={(e) => { (e.target as HTMLImageElement).src = avloLogo; }} />
                                <span className="text-xs text-zinc-400">{token.symbol}</span>
                              </div>
                              <div className="text-sm font-bold text-white">{parseFloat(token.balance).toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
                            </motion.div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {/* Staking - Compact Pills */}
                  {stakingPositions.length > 0 && (
                    <div className="px-4 py-2.5 border-t border-zinc-800/30">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Coins className="w-3.5 h-3.5 text-orange-400" />
                          <span className="text-[10px] uppercase tracking-wider text-zinc-600 font-semibold">Staking</span>
                        </div>
                        <button onClick={() => { navigate('/staking'); setIsProfileOpen(false); }} className="text-[9px] text-orange-400/70 hover:text-orange-400">
                          All →
                        </button>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                        {stakingPositions.slice(0, 4).map((position, index) => (
                          <motion.button
                            key={position.id}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.03 }}
                            onClick={() => { navigate(`/staking?pool=${position.id}`); setIsProfileOpen(false); }}
                            className="flex-shrink-0 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800/50 hover:border-orange-500/30 transition-colors"
                          >
                            <img src={position.stake_token_logo || avloLogo} alt={position.tokenSymbol} className="w-5 h-5 rounded-full" onError={(e) => { (e.target as HTMLImageElement).src = avloLogo; }} />
                            <div className="text-left">
                              <div className="text-[9px] text-zinc-500 truncate max-w-[60px]">{position.title}</div>
                              <div className="text-xs font-bold text-orange-400">{parseFloat(position.stakedAmount).toLocaleString('en-US', { maximumFractionDigits: 1 })}</div>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Activity - Compact List */}
                  {recentActivities.length > 0 && (
                    <div className="px-4 py-2.5 border-t border-zinc-800/30 flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-purple-400" />
                          <span className="text-[10px] uppercase tracking-wider text-zinc-600 font-semibold">Activity</span>
                        </div>
                        <button onClick={() => { navigate('/history'); setIsProfileOpen(false); }} className="text-[9px] text-purple-400/70 hover:text-purple-400">
                          All →
                        </button>
                      </div>
                      <div className="space-y-1">
                        {recentActivities.slice(0, 4).map((activity, index) => (
                          <motion.div
                            key={activity.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.02 }}
                            className="flex items-center justify-between py-1.5 px-2 rounded-md bg-zinc-900/30"
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                                activity.type === 'stake' ? 'bg-green-500/20' :
                                activity.type === 'unstake' ? 'bg-red-500/20' :
                                activity.type === 'game' ? 'bg-purple-500/20' :
                                activity.type === 'video' ? 'bg-pink-500/20' :
                                'bg-yellow-500/20'
                              }`}>
                                {activity.type === 'stake' && <TrendingUp className="w-2.5 h-2.5 text-green-400" />}
                                {activity.type === 'unstake' && <TrendingUp className="w-2.5 h-2.5 text-red-400 rotate-180" />}
                                {activity.type === 'game' && <Gamepad2 className="w-2.5 h-2.5 text-purple-400" />}
                                {activity.type === 'video' && <TrendingUp className="w-2.5 h-2.5 text-pink-400" />}
                                {activity.type === 'match' && <Trophy className="w-2.5 h-2.5 text-yellow-400" />}
                              </div>
                              <span className="text-[10px] text-zinc-400 truncate max-w-[120px]">{activity.title}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {activity.amount !== undefined && activity.amount > 0 && (
                                <span className="text-[9px] font-medium text-green-400">+{formatCompactNumber(activity.amount)}</span>
                              )}
                              <span className="text-[9px] text-zinc-600">{formatTimeAgo(activity.created_at)}</span>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Profile Settings Button - Full Width with Arena Logo */}
                  <div className="px-4 py-3 border-t border-zinc-800/30 mt-auto">
                    <button
                      onClick={() => { navigate('/profile'); setIsProfileOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-orange-500/10 via-pink-500/10 to-purple-500/10 hover:from-orange-500/20 hover:via-pink-500/20 hover:to-purple-500/20 border border-orange-500/20 hover:border-orange-500/40 transition-all group cursor-pointer z-10 relative"
                    >
                      {/* Arena User Logo */}
                      <div className="relative flex-shrink-0">
                        <div className="absolute inset-[-1px] rounded-full bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 opacity-60" />
                        <Avatar className="w-10 h-10 border border-black relative">
                          {(() => {
                            const avatarSrc = getAvatarUrl(profile.avatar_url, profile.username || profile.id);
                            const isVideo = avatarSrc.match(/\.(mp4|webm)$/i);
                            if (isVideo) {
                              return (
                                <video src={avatarSrc} autoPlay loop muted playsInline className="w-full h-full object-cover rounded-full" />
                              );
                            }
                            return <AvatarImage src={avatarSrc} alt={profile.username || 'Profile'} />;
                          })()}
                          <AvatarFallback className="bg-gradient-to-br from-orange-500 to-pink-500 text-white text-sm font-bold">
                            {profile.username?.charAt(0).toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="flex-1 text-left">
                        <span className="text-sm font-semibold text-white group-hover:text-orange-300 transition-colors block">Profile Settings</span>
                        <span className="text-[10px] text-zinc-500">Manage your account</span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-orange-500/60 group-hover:text-orange-400 transition-colors" />
                    </button>
                  </div>

                  {/* Footer */}
                  <div className="relative px-4 py-2 bg-zinc-900/30 border-t border-zinc-800/30">
                    <p className="text-[9px] text-zinc-600 text-center">
                      <span className="text-orange-500/80 font-semibold">AvaLove</span> • Avalanche
                    </p>
                  </div>
                </SheetContent>
              </Sheet>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
