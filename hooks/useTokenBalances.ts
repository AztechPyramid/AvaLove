import { useState, useEffect } from 'react';
import { Contract, JsonRpcProvider, formatUnits } from 'ethers';
import { ARENA_TOKEN_ADDRESS, AVLO_TOKEN_ADDRESS, ERC20_ABI } from '@/config/staking';
import { useWeb3Auth } from './useWeb3Auth';

const AVALANCHE_RPC = "https://api.avax.network/ext/bc/C/rpc";

export const useTokenBalances = (customWalletAddress?: string) => {
  const { walletAddress: connectedAddress, isConnected } = useWeb3Auth();
  const targetAddress = customWalletAddress || connectedAddress;
  
  const [balances, setBalances] = useState({
    avlo: '0',
    arena: '0',
  });
  const [isLoading, setIsLoading] = useState(false);

  const fetchBalances = async () => {
    if (!targetAddress) {
      console.log('[TOKEN BALANCE] No target address available');
      return;
    }
    
    console.log('[TOKEN BALANCE] Fetching balances for:', targetAddress);
    
    setIsLoading(true);
    try {
      // Always use Avalanche RPC directly for token balances
      const provider = new JsonRpcProvider(AVALANCHE_RPC);
      console.log('[TOKEN BALANCE] Using Avalanche RPC provider');
      console.log('[TOKEN BALANCE] Token addresses - AVLO:', AVLO_TOKEN_ADDRESS, 'ARENA:', ARENA_TOKEN_ADDRESS);
      
      const avloToken = new Contract(AVLO_TOKEN_ADDRESS, ERC20_ABI, provider);
      const arenaToken = new Contract(ARENA_TOKEN_ADDRESS, ERC20_ABI, provider);

      const [avloBalance, arenaBalance] = await Promise.all([
        avloToken.balanceOf(targetAddress),
        arenaToken.balanceOf(targetAddress),
      ]);

      console.log('[TOKEN BALANCE] Raw balances - AVLO:', avloBalance.toString(), 'ARENA:', arenaBalance.toString());

      const formattedAvlo = formatUnits(avloBalance, 18);
      const formattedArena = formatUnits(arenaBalance, 18);

      console.log('[TOKEN BALANCE] Formatted balances - AVLO:', formattedAvlo, 'ARENA:', formattedArena);
      
      setBalances({
        avlo: formattedAvlo,
        arena: formattedArena,
      });
    } catch (error) {
      console.error('[TOKEN BALANCE] Error fetching token balances:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, [targetAddress, isConnected]);

  // Auto-refetch every 60 seconds (was 10s - reduced for cost)
  useEffect(() => {
    if (!targetAddress) return;
    const interval = setInterval(fetchBalances, 60000);
    return () => clearInterval(interval);
  }, [targetAddress, isConnected]);

  return {
    avloBalance: balances.avlo,
    arenaBalance: balances.arena,
    refetchBalances: fetchBalances,
    hasBalances: targetAddress !== undefined,
    isLoading,
  };
};
