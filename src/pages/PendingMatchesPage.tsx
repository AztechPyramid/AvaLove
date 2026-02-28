import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Heart, Clock, ChevronRight, Inbox, Send, XCircle, RefreshCw, ArrowLeft, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { getAvatarUrl } from '@/lib/defaultAvatars';

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

const PendingMatchesPage = () => {
  const { profile } = useWalletAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'received' | 'sent' | 'rejected' | 'yourpasses'>('received');
  const [receivedLikes, setReceivedLikes] = useState<PendingLike[]>([]);
  const [sentLikes, setSentLikes] = useState<PendingLike[]>([]);
  const [rejectedMatches, setRejectedMatches] = useState<RejectedMatch[]>([]);
  const [yourPasses, setYourPasses] = useState<YourPass[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination state
  const [receivedVisible, setReceivedVisible] = useState(10);
  const [sentVisible, setSentVisible] = useState(10);
  const [rejectedVisible, setRejectedVisible] = useState(10);
  const [yourPassesVisible, setYourPassesVisible] = useState(10);
  const [loadingMore, setLoadingMore] = useState(false);
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

      // Fetch received likes
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
        .limit(100);

      const filteredReceived = (receivedData || [])
        .filter((s: any) => !matchedUserIds.has(s.swiper_id))
        .map((s: any) => ({
          id: s.id,
          created_at: s.created_at,
          profile: s.profiles,
        }));

      setReceivedLikes(filteredReceived);

      // Fetch sent likes
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
        .limit(100);

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
        .limit(50);

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
        .limit(50);

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
        .limit(100);

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

  const handleDeletePass = async (swipeId: string, createdAt: string) => {
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
        toast.success(`+${result.refundedAmount} score refunded! Profile will re-appear in Discover`);
      } else {
        toast.success('Pass removed! Profile will re-appear in Discover');
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

  const totalPending = receivedLikes.length + sentLikes.length;

  const renderLikeItem = (like: PendingLike, type: 'received' | 'sent', index: number) => (
    <motion.div
      key={like.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      onClick={() => handleUserClick(like.profile.id)}
      className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all group ${
        type === 'received' 
          ? 'bg-zinc-900/50 hover:bg-primary/10 border border-zinc-800/50 hover:border-primary/30' 
          : 'bg-zinc-900/50 hover:bg-orange-500/10 border border-zinc-800/50 hover:border-orange-500/30'
      }`}
    >
      <div className="relative">
        <Avatar className={`w-14 h-14 border-2 ${type === 'received' ? 'border-primary/40' : 'border-orange-500/40'}`}>
          <AvatarImage src={getAvatarUrl(like.profile.avatar_url, like.profile.username)} />
          <AvatarFallback className={`${type === 'received' ? 'bg-primary/20 text-primary' : 'bg-orange-500/20 text-orange-400'}`}>
            {like.profile.username?.[0]?.toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>
        <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ${
          type === 'received' ? 'bg-primary shadow-primary/30' : 'bg-orange-500 shadow-orange-500/30'
        } shadow-lg`}>
          {type === 'received' ? (
            <Heart className="w-3 h-3 text-white" fill="white" />
          ) : (
            <Send className="w-3 h-3 text-white" />
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-base font-semibold text-white truncate">
          {like.profile.display_name || like.profile.username}
        </p>
        <p className="text-sm text-zinc-500 truncate">@{like.profile.username}</p>
        <p className="text-xs text-zinc-600 flex items-center gap-1 mt-1">
          <Clock className="w-3 h-3" />
          {formatTimeAgo(like.created_at)}
        </p>
      </div>
      <div className="flex flex-col items-end gap-2">
        {type === 'received' && (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
            +20 score
          </Badge>
        )}
        <ChevronRight className={`w-5 h-5 text-zinc-600 group-hover:${type === 'received' ? 'text-primary' : 'text-orange-400'} transition-colors`} />
      </div>
    </motion.div>
  );

  const renderRejectedItem = (match: RejectedMatch, index: number) => (
    <motion.div
      key={match.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      onClick={() => match.other_profile && handleUserClick(match.other_profile.id)}
      className="flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all group bg-zinc-900/50 hover:bg-red-500/10 border border-zinc-800/50 hover:border-red-500/30"
    >
      <div className="relative">
        <Avatar className="w-14 h-14 border-2 border-red-500/40 opacity-70">
          <AvatarImage src={getAvatarUrl(match.other_profile?.avatar_url, match.other_profile?.username)} />
          <AvatarFallback className="bg-red-500/20 text-red-400">
            {match.other_profile?.username?.[0]?.toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/30">
          <XCircle className="w-3 h-3 text-white" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-base font-semibold text-white/80 truncate">
          {match.other_profile?.display_name || match.other_profile?.username || 'Unknown'}
        </p>
        <p className="text-sm text-zinc-500 truncate">
          {match.rejection_type === 'left_swipe' 
            ? 'Swiped left on you' 
            : match.cancelled_by === profile?.id 
              ? 'You cancelled' 
              : 'They cancelled'}
        </p>
        <p className="text-xs text-zinc-600 flex items-center gap-1 mt-1">
          <Clock className="w-3 h-3" />
          {formatTimeAgo(match.created_at)}
        </p>
      </div>
      <div className="flex flex-col items-end gap-2">
        <Badge className={`text-xs ${
          match.rejection_type === 'left_swipe' 
            ? 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' 
            : 'bg-red-500/20 text-red-400 border-red-500/30'
        }`}>
          {match.rejection_type === 'left_swipe' ? 'Rejected' : '-20 score'}
        </Badge>
        <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-red-400 transition-colors" />
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-xl border border-primary/20">
                <Heart className="w-6 h-6 text-primary" fill="currentColor" />
              </div>
              Pending Matches
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              {totalPending} pending • {rejectedMatches.length} rejected • {yourPasses.length} passes
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchPendingMatches();
              fetchRejectedMatches();
              fetchYourPasses();
            }}
            className="border-zinc-700 text-zinc-400 hover:bg-zinc-800"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {loading ? (
          <Card className="p-12 bg-zinc-900/50 border-zinc-800">
            <div className="flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          </Card>
        ) : (
          <Card className="bg-zinc-900/50 border-zinc-800 overflow-hidden">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'received' | 'sent' | 'rejected' | 'yourpasses')}>
              <TabsList className="w-full grid grid-cols-4 bg-black/50 rounded-none h-14 border-b border-zinc-800">
                <TabsTrigger 
                  value="received" 
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs gap-1 font-medium h-full rounded-none"
                >
                  <Heart className="w-3 h-3" />
                  Liked You
                  {receivedLikes.length > 0 && (
                    <Badge className="bg-primary/20 text-primary border-0 text-[10px] ml-1">
                      {receivedLikes.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="sent" 
                  className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400 text-xs gap-1 font-medium h-full rounded-none"
                >
                  <Send className="w-3 h-3" />
                  You Liked
                  {sentLikes.length > 0 && (
                    <Badge className="bg-orange-500/20 text-orange-400 border-0 text-[10px] ml-1">
                      {sentLikes.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="rejected" 
                  className="data-[state=active]:bg-red-500/10 data-[state=active]:text-red-400 text-xs gap-1 font-medium h-full rounded-none"
                >
                  <XCircle className="w-3 h-3" />
                  Rejected
                  {rejectedMatches.length > 0 && (
                    <Badge className="bg-red-500/20 text-red-400 border-0 text-[10px] ml-1">
                      {rejectedMatches.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="yourpasses" 
                  className="data-[state=active]:bg-yellow-500/10 data-[state=active]:text-yellow-400 text-xs gap-1 font-medium h-full rounded-none"
                >
                  <Undo2 className="w-3 h-3" />
                  Passed
                  {yourPasses.length > 0 && (
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-0 text-[10px] ml-1">
                      {yourPasses.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="received" className="mt-0 p-4 space-y-3 max-h-[60vh] overflow-y-auto">
                {receivedLikes.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                      <Heart className="w-8 h-8 text-zinc-600" />
                    </div>
                    <p className="text-zinc-400 text-base font-medium">No one swiped right on you yet</p>
                    <p className="text-zinc-600 text-sm mt-1">Keep swiping to get noticed!</p>
                  </div>
                ) : (
                  <>
                    <AnimatePresence>
                      {receivedLikes.slice(0, receivedVisible).map((like, index) => renderLikeItem(like, 'received', index))}
                    </AnimatePresence>
                    {receivedVisible < receivedLikes.length && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setLoadingMore(true);
                          setTimeout(() => {
                            setReceivedVisible(prev => prev + 10);
                            setLoadingMore(false);
                          }, 300);
                        }}
                        disabled={loadingMore}
                        className="w-full text-primary hover:bg-primary/10 gap-2"
                      >
                        {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Load more ({receivedLikes.length - receivedVisible} remaining)
                      </Button>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="sent" className="mt-0 p-4 space-y-3 max-h-[60vh] overflow-y-auto">
                {sentLikes.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                      <Send className="w-8 h-8 text-zinc-600" />
                    </div>
                    <p className="text-zinc-400 text-base font-medium">No pending sent likes</p>
                    <p className="text-zinc-600 text-sm mt-1">Start swiping right to send likes!</p>
                  </div>
                ) : (
                  <>
                    <AnimatePresence>
                      {sentLikes.slice(0, sentVisible).map((like, index) => renderLikeItem(like, 'sent', index))}
                    </AnimatePresence>
                    {sentVisible < sentLikes.length && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setLoadingMore(true);
                          setTimeout(() => {
                            setSentVisible(prev => prev + 10);
                            setLoadingMore(false);
                          }, 300);
                        }}
                        disabled={loadingMore}
                        className="w-full text-orange-400 hover:bg-orange-500/10 gap-2"
                      >
                        {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Load more ({sentLikes.length - sentVisible} remaining)
                      </Button>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="rejected" className="mt-0 p-4 space-y-3 max-h-[60vh] overflow-y-auto">
                {rejectedMatches.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                      <XCircle className="w-8 h-8 text-zinc-600" />
                    </div>
                    <p className="text-zinc-400 text-base font-medium">No cancelled matches</p>
                    <p className="text-zinc-600 text-sm mt-1">Cancelled matches will appear here</p>
                  </div>
                ) : (
                  <>
                    <AnimatePresence>
                      {rejectedMatches.slice(0, rejectedVisible).map((match, index) => renderRejectedItem(match, index))}
                    </AnimatePresence>
                    {rejectedVisible < rejectedMatches.length && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setLoadingMore(true);
                          setTimeout(() => {
                            setRejectedVisible(prev => prev + 10);
                            setLoadingMore(false);
                          }, 300);
                        }}
                        disabled={loadingMore}
                        className="w-full text-red-400 hover:bg-red-500/10 gap-2"
                      >
                        {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Load more ({rejectedMatches.length - rejectedVisible} remaining)
                      </Button>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="yourpasses" className="mt-0 p-4 space-y-3 max-h-[60vh] overflow-y-auto">
                {yourPasses.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                      <Undo2 className="w-8 h-8 text-zinc-600" />
                    </div>
                    <p className="text-zinc-400 text-base font-medium">No passes yet</p>
                    <p className="text-zinc-600 text-sm mt-1">Profiles you passed will appear here</p>
                  </div>
                ) : (
                  <>
                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-4">
                      <p className="text-yellow-400 text-sm text-center">
                        ⏳ You can delete passes after 24 hours to get +10 score refunded & see them in Discover again
                      </p>
                    </div>
                    <AnimatePresence>
                      {yourPasses.slice(0, yourPassesVisible).map((pass, index) => (
                        <motion.div
                          key={pass.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className="flex items-center gap-4 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-yellow-500/30 transition-all"
                        >
                          <Avatar className="w-14 h-14 border-2 border-yellow-500/40">
                            <AvatarImage src={getAvatarUrl(pass.profile?.avatar_url, pass.profile?.username)} />
                            <AvatarFallback className="bg-yellow-500/20 text-yellow-400">
                              {pass.profile?.username?.[0]?.toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-semibold text-white truncate">
                              {pass.profile?.display_name || pass.profile?.username}
                            </p>
                            <p className="text-sm text-zinc-500 truncate">@{pass.profile?.username}</p>
                            <p className="text-xs text-zinc-600 flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" />
                              {formatTimeAgo(pass.created_at)}
                            </p>
                          </div>
                          {canDeletePass(pass.created_at) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeletePass(pass.id, pass.created_at)}
                              disabled={deletingPass === pass.id}
                              className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 gap-2"
                            >
                              {deletingPass === pass.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                              Delete
                            </Button>
                          ) : (
                            <div className="flex flex-col items-end gap-1">
                              <Badge className="bg-zinc-700/50 text-zinc-400 border-zinc-600 text-xs">
                                <Clock className="w-3 h-3 mr-1" />
                                {getRemainingTime(pass.created_at)}
                              </Badge>
                              <span className="text-[10px] text-zinc-500">until delete</span>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {yourPassesVisible < yourPasses.length && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setLoadingMore(true);
                          setTimeout(() => {
                            setYourPassesVisible(prev => prev + 10);
                            setLoadingMore(false);
                          }, 300);
                        }}
                        disabled={loadingMore}
                        className="w-full text-yellow-400 hover:bg-yellow-500/10 gap-2"
                      >
                        {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Load more ({yourPasses.length - yourPassesVisible} remaining)
                      </Button>
                    )}
                  </>
                )}
              </TabsContent>
            </Tabs>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PendingMatchesPage;
