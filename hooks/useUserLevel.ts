import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWalletAuth } from '@/contexts/WalletAuthContext';

interface UserLevel {
  id: string;
  user_id: string;
  level: number;
  xp: number;
  total_xp: number;
}

const XP_PER_LEVEL = 1000;

// Global flag: once we confirm user_levels is empty, skip all future queries this session
let confirmedEmpty = false;

export const useUserLevel = () => {
  const { profile } = useWalletAuth();
  const [userLevel, setUserLevel] = useState<UserLevel | null>(null);
  const [loading, setLoading] = useState(true);
  const lastNotifiedLevelRef = useRef<number>(0);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }

    // If we already confirmed the table is empty this session, skip entirely
    if (confirmedEmpty) {
      setLoading(false);
      return;
    }

    // Only check once per mount
    if (checkedRef.current) return;
    checkedRef.current = true;

    fetchUserLevel();
  }, [profile?.id]);

  const fetchUserLevel = async () => {
    if (!profile?.id || confirmedEmpty) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_levels')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user level:', error);
        setLoading(false);
        return;
      }

      if (!data) {
        // No level data for this user - mark as empty to avoid future queries
        confirmedEmpty = true;
        setLoading(false);
        return;
      }

      if (lastNotifiedLevelRef.current === 0) {
        lastNotifiedLevelRef.current = data.level;
      }

      setUserLevel(data);
    } catch (error) {
      console.error('Error fetching user level:', error);
    } finally {
      setLoading(false);
    }
  };

  // Deprecated - XP is now automatically synced from activities
  const addXP = async (_amount: number) => {};

  const xpToNextLevel = userLevel
    ? XP_PER_LEVEL * userLevel.level - userLevel.xp
    : 0;

  const xpProgress = userLevel
    ? (userLevel.xp / (XP_PER_LEVEL * userLevel.level)) * 100
    : 0;

  return {
    userLevel,
    loading,
    addXP,
    xpToNextLevel,
    xpProgress,
    refetch: fetchUserLevel,
    syncXP: fetchUserLevel,
  };
};