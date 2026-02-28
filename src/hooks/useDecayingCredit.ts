import { useState, useEffect, useCallback, useMemo } from 'react';
import { useOnlineUsersContext } from '@/contexts/OnlineUsersContext';
import { supabase } from '@/integrations/supabase/client';

interface DecayingCreditData {
  /** Total unpaid earnings across all modules */
  totalEarned: number;
  /** Total burns already applied (including previous offline_decay) */
  totalBurned: number;
  /** Current spendable balance (earned - burned) */
  currentBalance: number;
  /** Pending decay amount (not yet persisted) - resets on pay reward or earning */
  pendingDecay: number;
  /** Effective balance after pending decay */
  effectiveBalance: number;
  /** Whether decay is currently active (offline and has balance) */
  isDecaying: boolean;
  /** Whether user is online */
  isOnline: boolean;
  /** Last active timestamp */
  lastActiveAt: string | null;
  /** Last payment timestamp (decay resets after this) */
  lastPaidAt: string | null;
  /** Display string for pending decay */
  pendingDecayDisplay: string;
  /** Whether there's any pending decay to show */
  hasPendingDecay: boolean;
  /** Refresh function to reload data */
  refresh: () => Promise<void>;
}

/**
 * Hook that calculates real-time CREDIT decay for inactive users.
 * 
 * Rules:
 * - Online users: No decay (pendingDecay = 0)
 * - Earning users: No decay (has active session)
 * - Offline users: Credits decay at 1 credit per second of inactivity
 * - Decay is capped at current unpaid balance
 * - Pay Reward resets the decayable balance (until new credits earned)
 * 
 * @param userId - The user ID to track
 */
export function useDecayingCredit(userId: string | undefined): DecayingCreditData {
  const { isUserOnline } = useOnlineUsersContext();
  const [totalEarned, setTotalEarned] = useState<number>(0);
  const [totalBurned, setTotalBurned] = useState<number>(0);
  const [lastActiveAt, setLastActiveAt] = useState<string | null>(null);
  const [lastPaidAt, setLastPaidAt] = useState<string | null>(null);
  const [hasActiveSession, setHasActiveSession] = useState<boolean>(false);
  const [pendingDecay, setPendingDecay] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const isOnline = userId ? isUserOnline(userId) : false;

  // Calculate current balance
  const currentBalance = useMemo(() => {
    return Math.max(0, totalEarned - totalBurned);
  }, [totalEarned, totalBurned]);

  // Fetch credit data using balance cache (single query instead of 12+)
  const fetchData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      // Use balance cache for earned/burned (O(1) instead of 12+ queries)
      const [cacheRes, profileRes, sessionRes] = await Promise.all([
        supabase
          .from('user_balance_cache')
          .select('effective_balance, total_earned, total_spent, last_calculated_at')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('last_active')
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('active_earn_sessions')
          .select('id')
          .eq('user_id', userId)
          .eq('is_active', true)
          .gt('last_heartbeat_at', new Date(Date.now() - 120000).toISOString())
          .limit(1)
          .maybeSingle(),
      ]);

      if (cacheRes.data) {
        setTotalEarned(Number(cacheRes.data.total_earned) || 0);
        setTotalBurned(Number(cacheRes.data.total_spent) || 0);
        setLastPaidAt(cacheRes.data.last_calculated_at);
      }

      setLastActiveAt(profileRes.data?.last_active || null);
      setHasActiveSession(!!sessionRes.data);
    } catch (error) {
      console.error('[DECAYING CREDIT] Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Poll for changes every 60s instead of realtime
  useEffect(() => {
    if (!userId) return;

    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [userId, fetchData]);

  // Calculate pending decay every second
  useEffect(() => {
    if (!userId) return;

    const calculatePendingDecay = () => {
      // No decay if online
      if (isOnline) {
        setPendingDecay(0);
        return;
      }

      // No decay if has active earning session
      if (hasActiveSession) {
        setPendingDecay(0);
        return;
      }

      // No decay if no balance to decay
      if (currentBalance <= 0) {
        setPendingDecay(0);
        return;
      }

      // No decay if no last_active timestamp
      if (!lastActiveAt) {
        setPendingDecay(0);
        return;
      }

      const now = new Date();
      const lastActive = new Date(lastActiveAt);
      
      // Grace period: 60 seconds
      const offlineSeconds = Math.floor((now.getTime() - lastActive.getTime()) / 1000);
      if (offlineSeconds < 60) {
        setPendingDecay(0);
        return;
      }

      // Decay is 1 credit per second (after grace period)
      const decaySeconds = offlineSeconds - 60;
      const decay = Math.min(decaySeconds, currentBalance);
      
      setPendingDecay(Math.max(0, decay));
    };

    calculatePendingDecay();

    const interval = setInterval(calculatePendingDecay, 1000);
    return () => clearInterval(interval);
  }, [userId, isOnline, hasActiveSession, currentBalance, lastActiveAt]);

  // Calculate effective balance
  const effectiveBalance = useMemo(() => {
    return Math.max(0, currentBalance - pendingDecay);
  }, [currentBalance, pendingDecay]);

  // Format pending decay for display
  const pendingDecayDisplay = useMemo(() => {
    if (pendingDecay === 0) return '0';
    
    if (pendingDecay >= 1000000) {
      return `${(pendingDecay / 1000000).toFixed(2)}M`;
    } else if (pendingDecay >= 1000) {
      return `${(pendingDecay / 1000).toFixed(2)}K`;
    }
    return pendingDecay.toFixed(2);
  }, [pendingDecay]);

  return {
    totalEarned,
    totalBurned,
    currentBalance,
    pendingDecay,
    effectiveBalance,
    isDecaying: !isOnline && !hasActiveSession && pendingDecay > 0,
    isOnline,
    lastActiveAt,
    lastPaidAt,
    pendingDecayDisplay,
    hasPendingDecay: pendingDecay > 0,
    refresh: fetchData,
  };
}
