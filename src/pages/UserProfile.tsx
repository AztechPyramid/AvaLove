import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getAvatarUrl } from '@/lib/defaultAvatars';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowLeft, MapPin, Calendar, Award, Instagram, Twitter, Linkedin, Heart, Sparkles, MessageCircle, Flame, Users, UserPlus, UserMinus, ChevronLeft, ChevronRight, Repeat, Gift, Loader2, Clock, Coins, Activity, Gamepad2, Music, Eye } from 'lucide-react';
import { TipDialog } from '@/components/TipDialog';
import { useBadges } from '@/hooks/useBadges';
import { useFollowers } from '@/hooks/useFollowers';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { useWeb3Auth } from '@/hooks/useWeb3Auth';
import { FollowButton } from '@/components/FollowButton';
import * as LucideIcons from 'lucide-react';
import arenaLogo from '@/assets/arena-logo.png';
import avloLogo from '@/assets/avlo-logo.jpg';
import { Contract, JsonRpcProvider, formatUnits, BrowserProvider } from 'ethers';
import { useTokenBalances } from '@/hooks/useTokenBalances';
import { useUnifiedCost } from '@/hooks/useUnifiedCost';
import { toast } from 'sonner';
import { PostComments } from '@/components/PostComments';
import { FollowersDialog } from '@/components/FollowersDialog';
import { ScoreTransferHistory } from '@/components/ScoreTransferHistory';


interface UserProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  date_of_birth: string | null;
  gender: string | null;
  interests: string[] | null;
  photo_urls: string[] | null;
  verified: boolean | null;
  instagram_username: string | null;
  linkedin_username: string | null;
  arena_username: string | null;
  special_badge: boolean | null;
  arena_verified: boolean | null;
  wallet_address?: string | null;
}

interface Post {
  id: string;
  content: string;
  cost: number;
  created_at: string;
  media_url: string | null;
  media_type: string | null;
  likes_count: number;
  comments_count: number;
  is_repost?: boolean;
  referenced_post_id?: string | null;
}

interface UserStats {
  totalPosts: number;
  totalBurned: number;
  recentPosts: Post[];
  qualifiedReferrals: number;
  airdropScore: number;
  airdropRank: number;
  avloBalance: number;
  totalSwipes: number;
  matchesCount: number;
  pixelsPlaced: number;
  totalTipsReceived: number;
  remainingMinutes: number;
  pendingRewards: number;
  paidRewards: number;
  lastActivity: { type: string; title: string; reward: number; timestamp: string } | null;
}

const UserProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile: currentUserProfile } = useWalletAuth();
  const { walletAddress, isConnected, arenaSDK, isArena } = useWeb3Auth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const { userBadges } = useBadges(resolvedUserId);
  const { followersCount, followingCount, isFollowing, toggleFollow } = useFollowers(resolvedUserId, currentUserProfile?.id);
  const balances = useTokenBalances(profile?.wallet_address || undefined);
  const { repostCost } = useUnifiedCost();
  const [postsPage, setPostsPage] = useState(1);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [showCommentsForPost, setShowCommentsForPost] = useState<string | null>(null);
  const [repostingIds, setRepostingIds] = useState<Set<string>>(new Set());
  const postRefs = useRef<Record<string, HTMLElement | null>>({});
  const highlightedPostId = searchParams.get('post');
  const shouldOpenComments = searchParams.get('comments') === 'true';
  const POSTS_PER_PAGE = 10;
  
  const [followersDialogOpen, setFollowersDialogOpen] = useState(false);
  const [followersDialogTab, setFollowersDialogTab] = useState<'followers' | 'following'>('followers');


  // Resolve userId - could be UUID or username
  useEffect(() => {
    const resolveUserId = async () => {
      if (!userId) return;

      // Check if userId is a UUID (contains hyphens)
      const isUUID = userId.includes('-');
      
      if (isUUID) {
        setResolvedUserId(userId);
      } else {
        // It's a username, resolve to ID
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', userId)
            .single();

          if (error) throw error;
          setResolvedUserId(data.id);
        } catch (error) {
          console.error('Error resolving username to ID:', error);
          setResolvedUserId(null);
          setLoading(false);
        }
      }
    };

    resolveUserId();
  }, [userId]);

  const fetchUserStats = async () => {
    if (!resolvedUserId) return;

    try {
      // Get cached AVLO token ID first
      const { getAvloTokenId } = await import('@/lib/avloTokenCache');
      const avloTokenId = await getAvloTokenId();
      const avloToken = avloTokenId ? { id: avloTokenId } : null;

      // Batch 1: All independent queries in parallel (skip empty tables: referrals, matches)
      const [
        { data: profileData },
        { count: postsCount },
        { data: burnsData },
        { data: swipesData },
        { count: pixelsPlacedCount },
        { data: tipsData },
        { data: recentPosts },
      ] = await Promise.all([
        supabase.from('profiles').select('wallet_address').eq('id', resolvedUserId).single(),
        supabase.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', resolvedUserId),
        supabase.from('token_burns').select('amount').eq('user_id', resolvedUserId),
        supabase.from('swipes').select('direction').eq('swiper_id', resolvedUserId),
        supabase.from('pixels').select('*', { count: 'exact', head: true }).eq('placed_by', resolvedUserId),
        supabase.from('tips').select('amount').eq('receiver_id', resolvedUserId),
        supabase.from('posts').select('*').eq('user_id', resolvedUserId).order('created_at', { ascending: false }),
      ]);
      const qualifiedReferralsCount = 0; // referrals table is empty
      const matchesCount = 0; // matches table is empty

      const totalBurned = burnsData?.reduce((sum, burn) => sum + Number(burn.amount), 0) || 0;
      const totalSwipes = swipesData?.length || 0;
      const totalTipsReceived = tipsData?.reduce((sum, tip) => sum + (tip.amount || 0), 0) || 0;

      // Batch 2: Queries that depend on avloToken.id + AVLO balance + rewards + last activities
      const [
        { data: userScoreData },
        { data: allScores },
        { data: gameRewards },
        { data: musicRewards },
        { data: watchRewards },
        { data: lastGame },
        { data: lastMusic },
        { data: lastWatch },
        avloBalance,
      ] = await Promise.all([
        supabase.from('user_scores').select('total_score').eq('user_id', resolvedUserId).eq('token_id', avloToken?.id || '').maybeSingle(),
        supabase.from('user_scores').select('user_id, total_score').eq('token_id', avloToken?.id || '').order('total_score', { ascending: false }),
        supabase.from('embedded_game_sessions').select('reward_earned, paid').eq('user_id', resolvedUserId),
        supabase.from('music_track_listens').select('reward_earned, paid').eq('user_id', resolvedUserId),
        supabase.from('watch_video_views').select('reward_earned, paid').eq('user_id', resolvedUserId),
        supabase.from('embedded_game_sessions').select('game_title, reward_earned, started_at').eq('user_id', resolvedUserId).order('started_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('music_track_listens').select('track:music_tracks(title), reward_earned, started_at').eq('user_id', resolvedUserId).order('started_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('watch_video_views').select('video:watch_videos(title), reward_earned, started_at').eq('user_id', resolvedUserId).order('started_at', { ascending: false }).limit(1).maybeSingle(),
        // Fetch AVLO balance in parallel
        (async () => {
          if (!profileData?.wallet_address) return 0;
          try {
            const AVLO_TOKEN_ADDRESS = '0x0226717468C595c7Fd508d0c3311cE0DFCe1e20C';
            const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'];
            const AVALANCHE_RPC = 'https://api.avax.network/ext/bc/C/rpc';
            const provider = new JsonRpcProvider(AVALANCHE_RPC);
            const avloContract = new Contract(AVLO_TOKEN_ADDRESS, ERC20_ABI, provider);
            const balance = await avloContract.balanceOf(profileData.wallet_address);
            return parseFloat(formatUnits(balance, 18));
          } catch {
            return 0;
          }
        })(),
      ]);

      const airdropScore = userScoreData?.total_score || 0;
      let airdropRank = 1;
      if (allScores) {
        const userRankIndex = allScores.findIndex(s => s.user_id === resolvedUserId);
        if (userRankIndex !== -1) airdropRank = userRankIndex + 1;
      }

      const scoreValue = typeof userScoreData?.total_score === 'number' ? userScoreData.total_score : 1;
      const dailyTimeMinutes = Math.max(1, Math.floor(scoreValue));

      const allRewards = [...(gameRewards || []), ...(musicRewards || []), ...(watchRewards || [])];
      const pendingRewards = allRewards.filter(r => !r.paid).reduce((sum, r) => sum + (r.reward_earned || 0), 0);
      const paidRewards = allRewards.filter(r => r.paid).reduce((sum, r) => sum + (r.reward_earned || 0), 0);

      const activities: { type: string; title: string; reward: number; timestamp: string }[] = [];
      if (lastGame) activities.push({ type: 'game', title: lastGame.game_title, reward: lastGame.reward_earned || 0, timestamp: lastGame.started_at });
      if (lastMusic) activities.push({ type: 'music', title: (lastMusic.track as any)?.title || 'Music', reward: lastMusic.reward_earned || 0, timestamp: lastMusic.started_at || '' });
      if (lastWatch) activities.push({ type: 'watch', title: (lastWatch.video as any)?.title || 'Video', reward: lastWatch.reward_earned || 0, timestamp: lastWatch.started_at || '' });
      const sortedActivities = activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setStats({
        totalPosts: postsCount || 0,
        totalBurned,
        recentPosts: recentPosts || [],
        qualifiedReferrals: qualifiedReferralsCount || 0,
        airdropScore,
        airdropRank,
        avloBalance,
        totalSwipes,
        matchesCount: matchesCount || 0,
        pixelsPlaced: pixelsPlacedCount || 0,
        totalTipsReceived,
        remainingMinutes: dailyTimeMinutes,
        pendingRewards,
        paidRewards,
        lastActivity: sortedActivities[0] || null,
      });
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  // Fetch liked posts for current user
  useEffect(() => {
    const fetchLikedPosts = async () => {
      if (!currentUserProfile?.id || !stats?.recentPosts) return;
      
      const postIds = stats.recentPosts.map(p => p.id);
      const { data } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', currentUserProfile.id)
        .in('post_id', postIds);
      
      if (data) {
        setLikedPosts(new Set(data.map(l => l.post_id)));
      }
    };
    
    fetchLikedPosts();
  }, [currentUserProfile?.id, stats?.recentPosts]);

  // Scroll to highlighted post when stats are loaded and URL has post param
  useEffect(() => {
    if (!loading && highlightedPostId && stats?.recentPosts && stats.recentPosts.length > 0) {
      // Find which page the post is on
      const postIndex = stats.recentPosts.findIndex(p => p.id === highlightedPostId);
      if (postIndex !== -1) {
        const targetPage = Math.floor(postIndex / POSTS_PER_PAGE) + 1;
        if (targetPage !== postsPage) {
          setPostsPage(targetPage);
        }
        
        // Wait for page to render, then scroll
        setTimeout(() => {
          const postElement = postRefs.current[highlightedPostId];
          if (postElement) {
            postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            postElement.classList.add('ring-2', 'ring-orange-500', 'ring-opacity-75');
            
            // If comments should be opened
            if (shouldOpenComments) {
              setShowCommentsForPost(highlightedPostId);
            }
            
            // Remove highlight after animation
            setTimeout(() => {
              postElement.classList.remove('ring-2', 'ring-orange-500', 'ring-opacity-75');
              setSearchParams({});
            }, 3000);
          }
        }, 200);
      }
    }
  }, [loading, highlightedPostId, stats?.recentPosts, postsPage, shouldOpenComments, setSearchParams]);

  useEffect(() => {
    if (resolvedUserId) {
      // Load all data in parallel for faster loading
      Promise.all([
        fetchProfile(),
        fetchUserStats()
      ]).finally(() => setLoading(false));
    }
  }, [resolvedUserId]);

  const fetchProfile = async () => {
    if (!resolvedUserId) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', resolvedUserId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  // Handle like toggle
  const handleLike = async (postId: string) => {
    if (!currentUserProfile?.id) {
      toast.error('Please connect your wallet first');
      return;
    }

    const isLiked = likedPosts.has(postId);

    try {
      if (isLiked) {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUserProfile.id);
        
        setLikedPosts(prev => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
      } else {
        await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: currentUserProfile.id });
        
        setLikedPosts(prev => new Set(prev).add(postId));
      }

      // Update local stats
      if (stats) {
        setStats({
          ...stats,
          recentPosts: stats.recentPosts.map(post =>
            post.id === postId
              ? { ...post, likes_count: isLiked ? post.likes_count - 1 : post.likes_count + 1 }
              : post
          ),
        });
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('Failed to like post');
    }
  };

  // Handle repost - uses credits, not on-chain tokens
  const handleRepost = async (post: Post) => {
    if (!currentUserProfile?.id) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (repostingIds.has(post.id)) return;

    setRepostingIds(prev => new Set(prev).add(post.id));

    try {
      // Record the credit burn first (no on-chain transaction needed)
      const { error: burnError } = await supabase
        .from('token_burns')
        .insert({
          user_id: currentUserProfile.id,
          amount: repostCost,
          burn_type: 'post_repost',
          tx_hash: null,  // No tx hash for credit burns
        });

      if (burnError) {
        console.error('Error recording repost burn:', burnError);
        throw new Error('Failed to record credit burn');
      }

      await supabase.from('posts').insert({
        user_id: currentUserProfile.id,
        content: post.content,
        cost: repostCost,
        is_repost: true,
        referenced_post_id: post.id,
      });

      await supabase.from('posts').update({ cost: (post.cost || 0) + repostCost }).eq('id', post.id);

      toast.success('Reposted successfully!');
    } catch (error) {
      console.error('Error reposting:', error);
      toast.error('Failed to create repost. Please try again.');
    } finally {
      setRepostingIds(prev => {
        const next = new Set(prev);
        next.delete(post.id);
        return next;
      });
    }
  };

  const toggleComments = (postId: string) => {
    setShowCommentsForPost(showCommentsForPost === postId ? null : postId);
  };

  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-xl text-white">Loading profile...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Card className="p-8 text-center bg-gradient-to-br from-black/95 via-black/90 to-black/95 backdrop-blur-xl border-primary/20 shadow-2xl">
          <p className="text-xl text-white">User not found</p>
          <Button onClick={() => navigate(-1)} className="mt-4">Go Back</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-4xl mx-auto">
        {/* Cover Photo */}
        <div className="relative h-48 md:h-64 bg-gradient-to-r from-orange-900/20 to-orange-600/20 border-b border-zinc-800">
          {(profile as any)?.cover_photo_url && (
            <img 
              src={(profile as any).cover_photo_url} 
              alt="Cover" 
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Profile Content */}
        <div className="px-4 pb-8">
          {/* Back Button & Avatar */}
          <div className="flex justify-between items-start -mt-16 mb-4">
            <Avatar className="w-32 h-32 border-4 border-black shadow-xl overflow-hidden bg-zinc-900">
              {(() => {
                const avatarSrc = getAvatarUrl(profile.avatar_url, profile.id);
                return avatarSrc.match(/\.(mp4|webm)$/i) ? (
                  <video 
                    src={avatarSrc} 
                    autoPlay 
                    loop 
                    muted 
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <AvatarImage src={avatarSrc} />
                );
              })()}
            </Avatar>

            <div className="flex gap-2 relative z-20">
              {currentUserProfile?.id && currentUserProfile.id !== userId && (
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('Follow button clicked');
                    toggleFollow();
                  }}
                  variant={isFollowing ? "outline" : "default"}
                  className={isFollowing 
                    ? "bg-zinc-900 hover:bg-red-500/10 hover:border-red-500 text-white border-zinc-700 transition-all cursor-pointer pointer-events-auto" 
                    : "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg cursor-pointer pointer-events-auto"
                  }
                >
                  {isFollowing ? (
                    <>
                      <UserMinus className="w-4 h-4 mr-2" />
                      Unfollow
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Follow
                    </>
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => navigate(-1)}
                className="text-white hover:bg-zinc-900 border border-zinc-700 rounded-full cursor-pointer pointer-events-auto"
              >
                <ArrowLeft className="mr-2 w-4 h-4" />
                Back
              </Button>
            </div>
          </div>

          {/* User Info */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold text-white">
                {profile.display_name || profile.username}
              </h1>
              {/* Show Arena badge OR regular username - not both */}
              {profile.arena_verified && profile.arena_username ? (
                <div className="flex items-center gap-1.5 bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/30 px-2.5 py-1.5 rounded-full">
                  <img src={arenaLogo} alt="Arena" className="w-4 h-4 rounded-sm" />
                  <span className="text-orange-400 text-xs font-semibold">@{profile.arena_username}</span>
                </div>
              ) : (
                <span className="text-zinc-500 text-lg">@{profile.username}</span>
              )}
              {profile.special_badge && (
                <div className="relative inline-flex items-center gap-1.5">
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-yellow-400 blur-md opacity-75 animate-pulse rounded-full"></div>
                  <img 
                    src={avloLogo} 
                    alt="AVLO Elite" 
                    className="relative w-6 h-6 rounded-full border-2 border-yellow-400 shadow-lg animate-pulse"
                  />
                </div>
              )}
            </div>

            {/* Follower Stats, Tips and Location */}
            <div className="flex flex-wrap items-center gap-4 mb-3">
              <button 
                className="hover:text-orange-500 transition-colors"
                onClick={() => {
                  setFollowersDialogTab('following');
                  setFollowersDialogOpen(true);
                }}
              >
                <span className="text-white font-semibold">{followingCount}</span>
                <span className="text-zinc-500 text-sm ml-1">Following</span>
              </button>
              <button 
                className="hover:text-orange-500 transition-colors"
                onClick={() => {
                  setFollowersDialogTab('followers');
                  setFollowersDialogOpen(true);
                }}
              >
                <span className="text-white font-semibold">{followersCount}</span>
                <span className="text-zinc-500 text-sm ml-1">Followers</span>
              </button>
              
              {/* Tip Button & Tips Received */}
              {currentUserProfile?.id && currentUserProfile.id !== resolvedUserId && profile.wallet_address && (
                <TipDialog
                  receiverId={resolvedUserId || ''}
                  receiverName={profile.display_name || profile.username}
                  receiverWallet={profile.wallet_address}
                  context="match"
                  variant="discover"
                />
              )}
              
              {stats && stats.totalTipsReceived > 0 && (
                <div className="flex items-center gap-1.5 bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/30 px-2.5 py-1 rounded-full">
                  <Gift className="w-4 h-4 text-orange-400" />
                  <span className="text-orange-400 font-semibold text-sm">
                    {stats.totalTipsReceived.toLocaleString('en-US')}
                  </span>
                  <span className="text-zinc-500 text-xs">Tips</span>
                </div>
              )}
              
              {profile.location && (
                <div className="flex items-center gap-1 text-zinc-400 text-sm">
                  <MapPin className="w-4 h-4" />
                  <span>{profile.location}</span>
                </div>
              )}
            </div>

            {profile.bio && (
              <p className="text-white text-sm mb-4">
                {profile.bio}
              </p>
            )}

            {profile.date_of_birth && (
              <div className="flex items-center gap-1 text-zinc-400 text-sm mb-4">
                <Calendar className="w-4 h-4" />
                <span>{calculateAge(profile.date_of_birth)} years old</span>
              </div>
            )}
          </div>

          {/* Statistics Row - Modern Grid */}
          {stats && (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-center">
                <div className="text-white font-bold text-lg">{stats.totalSwipes}</div>
                <div className="text-zinc-500 text-[10px] uppercase tracking-wide">Swipes</div>
              </div>

              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-center">
                <div className="text-white font-bold text-lg">{stats.matchesCount}</div>
                <div className="text-zinc-500 text-[10px] uppercase tracking-wide">Matches</div>
              </div>

              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-center">
                <div className="text-white font-bold text-lg">{stats.totalPosts}</div>
                <div className="text-zinc-500 text-[10px] uppercase tracking-wide">Posts</div>
              </div>

              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-center">
                <div className="text-orange-500 font-bold text-lg">{stats.airdropScore.toLocaleString()}</div>
                <div className="text-zinc-500 text-[10px] uppercase tracking-wide">Score</div>
              </div>

              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-center">
                <div className="text-orange-500 font-bold text-lg">#{stats.airdropRank}</div>
                <div className="text-zinc-500 text-[10px] uppercase tracking-wide">Rank</div>
              </div>

              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-center">
                <div className="text-pink-400 font-bold text-lg flex items-center justify-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {stats.pixelsPlaced.toLocaleString()}
                </div>
                <div className="text-zinc-500 text-[10px] uppercase tracking-wide">Pixels</div>
              </div>
            </div>
          )}

          {/* Reward Activity - Minimal */}
          {stats && (
            <div className="mb-6 bg-zinc-900/30 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-zinc-400" />
                  <span className="text-xs text-zinc-400 font-medium">Activity</span>
                </div>
                {stats.lastActivity && (
                  <span className="text-[10px] text-zinc-500">
                    Last: {stats.lastActivity.title}
                  </span>
                )}
              </div>
              
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 text-center">
                  <div className="text-xl font-bold text-white">{stats.remainingMinutes}<span className="text-sm text-zinc-500">m</span></div>
                  <div className="text-[10px] text-zinc-500">Daily Time</div>
                </div>
                
                <div className="w-px h-8 bg-zinc-800" />
                
                <div className="flex-1 text-center">
                  <div className="text-xl font-bold text-orange-400">
                    {stats.pendingRewards >= 1000 ? `${(stats.pendingRewards / 1000).toFixed(1)}K` : stats.pendingRewards.toFixed(0)}
                  </div>
                  <div className="text-[10px] text-zinc-500">Pending</div>
                </div>
                
                <div className="w-px h-8 bg-zinc-800" />
                
                <div className="flex-1 text-center">
                  <div className="text-xl font-bold text-green-400">
                    {stats.paidRewards >= 1000 ? `${(stats.paidRewards / 1000).toFixed(1)}K` : stats.paidRewards.toFixed(0)}
                  </div>
                  <div className="text-[10px] text-zinc-500">Paid</div>
                </div>
              </div>
            </div>
          )}

          {/* Tabs Section */}
          <Tabs defaultValue="posts" className="mb-6">
            <TabsList className="w-full bg-black border-b border-zinc-800 rounded-none h-auto p-0">
              <TabsTrigger 
                value="posts" 
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:bg-transparent text-zinc-500 data-[state=active]:text-white"
              >
                Posts
              </TabsTrigger>
              <TabsTrigger 
                value="media" 
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:bg-transparent text-zinc-500 data-[state=active]:text-white"
              >
                Media
              </TabsTrigger>
              <TabsTrigger 
                value="about" 
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:bg-transparent text-zinc-500 data-[state=active]:text-white"
              >
                About
              </TabsTrigger>
            </TabsList>

            {/* Posts Tab */}
            <TabsContent value="posts" className="mt-4">
              {stats?.recentPosts && stats.recentPosts.length > 0 ? (
                <>
                  <div className="space-y-4">
                    {stats.recentPosts.slice((postsPage - 1) * POSTS_PER_PAGE, postsPage * POSTS_PER_PAGE).map((post) => (
                    <Card 
                      key={post.id} 
                      ref={(el) => { postRefs.current[post.id] = el; }}
                      className={`p-4 bg-gradient-to-br from-zinc-950 via-black to-zinc-950 border border-zinc-800 hover:border-orange-500/50 transition-all duration-300 shadow-xl hover:shadow-orange-500/10 backdrop-blur-sm ${
                        highlightedPostId === post.id ? 'ring-2 ring-orange-500 bg-orange-500/10' : ''
                      }`}
                    >
                      {/* Post Header - User Info */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10 border border-zinc-800 overflow-hidden">
                            {profile.avatar_url ? (
                              profile.avatar_url.match(/\.(mp4|webm)$/i) ? (
                                <video 
                                  src={profile.avatar_url} 
                                  autoPlay 
                                  loop 
                                  muted 
                                  playsInline
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <AvatarImage src={profile.avatar_url} />
                              )
                            ) : (
                              <AvatarFallback className="bg-gradient-to-br from-orange-500 to-orange-600 text-white text-sm">
                                {profile.username.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-white font-semibold text-sm">
                                {profile.display_name || profile.username}
                              </p>
                              {profile.arena_verified && (
                                <img src={arenaLogo} alt="Arena" className="w-4 h-4 rounded-sm" />
                              )}
                              {profile.special_badge && (
                                <img 
                                  src={avloLogo} 
                                  alt="AVLO Elite" 
                                  className="w-4 h-4 rounded-full border border-yellow-400"
                                />
                              )}
                            </div>
                            <p className="text-zinc-500 text-xs">@{profile.username}</p>
                          </div>
                        </div>
                        
                        {/* Follow button on post */}
                        {currentUserProfile?.id && currentUserProfile.id !== userId && (
                          <FollowButton userId={userId} currentUserId={currentUserProfile.id} />
                        )}
                      </div>

      {/* Repost indicator */}
                      {post.is_repost && (
                        <div className="flex items-center gap-1 text-zinc-500 text-xs mb-2">
                          <Repeat className="w-3 h-3" />
                          <span>Reposted</span>
                        </div>
                      )}

                      <p className="text-white text-sm mb-3">{post.content}</p>
                      
                      {post.media_url && (
                        <div className="rounded-lg overflow-hidden mb-3">
                          {post.media_type?.startsWith('image') ? (
                            <img src={post.media_url} alt="Post" className="w-full max-h-96 object-cover" />
                          ) : post.media_type?.startsWith('video') ? (
                            <video src={post.media_url} className="w-full max-h-96 object-cover" controls />
                          ) : null}
                        </div>
                      )}
                      
                      {/* Post Actions */}
                      <div className="flex items-center justify-between text-xs border-t border-zinc-800 pt-3 mt-3">
                        <div className="flex items-center gap-4">
                          {/* Like Button */}
                          <button
                            onClick={() => handleLike(post.id)}
                            className={`flex items-center gap-1 transition-colors cursor-pointer ${
                              likedPosts.has(post.id) ? 'text-red-500' : 'text-zinc-400 hover:text-red-500'
                            }`}
                          >
                            <Heart className={`w-4 h-4 ${likedPosts.has(post.id) ? 'fill-current' : ''}`} />
                            {post.likes_count}
                          </button>
                          
                          {/* Comment Button */}
                          <button
                            onClick={() => toggleComments(post.id)}
                            className={`flex items-center gap-1 transition-colors cursor-pointer ${
                              showCommentsForPost === post.id ? 'text-orange-500' : 'text-zinc-400 hover:text-orange-500'
                            }`}
                          >
                            <MessageCircle className="w-4 h-4" />
                            {post.comments_count}
                          </button>
                          
                          {/* Repost Button */}
                          {currentUserProfile?.id && currentUserProfile.id !== resolvedUserId && (
                            <button
                              onClick={() => handleRepost(post)}
                              disabled={repostingIds.has(post.id)}
                              className="flex items-center gap-1 text-zinc-400 hover:text-green-500 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {repostingIds.has(post.id) ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Repeat className="w-4 h-4" />
                              )}
                              <span className="text-xs">50</span>
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-orange-500 font-bold flex items-center gap-1">
                            <Flame className="w-3 h-3" /> {post.cost} AVLO
                          </span>
                          <span className="text-zinc-500">
                            {new Date(post.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      
                      {/* Comments Section */}
                      {showCommentsForPost === post.id && (
                        <div className="mt-4 pt-4 border-t border-zinc-800">
                          <PostComments postId={post.id} />
                        </div>
                      )}
                    </Card>
                    ))}
                  </div>
                  
                  {/* Pagination */}
                  {stats.recentPosts.length > POSTS_PER_PAGE && (
                    <div className="flex items-center justify-center gap-2 pt-6">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPostsPage(p => Math.max(1, p - 1))}
                        disabled={postsPage === 1}
                        className="text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-zinc-400 text-sm">
                        Page {postsPage} of {Math.ceil(stats.recentPosts.length / POSTS_PER_PAGE)}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPostsPage(p => Math.min(Math.ceil(stats.recentPosts.length / POSTS_PER_PAGE), p + 1))}
                        disabled={postsPage >= Math.ceil(stats.recentPosts.length / POSTS_PER_PAGE)}
                        className="text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-zinc-500">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No posts yet</p>
                </div>
              )}
            </TabsContent>

            {/* Media Tab */}
            <TabsContent value="media" className="mt-4">
              {(() => {
                const postMedia = (stats?.recentPosts || []).filter(post => post.media_url).map(post => ({
                  url: post.media_url!,
                  type: post.media_type
                }));
                const profilePhotos = (profile.photo_urls || []).map((url) => ({
                  url,
                  type: url.match(/\.(mp4|webm)$/i) ? 'video' : 'image'
                }));
                const allMedia = [...postMedia, ...profilePhotos];
                
                return allMedia.length > 0 ? (
                  <div className="grid grid-cols-3 gap-1">
                    {allMedia.map((media, index) => (
                      <div key={index} className="aspect-square rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800">
                        {media.type?.startsWith('video') || media.url.match(/\.(mp4|webm)$/i) ? (
                          <video
                            src={media.url}
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <img
                            src={media.url}
                            alt={`Media ${index + 1}`}
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300 cursor-pointer"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-zinc-500">
                    <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No media yet</p>
                  </div>
                );
              })()}
            </TabsContent>


            {/* About Tab */}
            <TabsContent value="about" className="mt-4">
              <div className="space-y-6">
                {/* Score Transfer History */}
                <ScoreTransferHistory userId={resolvedUserId || ''} />
                {/* Interests */}
                {profile.interests && profile.interests.length > 0 && (
                  <div>
                    <h3 className="text-white font-semibold mb-3 text-sm">Interests</h3>
                    <div className="flex flex-wrap gap-2">
                      {profile.interests.map((interest, index) => (
                        <Badge 
                          key={index} 
                          className="bg-zinc-900 hover:bg-zinc-800 text-white border-zinc-800 rounded-full"
                        >
                          {interest}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Badges */}
                {userBadges && userBadges.length > 0 && (
                  <div>
                    <h3 className="text-white font-semibold mb-3 text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-white" />
                      Achievements
                    </h3>
                    <TooltipProvider>
                      <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                        {userBadges.map((userBadge) => {
                          const IconComponent = (LucideIcons as any)[userBadge.badges.icon] || LucideIcons.Award;
                          
                          return (
                            <Tooltip key={userBadge.id}>
                              <TooltipTrigger>
                                <div className="relative bg-black border border-zinc-800 p-4 rounded-lg flex flex-col items-center gap-2 hover:border-white transition-all group overflow-hidden">
                                  {/* Neon glow effect on hover */}
                                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                  
                                  {/* Icon */}
                                  <div className="relative z-10">
                                    <IconComponent className="text-white group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" size={28} strokeWidth={1.5} />
                                  </div>
                                  
                                  {/* Badge name */}
                                  <span className="relative z-10 text-white text-[10px] font-light text-center tracking-wide uppercase">
                                    {userBadge.badges.name}
                                  </span>
                                  
                                  {/* Corner accent */}
                                  <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-white/20 group-hover:border-white/60 transition-colors" />
                                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-white/20 group-hover:border-white/60 transition-colors" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                 <p className="font-semibold">{userBadge.badges.name}</p>
                                 <p className="text-sm">{userBadge.badges.description}</p>
                                 <p className="text-xs text-zinc-400 mt-1">
                                   Earned: {new Date(userBadge.earned_at).toLocaleDateString()}
                                 </p>
                               </TooltipContent>
                             </Tooltip>
                           );
                        })}
                      </div>
                    </TooltipProvider>
                  </div>
                )}

                {/* Social Links */}
                {((profile as any).instagram_username || (profile as any).linkedin_username || profile.arena_username) && (
                  <div>
                    <h3 className="text-white font-semibold mb-3 text-sm">Social Links</h3>
                    <div className="space-y-3">
                      {(profile as any).instagram_username && (
                        <a
                          href={`https://instagram.com/${(profile as any).instagram_username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 hover:border-purple-500/40 transition-all"
                        >
                          <Instagram className="w-5 h-5 text-purple-400" />
                          <span className="text-white font-medium">@{(profile as any).instagram_username}</span>
                        </a>
                      )}
                      {(profile as any).linkedin_username && (
                        <a
                          href={`https://linkedin.com/in/${(profile as any).linkedin_username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 rounded-lg bg-blue-600/10 border border-blue-600/20 hover:border-blue-600/40 transition-all"
                        >
                          <Linkedin className="w-5 h-5 text-blue-500" />
                          <span className="text-white font-medium">{(profile as any).linkedin_username}</span>
                        </a>
                      )}
                      {profile.arena_username && (
                        <a
                          href={`https://arena.social/${profile.arena_username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/20 hover:border-orange-500/40 transition-all"
                        >
                          <img src={arenaLogo} alt="Arena" className="w-5 h-5 rounded-sm" />
                          <span className="text-white font-medium">@{profile.arena_username}</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Followers Dialog */}
      {resolvedUserId && (
        <FollowersDialog
          isOpen={followersDialogOpen}
          onClose={() => setFollowersDialogOpen(false)}
          userId={resolvedUserId}
          initialTab={followersDialogTab}
        />
      )}
    </div>
  );
};

export default UserProfile;
