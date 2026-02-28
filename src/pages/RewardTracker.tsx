import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWalletAuth } from "@/contexts/WalletAuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Clock, Coins, Activity, Gamepad2, Award, HistoryIcon, Settings, TrendingUp, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Leaderboard from "@/components/games/Leaderboard";
import TopPlayersCard from "@/components/games/TopPlayersCard";
import AvloTokenLogo from "@/assets/avlo-token-logo.jpg";
import { useAvloPrice } from "@/hooks/useAvloPrice";
import { useWeb3Auth } from "@/hooks/useWeb3Auth";
import { useLimitPeriod } from "@/hooks/useLimitPeriod";

const ADMIN_WALLET = "0x87A7A3D8f13f92795e2Ce5016B36E15893439B4F";

export default function RewardTracker() {
  const navigate = useNavigate();
  const { profile } = useWalletAuth();
  const { walletAddress } = useWeb3Auth();
  const { formatAvloWithUsd } = useAvloPrice();
  const { period: limitPeriod, periodLabelEn } = useLimitPeriod();
  const [totalWinnings, setTotalWinnings] = useState(0);
  const [unpaidRewards, setUnpaidRewards] = useState(0);
  const [globalUnpaidRewards, setGlobalUnpaidRewards] = useState(0);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [globalWinnings, setGlobalWinnings] = useState(0);
  const [globalGamesPlayed, setGlobalGamesPlayed] = useState(0);
  const [totalGamesCount, setTotalGamesCount] = useState(0);
  const [gameHistory, setGameHistory] = useState<any[]>([]);
  const [liveActivity, setLiveActivity] = useState<any[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [liveActivityPage, setLiveActivityPage] = useState(1);
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);
  const [loadingMoreLiveActivity, setLoadingMoreLiveActivity] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [hasMoreLiveActivity, setHasMoreLiveActivity] = useState(true);
  const ITEMS_PER_PAGE = 10;
  const [leaderboardRefresh, setLeaderboardRefresh] = useState(0);
  
  // Pool stats
  const [totalRewardPool, setTotalRewardPool] = useState<number>(100_000_000);
  const [gameRewardsDistributed, setGameRewardsDistributed] = useState<number>(0);
  const [displayRemainingPool, setDisplayRemainingPool] = useState<number>(100_000_000);
  
  // Timer countdown
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  
  const isAdmin = walletAddress?.toLowerCase() === ADMIN_WALLET.toLowerCase();

  // Calculate reset time based on limit period
  const getResetTime = (): Date => {
    const now = new Date();
    switch (limitPeriod) {
      case 'daily':
        const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
        return tomorrow;
      case 'weekly':
        const daysUntilMonday = (8 - now.getUTCDay()) % 7 || 7;
        const nextMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday, 0, 0, 0));
        return nextMonday;
      case 'monthly':
        const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
        return nextMonth;
      case 'yearly':
        const nextYear = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1, 0, 0, 0));
        return nextYear;
      default:
        return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
    }
  };

  // Timer effect
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const resetTime = getResetTime();
      const diff = resetTime.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeRemaining("Resetting...");
        return;
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      if (days > 0) {
        setTimeRemaining(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining(`${minutes}m ${seconds}s`);
      }
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [limitPeriod]);

  useEffect(() => {
    if (profile?.id) {
      fetchUserStats();
    }
    fetchGlobalStats();
    fetchGlobalUnpaid();
    fetchLiveActivity();
    fetchTotalGamesCount();
    fetchTotalPool();
    fetchPoolDistributed();

    const channel = supabase
      .channel('reward-tracker-stats')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'embedded_game_sessions'
        },
        () => {
          if (profile?.id) {
            fetchUserStats();
          }
          fetchGlobalStats();
          fetchLiveActivity();
          fetchPoolDistributed();
          setLeaderboardRefresh(prev => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'music_track_listens'
        },
        () => {
          if (profile?.id) {
            fetchUserStats();
          }
          fetchGlobalStats();
          setLeaderboardRefresh(prev => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_config',
          filter: 'config_key=eq.total_reward_pool'
        },
        () => {
          fetchTotalPool();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const fetchTotalPool = async () => {
    try {
      const { data } = await supabase
        .from('game_config')
        .select('config_value')
        .eq('config_key', 'total_reward_pool')
        .single();
      
      if (data && data.config_value && typeof data.config_value === 'object' && 'value' in data.config_value) {
        setTotalRewardPool(data.config_value.value as number);
      }
    } catch (error) {
      console.error("Error fetching total pool:", error);
    }
  };

  const fetchPoolDistributed = async () => {
    try {
      // Fetch ONLY actually paid rewards (paid = true) from all sources
      const [{ data: gameData }, { data: musicData }, { data: watchData }] = await Promise.all([
        supabase
          .from('embedded_game_sessions')
          .select('reward_earned')
          .eq('paid', true),
        supabase
          .from('music_track_listens')
          .select('reward_earned')
          .eq('paid', true),
        supabase
          .from('watch_video_views')
          .select('reward_earned')
          .eq('paid', true)
      ]);
      
      const gamePaid = gameData?.reduce((sum, item) => sum + Number(item.reward_earned || 0), 0) || 0;
      const musicPaid = musicData?.reduce((sum, item) => sum + Number(item.reward_earned || 0), 0) || 0;
      const watchPaid = watchData?.reduce((sum, item) => sum + Number(item.reward_earned || 0), 0) || 0;
      
      setGameRewardsDistributed(gamePaid + musicPaid + watchPaid);
    } catch (error) {
      console.error("Error fetching pool distributed:", error);
    }
  };

  // Animate remaining pool
  const remainingPool = totalRewardPool - gameRewardsDistributed;
  const poolPercentage = ((gameRewardsDistributed / totalRewardPool) * 100).toFixed(2);

  useEffect(() => {
    const target = remainingPool;
    setDisplayRemainingPool((current) => {
      const start = current;
      const change = target - start;
      const duration = 500;
      const startTime = performance.now();

      const step = (now: number) => {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = Math.round(start + change * eased);
        setDisplayRemainingPool(value);
        if (progress < 1) {
          requestAnimationFrame(step);
        }
      };
      requestAnimationFrame(step);
      return current;
    });
  }, [remainingPool]);

  const fetchUserStats = async (page = 1, append = false) => {
    if (!profile?.id) return;

    try {
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      // Fetch game sessions for history
      const { data: gameData, error: gameError, count: gameCount } = await supabase
        .from("embedded_game_sessions")
        .select("*", { count: 'exact' })
        .eq("user_id", profile.id)
        .order("started_at", { ascending: false })
        .range(from, to);

      if (gameError) throw gameError;

      // Fetch music listen sessions for history
      const { data: musicData, error: musicError, count: musicCount } = await supabase
        .from("music_track_listens")
        .select(`
          *,
          track:music_tracks(title)
        `, { count: 'exact' })
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (musicError) throw musicError;

      // Fetch watch video sessions for history
      const { data: watchData, error: watchError, count: watchCount } = await supabase
        .from("watch_video_views")
        .select(`
          *,
          video:watch_videos(title)
        `, { count: 'exact' })
        .eq("user_id", profile.id)
        .order("started_at", { ascending: false })
        .range(from, to);

      if (watchError) throw watchError;

      // Combine and sort by date
      const combinedHistory = [
        ...(gameData || []).map(s => ({ ...s, type: 'game', started_at: s.started_at })),
        ...(musicData || []).map(s => ({ ...s, type: 'music', started_at: s.started_at || s.created_at })),
        ...(watchData || []).map(s => ({ ...s, type: 'watch', started_at: s.started_at, game_title: s.video?.title || 'Video' }))
      ].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());

      if (!append) {
        // Calculate total from all game sessions
        const { data: allGameData } = await supabase
          .from("embedded_game_sessions")
          .select("reward_earned, paid, paid_at")
          .eq("user_id", profile.id);

        // Calculate total from all music sessions
        const { data: allMusicData } = await supabase
          .from("music_track_listens")
          .select("reward_earned, paid, paid_at")
          .eq("user_id", profile.id);

        // Calculate total from all watch sessions
        const { data: allWatchData } = await supabase
          .from("watch_video_views")
          .select("reward_earned, paid, paid_at")
          .eq("user_id", profile.id);

        // Calculate total from all short video sessions
        const { data: allShortData } = await supabase
          .from("short_video_views")
          .select("reward_earned, paid, paid_at")
          .eq("user_id", profile.id);

        // Calculate total from all swap transactions
        const { data: allSwapData } = await supabase
          .from("swap_transactions")
          .select("reward_earned, paid, paid_at")
          .eq("user_id", profile.id);
        
        const totalGameEarned = allGameData?.reduce((sum, session) => sum + Number(session.reward_earned || 0), 0) || 0;
        const totalMusicEarned = allMusicData?.reduce((sum, session) => sum + Number(session.reward_earned || 0), 0) || 0;
        const totalWatchEarned = allWatchData?.reduce((sum, session) => sum + Number(session.reward_earned || 0), 0) || 0;
        const totalShortEarned = allShortData?.reduce((sum, session) => sum + Number(session.reward_earned || 0), 0) || 0;
        const totalSwapEarned = allSwapData?.reduce((sum, tx: any) => sum + Number(tx.reward_earned || 0), 0) || 0;
        const totalEarned = totalGameEarned + totalMusicEarned + totalWatchEarned + totalShortEarned + totalSwapEarned;
        
        // Calculate unpaid rewards
        const unpaidGames = allGameData?.filter(s => !s.paid).reduce((sum, s) => sum + Number(s.reward_earned || 0), 0) || 0;
        const unpaidMusic = allMusicData?.filter(s => !s.paid).reduce((sum, s) => sum + Number(s.reward_earned || 0), 0) || 0;
        const unpaidWatch = allWatchData?.filter(s => !s.paid).reduce((sum, s) => sum + Number(s.reward_earned || 0), 0) || 0;
        const unpaidShort = allShortData?.filter(s => !s.paid).reduce((sum, s) => sum + Number(s.reward_earned || 0), 0) || 0;
        const unpaidSwap = allSwapData?.filter((tx: any) => !tx.paid).reduce((sum, tx: any) => sum + Number(tx.reward_earned || 0), 0) || 0;
        const totalUnpaidRaw = unpaidGames + unpaidMusic + unpaidWatch + unpaidShort + unpaidSwap;

        // Find last payment date to calculate burns since then
        const paidDates = [
          ...(allGameData?.filter(s => s.paid && s.paid_at).map(s => s.paid_at) || []),
          ...(allMusicData?.filter(s => s.paid && s.paid_at).map(s => s.paid_at) || []),
          ...(allWatchData?.filter(s => s.paid && s.paid_at).map(s => s.paid_at) || []),
          ...(allShortData?.filter(s => s.paid && s.paid_at).map(s => s.paid_at) || []),
          ...(allSwapData?.filter((tx: any) => tx.paid && tx.paid_at).map((tx: any) => tx.paid_at) || [])
        ].filter(Boolean) as string[];
        
        const lastPaidAt = paidDates.length > 0 
          ? paidDates.reduce((latest, current) => current > latest ? current : latest)
          : null;

        // Get burns since last payment
        const burnTypes = ['chat_message', 'ai_chat', 'pack_opening', 'pixel_art', 'pixel_art_spend', 'card_purchase', 'card_sale', 'pool_boost', 'swipe_boost', 'post_text', 'post_image', 'post_gif', 'post_video', 'post_comment', 'post_repost', 'game_add', 'video_add', 'raffle_entry'];
        let burnsQuery = supabase
          .from('token_burns')
          .select('amount')
          .eq('user_id', profile.id)
          .in('burn_type', burnTypes);
        
        if (lastPaidAt) {
          burnsQuery = burnsQuery.gt('created_at', lastPaidAt);
        }
        
        const { data: burnsData } = await burnsQuery;
        const totalBurned = burnsData?.reduce((sum, b) => sum + Number(b.amount || 0), 0) || 0;

        // Spendable = unpaid - burns (never negative)
        const spendableBalance = Math.max(0, totalUnpaidRaw - totalBurned);
        
        setTotalWinnings(totalEarned);
        setUnpaidRewards(spendableBalance);
        setGamesPlayed((gameCount || 0) + (musicCount || 0) + (watchCount || 0));
        setGameHistory(combinedHistory);
      } else {
        setGameHistory(prev => [...prev, ...combinedHistory]);
      }
      
      setHasMoreHistory(combinedHistory.length === ITEMS_PER_PAGE);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchGlobalStats = async () => {
    try {
      const [{ data: gameData }, { data: musicData }, { data: watchData }] = await Promise.all([
        supabase.from("embedded_game_sessions").select("reward_earned"),
        supabase.from("music_track_listens").select("reward_earned"),
        supabase.from("watch_video_views").select("reward_earned")
      ]);

      const gameTotal = gameData?.reduce((sum, session) => sum + Number(session.reward_earned || 0), 0) || 0;
      const musicTotal = musicData?.reduce((sum, session) => sum + Number(session.reward_earned || 0), 0) || 0;
      const watchTotal = watchData?.reduce((sum, session) => sum + Number(session.reward_earned || 0), 0) || 0;
      
      setGlobalWinnings(gameTotal + musicTotal + watchTotal);
      setGlobalGamesPlayed((gameData?.length || 0) + (musicData?.length || 0) + (watchData?.length || 0));
    } catch (error) {
      console.error("Error fetching global stats:", error);
    }
  };

  const fetchGlobalUnpaid = async () => {
    try {
      // "Global Unpaid" should reflect *earned-but-not-paid* rewards.
      // We only count completed sessions with real play time to avoid including admin/adjustment rows.
      const [{ data: gameData }, { data: musicData }, { data: watchData }, { data: swapData }] = await Promise.all([
        supabase
          .from("embedded_game_sessions")
          .select("reward_earned")
          .eq("status", "completed")
          .gt("play_time_seconds", 0)
          .gt("reward_earned", 0)
          .or("paid.eq.false,paid.is.null"),
        supabase
          .from("music_track_listens")
          .select("reward_earned")
          .eq("status", "completed")
          .gt("play_time_seconds", 0)
          .gt("reward_earned", 0)
          .or("paid.eq.false,paid.is.null"),
        supabase
          .from("watch_video_views")
          .select("reward_earned")
          .eq("status", "completed")
          .gt("play_time_seconds", 0)
          .gt("reward_earned", 0)
          .or("paid.eq.false,paid.is.null"),
        supabase
          .from("swap_transactions")
          .select("reward_earned")
          .gt("reward_earned", 0)
          .or("paid.eq.false,paid.is.null")
      ]);

      const gameUnpaid = gameData?.reduce((sum, s) => sum + Number(s.reward_earned || 0), 0) || 0;
      const musicUnpaid = musicData?.reduce((sum, s) => sum + Number(s.reward_earned || 0), 0) || 0;
      const watchUnpaid = watchData?.reduce((sum, s) => sum + Number(s.reward_earned || 0), 0) || 0;
      const swapUnpaid = swapData?.reduce((sum, s: any) => sum + Number(s.reward_earned || 0), 0) || 0;

      setGlobalUnpaidRewards(gameUnpaid + musicUnpaid + watchUnpaid + swapUnpaid);
    } catch (error) {
      console.error("Error fetching global unpaid:", error);
    }
  };

  const fetchLiveActivity = async (page = 1, append = false) => {
    try {
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, error } = await supabase
        .from('embedded_game_sessions')
        .select(`
          *,
          profiles:user_id (
            username,
            display_name,
            avatar_url
          )
        `)
        .order('started_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      
      if (append) {
        setLiveActivity(prev => [...prev, ...(data || [])]);
      } else {
        setLiveActivity(data || []);
      }
      
      setHasMoreLiveActivity(data && data.length === ITEMS_PER_PAGE);
    } catch (error) {
      console.error('Error fetching live activity:', error);
    }
  };

  const loadMoreHistory = async () => {
    if (loadingMoreHistory || !hasMoreHistory) return;
    setLoadingMoreHistory(true);
    const nextPage = historyPage + 1;
    await fetchUserStats(nextPage, true);
    setHistoryPage(nextPage);
    setLoadingMoreHistory(false);
  };

  const loadMoreLiveActivity = async () => {
    if (loadingMoreLiveActivity || !hasMoreLiveActivity) return;
    setLoadingMoreLiveActivity(true);
    const nextPage = liveActivityPage + 1;
    await fetchLiveActivity(nextPage, true);
    setLiveActivityPage(nextPage);
    setLoadingMoreLiveActivity(false);
  };

  const fetchTotalGamesCount = async () => {
    try {
      const { count, error } = await supabase
        .from('online_games')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;
      setTotalGamesCount(count || 0);
    } catch (error) {
      console.error('Error fetching total games count:', error);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold flex items-center gap-2 text-white">
          <Trophy className="h-8 w-8 text-primary" />
          Reward Tracker
        </h1>
      </div>


      <Tabs defaultValue="reward" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 bg-transparent border-none gap-2">
          <TabsTrigger 
            value="reward" 
            className="relative overflow-hidden border-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-[0_0_15px_rgba(251,191,36,0.5)] transition-all duration-300 bg-gradient-to-br from-primary/10 to-secondary/10 hover:from-primary/20 hover:to-secondary/20 text-white/70 data-[state=active]:text-black group"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-primary via-secondary to-primary bg-[length:200%_100%] animate-[shimmer_3s_ease-in-out_infinite] opacity-0 group-data-[state=active]:opacity-100" />
            <Trophy className="w-4 h-4 relative z-10" />
            <span className="hidden sm:inline ml-1.5 relative z-10 font-semibold">Payments</span>
          </TabsTrigger>
          
          <TabsTrigger value="top-players" className="data-[state=active]:bg-primary data-[state=active]:text-white text-white/70 border border-white/10">
            <Award className="w-4 h-4" />
            <span className="hidden sm:inline ml-1.5">Top Players</span>
          </TabsTrigger>
          
          <TabsTrigger value="history" className="data-[state=active]:bg-primary data-[state=active]:text-white text-white/70 border border-white/10">
            <HistoryIcon className="w-4 h-4" />
            <span className="hidden sm:inline ml-1.5">History</span>
          </TabsTrigger>
          
          <TabsTrigger value="live" className="data-[state=active]:bg-primary data-[state=active]:text-white text-white/70 border border-white/10">
            <Activity className="w-4 h-4" />
            <span className="hidden sm:inline ml-1.5">Live Activity</span>
          </TabsTrigger>

          <TabsTrigger value="statistics" className="data-[state=active]:bg-primary data-[state=active]:text-white text-white/70 border border-white/10">
            <Coins className="w-4 h-4" />
            <span className="hidden sm:inline ml-1.5">Statistics</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reward">
          <Leaderboard key={leaderboardRefresh} />
        </TabsContent>

        <TabsContent value="top-players">
          <TopPlayersCard />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card className="bg-black border-primary">
            <CardHeader>
              <CardTitle className="text-white">Your Game History</CardTitle>
              <CardDescription className="text-white/70">
                Track your recent gaming sessions and rewards
              </CardDescription>
            </CardHeader>
            <CardContent>
              {gameHistory.length === 0 ? (
                <div className="text-center py-8 text-white/70">
                  No games played yet. Start playing to see your history!
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                     {gameHistory.map((session: any) => (
                      <div 
                        key={session.id}
                        className="flex items-center justify-between p-4 rounded-lg border border-primary bg-black hover:bg-black/80 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-full ${
                            session.status === 'completed' ? 'bg-green-500/20' : 
                            session.status === 'afk' ? 'bg-red-500/20' : 'bg-yellow-500/20'
                          }`}>
                            <Gamepad2 className={`w-5 h-5 ${
                              session.status === 'completed' ? 'text-green-500' : 
                              session.status === 'afk' ? 'text-red-500' : 'text-yellow-500'
                            }`} />
                          </div>
                          <div>
                            <h4 className="font-semibold text-white">
                              {session.type === 'music' ? (session.track?.title || 'Music Track') : session.game_title}
                            </h4>
                            <div className="flex items-center gap-3 text-sm text-white/70">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {Math.floor((session.play_time_seconds || 0) / 60)}m {(session.play_time_seconds || 0) % 60}s
                              </span>
                              <Badge variant={
                                session.status === 'completed' ? 'default' : 
                                session.status === 'afk' ? 'destructive' : 'secondary'
                              } className="text-xs">
                                {session.type === 'music' ? 'Listen' : session.status}
                              </Badge>
                              <span className="text-xs">
                                {new Date(session.started_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-bold flex items-center gap-1.5 justify-end ${
                            (session.reward_earned || 0) > 0 ? 'text-green-500' : 'text-muted-foreground'
                          }`}>
                            <img src={AvloTokenLogo} alt="AVLO" className="w-4 h-4 rounded-full" />
                            {(session.reward_earned || 0) > 0 ? '+' : ''}{formatAvloWithUsd(session.reward_earned || 0).avlo} AVLO
                          </div>
                          <div className="text-xs text-green-400">{formatAvloWithUsd(session.reward_earned || 0).usd}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {hasMoreHistory && (
                    <div className="flex justify-center mt-6">
                      <Button
                        onClick={loadMoreHistory}
                        disabled={loadingMoreHistory}
                        variant="outline"
                        className="bg-black border-primary text-white hover:bg-black/80"
                      >
                        {loadingMoreHistory ? 'Loading...' : 'Load More'}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="live" className="space-y-4">
          <Card className="bg-black border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Activity className="h-5 w-5 text-primary" />
                Live Activity Feed
              </CardTitle>
              <CardDescription className="text-white/70">
                See what players are doing in real-time
              </CardDescription>
            </CardHeader>
            <CardContent>
              {liveActivity.length === 0 ? (
                <div className="text-center py-8 text-white/70">
                  No recent activity
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {liveActivity.map((session: any) => (
                      <div 
                        key={session.id}
                        className="flex items-center gap-4 p-3 rounded-lg border border-primary bg-black"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={session.profiles?.avatar_url} />
                          <AvatarFallback>
                            {session.profiles?.display_name?.[0] || session.profiles?.username?.[0] || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate text-white">
                            {session.profiles?.display_name || session.profiles?.username || 'Anonymous'}
                          </p>
                          <p className="text-xs text-white/70 truncate">
                            {session.status === 'playing' ? '🎮 Playing' : session.status === 'completed' ? '✅ Completed' : '❌ AFK'} {session.game_title}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant={
                            session.status === 'completed' ? 'default' : 
                            session.status === 'afk' ? 'destructive' : 'secondary'
                          } className="flex items-center gap-1">
                            {session.status === 'completed' && (
                              <img src={AvloTokenLogo} alt="AVLO" className="w-3 h-3 rounded-full" />
                            )}
                            {session.status === 'completed' ? `+${formatAvloWithUsd(session.reward_earned).avlo}` : session.status}
                          </Badge>
                          {session.status === 'completed' && (
                            <p className="text-xs text-green-400 mt-0.5">{formatAvloWithUsd(session.reward_earned).usd}</p>
                          )}
                          <p className="text-xs text-white/70 mt-1">
                            {new Date(session.started_at).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {hasMoreLiveActivity && (
                    <div className="flex justify-center mt-6">
                      <Button
                        onClick={loadMoreLiveActivity}
                        disabled={loadingMoreLiveActivity}
                        variant="outline"
                        className="bg-black border-primary text-white hover:bg-black/80"
                      >
                        {loadingMoreLiveActivity ? 'Loading...' : 'Load More'}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statistics" className="space-y-6">
          {/* Timer Card */}
          <Card className="bg-gradient-to-br from-black via-zinc-900 to-black border border-primary/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/20 rounded-lg">
                    <Timer className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-white/70">Limit Period</p>
                    <p className="text-lg font-bold text-white">{periodLabelEn}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-white/70">Resets in</p>
                  <p className="text-xl font-mono font-bold text-primary">{timeRemaining}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pool Stats Card */}
          <Card className="bg-gradient-to-br from-black via-zinc-900 to-black border border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.1)]">
            <CardHeader className="border-b border-green-500/20">
              <CardTitle className="text-white flex items-center gap-2">
                <Trophy className="h-5 w-5 text-green-500" />
                Reward Pool
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/admin")}
                    className="h-6 w-6 p-0 hover:bg-purple-500/20 ml-2"
                  >
                    <Settings className="h-4 w-4 text-purple-400 hover:text-purple-300" />
                  </Button>
                )}
              </CardTitle>
              <CardDescription className="text-white/60">
                Token distribution and pool metrics
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {/* Total Pool */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-transparent rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300" />
                  <div className="relative bg-black/80 backdrop-blur-sm border border-green-500/50 rounded-xl p-4 hover:border-green-500 transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 bg-green-500/20 rounded-lg">
                        <Trophy className="h-5 w-5 text-green-500" />
                      </div>
                      <span className="text-xs text-green-400 font-mono">TOTAL POOL</span>
                    </div>
                    <div className="text-2xl font-bold text-white flex items-center gap-2">
                      {formatAvloWithUsd(totalRewardPool).avlo}
                      <img src={AvloTokenLogo} alt="AVLO" className="h-5 w-5 rounded-full" />
                    </div>
                    <p className="text-sm text-green-400 mt-1">≈ {formatAvloWithUsd(totalRewardPool).usd}</p>
                  </div>
                </div>

                {/* Distributed */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-transparent rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300" />
                  <div className="relative bg-black/80 backdrop-blur-sm border border-orange-500/50 rounded-xl p-4 hover:border-orange-500 transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 bg-orange-500/20 rounded-lg">
                        <TrendingUp className="h-5 w-5 text-orange-500" />
                      </div>
                      <span className="text-xs text-orange-400 font-mono">DISTRIBUTED</span>
                    </div>
                    <div className="text-2xl font-bold text-orange-500 flex items-center gap-2">
                      {formatAvloWithUsd(gameRewardsDistributed).avlo}
                      <img src={AvloTokenLogo} alt="AVLO" className="h-5 w-5 rounded-full" />
                    </div>
                    <p className="text-sm text-green-400 mt-1">≈ {formatAvloWithUsd(gameRewardsDistributed).usd}</p>
                  </div>
                </div>

                {/* Remaining */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-transparent rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300" />
                  <div className="relative bg-black/80 backdrop-blur-sm border border-emerald-500/50 rounded-xl p-4 hover:border-emerald-500 transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 bg-emerald-500/20 rounded-lg">
                        <Coins className="h-5 w-5 text-emerald-500" />
                      </div>
                      <span className="text-xs text-emerald-400 font-mono">REMAINING</span>
                    </div>
                    <div className="text-2xl font-bold text-emerald-500 flex items-center gap-2 animate-fade-in">
                      {formatAvloWithUsd(displayRemainingPool).avlo}
                      <img src={AvloTokenLogo} alt="AVLO" className="h-5 w-5 rounded-full" />
                    </div>
                    <p className="text-sm text-green-400 mt-1">≈ {formatAvloWithUsd(displayRemainingPool).usd}</p>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="bg-black/50 rounded-xl p-4 border border-white/10">
                <div className="flex justify-between text-sm text-white/70 mb-2">
                  <span className="font-mono">Pool Progress</span>
                  <span className="text-primary font-mono">{poolPercentage}% distributed</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-green-500 via-yellow-500 to-orange-500 h-3 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(251,191,36,0.5)]"
                    style={{ width: `${Math.min(parseFloat(poolPercentage), 100)}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Platform Statistics Card */}
          <Card className="bg-gradient-to-br from-black via-zinc-900 to-black border border-primary/30 shadow-[0_0_30px_rgba(251,191,36,0.1)]">
            <CardHeader className="border-b border-primary/20">
              <CardTitle className="text-white flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Platform Statistics
              </CardTitle>
              <CardDescription className="text-white/60">
                Real-time performance metrics and analytics
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {/* Total Earnings */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-transparent rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300" />
                  <div className="relative bg-black/80 backdrop-blur-sm border border-orange-500/50 rounded-xl p-4 hover:border-orange-500 transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 bg-orange-500/20 rounded-lg">
                        <Coins className="h-5 w-5 text-orange-500" />
                      </div>
                      <span className="text-xs text-orange-400 font-mono">EARNINGS</span>
                    </div>
                    <div className="text-2xl font-bold text-white flex items-center gap-2">
                      {formatAvloWithUsd(totalWinnings).avlo}
                      <img src={AvloTokenLogo} alt="AVLO" className="h-5 w-5 rounded-full" />
                    </div>
                    <p className="text-sm text-green-400 mt-1">≈ {formatAvloWithUsd(totalWinnings).usd}</p>
                    <div className="mt-2 pt-2 border-t border-white/10">
                      <p className="text-xs text-white/50">Global: {formatAvloWithUsd(globalWinnings).avlo}</p>
                    </div>
                  </div>
                </div>

                {/* Global Unpaid */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 to-transparent rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300" />
                  <div className="relative bg-black/80 backdrop-blur-sm border border-yellow-500/50 rounded-xl p-4 hover:border-yellow-500 transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 bg-yellow-500/20 rounded-lg">
                        <Coins className="h-5 w-5 text-yellow-500" />
                      </div>
                      <span className="text-xs text-yellow-400 font-mono">UNPAID</span>
                    </div>
                    <div className="text-2xl font-bold text-yellow-500 flex items-center gap-2">
                      {formatAvloWithUsd(globalUnpaidRewards).avlo}
                      <img src={AvloTokenLogo} alt="AVLO" className="h-5 w-5 rounded-full" />
                    </div>
                    <p className="text-sm text-green-400 mt-1">≈ {formatAvloWithUsd(globalUnpaidRewards).usd}</p>
                    <div className="mt-2 pt-2 border-t border-white/10">
                      <p className="text-xs text-white/50">Your Spendable: {formatAvloWithUsd(unpaidRewards).avlo}</p>
                    </div>
                  </div>
                </div>

                {/* Sessions Played */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-transparent rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300" />
                  <div className="relative bg-black/80 backdrop-blur-sm border border-green-500/50 rounded-xl p-4 hover:border-green-500 transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 bg-green-500/20 rounded-lg">
                        <Trophy className="h-5 w-5 text-green-500" />
                      </div>
                      <span className="text-xs text-green-400 font-mono">SESSIONS</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{gamesPlayed}</div>
                    <p className="text-sm text-white/60 mt-1">Your sessions</p>
                    <div className="mt-2 pt-2 border-t border-white/10">
                      <p className="text-xs text-white/50">Global: {globalGamesPlayed.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Avg. Per Session */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-transparent rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300" />
                  <div className="relative bg-black/80 backdrop-blur-sm border border-blue-500/50 rounded-xl p-4 hover:border-blue-500 transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 bg-blue-500/20 rounded-lg">
                        <Clock className="h-5 w-5 text-blue-500" />
                      </div>
                      <span className="text-xs text-blue-400 font-mono">AVG/SESSION</span>
                    </div>
                    <div className="text-2xl font-bold text-white flex items-center gap-2">
                      {formatAvloWithUsd(gamesPlayed > 0 ? totalWinnings / gamesPlayed : 0).avlo}
                      <img src={AvloTokenLogo} alt="AVLO" className="h-5 w-5 rounded-full" />
                    </div>
                    <p className="text-sm text-green-400 mt-1">≈ {formatAvloWithUsd(gamesPlayed > 0 ? totalWinnings / gamesPlayed : 0).usd}</p>
                    <div className="mt-2 pt-2 border-t border-white/10">
                      <p className="text-xs text-white/50">Per session average</p>
                    </div>
                  </div>
                </div>

                {/* Total Games */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-transparent rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300" />
                  <div className="relative bg-black/80 backdrop-blur-sm border border-purple-500/50 rounded-xl p-4 hover:border-purple-500 transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 bg-purple-500/20 rounded-lg">
                        <Gamepad2 className="h-5 w-5 text-purple-500" />
                      </div>
                      <span className="text-xs text-purple-400 font-mono">GAMES</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{totalGamesCount}</div>
                    <p className="text-sm text-white/60 mt-1">Available</p>
                    <div className="mt-2 pt-2 border-t border-white/10">
                      <p className="text-xs text-white/50">Ready to play</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
