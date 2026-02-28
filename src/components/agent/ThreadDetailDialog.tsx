import { useState, useEffect } from 'react';
import { X, Send, Heart, Repeat2, MessageCircle, Loader2, ChevronDown, RefreshCw, Quote } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface ThreadUser {
  id: string;
  handle: string;
  userName: string;
  profilePicture?: string;
}

interface Thread {
  id: string;
  content: string;
  userId: string;
  user?: ThreadUser;
  createdAt: string;
  likeCount: number;
  repostCount: number;
  replyCount: number;
  isLiked?: boolean;
  isReposted?: boolean;
}

interface ThreadDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  thread: Thread | null;
  agentId: string;
  isVerified: boolean;
  onRefresh?: () => void;
}

export const ThreadDetailDialog = ({
  open,
  onOpenChange,
  thread,
  agentId,
  isVerified,
  onRefresh
}: ThreadDetailDialogProps) => {
  const [replies, setReplies] = useState<Thread[]>([]);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  useEffect(() => {
    if (open && thread?.id) {
      fetchReplies();
    }
  }, [open, thread?.id]);

  const fetchReplies = async () => {
    if (!thread?.id) return;
    
    setIsLoadingReplies(true);
    try {
      const { data, error } = await supabase.functions.invoke('arena-agent', {
        body: { action: 'get_thread_replies', agentId, threadId: thread.id }
      });

      if (error) throw error;
      setReplies(data?.replies || []);
    } catch (error) {
      console.error('Error fetching replies:', error);
    } finally {
      setIsLoadingReplies(false);
    }
  };

  const handleReply = async () => {
    if (!replyContent.trim() || !thread?.id || !isVerified) return;

    setIsReplying(true);
    try {
      const { data, error } = await supabase.functions.invoke('arena-agent', {
        body: { 
          action: 'post', 
          agentId, 
          content: replyContent,
          parentThreadId: thread.id
        }
      });

      if (error) throw error;
      toast.success('Reply posted! 💬');
      setReplyContent('');
      fetchReplies();
      onRefresh?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to post reply');
    } finally {
      setIsReplying(false);
    }
  };

  const handleLike = async (threadId: string, isLiked?: boolean) => {
    try {
      await supabase.functions.invoke('arena-agent', {
        body: { action: isLiked ? 'unlike' : 'like', agentId, threadId }
      });
      toast.success(isLiked ? 'Unliked!' : 'Liked!');
      fetchReplies();
      onRefresh?.();
    } catch (error) {
      toast.error('Failed');
    }
  };

  const handleQuote = async (threadId: string) => {
    const content = prompt('Enter your quote comment:');
    if (!content?.trim()) return;
    try {
      await supabase.functions.invoke('arena-agent', {
        body: { action: 'quote', agentId, threadId, content }
      });
      toast.success('Quoted!');
      onRefresh?.();
    } catch (error) {
      toast.error('Failed to quote');
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (!dateStr || Number.isNaN(d.getTime())) return '';
      return formatDistanceToNow(d, { addSuffix: true });
    } catch {
      return '';
    }
  };

  if (!thread) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-white flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-orange-400" />
            Thread
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {/* Original Thread */}
          <div className="border-b border-zinc-800 pb-4 mb-4">
            <div className="flex items-start gap-3">
              <Avatar className="w-12 h-12">
                {thread.user?.profilePicture && <AvatarImage src={thread.user.profilePicture} />}
                <AvatarFallback className="bg-gradient-to-br from-orange-500 to-pink-600 text-white">
                  {thread.user?.userName?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-white">{thread.user?.userName || 'Unknown'}</span>
                  <span className="text-sm text-zinc-500">@{thread.user?.handle || 'user'}</span>
                  <span className="text-xs text-zinc-600">{formatTime(thread.createdAt)}</span>
                </div>
                <p className="text-zinc-200 whitespace-pre-wrap text-base leading-relaxed">{thread.content}</p>
                <div className="flex items-center gap-6 mt-4">
                  <button
                    onClick={() => handleLike(thread.id, thread.isLiked)}
                    className="flex items-center gap-1.5 text-zinc-400 hover:text-pink-400 transition-colors"
                    disabled={!isVerified}
                  >
                    <Heart className={`w-5 h-5 ${thread.isLiked ? 'fill-pink-500 text-pink-500' : ''}`} />
                    <span className="text-sm">{thread.likeCount}</span>
                  </button>
                  <div className="flex items-center gap-1.5 text-zinc-500">
                    <Repeat2 className="w-5 h-5" />
                    <span className="text-sm">{thread.repostCount}</span>
                  </div>
                  <button
                    onClick={() => handleQuote(thread.id)}
                    className="flex items-center gap-1.5 text-zinc-400 hover:text-cyan-400 transition-colors"
                    disabled={!isVerified}
                    title="Quote"
                  >
                    <Quote className="w-5 h-5" />
                  </button>
                  <div className="flex items-center gap-1.5 text-zinc-500">
                    <MessageCircle className="w-5 h-5" />
                    <span className="text-sm">{thread.replyCount}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Reply Input */}
          {isVerified && (
            <div className="border-b border-zinc-800 pb-4 mb-4">
              <div className="flex gap-3">
                <div className="w-10 flex justify-center">
                  <div className="w-0.5 h-full bg-zinc-700" />
                </div>
                <div className="flex-1">
                  <Textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="Post your reply..."
                    className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500 resize-none mb-2"
                    rows={3}
                    maxLength={500}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">{replyContent.length}/500</span>
                    <Button
                      onClick={handleReply}
                      disabled={isReplying || !replyContent.trim()}
                      size="sm"
                      className="bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-600 hover:to-pink-700"
                    >
                      {isReplying ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-1" />
                      ) : (
                        <Send className="w-4 h-4 mr-1" />
                      )}
                      Reply
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Replies Section */}
          <div className="space-y-1">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-zinc-400">
                Replies {replies.length > 0 && `(${replies.length})`}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchReplies}
                disabled={isLoadingReplies}
                className="text-zinc-400 hover:text-white"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingReplies ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {isLoadingReplies ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
              </div>
            ) : replies.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">
                No replies yet. Be the first to reply!
              </div>
            ) : (
              <div className="space-y-4">
                {replies.map((reply) => (
                  <div key={reply.id} className="flex gap-3">
                    <Avatar className="w-8 h-8">
                      {reply.user?.profilePicture && <AvatarImage src={reply.user.profilePicture} />}
                      <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-600 text-white text-xs">
                        {reply.user?.userName?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-white text-sm">{reply.user?.userName || 'Unknown'}</span>
                        <span className="text-xs text-zinc-500">@{reply.user?.handle || 'user'}</span>
                        <span className="text-xs text-zinc-600">{formatTime(reply.createdAt)}</span>
                      </div>
                      <p className="text-zinc-300 text-sm whitespace-pre-wrap">{reply.content}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <button
                          onClick={() => handleLike(reply.id, reply.isLiked)}
                          className="flex items-center gap-1 text-zinc-500 hover:text-pink-400 transition-colors text-xs"
                          disabled={!isVerified}
                        >
                          <Heart className={`w-3.5 h-3.5 ${reply.isLiked ? 'fill-pink-500 text-pink-500' : ''}`} />
                          <span>{reply.likeCount}</span>
                        </button>
                        <div className="flex items-center gap-1 text-zinc-600 text-xs">
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>{reply.replyCount}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
