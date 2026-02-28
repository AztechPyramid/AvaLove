import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement_type: string;
  requirement_value: number;
  rarity: string;
}

interface UserBadge {
  id: string;
  badge_id: string;
  earned_at: string;
  user_id: string;
  badges: Badge;
}

// Global cache for badges
const badgesCache = new Map<string, UserBadge[]>();
const pendingRequests = new Map<string, Promise<UserBadge[]>>();
let allBadgesCache: Badge[] | null = null;
// Global flag: once confirmed badges table is empty, skip all queries this session
let badgesTableConfirmedEmpty: boolean | null = null;

export const useBadgesCache = (userId: string | undefined) => {
  const [userBadges, setUserBadges] = useState<UserBadge[]>(() => {
    // Initialize from cache if available
    if (userId && badgesCache.has(userId)) {
      return badgesCache.get(userId) || [];
    }
    return [];
  });
  const [loading, setLoading] = useState(!userId || !badgesCache.has(userId));
  const mountedRef = useRef(true);

  const fetchUserBadges = useCallback(async (uid: string): Promise<UserBadge[]> => {
    // Check cache first
    if (badgesCache.has(uid)) {
      return badgesCache.get(uid) || [];
    }

    // Check if there's already a pending request for this user
    if (pendingRequests.has(uid)) {
      return pendingRequests.get(uid)!;
    }

    // Create new request
    const request = (async () => {
      try {
        // Skip if badges table is confirmed empty
        if (badgesTableConfirmedEmpty === true) {
          badgesCache.set(uid, []);
          return [];
        }

        const { data: earnedBadges } = await supabase
          .from('user_badges')
          .select('*, badges(*)')
          .eq('user_id', uid);

        const badges = (earnedBadges || []) as UserBadge[];
        if (badges.length === 0 && badgesTableConfirmedEmpty === null) {
          // Check if badges table itself is empty
          const { count } = await supabase.from('badges').select('*', { count: 'exact', head: true }).limit(0);
          if (count === 0) badgesTableConfirmedEmpty = true;
        }
        badgesCache.set(uid, badges);
        return badges;
      } catch (error) {
        console.error('Error fetching badges for user:', uid, error);
        return [];
      } finally {
        pendingRequests.delete(uid);
      }
    })();

    pendingRequests.set(uid, request);
    return request;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    
    if (!userId) {
      setUserBadges([]);
      setLoading(false);
      return;
    }

    // If already in cache, use it immediately
    if (badgesCache.has(userId)) {
      setUserBadges(badgesCache.get(userId) || []);
      setLoading(false);
      return;
    }

    // Fetch badges
    setLoading(true);
    fetchUserBadges(userId).then((badges) => {
      if (mountedRef.current) {
        setUserBadges(badges);
        setLoading(false);
      }
    });

    return () => {
      mountedRef.current = false;
    };
  }, [userId, fetchUserBadges]);

  return {
    userBadges,
    loading,
  };
};

// Batch fetch badges for multiple users at once
export const prefetchBadgesForUsers = async (userIds: string[]) => {
  // Skip entirely if badges table is confirmed empty
  if (badgesTableConfirmedEmpty === true) return;

  // Filter out users already in cache
  const uncachedUserIds = userIds.filter(id => !badgesCache.has(id));
  
  if (uncachedUserIds.length === 0) return;

  try {
    const { data: allUserBadges } = await supabase
      .from('user_badges')
      .select('*, badges(*)')
      .in('user_id', uncachedUserIds);

    if (allUserBadges) {
      // Group badges by user_id
      const badgesByUser = new Map<string, UserBadge[]>();
      
      for (const badge of allUserBadges as UserBadge[]) {
        const userId = badge.user_id;
        if (!badgesByUser.has(userId)) {
          badgesByUser.set(userId, []);
        }
        badgesByUser.get(userId)!.push(badge);
      }

      // Cache results (including empty arrays for users with no badges)
      for (const userId of uncachedUserIds) {
        badgesCache.set(userId, badgesByUser.get(userId) || []);
      }
    }
  } catch (error) {
    console.error('Error prefetching badges:', error);
  }
};

// Clear cache for a specific user (useful after badge award)
export const clearBadgeCache = (userId?: string) => {
  if (userId) {
    badgesCache.delete(userId);
  } else {
    badgesCache.clear();
  }
};
