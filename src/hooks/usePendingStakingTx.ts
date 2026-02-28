import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ethers } from 'ethers';
import { toast } from 'sonner';

interface PendingTransaction {
  id: string;
  tx_hash: string;
  stake_token_address: string;
  stake_token_symbol: string | null;
  stake_token_logo: string | null;
  reward_token_address: string;
  reward_token_symbol: string | null;
  reward_token_logo: string | null;
  pool_title: string;
  total_reward_amount: string | null;
  start_block: string | null;
  end_block: string | null;
  status: string;
  retry_count: number;
  user_id: string;
  form_data: any;
}

const STAKING_MINE_V3_ABI = [
  {
    "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "name": "rewardTokenInfos",
    "outputs": [
      { "internalType": "address", "name": "rewardToken", "type": "address" },
      { "internalType": "uint256", "name": "startBlock", "type": "uint256" },
      { "internalType": "uint256", "name": "endBlock", "type": "uint256" },
      { "internalType": "address", "name": "rewardVault", "type": "address" },
      { "internalType": "uint256", "name": "rewardPerBlock", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

/**
 * Hook to monitor and recover pending staking pool transactions
 * Polls every 30 seconds for pending TXs and auto-creates pools when receipts are found
 */
export const usePendingStakingTx = (walletAddress: string | null, onPoolRecovered?: () => void) => {
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);

  // Process pending transactions via Edge Function (bypasses RLS for updates)
  const processPendingTransactions = useCallback(async () => {
    try {
      console.log('[TX RECOVERY] Triggering edge function to process pending TXs...');
      
      const { data, error } = await supabase.functions.invoke('resolve-pending-staking-tx', {
        body: { user_id: walletAddress?.toLowerCase() }
      });

      if (error) {
        console.error('[TX RECOVERY] Edge function error:', error);
        return false;
      }

      console.log('[TX RECOVERY] Edge function result:', data);

      if (data?.resolved > 0) {
        toast.success(`🎉 ${data.resolved} staking pool(s) recovered successfully!`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('[TX RECOVERY] Error calling edge function:', error);
      return false;
    }
  }, [walletAddress]);

  const checkPendingTransactions = useCallback(async () => {
    if (!walletAddress || isProcessingRef.current) return;
    
    isProcessingRef.current = true;
    
    try {
      // First check if there are any pending transactions for this user
      const { data: pendingTxs, error } = await supabase
        .from('pending_staking_transactions')
        .select('id')
        .eq('user_id', walletAddress.toLowerCase())
        .eq('status', 'pending')
        .lt('retry_count', 50)
        .limit(1);

      if (error || !pendingTxs || pendingTxs.length === 0) {
        isProcessingRef.current = false;
        return;
      }

      console.log(`[TX RECOVERY] Found pending transactions, triggering resolution...`);

      // Process via edge function (has service_role access to bypass RLS)
      const recovered = await processPendingTransactions();

      if (recovered && onPoolRecovered) {
        onPoolRecovered();
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [walletAddress, processPendingTransactions, onPoolRecovered]);

  // Start polling when wallet is connected
  useEffect(() => {
    if (!walletAddress) return;

    // Check immediately on mount
    checkPendingTransactions();

    // Poll every 2 minutes (reduced from 30s for cost optimization)
    pollingRef.current = setInterval(checkPendingTransactions, 120000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [walletAddress, checkPendingTransactions]);

  // Manual trigger for recovery check
  const triggerCheck = useCallback(() => {
    checkPendingTransactions();
  }, [checkPendingTransactions]);

  return { triggerCheck };
};

/**
 * Log a pending staking transaction immediately after TX is sent
 */
export const logPendingStakingTx = async (data: {
  txHash: string;
  userWallet: string;
  stakeTokenAddress: string;
  stakeTokenSymbol?: string;
  stakeTokenLogo?: string;
  rewardTokenAddress: string;
  rewardTokenSymbol?: string;
  rewardTokenLogo?: string;
  poolTitle: string;
  totalRewardAmount?: string;
  startBlock?: number;
  endBlock?: number;
  formData?: any;
}) => {
  try {
    const { error } = await supabase
      .from('pending_staking_transactions')
      .insert({
        tx_hash: data.txHash,
        user_id: data.userWallet.toLowerCase(),
        stake_token_address: data.stakeTokenAddress,
        stake_token_symbol: data.stakeTokenSymbol || null,
        stake_token_logo: data.stakeTokenLogo || null,
        reward_token_address: data.rewardTokenAddress,
        reward_token_symbol: data.rewardTokenSymbol || null,
        reward_token_logo: data.rewardTokenLogo || null,
        pool_title: data.poolTitle,
        total_reward_amount: data.totalRewardAmount || null,
        start_block: data.startBlock?.toString() || null,
        end_block: data.endBlock?.toString() || null,
        form_data: data.formData || null,
        status: 'pending'
      });

    if (error) {
      console.error('[TX LOG] Failed to log pending TX:', error);
      return false;
    }

    console.log(`[TX LOG] ✅ Logged pending TX: ${data.txHash.slice(0, 10)}...`);
    return true;
  } catch (error) {
    console.error('[TX LOG] Error logging TX:', error);
    return false;
  }
};

/**
 * Mark a pending TX as resolved (when pool is created successfully in normal flow)
 */
/**
 * Mark a pending TX as resolved via edge function (bypasses RLS)
 */
export const resolvePendingStakingTx = async (txHash: string, poolId: string) => {
  try {
    const { error } = await supabase.functions.invoke('resolve-pending-staking-tx', {
      body: { 
        action: 'mark_resolved',
        tx_hash: txHash, 
        pool_id: poolId 
      }
    });

    if (error) {
      console.error('[TX RESOLVE] Edge function error:', error);
      return;
    }
    
    console.log(`[TX RESOLVE] Marked TX ${txHash.slice(0, 10)}... as resolved`);
  } catch (error) {
    console.error('[TX RESOLVE] Error:', error);
  }
};
