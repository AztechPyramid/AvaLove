import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { TrendingUp, Flame, Coins } from 'lucide-react';
import { FollowButton } from '@/components/FollowButton';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { TrendingPostDialog } from '@/components/TrendingPostDialog';
import avloLogo from '@/assets/avlo-logo.jpg';
import { Badge } from '@/components/ui/badge';

interface TrendingPost {
  id: string;
  content: string;
  score: number;
  cost: number;
  user_id: string;
  media_url: string | null;
  media_type: string | null;
  last_boosted_at: string | null;
  token_id?: string | null;
  payment_token?: {
    id: string;
    token_symbol: string;
    token_logo_url: string | null;
  } | null;
  user: {
    id: string;
    username: string;
    avatar_url: string | null;
    verified: boolean | null;
    wallet_address?: string | null;
  };
}
interface BoostedPool {
  id: string;
  title: string;
  stake_token_logo: string;
  boost_amount: number;
}

export const TrendingPosts = () => {
  const [posts, setPosts] = useState<TrendingPost[]>([]);
  const [boostedPools, setBoostedPools] = useState<BoostedPool[]>([]);
  const [selectedPost, setSelectedPost] = useState<TrendingPost | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { profile } = useWalletAuth();

  useEffect(() => {
    fetchTrendingPosts();
    fetchBoostedPools();

    // Refresh every 2 minutes
    const interval = setInterval(() => {
      fetchTrendingPosts();
      fetchBoostedPools();
    }, 120000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll effect for mobile - includes posts + boosted pools
  useEffect(() => {
    const scrollContainer = document.querySelector('.auto-scroll');
    const totalItems = posts.length + boostedPools.length;
    if (!scrollContainer || totalItems <= 1) return;

    let scrollIndex = 0;
    const autoScrollInterval = setInterval(() => {
      scrollIndex = (scrollIndex + 1) % totalItems;
      const cardWidth = scrollContainer.children[0]?.clientWidth || 0;
      const gap = 8; // gap-2 = 8px
      scrollContainer.scrollTo({
        left: scrollIndex * (cardWidth + gap),
        behavior: 'smooth'
      });
    }, 4000); // Change every 4 seconds

    return () => clearInterval(autoScrollInterval);
  }, [posts, boostedPools]);

  const fetchBoostedPools = async () => {
    try {
      const now = new Date().toISOString();
      
      // Get active boosts with pool info
      const { data: boosts, error } = await supabase
        .from('staking_pool_boosts')
        .select(`
          pool_id,
          amount,
          expires_at,
          staking_pools!inner(
            id,
            title,
            stake_token_logo,
            is_active
          )
        `)
        .gt('expires_at', now)
        .eq('staking_pools.is_active', true);

      if (error) throw error;

      // Aggregate boost amounts per pool
      const poolTotals = new Map<string, BoostedPool>();
      boosts?.forEach((boost: any) => {
        const pool = boost.staking_pools;
        if (!pool) return;
        
        const existing = poolTotals.get(pool.id);
        if (existing) {
          existing.boost_amount += Number(boost.amount);
        } else {
          poolTotals.set(pool.id, {
            id: pool.id,
            title: pool.title,
            stake_token_logo: pool.stake_token_logo,
            boost_amount: Number(boost.amount),
          });
        }
      });

      // Sort by boost amount and take top 3
      const sorted = Array.from(poolTotals.values())
        .sort((a, b) => b.boost_amount - a.boost_amount)
        .slice(0, 3);
      
      setBoostedPools(sorted);
    } catch (error) {
      console.error('Error fetching boosted pools:', error);
    }
  };

  const fetchTrendingPosts = async () => {
    try {
      // Calculate 7 days ago timestamp
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      // Fetch top 2 posts with highest AVLO burned (cost)
      const { data: topBurnedPosts } = await supabase
        .from('posts')
        .select(`
          id,
          content,
          score,
          cost,
          user_id,
          media_url,
          media_type,
          last_boosted_at,
          token_id,
          payment_token:dao_tokens!posts_token_id_fkey(
            id,
            token_symbol,
            token_logo_url
          ),
          user:profiles!posts_user_id_fkey(
            id,
            username,
            avatar_url,
            verified,
            wallet_address,
            special_badge
          )
        `)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('cost', { ascending: false })
        .limit(10);

      const filteredTopBurned = (topBurnedPosts || [])
        .filter((post: any) => !!post.user?.wallet_address)
        .slice(0, 2);

      // Fetch latest posts from Elite AVLO badge users (special_badge = true)
      const { data: elitePosts } = await supabase
        .from('posts')
        .select(`
          id,
          content,
          score,
          cost,
          user_id,
          media_url,
          media_type,
          last_boosted_at,
          token_id,
          payment_token:dao_tokens!posts_token_id_fkey(
            id,
            token_symbol,
            token_logo_url
          ),
          user:profiles!posts_user_id_fkey(
            id,
            username,
            avatar_url,
            verified,
            wallet_address,
            special_badge
          )
        `)
        .eq('user.special_badge', true)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(20);

      // Filter elite posts and exclude duplicates from top burned
      const topBurnedIds = new Set(filteredTopBurned.map((p: any) => p.id));
      const filteredElitePosts = (elitePosts || [])
        .filter((post: any) => !!post.user?.wallet_address && post.user?.special_badge === true && !topBurnedIds.has(post.id));

      // Shuffle and take 3 random elite posts
      const shuffledElite = filteredElitePosts.sort(() => Math.random() - 0.5).slice(0, 3);

      // Combine: 2 top burned + 3 random elite posts = 5 total
      const combinedPosts = [...filteredTopBurned, ...shuffledElite];
      
      setPosts(combinedPosts as any);

    } catch (error) {
      console.error('Error fetching trending posts:', error);
    }
  };

  const getRankEmoji = (index: number) => {
    switch (index) {
      case 0: return '🥇';
      case 1: return '🥈';
      case 2: return '🥉';
      default: return `#${index + 1}`;
    }
  };

  const handlePostClick = (post: TrendingPost) => {
    setSelectedPost(post);
    setDialogOpen(true);
  };

  const handleUserClick = (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    navigate(`/profile/${userId}`);
  };

  return (
    <>
      {/* Desktop Version */}
      <Card className="hidden xl:block bg-black border-zinc-800 p-3 sm:p-4">
        <h3 className="text-white font-bold text-base sm:text-lg mb-2 sm:mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
          Trending Posts
        </h3>
        
        <div className="space-y-1.5 sm:space-y-2">
          {posts.length === 0 ? (
            <div className="text-zinc-500 text-xs">No posts yet...</div>
          ) : (
            posts.map((post, index) => {
              const isVideo = post.user.avatar_url && /\.(mp4|webm|ogg|mov)$/i.test(post.user.avatar_url);
              return (
                <div 
                  key={post.id} 
                  onClick={() => handlePostClick(post)}
                  className="p-2 bg-zinc-800/50 rounded-lg hover:bg-zinc-800/70 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-bold text-blue-500 min-w-[28px] flex-shrink-0">
                      {getRankEmoji(index)}
                    </div>
                    
                    <button
                      onClick={(e) => handleUserClick(e, post.user.id)}
                      className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity"
                    >
                      {isVideo ? (
                        <video
                          src={post.user.avatar_url}
                          className="w-6 h-6 rounded-full object-cover border border-white/30 flex-shrink-0"
                          autoPlay
                          loop
                          muted
                          playsInline
                        />
                      ) : (
                        <Avatar className="w-6 h-6 border border-white/30 flex-shrink-0">
                          <AvatarImage src={(post.user as any)?.avatar_url || ''} />
                          <AvatarFallback className="bg-blue-500/30 text-white text-xs">
                            {((post.user as any)?.username || 'U').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-zinc-300 text-xs font-semibold truncate">
                          {(post.user as any)?.username}
                        </span>
                        {(post.user as any)?.verified && (
                          <span className="text-blue-500 text-xs flex-shrink-0">✓</span>
                        )}
                      </div>
                      
                      <p className="text-zinc-400 text-xs line-clamp-2 text-left">
                        {post.content}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    {profile?.id && post.user_id !== profile.id && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <FollowButton userId={post.user_id} currentUserId={profile.id} size="icon" variant="ghost" />
                      </div>
                    )}
                    <div className="flex items-center gap-0.5">
                      {post.payment_token?.token_logo_url ? (
                        <img src={post.payment_token.token_logo_url} alt={post.payment_token.token_symbol} className="w-3 h-3 rounded-full object-cover" />
                      ) : (
                        <img src={avloLogo} alt="AVLO" className="w-3 h-3 rounded-full object-cover" />
                      )}
                      <span className="text-xs text-zinc-400">{post.cost}</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <TrendingUp className="w-3 h-3 text-green-500" />
                      <span className="text-xs text-green-500 font-semibold">{post.score}</span>
                    </div>
                  </div>
                </div>
              </div>
              );
            })
          )}
        </div>

        {/* Boosted Pools Section */}
        {boostedPools.length > 0 && (
          <div className="mt-4 pt-4 border-t border-zinc-800">
            <h4 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
              <Flame className="w-4 h-4 text-purple-400" />
              Boosted Pools
            </h4>
            <div className="space-y-1.5">
              {boostedPools.map((pool) => (
                <div 
                  key={pool.id}
                  onClick={() => navigate(`/staking?pool=${pool.id}`)}
                  className="flex items-center justify-between p-2 bg-gradient-to-r from-purple-900/30 to-pink-900/20 border border-purple-500/30 rounded-lg hover:from-purple-900/50 hover:to-pink-900/30 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <img src={pool.stake_token_logo} alt="" className="w-5 h-5 rounded-full" />
                    <span className="text-sm text-white font-medium truncate max-w-[120px]">{pool.title}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-purple-500 bg-purple-500/20 text-purple-300 gap-0.5">
                    <Flame className="w-2.5 h-2.5" />
                    {pool.boost_amount.toLocaleString()}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Mobile Version - Minimal Scrolling Cards */}
      <div className="xl:hidden w-full">
        <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-2 px-4 auto-scroll">
          {posts.length === 0 && boostedPools.length === 0 ? (
            <div className="w-full flex-shrink-0 snap-center text-center py-4">
              <TrendingUp className="w-6 h-6 text-blue-500 mx-auto mb-1" />
              <p className="text-zinc-500 text-xs">No trending posts</p>
            </div>
          ) : (
            <>
              {/* Boosted Pools Cards */}
              {boostedPools.map((pool) => (
                <div 
                  key={`pool-${pool.id}`}
                  onClick={() => navigate(`/staking?pool=${pool.id}`)}
                  className="w-[70vw] flex-shrink-0 snap-center bg-gradient-to-r from-purple-900/50 to-pink-900/40 border border-purple-500/50 rounded-lg p-2.5 cursor-pointer hover:from-purple-900/70 hover:to-pink-900/50 transition-colors"
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Flame className="w-4 h-4 text-purple-400" />
                    <img src={pool.stake_token_logo} alt="" className="w-5 h-5 rounded-full" />
                    <span className="text-white text-xs font-semibold truncate flex-1">
                      {pool.title}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-purple-300">Boosted Pool</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-purple-500 bg-purple-500/20 text-purple-300 gap-0.5">
                      <Flame className="w-2.5 h-2.5" />
                      {pool.boost_amount.toLocaleString()}
                    </Badge>
                  </div>
                </div>
              ))}
              
              {/* Post Cards */}
              {posts.map((post, index) => {
                const isVideo = post.user.avatar_url && /\.(mp4|webm|ogg|mov)$/i.test(post.user.avatar_url);
                return (
                  <div 
                    key={post.id}
                    onClick={() => handlePostClick(post)}
                    className="w-[70vw] flex-shrink-0 snap-center bg-zinc-900/50 border border-zinc-700/50 rounded-lg p-2.5 cursor-pointer hover:bg-zinc-900/70 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="text-sm font-bold text-blue-500">
                        {getRankEmoji(index)}
                      </div>
                      {isVideo ? (
                        <video
                          src={post.user.avatar_url}
                          className="w-6 h-6 rounded-full object-cover border border-blue-500/50"
                          autoPlay
                          loop
                          muted
                          playsInline
                        />
                      ) : (
                        <Avatar className="w-6 h-6 border border-blue-500/50">
                          <AvatarImage src={(post.user as any)?.avatar_url || ''} />
                          <AvatarFallback className="bg-blue-500/30 text-white text-xs">
                            {((post.user as any)?.username || 'U').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <span className="text-white text-xs font-semibold truncate">
                        {(post.user as any)?.username}
                      </span>
                    </div>

                    <p className="text-zinc-300 text-xs leading-snug line-clamp-2 mb-1.5">
                      {post.content}
                    </p>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        {post.payment_token?.token_logo_url ? (
                          <img src={post.payment_token.token_logo_url} alt={post.payment_token.token_symbol} className="w-2.5 h-2.5 rounded-full object-cover" />
                        ) : (
                          <img src={avloLogo} alt="AVLO" className="w-2.5 h-2.5 rounded-full object-cover" />
                        )}
                        <span className="text-[10px] text-orange-400 font-semibold">{post.cost}</span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <TrendingUp className="w-2.5 h-2.5 text-green-500" />
                        <span className="text-[10px] text-green-500 font-bold">{post.score}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
        
        {/* Minimal Scroll Indicator */}
        {(posts.length + boostedPools.length) > 1 && (
          <div className="flex justify-center gap-0.5 mt-1.5">
            {[...boostedPools, ...posts].map((_, index) => (
              <div 
                key={index}
                className="w-0.5 h-0.5 rounded-full bg-zinc-600"
              />
            ))}
          </div>
        )}
      </div>

      <TrendingPostDialog 
        post={selectedPost}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
};
