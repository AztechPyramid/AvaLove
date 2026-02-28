import { useState, useEffect, useMemo } from 'react';
import { Clock, TrendingDown, Wifi, WifiOff, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDecayingScore } from '@/hooks/useDecayingScore';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface LiveTimeIndicatorProps {
  userId: string;
  baseScore?: number;
  className?: string;
  showDetails?: boolean;
  onClick?: () => void;
}

export function LiveTimeIndicator({ userId, baseScore, className, showDetails = true, onClick }: LiveTimeIndicatorProps) {
  const {
    effectiveScore,
    decayAmount,
    isDecaying,
    isOnline,
    remainingTimeDisplay,
  } = useDecayingScore(userId, baseScore);

  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [pulsePhase, setPulsePhase] = useState(0);

  // Animate the seconds countdown
  useEffect(() => {
    setDisplaySeconds(effectiveScore * 60);
    
    // If decaying, animate the countdown
    if (isDecaying && effectiveScore > 0) {
      const interval = setInterval(() => {
        setDisplaySeconds(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [effectiveScore, isDecaying]);

  // Energy pulse animation phase
  useEffect(() => {
    const interval = setInterval(() => {
      setPulsePhase(prev => (prev + 1) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Format display with hours:minutes:seconds when decaying
  const formattedTime = useMemo(() => {
    if (effectiveScore < 0) {
      return remainingTimeDisplay;
    }

    if (isDecaying) {
      const hours = Math.floor(displaySeconds / 3600);
      const mins = Math.floor((displaySeconds % 3600) / 60);
      const secs = displaySeconds % 60;
      
      if (hours > 0) {
        return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    return remainingTimeDisplay;
  }, [displaySeconds, effectiveScore, isDecaying, remainingTimeDisplay]);

  // Determine color based on state
  const getColorClass = () => {
    if (effectiveScore < 0) return 'text-red-400';
    if (effectiveScore === 0) return 'text-red-400';
    if (isDecaying) return 'text-orange-400';
    if (effectiveScore <= 5) return 'text-orange-400';
    return 'text-cyan-400';
  };

  const getGlowColor = () => {
    if (effectiveScore < 0) return 'rgba(239,68,68,0.6)';
    if (effectiveScore === 0) return 'rgba(239,68,68,0.6)';
    if (isDecaying) return 'rgba(249,115,22,0.6)';
    return 'rgba(34,211,238,0.8)';
  };

  const getEnergyColor = () => {
    if (effectiveScore < 0) return '#ef4444';
    if (effectiveScore === 0) return '#ef4444';
    if (isDecaying) return '#f97316';
    return '#22d3ee';
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            className={cn(
              'relative flex items-center gap-1.5 px-2 py-1.5 rounded-xl cursor-pointer overflow-hidden',
              'bg-black/60 backdrop-blur-xl',
              className
            )}
            onClick={onClick}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {/* Animated border gradient */}
            <motion.div
              className="absolute inset-0 rounded-xl"
              style={{
                background: `linear-gradient(${pulsePhase}deg, ${getEnergyColor()}, transparent, ${getEnergyColor()})`,
                padding: '1px',
              }}
              animate={{
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            
            {/* Inner container */}
            <div className="absolute inset-[1px] rounded-xl bg-zinc-950/95" />

            {/* Flowing energy particles */}
            <div className="absolute inset-0 overflow-hidden rounded-xl">
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 rounded-full"
                  style={{
                    background: getEnergyColor(),
                    boxShadow: `0 0 6px ${getEnergyColor()}`,
                  }}
                  animate={{
                    x: ['0%', '100%', '100%', '0%', '0%'],
                    y: ['0%', '0%', '100%', '100%', '0%'],
                    opacity: [0, 1, 1, 1, 0],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    delay: i * 1,
                    ease: 'linear',
                  }}
                />
              ))}
            </div>

            {/* Clock icon with energy glow */}
            <div className="relative z-10">
              <motion.div
                className="absolute inset-0 blur-md"
                style={{ background: getGlowColor() }}
                animate={{
                  scale: [1, 1.4, 1],
                  opacity: [0.3, 0.7, 0.3],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
              <motion.div
                className="relative"
                animate={isOnline ? {
                  rotate: [0, 5, -5, 0],
                } : {
                  rotate: [0, -10, 10, -10, 0],
                }}
                transition={{
                  duration: isOnline ? 2 : 0.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <Clock className={cn('w-4 h-4 relative z-10', getColorClass())} />
              </motion.div>
              
              {/* Energy rings around clock */}
              <motion.div
                className="absolute -inset-1 rounded-full border"
                style={{ borderColor: getEnergyColor() }}
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.5, 0, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeOut',
                }}
              />
              
              {isDecaying && (
                <motion.div
                  className="absolute -top-1 -right-1 z-20"
                  animate={{ 
                    scale: [1, 1.3, 1], 
                    opacity: [0.7, 1, 0.7],
                    y: [0, -2, 0],
                  }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                >
                  <TrendingDown className="w-2.5 h-2.5 text-orange-500" />
                </motion.div>
              )}
              
              {isOnline && !isDecaying && (
                <motion.div
                  className="absolute -top-1 -right-1 z-20"
                  animate={{ 
                    scale: [1, 1.2, 1],
                    rotate: [0, 180, 360],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Zap className="w-2.5 h-2.5 text-cyan-400" />
                </motion.div>
              )}
            </div>

            {/* Time Display - Hidden when showDetails is false */}
            {showDetails && (
              <motion.span 
                className={cn('relative z-10 text-xs font-bold tabular-nums', getColorClass())}
                animate={isDecaying ? {
                  textShadow: [
                    '0 0 5px rgba(249,115,22,0.5)',
                    '0 0 15px rgba(249,115,22,0.8)',
                    '0 0 5px rgba(249,115,22,0.5)',
                  ],
                } : {
                  textShadow: [
                    '0 0 5px rgba(34,211,238,0.3)',
                    '0 0 10px rgba(34,211,238,0.6)',
                    '0 0 5px rgba(34,211,238,0.3)',
                  ],
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                {formattedTime}
              </motion.span>
            )}

            {/* Decay indicator */}
            <AnimatePresence>
              {isDecaying && decayAmount > 0 && showDetails && (
                <motion.span
                  initial={{ opacity: 0, x: -5, scale: 0.8 }}
                  animate={{ 
                    opacity: 1, 
                    x: 0, 
                    scale: [1, 1.1, 1],
                  }}
                  exit={{ opacity: 0, x: -5 }}
                  transition={{ 
                    scale: { duration: 0.5, repeat: Infinity },
                  }}
                  className="relative z-10 text-[10px] text-orange-400 font-bold"
                >
                  -{decayAmount}
                </motion.span>
              )}
            </AnimatePresence>

            {/* Online/Offline indicator with pulse */}
            {showDetails && (
              <div className="relative z-10 flex items-center">
                {isOnline ? (
                  <motion.div
                    animate={{
                      scale: [1, 1.2, 1],
                    }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    <Wifi className="w-3 h-3 text-green-500" />
                  </motion.div>
                ) : (
                  <motion.div
                    animate={{
                      opacity: [0.5, 1, 0.5],
                    }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    <WifiOff className="w-3 h-3 text-zinc-500" />
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs p-4 bg-zinc-950 border-cyan-500/30">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span className="font-semibold text-white">Time Score System</span>
            </div>
            <div className="text-xs text-zinc-400 space-y-2">
              <p>
                <span className="text-white font-medium">Current Score:</span> {effectiveScore} points
              </p>
              <p>
                <span className="text-white font-medium">Time Available:</span> {remainingTimeDisplay}
              </p>
              {decayAmount > 0 && (
                <div className="p-2 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                  <div className="flex items-center gap-2 text-orange-400">
                    <TrendingDown className="w-3 h-3" />
                    <span className="font-semibold">Decaying: -{decayAmount} points</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1">Score decreases while offline</p>
                </div>
              )}
              <div className="pt-2 border-t border-zinc-700 space-y-1">
                <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                  <span className="text-green-400">•</span> 1 score = 1 minute earning time
                </p>
                <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                  <span className="text-amber-400">•</span> Offline = -1 score/min decay
                </p>
                <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                  <span className="text-green-400">•</span> Daily login = +60 bonus score
                </p>
                <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                  <span className="text-red-400">•</span> Credits also decay when offline!
                </p>
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
