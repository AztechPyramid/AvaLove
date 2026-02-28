import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { MessageCircle, MapPin, Trash2, Zap, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WalletAddress } from '@/components/WalletAddress';
import { TipDialog } from '@/components/TipDialog';
import { useStakingInfo } from '@/hooks/useStakingInfo';
import avloLogo from '@/assets/avlo-logo.jpg';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useOnlineUsersContext } from '@/contexts/OnlineUsersContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface MatchCardProps {
  match: {
    id: string;
    otherUser: {
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
      bio: string | null;
      location: string | null;
      wallet_address: string | null;
      interests: string[] | null;
      special_badge?: boolean | null;
    };
  };
}

export const MatchCard = ({ match }: MatchCardProps) => {
  const navigate = useNavigate();
  const { profile } = useWalletAuth();
  const { isUserOnline } = useOnlineUsersContext();
  const [isDeleting, setIsDeleting] = useState(false);
  const { totalStaked, pendingRewards, loading: stakingLoading } = useStakingInfo(match.otherUser.id);
  const isOnline = isUserOnline(match.otherUser.id);

  const handleCancelMatch = async () => {
    if (!profile?.id) {
      toast.error('You must be logged in');
      return;
    }
    
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.rpc('cancel_match_and_refund_scores', {
        p_match_id: match.id,
        p_user_id: profile.id
      });
      
      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; message?: string };
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to cancel match');
      }
      
      toast.success('Match cancelled. Score refunded for both users.');
      window.location.reload();
    } catch (error: any) {
      console.error('Error cancelling match:', error);
      toast.error(error?.message || 'Failed to cancel match');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <motion.div
      className="relative group"
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      {/* Outer glow effect on hover */}
      <motion.div
        className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-50 blur-lg transition-opacity duration-300"
      />
      
      {/* Main card */}
      <div className="relative bg-gradient-to-br from-zinc-900 via-black to-zinc-900 rounded-2xl border border-zinc-800/50 overflow-hidden backdrop-blur-xl">
        {/* Tech grid overlay */}
        <div 
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(6, 182, 212, 0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(6, 182, 212, 0.5) 1px, transparent 1px)
            `,
            backgroundSize: '30px 30px',
          }}
        />
        
        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-16 h-16 border-l-2 border-t-2 border-cyan-500/20 rounded-tl-2xl" />
        <div className="absolute bottom-0 right-0 w-16 h-16 border-r-2 border-b-2 border-purple-500/20 rounded-br-2xl" />
        
        {/* Animated top border */}
        <motion.div
          className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent"
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />

        {/* Content */}
        <div 
          className="relative p-5 cursor-pointer"
          onClick={() => navigate(`/chat/${match.id}`)}
        >
          <div className="flex items-start gap-4">
            {/* Avatar with animated border */}
            <div className="relative shrink-0">
              <motion.div
                className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 opacity-60 blur-md"
                animate={{ opacity: [0.4, 0.7, 0.4], rotate: [0, 360] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              />
              <Avatar className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 border-cyan-500/50">
                <AvatarImage src={match.otherUser.avatar_url || ''} className="rounded-xl" />
                <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-500 text-white text-xl sm:text-2xl font-bold rounded-xl">
                  {match.otherUser.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              {/* Online indicator */}
              {isOnline && (
                <motion.div
                  className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-3 border-black flex items-center justify-center"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Zap className="w-3 h-3 text-white" />
                </motion.div>
              )}
            </div>
            
            {/* User info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg sm:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-300 truncate">
                  {match.otherUser.display_name || match.otherUser.username}
                </h3>
                {match.otherUser.special_badge && (
                  <motion.div
                    className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30"
                    animate={{ boxShadow: ['0 0 10px rgba(251, 191, 36, 0.3)', '0 0 20px rgba(251, 191, 36, 0.5)', '0 0 10px rgba(251, 191, 36, 0.3)'] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Sparkles className="w-3 h-3 text-yellow-400" />
                    <span className="text-[10px] font-bold text-yellow-400">ELITE</span>
                  </motion.div>
                )}
              </div>
              
              {/* Status indicator */}
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
                <span className={`text-xs ${isOnline ? 'text-emerald-400' : 'text-zinc-500'}`}>
                  {isOnline ? 'Online now' : 'Offline'}
                </span>
              </div>
              
              {match.otherUser.location && (
                <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-2">
                  <MapPin size={12} className="text-cyan-400" />
                  <span>{match.otherUser.location}</span>
                </div>
              )}
              
              {match.otherUser.wallet_address && (
                <div onClick={(e) => e.stopPropagation()} className="mb-2">
                  <WalletAddress address={match.otherUser.wallet_address} className="text-zinc-500 text-xs" />
                </div>
              )}

              {/* Staking Info with tech style */}
              {!stakingLoading && (totalStaked > 0 || pendingRewards > 0) && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {totalStaked > 0 && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20">
                      <img src={avloLogo} alt="AVLO" className="w-3 h-3 rounded-full" />
                      <span className="text-emerald-400 text-[10px] font-bold">
                        {totalStaked.toLocaleString()} Staked
                      </span>
                    </div>
                  )}
                  {pendingRewards > 0 && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20">
                      <span className="text-yellow-400 text-[10px] font-bold">
                        +{pendingRewards.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {match.otherUser.bio && (
                <p className="text-zinc-500 text-xs line-clamp-2">
                  {match.otherUser.bio}
                </p>
              )}
            </div>
          </div>
          
          {/* Interests tags */}
          {match.otherUser.interests && match.otherUser.interests.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {match.otherUser.interests.slice(0, 3).map((interest, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 bg-zinc-800/50 backdrop-blur-sm rounded-lg text-[10px] text-cyan-300 border border-cyan-500/10"
                >
                  {interest}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="relative px-5 pb-5 flex gap-2" onClick={(e) => e.stopPropagation()}>
          <motion.button
            onClick={() => navigate(`/chat/${match.id}`)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-cyan-500/20"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <MessageCircle size={16} />
            Message
          </motion.button>
          
          {match.otherUser.wallet_address && (
            <TipDialog
              receiverId={match.otherUser.id}
              receiverName={match.otherUser.display_name || match.otherUser.username}
              receiverWallet={match.otherUser.wallet_address}
              context="match"
            />
          )}
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <motion.button
                className="flex items-center justify-center px-3 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl transition-all"
                title="Cancel Match"
                disabled={isDeleting}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Trash2 size={16} />
              </motion.button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-zinc-900 border-zinc-800">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">Cancel Match?</AlertDialogTitle>
                <AlertDialogDescription className="text-zinc-400 space-y-2">
                  <p>This will permanently cancel your match with <strong className="text-white">{match.otherUser.display_name || match.otherUser.username}</strong>.</p>
                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 mt-2">
                    <p className="text-orange-400 text-sm font-medium">⚠️ What happens:</p>
                    <ul className="text-orange-400/80 text-sm list-disc list-inside mt-1 space-y-1">
                      <li>Both users lose 20 score points</li>
                      <li>All chat messages will be deleted</li>
                      <li>You can re-match by swiping again</li>
                    </ul>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-zinc-800 text-white border-zinc-700 hover:bg-zinc-700">
                  Keep Match
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleCancelMatch}
                  disabled={isDeleting}
                  className="bg-destructive hover:bg-destructive/90 text-white"
                >
                  {isDeleting ? 'Cancelling...' : 'Cancel Match & Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </motion.div>
  );
};
