import { Bell, Check, CheckCheck, BellRing, Zap, Activity, TrendingUp, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useNotifications } from '@/hooks/useNotifications';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAvloPrice } from '@/hooks/useAvloPrice';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { getDefaultAvatarForUser } from '@/lib/defaultAvatars';
import AvloTokenLogo from '@/assets/avlo-token-logo.jpg';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';

export const NotificationCenter = ({ isPostsPage = false, isOverlay = false }: { isPostsPage?: boolean; isOverlay?: boolean }) => {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification } =
    useNotifications();
  const { isSupported, isSubscribed, loading: pushLoading, subscribe, unsubscribe } = 
    usePushNotifications();
  const { price: avloPrice, formatAvloWithUsd } = useAvloPrice();
  const navigate = useNavigate();
  const [sideOffset, setSideOffset] = useState(120);
  const [profileAvatarById, setProfileAvatarById] = useState<Record<string, string | null>>({});

  const actorIds = useMemo(() => {
    const ids = notifications
      .map((notification: any) =>
        notification.data?.follower_id ||
        notification.data?.liker_id ||
        notification.data?.commenter_id ||
        notification.data?.sender_id ||
        notification.data?.payer_id ||
        notification.data?.swiper_id ||
        notification.data?.actor_id ||
        notification.data?.matched_user_id ||
        notification.data?.booster_id ||
        notification.data?.creator_id
      )
      .filter((id: any): id is string => typeof id === 'string' && id.length > 0);

    return Array.from(new Set(ids));
  }, [notifications]);

  // Format notification message with USD value for rewards
  const formatNotificationMessage = (notification: any): { text: string; usdValue?: string } => {
    // Check if it's a tip or reward notification with AVLO amount
    if ((notification.type === 'reward' || notification.type === 'tip') && notification.data?.amount) {
      const amount = parseFloat(notification.data.amount);
      if (!isNaN(amount) && avloPrice > 0) {
        const { usd } = formatAvloWithUsd(amount);
        // Replace the AVLO amount in message with amount + USD
        const text = notification.message.replace(
          /(\d+(?:,\d{3})*(?:\.\d+)?)\s*AVLO/gi,
          `$1 AVLO`
        );
        return { text, usdValue: usd };
      }
    }
    return { text: notification.message };
  };

  useEffect(() => {
    const updateSideOffset = () => {
      const height = window.innerHeight;
      // Ekran yüksekliğine göre responsive offset - zile çok yakın
      if (height < 700) {
        setSideOffset(10);
      } else if (height < 900) {
        setSideOffset(15);
      } else {
        setSideOffset(20);
      }
    };

    updateSideOffset();
    window.addEventListener('resize', updateSideOffset);
    return () => window.removeEventListener('resize', updateSideOffset);
  }, []);

  // Get notification category badge
  const getNotificationCategory = (type: string): { label: string; color: string; icon: React.ReactNode } => {
    switch (type) {
      case 'match':
        return { label: 'MATCH', color: 'from-pink-500 to-rose-500', icon: <Sparkles className="w-3 h-3" /> };
      case 'message':
        return { label: 'MSG', color: 'from-blue-500 to-cyan-500', icon: <Activity className="w-3 h-3" /> };
      case 'tip':
      case 'swipe_gift':
        return { label: 'GIFT', color: 'from-amber-500 to-orange-500', icon: <Zap className="w-3 h-3" /> };
      case 'achievement':
        return { label: 'UNLOCK', color: 'from-purple-500 to-violet-500', icon: <TrendingUp className="w-3 h-3" /> };
      case 'reward':
        return { label: 'REWARD', color: 'from-green-500 to-emerald-500', icon: <Zap className="w-3 h-3" /> };
      case 'follow':
        return { label: 'FOLLOW', color: 'from-indigo-500 to-blue-500', icon: <Activity className="w-3 h-3" /> };
      case 'like':
        return { label: 'LIKE', color: 'from-red-500 to-pink-500', icon: <Sparkles className="w-3 h-3" /> };
      case 'comment':
        return { label: 'COMMENT', color: 'from-teal-500 to-cyan-500', icon: <Activity className="w-3 h-3" /> };
      case 'profile_boost':
      case 'pool_boost':
        return { label: 'BOOST', color: 'from-orange-500 to-red-500', icon: <TrendingUp className="w-3 h-3" /> };
      case 'pool_created':
      case 'staking_pool_created':
        return { label: 'POOL', color: 'from-cyan-500 to-blue-500', icon: <Activity className="w-3 h-3" /> };
      case 'system':
        return { label: 'SYSTEM', color: 'from-zinc-500 to-zinc-600', icon: <Bell className="w-3 h-3" /> };
      default:
        return { label: 'UPDATE', color: 'from-zinc-500 to-zinc-600', icon: <Bell className="w-3 h-3" /> };
    }
  };

  const getNotificationIcon = (type: string, data?: any) => {
    // For tip or swipe_gift notifications, show token logo if available
    if ((type === 'tip' || type === 'swipe_gift') && data?.token_logo) {
      return (
        <img 
          src={data.token_logo} 
          alt={data.token_symbol || 'Token'} 
          className="w-5 h-5 rounded-full object-cover"
        />
      );
    }
    if (type === 'tip' && data?.token_logo_url) {
      return (
        <img 
          src={data.token_logo_url} 
          alt={data.token_symbol || 'Token'} 
          className="w-5 h-5 rounded-full object-cover"
        />
      );
    }
    
    switch (type) {
      case 'match':
        return '💕';
      case 'message':
        return '💬';
      case 'tip':
      case 'swipe_gift':
        return '🎁';
      case 'achievement':
        return '🏆';
      case 'reward':
        return '💰';
      case 'follow':
        return '👤';
      case 'like':
        return '❤️';
      case 'comment':
        return '💬';
      case 'profile_boost':
      case 'pool_boost':
        return '🔥';
      case 'pool_created':
      case 'staking_pool_created':
        return '🚀';
      case 'system':
        return '🔔';
      default:
        return '📢';
    }
  };

  // Get actor avatar from notification data
  const getActorAvatar = (notification: any): string | null => {
    // Check for direct avatar fields - prioritize actor_avatar if it exists and is not empty
    if (notification.data?.actor_avatar && notification.data.actor_avatar.trim() !== '') {
      return notification.data.actor_avatar;
    }
    // Check for sender_avatar (tip notifications)
    if (notification.data?.sender_avatar && notification.data.sender_avatar.trim() !== '') {
      return notification.data.sender_avatar;
    }
    // Check for booster avatar (pool_boost notifications)
    if (notification.data?.booster_avatar && notification.data.booster_avatar.trim() !== '') {
      return notification.data.booster_avatar;
    }
    // Check for creator avatar (staking_pool_created notifications)
    if (notification.data?.creator_avatar && notification.data.creator_avatar.trim() !== '') {
      return notification.data.creator_avatar;
    }
    // Check for pool logo (staking pool notifications)
    if (notification.type === 'staking_pool_created' && notification.data?.pool_logo) {
      return notification.data.pool_logo;
    }
    // Fallback: try to get actor ID and generate default avatar
    const actorId = notification.data?.follower_id || 
                    notification.data?.liker_id || 
                    notification.data?.commenter_id || 
                    notification.data?.sender_id ||
                    notification.data?.payer_id ||
                    notification.data?.swiper_id ||
                    notification.data?.actor_id ||
                    notification.data?.matched_user_id ||
                    notification.data?.booster_id ||
                    notification.data?.creator_id;
    if (actorId) {
      const fetched = profileAvatarById[actorId];
      if (typeof fetched === 'string' && fetched.trim() !== '') {
        return fetched;
      }

      // For tips/gifts, prefer real profile avatars only (no DiceBear fallback)
      if (notification.type === 'tip' || notification.type === 'swipe_gift') {
        return null;
      }

      return getDefaultAvatarForUser(actorId);
    }
    return null;
  };

  // Format swipe_gift notification with token details
  const formatSwipeGiftMessage = (notification: any): { text: string; tokenLogo?: string } => {
    if (notification.type !== 'swipe_gift') {
      return { text: notification.message };
    }

    const tokenLogo = notification.data?.token_logo;

    // Prefer the backend-provided message (it already reflects burn/team/tip modes)
    if (typeof notification.message === 'string' && notification.message.trim().length > 0) {
      return { text: notification.message, tokenLogo };
    }

    // Legacy fallback (in case older notifications were created without a rich message)
    if (notification.data) {
      const { token_symbol, amount, usd_value, actor_name, payment_destination, is_burned } = notification.data;
      if (token_symbol && amount) {
        const amountStr = Number(amount).toLocaleString();
        const usdStr = usd_value ? ` (${usd_value})` : '';
        const name = actor_name || 'Someone';
        const destination = payment_destination || (is_burned ? 'burn' : 'team');

        if (destination === 'burn') {
          return { text: `${name} burned ${amountStr} ${token_symbol}${usdStr} for you! 🔥`, tokenLogo };
        }
        if (destination === 'tip') {
          return { text: `${name} tipped you ${amountStr} ${token_symbol}${usdStr}! 💝`, tokenLogo };
        }
        return { text: `${name} sent ${amountStr} ${token_symbol}${usdStr} to the team for you! 👥`, tokenLogo };
      }
    }

    return { text: 'You received a gift!', tokenLogo };
  };

  const handleNotificationClick = async (notification: any) => {
    // Mark as read and delete (both update state locally)
    await Promise.all([
      markAsRead(notification.id),
      deleteNotification(notification.id)
    ]);

    // Notify other parts of the app that notifications changed
    window.dispatchEvent(new Event('notifications:updated'));

    // Then navigate based on notification type
    if (notification.type === 'tip' && notification.data?.sender_id) {
      navigate(`/profile/${notification.data.sender_id}`);
    } else if (notification.type === 'message' && notification.data?.match_id) {
      navigate(`/chat/${notification.data.match_id}`);
    } else if (notification.type === 'match' && notification.data?.match_id) {
      navigate(`/chat/${notification.data.match_id}`);
    } else if (notification.type === 'reward' && notification.data?.payer_id) {
      navigate(`/profile/${notification.data.payer_id}`);
    } else if (notification.type === 'follow' && notification.data?.follower_id) {
      navigate(`/profile/${notification.data.follower_id}`);
    } else if (notification.type === 'swipe_gift' && notification.data?.actor_id) {
      navigate(`/profile/${notification.data.actor_id}`);
    } else if ((notification.type === 'pool_created' || notification.type === 'staking_pool_created') && notification.data?.staking_contract_address) {
      navigate(`/staking?pool=${notification.data.staking_contract_address}`);
    } else if (notification.type === 'like' && notification.data?.post_id) {
      // Navigate to user's own profile with the highlighted post
      navigate(`/profile/${notification.user_id}?post=${notification.data.post_id}`);
    } else if (notification.type === 'comment' && notification.data?.post_id) {
      // Navigate to user's own profile with comments open
      navigate(`/profile/${notification.user_id}?post=${notification.data.post_id}&comments=true`);
    } else if (notification.type === 'like' || notification.type === 'comment') {
      // Fallback: navigate to posts page
      navigate('/posts');
    }
  };

  // If used in overlay mode (from sidebar), render content only
  if (isOverlay) {
    return (
      <div className="flex flex-col h-full">
        {loading ? (
          <div className="p-8 text-center text-gray-400 flex-1">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-400 flex-1">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800 flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 hover:bg-zinc-800 transition-colors cursor-pointer ${
                  !notification.read ? 'bg-zinc-900' : ''
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex gap-3">
                  <div className="relative flex-shrink-0">
                    {getActorAvatar(notification) ? (
                      <Avatar className={`w-10 h-10 ring-2 ${notification.type === 'pool_created' && notification.data?.creator_arena_verified ? 'ring-cyan-500/70' : 'ring-orange-500/50'}`}>
                        <AvatarImage src={getActorAvatar(notification)!} alt="User" />
                        <AvatarFallback className="bg-gradient-to-br from-orange-500 to-pink-500 text-white text-lg">
                          {getNotificationIcon(notification.type)}
                        </AvatarFallback>
                      </Avatar>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-xl">
                          {getNotificationIcon(notification.type, notification.data)}
                        </div>
                      )}
                      {/* Arena verified badge on avatar */}
                      {notification.type === 'pool_created' && notification.data?.creator_arena_verified ? (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center border-2 border-zinc-900">
                          <span className="text-white text-[10px] font-bold">✓</span>
                        </div>
                      ) : (
                        <div className="absolute -bottom-1 -right-1 text-xs flex items-center justify-center">
                          {typeof getNotificationIcon(notification.type, notification.data) === 'string' 
                            ? getNotificationIcon(notification.type, notification.data)
                            : '🎁'}
                        </div>
                      )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-white text-sm">
                        {notification.title}
                      </p>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0 mt-1" />
                      )}
                    </div>
                      <div className="text-gray-400 text-sm mt-1 flex items-start gap-1 flex-wrap min-w-0 w-full">
                        {/* Show token logos for pool_created notifications */}
                        {notification.type === 'pool_created' && notification.data?.reward_token_logo ? (
                          <img src={notification.data.reward_token_logo} alt={notification.data.reward_token_symbol || 'Token'} className="w-4 h-4 rounded-full inline-block flex-shrink-0 mt-0.5" />
                        ) : (notification.type === 'swipe_gift' || notification.type === 'tip') && (notification.data?.token_logo || notification.data?.token_logo_url) ? (
                          <img src={notification.data.token_logo || notification.data.token_logo_url} alt={notification.data.token_symbol || 'Token'} className="w-4 h-4 rounded-full inline-block flex-shrink-0 mt-0.5" />
                        ) : (notification.type === 'reward' || notification.type === 'tip' || notification.type === 'swipe_gift') ? (
                          <img src={AvloTokenLogo} alt="AVLO" className="w-4 h-4 rounded-full inline-block flex-shrink-0 mt-0.5" />
                        ) : null}
                        {/* Arena verified badge is now shown on avatar, no need for inline badge */}
                        <span className="flex-1 min-w-0 break-words whitespace-normal">
                          {notification.type === 'swipe_gift' 
                            ? formatSwipeGiftMessage(notification).text 
                            : formatNotificationMessage(notification).text}
                        </span>
                        {notification.type !== 'swipe_gift' && formatNotificationMessage(notification).usdValue && (
                          <span className="text-green-400">({formatNotificationMessage(notification).usdValue})</span>
                        )}
                      </div>
                    <p className="text-gray-500 text-xs mt-2">
                      {formatDistanceToNow(new Date(notification.created_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`relative ${
            isPostsPage
              ? 'text-white hover:bg-zinc-800'
              : 'text-foreground hover:bg-white/20'
          }`}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-love-primary text-white text-xs rounded-full flex items-center justify-center font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        side="bottom" 
        align="end"
        sideOffset={8}
        className="w-96 p-0 bg-black/95 backdrop-blur-2xl border border-zinc-800/50 z-[9999] rounded-2xl overflow-hidden shadow-2xl shadow-black/50"
      >
        {/* Tech Header */}
        <div className="relative p-4 border-b border-zinc-800/50 bg-gradient-to-r from-zinc-900/80 via-black to-zinc-900/80">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(139,92,246,0.03)_50%,transparent_100%)]" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-black animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm tracking-wide">NOTIFICATIONS</h3>
                <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">
                  {notifications.length} updates • {unreadCount} unread
                </p>
              </div>
            </div>
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await Promise.all(notifications.map(n => deleteNotification(n.id)));
                  window.dispatchEvent(new Event('notifications:updated'));
                }}
                className="text-zinc-500 hover:text-white hover:bg-zinc-800/50 text-xs font-mono"
              >
                CLEAR
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="h-[420px] overflow-x-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="relative w-16 h-16 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full border-2 border-violet-500/20 animate-ping" />
                <div className="absolute inset-2 rounded-full border-2 border-t-violet-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                <Activity className="absolute inset-0 m-auto w-6 h-6 text-violet-400" />
              </div>
              <p className="text-zinc-500 font-mono text-xs tracking-wider">SYNCING DATA...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <div className="relative w-20 h-20 mx-auto mb-4">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700/50" />
                <Bell className="absolute inset-0 m-auto w-8 h-8 text-zinc-600" />
              </div>
              <p className="text-zinc-500 font-mono text-xs tracking-wider mb-1">NO NOTIFICATIONS</p>
              <p className="text-zinc-600 text-[10px]">Your feed is empty</p>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              <AnimatePresence>
                {notifications.map((notification, index) => {
                  const category = getNotificationCategory(notification.type);
                  return (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ delay: index * 0.03 }}
                      className={`relative group p-3 rounded-xl cursor-pointer transition-all duration-300 ${
                        !notification.read 
                          ? 'bg-gradient-to-r from-violet-500/10 via-transparent to-transparent border border-violet-500/20' 
                          : 'bg-zinc-900/50 hover:bg-zinc-800/50 border border-transparent hover:border-zinc-700/50'
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      {/* Glow effect for unread */}
                      {!notification.read && (
                        <div className="absolute inset-0 rounded-xl bg-violet-500/5 blur-xl" />
                      )}
                      
                      <div className="relative flex gap-3">
                        {/* Avatar with tech frame */}
                        <div className="relative flex-shrink-0">
                          <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${notification.type === 'pool_created' && notification.data?.creator_arena_verified ? 'from-cyan-500 to-blue-500' : category.color} opacity-20 blur-sm`} />
                          {getActorAvatar(notification) ? (
                            <Avatar className={`w-11 h-11 rounded-xl border-2 ${notification.type === 'pool_created' && notification.data?.creator_arena_verified ? 'border-cyan-500/50' : 'border-zinc-700/50'}`}>
                              <AvatarImage src={getActorAvatar(notification)!} alt="User" className="rounded-xl" />
                              <AvatarFallback className={`rounded-xl bg-gradient-to-br ${category.color} text-white text-lg`}>
                                {notification.title?.[0] || '?'}
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${category.color} flex items-center justify-center`}>
                              {category.icon}
                            </div>
                          )}
                          {/* Arena verified badge for pool_created OR Category badge */}
                          {notification.type === 'pool_created' && notification.data?.creator_arena_verified ? (
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center border-2 border-zinc-900 shadow-lg">
                              <span className="text-white text-[10px] font-bold">✓</span>
                            </div>
                          ) : (
                            <div className={`absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md bg-gradient-to-r ${category.color} text-[8px] font-bold text-white shadow-lg`}>
                              {category.label}
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="font-semibold text-white text-sm leading-tight line-clamp-1">
                              {notification.title}
                            </p>
                            {!notification.read && (
                              <div className="relative flex-shrink-0">
                                <div className="w-2 h-2 bg-violet-500 rounded-full" />
                                <div className="absolute inset-0 w-2 h-2 bg-violet-500 rounded-full animate-ping" />
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-start gap-1.5 text-zinc-400 text-xs flex-wrap min-w-0 w-full">
                            {/* Token logo for pool_created */}
                            {notification.type === 'pool_created' && notification.data?.reward_token_logo ? (
                              <img src={notification.data.reward_token_logo} alt={notification.data.reward_token_symbol || 'Token'} className="w-4 h-4 rounded-full ring-1 ring-zinc-700 flex-shrink-0 mt-0.5" />
                            ) : (notification.type === 'swipe_gift' || notification.type === 'tip') && (notification.data?.token_logo || notification.data?.token_logo_url) ? (
                              <img src={notification.data.token_logo || notification.data.token_logo_url} alt={notification.data.token_symbol || 'Token'} className="w-4 h-4 rounded-full ring-1 ring-zinc-700 flex-shrink-0 mt-0.5" />
                            ) : (notification.type === 'reward' || notification.type === 'tip' || notification.type === 'swipe_gift') ? (
                              <img src={AvloTokenLogo} alt="AVLO" className="w-4 h-4 rounded-full ring-1 ring-zinc-700 flex-shrink-0 mt-0.5" />
                            ) : null}
                            <span className="flex-1 min-w-0 break-words whitespace-normal">
                              {notification.type === 'swipe_gift' 
                                ? formatSwipeGiftMessage(notification).text 
                                : formatNotificationMessage(notification).text}
                            </span>
                            {notification.type !== 'swipe_gift' && formatNotificationMessage(notification).usdValue && (
                              <span className="text-green-400 font-mono text-[10px]">+{formatNotificationMessage(notification).usdValue}</span>
                            )}
                          </div>

                          {/* Timestamp with tech style */}
                          <div className="flex items-center gap-2 mt-2">
                            <div className="h-px flex-1 bg-gradient-to-r from-zinc-800 to-transparent" />
                            <span className="text-[10px] font-mono text-zinc-600 tracking-wider">
                              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true }).toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Hover effect line */}
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-violet-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>

        {/* Tech Footer */}
        <div className="relative p-3 border-t border-zinc-800/50 bg-gradient-to-r from-zinc-900/80 via-black to-zinc-900/80">
          <div className="flex items-center justify-center gap-2 text-[10px] font-mono text-zinc-600">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span>LIVE SYNC ENABLED</span>
            <span className="text-zinc-700">•</span>
            <span>v2.0</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
