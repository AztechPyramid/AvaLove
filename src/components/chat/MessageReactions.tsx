import { motion, AnimatePresence } from 'framer-motion';

interface Reaction {
  id: string;
  user_id: string;
  reaction: string;
}

interface MessageReactionsProps {
  reactions: Reaction[];
  currentUserId: string;
  onToggleReaction: (reaction: string) => void;
  isOwnMessage: boolean;
}

const AVAILABLE_REACTIONS = ['❤️', '😂', '😮', '😢', '🔥', '👍'];

export const MessageReactions = ({ 
  reactions, 
  currentUserId, 
  onToggleReaction,
  isOwnMessage 
}: MessageReactionsProps) => {
  // Group reactions by emoji
  const groupedReactions = reactions.reduce((acc, r) => {
    if (!acc[r.reaction]) {
      acc[r.reaction] = { count: 0, hasCurrentUser: false };
    }
    acc[r.reaction].count++;
    if (r.user_id === currentUserId) {
      acc[r.reaction].hasCurrentUser = true;
    }
    return acc;
  }, {} as Record<string, { count: number; hasCurrentUser: boolean }>);

  return (
    <div className={`flex items-center gap-1 flex-wrap ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
      <AnimatePresence>
        {Object.entries(groupedReactions).map(([emoji, data]) => (
          <motion.button
            key={emoji}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs transition-all ${
              data.hasCurrentUser 
                ? 'bg-cyan-500/20 border border-cyan-500/50' 
                : 'bg-zinc-800/50 border border-zinc-700/50 hover:bg-zinc-700/50'
            }`}
            onClick={() => onToggleReaction(emoji)}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <span>{emoji}</span>
            {data.count > 1 && (
              <span className="text-[10px] text-zinc-400">{data.count}</span>
            )}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
};

export const ReactionPicker = ({ 
  onSelect, 
  onClose 
}: { 
  onSelect: (reaction: string) => void; 
  onClose: () => void;
}) => {
  return (
    <motion.div
      className="absolute bottom-full mb-2 flex items-center gap-1 px-2 py-1.5 rounded-full bg-zinc-900 border border-zinc-700 shadow-xl z-50"
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 10 }}
      onMouseLeave={onClose}
    >
      {AVAILABLE_REACTIONS.map((emoji) => (
        <motion.button
          key={emoji}
          className="text-lg hover:scale-125 transition-transform p-1"
          whileHover={{ scale: 1.3 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            onSelect(emoji);
            onClose();
          }}
        >
          {emoji}
        </motion.button>
      ))}
    </motion.div>
  );
};
