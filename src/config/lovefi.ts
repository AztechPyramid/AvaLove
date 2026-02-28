/**
 * LoveFi DeFi Protocol Configuration
 * Complete contract ABIs and addresses for yield strategies
 */

// YieldYak Strategy Contract ABI
export const YIELDYAK_STRATEGY_ABI = [
  // Read Functions
  { constant: true, inputs: [], name: "ADMIN_FEE_BIPS", outputs: [{ name: "", type: "uint256" }], type: "function" },
  { constant: true, inputs: [], name: "DEPOSITS_ENABLED", outputs: [{ name: "", type: "bool" }], type: "function" },
  { constant: true, inputs: [], name: "DEV_FEE_BIPS", outputs: [{ name: "", type: "uint256" }], type: "function" },
  { constant: true, inputs: [], name: "MAX_TOKENS_TO_DEPOSIT_WITHOUT_REINVEST", outputs: [{ name: "", type: "uint256" }], type: "function" },
  { constant: true, inputs: [], name: "MIN_TOKENS_TO_REINVEST", outputs: [{ name: "", type: "uint256" }], type: "function" },
  { constant: true, inputs: [], name: "REINVEST_REWARD_BIPS", outputs: [{ name: "", type: "uint256" }], type: "function" },
  { constant: true, inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], name: "allowance", outputs: [{ name: "", type: "uint256" }], type: "function" },
  { constant: true, inputs: [{ name: "account", type: "address" }], name: "balanceOf", outputs: [{ name: "", type: "uint256" }], type: "function" },
  { constant: true, inputs: [], name: "checkReward", outputs: [{ name: "", type: "uint256" }], type: "function" },
  { constant: true, inputs: [], name: "decimals", outputs: [{ name: "", type: "uint8" }], type: "function" },
  { constant: true, inputs: [], name: "depositToken", outputs: [{ name: "", type: "address" }], type: "function" },
  { constant: true, inputs: [], name: "estimateDeployedBalance", outputs: [{ name: "", type: "uint256" }], type: "function" },
  { constant: true, inputs: [], name: "estimateReinvestReward", outputs: [{ name: "", type: "uint256" }], type: "function" },
  { constant: true, inputs: [], name: "getActualLeverage", outputs: [{ name: "", type: "uint256" }], type: "function" },
  { constant: true, inputs: [{ name: "amount", type: "uint256" }], name: "getDepositTokensForShares", outputs: [{ name: "", type: "uint256" }], type: "function" },
  { constant: true, inputs: [{ name: "amount", type: "uint256" }], name: "getSharesForDepositTokens", outputs: [{ name: "", type: "uint256" }], type: "function" },
  { constant: true, inputs: [], name: "name", outputs: [{ name: "", type: "string" }], type: "function" },
  { constant: true, inputs: [], name: "owner", outputs: [{ name: "", type: "address" }], type: "function" },
  { constant: true, inputs: [], name: "rewardToken", outputs: [{ name: "", type: "address" }], type: "function" },
  { constant: true, inputs: [], name: "symbol", outputs: [{ name: "", type: "string" }], type: "function" },
  { constant: true, inputs: [], name: "totalDeposits", outputs: [{ name: "", type: "uint256" }], type: "function" },
  { constant: true, inputs: [], name: "totalSupply", outputs: [{ name: "", type: "uint256" }], type: "function" },
  // Write Functions
  { constant: false, inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], name: "approve", outputs: [{ name: "", type: "bool" }], type: "function" },
  { constant: false, inputs: [{ name: "amount", type: "uint256" }], name: "deposit", outputs: [], type: "function" },
  { constant: false, inputs: [{ name: "account", type: "address" }, { name: "amount", type: "uint256" }], name: "depositFor", outputs: [], type: "function" },
  { constant: false, inputs: [], name: "reinvest", outputs: [], type: "function" },
  { constant: false, inputs: [{ name: "amount", type: "uint256" }], name: "withdraw", outputs: [], type: "function" },
  { constant: false, inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], name: "transfer", outputs: [{ name: "", type: "bool" }], type: "function" },
  { constant: false, inputs: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "amount", type: "uint256" }], name: "transferFrom", outputs: [{ name: "", type: "bool" }], type: "function" },
] as const;

// ERC20 ABI for token interactions
export const ERC20_ABI = [
  { constant: true, inputs: [], name: "name", outputs: [{ name: "", type: "string" }], type: "function" },
  { constant: true, inputs: [], name: "symbol", outputs: [{ name: "", type: "string" }], type: "function" },
  { constant: true, inputs: [], name: "decimals", outputs: [{ name: "", type: "uint8" }], type: "function" },
  { constant: true, inputs: [], name: "totalSupply", outputs: [{ name: "", type: "uint256" }], type: "function" },
  { constant: true, inputs: [{ name: "account", type: "address" }], name: "balanceOf", outputs: [{ name: "", type: "uint256" }], type: "function" },
  { constant: true, inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], name: "allowance", outputs: [{ name: "", type: "uint256" }], type: "function" },
  { constant: false, inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], name: "approve", outputs: [{ name: "", type: "bool" }], type: "function" },
  { constant: false, inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], name: "transfer", outputs: [{ name: "", type: "bool" }], type: "function" },
  { constant: false, inputs: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "amount", type: "uint256" }], name: "transferFrom", outputs: [{ name: "", type: "bool" }], type: "function" },
] as const;

// Protocol Definitions
export interface DeFiProtocol {
  id: string;
  name: string;
  description: string;
  logoUrl: string;
  website: string;
  tvl?: string;
  strategies: DeFiStrategy[];
}

export interface DeFiStrategy {
  id: string;
  name: string;
  description: string;
  protocolName: string;
  protocolLogoUrl: string;
  depositToken: {
    address: string;
    symbol: string;
    decimals: number;
    logoUrl: string;
  };
  strategyContract: string;
  apy?: number;
  tvl?: string;
  riskLevel: 'low' | 'medium' | 'high';
  features: string[];
}

// Protocol Logos
export const PROTOCOL_LOGOS = {
  benqi: 'https://imgproxy-mainnet.routescan.io/U9VXukx3X5bPqh-Y0bkluQ6c5IuhB0ncdLp16pwZVq8/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvYmVucWlfdG9rZW5fdGlja2VyX3doaXRlLmJmMWQyZmM4MGRkMy5zdmc',
  aave: 'https://imgproxy-mainnet.routescan.io/xQnAYos0BtnjeFRIaVy3-b2CH_rbX4zu6KKluWxpj8k/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvc21hbGxfQWF2ZV9Ub2tlbl9wbmdfNGU3NmQwNTFiMC5lMTY0YjA0ODE3NTYucG5n',
  joe: 'https://imgproxy-mainnet.routescan.io/VNMAr_yIpPJSOnNTsOmOzNLYmpCOQi7Uph__w4Ws7-g/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvTEZKXzMyLjU1YTJlMTg1NjA5Yy5wbmc',
  yieldyak: '/assets/yieldyak-logo.png'
};

// YieldYak Protocol Configuration
export const YIELDYAK_PROTOCOL: DeFiProtocol = {
  id: 'yieldyak',
  name: 'YieldYak',
  description: 'Auto-compounding yield optimizer on Avalanche. Maximize your returns with automated strategies.',
  logoUrl: PROTOCOL_LOGOS.yieldyak,
  website: 'https://yieldyak.com',
  strategies: []
};

// BenQi USDC Strategy
export const BENQI_USDC_STRATEGY: DeFiStrategy = {
  id: 'benqi-usdc',
  name: 'BenQi USDC',
  description: 'Auto-compounding USDC lending on BenQi protocol. Earn yield on your USDC with automated reinvestment.',
  protocolName: 'BenQi',
  protocolLogoUrl: 'https://imgproxy-mainnet.routescan.io/U9VXukx3X5bPqh-Y0bkluQ6c5IuhB0ncdLp16pwZVq8/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvYmVucWlfdG9rZW5fdGlja2VyX3doaXRlLmJmMWQyZmM4MGRkMy5zdmc',
  depositToken: {
    address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    symbol: 'USDC',
    decimals: 6,
    logoUrl: 'https://imgproxy-mainnet.routescan.io/_CkjIoBgQPOtUj_iXbgW7Af947je2xGUJnwXLMxMhmI/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvdXNkLWNvaW4tdXNkYy1sb2dvLjNiNTk3MmMxNmE5Ny5zdmc'
  },
  strategyContract: '0xFB692D03BBEA21D8665035779dd3082c2B1622d0',
  riskLevel: 'low',
  features: ['Auto-compound', 'Low risk', 'Stablecoin', 'BenQi']
};

// BenQi BTC.b Strategy
export const BENQI_BTCB_STRATEGY: DeFiStrategy = {
  id: 'benqi-btcb',
  name: 'BenQi BTC.b',
  description: 'Auto-compounding BTC.b lending on BenQi protocol. Earn yield on your Bitcoin with automated reinvestment.',
  protocolName: 'BenQi',
  protocolLogoUrl: 'https://imgproxy-mainnet.routescan.io/U9VXukx3X5bPqh-Y0bkluQ6c5IuhB0ncdLp16pwZVq8/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvYmVucWlfdG9rZW5fdGlja2VyX3doaXRlLmJmMWQyZmM4MGRkMy5zdmc',
  depositToken: {
    address: '0x152b9d0FdC40C096757F570A51E494bd4b943E50',
    symbol: 'BTC.b',
    decimals: 8,
    logoUrl: 'https://imgproxy-mainnet.routescan.io/OxAf5qYKdQQppZBG_QoYolSAdZMTGfprsooSFp8pPRg/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvYml0Y29pbmJfMzIuYTlhMmIxOGJhYjQ1LnBuZw'
  },
  strategyContract: '0x8889Da43CeE581068C695A2c256Ba2D514608F4A',
  riskLevel: 'medium',
  features: ['Auto-compound', 'Bitcoin', 'BenQi', 'Leverage']
};

// BenQi USDCn token address (for reference)
export const BENQI_USDCN_ADDRESS = '0xB715808a78F6041E46d61Cb123C9B4A27056AE9C';

// All available strategies
export const ALL_STRATEGIES: DeFiStrategy[] = [
  BENQI_USDC_STRATEGY,
  BENQI_BTCB_STRATEGY,
];

// All protocols with their strategies
export const ALL_PROTOCOLS: DeFiProtocol[] = [
  {
    ...YIELDYAK_PROTOCOL,
    strategies: ALL_STRATEGIES
  }
];

// Avalanche RPC
export const AVALANCHE_RPC = 'https://api.avax.network/ext/bc/C/rpc';

// Max uint256 for approvals
export const MAX_UINT256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
