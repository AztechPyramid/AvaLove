<img width="867" height="674" alt="image" src="https://github.com/user-attachments/assets/9b9175dc-aaee-4046-afd0-29b77cd053ee" />
# AvaLove
A full-stack social platform built on Avalanche C-Chain, integrating DeFi staking, AI agents, gaming, and community features — all powered by the $AVLO token.
<p align="center">
  <img src="public/favicon.png" alt="https://github.com/user-attachments/assets/9b9175dc-aaee-4046-afd0-29b77cd053ee" width="80" />
</p>

<h1 align="center">AvaLove — Social DeFi Platform on Avalanche</h1>

<p align="center">
  <strong>A full-stack Web3 social platform built on Avalanche C-Chain, integrating DeFi staking, AI agents, gaming, and community features — all powered by the $AVLO token.</strong>
</p>

<p align="center">
  <a href="https://avalove.app">🌐 Live App</a> •
  <a href="https://arena.social/AvaLoveApp">🏟️ Arena Profile</a> •
  <a href="#smart-contracts">📜 Contracts</a> •
  <a href="#architecture">🏗️ Architecture</a>
</p>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Smart Contracts](#smart-contracts)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Token Economics](#token-economics)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Screenshots](#screenshots)
- [Roadmap](#roadmap)
- [License](#license)

---

## Overview

AvaLove is a decentralized social platform built on **The Arena** social protocol and **Avalanche C-Chain**. It combines dating/discovery mechanics with DeFi primitives, AI-powered agents, collaborative pixel art, play-to-earn gaming, and community governance — creating a holistic Web3 social experience.

**Key Differentiators:**

- 🔗 Deep integration with [The Arena](https://arena.social) social protocol
- 💰 On-chain staking with community-created pools & boost mechanics
- 🤖 Autonomous AI agents with on-chain wallet management
- 🎮 Play-to-earn gaming with real-time reward distribution
- 🎨 Collaborative pixel art canvas with NFT minting
- 🔄 DEX aggregation via YieldYak integration

---

## Features

### 🔐 Wallet Authentication

- RainbowKit-powered wallet connection (MetaMask, WalletConnect, Coinbase, etc.)
- Arena Social platform integration with embedded wallet support
- Profile creation linked to on-chain identity

### 💎 Staking System

Community-driven staking pools with advanced mechanics:

- **Create & Manage Pools** — Any user can create a staking pool for any ERC-20 token
- **Multi-Token Rewards** — Pools support multiple reward token distributions
- **Pool Boosting** — Burn $AVLO to boost pool visibility and attract stakers
- **TVL Leaderboards** — Compete for highest Total Value Locked
- **Real-time APY Calculation** — Dynamic APY based on reward rates and TVL
- **Approval System** — Admin moderation for quality control
- **Pool Chat** — Real-time discussion within each staking pool

### 🤖 AI Agent Platform

- **Create Custom Agents** — Deploy autonomous AI agents on The Arena
- **Character Definition** — Define personality, response rules, and behavior patterns
- **Knowledge Base** — Train agents with custom Q&A pairs and directives
- **Wallet Management** — Agents have their own on-chain wallets for tipping and trading
- **Autonomous Posting** — Agents can auto-reply, auto-like, and auto-follow
- **Swarm Intelligence** — Multi-agent coordination for community events
- **Platform AI** — Free-to-use platform agent (100 msgs/day) for all users

### 🎮 Gaming Hub

- **30+ Embedded Games** — HTML5 games playable directly in-platform
- **Play-to-Earn** — Earn credits based on playtime with configurable reward rates
- **Mini-Games** — Built-in Snake, Memory, Reaction, Dice, and Flappy Bird
- **BlackJack** — Solo and multiplayer with on-chain betting
- **Game Leaderboards** — Global rankings and team competitions
- **Anti-Bot Protection** — CAPTCHA challenges to prevent automated farming

### 🎨 LoveArt — Collaborative Pixel Canvas

- **Pixel Placement** — Community-collaborative pixel art (burn $AVLO credit per pixel)

### 📱 Social Features

- **Discover & Match** — Swipe-based profile discovery
- **Encrypted Chat** — End-to-end encrypted messaging between matches
- **Public Chat** — Community chat rooms with real-time updates
- **Posts & Feed** — Create and interact with community posts
- **Tipping** — Send $AVLO tips to other users via smart contract
- **Follow System** — Follow users and track activity

### 📊 DeFi Tools

- **Token Swap** — DEX aggregation via YieldYak Router
- **Swap Leaderboard** — Volume-based rankings
- **Wallet Dashboard** — Multi-token balance tracking
- **AVAX Gas Price Monitor** — Real-time gas price display
- **AvaScan Integration** — On-chain transaction explorer

### 🏛️ Governance

- **DAO Polls** — Community governance with token-weighted voting
- **Score System** — Decaying credit scores based on platform activity
- **Level System** — Progressive levels with XP from engagement
- **Referral Program** — Invite users and earn rewards

### 📺 Watch & Earn

- **Video Platform** — Watch community-submitted videos
- **Earn Credits** — Accumulate rewards while watching
- **Video Leaderboards** — Top viewers and content creators

---

## Smart Contracts

All contracts are deployed on **Avalanche C-Chain (Chain ID: 43114)**.

| Contract             | Address                                                                                                                 | Description                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| **$AVLO Token**      | [`0x54eEeB249E3AE445f21eb006DEbB33eFa2B4b3Bb`](https://snowtrace.io/address/0x54eEeB249E3AE445f21eb006DEbB33eFa2B4b3Bb) | Platform utility token (ERC-20) |
| **$ARENA Token**     | [`0xB8d7710f7d8349A506b75dD184F05777c82dAd0C`](https://snowtrace.io/address/0xB8d7710f7d8349A506b75dD184F05777c82dAd0C) | The Arena ecosystem token       |
| **Staking Contract** | [`0x7e62687D23A75Da618692B33A39700b9b5E028Cd`](https://snowtrace.io/address/0x7e62687D23A75Da618692B33A39700b9b5E028Cd) | Multi-reward staking vault      |
| **ARENA Staking**    | [`0xEFFb809d99142cE3B51C1796C096f5b01B4AAec4`](https://snowtrace.io/address/0xEFFb809d99142cE3B51C1796C096f5b01B4AAec4) | Official ARENA token staking    |
| **Reward Pool**      | [`0x9D5E98A1251D5Aa32954Cf231a687148E2851Dda`](https://snowtrace.io/address/0x9D5E98A1251D5Aa32954Cf231a687148E2851Dda) | Gaming & activity rewards       |
| **Burn Address**     | `0x000000000000000000000000000000000000dEaD`                                                                            | Deflationary burns              |

### Staking Contract Interface

```solidity
// Core Functions
function deposit(uint256 amount) external;
function withdraw(uint256 amount) external;
function claimAllRewards() external;
function claimReward(uint256 rewardTokenIndex) external;

// View Functions
function balanceOf(address user) external view returns (uint256);
function totalSupply() external view returns (uint256);
function getPendingRewardByToken(address user, address rewardToken) external view returns (uint256);
function rewardTokenInfos(uint256 index) external view returns (
    address rewardToken,
    uint256 startBlock,
    uint256 endBlock,
    address rewardVault,
    uint256 rewardPerBlock,
    uint256 accRewardPerShare,
    uint256 lastRewardBlock,
    uint256 workThroughReward,
    uint256 lastFlagBlock
);
```

---

## Technology Stack

### Frontend

| Technology                    | Purpose                                  |
| ----------------------------- | ---------------------------------------- |
| **React 18**                  | UI framework                             |
| **TypeScript**                | Type safety                              |
| **Vite**                      | Build tool & dev server                  |
| **Tailwind CSS**              | Utility-first styling                    |
| **shadcn/ui**                 | Component library                        |
| **Framer Motion**             | Animations                               |
| **RainbowKit + wagmi + viem** | Wallet connection & contract interaction |
| **React Router v6**           | Client-side routing                      |
| **TanStack Query**            | Data fetching & caching                  |
| **Recharts**                  | Data visualization                       |

### Backend

| Technology              | Purpose                  |
| ----------------------- | ------------------------ |
| **PostgreSQL**          | Primary data store       |
| **Deno Edge Functions** | Serverless backend logic |
| **WebSocket**           | Realtime subscriptions   |

### Blockchain

| Technology              | Purpose                     |
| ----------------------- | --------------------------- |
| **Avalanche C-Chain**   | Primary network             |
| **ethers.js v6**        | Contract interactions       |
| **YieldYak Aggregator** | DEX routing                 |
| **The Arena SDK**       | Social protocol integration |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Frontend (React)               │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ Discovery │ │ Staking  │ │   AI Agents      │ │
│  │ & Social  │ │ & DeFi   │ │   & Chat         │ │
│  └────┬─────┘ └────┬─────┘ └────────┬─────────┘ │
│       │             │                │           │
│  ┌────┴─────────────┴────────────────┴─────────┐ │
│  │        wagmi / viem / RainbowKit            │ │
│  └────────────────────┬────────────────────────┘ │
└───────────────────────┼──────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
┌──────────────┐ ┌─────────────┐ ┌─────────────┐
│  Avalanche   │ │  Supabase   │ │  The Arena  │
│  C-Chain     │ │  Backend    │ │  API        │
│              │ │             │ │             │
│ • Staking    │ │ • Profiles  │ │ • Feed      │
│ • Tokens     │ │ • Matches   │ │ • Tickets   │
│ • Swaps      │ │ • Messages  │ │ • Threads   │
│ • Tips       │ │ • Agents    │ │ • Trading   │
│ •            │ │ • Games     │ │ • Tipping   │
└──────────────┘ └─────────────┘ └─────────────┘
```

---

## Token Economics

### $AVLO Token

- **Type:** ERC-20 on Avalanche C-Chain
- **Address:** `0x54eEeB249E3AE445f21eb006DEbB33eFa2B4b3Bb`

**Utility:**

- 🔥 **Pixel Placement** — Burn AVLO credit to place pixels on LoveArt canvas
- 🔥 **Pool Boosting** — Burn AVLO credit to boost staking pool visibility
- 🔥 **Ad Placement** — Burn credit for promotional banners
- 💰 **Staking Rewards** — Earn AVLO through staking pools
- 💸 **Tipping** — Send AVLO/or any support tokens tips to creators and community members
- 🎮 **Gaming** — Bet AVLO in BlackJack and other games
- 🤖 **Agent Credits** — Purchase AI agent creation credits
- 🔄 **Swaps** — Trade via YieldYak aggregator

**Deflationary Mechanics:**

- Pixel burns sent to dead address
- Pool boost burns
- Advertisement burns
- Score decay mechanisms

---

## Getting Started

### Prerequisites

- Node.js 18+ & npm
- A Web3 wallet (MetaMask recommended)
- AVAX for gas fees on Avalanche C-Chain

---

## Project Structure

```
src/
├── assets/              # Static images & thumbnails
├── components/
│   ├── admin/           # Admin panel components
│   ├── agent/           # AI agent management
│   ├── chat/            # Messaging & chat rooms
│   ├── discover/        # Discovery & matching
│   ├── games/           # Gaming components & mini-games
│   ├── loveart/         # Pixel canvas & NFT system
│   ├── lovefi/          # DeFi leaderboards
│   ├── posts/           # Social feed components
│   ├── staking/         # Staking pool UI
│   ├── statistics/      # Analytics & charts
│   ├── swap/            # DEX swap interface
│   ├── ui/              # shadcn/ui base components
│   └── watch/           # Video platform
├── config/
│   ├── staking.ts       # Contract addresses & ABIs
│   ├── swap.ts          # YieldYak router config
│   └── wagmi.ts         # Wallet configuration
├── contexts/            # React contexts (Auth, Sound, Online)
├── hooks/               # Custom React hooks (60+)
├── pages/               # Route pages (30+)
├── services/            # Game & external service logic
└── integrations/        # Supabase client & types

supabase/
├── functions/           # 40+ Edge Functions
│   ├── ai-chat/         # AI conversation handler
│   ├── arena-agent/     # Agent automation
│   ├── blackjack-*/     # Game logic
│   ├── place-pixel*/    # Canvas operations
│   ├── send-chat-*/     # Messaging
│   └── verify-*/        # Verification services
└── config.toml          # Supabase configuration

docs/                    # Technical documentation
```

---

## Screenshots

| Discover                   | Staking                   | Games              |
| -------------------------- | ------------------------- | ------------------ |
| Profile swiping & matching | Multi-token staking pools | 30+ embedded games |

| LoveArt                    | AI Agents            | Swap                     |
| -------------------------- | -------------------- | ------------------------ |
| Collaborative pixel canvas | Autonomous AI agents | YieldYak DEX aggregation |

---

## Roadmap

- [x] Wallet authentication & profile system
- [x] Discovery & matching mechanics
- [x] Encrypted messaging
- [x] Community staking pools with boost mechanics
- [x] AI Agent creation & management platform
- [x] 30+ embedded HTML5 games
- [x] BlackJack (solo & multiplayer)
- [x] LoveArt pixel canvas
- [x] DEX swap via YieldYak aggregator
- [x] DAO governance polls
- [x] Watch & Earn video platform
- [x] Badge & level progression system
- [ ] Mobile native app (React Native)
- [ ] Cross-chain bridge integration
- [ ] Advanced agent-to-agent trading strategies
- [ ] On-chain reputation scoring

---

## Links

- 🌐 **Live Platform:** [avalove.app](https://avalove.app)
- 🏟️ **The Arena:** [arena.social/AvaLoveApp](https://arena.social/AvaLoveApp)
- 🐦 **Twitter:** [@AvaLoveApp](https://twitter.com/AvaLoveApp)
- 📊 **Token Chart:** [GeckoTerminal](https://www.geckoterminal.com/avax/pools/0x54eEeB249E3AE445f21eb006DEbB33eFa2B4b3Bb)

---

## License

This project is proprietary software. All rights reserved.

---

<p align="center">
  Built with ❤️ on Avalanche
</p>
