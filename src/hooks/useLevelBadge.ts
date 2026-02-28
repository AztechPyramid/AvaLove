import { useMemo } from 'react';
import { useUserLevel } from './useUserLevel';

export interface LevelBadge {
  name: string;
  icon: string; // Lucide icon name
  color: string; // Tailwind color class
  tier: 'bronze' | 'silver' | 'gold' | 'diamond' | 'legendary';
  minLevel: number;
  maxLevel: number;
  description: string;
  unlockMessage: string;
}

const LEVEL_BADGES: LevelBadge[] = [
  {
    name: 'Newbie',
    icon: 'Sprout',
    color: 'text-zinc-400',
    tier: 'bronze',
    minLevel: 1,
    maxLevel: 5,
    description: 'Just getting started on the journey',
    unlockMessage: 'Welcome to AvaLove! Start your journey now.',
  },
  {
    name: 'Apprentice',
    icon: 'User',
    color: 'text-orange-600',
    tier: 'bronze',
    minLevel: 6,
    maxLevel: 10,
    description: 'Learning the ropes',
    unlockMessage: 'You\'re getting the hang of it! Keep going!',
  },
  {
    name: 'Experienced',
    icon: 'Star',
    color: 'text-zinc-300',
    tier: 'silver',
    minLevel: 11,
    maxLevel: 20,
    description: 'A seasoned community member',
    unlockMessage: 'You\'re becoming a pro! Silver tier unlocked!',
  },
  {
    name: 'Expert',
    icon: 'Award',
    color: 'text-yellow-500',
    tier: 'gold',
    minLevel: 21,
    maxLevel: 35,
    description: 'A true expert in the community',
    unlockMessage: 'Gold tier achieved! You\'re among the best!',
  },
  {
    name: 'Master',
    icon: 'Crown',
    color: 'text-cyan-400',
    tier: 'diamond',
    minLevel: 36,
    maxLevel: 50,
    description: 'Master of the craft',
    unlockMessage: 'Diamond tier! You\'ve reached mastery!',
  },
  {
    name: 'Legend',
    icon: 'Zap',
    color: 'text-purple-500',
    tier: 'legendary',
    minLevel: 51,
    maxLevel: 999,
    description: 'A legendary figure in AvaLove',
    unlockMessage: 'LEGENDARY! You are one of the greatest!',
  },
];

export const useLevelBadge = () => {
  const { userLevel, loading } = useUserLevel();

  const currentBadge = useMemo(() => {
    if (!userLevel) return LEVEL_BADGES[0];
    
    const badge = LEVEL_BADGES.find(
      (b) => userLevel.level >= b.minLevel && userLevel.level <= b.maxLevel
    );
    
    return badge || LEVEL_BADGES[LEVEL_BADGES.length - 1];
  }, [userLevel]);

  const nextBadge = useMemo(() => {
    if (!userLevel) return LEVEL_BADGES[1];
    
    const nextBadgeIndex = LEVEL_BADGES.findIndex(
      (b) => b.minLevel > userLevel.level
    );
    
    return nextBadgeIndex !== -1 ? LEVEL_BADGES[nextBadgeIndex] : null;
  }, [userLevel]);

  const allBadges = LEVEL_BADGES;

  return {
    currentBadge,
    nextBadge,
    allBadges,
    userLevel,
    loading,
  };
};
