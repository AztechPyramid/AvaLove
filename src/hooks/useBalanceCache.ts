import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWalletAuth } from '@/contexts/WalletAuthContext';

/**
 * Hook for accessing the optimized balance cache
 * Uses user_balance_cache table for O(1) balance lookups
 */
export const useBalanceCache = () => {
  const { profile } = useWalletAuth();
  const [balance, setBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!profile?.id) {
      setBalance(0);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('user_balance_cache')
        .select('effective_balance, total_earned, total_spent, last_calculated_at')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (fetchError) {
        console.error('[BALANCE CACHE] Fetch error:', fetchError);
        setError(fetchError.message);
      } else if (data) {
        setBalance(Number(data.effective_balance) || 0);
        setError(null);
      } else {
        // No cache yet - will be created on first action
        setBalance(0);
      }
    } catch (err) {
      console.error('[BALANCE CACHE] Error:', err);
      setError('Failed to fetch balance');
    } finally {
      setIsLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Poll every 60s instead of realtime
  useEffect(() => {
    if (!profile?.id) return;
    const interval = setInterval(fetchBalance, 60000);
    return () => clearInterval(interval);
  }, [profile?.id, fetchBalance]);

  return {
    balance,
    formattedBalance: Math.floor(balance).toLocaleString(),
    isLoading,
    error,
    refetch: fetchBalance,
  };
};
