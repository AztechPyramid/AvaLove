import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StakingInfo {
  totalStaked: number;
  pendingRewards: number;
  loading: boolean;
}

export const useStakingInfo = (userId: string | undefined) => {
  const [stakingInfo, setStakingInfo] = useState<StakingInfo>({
    totalStaked: 0,
    pendingRewards: 0,
    loading: true,
  });

  useEffect(() => {
    if (!userId) {
      setStakingInfo({ totalStaked: 0, pendingRewards: 0, loading: false });
      return;
    }

    fetchStakingInfo();
  }, [userId]);

  const fetchStakingInfo = async () => {
    if (!userId) return;

    try {
      // Fetch staking transactions
      const { data: transactions, error } = await supabase
        .from('staking_transactions')
        .select('amount, transaction_type')
        .eq('user_id', userId);

      if (error) throw error;

      let totalStaked = 0;
      transactions?.forEach((tx) => {
        const amount = parseFloat(tx.amount);
        if (tx.transaction_type === 'stake') {
          totalStaked += amount;
        } else if (tx.transaction_type === 'unstake') {
          totalStaked -= amount;
        }
      });

      // Calculate pending rewards (5% APY per year, calculate based on staked amount)
      // For demo: 5% annual = 0.0137% daily
      const dailyRate = 0.05 / 365;
      const pendingRewards = totalStaked * dailyRate * 30; // ~1 month of rewards

      setStakingInfo({
        totalStaked: Math.max(0, totalStaked),
        pendingRewards: Math.max(0, pendingRewards),
        loading: false,
      });
    } catch (error) {
      console.error('Error fetching staking info:', error);
      setStakingInfo({ totalStaked: 0, pendingRewards: 0, loading: false });
    }
  };

  return stakingInfo;
};
