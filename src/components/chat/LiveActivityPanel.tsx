import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame,
  Heart,
  Gamepad2,
  Video,
  Palette,
  MessageSquare,
  Coins,
  Zap,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ThumbsUp,
  UserPlus,
  Vote,
  Users,
  ThumbsDown,
  Rocket,
  Trophy,
  Bot,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ActivityType =
  | 'tip'
  | 'swipe_right'
  | 'swipe_left'
  | 'game_playing'
  | 'match'
  | 'watching_video'
  | 'pixel_placed'
  | 'post_created'
  | 'post_liked'
  | 'post_commented'
  | 'staked'
  | 'followed'
  | 'voted'
  | 'user_joined'
  | 'pool_created'
  | 'swap_bought'
  | 'swap_sold'
  | 'raffle_won'
  | 'blackjack_win'
  | 'blackjack_loss'
  | 'agent_created';

interface ActivityItem {
  id: string;
  type: ActivityType;
  senderName: string;
  senderAvatar?: string | null;
  receiverName?: string;
  receiverAvatar?: string | null;
  amount: number;
  timestamp: string;
  tokenSymbol?: string;
  tokenLogo?: string | null;
  extraInfo?: string;
  poolId?: string;
  color?: string;
  navigateTo?: string;
  paymentDestination?: 'burn' | 'tip' | 'team'; // where the payment went
}

const activityConfig: Record<
  ActivityType,
  {
    icon: React.ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
    label: string;
  }
> = {
  tip: { icon: Flame, color: 'text-orange-400', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/30', label: 'TIP' },
  swipe_right: { icon: Heart, color: 'text-pink-400', bgColor: 'bg-pink-500/10', borderColor: 'border-pink-500/30', label: 'LIKE' },
  swipe_left: { icon: ThumbsDown, color: 'text-zinc-400', bgColor: 'bg-zinc-500/10', borderColor: 'border-zinc-500/30', label: 'PASS' },
  game_playing: { icon: Gamepad2, color: 'text-purple-400', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/30', label: 'GAMING' },
  match: { icon: Heart, color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/30', label: 'MATCH' },
  watching_video: { icon: Video, color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30', label: 'WATCH' },
  pixel_placed: { icon: Palette, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10', borderColor: 'border-cyan-500/30', label: 'ART' },
  post_created: { icon: MessageSquare, color: 'text-yellow-400', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/30', label: 'POST' },
  post_liked: { icon: ThumbsUp, color: 'text-pink-400', bgColor: 'bg-pink-500/10', borderColor: 'border-pink-500/30', label: 'LIKED' },
  post_commented: { icon: MessageSquare, color: 'text-indigo-400', bgColor: 'bg-indigo-500/10', borderColor: 'border-indigo-500/30', label: 'COMMENT' },
  staked: { icon: Coins, color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30', label: 'STAKE' },
  followed: { icon: UserPlus, color: 'text-sky-400', bgColor: 'bg-sky-500/10', borderColor: 'border-sky-500/30', label: 'FOLLOW' },
  voted: { icon: Vote, color: 'text-violet-400', bgColor: 'bg-violet-500/10', borderColor: 'border-violet-500/30', label: 'VOTE' },
  user_joined: { icon: Users, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30', label: 'NEW' },
  pool_created: { icon: Rocket, color: 'text-orange-400', bgColor: 'bg-gradient-to-br from-orange-500/20 to-pink-500/20', borderColor: 'border-orange-500/40', label: 'NEW POOL' },
  swap_bought: { icon: TrendingUp, color: 'text-green-400', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/30', label: 'BUY' },
  swap_sold: { icon: TrendingDown, color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/30', label: 'SELL' },
  raffle_won: { icon: Trophy, color: 'text-yellow-400', bgColor: 'bg-gradient-to-br from-yellow-500/20 to-orange-500/20', borderColor: 'border-yellow-500/40', label: 'RAFFLE WIN' },
  blackjack_win: { icon: Trophy, color: 'text-green-400', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/30', label: 'BJ WIN' },
  blackjack_loss: { icon: TrendingDown, color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/30', label: 'BJ LOSS' },
  agent_created: { icon: Bot, color: 'text-purple-400', bgColor: 'bg-gradient-to-br from-purple-500/20 to-cyan-500/20', borderColor: 'border-purple-500/40', label: 'AI AGENT' },
};

export function LiveActivityPanel() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
    const interval = setInterval(fetchActivities, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchActivities = async () => {
    try {
      const allActivities: ActivityItem[] = [];

      // Run all queries in parallel for faster loading
      const [
        tipsResult,
        swipesResult,
        matchesResult,
        gamesResult,
        videosResult,
        pixelsResult,
        postsResult,
        likesResult,
        commentsResult,
        followsResult,
        votesResult,
        stakesResult,
        swapsResult,
        newUsersResult,
        newPoolsResult,
        raffleWinnersResult,
        blackjackResult,
        aiAgentsResult,
      ] = await Promise.all([
        // Tips
        supabase
          .from('tips')
          .select(`id, amount, created_at, sender:sender_id(username, avatar_url), receiver:receiver_id(username, avatar_url)`)
          .order('created_at', { ascending: false })
          .limit(2),
        // Swipes
        supabase
          .from('swipes')
          .select(`id, direction, amount, token_amount, payment_destination, created_at, swiper:swiper_id(username, avatar_url), swiped:swiped_id(username, avatar_url), token:token_id(token_symbol, token_logo_url), paymentToken:payment_token_id(token_symbol, logo_url)`)
          .order('created_at', { ascending: false })
          .limit(2),
        // Matches
        supabase
          .from('matches')
          .select(`id, created_at, user1:user1_id(username, avatar_url), user2:user2_id(username, avatar_url)`)
          .order('created_at', { ascending: false })
          .limit(2),
        // Games
        supabase
          .from('embedded_game_sessions')
          .select(`id, game_title, reward_earned, created_at, user:user_id(username, avatar_url)`)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(2),
        // Videos
        supabase
          .from('watch_video_views')
          .select(`id, earned_amount, created_at, user:user_id(username, avatar_url), video:video_id(title)`)
          .order('created_at', { ascending: false })
          .limit(2),
        // Pixels
        supabase
          .from('pixels')
          .select(`id, color, x, y, placed_at, user:placed_by(username, avatar_url)`)
          .order('placed_at', { ascending: false })
          .limit(2),
        // Posts
        supabase
          .from('posts')
          .select(`id, content, created_at, user:user_id(username, avatar_url)`)
          .order('created_at', { ascending: false })
          .limit(2),
        // Likes
        supabase
          .from('post_likes')
          .select(`id, created_at, user:user_id(username, avatar_url), post:post_id(user_id)`)
          .order('created_at', { ascending: false })
          .limit(2),
        // Comments
        supabase
          .from('post_comments')
          .select(`id, content, created_at, user:user_id(username, avatar_url), post:post_id(user_id)`)
          .order('created_at', { ascending: false })
          .limit(2),
        // Follows
        supabase
          .from('followers')
          .select(`id, created_at, follower:follower_id(id, username, avatar_url), following:following_id(id, username, avatar_url)`)
          .order('created_at', { ascending: false })
          .limit(2),
        // Votes
        supabase
          .from('community_votes')
          .select(`id, created_at, user:user_id(username, avatar_url), proposal:proposal_id(title)`)
          .order('created_at', { ascending: false })
          .limit(2),
        // Stakes
        supabase
          .from('staking_transactions')
          .select(`id, amount, token_symbol, pool_id, created_at, user:user_id(username, avatar_url), pool:pool_id(id, title, stake_token_logo)`)
          .eq('transaction_type', 'deposit')
          .order('created_at', { ascending: false })
          .limit(2),
        // Swaps (last 4)
        supabase
          .from('swap_transactions')
          .select(`id, created_at, src_token, dest_token, src_amount, dest_amount, user:user_id(username, avatar_url)`)
          .order('created_at', { ascending: false })
          .limit(4),
        // New Users
        supabase
          .from('profiles')
          .select(`id, username, avatar_url, created_at`)
          .order('created_at', { ascending: false })
          .limit(2),
        // New Staking Pools
        supabase
          .from('staking_pools')
          .select(`id, title, stake_token_logo, reward_token_logo, creator_wallet, created_at, creator:created_by(username, avatar_url)`)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(3),
        // Raffle Winners
        supabase
          .from('raffle_pools')
          .select(`
            id, pool_type, completed_at, 
            winner_1_amount, winner_2_amount, winner_3_amount,
            winner1:winner_1_id(username, avatar_url),
            winner2:winner_2_id(username, avatar_url),
            winner3:winner_3_id(username, avatar_url)
          `)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(1),
        // BlackJack sessions (last 3 wins/losses)
        supabase
          .from('blackjack_sessions')
          .select(`id, bet_amount, payout_amount, result, completed_at, user:user_id(username, avatar_url)`)
          .not('result', 'is', null)
          .order('completed_at', { ascending: false })
          .limit(3),
        // AI Agents
        supabase
          .from('arena_agents')
          .select(`id, agent_name, agent_handle, profile_picture_url, is_verified, created_at, creator:user_id(username, avatar_url)`)
          .order('created_at', { ascending: false })
          .limit(3),
      ]);

      // Process tips
      tipsResult.data?.forEach((tip: any) => {
        if (tip.sender && tip.receiver) {
          allActivities.push({
            id: `tip-${tip.id}`,
            type: 'tip',
            senderName: tip.sender.username,
            senderAvatar: tip.sender.avatar_url,
            receiverName: tip.receiver.username,
            receiverAvatar: tip.receiver.avatar_url,
            amount: tip.amount,
            timestamp: tip.created_at,
            navigateTo: '/discover',
          });
        }
      });

      // Process swipes
      swipesResult.data?.forEach((swipe: any) => {
        if (swipe.swiper && swipe.swiped) {
          const isRightSwipe = swipe.direction === 'right';
          const displayAmount = isRightSwipe
            ? (Number(swipe.token_amount) > 0 ? Number(swipe.token_amount) : (swipe.amount || 0))
            : 0;
          const destination = swipe.payment_destination || 'burn';

          allActivities.push({
            id: `swipe-${swipe.id}`,
            type: isRightSwipe ? 'swipe_right' : 'swipe_left',
            senderName: swipe.swiper.username,
            senderAvatar: swipe.swiper.avatar_url,
            receiverName: swipe.swiped.username,
            receiverAvatar: swipe.swiped.avatar_url,
            amount: displayAmount,
            tokenSymbol: isRightSwipe ? (swipe.paymentToken?.token_symbol || swipe.token?.token_symbol || undefined) : undefined,
            tokenLogo: isRightSwipe ? (swipe.paymentToken?.logo_url || swipe.token?.token_logo_url || null) : null,
            timestamp: swipe.created_at,
            navigateTo: '/discover',
            paymentDestination: isRightSwipe ? destination : undefined,
          });
        }
      });

      // Process matches
      matchesResult.data?.forEach((match: any) => {
        if (match.user1 && match.user2) {
          allActivities.push({
            id: `match-${match.id}`,
            type: 'match',
            senderName: match.user1.username,
            senderAvatar: match.user1.avatar_url,
            receiverName: match.user2.username,
            receiverAvatar: match.user2.avatar_url,
            amount: 0,
            timestamp: match.created_at,
            navigateTo: '/matches',
          });
        }
      });

      // Process games
      gamesResult.data?.forEach((game: any) => {
        if (game.user) {
          allActivities.push({
            id: `game-${game.id}`,
            type: 'game_playing',
            senderName: game.user.username,
            senderAvatar: game.user.avatar_url,
            amount: game.reward_earned || 0,
            timestamp: game.created_at,
            extraInfo: game.game_title,
            navigateTo: '/mini-games',
          });
        }
      });

      // Process videos
      videosResult.data?.forEach((session: any) => {
        if (session.user) {
          allActivities.push({
            id: `watch-${session.id}`,
            type: 'watching_video',
            senderName: session.user.username,
            senderAvatar: session.user.avatar_url,
            amount: session.earned_amount || 0,
            timestamp: session.created_at,
            extraInfo: session.video?.title,
            navigateTo: '/watch-earn',
          });
        }
      });

      // Process pixels
      pixelsResult.data?.forEach((pixel: any) => {
        if (pixel.user) {
          allActivities.push({
            id: `pixel-${pixel.id}`,
            type: 'pixel_placed',
            senderName: pixel.user.username,
            senderAvatar: pixel.user.avatar_url,
            amount: 0,
            timestamp: pixel.placed_at,
            color: pixel.color,
            extraInfo: `(${pixel.x}, ${pixel.y})`,
            navigateTo: '/loveart',
          });
        }
      });

      // Process posts
      postsResult.data?.forEach((post: any) => {
        if (post.user) {
          allActivities.push({
            id: `post-${post.id}`,
            type: 'post_created',
            senderName: post.user.username,
            senderAvatar: post.user.avatar_url,
            amount: 0,
            timestamp: post.created_at,
            extraInfo: post.content?.substring(0, 30),
            navigateTo: '/posts',
          });
        }
      });

      // Process likes - need additional query for post owners
      const likes = likesResult.data;
      if (likes && likes.length > 0) {
        const postUserIds = likes.map((l: any) => l.post?.user_id).filter(Boolean);
        let postOwners: Record<string, any> = {};
        if (postUserIds.length > 0) {
          const { data: owners } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .in('id', postUserIds);
          if (owners) {
            owners.forEach((o: any) => { postOwners[o.id] = o; });
          }
        }
        likes.forEach((like: any) => {
          if (like.user) {
            const owner = like.post?.user_id ? postOwners[like.post.user_id] : null;
            allActivities.push({
              id: `like-${like.id}`,
              type: 'post_liked',
              senderName: like.user.username,
              senderAvatar: like.user.avatar_url,
              receiverName: owner?.username,
              receiverAvatar: owner?.avatar_url,
              amount: 0,
              timestamp: like.created_at,
              navigateTo: '/posts',
            });
          }
        });
      }

      // Process comments - need additional query for post owners
      const comments = commentsResult.data;
      if (comments && comments.length > 0) {
        const commentPostUserIds = comments.map((c: any) => c.post?.user_id).filter(Boolean);
        let commentOwners: Record<string, any> = {};
        if (commentPostUserIds.length > 0) {
          const { data: cowners } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .in('id', commentPostUserIds);
          if (cowners) {
            cowners.forEach((o: any) => { commentOwners[o.id] = o; });
          }
        }
        comments.forEach((comment: any) => {
          if (comment.user) {
            const owner = comment.post?.user_id ? commentOwners[comment.post.user_id] : null;
            allActivities.push({
              id: `comment-${comment.id}`,
              type: 'post_commented',
              senderName: comment.user.username,
              senderAvatar: comment.user.avatar_url,
              receiverName: owner?.username,
              receiverAvatar: owner?.avatar_url,
              amount: 0,
              timestamp: comment.created_at,
              extraInfo: comment.content?.substring(0, 20),
              navigateTo: '/posts',
            });
          }
        });
      }

      // Process follows
      followsResult.data?.forEach((follow: any) => {
        if (follow.follower && follow.following) {
          allActivities.push({
            id: `follow-${follow.id}`,
            type: 'followed',
            senderName: follow.follower.username,
            senderAvatar: follow.follower.avatar_url,
            receiverName: follow.following.username,
            receiverAvatar: follow.following.avatar_url,
            amount: 0,
            timestamp: follow.created_at,
            navigateTo: follow.following.id ? `/profile/${follow.following.id}` : '/posts',
          });
        }
      });

      // Process votes
      votesResult.data?.forEach((vote: any) => {
        if (vote.user) {
          allActivities.push({
            id: `vote-${vote.id}`,
            type: 'voted',
            senderName: vote.user.username,
            senderAvatar: vote.user.avatar_url,
            amount: 0,
            timestamp: vote.created_at,
            extraInfo: vote.proposal?.title?.substring(0, 20),
            navigateTo: '/dao',
          });
        }
      });

      // Process stakes
      stakesResult.data?.forEach((stake: any) => {
        if (stake.user) {
          allActivities.push({
            id: `stake-${stake.id}`,
            type: 'staked',
            senderName: stake.user.username,
            senderAvatar: stake.user.avatar_url,
            amount: parseFloat(stake.amount) || 0,
            timestamp: stake.created_at,
            tokenSymbol: stake.token_symbol,
            tokenLogo: stake.pool?.stake_token_logo,
            extraInfo: stake.pool?.title,
            poolId: stake.pool?.id,
            navigateTo: `/staking?pool=${stake.pool?.id}`,
          });
        }
      });

      // Process swaps (last 4)
      swapsResult.data?.forEach((swap: any) => {
        if (!swap.user) return;

        const isBuy = swap.dest_token === 'AVLO';
        const amount = isBuy ? (Number(swap.dest_amount) || 0) : (Number(swap.src_amount) || 0);

        allActivities.push({
          id: `swap-${swap.id}`,
          type: isBuy ? 'swap_bought' : 'swap_sold',
          senderName: swap.user.username,
          senderAvatar: swap.user.avatar_url,
          amount,
          timestamp: swap.created_at,
          tokenSymbol: 'AVLO',
          extraInfo: isBuy ? 'ARENA → AVLO' : 'AVLO → ARENA',
          navigateTo: '/swap',
        });
      });

      // Process new users (already fetched in parallel)
      newUsersResult.data?.forEach((user: any) => {
        allActivities.push({
          id: `user-${user.id}`,
          type: 'user_joined',
          senderName: user.username,
          senderAvatar: user.avatar_url,
          amount: 0,
          timestamp: user.created_at,
          navigateTo: `/profile/${user.id}`,
        });
      });

      // Process new staking pools
      newPoolsResult.data?.forEach((pool: any) => {
        const creator = pool.creator as any;
        if (creator) {
          allActivities.push({
            id: `pool-${pool.id}`,
            type: 'pool_created',
            senderName: creator.username || pool.creator_wallet?.slice(0, 8) + '...',
            senderAvatar: creator.avatar_url,
            amount: 0,
            timestamp: pool.created_at,
            extraInfo: pool.title || 'Staking Pool',
            tokenLogo: pool.stake_token_logo,
            navigateTo: `/staking?pool=${pool.id}`,
          });
        }
      });

      // Process raffle winners - only show last 2 winners (1st and 2nd place)
      raffleWinnersResult.data?.forEach((pool: any) => {
        const poolTypeLabel = pool.pool_type || 'Raffle';
        // Add only 1st and 2nd place winners
        if (pool.winner1) {
          allActivities.push({
            id: `raffle-${pool.id}-1`,
            type: 'raffle_won',
            senderName: pool.winner1.username || 'Winner',
            senderAvatar: pool.winner1.avatar_url,
            amount: pool.winner_1_amount || 0,
            timestamp: pool.completed_at,
            extraInfo: `🥇 ${poolTypeLabel}`,
            tokenSymbol: 'AVLO',
            navigateTo: '/raffle',
          });
        }
        if (pool.winner2) {
          allActivities.push({
            id: `raffle-${pool.id}-2`,
            type: 'raffle_won',
            senderName: pool.winner2.username || 'Winner',
            senderAvatar: pool.winner2.avatar_url,
            amount: pool.winner_2_amount || 0,
            timestamp: pool.completed_at,
            extraInfo: `🥈 ${poolTypeLabel}`,
            tokenSymbol: 'AVLO',
            navigateTo: '/raffle',
          });
        }
        // Skip winner3 - only show last 2 winners
      });

      // Process blackjack sessions (last 3 wins/losses)
      blackjackResult.data?.forEach((session: any) => {
        if (session.user && session.result) {
          const isWin = ['blackjack', 'win'].includes(session.result);
          const profit = isWin ? (session.payout_amount - session.bet_amount) : session.bet_amount;
          allActivities.push({
            id: `bj-${session.id}`,
            type: isWin ? 'blackjack_win' : 'blackjack_loss',
            senderName: session.user.username || 'Player',
            senderAvatar: session.user.avatar_url,
            amount: profit,
            timestamp: session.completed_at,
            extraInfo: isWin ? `+${profit.toLocaleString()}` : `-${session.bet_amount.toLocaleString()}`,
            navigateTo: '/blackjack',
          });
        }
      });

      // Process AI agents
      aiAgentsResult.data?.forEach((agent: any) => {
        const creator = agent.creator as any;
        if (creator) {
          allActivities.push({
            id: `agent-${agent.id}`,
            type: 'agent_created',
            senderName: creator.username || 'Someone',
            senderAvatar: creator.avatar_url,
            receiverName: agent.agent_name,
            receiverAvatar: agent.profile_picture_url,
            amount: 0,
            timestamp: agent.created_at,
            extraInfo: `@${agent.agent_handle}`,
            navigateTo: '/ava-ai',
          });
        }
      });

      allActivities.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setActivities(allActivities);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  const formatAmount = (amount: number) => {
    if (amount >= 1000000) return (amount / 1000000).toFixed(1) + 'M';
    if (amount >= 1000) return (amount / 1000).toFixed(1) + 'K';
    return amount.toFixed(2);
  };

  const handleClick = (activity: ActivityItem) => {
    if (activity.navigateTo) {
      navigate(activity.navigateTo);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
            <Zap className="w-4 h-4 text-orange-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <span className="text-xs text-zinc-500">Loading activity...</span>
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <TrendingUp className="w-8 h-8 text-zinc-600 mx-auto" />
          <p className="text-sm text-zinc-500">No recent activity</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Header */}
      <div className="p-3 border-b border-zinc-800 bg-gradient-to-r from-zinc-900 via-black to-zinc-900">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Zap className="w-4 h-4 text-orange-500" />
            <div className="absolute inset-0 bg-orange-500/50 blur-md animate-pulse" />
          </div>
          <span className="text-sm font-bold text-white">Live Activity</span>
          <div className="flex-1" />
          <span className="text-[10px] text-zinc-500 font-mono">{activities.length} events</span>
        </div>
      </div>

      {/* Activity List */}
      <ScrollArea className="flex-1 [&>div>div]:!block [&_[data-radix-scroll-area-scrollbar]]:hidden">
        <div className="p-2 space-y-2">
          <AnimatePresence mode="popLayout">
            {activities.map((activity, index) => {
              const config = activityConfig[activity.type];
              const Icon = config.icon;

              return (
                <motion.button
                  key={activity.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleClick(activity)}
                  className={cn(
                    "w-full p-3 rounded-xl border transition-all duration-300",
                    "hover:scale-[1.02] hover:shadow-lg cursor-pointer group",
                    config.bgColor,
                    config.borderColor
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                      "bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700/50"
                    )}>
                      <Icon className={cn("w-4 h-4", config.color)} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-[9px] px-1.5 py-0 font-mono",
                            config.borderColor,
                            config.color
                          )}
                        >
                          {config.label}
                        </Badge>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {formatTime(activity.timestamp)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Avatar className="w-5 h-5">
                          <AvatarImage src={activity.senderAvatar || ''} />
                          <AvatarFallback className="text-[8px] bg-zinc-800">
                            {activity.senderName?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium text-white truncate">
                          {activity.senderName}
                        </span>
                        {activity.receiverName && (
                          <>
                            <ArrowRight className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                            <Avatar className="w-5 h-5">
                              <AvatarImage src={activity.receiverAvatar || ''} />
                              <AvatarFallback className="text-[8px] bg-zinc-800">
                                {activity.receiverName?.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-zinc-400 truncate">
                              {activity.receiverName}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Extra info with payment destination */}
                      {(activity.extraInfo || activity.amount > 0 || activity.tokenLogo || activity.paymentDestination) && (
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {/* Token logo */}
                          {activity.tokenLogo && (
                            activity.type === 'staked' ? (
                              <img 
                                src={activity.tokenLogo} 
                                alt={activity.tokenSymbol || ''} 
                                className="w-5 h-5 rounded-full ring-2 ring-amber-500/50 shadow-lg shadow-amber-500/20"
                              />
                            ) : (
                              <img
                                src={activity.tokenLogo}
                                alt={activity.tokenSymbol || ''}
                                className="w-5 h-5 rounded-full"
                              />
                            )
                          )}
                          {activity.amount > 0 && (
                            <span className={cn("text-xs font-bold", config.color)}>
                              {formatAmount(activity.amount)} {activity.tokenSymbol || 'AVLO'}
                            </span>
                          )}
                          {/* Payment destination badge for swipes */}
                          {activity.type === 'swipe_right' && activity.paymentDestination && (
                            <span className={cn(
                              "text-[9px] px-1.5 py-0.5 rounded font-medium",
                              activity.paymentDestination === 'burn' ? 'bg-orange-500/20 text-orange-400' :
                              activity.paymentDestination === 'tip' ? 'bg-pink-500/20 text-pink-400' :
                              'bg-blue-500/20 text-blue-400'
                            )}>
                              {activity.paymentDestination === 'burn' ? '🔥 BURN' : 
                               activity.paymentDestination === 'tip' ? '💝 TIP' : '👥 TEAM'}
                            </span>
                          )}
                          {activity.extraInfo && (
                            <span className="text-[10px] text-zinc-500 truncate">
                              {activity.type === 'pixel_placed' && activity.color && (
                                <span 
                                  className="inline-block w-2.5 h-2.5 rounded-sm mr-1 border border-zinc-600"
                                  style={{ backgroundColor: activity.color }}
                                />
                              )}
                              {activity.extraInfo}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Arrow indicator */}
                    <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-orange-500 transition-colors flex-shrink-0 self-center" />
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  );
}
