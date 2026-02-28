import { useState, useEffect, useMemo } from 'react';
import { Contract, JsonRpcProvider, formatUnits } from 'ethers';

// ABI for basic token balance check
const ERC20_BALANCE_ABI = ['function balanceOf(address) view returns (uint256)'];

interface PoolAPYParams {
  poolId: string;
  stakeTokenAddress: string;
  rewardTokenAddress: string;
  rewardPoolAddress: string;
  stakingContractAddress: string;
  startBlock?: number;
  endBlock?: number;
  currentBlock: number;
  totalStaked?: bigint;
  rewardVaultBalance?: string;
  rewardPerBlock?: string;
}

interface PoolAPYResult {
  apy: number;
  apyType: 'usd' | 'token' | 'rate' | 'none';
  stakeTokenPrice: number;
  rewardTokenPrice: number;
  isLoading: boolean;
}

// Cache for token prices (5 minute TTL)
const priceCache: Record<string, { price: number; timestamp: number }> = {};
const PRICE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getProvider = () => new JsonRpcProvider('https://api.avax.network/ext/bc/C/rpc');

// Fetch token price from DexScreener without liquidity filter
async function fetchTokenPrice(tokenAddress: string): Promise<number> {
  const addr = tokenAddress.toLowerCase();
  
  // Check cache
  const cached = priceCache[addr];
  if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL) {
    return cached.price;
  }

  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addr}`);
    const data = await res.json();
    
    if (data.pairs && data.pairs.length > 0) {
      // Prefer Avalanche pairs
      const avaxPair = data.pairs.find((p: any) => p.chainId === 'avalanche');
      const price = avaxPair?.priceUsd 
        ? parseFloat(avaxPair.priceUsd)
        : data.pairs[0]?.priceUsd 
          ? parseFloat(data.pairs[0].priceUsd)
          : 0;
      
      // Cache the price
      priceCache[addr] = { price, timestamp: Date.now() };
      return price;
    }
  } catch (e) {
    console.log(`Price fetch error for ${addr}:`, e);
  }
  
  // Cache 0 price to avoid repeated failed requests
  priceCache[addr] = { price: 0, timestamp: Date.now() };
  return 0;
}

// Calculate APY with multiple fallback strategies
export function calculateAPY(params: {
  totalStaked: number;
  remainingRewards: number;
  remainingBlocks: number;
  stakeTokenPrice: number;
  rewardTokenPrice: number;
  isSameToken: boolean;
  rewardPerBlock?: number;
}): { apy: number; type: 'usd' | 'token' | 'rate' | 'none' } {
  const {
    totalStaked,
    remainingRewards,
    remainingBlocks,
    stakeTokenPrice,
    rewardTokenPrice,
    isSameToken,
    rewardPerBlock = 0
  } = params;

  if (remainingBlocks <= 0 || totalStaked <= 0) {
    return { apy: 0, type: 'none' };
  }

  const blocksPerYear = 43200 * 365; // ~2 sec per block on Avalanche

  // Strategy 1: USD-based APY (most accurate when prices available)
  if (stakeTokenPrice > 0 && rewardTokenPrice > 0 && remainingRewards > 0) {
    const stakedValue = totalStaked * stakeTokenPrice;
    const rewardsValue = remainingRewards * rewardTokenPrice;
    
    if (stakedValue > 0 && rewardsValue > 0) {
      const periodReturn = rewardsValue / stakedValue;
      const annualizationFactor = blocksPerYear / remainingBlocks;
      const apy = periodReturn * annualizationFactor * 100;
      return { apy: Math.min(apy, 999999), type: 'usd' };
    }
  }

  // Strategy 2: Token-based APY (when same token is staked and earned)
  if (isSameToken && remainingRewards > 0) {
    const periodReturn = remainingRewards / totalStaked;
    const annualizationFactor = blocksPerYear / remainingBlocks;
    const apy = periodReturn * annualizationFactor * 100;
    return { apy: Math.min(apy, 999999), type: 'token' };
  }

  // Strategy 3: Reward rate based APY
  if (rewardPerBlock > 0) {
    const totalRewardsInPeriod = rewardPerBlock * remainingBlocks;
    
    // If same token, direct calculation
    if (isSameToken) {
      const periodReturn = totalRewardsInPeriod / totalStaked;
      const annualizationFactor = blocksPerYear / remainingBlocks;
      const apy = periodReturn * annualizationFactor * 100;
      return { apy: Math.min(apy, 999999), type: 'rate' };
    }
    
    // Different tokens with prices
    if (stakeTokenPrice > 0 && rewardTokenPrice > 0) {
      const rewardValue = totalRewardsInPeriod * rewardTokenPrice;
      const stakedValue = totalStaked * stakeTokenPrice;
      const periodReturn = rewardValue / stakedValue;
      const annualizationFactor = blocksPerYear / remainingBlocks;
      const apy = periodReturn * annualizationFactor * 100;
      return { apy: Math.min(apy, 999999), type: 'rate' };
    }
  }

  return { apy: 0, type: 'none' };
}

// Hook for individual pool APY calculation
export function usePoolAPY(params: PoolAPYParams | null): PoolAPYResult {
  const [stakeTokenPrice, setStakeTokenPrice] = useState(0);
  const [rewardTokenPrice, setRewardTokenPrice] = useState(0);
  const [remainingRewards, setRemainingRewards] = useState(0);
  const [totalStaked, setTotalStaked] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const isSameToken = params?.stakeTokenAddress.toLowerCase() === params?.rewardTokenAddress.toLowerCase();

  // Fetch prices and remaining rewards
  useEffect(() => {
    if (!params) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      
      try {
        const provider = getProvider();

        // Fetch prices in parallel
        const [stakePriceResult, rewardPriceResult] = await Promise.all([
          fetchTokenPrice(params.stakeTokenAddress),
          isSameToken 
            ? Promise.resolve(0) // Will be set same as stake price
            : fetchTokenPrice(params.rewardTokenAddress)
        ]);

        setStakeTokenPrice(stakePriceResult);
        setRewardTokenPrice(isSameToken ? stakePriceResult : rewardPriceResult);

        // Use provided values or fetch from blockchain
        if (params.rewardVaultBalance !== undefined) {
          setRemainingRewards(parseFloat(params.rewardVaultBalance));
        } else {
          try {
            const rewardToken = new Contract(params.rewardTokenAddress, ERC20_BALANCE_ABI, provider);
            const balance = await rewardToken.balanceOf(params.rewardPoolAddress);
            setRemainingRewards(parseFloat(formatUnits(balance, 18)));
          } catch (e) {
            console.log('Error fetching remaining rewards:', e);
          }
        }

        if (params.totalStaked !== undefined) {
          setTotalStaked(parseFloat(formatUnits(params.totalStaked, 18)));
        }
      } catch (e) {
        console.log('Error in usePoolAPY:', e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [
    params?.poolId,
    params?.stakeTokenAddress,
    params?.rewardTokenAddress,
    params?.rewardPoolAddress,
    params?.totalStaked?.toString(),
    params?.rewardVaultBalance,
    isSameToken
  ]);

  // Calculate APY
  const result = useMemo(() => {
    if (!params || !params.endBlock || params.currentBlock >= params.endBlock) {
      return { apy: 0, apyType: 'none' as const, stakeTokenPrice, rewardTokenPrice, isLoading };
    }

    const remainingBlocks = params.endBlock - params.currentBlock;
    const rewardPerBlock = params.rewardPerBlock ? parseFloat(params.rewardPerBlock) : 0;
    const effectiveTotalStaked = params.totalStaked 
      ? parseFloat(formatUnits(params.totalStaked, 18))
      : totalStaked;

    const { apy, type } = calculateAPY({
      totalStaked: effectiveTotalStaked,
      remainingRewards,
      remainingBlocks,
      stakeTokenPrice,
      rewardTokenPrice,
      isSameToken: !!isSameToken,
      rewardPerBlock
    });

    return { apy, apyType: type, stakeTokenPrice, rewardTokenPrice, isLoading };
  }, [
    params?.endBlock,
    params?.currentBlock,
    params?.totalStaked?.toString(),
    params?.rewardPerBlock,
    remainingRewards,
    stakeTokenPrice,
    rewardTokenPrice,
    totalStaked,
    isSameToken,
    isLoading
  ]);

  return result;
}

// Bulk APY calculation for multiple pools (used in sidebar)
export async function calculateBulkPoolAPYs(
  pools: Array<{
    id: string;
    stakeTokenAddress: string;
    rewardTokenAddress: string;
    rewardPoolAddress: string;
    stakingContractAddress: string;
    endBlock?: number;
  }>,
  currentBlock: number,
  poolTotalStaked: Record<string, bigint>,
  poolRewardRates: Record<string, string>
): Promise<Record<string, { apy: number; type: 'usd' | 'token' | 'rate' | 'none' }>> {
  const provider = getProvider();
  const results: Record<string, { apy: number; type: 'usd' | 'token' | 'rate' | 'none' }> = {};
  
  // Get unique token addresses
  const tokenAddresses = new Set<string>();
  pools.forEach(p => {
    tokenAddresses.add(p.stakeTokenAddress.toLowerCase());
    tokenAddresses.add(p.rewardTokenAddress.toLowerCase());
  });

  // Fetch all prices in parallel
  const prices: Record<string, number> = {};
  await Promise.all(
    Array.from(tokenAddresses).map(async (addr) => {
      prices[addr] = await fetchTokenPrice(addr);
    })
  );

  // Fetch remaining rewards for each pool
  const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'];
  const remainingRewardsMap: Record<string, number> = {};
  
  await Promise.all(
    pools.map(async (pool) => {
      try {
        const rewardToken = new Contract(pool.rewardTokenAddress, ERC20_ABI, provider);
        const balance = await rewardToken.balanceOf(pool.rewardPoolAddress);
        remainingRewardsMap[pool.id] = parseFloat(formatUnits(balance, 18));
      } catch (e) {
        console.log(`Error fetching rewards for pool ${pool.id}:`, e);
        remainingRewardsMap[pool.id] = 0;
      }
    })
  );

  // Calculate APY for each pool
  for (const pool of pools) {
    if (!pool.endBlock || currentBlock >= pool.endBlock) {
      results[pool.id] = { apy: 0, type: 'none' };
      continue;
    }

    const isSameToken = pool.stakeTokenAddress.toLowerCase() === pool.rewardTokenAddress.toLowerCase();
    const stakePrice = prices[pool.stakeTokenAddress.toLowerCase()] || 0;
    const rewardPrice = isSameToken ? stakePrice : (prices[pool.rewardTokenAddress.toLowerCase()] || 0);
    const totalStaked = poolTotalStaked[pool.id] 
      ? parseFloat(formatUnits(poolTotalStaked[pool.id], 18))
      : 0;
    const remainingRewards = remainingRewardsMap[pool.id] || 0;
    const remainingBlocks = pool.endBlock - currentBlock;
    const rewardPerBlock = poolRewardRates[pool.id] ? parseFloat(poolRewardRates[pool.id]) : 0;

    results[pool.id] = calculateAPY({
      totalStaked,
      remainingRewards,
      remainingBlocks,
      stakeTokenPrice: stakePrice,
      rewardTokenPrice: rewardPrice,
      isSameToken,
      rewardPerBlock
    });
  }

  return results;
}
