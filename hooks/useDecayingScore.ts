import { useState, useEffect, useCallback, useMemo } from 'react';
import { useOnlineUsersContext } from '@/contexts/OnlineUsersContext';
import { supabase } from '@/integrations/supabase/client';

interface DecayingScoreData {
  baseScore: number;
  effectiveScore: number;
  decayAmount: number;
  isDecaying: boolean;
  isOnline: boolean;
  lastActiveAt: string | null;
  remainingTimeDisplay: string;
  remainingSeconds: number;
}

interface UseDecayingScoreOptions {
  /** If true, will also fetch the base score from database */
  fetchScore?: boolean;
}

/**
 * Hook that calculates real-time score decay for inactive users.
 * 
 * Rules:
 * - Online users: No decay (score stays constant)
 * - Offline users: Score decays at 1 point per minute of inactivity
 * - Minimum effective score: 0 (decay cannot cause negative score)
 * - Pay Reward score stealing can still cause negative (handled separately)
 * 
 * @param userId - The user ID to track
 * @param initialBaseScore - Optional initial base score (will be fetched if not provided)
 */
export function useDecayingScore(
  userId: string | undefined,
  initialBaseScore?: number,
  options: UseDecayingScoreOptions = {}
): DecayingScoreData {
  const { isUserOnline } = useOnlineUsersContext();
  const [baseScore, setBaseScore] = useState<number>(initialBaseScore ?? 0);
  const [lastActiveAt, setLastActiveAt] = useState<string | null>(null);
  const [decayAmount, setDecayAmount] = useState<number>(0);
  const [tick, setTick] = useState<number>(0);

  const isOnline = userId ? isUserOnline(userId) : false;

  // Fetch base score and last_active from database
  useEffect(() => {
    if (!userId) return;

    const fetchData = async () => {
      try {
        // Use cached AVLO token ID
        const { getAvloTokenId } = await import('@/lib/avloTokenCache');
        const avloTokenId = await getAvloTokenId();

        // Fetch user's base score
        if (options.fetchScore !== false || initialBaseScore === undefined) {
          const { data: scoreData } = await supabase
            .from('user_scores')
            .select('total_score')
            .eq('user_id', userId)
            .eq('token_id', avloTokenId || '')
            .order('total_score', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (scoreData?.total_score !== undefined) {
            setBaseScore(scoreData.total_score);
          }
        }

        // Fetch last_active from profiles
        const { data: profileData } = await supabase
          .from('profiles')
          .select('last_active')
          .eq('id', userId)
          .maybeSingle();

        if (profileData?.last_active) {
          setLastActiveAt(profileData.last_active);
        }
      } catch (error) {
        console.error('[DECAYING SCORE] Error fetching data:', error);
      }
    };

    fetchData();

    // Poll last_active every 60s instead of realtime
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [userId, options.fetchScore, initialBaseScore]);

  // Update base score when initialBaseScore prop changes
  // Note: The hook now shows PENDING decay (not yet applied to DB)
  // When user comes back online, decay is permanently applied via apply_score_decay RPC
  useEffect(() => {
    if (initialBaseScore !== undefined) {
      setBaseScore(initialBaseScore);
    }
  }, [initialBaseScore]);

  // Calculate decay every second for real-time display
  useEffect(() => {
    const calculateDecay = () => {
      // If online, no decay
      if (isOnline || !lastActiveAt) {
        setDecayAmount(0);
        return;
      }

      const now = new Date();
      const lastActive = new Date(lastActiveAt);
      const inactiveMinutes = Math.floor((now.getTime() - lastActive.getTime()) / 60000);

      // Decay is 1 point per minute of inactivity
      // But cannot exceed the base score (minimum effective score = 0)
      const maxDecay = Math.max(0, baseScore); // Can't decay more than current score
      const calculatedDecay = Math.min(inactiveMinutes, maxDecay);

      setDecayAmount(Math.max(0, calculatedDecay));
    };

    calculateDecay();

    // Update every second for smooth countdown display
    const interval = setInterval(() => {
      calculateDecay();
      setTick(t => t + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isOnline, lastActiveAt, baseScore]);

  // Calculate effective score (base - decay, minimum 0)
  const effectiveScore = useMemo(() => {
    // If base score is negative (from Pay Reward stealing), keep it negative
    if (baseScore < 0) {
      return baseScore; // Don't apply decay to already negative scores
    }
    return Math.max(0, baseScore - decayAmount);
  }, [baseScore, decayAmount]);

  // Calculate remaining time display (1 score = 1 minute)
  const remainingSeconds = useMemo(() => {
    return Math.max(0, effectiveScore * 60);
  }, [effectiveScore]);

  const remainingTimeDisplay = useMemo(() => {
    if (effectiveScore < 0) {
      const absScore = Math.abs(effectiveScore);
      const hours = Math.floor(absScore / 60);
      const mins = absScore % 60;
      if (hours > 0) {
        return `-${hours}h ${mins}m debt`;
      }
      return `-${mins}m debt`;
    }

    const hours = Math.floor(effectiveScore / 60);
    const mins = effectiveScore % 60;

    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  }, [effectiveScore]);

  return {
    baseScore,
    effectiveScore,
    decayAmount,
    isDecaying: !isOnline && decayAmount > 0,
    isOnline,
    lastActiveAt,
    remainingTimeDisplay,
    remainingSeconds,
  };
}

/**
 * Hook variant for displaying another user's decaying score
 * Useful for leaderboards and profile views
 */
export function useUserDecayingScore(userId: string | undefined) {
  return useDecayingScore(userId, undefined, { fetchScore: true });
}
