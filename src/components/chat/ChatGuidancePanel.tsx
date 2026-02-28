import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { useAvloBalance } from '@/hooks/useAvloBalance';
import { useLimitPeriod, periodLabelsEn } from '@/hooks/useLimitPeriod';
import { useRewardPerSecond } from '@/hooks/useRewardPerSecond';
import { Trophy, Clock, Zap, ArrowRight, Gamepad2, Tv, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ChatGuidancePanelProps {
  isGlobalChat: boolean;
}

export default function ChatGuidancePanel({ isGlobalChat }: ChatGuidancePanelProps) {
  const { profile } = useWalletAuth();
  const { balance: avloBalance } = useAvloBalance();
  const { period, periodLabelEn } = useLimitPeriod();
  const { rewardPerSecond } = useRewardPerSecond();
  const [leaderboardScore, setLeaderboardScore] = useState<number>(0);
  const [dailyMinutes, setDailyMinutes] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id || !isGlobalChat) return;
    
    fetchUserStats();
    
    // Refresh every 2 minutes
    const interval = setInterval(fetchUserStats, 120000);
    return () => clearInterval(interval);
  }, [profile?.id, isGlobalChat, period]);

  const fetchUserStats = async () => {
    if (!profile?.id) return;

    try {
      // Fetch leaderboard score from user_scores table - sum all scores for this user
      const { data: scoreData } = await supabase
        .from('user_scores')
        .select('total_score')
        .eq('user_id', profile.id);

      // Sum all scores for this user (they might have multiple token entries)
      const totalScore = scoreData?.reduce((sum, s) => sum + (s.total_score || 0), 0) || 0;
      setLeaderboardScore(totalScore);

      // Calculate daily minutes based on period
      const now = new Date();
      let startDate: Date;
      
      switch (period) {
        case 'weekly':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
          break;
        case 'monthly':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'yearly':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default: // daily
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      }

      // Calculate earned minutes from game sessions
      const { data: gameSessions } = await supabase
        .from('embedded_game_sessions')
        .select('play_time_seconds')
        .eq('user_id', profile.id)
        .gte('created_at', startDate.toISOString());

      const totalGameSeconds = gameSessions?.reduce((sum, s) => sum + (s.play_time_seconds || 0), 0) || 0;
      
      // Also check watch time and music time (using correct column names)
      const { data: watchViews } = await supabase
        .from('watch_video_views')
        .select('play_time_seconds')
        .eq('user_id', profile.id)
        .gte('created_at', startDate.toISOString());

      const totalWatchSeconds = watchViews?.reduce((sum, s) => sum + (s.play_time_seconds || 0), 0) || 0;

      const { data: musicListens } = await supabase
        .from('music_track_listens')
        .select('play_time_seconds')
        .eq('user_id', profile.id)
        .gte('created_at', startDate.toISOString());

      const totalMusicSeconds = musicListens?.reduce((sum, s) => sum + (s.play_time_seconds || 0), 0) || 0;

      const totalMinutes = Math.floor((totalGameSeconds + totalWatchSeconds + totalMusicSeconds) / 60);
      setDailyMinutes(totalMinutes);
    } catch (error) {
      console.error('Error fetching user stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isGlobalChat || loading) return null;

  // Guidance logic
  const needsScore = leaderboardScore <= 1;
  const hasScoreNoCredits = leaderboardScore > 1 && avloBalance <= 0;
  const isReady = leaderboardScore > 1 && avloBalance > 0;

  return (
    <div className="bg-gradient-to-r from-zinc-900/90 via-zinc-800/90 to-zinc-900/90 border-b border-zinc-700/50 px-3 py-2">
      {/* Stats Row */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-4">
          {/* Leaderboard Score */}
          <div className="flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-zinc-400">Score:</span>
            <span className="text-sm font-bold text-yellow-400">{leaderboardScore.toLocaleString()}</span>
          </div>
          
          {/* Daily/Period Minutes */}
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-zinc-400">{periodLabelEn}:</span>
            <span className="text-sm font-bold text-cyan-400">{dailyMinutes} min</span>
          </div>
          
          {/* AVLO Credits */}
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-orange-400" />
            <span className="text-xs text-zinc-400">Credits:</span>
            <span className="text-sm font-bold text-orange-400">{Math.floor(avloBalance).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Guidance Message */}
      <div className="text-center">
        {needsScore && (
          <div className="flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20 rounded-lg px-3 py-2">
            <Heart className="w-4 h-4 text-pink-400 animate-pulse" />
            <p className="text-xs text-zinc-300">
              <span className="text-pink-400 font-semibold">Start your journey!</span> Right swipe on{' '}
              <Link to="/discover" className="text-pink-400 hover:text-pink-300 underline">Discover</Link>{' '}
              to burn AVLO/tokens and earn Score points. Score unlocks {periodLabelEn.toLowerCase()} minutes!
            </p>
            <ArrowRight className="w-4 h-4 text-pink-400" />
          </div>
        )}

        {hasScoreNoCredits && (
          <div className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/20 rounded-lg px-3 py-2">
            <Gamepad2 className="w-4 h-4 text-orange-400 animate-pulse" />
            <p className="text-xs text-zinc-300">
              <span className="text-orange-400 font-semibold">Earn Credits!</span> Play{' '}
              <Link to="/games" className="text-orange-400 hover:text-orange-300 underline">Games</Link>{' '}
              or watch{' '}
              <Link to="/watch" className="text-orange-400 hover:text-orange-300 underline">Videos</Link>{' '}
              to convert your {dailyMinutes > 0 ? `${dailyMinutes} earned minutes` : 'time'} into AVLO Credits for chat & LoveArt.
            </p>
            <Tv className="w-4 h-4 text-yellow-400" />
          </div>
        )}

        {isReady && (
          <div className="flex items-center justify-center gap-2 bg-gradient-to-r from-green-500/10 to-cyan-500/10 border border-green-500/20 rounded-lg px-3 py-2">
            <Zap className="w-4 h-4 text-green-400" />
            <p className="text-xs text-zinc-300">
              <span className="text-green-400 font-semibold">You're powered up!</span>{' '}
              {Math.floor(avloBalance)} credits ready. Earn {rewardPerSecond.toFixed(4)} AVLO/sec in{' '}
              <Link to="/games" className="text-cyan-400 hover:text-cyan-300 underline">Games</Link> &{' '}
              <Link to="/watch" className="text-cyan-400 hover:text-cyan-300 underline">Watch</Link>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
