import { useEffect, useState } from 'react';
import { useWeb3Auth } from './useWeb3Auth';
import { supabase } from '@/integrations/supabase/client';

interface StakingTransaction {
  id: string;
  transaction_type: 'deposit' | 'withdraw' | 'claim' | 'stake' | 'unstake';
  amount: string;
  token_symbol: string;
  tx_hash: string | null;
  created_at: string;
  pool_id: string | null;
}

export const useStakingHistory = () => {
  const { walletAddress } = useWeb3Auth();
  const [transactions, setTransactions] = useState<StakingTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    if (!walletAddress) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    try {
      // Get user profile first
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('wallet_address', walletAddress.toLowerCase())
        .maybeSingle();

      if (!profile) {
        setTransactions([]);
        setLoading(false);
        return;
      }

      // Fetch staking transactions
      const { data, error } = await supabase
        .from('staking_transactions')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setTransactions((data || []) as StakingTransaction[]);
    } catch (error) {
      console.error('Error fetching staking history:', error);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const recordTransaction = async (
    type: 'deposit' | 'withdraw' | 'claim' | 'stake' | 'unstake',
    amount: string,
    tokenSymbol: string,
    txHash?: string,
    poolId?: string
  ) => {
    if (!walletAddress) return;

    try {
      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('wallet_address', walletAddress.toLowerCase())
        .maybeSingle();

      if (!profile) return;

      // Insert transaction record with pool_id
      const { error } = await supabase
        .from('staking_transactions')
        .insert({
          user_id: profile.id,
          transaction_type: type,
          amount,
          token_symbol: tokenSymbol,
          tx_hash: txHash || null,
          pool_id: poolId || null,
        });

      if (error) throw error;

      // Refresh history
      await fetchHistory();
    } catch (error) {
      console.error('Error recording transaction:', error);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [walletAddress]);

  return {
    transactions,
    loading,
    refetch: fetchHistory,
    recordTransaction,
  };
};
