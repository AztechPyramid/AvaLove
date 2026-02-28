import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Heart, X, Loader2, Trash2, History as HistoryIcon, Search } from 'lucide-react';

interface SwipeWithProfile {
  id: string;
  direction: 'left' | 'right';
  created_at: string;
  profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    location: string | null;
    interests: string[] | null;
  };
}

export default function History() {
  const { profile } = useWalletAuth();
  const [swipes, setSwipes] = useState<SwipeWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'likes' | 'passes'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (profile) {
      fetchSwipeHistory();
    }
  }, [profile]);

  const fetchSwipeHistory = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('swipes')
        .select(`
          id,
          direction,
          created_at,
          swiped_id,
          profiles!swipes_swiped_id_fkey (
            id,
            username,
            display_name,
            avatar_url,
            bio,
            location,
            interests
          )
        `)
        .eq('swiper_id', profile.id)
        .eq('hidden', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const swipesWithProfiles = data.map((swipe: any) => ({
        id: swipe.id,
        direction: swipe.direction,
        created_at: swipe.created_at,
        profile: swipe.profiles,
      }));

      setSwipes(swipesWithProfiles);
    } catch (error: any) {
      toast.error('Failed to load swipe history');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Check if swipe is within 24 hours (delete not allowed)
  const isWithin24Hours = (createdAt: string): boolean => {
    const swipeDate = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - swipeDate.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours < 24;
  };

  // Calculate remaining hours until delete is allowed
  const getRemainingHours = (createdAt: string): number => {
    const swipeDate = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - swipeDate.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return Math.ceil(24 - diffHours);
  };

  const handleDeleteSwipe = async (swipeId: string, createdAt: string) => {
    if (!profile) return;

    // Block deletion if within 24 hours
    if (isWithin24Hours(createdAt)) {
      const remainingHours = getRemainingHours(createdAt);
      toast.error(`Cannot delete yet. Please wait ${remainingHours} more hour${remainingHours > 1 ? 's' : ''}.`);
      return;
    }

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
        throw new Error(result.error || 'Failed to delete swipe');
      }

      setSwipes((prev) => prev.filter((s) => s.id !== swipeId));
      
      if (result.refunded) {
        toast.success(`Removed from history — +${result.refundedAmount} score refunded, profile will re-appear in Discover`);
      } else {
        toast.success('Removed from history — profile will re-appear in Discover');
      }
    } catch (error: any) {
      toast.error('Failed to remove from history');
      console.error(error);
    }
  };

  const filteredSwipes = swipes.filter(swipe => {
    // Tab filter
    if (activeTab === 'likes' && swipe.direction !== 'right') return false;
    if (activeTab === 'passes' && swipe.direction !== 'left') return false;
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const username = swipe.profile.username?.toLowerCase() || '';
      const displayName = swipe.profile.display_name?.toLowerCase() || '';
      if (!username.includes(query) && !displayName.includes(query)) {
        return false;
      }
    }
    
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="animate-spin text-orange-500" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg shadow-orange-500/20">
              <HistoryIcon className="text-white" size={32} />
            </div>
            <h1 className="text-4xl font-bold text-white">Swipe History</h1>
          </div>
          <p className="text-white/80">View and manage your likes and passes</p>
        </div>

        {/* Search Input */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-500/60" size={20} />
          <Input
            type="text"
            placeholder="Search users by name or username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-black/50 border-orange-500/30 focus:border-orange-500 text-white placeholder:text-white/40"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white h-7 px-2"
            >
              <X size={14} />
            </Button>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="mb-6">
          <TabsList className="grid w-full grid-cols-3 bg-gradient-to-r from-black to-gray-950 border border-orange-500/20">
            <TabsTrigger value="all" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">
              All ({swipes.length})
            </TabsTrigger>
            <TabsTrigger value="likes" className="gap-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white">
              <Heart size={16} fill="currentColor" />
              Likes ({swipes.filter(s => s.direction === 'right').length})
            </TabsTrigger>
            <TabsTrigger value="passes" className="gap-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white">
              <X size={16} />
              Passes ({swipes.filter(s => s.direction === 'left').length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6 space-y-4">
            {filteredSwipes.length === 0 ? (
              <Card className="p-12 text-center bg-gradient-to-br from-black to-gray-950 border-orange-500/20">
                <HistoryIcon className="mx-auto mb-4 text-orange-500" size={64} />
                <h3 className="text-xl font-semibold mb-2 text-white">No swipes yet</h3>
                <p className="text-white/60">
                  Start swiping on the Discover page!
                </p>
              </Card>
            ) : (
              filteredSwipes.map((swipe) => (
                <Card key={swipe.id} className="p-4 bg-gradient-to-r from-black to-gray-950 backdrop-blur-sm border-orange-500/20 hover:border-orange-500/40 transition-all duration-300 hover:scale-102">
                  <div className="flex items-start gap-4">
                    <Avatar className="w-16 h-16">
                      {swipe.profile.avatar_url ? (
                        <AvatarImage src={swipe.profile.avatar_url} />
                      ) : (
                        <AvatarFallback className="bg-gradient-love text-white text-xl">
                          {swipe.profile.username[0].toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg text-white">
                          {swipe.profile.display_name || swipe.profile.username}
                        </h3>
                        <Badge variant={swipe.direction === 'right' ? 'default' : 'secondary'} className={swipe.direction === 'right' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-white'}>
                          {swipe.direction === 'right' ? (
                            <Heart size={12} fill="currentColor" className="mr-1" />
                          ) : (
                            <X size={12} className="mr-1" />
                          )}
                          {swipe.direction === 'right' ? 'Liked' : 'Passed'}
                        </Badge>
                      </div>

                      {swipe.profile.bio && (
                        <p className="text-sm text-white/70 mb-2 line-clamp-2">
                          {swipe.profile.bio}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-2 text-xs text-white/60">
                        {swipe.profile.location && (
                          <span>📍 {swipe.profile.location}</span>
                        )}
                        <span>
                          {new Date(swipe.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      {swipe.profile.interests && swipe.profile.interests.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {swipe.profile.interests.slice(0, 3).map((interest, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs border-orange-500/30 text-orange-400">
                              {interest}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Delete button only for passed swipes - likes should not be deletable since they earned score */}
                    {swipe.direction === 'left' && (
                      <div className="flex flex-col gap-2">
                        {isWithin24Hours(swipe.created_at) ? (
                          <div className="text-xs text-zinc-500 text-center px-2">
                            <span className="block text-amber-500/80">⏳ Wait {getRemainingHours(swipe.created_at)}h</span>
                            <span className="text-[10px]">to delete</span>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteSwipe(swipe.id, swipe.created_at)}
                            className="gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <Trash2 size={14} />
                            Delete
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
