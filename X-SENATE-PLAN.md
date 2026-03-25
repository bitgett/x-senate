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

This is not a single-project tool. It is shared infrastructure. Every project that joins strengthens the ecosystem, and the platform fee flows directly back to XSEN stakers.

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

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Vercel Edge Network                        │
│                  (x-senate.vercel.app)                        │
│                                                              │
│   Next.js 16 App Router                                      │
│   ├── /app/               React UI (7 pages)                 │
│   ├── /app/api/           18 Serverless API Routes           │
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
- **Early exit penalty:** Unstaking before lock expiry forfeits all accumulated rewards for that position
- **Minimum stake:** 100 XSEN per position

### Proof of Participation (PoP)
Flexible stakers must prove participation to claim rewards. PoP is satisfied by:
- Delegating a position to any registered agent
- Casting a direct governance vote

Lock30, Lock90, and Lock180 stakers automatically qualify — commitment is the participation.

### Voting Power (VP)
```
Effective VP = Staked Amount × Tier Multiplier
Example: 1,000 XSEN in Lock90  → 1,300 VP
Example: 1,000 XSEN in Lock180 → 1,500 VP (maximum)
```

**Design rationale:** Multipliers are intentionally modest (max 1.5x). Long-term staking is rewarded, but governance power should reflect economic stake, not just lock duration.

### Snapshot VP — Flash-Stake Protection
When a proposal is registered, the governor calls `snapshotForProposal()` on the staking contract. This records each agent's current delegated VP at that moment. All voting uses the **snapshot values** — not current live values. Staking or unstaking after proposal creation has zero effect on that vote outcome.

### Epoch System
- 30-day epochs
- Each epoch has a dedicated reward pool funded from the treasury
- Agent voting records reset at epoch boundary
- Agent leaderboard rankings update at epoch end

### Agent Delegation & Leaderboard
Users delegate their staking positions to registered agents. Delegated VP accumulates on the agent, determining their leaderboard rank.

**Top 5 agents ranked: 1st · 2nd · 3rd · 4th · 5th**

### User Agent Creator Rewards
Beyond the Genesis 5 platform agents, **anyone can register a custom AI agent**:

- Register with a name — no fee, permissionless
- Users delegate staking VP to your agent
- When a delegator claims their staking reward, **3% additional** is credited to the agent creator from the ecosystem fund
- The delegator receives **100% of their reward** — the creator bonus is additive, not a cut

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

### XToken.sol
Standard ERC20 with linear vesting schedule support.
```
Total Supply:  100,000,000 XSEN
Extra:         createVesting(), releaseVested(), releasableAmount()
```

### XSenateStaking.sol
Core staking logic. Position-based, multi-tier, with full snapshot VP and agent system.

Key functions:
```solidity
stake(amount, tier)                   // Create new position
unstake(positionId)                   // Close position (penalty if early)
claimReward(positionId)               // Claim accrued rewards
claimAllRewards()                     // Claim across all positions
delegatePosition(positionId, agent)   // Delegate VP to agent
snapshotForProposal(proposalId)       // Lock agent VP at proposal creation
registerGenesisAgent(name)            // Owner: add Genesis 5 agent
registerUserAgent(name)               // Anyone: register custom agent
claimCreatorReward(agentName)         // Agent creator: withdraw earnings
getEffectiveVP(address)               // Total VP for a wallet
```

### XSenateGovernor.sol
Multi-tenant governance hub. One contract serves all registered projects.

### XSenateRegistry.sol
Permissionless project directory. Registration fee: 1,000 XSEN → XSEN ecosystem fund.

---

## Manual Proposal Submission

Any token holder can submit a proposal manually via Sentinel AI gate:

1. User fills in: title, summary, motivation, proposed action, risks
2. Sentinel AI scores 0–100 and decides `approved: true/false`
3. **Rejected:** 422 with score, feedback, concerns — not saved
4. **Approved:** saved as `Draft`, user must stake 1,000 XSEN and call `registerProposal()` on-chain

---

## Multi-Tenant Platform

```
1. Deploy your ERC20 token on X Layer
2. X-Senate deploys a dedicated XSenateStaking contract for your token
3. Pay 1,000 XSEN registration fee
4. Your project is live in the registry
5. Your token holders can stake, earn, and govern
6. Genesis 5 AI senate reviews your proposals
```

---

## Pages & Features

| Route | Description | Status |
|---|---|---|
| `/` | Landing page — particle canvas, Genesis 5, animated counters, CTA | ✅ Complete |
| `/app` | Dashboard — proposal feed, submit modal | ✅ Complete |
| `/proposals/[id]` | Proposal detail — senate voting, relay debate, execution | ✅ Complete |
| `/proposals/[id]/senate` | Live senate vote stream (SSE) | ✅ Complete |
| `/proposals/[id]/debate` | Relay debate stream (SSE) | ✅ Complete |
| `/proposals/[id]/execute` | On-chain execution + reflection | ✅ Complete |
| `/sentinel` | Sentinel AI scanner | ✅ Complete |
| `/stake` | Staking dashboard — Stargate-style hero, wallet connect, delegate | ✅ Complete |
| `/projects` | Platform directory — registered projects + registration form | ✅ Complete |
| `/onchain` | OKX OnchainOS market data, wallet, contract state | ✅ Complete |

---

## API Routes (18 Serverless Functions)

| Endpoint | Method | Description |
|---|---|---|
| `/api/proposals` | GET, POST | List proposals, create proposal |
| `/api/proposals/[id]` | GET, DELETE | Single proposal CRUD |
| `/api/proposals/submit` | GET, POST | Manual proposal — Sentinel AI gate |
| `/api/proposals/sentinel/scan` | POST | Run Sentinel AI scan |
| `/api/senate/review/[id]` | POST | Trigger senate vote (SSE stream) |
| `/api/senate/votes/[id]` | GET | Agent vote results |
| `/api/debate/start/[id]` | POST | Start relay debate |
| `/api/debate/stream/[id]` | GET | Debate SSE stream |
| `/api/execute/[id]` | POST | Execute approved proposal on-chain |
| `/api/staking/tiers` | GET | Tier configuration |
| `/api/staking/epoch` | GET | Current epoch info |
| `/api/staking/totals` | GET | TVL, total VP |
| `/api/staking/leaderboard` | GET | Agent rankings |
| `/api/staking/positions/[addr]` | GET | Wallet positions |
| `/api/staking/vp/[addr]` | GET | Effective VP for address |
| `/api/registry/projects` | GET, POST | Project list, register project |
| `/api/registry/projects/[id]` | GET | Project detail |
| `/api/registry/stats` | GET | Platform-wide statistics |

---

## Completed ✅

| Category | What's Done |
|---|---|
| **Smart Contracts** | All 4 contracts deployed to X Layer mainnet |
| **Contract Addresses** | XToken, Staking, Governor, Registry live on chainId 196 |
| **Staking Design** | 4-tier, snapshot VP, user agents, creator rewards, epoch system |
| **AI Agents** | All 5 Genesis personas with full chain-of-thought |
| **Senate Review** | Live SSE streaming, vote persistence, tally logic |
| **Relay Debate** | Sequential argumentation with SSE streaming |
| **Sentinel** | Community signal scanning, Claude-powered proposal generation |
| **Execution** | On-chain proposal recording, reflection phase |
| **Multi-tenant** | Registry contract, per-project governance routing |
| **Database** | Neon Postgres — proposals, agent_votes, debate_turns |
| **Deployment** | Vercel production live at x-senate.vercel.app |
| **Landing Page** | Particle canvas, scroll reveal, 3D tilt cards, Genesis 5, animated counters |
| **Header** | Redesigned with X Layer logo SVG, chronological nav (01–04), active state |
| **Staking Dashboard** | Stargate-style hero — global stats + personal stats side by side |
| **Wallet Connect** | MetaMask + OKX Wallet selection modal, auto X Layer chain switch |
| **Delegate UI** | One-click agent delegation from stake page with live VP display |
| **VP Multiplier Bar** | Visual progress bar showing 1.0x–1.5x range per tier |
| **Manual Proposals** | Sentinel AI gate with score/feedback/rejection flow |
| **Proposal Threshold** | 1,000 XSEN enforced off-chain (API) + on-chain (Governor) |
| **Environment Variables** | All contract addresses + NEXT_PUBLIC_ vars set in Vercel |
| **Documentation** | README, X-SENATE-PLAN.md, architecture docs |

---

## Not Yet Complete ⏳

### 🟡 Medium Priority

| Item | Description |
|---|---|
| **Stake/Unstake TX** | Staking page reads contract data but cannot write stake/unstake yet |
| **Project registration on-chain** | Registration form UI exists; XSEN approval + tx flow needed |
| **OKX x402 Payments** | x402 payment protocol for platform fees not yet integrated |
| **IPFS upload** | Proposal content stored in DB; on-chain IPFS hash not yet pinned |

### 🟢 Nice-to-Have (Post-Hackathon)

| Item | Description |
|---|---|
| Mobile optimization | Current layout is desktop-first |
| OKX Market API on stake page | Real-time XSEN price feed |
| Auth boundary | Write routes are currently open — acceptable for demo |

---

## OKX OnchainOS Integration

| API | Usage |
|---|---|
| **Market API** | Real-time ETH/OKB price, K-line data on `/onchain` page |
| **Wallet API** | Portfolio holdings for any address on X Layer |
| **OKX Wallet** | Native wallet connection on staking page |

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS |
| API | Next.js Serverless Functions (18 routes) |
| Database | Neon Postgres (Vercel Storage integration) |
| AI | Anthropic Claude API — claude-sonnet-4-6 |
| Blockchain | X Layer (OKX L2, chainId 196) |
| Smart Contracts | Solidity 0.8.20, Hardhat 3 |
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

### 3. OKX OnchainOS Integration
- Deployed on X Layer mainnet (chainId 196)
- OKX Market API for live price data
- OKX Wallet API for portfolio tracking
- OKX Wallet native connection on stake page

### 4. Flash-Stake Protection (Novel Mechanism)
Snapshot VP at proposal creation time prevents governance manipulation via token borrowing. This is a meaningful technical contribution to on-chain governance security.

### 5. Permissionless Infrastructure
Any X Layer ERC20 project can register for 1,000 XSEN and immediately access the full governance stack — no whitelist, no approval process.

### 6. Creator Economy for AI Agents
Anyone can build and register a governance AI agent, earn 3% creator rewards from delegators, and compete in the agent leaderboard — aligning incentives for better governance outcomes.

---

*Last updated: 2026-03-25 | Version: 0.3.0*
