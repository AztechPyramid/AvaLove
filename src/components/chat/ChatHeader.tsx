import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Video, MoreVertical, Shield, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useOnlineUsersContext } from '@/contexts/OnlineUsersContext';

interface OtherUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  special_badge: boolean | null;
}

interface ChatHeaderProps {
  otherUser: OtherUser | null;
  keyFingerprint: string;
  isEncryptionInitialized: boolean;
  isOtherUserTyping: boolean;
}

export const ChatHeader = ({ 
  otherUser, 
  keyFingerprint, 
  isEncryptionInitialized,
  isOtherUserTyping 
}: ChatHeaderProps) => {
  const navigate = useNavigate();
  const { isUserOnline } = useOnlineUsersContext();
  const isOnline = otherUser ? isUserOnline(otherUser.id) : false;

  return (
    <div className="relative mb-3 sm:mb-4">
      {/* Futuristic background */}
      <div className="absolute inset-0 bg-gradient-to-r from-black via-zinc-900/95 to-black rounded-xl sm:rounded-2xl overflow-hidden">
        {/* Animated gradient border */}
        <motion.div
          className="absolute inset-0 opacity-40"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(6, 182, 212, 0.3), rgba(168, 85, 247, 0.3), transparent)',
            backgroundSize: '200% 100%',
          }}
          animate={{ backgroundPosition: ['200% 0%', '-200% 0%'] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        />
        
        {/* Tech grid overlay */}
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `
              linear-gradient(rgba(6, 182, 212, 0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(6, 182, 212, 0.5) 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px',
          }}
        />
        
        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-12 h-12 sm:w-16 sm:h-16 border-l-2 border-t-2 border-cyan-500/30 rounded-tl-xl sm:rounded-tl-2xl" />
        <div className="absolute bottom-0 right-0 w-12 h-12 sm:w-16 sm:h-16 border-r-2 border-b-2 border-purple-500/30 rounded-br-xl sm:rounded-br-2xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 p-2.5 sm:p-4 flex items-center gap-2 sm:gap-4">
        {/* Back button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/matches')}
          className="text-white hover:bg-cyan-500/10 hover:text-cyan-400 transition-colors h-8 w-8 sm:h-10 sm:w-10 shrink-0"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </Button>
        
        {otherUser && (
          <>
            {/* Avatar with status */}
            <div className="relative shrink-0">
              <motion.div
                className="absolute -inset-1 rounded-full bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 opacity-50 blur-md"
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <Avatar className="relative w-10 h-10 sm:w-12 sm:h-12 border-2 border-cyan-500/50">
                <AvatarImage src={otherUser.avatar_url || ''} />
                <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-500 text-white text-sm sm:text-base font-bold">
                  {otherUser.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              {/* Online indicator */}
              {isOnline && (
                <motion.div
                  className="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-4 sm:h-4 bg-emerald-500 rounded-full border-2 border-black"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
            </div>
            
            {/* User info - compact for mobile */}
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h2 className="text-sm sm:text-lg font-bold text-white truncate max-w-[120px] sm:max-w-none">
                  {otherUser.display_name || otherUser.username}
                </h2>
                {otherUser.special_badge && (
                  <span className="text-[10px] sm:text-xs font-bold text-yellow-400 shrink-0">⭐</span>
                )}
              </div>
              
              <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5">
                {isOtherUserTyping ? (
                  <motion.span
                    className="text-cyan-400 text-[10px] sm:text-xs font-medium"
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    typing...
                  </motion.span>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
                    <span className="text-zinc-400 text-[10px] sm:text-xs">{isOnline ? 'Online' : 'Offline'}</span>
                  </div>
                )}
                
                {/* E2E Badge - compact */}
                {isEncryptionInitialized && (
                  <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                    <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400" />
                    <span className="text-[8px] sm:text-[10px] text-emerald-400 font-medium hidden xs:inline">E2E</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Actions - compact for mobile */}
            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-cyan-500/10 hover:text-cyan-400 h-7 w-7 sm:h-9 sm:w-9"
                onClick={() => toast.info('Voice call coming soon!')}
              >
                <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-purple-500/10 hover:text-purple-400 h-7 w-7 sm:h-9 sm:w-9"
                onClick={() => toast.info('Video call coming soon!')}
              >
                <Video className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-white hover:bg-zinc-800 h-7 w-7 sm:h-9 sm:w-9">
                    <MoreVertical className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                  <DropdownMenuItem 
                    onClick={() => navigate(`/profile/${otherUser.id}`)} 
                    className="text-white hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white"
                  >
                    View Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-white hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white">
                    <Shield className="w-4 h-4 mr-2" />
                    Security Info
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        )}
      </div>
      
      {/* Bottom accent line */}
      <motion.div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[1px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent"
        initial={{ width: 0 }}
        animate={{ width: '80%' }}
        transition={{ duration: 1, delay: 0.3 }}
      />
    </div>
  );
};
