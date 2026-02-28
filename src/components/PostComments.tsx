import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { formatDistanceToNow } from 'date-fns';
import { Trash2, AlertCircle, Coins, Loader2 } from 'lucide-react';
import { useAvloBalance } from '@/hooks/useAvloBalance';
import { getAvatarUrl } from '@/lib/defaultAvatars';
import { useUnifiedCost } from '@/hooks/useUnifiedCost';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  user: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface PostCommentsProps {
  postId: string;
}

export const PostComments = ({ postId }: PostCommentsProps) => {
  const { profile } = useWalletAuth();
  const { balance: creditBalance, loading: creditLoading, refresh: refreshBalance } = useAvloBalance();
  const { baseCost: commentCost } = useUnifiedCost();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  
  const hasEnoughCredits = creditBalance >= commentCost;

  useEffect(() => {
    fetchComments();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`comments-${postId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'post_comments',
          filter: `post_id=eq.${postId}`,
        },
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId]);

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('post_comments')
        .select(`
          *,
          user:user_id(username, display_name, avatar_url)
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments((data as any) || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleSubmitComment = async () => {
    // Prevent double submission with ref (sync check)
    if (isSubmittingRef.current) {
      console.log('[COMMENT] Already submitting, ignoring click');
      return;
    }

    if (!profile?.id) {
      toast.error('Please login to comment');
      return;
    }

    if (!newComment.trim()) {
      toast.error('Comment cannot be empty');
      return;
    }

    // Check credit balance
    if (!hasEnoughCredits) {
      toast.error(`Insufficient credits. You need at least ${commentCost} AVLO credits to comment.`);
      return;
    }

    // Set ref immediately (sync)
    isSubmittingRef.current = true;
    setLoading(true);
    
    try {
      console.log('[COMMENT FLOW] Starting comment submission with credits', { postId, userId: profile.id, timestamp: Date.now() });

      // Record the credit burn first
      const { error: burnError } = await supabase
        .from('token_burns')
        .insert({
          user_id: profile.id,
          amount: commentCost,
          burn_type: 'post_comment',
          tx_hash: null, // No tx hash for credit burns
        });

      if (burnError) {
        console.error('[COMMENT FLOW] Error recording burn:', burnError);
        throw new Error('Failed to record credit burn');
      }

      console.log('[COMMENT FLOW] Inserting comment to database...');
      const { error: commentError } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          user_id: profile.id,
          content: newComment.trim(),
        });

      if (commentError) {
        console.error('[COMMENT FLOW] Error inserting comment:', commentError);
        throw commentError;
      }

      console.log('[COMMENT FLOW] Comment inserted, getting post owner...');

      // Get post data to update cost
      const { data: postData } = await supabase
        .from('posts')
        .select('user_id, cost')
        .eq('id', postId)
        .single();

      // Update post's cost
      if (postData) {
        await supabase
          .from('posts')
          .update({ cost: (postData.cost || 0) + commentCost })
          .eq('id', postId);
      }

      console.log('[COMMENT FLOW] Comment submission complete!');
      setNewComment('');
      toast.success('Comment added!');
      refreshBalance();
      fetchComments();
    } catch (error) {
      console.error('[COMMENT FLOW] Error adding comment:', error);
      toast.error('Failed to add comment');
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('post_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
      toast.success('Comment deleted');
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error('Failed to delete comment');
    }
  };

  return (
    <div className="mt-4 space-y-3 border-t border-zinc-800 pt-4">
      {/* Comment Input */}
      {profile && (
        <div className="flex gap-2">
          <Avatar className="w-8 h-8 flex-shrink-0">
            <AvatarImage src={profile.avatar_url || ''} />
            <AvatarFallback className="bg-zinc-800 text-white text-xs">
              {profile.username[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 text-sm min-h-[60px]"
            />
            {/* Insufficient Credits Warning */}
            {!creditLoading && !hasEnoughCredits && (
              <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                <span className="text-orange-400 text-xs">
                  Need {commentCost} AVLO credits to comment (you have {creditBalance.toLocaleString()})
                </span>
              </div>
            )}
            <Button
              onClick={handleSubmitComment}
              disabled={loading || !newComment.trim() || !hasEnoughCredits}
              size="sm"
              className={`gap-1.5 ${
                hasEnoughCredits 
                  ? 'bg-orange-600 hover:bg-orange-700 text-white' 
                  : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
              }`}
              title={!hasEnoughCredits ? 'Insufficient AVLO credits' : 'Add comment'}
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Coins className="w-3.5 h-3.5" />
              )}
              Comment ({commentCost} Credits)
            </Button>
          </div>
        </div>
      )}

      {/* Comments List */}
      {comments.length > 0 && (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-2">
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarImage src={getAvatarUrl((comment.user as any)?.avatar_url, (comment.user as any)?.username || 'user')} />
                <AvatarFallback className="bg-zinc-800 text-white text-xs">
                  {((comment.user as any)?.username || 'U')[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 bg-zinc-800/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold text-sm">
                      {(comment.user as any)?.display_name || (comment.user as any)?.username}
                    </span>
                    <span className="text-zinc-500 text-xs">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  {profile?.id === comment.user_id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteComment(comment.id)}
                      className="h-6 w-6 p-0 text-zinc-400 hover:text-red-400 hover:bg-zinc-700"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                <p className="text-white text-sm">{comment.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
