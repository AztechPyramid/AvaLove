import { useState, useEffect, useContext } from 'react';
import { TrendingDown, TrendingUp, Trophy, Loader2, Sparkles, Timer, Clock, Zap, Gift, Coins, Gamepad2, Video, Music, ArrowUpDown, Flame, MessageCircle, Bot, Palette, Package, ShoppingCart, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { useTimeScore } from '@/hooks/useTimeScore';
import { getAvatarUrl } from '@/lib/defaultAvatars';
import { supabase } from '@/integrations/supabase/client';
import { WalletAuthContext } from '@/contexts/WalletAuthContext';
import avloHeartLogo from '@/assets/avlo-heart-logo.png';

interface TimePopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CreditBreakdown {
  earned: {
    games: number;
    videos: number;
    music: number;
    shortVideos: number;
    swaps: number;
    raffleWinnings: number;
    blackjackWinnings: number;
    total: number;
  };
  spent: {
    chat: number;
    aiChat: number;
    pixelArt: number;
    packOpening: number;
    cardPurchase: number;
    poolBoost: number;
    swipeBoost: number;
    posts: number;
    comments: number;
    raffleEntry: number;
    blackjackBet: number;
    offlineDecay: number;
    total: number;
  };
  balance: number;
}

export const TimePopup = ({ open, onOpenChange }: TimePopupProps) => {
  const { leaderboard, loading, data } = useTimeScore();
  const walletAuth = useContext(WalletAuthContext);
  const profile = walletAuth?.profile;
  
  const [creditData, setCreditData] = useState<CreditBreakdown | null>(null);
  const [creditLoading, setCreditLoading] = useState(false);
  const [showEarnedDetails, setShowEarnedDetails] = useState(false);
  const [showSpentDetails, setShowSpentDetails] = useState(false);
  const [pulsePhase, setPulsePhase] = useState(0);

  // Energy pulse animation
  useEffect(() => {
    const interval = setInterval(() => {
      setPulsePhase(prev => (prev + 1) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Format score to time display
  const formatScoreToTime = (score: number) => {
    if (score <= 0) return '0m';
    const hours = Math.floor(score / 60);
    const mins = score % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // Fetch credit data when popup opens
  useEffect(() => {
    if (!open || !profile?.id) return;
    
    const fetchCreditData = async () => {
      setCreditLoading(true);
      try {
        const pageSize = 1000;
        
        // Find latest paid_at
        const [lastPaidGames, lastPaidVideos, lastPaidMusic, lastPaidShort, lastPaidSwaps] = await Promise.all([
          supabase.from('embedded_game_sessions').select('paid_at').eq('user_id', profile.id).eq('paid', true).order('paid_at', { ascending: false }).limit(1),
          supabase.from('watch_video_views').select('paid_at').eq('user_id', profile.id).eq('paid', true).order('paid_at', { ascending: false }).limit(1),
          supabase.from('music_track_listens').select('paid_at').eq('user_id', profile.id).eq('paid', true).order('paid_at', { ascending: false }).limit(1),
          supabase.from('short_video_views').select('paid_at').eq('user_id', profile.id).eq('paid', true).order('paid_at', { ascending: false }).limit(1),
          supabase.from('swap_transactions').select('paid_at').eq('user_id', profile.id).eq('paid', true).order('paid_at', { ascending: false }).limit(1)
        ]);

        const paidDates = [
          lastPaidGames.data?.[0]?.paid_at,
          lastPaidVideos.data?.[0]?.paid_at,
          lastPaidMusic.data?.[0]?.paid_at,
          lastPaidShort.data?.[0]?.paid_at,
          lastPaidSwaps.data?.[0]?.paid_at,
        ].filter(Boolean) as string[];

        const lastPaidAt = paidDates.length > 0
          ? paidDates.reduce((latest, current) => (current > latest ? current : latest))
          : null;

        // Helper to sum unpaid rewards from a table
        const sumUnpaidRewards = async (
          table: 'embedded_game_sessions' | 'watch_video_views' | 'music_track_listens' | 'short_video_views',
          orderColumn: 'started_at' | 'created_at'
        ) => {
          let from = 0;
          let total = 0;

          while (true) {
            let q: any = supabase
              .from(table)
              .select('reward_earned, status')
              .eq('user_id', profile.id)
              .or('paid.is.null,paid.eq.false')
              .order(orderColumn, { ascending: false })
              .range(from, from + pageSize - 1);

            if (table === 'embedded_game_sessions') {
              q = q.not('game_id', 'like', 'raffle_%').not('game_id', 'like', 'blackjack_%');
            }

            const { data, error } = await q;
            if (error) throw error;

            total += data?.reduce((sum: number, s: any) => {
              const reward = Number(s.reward_earned) || 0;
              const isCompleted = s.status === 'completed';
              if (isCompleted || reward > 0) {
                return sum + reward;
              }
              return sum;
            }, 0) || 0;

            if (!data || data.length < pageSize) break;
            from += pageSize;
          }
          return total;
        };

        // Sum swap rewards
        const sumSwapRewards = async () => {
          let from = 0;
          let total = 0;

          while (true) {
            const { data, error } = await supabase
              .from('swap_transactions')
              .select('reward_earned')
              .eq('user_id', profile.id)
              .or('paid.is.null,paid.eq.false')
              .order('created_at', { ascending: false })
              .range(from, from + pageSize - 1);

            if (error) throw error;
            total += data?.reduce((sum, s) => sum + (Number((s as any).reward_earned) || 0), 0) || 0;

            if (!data || data.length < pageSize) break;
            from += pageSize;
          }
          return total;
        };

        // Sum raffle winnings
        const sumRaffleWinnings = async () => {
          let from = 0;
          let total = 0;

          while (true) {
            const { data, error } = await supabase
              .from('embedded_game_sessions')
              .select('reward_earned')
              .eq('user_id', profile.id)
              .like('game_id', 'raffle_%')
              .or('paid.is.null,paid.eq.false')
              .order('started_at', { ascending: false })
              .range(from, from + pageSize - 1);

            if (error) throw error;
            total += data?.reduce((sum, s) => sum + (Number((s as any).reward_earned) || 0), 0) || 0;

            if (!data || data.length < pageSize) break;
            from += pageSize;
          }
          return total;
        };

        // Sum blackjack winnings
        const sumBlackjackWinnings = async () => {
          let from = 0;
          let total = 0;

          while (true) {
            const { data, error } = await supabase
              .from('embedded_game_sessions')
              .select('reward_earned')
              .eq('user_id', profile.id)
              .like('game_id', 'blackjack_%')
              .or('paid.is.null,paid.eq.false')
              .order('started_at', { ascending: false })
              .range(from, from + pageSize - 1);

            if (error) throw error;
            total += data?.reduce((sum, s) => sum + (Number((s as any).reward_earned) || 0), 0) || 0;

            if (!data || data.length < pageSize) break;
            from += pageSize;
          }
          return total;
        };

        // Sum burns by type
        const burnTypes = ['chat_message', 'ai_chat', 'pack_opening', 'pixel_art', 'pixel_art_spend', 'card_purchase', 'card_sale', 'pool_boost', 'swipe_boost', 'post_text', 'post_image', 'post_gif', 'post_video', 'post_comment', 'post_repost', 'game_add', 'video_add', 'raffle_entry', 'blackjack_bet', 'offline_decay'];
        
        const sumBurnsByType = async () => {
          let from = 0;
          const burnsByType: Record<string, number> = {};

          while (true) {
            let q = supabase
              .from('token_burns')
              .select('amount, burn_type, created_at')
              .eq('user_id', profile.id)
              .in('burn_type', burnTypes)
              .order('created_at', { ascending: false })
              .range(from, from + pageSize - 1);

            if (lastPaidAt) {
              q = q.gt('created_at', lastPaidAt);
            }

            const { data, error } = await q;
            if (error) throw error;

            data?.forEach((burn: any) => {
              const type = burn.burn_type;
              burnsByType[type] = (burnsByType[type] || 0) + Number(burn.amount || 0);
            });

            if (!data || data.length < pageSize) break;
            from += pageSize;
          }
          return burnsByType;
        };

        const [gamesEarned, videosEarned, musicEarned, shortVideosEarned, swapsEarned, raffleWinnings, blackjackWinnings, burnsByType] = await Promise.all([
          sumUnpaidRewards('embedded_game_sessions', 'started_at'),
          sumUnpaidRewards('watch_video_views', 'started_at'),
          sumUnpaidRewards('music_track_listens', 'created_at'),
          sumUnpaidRewards('short_video_views', 'created_at'),
          sumSwapRewards(),
          sumRaffleWinnings(),
          sumBlackjackWinnings(),
          sumBurnsByType(),
        ]);

        const chatSpent = burnsByType['chat_message'] || 0;
        const aiChatSpent = burnsByType['ai_chat'] || 0;
        const pixelArtSpent = (burnsByType['pixel_art'] || 0) + (burnsByType['pixel_art_spend'] || 0);
        const packOpeningSpent = burnsByType['pack_opening'] || 0;
        const cardPurchaseSpent = (burnsByType['card_purchase'] || 0) + (burnsByType['card_sale'] || 0);
        const poolBoostSpent = burnsByType['pool_boost'] || 0;
        const swipeBoostSpent = burnsByType['swipe_boost'] || 0;
        const postsSpent = (burnsByType['post_text'] || 0) + (burnsByType['post_image'] || 0) + (burnsByType['post_gif'] || 0) + (burnsByType['post_video'] || 0) + (burnsByType['post_repost'] || 0) + (burnsByType['game_add'] || 0) + (burnsByType['video_add'] || 0);
        const commentsSpent = burnsByType['post_comment'] || 0;
        const raffleEntrySpent = burnsByType['raffle_entry'] || 0;
        const blackjackBetSpent = burnsByType['blackjack_bet'] || 0;
        const offlineDecaySpent = burnsByType['offline_decay'] || 0;

        const totalEarned = gamesEarned + videosEarned + musicEarned + shortVideosEarned + swapsEarned + raffleWinnings + blackjackWinnings;
        const totalSpent = chatSpent + aiChatSpent + pixelArtSpent + packOpeningSpent + cardPurchaseSpent + poolBoostSpent + swipeBoostSpent + postsSpent + commentsSpent + raffleEntrySpent + blackjackBetSpent + offlineDecaySpent;

        setCreditData({
          earned: {
            games: gamesEarned,
            videos: videosEarned,
            music: musicEarned,
            shortVideos: shortVideosEarned,
            swaps: swapsEarned,
            raffleWinnings,
            blackjackWinnings,
            total: totalEarned,
          },
          spent: {
            chat: chatSpent,
            aiChat: aiChatSpent,
            pixelArt: pixelArtSpent,
            packOpening: packOpeningSpent,
            cardPurchase: cardPurchaseSpent,
            poolBoost: poolBoostSpent,
            swipeBoost: swipeBoostSpent,
            posts: postsSpent,
            comments: commentsSpent,
            raffleEntry: raffleEntrySpent,
            blackjackBet: blackjackBetSpent,
            offlineDecay: offlineDecaySpent,
            total: totalSpent,
          },
          balance: Math.max(0, totalEarned - totalSpent),
        });
      } catch (error) {
        console.error('Error fetching credit data:', error);
      } finally {
        setCreditLoading(false);
      }
    };

    fetchCreditData();
  }, [open, profile?.id]);

  // AVLO Logo component
  const AvloLogo = ({ size = 'sm' }: { size?: 'sm' | 'md' | 'lg' }) => {
    const sizeClasses = {
      sm: 'w-4 h-4',
      md: 'w-5 h-5',
      lg: 'w-6 h-6',
    };
    return (
      <motion.img 
        src={avloHeartLogo} 
        alt="AVLO" 
        className={`${sizeClasses[size]} object-contain`}
        animate={{
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-4 right-4 w-auto max-w-none translate-x-0 bg-zinc-950/98 border border-cyan-500/30 text-white max-h-[90vh] backdrop-blur-xl overflow-hidden p-4 sm:left-1/2 sm:right-auto sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:p-6">
        {/* Animated tech background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Gradient orbs */}
          <motion.div 
            className="absolute top-0 left-1/4 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl"
            animate={{
              x: [0, 30, 0],
              y: [0, -20, 0],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div 
            className="absolute bottom-0 right-0 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl"
            animate={{
              x: [0, -20, 0],
              y: [0, 20, 0],
              opacity: [0.2, 0.3, 0.2],
            }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          />
          
          {/* Tech grid pattern */}
          <div 
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: `linear-gradient(rgba(34,211,238,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.3) 1px, transparent 1px)`,
              backgroundSize: '30px 30px',
            }}
          />
          
          {/* Flowing energy lines */}
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"
              style={{
                width: '100%',
                top: `${20 + i * 20}%`,
              }}
              animate={{
                x: ['-100%', '100%'],
                opacity: [0, 0.5, 0],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                delay: i * 0.8,
                ease: 'linear',
              }}
            />
          ))}
        </div>
        
        <DialogHeader className="relative z-10">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <motion.div 
              className="relative"
              animate={{
                rotate: [0, 5, -5, 0],
              }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <motion.div 
                className="absolute inset-0 bg-cyan-500 blur-lg"
                animate={{
                  opacity: [0.3, 0.7, 0.3],
                  scale: [1, 1.3, 1],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <div className="relative bg-gradient-to-br from-cyan-400 to-cyan-600 p-2.5 rounded-xl">
                <Timer className="w-5 h-5 text-black" />
              </div>
            </motion.div>
            <span className="bg-gradient-to-r from-cyan-400 via-white to-purple-400 bg-clip-text text-transparent font-bold">
              Time Matrix
            </span>
            <motion.div
              animate={{
                rotate: [0, 360],
                scale: [1, 1.2, 1],
              }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <Sparkles className="w-4 h-4 text-yellow-400" />
            </motion.div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-100px)] pr-2">
          {/* User Stats Summary - Score from user_scores */}
          {data && (
            <motion.div 
              className="relative z-10 grid grid-cols-2 gap-2 mb-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="relative overflow-hidden bg-gradient-to-br from-cyan-500/10 to-cyan-900/10 border border-cyan-500/30 rounded-xl p-3">
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                />
                <div className="relative flex items-center gap-1.5 text-cyan-400 text-xs mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="font-semibold">Your Time</span>
                </div>
                <div className="relative text-lg font-black text-white">
                  {formatScoreToTime(data.totalScore)}
                </div>
                <div className="relative text-[10px] text-zinc-500">{data.totalScore} score</div>
              </div>
              
              <div className="relative overflow-hidden bg-gradient-to-br from-green-500/10 to-green-900/10 border border-green-500/30 rounded-xl p-3">
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-green-500/10 to-transparent"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear', delay: 0.5 }}
                />
                <div className="relative flex items-center gap-1.5 text-green-400 text-xs mb-1">
                  <Zap className="w-3.5 h-3.5" />
                  <span className="font-semibold">Earned</span>
                </div>
                <div className="relative text-lg font-black text-green-400">
                  +{data.earnedScore}
                </div>
                <div className="relative text-[10px] text-zinc-500">from activities</div>
              </div>
              
              <div className="relative overflow-hidden bg-gradient-to-br from-red-500/10 to-red-900/10 border border-red-500/30 rounded-xl p-3">
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-red-500/10 to-transparent"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear', delay: 1 }}
                />
                <div className="relative flex items-center gap-1.5 text-red-400 text-xs mb-1">
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span className="font-semibold">Decayed</span>
                </div>
                <div className="relative text-lg font-black text-red-400">
                  -{data.decayedScore}
                </div>
                <div className="relative text-[10px] text-zinc-500">offline penalty</div>
              </div>
              
              <div className="relative overflow-hidden bg-gradient-to-br from-purple-500/10 to-purple-900/10 border border-purple-500/30 rounded-xl p-3">
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/10 to-transparent"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear', delay: 1.5 }}
                />
                <div className="relative flex items-center gap-1.5 text-purple-400 text-xs mb-1">
                  <Gift className="w-3.5 h-3.5" />
                  <span className="font-semibold">Daily Bonus</span>
                </div>
                <div className="relative text-lg font-black text-purple-400">
                  +60
                </div>
                <div className="relative text-[10px] text-zinc-500">per day login</div>
              </div>
            </motion.div>
          )}

          {/* Credit Balance Card with AVLO Logo */}
          {profile?.id && (
            <motion.div 
              className="relative z-10 mb-3 p-4 rounded-xl bg-gradient-to-br from-yellow-500/10 via-zinc-900/50 to-orange-500/10 border border-yellow-500/30 overflow-hidden"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              {/* Shimmer effect */}
              <motion.div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-500/10 to-transparent"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              />
              
              <div className="relative flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <AvloLogo size="lg" />
                  <span className="font-bold text-yellow-400">AVLO Credits</span>
                </div>
                {creditLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-yellow-400" />
                ) : (
                  <motion.div 
                    className="text-2xl font-black text-yellow-400"
                    animate={{ scale: [1, 1.02, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    {Math.round(creditData?.balance || 0).toLocaleString()}
                  </motion.div>
                )}
              </div>
              
              {/* Earned Section */}
              <div className="relative space-y-2">
                <button
                  onClick={() => setShowEarnedDetails(!showEarnedDetails)}
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    <span className="text-sm font-semibold text-green-400">Earned</span>
                    <AvloLogo size="sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    {creditLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-green-400" />
                    ) : (
                      <span className="text-sm font-bold text-green-400">
                        +{Math.round(creditData?.earned.total || 0).toLocaleString()}
                      </span>
                    )}
                    {showEarnedDetails ? (
                      <ChevronUp className="w-4 h-4 text-green-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-green-400" />
                    )}
                  </div>
                </button>
                
                <AnimatePresence>
                  {showEarnedDetails && creditData && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="p-2 rounded-lg bg-zinc-900/50 border border-zinc-800 space-y-1.5">
                        {creditData.earned.games > 0 && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2 text-zinc-400">
                              <Gamepad2 className="w-3 h-3 text-purple-400" />
                              Games
                            </span>
                            <span className="text-green-400 font-medium">+{Math.round(creditData.earned.games).toLocaleString()}</span>
                          </div>
                        )}
                        {creditData.earned.videos > 0 && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2 text-zinc-400">
                              <Video className="w-3 h-3 text-red-400" />
                              Watch Videos
                            </span>
                            <span className="text-green-400 font-medium">+{Math.round(creditData.earned.videos).toLocaleString()}</span>
                          </div>
                        )}
                        {creditData.earned.music > 0 && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2 text-zinc-400">
                              <Music className="w-3 h-3 text-green-400" />
                              Listen Music
                            </span>
                            <span className="text-green-400 font-medium">+{Math.round(creditData.earned.music).toLocaleString()}</span>
                          </div>
                        )}
                        {creditData.earned.shortVideos > 0 && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2 text-zinc-400">
                              <Video className="w-3 h-3 text-pink-400" />
                              Short Videos
                            </span>
                            <span className="text-green-400 font-medium">+{Math.round(creditData.earned.shortVideos).toLocaleString()}</span>
                          </div>
                        )}
                        {creditData.earned.swaps > 0 && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2 text-zinc-400">
                              <ArrowUpDown className="w-3 h-3 text-cyan-400" />
                              Swap Rewards
                            </span>
                            <span className="text-green-400 font-medium">+{Math.round(creditData.earned.swaps).toLocaleString()}</span>
                          </div>
                        )}
                        {creditData.earned.raffleWinnings > 0 && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2 text-zinc-400">
                              <Flame className="w-3 h-3 text-yellow-400" />
                              Raffle Winnings
                            </span>
                            <span className="text-green-400 font-medium">+{Math.round(creditData.earned.raffleWinnings).toLocaleString()}</span>
                          </div>
                        )}
                        {creditData.earned.blackjackWinnings > 0 && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2 text-zinc-400">
                              <Gamepad2 className="w-3 h-3 text-emerald-400" />
                              BlackJack Wins
                            </span>
                            <span className="text-green-400 font-medium">+{Math.round(creditData.earned.blackjackWinnings).toLocaleString()}</span>
                          </div>
                        )}
                        {creditData.earned.total === 0 && (
                          <div className="text-xs text-zinc-500 italic">No earnings yet. Play games, watch videos, or swap tokens!</div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              {/* Spent Section */}
              <div className="relative space-y-2 mt-2">
                <button
                  onClick={() => setShowSpentDetails(!showSpentDetails)}
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-rose-400" />
                    <span className="text-sm font-semibold text-rose-400">Spent</span>
                    <AvloLogo size="sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    {creditLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                    ) : (
                      <span className="text-sm font-bold text-rose-400">
                        -{Math.round(creditData?.spent.total || 0).toLocaleString()}
                      </span>
                    )}
                    {showSpentDetails ? (
                      <ChevronUp className="w-4 h-4 text-rose-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-rose-400" />
                    )}
                  </div>
                </button>
                
                <AnimatePresence>
                  {showSpentDetails && creditData && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="p-2 rounded-lg bg-zinc-900/50 border border-zinc-800 space-y-1.5">
                        {creditData.spent.chat > 0 && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2 text-zinc-400">
                              <MessageCircle className="w-3 h-3 text-blue-400" />
                              Global Chat
                            </span>
                            <span className="text-rose-400 font-medium">-{Math.round(creditData.spent.chat).toLocaleString()}</span>
                          </div>
                        )}
                        {creditData.spent.aiChat > 0 && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2 text-zinc-400">
                              <Bot className="w-3 h-3 text-cyan-400" />
                              Love AI
                            </span>
                            <span className="text-rose-400 font-medium">-{Math.round(creditData.spent.aiChat).toLocaleString()}</span>
                          </div>
                        )}
                        {creditData.spent.pixelArt > 0 && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2 text-zinc-400">
                              <Palette className="w-3 h-3 text-orange-400" />
                              LoveArt
                            </span>
                            <span className="text-rose-400 font-medium">-{Math.round(creditData.spent.pixelArt).toLocaleString()}</span>
                          </div>
                        )}
                        {creditData.spent.packOpening > 0 && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2 text-zinc-400">
                              <Package className="w-3 h-3 text-yellow-400" />
                              Pack Opening
                            </span>
                            <span className="text-rose-400 font-medium">-{Math.round(creditData.spent.packOpening).toLocaleString()}</span>
                          </div>
                        )}
                        {creditData.spent.cardPurchase > 0 && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2 text-zinc-400">
                              <ShoppingCart className="w-3 h-3 text-emerald-400" />
                              Card Trades
                            </span>
                            <span className="text-rose-400 font-medium">-{Math.round(creditData.spent.cardPurchase).toLocaleString()}</span>
                          </div>
                        )}
                        {creditData.spent.poolBoost > 0 && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2 text-zinc-400">
                              <Flame className="w-3 h-3 text-purple-400" />
                              Pool Boost
                            </span>
                            <span className="text-rose-400 font-medium">-{Math.round(creditData.spent.poolBoost).toLocaleString()}</span>
                          </div>
                        )}
                        {creditData.spent.swipeBoost > 0 && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2 text-zinc-400">
                              <Flame className="w-3 h-3 text-pink-400" />
                              Swipe Boost
                            </span>
                            <span className="text-rose-400 font-medium">-{Math.round(creditData.spent.swipeBoost).toLocaleString()}</span>
                          </div>
                        )}
                        {creditData.spent.posts > 0 && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2 text-zinc-400">
                              <Plus className="w-3 h-3 text-orange-400" />
                              Posts & Content
                            </span>
                            <span className="text-rose-400 font-medium">-{Math.round(creditData.spent.posts).toLocaleString()}</span>
                          </div>
                        )}
                        {creditData.spent.comments > 0 && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2 text-zinc-400">
                              <MessageCircle className="w-3 h-3 text-blue-400" />
                              Comments
                            </span>
                            <span className="text-rose-400 font-medium">-{Math.round(creditData.spent.comments).toLocaleString()}</span>
                          </div>
                        )}
                        {creditData.spent.raffleEntry > 0 && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2 text-zinc-400">
                              <Flame className="w-3 h-3 text-yellow-400" />
                              Raffle Entries
                            </span>
                            <span className="text-rose-400 font-medium">-{Math.round(creditData.spent.raffleEntry).toLocaleString()}</span>
                          </div>
                        )}
                        {creditData.spent.blackjackBet > 0 && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2 text-zinc-400">
                              <Gamepad2 className="w-3 h-3 text-emerald-400" />
                              BlackJack Bets
                            </span>
                            <span className="text-rose-400 font-medium">-{Math.round(creditData.spent.blackjackBet).toLocaleString()}</span>
                          </div>
                        )}
                        {creditData.spent.offlineDecay > 0 && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2 text-zinc-400">
                              <TrendingDown className="w-3 h-3 text-amber-400" />
                              Offline Decay
                            </span>
                            <span className="text-rose-400 font-medium">-{Math.round(creditData.spent.offlineDecay).toLocaleString()}</span>
                          </div>
                        )}
                        {creditData.spent.total === 0 && (
                          <div className="text-xs text-zinc-500 italic">No credits spent yet</div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* Leaderboard */}
          <motion.div 
            className="w-full relative z-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Trophy className="w-4 h-4 text-purple-400" />
              </motion.div>
              <span className="font-semibold text-purple-400 text-sm">Top Players</span>
            </div>
            <div className="space-y-1.5">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                  <span className="text-zinc-400 text-sm">Loading...</span>
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="text-center py-8">
                  <Trophy className="w-10 h-10 text-zinc-700 mx-auto mb-2" />
                  <p className="text-zinc-500 text-sm">No data yet</p>
                </div>
              ) : (
                leaderboard.slice(0, 10).map((entry, index) => (
                  <motion.div
                    key={`${entry.user_id}-${index}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                    className={`relative flex min-w-0 items-center gap-2 p-2 rounded-xl border transition-all duration-300 overflow-hidden ${
                      index === 0 ? 'bg-gradient-to-r from-yellow-500/10 to-yellow-900/10 border-yellow-500/30' :
                      index === 1 ? 'bg-gradient-to-r from-zinc-400/10 to-zinc-700/10 border-zinc-400/30' :
                      index === 2 ? 'bg-gradient-to-r from-amber-600/10 to-amber-900/10 border-amber-600/30' :
                      'bg-zinc-900/30 border-zinc-800'
                    }`}
                  >
                    {/* Shimmer for top 3 */}
                    {index < 3 && (
                      <motion.div 
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'linear', delay: index * 0.5 }}
                      />
                    )}
                    
                    {/* Rank Badge */}
                    <div className={`relative w-5 h-5 rounded-md flex items-center justify-center font-black text-[10px] shrink-0 ${
                      index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black' :
                      index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-black' :
                      index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-800 text-white' :
                      'bg-zinc-800 text-zinc-400'
                    }`}>
                      {index + 1}
                    </div>

                    {/* Avatar */}
                    <Avatar className={`relative w-7 h-7 border shrink-0 ${
                      index === 0 ? 'border-yellow-500/50' :
                      index === 1 ? 'border-gray-400/50' :
                      index === 2 ? 'border-amber-600/50' :
                      'border-zinc-700'
                    }`}>
                      <AvatarImage src={getAvatarUrl(entry.avatar_url, entry.username)} />
                      <AvatarFallback className="bg-zinc-800 text-white text-[10px]">
                        {entry.username?.charAt(0).toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>

                    {/* User Info */}
                    <div className="relative flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold truncate text-[11px]">{entry.username || 'Anonymous'}</span>
                        {entry.arena_verified && (
                          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[8px] px-1 py-0 shrink-0">
                            ✓
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[9px]">
                        <span className="flex items-center gap-0.5 text-green-400">
                          <TrendingUp className="w-2.5 h-2.5" />
                          +{entry.earned_score || 0}
                        </span>
                        {entry.time_lost_minutes > 0 && (
                          <span className="flex items-center gap-0.5 text-red-400">
                            <TrendingDown className="w-2.5 h-2.5" />
                            -{entry.time_lost_minutes}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Total Score with Time */}
                    <div className="relative text-right shrink-0">
                      <div className={`font-black text-xs leading-none tabular-nums ${
                        index === 0 ? 'text-yellow-400' :
                        index === 1 ? 'text-gray-300' :
                        index === 2 ? 'text-amber-500' :
                        'text-cyan-400'
                      }`}>
                        {formatScoreToTime(entry.total_score)}
                      </div>
                      <div className="text-[8px] text-zinc-500">{entry.total_score}</div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
