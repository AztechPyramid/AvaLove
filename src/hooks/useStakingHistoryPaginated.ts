import { useEffect, useState, useCallback, useRef } from 'react';
import { useWeb3Auth } from './useWeb3Auth';
import { supabase } from '@/integrations/supabase/client';

const ITEMS_PER_PAGE = 15;

interface StakingTransaction {
  id: string;
  transaction_type: 'deposit' | 'withdraw' | 'claim' | 'stake' | 'unstake';
  amount: string;
  token_symbol: string;
  tx_hash: string | null;
  created_at: string;
  pool_id: string | null;
  pool_title?: string;
  pool_logo?: string;
}

export const useStakingHistoryPaginated = () => {
  const { walletAddress } = useWeb3Auth();
  const [transactions, setTransactions] = useState<StakingTransaction[]>([]);
  const [displayedTransactions, setDisplayedTransactions] = useState<StakingTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [profileId, setProfileId] = useState<string | null>(null);
  const poolCacheRef = useRef<Map<string, { title: string; logo: string | null }>>(new Map());

  // Fetch pool details for a batch of pool IDs
  const fetchPoolDetails = useCallback(async (poolIds: string[]) => {
    const uncachedIds = poolIds.filter(id => id && !poolCacheRef.current.has(id));
    
    if (uncachedIds.length === 0) return;

    const { data: pools } = await supabase
      .from('staking_pools')
      .select('id, title, stake_token_logo')
      .in('id', uncachedIds);

    if (pools) {
      pools.forEach(pool => {
        poolCacheRef.current.set(pool.id, {
          title: pool.title,
          logo: pool.stake_token_logo
        });
      });
    }
  }, []);

  // Enrich transactions with pool details
  const enrichTransactions = useCallback((txs: StakingTransaction[]): StakingTransaction[] => {
    return txs.map(tx => {
      if (tx.pool_id && poolCacheRef.current.has(tx.pool_id)) {
        const poolDetails = poolCacheRef.current.get(tx.pool_id)!;
        return {
          ...tx,
          pool_title: poolDetails.title,
          pool_logo: poolDetails.logo || undefined
        };
      }
      return tx;
    });
  }, []);

  const fetchHistory = useCallback(async () => {
    if (!walletAddress) {
      setTransactions([]);
      setDisplayedTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Get user profile first
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('wallet_address', walletAddress.toLowerCase())
        .maybeSingle();

      if (!profile) {
        setTransactions([]);
        setDisplayedTransactions([]);
        setLoading(false);
        return;
      }

      setProfileId(profile.id);

      // Fetch first batch of staking transactions
      const { data, error } = await supabase
        .from('staking_transactions')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(ITEMS_PER_PAGE * 3); // Fetch more initially for smooth scrolling

      if (error) throw error;

      const txs = (data || []) as StakingTransaction[];
      
      // Fetch pool details for visible transactions
      const poolIds = [...new Set(txs.slice(0, ITEMS_PER_PAGE).map(t => t.pool_id).filter(Boolean))] as string[];
      await fetchPoolDetails(poolIds);

      setTransactions(txs);
      setDisplayedTransactions(enrichTransactions(txs.slice(0, ITEMS_PER_PAGE)));
      setHasMore(txs.length >= ITEMS_PER_PAGE);
    } catch (error) {
      console.error('Error fetching staking history:', error);
      setTransactions([]);
      setDisplayedTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [walletAddress, fetchPoolDetails, enrichTransactions]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !profileId) return;

    setLoadingMore(true);

    try {
      const currentCount = displayedTransactions.length;
      
      // If we have more in memory, use those first
      if (currentCount < transactions.length) {
        const nextBatch = transactions.slice(currentCount, currentCount + ITEMS_PER_PAGE);
        
        // Fetch pool details for new batch
        const poolIds = [...new Set(nextBatch.map(t => t.pool_id).filter(Boolean))] as string[];
        await fetchPoolDetails(poolIds);

        setDisplayedTransactions(prev => [...prev, ...enrichTransactions(nextBatch)]);
        setHasMore(currentCount + ITEMS_PER_PAGE < transactions.length);
      } else {
        // Fetch more from database
        const { data, error } = await supabase
          .from('staking_transactions')
          .select('*')
          .eq('user_id', profileId)
          .order('created_at', { ascending: false })
          .range(transactions.length, transactions.length + ITEMS_PER_PAGE * 2 - 1);

        if (error) throw error;

        if (!data || data.length === 0) {
          setHasMore(false);
        } else {
          const newTxs = data as StakingTransaction[];
          
          // Fetch pool details for new transactions
          const poolIds = [...new Set(newTxs.slice(0, ITEMS_PER_PAGE).map(t => t.pool_id).filter(Boolean))] as string[];
          await fetchPoolDetails(poolIds);

          setTransactions(prev => [...prev, ...newTxs]);
          setDisplayedTransactions(prev => [...prev, ...enrichTransactions(newTxs.slice(0, ITEMS_PER_PAGE))]);
          setHasMore(newTxs.length >= ITEMS_PER_PAGE);
        }
      }
    } catch (error) {
      console.error('Error loading more transactions:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, profileId, displayedTransactions.length, transactions, fetchPoolDetails, enrichTransactions]);

  const recordTransaction = async (
    type: 'deposit' | 'withdraw' | 'claim' | 'stake' | 'unstake',
    amount: string,
    tokenSymbol: string,
    txHash?: string,
    poolId?: string
  ) => {
    if (!walletAddress || !profileId) return;

    try {
      const { error } = await supabase
        .from('staking_transactions')
        .insert({
          user_id: profileId,
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
  }, [fetchHistory]);

  return {
    transactions: displayedTransactions,
    loading,
    loadingMore,
    hasMore,
    refetch: fetchHistory,
    loadMore,
    recordTransaction,
  };
};
