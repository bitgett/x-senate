# X-Senate: AI-Native Governance Infrastructure for X Layer

> **Hackathon:** OKX × X Layer OnchainOS AI Hackathon 2026
> **Team:** QuackAI
> **Live:** https://x-senate.vercel.app
> **Repo:** https://github.com/bitgett/x-senate
> **Network:** X Layer (OKX L2, chainId 196)

---

## Executive Summary

X-Senate is a permissionless AI governance platform built on X Layer. Any ERC20 project on the network can register and immediately access a full governance stack — automated proposal scanning, five-agent AI senate review, live debate streaming, on-chain execution, and position-based staking with voting power.

The platform's core insight is that most DAOs fail not because token holders don't care, but because governance participation is too slow, too complex, and too easy to manipulate. X-Senate replaces manual human voting with **Genesis 5** — five specialized AI agents that independently analyze every proposal from different angles, then debate and decide by majority vote.

Beyond Genesis 5, **anyone can build their own governance AI agent** using the visual personality builder — choose a focus area, set voting weights with sliders, write a mandate, and register. Your agent earns 3% creator rewards from every delegator.

---

## The Problem

| Problem | How It Manifests |
|---|---|
| Low voter turnout | Most DAO proposals pass with <5% quorum |
| Plutocratic voting | Whales dominate; small holders are irrelevant |
| Flash-loan attacks | Borrow tokens → vote → return, repeat |
| Proposal fatigue | Too many proposals, too little time to research |
| No multi-project governance | Each project builds its own fragmented system |

---

## The Solution

X-Senate provides a **shared AI governance layer** where:

1. **Sentinel AI** continuously monitors community signals and drafts structured proposals
2. **Genesis 5 AI Senate** reviews each proposal from 5 independent analytical perspectives
3. **Relay Debate** lets agents argue sequentially, building on each other's reasoning
4. **On-chain execution** records approved proposals with a verifiable audit trail
5. **Staking with Snapshot VP** prevents flash-stake attacks at the governance layer
6. **Permissionless Registry** lets any X Layer project plug in for 1,000 XSEN
7. **Custom AI Agent Builder** — visual builder to create and register personal governance agents

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Vercel Edge Network                        │
│                  (x-senate.vercel.app)                        │
│                                                              │
│   Next.js 16 App Router                                      │
│   ├── /app/               React UI (9 pages)                 │
│   ├── /app/api/           20+ Serverless API Routes          │
│   └── /lib/               DB · AI Agents · Web3 Helpers      │
│                                                              │
│   Neon Postgres            proposals, agent votes, debates   │
│   Anthropic Claude API     claude-sonnet-4-6 for all AI      │
└──────────────────────────────┬───────────────────────────────┘
                               │  RPC calls (read/write)
┌──────────────────────────────▼───────────────────────────────┐
│                    X Layer  (chainId 196)                     │
│                                                              │
│   XToken.sol           XSEN ERC20 + linear vesting           │
│   XSenateStaking.sol   4-tier position staking + VP          │
│   XSenateGovernor.sol  Multi-tenant AI senate voting         │
│   XSenateRegistry.sol  Permissionless project directory      │
└──────────────────────────────────────────────────────────────┘
```

**Design principles:**
- Single Vercel deployment — frontend, backend API, and database in one project
- No separate backend server — all logic runs in Next.js Serverless Functions
- Contracts are shared across projects — one governor, one registry, per-project staking
- SSE (Server-Sent Events) for real-time streaming — compatible with Vercel's edge runtime
- Global wallet state via React Context — connect once, works across all pages

---

## How It Works — End to End

### Phase 1: Sentinel Scan
The **Sentinel AI** scans community signals (forum posts, Discord messages, governance threads). When a governance keyword threshold is crossed, Claude generates a structured proposal draft: title, summary, motivation, proposed action, and risk analysis.

### Phase 2: Senate Review
The proposal is submitted to the **Genesis 5 AI Senate**. All five agents receive identical proposal data and independently analyze it through their specialized lenses. Votes stream live to the UI via Server-Sent Events — users watch each agent's reasoning and verdict appear in real time.

**Voting rule:** 3 of 5 approvals required to advance. Rejection by 3 or more agents kills the proposal.

### Phase 3: Relay Debate
Approved proposals enter the **Relay Debate**. Agents argue sequentially — each agent reads all prior arguments before responding. This creates a genuine chain of reasoning where agents can rebut, concede, or reinforce positions. The Diplomat agent leads and moderates.

After the debate, each agent's argument is compressed into a one-liner opinion summary.

### Phase 4: On-Chain Execution
Approved proposals are recorded on-chain via `XSenateGovernor.sol`. A Snapshot URL and transaction hash are generated as verifiable proof of governance. Agents then run a **Post-Vote Reflection** — self-critiquing their reasoning based on the outcome.

```
Sentinel → Draft → Senate (5 agents, 3/5 rule) → Debate → Execute → Reflect
```

---

## Genesis 5 AI Agents

| Agent | Analytical Lens | Voting Bias |
|---|---|---|
| **Guardian** | Security, attack vectors, constitutional consistency | Conservative — rejects anything with systemic risk |
| **Merchant** | Tokenomics, TVL impact, fee structures, yield | Aggressive — prioritizes protocol revenue and growth |
| **Architect** | Technical feasibility, smart contract design, timelines | Pragmatic — rejects what cannot actually be built |
| **Diplomat** | Stakeholder relations, ecosystem partnerships, consensus | Collaborative — values long-term coalition building |
| **Populist** | User experience, accessibility, fairness to small holders | Egalitarian — champions the average token holder |

Each agent is powered by `claude-sonnet-4-6` with a distinct system prompt that shapes its personality, priorities, and reasoning style. The chain-of-thought reasoning is visible in the UI, making the governance process fully transparent and auditable.

---

## Custom AI Agent Builder

Beyond Genesis 5, anyone can create and register governance agents:

```
Step 1: Basic Info
  ├── Agent Name (unique)
  └── Focus Area: Security / DeFi / Technical / Community / Ecosystem / Risk / Innovation

Step 2: Personality Builder
  ├── Style: Conservative ←──────────── Progressive (0-100 slider)
  ├── Voting Weights (4 sliders, auto-normalize to 100%):
  │   Security   ████░░  35%
  │   Economics  ██░░░░  20%
  │   Community  ████████ 40%
  │   Technical  ░░░░░░   5%
  └── Mandate: "My agent votes to protect small holders above all else"

Step 3: Preview
  ├── Auto-generated system prompt (collapsible)
  └── Mock vote: "Increase staking reward 15% → Approve / 78% confidence"

Register → POST /api/uga/register
```

Auto-generated system prompt follows Genesis 5 format — the `buildSystemPrompt()` function maps slider values to personality descriptions and voting weight breakdowns.

**Creator rewards:** When a delegator stakes to your agent, 3% additional XSEN flows to you from the ecosystem fund on every reward claim.

---

## Staking System

### 4-Tier Position-Based Staking

| Tier | APY | VP Multiplier | Lock Period | PoP Qualification |
|---|---|---|---|---|
| **Flexible** | 5% | 1.0x | None | Must actively vote or delegate |
| **Lock30** | 10% | 1.1x | 30 days | Automatic |
| **Lock90** | 20% | 1.3x | 90 days | Automatic |
| **Lock180** | 35% | 1.5x | 180 days | Automatic |

- **Position-based:** One wallet can hold multiple positions across different tiers simultaneously
- **Per-second accrual:** Rewards accumulate continuously, claimable at any time
- **7-day unstake cooldown:** Request unstake → 7-day wait → Complete unstake (UI-enforced)
- **Early exit penalty:** Unstaking before lock expiry forfeits all accumulated rewards for that position
- **Staking history:** Full transaction record with timestamps and amounts

### Voting Power (VP)
```
Effective VP = Staked Amount × Tier Multiplier
Example: 1,000 XSEN in Lock90  → 1,300 VP
Example: 1,000 XSEN in Lock180 → 1,500 VP (maximum)
```

### Snapshot VP — Flash-Stake Protection
When a proposal is registered, the governor calls `snapshotForProposal()` on the staking contract. This records each agent's current delegated VP at that moment. All voting uses the **snapshot values** — staking or unstaking after proposal creation has zero effect on that vote outcome.

---

## Smart Contracts

### Deployed Addresses (X Layer Mainnet — chainId 196)

| Contract | Address |
|---|---|
| XToken (XSEN) | `0x1bAB744c4c98D844984e297744Cb6b4E24e2E89b` |
| XSenateStaking | `0x9CD9eF69c4EE176c8115E4BCf6c604Eb46599502` |
| XSenateGovernor | `0xa140f36Cc529e6487b877547A543213aD2ae39dF` |
| XSenateRegistry | `0xFd11e955CCEA6346911F33119B3bf84b3f0E6678` |
| Deployer | `0x8266D8e3B231dfD16fa21e40Cc3B99F38bC4B6C2` |

---

## Pages & Features

| Route | Description | Status |
|---|---|---|
| `/` | Landing page — particle canvas, Genesis 5, animated counters, CTA | ✅ Complete |
| `/app` | Dashboard — proposal feed, submit modal | ✅ Complete |
| `/proposals/[id]` | Proposal detail — senate voting, relay debate, execution, timeline, bottom nav | ✅ Complete |
| `/sentinel` | Sentinel AI scanner, token stats, proposal stats, past proposals table | ✅ Complete |
| `/stake` | 4-tier staking, 7-day cooldown, history, delegation, wallet connect | ✅ Complete |
| `/agents` | AI Agent Hub — Browse Genesis 5 + Create agents + My Agent + Avatar Upload | ✅ Complete |
| `/leaderboard` | 3-tab podium ranking (Agents / Stakers / Governance) with animations | ✅ Complete |
| `/projects` | Multi-tenant registry — project list + registration | ✅ Complete |
| `/onchain` | OKX OnchainOS market data, wallet portfolio *(content distributed to Sentinel/Stake)* | ✅ Complete |

---

## API Routes

| Endpoint | Method | Description |
|---|---|---|
| `/api/proposals` | GET, POST | List proposals, create proposal |
| `/api/proposals/[id]` | GET, DELETE | Single proposal CRUD |
| `/api/proposals/submit` | POST | Manual proposal — Sentinel AI gate |
| `/api/proposals/sentinel/scan` | POST | Run Sentinel AI scan |
| `/api/senate/review/[id]` | GET (SSE) | Senate vote stream |
| `/api/senate/votes/[id]` | GET | Agent vote results |
| `/api/debate/start/[id]` | POST | Start relay debate |
| `/api/debate/stream/[id]` | GET (SSE) | Debate stream |
| `/api/debate/turns/[id]` | GET | Debate turn history |
| `/api/execute/[id]` | POST | Execute approved proposal on-chain |
| `/api/execute/reflect/[id]` | POST | Post-vote reflection |
| `/api/personas` | GET | Genesis 5 agent personas |
| `/api/uga/` | GET | List community agents |
| `/api/uga/register` | POST | Register custom agent (x402: $10 XSEN gate) |
| `/api/proposals/submit` | POST | Manual proposal — Sentinel AI gate (x402: $10 XSEN gate) |
| `/api/x402/quote` | GET | Live XSEN price quote for payment UX |
| `/api/x402/verify` | POST | On-chain receipt verification (ERC20 Transfer check) |
| `/api/registry/projects` | GET, POST | Project list, register project |
| `/api/registry/stats` | GET | Platform-wide statistics |
| `/api/staking/leaderboard` | GET | Agent rankings |
| `/api/onchain/wallet/[addr]/activity` | GET | Staking transaction history |

---

## Completed ✅

| Category | What's Done |
|---|---|
| **Smart Contracts** | All 4 contracts deployed to X Layer mainnet |
| **Staking Design** | 4-tier, snapshot VP, user agents, creator rewards, epoch system |
| **AI Agents** | All 5 Genesis personas with full chain-of-thought |
| **Senate Review** | Live SSE streaming, vote persistence, tally logic |
| **Relay Debate** | Sequential argumentation with SSE streaming |
| **Sentinel** | Community signal scanning, Claude-powered proposal generation, token stats |
| **Execution** | On-chain proposal recording, reflection phase |
| **Multi-tenant** | Registry contract, per-project governance routing |
| **Database** | Neon Postgres — proposals, agent_votes, debate_turns, UGAs |
| **Deployment** | Vercel production live at x-senate.vercel.app |
| **Landing Page** | Particle canvas, scroll reveal, 3D tilt cards, Genesis 5, animated counters |
| **NavBar** | X Layer logo, wallet connect button (global, persistent across all pages) |
| **Wallet Connect** | MetaMask + OKX Wallet with real logos, auto X Layer chain switch |
| **Global Wallet State** | React Context (WalletContext) — connect once, works everywhere |
| **Staking Dashboard** | Stargate-style hero — global stats + personal stats |
| **Unstake** | Flexible tier: instant unstake; Lock tiers: 7-day cooldown (Request → countdown → Complete) |
| **Staking History** | Transaction timestamps, amounts, via OKLink API |
| **Sentinel Redesign** | Full-width, token price card, proposal stats, past proposals table |
| **Custom Agent Builder** | Visual builder with sliders, auto system prompt, mock vote preview |
| **Community Agent Grid** | Browse + delegate UGAs, rank badges (Gold/Silver/Bronze) |
| **My Agent Tab** | Personal agent stats, VP, participation rate |
| **Governance Page** | Full-width layout (removed max-w-4xl) |
| **Sample Proposals** | 3 demo proposals seeded (Approved, Debating, Draft) |
| **Governance Timeline** | 4-step visual timeline on proposal detail (Sentinel→Senate→Debate→Execute) |
| **Proposal Detail Enhancements** | Proposer address, vote tally bar, AgentVoteCard expand/collapse, bottom navigation |
| **Leaderboard** | `/leaderboard` — 3-tab podium: Agents (VP), Stakers (XSEN tokens), Governance (score) |
| **NavBar Leaderboard Link** | Trophy icon with gold shimmer sweep effect, leftmost position |
| **Stake Stats Bar Fix** | Stats bar constrained inside `max-w-5xl mx-auto` to prevent edge overflow |
| **Leaderboard SVG Icons** | Tabs use inline SVG icons (no emoji); medal/crown badges also SVG |
| **Stakers Show Token Count** | Leaderboard Stakers tab displays actual XSEN token count, not VP |
| **x402 Payments — Agent Creation** | `/api/uga/register` requires $10 USD in XSEN; price from OKX Market API |
| **x402 Payments — Proposal Submit** | `/api/proposals/submit` requires $10 USD in XSEN payment gate |
| **Live XSEN Price** | OKX Market API chainIndex=196 for real-time price; fallback $0.01 |
| **XSEN/USDT Pool (V3/Algebra)** | On-chain pool `0xb524efba...` on X Layer; price read via `slot0()` sqrtPriceX96 |
| **Pool Price Calculation** | V3/Algebra pool (not V2) — `getReserves()` reverts; use `slot0()` + sqrtPriceX96 math |
| **Treasury Wallet** | `0x8266...` collects all x402 XSEN payments |
| **x402 Inline Verification** | RPC receipt check inlined in each route (no serverless-to-serverless hop) |
| **Payment Security** | `from_address` validated against Transfer log `topics[1]`; fail-open removed |
| **Sentinel Market Strip** | XSEN price + gas prices shown as pill chips below Sentinel header |
| **Status Normalization** | `normalizeStatus()` maps DB status strings (Draft/In_Senate/Rejected_Senate) to UI canonical keys |
| **Stake Gas Display** | Live gas prices (normal/fast/rapid Gwei) from X Layer RPC `eth_gasPrice` |
| **Stake Portfolio Tab** | My VP tab auto-loads X Layer Portfolio on wallet connect |
| **OKX API Client** | `lib/okx.ts` — shared HMAC-SHA256 auth client for all OKX DEX v6 endpoints |
| **OKX Balance API v6** | `/api/v6/dex/balance/all-token-balances-by-address` + `total-value-by-address` |
| **OKX x402/verify** | `/api/v6/x402/verify` used as primary payment verifier; RPC as fallback |
| **OKX Market Price (auth)** | Authenticated `GET /api/v6/dex/market/price` — top priority price source |
| **Price Source Priority** | okx_market_v6_auth → okx_market_v6 → xlayer_pool → fallback |
| **XSEN Token Logo** | Custom teal hexagon ring SVG; deployed to `/public/xsen-logo.svg` |
| **/onchain Distributed** | /onchain page content distributed: price/gas → Sentinel, portfolio → Stake My VP |
| **NavBar Cleanup** | Removed /onchain link; Projects=05, Activity=06 numbering added |
| **x402 Payment UI** | Agents page: Quote→Pay→Verify→Register step indicator with live XSEN price |
| **x402 Proposal UI** | App page submit: Quote→Pay→Verify→AI Review step indicator |
| **DB Init Order Fix** | ALTER TABLE agent_votes moved after CREATE TABLE (was crashing fresh DB deployments) |
| **Sentinel Timeout Fix** | `maxDuration=60`, Anthropic `timeout:25_000`, client `AbortSignal.timeout(55_000)` |
| **Agents Page fmt() Fix** | Neon Postgres returns NUMERIC as strings; `fmt()` now coerces with `Number()` |

---

## Not Yet Complete ⏳

### 🟡 Medium Priority

| Item | Description |
|---|---|
| **Stake/Unstake TX** | Staking page reads contract data but write transactions need wallet signing |
| **Project registration on-chain** | Registration form UI exists; XSEN approval + tx flow needed |

### 🟢 Nice-to-Have (Post-Hackathon)

| Item | Description |
|---|---|
| Mobile optimization | Current layout is desktop-first |
| Auth boundary | Write routes are currently open — acceptable for demo |

---

## OKX OnchainOS Integration

| API | Usage |
|---|---|
| **X Layer Network** | Deployed on OKX's EVM L2 (chainId 196) |
| **OKX Wallet** | Native wallet connection with auto chain switch |
| **OKX Market API** | Real-time XSEN price (chainIndex=196); ETH price on Sentinel |
| **OKX Wallet API** | Portfolio holdings on Stake My VP tab |
| **OKLink API** | On-chain staking history for wallet activity |

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS |
| API | Next.js Serverless Functions |
| Database | Neon Postgres |
| AI | Anthropic Claude API — claude-sonnet-4-6 |
| Blockchain | X Layer (OKX L2, chainId 196) |
| Smart Contracts | Solidity 0.8.20 |
| Web3 | ethers.js v6 |
| Streaming | Server-Sent Events (SSE) |
| Deployment | Vercel |
| Source | GitHub: bitgett/x-senate |

---

## Hackathon Evaluation Points

### 1. AI Deeply Integrated On-Chain
Five AI agents with distinct personalities vote, debate, and execute governance decisions on X Layer. Every vote, every debate argument, every outcome is recorded on-chain with a verifiable audit trail.

### 2. Multi-Agent Collaboration Architecture
Genesis 5 is a structured multi-agent system — not a single AI giving one answer, but five independent agents with different analytical lenses that must reach 3/5 consensus. The Relay Debate creates genuine agent-to-agent argumentation.

### 3. User-Generated AI Agents
Anyone can build their own governance AI agent using the visual personality builder. Agents compete in a leaderboard, earn creator rewards, and represent their delegators' values — creating a community layer on top of Genesis 5.

### 4. OKX OnchainOS Integration
- Deployed on X Layer mainnet (chainId 196)
- OKX Wallet native connection with logo and auto chain switch
- OKX Market API for live price data
- OKLink API for on-chain transaction history

### 5. Flash-Stake Protection (Novel Mechanism)
Snapshot VP at proposal creation time prevents governance manipulation via token borrowing. This is a meaningful technical contribution to on-chain governance security.

### 6. Permissionless Infrastructure
Any X Layer ERC20 project can register for 1,000 XSEN and immediately access the full governance stack — no whitelist, no approval process.

---

*Last updated: 2026-03-25 | Version: 0.6.0*
