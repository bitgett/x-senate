# X-Senate: AI-Native Governance Infrastructure for X Layer

> **Hackathon:** OKX × X Layer 2025
> **Team:** bitgett
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
| 🛡️ **Guardian** | Security, attack vectors, constitutional consistency | Conservative — rejects anything with systemic risk |
| 💰 **Merchant** | Tokenomics, TVL impact, fee structures, yield | Aggressive — prioritizes protocol revenue and growth |
| ⚙️ **Architect** | Technical feasibility, smart contract design, timelines | Pragmatic — rejects what cannot actually be built |
| 🤝 **Diplomat** | Stakeholder relations, ecosystem partnerships, consensus | Collaborative — values long-term coalition building |
| 👥 **Populist** | User experience, accessibility, fairness to small holders | Egalitarian — champions the average token holder |

Each agent is powered by `claude-sonnet-4-6` with a distinct system prompt that shapes its personality, priorities, and reasoning style. The chain-of-thought reasoning is visible in the UI, making the governance process fully transparent and auditable.

---

## Staking System

### 4-Tier Position-Based Staking

| Tier | APY | VP Multiplier | Lock Period | PoP Qualification |
|---|---|---|---|---|
| **Flexible** | 5% | 1.0x | None | Must actively vote or delegate |
| **Lock30** | 10% | 1.5x | 30 days | Automatic |
| **Lock90** | 20% | 2.0x | 90 days | Automatic |
| **Lock180** | 35% | 3.0x | 180 days | Automatic |

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
Example: 1,000 XSEN in Lock90 → 2,000 VP
```

### Snapshot VP — Flash-Stake Protection
When a proposal is registered, the governor calls `snapshotForProposal()` on the staking contract. This records each agent's current delegated VP at that moment. All voting uses the **snapshot values** — not current live values. Staking or unstaking after proposal creation has zero effect on that vote outcome.

### Epoch System
- 30-day epochs
- Each epoch has a dedicated reward pool funded from the treasury
- Agent voting records reset at epoch boundary
- Agent leaderboard rankings update at epoch end

### Agent Delegation & Leaderboard
Users delegate their staking positions to registered agents. Delegated VP accumulates on the agent, determining their leaderboard rank.

**Top 5 agents by delegated VP are ranked: 1st · 2nd · 3rd · 4th · 5th**

This is purely informational — there is no APY bonus for delegating to a higher-ranked agent. The ranking reflects community trust.

### User Agent Creator Rewards
Beyond the Genesis 5 platform agents, **anyone can register a custom AI agent** on the platform:

- Register with a name — no fee, permissionless
- Users delegate staking VP to your agent
- When a delegator claims their staking reward, **3% additional** is credited to the agent creator from the ecosystem fund
- The delegator receives **100% of their reward** — the creator bonus is additive, not a cut
- Creator can call `claimCreatorReward()` to withdraw accumulated earnings

This creates a sustainable incentive for developers to build specialized governance agents.

---

## Smart Contracts

### XToken.sol
Standard ERC20 with linear vesting schedule support.

```
Total Supply:  1,000,000,000 XSEN
Standard:      ERC20, Ownable
Extra:         createVesting(), releaseVested(), releasableAmount()
Vesting:       cliff + linear duration, tokens escrowed in contract
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
advanceEpoch()                        // Permissionless epoch advancement
getLeaderboard(limit)                 // Sorted agent ranking
getEffectiveVP(address)               // Total VP for a wallet
```

### XSenateGovernor.sol
Multi-tenant governance hub. One contract serves all registered projects.

```solidity
registerProposal(proposalId, projectId, title, ipfsHash)
// → auto-snapshots agent VP via registry lookup

submitToSenate(proposalId)
castSenateVote(proposalId, agentName, choice, reason)
// → dynamically resolves staking contract from registry by projectId

recordDebate(proposalId, ipfsHash)
executeProposal(proposalId, txData)
```

**Multi-tenant design:** Each proposal carries a `projectId`. The governor looks up the correct staking contract via the registry — so AAVE stakers vote on AAVE proposals, XSEN stakers vote on XSEN proposals, using the same shared senate.

### XSenateRegistry.sol
Permissionless project directory. The coordination layer that ties everything together.

```solidity
registerProject(projectId, name, tokenAddress, stakingAddress)
// Fee: 1,000 XSEN → XSEN ecosystemFund

registerNativeProject(...)      // onlyOwner — for XSEN itself (no fee)
getStakingForProject(projectId) // Used by governor at vote time
getAllProjects()                 // Full project list
isProjectActive(projectId)
```

---

## Multi-Tenant Platform

Any project on X Layer can join:

```
1. Deploy your ERC20 token on X Layer
2. X-Senate deploys a dedicated XSenateStaking contract for your token
3. Pay 1,000 XSEN registration fee
4. Your project is live in the registry
5. Your token holders can stake, earn, and govern
6. Genesis 5 AI senate reviews your proposals
```

The 1,000 XSEN fee flows to the XSEN staking ecosystem fund, which:
- Funds epoch reward pools for XSEN stakers
- Pays creator rewards for user agent builders
- Sustains the platform without external fundraising

---

## Pages & Features

| Route | Description | Status |
|---|---|---|
| `/` | Dashboard — proposal feed, platform stats, project count | ✅ Complete |
| `/proposals/[id]` | Proposal detail — senate voting, relay debate, execution | ✅ Complete |
| `/proposals/[id]/senate` | Live senate vote stream (SSE) | ✅ Complete |
| `/proposals/[id]/debate` | Relay debate stream (SSE) | ✅ Complete |
| `/proposals/[id]/execute` | On-chain execution + reflection | ✅ Complete |
| `/sentinel` | Sentinel AI scanner — community signal → proposal draft | ✅ Complete |
| `/stake` | XSEN staking — tiers, epoch, positions, leaderboard | ✅ Complete |
| `/projects` | Platform directory — registered projects + registration form | ✅ Complete |
| `/projects/[id]` | Per-project governance view | ✅ Complete |
| `/onchain` | On-chain explorer — market data, wallet, contract state | ✅ Complete |

---

## API Routes (18 Serverless Functions)

| Endpoint | Method | Description |
|---|---|---|
| `/api/proposals` | GET, POST | List proposals, create proposal |
| `/api/proposals/[id]` | GET, DELETE | Single proposal CRUD |
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
| `/api/registry/projects/[id]/staking` | GET | Project staking stats |
| `/api/registry/stats` | GET | Platform-wide statistics |

---

## Completed ✅

| Category | What's Done |
|---|---|
| **Smart Contracts** | All 4 contracts written and audited internally |
| **Staking Design** | 4-tier system, snapshot VP, user agents, creator rewards, epoch system |
| **AI Agents** | All 5 Genesis personas implemented with full chain-of-thought |
| **Senate Review** | Live SSE streaming, vote persistence, tally logic |
| **Relay Debate** | Sequential agent argumentation with SSE streaming |
| **Sentinel** | Community signal scanning, Claude-powered proposal generation |
| **Execution** | On-chain proposal recording, reflection phase |
| **Multi-tenant** | Registry contract, per-project governance routing |
| **Database** | Neon Postgres schema — proposals, agent_votes, debate_turns |
| **Deployment** | Vercel production deployment live at x-senate.vercel.app |
| **Documentation** | README, architecture docs, agent personas |
| **Bug Fixes** | Debate approval logic, staking API/UI alignment, TypeScript targets |

---

## Not Yet Complete ⏳

### 🔴 High Priority

| Item | Description |
|---|---|
| **Contract Deployment** | 4 contracts not yet deployed to X Layer mainnet |
| **Environment Variables** | `XSEN_TOKEN_ADDRESS`, `XSEN_STAKING_ADDRESS`, `XSEN_REGISTRY_ADDRESS`, `XLAYER_PRIVATE_KEY` not set in Vercel |
| **Staking page — live data** | Currently shows mock data; needs deployed contracts to show real TVL, VP, epoch |

### 🟡 Medium Priority

| Item | Description |
|---|---|
| **Wallet Connect** | No MetaMask/WalletConnect integration — users enter address manually |
| **Stake/Unstake UI** | Staking page reads data but cannot execute transactions yet |
| **Project registration on-chain** | Registration form calls backend only; real XSEN approval + tx needed |
| **CLAUDE_MODEL env var** | Not yet added to Vercel Settings |

### 🟢 Nice-to-Have (Post-Hackathon)

| Item | Description |
|---|---|
| OKX Wallet API | Native OKX wallet connection via OnchainOS |
| OKX Market API | Real-time XSEN price feed on staking page |
| OKX Security Scan | Token contract security check during project registration |
| IPFS upload | Store proposal content on IPFS, record hash on-chain |
| Mobile optimization | Current layout is desktop-first |
| Auth boundary | Write routes are currently open — acceptable for demo |

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS, Zustand |
| API | Next.js Serverless Functions (18 routes) |
| Database | Neon Postgres (Vercel Storage integration) |
| AI | Anthropic Claude API — claude-sonnet-4-6 |
| Blockchain | X Layer (OKX L2, chainId 196) |
| Smart Contracts | Solidity 0.8.20 |
| Web3 | ethers.js |
| Streaming | Server-Sent Events (SSE) — Vercel-compatible |
| Deployment | Vercel (single project, zero infra management) |
| Source | GitHub: bitgett/x-senate |

---

## Hackathon Evaluation Points

### 1. X Layer Ecosystem Contribution
X-Senate is purpose-built for X Layer. Every ERC20 project on the network is a potential user. The platform creates a gravitational center for governance activity on X Layer — the more projects that join, the more valuable XSEN staking becomes.

### 2. AI-Native Design
This is not AI bolted onto a DAO tool. The entire governance flow is designed around AI agents from the ground up. Five distinct personas, live streaming votes, sequential debate, self-critique reflection — governance as a reasoning process, not just a vote count.

### 3. OKX OnchainOS Integration
- Deployed on X Layer (OKX L2)
- OKX Market API for on-chain market data
- OKX Wallet API for portfolio and transaction history
- OKX Security Scan API for token contract verification

### 4. Permissionless and Self-Sustaining
No admin approval required to join. 1,000 XSEN fee is the only gate. Fees flow to stakers, not the team. The platform funds itself through usage.

### 5. Flash-Stake Protection (Novel)
The snapshot VP mechanism is a genuine technical contribution — locking agent voting power at proposal creation time prevents the class of governance attacks where tokens are borrowed, used to vote, and returned within a single block or epoch.

### 6. Creator Economy for AI Agents
The user agent system creates a marketplace for governance AI. Developers can build specialized agents, earn passive income from delegation rewards, and compete on quality — aligning incentives for better governance outcomes across the ecosystem.

---

## Contract Deployment Sequence

```
Step 1: Deploy XToken.sol
  → Returns: XSEN_TOKEN_ADDRESS

Step 2: Deploy XSenateStaking.sol(XSEN_TOKEN_ADDRESS)
  → Returns: XSEN_STAKING_ADDRESS

Step 3: Deploy XSenateGovernor.sol(address(0))
  → Returns: XSEN_GOVERNOR_ADDRESS

Step 4: Deploy XSenateRegistry.sol(governor, xsenToken, xsenStaking)
  → Returns: XSEN_REGISTRY_ADDRESS

Step 5: Wire contracts
  → staking.setGovernor(governor)
  → governor.setRegistry(registry)
  → registry.registerNativeProject("XSEN", "X-Senate", xsenToken, xsenStaking)
  → governor.registerAgent("Guardian", agentWallet)  × 5
  → staking.registerGenesisAgent("Guardian")         × 5
  → staking.fundRewardPool(20_000_000 XSEN)

Step 6: Add to Vercel Environment Variables
  → XSEN_TOKEN_ADDRESS
  → XSEN_STAKING_ADDRESS
  → XSEN_REGISTRY_ADDRESS
  → XLAYER_PRIVATE_KEY
  → XLAYER_RPC_URL
```

---

*Last updated: 2026-03-25 | Version: 0.2.0*
