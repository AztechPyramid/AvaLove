import { useUserLevel } from '@/hooks/useUserLevel';
import { useLevelBadge } from '@/hooks/useLevelBadge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Trophy } from 'lucide-react';
import { LevelBadgeDisplay } from './LevelBadgeDisplay';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export const LevelBadge = ({ minimal = false }: { minimal?: boolean }) => {
  const { userLevel, xpProgress, xpToNextLevel, loading } = useUserLevel();
  const { currentBadge, nextBadge } = useLevelBadge();

  if (loading || !userLevel) return null;

  if (minimal) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-full border border-yellow-500/30 cursor-pointer">
              <Trophy className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-bold text-foreground">
                {userLevel.level}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Level {userLevel.level}</p>
            <p className="text-xs text-muted-foreground">
              {xpToNextLevel} XP to next level
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Card className="p-4 bg-gradient-to-br from-orange-900/20 to-orange-600/20 border-orange-500/20">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-orange-500/10 rounded-lg">
          <Trophy className="w-6 h-6 text-orange-500" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-white font-semibold">Level {userLevel?.level || 1}</h3>
            <LevelBadgeDisplay size="sm" showTooltip={true} />
          </div>
          <p className="text-zinc-400 text-xs">
            {userLevel?.xp || 0} / {(userLevel?.level || 1) * 1000} XP
          </p>
        </div>
      </div>
      <Progress value={xpProgress} className="h-2 bg-zinc-800" />
      <div className="flex items-center justify-between mt-2">
        <p className="text-zinc-400 text-xs">
          {xpToNextLevel} XP to next level
        </p>
        {nextBadge && (
          <p className="text-zinc-500 text-[10px]">
            Next: {nextBadge.name} (Lv.{nextBadge.minLevel})
          </p>
        )}
      </div>
    </Card>
  );
};
