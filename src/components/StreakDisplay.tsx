import { useStreak } from '@/hooks/useStreak';
import { Flame } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export const StreakDisplay = () => {
  const { streak, loading } = useStreak();

  if (loading || !streak) return null;

  // Calculate time since last login
  const getTimeSinceLastLogin = () => {
    if (!streak.last_login_date) return '';
    
    const lastLogin = new Date(streak.last_login_date);
    const now = new Date();
    const diffMs = now.getTime() - lastLogin.getTime();
    
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m ago`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ago`;
    } else if (minutes > 0) {
      return `${minutes}m ago`;
    } else {
      return 'Just now';
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-full border border-orange-500/30 cursor-pointer">
            <Flame className="w-4 h-4 text-white" />
            <span className="text-sm font-bold text-white">
              {streak.current_streak}
            </span>
            <span className="text-xs text-white/70">days</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>🔥 {streak.current_streak} day streak!</p>
          <p className="text-xs text-muted-foreground">
            Longest: {streak.longest_streak} days
          </p>
          {streak.last_login_date && (
            <p className="text-xs text-muted-foreground mt-1">
              Last login: {getTimeSinceLastLogin()}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
