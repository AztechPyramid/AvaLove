import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Heart, Gamepad2, FileText, Palette, Sparkles, ThumbsUp, 
  Music, Video, Coins, Star, TrendingUp, TrendingDown, Vote, MessageCircle,
  Users, Flame, Trophy, Gift, Zap, BadgeCheck, Bot
} from 'lucide-react';

// Extended notification types
export type ActivityType = 
  | 'match' | 'swipe' | 'post' | 'comment' | 'game' | 'pixel' 
  | 'music' | 'video' | 'staking' | 'unstaking' | 'tip' | 'follow' | 'proposal' | 'vote' | 'boost' | 'profile_boost' | 'token_listing' | 'swap_bought' | 'swap_sold' | 'agent_created';

export interface ActivityNotification {
  id: string;
  type: ActivityType;
  content: string;
  timestamp: string;
  data?: Record<string, any>;
}

interface UseCommunityActivityProps {
  enabled: boolean;
  onNewActivity?: (activity: ActivityNotification) => void;
  maxNotifications?: number;
}

export function useCommunityActivity({ enabled, onNewActivity, maxNotifications = 10 }: UseCommunityActivityProps) {
  const [notifications, setNotifications] = useState<ActivityNotification[]>([]);
  const [lastChecked, setLastChecked] = useState<Record<string, string>>(() => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    return {
      matches: oneHourAgo,
      swipes: oneHourAgo,
      posts: oneHourAgo,
      comments: oneHourAgo,
      games: oneHourAgo,
      pixels: oneHourAgo,
      music: oneHourAgo,
      videos: oneHourAgo,
      staking: oneHourAgo,
      tips: oneHourAgo,
      follows: oneHourAgo,
      proposals: oneHourAgo,
      votes: oneHourAgo,
      boosts: oneHourAgo,
      profileBoosts: oneHourAgo,
      tokenListings: oneHourAgo,
      swapBought: oneHourAgo,
      agents: oneHourAgo,
    };
  });
  const processedIds = useRef(new Set<string>());
  const initialLoadDone = useRef(false);

  const addNotification = useCallback((activity: ActivityNotification) => {
    if (processedIds.current.has(activity.id)) return;
    processedIds.current.add(activity.id);
    
    setNotifications(prev => {
      const updated = [...prev, activity];
      // Keep only last N notifications
      if (updated.length > maxNotifications) {
        return updated.slice(-maxNotifications);
      }
      return updated;
    });
    
    onNewActivity?.(activity);
  }, [maxNotifications, onNewActivity]);

  const checkForNewActivities = useCallback(async () => {
    if (!enabled) return;

    const newActivities: ActivityNotification[] = [];

    // 1. Check for new SWIPES (likes) with token info
    const { data: newSwipes } = await supabase
      .from('swipes')
      .select(`
        id, direction, created_at, amount, token_amount,
        swiper:swiper_id(username, display_name),
        swiped:swiped_id(username, display_name),
        token:token_id(token_symbol, token_logo_url),
        paymentToken:payment_token_id(token_symbol, logo_url)
      `)
      .eq('direction', 'right')
      .gt('created_at', lastChecked.swipes)
      .order('created_at', { ascending: false })
      .limit(5);

    newSwipes?.forEach(s => {
      const swiper = (s.swiper as any)?.display_name || (s.swiper as any)?.username || 'Someone';
      const swiped = (s.swiped as any)?.display_name || (s.swiped as any)?.username || 'someone';
      const tokenSymbol = (s.paymentToken as any)?.token_symbol || (s.token as any)?.token_symbol || 'AVLO';
      const tokenLogo = (s.paymentToken as any)?.logo_url || (s.token as any)?.token_logo_url || null;
      // Use token_amount for display, fallback to amount if not set
      const displayAmount = s.token_amount || s.amount || 1000;
      newActivities.push({
        id: `swipe-${s.id}`,
        type: 'swipe',
        content: `${swiper} gifted ${swiped} ${displayAmount.toLocaleString()} ${tokenSymbol}! 🎁`,
        timestamp: s.created_at,
        data: { tokenLogo },
      });
    });

    // 2. Check for new MATCHES
    const { data: newMatches } = await supabase
      .from('matches')
      .select(`
        id, created_at,
        user1:user1_id(username, display_name),
        user2:user2_id(username, display_name)
      `)
      .gt('created_at', lastChecked.matches)
      .order('created_at', { ascending: false })
      .limit(5);

    newMatches?.forEach(m => {
      const u1 = (m.user1 as any)?.display_name || (m.user1 as any)?.username || 'Someone';
      const u2 = (m.user2 as any)?.display_name || (m.user2 as any)?.username || 'Someone';
      newActivities.push({
        id: `match-${m.id}`,
        type: 'match',
        content: `${u1} & ${u2} matched! 💕`,
        timestamp: m.created_at,
      });
    });

    // 3. Check for new POSTS
    const { data: newPosts } = await supabase
      .from('posts')
      .select(`
        id, content, created_at,
        author:user_id(username, display_name)
      `)
      .gt('created_at', lastChecked.posts)
      .order('created_at', { ascending: false })
      .limit(5);

    newPosts?.forEach(p => {
      const author = (p.author as any)?.display_name || (p.author as any)?.username || 'Someone';
      const preview = p.content?.substring(0, 25) || '';
      newActivities.push({
        id: `post-${p.id}`,
        type: 'post',
        content: `${author}: \"${preview}${p.content?.length > 25 ? '...' : ''}\"`,
        timestamp: p.created_at,
      });
    });

    // 4. Check for new POST COMMENTS
    const { data: newComments } = await supabase
      .from('post_comments')
      .select(`
        id, content, created_at,
        author:user_id(username, display_name)
      `)
      .gt('created_at', lastChecked.comments)
      .order('created_at', { ascending: false })
      .limit(5);

    newComments?.forEach(c => {
      const author = (c.author as any)?.display_name || (c.author as any)?.username || 'Someone';
      newActivities.push({
        id: `comment-${c.id}`,
        type: 'comment',
        content: `${author} commented on a post 💬`,
        timestamp: c.created_at,
      });
    });

    // 5. Check for new GAME SESSIONS
    const { data: newGames } = await supabase
      .from('embedded_game_sessions')
      .select(`
        id, game_title, created_at,
        player:user_id(username, display_name)
      `)
      .eq('status', 'playing')
      .gt('created_at', lastChecked.games)
      .order('created_at', { ascending: false })
      .limit(5);

    newGames?.forEach(g => {
      const player = (g.player as any)?.display_name || (g.player as any)?.username || 'Someone';
      newActivities.push({
        id: `game-${g.id}`,
        type: 'game',
        content: `${player} playing ${g.game_title} 🎮`,
        timestamp: g.created_at,
      });
    });

    // 6. Check for new PIXELS
    const { data: newPixels } = await supabase
      .from('pixels')
      .select(`
        id, color, placed_at,
        artist:placed_by(username, display_name)
      `)
      .gt('placed_at', lastChecked.pixels)
      .order('placed_at', { ascending: false })
      .limit(5);

    newPixels?.forEach(p => {
      const artist = (p.artist as any)?.display_name || (p.artist as any)?.username || 'Someone';
      newActivities.push({
        id: `pixel-${p.id}`,
        type: 'pixel',
        content: `${artist} placed a pixel! 🎨`,
        timestamp: p.placed_at || new Date().toISOString(),
      });
    });

    // 7. Check for new MUSIC LISTENS
    const { data: newMusic } = await supabase
      .from('music_track_listens')
      .select(`
        id, created_at,
        listener:user_id(username, display_name),
        track:track_id(title, artist)
      `)
      .gt('created_at', lastChecked.music)
      .order('created_at', { ascending: false })
      .limit(5);

    newMusic?.forEach(m => {
      const listener = (m.listener as any)?.display_name || (m.listener as any)?.username || 'Someone';
      const track = (m.track as any)?.title || 'a track';
      newActivities.push({
        id: `music-${m.id}`,
        type: 'music',
        content: `${listener} listening to \"${track}\" 🎵`,
        timestamp: m.created_at,
      });
    });

    // 8. Check for new VIDEO WATCHES
    const { data: newVideos } = await supabase
      .from('watch_video_views')
      .select(`
        id, created_at,
        viewer:user_id(username, display_name)
      `)
      .gt('created_at', lastChecked.videos)
      .order('created_at', { ascending: false })
      .limit(5);

    newVideos?.forEach(v => {
      const viewer = (v.viewer as any)?.display_name || (v.viewer as any)?.username || 'Someone';
      newActivities.push({
        id: `video-${v.id}`,
        type: 'video',
        content: `${viewer} is watching a video 📺`,
        timestamp: v.created_at,
      });
    });

    // 9. Check for new STAKES
    const { data: newStakes } = await supabase
      .from('staking_transactions')
      .select(`
        id, amount, created_at,
        staker:user_id(username, display_name)
      `)
      .eq('transaction_type', 'stake')
      .gt('created_at', lastChecked.staking)
      .order('created_at', { ascending: false })
      .limit(2);

    newStakes?.forEach(s => {
      const staker = (s.staker as any)?.display_name || (s.staker as any)?.username || 'Someone';
      newActivities.push({
        id: `stake-${s.id}`,
        type: 'staking',
        content: `${staker} staked ${s.amount} tokens! 💰`,
        timestamp: s.created_at,
      });
    });

    // 9b. Check for new UNSTAKES
    const { data: newUnstakes } = await supabase
      .from('staking_transactions')
      .select(`
        id, amount, created_at,
        staker:user_id(username, display_name)
      `)
      .eq('transaction_type', 'withdraw')
      .gt('created_at', lastChecked.staking)
      .order('created_at', { ascending: false })
      .limit(2);

    newUnstakes?.forEach(s => {
      const staker = (s.staker as any)?.display_name || (s.staker as any)?.username || 'Someone';
      newActivities.push({
        id: `unstake-${s.id}`,
        type: 'unstaking',
        content: `${staker} unstaked ${s.amount} tokens! 📤`,
        timestamp: s.created_at,
      });
    });

    // 10. Check for new FOLLOWS
    const { data: newFollows } = await supabase
      .from('followers')
      .select(`
        id, created_at,
        follower:follower_id(username, display_name),
        following:following_id(username, display_name)
      `)
      .gt('created_at', lastChecked.follows)
      .order('created_at', { ascending: false })
      .limit(5);

    newFollows?.forEach(f => {
      const follower = (f.follower as any)?.display_name || (f.follower as any)?.username || 'Someone';
      const following = (f.following as any)?.display_name || (f.following as any)?.username || 'someone';
      newActivities.push({
        id: `follow-${f.id}`,
        type: 'follow',
        content: `${follower} followed ${following} 👥`,
        timestamp: f.created_at,
      });
    });

    // 11. Check for new DAO PROPOSALS
    const { data: newProposals } = await supabase
      .from('community_proposals')
      .select(`
        id, title, created_at,
        creator:created_by(username, display_name)
      `)
      .gt('created_at', lastChecked.proposals)
      .order('created_at', { ascending: false })
      .limit(5);

    newProposals?.forEach(p => {
      const creator = (p.creator as any)?.display_name || (p.creator as any)?.username || 'Someone';
      newActivities.push({
        id: `proposal-${p.id}`,
        type: 'proposal',
        content: `${creator} created poll: \"${p.title?.substring(0, 20)}...\"`,
        timestamp: p.created_at,
        data: { proposalId: p.id, title: p.title },
      });
    });

    // 12. Check for new VOTES
    const { data: newVotes } = await supabase
      .from('community_votes')
      .select(`
        id, created_at,
        voter:user_id(username, display_name),
        proposal:proposal_id(title)
      `)
      .gt('created_at', lastChecked.votes)
      .order('created_at', { ascending: false })
      .limit(5);

    newVotes?.forEach(v => {
      const voter = (v.voter as any)?.display_name || (v.voter as any)?.username || 'Someone';
      newActivities.push({
        id: `vote-${v.id}`,
        type: 'vote',
        content: `${voter} voted on a poll! 🗳️`,
        timestamp: v.created_at,
      });
    });

    // 13. Check for new POOL BOOSTS
    const { data: newBoosts } = await supabase
      .from('staking_pool_boosts')
      .select(`
        id, amount, created_at,
        booster:user_id(username, display_name),
        pool:pool_id(title)
      `)
      .gt('created_at', lastChecked.boosts)
      .order('created_at', { ascending: false })
      .limit(5);

    newBoosts?.forEach(b => {
      const booster = (b.booster as any)?.display_name || (b.booster as any)?.username || 'Someone';
      const poolTitle = (b.pool as any)?.title || 'a pool';
      newActivities.push({
        id: `boost-${b.id}`,
        type: 'boost',
        content: `${booster} boosted ${poolTitle} with ${b.amount} AVLO! 🔥`,
        timestamp: b.created_at,
      });
    });

    // 14. Check for new PROFILE BOOSTS
    const { data: newProfileBoosts } = await supabase
      .from('swipe_profile_boosts')
      .select(`
        id, amount, created_at,
        booster:booster_id(username, display_name),
        profile:profile_id(username, display_name)
      `)
      .gt('created_at', lastChecked.profileBoosts)
      .order('created_at', { ascending: false })
      .limit(5);

    newProfileBoosts?.forEach(b => {
      const booster = (b.booster as any)?.display_name || (b.booster as any)?.username || 'Someone';
      const profile = (b.profile as any)?.display_name || (b.profile as any)?.username || 'someone';
      newActivities.push({
        id: `profile-boost-${b.id}`,
        type: 'profile_boost',
        content: `${booster} boosted ${profile}'s profile with ${b.amount} AVLO! 🔥`,
        timestamp: b.created_at,
      });
    });

    // 15. Check for new TOKEN LISTINGS
    const { data: newTokenListings } = await supabase
      .from('user_token_submissions')
      .select(`
        id, token_name, token_symbol, logo_url, created_at,
        submitter:user_id(username, display_name)
      `)
      .eq('is_active', true)
      .gt('created_at', lastChecked.tokenListings)
      .order('created_at', { ascending: false })
      .limit(5);

    newTokenListings?.forEach(t => {
      const submitter = (t.submitter as any)?.display_name || (t.submitter as any)?.username || 'Someone';
      newActivities.push({
        id: `token-listing-${t.id}`,
        type: 'token_listing',
        content: `${submitter} listed ${t.token_symbol} token! 🪙`,
        timestamp: t.created_at,
        data: { tokenLogo: t.logo_url, tokenSymbol: t.token_symbol },
      });
    });

    // 16. Check for new AVLO SWAP TRANSACTIONS (buys and sells)
    const { data: newSwaps } = await supabase
      .from('swap_transactions')
      .select(`
        id, src_token, dest_token, src_amount, dest_amount, created_at,
        buyer:user_id(username, display_name)
      `)
      .gt('created_at', lastChecked.swapBought)
      .order('created_at', { ascending: false })
      .limit(5);

    newSwaps?.forEach(s => {
      const buyer = (s.buyer as any)?.display_name || (s.buyer as any)?.username || 'Someone';
      const isBuy = s.dest_token === 'AVLO';
      const amount = isBuy 
        ? (parseFloat(String(s.dest_amount)) || 0) 
        : (parseFloat(String(s.src_amount)) || 0);
      newActivities.push({
        id: `swap-${s.id}`,
        type: isBuy ? 'swap_bought' : 'swap_sold',
        content: isBuy 
          ? `${buyer} bought ${amount.toLocaleString()} AVLO! 🚀🔥`
          : `${buyer} sold ${amount.toLocaleString()} AVLO 📉`,
        timestamp: s.created_at,
      });
    });

    // 17. Check for new AI AGENTS
    const { data: newAgents } = await supabase
      .from('arena_agents')
      .select(`
        id, agent_name, agent_handle, profile_picture_url, created_at,
        creator:user_id(username, display_name)
      `)
      .gt('created_at', lastChecked.agents)
      .order('created_at', { ascending: false })
      .limit(3);

    newAgents?.forEach(a => {
      const creator = (a.creator as any)?.display_name || (a.creator as any)?.username || 'Someone';
      newActivities.push({
        id: `agent-${a.id}`,
        type: 'agent_created',
        content: `${creator} created AI agent @${a.agent_handle} 🤖`,
        timestamp: a.created_at,
      });
    });

    // Update last checked timestamps
    const now = new Date().toISOString();
    setLastChecked({
      matches: now,
      swipes: now,
      posts: now,
      comments: now,
      games: now,
      pixels: now,
      music: now,
      videos: now,
      staking: now,
      tips: now,
      follows: now,
      proposals: now,
      votes: now,
      boosts: now,
      profileBoosts: now,
      tokenListings: now,
      swapBought: now,
      agents: now,
    });

    // Sort by timestamp and add all
    newActivities.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    newActivities.forEach(activity => addNotification(activity));
  }, [enabled, lastChecked, addNotification]);

  useEffect(() => {
    if (!enabled) return;

    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      checkForNewActivities();
    }

    // Check every 45 seconds
    const interval = setInterval(checkForNewActivities, 45000);
    
    return () => clearInterval(interval);
  }, [enabled, checkForNewActivities]);

  return { notifications, checkForNewActivities };
}

// Activity styling configuration
const activityConfig: Record<ActivityType, {
  icon: React.ElementType;
  gradient: string;
  iconColor: string;
  glow?: string;
}> = {
  match: { icon: Heart, gradient: 'from-pink-500/30 to-red-500/30', iconColor: 'text-pink-400', glow: 'shadow-pink-500/20' },
  swipe: { icon: ThumbsUp, gradient: 'from-rose-500/30 to-pink-500/30', iconColor: 'text-rose-400', glow: 'shadow-rose-500/20' },
  post: { icon: FileText, gradient: 'from-purple-500/30 to-violet-500/30', iconColor: 'text-purple-400', glow: 'shadow-purple-500/20' },
  comment: { icon: MessageCircle, gradient: 'from-indigo-500/30 to-purple-500/30', iconColor: 'text-indigo-400', glow: 'shadow-indigo-500/20' },
  game: { icon: Gamepad2, gradient: 'from-green-500/30 to-emerald-500/30', iconColor: 'text-green-400', glow: 'shadow-green-500/20' },
  pixel: { icon: Palette, gradient: 'from-orange-500/30 to-yellow-500/30', iconColor: 'text-orange-400', glow: 'shadow-orange-500/20' },
  music: { icon: Music, gradient: 'from-cyan-500/30 to-blue-500/30', iconColor: 'text-cyan-400', glow: 'shadow-cyan-500/20' },
  video: { icon: Video, gradient: 'from-red-500/30 to-orange-500/30', iconColor: 'text-red-400', glow: 'shadow-red-500/20' },
  staking: { icon: Coins, gradient: 'from-yellow-500/30 to-amber-500/30', iconColor: 'text-yellow-400', glow: 'shadow-yellow-500/20' },
  unstaking: { icon: Coins, gradient: 'from-red-500/30 to-orange-500/30', iconColor: 'text-red-400', glow: 'shadow-red-500/20' },
  tip: { icon: Gift, gradient: 'from-emerald-500/30 to-teal-500/30', iconColor: 'text-emerald-400', glow: 'shadow-emerald-500/20' },
  follow: { icon: Users, gradient: 'from-blue-500/30 to-indigo-500/30', iconColor: 'text-blue-400', glow: 'shadow-blue-500/20' },
  proposal: { icon: Vote, gradient: 'from-amber-500/30 to-orange-500/30', iconColor: 'text-amber-400', glow: 'shadow-amber-500/20' },
  vote: { icon: TrendingUp, gradient: 'from-lime-500/30 to-green-500/30', iconColor: 'text-lime-400', glow: 'shadow-lime-500/20' },
  boost: { icon: Flame, gradient: 'from-purple-500/30 to-pink-500/30', iconColor: 'text-purple-400', glow: 'shadow-purple-500/20' },
  profile_boost: { icon: Flame, gradient: 'from-pink-500/30 to-rose-500/30', iconColor: 'text-pink-400', glow: 'shadow-pink-500/20' },
  token_listing: { icon: BadgeCheck, gradient: 'from-blue-500/30 to-cyan-500/30', iconColor: 'text-blue-400', glow: 'shadow-blue-500/20' },
  swap_bought: { icon: TrendingUp, gradient: 'from-green-500/30 to-emerald-500/30', iconColor: 'text-green-400', glow: 'shadow-green-500/20' },
  swap_sold: { icon: TrendingDown, gradient: 'from-red-500/30 to-rose-500/30', iconColor: 'text-red-400', glow: 'shadow-red-500/20' },
  agent_created: { icon: Bot, gradient: 'from-purple-500/30 to-cyan-500/30', iconColor: 'text-purple-400', glow: 'shadow-purple-500/20' },
};

interface ActivityMessageProps {
  content: string;
  type: ActivityType;
  tokenLogo?: string | null;
  onClick?: () => void;
}

export function ActivityMessage({ content, type, tokenLogo, onClick }: ActivityMessageProps) {
  const config = activityConfig[type];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="flex justify-center my-1.5"
      onClick={onClick}
    >
      <div 
        className={`
          flex items-center gap-2 px-4 py-2 rounded-full 
          bg-gradient-to-r ${config.gradient} 
          border border-white/10 backdrop-blur-md
          shadow-lg ${config.glow || ''}
          ${onClick ? 'cursor-pointer hover:scale-105 transition-transform' : ''}
        `}
      >
        <Sparkles className="w-3 h-3 text-white/60 animate-pulse" />
        <Icon className={`w-4 h-4 ${config.iconColor}`} />
        {tokenLogo && (
          <img
            src={tokenLogo}
            alt=""
            className="w-4 h-4 rounded-full"
            loading="lazy"
          />
        )}
        <span className="text-xs font-medium text-white/90">{content}</span>
        <Zap className="w-3 h-3 text-yellow-400/60" />
      </div>
    </motion.div>
  );
}

// Rotating notification ticker
interface ActivityTickerProps {
  notifications: ActivityNotification[];
  onNotificationClick?: (notification: ActivityNotification) => void;
}

export function ActivityTicker({ notifications, onNotificationClick }: ActivityTickerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (notifications.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % notifications.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [notifications.length]);

  if (notifications.length === 0) return null;

  const current = notifications[currentIndex];

  return (
    <div className="relative w-full h-10 overflow-hidden bg-gradient-to-r from-zinc-900/80 via-black/60 to-zinc-900/80">
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -50, opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          className="absolute inset-0 flex items-center justify-center w-full"
        >
          <ActivityMessage 
            content={current.content} 
            type={current.type}
            tokenLogo={(current.data as any)?.tokenLogo || null}
            onClick={() => onNotificationClick?.(current)}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
