import { useState, useEffect } from 'react';
import { ArenaAppStoreSdk } from '@the-arena/arena-app-store-sdk';

/**
 * Arena SDK Only - Web3 Authentication Hook
 * 100% Arena SDK compatible - No other wallet support
 * 
 * Using official SDK: https://www.npmjs.com/package/@the-arena/arena-app-store-sdk
 */

// Global singleton for Arena SDK - prevents multiple initializations
let globalArenaSDK: any | null = null;
let globalArenaAddress: string | null = null;
let globalInitPromise: Promise<void> | null = null;
let globalInitialized = false;
let globalIsInArena = false;

// Store all setState functions to update all hook instances when wallet changes
const addressSetters = new Set<(address: string | null) => void>();

const notifyAddressChange = (address: string | null) => {
  globalArenaAddress = address;
  addressSetters.forEach(setter => setter(address));
};

// Detect if running inside Arena app - must be strict to avoid false positives
const detectArenaEnvironment = (): boolean => {
  try {
    // Most reliable: Check if arena SDK global is already present
    const hasArenaGlobal = typeof (window as any).arenaSDK !== 'undefined';
    if (hasArenaGlobal) return true;
    
    // Check for Arena-specific indicators in referrer
    const referrer = document.referrer || '';
    const isArenaReferrer = referrer.includes('starsarena.com') || referrer.includes('arena.social');
    if (isArenaReferrer) return true;
    
    // Check URL params that Arena sets
    const urlParams = new URLSearchParams(window.location.search);
    const hasArenaParams = urlParams.has('arena') || urlParams.has('embedded');
    if (hasArenaParams) return true;
    
    // Check for Arena user agent hints
    const userAgent = navigator.userAgent.toLowerCase();
    const isArenaUA = userAgent.includes('arena');
    if (isArenaUA) return true;
    
    // Check if we're in a cross-origin iframe (Arena embeds apps cross-origin)
    if (window.self !== window.top) {
      try {
        // Try to access parent - if blocked, we're in cross-origin iframe
        const _test = window.parent.location.href;
        // If we get here, it's same origin (Lovable preview) - NOT Arena
        console.log('[Arena SDK] Same-origin iframe detected, not Arena');
        return false;
      } catch (e) {
        // Cross-origin iframe - this IS Arena
        console.log('[Arena SDK] Cross-origin iframe detected, treating as Arena');
        return true;
      }
    }
    
    return false;
  } catch {
    return false;
  }
};

export const useWeb3Auth = () => {
  const [arenaSDK, setArenaSDK] = useState<any | null>(globalArenaSDK);
  const [arenaAddress, setArenaAddress] = useState<string | null>(globalArenaAddress);
  const [isLoading, setIsLoading] = useState(!globalInitialized);
  const [isTransactionPending, setIsTransactionPending] = useState(false);

  // Register this component's setter to receive address updates
  useEffect(() => {
    addressSetters.add(setArenaAddress);
    return () => {
      addressSetters.delete(setArenaAddress);
    };
  }, []);

  useEffect(() => {
    // If already fully initialized, just sync state
    if (globalInitialized) {
      setArenaSDK(globalArenaSDK);
      setArenaAddress(globalArenaAddress);
      setIsLoading(false);
      return;
    }

    // If initialization is in progress, wait for it
    if (globalInitPromise) {
      globalInitPromise.then(() => {
        setArenaSDK(globalArenaSDK);
        setArenaAddress(globalArenaAddress);
        setIsLoading(false);
      }).catch(() => {
        setIsLoading(false);
      });
      return;
    }

    // Create initialization promise (only once)
    globalInitPromise = (async () => {
      // First check if we're actually in Arena
      globalIsInArena = detectArenaEnvironment();
      console.log('[Arena SDK] Environment detection:', { isInArena: globalIsInArena });
      
      if (!globalIsInArena) {
        console.log('[Arena SDK] Not running in Arena environment, skipping SDK init');
        globalInitialized = true;
        return;
      }

      console.log('[Arena SDK] Starting initialization...');

      try {
        const projectId = '0299d75f727f4ded571ce094407cf023';

        // Create SDK instance using inline class
        const sdk = new ArenaAppStoreSdk({
          projectId: projectId,
          metadata: {
            name: 'AvaLove',
            description: 'Web3 Dating dApp on Avalanche',
            url: window.location.origin,
            icons: ['https://pbs.twimg.com/profile_images/1990797365297532928/nZaWasy4_400x400.jpg'],
          },
        });

        console.log('[Arena SDK] SDK created successfully');
        globalArenaSDK = sdk;
        
        // Listen for disconnect events
        sdk.on('disconnect', (error: any) => {
          console.log('[Arena SDK] Disconnected event received:', error?.message);
          notifyAddressChange(null);
          localStorage.removeItem('arena_wallet_address');
        });
        
        // Listen for errors
        sdk.on('error', (error: any) => {
          console.warn('[Arena SDK] Error event:', error?.message || error);
        });

        // Listen for wallet changes
        sdk.on('walletChanged', ({ address }: { address: string | null }) => {
          console.log('[Arena SDK] Wallet changed:', address);
          notifyAddressChange(address);
          if (address) {
            localStorage.setItem('arena_wallet_address', address);
          } else {
            localStorage.removeItem('arena_wallet_address');
          }
        });

        // Wait for provider to be ready
        let retries = 0;
        const maxRetries = 20;
        
        while (!sdk.provider && retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 200));
          retries++;
        }

        if (sdk.provider) {
          console.log('[Arena SDK] Provider ready');
          
          // Get address from provider.accounts[0]
          if (sdk.provider.accounts && sdk.provider.accounts[0]) {
            const address = sdk.provider.accounts[0];
            notifyAddressChange(address);
            console.log('[Arena SDK] Got address:', address);
            localStorage.setItem('arena_wallet_address', address);
          }
        } else {
          console.warn('[Arena SDK] Provider not ready after timeout');
        }

        globalInitialized = true;
      } catch (err: any) {
        console.error('[Arena SDK] Init error:', err?.message || err);
        // Don't crash - just mark as initialized without SDK
        globalInitialized = true;
      }
    })();

    globalInitPromise.then(() => {
      setArenaSDK(globalArenaSDK);
      setArenaAddress(globalArenaAddress);
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });
  }, []);

  /**
   * Connect to Arena SDK provider - checks if already connected
   */
  const ensureConnected = async (): Promise<boolean> => {
    if (!arenaSDK?.provider) {
      console.error('[Arena SDK] No provider available');
      return false;
    }

    // Check if already connected by trying to get accounts
    const accounts = arenaSDK.provider.accounts;
    if (accounts && accounts.length > 0) {
      console.log('[Arena SDK] Already connected:', accounts[0]);
      return true;
    }

    // If no accounts but we have cached address, use that
    if (globalArenaAddress) {
      console.log('[Arena SDK] Using cached address:', globalArenaAddress);
      return true;
    }

    // Only try connect if absolutely no address available
    try {
      console.log('[Arena SDK] No accounts found, attempting connect...');
      await arenaSDK.provider.connect();
      
      if (arenaSDK.provider.accounts?.[0]) {
        const address = arenaSDK.provider.accounts[0];
        notifyAddressChange(address);
        localStorage.setItem('arena_wallet_address', address);
      }
      
      return true;
    } catch (error: any) {
      console.error('[Arena SDK] Connect error:', error?.message || error);
      // Even if connect fails, if we have an address in provider, we're fine
      return !!arenaSDK.provider.accounts?.[0];
    }
  };

  /**
   * Get current wallet address from Arena SDK
   */
  const getWalletAddress = (): string | null => {
    if (arenaSDK?.provider?.accounts?.[0]) {
      return arenaSDK.provider.accounts[0];
    }
    return arenaAddress;
  };

  const walletAddress = getWalletAddress();
  const isConnected = !!walletAddress;

  /**
   * Sign message using Arena SDK
   */
  const signMessage = async (message: string): Promise<string | null> => {
    if (!arenaSDK?.provider || !walletAddress) {
      console.error('[Arena SDK] Cannot sign - no provider or wallet');
      return null;
    }

    // Prefer personal_sign so the backend can verify with ethers.verifyMessage(message, signature)
    try {
      // Most providers expect params: [message, address]
      const signature = await arenaSDK.provider.request({
        method: 'personal_sign',
        params: [message, walletAddress],
      });
      return signature as string;
    } catch (error1: any) {
      // Some providers use the reversed parameter order
      try {
        const signature = await arenaSDK.provider.request({
          method: 'personal_sign',
          params: [walletAddress, message],
        });
        return signature as string;
      } catch (error2: any) {
        // Fallback: eth_sign with hex-encoded message bytes
        try {
          const messageHex =
            '0x' +
            Array.from(new TextEncoder().encode(message))
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('');

          const signature = await arenaSDK.provider.request({
            method: 'eth_sign',
            params: [walletAddress, messageHex],
          });
          return signature as string;
        } catch (error3: any) {
          console.error('[Arena SDK] Message signing failed', {
            personal_sign_error: error1,
            personal_sign_reversed_error: error2,
            eth_sign_error: error3,
          });
          return null;
        }
      }
    }
  };

  /**
   * Send transaction using Arena SDK
   */
  const sendTransaction = async (params: {
    to: string;
    data?: string;
    value?: string;
  }): Promise<string | null> => {
    if (!arenaSDK?.provider) {
      console.error('[Arena SDK] Cannot send tx - no provider');
      return null;
    }

    const fromAddress = arenaSDK.provider.accounts?.[0];
    if (!fromAddress) {
      console.error('[Arena SDK] Cannot send tx - no wallet address');
      return null;
    }

    try {
      console.log('[Arena SDK] Sending transaction', { from: fromAddress, to: params.to });

      const txHash = await arenaSDK.provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: fromAddress,
          to: params.to,
          data: params.data || '0x',
          value: params.value || '0x0',
          gas: '0x5B8D80' // 6M gas
        }]
      }) as string;

      console.log('[Arena SDK] Transaction sent:', txHash);
      return txHash;
    } catch (error: any) {
      console.error('[Arena SDK] Transaction error:', error?.message || error);
      throw error;
    }
  };

  /**
   * Get user profile from Arena
   */
  const getUserProfile = async () => {
    if (!arenaSDK) return null;
    
    try {
      const profile = await arenaSDK.sendRequest("getUserProfile");
      return profile;
    } catch (error) {
      console.error('[Arena SDK] getUserProfile error:', error);
      return null;
    }
  };

  /**
   * Get Arena auth token for API calls
   */
  const getArenaToken = async (): Promise<string | null> => {
    if (!arenaSDK) {
      console.error('[Arena SDK] No SDK available for token request');
      return null;
    }
    
    try {
      // Try to get auth token from Arena SDK
      const token = await arenaSDK.sendRequest("getAuthToken");
      if (token) {
        console.log('[Arena SDK] Got auth token');
        return token;
      }
    } catch (error) {
      console.warn('[Arena SDK] getAuthToken not available, trying alternative methods');
    }

    // Alternative: Try to get JWT token
    try {
      const jwt = await arenaSDK.sendRequest("getJwt");
      if (jwt) {
        console.log('[Arena SDK] Got JWT token');
        return jwt;
      }
    } catch (error) {
      console.warn('[Arena SDK] getJwt not available');
    }

    // Alternative: Try to get access token
    try {
      const accessToken = await arenaSDK.sendRequest("getAccessToken");
      if (accessToken) {
        console.log('[Arena SDK] Got access token');
        return accessToken;
      }
    } catch (error) {
      console.warn('[Arena SDK] getAccessToken not available');
    }

    console.error('[Arena SDK] Could not retrieve auth token');
    return null;
  };

  /**
   * Disconnect wallet (clear local state only)
   */
  const disconnectWallet = () => {
    notifyAddressChange(null);
    localStorage.removeItem('arena_wallet_address');
  };

  /**
   * Connect wallet - Arena handles this automatically
   */
  const connectWallet = async () => {
    console.log('[Arena SDK] connectWallet called - Arena handles connection automatically');
  };

  /**
   * Transaction lock helpers
   */
  const acquireTransactionLock = async (): Promise<boolean> => {
    if (isTransactionPending) return false;
    setIsTransactionPending(true);
    return true;
  };

  const releaseTransactionLock = () => {
    setIsTransactionPending(false);
  };

  return {
    walletAddress,
    isConnected,
    isLoading,
    signMessage,
    sendTransaction,
    getUserProfile,
    getArenaToken,
    disconnectWallet,
    connectWallet,
    ensureConnected,
    arenaSDK,
    isArena: globalIsInArena,
    isTransactionPending,
    acquireTransactionLock,
    releaseTransactionLock,
  };
};
