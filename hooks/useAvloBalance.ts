import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWalletAuth } from '@/contexts/WalletAuthContext';

/**
 * Uses get_user_spendable_balance RPC for accurate real-time balance.
 * Polls every 30s and can be manually refreshed after transactions.
 */
export function useAvloBalance() {
  const { profile } = useWalletAuth();
  const [balance, setBalance] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadBalance = useCallback(async () => {
    if (!profile?.id) {
      setBalance(0);
      setTotalEarned(0);
      setTotalSpent(0);
      setLoading(false);
      return;
    }

    try {
      // Use the accurate RPC function that accounts for all sources
      const { data, error } = await supabase.rpc('get_user_spendable_balance', {
        p_user_id: profile.id
      });

      if (!error && data !== null) {
        const bal = Math.max(0, parseFloat(String(data)) || 0);
        setBalance(bal);
        setLoading(false);
        return;
      }

      // Fallback: try balance cache
      const { data: cached } = await supabase
        .from('user_balance_cache')
        .select('effective_balance, total_earned, total_spent')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (cached) {
        setBalance(Math.max(0, Number(cached.effective_balance) || 0));
        setTotalEarned(Number(cached.total_earned) || 0);
        setTotalSpent(Number(cached.total_spent) || 0);
      } else {
        setBalance(0);
      }
    } catch (error) {
      console.error('Error loading balance:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    loadBalance();

    if (!profile?.id) return;

    // Poll every 30s for responsive balance updates
    const interval = setInterval(loadBalance, 30000);
    return () => clearInterval(interval);
  }, [profile?.id, loadBalance]);

  return { balance, totalEarned, totalSpent, loading, refresh: loadBalance };
}
