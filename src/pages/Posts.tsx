import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Heart, MessageCircle, Repeat, Upload, Film, Image as ImageIcon, FileText, Sparkles, Trash2, Edit3, MoreHorizontal, Smile, Loader2, Search, X, Bold, Italic, Type, Hash, AlertCircle, Gift, TrendingUp, Users, Zap, Wallet, Coins, Flame } from 'lucide-react';
import { useAvloPrice } from '@/hooks/useAvloPrice';
import { useAvloBalance } from '@/hooks/useAvloBalance';
import { useUnifiedCost } from '@/hooks/useUnifiedCost';
import { extractMentions, extractHashtags } from '@/lib/contentParser';
import { PostContent } from '@/components/PostContent';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { useWeb3Auth } from '@/hooks/useWeb3Auth';
import { TOKEN_CONTRACT, DEAD_ADDRESS } from '@/config/wagmi';
import { Contract, BrowserProvider } from 'ethers';
import { formatDistanceToNow } from 'date-fns';
import { TrendingPosts } from '@/components/TrendingPosts';
import { PostBurnActivity } from '@/components/PostBurnActivity';
import { FeatureCardsCarousel } from '@/components/FeatureCardsCarousel';
import { EditPostDialog } from '@/components/EditPostDialog';
import { PostComments } from '@/components/PostComments';
import { GifPicker } from '@/components/GifPicker';
import avloLogo from '@/assets/avlo-logo.jpg';
import { useMilestones } from '@/hooks/useMilestones';
import arenaLogo from '@/assets/arena-logo.png';
import { GenerousBurnerBadge } from '@/components/GenerousBurnerBadge';
import { ArenaVerifiedBadge } from '@/components/ArenaVerifiedBadge';

import { FollowButton } from '@/components/FollowButton';
import { BadgeDisplay } from '@/components/BadgeDisplay';
import { UserBadges } from '@/components/UserBadges';
import { TipDialog } from '@/components/TipDialog';
import { prefetchBadgesForUsers } from '@/hooks/useBadgesCache';
import { getAvatarUrl } from '@/lib/defaultAvatars';
import { AvaxGasPrice } from '@/components/AvaxGasPrice';
import { motion } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { StakingPoolPicker } from '@/components/posts/StakingPoolPicker';
import { StakingPoolCard } from '@/components/posts/StakingPoolCard';
import { ProfilePicker } from '@/components/posts/ProfilePicker';
import { ProfileCard } from '@/components/posts/ProfileCard';

interface SelectedStakingPool {
  id: string;
  title: string;
  stake_token_logo: string | null;
  reward_token_logo: string | null;
}

interface SelectedProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  arena_verified: boolean | null;
  bio: string | null;
}

interface Post {
  id: string;
  content: string;
  media_type: string | null;
  media_url: string | null;
  cost: number;
  likes_count: number;
  comments_count: number;
  created_at: string;
  last_boosted_at: string | null;
  user_id: string;
  is_repost: boolean;
  referenced_post_id: string | null;
  total_tips_received?: number;
  token_id?: string | null;
  staking_pool_id?: string | null;
  shared_profile_id?: string | null;
  staking_pool?: {
    id: string;
    title: string;
    stake_token_logo: string | null;
    reward_token_logo: string | null;
  } | null;
  shared_profile?: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    arena_verified: boolean | null;
  } | null;
  payment_token?: {
    id: string;
    token_symbol: string;
    token_logo_url: string | null;
  } | null;
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    verified: boolean;
    special_badge?: boolean | null;
    arena_verified?: boolean | null;
    arena_username?: string | null;
    wallet_address?: string | null;
  };

  referenced_post?: {
    id: string;
    content: string;
    media_type: string | null;
    media_url: string | null;
    created_at: string;
    user: {
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
      verified: boolean;
      special_badge?: boolean | null;
      arena_verified?: boolean | null;
      arena_username?: string | null;
    };
  };
  isLiked?: boolean;
}

export default function Posts() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useWalletAuth();
  const { walletAddress, isConnected } = useWeb3Auth();
  const { checkFirstPost } = useMilestones();
  const { balance: creditBalance, loading: creditLoading, refresh: refreshBalance } = useAvloBalance();
  const { formatAvloWithUsd } = useAvloPrice();
  const hasEnoughCredits = (cost: number) => creditBalance >= cost;
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [newPost, setNewPost] = useState('');
  const [selectedMediaType, setSelectedMediaType] = useState<'text' | 'image' | 'video' | 'gif'>('text');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [showCommentsForPost, setShowCommentsForPost] = useState<string | null>(null);
  const [deletePostId, setDeletePostId] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [repostingIds, setRepostingIds] = useState<Set<string>>(new Set());
  const [selectedStakingPool, setSelectedStakingPool] = useState<SelectedStakingPool | null>(null);
  const [showStakingPoolPicker, setShowStakingPoolPicker] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<SelectedProfile | null>(null);
  const [showProfilePicker, setShowProfilePicker] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [textareaRef, setTextareaRef] = useState<HTMLTextAreaElement | null>(null);
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);
  const [searchUsers, setSearchUsers] = useState<any[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [activeTab, setActiveTab] = useState<'community' | 'following'>('community');
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const postRefs = useRef<Record<string, HTMLElement | null>>({});
  const highlightedPostId = searchParams.get('post');
  const shouldOpenComments = searchParams.get('comments') === 'true';

  // Superadmin ID to hide from posts
  const SUPERADMIN_ID = 'c37676ba-5108-4447-ad13-119cec785bda';

  // Fetch following IDs for the current user
  useEffect(() => {
    const fetchFollowingIds = async () => {
      if (!profile?.id) {
        setFollowingIds([]);
        return;
      }
      
      const { data, error } = await supabase
        .from('followers')
        .select('following_id')
        .eq('follower_id', profile.id);
      
      if (!error && data) {
        setFollowingIds(data.map(f => f.following_id));
      }
    };
    
    fetchFollowingIds();
  }, [profile?.id]);
  // Search users when search query changes
  useEffect(() => {
    const searchForUsers = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchUsers([]);
        setShowUserDropdown(false);
        return;
      }

      setSearchingUsers(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, arena_verified, arena_username, special_badge')
          .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%,arena_username.ilike.%${searchQuery}%`)
          .limit(5);

        if (!error && data) {
          setSearchUsers(data);
          setShowUserDropdown(data.length > 0);
        }
      } catch (err) {
        console.error('Error searching users:', err);
      } finally {
        setSearchingUsers(false);
      }
    };

    const debounce = setTimeout(searchForUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  useEffect(() => {
    setPage(0);
    setHasMore(true);
    fetchPosts(0, false);

    // No realtime subscription - posts are refreshed only when the current user creates a post
    // This prevents other users' actions from refreshing the page for everyone
  }, []);

  const fetchPosts = async (pageNum: number = 0, append: boolean = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const POSTS_PER_PAGE = 25;
      const from = pageNum * POSTS_PER_PAGE;
      const to = from + POSTS_PER_PAGE - 1;

      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          user:profiles!posts_user_id_fkey(
            id,
            username,
            display_name,
            avatar_url,
            verified,
            special_badge,
            arena_verified,
            arena_username,
            wallet_address
          ),
          payment_token:dao_tokens!posts_token_id_fkey(
            id,
            token_symbol,
            token_logo_url
          ),
          staking_pool:staking_pools!posts_staking_pool_id_fkey(
            id,
            title,
            stake_token_logo,
            reward_token_logo
          ),
          shared_profile:profiles!posts_shared_profile_id_fkey(
            id,
            username,
            display_name,
            avatar_url,
            arena_verified
          )
        `)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      // Only keep posts from profiles that have a connected wallet
      const postsData = (data || []).filter((post: any) => !!post.user?.wallet_address);

      // OPTIMIZED: Fetch all referenced posts in a single query instead of N+1 queries
      const repostIds = postsData
        .filter((post: any) => post.is_repost && post.referenced_post_id)
        .map((post: any) => post.referenced_post_id);

      let referencedPostsMap: Record<string, any> = {};
      
      if (repostIds.length > 0) {
        const { data: refPosts } = await supabase
          .from('posts')
          .select(`
            id,
            content,
            media_type,
            media_url,
            created_at,
            user:profiles!posts_user_id_fkey(
              id,
              username,
              display_name,
              avatar_url,
              verified,
              special_badge,
              arena_verified,
              arena_username,
              wallet_address
            )
          `)
          .in('id', repostIds);

        // Create a map for quick lookup
        referencedPostsMap = (refPosts || []).reduce((acc: Record<string, any>, post: any) => {
          acc[post.id] = post;
          return acc;
        }, {});
      }

      // Attach referenced posts using the map (O(1) lookup instead of O(n) queries)
      const postsWithRefs = postsData.map((post: any) => {
        if (post.is_repost && post.referenced_post_id) {
          return { ...post, referenced_post: referencedPostsMap[post.referenced_post_id] || null };
        }
        return post;
      });

      // Check if there are more posts
      const hasMorePosts = postsData.length === 25;
      setHasMore(hasMorePosts);

      // Fetch tips received for each post's user
      const userIds = [...new Set(postsWithRefs.map((p: any) => p.user_id))];
      
      // Prefetch badges for all users in parallel (non-blocking for UI)
      prefetchBadgesForUsers(userIds as string[]);
      
      const { data: tipsData } = await supabase
        .from('tips')
        .select('receiver_id, amount')
        .in('receiver_id', userIds);
      
      const tipsByUser = (tipsData || []).reduce((acc: Record<string, number>, tip) => {
        acc[tip.receiver_id] = (acc[tip.receiver_id] || 0) + (tip.amount || 0);
        return acc;
      }, {});

      const postsWithTips = postsWithRefs.map((post: any) => ({
        ...post,
        total_tips_received: tipsByUser[post.user_id] || 0,
      }));

      // Posts are already sorted by created_at descending from the query - newest first

      if (profile?.id) {
        const { data: likes } = await supabase
          .from('post_likes')
          .select('post_id')
          .eq('user_id', profile.id);

        const likedPostIds = new Set(likes?.map((l) => l.post_id) || []);
        const postsWithLikes = postsWithTips.map((post: any) => ({
          ...post,
          isLiked: likedPostIds.has(post.id),
        }));

        if (append) {
          setPosts(prev => [...prev, ...postsWithLikes]);
        } else {
          setPosts(postsWithLikes);
        }
      } else {
        if (append) {
          setPosts(prev => [...prev, ...postsWithTips]);
        } else {
          setPosts(postsWithTips);
        }
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast.error('Failed to load posts');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Scroll to highlighted post when posts are loaded and URL has post param
  useEffect(() => {
    if (!loading && highlightedPostId && posts.length > 0) {
      const postElement = postRefs.current[highlightedPostId];
      if (postElement) {
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add highlight animation
          postElement.classList.add('ring-2', 'ring-orange-500', 'ring-opacity-75');
          // If comments should be opened
          if (shouldOpenComments) {
            setShowCommentsForPost(highlightedPostId);
          }
          // Remove highlight after animation
          setTimeout(() => {
            postElement.classList.remove('ring-2', 'ring-orange-500', 'ring-opacity-75');
            // Clear URL params
            setSearchParams({});
          }, 3000);
        }, 100);
      }
    }
  }, [loading, highlightedPostId, posts, shouldOpenComments, setSearchParams]);

  const loadMorePosts = () => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchPosts(nextPage, true);
    }
  };


  // Use unified cost from rewardPerSecond * 10
  const { getCostForMediaType, repostCost, loading: costLoading } = useUnifiedCost();

  // Credit-based posting - no on-chain transaction needed

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size must be 2MB or less');
      return;
    }

    // Check file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'];
    if (!validTypes.includes(file.type)) {
      toast.error('Unsupported file format');
      return;
    }

    setMediaFile(file);
    if (file.type.startsWith('image')) {
      setSelectedMediaType('image');
    } else if (file.type.startsWith('video')) {
      setSelectedMediaType('video');
    }
    setGifUrl(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    // Reset input value to allow selecting the same file again
    e.target.value = '';
    
    if (!file) return;

    // Video upload
    if (file.type.startsWith('video')) {
      // Max 20MB video boyutu
      if (file.size > 20 * 1024 * 1024) {
        toast.error('Video size must be 20MB or less');
        return;
      }
      
      setSelectedMediaType('video');
    } else if (file.type.startsWith('image')) {
      // Image için 2MB limit
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Image size must be 2MB or less');
        return;
      }
      setSelectedMediaType('image');
    } else {
      toast.error('Unsupported file type');
      return;
    }

    setMediaFile(file);
    setGifUrl(null);
  };

  const handleGifSelected = (url: string) => {
    setGifUrl(url);
    setSelectedMediaType('gif');
    setMediaFile(null);
    setShowGifPicker(false);
  };

  const insertEmoji = (emoji: string) => {
    if (!textareaRef) return;
    
    const start = textareaRef.selectionStart;
    const end = textareaRef.selectionEnd;
    const text = newPost;
    const newText = text.substring(0, start) + emoji + text.substring(end);
    
    setNewPost(newText);
    setShowEmojiPicker(false);
    
    // Focus textarea and set cursor position after emoji
    setTimeout(() => {
      textareaRef?.focus();
      textareaRef?.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  const wrapSelectedText = (prefix: string, suffix: string = prefix) => {
    if (!textareaRef) return;
    
    const start = textareaRef.selectionStart;
    const end = textareaRef.selectionEnd;
    const text = newPost;
    const selectedText = text.substring(start, end);
    
    if (selectedText) {
      const newText = text.substring(0, start) + prefix + selectedText + suffix + text.substring(end);
      setNewPost(newText);
      
      setTimeout(() => {
        textareaRef?.focus();
        textareaRef?.setSelectionRange(start + prefix.length, end + prefix.length);
      }, 0);
    } else {
      // No text selected, just insert the formatting markers
      const newText = text.substring(0, start) + prefix + suffix + text.substring(end);
      setNewPost(newText);
      
      setTimeout(() => {
        textareaRef?.focus();
        textareaRef?.setSelectionRange(start + prefix.length, start + prefix.length);
      }, 0);
    }
  };

  const commonEmojis = ['😀', '😂', '❤️', '🔥', '👍', '🎉', '💯', '✨', '🚀', '💪', '😍', '🤔', '👀', '🙌', '💰', '🎯', '⚡', '🌟', '💎', '🎊'];


  const handleCreatePost = async () => {
    if (!profile?.id || !walletAddress) {
      toast.error('Please connect your wallet first');
      return;
    }

    // Prevent double submission
    if (isPosting) {
      return;
    }

    if (!newPost.trim() && !mediaFile && !gifUrl) {
      toast.error('Please enter some content or select media');
      return;
    }

    // Note: selectedToken = null means AVLO burn (default option)
    // Only check balance, no need to require token selection

    if (mediaFile && selectedMediaType === 'video') {
      const maxSize = 2 * 1024 * 1024;
      if (mediaFile.size > maxSize) {
        toast.error('Video size must be 2MB or less');
        return;
      }
    }

    // Check credit balance
    const postCost = getCostForMediaType(gifUrl ? 'gif' : (mediaFile ? selectedMediaType : 'text'));
    
    if (!hasEnoughCredits(postCost)) {
      toast.error(`Insufficient credits. You need at least ${postCost.toLocaleString()} AVLO credits to create this post.`);
      return;
    }

    setIsPosting(true);
    
    try {
      // 1) Upload media (if exists)
      let mediaUrl = null;

      if (gifUrl) {
        mediaUrl = gifUrl;
      } else if (mediaFile) {
        const fileExt = mediaFile.name.split('.').pop();
        const fileName = `${profile.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('chat-media')
          .upload(fileName, mediaFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('chat-media')
          .getPublicUrl(fileName);

        mediaUrl = publicUrl;
      }

      // 2) Create post via backend with credit system
      const { data, error } = await supabase.functions.invoke('create-post', {
        body: {
          walletAddress,
          content: newPost.trim(),
          mediaUrl,
          mediaType: gifUrl ? 'gif' : (mediaFile ? selectedMediaType : 'text'),
          useCredits: true,
          stakingPoolId: selectedStakingPool?.id || null,
          sharedProfileId: selectedProfile?.id || null,
        }
      });

      if (error) throw error;

      if (!data.success) {
        toast.error(data.error || 'Failed to create post');
        return;
      }

      // Send notifications to mentioned users
      const mentions = extractMentions(newPost.trim());
      if (mentions.length > 0) {
        const { data: mentionedUsers } = await supabase
          .from('profiles')
          .select('id, username')
          .in('username', mentions);
        
        if (mentionedUsers && mentionedUsers.length > 0) {
          const notifications = mentionedUsers.map(user => ({
            user_id: user.id,
            type: 'mention',
            title: 'New Mention',
            message: `@${profile.username} mentioned you in a post`,
            data: {
              post_id: data.post?.id || 'new_post',
              mentioned_by: profile.id,
              content_preview: newPost.trim().slice(0, 100)
            }
          }));

          await supabase.from('notifications').insert(notifications);
        }
      }

      toast.success('Post created successfully!');

      // Reset form
      setNewPost('');
      setMediaFile(null);
      setGifUrl(null);
      setSelectedMediaType('text');
      setSelectedStakingPool(null);
      setSelectedProfile(null);
      
      // Fetch posts and check milestones in background, refresh credits
      setPage(0);
      setHasMore(true);
      fetchPosts(0, false);
      checkFirstPost();
      refreshBalance();
      console.log('[POST FLOW] Post flow completed!', { timestamp: Date.now() });
    } catch (error) {
      console.error('[POST FLOW] Error occurred:', error);
      toast.error(error instanceof Error ? error.message : "Failed to create post. Please try again.");
    } finally {
      setIsPosting(false);
    }
  };

  const handleLike = async (postId: string, isLiked: boolean) => {
    if (!profile?.id) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      // Find the post to get owner info
      const post = posts.find(p => p.id === postId);
      
      if (isLiked) {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', profile.id);
      } else {
        await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: profile.id });
        
        // Notification is created automatically by database trigger
      }

      setPosts(posts.map(post => 
        post.id === postId 
          ? { 
              ...post, 
              isLiked: !isLiked,
              likes_count: isLiked ? post.likes_count - 1 : post.likes_count + 1
            }
          : post
      ));
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('Failed to like post');
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      toast.success('Post deleted successfully');
      setPosts(posts.filter(p => p.id !== postId));
      setDeletePostId(null);
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error('Failed to delete post');
    }
  };

  const handleRepost = async (originalPost: Post) => {
    if (!profile?.id) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!isConnected || !walletAddress) {
      toast.error('Please connect your wallet to repost');
      return;
    }

    // Prevent double repost attempts
    if (repostingIds.has(originalPost.id)) {
      return;
    }

    // Use unified repost cost (same as all costs - rewardPerSecond * 10)

    // Check credit balance
    if (!hasEnoughCredits(repostCost)) {
      toast.error(`Insufficient credits. You need at least ${repostCost} AVLO credits to repost.`);
      return;
    }

    setRepostingIds(prev => new Set(prev).add(originalPost.id));
    
    try {
      // Record the credit burn first
      const { error: burnError } = await supabase
        .from('token_burns')
        .insert({
          user_id: profile.id,
          amount: repostCost,
          burn_type: 'post_repost',
          tx_hash: null,  // No tx hash for credit burns
        });

      if (burnError) {
        console.error('Error recording repost burn:', burnError);
        throw new Error('Failed to record credit burn');
      }

      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: profile.id,
          content: originalPost.content,
          media_type: null,
          media_url: null,
          cost: repostCost,
          is_repost: true,
          referenced_post_id: originalPost.id,
        });

      if (error) throw error;

      // Update referenced post's cost
      await supabase
        .from('posts')
        .update({ cost: (originalPost.cost || 0) + repostCost })
        .eq('id', originalPost.id);

      toast.success('Reposted successfully!');
      
      // Fetch posts in background and refresh credits
      setPage(0);
      setHasMore(true);
      fetchPosts(0, false);
      refreshBalance();
    } catch (error) {
      console.error('Error reposting:', error);
      toast.error('Failed to create repost. Please try again.');
    } finally {
      setRepostingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(originalPost.id);
        return newSet;
      });
    }
  };

  const toggleComments = (postId: string) => {
    setShowCommentsForPost(showCommentsForPost === postId ? null : postId);
  };



  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-950/30 via-black to-pink-950/20"></div>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 flex flex-col items-center gap-4"
        >
          <div className="w-16 h-16 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></div>
          <p className="text-white/80 text-lg font-medium">Loading Community...</p>
        </motion.div>
      </div>
    );
  }

  // Filter posts based on search query, hashtag, tab, and hide superadmin
  const filteredPosts = posts.filter(post => {
    // Hide superadmin posts
    if (post.user_id === SUPERADMIN_ID) return false;
    
    // Tab filter - following tab only shows posts from users you follow
    if (activeTab === 'following' && !followingIds.includes(post.user_id)) return false;
    
    // Hashtag filter
    if (activeHashtag) {
      const hashtags = extractHashtags(post.content);
      if (!hashtags.includes(activeHashtag)) return false;
    }
    
    // Search filter
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    const matchesUsername = post.user.username.toLowerCase().includes(query);
    const matchesDisplayName = post.user.display_name?.toLowerCase().includes(query);
    const matchesContent = post.content.toLowerCase().includes(query);
    
    return matchesUsername || matchesDisplayName || matchesContent;
  });

  const handleHashtagClick = (hashtag: string) => {
    setActiveHashtag(hashtag);
    setSearchQuery('');
    toast.success(`Filtering posts by #${hashtag}`);
  };

  const clearHashtagFilter = () => {
    setActiveHashtag(null);
  };

  // Stats for header
  const uniqueUsers = new Set(posts.map(p => p.user_id)).size;

  return (
    <div 
      className="min-h-screen bg-black overflow-x-hidden relative"
    >
      {/* Simple Background */}
      <div className="fixed inset-0 pointer-events-none bg-black"></div>
      
      <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-12 gap-0 overflow-x-hidden relative z-10">
        {/* Mobile Header Stats - Minimal */}
        <div className="xl:hidden w-full border-b border-zinc-800/50 py-3 px-4 overflow-hidden">
          {/* Minimal Stats Row */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-4 text-xs mb-3"
          >
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-pink-400" />
              <span className="text-zinc-400">{uniqueUsers}</span>
              <span className="text-zinc-600">creators</span>
            </div>
            <div className="w-px h-3 bg-zinc-700" />
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-zinc-400">{posts.length}</span>
              <span className="text-zinc-600">posts</span>
            </div>
          </motion.div>
          
          {/* Trending Posts - Keep full */}
          <TrendingPosts />
          
        </div>
        
        {/* Post Burn Activity - Moved outside, minimal inline */}
        <div className="xl:hidden">
          <PostBurnActivity />
        </div>

        {/* Main Feed */}
        <main className="xl:col-span-9 border-x border-zinc-800/50 min-h-screen overflow-x-hidden backdrop-blur-sm">
          {/* Sticky Header with Glass Effect */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="sticky top-0 z-10 bg-black/80 backdrop-blur-xl border-b border-zinc-800/50 p-3 sm:p-4"
          >
            {/* Tab Navigation */}
            <div className="flex items-center gap-1 mb-3 border-b border-zinc-800/50 -mx-3 sm:-mx-4 px-3 sm:px-4">
              <button
                onClick={() => setActiveTab('community')}
                className={`relative px-4 py-3 text-sm font-semibold transition-all duration-300 ${
                  activeTab === 'community'
                    ? 'text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Community
                </span>
                {activeTab === 'community' && (
                  <motion.div 
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-pink-500 rounded-t-full" 
                  />
                )}
              </button>
              <button
                onClick={() => setActiveTab('following')}
                className={`relative px-4 py-3 text-sm font-semibold transition-all duration-300 ${
                  activeTab === 'following'
                    ? 'text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Heart className="w-4 h-4" />
                  Following
                </span>
                {activeTab === 'following' && (
                  <motion.div 
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-pink-500 rounded-t-full" 
                  />
                )}
              </button>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 mb-3">
              <div className="flex items-center justify-between sm:justify-start gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <h1 className="text-white text-lg sm:text-xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                    {activeTab === 'community' ? 'Community Feed' : 'Following'}
                  </h1>
                </div>
                <AvaxGasPrice showBalance />
              </div>
              
              {/* Search Bar with Glass Effect */}
              <div className="relative w-full sm:flex-1 sm:max-w-xs group">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-pink-500/20 rounded-lg blur-sm opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 z-10" />
                <Input
                  type="text"
                  placeholder="Search users or posts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => searchUsers.length > 0 && setShowUserDropdown(true)}
                  onBlur={() => setTimeout(() => setShowUserDropdown(false), 200)}
                  className="pl-9 pr-9 bg-zinc-900/80 border-zinc-700/50 text-white placeholder:text-zinc-500 focus:border-orange-500/50 focus:ring-orange-500/20 text-sm relative"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setShowUserDropdown(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors z-10"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                
                {/* User Search Dropdown */}
                {showUserDropdown && searchUsers.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-full left-0 right-0 mt-1 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-xl shadow-2xl overflow-hidden z-50"
                  >
                    <div className="px-3 py-2 border-b border-zinc-800/50">
                      <span className="text-xs text-zinc-500 font-medium">Users</span>
                    </div>
                    {searchUsers.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => {
                          navigate(`/profile/${user.id}`);
                          setShowUserDropdown(false);
                          setSearchQuery('');
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800/50 transition-colors text-left"
                      >
                        <Avatar className="w-8 h-8 ring-2 ring-zinc-700/50">
                          {(() => {
                            const avatarSrc = getAvatarUrl(user.avatar_url, user.username || user.id);
                            const isVideo = avatarSrc.match(/\.(mp4|webm)$/i);
                            
                            if (isVideo) {
                              return (
                                <video
                                  src={avatarSrc}
                                  autoPlay
                                  loop
                                  muted
                                  playsInline
                                  className="w-full h-full object-cover rounded-full"
                                />
                              );
                            }
                            return <AvatarImage src={avatarSrc} />;
                          })()}
                          <AvatarFallback className="bg-zinc-800 text-white text-xs">
                            {user.username?.[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-white font-medium text-sm truncate">
                              {user.display_name || user.username}
                            </span>
                            {user.arena_verified && (
                              <img src={arenaLogo} alt="Arena" className="w-3.5 h-3.5 rounded-sm" />
                            )}
                          </div>
                          <span className="text-zinc-500 text-xs">@{user.username}</span>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
                
                {/* Loading indicator */}
                {searchingUsers && searchQuery.length >= 2 && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-full left-0 right-0 mt-1 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-xl shadow-xl p-3 z-50"
                  >
                    <div className="flex items-center gap-2 text-zinc-400 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Searching users...</span>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Active Hashtag Filter */}
            {activeHashtag && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-full px-3 py-1.5 w-fit"
              >
                <Hash className="w-4 h-4 text-blue-400" />
                <span className="text-blue-400 font-medium text-sm">#{activeHashtag}</span>
                <button
                  onClick={clearHashtagFilter}
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </motion.div>

          {/* Create Post with Glass Effect */}
          {profile && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="border-b border-zinc-800/50 p-3 sm:p-4 pb-6 relative overflow-hidden"
            >
              {/* Subtle gradient background */}
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-pink-500/5 pointer-events-none"></div>
              
              {/* AVLO Credit Balance Display with Max Posts */}
              <div className="flex items-center justify-end gap-2 mb-3 relative flex-wrap">
                <div className="flex items-center gap-2 bg-zinc-800/50 backdrop-blur-sm rounded-full px-3 py-1.5 border border-zinc-700/50">
                  <img src={avloLogo} alt="AVLO" className="w-4 h-4 rounded-full" />
                  <span className="text-sm font-medium text-white">
                    {creditLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      `${creditBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })} Credits`
                    )}
                  </span>
                </div>
                {!creditLoading && creditBalance > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <span>≈</span>
                    <span className="text-orange-400 font-medium">{Math.floor(creditBalance / 1000)}</span>
                    <span>posts</span>
                    <span className="text-zinc-600">|</span>
                    <span className="text-pink-400 font-medium">{Math.floor(creditBalance / 100000)}</span>
                    <span>videos</span>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2 sm:gap-3 relative">
                <Avatar className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 ring-2 ring-orange-500/30">
                  {(() => {
                    const avatarSrc = getAvatarUrl(profile.avatar_url, profile.username || profile.id);
                    const isVideo = avatarSrc.match(/\.(mp4|webm)$/i);
                    
                    if (isVideo) {
                      return (
                        <video
                          src={avatarSrc}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="w-full h-full object-cover rounded-full"
                        />
                      );
                    }
                    return <AvatarImage src={avatarSrc} />;
                  })()}
                  <AvatarFallback className="bg-zinc-800 text-white">
                    {profile.username[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 space-y-3">
                  <Textarea
                    id="community-new-post"
                    ref={(el) => setTextareaRef(el)}
                    value={newPost}
                    onChange={(e) => setNewPost(e.target.value)}
                    placeholder="What's happening?"
                    className="bg-transparent border-0 text-white text-xl placeholder:text-zinc-500 resize-none focus-visible:ring-0 p-0 min-h-[80px] max-h-[300px] overflow-y-auto"
                  />

                  {/* Media Preview with Glass Effect */}
                  {mediaFile && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="relative rounded-xl overflow-hidden border border-zinc-700/50 bg-zinc-900/50 backdrop-blur-sm"
                    >
                      {selectedMediaType === 'image' ? (
                        <img 
                          src={URL.createObjectURL(mediaFile)} 
                          alt="Preview" 
                          className="w-full max-h-64 object-contain"
                        />
                      ) : (
                        <video 
                          src={URL.createObjectURL(mediaFile)} 
                          className="w-full max-h-64 object-contain"
                          controls
                        />
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm"
                        onClick={() => {
                          setMediaFile(null);
                          setSelectedMediaType('text');
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </motion.div>
                  )}

                  {/* GIF Preview */}
                  {gifUrl && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="relative rounded-xl overflow-hidden border border-zinc-700/50 bg-zinc-900/50 backdrop-blur-sm"
                    >
                      <img 
                        src={gifUrl} 
                        alt="GIF Preview" 
                        className="w-full max-h-64 object-contain"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm"
                        onClick={() => {
                          setGifUrl(null);
                          setSelectedMediaType('text');
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </motion.div>
                  )}

                  {/* Selected Staking Pool Preview */}
                  {selectedStakingPool && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="relative rounded-xl overflow-hidden border border-orange-500/30 bg-gradient-to-r from-orange-500/10 to-pink-500/10 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0">
                          <img src={selectedStakingPool.stake_token_logo || '/placeholder.svg'} alt="Stake" className="w-10 h-10 rounded-full border-2 border-orange-500/50" />
                          <img src={selectedStakingPool.reward_token_logo || '/placeholder.svg'} alt="Reward" className="w-6 h-6 rounded-full border-2 border-zinc-900 absolute -bottom-1 -right-1" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-orange-400" />
                            <span className="text-xs text-orange-400 font-medium">Staking Pool</span>
                          </div>
                          <span className="text-white font-bold">{selectedStakingPool.title}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm h-6 w-6 p-0"
                        onClick={() => setSelectedStakingPool(null)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </motion.div>
                  )}

                  {/* Selected Profile Preview */}
                  {selectedProfile && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="relative rounded-xl overflow-hidden border border-pink-500/30 bg-gradient-to-r from-pink-500/10 to-purple-500/10 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10 flex-shrink-0 ring-2 ring-pink-500/50">
                          {(() => {
                            const avatarSrc = getAvatarUrl(selectedProfile.avatar_url, selectedProfile.username);
                            const isVideo = avatarSrc.match(/\.(mp4|webm)$/i);
                            
                            if (isVideo) {
                              return (
                                <video
                                  src={avatarSrc}
                                  autoPlay
                                  loop
                                  muted
                                  playsInline
                                  className="w-full h-full object-cover rounded-full"
                                />
                              );
                            }
                            return <AvatarImage src={avatarSrc} />;
                          })()}
                          <AvatarFallback className="bg-zinc-700 text-white">
                            {selectedProfile.username[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-pink-400" />
                            <span className="text-xs text-pink-400 font-medium">User Profile</span>
                          </div>
                          <span className="text-white font-bold">{selectedProfile.display_name || selectedProfile.username}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm h-6 w-6 p-0"
                        onClick={() => setSelectedProfile(null)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </motion.div>
                  )}

                  {/* Drag & Drop Area - Modern */}
                  {!mediaFile && !gifUrl && isDragging && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className="border-2 border-dashed border-orange-500/50 bg-gradient-to-br from-orange-500/10 to-pink-500/10 rounded-xl p-4 text-center transition-all backdrop-blur-sm"
                    >
                      <Upload className="w-6 h-6 mx-auto mb-1 text-orange-400" />
                      <p className="text-sm text-orange-400">Drop your media here</p>
                    </motion.div>
                  )}

                  {/* Modern Toolbar */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-zinc-800/50">
                    <div className="flex items-center gap-1 flex-wrap">
                      {/* Text Formatting */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => wrapSelectedText('**')}
                        className="text-zinc-400 hover:text-white hover:bg-zinc-800/50 h-8 w-8 sm:h-9 sm:w-9 p-0"
                        title="Bold"
                      >
                        <Bold className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => wrapSelectedText('_')}
                        className="text-zinc-400 hover:text-white hover:bg-zinc-800/50 h-8 w-8 sm:h-9 sm:w-9 p-0"
                        title="Italic"
                      >
                        <Italic className="w-4 h-4" />
                      </Button>
                      
                      <div className="w-px h-5 sm:h-6 bg-zinc-800 mx-0.5 sm:mx-1" />

                      {/* Media Buttons */}
                      <input
                        type="file"
                        accept="image/*,video/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="media-upload"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => document.getElementById('media-upload')?.click()}
                        className="text-zinc-400 hover:text-white hover:bg-zinc-800/50 h-8 w-8 sm:h-9 sm:w-9 p-0"
                        title="Add Image (1K $AVLO)"
                        onDragOver={handleDragOver}
                      >
                        <ImageIcon className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => document.getElementById('media-upload')?.click()}
                        className="text-zinc-400 hover:text-white hover:bg-zinc-800/50 h-8 w-8 sm:h-9 sm:w-9 p-0"
                        title="Add Video (100K $AVLO)"
                      >
                        <Film className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowGifPicker(true)}
                        className="text-zinc-400 hover:text-white hover:bg-zinc-800/50 h-8 w-8 sm:h-9 sm:w-9 p-0"
                        title="Add GIF (3K $AVLO)"
                      >
                        <Sparkles className="w-4 h-4" />
                      </Button>
                      
                      {/* Staking Pool Picker */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowStakingPoolPicker(true)}
                        className={`h-8 w-8 sm:h-9 sm:w-9 p-0 ${selectedStakingPool ? 'text-orange-400 bg-orange-500/10' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'}`}
                        title="Share Staking Pool"
                      >
                        <TrendingUp className="w-4 h-4" />
                      </Button>

                      {/* Profile Picker */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowProfilePicker(true)}
                        className={`h-8 w-8 sm:h-9 sm:w-9 p-0 ${selectedProfile ? 'text-pink-400 bg-pink-500/10' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'}`}
                        title="Share User Profile"
                      >
                        <Users className="w-4 h-4" />
                      </Button>

                      <div className="w-px h-5 sm:h-6 bg-zinc-800 mx-0.5 sm:mx-1" />

                      {/* Emoji Picker */}
                      <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-zinc-400 hover:text-white hover:bg-zinc-800/50 h-8 w-8 sm:h-9 sm:w-9 p-0"
                            title="Add Emoji"
                          >
                            <Smile className="w-4 h-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-2 bg-zinc-900 border-zinc-800">
                          <div className="grid grid-cols-5 gap-1">
                            {commonEmojis.map((emoji, idx) => (
                              <button
                                key={idx}
                                onClick={() => insertEmoji(emoji)}
                                className="text-2xl hover:bg-zinc-800 rounded p-1 transition-colors"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Post Button & Cost */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between sm:justify-end gap-2 sm:gap-3">
                      {/* Insufficient Balance Warning */}
                      {!creditLoading && !hasEnoughCredits(getCostForMediaType(gifUrl ? 'gif' : (mediaFile ? selectedMediaType : 'text'))) && (
                        <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 rounded-lg px-3 py-2">
                          <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                          <span className="text-orange-400 text-xs">
                            Need {getCostForMediaType(gifUrl ? 'gif' : (mediaFile ? selectedMediaType : 'text')).toLocaleString()} credits (you have {creditBalance.toLocaleString()})
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
                        <span className="text-xs sm:text-sm text-zinc-500 font-medium">
                          🔥 {getCostForMediaType(gifUrl ? 'gif' : (mediaFile ? selectedMediaType : 'text')).toLocaleString()} Credits
                          <span className="text-zinc-600 ml-1">
                            ({formatAvloWithUsd(getCostForMediaType(gifUrl ? 'gif' : (mediaFile ? selectedMediaType : 'text'))).usd})
                          </span>
                        </span>
                        <Button
                          onClick={handleCreatePost}
                          disabled={isPosting || (!newPost.trim() && !mediaFile && !gifUrl) || !hasEnoughCredits(getCostForMediaType(gifUrl ? 'gif' : (mediaFile ? selectedMediaType : 'text')))}
                          className={`font-bold rounded-full px-4 sm:px-6 text-sm shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                            hasEnoughCredits(getCostForMediaType(gifUrl ? 'gif' : (mediaFile ? selectedMediaType : 'text')))
                              ? 'bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white shadow-orange-500/20'
                              : 'bg-zinc-700 text-zinc-400'
                          }`}
                          title={!hasEnoughCredits(getCostForMediaType(gifUrl ? 'gif' : (mediaFile ? selectedMediaType : 'text'))) ? 'Insufficient credits' : 'Create post'}
                        >
                          {isPosting ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Posting...</span>
                            </div>
                          ) : (
                            'Post'
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {showGifPicker && (
                    <div className="mt-3">
                      <GifPicker
                        onGifSelected={handleGifSelected}
                        onClose={() => setShowGifPicker(false)}
                      />
                    </div>
                  )}
                  
                  {/* Staking Pool Picker Dialog */}
                  <StakingPoolPicker
                    isOpen={showStakingPoolPicker}
                    onClose={() => setShowStakingPoolPicker(false)}
                    onSelect={(pool) => setSelectedStakingPool(pool)}
                  />

                  {/* Profile Picker Dialog */}
                  <ProfilePicker
                    isOpen={showProfilePicker}
                    onClose={() => setShowProfilePicker(false)}
                    onSelect={(profile) => setSelectedProfile(profile)}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* Posts List */}
          <div>
            {filteredPosts.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-12 text-center"
              >
                {activeHashtag ? (
                  <div className="flex flex-col items-center">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mb-4">
                      <Hash className="w-10 h-10 text-blue-400" />
                    </div>
                    <p className="text-zinc-400 text-lg">No posts found with <span className="text-blue-400 font-semibold">#{activeHashtag}</span></p>
                    <Button
                      onClick={clearHashtagFilter}
                      variant="ghost"
                      className="mt-4 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                    >
                      Clear hashtag filter
                    </Button>
                  </div>
                ) : searchQuery ? (
                  <div className="flex flex-col items-center">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500/20 to-pink-500/20 flex items-center justify-center mb-4">
                      <Search className="w-10 h-10 text-orange-400" />
                    </div>
                    <p className="text-zinc-400 text-lg">No posts found matching "<span className="text-orange-400 font-semibold">{searchQuery}</span>"</p>
                    <Button
                      onClick={() => setSearchQuery('')}
                      variant="ghost"
                      className="mt-4 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                    >
                      Clear search
                    </Button>
                  </div>
                ) : activeTab === 'following' ? (
                  <div className="flex flex-col items-center">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-500/20 to-red-500/20 flex items-center justify-center mb-4">
                      <Heart className="w-10 h-10 text-pink-400" />
                    </div>
                    <p className="text-zinc-400 text-lg">No posts from people you follow yet</p>
                    <p className="text-zinc-500 text-sm mt-2">Follow some users to see their posts here!</p>
                    <Button
                      onClick={() => setActiveTab('community')}
                      className="mt-4 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white"
                    >
                      Browse Community Feed
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500/20 to-yellow-500/20 flex items-center justify-center mb-4 animate-pulse">
                      <Zap className="w-10 h-10 text-orange-400" />
                    </div>
                    <p className="text-zinc-400 text-lg">No posts yet. Be the first to share!</p>
                  </div>
                )}
              </motion.div>
            ) : (
              filteredPosts.map((post, index) => (
                <motion.article 
                  key={post.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.02, 0.3) }}
                  ref={(el) => { postRefs.current[post.id] = el; }}
                  className={`border-b border-zinc-800/50 p-3 sm:p-4 hover:bg-gradient-to-r hover:from-zinc-900/50 hover:to-transparent transition-all duration-300 relative group ${
                    highlightedPostId === post.id ? 'bg-orange-500/10 ring-1 ring-orange-500/30' : ''
                  }`}
                >
                  <div className="flex gap-2 sm:gap-3">
                    <Avatar className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 cursor-pointer ring-2 ring-zinc-700/50 hover:ring-orange-500/50 transition-all" onClick={() => navigate(`/profile/${post.user.id}`)}>
                      {(() => {
                        const avatarSrc = getAvatarUrl(post.user.avatar_url, post.user.username || post.user.id);
                        const isVideo = avatarSrc.match(/\.(mp4|webm)$/i);
                        
                        if (isVideo) {
                          return (
                            <video
                              src={avatarSrc}
                              autoPlay
                              loop
                              muted
                              playsInline
                              className="w-full h-full object-cover rounded-full"
                            />
                          );
                        }
                        return <AvatarImage src={avatarSrc} />;
                      })()}
                      <AvatarFallback className="bg-zinc-800 text-white">
                        {post.user.username[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span 
                            className="font-bold text-white hover:underline cursor-pointer" 
                            onClick={() => navigate(`/profile/${post.user.id}`)}
                          >
                            {post.user.display_name || post.user.username}
                          </span>
                          {post.user.verified && (
                            <svg className="w-4 h-4 text-orange-500" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M8.52 3.59l2.44-1.41c.69-.4 1.55-.4 2.24 0l2.44 1.41c.31.18.67.28 1.04.28h2.84c.79 0 1.43.64 1.43 1.43v2.84c0 .37.1.73.28 1.04l1.41 2.44c.4.69.4 1.55 0 2.24l-1.41 2.44c-.18.31-.28.67-.28 1.04v2.84c0 .79-.64 1.43-1.43 1.43h-2.84c-.37 0-.73.1-1.04.28l-2.44 1.41c-.69.4-1.55.4-2.24 0l-2.44-1.41c-.31-.18-.67-.28-1.04-.28H4.43C3.64 20.57 3 19.93 3 19.14v-2.84c0-.37-.1-.73-.28-1.04l-1.41-2.44c-.4-.69-.4-1.55 0-2.24l1.41-2.44c.18-.31.28-.67.28-1.04V4.43C3 3.64 3.64 3 4.43 3h2.84c.37 0 .73-.1 1.04-.28zM10 14.17L7.83 12l-1.41 1.41L10 17l6-6-1.41-1.41L10 14.17z"/>
                            </svg>
                          )}
                          {(post.user as any).arena_verified && (post.user as any).arena_username && (
                            <div className="flex items-center gap-1 bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/30 px-1.5 py-0.5 rounded-full" title={`Arena: @${(post.user as any).arena_username}`}>
                              <img src={arenaLogo} alt="Arena" className="w-3.5 h-3.5 rounded-sm" />
                              <span className="text-orange-400 text-xs font-semibold">@{(post.user as any).arena_username}</span>
                            </div>
                          )}
                          <GenerousBurnerBadge userId={post.user.id} size="sm" />
                          <UserBadges userId={post.user.id} size="sm" maxBadges={3} showNames={false} />
                          <span className="text-zinc-500 text-sm">
                            @{post.user.username}
                          </span>
                          <span className="text-zinc-500 text-sm">·</span>
                          <span className="text-zinc-500 text-sm">
                            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                          </span>
                        </div>

                        {/* Follow Button & Post Actions Menu */}
                        <div className="flex items-center gap-2">
                          {/* Follow button for other users' posts */}
                          {profile?.id && profile.id !== post.user_id && (
                            <FollowButton userId={post.user_id} currentUserId={profile.id} />
                          )}
                          
                          {/* Post Actions Menu - only for own posts */}
                          {profile?.id === post.user_id && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-zinc-400 hover:text-white hover:bg-zinc-800">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                                <DropdownMenuItem 
                                  onClick={() => setEditingPost(post)}
                                  className="text-white hover:bg-zinc-800 cursor-pointer"
                                >
                                  <Edit3 className="w-4 h-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => setDeletePostId(post.id)}
                                  className="text-red-400 hover:bg-zinc-800 cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>

                      {post.is_repost && post.referenced_post && (
                        <div className="text-zinc-500 text-sm flex items-center gap-1 mb-2">
                          <Repeat className="w-3 h-3" />
                          <span>Reposted</span>
                        </div>
                      )}

                      <div className="text-white text-[15px] leading-normal mt-1">
                        <PostContent 
                          content={post.content}
                          onHashtagClick={handleHashtagClick}
                        />
                      </div>

                      {post.is_repost && post.referenced_post && (
                        <div className="mt-3 border border-zinc-700 rounded-xl p-3 bg-zinc-900/50">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="text-zinc-400 text-sm font-semibold">
                              @{post.referenced_post.user.username}
                            </span>
                            {post.referenced_post.user.verified && (
                              <svg className="w-3.5 h-3.5 text-orange-500" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8.52 3.59l2.44-1.41c.69-.4 1.55-.4 2.24 0l2.44 1.41c.31.18.67.28 1.04.28h2.84c.79 0 1.43.64 1.43 1.43v2.84c0 .37.1.73.28 1.04l1.41 2.44c.4.69.4 1.55 0 2.24l-1.41 2.44c-.18.31-.28.67-.28 1.04v2.84c0 .79-.64 1.43-1.43 1.43h-2.84c-.37 0-.73.1-1.04.28l-2.44 1.41c-.69.4-1.55.4-2.24 0l-2.44-1.41c-.31-.18-.67-.28-1.04-.28H4.43C3.64 20.57 3 19.93 3 19.14v-2.84c0-.37-.1-.73-.28-1.04l-1.41-2.44c-.4-.69-.4-1.55 0-2.24l1.41-2.44c.18-.31.28-.67.28-1.04V4.43C3 3.64 3.64 3 4.43 3h2.84c.37 0 .73-.1 1.04-.28zM10 14.17L7.83 12l-1.41 1.41L10 17l6-6-1.41-1.41L10 14.17z"/>
                              </svg>
                            )}
                            {(post.referenced_post.user as any).arena_verified && (post.referenced_post.user as any).arena_username && (
                              <div className="flex items-center gap-1 bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/30 px-1 py-0.5 rounded-full">
                                <img src={arenaLogo} alt="Arena" className="w-3 h-3 rounded-sm" />
                                <span className="text-orange-400 text-[10px] font-semibold">@{(post.referenced_post.user as any).arena_username}</span>
                              </div>
                            )}
                            <GenerousBurnerBadge userId={post.referenced_post.user.id} size="sm" />
                            <span className="text-zinc-600 text-xs">
                              {formatDistanceToNow(new Date(post.referenced_post.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          <div className="text-zinc-300 text-sm">
                            <PostContent 
                              content={post.referenced_post.content}
                              onHashtagClick={handleHashtagClick}
                            />
                          </div>
                          {post.referenced_post.media_url && (
                            <div className="rounded-lg overflow-hidden mt-2 border border-zinc-800">
                              {post.referenced_post.media_type === 'image' || post.referenced_post.media_type === 'gif' ? (
                                <img src={post.referenced_post.media_url} alt="Referenced media" className="w-full max-h-[300px] object-cover" />
                              ) : post.referenced_post.media_type === 'video' ? (
                                <video src={post.referenced_post.media_url} controls className="w-full max-h-[300px]" />
                              ) : null}
                            </div>
                          )}
                        </div>
                      )}

                      {!post.is_repost && post.media_url && (
                        <div className="rounded-2xl overflow-hidden mt-3 border border-zinc-800">
                          {post.media_type === 'image' || post.media_type === 'gif' ? (
                            <img src={post.media_url} alt="Post media" className="w-full max-h-[500px] object-cover" />
                          ) : post.media_type === 'video' ? (
                            <video src={post.media_url} controls className="w-full max-h-[500px]" />
                          ) : null}
                        </div>
                      )}

                      {/* Staking Pool Card */}
                      {post.staking_pool && (
                        <StakingPoolCard pool={post.staking_pool} />
                      )}

                      {/* Shared Profile Card */}
                      {post.shared_profile && (
                        <ProfileCard profile={post.shared_profile} />
                      )}

                      <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-3">
                        <button
                          onClick={() => handleLike(post.id, post.isLiked || false)}
                          className="flex items-center gap-1 sm:gap-2 group"
                        >
                          <div className={`rounded-full p-1.5 sm:p-2 transition-colors ${post.isLiked ? 'text-orange-500' : 'text-zinc-500 hover:text-orange-500 hover:bg-orange-500/10'}`}>
                            <Heart className={`w-4 h-4 sm:w-5 sm:h-5 ${post.isLiked ? 'fill-current' : ''}`} />
                          </div>
                          <span className={`text-xs sm:text-sm ${post.isLiked ? 'text-orange-500' : 'text-zinc-500 group-hover:text-orange-500'}`}>
                            {post.likes_count}
                          </span>
                        </button>

                        <button 
                          onClick={() => toggleComments(post.id)}
                          className="flex items-center group"
                        >
                          <div className="flex items-center gap-1 sm:gap-1.5 border border-white/20 rounded-full px-2 py-1 sm:px-2.5 sm:py-1.5 hover:border-blue-500/50 transition-colors">
                            <MessageCircle className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${showCommentsForPost === post.id ? 'text-blue-500' : 'text-zinc-400 group-hover:text-blue-500'}`} />
                            <span className={`text-[10px] sm:text-xs font-medium ${showCommentsForPost === post.id ? 'text-blue-500' : 'text-zinc-400 group-hover:text-blue-500'}`}>
                              {post.comments_count}
                            </span>
                            <span className="text-[9px] sm:text-[10px] font-semibold text-zinc-400 group-hover:text-blue-500 hidden xs:inline">
                              25
                            </span>
                          </div>
                        </button>

                        {!post.is_repost && (
                          <button 
                            onClick={() => handleRepost(post)}
                            disabled={repostingIds.has(post.id)}
                            className="flex items-center group disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <div className="flex items-center gap-1 sm:gap-1.5 border border-white/20 rounded-full px-2 py-1 sm:px-2.5 sm:py-1.5 hover:border-green-500/50 transition-colors">
                              {repostingIds.has(post.id) ? (
                                <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-green-500" />
                              ) : (
                                <Repeat className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-400 group-hover:text-green-500" />
                              )}
                              <span className="text-[9px] sm:text-[10px] font-semibold text-zinc-400 group-hover:text-green-500">
                                {repostingIds.has(post.id) ? '...' : '50'}
                              </span>
                            </div>
                          </button>
                        )}


                        {/* Tip Button */}
                        {profile?.id && profile.id !== post.user_id && post.user.wallet_address && (
                          <TipDialog
                            receiverId={post.user_id}
                            receiverName={post.user.display_name || post.user.username}
                            receiverWallet={post.user.wallet_address}
                            receiverAvatar={post.user.avatar_url || undefined}
                            context="match"
                            variant="discover"
                          />
                        )}

                        {/* Tips Received Badge */}
                        {(post.total_tips_received || 0) > 0 && (
                          <div className="flex items-center gap-1 sm:gap-1.5 bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/30 rounded-full px-2 py-1 sm:px-2.5 sm:py-1.5">
                            <Gift className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-400" />
                            <span className="text-[9px] sm:text-[10px] font-semibold text-orange-400">
                              {(post.total_tips_received || 0).toLocaleString('en-US')}
                            </span>
                          </div>
                        )}

                      </div>

                      {/* Comments Section */}
                      {showCommentsForPost === post.id && (
                        <PostComments postId={post.id} />
                      )}
                    </div>
                  </div>
                </motion.article>
              ))
            )}

            {/* Load More Button with Modern Style */}
            {!loading && hasMore && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-center py-8"
              >
                <Button
                  onClick={loadMorePosts}
                  disabled={loadingMore}
                  className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white px-8 py-3 rounded-full font-semibold shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Load More Posts
                    </>
                  )}
                </Button>
              </motion.div>
            )}

            {/* No More Posts Message */}
            {!loading && !hasMore && posts.length > 0 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-center py-8"
              >
                <div className="flex items-center gap-2 text-zinc-500 text-sm">
                  <Sparkles className="w-4 h-4" />
                  <span>You've seen all posts</span>
                </div>
              </motion.div>
            )}
          </div>
        </main>

        {/* Right Sidebar - Desktop Only with Glass Effect */}
        <aside className="hidden xl:block xl:col-span-3 sticky top-16 h-fit p-4">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800/50 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-5 h-5 text-orange-400" />
                <h3 className="text-white font-semibold">Trending</h3>
              </div>
              <TrendingPosts />
            </div>
            <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800/50 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Flame className="w-5 h-5 text-orange-400" />
                <h3 className="text-white font-semibold">Burn Activity</h3>
              </div>
              <PostBurnActivity />
            </div>
          </motion.div>
        </aside>
      </div>

      {/* Delete Confirmation Dialog with Modern Style */}
      <AlertDialog open={!!deletePostId} onOpenChange={(open) => !open && setDeletePostId(null)}>
        <AlertDialogContent className="bg-zinc-900/95 backdrop-blur-xl border-zinc-800/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Post?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This action cannot be undone. This will permanently delete your post.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800/80 border-zinc-700/50 text-white hover:bg-zinc-700/80">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deletePostId && handleDeletePost(deletePostId)}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white border-0"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      {editingPost && (
        <EditPostDialog
          open={!!editingPost}
          onOpenChange={(open) => !open && setEditingPost(null)}
          postId={editingPost.id}
          currentContent={editingPost.content}
          onSuccess={() => {
            setPage(0);
            setHasMore(true);
            fetchPosts(0, false);
          }}
        />
      )}
    </div>
  );
}
