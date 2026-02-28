import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Heart, Clock, ChevronRight, Info, Inbox, Send, ChevronDown, XCircle, RefreshCw, Trash2, Undo2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { getAvatarUrl } from '@/lib/defaultAvatars';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface PendingLike {
  id: string;
  created_at: string;
  profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    arena_verified: boolean | null;
  };
}

interface RejectedMatch {
  id: string;
  created_at: string;
  other_user_id: string;
  cancelled_by?: string;
  rejection_type: 'cancelled' | 'left_swipe';
  other_profile?: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface YourPass {
  id: string;
  created_at: string;
  profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface PendingMatchesProps {
  onSelectUser?: (userId: string) => void;
}

export const PendingMatches = ({ onSelectUser }: PendingMatchesProps) => {
  const { profile } = useWalletAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'received' | 'sent' | 'rejected' | 'yourpasses'>('received');
  const [receivedLikes, setReceivedLikes] = useState<PendingLike[]>([]);
  const [sentLikes, setSentLikes] = useState<PendingLike[]>([]);
  const [rejectedMatches, setRejectedMatches] = useState<RejectedMatch[]>([]);
  const [yourPasses, setYourPasses] = useState<YourPass[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingPass, setDeletingPass] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id) {
      fetchPendingMatches();
      fetchRejectedMatches();
      fetchYourPasses();
    }
  }, [profile?.id]);

  const fetchPendingMatches = async () => {
    if (!profile?.id) return;

    setLoading(true);
    try {
      // Get all matches to filter out matched users
      const { data: matches } = await supabase
        .from('matches')
        .select('user1_id, user2_id')
        .or(`user1_id.eq.${profile.id},user2_id.eq.${profile.id}`);

      const matchedUserIds = new Set<string>();
      matches?.forEach(m => {
        if (m.user1_id === profile.id) matchedUserIds.add(m.user2_id);
        else matchedUserIds.add(m.user1_id);
      });

      // Fetch received likes (people who liked me but I haven't swiped on them yet)
      const { data: receivedData } = await supabase
        .from('swipes')
        .select(`
          id,
          created_at,
          swiper_id,
          profiles!swipes_swiper_id_fkey (
            id,
            username,
            display_name,
            avatar_url,
            arena_verified
          )
        `)
        .eq('swiped_id', profile.id)
        .eq('direction', 'right')
        .order('created_at', { ascending: false })
        .limit(50);

      // Filter out already matched users
      const filteredReceived = (receivedData || [])
        .filter((s: any) => !matchedUserIds.has(s.swiper_id))
        .map((s: any) => ({
          id: s.id,
          created_at: s.created_at,
          profile: s.profiles,
        }));

      setReceivedLikes(filteredReceived);

      // Fetch sent likes (people I liked but they haven't swiped on me yet)
      const { data: sentData } = await supabase
        .from('swipes')
        .select(`
          id,
          created_at,
          swiped_id,
          profiles!swipes_swiped_id_fkey (
            id,
            username,
            display_name,
            avatar_url,
            arena_verified
          )
        `)
        .eq('swiper_id', profile.id)
        .eq('direction', 'right')
        .order('created_at', { ascending: false })
        .limit(50);

      // Filter out already matched users
      const filteredSent = (sentData || [])
        .filter((s: any) => !matchedUserIds.has(s.swiped_id))
        .map((s: any) => ({
          id: s.id,
          created_at: s.created_at,
          profile: s.profiles,
        }));

      setSentLikes(filteredSent);
    } catch (error) {
      console.error('Error fetching pending matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRejectedMatches = async () => {
    if (!profile?.id) return;

    try {
      const allRejected: RejectedMatch[] = [];

      // 1. Fetch cancelled matches from notifications
      const { data: notifications } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .eq('type', 'match_cancelled')
        .order('created_at', { ascending: false })
        .limit(20);

      if (notifications && notifications.length > 0) {
        const cancelledUserIds = notifications.map((n: any) => {
          const data = n.data as any;
          return data?.other_user_id;
        }).filter(Boolean);

        const { data: cancelledProfiles } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', cancelledUserIds);

        const cancelledProfilesMap = new Map(cancelledProfiles?.map(p => [p.id, p]) || []);

        notifications.forEach((n: any) => {
          const data = n.data as any;
          allRejected.push({
            id: n.id,
            created_at: n.created_at,
            other_user_id: data?.other_user_id,
            cancelled_by: data?.cancelled_by,
            rejection_type: 'cancelled',
            other_profile: cancelledProfilesMap.get(data?.other_user_id),
          });
        });
      }

      // 2. Fetch left swipes (people who swiped left on the current user)
      const { data: leftSwipes } = await supabase
        .from('swipes')
        .select(`
          id,
          created_at,
          swiper_id,
          profiles!swipes_swiper_id_fkey (
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('swiped_id', profile.id)
        .eq('direction', 'left')
        .order('created_at', { ascending: false })
        .limit(30);

      if (leftSwipes && leftSwipes.length > 0) {
        leftSwipes.forEach((swipe: any) => {
          allRejected.push({
            id: swipe.id,
            created_at: swipe.created_at,
            other_user_id: swipe.swiper_id,
            rejection_type: 'left_swipe',
            other_profile: swipe.profiles,
          });
        });
      }

      // Sort by created_at descending
      allRejected.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setRejectedMatches(allRejected);
    } catch (error) {
      console.error('Error fetching rejected matches:', error);
    }
  };

  const fetchYourPasses = async () => {
    if (!profile?.id) return;

    try {
      // Fetch left swipes made by the current user
      const { data: leftSwipes } = await supabase
        .from('swipes')
        .select(`
          id,
          created_at,
          swiped_id,
          profiles!swipes_swiped_id_fkey (
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('swiper_id', profile.id)
        .eq('direction', 'left')
        .order('created_at', { ascending: false })
        .limit(50);

      const passes = (leftSwipes || []).map((swipe: any) => ({
        id: swipe.id,
        created_at: swipe.created_at,
        profile: swipe.profiles,
      }));

      setYourPasses(passes);
    } catch (error) {
      console.error('Error fetching your passes:', error);
    }
  };

  // Check if pass can be deleted (24 hours must pass)
  const canDeletePass = (createdAt: string): boolean => {
    const passDate = new Date(createdAt);
    const now = new Date();
    const hoursSincePass = (now.getTime() - passDate.getTime()) / (1000 * 60 * 60);
    return hoursSincePass >= 24;
  };

  // Get remaining time until delete is allowed
  const getRemainingTime = (createdAt: string): string => {
    const passDate = new Date(createdAt);
    const unlockTime = new Date(passDate.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();
    const remainingMs = unlockTime.getTime() - now.getTime();
    
    if (remainingMs <= 0) return '';
    
    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const handleDeletePass = async (e: React.MouseEvent, swipeId: string, createdAt: string) => {
    e.stopPropagation();
    if (!profile) return;

    // Client-side check for 24 hour restriction
    if (!canDeletePass(createdAt)) {
      const remaining = getRemainingTime(createdAt);
      toast.error(`Cannot delete yet - ${remaining} remaining`, {
        description: 'You can delete passes after 24 hours'
      });
      return;
    }

    setDeletingPass(swipeId);
    try {
      // Call edge function to delete swipe and refund score
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refund-pass-score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          swipeId,
          userId: profile.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete pass');
      }

      setYourPasses((prev) => prev.filter((p) => p.id !== swipeId));
      
      if (result.refunded) {
        toast.success(`+${result.refundedAmount} score refunded!`);
      } else {
        toast.success('Pass removed!');
      }
    } catch (error: any) {
      toast.error('Failed to remove pass');
      console.error(error);
    } finally {
      setDeletingPass(null);
    }
  };

  // Poll every 30s instead of realtime
  useEffect(() => {
    if (!profile?.id) return;
    const interval = setInterval(() => {
      fetchPendingMatches();
      fetchRejectedMatches();
    }, 30000);
    return () => clearInterval(interval);
  }, [profile?.id]);

  const handleUserClick = (userId: string) => {
    // All tabs navigate to discover with this user's card
    navigate(`/?showUser=${userId}`);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    return 'Just now';
  };

  if (loading) {
    return (
      <Card className="p-4 bg-black/80 border-zinc-800/50 backdrop-blur-xl">
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </Card>
    );
  }

  const totalPending = receivedLikes.length + sentLikes.length;
  const totalAll = totalPending + rejectedMatches.length + yourPasses.length;

  if (totalAll === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="bg-black/90 border-zinc-800/60 backdrop-blur-xl overflow-hidden shadow-2xl">
        {/* Collapsible Header */}
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-zinc-900/50 transition-colors border-b border-zinc-800/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-xl border border-primary/20">
                <Heart className="w-4 h-4 text-primary" fill="currentColor" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  Pending Matches
                  {totalPending > 0 && (
                    <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] px-1.5">
                      {totalPending}
                    </Badge>
                  )}
                </h3>
                <p className="text-[10px] text-zinc-500">Click to {isOpen ? 'collapse' : 'expand'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger onClick={(e) => e.stopPropagation()}>
                    <Info className="w-4 h-4 text-zinc-600 hover:text-primary transition-colors" />
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs bg-black border-zinc-800 text-xs">
                    <p className="text-white mb-2 font-medium">💡 How it works:</p>
                    <ul className="space-y-1 text-zinc-400">
                      <li>• <strong className="text-primary">Received:</strong> People who liked you</li>
                      <li>• <strong className="text-orange-400">Sent:</strong> People you liked</li>
                      <li>• <strong className="text-red-400">Rejected:</strong> Cancelled matches & left swipes</li>
                      <li>• <strong className="text-zinc-400">Your Passes:</strong> People you passed (can undo after 24h)</li>
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <motion.div
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-5 h-5 text-zinc-500" />
              </motion.div>
            </div>
          </div>
        </CollapsibleTrigger>

        {/* Collapsible Content */}
        <CollapsibleContent>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'received' | 'sent' | 'rejected' | 'yourpasses')}>
              <TabsList className="w-full grid grid-cols-4 bg-zinc-900/80 rounded-none h-10 border-b border-zinc-800/50">
                <TabsTrigger 
                  value="received" 
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-[10px] gap-0.5 font-medium px-1"
                >
                  <Heart className="w-3 h-3" />
                  <span className="hidden sm:inline">Received</span> ({receivedLikes.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="sent" 
                  className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400 text-[10px] gap-0.5 font-medium px-1"
                >
                  <Send className="w-3 h-3" />
                  <span className="hidden sm:inline">Sent</span> ({sentLikes.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="rejected" 
                  className="data-[state=active]:bg-red-500/10 data-[state=active]:text-red-400 text-[10px] gap-0.5 font-medium px-1"
                >
                  <XCircle className="w-3 h-3" />
                  <span className="hidden sm:inline">Rejected</span> ({rejectedMatches.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="yourpasses" 
                  className="data-[state=active]:bg-zinc-700/30 data-[state=active]:text-zinc-300 text-[10px] gap-0.5 font-medium px-1"
                >
                  <Undo2 className="w-3 h-3" />
                  <span className="hidden sm:inline">Passes</span> ({yourPasses.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="received" className="mt-0">
                {receivedLikes.length === 0 ? (
                  <div className="p-6 text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                      <Inbox className="w-6 h-6 text-zinc-600" />
                    </div>
                    <p className="text-zinc-400 text-sm">No pending likes yet</p>
                    <p className="text-zinc-600 text-xs mt-1">Keep swiping to get noticed!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800/30 max-h-[300px] overflow-y-auto">
                    <AnimatePresence>
                      {receivedLikes.slice(0, 5).map((like, index) => (
                        <motion.div
                          key={like.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ delay: index * 0.05 }}
                          onClick={() => handleUserClick(like.profile.id)}
                          className="flex items-center gap-3 p-3 hover:bg-primary/5 cursor-pointer transition-all group"
                        >
                          <div className="relative">
                            <Avatar className="w-10 h-10 border-2 border-primary/30 ring-2 ring-primary/10">
                              <AvatarImage src={getAvatarUrl(like.profile.avatar_url, like.profile.username)} />
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {like.profile.username?.[0]?.toUpperCase() || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/30">
                              <Heart className="w-2.5 h-2.5 text-white" fill="white" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {like.profile.display_name || like.profile.username}
                            </p>
                            <p className="text-xs text-zinc-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTimeAgo(like.created_at)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-[10px]">
                              +20 score
                            </Badge>
                            <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-primary transition-colors" />
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {receivedLikes.length > 5 && (
                      <div className="p-3 text-center bg-zinc-900/50">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate('/pending-matches')}
                          className="text-primary hover:text-primary/80 text-xs"
                        >
                          View all {receivedLikes.length} pending likes
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="sent" className="mt-0">
                {sentLikes.length === 0 ? (
                  <div className="p-6 text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                      <Send className="w-6 h-6 text-zinc-600" />
                    </div>
                    <p className="text-zinc-400 text-sm">No pending sent likes</p>
                    <p className="text-zinc-600 text-xs mt-1">Start swiping right to send likes!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800/30 max-h-[300px] overflow-y-auto">
                    <AnimatePresence>
                      {sentLikes.slice(0, 5).map((like, index) => (
                        <motion.div
                          key={like.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ delay: index * 0.05 }}
                          onClick={() => handleUserClick(like.profile.id)}
                          className="flex items-center gap-3 p-3 hover:bg-orange-500/5 cursor-pointer transition-all group"
                        >
                          <div className="relative">
                            <Avatar className="w-10 h-10 border-2 border-orange-500/30 ring-2 ring-orange-500/10">
                              <AvatarImage src={getAvatarUrl(like.profile.avatar_url, like.profile.username)} />
                              <AvatarFallback className="bg-orange-500/10 text-orange-400">
                                {like.profile.username?.[0]?.toUpperCase() || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center">
                              <Clock className="w-2.5 h-2.5 text-white" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {like.profile.display_name || like.profile.username}
                            </p>
                            <p className="text-xs text-zinc-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTimeAgo(like.created_at)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20 text-[10px]">
                              Pending
                            </Badge>
                            <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-orange-400 transition-colors" />
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {sentLikes.length > 5 && (
                      <div className="p-3 text-center bg-zinc-900/50">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate('/pending-matches')}
                          className="text-orange-400 hover:text-orange-300 text-xs"
                        >
                          View all {sentLikes.length} sent likes
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="rejected" className="mt-0">
                {rejectedMatches.length === 0 ? (
                  <div className="p-6 text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                      <XCircle className="w-6 h-6 text-zinc-600" />
                    </div>
                    <p className="text-zinc-400 text-sm">No rejections</p>
                    <p className="text-zinc-600 text-xs mt-1">Your match history is clean!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800/30 max-h-[300px] overflow-y-auto">
                    <AnimatePresence>
                      {rejectedMatches.slice(0, 5).map((match, index) => (
                        <motion.div
                          key={match.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ delay: index * 0.05 }}
                          onClick={() => match.other_profile && handleUserClick(match.other_profile.id)}
                          className="flex items-center gap-3 p-3 hover:bg-red-500/5 cursor-pointer transition-all group"
                        >
                          <div className="relative">
                            <Avatar className="w-10 h-10 border-2 border-red-500/30 ring-2 ring-red-500/10 grayscale-[30%]">
                              <AvatarImage src={match.other_profile ? getAvatarUrl(match.other_profile.avatar_url, match.other_profile.username) : undefined} />
                              <AvatarFallback className="bg-red-500/10 text-red-400">
                                {match.other_profile?.username?.[0]?.toUpperCase() || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                              <XCircle className="w-2.5 h-2.5 text-white" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-zinc-300 truncate">
                              {match.other_profile?.display_name || match.other_profile?.username || 'Unknown User'}
                            </p>
                            <p className="text-xs text-zinc-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTimeAgo(match.created_at)}
                              <span className="text-zinc-600 ml-1">
                                • {match.rejection_type === 'left_swipe' 
                                    ? 'Swiped left on you' 
                                    : match.cancelled_by === profile?.id 
                                      ? 'You cancelled' 
                                      : 'They cancelled'}
                              </span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={`text-[10px] ${
                              match.rejection_type === 'left_swipe' 
                                ? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' 
                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}>
                              {match.rejection_type === 'left_swipe' ? 'Rejected' : '-20 score'}
                            </Badge>
                            <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-red-400 transition-colors" />
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {rejectedMatches.length > 5 && (
                      <div className="p-3 text-center bg-zinc-900/50">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate('/pending-matches')}
                          className="text-red-400 hover:text-red-300 text-xs"
                        >
                          View all {rejectedMatches.length} rejections
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="yourpasses" className="mt-0">
                {yourPasses.length === 0 ? (
                  <div className="p-6 text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                      <Undo2 className="w-6 h-6 text-zinc-600" />
                    </div>
                    <p className="text-zinc-400 text-sm">No passes yet</p>
                    <p className="text-zinc-600 text-xs mt-1">You haven't passed on anyone</p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800/30 max-h-[300px] overflow-y-auto">
                    <AnimatePresence>
                      {yourPasses.slice(0, 5).map((pass, index) => {
                        const canUndo = canDeletePass(pass.created_at);
                        const remaining = getRemainingTime(pass.created_at);
                        
                        return (
                          <motion.div
                            key={pass.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ delay: index * 0.05 }}
                            onClick={() => handleUserClick(pass.profile.id)}
                            className="flex items-center gap-3 p-3 hover:bg-zinc-800/30 cursor-pointer transition-all group"
                          >
                            <div className="relative">
                              <Avatar className="w-10 h-10 border-2 border-zinc-600/30 ring-2 ring-zinc-600/10 grayscale-[50%]">
                                <AvatarImage src={getAvatarUrl(pass.profile.avatar_url, pass.profile.username)} />
                                <AvatarFallback className="bg-zinc-700/30 text-zinc-400">
                                  {pass.profile.username?.[0]?.toUpperCase() || '?'}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-zinc-300 truncate">
                                {pass.profile.display_name || pass.profile.username}
                              </p>
                              <p className="text-xs text-zinc-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTimeAgo(pass.created_at)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {canUndo ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => handleDeletePass(e, pass.id, pass.created_at)}
                                  disabled={deletingPass === pass.id}
                                  className="h-7 px-2 text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20"
                                >
                                  {deletingPass === pass.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <>
                                      <Undo2 className="w-3 h-3 mr-1" />
                                      Undo
                                    </>
                                  )}
                                </Button>
                              ) : (
                                <Badge className="bg-zinc-700/30 text-zinc-400 border-zinc-600/20 text-[10px]">
                                  {remaining}
                                </Badge>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                    {yourPasses.length > 5 && (
                      <div className="p-3 text-center bg-zinc-900/50">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate('/pending-matches')}
                          className="text-zinc-400 hover:text-zinc-300 text-xs"
                        >
                          View all {yourPasses.length} passes
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </motion.div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
