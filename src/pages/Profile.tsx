import { useState, useEffect } from 'react';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MapPin, Calendar, Heart, Camera, TrendingUp, Flame, BarChart3, Award, Trophy, Sparkles, Trash2, MessageCircle, Edit3, X, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useBadges } from '@/hooks/useBadges';
import { useFollowers } from '@/hooks/useFollowers';
import * as LucideIcons from 'lucide-react';
import { toast } from 'sonner';
import { LocationSearch } from '@/components/LocationSearch';
import { isArenaApp } from '@/lib/arenaDetector';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useTokenBalances } from '@/hooks/useTokenBalances';
import { motion } from 'framer-motion';
import avloLogo from '@/assets/avlo-logo.jpg';
import arenaLogo from '@/assets/arena-logo.png';
import { CoverPhotoUpload } from '@/components/CoverPhotoUpload';
import { RecentPixelArtists } from '@/components/loveart/RecentPixelArtists';
import { ScoreTransferHistory } from '@/components/ScoreTransferHistory';

interface Stats {
  totalSwipes: number;
  likesCount: number;
  passesCount: number;
  totalBurned: number;
  mostActiveDay: string;
  matchesCount: number;
  qualifiedReferrals: number;
  airdropScore: number;
  airdropRank: number;
  avloBalance: number;
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
}

interface PostLike {
  post_id: string;
  posts: Post & {
    user: {
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    };
  };
}

const Profile = () => {
  const { profile } = useWalletAuth();
  const navigate = useNavigate();
  const { userBadges, loading: badgesLoading } = useBadges(profile?.id);
  const { followersCount, followingCount } = useFollowers(profile?.id);
  const balances = useTokenBalances();
  const [maxDistance, setMaxDistance] = useState<number>(profile?.max_distance_km || 50);
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [stats, setStats] = useState<Stats>({
    totalSwipes: 0,
    likesCount: 0,
    passesCount: 0,
    totalBurned: 0,
    mostActiveDay: '',
    matchesCount: 0,
    qualifiedReferrals: 0,
    airdropScore: 0,
    airdropRank: 0,
    avloBalance: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [likedPosts, setLikedPosts] = useState<PostLike[]>([]);
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | null>((profile as any)?.cover_photo_url || null);
  const [postFilter, setPostFilter] = useState<'all' | 'media' | 'text'>('all');
  const [editingBio, setEditingBio] = useState(false);
  const [bioValue, setBioValue] = useState('');
  const [editingInterests, setEditingInterests] = useState(false);
  const [interestsValue, setInterestsValue] = useState<string[]>([]);
  const [newInterest, setNewInterest] = useState('');
  const [editingSocials, setEditingSocials] = useState(false);
  const [socialValues, setSocialValues] = useState({
    instagram: '',
    twitter: '',
    linkedin: '',
    arena: ''
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [selectedBadge, setSelectedBadge] = useState<any>(null);
  const [activityPage, setActivityPage] = useState(1);
  const ACTIVITY_PER_PAGE = 10;
  const [postsPage, setPostsPage] = useState(1);
  const POSTS_PER_PAGE = 10;

  useEffect(() => {
    if (profile) {
      fetchStats();
      fetchUserPosts();
      fetchLikedPosts();
      fetchRecentActivity();
      if (profile.max_distance_km) {
        setMaxDistance(profile.max_distance_km);
      }
      if ((profile as any)?.cover_photo_url) {
        setCoverPhotoUrl((profile as any).cover_photo_url);
      }
      if (profile.bio) {
        setBioValue(profile.bio);
      }
      if (profile.interests) {
        setInterestsValue(profile.interests);
      }
      setSocialValues({
        instagram: (profile as any).instagram_username || '',
        twitter: (profile as any).twitter_username || '',
        linkedin: (profile as any).linkedin_username || '',
        arena: (profile as any).arena_username || ''
      });
    }
  }, [profile]);

  const fetchRecentActivity = async () => {
    if (!profile) return;

    try {
      const activities: any[] = [];

      // Fetch recent swipes
      const { data: swipes } = await supabase
        .from('swipes')
        .select('*, swiped:swiped_id(username, display_name, avatar_url)')
        .eq('swiper_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(5);

      swipes?.forEach(swipe => {
        activities.push({
          type: swipe.direction === 'right' ? 'like' : 'pass',
          timestamp: swipe.created_at,
          data: swipe
        });
      });

      // Fetch recent matches
      const { data: matches } = await supabase
        .from('matches')
        .select(`
          *,
          user1:user1_id(username, display_name, avatar_url),
          user2:user2_id(username, display_name, avatar_url)
        `)
        .or(`user1_id.eq.${profile.id},user2_id.eq.${profile.id}`)
        .order('created_at', { ascending: false })
        .limit(5);

      matches?.forEach(match => {
        const otherUser = match.user1_id === profile.id ? match.user2 : match.user1;
        activities.push({
          type: 'match',
          timestamp: match.created_at,
          data: { ...match, otherUser }
        });
      });

      // Fetch recent tips sent
      const { data: tips } = await supabase
        .from('tips')
        .select('*, receiver:receiver_id(username, display_name, avatar_url)')
        .eq('sender_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(5);

      tips?.forEach(tip => {
        activities.push({
          type: 'tip',
          timestamp: tip.created_at,
          data: tip
        });
      });

      // Sort all activities by timestamp
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecentActivity(activities); // Store all activities for pagination
    } catch (error) {
      console.error('Error fetching recent activity:', error);
    }
  };

  const handleUnlike = async (postId: string) => {
    if (!profile) return;

    try {
      const { error } = await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', profile.id);

      if (error) throw error;

      // Refresh liked posts
      fetchLikedPosts();
      toast.success('Post unliked');
    } catch (error) {
      console.error('Error unliking post:', error);
      toast.error('Failed to unlike post');
    }
  };

  const handleSaveBio = async () => {
    if (!profile) return;

    const trimmedBio = bioValue.trim();
    if (trimmedBio.length > 500) {
      toast.error('Bio must be less than 500 characters');
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ bio: trimmedBio })
        .eq('id', profile.id);

      if (error) throw error;
      
      setEditingBio(false);
      toast.success('Bio updated');
    } catch (error) {
      console.error('Error updating bio:', error);
      toast.error('Failed to update bio');
    }
  };

  const handleSaveInterests = async () => {
    if (!profile) return;

    if (interestsValue.length > 10) {
      toast.error('Maximum 10 interests allowed');
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ interests: interestsValue })
        .eq('id', profile.id);

      if (error) throw error;
      
      setEditingInterests(false);
      toast.success('Interests updated');
    } catch (error) {
      console.error('Error updating interests:', error);
      toast.error('Failed to update interests');
    }
  };

  const handleAddInterest = () => {
    const trimmed = newInterest.trim();
    if (!trimmed) return;
    
    if (trimmed.length > 30) {
      toast.error('Interest must be less than 30 characters');
      return;
    }

    if (interestsValue.length >= 10) {
      toast.error('Maximum 10 interests allowed');
      return;
    }

    if (interestsValue.includes(trimmed)) {
      toast.error('Interest already added');
      return;
    }

    setInterestsValue([...interestsValue, trimmed]);
    setNewInterest('');
  };

  const handleSaveSocials = async () => {
    if (!profile) return;

    // Validate usernames
    if (socialValues.instagram && socialValues.instagram.length > 30) {
      toast.error('Instagram username too long');
      return;
    }
    if (socialValues.twitter && socialValues.twitter.length > 15) {
      toast.error('Twitter username too long');
      return;
    }
    if (socialValues.linkedin && socialValues.linkedin.length > 100) {
      toast.error('LinkedIn username too long');
      return;
    }
    if (socialValues.arena && socialValues.arena.length > 30) {
      toast.error('Arena username too long');
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          instagram_username: socialValues.instagram.trim() || null,
          twitter_username: socialValues.twitter.trim() || null,
          linkedin_username: socialValues.linkedin.trim() || null,
          arena_username: socialValues.arena.trim() || null
        })
        .eq('id', profile.id);

      if (error) throw error;
      
      setEditingSocials(false);
      toast.success('Social links updated');
    } catch (error) {
      console.error('Error updating social links:', error);
      toast.error('Failed to update social links');
    }
  };

  const handleRemoveInterest = (interest: string) => {
    setInterestsValue(interestsValue.filter(i => i !== interest));
  };

  const filteredPosts = postFilter === 'all' 
    ? userPosts 
    : postFilter === 'media'
    ? userPosts.filter(p => p.media_url)
    : userPosts.filter(p => !p.media_url);

  const fetchUserPosts = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUserPosts(data || []);
    } catch (error) {
      console.error('Error fetching user posts:', error);
    }
  };

  const fetchLikedPosts = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('post_likes')
        .select(`
          post_id,
          posts:post_id (
            *,
            user:profiles!posts_user_id_fkey (
              username,
              display_name,
              avatar_url
            )
          )
        `)
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLikedPosts(data || []);
    } catch (error) {
      console.error('Error fetching liked posts:', error);
    }
  };

  const handleLocationSelect = async (location: string, latitude: number, longitude: number) => {
    if (!profile) return;
    
    setIsSavingLocation(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          location,
          latitude,
          longitude,
        })
        .eq('id', profile.id);

      if (error) throw error;
      toast.success('Location updated successfully');
    } catch (error) {
      console.error('Error updating location:', error);
      toast.error('Failed to update location');
    } finally {
      setIsSavingLocation(false);
    }
  };

  const updateMaxDistance = async (distance: number) => {
    if (!profile) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          max_distance_km: distance,
        })
        .eq('id', profile.id);

      if (error) throw error;
      
      setMaxDistance(distance);
      toast.success(`Search radius updated to ${distance}km`);
    } catch (error) {
      console.error('Error updating max distance:', error);
      toast.error('Failed to update search radius');
    }
  };


  const fetchStats = async () => {
    if (!profile) return;

    setLoadingStats(true);
    try {
      // Fetch swipes
      const { data: swipes, error: swipesError } = await supabase
        .from('swipes')
        .select('direction, created_at')
        .eq('swiper_id', profile.id);

      if (swipesError) throw swipesError;

      // Fetch token burns
      const { data: burns, error: burnsError } = await supabase
        .from('token_burns')
        .select('amount')
        .eq('user_id', profile.id);

      if (burnsError) throw burnsError;

      // Skip empty tables: matches (0 rows), referrals (0 rows), messages (0 rows)
      const matchesCount = 0;
      const qualifiedReferralsCount = 0;
      const messagesCount = 0;

      const { count: tipsCount } = await supabase
        .from('tips')
        .select('*', { count: 'exact', head: true })
        .eq('sender_id', profile.id);

      const { count: stakesCount } = await supabase
        .from('staking_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('transaction_type', 'stake');

      const { count: burnsCount } = await supabase
        .from('token_burns')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id);

      const { count: postsCount } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id);

      const { count: likesCount } = await supabase
        .from('post_likes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id);

      const { count: commentsCount } = await supabase
        .from('post_comments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id);

      // Get cached AVLO token ID
      const { getAvloTokenId } = await import('@/lib/avloTokenCache');
      const avloTokenId = await getAvloTokenId();
      const avloToken = avloTokenId ? { id: avloTokenId } : null;

      // Get score from user_scores table filtered by AVLO token
      const { data: userScoreData } = await supabase
        .from('user_scores')
        .select('total_score')
        .eq('user_id', profile.id)
        .eq('token_id', avloToken?.id)
        .maybeSingle();

      const airdropScore = userScoreData?.total_score || 0;

      // Get rank from user_scores table (AVLO only)
      const { data: allScores } = await supabase
        .from('user_scores')
        .select('user_id, total_score')
        .eq('token_id', avloToken?.id)
        .order('total_score', { ascending: false });

      let airdropRank = 1;
      if (allScores) {
        const userRankIndex = allScores.findIndex(s => s.user_id === profile.id);
        if (userRankIndex !== -1) {
          airdropRank = userRankIndex + 1;
        }
      }

      // Calculate stats
      const totalSwipes = swipes?.length || 0;
      const likes = swipes?.filter(s => s.direction === 'right').length || 0;
      const passesCount = swipes?.filter(s => s.direction === 'left').length || 0;
      const totalBurned = burns?.reduce((sum, b) => sum + Number(b.amount), 0) || 0;

      // Calculate most active day
      const dayCount: Record<string, number> = {};
      swipes?.forEach(swipe => {
        const day = new Date(swipe.created_at).toLocaleDateString('en-US', { weekday: 'long' });
        dayCount[day] = (dayCount[day] || 0) + 1;
      });

      const mostActiveDay = Object.keys(dayCount).length > 0
        ? Object.entries(dayCount).sort(([, a], [, b]) => b - a)[0][0]
        : 'N/A';

      // Get AVLO balance from hook
      const avloBalance = balances.avloBalance ? parseFloat(balances.avloBalance) : 0;

      setStats({
        totalSwipes,
        likesCount: likes,
        passesCount,
        totalBurned,
        mostActiveDay,
        matchesCount: matchesCount || 0,
        qualifiedReferrals: qualifiedReferralsCount || 0,
        airdropScore,
        airdropRank,
        avloBalance,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-xl text-white">Loading profile...</div>
      </div>
    );
  }

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-4xl mx-auto">
        {/* Cover Photo */}
        <div className="relative h-48 md:h-64 bg-gradient-to-r from-orange-900/20 to-orange-600/20 border-b border-zinc-800">
          {coverPhotoUrl && (
            <img 
              src={coverPhotoUrl} 
              alt="Cover" 
              className="w-full h-full object-cover"
            />
          )}
          <CoverPhotoUpload 
            userId={profile.id} 
            onUploadComplete={(url) => setCoverPhotoUrl(url)} 
          />
        </div>

        {/* Profile Content */}
        <div className="px-4 pb-8">
          {/* Avatar & Edit Button Row */}
          <div className="flex justify-between items-start -mt-16 mb-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
            >
              <Avatar className="w-32 h-32 border-4 border-black shadow-xl overflow-hidden bg-zinc-900">
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
                  <AvatarFallback className="bg-gradient-to-br from-orange-500 to-orange-600 text-white text-4xl">
                    {profile.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                )}
              </Avatar>
            </motion.div>

            <Button
              onClick={() => navigate('/profile-setup')}
              className="mt-4 bg-black hover:bg-zinc-900 text-white border border-zinc-700 rounded-full px-6 z-20 pointer-events-auto"
            >
              Edit Profile
            </Button>
          </div>

          {/* User Info */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-white">
                {profile.display_name || profile.username}
              </h1>
              <span className="text-zinc-500 text-lg">@{profile.username}</span>
              {(profile as any).twitter_verified && (
                <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/30 px-2.5 py-1.5 rounded-full">
                  <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  <span className="text-blue-400 text-xs font-semibold">Verified</span>
                </div>
              )}
              {(profile as any).arena_verified && (profile as any).arena_username && (
                <div className="flex items-center gap-1.5 bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/30 px-2.5 py-1.5 rounded-full">
                  <img src={arenaLogo} alt="Arena" className="w-4 h-4 rounded-sm" />
                  <span className="text-orange-400 text-xs font-semibold">@{(profile as any).arena_username}</span>
                </div>
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

            {/* Follower Stats and Location */}
            <div className="flex flex-wrap items-center gap-4 mb-3">
              <button 
                className="hover:text-orange-500 transition-colors"
                onClick={() => {/* TODO: Show followers modal */}}
              >
                <span className="text-white font-semibold">{followingCount}</span>
                <span className="text-zinc-500 text-sm ml-1">Following</span>
              </button>
              <button 
                className="hover:text-orange-500 transition-colors"
                onClick={() => {/* TODO: Show followers modal */}}
              >
                <span className="text-white font-semibold">{followersCount}</span>
                <span className="text-zinc-500 text-sm ml-1">Followers</span>
              </button>
              {profile.location && (
                <div className="flex items-center gap-1 text-zinc-400 text-sm">
                  <MapPin className="w-4 h-4" />
                  <span>{profile.location}</span>
                </div>
              )}
            </div>

            {profile.bio ? (
              <div className="mb-4">
                {editingBio ? (
                  <div className="space-y-2">
                    <Textarea
                      value={bioValue}
                      onChange={(e) => setBioValue(e.target.value)}
                      className="bg-zinc-900 border-zinc-800 text-white resize-none"
                      rows={3}
                      maxLength={500}
                    />
                    <div className="flex justify-between items-center">
                      <span className={`text-xs ${bioValue.length > 450 ? 'text-orange-500' : 'text-zinc-500'}`}>
                        {bioValue.length}/500 characters
                      </span>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveBio} className="bg-orange-500 hover:bg-orange-600">
                          Save
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => {
                            setBioValue(profile.bio || '');
                            setEditingBio(false);
                          }}
                          className="text-white hover:bg-zinc-800"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="group relative">
                    <p className="text-white text-sm">
                      {profile.bio}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingBio(true)}
                      className="absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-white"
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditingBio(true);
                  setBioValue('');
                }}
                className="mb-4 text-zinc-400 hover:text-white"
              >
                <Edit3 className="w-4 h-4 mr-2" />
                Add bio
              </Button>
            )}

            <div className="flex flex-wrap gap-3 mb-4">
              {profile.date_of_birth && (
                <div className="flex items-center gap-1 text-zinc-400 text-sm">
                  <Calendar className="w-4 h-4" />
                  <span>{calculateAge(profile.date_of_birth)} years old</span>
                </div>
              )}
            </div>
          </div>

          {/* Statistics Row */}
          <div className="flex flex-wrap gap-4 md:gap-6 mb-6 pb-4 border-b border-zinc-800 overflow-x-auto">
            <div className="flex flex-col">
              <div className="text-white font-bold text-sm">
                {loadingStats ? '...' : stats.totalSwipes}
              </div>
              <div className="text-zinc-500 text-xs">Swipes</div>
            </div>

            <div className="flex flex-col">
              <div className="text-white font-bold text-sm">
                {loadingStats ? '...' : stats.matchesCount}
              </div>
              <div className="text-zinc-500 text-xs">Matches</div>
            </div>

            <div className="flex flex-col">
              <div className="text-white font-bold text-sm">
                {loadingStats ? '...' : stats.totalBurned >= 1000 
                  ? `${(stats.totalBurned / 1000).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}K`
                  : stats.totalBurned.toLocaleString('en-US')
                }
              </div>
              <div className="text-zinc-500 text-xs">$AVLO Burned</div>
            </div>

            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1.5">
                <img src={avloLogo} alt="AVLO" className="w-4 h-4 rounded-full" />
                <div className="text-white font-bold text-sm">
                  {loadingStats ? '...' : balances.avloBalance ? parseFloat(balances.avloBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                </div>
              </div>
              <div className="text-zinc-500 text-xs">$AVLO Balance</div>
            </div>

            <div className="flex flex-col">
              <div className="text-orange-500 font-bold text-sm">
                {loadingStats ? '...' : stats.airdropScore.toLocaleString()}
              </div>
              <div className="text-zinc-500 text-xs">Airdrop Score</div>
            </div>

            <div className="flex flex-col">
              <div className="text-orange-500 font-bold text-sm">
                #{loadingStats ? '...' : stats.airdropRank}
              </div>
              <div className="text-zinc-500 text-xs">Ranking</div>
            </div>
          </div>

          {/* Interests */}
          {(profile.interests && profile.interests.length > 0) || editingInterests ? (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold text-sm">Interests</h3>
                {!editingInterests && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingInterests(true)}
                    className="text-zinc-400 hover:text-white h-auto p-1"
                  >
                    <Edit3 className="w-4 h-4" />
                  </Button>
                )}
              </div>
              
              {editingInterests ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {interestsValue.map((interest, index) => (
                      <Badge 
                        key={index} 
                        className="bg-zinc-900 hover:bg-zinc-800 text-white border-zinc-800 rounded-full pr-1"
                      >
                        {interest}
                        <button
                          onClick={() => handleRemoveInterest(interest)}
                          className="ml-2 hover:text-red-500"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                  
                  <div className="flex gap-2">
                    <Input
                      value={newInterest}
                      onChange={(e) => setNewInterest(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddInterest()}
                      placeholder="Add interest..."
                      className="bg-zinc-900 border-zinc-800 text-white"
                      maxLength={30}
                    />
                    <Button size="sm" onClick={handleAddInterest} className="bg-orange-500 hover:bg-orange-600">
                      Add
                    </Button>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className={`text-xs ${interestsValue.length >= 10 ? 'text-orange-500' : 'text-zinc-500'}`}>
                      {interestsValue.length}/10 interests
                    </span>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveInterests} className="bg-orange-500 hover:bg-orange-600">
                        Save
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => {
                          setInterestsValue(profile.interests || []);
                          setEditingInterests(false);
                          setNewInterest('');
                        }}
                        className="text-white hover:bg-zinc-800"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {interestsValue.map((interest, index) => (
                    <Badge 
                      key={index} 
                      className="bg-zinc-900 hover:bg-zinc-800 text-white border-zinc-800 rounded-full"
                    >
                      {interest}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="mb-6">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditingInterests(true);
                  setInterestsValue([]);
                }}
                className="text-zinc-400 hover:text-white"
              >
                <Edit3 className="w-4 h-4 mr-2" />
                Add interests
              </Button>
            </div>
          )}

          {/* Badges */}
          {!badgesLoading && userBadges.length > 0 && (
            <div className="mb-6">
              <h3 className="text-white font-semibold mb-3 text-sm">Achievements</h3>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                {userBadges.map((userBadge) => {
                  const IconComponent = (LucideIcons as any)[userBadge.badges.icon] || Award;
                  
                  return (
                    <button
                      key={userBadge.id}
                      onClick={() => setSelectedBadge(userBadge)}
                      className="relative bg-black border border-zinc-800 p-4 rounded-lg flex flex-col items-center gap-2 hover:border-white transition-all group overflow-hidden"
                    >
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
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tabs Section */}
          <Tabs defaultValue="activity" className="mb-6">
            <TabsList className="w-full bg-black border-b border-zinc-800 rounded-none h-auto p-0">
              <TabsTrigger 
                value="activity" 
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:bg-transparent text-zinc-500 data-[state=active]:text-white"
              >
                Activity
              </TabsTrigger>
              <TabsTrigger 
                value="posts" 
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:bg-transparent text-zinc-500 data-[state=active]:text-white"
              >
                Posts
              </TabsTrigger>
              <TabsTrigger 
                value="likes" 
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:bg-transparent text-zinc-500 data-[state=active]:text-white"
              >
                Likes
              </TabsTrigger>
              <TabsTrigger
                value="media"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:bg-transparent text-zinc-500 data-[state=active]:text-white"
              >
                Media
              </TabsTrigger>
              <TabsTrigger
                value="art"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:bg-transparent text-zinc-500 data-[state=active]:text-white"
              >
                LoveArt
              </TabsTrigger>
            </TabsList>

            {/* Activity Tab */}
            <TabsContent value="activity" className="mt-4">
              <Card className="bg-gradient-to-br from-zinc-950 via-black to-zinc-950 border-zinc-800 p-6 mb-6 shadow-xl backdrop-blur-sm">
                <h3 className="text-white font-semibold mb-4 text-sm">Statistics</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-black rounded-lg border border-zinc-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Heart className="w-4 h-4 text-orange-500" />
                      <span className="text-zinc-400 text-xs">Total Likes</span>
                    </div>
                    <p className="text-white text-xl font-bold">{stats.likesCount}</p>
                  </div>

                  <div className="p-4 bg-black rounded-lg border border-zinc-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Flame className="w-4 h-4 text-orange-500" />
                      <span className="text-zinc-400 text-xs">Tokens Burned</span>
                    </div>
                    <p className="text-white text-xl font-bold">
                      {stats.totalBurned >= 1000 
                        ? `${(stats.totalBurned / 1000).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}K`
                        : stats.totalBurned.toLocaleString('en-US')
                      }
                    </p>
                  </div>

                  <div className="p-4 bg-black rounded-lg border border-zinc-800">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-orange-500" />
                      <span className="text-zinc-400 text-xs">Total Swipes</span>
                    </div>
                    <p className="text-white text-xl font-bold">{stats.totalSwipes}</p>
                  </div>

                  <div className="p-4 bg-black rounded-lg border border-zinc-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Trophy className="w-4 h-4 text-orange-500" />
                      <span className="text-zinc-400 text-xs">Matches</span>
                    </div>
                    <p className="text-white text-xl font-bold">{stats.matchesCount}</p>
                  </div>
                </div>

                <h3 className="text-white font-semibold mb-3 text-sm">Recent Activity</h3>
                <div className="space-y-3 mb-4">
                  {recentActivity.length > 0 ? (
                    recentActivity
                      .slice((activityPage - 1) * ACTIVITY_PER_PAGE, activityPage * ACTIVITY_PER_PAGE)
                      .map((activity, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-black rounded-lg border border-zinc-800">
                        {activity.type === 'like' && (
                          <>
                            <Heart className="w-4 h-4 text-orange-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm">
                                Liked <span className="text-orange-500">{activity.data.swiped?.display_name || activity.data.swiped?.username}</span>
                              </p>
                              <p className="text-zinc-500 text-xs">{new Date(activity.timestamp).toLocaleDateString()}</p>
                            </div>
                          </>
                        )}
                        {activity.type === 'pass' && (
                          <>
                            <X className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm">
                                Passed on <span className="text-zinc-400">{activity.data.swiped?.display_name || activity.data.swiped?.username}</span>
                              </p>
                              <p className="text-zinc-500 text-xs">{new Date(activity.timestamp).toLocaleDateString()}</p>
                            </div>
                          </>
                        )}
                        {activity.type === 'match' && (
                          <>
                            <Sparkles className="w-4 h-4 text-orange-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm">
                                Matched with <span className="text-orange-500">{activity.data.otherUser?.display_name || activity.data.otherUser?.username}</span>
                              </p>
                              <p className="text-zinc-500 text-xs">{new Date(activity.timestamp).toLocaleDateString()}</p>
                            </div>
                          </>
                        )}
                        {activity.type === 'tip' && (
                          <>
                            <Flame className="w-4 h-4 text-orange-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm">
                                Sent {activity.data.amount} AVLO to <span className="text-orange-500">{activity.data.receiver?.display_name || activity.data.receiver?.username}</span>
                              </p>
                              <p className="text-zinc-500 text-xs">{new Date(activity.timestamp).toLocaleDateString()}</p>
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-zinc-500">
                      <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No recent activity</p>
                    </div>
                  )}
                </div>
                
                {/* Pagination */}
                {recentActivity.length > ACTIVITY_PER_PAGE && (
                  <div className="flex items-center justify-center gap-2 pt-3 border-t border-zinc-800">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setActivityPage(p => Math.max(1, p - 1))}
                      disabled={activityPage === 1}
                      className="text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-zinc-400 text-sm">
                      Page {activityPage} of {Math.ceil(recentActivity.length / ACTIVITY_PER_PAGE)}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setActivityPage(p => Math.min(Math.ceil(recentActivity.length / ACTIVITY_PER_PAGE), p + 1))}
                      disabled={activityPage >= Math.ceil(recentActivity.length / ACTIVITY_PER_PAGE)}
                      className="text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </Card>
            </TabsContent>

            {/* Posts Tab */}
            <TabsContent value="posts" className="mt-4">
              <div className="flex gap-2 mb-4">
                <Button
                  size="sm"
                  variant={postFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setPostFilter('all')}
                  className={postFilter === 'all' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-zinc-900 hover:bg-zinc-800 text-white border-zinc-800'}
                >
                  All Posts
                </Button>
                <Button
                  size="sm"
                  variant={postFilter === 'media' ? 'default' : 'outline'}
                  onClick={() => setPostFilter('media')}
                  className={postFilter === 'media' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-zinc-900 hover:bg-zinc-800 text-white border-zinc-800'}
                >
                  Media Posts
                </Button>
                <Button
                  size="sm"
                  variant={postFilter === 'text' ? 'default' : 'outline'}
                  onClick={() => setPostFilter('text')}
                  className={postFilter === 'text' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-zinc-900 hover:bg-zinc-800 text-white border-zinc-800'}
                >
                  Text Posts
                </Button>
              </div>

              {filteredPosts.length > 0 ? (
                <>
                  <div className="space-y-4">
                    {filteredPosts.slice((postsPage - 1) * POSTS_PER_PAGE, postsPage * POSTS_PER_PAGE).map((post) => (
                    <Card key={post.id} className="p-4 bg-gradient-to-br from-zinc-950 via-black to-zinc-950 border border-zinc-800 hover:border-orange-500/50 transition-all duration-300 shadow-xl hover:shadow-orange-500/10 backdrop-blur-sm">
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
                      
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-4 text-zinc-400">
                          <span className="flex items-center gap-1">
                            <Heart className="w-4 h-4" />
                            {post.likes_count}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageCircle className="w-4 h-4" />
                            {post.comments_count}
                          </span>
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
                    </Card>
                    ))}
                  </div>
                  
                  {/* Pagination */}
                  {filteredPosts.length > POSTS_PER_PAGE && (
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
                        Page {postsPage} of {Math.ceil(filteredPosts.length / POSTS_PER_PAGE)}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPostsPage(p => Math.min(Math.ceil(filteredPosts.length / POSTS_PER_PAGE), p + 1))}
                        disabled={postsPage >= Math.ceil(filteredPosts.length / POSTS_PER_PAGE)}
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
                  <p>No {postFilter !== 'all' ? postFilter : ''} posts yet</p>
                </div>
              )}
            </TabsContent>

            {/* Likes Tab */}
            <TabsContent value="likes" className="mt-4">
              {likedPosts.length > 0 ? (
                <div className="space-y-4">
                  {likedPosts.map((like) => {
                    const post = like.posts as any;
                    return (
                      <Card key={like.post_id} className="p-4 bg-gradient-to-br from-zinc-950 via-black to-zinc-950 border border-zinc-800 hover:border-orange-500/50 transition-all duration-300 shadow-xl hover:shadow-orange-500/10 backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Avatar className="w-6 h-6">
                              <AvatarImage src={post.user?.avatar_url} />
                              <AvatarFallback className="text-xs">{post.user?.username?.[0]?.toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <span className="text-zinc-400 text-xs">
                              {post.user?.display_name || post.user?.username}
                            </span>
                          </div>
                          
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleUnlike(like.post_id)}
                            className="text-red-500 hover:text-red-600 hover:bg-red-500/10 h-auto p-2"
                          >
                            <Heart className="w-4 h-4 fill-red-500" />
                          </Button>
                        </div>
                        
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
                        
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-4 text-zinc-400">
                            <span className="flex items-center gap-1">
                              <Heart className="w-4 h-4" />
                              {post.likes_count}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="w-4 h-4" />
                              {post.comments_count}
                            </span>
                          </div>
                          <span className="text-zinc-500">
                            {new Date(post.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-zinc-500">
                  <Heart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No liked posts yet</p>
                </div>
              )}
            </TabsContent>

            {/* Media Tab */}
            <TabsContent value="media" className="mt-4">
              {(() => {
                const postMedia = userPosts.filter(post => post.media_url).map(post => ({
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

            {/* Art Tab */}
            <TabsContent value="art" className="mt-4">
              <RecentPixelArtists />
            </TabsContent>
          </Tabs>

          {/* Score Transfer History */}
          <div className="mb-6">
            <ScoreTransferHistory userId={profile.id} compact />
          </div>

          {/* Additional Sections */}
          <Card className="bg-gradient-to-br from-zinc-950 via-black to-zinc-950 border-zinc-800 p-6 mb-6 shadow-xl backdrop-blur-sm">
            <h3 className="text-white font-semibold mb-4 text-sm">Location Settings</h3>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="location" className="text-zinc-400 mb-2 block text-sm">
                  Your Location
                </Label>
                <LocationSearch 
                  onLocationSelect={handleLocationSelect}
                  disabled={isSavingLocation}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label htmlFor="maxDistance" className="text-zinc-400 text-sm">
                    Search Radius: {maxDistance}km
                  </Label>
                </div>
                <Input
                  id="maxDistance"
                  type="range"
                  min="1"
                  max="100"
                  value={maxDistance}
                  onChange={(e) => updateMaxDistance(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </Card>

          {/* Social Links */}
          {((profile as any).instagram_username || (profile as any).twitter_username || (profile as any).linkedin_username || (profile as any).arena_username || editingSocials) && (
            <Card className="bg-gradient-to-br from-zinc-950 via-black to-zinc-950 border-zinc-800 p-6 mb-6 shadow-xl backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold text-sm">Social Links</h3>
                {!editingSocials && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingSocials(true)}
                    className="text-zinc-400 hover:text-white h-auto p-1"
                  >
                    <Edit3 className="w-4 h-4" />
                  </Button>
                )}
              </div>
              
              {editingSocials ? (
                <div className="space-y-3">
                  <div>
                    <Label className="text-zinc-400 text-xs">Instagram</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500">@</span>
                      <Input
                        value={socialValues.instagram}
                        onChange={(e) => setSocialValues({...socialValues, instagram: e.target.value})}
                        placeholder="username"
                        className="bg-zinc-900 border-zinc-800 text-white"
                        maxLength={30}
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-zinc-400 text-xs">Twitter/X</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500">@</span>
                      <Input
                        value={socialValues.twitter}
                        onChange={(e) => setSocialValues({...socialValues, twitter: e.target.value})}
                        placeholder="username"
                        className="bg-zinc-900 border-zinc-800 text-white"
                        maxLength={15}
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-zinc-400 text-xs">LinkedIn</Label>
                    <Input
                      value={socialValues.linkedin}
                      onChange={(e) => setSocialValues({...socialValues, linkedin: e.target.value})}
                      placeholder="linkedin.com/in/username"
                      className="bg-zinc-900 border-zinc-800 text-white"
                      maxLength={100}
                    />
                  </div>

                  <div>
                    <Label className="text-zinc-400 text-xs">Arena</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500">@</span>
                      <Input
                        value={socialValues.arena}
                        onChange={(e) => setSocialValues({...socialValues, arena: e.target.value})}
                        placeholder="username"
                        className="bg-zinc-900 border-zinc-800 text-white"
                        maxLength={30}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button size="sm" onClick={handleSaveSocials} className="bg-orange-500 hover:bg-orange-600">
                      Save
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => {
                        setSocialValues({
                          instagram: (profile as any).instagram_username || '',
                          twitter: (profile as any).twitter_username || '',
                          linkedin: (profile as any).linkedin_username || '',
                          arena: (profile as any).arena_username || ''
                        });
                        setEditingSocials(false);
                      }}
                      className="text-white hover:bg-zinc-800"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {(profile as any).instagram_username && (
                    <a
                      href={`https://instagram.com/${(profile as any).instagram_username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 hover:border-purple-500/40 transition-all"
                    >
                      <svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                      <span className="text-white font-medium">@{(profile as any).instagram_username}</span>
                    </a>
                  )}

                  {(profile as any).twitter_username && (
                    <a
                      href={`https://twitter.com/${(profile as any).twitter_username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 transition-all"
                    >
                      <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                      </svg>
                      <span className="text-white font-medium">@{(profile as any).twitter_username}</span>
                    </a>
                  )}

                  {(profile as any).linkedin_username && (
                    <a
                      href={`https://linkedin.com/in/${(profile as any).linkedin_username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg bg-blue-600/10 border border-blue-600/20 hover:border-blue-600/40 transition-all"
                    >
                      <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                      <span className="text-white font-medium">{(profile as any).linkedin_username}</span>
                    </a>
                  )}

                  {(profile as any).arena_username && (
                    <a
                      href={`https://arena.social/${(profile as any).arena_username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/20 hover:border-orange-500/40 transition-all"
                    >
                      <img src={arenaLogo} alt="Arena" className="w-5 h-5 rounded-sm" />
                      <span className="text-white font-medium">@{(profile as any).arena_username}</span>
                    </a>
                  )}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Badge Info Dialog */}
      <Dialog open={!!selectedBadge} onOpenChange={(open) => !open && setSelectedBadge(null)}>
        <DialogContent className="bg-black border-2 border-orange-500/30 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl">
              {selectedBadge && (() => {
                const IconComponent = (LucideIcons as any)[selectedBadge.badges.icon] || Award;
                const rarityColors = {
                  common: 'from-gray-500 to-gray-600',
                  rare: 'from-blue-500 to-blue-600',
                  epic: 'from-purple-500 to-purple-600',
                  legendary: 'from-yellow-500 to-orange-600',
                };
                const gradient = rarityColors[selectedBadge.badges.rarity as keyof typeof rarityColors] || rarityColors.common;
                
                return (
                  <>
                    <div className={`p-3 rounded-lg bg-gradient-to-br ${gradient} shadow-lg`}>
                      <IconComponent className="w-8 h-8 text-white" />
                    </div>
                    <span>{selectedBadge.badges.name}</span>
                  </>
                );
              })()}
            </DialogTitle>
            <DialogDescription className="text-zinc-400 mt-4 space-y-4">
              {selectedBadge && (
                <>
                  <div>
                    <p className="text-base">{selectedBadge.badges.description}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">Rarity:</span>
                    <span className={`text-sm font-bold capitalize ${
                      selectedBadge.badges.rarity === 'legendary' ? 'text-yellow-500' :
                      selectedBadge.badges.rarity === 'epic' ? 'text-purple-500' :
                      selectedBadge.badges.rarity === 'rare' ? 'text-blue-500' :
                      'text-gray-500'
                    }`}>
                      {selectedBadge.badges.rarity}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">Requirement:</span>
                    <span className="text-sm text-zinc-300">
                      {selectedBadge.badges.requirement_type === 'matches' && `${selectedBadge.badges.requirement_value} matches`}
                      {selectedBadge.badges.requirement_type === 'swipes' && `${selectedBadge.badges.requirement_value} swipes`}
                      {selectedBadge.badges.requirement_type === 'tokens' && `${selectedBadge.badges.requirement_value} tokens`}
                      {selectedBadge.badges.requirement_type === 'days_since_creation' && `Account age: ${selectedBadge.badges.requirement_value} days`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
                    <span className="text-xs text-zinc-500">Earned on:</span>
                    <span className="text-sm text-zinc-300">
                      {new Date(selectedBadge.earned_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;