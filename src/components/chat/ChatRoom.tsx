import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAvatarUrl } from '@/lib/defaultAvatars';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Send, Sparkles, Loader2, ChevronUp, ChevronDown, Pin, PinOff, Crown, Trash2, Ban, Bot, Zap, X, ImageIcon } from 'lucide-react';
import { GifPicker } from '@/components/GifPicker';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useUnifiedCost } from '@/hooks/useUnifiedCost';
import { useAvloBalance } from '@/hooks/useAvloBalance';
import { useAvloPrice } from '@/hooks/useAvloPrice';
import { useLoveAI, LoveAIResponse, MatchData, UserInfo, PostData, GameData, LeaderboardData } from '@/hooks/useLoveAI';
import { useCommunityActivity, ActivityMessage, ActivityTicker, ActivityNotification } from './CommunityActivityFeed';
import LiveDAOPolls from './LiveDAOPolls';
import ChatGuidancePanel from './ChatGuidancePanel';
import { Badge } from '@/components/ui/badge';

// Helper to check if URL is a video
const isVideoUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
  const lowerUrl = url.toLowerCase();
  return videoExtensions.some(ext => lowerUrl.includes(ext));
};

// Helper to strip links from content
const stripLinks = (content: string): string => {
  // Remove URLs
  return content.replace(/https?:\/\/[^\s]+/gi, '[link removed]')
    .replace(/www\.[^\s]+/gi, '[link removed]');
};

interface Message {
  id: string;
  sender_id: string;
  content: string;
  is_voice: boolean;
  created_at: string;
  is_pinned?: boolean;
  sender: {
    username: string;
    avatar_url: string | null;
    display_name: string | null;
  };
  attachments?: Array<{
    id: string;
    type: string;
    url: string;
  }>;
}

interface ChatRoomProps {
  roomId: string;
  roomTitle: string;
}

// Staking Pool Creator Badge - shows ALL staking pools created by user
interface StakingPoolInfo {
  id: string;
  title: string;
  creator_wallet: string;
  stake_token_logo: string | null;
  reward_token_logo: string | null;
}

// Wrapper component to check if user is a staking creator and wrap entire message
function StakingCreatorWrapper({ 
  senderId, 
  children,
  isOwnMessage 
}: { 
  senderId: string; 
  children: React.ReactNode;
  isOwnMessage: boolean;
}) {
  const [pools, setPools] = useState<StakingPoolInfo[]>([]);
  const [showGrid, setShowGrid] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkCreator = async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('wallet_address')
          .eq('id', senderId)
          .single();

        if (!profile?.wallet_address) return;

        // Get only APPROVED staking pools created by this user (unapproved/rejected should not show in chat)
        const { data: userPools } = await supabase
          .from('staking_pools')
          .select('id, title, creator_wallet, stake_token_logo, reward_token_logo')
          .ilike('creator_wallet', profile.wallet_address)
          .eq('is_active', true)
          .neq('pending_approval', true)
          .neq('is_rejected', true);

        if (userPools && userPools.length > 0) {
          setPools(userPools);
        }
      } catch (err) {
        console.log('Error checking staking creator:', err);
      }
    };
    checkCreator();
  }, [senderId]);

  // Not a creator - render children normally
  if (pools.length === 0) {
    return <>{children}</>;
  }

  // Creator - wrap in special tech pitch bubble
  return (
    <div className={`relative w-full ${isOwnMessage ? 'max-w-[85%] ml-auto' : 'max-w-[85%]'}`}>
      {/* Tech pitch creator wrapper */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-700/50 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 w-full">
        {/* Subtle grid overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px',
          }}
        />
        
        {/* Accent line on left */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-cyan-500 via-purple-500 to-pink-500" />
        
        {/* Creator header with token logos */}
        <div className="relative px-2 py-1.5 border-b border-zinc-700/50 bg-black/30 overflow-hidden">
          <div className="flex items-center gap-1 flex-wrap overflow-x-auto scrollbar-hide">
            <div className="w-3.5 h-3.5 rounded bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <Crown className="w-2 h-2 text-white" />
            </div>
            <span className="text-[8px] font-bold uppercase tracking-wider text-zinc-400 flex-shrink-0">
              Creator
            </span>
            <span className="text-[8px] text-zinc-500 flex-shrink-0">•</span>
            {/* Token logos - scrollable on overflow */}
            <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide flex-1 min-w-0">
              {pools.map((pool, idx) => (
                <div key={pool.id} className="flex items-center gap-0.5 flex-shrink-0">
                  {pool.stake_token_logo && (
                    <img 
                      src={pool.stake_token_logo} 
                      alt={pool.title} 
                      className="w-3 h-3 rounded-full border border-zinc-600"
                    />
                  )}
                  <span className="text-[8px] font-medium text-cyan-400 whitespace-nowrap">
                    {pool.title.replace('Stake ', '')}
                  </span>
                  {idx < pools.length - 1 && (
                    <span className="text-[8px] text-zinc-600 mx-0.5">•</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Message content */}
        <div className="relative p-2.5 w-full overflow-hidden">
          <div className="break-words overflow-wrap-anywhere">
            {children}
          </div>
        </div>
        
        {/* Clickable pools grid with token logos */}
        <div className="relative px-3 pb-3">
          <button
            onClick={() => setShowGrid(!showGrid)}
            className="text-[10px] text-zinc-500 hover:text-white flex items-center gap-1 transition-colors"
          >
            <span>{showGrid ? '▼' : '▶'}</span>
            <span>View {pools.length} Staking Pool{pools.length > 1 ? 's' : ''}</span>
          </button>
          
          {showGrid && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {pools.map((pool) => (
                <button
                  key={pool.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/staking?pool=${pool.id}`);
                  }}
                  className="group flex items-center gap-2 p-2 rounded-lg bg-black/40 border border-zinc-700/50 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all"
                >
                  {pool.stake_token_logo ? (
                    <img 
                      src={pool.stake_token_logo} 
                      alt={pool.title}
                      className="w-6 h-6 rounded-full border border-cyan-500/30 group-hover:border-cyan-400"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 flex items-center justify-center group-hover:border-cyan-400">
                      <Crown className="w-3 h-3 text-cyan-400" />
                    </div>
                  )}
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-[10px] font-medium text-white truncate group-hover:text-cyan-300">
                      {pool.title}
                    </p>
                    <p className="text-[8px] text-zinc-500">Tap to view</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Pool Creator Badge for current staking room only (simplified)
function PoolCreatorBadge({ senderId, poolCreatorWallet }: { senderId: string; poolCreatorWallet: string }) {
  const [isCreator, setIsCreator] = useState(false);

  useEffect(() => {
    const checkCreator = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('wallet_address')
          .eq('id', senderId)
          .single();

        if (data?.wallet_address?.toLowerCase() === poolCreatorWallet.toLowerCase()) {
          setIsCreator(true);
        }
      } catch (err) {
        console.log('Error checking creator:', err);
      }
    };
    checkCreator();
  }, [senderId, poolCreatorWallet]);

  if (!isCreator) return null;

  return (
    <Badge className="bg-gradient-to-r from-zinc-800 to-zinc-700 text-cyan-400 text-[9px] px-1.5 py-0 border border-cyan-500/30">
      <Crown className="w-2.5 h-2.5 mr-0.5" />
      Room Host
    </Badge>
  );
}
export default function ChatRoom({ roomId, roomTitle }: ChatRoomProps) {
  const { profile } = useWalletAuth();
  const navigate = useNavigate();
  const { chatMessageCost: messageCost, loading: loadingCost } = useUnifiedCost();
  const { balance: avloBalance, refresh: refetchBalances } = useAvloBalance();
  const { formatAvloWithUsd } = useAvloPrice();
  const { askLoveFull, isLoading: loveAILoading } = useLoveAI();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loveTyping, setLoveTyping] = useState(false);
  const [profileToVisit, setProfileToVisit] = useState<string | null>(null);
  const [showCommunityPanel, setShowCommunityPanel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Staking room state
  const [isStakingRoom, setIsStakingRoom] = useState(false);
  const [poolCreatorWallet, setPoolCreatorWallet] = useState<string | null>(null);
  const [isPoolCreator, setIsPoolCreator] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  
  // Moderation state
  const [isAdmin, setIsAdmin] = useState(false);
  const [bannedUsers, setBannedUsers] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ messageId: string; senderId: string } | null>(null);
  const [banConfirm, setBanConfirm] = useState<{ userId: string; username: string } | null>(null);
  
  // GIF picker state
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [pendingGif, setPendingGif] = useState<string | null>(null);
  
  // Community Activity hook - only for Global Chat with extended notifications
  const isGlobalChat = roomTitle === 'Global Chat';
  const { notifications: activityNotifications } = useCommunityActivity({
    enabled: isGlobalChat,
    maxNotifications: 10,
  });

  // Check if this is a staking room and if user is pool creator
  useEffect(() => {
    const checkStakingRoom = async () => {
      try {
        const { data: roomData } = await supabase
          .from('chat_rooms')
          .select('room_type, reference_id')
          .eq('id', roomId)
          .single();

        if (roomData?.room_type === 'staking' && roomData?.reference_id) {
          setIsStakingRoom(true);
          
          // Get pool creator wallet
          const { data: poolData } = await supabase
            .from('staking_pools')
            .select('creator_wallet')
            .eq('id', roomData.reference_id)
            .single();

          if (poolData?.creator_wallet) {
            setPoolCreatorWallet(poolData.creator_wallet.toLowerCase());
            
            // Check if current user is pool creator
            const currentWallet = (profile as any)?.wallet_address?.toLowerCase();
            if (currentWallet && currentWallet === poolData.creator_wallet.toLowerCase()) {
              setIsPoolCreator(true);
            }
          }
        } else {
          setIsStakingRoom(false);
          setPoolCreatorWallet(null);
          setIsPoolCreator(false);
        }
      } catch (err) {
        console.log('Error checking staking room:', err);
      }
    };

    checkStakingRoom();
  }, [roomId, profile]);

  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      if (!profile?.id) return;
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', profile.id)
        .eq('role', 'admin')
        .maybeSingle();
      setIsAdmin(!!data);
    };
    checkAdmin();
  }, [profile?.id]);

  // Load banned users for this room
  useEffect(() => {
    const loadBannedUsers = async () => {
      const { data } = await supabase
        .from('chat_banned_users')
        .select('user_id')
        .eq('room_id', roomId);
      if (data) {
        setBannedUsers(data.map(b => b.user_id));
      }
    };
    loadBannedUsers();

    // Subscribe to ban changes
    const channel = supabase
      .channel(`room_${roomId}_bans`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_banned_users', filter: `room_id=eq.${roomId}` }, () => {
        loadBannedUsers();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    fetchMessages();
    
    // Subscribe to new messages in this room
    const channel = supabase
      .channel(`room_${roomId}_messages`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'public_chat_messages',
          filter: `room_id=eq.${roomId}`
        },
        async (payload) => {
          // Fetch full message with sender info
          const { data } = await supabase
            .from('public_chat_messages')
            .select(`
              *,
              sender:profiles!public_chat_messages_sender_id_fkey(username, avatar_url, display_name),
              attachments:public_chat_attachments(*)
            `)
            .eq('id', payload.new.id)
            .single();

          if (data) {
            setMessages((prev) => [...prev, data as Message]);
            // Only scroll to bottom for messages from others, not own messages
            if ((data as Message).sender_id !== profile?.id) {
              scrollToBottom();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // Scroll to bottom on initial load
  const hasScrolledRef = useRef(false);
  useEffect(() => {
    if (messages.length > 0 && !hasScrolledRef.current) {
      // Scroll to bottom on initial load
      const timer = setTimeout(() => {
        scrollToBottom();
        hasScrolledRef.current = true;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages.length]);
  
  // Reset scroll flag when room changes
  useEffect(() => {
    hasScrolledRef.current = false;
  }, [roomId]);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('public_chat_messages')
        .select(`
          *,
          sender:profiles!public_chat_messages_sender_id_fkey(username, avatar_url, display_name),
          attachments:public_chat_attachments(*)
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      const allMessages = ((data as Message[]) || []).reverse();
      
      // Separate pinned messages
      const pinned = allMessages.filter(m => m.is_pinned);
      const regular = allMessages.filter(m => !m.is_pinned);
      
      setPinnedMessages(pinned);
      setMessages(regular);
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    }
  };

  // Toggle pin message (only for pool creators in staking rooms)
  const togglePinMessage = async (messageId: string, currentlyPinned: boolean) => {
    if (!isPoolCreator) return;
    
    try {
      const { error } = await supabase
        .from('public_chat_messages')
        .update({
          is_pinned: !currentlyPinned,
          pinned_at: currentlyPinned ? null : new Date().toISOString(),
          pinned_by: currentlyPinned ? null : profile?.id
        })
        .eq('id', messageId);

      if (error) throw error;
      
      // Refresh messages
      fetchMessages();
      toast.success(currentlyPinned ? 'Message unpinned' : 'Message pinned');
    } catch (err) {
      console.error('Error toggling pin:', err);
      toast.error('Failed to update pin status');
    }
  };

  // Check if a message sender is pool creator
  const isSenderPoolCreator = (senderId: string) => {
    if (!isStakingRoom || !poolCreatorWallet) return false;
    // We need to check by looking at the sender's wallet
    // For now, we'll need to fetch this info
    return false; // Will be enhanced with proper check
  };

  const sendMessage = async (content: string, gifUrl?: string) => {
    if (!profile || (!content.trim() && !gifUrl)) return;

    // Check if user is banned
    if (isBanned) {
      toast.error('You are banned from this chat room');
      return;
    }

    // Strip links from content (but not gif URLs which are attachments)
    const sanitizedContent = stripLinks(content);
    
    // Check if message contains only link placeholders (unless we have a GIF)
    if (!gifUrl && (sanitizedContent.trim() === '[link removed]' || !sanitizedContent.trim())) {
      toast.error('Links are not allowed in chat');
      return;
    }

    // Preliminary client-side balance check
    const currentBalance = avloBalance;
    if (messageCost > 0 && currentBalance < messageCost) {
      toast.error(`Insufficient balance. You need ${messageCost} AVLO Credit to send a message.`);
      return;
    }

    setSending(true);
    try {
      // Use secure edge function for server-side validation
      const walletAddress = (profile as any)?.wallet_address;
      if (!walletAddress) {
        toast.error('Wallet not connected');
        return;
      }

      // Prepare attachments if GIF is included
      const attachments = gifUrl ? [{ type: 'gif', url: gifUrl }] : [];

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-chat-message`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            walletAddress,
            roomId,
            content: sanitizedContent.trim() || '📎',
            isVoice: false,
            attachments,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        if (result.insufficientBalance) {
          toast.error(`Insufficient balance. Required: ${result.required} AVLO Credit, Available: ${result.available}`);
        } else {
          toast.error(result.error || 'Failed to send message');
        }
        return;
      }

      setNewMessage('');
      setPendingGif(null);
      setShowGifPicker(false);
      
      // Refresh balances to show updated available balance
      refetchBalances();
      
      if (messageCost > 0) {
        toast.success(`Message sent! ${messageCost} AVLO Credit deducted.`);
      }

      // Check if the message is calling Love AI (only in global chat)
      const lowerContent = content.toLowerCase();
      const isLoveCall = lowerContent.includes('hey love') || 
                         lowerContent.includes('hi love') || 
                         lowerContent.startsWith('love,') ||
                         lowerContent.startsWith('love ') ||
                         lowerContent.includes('@love');
      
      if (isLoveCall && roomTitle === 'Global Chat') {
        // Extract the question (remove the "hey love" part)
        let cleanedMessage = content
          .replace(/hey love[,!]?/gi, '')
          .replace(/hi love[,!]?/gi, '')
          .replace(/@love/gi, '')
          .replace(/^love[,]?\s*/gi, '')
          .trim();
        
        // If just "Hey Love" with no question, default to a greeting
        if (!cleanedMessage) {
          cleanedMessage = 'hello';
        }
        
        setLoveTyping(true);
        try {
          const loveData = await askLoveFull(cleanedMessage);
          
          // Build rich response content with structured data
          let richContent = `💜 Love: ${loveData.response}`;
          
          // Add matches data as JSON for rich rendering
          if (loveData.matches && loveData.matches.length > 0) {
            richContent += `\n\n[LOVE_DATA_MATCHES]${JSON.stringify(loveData.matches)}[/LOVE_DATA_MATCHES]`;
          }
          
          // Add posts data
          if (loveData.posts && loveData.posts.length > 0) {
            richContent += `\n\n[LOVE_DATA_POSTS]${JSON.stringify(loveData.posts)}[/LOVE_DATA_POSTS]`;
          }
          
          // Add games data
          if (loveData.games && loveData.games.length > 0) {
            richContent += `\n\n[LOVE_DATA_GAMES]${JSON.stringify(loveData.games)}[/LOVE_DATA_GAMES]`;
          }
          
          // Add leaderboard data
          if (loveData.leaderboard && loveData.leaderboard.length > 0) {
            richContent += `\n\n[LOVE_DATA_LEADERBOARD]${JSON.stringify(loveData.leaderboard)}[/LOVE_DATA_LEADERBOARD]`;
          }
          
          // Send Love's response as a system message
          await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-chat-message`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
              body: JSON.stringify({
                walletAddress,
                roomId,
                content: richContent,
                isVoice: false,
                attachments: [],
                isSystemMessage: true,
              }),
            }
          );
        } catch (err) {
          console.error('Love AI error:', err);
        } finally {
          setLoveTyping(false);
        }
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleSendMessage = () => {
    if (newMessage.trim() || pendingGif) {
      sendMessage(newMessage, pendingGif || undefined);
    }
  };

  const handleGifSelected = (gifUrl: string) => {
    setPendingGif(gifUrl);
    setShowGifPicker(false);
  };

  // Delete message function (for pool creators and admins)
  const deleteMessage = async (messageId: string) => {
    if (!isPoolCreator && !isAdmin) {
      toast.error('You do not have permission to delete messages');
      return;
    }

    try {
      const { error } = await supabase
        .from('public_chat_messages')
        .update({
          is_deleted: true,
          deleted_by: profile?.id,
          deleted_at: new Date().toISOString()
        })
        .eq('id', messageId);

      if (error) throw error;
      
      // Remove from local state
      setMessages(prev => prev.filter(m => m.id !== messageId));
      setPinnedMessages(prev => prev.filter(m => m.id !== messageId));
      toast.success('Message deleted');
    } catch (err) {
      console.error('Error deleting message:', err);
      toast.error('Failed to delete message');
    }
    setDeleteConfirm(null);
  };

  // Ban user function (for pool creators and admins)
  const banUser = async (userId: string) => {
    if (!isPoolCreator && !isAdmin) {
      toast.error('You do not have permission to ban users');
      return;
    }

    try {
      const { error } = await supabase
        .from('chat_banned_users')
        .insert({
          room_id: roomId,
          user_id: userId,
          banned_by: profile?.id,
          reason: 'Banned by moderator'
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('User is already banned from this room');
        } else {
          throw error;
        }
        return;
      }
      
      toast.success('User banned from this chat room');
    } catch (err) {
      console.error('Error banning user:', err);
      toast.error('Failed to ban user');
    }
    setBanConfirm(null);
  };

  // Check if current user is banned
  const isBanned = profile?.id ? bannedUsers.includes(profile.id) : false;

  return (
    <div className="h-full flex flex-col bg-black pb-16 landscape:pb-10">
      
      {/* Community Panel - Activity Ticker always visible, DAO Polls collapsible */}
      {isGlobalChat && (
        <div className="border-b border-zinc-800 bg-zinc-900/50">
          {/* Activity Ticker - Always visible, full width horizontal */}
          {activityNotifications.length > 0 && (
            <div className="w-full overflow-hidden border-b border-zinc-800/50">
              <ActivityTicker 
                notifications={activityNotifications} 
                onNotificationClick={(notification) => {
                  // Navigate based on activity type
                  switch (notification.type) {
                    case 'match':
                      navigate('/matches');
                      break;
                    case 'swipe':
                      navigate('/');
                      break;
                    case 'post':
                    case 'comment':
                      navigate('/posts');
                      break;
                    case 'game':
                      navigate('/mini-games');
                      break;
                    case 'pixel':
                      navigate('/loveart');
                      break;
                    case 'video':
                      navigate('/watch-earn');
                      break;
                    case 'staking':
                    case 'boost':
                      navigate('/staking');
                      break;
                    case 'follow':
                    case 'profile_boost':
                      navigate('/');
                      break;
                    case 'proposal':
                    case 'vote':
                      navigate('/dao');
                      break;
                    case 'token_listing':
                      navigate('/dao');
                      break;
                    default:
                      break;
                  }
                }}
              />
            </div>
          )}
          
          {/* Collapsible DAO Polls Section */}
          <button 
            onClick={() => setShowCommunityPanel(!showCommunityPanel)}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-orange-400" />
              Live DAO Polls
            </span>
            {showCommunityPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {showCommunityPanel && (
            <LiveDAOPolls maxVisible={3} />
          )}
        </div>
      )}

      {/* Guidance Panel - Score, Minutes, Credits with helpful hints */}
      <ChatGuidancePanel isGlobalChat={isGlobalChat} />
      
      {/* Room Header */}
      <div className="p-4 landscape:p-1.5 landscape:py-1 border-b border-zinc-800 bg-black/60 backdrop-blur-sm landscape:min-h-[36px]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg landscape:text-xs font-bold text-white landscape:leading-tight">{roomTitle}</h3>
            <p className="text-xs landscape:text-[9px] text-zinc-500 landscape:leading-tight">
              {messages.length + pinnedMessages.length} messages • <span className="text-orange-400">
                {isPoolCreator ? 'FREE (Pool Creator)' : `${messageCost} AVLO/msg`}
              </span>
            </p>
          </div>
          {!isPoolCreator && messageCost > 0 && (
            <div className="text-right bg-zinc-900/80 px-3 py-1.5 rounded-lg border border-zinc-700">
              <p className="text-xs text-orange-400 font-semibold">{formatAvloWithUsd(avloBalance).avlo} AVLO Credit</p>
              <p className="text-[10px] text-green-400">{formatAvloWithUsd(avloBalance).usd}</p>
              <p className="text-[10px] text-zinc-400">
                {messageCost > 0 ? Math.floor(avloBalance / messageCost) : '∞'} messages
              </p>
            </div>
          )}
          {isPoolCreator && (
            <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0">
              <Crown className="w-3 h-3 mr-1" />
              Pool Creator
            </Badge>
          )}
        </div>
      </div>

      {/* Pinned Messages */}
      {pinnedMessages.length > 0 && (
        <div className="px-4 py-2 border-b border-yellow-500/30 bg-yellow-500/5">
          <div className="flex items-center gap-2 mb-2">
            <Pin className="w-4 h-4 text-yellow-500" />
            <span className="text-xs font-semibold text-yellow-500">Pinned Messages</span>
          </div>
          <div className="space-y-2">
            {pinnedMessages.map((msg) => (
              <div key={msg.id} className="flex items-start gap-2 p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                <Avatar className="w-6 h-6 border border-yellow-500/30">
                  <AvatarImage src={getAvatarUrl(msg.sender?.avatar_url, msg.sender_id)} />
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-yellow-400">{msg.sender?.display_name || msg.sender?.username}</span>
                  </div>
                  <p className="text-xs text-white truncate">{msg.content}</p>
                </div>
                {isPoolCreator && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => togglePinMessage(msg.id, true)}
                    className="h-6 w-6 p-0 text-yellow-500 hover:text-yellow-400"
                  >
                    <PinOff className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 landscape:p-2 landscape:py-2 space-y-4 landscape:space-y-2">
        {messages.map((message) => {
          const isOwnMessage = message.sender_id === profile?.id;
          const isLoveMessage = message.content?.startsWith('💜 Love:');
          
          // Love AI special message rendering
          if (isLoveMessage) {
            // Parse structured data from message
            let textContent = message.content.replace('💜 Love:', '').trim();
            let matchesData: MatchData[] = [];
            let postsData: PostData[] = [];
            let gamesData: GameData[] = [];
            let leaderboardData: LeaderboardData[] = [];
            
            // Extract matches data
            const matchesMatch = textContent.match(/\[LOVE_DATA_MATCHES\](.*?)\[\/LOVE_DATA_MATCHES\]/s);
            if (matchesMatch) {
              try {
                matchesData = JSON.parse(matchesMatch[1]);
                textContent = textContent.replace(matchesMatch[0], '').trim();
              } catch (e) { console.error('Parse matches error:', e); }
            }
            
            // Extract posts data
            const postsMatch = textContent.match(/\[LOVE_DATA_POSTS\](.*?)\[\/LOVE_DATA_POSTS\]/s);
            if (postsMatch) {
              try {
                postsData = JSON.parse(postsMatch[1]);
                textContent = textContent.replace(postsMatch[0], '').trim();
              } catch (e) { console.error('Parse posts error:', e); }
            }
            
            // Extract games data
            const gamesMatch = textContent.match(/\[LOVE_DATA_GAMES\](.*?)\[\/LOVE_DATA_GAMES\]/s);
            if (gamesMatch) {
              try {
                gamesData = JSON.parse(gamesMatch[1]);
                textContent = textContent.replace(gamesMatch[0], '').trim();
              } catch (e) { console.error('Parse games error:', e); }
            }
            
            // Extract leaderboard data
            const leaderboardMatch = textContent.match(/\[LOVE_DATA_LEADERBOARD\](.*?)\[\/LOVE_DATA_LEADERBOARD\]/s);
            if (leaderboardMatch) {
              try {
                leaderboardData = JSON.parse(leaderboardMatch[1]);
                textContent = textContent.replace(leaderboardMatch[0], '').trim();
              } catch (e) { console.error('Parse leaderboard error:', e); }
            }
            
            return (
              <div key={message.id} className="flex gap-3 items-start">
                {/* Love AI Avatar with tech styling */}
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 landscape:w-7 landscape:h-7 rounded-xl bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                    <Bot className="w-5 h-5 landscape:w-3.5 landscape:h-3.5 text-white" />
                  </div>
                  {/* Orbiting dot */}
                  <div 
                    className="absolute w-1.5 h-1.5 bg-cyan-400 rounded-full shadow-sm shadow-cyan-400 animate-pulse"
                    style={{ top: '-2px', right: '-2px' }}
                  />
                </div>
                
                {/* Love AI Message Content */}
                <div className="flex-1 max-w-[85%]">
                  <div className="flex items-center gap-2 mb-1 landscape:mb-0.5">
                    <span className="text-sm landscape:text-xs font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                      LoveBot
                    </span>
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
                      <Zap className="w-2.5 h-2.5 text-cyan-400" />
                      <span className="text-[9px] text-cyan-400 font-medium">NEURAL</span>
                    </div>
                    <span className="text-xs landscape:text-[10px] text-zinc-500">
                      {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  
                  {/* Tech-styled message bubble */}
                  <div className="relative overflow-hidden rounded-2xl landscape:rounded-xl">
                    {/* Background grid */}
                    <div 
                      className="absolute inset-0 opacity-20"
                      style={{
                        backgroundImage: `
                          linear-gradient(rgba(6, 182, 212, 0.3) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(6, 182, 212, 0.3) 1px, transparent 1px)
                        `,
                        backgroundSize: '15px 15px',
                      }}
                    />
                    
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-pink-500/10" />
                    
                    {/* Content */}
                    <div className="relative px-4 landscape:px-3 py-3 landscape:py-2 border border-cyan-500/20 rounded-2xl landscape:rounded-xl bg-black/50 backdrop-blur-sm">
                      {/* Glowing accent line */}
                      <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-gradient-to-b from-cyan-500 via-purple-500 to-pink-500 rounded-full" />
                      
                      <p className="text-zinc-100 text-sm landscape:text-xs leading-relaxed pl-2 whitespace-pre-wrap mb-3">
                        {textContent}
                      </p>
                      
                      {/* Matches Cards */}
                      {matchesData.length > 0 && (
                        <div className="mt-3 space-y-2 pl-2">
                          {matchesData.map((match, idx) => (
                            <div key={idx} className="flex items-center gap-3 p-2 bg-pink-500/10 border border-pink-500/20 rounded-xl">
                              <div className="flex items-center -space-x-2">
                                <Avatar className="w-8 h-8 border-2 border-pink-500">
                                  <AvatarImage src={match.user1?.avatar_url || ''} />
                                  <AvatarFallback className="bg-pink-500/30 text-white text-xs">
                                    {match.user1?.username?.charAt(0).toUpperCase() || '?'}
                                  </AvatarFallback>
                                </Avatar>
                                <Avatar className="w-8 h-8 border-2 border-cyan-500">
                                  <AvatarImage src={match.user2?.avatar_url || ''} />
                                  <AvatarFallback className="bg-cyan-500/30 text-white text-xs">
                                    {match.user2?.username?.charAt(0).toUpperCase() || '?'}
                                  </AvatarFallback>
                                </Avatar>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-white font-medium truncate">
                                  {match.user1?.display_name || match.user1?.username} 💕 {match.user2?.display_name || match.user2?.username}
                                </p>
                                <p className="text-[10px] text-zinc-400">
                                  {formatDistanceToNow(new Date(match.created_at), { addSuffix: true })}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Posts Cards */}
                      {postsData.length > 0 && (
                        <div className="mt-3 space-y-2 pl-2">
                          {postsData.map((post, idx) => (
                            <div key={idx} className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                              <div className="flex items-center gap-2 mb-1">
                                <Avatar className="w-6 h-6 border border-purple-500/50">
                                  <AvatarImage src={post.author?.avatar_url || ''} />
                                  <AvatarFallback className="bg-purple-500/30 text-white text-[10px]">
                                    {post.author?.username?.charAt(0).toUpperCase() || '?'}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs text-white font-medium">{post.author?.display_name || post.author?.username}</span>
                              </div>
                              <p className="text-xs text-zinc-300 line-clamp-2">{post.content}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Games Cards */}
                      {gamesData.length > 0 && (
                        <div className="mt-3 space-y-2 pl-2">
                          {gamesData.map((game, idx) => (
                            <div key={idx} className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded-xl">
                              <Avatar className="w-6 h-6 border border-green-500/50">
                                <AvatarImage src={game.player?.avatar_url || ''} />
                                <AvatarFallback className="bg-green-500/30 text-white text-[10px]">
                                  {game.player?.username?.charAt(0).toUpperCase() || '?'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-white font-medium truncate">{game.player?.username}</p>
                                <p className="text-[10px] text-green-400">🎮 {game.game_title}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Leaderboard */}
                      {leaderboardData.length > 0 && (
                        <div className="mt-3 space-y-1 pl-2">
                          {leaderboardData.map((player, idx) => (
                            <div key={idx} className="flex items-center gap-2 p-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                              <span className="text-xs font-bold text-yellow-400 w-5">#{player.rank}</span>
                              <Avatar className="w-5 h-5 border border-yellow-500/50">
                                <AvatarImage src={player.player?.avatar_url || ''} />
                                <AvatarFallback className="bg-yellow-500/30 text-white text-[8px]">
                                  {player.player?.username?.charAt(0).toUpperCase() || '?'}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs text-white flex-1 truncate">{player.player?.username}</span>
                              <span className="text-[10px] text-yellow-400">{player.play_time_minutes}m</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          }
          
          // Regular message rendering
          return (
            <div
              key={message.id}
              className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
            >
              <Avatar 
                className="w-10 h-10 landscape:w-7 landscape:h-7 border-2 border-orange-500/20 cursor-pointer hover:border-orange-500/40 transition-colors overflow-hidden"
                onClick={() => setProfileToVisit(message.sender_id)}
              >
                {(() => {
                  const avatarSrc = getAvatarUrl(message.sender?.avatar_url, message.sender_id);
                  return isVideoUrl(avatarSrc) ? (
                    <video
                      src={avatarSrc}
                      className="w-full h-full object-cover"
                      autoPlay
                      loop
                      muted
                      playsInline
                    />
                  ) : (
                    <AvatarImage src={avatarSrc} />
                  );
                })()}
              </Avatar>

               <StakingCreatorWrapper senderId={message.sender_id} isOwnMessage={isOwnMessage}>
                 <div className={`flex-1 ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                   <div className="flex items-center gap-2 mb-1 landscape:mb-0.5 flex-wrap">
                     <span className={`text-sm landscape:text-xs font-semibold text-white ${isOwnMessage ? 'text-right' : ''}`}>
                       {message.sender?.display_name || message.sender?.username || 'Unknown'}
                     </span>
                     {/* Pool Creator Badge - show only for current staking room's creator */}
                     {isStakingRoom && poolCreatorWallet && (
                       <PoolCreatorBadge senderId={message.sender_id} poolCreatorWallet={poolCreatorWallet} />
                     )}
                     <span className="text-xs landscape:text-[10px] text-zinc-500">
                       {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                     </span>
                      {/* Pin button for pool creators */}
                      {isPoolCreator && isStakingRoom && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePinMessage(message.id, !!message.is_pinned);
                          }}
                          className="h-6 w-6 p-0 text-zinc-400 hover:text-yellow-500 hover:bg-zinc-800"
                          title={message.is_pinned ? "Unpin message" : "Pin message"}
                        >
                          {message.is_pinned ? (
                            <PinOff className="w-3.5 h-3.5 text-yellow-500" />
                          ) : (
                            <Pin className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      )}
                      {/* Moderation buttons for pool creators and admins */}
                      {(isPoolCreator || isAdmin) && !isOwnMessage && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm({ messageId: message.id, senderId: message.sender_id });
                            }}
                            className="h-6 w-6 p-0 text-zinc-400 hover:text-red-500 hover:bg-zinc-800"
                            title="Delete message"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setBanConfirm({ 
                                userId: message.sender_id, 
                                username: message.sender?.display_name || message.sender?.username || 'User' 
                              });
                            }}
                            className="h-6 w-6 p-0 text-zinc-400 hover:text-red-500 hover:bg-zinc-800"
                            title="Ban user from room"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                   </div>

                   <div
                     className={`rounded-2xl landscape:rounded-xl px-4 landscape:px-3 py-2 landscape:py-1.5 ${
                       isOwnMessage
                         ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white'
                         : 'bg-zinc-900 text-white border border-zinc-700'
                     }`}
                   >
                    {/* Attachments */}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mb-2 space-y-2">
                        {message.attachments.map((att) => (
                          <div key={att.id}>
                            {att.type === 'voice' && (
                              <audio controls src={att.url} className="max-w-full" />
                            )}
                            {att.type === 'image' && (
                              <img src={att.url} alt="attachment" className="rounded-lg max-w-full" />
                            )}
                            {att.type === 'video' && (
                              <video controls src={att.url} className="rounded-lg max-w-full" />
                            )}
                            {att.type === 'gif' && (
                              <img src={att.url} alt="gif" className="rounded-lg max-w-full" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                     {/* Text content */}
                     {message.content && message.content !== '📎' && (
                       <p className="break-words text-sm landscape:text-xs">{message.content}</p>
                     )}
                  </div>
                </div>
               </StakingCreatorWrapper>
            </div>
          );
        })}
        
        {/* Activity notifications now shown in the community panel above */}
        
        {/* Love AI Typing Indicator */}
        {loveTyping && (
          <div className="flex gap-3 items-start">
            <div className="w-10 h-10 landscape:w-7 landscape:h-7 rounded-xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-500/20">
              <Sparkles className="w-5 h-5 landscape:w-3.5 landscape:h-3.5 text-white" />
            </div>
            <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-2xl px-4 py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-purple-300">Love is thinking</span>
                <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* GIF Picker */}
      {showGifPicker && (
        <div className="absolute bottom-24 left-4 right-4 z-50">
          <GifPicker 
            onGifSelected={handleGifSelected} 
            onClose={() => setShowGifPicker(false)} 
          />
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 landscape:p-1.5 landscape:pb-2 pb-6 border-t border-zinc-800 bg-black/90 backdrop-blur-sm">
        {/* Pending GIF Preview */}
        {pendingGif && (
          <div className="mb-2 relative inline-block">
            <img 
              src={pendingGif} 
              alt="Selected GIF" 
              className="h-20 rounded-lg border border-zinc-700"
            />
            <button
              onClick={() => setPendingGif(null)}
              className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="flex gap-2 items-center">
          {/* GIF Button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowGifPicker(!showGifPicker)}
            className="shrink-0 text-zinc-400 hover:text-orange-400 hover:bg-zinc-800"
            disabled={sending}
          >
            <ImageIcon className="w-5 h-5" />
          </Button>

          <Input
            type="text"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            className="flex-1 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500"
            disabled={sending}
          />

          <Button
            onClick={handleSendMessage}
            disabled={(!newMessage.trim() && !pendingGif) || sending}
            className="shrink-0 bg-orange-500 hover:bg-orange-600"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
        <p className="text-[10px] text-zinc-500 mt-1 text-center">
          Powered by Tenor • Links are disabled
        </p>
      </div>

      {/* Profile Visit Confirmation Dialog */}
      <AlertDialog open={!!profileToVisit} onOpenChange={(open) => !open && setProfileToVisit(null)}>
        <AlertDialogContent className="bg-black border-zinc-800 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white text-xl">Visit Profile?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Would you like to view this user's profile?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-900 text-white border-zinc-700 hover:bg-zinc-800">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              className="bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700"
              onClick={() => {
                if (profileToVisit) {
                  navigate(`/profile/${profileToVisit}`);
                  setProfileToVisit(null);
                }
              }}
            >
              Go to Profile
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Message Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent className="bg-black border-zinc-800 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white text-xl">Delete Message?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This message will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-900 text-white border-zinc-700 hover:bg-zinc-800">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                if (deleteConfirm) {
                  deleteMessage(deleteConfirm.messageId);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Ban User Confirmation Dialog */}
      <AlertDialog open={!!banConfirm} onOpenChange={(open) => !open && setBanConfirm(null)}>
        <AlertDialogContent className="bg-black border-zinc-800 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white text-xl">Ban User?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Are you sure you want to ban <span className="text-orange-400 font-medium">{banConfirm?.username}</span> from this chat room? 
              They will no longer be able to send messages here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-900 text-white border-zinc-700 hover:bg-zinc-800">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                if (banConfirm) {
                  banUser(banConfirm.userId);
                }
              }}
            >
              Ban User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
