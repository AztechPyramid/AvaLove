import { memo } from 'react';
import { useBadgesCache } from '@/hooks/useBadgesCache';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface EmojiUserBadgesProps {
  userId: string;
  maxBadges?: number;
}

// Memoized to prevent unnecessary re-renders during scroll
export const EmojiUserBadges = memo(({ userId, maxBadges = 3 }: EmojiUserBadgesProps) => {
  const { userBadges, loading } = useBadgesCache(userId);

  // Don't show loading state - just render nothing until loaded
  if (userBadges.length === 0) return null;

  const displayBadges = userBadges.slice(0, maxBadges);

  return (
    <div className="flex items-center gap-1">
      {displayBadges.map((userBadge) => (
        <Popover key={userBadge.badge_id}>
          <PopoverTrigger asChild>
            <button 
              className="text-base hover:scale-110 transition-transform cursor-pointer"
              aria-label={`View ${userBadge.badges.name} badge details`}
            >
              {userBadge.badges.icon}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 bg-background border-border">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{userBadge.badges.icon}</span>
                <h4 className="font-semibold text-foreground">{userBadge.badges.name}</h4>
              </div>
              <p className="text-sm text-muted-foreground">{userBadge.badges.description}</p>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium capitalize">
                  {userBadge.badges.rarity}
                </span>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      ))}
    </div>
  );
});
