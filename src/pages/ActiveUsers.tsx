import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { useOnlineUsersContext } from '@/contexts/OnlineUsersContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getAvatarUrl } from '@/lib/defaultAvatars';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Users, 
  Gamepad2, 
  Play, 
  Music, 
  Heart, 
  Flame, 
  MessageCircle,
  Clock,
  Trophy,
  Coins,
  Eye,
  RefreshCw,
  ChevronRight
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ActiveUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  arena_verified: boolean;
  current_activity: 'game' | 'video' | 'music' | 'discover' | 'idle';
  activity_title: string | null;
  online_since: string;
  stats: {
    total_burned: number;
    total_swipes: number;
    total_matches: number;
    total_messages: number;
    total_posts: number;
    airdrop_score: number;
    play_time_minutes: number;
    watch_time_minutes: number;
    listen_time_minutes: number;
  };
}

const USERS_PER_PAGE = 10;

export default function ActiveUsers() {
  const navigate = useNavigate();
  const { profile } = useWalletAuth();
  const [users, setUsers] = useState<ActiveUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  
  // Import centralized online users context
  const { onlineUserIds } = useOnlineUsersContext();

  const fetchActiveUsers = useCallback(async (pageNum: number, append = false) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);

    try {
      const offset = pageNum * USERS_PER_PAGE;
      
      // Fetch profiles with recent activity
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select(`
          id,
          username,
          display_name,
          avatar_url,
          arena_verified
        `)
        .not('id', 'eq', profile?.id)
        .order('updated_at', { ascending: false })
        .range(offset, offset + USERS_PER_PAGE - 1);

      if (error) throw error;

      if (!profiles || profiles.length === 0) {
        setHasMore(false);
        if (!append) setUsers([]);
        return;
      }

      // Get user IDs for batch queries
      const userIds = profiles.map(p => p.id);

      // Fetch additional stats in parallel
      const [
        swipesData,
        matchesData,
        messagesData,
        postsData,
        scoresData,
        gameSessionsData,
        watchSessionsData,
        listenSessionsData,
        currentGameSessions,
        currentWatchSessions,
        currentListenSessions
      ] = await Promise.all([
        // Total swipes per user
        supabase.from('swipes').select('swiper_id').in('swiper_id', userIds),
        // Total matches
        supabase.from('matches').select('user1_id, user2_id'),
        // Total messages
        supabase.from('messages').select('sender_id').in('sender_id', userIds),
        // Total posts with cost (for burned calculation)
        supabase.from('posts').select('user_id, cost').in('user_id', userIds),
        // Airdrop scores
        supabase.from('user_scores').select('user_id, total_score').in('user_id', userIds),
        // Game sessions
        supabase.from('embedded_game_sessions').select('user_id, play_time_seconds').in('user_id', userIds),
        // Watch sessions
        supabase.from('watch_video_views').select('user_id, play_time_seconds').in('user_id', userIds),
        // Listen sessions
        supabase.from('music_track_listens').select('user_id, play_time_seconds').in('user_id', userIds),
        // Current game sessions (active)
        supabase.from('embedded_game_sessions')
          .select('user_id, game_title, started_at')
          .in('user_id', userIds)
          .eq('status', 'active')
          .order('started_at', { ascending: false }),
        // Current watch sessions (active)
        supabase.from('watch_video_views')
          .select('user_id, started_at')
          .in('user_id', userIds)
          .eq('status', 'active')
          .order('started_at', { ascending: false }),
        // Current listen sessions (active)
        supabase.from('music_track_listens')
          .select('user_id, started_at, track_id')
          .in('user_id', userIds)
          .eq('status', 'active')
          .order('started_at', { ascending: false })
      ]);

      // Process data into user stats
      const userStatsMap = new Map<string, ActiveUser['stats']>();
      const userActivityMap = new Map<string, { activity: ActiveUser['current_activity'], title: string | null, since: string }>();

      userIds.forEach(id => {
        userStatsMap.set(id, {
          total_burned: 0,
          total_swipes: 0,
          total_matches: 0,
          total_messages: 0,
          total_posts: 0,
          airdrop_score: 0,
          play_time_minutes: 0,
          watch_time_minutes: 0,
          listen_time_minutes: 0
        });
        userActivityMap.set(id, { activity: 'idle', title: null, since: new Date().toISOString() });
      });

      // Count swipes per user
      swipesData.data?.forEach((s: any) => {
        const stats = userStatsMap.get(s.swiper_id);
        if (stats) stats.total_swipes++;
      });

      // Count matches
      matchesData.data?.forEach((m: any) => {
        if (userIds.includes(m.user1_id)) {
          const stats = userStatsMap.get(m.user1_id);
          if (stats) stats.total_matches++;
        }
        if (userIds.includes(m.user2_id)) {
          const stats = userStatsMap.get(m.user2_id);
          if (stats) stats.total_matches++;
        }
      });

      // Count messages
      messagesData.data?.forEach((m: any) => {
        const stats = userStatsMap.get(m.sender_id);
        if (stats) stats.total_messages++;
      });

      // Count posts and burned amount
      postsData.data?.forEach((p: any) => {
        const stats = userStatsMap.get(p.user_id);
        if (stats) {
          stats.total_posts++;
          stats.total_burned += (p.cost || 0);
        }
      });

      // Airdrop scores
      scoresData.data?.forEach((s: any) => {
        const stats = userStatsMap.get(s.user_id);
        if (stats) stats.airdrop_score = s.total_score || 0;
      });

      // Game time
      gameSessionsData.data?.forEach((g: any) => {
        const stats = userStatsMap.get(g.user_id);
        if (stats) stats.play_time_minutes += Math.floor((g.play_time_seconds || 0) / 60);
      });

      // Watch time
      watchSessionsData.data?.forEach((w: any) => {
        const stats = userStatsMap.get(w.user_id);
        if (stats) stats.watch_time_minutes += Math.floor((w.play_time_seconds || 0) / 60);
      });

      // Listen time
      listenSessionsData.data?.forEach((l: any) => {
        const stats = userStatsMap.get(l.user_id);
        if (stats) stats.listen_time_minutes += Math.floor((l.play_time_seconds || 0) / 60);
      });

      // Set current activities
      currentGameSessions.data?.forEach((g: any) => {
        const current = userActivityMap.get(g.user_id);
        if (current?.activity === 'idle') {
          userActivityMap.set(g.user_id, { activity: 'game', title: g.game_title, since: g.started_at });
        }
      });

      currentWatchSessions.data?.forEach((w: any) => {
        const current = userActivityMap.get(w.user_id);
        if (current?.activity === 'idle') {
          userActivityMap.set(w.user_id, { activity: 'video', title: 'Watching Video', since: w.started_at });
        }
      });

      currentListenSessions.data?.forEach((l: any) => {
        const current = userActivityMap.get(l.user_id);
        if (current?.activity === 'idle') {
          userActivityMap.set(l.user_id, { activity: 'music', title: 'Listening to Music', since: l.started_at });
        }
      });

      // Build active users list
      const activeUsers: ActiveUser[] = profiles.map(p => {
        const activity = userActivityMap.get(p.id) || { activity: 'idle' as const, title: null, since: new Date().toISOString() };
        return {
          id: p.id,
          username: p.username || 'Anonymous',
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          arena_verified: p.arena_verified || false,
          current_activity: activity.activity,
          activity_title: activity.title,
          online_since: activity.since,
          stats: userStatsMap.get(p.id)!
        };
      });

      if (append) {
        setUsers(prev => [...prev, ...activeUsers]);
      } else {
        setUsers(activeUsers);
      }

      setHasMore(profiles.length === USERS_PER_PAGE);
    } catch (error) {
      console.error('Error fetching active users:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchActiveUsers(0);
  }, [fetchActiveUsers]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchActiveUsers(nextPage, true);
  };

  const refresh = () => {
    setPage(0);
    fetchActiveUsers(0);
  };

  const getActivityIcon = (activity: ActiveUser['current_activity']) => {
    switch (activity) {
      case 'game': return <Gamepad2 className="w-4 h-4 text-green-400" />;
      case 'video': return <Play className="w-4 h-4 text-red-400" />;
      case 'music': return <Music className="w-4 h-4 text-purple-400" />;
      case 'discover': return <Heart className="w-4 h-4 text-pink-400" />;
      default: return <Eye className="w-4 h-4 text-zinc-400" />;
    }
  };

  const getActivityColor = (activity: ActiveUser['current_activity']) => {
    switch (activity) {
      case 'game': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'video': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'music': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'discover': return 'bg-pink-500/20 text-pink-400 border-pink-500/30';
      default: return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
    }
  };

  const getActivityLabel = (activity: ActiveUser['current_activity'], title: string | null) => {
    switch (activity) {
      case 'game': return title || 'Playing Game';
      case 'video': return 'Watching Video';
      case 'music': return 'Listening';
      case 'discover': return 'Discovering';
      default: return 'Online';
    }
  };

  const formatMinutes = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remaining = mins % 60;
    return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500/20 to-pink-500/20 border border-orange-500/30">
              <Users className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-pink-400 bg-clip-text text-transparent">
                Active Users
              </h1>
              <p className="text-sm text-zinc-400">
                {onlineUserIds.size} users online now
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            className="border-zinc-700 hover:bg-zinc-800"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Users Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="p-4 bg-zinc-900/50 border-zinc-800">
                <div className="flex items-start gap-4">
                  <Skeleton className="w-16 h-16 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-16 h-16 mx-auto text-zinc-600 mb-4" />
            <p className="text-zinc-400">No active users found</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Sort users: online first, then by activity */}
              {[...users].sort((a, b) => {
                const aOnline = onlineUserIds.has(a.id) || a.current_activity !== 'idle';
                const bOnline = onlineUserIds.has(b.id) || b.current_activity !== 'idle';
                if (aOnline && !bOnline) return -1;
                if (!aOnline && bOnline) return 1;
                return 0;
              }).map((user) => {
                const isOnline = onlineUserIds.has(user.id);
                return (
                  <Card
                    key={user.id}
                    className="p-3 bg-zinc-900/50 border-zinc-800 hover:border-orange-500/50 transition-all cursor-pointer group"
                    onClick={() => navigate(`/profile/${user.id}`)}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        {user.avatar_url && (user.avatar_url.endsWith('.mp4') || user.avatar_url.endsWith('.webm') || user.avatar_url.endsWith('.mov')) ? (
                          <div className="w-12 h-12 rounded-full border-2 border-zinc-700 overflow-hidden">
                            <video
                              src={user.avatar_url}
                              className="w-full h-full object-cover"
                              autoPlay
                              loop
                              muted
                              playsInline
                            />
                          </div>
                        ) : (
                          <Avatar className="w-12 h-12 border-2 border-zinc-700">
                            <AvatarImage src={getAvatarUrl(user.avatar_url, user.username || user.id)} />
                            <AvatarFallback className="bg-gradient-to-br from-orange-500 to-pink-500 text-white text-lg">
                              {user.username?.charAt(0).toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        {/* Online indicator */}
                        <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-zinc-900 ${
                          isOnline || user.current_activity !== 'idle' ? 'bg-green-500 animate-pulse' : 'bg-zinc-500'
                        }`} />
                      </div>

                      {/* User Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <h3 className="font-medium text-sm text-white truncate">
                            {user.display_name || user.username}
                          </h3>
                          {user.arena_verified && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-orange-500/20 text-orange-400 border-orange-500/30">
                              Arena
                            </Badge>
                          )}
                          <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-orange-400 transition-colors ml-auto flex-shrink-0" />
                        </div>
                        <p className="text-xs text-zinc-500 mb-1.5 truncate">@{user.username}</p>

                        {/* Current Activity */}
                        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${getActivityColor(user.current_activity)}`}>
                          {getActivityIcon(user.current_activity)}
                          <span className="truncate max-w-[100px]">
                            {getActivityLabel(user.current_activity, user.activity_title)}
                          </span>
                        </div>

                        {/* Compact Stats */}
                        <div className="flex items-center gap-2 mt-2 text-[10px] text-zinc-400">
                          <span className="flex items-center gap-0.5">
                            <Flame className="w-3 h-3 text-orange-400" />
                            {user.stats.total_burned.toLocaleString()}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Heart className="w-3 h-3 text-pink-400" />
                            {user.stats.total_swipes}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Trophy className="w-3 h-3 text-yellow-400" />
                            {user.stats.airdrop_score.toLocaleString()}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Gamepad2 className="w-3 h-3 text-green-400" />
                            {formatMinutes(user.stats.play_time_minutes)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="text-center mt-6">
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="border-zinc-700 hover:bg-zinc-800 px-8"
                >
                  {loadingMore ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
