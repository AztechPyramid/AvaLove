import { useState, useEffect, useCallback } from 'react';
import { Contract, JsonRpcProvider, formatUnits } from 'ethers';
import { useWeb3Auth } from './useWeb3Auth';
import { supabase } from '@/integrations/supabase/client';

const AVALANCHE_RPC = "https://api.avax.network/ext/bc/C/rpc";
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

// Fixed USD amount per swipe
const SWIPE_USD_AMOUNT = 0.10;

// Price cache to avoid repeated API calls
const priceCache: Record<string, { price: number; timestamp: number }> = {};
const CACHE_DURATION = 60000; // 1 minute cache

export interface WalletToken {
  id: string;
  token_address: string;
  token_name: string;
  token_symbol: string;
  logo_url: string | null;
  swipe_price: number; // Dynamic: $0.10 worth of tokens
  decimals: number;
  balance: number;
  payment_address: string;
  priceUsd: number;
}

// Fetch token price from GeckoTerminal
const fetchTokenPrice = async (tokenAddress: string): Promise<number> => {
  // Check cache first
  const cached = priceCache[tokenAddress.toLowerCase()];
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.price;
  }

  try {
    const response = await fetch(
      `https://api.geckoterminal.com/api/v2/simple/networks/avax/token_price/${tokenAddress}`,
      { headers: { 'Accept': 'application/json;version=20230203' } }
    );
    if (!response.ok) return 0;
    
    const data = await response.json();
    const prices = data?.data?.attributes?.token_prices || {};
    const priceStr = prices[tokenAddress.toLowerCase()] || prices[tokenAddress];
    
    const price = priceStr ? parseFloat(priceStr) : 0;

    // Cache the price
    priceCache[tokenAddress.toLowerCase()] = { price, timestamp: Date.now() };

    return price;
  } catch (err) {
    console.error(`[WALLET TOKENS] Error fetching price for ${tokenAddress}:`, err);
    return 0;
  }
};

export const useWalletTokenBalances = () => {
  const { walletAddress, isConnected } = useWeb3Auth();
  const [tokens, setTokens] = useState<WalletToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<number>(0);

  const fetchTokenBalances = useCallback(async () => {
    if (!walletAddress || !isConnected) {
      setTokens([]);
      return;
    }

    setIsLoading(true);
    try {
      // Fetch all active payment tokens from platform (approved submissions)
      const { data: paymentTokens, error } = await supabase
        .from('user_token_submissions')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      if (!paymentTokens || paymentTokens.length === 0) {
        setTokens([]);
        return;
      }

      const provider = new JsonRpcProvider(AVALANCHE_RPC);

      // Filter obviously-invalid token addresses early (prevents noisy RPC + price calls)
      const validTokens = paymentTokens
        .map((t) => ({ ...t, token_address: (t.token_address ?? '').trim() }))
        .filter((t) => /^0x[a-fA-F0-9]{40}$/.test(t.token_address));

      const results = await Promise.all(
        validTokens.map(async (token) => {
          try {
            // 1) Price (requires DexScreener liquidity >= $100)
            const priceUsd = await fetchTokenPrice(token.token_address);

            // Skip tokens without price (not on DexScreener or low liquidity)
            if (priceUsd <= 0) {
              console.log(`[WALLET TOKENS] Skipping ${token.token_symbol} - no price on DexScreener`);
              return null;
            }

            // 2) Wallet balance (use on-chain decimals if DB value is missing)
            const contract = new Contract(token.token_address, ERC20_ABI, provider);

            const decimals =
              typeof token.decimals === 'number'
                ? token.decimals
                : await contract.decimals().catch(() => 18);

            const rawBalance = await contract.balanceOf(walletAddress);
            const formattedBalance = parseFloat(formatUnits(rawBalance, decimals));

            // 3) Swipe price: $0.10 worth of tokens
            const swipePrice = SWIPE_USD_AMOUNT / priceUsd;

            // Only include tokens with sufficient balance for at least 1 swipe
            if (formattedBalance < swipePrice) return null;

            const walletToken: WalletToken = {
              id: token.id,
              token_address: token.token_address,
              token_name: token.token_name,
              token_symbol: token.token_symbol,
              logo_url: token.logo_url,
              swipe_price: swipePrice, // Dynamic $0.10 USD equivalent
              decimals,
              balance: formattedBalance,
              payment_address: token.payment_address,
              priceUsd,
            };

            return walletToken;
          } catch (err) {
            console.error(`[WALLET TOKENS] Error checking ${token.token_symbol}:`, err);
            return null;
          }
        })
      );

      // Deduplicate by token address (case-insensitive) – fixes "2'şer görünme" issue from mixed-case rows
      const deduped = new Map<string, WalletToken>();
      for (const t of results) {
        if (!t) continue;
        const key = t.token_address.toLowerCase();
        const existing = deduped.get(key);

        // Prefer higher balance; otherwise keep the first one.
        if (!existing || t.balance > existing.balance) {
          deduped.set(key, t);
        }
      }

      const tokensWithBalance = Array.from(deduped.values()).sort((a, b) =>
        a.token_symbol.localeCompare(b.token_symbol)
      );

      setTokens(tokensWithBalance);
      setLastFetched(Date.now());
      console.log('[WALLET TOKENS] Found tokens with price & balance:', tokensWithBalance.map(t =>
        `${t.token_symbol} ($${t.priceUsd.toFixed(6)}, swipe=${t.swipe_price.toFixed(4)})`
      ));
    } catch (err) {
      console.error('[WALLET TOKENS] Error fetching token balances:', err);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress, isConnected]);

  // Fetch on mount and when wallet changes
  useEffect(() => {
    fetchTokenBalances();
  }, [fetchTokenBalances]);

  // Get a random token from available tokens
  const getRandomToken = useCallback((): WalletToken | null => {
    if (tokens.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * tokens.length);
    return tokens[randomIndex];
  }, [tokens]);

  return {
    tokens,
    isLoading,
    refetch: fetchTokenBalances,
    getRandomToken,
    hasTokens: tokens.length > 0,
    lastFetched,
    swipeUsdAmount: SWIPE_USD_AMOUNT,
  };
};
