import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Repeat, Coins, Activity, TrendingUp, Gamepad2, Music, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

interface UserStatsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  username: string;
}

interface UserActivity {
  type: 'game' | 'music' | 'watch';
  title: string;
  reward: number;
  timestamp: string;
}

export const UserStatsPopup = ({ isOpen, onClose, userId, username }: UserStatsPopupProps) => {
  const [stats, setStats] = useState({
    dailyTimeMinutes: 0,
    totalSwipes: 0,
    pendingRewards: 0,
    paidRewards: 0,
  });
  const [lastActivity, setLastActivity] = useState<UserActivity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && userId) {
      fetchUserStats();
    }
  }, [isOpen, userId]);

  const fetchUserStats = async () => {
    setLoading(true);
    try {
      // Fetch user's score - this determines their daily limit
      const { data: scoreData } = await supabase
        .from('user_scores')
        .select('total_score')
        .eq('user_id', userId)
        .maybeSingle();

      // Score determines allowed seconds: 1 point = 1 minute (same as edge function logic)
      const userScore = scoreData?.total_score || 1;
      const allowedSeconds = userScore * 60; // 1 point = 1 minute

      // Fetch swipes count
      const { count: swipesCount } = await supabase
        .from('swipes')
        .select('*', { count: 'exact', head: true })
        .eq('swiper_id', userId);

      // Fetch rewards
      const [{ data: gameRewards }, { data: musicRewards }, { data: watchRewards }] = await Promise.all([
        supabase.from('embedded_game_sessions').select('reward_earned, paid').eq('user_id', userId),
        supabase.from('music_track_listens').select('reward_earned, paid').eq('user_id', userId),
        supabase.from('watch_video_views').select('reward_earned, paid').eq('user_id', userId),
      ]);

      const allRewards = [...(gameRewards || []), ...(musicRewards || []), ...(watchRewards || [])];
      const pendingRewards = allRewards.filter(r => !r.paid).reduce((sum, r) => sum + (r.reward_earned || 0), 0);
      const paidRewards = allRewards.filter(r => r.paid).reduce((sum, r) => sum + (r.reward_earned || 0), 0);

      // Fetch last activity
      const [{ data: lastGame }, { data: lastMusic }, { data: lastWatch }] = await Promise.all([
        supabase
          .from('embedded_game_sessions')
          .select('game_title, reward_earned, started_at')
          .eq('user_id', userId)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('music_track_listens')
          .select('track:music_tracks(title), reward_earned, started_at')
          .eq('user_id', userId)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('watch_video_views')
          .select('video:watch_videos(title), reward_earned, started_at')
          .eq('user_id', userId)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const activities: UserActivity[] = [];
      if (lastGame) activities.push({ type: 'game', title: lastGame.game_title, reward: lastGame.reward_earned || 0, timestamp: lastGame.started_at });
      if (lastMusic) activities.push({ type: 'music', title: (lastMusic.track as any)?.title || 'Music', reward: lastMusic.reward_earned || 0, timestamp: lastMusic.started_at || '' });
      if (lastWatch) activities.push({ type: 'watch', title: (lastWatch.video as any)?.title || 'Video', reward: lastWatch.reward_earned || 0, timestamp: lastWatch.started_at || '' });

      const sortedActivities = activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setStats({
        dailyTimeMinutes: Math.floor(allowedSeconds / 60),
        totalSwipes: swipesCount || 0,
        pendingRewards,
        paidRewards,
      });
      setLastActivity(sortedActivities[0] || null);
    } catch (error) {
      console.error('Error fetching user stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'game': return <Gamepad2 className="w-4 h-4 text-purple-400" />;
      case 'music': return <Music className="w-4 h-4 text-green-400" />;
      case 'watch': return <Eye className="w-4 h-4 text-pink-400" />;
      default: return <Activity className="w-4 h-4 text-cyan-400" />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={onClose}
        >
          {/* Backdrop */}
          <motion.div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          
          {/* Popup */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4 text-white/70" />
            </button>
            
            {/* Icon */}
            <div className="flex justify-center mb-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 400 }}
                className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center"
              >
                <TrendingUp className="w-7 h-7 text-cyan-400" />
              </motion.div>
            </div>
            
            {/* Title */}
            <h3 className="text-lg font-bold text-white text-center mb-4">
              {username}'s Stats
            </h3>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {/* Daily Time Limit */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                    <Clock className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
                    <div className="text-lg font-bold text-cyan-400">{stats.dailyTimeMinutes}m</div>
                    <div className="text-[10px] text-white/50">Daily Time</div>
                  </div>

                  {/* Swipes */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                    <Repeat className="w-5 h-5 text-purple-400 mx-auto mb-1" />
                    <div className="text-lg font-bold text-purple-400">{stats.totalSwipes}</div>
                    <div className="text-[10px] text-white/50">Total Swipes</div>
                  </div>

                  {/* Pending Rewards */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                    <Coins className="w-5 h-5 text-orange-400 mx-auto mb-1" />
                    <div className="text-lg font-bold text-orange-400">
                      {stats.pendingRewards >= 1000 
                        ? `${(stats.pendingRewards / 1000).toFixed(1)}K` 
                        : stats.pendingRewards.toFixed(0)}
                    </div>
                    <div className="text-[10px] text-white/50">Pending AVLO</div>
                  </div>

                  {/* Paid Rewards */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                    <Coins className="w-5 h-5 text-green-400 mx-auto mb-1" />
                    <div className="text-lg font-bold text-green-400">
                      {stats.paidRewards >= 1000 
                        ? `${(stats.paidRewards / 1000).toFixed(1)}K` 
                        : stats.paidRewards.toFixed(0)}
                    </div>
                    <div className="text-[10px] text-white/50">Paid AVLO</div>
                  </div>
                </div>

                {/* Last Activity */}
                {lastActivity && (
                  <>
                    <div className="h-px bg-white/10 my-4" />
                    <div className="text-center">
                      <p className="text-white/50 text-xs mb-2">Last Activity</p>
                      <div className="flex items-center justify-center gap-2 bg-white/5 rounded-lg p-2">
                        <div className="p-1.5 rounded-lg bg-white/10">
                          {getActivityIcon(lastActivity.type)}
                        </div>
                        <div className="text-left">
                          <div className="text-white text-xs font-medium truncate max-w-[180px]">{lastActivity.title}</div>
                          <div className="text-[10px] text-white/40">
                            +{lastActivity.reward.toFixed(1)} AVLO • {formatTimeAgo(lastActivity.timestamp)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
            
            {/* Action button */}
            <Button
              onClick={onClose}
              className="w-full mt-5 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-medium"
            >
              Close
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};