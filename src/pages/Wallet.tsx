import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useWalletAuth } from "@/contexts/WalletAuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TokenBalanceDisplay } from "@/components/TokenBalanceDisplay";
import { 
  Copy, Check, Eye, EyeOff, Wallet as WalletIcon, Coins, ArrowRight, 
  TrendingUp, Gift, Sparkles, ExternalLink, Heart, X, Users, 
  Gamepad2, Play, Palette, MessageSquare, Zap, Shield, Activity,
  Clock, Target, Award, ArrowUpRight, ArrowDownLeft, Send, Download
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useAvloBalance } from "@/hooks/useAvloBalance";

interface UserStakingPool {
  pool_id: string;
  pool_title: string;
  stake_token_logo: string | null;
  creator_wallet: string | null;
  net_staked: number;
}

interface SwipedProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  direction: 'left' | 'right';
  created_at: string;
}

interface UserStats {
  totalSwipes: number;
  likesGiven: number;
  passesGiven: number;
  matchCount: number;
  postsCount: number;
  gamesPlayed: number;
  videosWatched: number;
  pixelsPlaced: number;
}

interface PlatformActivity {
  id: string;
  type: 'stake' | 'unstake' | 'claim' | 'tip_sent' | 'tip_received' | 'swipe_gift';
  amount: number;
  token_symbol: string;
  token_logo?: string | null;
  tx_hash: string | null;
  created_at: string;
  details?: string;
  sender_username?: string | null;
  sender_avatar?: string | null;
  receiver_username?: string | null;
  receiver_avatar?: string | null;
}

const Wallet = () => {
  const navigate = useNavigate();
  const { walletAddress, profile } = useWalletAuth();
  const [copied, setCopied] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const [userStakingPools, setUserStakingPools] = useState<UserStakingPool[]>([]);
  const [loadingPools, setLoadingPools] = useState(true);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [swipedProfiles, setSwipedProfiles] = useState<SwipedProfile[]>([]);
  const [loadingSwipes, setLoadingSwipes] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'activity'>('overview');
  const [platformActivities, setPlatformActivities] = useState<PlatformActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [userStats, setUserStats] = useState<UserStats>({
    totalSwipes: 0,
    likesGiven: 0,
    passesGiven: 0,
    matchCount: 0,
    postsCount: 0,
    gamesPlayed: 0,
    videosWatched: 0,
    pixelsPlaced: 0
  });

  const { balance: avloBalance, totalEarned, totalSpent } = useAvloBalance();

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    if (profile?.id) {
      fetchUserStakingPools();
      fetchSwipedProfiles();
      fetchUserStats();
      fetchPlatformActivities();
    } else {
      setLoadingPools(false);
      setLoadingSwipes(false);
      setLoadingActivities(false);
    }
  }, [profile?.id]);

  const fetchPlatformActivities = async () => {
    if (!profile?.id) return;
    setLoadingActivities(true);

    try {
      const activities: PlatformActivity[] = [];

      // Build a token_symbol -> logo_url lookup for consistent logos across tables
      const { data: tokenRows } = await supabase
        .from('custom_payment_tokens')
        .select('token_symbol, logo_url')
        .eq('is_active', true);

      const tokenLogoBySymbol = new Map<string, string>();
      (tokenRows || []).forEach((t: any) => {
        if (t?.token_symbol && t?.logo_url) tokenLogoBySymbol.set(String(t.token_symbol).toUpperCase(), String(t.logo_url));
      });

      const normalizeLogoUrl = (url: string | null | undefined) => {
        if (!url) return null;
        try {
          const u = new URL(url);
          if (u.pathname === '/_next/image') {
            const inner = u.searchParams.get('url');
            if (inner) return decodeURIComponent(inner);
          }
        } catch {
          // ignore invalid URLs
        }
        return url;
      };

      const resolveLogo = (symbol?: string | null, explicit?: string | null) => {
        const sym = (symbol || '').toUpperCase();
        return (
          normalizeLogoUrl(explicit) ||
          normalizeLogoUrl(tokenLogoBySymbol.get(sym) || null) ||
          (sym === 'AVLO' ? '/images/avlo-logo.jpg' : null)
        );
      };

      // Fetch staking transactions (stake, unstake, claim)
      const { data: stakingTxs } = await supabase
        .from('staking_transactions')
        .select('id, transaction_type, amount, token_symbol, tx_hash, created_at')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50);

      (stakingTxs || []).forEach((tx: any) => {
        const txType = String(tx.transaction_type || '').toLowerCase();
        const tokenSymbol = tx.token_symbol || 'AVLO';

        if (['stake', 'deposit'].includes(txType)) {
          activities.push({
            id: tx.id,
            type: 'stake',
            amount: parseFloat(tx.amount) || 0,
            token_symbol: tokenSymbol,
            token_logo: resolveLogo(tokenSymbol, null),
            tx_hash: tx.tx_hash,
            created_at: tx.created_at,
            details: 'Staked tokens'
          });
        } else if (['unstake', 'withdraw'].includes(txType)) {
          activities.push({
            id: tx.id,
            type: 'unstake',
            amount: parseFloat(tx.amount) || 0,
            token_symbol: tokenSymbol,
            token_logo: resolveLogo(tokenSymbol, null),
            tx_hash: tx.tx_hash,
            created_at: tx.created_at,
            details: 'Unstaked tokens'
          });
        } else if (txType === 'claim') {
          activities.push({
            id: tx.id,
            type: 'claim',
            amount: parseFloat(tx.amount) || 0,
            token_symbol: tokenSymbol,
            token_logo: resolveLogo(tokenSymbol, null),
            tx_hash: tx.tx_hash,
            created_at: tx.created_at,
            details: 'Claimed rewards'
          });
        }
      });

      // Fetch tips sent with receiver info
      const { data: tipsSent } = await supabase
        .from('tips')
        .select('id, amount, token_symbol, tx_hash, created_at, context, token_logo_url, receiver:profiles!tips_receiver_id_fkey(username, avatar_url)')
        .eq('sender_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(15);

      (tipsSent || []).forEach((tip: any) => {
        const tokenSymbol = tip.token_symbol || 'AVLO';
        activities.push({
          id: tip.id,
          type: 'tip_sent',
          amount: parseFloat(tip.amount as any) || 0,
          token_symbol: tokenSymbol,
          token_logo: resolveLogo(tokenSymbol, tip.token_logo_url || null),
          tx_hash: tip.tx_hash,
          created_at: tip.created_at,
          details: tip.context || 'Sent tip',
          receiver_username: tip.receiver?.username,
          receiver_avatar: tip.receiver?.avatar_url
        });
      });

      // Fetch tips received with sender info
      const { data: tipsReceived } = await supabase
        .from('tips')
        .select('id, amount, token_symbol, tx_hash, created_at, context, token_logo_url, sender:profiles!tips_sender_id_fkey(username, avatar_url)')
        .eq('receiver_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(15);

      (tipsReceived || []).forEach((tip: any) => {
        const tokenSymbol = tip.token_symbol || 'AVLO';
        activities.push({
          id: `recv-${tip.id}`,
          type: 'tip_received',
          amount: parseFloat(tip.amount as any) || 0,
          token_symbol: tokenSymbol,
          token_logo: resolveLogo(tokenSymbol, tip.token_logo_url || null),
          tx_hash: tip.tx_hash,
          created_at: tip.created_at,
          details: tip.context || 'Received tip',
          sender_username: tip.sender?.username,
          sender_avatar: tip.sender?.avatar_url
        });
      });

      // Fetch right swipes with token info directly from swipes table
      const { data: rightSwipes } = await supabase
        .from('swipes')
        .select(`
          id, direction, amount, token_amount, tx_hash, payment_destination, created_at,
          swiped:profiles!swipes_swiped_id_fkey(username, avatar_url),
          payment_token:custom_payment_tokens!swipes_payment_token_id_fkey(token_symbol, logo_url, decimals)
        `)
        .eq('swiper_id', profile.id)
        .eq('direction', 'right')
        .order('created_at', { ascending: false })
        .limit(30);

      (rightSwipes || []).forEach((swipe: any) => {
        const tokenSymbol = swipe.payment_token?.token_symbol || 'AVLO';
        const tokenLogo = resolveLogo(tokenSymbol, swipe.payment_token?.logo_url || null);
        const destination = swipe.payment_destination || 'burn';

        const rawTokenAmount = swipe.token_amount ?? swipe.amount ?? 0;
        const parsed = parseFloat(rawTokenAmount as any) || 0;
        const decimals = typeof swipe.payment_token?.decimals === 'number' ? swipe.payment_token.decimals : null;

        // Heuristic: if token_amount looks like a raw on-chain integer, scale by decimals.
        // (For most records in this app, token_amount is already human-readable.)
        const displayAmount =
          decimals != null && String(rawTokenAmount).length > 12
            ? parsed / Math.pow(10, decimals)
            : parsed;

        let details = 'Right swipe';
        if (destination === 'burn') {
          details = `Burned for @${swipe.swiped?.username || 'user'}`;
        } else if (destination === 'team') {
          details = `Sent to team for @${swipe.swiped?.username || 'user'}`;
        } else if (destination === 'tip') {
          details = `Tipped @${swipe.swiped?.username || 'user'}`;
        }

        activities.push({
          id: `swipe-${swipe.id}`,
          type: 'swipe_gift',
          amount: Number.isFinite(displayAmount) ? displayAmount : 0,
          token_symbol: tokenSymbol,
          token_logo: tokenLogo,
          tx_hash: swipe.tx_hash,
          created_at: swipe.created_at,
          details,
          receiver_username: swipe.swiped?.username,
          receiver_avatar: swipe.swiped?.avatar_url
        });
      });

      // Sort all activities by date
      activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Prevent the feed from being dominated by one type (e.g. swipes are often all 1,000)
      const caps: Record<PlatformActivity['type'], number> = {
        stake: 6,
        unstake: 6,
        claim: 6,
        tip_sent: 8,
        tip_received: 8,
        swipe_gift: 10,
      };

      const counts: Partial<Record<PlatformActivity['type'], number>> = {};
      const mixed: PlatformActivity[] = [];
      for (const a of activities) {
        const cap = caps[a.type] ?? 8;
        const current = counts[a.type] ?? 0;
        if (current >= cap) continue;
        mixed.push(a);
        counts[a.type] = current + 1;
        if (mixed.length >= 25) break;
      }

      setPlatformActivities(mixed);
    } catch (error) {
      console.error('Error fetching platform activities:', error);
    } finally {
      setLoadingActivities(false);
    }
  };

  const fetchUserStats = async () => {
    if (!profile?.id) return;

    try {
      const [swipesRes, matchesRes, postsRes, gamesRes, videosRes] = await Promise.all([
        supabase.from('swipes').select('direction').eq('swiper_id', profile.id),
        supabase.from('matches').select('id').or(`user1_id.eq.${profile.id},user2_id.eq.${profile.id}`),
        supabase.from('posts').select('id').eq('user_id', profile.id),
        supabase.from('embedded_game_sessions').select('id').eq('user_id', profile.id),
        supabase.from('watch_video_views').select('id').eq('user_id', profile.id)
      ]);

      const swipes = swipesRes.data || [];
      setUserStats({
        totalSwipes: swipes.length,
        likesGiven: swipes.filter(s => s.direction === 'right').length,
        passesGiven: swipes.filter(s => s.direction === 'left').length,
        matchCount: matchesRes.data?.length || 0,
        postsCount: postsRes.data?.length || 0,
        gamesPlayed: gamesRes.data?.length || 0,
        videosWatched: videosRes.data?.length || 0,
        pixelsPlaced: 0
      });
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  const fetchSwipedProfiles = async () => {
    if (!profile?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('swipes')
        .select(`
          id, direction, created_at,
          swiped:profiles!swipes_swiped_id_fkey(id, username, avatar_url)
        `)
        .eq('swiper_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const profiles: SwipedProfile[] = (data || []).map((swipe: any) => ({
        id: swipe.swiped?.id || '',
        username: swipe.swiped?.username || 'Unknown',
        avatar_url: swipe.swiped?.avatar_url,
        direction: swipe.direction,
        created_at: swipe.created_at
      })).filter((p: SwipedProfile) => p.id);

      setSwipedProfiles(profiles);
    } catch (error) {
      console.error('Error fetching swiped profiles:', error);
    } finally {
      setLoadingSwipes(false);
    }
  };

  const fetchUserStakingPools = async () => {
    if (!profile?.id) return;
    
    try {
      const { data: transactions, error: txError } = await supabase
        .from('staking_transactions')
        .select('amount, transaction_type, pool_id')
        .eq('user_id', profile.id)
        .not('pool_id', 'is', null);

      if (txError) throw txError;

      if (!transactions || transactions.length === 0) {
        setUserStakingPools([]);
        setLoadingPools(false);
        return;
      }

      const poolIds = [...new Set(transactions.map(t => t.pool_id).filter(Boolean))] as string[];
      
      if (poolIds.length === 0) {
        setUserStakingPools([]);
        setLoadingPools(false);
        return;
      }

      const { data: pools, error: poolError } = await supabase
        .from('staking_pools')
        .select('id, title, stake_token_logo, creator_wallet')
        .in('id', poolIds);

      if (poolError) throw poolError;

      const poolStakes = new Map<string, number>();
      transactions.forEach(tx => {
        if (!tx.pool_id) return;
        const current = poolStakes.get(tx.pool_id) || 0;
        const amount = parseFloat(tx.amount) || 0;
        if (tx.transaction_type === 'stake' || tx.transaction_type === 'deposit') {
          poolStakes.set(tx.pool_id, current + amount);
        } else if (tx.transaction_type === 'unstake' || tx.transaction_type === 'withdraw') {
          poolStakes.set(tx.pool_id, current - amount);
        }
      });

      const userPools: UserStakingPool[] = [];
      pools?.forEach(pool => {
        const netStaked = poolStakes.get(pool.id) || 0;
        if (netStaked > 0) {
          userPools.push({
            pool_id: pool.id,
            pool_title: pool.title,
            stake_token_logo: pool.stake_token_logo,
            creator_wallet: pool.creator_wallet,
            net_staked: netStaked
          });
        }
      });

      setUserStakingPools(userPools);
    } catch (error) {
      console.error('Error fetching user staking pools:', error);
    } finally {
      setLoadingPools(false);
    }
  };

  const copyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      toast.success("Wallet address copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatAddress = (address: string) => {
    if (!address) return "Not connected";
    if (showFull) return address;
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  const isVideoUrl = (url: string | null) => {
    if (!url) return false;
    return url.match(/\.(mp4|webm|ogg)$/i);
  };

  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const likedProfiles = swipedProfiles.filter(p => p.direction === 'right');
  const passedProfiles = swipedProfiles.filter(p => p.direction === 'left');

  const activityStats = [
    { icon: Heart, value: userStats.likesGiven, label: "Likes Given", color: "#22c55e" },
    { icon: X, value: userStats.passesGiven, label: "Passes", color: "#ef4444" },
    { icon: Users, value: userStats.matchCount, label: "Matches", color: "#ec4899" },
    { icon: MessageSquare, value: userStats.postsCount, label: "Posts", color: "#a855f7" },
    { icon: Gamepad2, value: userStats.gamesPlayed, label: "Games", color: "#f97316" },
    { icon: Play, value: userStats.videosWatched, label: "Videos", color: "#06b6d4" },
    { icon: Palette, value: userStats.pixelsPlaced, label: "Pixels", color: "#eab308" },
  ];

  return (
    <div className="min-h-screen bg-black pt-20 pb-8 px-4 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage: `
              linear-gradient(rgba(168, 85, 247, 0.15) 1px, transparent 1px),
              linear-gradient(90deg, rgba(168, 85, 247, 0.15) 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px',
          }}
        />
        
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full blur-[120px] opacity-20"
          style={{
            background: `radial-gradient(circle, #a855f7, transparent 70%)`,
            left: mousePosition.x - 250,
            top: mousePosition.y - 250,
          }}
        />
        
        <motion.div
          className="absolute top-20 right-0 w-[400px] h-[400px] rounded-full blur-[100px]"
          animate={{
            background: [
              "radial-gradient(circle, rgba(236, 72, 153, 0.25), transparent 70%)",
              "radial-gradient(circle, rgba(168, 85, 247, 0.25), transparent 70%)",
              "radial-gradient(circle, rgba(236, 72, 153, 0.25), transparent 70%)",
            ],
          }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        
        <motion.div
          className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full blur-[80px]"
          animate={{
            background: [
              "radial-gradient(circle, rgba(249, 115, 22, 0.25), transparent 70%)",
              "radial-gradient(circle, rgba(234, 179, 8, 0.25), transparent 70%)",
              "radial-gradient(circle, rgba(249, 115, 22, 0.25), transparent 70%)",
            ],
          }}
          transition={{ duration: 6, repeat: Infinity }}
        />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header with Tabs */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6"
        >
          <div className="flex items-center gap-4">
            <motion.div 
              className="p-2 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 rounded-2xl shadow-lg shadow-purple-500/30 overflow-hidden"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              <img src="/images/avlo-logo.jpg" alt="AVLO" className="w-10 h-10 rounded-xl" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            </motion.div>
            <div>
              <h1 className="text-3xl font-black bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
                Your Wallet
              </h1>
              <p className="text-white/50 text-sm flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                AvaLove Dashboard
              </p>
            </div>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex gap-1 p-1 bg-white/5 rounded-xl border border-white/10">
            {(['overview', 'activity'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all capitalize ${
                  activeTab === tab 
                    ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-white border border-purple-500/30' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-4"
            >
              {/* Wallet Address Card */}
              <div className="lg:col-span-2">
                <Card className="p-5 bg-white/5 backdrop-blur-xl border-white/10 h-full">
                  <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-purple-500/20">
                      <WalletIcon className="w-4 h-4 text-purple-400" />
                    </div>
                    Wallet Address
                  </h2>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <code className="flex-1 text-sm bg-black/50 px-4 py-3 rounded-xl border border-white/10 text-white font-mono break-all">
                      {formatAddress(walletAddress || "")}
                    </code>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowFull(!showFull)}
                        className="bg-white/5 border-white/10 hover:bg-white/10 text-white"
                      >
                        {showFull ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyAddress}
                        disabled={!walletAddress}
                        className="bg-white/5 border-white/10 hover:bg-white/10 text-white"
                      >
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`https://snowtrace.io/address/${walletAddress}`, '_blank')}
                        disabled={!walletAddress}
                        className="bg-white/5 border-white/10 hover:bg-white/10 text-white"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* AVLO Credit Stats */}
                  <div className="mt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Coins className="w-4 h-4 text-orange-400" />
                      <span className="text-sm font-medium text-orange-400">AVLO Credit</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                        <TrendingUp className="w-4 h-4 text-green-400 mb-1" />
                        <div className="text-lg font-bold text-green-400">{totalEarned.toLocaleString()}</div>
                        <div className="text-[10px] text-green-400/70 uppercase">Credit Earned</div>
                      </div>
                      <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                        <Zap className="w-4 h-4 text-red-400 mb-1" />
                        <div className="text-lg font-bold text-red-400">{totalSpent.toLocaleString()}</div>
                        <div className="text-[10px] text-red-400/70 uppercase">Credit Spent</div>
                      </div>
                      <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
                        <Coins className="w-4 h-4 text-orange-400 mb-1" />
                        <div className="text-lg font-bold text-orange-400">{avloBalance.toLocaleString()}</div>
                        <div className="text-[10px] text-orange-400/70 uppercase">Credit Balance</div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Token Balances */}
              <Card className="p-5 bg-white/5 backdrop-blur-xl border-white/10">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-gradient-to-r from-orange-500/20 to-pink-500/20">
                    <Gift className="w-4 h-4 text-orange-400" />
                  </div>
                  Token Balances
                </h2>
                <TokenBalanceDisplay compact />
              </Card>

              {/* Activity Stats */}
              <div className="lg:col-span-3">
                <Card className="p-5 bg-white/5 backdrop-blur-xl border-white/10">
                  <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-cyan-500/20">
                      <Activity className="w-4 h-4 text-cyan-400" />
                    </div>
                    Platform Activity
                  </h2>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-3">
                    {activityStats.map((stat, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className="p-3 rounded-xl bg-white/5 border border-white/10 text-center hover:border-white/20 transition-all cursor-pointer group"
                      >
                        <stat.icon 
                          className="w-5 h-5 mx-auto mb-2 group-hover:scale-110 transition-transform" 
                          style={{ color: stat.color }} 
                        />
                        <div className="text-xl font-bold text-white">{stat.value}</div>
                        <div className="text-[9px] text-gray-400 uppercase tracking-wide">{stat.label}</div>
                      </motion.div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Staking Pools */}
              <div className="lg:col-span-3">
                <Card className="p-5 bg-white/5 backdrop-blur-xl border-white/10">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-orange-500/20">
                        <Coins className="w-4 h-4 text-orange-400" />
                      </div>
                      Staking Positions
                    </h2>
                    <Button
                      onClick={() => navigate('/staking')}
                      variant="outline"
                      size="sm"
                      className="bg-gradient-to-r from-orange-500/10 to-pink-500/10 border-orange-500/30 hover:border-orange-500/50 text-orange-400"
                    >
                      <TrendingUp className="w-4 h-4 mr-2" />
                      View All
                    </Button>
                  </div>

                  {loadingPools ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-24 bg-white/5 rounded-xl animate-pulse" />
                      ))}
                    </div>
                  ) : userStakingPools.length === 0 ? (
                    <div className="text-center py-6">
                      <Coins className="w-10 h-10 text-white/20 mx-auto mb-2" />
                      <p className="text-white/40 text-sm mb-3">No active staking positions</p>
                      <Button
                        onClick={() => navigate('/staking')}
                        size="sm"
                        className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600"
                      >
                        Start Staking
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {userStakingPools.slice(0, 4).map((pool, i) => (
                        <motion.div
                          key={pool.pool_id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 * i }}
                          className="bg-black/30 border border-white/10 rounded-xl p-3 hover:border-orange-500/30 transition-all cursor-pointer group"
                          onClick={() => navigate(`/staking?pool=${pool.pool_id}`)}
                        >
                          <Avatar className="w-10 h-10 border-2 border-orange-500/30 mx-auto mb-2">
                            {pool.stake_token_logo ? (
                              isVideoUrl(pool.stake_token_logo) ? (
                                <video
                                  src={pool.stake_token_logo}
                                  className="w-full h-full object-cover"
                                  autoPlay loop muted playsInline
                                />
                              ) : (
                                <AvatarImage src={pool.stake_token_logo} />
                              )
                            ) : (
                              <AvatarFallback className="bg-gradient-to-r from-orange-500 to-pink-500 text-white text-xs">
                                {pool.pool_title?.[0] || 'S'}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div className="text-center">
                            <span className="font-medium text-white text-xs truncate block">
                              {pool.pool_title}
                            </span>
                            <span className="text-[10px] text-green-400 font-medium">
                              {pool.net_staked.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </motion.div>
          )}


          {activeTab === 'activity' && (
            <motion.div
              key="activity"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              {/* Platform Transactions - Sexy Tech Style */}
              <Card className="p-0 bg-gradient-to-br from-zinc-900/80 via-black/90 to-zinc-900/80 backdrop-blur-xl border border-white/5 overflow-hidden relative">
                {/* Glowing header accent */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-16 bg-purple-500/20 blur-3xl" />
                
                <div className="p-5 border-b border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/20">
                          <Activity className="w-5 h-5 text-purple-400" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500 border-2 border-black animate-pulse" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                          Activity Feed
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium border border-purple-500/20">
                            LIVE
                          </span>
                        </h2>
                        <p className="text-xs text-white/40">On-chain transactions & platform activity</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-white/50">Total Txns</div>
                      <div className="text-lg font-bold text-white">{platformActivities.length}</div>
                    </div>
                  </div>
                </div>

                {loadingActivities ? (
                  <div className="p-5 space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 bg-white/[0.02] rounded-2xl animate-pulse border border-white/5">
                        <div className="w-12 h-12 rounded-xl bg-white/5" />
                        <div className="flex-1 space-y-2">
                          <div className="w-32 h-4 bg-white/5 rounded-lg" />
                          <div className="w-48 h-3 bg-white/5 rounded" />
                        </div>
                        <div className="w-20 h-8 bg-white/5 rounded-lg" />
                      </div>
                    ))}
                  </div>
                ) : platformActivities.length === 0 ? (
                  <div className="text-center py-16 px-6">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/10 flex items-center justify-center">
                      <Activity className="w-10 h-10 text-white/20" />
                    </div>
                    <p className="text-white/50 font-medium">No transactions yet</p>
                    <p className="text-white/30 text-sm mt-1">Start staking, tipping, or swiping to see activity</p>
                  </div>
                ) : (
                  <div className="p-4 space-y-2 max-h-[600px] overflow-y-auto scrollbar-hide">
                    {platformActivities.map((activity, i) => {
                      const getActivityConfig = () => {
                        switch (activity.type) {
                          case 'stake':
                            return { 
                              icon: ArrowUpRight, 
                              color: 'text-emerald-400', 
                              bgGradient: 'from-emerald-500/20 to-green-500/10',
                              borderColor: 'border-emerald-500/20',
                              glowColor: 'shadow-emerald-500/10',
                              label: 'Staked',
                              verb: 'Locked tokens in pool'
                            };
                          case 'unstake':
                            return { 
                              icon: ArrowDownLeft, 
                              color: 'text-orange-400', 
                              bgGradient: 'from-orange-500/20 to-amber-500/10',
                              borderColor: 'border-orange-500/20',
                              glowColor: 'shadow-orange-500/10',
                              label: 'Unstaked',
                              verb: 'Withdrew from pool'
                            };
                          case 'claim':
                            return { 
                              icon: Download, 
                              color: 'text-cyan-400', 
                              bgGradient: 'from-cyan-500/20 to-blue-500/10',
                              borderColor: 'border-cyan-500/20',
                              glowColor: 'shadow-cyan-500/10',
                              label: 'Claimed',
                              verb: 'Harvested rewards'
                            };
                          case 'tip_sent':
                            return { 
                              icon: Send, 
                              color: 'text-pink-400', 
                              bgGradient: 'from-pink-500/20 to-rose-500/10',
                              borderColor: 'border-pink-500/20',
                              glowColor: 'shadow-pink-500/10',
                              label: 'Sent Tip',
                              verb: 'Tipped a creator'
                            };
                          case 'tip_received':
                            return { 
                              icon: Gift, 
                              color: 'text-purple-400', 
                              bgGradient: 'from-purple-500/20 to-violet-500/10',
                              borderColor: 'border-purple-500/20',
                              glowColor: 'shadow-purple-500/10',
                              label: 'Received Tip',
                              verb: 'Someone tipped you!'
                            };
                          case 'swipe_gift':
                            return { 
                              icon: Heart, 
                              color: 'text-red-400', 
                              bgGradient: 'from-red-500/20 to-rose-500/10',
                              borderColor: 'border-red-500/20',
                              glowColor: 'shadow-red-500/10',
                              label: 'Love Gift',
                              verb: 'Right swipe payment'
                            };
                          default:
                            return { 
                              icon: Activity, 
                              color: 'text-gray-400', 
                              bgGradient: 'from-gray-500/20 to-zinc-500/10',
                              borderColor: 'border-gray-500/20',
                              glowColor: 'shadow-gray-500/10',
                              label: 'Transaction',
                              verb: 'Blockchain transaction'
                            };
                        }
                      };

                      const config = getActivityConfig();
                      const ActivityIcon = config.icon;
                      const date = new Date(activity.created_at);
                      const timeAgo = getTimeAgo(date);
                      const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      const formattedTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

                      const userAvatar = activity.type === 'tip_sent' ? activity.receiver_avatar : activity.sender_avatar;
                      const username = activity.type === 'tip_sent' ? activity.receiver_username : activity.sender_username;
                      
                      const isIncoming = activity.type === 'tip_received' || activity.type === 'claim';
                      
                      return (
                        <motion.div
                          key={activity.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04, type: 'spring', stiffness: 200 }}
                          className={`relative group p-4 rounded-2xl bg-gradient-to-r ${config.bgGradient} border ${config.borderColor} hover:border-white/20 transition-all duration-300 hover:shadow-lg ${config.glowColor}`}
                        >
                          {/* Left accent line */}
                          <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-full bg-gradient-to-b ${config.bgGradient.replace('/20', '/50').replace('/10', '/30')}`} />
                          
                          <div className="flex items-start gap-4 pl-3">
                            {/* Icon or Avatar */}
                            <div className="relative flex-shrink-0">
                              {userAvatar ? (
                                <Avatar className="w-12 h-12 border-2 border-white/10 shadow-lg">
                                  <AvatarImage src={userAvatar} className="object-cover" />
                                  <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-sm font-bold">
                                    {username?.[0]?.toUpperCase() || '?'}
                                  </AvatarFallback>
                                </Avatar>
                              ) : (
                                <div className={`p-3 rounded-xl bg-gradient-to-br ${config.bgGradient} border ${config.borderColor} shadow-lg`}>
                                  <ActivityIcon className={`w-6 h-6 ${config.color}`} />
                                </div>
                              )}
                              {/* Token logo overlay */}
                              {activity.token_logo && (
                                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-black overflow-hidden shadow-md">
                                  <img src={activity.token_logo} alt={activity.token_symbol} className="w-full h-full object-cover" />
                                </div>
                              )}
                            </div>
                            
                            {/* Main Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`font-bold text-sm ${config.color}`}>
                                  {config.label}
                                </span>
                                {username && (
                                  <span className="text-xs text-white/60 bg-white/5 px-2 py-0.5 rounded-full">
                                    {activity.type === 'tip_sent' ? '→' : '←'} @{username}
                                  </span>
                                )}
                              </div>
                              
                              <p className="text-xs text-white/40 mt-0.5">{config.verb}</p>
                              
                              {/* TX Hash Row */}
                              {activity.tx_hash && (
                                <div className="mt-2 flex items-center gap-2">
                                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/30 border border-white/5 group/hash">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-[10px] font-mono text-white/50">
                                      {activity.tx_hash.slice(0, 8)}...{activity.tx_hash.slice(-6)}
                                    </span>
                                    <button
                                      onClick={() => window.open(`https://snowtrace.io/tx/${activity.tx_hash}`, '_blank')}
                                      className="ml-1 p-0.5 rounded hover:bg-white/10 transition-colors"
                                      title="View on Snowtrace"
                                    >
                                      <ExternalLink className="w-3 h-3 text-white/40 hover:text-purple-400 transition-colors" />
                                    </button>
                                  </div>
                                  <span className="text-[10px] text-white/30">{formattedTime}</span>
                                </div>
                              )}
                            </div>
                            
                            {/* Amount & Time */}
                            <div className="flex flex-col items-end gap-1">
                              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${isIncoming ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-white/5 border border-white/5'}`}>
                                {!activity.token_logo && (
                                  <div className="w-5 h-5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-[8px] text-white font-bold shadow-sm">
                                    {activity.token_symbol?.[0] || '$'}
                                  </div>
                                )}
                                {activity.token_logo && (
                                  <img src={activity.token_logo} alt={activity.token_symbol} className="w-5 h-5 rounded-full" />
                                )}
                                <div className="text-right">
                                  <div className={`font-bold text-sm ${isIncoming ? 'text-emerald-400' : 'text-white'}`}>
                                    {isIncoming ? '+' : ''}{activity.amount.toLocaleString()}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-white/30">
                                <Clock className="w-3 h-3" />
                                <span>{timeAgo}</span>
                              </div>
                              <span className="text-[9px] text-white/20">{formattedDate}</span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
                
                {/* Bottom gradient fade */}
                <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Wallet;