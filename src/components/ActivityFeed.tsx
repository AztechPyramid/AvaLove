import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Flame, Heart, TrendingUp, TrendingDown, Coins, ThumbsDown, Gamepad2, Play, PiggyBank } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

type ActivityType = 
  | 'tip' 
  | 'swipe_right' 
  | 'swipe_left' 
  | 'game_playing' 
  | 'payment' 
  | 'match'
  | 'watching_video'
  | 'listening_music'
  | 'pixel_placed'
  | 'ai_chat'
  | 'post_created'
  | 'agent_stats'
  | 'user_joined'
  | 'staked'
  | 'unstaked'
  | 'pool_boosted'
  | 'profile_boosted'
  | 'pool_created'
  | 'swap_bought'
  | 'swap_sold'
  | 'raffle_won'
  | 'blackjack_win'
  | 'blackjack_loss'
  | 'agent_created';

interface ActivityItem {
  type: ActivityType;
  senderName: string;
  senderAvatar?: string | null;
  receiverName?: string;
  receiverAvatar?: string | null;
  amount: number;
  timestamp: string;
  gameName?: string;
  tokenSymbol?: string;
  tokenLogo?: string | null;
  extraInfo?: string; // video title, track name, etc.
  color?: string; // for pixel art
  stakeLogo?: string | null; // for staking pool logo
  paymentDestination?: 'burn' | 'tip' | 'team'; // where the payment went
}

// Format large numbers compactly: 1000000 -> 1M, 1500000 -> 1.5M
const formatCompactNumber = (num: number): string => {
  if (num >= 1_000_000_000) {
    const val = num / 1_000_000_000;
    return val % 1 === 0 ? `${val}B` : `${val.toFixed(1)}B`;
  }
  if (num >= 1_000_000) {
    const val = num / 1_000_000;
    return val % 1 === 0 ? `${val}M` : `${val.toFixed(1)}M`;
  }
  if (num >= 1_000) {
    const val = num / 1_000;
    return val % 1 === 0 ? `${val}K` : `${val.toFixed(1)}K`;
  }
  return num.toLocaleString();
};

const getStakeTokenSymbolFromPoolTitle = (title?: string | null): string | null => {
  if (!title) return null;
  // Examples:
  // - "Stake AVLO"
  // - "Stake AVLO { #1 EPOCH }"
  // - "Stake MEOW"
  const match = title.match(/stake\s+\$?([a-z0-9]+)/i);
  return match?.[1]?.toUpperCase() ?? null;
};

export const ActivityFeed = () => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const previousActivitiesRef = useRef<ActivityItem[]>([]);
  const isFirstLoadRef = useRef(true);
  const { playTipSound, playBurnSound, playNotificationSound } = useSoundEffects();

  // Cycle through activities - 50% faster (1.5s instead of 3s)
  useEffect(() => {
    if (activities.length === 0) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activities.length);
    }, 1500); // 1.5 seconds (50% of 3 seconds)

    return () => clearInterval(timer);
  }, [activities.length]);

  useEffect(() => {
    // Fetch immediately on mount
    fetchActivities();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchActivities, 30000);
    return () => clearInterval(interval);
  }, []);

  // Shuffle array with constraint: same user can't appear within 3 items
  const shuffleWithConstraint = (items: ActivityItem[]): ActivityItem[] => {
    if (items.length <= 3) return items;
    
    const result: ActivityItem[] = [];
    const remaining = [...items];
    const recentUsers: string[] = [];
    
    while (remaining.length > 0) {
      // Find items where sender hasn't appeared in last 3
      const validItems = remaining.filter(item => 
        !recentUsers.includes(item.senderName) && 
        (!item.receiverName || !recentUsers.includes(item.receiverName))
      );
      
      // If no valid items, just take any remaining
      const pool = validItems.length > 0 ? validItems : remaining;
      const randomIndex = Math.floor(Math.random() * pool.length);
      const selected = pool[randomIndex];
      
      result.push(selected);
      remaining.splice(remaining.indexOf(selected), 1);
      
      // Track recent users (keep last 3)
      recentUsers.push(selected.senderName);
      if (selected.receiverName) recentUsers.push(selected.receiverName);
      while (recentUsers.length > 6) recentUsers.shift(); // 3 items * 2 users max
    }
    
    return result;
  };

  const fetchActivities = async () => {
    setIsLoading(true);
    try {
      // Run ALL queries in parallel using Promise.all for maximum speed
      const [
        tipsResult,
        swipesResult,
        matchesResult,
        paymentsResult,
        gameSessionsResult,
        videoViewsResult,
        musicListensResult,
        pixelsResult,
        burnsResult,
        newUsersResult,
        stakingTxsResult,
        unstakingTxsResult,
        poolBoostsResult,
        profileBoostsResult,
        newPoolsResult
      ] = await Promise.all([
        // Tips
        supabase
          .from('tips')
          .select(`
            amount,
            created_at,
            sender:sender_id(username, display_name, avatar_url),
            receiver:receiver_id(username, display_name, avatar_url)
          `)
          .order('created_at', { ascending: false })
          .limit(15),
        
        // Swipes
        supabase
          .from('swipes')
          .select(`
            direction,
            amount,
            token_amount,
            payment_destination,
            created_at,
            swiper:swiper_id(username, display_name, avatar_url),
            swiped:swiped_id(username, display_name, avatar_url),
            token:token_id(token_symbol, token_logo_url),
            paymentToken:payment_token_id(token_symbol, logo_url)
          `)
          .order('created_at', { ascending: false })
          .limit(10),
        
        // Matches
        supabase
          .from('matches')
          .select(`
            created_at,
            user1:user1_id(username, display_name, avatar_url),
            user2:user2_id(username, display_name, avatar_url)
          `)
          .order('created_at', { ascending: false })
          .limit(10),
        
        // Token payments
        supabase
          .from('token_payments')
          .select(`
            amount,
            payment_type,
            reference_id,
            created_at,
            user:user_id(username, display_name, avatar_url),
            token:token_id(token_symbol, logo_url)
          `)
          .eq('payment_type', 'swipe')
          .order('created_at', { ascending: false })
          .limit(10),
        
        // Game sessions
        supabase
          .from('embedded_game_sessions')
          .select(`
            game_title,
            started_at,
            user:user_id(username, display_name, avatar_url)
          `)
          .eq('status', 'playing')
          .order('started_at', { ascending: false })
          .limit(10),
        
        // Video views
        supabase
          .from('watch_video_views')
          .select(`
            video_title,
            started_at,
            user:user_id(username, display_name, avatar_url)
          `)
          .eq('status', 'watching')
          .order('started_at', { ascending: false })
          .limit(10),
        
        // Music listens
        supabase
          .from('music_track_listens')
          .select(`
            started_at,
            user:user_id(username, display_name, avatar_url),
            track:track_id(title, artist)
          `)
          .eq('status', 'listening')
          .order('started_at', { ascending: false })
          .limit(10),
        
        // Pixels
        supabase
          .from('pixels')
          .select(`
            color,
            x,
            y,
            placed_at,
            user:placed_by(username, display_name, avatar_url)
          `)
          .order('placed_at', { ascending: false })
          .limit(10),
        
        // Burns
        supabase
          .from('token_burns')
          .select(`
            amount,
            burn_type,
            created_at,
            user:user_id(username, display_name, avatar_url)
          `)
          .in('burn_type', ['ai_chat', 'post', 'post_text', 'post_image'])
          .order('created_at', { ascending: false })
          .limit(10),
        
        // New users
        supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, created_at')
          .order('created_at', { ascending: false })
          .limit(10),
        
        // Staking deposits
        supabase
          .from('staking_transactions')
          .select(`
            amount,
            token_symbol,
            created_at,
            user:user_id(username, display_name, avatar_url),
            pool:pool_id(title, stake_token_logo)
          `)
          .eq('transaction_type', 'deposit')
          .order('created_at', { ascending: false })
          .limit(2),
        
        // Staking withdrawals
        supabase
          .from('staking_transactions')
          .select(`
            amount,
            token_symbol,
            created_at,
            user:user_id(username, display_name, avatar_url),
            pool:pool_id(title, stake_token_logo)
          `)
          .eq('transaction_type', 'withdraw')
          .order('created_at', { ascending: false })
          .limit(2),
        
        // Pool boosts
        supabase
          .from('staking_pool_boosts')
          .select(`
            amount,
            created_at,
            user:user_id(username, display_name, avatar_url),
            pool:pool_id(title)
          `)
          .order('created_at', { ascending: false })
          .limit(10),
        
        // Profile boosts
        supabase
          .from('swipe_profile_boosts')
          .select(`
            amount,
            created_at,
            booster:booster_id(username, display_name, avatar_url),
            profile:profile_id(username, display_name, avatar_url)
          `)
          .order('created_at', { ascending: false })
          .limit(10),
        
        // New pools
        supabase
          .from('staking_pools')
          .select(`
            id,
            title,
            stake_token_logo,
            reward_token_logo,
            creator_wallet,
            created_at,
            creator:created_by(username, display_name, avatar_url)
          `)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
      ]);

      // Extract data from results
      const tips = tipsResult.data;
      const swipes = swipesResult.data;
      const matches = matchesResult.data;
      const payments = paymentsResult.data;
      const gameSessions = gameSessionsResult.data;
      const videoViews = videoViewsResult.data;
      const musicListens = musicListensResult.data;
      const pixels = pixelsResult.data;
      const burns = burnsResult.data;
      const newUsers = newUsersResult.data;
      const stakingTxs = stakingTxsResult.data;
      const unstakingTxs = unstakingTxsResult.data;
      const poolBoosts = poolBoostsResult.data;
      const profileBoosts = profileBoostsResult.data;
      const newPools = newPoolsResult.data;

      const allActivities: ActivityItem[] = [];

      // Process tips
      if (tips) {
        tips.forEach((tip: any) => {
          if (tip.sender && tip.receiver) {
            allActivities.push({
              type: 'tip',
              senderName: tip.sender.display_name || tip.sender.username,
              senderAvatar: tip.sender.avatar_url,
              receiverName: tip.receiver.display_name || tip.receiver.username,
              receiverAvatar: tip.receiver.avatar_url,
              amount: tip.amount,
              timestamp: tip.created_at,
            });
          }
        });
      }

      // Process swipes - now with receiver info, token and payment destination!
      if (swipes) {
        swipes.forEach((swipe: any) => {
          if (swipe.swiper && swipe.swiped) {
            // For left swipes, don't show token amount (no burning happens)
            const isRightSwipe = swipe.direction === 'right';
            // Use token_amount for display on right swipes, 0 for left swipes
            const displayAmount = isRightSwipe ? (swipe.token_amount || swipe.amount || 0) : 0;
            allActivities.push({
              type: isRightSwipe ? 'swipe_right' : 'swipe_left',
              senderName: swipe.swiper.display_name || swipe.swiper.username,
              senderAvatar: swipe.swiper.avatar_url,
              receiverName: swipe.swiped.display_name || swipe.swiped.username,
              receiverAvatar: swipe.swiped.avatar_url,
              amount: displayAmount,
              timestamp: swipe.created_at,
              // Only show token info for right swipes
              tokenSymbol: isRightSwipe ? (swipe.paymentToken?.token_symbol || swipe.token?.token_symbol || 'AVLO') : undefined,
              tokenLogo: isRightSwipe ? (swipe.paymentToken?.logo_url || swipe.token?.token_logo_url || null) : null,
              paymentDestination: isRightSwipe ? (swipe.payment_destination || 'burn') : undefined,
            });
          }
        });
      }

      // Process matches
      if (matches) {
        matches.forEach((match: any) => {
          if (match.user1 && match.user2) {
            allActivities.push({
              type: 'match',
              senderName: match.user1.display_name || match.user1.username,
              senderAvatar: match.user1.avatar_url,
              receiverName: match.user2.display_name || match.user2.username,
              receiverAvatar: match.user2.avatar_url,
              amount: 0,
              timestamp: match.created_at,
            });
          }
        });
      }

      // Process game sessions
      if (gameSessions) {
        gameSessions.forEach((session: any) => {
          if (session.user) {
            allActivities.push({
              type: 'game_playing',
              senderName: session.user.display_name || session.user.username,
              senderAvatar: session.user.avatar_url,
              amount: 0,
              timestamp: session.started_at,
              gameName: session.game_title,
            });
          }
        });
      }

      // Process custom token payments - try to get swiped user from reference_id
      if (payments) {
        // Get swiped profiles for payments with reference_id (swipe_id)
        const paymentSwipeIds = payments
          .filter((p: any) => p.reference_id)
          .map((p: any) => p.reference_id);
        
        let swipedProfiles: Record<string, any> = {};
        if (paymentSwipeIds.length > 0) {
          const { data: paymentSwipes } = await supabase
            .from('swipes')
            .select('id, swiped:swiped_id(username, display_name, avatar_url)')
            .in('id', paymentSwipeIds);
          
          if (paymentSwipes) {
            paymentSwipes.forEach((s: any) => {
              swipedProfiles[s.id] = s.swiped;
            });
          }
        }

        payments.forEach((payment: any) => {
          if (payment.user && payment.token) {
            const swipedUser = payment.reference_id ? swipedProfiles[payment.reference_id] : null;
            allActivities.push({
              type: 'payment',
              senderName: payment.user.display_name || payment.user.username,
              senderAvatar: payment.user.avatar_url,
              receiverName: swipedUser ? (swipedUser.display_name || swipedUser.username) : undefined,
              receiverAvatar: swipedUser?.avatar_url,
              amount: payment.amount,
              timestamp: payment.created_at,
              tokenSymbol: payment.token.token_symbol,
              tokenLogo: payment.token.logo_url,
            });
          }
        });
      }

      // Process video watching
      if (videoViews) {
        videoViews.forEach((view: any) => {
          if (view.user) {
            allActivities.push({
              type: 'watching_video',
              senderName: view.user.display_name || view.user.username,
              senderAvatar: view.user.avatar_url,
              amount: 0,
              timestamp: view.started_at,
              extraInfo: view.video_title,
            });
          }
        });
      }

      // Process music listening
      if (musicListens) {
        musicListens.forEach((listen: any) => {
          if (listen.user && listen.track) {
            allActivities.push({
              type: 'listening_music',
              senderName: listen.user.display_name || listen.user.username,
              senderAvatar: listen.user.avatar_url,
              amount: 0,
              timestamp: listen.started_at,
              extraInfo: `${listen.track.title} - ${listen.track.artist}`,
            });
          }
        });
      }

      // Process pixel placements
      if (pixels) {
        pixels.forEach((pixel: any) => {
          if (pixel.user) {
            allActivities.push({
              type: 'pixel_placed',
              senderName: pixel.user.display_name || pixel.user.username,
              senderAvatar: pixel.user.avatar_url,
              amount: 0,
              timestamp: pixel.placed_at,
              color: pixel.color,
              extraInfo: `(${pixel.x}, ${pixel.y})`,
            });
          }
        });
      }

      // Process burns for AI chat, posts, chat messages
      if (burns) {
        burns.forEach((burn: any) => {
          if (burn.user) {
            let activityType: ActivityType;
            if (burn.burn_type === 'ai_chat') {
              activityType = 'ai_chat';
            } else {
              activityType = 'post_created';
            }
            
            allActivities.push({
              type: activityType,
              senderName: burn.user.display_name || burn.user.username,
              senderAvatar: burn.user.avatar_url,
              amount: burn.amount,
              timestamp: burn.created_at,
            });
          }
        });
      }

      // Process recently joined users
      if (newUsers) {
        newUsers.forEach((user: any) => {
          allActivities.push({
            type: 'user_joined',
            senderName: user.display_name || user.username,
            senderAvatar: user.avatar_url,
            amount: 0,
            timestamp: user.created_at,
          });
        });
      }

      // Process staking transactions
      if (stakingTxs) {
        stakingTxs.forEach((tx: any) => {
          if (tx.user) {
            allActivities.push({
              type: 'staked',
              senderName: tx.user.display_name || tx.user.username,
              senderAvatar: tx.user.avatar_url,
              amount: parseFloat(tx.amount) || 0,
              timestamp: tx.created_at,
              tokenSymbol: getStakeTokenSymbolFromPoolTitle(tx.pool?.title) || tx.token_symbol,
              extraInfo: tx.pool?.title || 'Staking Pool',
              stakeLogo: tx.pool?.stake_token_logo || null,
            });
          }
        });
      }

      // Process unstaking transactions
      if (unstakingTxs) {
        unstakingTxs.forEach((tx: any) => {
          if (tx.user) {
            allActivities.push({
              type: 'unstaked',
              senderName: tx.user.display_name || tx.user.username,
              senderAvatar: tx.user.avatar_url,
              amount: parseFloat(tx.amount) || 0,
              timestamp: tx.created_at,
              tokenSymbol: getStakeTokenSymbolFromPoolTitle(tx.pool?.title) || tx.token_symbol,
              extraInfo: tx.pool?.title || 'Staking Pool',
              stakeLogo: tx.pool?.stake_token_logo || null,
            });
          }
        });
      }

      // Process pool boosts
      if (poolBoosts) {
        poolBoosts.forEach((boost: any) => {
          if (boost.user) {
            allActivities.push({
              type: 'pool_boosted',
              senderName: boost.user.display_name || boost.user.username,
              senderAvatar: boost.user.avatar_url,
              amount: parseFloat(boost.amount) || 0,
              timestamp: boost.created_at,
              extraInfo: boost.pool?.title || 'Staking Pool',
            });
          }
        });
      }

      // Process profile boosts
      if (profileBoosts) {
        profileBoosts.forEach((boost: any) => {
          if (boost.booster && boost.profile) {
            allActivities.push({
              type: 'profile_boosted',
              senderName: boost.booster.display_name || boost.booster.username,
              senderAvatar: boost.booster.avatar_url,
              receiverName: boost.profile.display_name || boost.profile.username,
              receiverAvatar: boost.profile.avatar_url,
              amount: parseFloat(boost.amount) || 0,
              timestamp: boost.created_at,
            });
          }
        });
      }

      // Process newly created pools
      if (newPools) {
        newPools.forEach((pool: any) => {
          const creator = pool.creator as any;
          if (creator) {
            allActivities.push({
              type: 'pool_created',
              senderName: creator.display_name || creator.username || pool.creator_wallet?.slice(0, 8) + '...',
              senderAvatar: creator.avatar_url,
              amount: 0,
              timestamp: pool.created_at,
              extraInfo: pool.title || 'Staking Pool',
              stakeLogo: pool.stake_token_logo || null,
            });
          }
        });
      }

      // Fetch recent swap transactions (both buys and sells)
      const { data: swapTxs } = await supabase
        .from('swap_transactions')
        .select(`
          id,
          src_token,
          dest_token,
          src_amount,
          dest_amount,
          created_at,
          user:user_id(username, display_name, avatar_url)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      // Process swap transactions (AVLO purchases and sales)
      if (swapTxs) {
        swapTxs.forEach((tx: any) => {
          if (tx.user) {
            const isBuy = tx.dest_token === 'AVLO';
            allActivities.push({
              type: isBuy ? 'swap_bought' : 'swap_sold',
              senderName: tx.user.display_name || tx.user.username || 'Someone',
              senderAvatar: tx.user.avatar_url,
              amount: isBuy ? (parseFloat(tx.dest_amount) || 0) : (parseFloat(tx.src_amount) || 0),
              timestamp: tx.created_at,
              tokenSymbol: 'AVLO',
              extraInfo: isBuy ? tx.src_token : tx.dest_token,
            });
          }
        });
      }

      // Fetch recent raffle winners - only last pool to show max 2 winners
      const { data: raffleWinners } = await supabase
        .from('raffle_pools')
        .select(`
          id, pool_type, completed_at,
          winner_1_amount, winner_2_amount, winner_3_amount,
          winner1:winner_1_id(username, display_name, avatar_url),
          winner2:winner_2_id(username, display_name, avatar_url),
          winner3:winner_3_id(username, display_name, avatar_url)
        `)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1);

      // Process raffle winners - only show last 2 winners (1st and 2nd place)
      if (raffleWinners) {
        raffleWinners.forEach((pool: any) => {
          const poolTypeLabel = pool.pool_type || 'Raffle';
          if (pool.winner1) {
            allActivities.push({
              type: 'raffle_won',
              senderName: pool.winner1.display_name || pool.winner1.username || 'Winner',
              senderAvatar: pool.winner1.avatar_url,
              amount: pool.winner_1_amount || 0,
              timestamp: pool.completed_at,
              extraInfo: `🥇 ${poolTypeLabel}`,
              tokenSymbol: 'AVLO',
            });
          }
          if (pool.winner2) {
            allActivities.push({
              type: 'raffle_won',
              senderName: pool.winner2.display_name || pool.winner2.username || 'Winner',
              senderAvatar: pool.winner2.avatar_url,
              amount: pool.winner_2_amount || 0,
              timestamp: pool.completed_at,
              extraInfo: `🥈 ${poolTypeLabel}`,
              tokenSymbol: 'AVLO',
            });
          }
          // Skip winner3 - only show last 2 winners
        });
      }

      // Fetch recent blackjack sessions (last 3 wins/losses)
      const { data: blackjackSessions } = await supabase
        .from('blackjack_sessions')
        .select(`
          id,
          bet_amount,
          payout_amount,
          result,
          completed_at,
          user:user_id(username, display_name, avatar_url)
        `)
        .not('result', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(3);

      // Process blackjack sessions
      if (blackjackSessions) {
        blackjackSessions.forEach((session: any) => {
          if (session.user && session.result) {
            const isWin = ['blackjack', 'win'].includes(session.result);
            const profit = isWin ? (session.payout_amount - session.bet_amount) : session.bet_amount;
            allActivities.push({
              type: isWin ? 'blackjack_win' : 'blackjack_loss',
              senderName: session.user.display_name || session.user.username || 'Player',
              senderAvatar: session.user.avatar_url,
              amount: profit,
              timestamp: session.completed_at,
              extraInfo: isWin ? `+${profit.toLocaleString()}` : `-${session.bet_amount.toLocaleString()}`,
            });
          }
        });
      }

      // Fetch recent AI agents
      const { data: aiAgents } = await supabase
        .from('arena_agents')
        .select(`
          id,
          agent_name,
          agent_handle,
          profile_picture_url,
          is_verified,
          total_posts,
          total_likes_received,
          follower_count,
          following_count,
          created_at,
          creator:user_id(username, display_name, avatar_url)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      // Process AI agents - agent_created + random agent stats
      if (aiAgents) {
        aiAgents.forEach((agent: any) => {
          const creator = agent.creator as any;
          if (creator) {
            allActivities.push({
              type: 'agent_created',
              senderName: creator.display_name || creator.username || 'Someone',
              senderAvatar: creator.avatar_url,
              receiverName: agent.agent_name,
              receiverAvatar: agent.profile_picture_url,
              amount: 0,
              timestamp: agent.created_at,
              extraInfo: `@${agent.agent_handle}`,
            });
          }
        });

        // Generate random agent stat activities from last 5 agents
        const statTypes = [
          { label: 'posts', key: 'total_posts', emoji: '📝' },
          { label: 'likes', key: 'total_likes_received', emoji: '❤️' },
          { label: 'followers', key: 'follower_count', emoji: '👥' },
          { label: 'following', key: 'following_count', emoji: '👁️' },
        ];
        
        // Shuffle agents and pick 5
        const shuffledAgents = [...aiAgents].sort(() => Math.random() - 0.5).slice(0, 5);
        shuffledAgents.forEach((agent: any) => {
          // Pick a random stat for each agent
          const randomStat = statTypes[Math.floor(Math.random() * statTypes.length)];
          const statValue = agent[randomStat.key] || 0;
          allActivities.push({
            type: 'agent_stats',
            senderName: agent.agent_name || agent.agent_handle,
            senderAvatar: agent.profile_picture_url,
            amount: statValue,
            timestamp: agent.created_at,
            extraInfo: `${randomStat.emoji} ${statValue} ${randomStat.label}`,
            tokenSymbol: `@${agent.agent_handle}`,
          });
        });
      }
      allActivities.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      const topActivities = allActivities.slice(0, 30);
      const shuffledActivities = shuffleWithConstraint(topActivities);
      
      // Check for new activities and play sounds - but skip on first load
      if (!isFirstLoadRef.current && previousActivitiesRef.current.length > 0 && topActivities.length > 0) {
        const latestActivity = topActivities[0];
        const wasNew = !previousActivitiesRef.current.some(
          prev => prev.timestamp === latestActivity.timestamp
        );
        
        // Sounds disabled - were playing unexpectedly for other users' activities
        // if (wasNew) {
        //   if (latestActivity.type === 'tip') playTipSound();
        //   else if (latestActivity.type === 'swipe_right' || latestActivity.type === 'swipe_left') playBurnSound();
        //   else if (latestActivity.type === 'game_playing' || latestActivity.type === 'match') playNotificationSound();
        // }
      }
      
      // Mark first load as done
      isFirstLoadRef.current = false;
      previousActivitiesRef.current = topActivities;
      setActivities(shuffledActivities);
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderAvatar = (avatar: string | null | undefined, name: string, borderColor: string) => {
    const isVideo = avatar && /\.(mp4|webm|ogg|mov)$/i.test(avatar);
    if (isVideo) {
      return (
        <video
          src={avatar}
          className={`w-6 h-6 rounded-full object-cover border ${borderColor}`}
          autoPlay
          loop
          muted
          playsInline
        />
      );
    }
    return (
      <Avatar className={`w-6 h-6 border ${borderColor}`}>
        <AvatarImage src={avatar || ''} />
        <AvatarFallback className="bg-orange-500/30 text-white text-xs">
          {name.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
    );
  };

  // Truncate only wallet addresses (starting with 0x) - keep normal usernames full
  const truncateName = (name: string) => {
    if (!name) return name;
    // Only truncate if it's a wallet address (starts with 0x and is long)
    if (name.startsWith('0x') && name.length > 12) {
      return `${name.slice(0, 6)}...${name.slice(-4)}`;
    }
    return name;
  };

  const getActivityText = (activity: ActivityItem) => {
    const senderDisplay = truncateName(activity.senderName);
    const receiverDisplay = activity.receiverName ? truncateName(activity.receiverName) : '';

    switch (activity.type) {
      case 'tip':
        return (
          <div className="flex items-center gap-2 text-white">
            {renderAvatar(activity.senderAvatar, activity.senderName, 'border-orange-500/30')}
            <span className="font-bold">{senderDisplay}</span>
            <span>sent</span>
            <span className="font-bold text-orange-400">{activity.amount} $AVLO</span>
            <span>to</span>
            {renderAvatar(activity.receiverAvatar, activity.receiverName || '', 'border-orange-500/30')}
            <span className="font-bold">{receiverDisplay}</span>
          </div>
        );
      case 'swipe_right': {
        // Determine action text and emoji based on payment destination
        const destination = activity.paymentDestination || 'burn';
        const destIcon = destination === 'burn' ? '🔥' : destination === 'tip' ? '💝' : '👥';
        
        return (
          <div className="flex items-center gap-1 text-white text-xs">
            {renderAvatar(activity.senderAvatar, activity.senderName, 'border-pink-500/30')}
            <span className="font-bold truncate max-w-[60px]">{senderDisplay}</span>
            <span className="text-pink-400">💕</span>
            {renderAvatar(activity.receiverAvatar, activity.receiverName || '', 'border-pink-500/30')}
            <span className="font-bold truncate max-w-[60px]">{receiverDisplay}</span>
            <span className="text-zinc-500">•</span>
            {activity.tokenLogo && (
              <img src={activity.tokenLogo} alt="" className="w-3 h-3 rounded-full flex-shrink-0" />
            )}
            <span className="font-bold text-pink-400 whitespace-nowrap">
              {formatCompactNumber(activity.amount)}
            </span>
            <span className="text-[10px]">{destIcon}</span>
          </div>
        );
      }
      case 'swipe_left':
        return (
          <div className="flex items-center gap-2 text-white">
            {renderAvatar(activity.senderAvatar, activity.senderName, 'border-zinc-500/30')}
            <span className="font-bold">{senderDisplay}</span>
            <span>passed</span>
            <span className="text-zinc-400">👎</span>
            {renderAvatar(activity.receiverAvatar, activity.receiverName || '', 'border-zinc-500/30')}
            <span className="font-bold">{receiverDisplay}</span>
          </div>
        );
      case 'game_playing':
        return (
          <div className="flex items-center gap-2 text-white">
            {renderAvatar(activity.senderAvatar, activity.senderName, 'border-green-500/30')}
            <span className="font-bold">{senderDisplay}</span>
            <span>is playing</span>
            <span className="font-bold text-green-400 flex items-center gap-1">
              <Gamepad2 className="w-4 h-4" />
              {activity.gameName?.slice(0, 20)}{(activity.gameName?.length || 0) > 20 ? '...' : ''}
            </span>
          </div>
        );
      case 'payment':
        return (
          <div className="flex items-center gap-2 text-white">
            {renderAvatar(activity.senderAvatar, activity.senderName, 'border-purple-500/30')}
            <span className="font-bold">{senderDisplay}</span>
            <span>paid</span>
            <span className="font-bold text-purple-400 flex items-center gap-1">
              {activity.tokenLogo && (
                <img src={activity.tokenLogo} alt="" className="w-4 h-4 rounded-full" />
              )}
              {activity.amount} ${activity.tokenSymbol}
            </span>
            <span>to like</span>
            {activity.receiverName && (
              <>
                {renderAvatar(activity.receiverAvatar, activity.receiverName, 'border-purple-500/30')}
                <span className="font-bold">{receiverDisplay}</span>
              </>
            )}
            <span>💜</span>
          </div>
        );
      case 'match':
        return (
          <div className="flex items-center gap-2 text-white">
            {renderAvatar(activity.senderAvatar, activity.senderName, 'border-red-500/50')}
            <span className="font-bold">{senderDisplay}</span>
            <span className="text-red-400">💕 matched with 💕</span>
            {renderAvatar(activity.receiverAvatar, activity.receiverName || '', 'border-red-500/50')}
            <span className="font-bold">{receiverDisplay}</span>
          </div>
        );
      case 'watching_video':
        return (
          <div className="flex items-center gap-2 text-white">
            {renderAvatar(activity.senderAvatar, activity.senderName, 'border-red-500/30')}
            <span className="font-bold">{senderDisplay}</span>
            <span>is watching</span>
            <span className="font-bold text-red-400 flex items-center gap-1">
              <Play className="w-4 h-4 fill-red-400" />
              {activity.extraInfo?.slice(0, 20)}{(activity.extraInfo?.length || 0) > 20 ? '...' : ''}
            </span>
          </div>
        );
      case 'listening_music':
        return (
          <div className="flex items-center gap-2 text-white">
            {renderAvatar(activity.senderAvatar, activity.senderName, 'border-emerald-500/30')}
            <span className="font-bold">{senderDisplay}</span>
            <span>is listening</span>
            <span className="font-bold text-emerald-400">🎵 {activity.extraInfo?.slice(0, 20)}{(activity.extraInfo?.length || 0) > 20 ? '...' : ''}</span>
          </div>
        );
      case 'pixel_placed':
        return (
          <div className="flex items-center gap-2 text-white">
            {renderAvatar(activity.senderAvatar, activity.senderName, 'border-yellow-500/30')}
            <span className="font-bold">{senderDisplay}</span>
            <span>placed a pixel</span>
            <span 
              className="w-4 h-4 rounded border border-white/30" 
              style={{ backgroundColor: activity.color }}
            />
            <span className="text-yellow-400">🎨 {activity.extraInfo}</span>
          </div>
        );
      case 'ai_chat':
        return (
          <div className="flex items-center gap-2 text-white">
            {renderAvatar(activity.senderAvatar, activity.senderName, 'border-cyan-500/30')}
            <span className="font-bold">{senderDisplay}</span>
            <span>used</span>
            <span className="font-bold text-cyan-400">🤖 LoveBot</span>
            <span className="text-orange-400 text-xs">🔥 {activity.amount}</span>
          </div>
        );
      case 'post_created':
        return (
          <div className="flex items-center gap-2 text-white">
            {renderAvatar(activity.senderAvatar, activity.senderName, 'border-indigo-500/30')}
            <span className="font-bold">{senderDisplay}</span>
            <span>posted</span>
            <span className="text-indigo-400">📝</span>
            <span className="text-orange-400 text-xs">🔥 {activity.amount}</span>
          </div>
        );
      case 'agent_stats':
        return (
          <div className="flex items-center gap-1.5 text-white">
            {renderAvatar(activity.senderAvatar, activity.senderName, 'border-purple-500/30')}
            <span className="font-bold text-purple-400">{senderDisplay}</span>
            <span className="text-zinc-400 text-xs">{activity.tokenSymbol}</span>
            <span className="text-cyan-400 font-medium">{activity.extraInfo}</span>
          </div>
        );
      case 'user_joined':
        return (
          <div className="flex items-center gap-2 text-white">
            {renderAvatar(activity.senderAvatar, activity.senderName, 'border-green-500/30')}
            <span className="font-bold text-green-400">{senderDisplay}</span>
            <span>joined AvaLove</span>
            <span className="text-green-400">🎉</span>
          </div>
        );
      case 'staked':
        return (
          <div className="flex items-center gap-1.5 text-white">
            {renderAvatar(activity.senderAvatar, activity.senderName, 'border-amber-500/30')}
            <span className="font-bold">{senderDisplay}</span>
            <span className="font-bold text-amber-400 flex items-center gap-1">
              {formatCompactNumber(activity.amount)}
              {activity.stakeLogo && (
                <img src={activity.stakeLogo} alt="" className="w-4 h-4 rounded-full" />
              )}
              ${activity.tokenSymbol}
            </span>
            <span className="text-amber-400">staked</span>
          </div>
        );
      case 'unstaked':
        return (
          <div className="flex items-center gap-1.5 text-white">
            {renderAvatar(activity.senderAvatar, activity.senderName, 'border-red-500/30')}
            <span className="font-bold">{senderDisplay}</span>
            <span className="font-bold text-red-400 flex items-center gap-1">
              {formatCompactNumber(activity.amount)}
              {activity.stakeLogo && (
                <img src={activity.stakeLogo} alt="" className="w-4 h-4 rounded-full" />
              )}
              ${activity.tokenSymbol}
            </span>
            <span className="text-red-400">unstaked</span>
          </div>
        );
      case 'pool_boosted':
        return (
          <div className="flex items-center gap-1.5 text-white">
            {renderAvatar(activity.senderAvatar, activity.senderName, 'border-purple-500/30')}
            <span className="font-bold">{senderDisplay}</span>
            <span className="text-purple-400">boosted</span>
            <span className="font-bold text-purple-400">{activity.extraInfo?.slice(0, 15)}{(activity.extraInfo?.length || 0) > 15 ? '...' : ''}</span>
            <span className="text-purple-300 font-semibold">{formatCompactNumber(activity.amount)} AVLO</span>
            <span className="text-purple-400">🔥</span>
          </div>
        );
      case 'profile_boosted':
        return (
          <div className="flex items-center gap-1.5 text-white">
            {renderAvatar(activity.senderAvatar, activity.senderName, 'border-pink-500/30')}
            <span className="font-bold">{senderDisplay}</span>
            <span className="text-pink-400">boosted</span>
            {renderAvatar(activity.receiverAvatar, activity.receiverName || '', 'border-pink-500/30')}
            <span className="font-bold">{receiverDisplay}</span>
            <span className="text-pink-300 font-semibold">{formatCompactNumber(activity.amount)} AVLO</span>
            <span className="text-pink-400">🔥</span>
          </div>
        );
      case 'pool_created':
        return (
          <div className="flex items-center gap-1.5 text-white">
            {renderAvatar(activity.senderAvatar, activity.senderName, 'border-orange-500/30')}
            <span className="font-bold">{senderDisplay}</span>
            <span className="text-orange-400">launched</span>
            {activity.stakeLogo && (
              <img src={activity.stakeLogo} alt="" className="w-4 h-4 rounded-full" />
            )}
            <span className="font-bold text-orange-400">{activity.extraInfo?.slice(0, 18)}{(activity.extraInfo?.length || 0) > 18 ? '...' : ''}</span>
            <span className="text-orange-400">🚀</span>
          </div>
        );
      case 'swap_bought':
        return (
          <div className="flex items-center gap-1.5 text-white">
            {renderAvatar(activity.senderAvatar, activity.senderName, 'border-green-500/30')}
            <span className="font-bold text-green-400">{senderDisplay}</span>
            <span>bought</span>
            <span className="font-bold text-green-400">{formatCompactNumber(activity.amount)} AVLO</span>
            <span>🚀🔥</span>
          </div>
        );
      case 'swap_sold':
        return (
          <div className="flex items-center gap-1.5 text-white">
            {renderAvatar(activity.senderAvatar, activity.senderName, 'border-red-500/30')}
            <span className="font-bold text-red-400">{senderDisplay}</span>
            <span>sold</span>
            <span className="font-bold text-red-400">{formatCompactNumber(activity.amount)} AVLO</span>
            <span>📉</span>
          </div>
        );
      case 'raffle_won':
        return (
          <div className="flex items-center gap-1.5 text-white">
            {renderAvatar(activity.senderAvatar, activity.senderName, 'border-yellow-500/30')}
            <span className="font-bold text-yellow-400">{senderDisplay}</span>
            <span>won</span>
            <span className="font-bold text-yellow-400">{formatCompactNumber(activity.amount)} AVLO</span>
            <span>{activity.extraInfo}</span>
            <span>🎉</span>
          </div>
        );
      case 'blackjack_win':
        return (
          <div className="flex items-center gap-1.5 text-white">
            {renderAvatar(activity.senderAvatar, activity.senderName, 'border-green-500/30')}
            <span className="font-bold text-green-400">{senderDisplay}</span>
            <span>won</span>
            <span className="font-bold text-green-400">{activity.extraInfo}</span>
            <span>in BlackJack 🃏♠️</span>
          </div>
        );
      case 'blackjack_loss':
        return (
          <div className="flex items-center gap-1.5 text-white">
            {renderAvatar(activity.senderAvatar, activity.senderName, 'border-red-500/30')}
            <span className="font-bold text-red-400">{senderDisplay}</span>
            <span>lost</span>
            <span className="font-bold text-red-400">{activity.extraInfo}</span>
            <span>in BlackJack 🃏💔</span>
          </div>
        );
      case 'agent_created':
        return (
          <div className="flex items-center gap-1.5 text-white">
            {renderAvatar(activity.senderAvatar, activity.senderName, 'border-purple-500/30')}
            <span className="font-bold text-purple-400">{senderDisplay}</span>
            <span>created AI agent</span>
            {renderAvatar(activity.receiverAvatar, activity.receiverName || '', 'border-cyan-500/30')}
            <span className="font-bold text-cyan-400">{activity.extraInfo}</span>
            <span>🤖</span>
          </div>
        );
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'tip':
        return <Heart className="w-4 h-4 fill-orange-500 text-orange-500" />;
      case 'swipe_right':
        return <Heart className="w-4 h-4 fill-pink-500 text-pink-500" />;
      case 'swipe_left':
        return <ThumbsDown className="w-4 h-4 text-zinc-400" />;
      case 'game_playing':
        return <Gamepad2 className="w-4 h-4 text-green-400" />;
      case 'payment':
        return <Coins className="w-4 h-4 text-purple-500" />;
      case 'match':
        return <span className="text-lg">💕</span>;
      case 'watching_video':
        return <Play className="w-4 h-4 fill-red-500 text-red-500" />;
      case 'listening_music':
        return <span className="text-lg">🎵</span>;
      case 'pixel_placed':
        return <span className="text-lg">🎨</span>;
      case 'ai_chat':
        return <span className="text-lg">🤖</span>;
      case 'post_created':
        return <span className="text-lg">📝</span>;
      case 'agent_stats':
        return <span className="text-lg">🤖</span>;
      case 'user_joined':
        return <span className="text-lg">🎉</span>;
      case 'staked':
        return <PiggyBank className="w-4 h-4 text-amber-400" />;
      case 'unstaked':
        return <PiggyBank className="w-4 h-4 text-red-400" />;
      case 'pool_boosted':
        return <Flame className="w-4 h-4 text-purple-400" />;
      case 'profile_boosted':
        return <Flame className="w-4 h-4 text-pink-400" />;
      case 'pool_created':
        return <span className="text-lg">🚀</span>;
      case 'swap_bought':
        return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'swap_sold':
        return <TrendingDown className="w-4 h-4 text-red-400" />;
      case 'raffle_won':
        return <span className="text-lg">🎰</span>;
      case 'blackjack_win':
        return <span className="text-lg">🃏</span>;
      case 'blackjack_loss':
        return <span className="text-lg">🃏</span>;
      case 'agent_created':
        return <span className="text-lg">🤖</span>;
      default:
        return <Flame className="w-4 h-4 text-orange-500" />;
    }
  };

  // Show loading skeleton during initial load
  if (isLoading && activities.length === 0) {
    return (
      <div className="relative w-full overflow-hidden rounded-xl backdrop-blur-xl h-16 flex items-center shadow-2xl shadow-pink-500/10">
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-900/95 via-zinc-950/95 to-zinc-900/95" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-pink-500/60 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-10">
          <motion.div 
            className="w-2 h-2 rounded-full bg-pink-500"
            animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <span className="text-[10px] font-bold text-pink-400 uppercase tracking-wider">Live</span>
        </div>
        <div className="flex items-center gap-2 px-14 py-2 w-full justify-center relative z-10">
          <div className="w-8 h-8 rounded-lg bg-pink-500/20 animate-pulse" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-zinc-700 animate-pulse" />
            <div className="w-24 h-4 rounded bg-zinc-700 animate-pulse" />
            <div className="w-16 h-4 rounded bg-zinc-700 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (activities.length === 0) return null;

  const currentActivity = activities[currentIndex];

  return (
    <div className="relative w-full overflow-hidden rounded-xl backdrop-blur-xl h-16 flex items-center shadow-2xl shadow-pink-500/10">
      {/* Tech pitch gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-zinc-900/95 via-zinc-950/95 to-zinc-900/95" />
      
      {/* Animated top glow line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-pink-500/60 to-transparent" />
      
      {/* Animated bottom glow line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />
      
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-3 h-3 border-l-2 border-t-2 border-pink-500/40" />
      <div className="absolute top-0 right-0 w-3 h-3 border-r-2 border-t-2 border-pink-500/40" />
      <div className="absolute bottom-0 left-0 w-3 h-3 border-l-2 border-b-2 border-purple-500/30" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-r-2 border-b-2 border-purple-500/30" />
      
      {/* Tech grid overlay */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: `
          linear-gradient(rgba(236,72,153,0.3) 1px, transparent 1px),
          linear-gradient(90deg, rgba(236,72,153,0.3) 1px, transparent 1px)
        `,
        backgroundSize: '20px 20px',
      }} />
      
      {/* Pulsing glow effect */}
      <motion.div 
        className="absolute inset-0 bg-gradient-to-r from-pink-500/5 via-purple-500/10 to-pink-500/5"
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
      
      {/* LIVE indicator */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-10">
        <motion.div 
          className="w-2 h-2 rounded-full bg-pink-500"
          animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
        <span className="text-[10px] font-bold text-pink-400 uppercase tracking-wider">Live</span>
      </div>
      
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ 
            opacity: 1, 
            y: 0,
            scale: 1,
          }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{
            duration: 0.2,
            ease: "easeOut",
          }}
          className="flex items-center gap-2 px-14 py-2 w-full justify-center relative z-10"
        >
          <motion.div
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/20"
            animate={{
              scale: [1, 1.05, 1],
              borderColor: ['rgba(236,72,153,0.2)', 'rgba(236,72,153,0.4)', 'rgba(236,72,153,0.2)'],
            }}
            transition={{
              duration: 1.5,
              ease: "easeInOut",
              repeat: Infinity,
            }}
          >
            {getIcon(currentActivity.type)}
          </motion.div>
          <motion.div 
            className="text-sm font-medium whitespace-nowrap drop-shadow-md"
            animate={{
              x: [0, -1, 1, -1, 1, 0],
            }}
            transition={{
              duration: 0.3,
              ease: "easeInOut",
              delay: 0.1,
            }}
          >
            {getActivityText(currentActivity)}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
