import { memo } from 'react';
import { Clock, TrendingDown, Wifi, WifiOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { useDecayingScore } from '@/hooks/useDecayingScore';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface DecayingScoreBadgeProps {
  userId: string;
  baseScore?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showOnlineStatus?: boolean;
}

/**
 * A compact badge showing user's effective score with decay indication.
 * Ideal for use in cards, leaderboards, and lists.
 */
export const DecayingScoreBadge = memo(function DecayingScoreBadge({
  userId,
  baseScore,
  className,
  size = 'sm',
  showOnlineStatus = true,
}: DecayingScoreBadgeProps) {
  const {
    effectiveScore,
    decayAmount,
    isDecaying,
    isOnline,
    remainingTimeDisplay,
  } = useDecayingScore(userId, baseScore);

  const sizeClasses = {
    sm: 'text-[10px] gap-1 px-1.5 py-0.5',
    md: 'text-xs gap-1.5 px-2 py-1',
    lg: 'text-sm gap-2 px-3 py-1.5',
  };

  const iconSizes = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  // Determine color based on state
  const getColorClasses = () => {
    if (effectiveScore < 0) return 'bg-red-500/10 border-red-500/30 text-red-400';
    if (effectiveScore === 0) return 'bg-red-500/10 border-red-500/30 text-red-400';
    if (isDecaying) return 'bg-orange-500/10 border-orange-500/30 text-orange-400';
    if (effectiveScore <= 5) return 'bg-orange-500/10 border-orange-500/30 text-orange-400';
    return 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400';
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            className={cn(
              'inline-flex items-center rounded-full border font-semibold',
              sizeClasses[size],
              getColorClasses(),
              className
            )}
            animate={isDecaying ? { 
              opacity: [1, 0.7, 1],
            } : {}}
            transition={isDecaying ? { duration: 1.5, repeat: Infinity } : {}}
          >
            <Clock className={iconSizes[size]} />
            <span className="tabular-nums">{remainingTimeDisplay}</span>
            
            {/* Decay indicator */}
            {isDecaying && decayAmount > 0 && (
              <span className="flex items-center gap-0.5 text-orange-500">
                <TrendingDown className={iconSizes[size]} />
                <span>-{decayAmount}</span>
              </span>
            )}

            {/* Online/Offline indicator */}
            {showOnlineStatus && (
              isOnline ? (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                </span>
              ) : (
                <WifiOff className={cn(iconSizes[size], 'text-zinc-500')} />
              )
            )}
          </motion.div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="text-xs space-y-1">
            <p>
              <span className="font-semibold">Effective Score:</span> {effectiveScore} pts
            </p>
            {decayAmount > 0 && (
              <p className="text-orange-400">
                Decaying -{decayAmount} pts (offline)
              </p>
            )}
            {isOnline && (
              <p className="text-green-400">Online - No decay</p>
            )}
            <p className="text-zinc-500 text-[10px]">1 score = 1 min playtime</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});
