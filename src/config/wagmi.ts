/**
 * AvaLove Token Configuration
 * Arena SDK Only - No WalletConnect/RainbowKit
 */

export const TOKEN_CONTRACT = "0x54eEeB249E3AE445f21eb006DEbB33eFa2B4b3Bb";
export const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";
export const BURN_AMOUNT = "1000";

// ERC20 ABI for transfer function
export const ERC20_ABI = [
  {
    constant: false,
    inputs: [
      { name: "_to", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
] as const;
