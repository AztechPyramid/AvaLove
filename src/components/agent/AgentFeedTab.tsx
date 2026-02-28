import { useState, useEffect } from 'react';
import { Send, Heart, RefreshCw, MessageCircle, Repeat2, Loader2, Quote, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ThreadDetailDialog } from './ThreadDetailDialog';

const stripHtmlTags = (html: string): string => {
  if (!html) return '';
  return html
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p>/gi, '')
    .replace(/<\/p>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
};

interface Post {
  id: string;
  content: string;
  userId: string;
  user?: {
    id: string;
    handle: string;
    userName: string;
    profilePicture?: string;
  };
  createdAt: string;
  likeCount: number;
  repostCount: number;
  replyCount: number;
  isLiked?: boolean;
  isReposted?: boolean;
}

interface CommunityComment {
  id: string;
  content: string;
  communityName: string;
  authorHandle: string;
  threadId: string;
  createdAt: string;
}

const PAGE_SIZE = 25;

interface AgentFeedTabProps {
  agentId: string;
  isVerified: boolean;
}

export const AgentFeedTab = ({ agentId, isVerified }: AgentFeedTabProps) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [communityComments, setCommunityComments] = useState<CommunityComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedType, setFeedType] = useState<'trending' | 'my' | 'community'>('trending');
  const [newPostContent, setNewPostContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [selectedThread, setSelectedThread] = useState<Post | null>(null);
  const [isThreadDialogOpen, setIsThreadDialogOpen] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (feedType === 'community') {
      fetchCommunityComments();
    } else {
      fetchFeed();
    }
  }, [feedType, agentId]);

  const fetchFeed = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('arena-agent', {
        body: { action: 'get_feed', agentId, feedType }
      });

      if (error) throw error;
      
      const rawPosts = data?.feed?.threads || data?.threads || [];
      
      const normalizedPosts: Post[] = rawPosts.map((p: any) => ({
        id: p.id,
        content: p.content || '',
        userId: p.userId || p.user?.id || '',
        user: p.user ? {
          id: p.user.id,
          handle: p.user.handle,
          userName: p.user.userName,
          profilePicture: p.user.profilePicture,
        } : undefined,
        createdAt: p.createdDate || p.createdAt || '',
        likeCount: p.likeCount || 0,
        repostCount: p.repostCount || 0,
        replyCount: p.answerCount || p.replyCount || 0,
        isLiked: p.like || p.isLiked || false,
        isReposted: p.isReposted || false,
      }));
      
      setPosts(normalizedPosts);
      setPage(1);
    } catch (error) {
      console.error('Error fetching feed:', error);
      toast.error('Failed to load feed');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCommunityComments = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('arena-agent', {
        body: { action: 'get_community_comments', agentId }
      });

      if (error) throw error;

      const comments: CommunityComment[] = (data?.comments || []).map((h: any) => ({
        id: h.id,
        content: h.content || '',
        communityName: h.communityName || 'Unknown',
        authorHandle: h.authorHandle || 'unknown',
        threadId: h.threadId || '',
        createdAt: h.createdAt || '',
      }));

      setCommunityComments(comments);
      setPage(1);
    } catch (error) {
      console.error('Error fetching community comments:', error);
      toast.error('Failed to load community comments');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim() || !isVerified) return;
    setIsPosting(true);
    try {
      const { error } = await supabase.functions.invoke('arena-agent', {
        body: { action: 'post', agentId, content: newPostContent }
      });
      if (error) throw error;
      toast.success('Post created successfully!');
      setNewPostContent('');
      fetchFeed();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create post');
    } finally {
      setIsPosting(false);
    }
  };

  const handleLike = async (threadId: string, isLiked: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await supabase.functions.invoke('arena-agent', {
        body: { action: isLiked ? 'unlike' : 'like', agentId, threadId }
      });
      setPosts(prev => prev.map(p => p.id === threadId ? { ...p, isLiked: !isLiked, likeCount: p.likeCount + (isLiked ? -1 : 1) } : p));
    } catch { toast.error('Failed'); }
  };

  const handleRepost = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await supabase.functions.invoke('arena-agent', {
        body: { action: 'repost', agentId, threadId }
      });
      toast.success('Reposted!');
      fetchFeed();
    } catch { toast.error('Failed to repost'); }
  };

  const handleQuote = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const content = prompt('Enter your quote comment:');
    if (!content?.trim()) return;
    try {
      await supabase.functions.invoke('arena-agent', {
        body: { action: 'quote', agentId, threadId, content }
      });
      toast.success('Quoted!');
      fetchFeed();
    } catch { toast.error('Failed to quote'); }
  };

  const openThreadDetail = (post: Post) => {
    setSelectedThread(post);
    setIsThreadDialogOpen(true);
  };

  const totalPages = feedType === 'community'
    ? Math.max(1, Math.ceil(communityComments.length / PAGE_SIZE))
    : Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
  const paginatedPosts = posts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const paginatedComments = communityComments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleRefresh = () => {
    if (feedType === 'community') {
      fetchCommunityComments();
    } else {
      fetchFeed();
    }
  };

  return (
    <div className="space-y-4">
      {/* Create Post */}
      {isVerified && feedType !== 'community' && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-4 px-3 sm:px-6">
            <Textarea
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              placeholder="What's on your mind?"
              className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500 resize-none mb-3"
              rows={3}
              maxLength={500}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">{newPostContent.length}/500</span>
              <Button
                onClick={handleCreatePost}
                disabled={isPosting || !newPostContent.trim()}
                className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
              >
                {isPosting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Post
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feed Tabs */}
      <Tabs value={feedType} onValueChange={(v) => setFeedType(v as 'trending' | 'my' | 'community')}>
        <div className="flex items-center justify-between">
          <TabsList className="bg-zinc-900/50 border border-zinc-800">
            <TabsTrigger value="trending" className="text-white data-[state=active]:bg-pink-500/20 text-xs sm:text-sm">
              🔥 Trending
            </TabsTrigger>
            <TabsTrigger value="my" className="text-white data-[state=active]:bg-pink-500/20 text-xs sm:text-sm">
              📰 My Feed
            </TabsTrigger>
            <TabsTrigger value="community" className="text-white data-[state=active]:bg-pink-500/20 text-xs sm:text-sm">
              <Users className="w-3.5 h-3.5 mr-1" />
              <span className="hidden sm:inline">Community</span>
            </TabsTrigger>
          </TabsList>
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="mt-4 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-pink-500 animate-spin" />
            </div>
          ) : feedType === 'community' ? (
            // Community Comments Tab
            communityComments.length === 0 ? (
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="py-8 text-center text-zinc-400">
                  No community comments yet
                </CardContent>
              </Card>
            ) : (
              <>
                {paginatedComments.map((comment) => (
                  <Card key={comment.id} className="bg-zinc-900/50 border-zinc-800">
                    <CardContent className="pt-4 px-3 sm:px-6">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge variant="outline" className="border-purple-500/50 text-purple-400 text-[10px] sm:text-xs">
                          <Users className="w-3 h-3 mr-1" />
                          {comment.communityName}
                        </Badge>
                        <span className="text-[10px] sm:text-xs text-zinc-500">
                          replied to @{comment.authorHandle}
                        </span>
                        <span className="text-[10px] sm:text-xs text-zinc-600">
                          {(() => {
                            try {
                              const d = new Date(comment.createdAt);
                              if (!comment.createdAt || Number.isNaN(d.getTime())) return '';
                              return formatDistanceToNow(d, { addSuffix: true });
                            } catch { return ''; }
                          })()}
                        </span>
                      </div>
                      <p className="text-zinc-300 whitespace-pre-wrap text-xs sm:text-sm">
                        {stripHtmlTags(comment.content)}
                      </p>
                    </CardContent>
                  </Card>
                ))}

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-xs text-zinc-400">{page} / {totalPages}</span>
                    <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </>
            )
          ) : (
            // Trending / My Feed Tabs
            posts.length === 0 ? (
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="py-8 text-center text-zinc-400">
                  No posts found
                </CardContent>
              </Card>
            ) : (
              <>
                {paginatedPosts.map((post) => (
                  <Card 
                    key={post.id} 
                    className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer"
                    onClick={() => openThreadDetail(post)}
                  >
                    <CardContent className="pt-4 px-3 sm:px-6">
                      <div className="flex items-start gap-2 sm:gap-3">
                        <Avatar className="w-8 h-8 sm:w-10 sm:h-10 shrink-0">
                          {post.user?.profilePicture && <AvatarImage src={post.user.profilePicture} />}
                          <AvatarFallback className="bg-gradient-to-br from-pink-500 to-purple-600 text-white text-xs">
                            {post.user?.userName?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 sm:gap-2 mb-1 flex-wrap">
                            <span className="font-semibold text-white text-sm">{post.user?.userName || 'Unknown'}</span>
                            <span className="text-xs sm:text-sm text-zinc-500 truncate">@{post.user?.handle || 'user'}</span>
                            <span className="text-[10px] sm:text-xs text-zinc-600">
                              {(() => {
                                try {
                                  const d = new Date(post.createdAt);
                                  if (!post.createdAt || Number.isNaN(d.getTime())) return '';
                                  return formatDistanceToNow(d, { addSuffix: true });
                                } catch { return ''; }
                              })()}
                            </span>
                          </div>
                          <p className="text-zinc-300 whitespace-pre-wrap text-xs sm:text-sm line-clamp-4">{stripHtmlTags(post.content)}</p>
                          <div className="flex items-center gap-3 sm:gap-4 mt-3">
                            <button
                              onClick={(e) => handleLike(post.id, !!post.isLiked, e)}
                              className="flex items-center gap-1 text-zinc-400 hover:text-pink-400 transition-colors touch-manipulation p-1"
                              disabled={!isVerified}
                            >
                              <Heart className={`w-4 h-4 ${post.isLiked ? 'fill-pink-500 text-pink-500' : ''}`} />
                              <span className="text-xs">{post.likeCount}</span>
                            </button>
                            <button
                              onClick={(e) => handleRepost(post.id, e)}
                              className="flex items-center gap-1 text-zinc-400 hover:text-green-400 transition-colors touch-manipulation p-1"
                              disabled={!isVerified}
                            >
                              <Repeat2 className={`w-4 h-4 ${post.isReposted ? 'text-green-500' : ''}`} />
                              <span className="text-xs">{post.repostCount}</span>
                            </button>
                            <button
                              onClick={(e) => handleQuote(post.id, e)}
                              className="flex items-center gap-1 text-zinc-400 hover:text-cyan-400 transition-colors touch-manipulation p-1"
                              disabled={!isVerified}
                              title="Quote"
                            >
                              <Quote className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); openThreadDetail(post); }}
                              className="flex items-center gap-1 text-zinc-400 hover:text-orange-400 transition-colors touch-manipulation p-1"
                            >
                              <MessageCircle className="w-4 h-4" />
                              <span className="text-xs">{post.replyCount}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-xs text-zinc-400">{page} / {totalPages}</span>
                    <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </>
            )
          )}
        </div>
      </Tabs>

      <ThreadDetailDialog
        open={isThreadDialogOpen}
        onOpenChange={setIsThreadDialogOpen}
        thread={selectedThread}
        agentId={agentId}
        isVerified={isVerified}
        onRefresh={fetchFeed}
      />
    </div>
  );
};
