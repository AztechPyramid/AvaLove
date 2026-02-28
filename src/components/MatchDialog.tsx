import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, User, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useEffect } from 'react';

interface MatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchedUser: {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
    bio?: string;
    location?: string;
  } | null;
  currentUser: {
    avatar_url?: string;
    display_name?: string;
    username: string;
  } | null;
}

export const MatchDialog = ({ open, onOpenChange, matchedUser, currentUser }: MatchDialogProps) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (open && matchedUser) {
      // Trigger confetti animation
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min;
      };

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [open, matchedUser]);

  if (!matchedUser || !currentUser) return null;

  const handleViewProfile = () => {
    onOpenChange(false);
    navigate(`/user/${matchedUser.id}`);
  };

  const handleSendMessage = () => {
    onOpenChange(false);
    navigate('/matches');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-zinc-900 via-black to-zinc-900 border-2 border-orange-500/50 shadow-2xl overflow-hidden">
        {/* Animated background effects */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,128,0,0.15),transparent_50%)] animate-pulse" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl animate-pulse" />

        {/* Content */}
        <div className="relative z-10 space-y-6 py-6">
          {/* Header with sparkles */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", duration: 0.8 }}
            className="text-center"
          >
            <div className="flex justify-center items-center gap-2 mb-2">
              <Sparkles className="text-orange-500 animate-pulse" size={32} />
              <Heart className="text-orange-500 animate-pulse fill-orange-500" size={40} />
              <Sparkles className="text-orange-500 animate-pulse" size={32} />
            </div>
            <h2 className="text-4xl font-bold text-white mb-2 bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
              It's a Match!
            </h2>
            <p className="text-zinc-400 text-sm">
              You and {matchedUser.display_name || matchedUser.username} liked each other
            </p>
          </motion.div>

          {/* User avatars */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex justify-center items-center gap-4"
          >
            {/* Current user avatar */}
            <motion.div
              initial={{ x: -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.5, type: "spring" }}
            >
              <Avatar className="w-24 h-24 border-4 border-orange-500 shadow-lg">
                {currentUser.avatar_url ? (
                  currentUser.avatar_url.match(/\.(mp4|webm)$/i) ? (
                    <video 
                      src={currentUser.avatar_url} 
                      autoPlay 
                      loop 
                      muted 
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <AvatarImage src={currentUser.avatar_url} />
                  )
                ) : (
                  <AvatarFallback className="bg-gradient-to-br from-orange-500 to-orange-600 text-white text-2xl">
                    {currentUser.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                )}
              </Avatar>
            </motion.div>

            {/* Heart icon in the middle */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              transition={{ delay: 0.7, duration: 0.5 }}
            >
              <Heart className="text-orange-500 fill-orange-500 animate-pulse" size={32} />
            </motion.div>

            {/* Matched user avatar */}
            <motion.div
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.5, type: "spring" }}
            >
              <Avatar className="w-24 h-24 border-4 border-orange-500 shadow-lg">
                {matchedUser.avatar_url ? (
                  matchedUser.avatar_url.match(/\.(mp4|webm)$/i) ? (
                    <video 
                      src={matchedUser.avatar_url} 
                      autoPlay 
                      loop 
                      muted 
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <AvatarImage src={matchedUser.avatar_url} />
                  )
                ) : (
                  <AvatarFallback className="bg-gradient-to-br from-orange-500 to-orange-600 text-white text-2xl">
                    {matchedUser.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                )}
              </Avatar>
            </motion.div>
          </motion.div>

          {/* Matched user info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="text-center space-y-2"
          >
            <h3 className="text-2xl font-bold text-white">
              {matchedUser.display_name || matchedUser.username}
            </h3>
            {matchedUser.location && (
              <p className="text-orange-500 text-sm">📍 {matchedUser.location}</p>
            )}
            {matchedUser.bio && (
              <p className="text-zinc-400 text-sm max-w-sm mx-auto line-clamp-2">
                {matchedUser.bio}
              </p>
            )}
          </motion.div>

          {/* Action buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
            className="flex gap-3"
          >
            <Button
              onClick={handleSendMessage}
              className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-6 rounded-xl shadow-lg"
            >
              <MessageCircle className="mr-2" size={20} />
              Send Message
            </Button>
            <Button
              onClick={handleViewProfile}
              variant="outline"
              className="flex-1 border-2 border-orange-500/50 hover:bg-orange-500/10 text-white font-semibold py-6 rounded-xl"
            >
              <User className="mr-2" size={20} />
              View Profile
            </Button>
          </motion.div>

          {/* Keep swiping button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.3 }}
          >
            <Button
              onClick={() => onOpenChange(false)}
              variant="ghost"
              className="w-full text-zinc-400 hover:text-white hover:bg-zinc-800/50"
            >
              Keep Swiping
            </Button>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
