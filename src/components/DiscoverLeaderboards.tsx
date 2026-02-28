import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Heart, X, Trophy, Medal, Award, Loader2, ChevronDown, Sparkles, BookOpen, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAvatarUrl } from '@/lib/defaultAvatars';
import WelcomeOnboardingModal from '@/components/WelcomeOnboardingModal';
import { PlatformTutorial } from '@/components/PlatformTutorial';

interface LeaderboardUser {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url: string | null;
  value: number;
}

interface DiscoverLeaderboardsProps {
  onSelectUser: (userId: string) => void;
  refetchTrigger?: number; // Increment to force a refetch
}

const ITEMS_PER_PAGE = 5;

export const DiscoverLeaderboards = ({ onSelectUser, refetchTrigger = 0 }: DiscoverLeaderboardsProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'liked' | 'passed'>('liked');
  const [mostLiked, setMostLiked] = useState<LeaderboardUser[]>([]);
  const [mostPassed, setMostPassed] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [likedPage, setLikedPage] = useState(1);
  const [passedPage, setPassedPage] = useState(1);
  const [hasMoreLiked, setHasMoreLiked] = useState(true);
  const [hasMorePassed, setHasMorePassed] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [dataFetched, setDataFetched] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Fetch data only when opened for the first time
  useEffect(() => {
    if (isOpen && !dataFetched) {
      fetchLeaderboards();
    }
  }, [isOpen, dataFetched]);

  // Refetch when trigger changes (after a swipe)
  useEffect(() => {
    if (refetchTrigger > 0 && dataFetched) {
      // Reset pagination and refetch
      setLikedPage(1);
      setPassedPage(1);
      setHasMoreLiked(true);
      setHasMorePassed(true);
      fetchLeaderboards();
    }
  }, [refetchTrigger]);

  const fetchLeaderboards = async () => {
    try {
      setLoading(true);
      setDataFetched(true);
      
      // Fetch all swipes with direction
      const { data: swipesData } = await supabase
        .from('swipes')
        .select('swiped_id, direction');
      
      if (!swipesData) return;

      // Process most liked users (received right swipes)
      const likedCountMap: { [key: string]: number } = {};
      const passedCountMap: { [key: string]: number } = {};
      
      swipesData.forEach((swipe) => {
        if (swipe.direction === 'right') {
          likedCountMap[swipe.swiped_id] = (likedCountMap[swipe.swiped_id] || 0) + 1;
        } else if (swipe.direction === 'left') {
          passedCountMap[swipe.swiped_id] = (passedCountMap[swipe.swiped_id] || 0) + 1;
        }
      });

      // Sort by count and get all IDs
      const mostLikedIds = Object.entries(likedCountMap)
        .sort(([, a], [, b]) => b - a)
        .map(([id, count]) => ({ id, count }));
      
      const mostPassedIds = Object.entries(passedCountMap)
        .sort(([, a], [, b]) => b - a)
        .map(([id, count]) => ({ id, count }));

      // Fetch initial profiles
      const initialLikedIds = mostLikedIds.slice(0, ITEMS_PER_PAGE);
      const initialPassedIds = mostPassedIds.slice(0, ITEMS_PER_PAGE);
      
      const allUserIds = [...new Set([
        ...initialLikedIds.map(u => u.id),
        ...initialPassedIds.map(u => u.id),
      ])];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', allUserIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]));

      const mapToLeaderboard = (ids: { id: string; count: number }[]): LeaderboardUser[] =>
        ids
          .filter(u => profileMap.has(u.id))
          .map(u => ({ 
            ...profileMap.get(u.id)!, 
            value: u.count 
          }));

      setMostLiked(mapToLeaderboard(initialLikedIds));
      setMostPassed(mapToLeaderboard(initialPassedIds));
      setHasMoreLiked(mostLikedIds.length > ITEMS_PER_PAGE);
      setHasMorePassed(mostPassedIds.length > ITEMS_PER_PAGE);
      
      // Store full lists for pagination
      (window as any).__likedIds = mostLikedIds;
      (window as any).__passedIds = mostPassedIds;
    } catch (error) {
      console.error('Error fetching leaderboards:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async (type: 'liked' | 'passed') => {
    setLoadingMore(true);
    try {
      const ids = type === 'liked' ? (window as any).__likedIds : (window as any).__passedIds;
      const currentPage = type === 'liked' ? likedPage : passedPage;
      const nextPage = currentPage + 1;
      const startIdx = currentPage * ITEMS_PER_PAGE;
      const endIdx = nextPage * ITEMS_PER_PAGE;
      
      const nextIds = ids.slice(startIdx, endIdx);
      
      if (nextIds.length === 0) {
        if (type === 'liked') setHasMoreLiked(false);
        else setHasMorePassed(false);
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', nextIds.map((u: any) => u.id));
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]));
      
      const newUsers = nextIds
        .filter((u: any) => profileMap.has(u.id))
        .map((u: any) => ({
          ...profileMap.get(u.id)!,
          value: u.count
        }));

      if (type === 'liked') {
        setMostLiked(prev => [...prev, ...newUsers]);
        setLikedPage(nextPage);
        setHasMoreLiked(endIdx < ids.length);
      } else {
        setMostPassed(prev => [...prev, ...newUsers]);
        setPassedPage(nextPage);
        setHasMorePassed(endIdx < ids.length);
      }
    } catch (error) {
      console.error('Error loading more:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="w-4 h-4 text-yellow-400" />;
    if (index === 1) return <Medal className="w-4 h-4 text-gray-300" />;
    if (index === 2) return <Award className="w-4 h-4 text-orange-500" />;
    return <span className="text-[10px] font-bold text-zinc-500">#{index + 1}</span>;
  };

  const currentData = activeTab === 'liked' ? mostLiked : mostPassed;
  const hasMore = activeTab === 'liked' ? hasMoreLiked : hasMorePassed;

  return (
    <div className="w-full space-y-1.5">
      {/* Welcome Onboarding Modal */}
      <WelcomeOnboardingModal 
        externalOpen={showWelcomeModal} 
        onExternalOpenChange={setShowWelcomeModal} 
      />

      {/* Toggle Buttons - 50/50 */}
      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={() => {
            if (isOpen && activeTab === 'liked') {
              setIsOpen(false);
            } else {
              setActiveTab('liked');
              setIsOpen(true);
            }
          }}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg font-medium text-xs transition-all ${
            isOpen && activeTab === 'liked'
              ? 'bg-green-500/15 border border-green-500/30 text-green-400'
              : 'bg-zinc-900/50 border border-zinc-800 text-zinc-500 hover:border-green-500/20 hover:text-green-400'
          }`}
        >
          <Heart className="w-3 h-3" fill={isOpen && activeTab === 'liked' ? 'currentColor' : 'none'} />
          <span>Most Liked</span>
        </button>
        
        <button
          onClick={() => {
            if (isOpen && activeTab === 'passed') {
              setIsOpen(false);
            } else {
              setActiveTab('passed');
              setIsOpen(true);
            }
          }}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg font-medium text-xs transition-all ${
            isOpen && activeTab === 'passed'
              ? 'bg-red-500/15 border border-red-500/30 text-red-400'
              : 'bg-zinc-900/50 border border-zinc-800 text-zinc-500 hover:border-red-500/20 hover:text-red-400'
          }`}
        >
          <X className="w-3 h-3" />
          <span>Most Passed</span>
        </button>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {loading ? (
              <Card className="bg-zinc-900/50 border-zinc-800 p-3">
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
                </div>
              </Card>
            ) : (
              <Card className="bg-zinc-900/50 border-zinc-800 p-3">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2"
                  >
                    {currentData.length === 0 ? (
                      <div className="text-center py-6 text-zinc-500 text-sm">
                        No data yet
                      </div>
                    ) : (
                      <>
                        {currentData.map((user, index) => (
                          <motion.button
                            key={user.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            onClick={() => onSelectUser(user.id)}
                            className="w-full flex items-center gap-3 p-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 transition-all group"
                          >
                            <div className="w-6 flex items-center justify-center">
                              {getRankIcon(index)}
                            </div>
                            <Avatar className="w-8 h-8 border border-zinc-700 group-hover:border-orange-500/50 transition-colors">
                              <AvatarImage src={getAvatarUrl(user.avatar_url, user.id)} />
                              <AvatarFallback className="bg-zinc-800 text-xs">
                                {(user.display_name || user.username)?.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0 text-left">
                              <p className="text-sm font-medium text-white truncate">
                                {user.display_name || user.username}
                              </p>
                              <p className="text-xs text-zinc-500 truncate">@{user.username}</p>
                            </div>
                            <div className={`flex items-center gap-1 text-sm font-medium ${
                              activeTab === 'liked' ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {activeTab === 'liked' ? (
                                <Heart className="w-3 h-3" fill="currentColor" />
                              ) : (
                                <X className="w-3 h-3" />
                              )}
                              <span>{user.value.toLocaleString()}</span>
                            </div>
                          </motion.button>
                        ))}

                        {/* Load More Button */}
                        {hasMore && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => loadMore(activeTab)}
                            disabled={loadingMore}
                            className="w-full mt-2 text-zinc-400 hover:text-white hover:bg-zinc-800"
                          >
                            {loadingMore ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                              <ChevronDown className="w-4 h-4 mr-2" />
                            )}
                            Load More
                          </Button>
                        )}
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* How to Earn & Platform Tutorial Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowWelcomeModal(true)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 hover:border-primary/40 text-primary hover:text-primary/80 transition-all text-xs font-medium group"
        >
          <Sparkles className="w-3 h-3 group-hover:animate-pulse" />
          <span>How to Earn</span>
        </button>
        
        <PlatformTutorial>
          <button
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 hover:border-amber-500/40 text-amber-400 hover:text-amber-300 transition-all text-xs font-medium group"
          >
            <BookOpen className="w-3 h-3 group-hover:animate-pulse" />
            <span>Tutorial</span>
          </button>
        </PlatformTutorial>
      </div>
    </div>
  );
};
