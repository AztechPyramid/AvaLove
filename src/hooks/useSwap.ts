import { useState, useCallback, useEffect, useMemo } from 'react';
import { useArenaTransaction } from './useArenaTransaction';
import { 
  SWAP_TOKENS, 
  VELORA_CONFIG, 
  GECKO_TERMINAL_API,
  SwapQuote,
  TokenPrice,
  SwapTokenSymbol,
} from '@/config/swap';
import { toast } from 'sonner';
import { JsonRpcProvider, formatUnits, parseUnits, Contract, Interface } from 'ethers';
import { supabase } from '@/integrations/supabase/client';

const AVALANCHE_RPC = 'https://api.avax.network/ext/bc/C/rpc';

// =====================================================================
// FALLBACK SECURITY ADDRESSES (used if DB fetch fails)
// These are hardcoded as a backup layer of security
// =====================================================================
const FALLBACK_YAKSWAP_AGGREGATOR = '0xDE9D7290959b6060860b983b32f2d65b2701EBC2';
const FALLBACK_ARENA_TOKEN = '0xB8d7710f7d8349A506b75dD184F05777c82dAd0C';
const FALLBACK_AVLO_TOKEN = '0x54eEeB249E3AE445f21eb006DEbB33eFa2B4b3Bb';
// WAVAX is allowed as intermediate routing token (not for direct swap)
const FALLBACK_WAVAX_TOKEN = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
// Some routers represent native AVAX with the common placeholder address
const FALLBACK_AVAX_PLACEHOLDER = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const DEFAULT_MAX_STEPS = 4;
const DEFAULT_FEE_ON_INPUT = false;

// YakSwap ABI
const YAKSWAP_ABI = [
  'function quoteYakExactIn(uint256 _amountIn, address _tokenIn, address _tokenOut, uint256 _maxSteps, bool _feeOnInput, address _referrer) view returns (tuple(uint256[] amounts, address[] adapters, address[] path, uint256 gasEstimate) offer, uint256 amountOutAfterFees, uint256 feeAmount, uint256 referrerFeeAmount)',
  'function yakSwapExactTokensForTokens(tuple(uint256 amountIn, uint256 amountOut, address[] path, address[] adapters) _trade, address _to, uint256 _minAmountOut, bool _feeOnInput) external',
];

// ERC20 ABI for balance checks and approvals
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

// =====================================================================
// SECURITY CONFIG INTERFACE
// =====================================================================
interface SwapSecurityConfig {
  yakswapAggregator: string;
  arenaToken: string;
  avloToken: string;
  wavaxToken: string;
  avaxPlaceholder: string;
  allowedTokens: Set<string>;        // Tokens allowed for direct swap (ARENA, AVLO)
  allowedPathTokens: Set<string>;    // Tokens allowed in routing path (includes WAVAX)
  isLoaded: boolean;
}

interface SwapState {
  isLoading: boolean;
  isApproving: boolean;
  isSwapping: boolean;
  quote: SwapQuote | null;
  error: string | null;
  txHash: string | null;
}

interface TokenBalance {
  balance: bigint;
  formatted: string;
}

interface DexPairInfo {
  priceNative: string;
  priceUsd: string;
  liquidity: { usd: number; base: number; quote: number };
  baseToken: { address: string; symbol: string };
  quoteToken: { address: string; symbol: string };
}

export const useSwap = () => {
  const { walletAddress, isConnected, sendTransaction, approveToken, isArena, arenaSDK } = useArenaTransaction();
  const [state, setState] = useState<SwapState>({
    isLoading: false,
    isApproving: false,
    isSwapping: false,
    quote: null,
    error: null,
    txHash: null,
  });

  const [tokenPrices, setTokenPrices] = useState<Record<string, TokenPrice>>({});
  const [balances, setBalances] = useState<Record<string, TokenBalance>>({});
  const [pairInfo, setPairInfo] = useState<DexPairInfo | null>(null);
  
  // =====================================================================
  // SECURITY CONFIG FROM DATABASE
  // =====================================================================
  const [securityConfig, setSecurityConfig] = useState<SwapSecurityConfig>({
    yakswapAggregator: FALLBACK_YAKSWAP_AGGREGATOR,
    arenaToken: FALLBACK_ARENA_TOKEN,
    avloToken: FALLBACK_AVLO_TOKEN,
    wavaxToken: FALLBACK_WAVAX_TOKEN,
    avaxPlaceholder: FALLBACK_AVAX_PLACEHOLDER,
    allowedTokens: new Set([FALLBACK_ARENA_TOKEN.toLowerCase(), FALLBACK_AVLO_TOKEN.toLowerCase()]),
    allowedPathTokens: new Set([
      FALLBACK_ARENA_TOKEN.toLowerCase(),
      FALLBACK_AVLO_TOKEN.toLowerCase(),
      FALLBACK_WAVAX_TOKEN.toLowerCase(),
      FALLBACK_AVAX_PLACEHOLDER.toLowerCase(),
    ]),
    isLoaded: false,
  });

  // Fetch security config from database on mount
  useEffect(() => {
    const fetchSecurityConfig = async () => {
      try {
        // Use platform_security_config table (renamed from swap_security_config)
        const { data, error } = await supabase
          .from('platform_security_config' as any)
          .select('config_key, config_value')
          .eq('is_active', true);

        if (error) {
          console.error('[SWAP] Error fetching security config:', error);
          return;
        }

        if (data && data.length > 0) {
          const configMap = (data as any[]).reduce((acc: Record<string, string>, item: any) => {
            acc[item.config_key] = item.config_value;
            return acc;
          }, {} as Record<string, string>);

          const arenaToken = configMap['arena_token'] || FALLBACK_ARENA_TOKEN;
          const avloToken = configMap['avlo_token'] || FALLBACK_AVLO_TOKEN;
          const wavaxToken = configMap['wavax_token'] || FALLBACK_WAVAX_TOKEN;
          const avaxPlaceholder = configMap['avax_placeholder'] || FALLBACK_AVAX_PLACEHOLDER;

          setSecurityConfig({
            yakswapAggregator: configMap['yakswap_aggregator'] || FALLBACK_YAKSWAP_AGGREGATOR,
            arenaToken,
            avloToken,
            wavaxToken,
            avaxPlaceholder,
            allowedTokens: new Set([arenaToken.toLowerCase(), avloToken.toLowerCase()]),
            // Always keep the known-safe intermediates allowed even if DB config is partial
            allowedPathTokens: new Set([
              arenaToken.toLowerCase(),
              avloToken.toLowerCase(),
              wavaxToken.toLowerCase(),
              FALLBACK_WAVAX_TOKEN.toLowerCase(),
              avaxPlaceholder.toLowerCase(),
              FALLBACK_AVAX_PLACEHOLDER.toLowerCase(),
            ]),
            isLoaded: true,
          });
          
          console.log('[SWAP] Security config loaded from database');
        }
      } catch (err) {
        console.error('[SWAP] Failed to load security config:', err);
      }
    };

    fetchSecurityConfig();
  }, []);

  // =====================================================================
  // SECURITY VALIDATION FUNCTIONS (using DB config)
  // =====================================================================
  const isAllowedToken = useCallback((address: string): boolean => {
    return securityConfig.allowedTokens.has(address.toLowerCase());
  }, [securityConfig.allowedTokens]);

  const validateSwapTokens = useCallback((srcToken: string, destToken: string): void => {
    if (!isAllowedToken(srcToken)) {
      throw new Error(`Source token ${srcToken} is not allowed for swap`);
    }
    if (!isAllowedToken(destToken)) {
      throw new Error(`Destination token ${destToken} is not allowed for swap`);
    }
    if (srcToken.toLowerCase() === destToken.toLowerCase()) {
      throw new Error('Cannot swap token to itself');
    }
  }, [isAllowedToken]);

  // Check if a token is allowed in the routing path (includes WAVAX as intermediate)
  const isAllowedPathToken = useCallback((address: string): boolean => {
    return securityConfig.allowedPathTokens.has(address.toLowerCase());
  }, [securityConfig.allowedPathTokens]);

  const validatePathSecurity = useCallback((path: string[]): void => {
    if (!path || path.length < 2) {
      throw new Error('Invalid swap path');
    }
    // First and last tokens must be ARENA or AVLO (direct swap tokens)
    if (!isAllowedToken(path[0])) {
      throw new Error(`Source token ${path[0]} is not allowed for swap`);
    }
    if (!isAllowedToken(path[path.length - 1])) {
      throw new Error(`Destination token ${path[path.length - 1]} is not allowed for swap`);
    }
    // Intermediate tokens can include WAVAX for routing
    for (let i = 1; i < path.length - 1; i++) {
      if (!isAllowedPathToken(path[i])) {
        throw new Error(`Intermediate token ${path[i]} in path is not allowed`);
      }
    }
  }, [isAllowedToken, isAllowedPathToken]);

  // Fetch AVLO/ARENA pair info from GeckoTerminal
  const fetchPairInfo = useCallback(async () => {
    try {
      const avloAddress = SWAP_TOKENS.AVLO.address;
      const arenaAddress = SWAP_TOKENS.ARENA.address;
      // Fetch both token prices in one call
      const response = await fetch(
        `${GECKO_TERMINAL_API}/simple/networks/avax/token_price/${avloAddress},${arenaAddress}`,
        { headers: { 'Accept': 'application/json;version=20230203' } }
      );
      const data = await response.json();
      const prices = data?.data?.attributes?.token_prices || {};
      
      const avloPrice = parseFloat(prices[avloAddress.toLowerCase()] || '0');
      const arenaPrice = parseFloat(prices[arenaAddress.toLowerCase()] || '0');
      
      if (avloPrice > 0) {
        setPairInfo({
          priceNative: arenaPrice > 0 ? String(avloPrice / arenaPrice) : '0',
          priceUsd: String(avloPrice),
          liquidity: { usd: 0, base: 0, quote: 0 },
          baseToken: { symbol: 'AVLO', address: avloAddress },
          quoteToken: { symbol: 'ARENA', address: arenaAddress },
        });
        return {
          priceNative: arenaPrice > 0 ? String(avloPrice / arenaPrice) : '0',
          priceUsd: String(avloPrice),
          liquidity: { usd: 0, base: 0, quote: 0 },
        };
      }
    } catch (error) {
      console.error('[SWAP] Error fetching pair info:', error);
    }
    return null;
  }, []);

  // Fetch token prices from GeckoTerminal
  const fetchTokenPrices = useCallback(async () => {
    const prices: Record<string, TokenPrice> = {};

    try {
      const avloAddress = SWAP_TOKENS.AVLO.address;
      const arenaAddress = SWAP_TOKENS.ARENA.address;
      const response = await fetch(
        `${GECKO_TERMINAL_API}/simple/networks/avax/token_price/${avloAddress},${arenaAddress}`,
        { headers: { 'Accept': 'application/json;version=20230203' } }
      );
      const data = await response.json();
      const tokenPrices = data?.data?.attributes?.token_prices || {};
      
      const avloPrice = parseFloat(tokenPrices[avloAddress.toLowerCase()] || '0');
      const arenaPrice = parseFloat(tokenPrices[arenaAddress.toLowerCase()] || '0');
      
      if (avloPrice > 0) {
        prices['AVLO'] = {
          priceUsd: avloPrice,
          liquidity: 0,
          verified: true,
          lastUpdated: Date.now(),
        };
      }
      if (arenaPrice > 0) {
        prices['ARENA'] = {
          priceUsd: arenaPrice,
          liquidity: 0,
          verified: true,
          lastUpdated: Date.now(),
        };
      }

      setTokenPrices(prices);
    } catch (error) {
      console.error('[SWAP] Error fetching token prices:', error);
    }
  }, []);

  // Fetch token balances
  const fetchBalances = useCallback(async () => {
    if (!walletAddress) return;

    const provider = new JsonRpcProvider(AVALANCHE_RPC);
    const newBalances: Record<string, TokenBalance> = {};

    try {
      const tokens = ['ARENA', 'AVLO'] as const;
      for (const symbol of tokens) {
        const token = SWAP_TOKENS[symbol];
        try {
          const contract = new Contract(token.address, ERC20_ABI, provider);
          const balance = await contract.balanceOf(walletAddress);
          newBalances[symbol] = {
            balance: balance,
            formatted: formatUnits(balance, token.decimals),
          };
        } catch (err) {
          console.error(`[SWAP] Error fetching ${symbol} balance:`, err);
          newBalances[symbol] = { balance: BigInt(0), formatted: '0' };
        }
      }

      setBalances(newBalances);
    } catch (error) {
      console.error('[SWAP] Error fetching balances:', error);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchTokenPrices();
    if (walletAddress) {
      fetchBalances();
    }
    
    const interval = setInterval(() => {
      fetchTokenPrices();
      if (walletAddress) fetchBalances();
    }, 30000);

    return () => clearInterval(interval);
  }, [walletAddress, fetchTokenPrices, fetchBalances]);

  // Calculate price impact from pair data
  const calculatePriceImpact = useCallback((
    srcToken: SwapTokenSymbol,
    srcAmount: string
  ): number => {
    if (!pairInfo) return 0.5;
    
    const srcAmountFloat = parseFloat(srcAmount);
    if (isNaN(srcAmountFloat) || srcAmountFloat <= 0) return 0.5;

    const liquidity = pairInfo.liquidity?.usd || 0;
    const tradeValueUsd = srcAmountFloat * (tokenPrices[srcToken]?.priceUsd || 0);
    return liquidity > 0 ? Math.min((tradeValueUsd / liquidity) * 100, 50) : 0.5;
  }, [pairInfo, tokenPrices]);

  // Get swap quote using ON-CHAIN quoteYakExactIn
  const getQuote = useCallback(async (
    srcToken: SwapTokenSymbol,
    destToken: SwapTokenSymbol,
    srcAmount: string
  ): Promise<SwapQuote | null> => {
    if (!walletAddress || !srcAmount || srcAmount === '0' || parseFloat(srcAmount) <= 0) {
      return null;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const srcTokenData = SWAP_TOKENS[srcToken];
      const destTokenData = SWAP_TOKENS[destToken];
      
      // SECURITY: Validate tokens before proceeding
      validateSwapTokens(srcTokenData.address, destTokenData.address);
      
      const srcAmountWei = parseUnits(srcAmount, srcTokenData.decimals);

      // Use ON-CHAIN quoteYakExactIn to get exact route with adapters
      const provider = new JsonRpcProvider(AVALANCHE_RPC);
      const yakContract = new Contract(securityConfig.yakswapAggregator, YAKSWAP_ABI, provider);

      const [offer, amountOutAfterFees] = await yakContract.quoteYakExactIn(
        srcAmountWei,
        srcTokenData.address,
        destTokenData.address,
        DEFAULT_MAX_STEPS,
        DEFAULT_FEE_ON_INPUT,
        ZERO_ADDRESS
      );

      if (!amountOutAfterFees || amountOutAfterFees === 0n) {
        throw new Error('No route found for this swap');
      }

      const path = offer.path as string[];
      const adapters = offer.adapters as string[];

      // Debugging: helps distinguish router path vs local validation issues
      console.log('[SWAP] Quote path:', path);

      // SECURITY: Validate the returned path
      validatePathSecurity(path);

      const destAmountFloat = parseFloat(formatUnits(amountOutAfterFees, destTokenData.decimals));
      const srcAmountFloat = parseFloat(srcAmount);
      const exchangeRate = (destAmountFloat / (srcAmountFloat > 0 ? srcAmountFloat : 1)).toFixed(6);
      const priceImpact = calculatePriceImpact(srcToken, srcAmount);

      const quote: SwapQuote = {
        srcToken: srcTokenData.address,
        destToken: destTokenData.address,
        srcAmount: srcAmountWei.toString(),
        destAmount: amountOutAfterFees.toString(),
        priceRoute: {
          dex: 'YakSwap',
          path,
          adapters,
          feeOnInput: DEFAULT_FEE_ON_INPUT,
        },
        gasCost: offer.gasEstimate?.toString() || '0',
        priceImpact,
        exchangeRate,
      };

      setState(prev => ({ ...prev, isLoading: false, quote }));
      return quote;
    } catch (error: any) {
      console.error('[SWAP] Quote error:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error.reason || error.message || 'Failed to get quote' 
      }));
      return null;
    }
  }, [walletAddress, calculatePriceImpact, validateSwapTokens, validatePathSecurity, securityConfig.yakswapAggregator]);

  // Check and approve token allowance
  const checkAndApprove = useCallback(async (
    tokenSymbol: SwapTokenSymbol,
    spenderAddress: string,
    amount: string
  ): Promise<boolean> => {
    const token = SWAP_TOKENS[tokenSymbol];
    
    // SECURITY: Only approve to the DB-configured aggregator
    if (spenderAddress.toLowerCase() !== securityConfig.yakswapAggregator.toLowerCase()) {
      toast.error('Invalid spender address');
      return false;
    }
    
    const provider = new JsonRpcProvider(AVALANCHE_RPC);

    try {
      setState(prev => ({ ...prev, isApproving: true }));

      const contract = new Contract(token.address, ERC20_ABI, provider);
      const currentAllowance = await contract.allowance(walletAddress, spenderAddress);
      const requiredAmount = BigInt(amount);

      if (currentAllowance >= requiredAmount) {
        setState(prev => ({ ...prev, isApproving: false }));
        return true;
      }

      toast.info('Approving token...');
      
      const result = await approveToken(token.address, spenderAddress);
      
      if (!result.success) {
        throw new Error(result.error || 'Approval failed');
      }

      toast.success('Token approved!');
      setState(prev => ({ ...prev, isApproving: false }));
      return true;
    } catch (error: any) {
      console.error('[SWAP] Approval error:', error);
      setState(prev => ({ 
        ...prev, 
        isApproving: false, 
        error: error.message || 'Approval failed' 
      }));
      toast.error(error.message || 'Approval failed');
      return false;
    }
  }, [walletAddress, approveToken, securityConfig.yakswapAggregator]);

  // Check approval status for a token
  const checkApproval = useCallback(async (
    tokenSymbol: SwapTokenSymbol,
    amount: string
  ): Promise<boolean> => {
    const token = SWAP_TOKENS[tokenSymbol];
    const provider = new JsonRpcProvider(AVALANCHE_RPC);
    
    try {
      const contract = new Contract(token.address, ERC20_ABI, provider);
      const currentAllowance = await contract.allowance(walletAddress, securityConfig.yakswapAggregator);
      const requiredAmount = BigInt(amount);
      return currentAllowance >= requiredAmount;
    } catch {
      return false;
    }
  }, [walletAddress, securityConfig.yakswapAggregator]);

  // Approve token (separate step for 2-stage UX)
  const approveSwapToken = useCallback(async (
    tokenSymbol: SwapTokenSymbol
  ): Promise<boolean> => {
    const token = SWAP_TOKENS[tokenSymbol];
    
    setState(prev => ({ ...prev, isApproving: true, error: null }));

    try {
      const result = await approveToken(token.address, securityConfig.yakswapAggregator);
      
      if (!result.success) {
        throw new Error(result.error || 'Approval failed');
      }

      setState(prev => ({ ...prev, isApproving: false }));
      return true;
    } catch (error: any) {
      console.error('[SWAP] Approval error:', error);
      setState(prev => ({ 
        ...prev, 
        isApproving: false, 
        error: error.message || 'Approval failed' 
      }));
      return false;
    }
  }, [approveToken, securityConfig.yakswapAggregator]);

  // Execute swap via YakSwap Aggregator (swap only, approval handled separately)
  // Execute swap via YakSwap Aggregator
  // IMPORTANT: We only return success after the tx is mined and status=1.
  // This prevents showing "success" (and triggering rewards) for reverted swaps.
  const executeSwap = useCallback(async (quote: SwapQuote): Promise<string | null> => {
    if (!walletAddress || !quote) {
      toast.error('No quote available');
      return null;
    }

    setState(prev => ({ ...prev, isSwapping: true, error: null }));

    try {
      // SECURITY: Validate quote tokens
      validateSwapTokens(quote.srcToken, quote.destToken);
      
      const path = quote.priceRoute.path as string[];
      const adapters = quote.priceRoute.adapters as string[];
      
      // SECURITY: Validate path from quote
      validatePathSecurity(path);
      
      if (!adapters || adapters.length !== path.length - 1) {
        throw new Error('Invalid adapters in quote');
      }

      // Calculate minimum output with slippage
      const slippageBps = VELORA_CONFIG.DEFAULT_SLIPPAGE;
      const minOutput = BigInt(quote.destAmount) * BigInt(10000 - slippageBps) / BigInt(10000);

      // Build Trade struct using EXACT path and adapters from on-chain quote
      const trade = {
        amountIn: quote.srcAmount,
        amountOut: quote.destAmount,
        path: path,
        adapters: adapters,
      };

      const iface = new Interface(YAKSWAP_ABI);
      const feeOnInput = quote.priceRoute.feeOnInput ?? DEFAULT_FEE_ON_INPUT;
      
      const txData = iface.encodeFunctionData('yakSwapExactTokensForTokens', [
        trade,
        walletAddress,
        minOutput,
        feeOnInput,
      ]);

      const result = await sendTransaction({
        to: securityConfig.yakswapAggregator,
        data: txData,
        value: '0x0',
      });

      if (!result.success || !result.txHash) {
        throw new Error(result.error || 'Swap failed');
      }

      // Wait for on-chain confirmation. If it reverts, receipt.status will be 0.
      const provider = new JsonRpcProvider(AVALANCHE_RPC);
      const receipt = await provider.waitForTransaction(result.txHash, 1, 120_000).catch(() => null);
      if (!receipt) {
        throw new Error('Transaction pending confirmation. Please wait and try again.');
      }
      if ((receipt as any).status !== 1) {
        throw new Error('Transaction reverted on-chain');
      }

      setState(prev => ({ 
        ...prev, 
        isSwapping: false, 
        txHash: result.txHash 
      }));

      await fetchBalances();
      return result.txHash;
    } catch (error: any) {
      console.error('[SWAP] Swap error:', error);
      setState(prev => ({ 
        ...prev, 
        isSwapping: false, 
        error: error.message || 'Swap failed' 
      }));
      return null;
    }
  }, [walletAddress, sendTransaction, fetchBalances, validateSwapTokens, validatePathSecurity, securityConfig.yakswapAggregator]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const clearQuote = useCallback(() => {
    setState(prev => ({ ...prev, quote: null }));
  }, []);

  return {
    isLoading: state.isLoading,
    isApproving: state.isApproving,
    isSwapping: state.isSwapping,
    quote: state.quote,
    error: state.error,
    txHash: state.txHash,
    tokens: SWAP_TOKENS,
    tokenPrices,
    balances,
    pairInfo,
    getQuote,
    executeSwap,
    approveSwapToken,
    checkApproval,
    clearError,
    clearQuote,
    refreshBalances: fetchBalances,
    refreshPrices: fetchTokenPrices,
    isConnected,
    walletAddress,
    isArena,
  };
};