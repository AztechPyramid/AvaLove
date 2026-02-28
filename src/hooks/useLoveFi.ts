import { useState, useCallback, useEffect } from 'react';
import { Contract, JsonRpcProvider, formatUnits, parseUnits, Interface } from 'ethers';
import { useArenaTransaction } from './useArenaTransaction';
import { 
  YIELDYAK_STRATEGY_ABI, 
  ERC20_ABI, 
  AVALANCHE_RPC, 
  DeFiStrategy 
} from '@/config/lovefi';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useWalletAuth } from '@/contexts/WalletAuthContext';

// Fallback addresses (used if DB fetch fails)
const FALLBACK_STRATEGIES: Record<string, { strategyContract: string; tokenAddress: string }> = {
  'benqi-usdc': {
    strategyContract: '0xFB692D03BBEA21D8665035779dd3082c2B1622d0',
    tokenAddress: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  },
  'benqi-btcb': {
    strategyContract: '0x8889Da43CeE581068C695A2c256Ba2D514608F4A',
    tokenAddress: '0x152b9d0FdC40C096757F570A51E494bd4b943E50',
  },
};

interface SecurityConfig {
  benqiUsdcStrategy: string;
  benqiBtcbStrategy: string;
  usdcToken: string;
  btcbToken: string;
}

interface StrategyInfo {
  userShares: bigint;
  userDeposits: bigint;
  totalDeposits: bigint;
  totalSupply: bigint;
  depositsEnabled: boolean;
  tokenBalance: bigint;
  tokenAllowance: bigint;
  apy?: number;
}

export interface TxProgressState {
  isOpen: boolean;
  status: 'waiting' | 'processing' | 'success' | 'error';
  message: string;
  txHash: string | null;
  type: 'approval' | 'deposit' | 'withdraw' | null;
}

export function useLoveFi(strategy: DeFiStrategy | null) {
  const { walletAddress, isConnected, sendTransaction, approveToken, isArena } = useArenaTransaction();
  const { profile } = useWalletAuth();
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<StrategyInfo | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [securityConfig, setSecurityConfig] = useState<SecurityConfig>({
    benqiUsdcStrategy: FALLBACK_STRATEGIES['benqi-usdc'].strategyContract,
    benqiBtcbStrategy: FALLBACK_STRATEGIES['benqi-btcb'].strategyContract,
    usdcToken: FALLBACK_STRATEGIES['benqi-usdc'].tokenAddress,
    btcbToken: FALLBACK_STRATEGIES['benqi-btcb'].tokenAddress,
  });
  
  // Transaction progress state
  const [txProgress, setTxProgress] = useState<TxProgressState>({
    isOpen: false,
    status: 'waiting',
    message: '',
    txHash: null,
    type: null
  });

  // Fetch security config from database
  useEffect(() => {
    const fetchSecurityConfig = async () => {
      try {
        const { data, error } = await supabase
          .from('platform_security_config')
          .select('config_key, config_value')
          .in('config_key', ['benqi_usdc_strategy', 'benqi_btcb_strategy', 'usdc_token', 'btcb_token']);

        if (error) {
          console.error('[LoveFi] Failed to fetch security config:', error);
          return;
        }

        if (data && data.length > 0) {
          const configMap: Record<string, string> = {};
          data.forEach((row) => {
            configMap[row.config_key] = row.config_value;
          });

          setSecurityConfig({
            benqiUsdcStrategy: configMap['benqi_usdc_strategy'] || FALLBACK_STRATEGIES['benqi-usdc'].strategyContract,
            benqiBtcbStrategy: configMap['benqi_btcb_strategy'] || FALLBACK_STRATEGIES['benqi-btcb'].strategyContract,
            usdcToken: configMap['usdc_token'] || FALLBACK_STRATEGIES['benqi-usdc'].tokenAddress,
            btcbToken: configMap['btcb_token'] || FALLBACK_STRATEGIES['benqi-btcb'].tokenAddress,
          });
          console.log('[LoveFi] Security config loaded from database');
        }
      } catch (err) {
        console.error('[LoveFi] Exception fetching security config:', err);
      }
    };

    fetchSecurityConfig();
  }, []);

  // Get secure addresses based on strategy
  const getSecureAddresses = useCallback((strategyId: string | undefined) => {
    if (!strategyId) return null;
    
    if (strategyId === 'benqi-usdc') {
      return {
        strategyContract: securityConfig.benqiUsdcStrategy,
        tokenAddress: securityConfig.usdcToken,
      };
    } else if (strategyId === 'benqi-btcb') {
      return {
        strategyContract: securityConfig.benqiBtcbStrategy,
        tokenAddress: securityConfig.btcbToken,
      };
    }
    return null;
  }, [securityConfig]);

  const closeTxProgress = useCallback(() => {
    setTxProgress(prev => ({ ...prev, isOpen: false }));
  }, []);

  const provider = new JsonRpcProvider(AVALANCHE_RPC);

  // Create interfaces for encoding function calls
  const strategyInterface = new Interface(YIELDYAK_STRATEGY_ABI);
  const erc20Interface = new Interface(ERC20_ABI);

  // Fetch strategy info
  const fetchInfo = useCallback(async () => {
    if (!strategy || !walletAddress) return;

    // Use secure addresses from database
    const secureAddrs = getSecureAddresses(strategy.id);
    const strategyContractAddr = secureAddrs?.strategyContract || strategy.strategyContract;
    const tokenAddr = secureAddrs?.tokenAddress || strategy.depositToken.address;

    try {
      const strategyContract = new Contract(strategyContractAddr, YIELDYAK_STRATEGY_ABI, provider);
      const tokenContract = new Contract(tokenAddr, ERC20_ABI, provider);

      const [
        userShares,
        totalDeposits,
        totalSupply,
        depositsEnabled,
        tokenBalance,
        tokenAllowance
      ] = await Promise.all([
        strategyContract.balanceOf(walletAddress),
        strategyContract.totalDeposits(),
        strategyContract.totalSupply(),
        strategyContract.DEPOSITS_ENABLED(),
        tokenContract.balanceOf(walletAddress),
        tokenContract.allowance(walletAddress, strategyContractAddr)
      ]);

      // Calculate user's deposit value from shares
      let userDeposits = BigInt(0);
      if (userShares > 0 && totalSupply > 0) {
        userDeposits = await strategyContract.getDepositTokensForShares(userShares);
      }

      setInfo({
        userShares,
        userDeposits,
        totalDeposits,
        totalSupply,
        depositsEnabled,
        tokenBalance,
        tokenAllowance
      });
    } catch (error) {
      console.error('Error fetching strategy info:', error);
    }
  }, [strategy, walletAddress, getSecureAddresses]);

  useEffect(() => {
    fetchInfo();
  }, [fetchInfo, refreshKey]);

  // Approve token spending
  const approve = useCallback(async () => {
    if (!strategy || !walletAddress) {
      toast.error('Please connect your wallet');
      return false;
    }

    // Use secure addresses from database
    const secureAddrs = getSecureAddresses(strategy.id);
    const strategyContractAddr = secureAddrs?.strategyContract || strategy.strategyContract;
    const tokenAddr = secureAddrs?.tokenAddress || strategy.depositToken.address;

    setLoading(true);
    
    // Show approval waiting popup
    setTxProgress({
      isOpen: true,
      status: 'waiting',
      message: `Please approve ${strategy.depositToken.symbol} spending in your wallet`,
      txHash: null,
      type: 'approval'
    });
    
    try {
      const result = await approveToken(tokenAddr, strategyContractAddr);

      if (result.success) {
        // Show processing state
        setTxProgress({
          isOpen: true,
          status: 'processing',
          message: `Confirming ${strategy.depositToken.symbol} approval on chain...`,
          txHash: result.txHash,
          type: 'approval'
        });
        
        // Wait a bit for the chain to update
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Show success state
        setTxProgress({
          isOpen: true,
          status: 'success',
          message: `${strategy.depositToken.symbol} approved successfully! You can now deposit.`,
          txHash: result.txHash,
          type: 'approval'
        });
        
        setRefreshKey(prev => prev + 1);
        return true;
      } else {
        setTxProgress({
          isOpen: true,
          status: 'error',
          message: result.error || 'Approval failed',
          txHash: null,
          type: 'approval'
        });
        return false;
      }
    } catch (error: any) {
      console.error('Approval error:', error);
      setTxProgress({
        isOpen: true,
        status: 'error',
        message: error.message || 'Approval failed',
        txHash: null,
        type: 'approval'
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [strategy, walletAddress, approveToken, getSecureAddresses]);

  // Record deposit to database for leaderboard
  const recordDeposit = useCallback(async (amount: string, txHash: string) => {
    if (!strategy) {
      console.log('[LoveFi] No strategy selected for recording deposit');
      return;
    }

    if (!walletAddress) {
      console.log('[LoveFi] No wallet address for recording deposit');
      return;
    }

    try {
      console.log('[LoveFi] Recording deposit via backend function:', {
        walletAddress,
        strategy_id: strategy.id,
        amount: parseFloat(amount),
        tx_hash: txHash,
      });

      const { data, error } = await supabase.functions.invoke('lovefi-record-deposit', {
        body: {
          walletAddress,
          strategyId: strategy.id,
          amount: parseFloat(amount),
          txHash,
        },
      });

      if (error) {
        console.error('[LoveFi] Failed to record deposit:', error);
      } else {
        console.log('[LoveFi] Deposit recorded successfully:', data);
      }
    } catch (error) {
      console.error('[LoveFi] Exception recording deposit:', error);
    }
  }, [strategy, walletAddress]);

  // Deposit tokens
  const deposit = useCallback(async (amount: string) => {
    if (!strategy || !walletAddress || !info) {
      toast.error('Please connect your wallet');
      return false;
    }

    if (!info.depositsEnabled) {
      toast.error('Deposits are currently disabled for this strategy');
      return false;
    }

    // Use secure addresses from database
    const secureAddrs = getSecureAddresses(strategy.id);
    const strategyContractAddr = secureAddrs?.strategyContract || strategy.strategyContract;
    const tokenAddr = secureAddrs?.tokenAddress || strategy.depositToken.address;

    const amountBigInt = parseUnits(amount, strategy.depositToken.decimals);

    if (amountBigInt > info.tokenBalance) {
      toast.error(`Insufficient ${strategy.depositToken.symbol} balance`);
      return false;
    }

    // Check allowance and approve if needed
    if (info.tokenAllowance < amountBigInt) {
      // Show approval waiting popup
      setTxProgress({
        isOpen: true,
        status: 'waiting',
        message: `Step 1/2: Please approve ${strategy.depositToken.symbol} spending in your wallet`,
        txHash: null,
        type: 'approval'
      });
      
      setLoading(true);
      try {
        const approvalResult = await approveToken(tokenAddr, strategyContractAddr);

        if (!approvalResult.success) {
          setTxProgress({
            isOpen: true,
            status: 'error',
            message: approvalResult.error || 'Approval failed',
            txHash: null,
            type: 'approval'
          });
          setLoading(false);
          return false;
        }

        // Show processing state for approval
        setTxProgress({
          isOpen: true,
          status: 'processing',
          message: `Step 1/2: Confirming ${strategy.depositToken.symbol} approval...`,
          txHash: approvalResult.txHash,
          type: 'approval'
        });
        
        // Wait for chain to update
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Refresh info after approval
        await fetchInfo();
      } catch (error: any) {
        console.error('Approval error:', error);
        setTxProgress({
          isOpen: true,
          status: 'error',
          message: error.message || 'Approval failed',
          txHash: null,
          type: 'approval'
        });
        setLoading(false);
        return false;
      }
    } else {
      setLoading(true);
    }

    // Now proceed with deposit
    try {
      // Show deposit waiting popup
      setTxProgress({
        isOpen: true,
        status: 'waiting',
        message: `Step 2/2: Please confirm deposit of ${amount} ${strategy.depositToken.symbol}`,
        txHash: null,
        type: 'deposit'
      });

      // Encode deposit function call: deposit(uint256 amount)
      const data = strategyInterface.encodeFunctionData('deposit', [amountBigInt]);

      const result = await sendTransaction({
        to: strategyContractAddr,
        data: data
      });

      if (result.success) {
        // Show processing state for deposit
        setTxProgress({
          isOpen: true,
          status: 'processing',
          message: `Confirming deposit on chain...`,
          txHash: result.txHash,
          type: 'deposit'
        });
        
        // Record deposit to database for leaderboard
        await recordDeposit(amount, result.txHash || '');
        
        // Wait for chain update
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Show success
        setTxProgress({
          isOpen: true,
          status: 'success',
          message: `Successfully deposited ${amount} ${strategy.depositToken.symbol}!`,
          txHash: result.txHash,
          type: 'deposit'
        });
        
        setRefreshKey(prev => prev + 1);
        return true;
      } else {
        setTxProgress({
          isOpen: true,
          status: 'error',
          message: result.error || 'Deposit failed',
          txHash: null,
          type: 'deposit'
        });
        return false;
      }
    } catch (error: any) {
      console.error('Deposit error:', error);
      setTxProgress({
        isOpen: true,
        status: 'error',
        message: error.message || 'Deposit failed',
        txHash: null,
        type: 'deposit'
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [strategy, walletAddress, info, approveToken, sendTransaction, strategyInterface, fetchInfo, recordDeposit, getSecureAddresses]);

  // Withdraw tokens
  const withdraw = useCallback(async (amount: string) => {
    if (!strategy || !walletAddress || !info) {
      toast.error('Please connect your wallet');
      return false;
    }

    // Use secure addresses from database
    const secureAddrs = getSecureAddresses(strategy.id);
    const strategyContractAddr = secureAddrs?.strategyContract || strategy.strategyContract;

    const amountBigInt = parseUnits(amount, strategy.depositToken.decimals);

    // Get shares needed for this amount
    const strategyContractRead = new Contract(strategyContractAddr, YIELDYAK_STRATEGY_ABI, provider);
    const sharesNeeded = await strategyContractRead.getSharesForDepositTokens(amountBigInt);

    if (sharesNeeded > info.userShares) {
      toast.error('Insufficient deposited balance');
      return false;
    }

    setLoading(true);
    try {
      toast.loading('Withdrawing...', { id: 'withdraw' });

      // Encode withdraw function call: withdraw(uint256 shares)
      const data = strategyInterface.encodeFunctionData('withdraw', [sharesNeeded]);

      const result = await sendTransaction({
        to: strategyContractAddr,
        data: data
      });

      if (result.success) {
        toast.success(`Successfully withdrew ${amount} ${strategy.depositToken.symbol}!`, { id: 'withdraw' });
        await new Promise(resolve => setTimeout(resolve, 2000));
        setRefreshKey(prev => prev + 1);
        return true;
      } else {
        toast.error(result.error || 'Withdrawal failed', { id: 'withdraw' });
        return false;
      }
    } catch (error: any) {
      console.error('Withdraw error:', error);
      toast.error(error.message || 'Withdrawal failed', { id: 'withdraw' });
      return false;
    } finally {
      setLoading(false);
    }
  }, [strategy, walletAddress, info, sendTransaction, strategyInterface, getSecureAddresses]);

  // Withdraw all
  const withdrawAll = useCallback(async () => {
    if (!strategy || !walletAddress || !info) {
      toast.error('Please connect your wallet');
      return false;
    }

    if (info.userShares === BigInt(0)) {
      toast.error('No deposited balance to withdraw');
      return false;
    }

    // Use secure addresses from database
    const secureAddrs = getSecureAddresses(strategy.id);
    const strategyContractAddr = secureAddrs?.strategyContract || strategy.strategyContract;

    setLoading(true);
    try {
      toast.loading('Withdrawing all...', { id: 'withdrawAll' });

      // Encode withdraw function call with all user shares
      const data = strategyInterface.encodeFunctionData('withdraw', [info.userShares]);

      const result = await sendTransaction({
        to: strategyContractAddr,
        data: data
      });

      if (result.success) {
        toast.success('Successfully withdrew all funds!', { id: 'withdrawAll' });
        await new Promise(resolve => setTimeout(resolve, 2000));
        setRefreshKey(prev => prev + 1);
        return true;
      } else {
        toast.error(result.error || 'Withdrawal failed', { id: 'withdrawAll' });
        return false;
      }
    } catch (error: any) {
      console.error('Withdraw all error:', error);
      toast.error(error.message || 'Withdrawal failed', { id: 'withdrawAll' });
      return false;
    } finally {
      setLoading(false);
    }
  }, [strategy, walletAddress, info, sendTransaction, strategyInterface, getSecureAddresses]);

  // Format balance for display
  const formatBalance = useCallback((value: bigint | undefined, decimals: number = 6) => {
    if (!value) return '0.00';
    return parseFloat(formatUnits(value, decimals)).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    });
  }, []);

  return {
    info,
    loading,
    approve,
    deposit,
    withdraw,
    withdrawAll,
    refresh: () => setRefreshKey(prev => prev + 1),
    formatBalance,
    isConnected,
    isArena,
    txProgress,
    closeTxProgress
  };
}
