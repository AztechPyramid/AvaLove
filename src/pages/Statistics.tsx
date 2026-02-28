import { useState, useEffect, lazy, Suspense } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePaymentTokens, PaymentToken } from '@/hooks/usePaymentTokens';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { 
  Users, Heart, Flame, TrendingUp, Trophy, Medal, Award, Gift, 
  BarChart3, Activity, Zap, Gamepad2, Play, Palette,
  MessageSquare, Eye, Clock, Star, Target, Sparkles, X, ThumbsUp, Share2, Building2, Wallet, ExternalLink, Bot
} from 'lucide-react';
import avloLogo from '@/assets/avlo-logo.jpg';
import { motion } from 'framer-motion';
import { JsonRpcProvider, Contract } from 'ethers';
import { TOKEN_CONTRACT, DEAD_ADDRESS } from '@/config/wagmi';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const BubbleMapNetwork = lazy(() => import('@/components/statistics/BubbleMapNetwork'));
const AgentActivityTab = lazy(() => import('@/components/statistics/AgentActivityTab'));

interface PlatformStats {
  totalUsers: number;
  totalSwipes: number;
  totalMatches: number;
  totalTokensBurned: number;
  totalLikes: number;
  totalPasses: number;
  likeRate: number;
  totalTips: number;
  totalTipsAmount: number;
  totalPosts: number;
  totalPostLikes: number;
  totalPostComments: number;
  totalGames: number;
  totalGameSessions: number;
  totalGameTime: number;
  totalGameRewards: number;
  totalPixels: number;
  uniqueArtists: number;
  totalCards: number;
  totalProposals: number;
  totalVotes: number;
  todayDAU: number;
  yesterdayDAU: number;
  weeklyDAU: number;
}

interface LeaderboardUser {
  id: string;
  username: string;
  avatar_url: string | null;
  value: number;
}

interface ChartDataPoint {
  date: string;
  value: number;
}

const FOUNDATION_WALLET = '0xB799CD1f2ED5dB96ea94EdF367fBA2d90dfd9634';

const Statistics = () => {
  const [stats, setStats] = useState<PlatformStats>({
    totalUsers: 0, totalSwipes: 0, totalMatches: 0, totalTokensBurned: 0,
    totalLikes: 0, totalPasses: 0, likeRate: 0, totalTips: 0, totalTipsAmount: 0,
    totalPosts: 0, totalPostLikes: 0, totalPostComments: 0,
    totalGames: 0, totalGameSessions: 0, totalGameTime: 0, totalGameRewards: 0,
    totalPixels: 0, uniqueArtists: 0, totalCards: 0,
    totalProposals: 0, totalVotes: 0,
    todayDAU: 0, yesterdayDAU: 0, weeklyDAU: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'overview' | 'leaderboards' | 'charts' | 'bubblemap' | 'foundation' | 'agents'>('overview');
  const [activeLeaderboard, setActiveLeaderboard] = useState('scores');
  const [foundationBalances, setFoundationBalances] = useState<{token: PaymentToken; balance: number; usdValue: number}[]>([]);
  const [avaxBalance, setAvaxBalance] = useState<number>(0);
  const [avaxUsdValue, setAvaxUsdValue] = useState<number>(0);
  const [totalFoundationValue, setTotalFoundationValue] = useState<number>(0);
  const [foundationLoading, setFoundationLoading] = useState(false);
  
  const { tokens: paymentTokens } = usePaymentTokens();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  const [topMatchers, setTopMatchers] = useState<LeaderboardUser[]>([]);
  const [topSwipers, setTopSwipers] = useState<LeaderboardUser[]>([]);
  const [topBurners, setTopBurners] = useState<LeaderboardUser[]>([]);
  const [topGivers, setTopGivers] = useState<LeaderboardUser[]>([]);
  const [topReceivers, setTopReceivers] = useState<LeaderboardUser[]>([]);
  const [topScorers, setTopScorers] = useState<LeaderboardUser[]>([]);
  const [topGamers, setTopGamers] = useState<LeaderboardUser[]>([]);
  const [mostLiked, setMostLiked] = useState<LeaderboardUser[]>([]);
  const [mostPassed, setMostPassed] = useState<LeaderboardUser[]>([]);
  
  const [burnChartData, setBurnChartData] = useState<ChartDataPoint[]>([]);
  const [userChartData, setUserChartData] = useState<ChartDataPoint[]>([]);
  
  useEffect(() => {
    fetchPlatformStats();
    fetchLeaderboards();
    fetchChartData();
  }, []);

  useEffect(() => {
    if (activeSection === 'foundation' && paymentTokens.length > 0) {
      fetchFoundationBalances();
    }
  }, [activeSection, paymentTokens]);

  const fetchFoundationBalances = async () => {
    setFoundationLoading(true);
    try {
      const provider = new JsonRpcProvider('https://api.avax.network/ext/bc/C/rpc');
      const erc20Abi = ['function balanceOf(address owner) view returns (uint256)'];
      
      // Fetch AVAX balance
      const avaxBal = await provider.getBalance(FOUNDATION_WALLET);
      const avaxBalNum = Number(avaxBal) / (10 ** 18);
      setAvaxBalance(avaxBalNum);
      
      // Fetch AVAX price via GeckoTerminal
      const wavaxAddress = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
      const avaxPriceRes = await fetch(
        `https://api.geckoterminal.com/api/v2/simple/networks/avax/token_price/${wavaxAddress}`,
        { headers: { 'Accept': 'application/json;version=20230203' } }
      );
      const avaxPriceData = await avaxPriceRes.json();
      const avaxPrices = avaxPriceData?.data?.attributes?.token_prices || {};
      const avaxPrice = parseFloat(avaxPrices[wavaxAddress.toLowerCase()] || '0');
      setAvaxUsdValue(avaxBalNum * avaxPrice);
      
      // Fetch all token balances
      const balancePromises = paymentTokens.map(async (token) => {
        try {
          const tokenContract = new Contract(token.token_address, erc20Abi, provider);
          const balance = await tokenContract.balanceOf(FOUNDATION_WALLET);
          const balanceNum = Number(balance) / (10 ** token.decimals);
          
          // Try to get price from GeckoTerminal
          let usdValue = 0;
          try {
            const priceRes = await fetch(
              `https://api.geckoterminal.com/api/v2/simple/networks/avax/token_price/${token.token_address}`,
              { headers: { 'Accept': 'application/json;version=20230203' } }
            );
            const priceData = await priceRes.json();
            const tokenPrices = priceData?.data?.attributes?.token_prices || {};
            const priceStr = tokenPrices[token.token_address.toLowerCase()] || tokenPrices[token.token_address];
            const price = priceStr ? parseFloat(priceStr) : 0;
            usdValue = balanceNum * price;
          } catch (e) {
            console.log(`Could not fetch price for ${token.token_symbol}`);
          }
          
          return { token, balance: balanceNum, usdValue };
        } catch (e) {
          console.error(`Error fetching balance for ${token.token_symbol}:`, e);
          return { token, balance: 0, usdValue: 0 };
        }
      });
      
      const balances = await Promise.all(balancePromises);
      // Filter out zero balances and sort by USD value
      const nonZeroBalances = balances.filter(b => b.balance > 0).sort((a, b) => b.usdValue - a.usdValue);
      setFoundationBalances(nonZeroBalances);
      
      // Calculate total value
      const totalTokenValue = nonZeroBalances.reduce((sum, b) => sum + b.usdValue, 0);
      setTotalFoundationValue(totalTokenValue + (avaxBalNum * avaxPrice));
      
    } catch (error) {
      console.error('Error fetching foundation balances:', error);
    } finally {
      setFoundationLoading(false);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const fetchPlatformStats = async () => {
    try {
      // Get today and yesterday dates
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);

      // Parallel queries for better performance
      const [
        usersResult,
        swipesResult,
        matchesResult,
        tipsResult,
        postsResult,
        postLikesResult,
        postCommentsResult,
        gamesResult,
        gameSessionsResult,
        pixelsResult,
        artistsResult,
        cardsResult,
        proposalsResult,
        votesResult,
        todayActiveResult,
        yesterdayActiveResult,
        weeklyActiveResult,
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('swipes').select('direction', { count: 'exact' }),
        supabase.from('matches').select('*', { count: 'exact', head: true }),
        supabase.from('tips').select('amount', { count: 'exact' }),
        supabase.from('posts').select('*', { count: 'exact', head: true }),
        supabase.from('post_likes').select('*', { count: 'exact', head: true }),
        supabase.from('post_comments').select('*', { count: 'exact', head: true }),
        supabase.from('online_games').select('*', { count: 'exact', head: true }),
        supabase.from('embedded_game_sessions').select('play_time_seconds, reward_earned, paid', { count: 'exact' }),
        supabase.from('pixels').select('*', { count: 'exact', head: true }),
        supabase.from('pixels').select('placed_by'),
        supabase.from('art_cards').select('*', { count: 'exact', head: true }),
        supabase.from('community_proposals').select('*', { count: 'exact', head: true }),
        supabase.from('community_votes').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('last_active', todayStr),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('last_active', yesterdayStr).lt('last_active', todayStr),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('last_active', weekAgo.toISOString()),
      ]);

      // Process swipes data
      const swipesData = swipesResult.data;
      const likes = swipesData?.filter(s => s.direction === 'right').length || 0;
      const passes = swipesData?.filter(s => s.direction === 'left').length || 0;
      const swipesCount = swipesResult.count || 0;
      const likeRate = swipesCount ? ((likes / swipesCount) * 100) : 0;

      // Token burns - try blockchain first, fallback to DB
      let totalBurned = 0;
      try {
        const provider = new JsonRpcProvider('https://api.avax.network/ext/bc/C/rpc');
        const erc20Abi = ['function balanceOf(address owner) view returns (uint256)'];
        const tokenContract = new Contract(TOKEN_CONTRACT, erc20Abi, provider);
        const balance = await tokenContract.balanceOf(DEAD_ADDRESS);
        totalBurned = Number(balance) / (10 ** 18);
      } catch (error) {
        const { data: burnsData } = await supabase.from('token_burns').select('amount');
        totalBurned = burnsData?.reduce((sum, burn) => sum + burn.amount, 0) || 0;
      }

      // Process game sessions
      const gameSessionsData = gameSessionsResult.data || [];
      const totalGameTime = gameSessionsData.reduce((sum, s) => sum + (s.play_time_seconds || 0), 0);
      const totalGameRewards = gameSessionsData.filter(s => s.paid).reduce((sum, s) => sum + (s.reward_earned || 0), 0);

      // Process tips
      const tipsData = tipsResult.data || [];
      const totalTipsAmount = tipsData.reduce((sum, tip) => sum + tip.amount, 0);

      // Unique artists
      const uniqueArtists = new Set(artistsResult.data?.map(p => p.placed_by)).size;

      setStats({
        totalUsers: usersResult.count || 0,
        totalSwipes: swipesCount,
        totalMatches: matchesResult.count || 0,
        totalTokensBurned: totalBurned,
        totalLikes: likes,
        totalPasses: passes,
        likeRate,
        totalTips: tipsResult.count || 0,
        totalTipsAmount,
        totalPosts: postsResult.count || 0,
        totalPostLikes: postLikesResult.count || 0,
        totalPostComments: postCommentsResult.count || 0,
        totalGames: gamesResult.count || 0,
        totalGameSessions: gameSessionsResult.count || 0,
        totalGameTime,
        totalGameRewards,
        totalPixels: pixelsResult.count || 0,
        uniqueArtists,
        totalCards: cardsResult.count || 0,
        totalProposals: proposalsResult.count || 0,
        totalVotes: votesResult.count || 0,
        todayDAU: todayActiveResult.count || 0,
        yesterdayDAU: yesterdayActiveResult.count || 0,
        weeklyDAU: weeklyActiveResult.count || 0,
      });
    } catch (error) {
      console.error('Error fetching platform stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboards = async () => {
    try {
      // Parallel fetch all leaderboard data
      const [
        matchCounts,
        swipeCounts,
        swipeReceivedCounts,
        burnCounts,
        tipGivers,
        tipReceivers,
        gameData,
        avloToken,
      ] = await Promise.all([
        supabase.from('matches').select('user1_id, user2_id'),
        supabase.from('swipes').select('swiper_id'),
        supabase.from('swipes').select('swiped_id, direction'),
        supabase.from('token_burns').select('user_id, amount, burn_type')
          .in('burn_type', ['swipe', 'post_text', 'post_image', 'post_video', 'post_like', 'post_boost', 'post_repost', 'post_comment', 'post_create']),
        supabase.from('tips').select('sender_id, amount'),
        supabase.from('tips').select('receiver_id, amount'),
        supabase.from('embedded_game_sessions').select('user_id, reward_earned, paid').eq('paid', true),
        supabase.from('dao_tokens').select('id').eq('token_address', '0xb5B3e63540fD53DCFFD4e65c726a84aA67B24E61').single(),
      ]);

      // Process matches
      const matchCountMap: { [key: string]: number } = {};
      matchCounts.data?.forEach((match) => {
        matchCountMap[match.user1_id] = (matchCountMap[match.user1_id] || 0) + 1;
        matchCountMap[match.user2_id] = (matchCountMap[match.user2_id] || 0) + 1;
      });
      const topMatcherIds = Object.entries(matchCountMap).sort(([, a], [, b]) => b - a).slice(0, 5).map(([id, count]) => ({ id, count }));

      // Process swipes (who swiped the most)
      const swipeCountMap: { [key: string]: number } = {};
      swipeCounts.data?.forEach((swipe) => { swipeCountMap[swipe.swiper_id] = (swipeCountMap[swipe.swiper_id] || 0) + 1; });
      const topSwiperIds = Object.entries(swipeCountMap).sort(([, a], [, b]) => b - a).slice(0, 5).map(([id, count]) => ({ id, count }));

      // Process most liked users (received right swipes)
      const likedCountMap: { [key: string]: number } = {};
      const passedCountMap: { [key: string]: number } = {};
      swipeReceivedCounts.data?.forEach((swipe) => { 
        if (swipe.direction === 'right') {
          likedCountMap[swipe.swiped_id] = (likedCountMap[swipe.swiped_id] || 0) + 1; 
        } else if (swipe.direction === 'left') {
          passedCountMap[swipe.swiped_id] = (passedCountMap[swipe.swiped_id] || 0) + 1; 
        }
      });
      const mostLikedIds = Object.entries(likedCountMap).sort(([, a], [, b]) => b - a).slice(0, 5).map(([id, count]) => ({ id, count }));
      const mostPassedIds = Object.entries(passedCountMap).sort(([, a], [, b]) => b - a).slice(0, 5).map(([id, count]) => ({ id, count }));

      // Process burns
      const burnCountMap: { [key: string]: number } = {};
      burnCounts.data?.forEach((burn) => { burnCountMap[burn.user_id] = (burnCountMap[burn.user_id] || 0) + burn.amount; });
      const topBurnerIds = Object.entries(burnCountMap).sort(([, a], [, b]) => b - a).slice(0, 5).map(([id, count]) => ({ id, count }));

      // Process tip givers
      const giverMap: { [key: string]: number } = {};
      tipGivers.data?.forEach((tip) => { giverMap[tip.sender_id] = (giverMap[tip.sender_id] || 0) + tip.amount; });
      const topGiverIds = Object.entries(giverMap).sort(([, a], [, b]) => b - a).slice(0, 5).map(([id, count]) => ({ id, count }));

      // Process tip receivers
      const receiverMap: { [key: string]: number } = {};
      tipReceivers.data?.forEach((tip) => { receiverMap[tip.receiver_id] = (receiverMap[tip.receiver_id] || 0) + tip.amount; });
      const topReceiverIds = Object.entries(receiverMap).sort(([, a], [, b]) => b - a).slice(0, 5).map(([id, count]) => ({ id, count }));

      // Process gamers
      const gamerMap: { [key: string]: number } = {};
      gameData.data?.forEach((g) => { gamerMap[g.user_id] = (gamerMap[g.user_id] || 0) + (g.reward_earned || 0); });
      const topGamerIds = Object.entries(gamerMap).sort(([, a], [, b]) => b - a).slice(0, 5).map(([id, count]) => ({ id, count }));

      // Get top scores
      const { data: topScores } = await supabase.from('user_scores').select('user_id, total_score').eq('token_id', avloToken?.data?.id).order('total_score', { ascending: false }).limit(5);
      const topScorerIds = topScores?.map(s => ({ id: s.user_id, count: s.total_score })) || [];

      // Get all user profiles
      const allUserIds = [...new Set([
        ...topMatcherIds.map(u => u.id), ...topSwiperIds.map(u => u.id), ...topBurnerIds.map(u => u.id),
        ...topGiverIds.map(u => u.id), ...topReceiverIds.map(u => u.id),
        ...topGamerIds.map(u => u.id), ...topScorerIds.map(u => u.id),
        ...mostLikedIds.map(u => u.id), ...mostPassedIds.map(u => u.id),
      ])];
      
      const { data: profiles } = await supabase.from('profiles').select('id, username, avatar_url').in('id', allUserIds);
      const profileMap = new Map(profiles?.map(p => [p.id, p]));

      const mapToLeaderboard = (ids: { id: string; count: number }[]) =>
        ids.filter(u => profileMap.has(u.id)).map(u => ({ ...profileMap.get(u.id)!, value: u.count }));

      setTopMatchers(mapToLeaderboard(topMatcherIds));
      setTopSwipers(mapToLeaderboard(topSwiperIds));
      setTopBurners(mapToLeaderboard(topBurnerIds));
      setTopGivers(mapToLeaderboard(topGiverIds));
      setTopReceivers(mapToLeaderboard(topReceiverIds));
      setTopGamers(mapToLeaderboard(topGamerIds));
      setTopScorers(mapToLeaderboard(topScorerIds));
      setMostLiked(mapToLeaderboard(mostLikedIds));
      setMostPassed(mapToLeaderboard(mostPassedIds));
    } catch (error) {
      console.error('Error fetching leaderboards:', error);
    }
  };

  const fetchChartData = async () => {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 14);

      const [burnsData, usersData] = await Promise.all([
        supabase.from('token_burns').select('amount, created_at').gte('created_at', startDate.toISOString()).order('created_at', { ascending: true }),
        supabase.from('profiles').select('created_at').gte('created_at', startDate.toISOString()).order('created_at', { ascending: true }),
      ]);

      const burnsByDay: { [key: string]: number } = {};
      burnsData.data?.forEach((burn) => {
        const date = new Date(burn.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        burnsByDay[date] = (burnsByDay[date] || 0) + burn.amount;
      });

      const usersByDay: { [key: string]: number } = {};
      usersData.data?.forEach((user) => {
        const date = new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        usersByDay[date] = (usersByDay[date] || 0) + 1;
      });

      const days: string[] = [];
      for (let i = 13; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        days.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      }

      setBurnChartData(days.map(date => ({ date, value: burnsByDay[date] || 0 })));
      setUserChartData(days.map(date => ({ date, value: usersByDay[date] || 0 })));
    } catch (error) {
      console.error('Error fetching chart data:', error);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="w-5 h-5 text-yellow-400" />;
    if (index === 1) return <Medal className="w-5 h-5 text-gray-300" />;
    if (index === 2) return <Award className="w-5 h-5 text-orange-500" />;
    return <span className="text-xs font-bold text-zinc-500">#{index + 1}</span>;
  };

  const leaderboards = [
    { key: 'scores', label: 'Top Scores', data: topScorers, suffix: 'pts', icon: Star },
    { key: 'mostLiked', label: 'Most Liked', data: mostLiked, suffix: 'likes', icon: Heart, color: 'text-green-400' },
    { key: 'mostPassed', label: 'Most Passed', data: mostPassed, suffix: 'passes', icon: X, color: 'text-red-400' },
    { key: 'matchers', label: 'Top Matchers', data: topMatchers, suffix: 'matches', icon: ThumbsUp },
    { key: 'swipers', label: 'Top Swipers', data: topSwipers, suffix: 'swipes', icon: Activity },
    { key: 'burners', label: 'Top Burners', data: topBurners, suffix: 'AVLO', icon: Flame },
    { key: 'gamers', label: 'Top Gamers', data: topGamers, suffix: 'AVLO', icon: Gamepad2 },
    { key: 'givers', label: 'Top Givers', data: topGivers, suffix: 'AVLO', icon: Gift },
    { key: 'receivers', label: 'Top Receivers', data: topReceivers, suffix: 'AVLO', icon: Gift },
  ];

  const currentLeaderboard = leaderboards.find(l => l.key === activeLeaderboard) || leaderboards[0];

  if (loading) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-black text-white flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-orange-500 animate-pulse" />
          <span className="text-xl font-semibold">Loading Statistics...</span>
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

      {/* Main Layout */}
      <div className="relative z-10 pt-16 md:pt-20 pb-8 px-4 md:px-6 lg:px-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <motion.div
              className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-orange-500 to-orange-600"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <BarChart3 className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </motion.div>
            <span className="text-xl md:text-2xl font-bold tracking-tight">Platform Statistics</span>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex gap-1 p-1 bg-white/5 rounded-lg w-full sm:w-auto overflow-x-auto">
            {[
              { key: 'overview', label: 'Overview', icon: BarChart3 },
              { key: 'leaderboards', label: 'Leaderboards', icon: Trophy },
              { key: 'charts', label: 'Charts', icon: TrendingUp },
              { key: 'bubblemap', label: 'Bubble Map', icon: Share2 },
              { key: 'foundation', label: 'Foundation', icon: Building2 },
              { key: 'agents', label: 'Agents', icon: Bot },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveSection(tab.key as typeof activeSection)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 md:px-4 py-2 text-xs md:text-sm font-medium rounded-md transition-all ${
                  activeSection === tab.key ? 'bg-orange-500/20 text-orange-400' : 'text-gray-400 hover:text-white'
                }`}
              >
                <tab.icon className="w-3 h-3 md:w-4 md:h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.key === 'bubblemap' ? 'Map' : tab.key === 'foundation' ? 'Found.' : tab.label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Bubble Map - Full Width */}
        {activeSection === 'bubblemap' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            key="bubblemap"
          >
            <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
              <div className="p-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-orange-500" />
                  <h2 className="text-lg font-bold text-white">User Network Map</h2>
                </div>
                <p className="text-sm text-zinc-400 mt-1">
                  3D semantic visualization of platform activity. Bubble size = activity level. Colors = dominant activity type. Connections = matches & tips.
                </p>
              </div>
              <Suspense fallback={
                <div className="h-[600px] flex items-center justify-center">
                  <div className="flex items-center gap-3 text-zinc-400">
                    <Share2 className="w-6 h-6 animate-pulse" />
                    <span>Loading network map...</span>
                  </div>
                </div>
              }>
                <BubbleMapNetwork />
              </Suspense>
            </div>
          </motion.div>
        )}

        {/* Foundation - Full Width */}
        {activeSection === 'foundation' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            key="foundation"
          >
            <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
              <div className="p-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-500" />
                  <h2 className="text-lg font-bold text-white">AvaLove Foundation</h2>
                </div>
                <p className="text-sm text-zinc-400 mt-1">
                  Foundation treasury wallet holding tokens for ecosystem development.
                </p>
              </div>
              <div className="p-6">
                {foundationLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="flex items-center gap-3 text-zinc-400">
                      <Wallet className="w-6 h-6 animate-pulse" />
                      <span>Loading balances...</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Total Value Card */}
                    <div className="p-6 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20">
                      <div className="flex items-center gap-3 mb-4">
                        <Building2 className="w-10 h-10 text-emerald-400" />
                        <div>
                          <h3 className="text-lg font-bold text-white">Total Treasury Value</h3>
                          <p className="text-xs text-zinc-400">All tokens combined</p>
                        </div>
                      </div>
                      <div className="text-3xl md:text-4xl font-black text-emerald-400">
                        ${totalFoundationValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </div>
                    </div>

                    {/* AVAX Balance */}
                    {avaxBalance > 0 && (
                      <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <img 
                              src="https://raw.githubusercontent.com/traderjoe-xyz/joe-tokenlists/main/logos/0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7/logo.png" 
                              alt="AVAX" 
                              className="w-8 h-8 rounded-full"
                            />
                            <div>
                              <p className="text-sm font-semibold text-white">AVAX</p>
                              <p className="text-xs text-zinc-500">Avalanche</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-white">
                              {avaxBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                            </p>
                            <p className="text-xs text-zinc-400">
                              ≈ ${avaxUsdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Token Balances */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Token Holdings</h4>
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {foundationBalances.map((item) => (
                          <div 
                            key={item.token.id} 
                            className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {item.token.logo_url ? (
                                  <img 
                                    src={item.token.logo_url} 
                                    alt={item.token.token_symbol} 
                                    className="w-8 h-8 rounded-full"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = avloLogo;
                                    }}
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold text-white">
                                    {item.token.token_symbol.slice(0, 2)}
                                  </div>
                                )}
                                <div>
                                  <p className="text-sm font-semibold text-white">{item.token.token_symbol}</p>
                                  <p className="text-xs text-zinc-500 truncate max-w-[120px]">{item.token.token_name}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-white">
                                  {item.balance.toLocaleString(undefined, { maximumFractionDigits: item.balance < 1 ? 6 : 2 })}
                                </p>
                                {item.usdValue > 0 && (
                                  <p className="text-xs text-zinc-400">
                                    ≈ ${item.usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        {foundationBalances.length === 0 && (
                          <p className="text-sm text-zinc-500 text-center py-4">No token balances found</p>
                        )}
                      </div>
                    </div>

                    {/* Wallet Address */}
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Wallet Address</p>
                          <p className="text-sm font-mono text-zinc-300 break-all">{FOUNDATION_WALLET}</p>
                        </div>
                        <a
                          href={`https://snowtrace.io/address/${FOUNDATION_WALLET}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4 text-zinc-400" />
                        </a>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="text-xs text-zinc-500 text-center">
                      Data fetched directly from Avalanche C-Chain
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Agents Tab */}
        {activeSection === 'agents' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            key="agents"
          >
            <Suspense fallback={
              <div className="flex items-center justify-center py-20">
                <Bot className="w-6 h-6 text-orange-500 animate-pulse mr-2" />
                <span className="text-zinc-400">Loading agents...</span>
              </div>
            }>
              <AgentActivityTab />
            </Suspense>
          </motion.div>
        )}

        {/* Mobile-first grid layout */}
        {activeSection !== 'bubblemap' && activeSection !== 'foundation' && activeSection !== 'agents' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-4">
            {activeSection === 'overview' && (
              <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} key="overview" className="space-y-4">
                <div className="text-xs font-mono text-gray-400 mb-3 flex items-center gap-2">
                  <Sparkles className="w-3 h-3" />
                  REAL-TIME ANALYTICS • AVALANCHE
                </div>
                
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-black leading-[1.1] mb-4">
                  <span className="text-white">Complete Platform</span>
                  <br />
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-pink-500">
                    Overview
                  </span>
                </h1>

                {/* Core Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { icon: Users, label: 'Users', value: stats.totalUsers, color: '#f97316' },
                    { icon: Heart, label: 'Matches', value: stats.totalMatches, color: '#ec4899' },
                    { icon: Activity, label: 'Swipes', value: stats.totalSwipes, color: '#a855f7' },
                    { icon: Flame, label: 'Burned', value: formatNumber(stats.totalTokensBurned), color: '#ef4444' },
                  ].map((stat, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.05 }}
                      className="p-3 rounded-xl bg-white/5 border border-white/10"
                    >
                      <stat.icon className="w-4 h-4 mb-1" style={{ color: stat.color }} />
                      <div className="text-lg font-bold">{stat.value}</div>
                      <div className="text-[10px] text-gray-500 uppercase">{stat.label}</div>
                    </motion.div>
                  ))}
                </div>

                {/* Feature Stats */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Feature Stats</h3>
                  
                  {/* Games */}
                  <div className="p-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-transparent border border-purple-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Gamepad2 className="w-4 h-4 text-purple-400" />
                      <span className="text-sm font-semibold text-purple-400">Games</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div><div className="text-lg font-bold">{stats.totalGames}</div><div className="text-[9px] text-gray-500">Games</div></div>
                      <div><div className="text-lg font-bold">{stats.totalGameSessions}</div><div className="text-[9px] text-gray-500">Sessions</div></div>
                      <div><div className="text-lg font-bold">{formatNumber(stats.totalGameRewards)}</div><div className="text-[9px] text-gray-500">Earned</div></div>
                    </div>
                  </div>

                  {/* Daily Activity */}
                  <div className="p-3 rounded-xl bg-gradient-to-r from-cyan-500/10 to-transparent border border-cyan-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-cyan-400" />
                      <span className="text-sm font-semibold text-cyan-400">Daily Activity</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div><div className="text-lg font-bold">{stats.todayDAU}</div><div className="text-[9px] text-gray-500">Today</div></div>
                      <div><div className="text-lg font-bold">{stats.yesterdayDAU}</div><div className="text-[9px] text-gray-500">Yesterday</div></div>
                      <div><div className="text-lg font-bold">{stats.weeklyDAU}</div><div className="text-[9px] text-gray-500">This Week</div></div>
                    </div>
                  </div>


                  {/* LoveArt */}
                  <div className="p-3 rounded-xl bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Palette className="w-4 h-4 text-orange-400" />
                      <span className="text-sm font-semibold text-orange-400">LoveArt</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div><div className="text-lg font-bold">{stats.totalPixels}</div><div className="text-[9px] text-gray-500">Pixels</div></div>
                      <div><div className="text-lg font-bold">{stats.uniqueArtists}</div><div className="text-[9px] text-gray-500">Artists</div></div>
                      <div><div className="text-lg font-bold">{stats.totalCards}</div><div className="text-[9px] text-gray-500">Cards</div></div>
                    </div>
                  </div>

                  {/* Social */}
                  <div className="p-3 rounded-xl bg-gradient-to-r from-blue-500/10 to-transparent border border-blue-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-semibold text-blue-400">Social</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div><div className="text-lg font-bold">{stats.totalPosts}</div><div className="text-[9px] text-gray-500">Posts</div></div>
                      <div><div className="text-lg font-bold">{stats.totalPostLikes}</div><div className="text-[9px] text-gray-500">Likes</div></div>
                      <div><div className="text-lg font-bold">{stats.totalPostComments}</div><div className="text-[9px] text-gray-500">Comments</div></div>
                      <div><div className="text-lg font-bold">{stats.totalTips}</div><div className="text-[9px] text-gray-500">Tips</div></div>
                    </div>
                  </div>

                  {/* DAO */}
                  <div className="p-3 rounded-xl bg-gradient-to-r from-yellow-500/10 to-transparent border border-yellow-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-4 h-4 text-yellow-400" />
                      <span className="text-sm font-semibold text-yellow-400">DAO</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div><div className="text-lg font-bold">{stats.totalProposals}</div><div className="text-[9px] text-gray-500">Proposals</div></div>
                      <div><div className="text-lg font-bold">{stats.totalVotes}</div><div className="text-[9px] text-gray-500">Votes</div></div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeSection === 'leaderboards' && (
              <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} key="leaderboards" className="space-y-4">
                <h2 className="text-xl md:text-2xl font-bold mb-4">Leaderboards</h2>
                
                {/* Leaderboard Selector */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {leaderboards.map((lb) => (
                    <button
                      key={lb.key}
                      onClick={() => setActiveLeaderboard(lb.key)}
                      className={`px-2 py-1 text-[10px] rounded-lg transition-all flex items-center gap-1 ${
                        activeLeaderboard === lb.key 
                          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' 
                          : 'bg-white/5 text-gray-400 border border-transparent hover:bg-white/10'
                      }`}
                    >
                      <lb.icon className="w-3 h-3" />
                      {lb.label.replace('Top ', '')}
                    </button>
                  ))}
                </div>

                {/* Leaderboard List */}
                <div className="space-y-2">
                  {currentLeaderboard.data.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No data yet</p>
                  ) : (
                    currentLeaderboard.data.map((user, index) => (
                      <motion.div
                        key={user.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-orange-500/30 transition-all flex items-center gap-3"
                      >
                        <div className="w-8 flex items-center justify-center">
                          {getRankIcon(index)}
                        </div>
                        <Avatar className="w-10 h-10 border border-orange-500/30">
                          {user.avatar_url?.match(/\.(mp4|webm)$/i) ? (
                            <video src={user.avatar_url} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                          ) : (
                            <AvatarImage src={user.avatar_url || ''} />
                          )}
                          <AvatarFallback className="bg-gradient-to-br from-orange-500 to-orange-600 text-white text-xs">
                            {user.username.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{user.username}</p>
                          <p className="text-xs text-gray-500">{formatNumber(user.value)} {currentLeaderboard.suffix}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-orange-400">{formatNumber(user.value)}</p>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {activeSection === 'charts' && (
              <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} key="charts" className="space-y-4">
                <h2 className="text-xl md:text-2xl font-bold mb-4">Analytics</h2>
                
                {/* Token Burns Chart */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2 mb-3">
                    <Flame className="w-4 h-4 text-orange-500" />
                    <span className="text-sm font-semibold">Daily Token Burns (14 days)</span>
                  </div>
                  <div className="h-40 md:h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={burnChartData}>
                        <defs>
                          <linearGradient id="burnGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f97316" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis dataKey="date" stroke="#71717a" style={{ fontSize: '10px' }} />
                        <YAxis stroke="#71717a" style={{ fontSize: '10px' }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#18181b', border: '1px solid #f97316', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                          formatter={(value: number) => [value.toLocaleString() + ' AVLO', 'Burned']}
                        />
                        <Area type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2} fill="url(#burnGradient)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* User Growth Chart */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-semibold">Daily New Users (14 days)</span>
                  </div>
                  <div className="h-40 md:h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={userChartData}>
                        <defs>
                          <linearGradient id="userGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis dataKey="date" stroke="#71717a" style={{ fontSize: '10px' }} />
                        <YAxis stroke="#71717a" style={{ fontSize: '10px' }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3b82f6', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                          formatter={(value: number) => [value.toLocaleString(), 'New Users']}
                        />
                        <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fill="url(#userGradient)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Insights */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                    <p className="text-xl md:text-2xl font-bold text-orange-400">{stats.likeRate.toFixed(1)}%</p>
                    <p className="text-[10px] text-gray-500">Like Rate</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                    <p className="text-xl md:text-2xl font-bold text-pink-400">
                      {stats.totalLikes > 0 ? ((stats.totalMatches / stats.totalLikes) * 100).toFixed(1) : 0}%
                    </p>
                    <p className="text-[10px] text-gray-500">Match Rate</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                    <p className="text-xl md:text-2xl font-bold text-purple-400">
                      {stats.totalUsers > 0 ? (stats.totalSwipes / stats.totalUsers).toFixed(1) : 0}
                    </p>
                    <p className="text-[10px] text-gray-500">Avg Swipes/User</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                    <p className="text-xl md:text-2xl font-bold text-cyan-400">{formatTime(stats.totalGameTime)}</p>
                    <p className="text-[10px] text-gray-500">Total Play Time</p>
                  </div>
                </div>
              </motion.div>
            )}

          </div>

          {/* Right Column - Big Numbers */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="space-y-4">
            {/* Total Burned - Hero Stat */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="p-4 md:p-6 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/10 border border-orange-500/30 relative overflow-hidden"
            >
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-orange-500/20 rounded-full blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg">
                    <Flame className="w-5 md:w-6 h-5 md:h-6 text-white" />
                  </div>
                  <span className="text-xs md:text-sm font-semibold text-gray-400">Total Tokens Burned</span>
                </div>
                <p className="text-3xl md:text-4xl lg:text-5xl font-black bg-gradient-to-r from-orange-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
                  {formatNumber(stats.totalTokensBurned)}
                </p>
                <p className="text-xs md:text-sm text-gray-500 mt-1">AVLO sent to dead address</p>
              </div>
            </motion.div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              {/* Total Rewards */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
                className="p-4 md:p-5 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/10 border border-purple-500/30"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Gamepad2 className="w-4 md:w-5 h-4 md:h-5 text-purple-400" />
                  <span className="text-[10px] md:text-xs font-semibold text-gray-400">Game Rewards</span>
                </div>
                <p className="text-xl md:text-2xl lg:text-3xl font-black text-purple-400">{formatNumber(stats.totalGameRewards)}</p>
                <p className="text-[10px] md:text-xs text-gray-500">AVLO earned</p>
              </motion.div>

              {/* Tips */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 }}
                className="p-4 md:p-5 rounded-2xl bg-gradient-to-br from-pink-500/20 to-orange-500/10 border border-pink-500/30"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Gift className="w-4 md:w-5 h-4 md:h-5 text-pink-400" />
                  <span className="text-[10px] md:text-xs font-semibold text-gray-400">Total Tips</span>
                </div>
                <p className="text-xl md:text-2xl lg:text-3xl font-black text-pink-400">{formatNumber(stats.totalTipsAmount)}</p>
                <p className="text-[10px] md:text-xs text-gray-500">AVLO gifted</p>
              </motion.div>
            </div>

            {/* Active Features Grid */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.7 }}
              className="p-4 md:p-5 rounded-2xl bg-white/5 border border-white/10"
            >
              <h3 className="text-sm font-semibold text-gray-400 mb-4">Platform Activity</h3>
              <div className="grid grid-cols-4 gap-2 md:gap-3">
                {[
                  { icon: Heart, label: 'Dating', value: `${stats.totalMatches}`, color: '#ec4899' },
                  { icon: Gamepad2, label: 'Games', value: `${stats.totalGames}`, color: '#a855f7' },
                  { icon: Users, label: 'Active Today', value: `${stats.todayDAU}`, color: '#06b6d4' },
                  { icon: Palette, label: 'LoveArt', value: `${stats.totalPixels}`, color: '#eab308' },
                  { icon: MessageSquare, label: 'Posts', value: `${stats.totalPosts}`, color: '#3b82f6' },
                  { icon: Target, label: 'DAO', value: `${stats.totalProposals}`, color: '#10b981' },
                  { icon: Gift, label: 'Tips', value: `${stats.totalTips}`, color: '#ec4899' },
                ].map((item, i) => (
                  <div key={i} className="text-center p-2 md:p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all">
                    <item.icon className="w-4 md:w-5 h-4 md:h-5 mx-auto mb-1" style={{ color: item.color }} />
                    <p className="text-[10px] md:text-xs font-semibold">{item.label}</p>
                    <p className="text-[9px] md:text-[10px] text-gray-500">{item.value}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* AVLO Token */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8 }}
              className="p-4 rounded-2xl bg-gradient-to-r from-zinc-800/80 to-zinc-900/80 border border-orange-500/20 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <img src={avloLogo} alt="AVLO" className="w-10 md:w-12 h-10 md:h-12 rounded-full border-2 border-orange-500/30" />
                <div>
                  <p className="font-bold text-base md:text-lg">AVLO Token</p>
                  <p className="text-[10px] md:text-xs text-gray-500">Native platform currency</p>
                </div>
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-xs md:text-sm text-gray-400">Deflationary</p>
                <p className="text-orange-400 font-semibold text-xs md:text-sm">Burn on every action</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
        )}
      </div>
    </div>
  );
};

export default Statistics;