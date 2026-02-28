import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  badges: Badge;
}

// Global flag: once we confirm badges table is empty, skip all future queries this session
let badgesTableEmpty: boolean | null = null;

export const useBadges = (userId: string | undefined) => {
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    // If we confirmed badges table is empty, skip all queries
    if (badgesTableEmpty === true) {
      setLoading(false);
      return;
    }

    fetchBadges();
  }, [userId]);

  const fetchBadges = async () => {
    if (!userId) return;

    try {
      // First time: check if badges table has any rows at all
      if (badgesTableEmpty === null) {
        const { count } = await supabase
          .from('badges')
          .select('*', { count: 'exact', head: true })
          .limit(0);
        
        if (count === 0) {
          badgesTableEmpty = true;
          setLoading(false);
          return;
        }
        badgesTableEmpty = false;
      }

      // Fetch all badges
      const { data: badges } = await supabase
        .from('badges')
        .select('*')
        .order('requirement_value', { ascending: true });

      if (badges) setAllBadges(badges);

      // Fetch user's earned badges
      const { data: earnedBadges } = await supabase
        .from('user_badges')
        .select('*, badges(*)')
        .eq('user_id', userId);

      if (earnedBadges) setUserBadges(earnedBadges);
    } catch (error) {
      console.error('Error fetching badges:', error);
    } finally {
      setLoading(false);
    }
  };

  // checkAndAwardBadges removed - badges table is empty, no awards possible
  const checkAndAwardBadges = async () => {};

  return {
    userBadges,
    allBadges,
    loading,
    checkAndAwardBadges,
  };
};