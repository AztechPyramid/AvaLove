import { useState, useEffect, useContext } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Trophy, Medal, Award, Gift, Copy, Check, 
  Lightbulb, Clock, Coins, RefreshCw, Gamepad2, CreditCard, Flame, Zap, Sparkles,
  ChevronDown, ChevronUp, Heart, Building2, Info, TrendingUp
} from 'lucide-react';
import { WalletAuthContext } from '@/contexts/WalletAuthContext';
import { TipDialog } from '@/components/TipDialog';
import { toast } from 'sonner';
import { useScorePoints } from '@/hooks/useScorePoints';
import { AnimatedAvatar } from '@/components/AnimatedAvatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScoreBreakdownAccordion } from '@/components/ScoreBreakdownAccordion';
import { ScoreDecayInfoCard } from '@/components/ScoreDecayInfoCard';
import { CreditDecayInfoCard } from '@/components/CreditDecayInfoCard';
interface LeaderboardUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  wallet_address: string | null;
  remaining_reviews: number;
  swipe_count: number;
  match_count: number;
  message_count: number;
  tip_count: number;
  stake_count: number;
  burn_count: number;
  text_post_count: number;
  image_post_count: number;
  video_post_count: number;
  gif_post_count: number;
  like_count: number;
  comment_count: number;
  qualified_referrals: number;
  current_streak: number;
  rank: number;
  total_score: number;
}

const Airdrop = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<LeaderboardUser | null>(null);
  const [showTipDialog, setShowTipDialog] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isBurnInfoOpen, setIsBurnInfoOpen] = useState(false);
  const [isPointSystemOpen, setIsPointSystemOpen] = useState(false);
  const [isSwipeSystemOpen, setIsSwipeSystemOpen] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const USERS_PER_PAGE = 25;
  const walletAuth = useContext(WalletAuthContext);
  const { points } = useScorePoints();

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  // Poll score every 60s instead of realtime
  useEffect(() => {
    if (!walletAuth?.profile?.id) return;
    const interval = setInterval(fetchLeaderboard, 60000);
    return () => clearInterval(interval);
  }, [walletAuth?.profile?.id]);

  useEffect(() => {
    // Reset to page 1 when leaderboard changes
    setCurrentPage(1);
  }, [leaderboard.length]);

  const fetchLeaderboard = async () => {
    try {
      // Fetch all users with their profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, wallet_address, remaining_reviews')
        .order('username', { ascending: true });

      if (profilesError) throw profilesError;

      if (!profiles || profiles.length === 0) {
        setLeaderboard([]);
        setLoading(false);
        return;
      }

      // Get cached AVLO token ID
      const { getAvloTokenId } = await import('@/lib/avloTokenCache');
      const avloTokenId = await getAvloTokenId();
      const avloToken = avloTokenId ? { id: avloTokenId } : null;

      // Fetch user_scores table which has the calculated scores from database (AVLO only)
      // Order by total_score DESC to handle any duplicate entries - keep the highest
      const { data: userScores, error: scoresError } = await supabase
        .from('user_scores')
        .select('user_id, total_score, swipe_count, match_count, message_count, stake_count, burn_count')
        .eq('token_id', avloToken?.id)
        .order('total_score', { ascending: false });

      if (scoresError) throw scoresError;

      // Fetch additional data for display
      const [postsData, commentsData, referralsData, streaksData] = await Promise.all([
        supabase.from('posts').select('user_id, media_type'),
        supabase.from('post_comments').select('user_id, id'),
        supabase.from('referrals').select('referrer_id, qualified'),
        supabase.from('user_streaks').select('user_id, current_streak'),
      ]);

      // Use Map to deduplicate - first occurrence (highest score due to ordering) wins
      const scoresByUser = new Map<string, any>();
      userScores?.forEach(score => {
        if (!scoresByUser.has(score.user_id)) {
          scoresByUser.set(score.user_id, score);
        }
      });

      const textPostsByUser = new Map<string, number>();
      const imagePostsByUser = new Map<string, number>();
      const videoPostsByUser = new Map<string, number>();
      const gifPostsByUser = new Map<string, number>();
      
      postsData.data?.forEach(post => {
        if (!post.media_type || post.media_type === 'text') {
          textPostsByUser.set(post.user_id, (textPostsByUser.get(post.user_id) || 0) + 1);
        } else if (post.media_type === 'image') {
          imagePostsByUser.set(post.user_id, (imagePostsByUser.get(post.user_id) || 0) + 1);
        } else if (post.media_type === 'video') {
          videoPostsByUser.set(post.user_id, (videoPostsByUser.get(post.user_id) || 0) + 1);
        } else if (post.media_type === 'gif') {
          gifPostsByUser.set(post.user_id, (gifPostsByUser.get(post.user_id) || 0) + 1);
        }
      });

      const commentsByUser = new Map<string, number>();
      commentsData.data?.forEach(comment => {
        commentsByUser.set(comment.user_id, (commentsByUser.get(comment.user_id) || 0) + 1);
      });

      const referralsByUser = new Map<string, number>();
      referralsData.data?.forEach(referral => {
        if (referral.qualified) {
          referralsByUser.set(referral.referrer_id, (referralsByUser.get(referral.referrer_id) || 0) + 1);
        }
      });

      const streaksByUser = new Map<string, number>();
      streaksData.data?.forEach(streak => {
        streaksByUser.set(streak.user_id, streak.current_streak || 0);
      });

      // Build user data with scores from user_scores table
      const usersWithScores = profiles.map(profile => {
        const userScore = scoresByUser.get(profile.id);
        
        return {
          id: profile.id,
          username: profile.username,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          wallet_address: profile.wallet_address,
          remaining_reviews: profile.remaining_reviews || 0,
          swipe_count: userScore?.swipe_count || 0,
          match_count: userScore?.match_count || 0,
          message_count: userScore?.message_count || 0,
          tip_count: 0,
          stake_count: userScore?.stake_count || 0,
          burn_count: userScore?.burn_count || 0,
          text_post_count: textPostsByUser.get(profile.id) || 0,
          image_post_count: imagePostsByUser.get(profile.id) || 0,
          video_post_count: videoPostsByUser.get(profile.id) || 0,
          gif_post_count: gifPostsByUser.get(profile.id) || 0,
          like_count: 0,
          comment_count: commentsByUser.get(profile.id) || 0,
          qualified_referrals: referralsByUser.get(profile.id) || 0,
          current_streak: streaksByUser.get(profile.id) || 0,
          rank: 0,
          total_score: userScore?.total_score || 0
        };
      });

      // Sort by score and assign ranks
      usersWithScores.sort((a, b) => b.total_score - a.total_score);
      usersWithScores.forEach((user, index) => {
        user.rank = index + 1;
      });

      setLeaderboard(usersWithScores);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      toast.error('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-8 h-8 text-yellow-400" />;
      case 2:
        return <Medal className="w-8 h-8 text-gray-300" />;
      case 3:
        return <Award className="w-8 h-8 text-amber-600" />;
      default:
        return (
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <span className="text-foreground text-lg font-bold">#{rank}</span>
          </div>
        );
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { label: '👑 Champion', variant: 'default' as const, className: 'bg-yellow-500' };
    if (rank === 2) return { label: '🥈 Elite', variant: 'secondary' as const, className: 'bg-gray-400' };
    if (rank === 3) return { label: '🥉 Master', variant: 'secondary' as const, className: 'bg-amber-600' };
    if (rank <= 10) return { label: '⭐ Top 10', variant: 'outline' as const, className: '' };
    if (rank <= 50) return { label: '🌟 Top 50', variant: 'outline' as const, className: '' };
    return { label: '💎 Active', variant: 'outline' as const, className: '' };
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    toast.success('Wallet address copied!');
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const formatAddress = (address: string) => {
    if (!address) return 'N/A';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleTip = (user: LeaderboardUser) => {
    setSelectedUser(user);
    setShowTipDialog(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-xl text-white font-semibold">Loading airdrop leaderboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pt-24 pb-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Why Burn Explanation Card - Collapsible */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Collapsible open={isBurnInfoOpen} onOpenChange={setIsBurnInfoOpen}>
            <Card className="bg-black/80 backdrop-blur-xl border border-purple-500/30 shadow-2xl shadow-purple-500/20 relative overflow-hidden">
              <CollapsibleTrigger asChild>
                <button className="w-full p-6 sm:p-8 flex items-center justify-between hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-4">
                    <motion.div 
                      className="p-3 bg-gradient-to-br from-orange-500 to-pink-500 rounded-2xl shadow-lg shadow-orange-500/30"
                      animate={{ rotate: [0, 5, -5, 0] }}
                      transition={{ duration: 3, repeat: Infinity }}
                    >
                      <Lightbulb className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                    </motion.div>
                    <div className="text-left">
                      <h2 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-orange-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                        How Does the Score System Work?
                      </h2>
                      <p className="text-white/50 text-sm flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Click to learn about the ecosystem
                      </p>
                    </div>
                  </div>
                  {isBurnInfoOpen ? (
                    <ChevronUp className="w-6 h-6 text-white/50" />
                  ) : (
                    <ChevronDown className="w-6 h-6 text-white/50" />
                  )}
                </button>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="px-6 sm:px-8 pb-6 sm:pb-8">
                  {/* Animated Background */}
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div 
                      className="absolute inset-0 opacity-10"
                      style={{
                        backgroundImage: `
                          linear-gradient(rgba(168, 85, 247, 0.2) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(168, 85, 247, 0.2) 1px, transparent 1px)
                        `,
                        backgroundSize: '40px 40px',
                      }}
                    />
                  </div>
                  
                  <p className="text-gray-300 leading-relaxed mb-6 relative z-10">
                    Every action you take on the platform earns you <span className="text-orange-400 font-semibold">Score Points</span>. 
                    These points directly translate to <span className="text-green-400 font-semibold">earning minutes</span> – 
                    the more you engage, the more time you unlock to earn AVLO tokens daily.
                    <span className="text-pink-400 font-semibold"> In Discover, your tokens go directly to the people you like as gifts!</span>
                  </p>
                  
                  {/* Feature Cards Grid */}
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
                    {/* Score = Earning Time */}
                    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 hover:border-orange-500/50 transition-all duration-300 h-full">
                      <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center mb-4">
                        <Clock className="w-6 h-6 text-orange-400" />
                      </div>
                      <h3 className="text-white font-bold mb-2">Score = Earning Time</h3>
                      <p className="text-gray-400 text-sm leading-relaxed">
                        1 Score Point = 1 minute of daily earning time across Watch, Games, and Listen features.
                      </p>
                    </div>
                    
                    {/* Sustainable Rewards */}
                    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 hover:border-green-500/50 transition-all duration-300 h-full">
                      <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center mb-4">
                        <Coins className="w-6 h-6 text-green-400" />
                      </div>
                      <h3 className="text-white font-bold mb-2">Sustainable Rewards</h3>
                      <p className="text-gray-400 text-sm leading-relaxed">
                        Creator fees from Arena trading continuously replenish the reward system.
                      </p>
                    </div>
                    
                    {/* Circular Economy */}
                    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 hover:border-cyan-500/50 transition-all duration-300 h-full">
                      <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center mb-4">
                        <RefreshCw className="w-6 h-6 text-cyan-400" />
                      </div>
                      <h3 className="text-white font-bold mb-2">Circular Economy</h3>
                      <p className="text-gray-400 text-sm leading-relaxed">
                        Burn → Earn points → Get time → Earn AVLO → Repeat.
                      </p>
                    </div>
                    
                    {/* Multiple Earning Ways */}
                    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 hover:border-purple-500/50 transition-all duration-300 h-full">
                      <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-4">
                        <Gamepad2 className="w-6 h-6 text-purple-400" />
                      </div>
                      <h3 className="text-white font-bold mb-2">Multiple Earning Ways</h3>
                      <p className="text-gray-400 text-sm leading-relaxed">
                        Use minutes in Watch, Games, or Listen to earn AVLO.
                      </p>
                    </div>
                    
                    {/* AVLO Credits */}
                    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 hover:border-pink-500/50 transition-all duration-300 h-full sm:col-span-2">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center flex-shrink-0">
                          <CreditCard className="w-6 h-6 text-pink-400" />
                        </div>
                        <div>
                          <h3 className="text-white font-bold mb-2">AVLO Credits</h3>
                          <p className="text-gray-400 text-sm leading-relaxed">
                            Earned AVLO becomes Credits for Chat, LoveArt, and LoveBot.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Bottom CTA */}
                  <div className="mt-6 text-center relative z-10">
                    <p className="text-transparent bg-gradient-to-r from-orange-400 via-pink-400 to-purple-400 bg-clip-text font-semibold flex items-center justify-center gap-2">
                      <Flame className="w-4 h-4 text-orange-400" />
                      The more you participate, the more you earn.
                      <Flame className="w-4 h-4 text-orange-400" />
                    </p>
                  </div>
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </motion.div>

        {/* Discover Swipe System - Collapsible */}
        <Collapsible open={isSwipeSystemOpen} onOpenChange={setIsSwipeSystemOpen}>
          <Card className="bg-black border border-cyan-500/30 shadow-2xl shadow-cyan-500/10 mb-8 relative overflow-hidden">
            {/* Tech grid background */}
            <div 
              className="absolute inset-0 opacity-[0.03] pointer-events-none"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(6, 182, 212, 0.5) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(6, 182, 212, 0.5) 1px, transparent 1px)
                `,
                backgroundSize: '30px 30px',
              }}
            />
            {/* Gradient accent */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-cyan-500 via-purple-500 to-pink-500" />
            
            <CollapsibleTrigger asChild>
              <button className="w-full p-6 sm:p-8 flex items-center justify-between hover:bg-white/5 transition-colors relative z-10">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-2xl border border-cyan-500/30">
                      <Heart className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full animate-pulse" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent flex items-center gap-2">
                      <Zap className="w-5 h-5 text-cyan-400" />
                      Discover Swipe System
                    </h2>
                    <p className="text-zinc-500 text-sm font-mono">// Multi-token support • Fixed $0.10 USD swipes</p>
                  </div>
                </div>
                {isSwipeSystemOpen ? (
                  <ChevronUp className="w-6 h-6 text-cyan-400" />
                ) : (
                  <ChevronDown className="w-6 h-6 text-cyan-400" />
                )}
              </button>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <div className="px-6 sm:px-8 pb-6 sm:pb-8 relative z-10">
                <div className="space-y-4 text-zinc-300 leading-relaxed">
                  <p className="border-l-2 border-cyan-500/50 pl-4 text-sm">
                    <span className="text-cyan-400 font-semibold font-mono">&gt;</span> Discover now supports <span className="text-cyan-400 font-semibold">all tokens</span> with DexScreener prices. You can <span className="text-purple-400 font-semibold">choose your preferred token</span> from your wallet and the system uses exactly <span className="text-green-400 font-bold font-mono">$0.10 USD</span> worth per swipe.
                  </p>

                  <div className="grid sm:grid-cols-3 gap-4 my-6">
                    {/* Gift Mode */}
                    <div className="bg-black border border-green-500/30 rounded-xl p-4 hover:border-green-500/60 transition-all group">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center border border-green-500/30 group-hover:border-green-500/60">
                          <Gift className="w-4 h-4 text-green-400" />
                        </div>
                        <span className="text-green-400 font-bold font-mono text-sm">GIFT_MODE</span>
                      </div>
                      <p className="text-xs text-zinc-500 leading-relaxed">
                        Tokens go directly to the person you like. Spread the love!
                      </p>
                    </div>

                    {/* Burn Mode */}
                    <div className="bg-black border border-orange-500/30 rounded-xl p-4 hover:border-orange-500/60 transition-all group">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center border border-orange-500/30 group-hover:border-orange-500/60">
                          <Flame className="w-4 h-4 text-orange-400" />
                        </div>
                        <span className="text-orange-400 font-bold font-mono text-sm">BURN_MODE</span>
                      </div>
                      <p className="text-xs text-zinc-500 leading-relaxed">
                        Tokens sent to dead address. Reduce supply forever!
                      </p>
                    </div>

                    {/* Team Mode */}
                    <div className="bg-black border border-blue-500/30 rounded-xl p-4 hover:border-blue-500/60 transition-all group">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/30 group-hover:border-blue-500/60">
                          <Building2 className="w-4 h-4 text-blue-400" />
                        </div>
                        <span className="text-blue-400 font-bold font-mono text-sm">TEAM_MODE</span>
                      </div>
                      <p className="text-xs text-zinc-500 leading-relaxed">
                        Support team and platform development. Thank you!
                      </p>
                    </div>
                  </div>

                  <div className="bg-black/50 border border-zinc-800 rounded-xl p-4">
                    <h4 className="text-white font-bold mb-3 flex items-center gap-2 font-mono text-sm">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      <span className="text-cyan-400">process</span>.<span className="text-white">workflow</span>()
                    </h4>
                    <div className="space-y-2 text-xs font-mono">
                      <div className="flex items-start gap-2 p-2 bg-zinc-900/50 rounded-lg border border-zinc-800">
                        <span className="text-cyan-400 font-bold w-6">01</span>
                        <span className="text-zinc-400">Check wallet for tokens with DexScreener prices <span className="text-zinc-600">(min $100 liquidity)</span></span>
                      </div>
                      <div className="flex items-start gap-2 p-2 bg-zinc-900/50 rounded-lg border border-zinc-800">
                        <span className="text-cyan-400 font-bold w-6">02</span>
                        <span className="text-zinc-400">Select preferred token from dropdown <span className="text-purple-400">[purple badge shows active token]</span></span>
                      </div>
                      <div className="flex items-start gap-2 p-2 bg-zinc-900/50 rounded-lg border border-zinc-800">
                        <span className="text-cyan-400 font-bold w-6">03</span>
                        <span className="text-zinc-400">Each right swipe = <span className="text-green-400 font-bold">$0.10 USD</span> worth of token</span>
                      </div>
                      <div className="flex items-start gap-2 p-2 bg-zinc-900/50 rounded-lg border border-zinc-800">
                        <span className="text-cyan-400 font-bold w-6">04</span>
                        <span className="text-zinc-400">Cycle: <span className="text-green-400">Gift</span> → <span className="text-orange-400">Burn</span> → <span className="text-blue-400">Team</span> → <span className="text-green-400">Gift</span>...</span>
                      </div>
                      <div className="flex items-start gap-2 p-2 bg-zinc-900/50 rounded-lg border border-zinc-800">
                        <span className="text-cyan-400 font-bold w-6">05</span>
                        <span className="text-zinc-400">Left swipe = <span className="text-orange-400 font-bold">10 Score Points</span> <span className="text-zinc-600">(no tokens)</span></span>
                      </div>
                    </div>
                  </div>

                  <p className="text-center text-cyan-400/80 font-mono text-xs mt-4 p-2 bg-cyan-500/5 border border-cyan-500/20 rounded-lg">
                    <Zap className="w-3 h-3 inline mr-1" />
                    Any token with DexScreener price = auto-supported • No DAO proposals needed
                  </p>
                </div>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Score Stealing System - Collapsible */}
        <Collapsible>
          <Card className="bg-black border border-red-500/30 shadow-2xl shadow-red-500/10 mb-8 relative overflow-hidden">
            {/* Tech grid background */}
            <div 
              className="absolute inset-0 opacity-[0.03] pointer-events-none"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(239, 68, 68, 0.5) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(239, 68, 68, 0.5) 1px, transparent 1px)
                `,
                backgroundSize: '30px 30px',
              }}
            />
            {/* Gradient accent */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-red-500 via-orange-500 to-yellow-500" />
            
            <CollapsibleTrigger asChild>
              <button className="w-full p-6 sm:p-8 flex items-center justify-between hover:bg-white/5 transition-colors relative z-10">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="p-3 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-2xl border border-red-500/30">
                      <Zap className="w-6 h-6 text-red-400" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-400 rounded-full animate-pulse" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent flex items-center gap-2">
                      <Flame className="w-5 h-5 text-red-400" />
                      Score Stealing System
                    </h2>
                    <p className="text-zinc-500 text-sm font-mono">// Competitive scoring • $0.01 = 1 Score</p>
                  </div>
                </div>
                <ChevronDown className="w-6 h-6 text-red-400" />
              </button>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <div className="px-6 sm:px-8 pb-6 sm:pb-8 relative z-10">
                <div className="space-y-4 text-zinc-300 leading-relaxed">
                  <p className="border-l-2 border-red-500/50 pl-4 text-sm">
                    <span className="text-red-400 font-semibold font-mono">&gt;</span> When rewards are paid out, the <span className="text-green-400 font-semibold">payer</span> steals score from the <span className="text-red-400 font-semibold">recipient</span>. This creates a competitive ecosystem where paying rewards actually benefits you!
                  </p>

                  <div className="grid sm:grid-cols-2 gap-4 my-6">
                    {/* Stealing Rate */}
                    <div className="bg-black border border-red-500/30 rounded-xl p-4 hover:border-red-500/60 transition-all group">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/30 group-hover:border-red-500/60">
                          <Coins className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                          <span className="text-white font-bold text-lg">$0.01 = 1 Score</span>
                          <p className="text-xs text-zinc-500">Stealing rate</p>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        For every <span className="text-orange-400 font-bold">$0.01 USD</span> worth of rewards paid, the payer gains <span className="text-green-400 font-bold">1 score point</span> and the recipient loses <span className="text-red-400 font-bold">1 score point</span>.
                      </p>
                    </div>

                    {/* Swap Volume Bonus */}
                    <div className="bg-black border border-green-500/30 rounded-xl p-4 hover:border-green-500/60 transition-all group">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center border border-green-500/30 group-hover:border-green-500/60">
                          <TrendingUp className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                          <span className="text-white font-bold text-lg">Swap Volume</span>
                          <p className="text-xs text-zinc-500">Same rate applies</p>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        Your swap trading volume on the DEX also earns score at <span className="text-green-400 font-bold">$0.01 = 1 score</span> rate. Trade more, earn more!
                      </p>
                    </div>
                  </div>

                  <div className="bg-black/50 border border-zinc-800 rounded-xl p-4">
                    <h4 className="text-white font-bold mb-3 flex items-center gap-2 font-mono text-sm">
                      <Sparkles className="w-4 h-4 text-red-400" />
                      <span className="text-red-400">score</span>.<span className="text-white">examples</span>()
                    </h4>
                    <div className="space-y-2 text-xs font-mono">
                      <div className="flex items-start gap-2 p-2 bg-zinc-900/50 rounded-lg border border-zinc-800">
                        <span className="text-red-400 font-bold w-6">01</span>
                        <span className="text-zinc-400">Pay <span className="text-orange-400">$0.50</span> reward → Steal <span className="text-green-400 font-bold">50 score</span> from recipient</span>
                      </div>
                      <div className="flex items-start gap-2 p-2 bg-zinc-900/50 rounded-lg border border-zinc-800">
                        <span className="text-red-400 font-bold w-6">02</span>
                        <span className="text-zinc-400">Swap <span className="text-orange-400">$100</span> volume → Earn <span className="text-green-400 font-bold">10,000 score</span></span>
                      </div>
                      <div className="flex items-start gap-2 p-2 bg-zinc-900/50 rounded-lg border border-zinc-800">
                        <span className="text-red-400 font-bold w-6">03</span>
                        <span className="text-zinc-400">Receive <span className="text-orange-400">$1.00</span> reward → Lose <span className="text-red-400 font-bold">100 score</span></span>
                      </div>
                    </div>
                  </div>

                  <p className="text-center text-red-400/80 font-mono text-xs mt-4 p-2 bg-red-500/5 border border-red-500/20 rounded-lg">
                    <Flame className="w-3 h-3 inline mr-1" />
                    Negative scores are possible! Pay rewards strategically to climb the leaderboard.
                  </p>
                </div>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Score Decay System - Tech Pitch Style */}
        <ScoreDecayInfoCard />

        {/* Credit Decay System - Tech Pitch Style */}
        <CreditDecayInfoCard />

        {/* Point System Info - Collapsible */}
        <Collapsible open={isPointSystemOpen} onOpenChange={setIsPointSystemOpen}>
          <Card className="bg-black border border-white/10 shadow-2xl mb-8 relative overflow-hidden">
            <CollapsibleTrigger asChild>
              <button className="w-full p-6 sm:p-8 flex items-center justify-between hover:bg-white/5 transition-colors">
                <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-3">
                  <span className="text-2xl sm:text-3xl">💎</span>
                  Point System
                  <span className="text-sm font-normal text-gray-400">(1 point = 1 min earning time)</span>
                </h2>
                {isPointSystemOpen ? (
                  <ChevronUp className="w-6 h-6 text-white/50" />
                ) : (
                  <ChevronDown className="w-6 h-6 text-white/50" />
                )}
              </button>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <div className="px-6 sm:px-8 pb-6 sm:pb-8">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {/* Right Swipe */}
                  <div className="bg-zinc-800/70 border border-zinc-700 rounded-xl p-4 hover:bg-zinc-800 hover:border-orange-500/30 transition-all hover:scale-105">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl">👉</span>
                      <span className="text-2xl font-bold text-orange-500">{points.swipe}</span>
                    </div>
                    <p className="text-white font-semibold">Right Swipe</p>
                    <p className="text-xs text-gray-400">When you match</p>
                    <p className="text-xs text-cyan-400 mt-1 font-mono">💫 $0.10 USD per swipe</p>
                  </div>

                  {/* Match */}
                  <div className="bg-zinc-800/70 border border-zinc-700 rounded-xl p-4 hover:bg-zinc-800 hover:border-orange-500/30 transition-all hover:scale-105">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl">💘</span>
                      <span className="text-2xl font-bold text-orange-500">{points.match}</span>
                    </div>
                    <p className="text-white font-semibold">Match</p>
                    <p className="text-xs text-gray-400">When both swipe right</p>
                    <p className="text-xs text-green-400 mt-1">✨ No burn required</p>
                  </div>

                  {/* Initial Bonus */}
                  <div className="bg-zinc-800/70 border border-zinc-700 rounded-xl p-4 hover:bg-zinc-800 hover:border-orange-500/30 transition-all hover:scale-105">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl">🎉</span>
                      <span className="text-2xl font-bold text-orange-500">{points.initial_bonus}</span>
                    </div>
                    <p className="text-white font-semibold">Initial Bonus</p>
                    <p className="text-xs text-gray-400">New user bonus</p>
                    <p className="text-xs text-green-400 mt-1">✨ One-time only</p>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Current User Card - Accordion Style */}
        {walletAuth?.profile?.id && leaderboard.find(u => u.id === walletAuth.profile.id) && (
          <div className="mb-6 relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 via-pink-500 to-orange-500 rounded-xl opacity-30 blur-xl animate-pulse pointer-events-none" />
            <div className="relative">
              <ScoreBreakdownAccordion
                userId={walletAuth.profile.id}
                username={leaderboard.find(u => u.id === walletAuth.profile.id)!.username}
                displayName={leaderboard.find(u => u.id === walletAuth.profile.id)!.display_name}
                avatarUrl={leaderboard.find(u => u.id === walletAuth.profile.id)!.avatar_url}
                totalScore={leaderboard.find(u => u.id === walletAuth.profile.id)!.total_score}
                isExpanded={expandedUserId === walletAuth.profile.id}
                onToggle={() => setExpandedUserId(expandedUserId === walletAuth.profile.id ? null : walletAuth.profile.id)}
                isCurrentUser
                rank={leaderboard.find(u => u.id === walletAuth.profile.id)!.rank}
                swipeCount={leaderboard.find(u => u.id === walletAuth.profile.id)!.swipe_count}
                matchCount={leaderboard.find(u => u.id === walletAuth.profile.id)!.match_count}
                referralCount={leaderboard.find(u => u.id === walletAuth.profile.id)!.qualified_referrals}
              />
            </div>
          </div>
        )}

        {/* Leaderboard - Tech Pitch Style */}
        <Card className="bg-black/90 backdrop-blur-xl border border-cyan-500/30 shadow-2xl shadow-cyan-500/10 relative overflow-hidden">
          {/* Tech grid background */}
          <div 
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(rgba(6, 182, 212, 0.5) 1px, transparent 1px),
                linear-gradient(90deg, rgba(6, 182, 212, 0.5) 1px, transparent 1px)
              `,
              backgroundSize: '30px 30px',
            }}
          />
          {/* Gradient accent */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-cyan-500 via-purple-500 to-pink-500" />
          {/* Floating glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          
          {/* Header */}
          <div className="p-6 border-b border-cyan-500/20 relative z-10">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-2xl border border-cyan-500/30">
                  <Trophy className="w-6 h-6 text-cyan-400" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Score Leaderboard
                </h2>
                <p className="text-zinc-500 text-sm font-mono">// {leaderboard.length} users • Real-time rankings</p>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-3 relative z-10">
            {leaderboard.length === 0 ? (
              <div className="p-12 text-center">
                <Trophy className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
                <p className="text-xl text-gray-300">No users on leaderboard yet. Be the first!</p>
              </div>
            ) : (
              <>
                {leaderboard
                  .filter(user => user.id !== walletAuth?.profile?.id)
                  .slice((currentPage - 1) * USERS_PER_PAGE, currentPage * USERS_PER_PAGE)
                  .map((user) => (
                    <ScoreBreakdownAccordion
                      key={user.id}
                      userId={user.id}
                      username={user.username}
                      displayName={user.display_name}
                      avatarUrl={user.avatar_url}
                      totalScore={user.total_score}
                      isExpanded={expandedUserId === user.id}
                      onToggle={() => setExpandedUserId(expandedUserId === user.id ? null : user.id)}
                    />
                  ))}

                {/* Pagination Controls */}
                {leaderboard.filter(u => u.id !== walletAuth?.profile?.id).length > USERS_PER_PAGE && (
                  <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-cyan-500/20">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 disabled:opacity-50"
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ 
                        length: Math.ceil(leaderboard.filter(u => u.id !== walletAuth?.profile?.id).length / USERS_PER_PAGE) 
                      }, (_, i) => i + 1).slice(
                        Math.max(0, currentPage - 3),
                        currentPage + 2
                      ).map(pageNum => (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className={currentPage === pageNum 
                            ? "bg-gradient-to-r from-cyan-500 to-purple-500 text-white border-0" 
                            : "border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                          }
                        >
                          {pageNum}
                        </Button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(
                        Math.ceil(leaderboard.filter(u => u.id !== walletAuth?.profile?.id).length / USERS_PER_PAGE), 
                        p + 1
                      ))}
                      disabled={currentPage === Math.ceil(leaderboard.filter(u => u.id !== walletAuth?.profile?.id).length / USERS_PER_PAGE)}
                      className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 disabled:opacity-50"
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Tip Dialog */}
      {selectedUser && (
        <TipDialog
          open={showTipDialog}
          onOpenChange={setShowTipDialog}
          receiverId={selectedUser.id}
          receiverName={selectedUser.display_name || selectedUser.username}
          receiverWallet={selectedUser.wallet_address || ''}
          context="match"
          userScore={selectedUser.total_score}
        />
      )}

    </div>
  );
};

export default Airdrop;
