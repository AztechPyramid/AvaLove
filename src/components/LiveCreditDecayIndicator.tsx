import { memo, useMemo } from 'react';
import { TrendingDown, Coins, Wifi, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDecayingCredit } from '@/hooks/useDecayingCredit';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface LiveCreditDecayIndicatorProps {
  userId: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showOnlineStatus?: boolean;
  showBalance?: boolean;
}

/**
 * Real-time credit decay indicator similar to LiveTimeIndicator.
 * Shows pending credit decay for offline users.
 * Resets after Pay Reward until new credits are earned.
 */
export const LiveCreditDecayIndicator = memo(function LiveCreditDecayIndicator({
  userId,
  className = '',
  size = 'sm',
  showOnlineStatus = true,
  showBalance = false,
}: LiveCreditDecayIndicatorProps) {
  const {
    currentBalance,
    pendingDecay,
    effectiveBalance,
    isDecaying,
    isOnline,
    pendingDecayDisplay,
    hasPendingDecay,
  } = useDecayingCredit(userId);

  // Size classes
  const sizeClasses = useMemo(() => {
    switch (size) {
      case 'lg':
        return { container: 'px-3 py-1.5', text: 'text-sm', icon: 'w-4 h-4' };
      case 'md':
        return { container: 'px-2 py-1', text: 'text-xs', icon: 'w-3.5 h-3.5' };
      default:
        return { container: 'px-1.5 py-0.5', text: 'text-[10px]', icon: 'w-3 h-3' };
    }
  }, [size]);

  // Color based on decay status
  const colorClasses = useMemo(() => {
    if (isOnline || !hasPendingDecay) {
      return {
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        text: 'text-emerald-400',
        icon: 'text-emerald-400',
      };
    }
    // Decaying - orange warning
    return {
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/30',
      text: 'text-orange-400',
      icon: 'text-orange-400',
    };
  }, [isOnline, hasPendingDecay]);

  // Format balance for display
  const formatBalance = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toFixed(1);
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            className={`inline-flex items-center gap-1 rounded-full border ${colorClasses.bg} ${colorClasses.border} ${sizeClasses.container} ${className}`}
            animate={isDecaying ? { borderColor: ['rgba(249,115,22,0.3)', 'rgba(249,115,22,0.6)', 'rgba(249,115,22,0.3)'] } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            {/* Online/Offline indicator */}
            {showOnlineStatus && (
              <>
                {isOnline ? (
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                ) : (
                  <WifiOff className={`${sizeClasses.icon} ${colorClasses.icon}`} />
                )}
              </>
            )}

            {/* Credit icon */}
            <Coins className={`${sizeClasses.icon} ${colorClasses.icon}`} />

            {/* Balance or decay display */}
            {showBalance ? (
              <span className={`${sizeClasses.text} font-mono ${colorClasses.text}`}>
                {formatBalance(effectiveBalance)}
              </span>
            ) : (
              <>
                {isDecaying && hasPendingDecay ? (
                  <motion.div
                    className="flex items-center gap-0.5"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <TrendingDown className={`${sizeClasses.icon} ${colorClasses.icon}`} />
                    <span className={`${sizeClasses.text} font-mono font-bold ${colorClasses.text}`}>
                      -{pendingDecayDisplay}
                    </span>
                  </motion.div>
                ) : (
                  <span className={`${sizeClasses.text} font-mono ${colorClasses.text}`}>
                    {isOnline ? 'SAFE' : '0'}
                  </span>
                )}
              </>
            )}

            {/* Decay animation indicator */}
            <AnimatePresence>
              {isDecaying && (
                <motion.span
                  className={`${sizeClasses.text} ${colorClasses.text} opacity-60`}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: [0.4, 0.8, 0.4] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  /s
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium text-sm">
              {isOnline ? '🟢 Online - Credits Protected' : '🔴 Offline - Credits Decaying'}
            </p>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>Current Balance: {formatBalance(currentBalance)} AVLO</p>
              {hasPendingDecay && (
                <p className="text-destructive">Pending Decay: -{pendingDecayDisplay} AVLO</p>
              )}
              <p>Effective Balance: {formatBalance(effectiveBalance)} AVLO</p>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 border-t border-border pt-1">
              Credits decay at 1/sec when offline. Resets after Pay Reward.
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});
