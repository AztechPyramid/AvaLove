import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, TrendingUp, TrendingDown, ArrowRightLeft, Heart, Users, Gift, Clock, Award, Hash, WifiOff, Coins } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { getAvatarUrl } from '@/lib/defaultAvatars';
import { formatDistanceToNow } from 'date-fns';
import { useDecayingScore } from '@/hooks/useDecayingScore';
import { useDecayingCredit } from '@/hooks/useDecayingCredit';
import { useOnlineUsersContext } from '@/contexts/OnlineUsersContext';

interface ScoreBreakdownAccordionProps {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  totalScore: number;
  isExpanded: boolean;
  onToggle: () => void;
  isCurrentUser?: boolean;
  rank?: number;
  swipeCount?: number;
  matchCount?: number;
  referralCount?: number;
}

interface ScoreTransfer {
  id: string;
  payer_id: string;
  recipient_id: string;
  amount_usd: number;
  score_transferred: number;
  created_at: string;
  payer?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  recipient?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface ScoreBreakdown {
  initial_score: number;
  swipe_count: number;
  match_count: number;
  stolen_from_others: number;
  stolen_by_others: number;
}

export function ScoreBreakdownAccordion({
  userId,
  username,
  displayName,
  avatarUrl,
  totalScore,
  isExpanded,
  onToggle,
  isCurrentUser = false,
  rank,
  swipeCount,
  matchCount,
  referralCount
}: ScoreBreakdownAccordionProps) {
  const [loading, setLoading] = useState(false);
  const [breakdown, setBreakdown] = useState<ScoreBreakdown | null>(null);
  const [transfers, setTransfers] = useState<ScoreTransfer[]>([]);
  const [hasFetched, setHasFetched] = useState(false);

  // Use real-time decaying score
  const { isUserOnline } = useOnlineUsersContext();
  const isOnline = isUserOnline(userId);
  const {
    effectiveScore,
    decayAmount,
    isDecaying,
    remainingTimeDisplay,
  } = useDecayingScore(userId, totalScore, { fetchScore: false });

  // Use real-time decaying credit
  const {
    pendingDecay: creditPendingDecay,
    isDecaying: creditIsDecaying,
    pendingDecayDisplay: creditPendingDecayDisplay,
  } = useDecayingCredit(userId);

  useEffect(() => {
    if (isExpanded && !hasFetched) {
      fetchBreakdown();
    }
  }, [isExpanded]);

  const fetchBreakdown = async () => {
    setLoading(true);
    try {
      // Get AVLO token ID
      const { data: avloToken } = await supabase
        .from('dao_tokens')
        .select('id')
        .eq('token_address', '0xb5B3e63540fD53DCFFD4e65c726a84aA67B24E61')
        .single();

      // Fetch user score details - order by total_score to get highest in case of duplicates
      const { data: userScoreArray } = await supabase
        .from('user_scores')
        .select('initial_score, earned_score, swipe_count, match_count, total_score')
        .eq('user_id', userId)
        .eq('token_id', avloToken?.id || '')
        .order('total_score', { ascending: false })
        .limit(1);
      
      const userScore = userScoreArray?.[0] || null;

      // Fetch score transfers where user is payer OR recipient
      const { data: transfersData, error: transferError } = await supabase
        .from('score_transfers')
        .select(`
          id,
          payer_id,
          recipient_id,
          amount_usd,
          score_transferred,
          created_at
        `)
        .or(`payer_id.eq.${userId},recipient_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(20);
      
      console.log('[ScoreBreakdown] Transfers for', userId, ':', transfersData, transferError);

      // Fetch profiles for transfers
      if (transfersData && transfersData.length > 0) {
        const userIds = new Set<string>();
        transfersData.forEach(t => {
          userIds.add(t.payer_id);
          userIds.add(t.recipient_id);
        });

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', Array.from(userIds));

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        const enrichedTransfers = transfersData.map(t => ({
          ...t,
          payer: profileMap.get(t.payer_id),
          recipient: profileMap.get(t.recipient_id)
        }));

        setTransfers(enrichedTransfers as ScoreTransfer[]);
      } else {
        setTransfers([]);
      }

      // Calculate breakdown
      const stolenFromOthers = (transfersData || [])
        .filter(t => t.payer_id === userId)
        .reduce((sum, t) => sum + t.score_transferred, 0);

      const stolenByOthers = (transfersData || [])
        .filter(t => t.recipient_id === userId)
        .reduce((sum, t) => sum + t.score_transferred, 0);

      setBreakdown({
        initial_score: userScore?.initial_score || 0,
        swipe_count: userScore?.swipe_count || 0,
        match_count: userScore?.match_count || 0,
        stolen_from_others: stolenFromOthers,
        stolen_by_others: stolenByOthers
      });
      setHasFetched(true);
    } catch (error) {
      console.error('Error fetching score breakdown:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`bg-zinc-900/80 border rounded-xl overflow-hidden ${isCurrentUser ? 'border-orange-500/50' : 'border-zinc-800'}`}>
      {/* Header - Clickable */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {/* Rank Badge */}
          {rank !== undefined && (
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm shrink-0 ${
              rank === 1 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black' :
              rank === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-black' :
              rank === 3 ? 'bg-gradient-to-br from-amber-600 to-amber-800 text-white' :
              'bg-zinc-800 text-zinc-400 border border-zinc-700'
            }`}>
              {rank <= 3 ? (
                rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'
              ) : (
                <span className="flex items-center"><Hash className="w-3 h-3" />{rank}</span>
              )}
            </div>
          )}
          
          <Avatar className={`w-10 h-10 border-2 ${isCurrentUser ? 'border-orange-500' : 'border-purple-500/50'}`}>
            <AvatarImage src={getAvatarUrl(avatarUrl, username)} />
            <AvatarFallback className="bg-zinc-800 text-zinc-300">
              {username[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="text-white font-bold text-sm">{displayName || username}</h3>
              {isCurrentUser && (
                <Badge className="bg-orange-500 text-white text-[10px] px-1.5 py-0">You</Badge>
              )}
            </div>
            <p className="text-zinc-500 text-xs">@{username}</p>
          </div>
        </div>
        
        {/* Stats for current user */}
        {isCurrentUser && swipeCount !== undefined && (
          <div className="hidden sm:flex items-center gap-3 text-xs">
            <div className="text-center px-2 py-1 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
              <div className="font-bold text-cyan-400">{swipeCount}</div>
              <div className="text-[10px] text-zinc-500">Swipes</div>
            </div>
            <div className="text-center px-2 py-1 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
              <div className="font-bold text-purple-400">{matchCount}</div>
              <div className="text-[10px] text-zinc-500">Matches</div>
            </div>
            <div className="text-center px-2 py-1 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
              <div className="font-bold text-orange-400">{referralCount}</div>
              <div className="text-[10px] text-zinc-500">Refs</div>
            </div>
          </div>
        )}
        
        <div className="flex items-center gap-3">
          <div className="text-right space-y-1">
            {/* Score with decay */}
            <div className="flex items-center justify-end gap-2">
              <motion.p 
                className={`text-lg font-black bg-gradient-to-r ${isCurrentUser ? 'from-orange-400 to-pink-400' : 'from-cyan-400 to-purple-400'} bg-clip-text text-transparent tabular-nums`}
                animate={isDecaying ? { opacity: [1, 0.7, 1] } : {}}
                transition={isDecaying ? { duration: 1.5, repeat: Infinity } : {}}
              >
                {effectiveScore.toLocaleString()}
              </motion.p>
              {isDecaying && decayAmount > 0 && (
                <span className="flex items-center gap-0.5 text-orange-400 text-xs">
                  <TrendingDown className="w-3 h-3" />
                  <span>-{decayAmount}</span>
                </span>
              )}
              {isOnline && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative rounded-full h-2 w-2 bg-green-500"></span>
                </span>
              )}
              {!isOnline && !isDecaying && (
                <WifiOff className="w-3 h-3 text-zinc-500" />
              )}
            </div>
            <p className={`text-[10px] flex items-center justify-end gap-1 ${effectiveScore >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              <Clock className="w-3 h-3" />
              {remainingTimeDisplay}
            </p>
            {/* Credit decay indicator - only show when offline and has decay */}
            {creditIsDecaying && creditPendingDecay > 0 && (
              <motion.div 
                className="flex items-center justify-end gap-1 text-[10px]"
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Coins className="w-3 h-3 text-orange-400" />
                <span className="text-orange-400 font-mono">-{creditPendingDecayDisplay}/s</span>
              </motion.div>
            )}
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-5 h-5 text-zinc-500" />
          </motion.div>
        </div>
      </button>

      {/* Content - Expandable */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 border-t border-zinc-800 space-y-4">
              {loading ? (
                <div className="space-y-3 py-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-10 bg-zinc-800 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : breakdown ? (
                <>
                  {/* Score Sources */}
                  <div className="space-y-2 pt-4">
                    <h4 className="text-white font-semibold text-xs flex items-center gap-2">
                      <Award className="w-4 h-4 text-cyan-400" />
                      Score Sources
                    </h4>
                    
                    {/* Initial Bonus */}
                    <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                      <div className="flex items-center gap-2">
                        <Gift className="w-4 h-4 text-yellow-400" />
                        <span className="text-zinc-400 text-sm">Initial Bonus</span>
                      </div>
                      <span className="text-yellow-400 font-bold">{breakdown.initial_score}</span>
                    </div>

                    {/* Swipes */}
                    <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                      <div className="flex items-center gap-2">
                        <Heart className="w-4 h-4 text-pink-400" />
                        <span className="text-zinc-400 text-sm">Right Swipes</span>
                      </div>
                      <span className="text-pink-400 font-bold">{breakdown.swipe_count} swipes</span>
                    </div>

                    {/* Matches */}
                    <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-purple-400" />
                        <span className="text-zinc-400 text-sm">Matches Made</span>
                      </div>
                      <span className="text-purple-400 font-bold">{breakdown.match_count} matches</span>
                    </div>
                  </div>

                  {/* Score Transfers */}
                  <div className="space-y-2">
                    <h4 className="text-white font-semibold text-xs flex items-center gap-2">
                      <ArrowRightLeft className="w-4 h-4 text-purple-400" />
                      Score Transfers
                    </h4>

                    {/* Stolen from others */}
                    <div className="flex items-center justify-between p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        <span className="text-zinc-400 text-sm">Stolen from Others</span>
                      </div>
                      <span className="text-emerald-400 font-bold">+{breakdown.stolen_from_others}</span>
                    </div>

                    {/* Stolen by others */}
                    <div className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-red-400" />
                        <span className="text-zinc-400 text-sm">Lost to Others</span>
                      </div>
                      <span className="text-red-400 font-bold">-{breakdown.stolen_by_others}</span>
                    </div>
                  </div>

                  {/* Recent Transfers */}
                  {transfers.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-white font-semibold text-xs">Recent Transfers</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                        {transfers.slice(0, 10).map((transfer) => {
                          const isGain = transfer.payer_id === userId;
                          const otherUser = isGain ? transfer.recipient : transfer.payer;
                          
                          return (
                            <div
                              key={transfer.id}
                              className={`flex items-center justify-between p-2 rounded-lg text-sm ${
                                isGain 
                                  ? 'bg-emerald-500/5 border border-emerald-500/10' 
                                  : 'bg-red-500/5 border border-red-500/10'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {isGain ? (
                                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <TrendingDown className="w-3 h-3 text-red-400" />
                                )}
                                <Avatar className="w-6 h-6">
                                  <AvatarImage src={getAvatarUrl(otherUser?.avatar_url || null, otherUser?.username || '')} />
                                  <AvatarFallback className="text-[10px] bg-zinc-800">
                                    {otherUser?.username?.[0]?.toUpperCase() || '?'}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-zinc-400">
                                  {isGain ? 'from' : 'to'}{' '}
                                  <span className={isGain ? 'text-emerald-400' : 'text-red-400'}>
                                    @{otherUser?.username || 'Unknown'}
                                  </span>
                                </span>
                              </div>
                              <div className="text-right">
                                <span className={`font-bold ${isGain ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {isGain ? '+' : '-'}{transfer.score_transferred}
                                </span>
                                <p className="text-[10px] text-zinc-600">
                                  {formatDistanceToNow(new Date(transfer.created_at), { addSuffix: true })}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center text-zinc-500 py-4 text-sm">
                  No score data available
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
