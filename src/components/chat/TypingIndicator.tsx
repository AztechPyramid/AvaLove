import { motion } from 'framer-motion';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface TypingIndicatorProps {
  username: string;
  avatarUrl?: string | null;
}

export const TypingIndicator = ({ username, avatarUrl }: TypingIndicatorProps) => {
  return (
    <motion.div
      className="flex items-end gap-2"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <Avatar className="w-8 h-8 border border-zinc-700">
        <AvatarImage src={avatarUrl || ''} />
        <AvatarFallback className="bg-gradient-to-br from-zinc-700 to-zinc-800 text-white text-xs">
          {username.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex items-center gap-1 px-4 py-3 rounded-2xl bg-zinc-800/90 border border-zinc-700/50 rounded-bl-sm">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-gradient-to-r from-cyan-400 to-purple-400 rounded-full"
            animate={{
              y: [0, -6, 0],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: i * 0.15,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>
    </motion.div>
  );
};
