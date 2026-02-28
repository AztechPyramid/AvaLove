import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { TrendingUp, Flame, Sparkles, X } from 'lucide-react';
import { FollowButton } from '@/components/FollowButton';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { motion, AnimatePresence } from 'framer-motion';

interface TrendingPostDialogProps {
  post: {
    id: string;
    content: string;
    score: number;
    cost: number;
    user_id: string;
    media_url: string | null;
    media_type: string | null;
    user: {
      id: string;
      username: string;
      avatar_url: string | null;
      verified: boolean | null;
    };
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TrendingPostDialog = ({ post, open, onOpenChange }: TrendingPostDialogProps) => {
  const { profile } = useWalletAuth();

  if (!post) return null;

  const isVideo = post.user.avatar_url && /\.(mp4|webm|ogg|mov)$/i.test(post.user.avatar_url);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden bg-black border-0 p-0">
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative overflow-hidden"
            >
              {/* Tech Background */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div 
                  className="absolute inset-0 opacity-20"
                  style={{
                    backgroundImage: `
                      linear-gradient(rgba(6, 182, 212, 0.3) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(6, 182, 212, 0.3) 1px, transparent 1px)
                    `,
                    backgroundSize: '30px 30px',
                  }}
                />
                
                {/* Animated gradient orbs */}
                <motion.div
                  className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-[80px]"
                  animate={{
                    background: [
                      "radial-gradient(circle, rgba(6, 182, 212, 0.4), transparent 70%)",
                      "radial-gradient(circle, rgba(168, 85, 247, 0.4), transparent 70%)",
                      "radial-gradient(circle, rgba(6, 182, 212, 0.4), transparent 70%)",
                    ],
                  }}
                  transition={{ duration: 4, repeat: Infinity }}
                />
                <motion.div
                  className="absolute -bottom-20 -left-20 w-40 h-40 rounded-full blur-[80px]"
                  animate={{
                    background: [
                      "radial-gradient(circle, rgba(236, 72, 153, 0.3), transparent 70%)",
                      "radial-gradient(circle, rgba(6, 182, 212, 0.3), transparent 70%)",
                      "radial-gradient(circle, rgba(236, 72, 153, 0.3), transparent 70%)",
                    ],
                  }}
                  transition={{ duration: 5, repeat: Infinity }}
                />

                {/* Floating particles */}
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-1 h-1 bg-cyan-500/60 rounded-full"
                    style={{
                      left: `${10 + i * 12}%`,
                      top: `${20 + (i % 3) * 25}%`,
                    }}
                    animate={{
                      y: [0, -20, 0],
                      opacity: [0.3, 0.8, 0.3],
                      scale: [1, 1.5, 1],
                    }}
                    transition={{
                      duration: 2 + Math.random() * 2,
                      repeat: Infinity,
                      delay: Math.random() * 2,
                    }}
                  />
                ))}
              </div>

              {/* Close button */}
              <button
                onClick={() => onOpenChange(false)}
                className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-zinc-800/80 backdrop-blur-sm flex items-center justify-center hover:bg-zinc-700 transition-colors border border-zinc-600/50"
              >
                <X className="w-4 h-4 text-zinc-300" />
              </button>

              {/* Content */}
              <div className="relative z-10 p-6 overflow-y-auto max-h-[85vh]">
                {/* Header with user info */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <motion.div
                      className="relative"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", delay: 0.1 }}
                    >
                      {isVideo ? (
                        <video
                          src={post.user.avatar_url}
                          className="w-14 h-14 rounded-2xl object-cover border-2 border-cyan-500/50 shadow-lg shadow-cyan-500/20"
                          autoPlay
                          loop
                          muted
                          playsInline
                        />
                      ) : (
                        <Avatar className="w-14 h-14 rounded-2xl border-2 border-cyan-500/50 shadow-lg shadow-cyan-500/20">
                          <AvatarImage src={post.user.avatar_url || ''} className="object-cover" />
                          <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-500 text-white text-lg rounded-2xl">
                            {post.user.username.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      
                      {/* Status indicator */}
                      <motion.div
                        className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-black"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    </motion.div>
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold text-lg">{post.user.username}</span>
                        {post.user.verified && (
                          <span className="text-cyan-400">✓</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Sparkles className="w-3 h-3 text-purple-400" />
                        <span className="text-xs text-zinc-400">Trending Creator</span>
                      </div>
                    </div>
                  </div>
                  
                  {profile?.id && post.user_id !== profile.id && (
                    <FollowButton userId={post.user_id} currentUserId={profile.id} size="sm" />
                  )}
                </div>

                {/* Media Content */}
                {post.media_url && (
                  <motion.div
                    className="rounded-xl overflow-hidden mb-6 border border-zinc-800/50 shadow-2xl"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    {post.media_type?.startsWith('image') || post.media_type === 'gif' ? (
                      <img 
                        src={post.media_url} 
                        alt="Post content" 
                        className="w-full max-h-[400px] object-contain bg-zinc-900"
                      />
                    ) : post.media_type?.startsWith('video') ? (
                      <video 
                        src={post.media_url} 
                        className="w-full max-h-[400px] object-contain bg-zinc-900"
                        controls
                        autoPlay
                      />
                    ) : null}
                  </motion.div>
                )}

                {/* Text Content */}
                <motion.div
                  className="relative mb-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <div className="absolute -left-3 top-0 bottom-0 w-1 bg-gradient-to-b from-cyan-500 via-purple-500 to-pink-500 rounded-full" />
                  <p className="text-zinc-100 text-lg leading-relaxed whitespace-pre-wrap pl-4">
                    {post.content}
                  </p>
                </motion.div>

                {/* Stats Cards */}
                <motion.div
                  className="grid grid-cols-2 gap-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 p-4">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/10 rounded-full blur-2xl" />
                    <div className="relative flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
                        <Flame className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-orange-400">{post.cost.toLocaleString()}</p>
                        <p className="text-xs text-zinc-400">AVLO Credit Burned</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 p-4">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/10 rounded-full blur-2xl" />
                    <div className="relative flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/30">
                        <TrendingUp className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-400">{post.score}</p>
                        <p className="text-xs text-zinc-400">Engagement</p>
                      </div>
                    </div>
                  </div>
                </motion.div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};
