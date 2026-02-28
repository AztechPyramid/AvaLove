import { useEffect, useState } from 'react';
import { Contract, BrowserProvider, formatUnits, parseUnits } from 'ethers';
import { 
  STAKING_ABI,
  ERC20_ABI 
} from '@/config/staking';
import { useStakingHistory } from './useStakingHistory';
import { useWeb3Auth } from './useWeb3Auth';

export interface TransactionProgress {
  isOpen: boolean;
  status: "waiting" | "processing" | "success" | "error";
  message: string;
  txHash?: string | null;
  tokenLogo?: string | null;
  tokenSymbol?: string;
  successTitle?: string;
}

interface StakingPool {
  id: string;
  title: string;
  staking_contract_address: string;
  stake_token_address: string;
  reward_token_address: string;
  reward_pool_address: string;
  stake_token_logo: string;
  reward_token_logo: string;
  is_active: boolean;
}

export const useStaking = (pool: StakingPool) => {
  const { walletAddress, isConnected, arenaSDK, isArena } = useWeb3Auth();
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const { recordTransaction } = useStakingHistory();

  // Balances
  const [stakeTokenBalance, setStakeTokenBalance] = useState('0');
  const [stakedBalance, setStakedBalance] = useState('0');
  const [totalSupply, setTotalSupply] = useState('0');
  const [pendingRewards, setPendingRewards] = useState('0');
  const [allowance, setAllowance] = useState('0');
  const [rewardVaultAddress, setRewardVaultAddress] = useState<string | null>(null);
  const [rewardVaultBalance, setRewardVaultBalance] = useState('0');
  const [poolStartBlock, setPoolStartBlock] = useState<number | null>(null);
  const [poolEndBlock, setPoolEndBlock] = useState<number | null>(null);
  const [currentBlock, setCurrentBlock] = useState<number | null>(null);
  const [rewardPerBlock, setRewardPerBlock] = useState('0');

  // Loading states
  const [isApproving, setIsApproving] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  // Success states
  const [approveSuccess, setApproveSuccess] = useState(false);
  const [depositSuccess, setDepositSuccess] = useState(false);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);

  // Transaction progress
  const [txProgress, setTxProgress] = useState<TransactionProgress>({
    isOpen: false,
    status: "waiting",
    message: "",
    txHash: null,
    tokenLogo: pool?.stake_token_logo || null,
    tokenSymbol: 'TOKEN',
    successTitle: 'Staked! 🎉',
  });

  // Get provider for read operations (Arena SDK compatible)
  const getProvider = async () => {
    if (isArena && arenaSDK?.provider) {
      // Use Arena SDK provider with ethers BrowserProvider
      const provider = new BrowserProvider(arenaSDK.provider);
      return provider;
    }
    // Fallback to public RPC for read-only operations
    const { JsonRpcProvider } = await import('ethers');
    return new JsonRpcProvider('https://api.avax.network/ext/bc/C/rpc');
  };

  // Fetch all balances
  const fetchBalances = async () => {
    if (!walletAddress || !isConnected || !pool) return;

    try {
      const provider = await getProvider();

      const stakeToken = new Contract(pool.stake_token_address, ERC20_ABI, provider);
      const rewardToken = new Contract(pool.reward_token_address, ERC20_ABI, provider);
      const stakingContract = new Contract(pool.staking_contract_address, STAKING_ABI, provider);

      // Get current block number
      const blockNumber = await provider.getBlockNumber();
      setCurrentBlock(blockNumber);

      // First get reward vault address and block info from rewardTokenInfos(0)
      let vaultAddress = pool.reward_pool_address; // fallback
      try {
        const rewardInfo = await stakingContract.rewardTokenInfos(0);
        // rewardInfo structure: [rewardToken, startBlock, endBlock, rewardVault, rewardPerBlock, ...]
        if (rewardInfo) {
          if (rewardInfo[1]) setPoolStartBlock(Number(rewardInfo[1]));
          if (rewardInfo[2]) setPoolEndBlock(Number(rewardInfo[2]));
          if (rewardInfo[3]) {
            vaultAddress = rewardInfo[3];
            setRewardVaultAddress(vaultAddress);
          }
          // Get rewardPerBlock for accurate APY calculation
          if (rewardInfo[4]) {
            setRewardPerBlock(formatUnits(rewardInfo[4], 18));
          }
        }
      } catch (err) {
        console.log('Could not fetch rewardTokenInfos, using reward_pool_address:', err);
      }

      const [stakeBalance, staked, total, pending, allow, vaultBalance] = await Promise.all([
        stakeToken.balanceOf(walletAddress),
        stakingContract.balanceOf(walletAddress),
        stakingContract.totalSupply(),
        stakingContract.getPendingRewardByToken(walletAddress, pool.reward_token_address),
        stakeToken.allowance(walletAddress, pool.staking_contract_address),
        rewardToken.balanceOf(vaultAddress),
      ]);

      setStakeTokenBalance(formatUnits(stakeBalance, 18));
      setStakedBalance(formatUnits(staked, 18));
      setTotalSupply(formatUnits(total, 18));
      setPendingRewards(formatUnits(pending, 18));
      setAllowance(formatUnits(allow, 18));
      setRewardVaultBalance(formatUnits(vaultBalance, 18));
    } catch (error) {
      console.error('Error fetching balances:', error);
    }
  };

  // Fetch on mount and when wallet changes
  useEffect(() => {
    fetchBalances();
  }, [walletAddress, isConnected, refetchTrigger, pool?.id]);

  // Auto-refetch every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchBalances, 10000);
    return () => clearInterval(interval);
  }, [walletAddress, isConnected]);

  const approve = async (amount: string, showProgress = true) => {
    if (!walletAddress) return;

    setIsApproving(true);
    setApproveSuccess(false);
    
    try {
      const provider = await getProvider();
      const stakeToken = new Contract(pool.stake_token_address, ERC20_ABI, provider);
      
      // Use MAX_UINT256 for Arena to avoid multiple approval popups
      const MAX_UINT256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      const amountWei = isArena ? MAX_UINT256 : parseUnits(amount, 18);

      if (isArena && arenaSDK?.provider) {
        // CRITICAL: Use arenaSDK.provider.accounts[0] directly for Arena SDK
        const arenaAddress = arenaSDK.provider.accounts?.[0];
        if (!arenaAddress) throw new Error('Arena wallet not connected');
        
        console.log('[STAKING] Using Arena SDK for approve with provider.accounts[0]', { arenaAddress });

        // Arena: NO popup before transaction, only show success/error

        const functionData = stakeToken.interface.encodeFunctionData('approve', [pool.staking_contract_address, amountWei]);

        const txHash = await arenaSDK.provider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: arenaAddress,
            to: pool.stake_token_address,
            data: functionData,
            value: '0x0',
            gas: '0x5B8D80' // 6M gas for Arena SDK
          }]
        }) as string;
        
        console.log('[STAKING] ✅ Approval confirmed!', { txHash });

        if (showProgress) {
          setTxProgress({
            isOpen: true,
            status: "success",
            message: "Tokens approved!",
            txHash: txHash,
          });
        }
      } else {
        if (showProgress) {
          setTxProgress({
            isOpen: true,
            status: "waiting",
            message: "Waiting for approval...",
            txHash: null,
          });
        }

        const tx = await stakeToken.approve(pool.staking_contract_address, amountWei);
        
        if (showProgress) {
          setTxProgress({
            isOpen: true,
            status: "processing",
            message: "Approval processing...",
            txHash: tx.hash,
          });
        }

        await tx.wait();

        if (showProgress) {
          setTxProgress({
            isOpen: true,
            status: "success",
            message: "Tokens approved!",
            txHash: tx.hash,
          });
        }
      }
      
      setApproveSuccess(true);
      await fetchBalances();
    } catch (error: any) {
      console.error('Approve error:', error);
      if (showProgress) {
        setTxProgress({
          isOpen: true,
          status: "error",
          message: error.message || "Approval failed",
          txHash: null,
        });
      }
      throw error;
    } finally {
      setIsApproving(false);
      if (showProgress) {
        setTimeout(() => {
          setTxProgress({ isOpen: false, status: "waiting", message: "", txHash: null });
        }, 2000);
      }
    }
  };

  const deposit = async (amount: string) => {
    if (!walletAddress) return;

    setIsDepositing(true);
    setDepositSuccess(false);
    
    try {
      const amountWei = parseUnits(amount, 18);
      const currentAllowance = parseUnits(allowance, 18);

      // Check if approval is needed
      if (currentAllowance < amountWei) {
        console.log('[STAKING] Insufficient allowance, approving first...');

        setTxProgress({
          isOpen: true,
          status: "waiting",
          message: "Step 1/2: Approving tokens...",
          txHash: null,
          tokenLogo: pool.stake_token_logo,
          tokenSymbol: 'STAKE',
          successTitle: 'Staked! 🎉',
        });

        await approve(amount, false);
        await new Promise(resolve => setTimeout(resolve, 2000));
        await fetchBalances();

        setTxProgress({
          isOpen: true,
          status: "waiting",
          message: "Step 2/2: Depositing...",
          txHash: null,
          tokenLogo: pool.stake_token_logo,
          tokenSymbol: 'STAKE',
          successTitle: 'Staked! 🎉',
        });
      }

      const provider = await getProvider();
      const stakingContract = new Contract(pool.staking_contract_address, STAKING_ABI, provider);

      let txHash: string;

      if (isArena && arenaSDK?.provider) {
        // CRITICAL: Use arenaSDK.provider.accounts[0] directly for Arena SDK
        const arenaAddress = arenaSDK.provider.accounts?.[0];
        if (!arenaAddress) throw new Error('Arena wallet not connected');
        
        console.log('[STAKING] Using Arena SDK for deposit with provider.accounts[0]', { arenaAddress });

        // Arena: NO popup before transaction, only show success/error

        const functionData = stakingContract.interface.encodeFunctionData('deposit', [amountWei]);

        txHash = await arenaSDK.provider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: arenaAddress,
            to: pool.staking_contract_address,
            data: functionData,
            value: '0x0',
            gas: '0x5B8D80' // 6M gas for Arena SDK
          }]
        }) as string;

        console.log('[STAKING] ✅ Deposit confirmed!', { txHash });
        
        setTxProgress({
          isOpen: true,
          status: "success",
          message: "Tokens staked successfully!",
          txHash: txHash,
          tokenLogo: pool.stake_token_logo,
          tokenSymbol: 'STAKE',
          successTitle: 'Staked! 🎉',
        });
      } else {
        setTxProgress({
          isOpen: true,
          status: "waiting",
          message: "Confirm in wallet...",
          txHash: null,
          tokenLogo: pool.stake_token_logo,
          tokenSymbol: 'STAKE',
          successTitle: 'Staked! 🎉',
        });

        const tx = await stakingContract.deposit(amountWei);
        
        setTxProgress({
          isOpen: true,
          status: "processing",
          message: "Staking in progress...",
          txHash: tx.hash,
          tokenLogo: pool.stake_token_logo,
          tokenSymbol: 'STAKE',
          successTitle: 'Staked! 🎉',
        });

        await tx.wait();

        setTxProgress({
          isOpen: true,
          status: "success",
          message: "Tokens staked successfully!",
          txHash: tx.hash,
          tokenLogo: pool.stake_token_logo,
          tokenSymbol: 'STAKE',
          successTitle: 'Staked! 🎉',
        });

        txHash = tx.hash;
      }
      
      await recordTransaction('deposit', amount, 'STAKE', txHash, pool.id);
      setDepositSuccess(true);
      await fetchBalances();
    } catch (error: any) {
      console.error('Deposit error:', error);
      setTxProgress({
        isOpen: true,
        status: "error",
        message: error.message || "Deposit failed",
        txHash: null,
      });
      throw error;
    } finally {
      setIsDepositing(false);
      setTimeout(() => {
        setTxProgress({ isOpen: false, status: "waiting", message: "", txHash: null });
      }, 3000);
    }
  };

  const withdraw = async (amount: string) => {
    if (!walletAddress) return;

    setIsWithdrawing(true);
    setWithdrawSuccess(false);
    
    try {
      const provider = await getProvider();
      const stakingContract = new Contract(pool.staking_contract_address, STAKING_ABI, provider);
      const amountWei = parseUnits(amount, 18);

      let txHash: string;

      if (isArena && arenaSDK?.provider) {
        // CRITICAL: Use arenaSDK.provider.accounts[0] directly for Arena SDK
        const arenaAddress = arenaSDK.provider.accounts?.[0];
        if (!arenaAddress) throw new Error('Arena wallet not connected');
        
        console.log('[STAKING] Using Arena SDK for withdraw with provider.accounts[0]', { arenaAddress });

        // Arena: NO popup before transaction, only show success/error

        const functionData = stakingContract.interface.encodeFunctionData('withdraw', [amountWei]);

        txHash = await arenaSDK.provider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: arenaAddress,
            to: pool.staking_contract_address,
            data: functionData,
            value: '0x0',
            gas: '0x5B8D80' // 6M gas for Arena SDK
          }]
        }) as string;

        console.log('[STAKING] ✅ Withdraw confirmed!', { txHash });
        
        setTxProgress({
          isOpen: true,
          status: "success",
          message: "Tokens unstaked successfully!",
          txHash: txHash,
          tokenLogo: pool.stake_token_logo,
          tokenSymbol: 'STAKE',
          successTitle: 'Unstaked! 💰',
        });
      } else {
        setTxProgress({
          isOpen: true,
          status: "waiting",
          message: "Confirm in wallet...",
          txHash: null,
          tokenLogo: pool.stake_token_logo,
          tokenSymbol: 'STAKE',
          successTitle: 'Unstaked! 💰',
        });

        const tx = await stakingContract.withdraw(amountWei);
        
        setTxProgress({
          isOpen: true,
          status: "processing",
          message: "Unstaking in progress...",
          txHash: tx.hash,
          tokenLogo: pool.stake_token_logo,
          tokenSymbol: 'STAKE',
          successTitle: 'Unstaked! 💰',
        });

        await tx.wait();

        setTxProgress({
          isOpen: true,
          status: "success",
          message: "Tokens unstaked successfully!",
          txHash: tx.hash,
          tokenLogo: pool.stake_token_logo,
          tokenSymbol: 'STAKE',
          successTitle: 'Unstaked! 💰',
        });

        txHash = tx.hash;
      }
      
      await recordTransaction('withdraw', amount, 'STAKE', txHash, pool.id);
      setWithdrawSuccess(true);
      await fetchBalances();
    } catch (error: any) {
      console.error('Withdraw error:', error);
      setTxProgress({
        isOpen: true,
        status: "error",
        message: error.message || "Withdraw failed",
        txHash: null,
      });
      throw error;
    } finally {
      setIsWithdrawing(false);
      setTimeout(() => {
        setTxProgress({ isOpen: false, status: "waiting", message: "", txHash: null });
      }, 3000);
    }
  };

  const claimRewards = async () => {
    if (!walletAddress) return;

    setIsClaiming(true);
    setClaimSuccess(false);
    
    try {
      const provider = await getProvider();
      const stakingContract = new Contract(pool.staking_contract_address, STAKING_ABI, provider);
      
      let txHash: string;

      if (isArena && arenaSDK?.provider) {
        // CRITICAL: Use arenaSDK.provider.accounts[0] directly for Arena SDK
        const arenaAddress = arenaSDK.provider.accounts?.[0];
        if (!arenaAddress) throw new Error('Arena wallet not connected');
        
        console.log('[STAKING] Using Arena SDK for claim with provider.accounts[0]', { arenaAddress });

        // Arena: NO popup before transaction, only show success/error

        const functionData = stakingContract.interface.encodeFunctionData('claimAllRewards', []);

        txHash = await arenaSDK.provider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: arenaAddress,
            to: pool.staking_contract_address,
            data: functionData,
            value: '0x0',
            gas: '0x5B8D80' // 6M gas for Arena SDK
          }]
        }) as string;

        console.log('[STAKING] ✅ Claim confirmed!', { txHash });
        
        setTxProgress({
          isOpen: true,
          status: "success",
          message: "Rewards claimed successfully!",
          txHash: txHash,
          tokenLogo: pool.reward_token_logo,
          tokenSymbol: 'REWARD',
          successTitle: 'Claimed! 🎁',
        });
      } else {
        setTxProgress({
          isOpen: true,
          status: "waiting",
          message: "Confirm in wallet...",
          txHash: null,
          tokenLogo: pool.reward_token_logo,
          tokenSymbol: 'REWARD',
          successTitle: 'Claimed! 🎁',
        });

        const tx = await stakingContract.claimAllRewards();
        
        setTxProgress({
          isOpen: true,
          status: "success",
          message: "Rewards claimed successfully!",
          txHash: tx.hash,
          tokenLogo: pool.reward_token_logo,
          tokenSymbol: 'REWARD',
          successTitle: 'Claimed! 🎁',
        });

        txHash = tx.hash;
      }
      
      await recordTransaction('claim', pendingRewards, 'REWARD', txHash, pool.id);
      setClaimSuccess(true);
      await fetchBalances();
    } catch (error: any) {
      console.error('Claim error:', error);
      setTxProgress({
        isOpen: true,
        status: "error",
        message: error.message || "Claim failed",
        txHash: null,
      });
      throw error;
    } finally {
      setIsClaiming(false);
      setTimeout(() => {
        setTxProgress({ isOpen: false, status: "waiting", message: "", txHash: null });
      }, 3000);
    }
  };

  return {
    // Balances (formatted)
    stakeTokenBalance,
    stakedBalance,
    totalSupply,
    pendingRewards,
    allowance,
    rewardVaultAddress,
    rewardVaultBalance,
    poolStartBlock,
    poolEndBlock,
    currentBlock,
    rewardPerBlock,
    
    // Actions
    approve,
    deposit,
    withdraw,
    claimRewards,
    
    // Loading states
    isApproving,
    isDepositing,
    isWithdrawing,
    isClaiming,
    
    // Success states
    approveSuccess,
    depositSuccess,
    withdrawSuccess,
    claimSuccess,
    
    // Transaction progress
    txProgress,
    setTxProgress,
    
    // Refetch trigger
    refetchTrigger,
  };
};
