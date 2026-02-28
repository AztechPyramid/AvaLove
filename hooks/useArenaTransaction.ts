import { useCallback } from 'react';
import { useWeb3Auth } from './useWeb3Auth';
import { BrowserProvider } from 'ethers';

interface ArenaTransactionParams {
  to: string;
  data: string;
  value?: string;
}

interface TransactionResult {
  success: boolean;
  txHash: string | null;
  error?: string;
}

/**
 * Arena SDK Transaction Hook
 * Uses arenaSDK.provider.accounts[0] directly for transactions as per SDK docs
 */
export const useArenaTransaction = () => {
  const { walletAddress, isConnected, arenaSDK, isArena } = useWeb3Auth();

  /**
   * Get the current wallet address from Arena SDK provider
   * CRITICAL: Use provider.accounts[0] for Arena transactions
   */
  const getArenaAddress = useCallback((): string | null => {
    if (isArena && arenaSDK?.provider?.accounts?.[0]) {
      return arenaSDK.provider.accounts[0];
    }
    return walletAddress;
  }, [isArena, arenaSDK, walletAddress]);

  /**
   * Send transaction using Arena SDK or regular wallet
   * Arena SDK requires: from=provider.accounts[0], gas parameter
   */
  const sendTransaction = useCallback(async (
    params: ArenaTransactionParams
  ): Promise<TransactionResult> => {
    const address = getArenaAddress();
    
    if (!address || !isConnected) {
      return { success: false, txHash: null, error: 'Wallet not connected' };
    }

    try {
      if (isArena && arenaSDK?.provider) {
        // CRITICAL: Use arenaSDK.provider.accounts[0] directly
        const fromAddress = arenaSDK.provider.accounts?.[0];
        
        if (!fromAddress) {
          return { success: false, txHash: null, error: 'Arena wallet address not available' };
        }

        console.log('[ARENA TX] Sending transaction via Arena SDK', {
          to: params.to,
          from: fromAddress,
          dataLength: params.data.length,
          timestamp: Date.now()
        });

        // Arena SDK transaction format as per documentation
        const txHash = await arenaSDK.provider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: fromAddress,
            to: params.to,
            data: params.data,
            value: params.value || '0x0',
            gas: '0x5B8D80' // 6M gas - required for Arena SDK
          }]
        }) as string;

        console.log('[ARENA TX] Transaction confirmed!', { txHash, timestamp: Date.now() });
        return { success: true, txHash };
      } else if ((window as any).ethereum) {
        console.log('[REGULAR TX] Sending transaction via browser wallet');
        
        const provider = new BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        
        const tx = await signer.sendTransaction({
          to: params.to,
          data: params.data,
          value: params.value || '0x0',
        });

        console.log('[REGULAR TX] Transaction sent', { txHash: tx.hash });
        return { success: true, txHash: tx.hash };
      }

      return { success: false, txHash: null, error: 'No wallet provider available' };
    } catch (error: any) {
      console.error('[TX ERROR]', error);
      
      if (error.code === 4001) {
        return { success: false, txHash: null, error: 'Transaction rejected by user' };
      }
      
      return { success: false, txHash: null, error: error.message || 'Transaction failed' };
    }
  }, [isConnected, isArena, arenaSDK, getArenaAddress]);

  /**
   * Send ERC20 transfer (for token burns)
   */
  const sendTokenTransfer = useCallback(async (
    tokenAddress: string,
    toAddress: string,
    amount: bigint
  ): Promise<TransactionResult> => {
    // ERC20 transfer function signature: transfer(address,uint256)
    const functionSelector = '0xa9059cbb';
    const paddedAddress = toAddress.slice(2).padStart(64, '0');
    const paddedAmount = amount.toString(16).padStart(64, '0');
    const data = functionSelector + paddedAddress + paddedAmount;

    return sendTransaction({ to: tokenAddress, data });
  }, [sendTransaction]);

  /**
   * Approve ERC20 token spending (max approval for Arena)
   */
  const approveToken = useCallback(async (
    tokenAddress: string,
    spenderAddress: string,
    amount?: bigint
  ): Promise<TransactionResult> => {
    const MAX_UINT256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const approvalAmount = isArena ? MAX_UINT256 : (amount?.toString(16).padStart(64, '0') || MAX_UINT256);
    
    const functionSelector = '0x095ea7b3'; // approve(address,uint256)
    const paddedSpender = spenderAddress.slice(2).padStart(64, '0');
    const paddedAmount = approvalAmount.startsWith('0x') ? approvalAmount.slice(2) : approvalAmount;
    const data = functionSelector + paddedSpender + paddedAmount;

    return sendTransaction({ to: tokenAddress, data });
  }, [sendTransaction, isArena]);

  return {
    sendTransaction,
    sendTokenTransfer,
    approveToken,
    isArena,
    isConnected,
    walletAddress: getArenaAddress() || walletAddress,
    arenaSDK,
    getArenaAddress,
  };
};
