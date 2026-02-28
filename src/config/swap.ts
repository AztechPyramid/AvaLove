/**
 * Swap Configuration for AvaLove DEX Integration
 * Uses Velora (ParaSwap) as aggregator
 */

// Token addresses on Avalanche C-Chain (ARENA and AVLO only)
export const SWAP_TOKENS = {
  ARENA: {
    address: '0xB8d7710f7d8349A506b75dD184F05777c82dAd0C',
    symbol: 'ARENA',
    name: 'Arena Token',
    decimals: 18,
    logo: '/src/assets/arena-token-logo.jpg',
    isNative: false,
  },
  AVLO: {
    address: '0x54eEeB249E3AE445f21eb006DEbB33eFa2B4b3Bb',
    symbol: 'AVLO',
    name: 'AvaLove Token',
    decimals: 18,
    logo: '/src/assets/avlo-token-logo.jpg',
    isNative: false,
  },
} as const;

export type SwapTokenSymbol = keyof typeof SWAP_TOKENS;

export interface SwapToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logo: string;
  isNative: boolean;
}

// Velora/ParaSwap API configuration
export const VELORA_CONFIG = {
  API_URL: 'https://api.paraswap.io',
  AVALANCHE_CHAIN_ID: 43114,
  DEFAULT_SLIPPAGE: 100, // 1% = 100 basis points
  MAX_SLIPPAGE: 500, // 5% max
  MIN_LIQUIDITY_USD: 1000, // Minimum $1000 liquidity required
  PARTNER_ADDRESS: 'avalove', // Partner ID for referral
};

// GeckoTerminal API for price verification
export const GECKO_TERMINAL_API = 'https://api.geckoterminal.com/api/v2';

// Token approval - max uint256
export const MAX_UINT256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

// ERC20 ABI for swap operations
export const SWAP_ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [
      { name: '_owner', type: 'address' },
      { name: '_spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: 'remaining', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      { name: '_spender', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: 'success', type: 'bool' }],
    type: 'function',
  },
] as const;

// Swap transaction result interface
export interface SwapQuote {
  srcToken: string;
  destToken: string;
  srcAmount: string;
  destAmount: string;
  priceRoute: any;
  gasCost: string;
  priceImpact: number;
  exchangeRate: string;
}

export interface SwapTransaction {
  to: string;
  data: string;
  value: string;
  gasPrice: string;
  gas: string;
}

export interface TokenPrice {
  priceUsd: number;
  liquidity: number;
  verified: boolean;
  lastUpdated: number;
}
