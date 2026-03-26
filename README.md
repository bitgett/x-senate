# X-Senate — AI Governance Platform for X Layer

> Multi-tenant DAO governance powered by Genesis 5 AI Agents + community-built custom agents.
> Any ERC20 project on X Layer can plug in and use the full AI governance + staking infrastructure.

**Live Demo:** https://x-senate.vercel.app
**Network:** X Layer Mainnet (chainId 196)
**Team:** QuackAI — OKX × X Layer OnchainOS AI Hackathon 2026

---

## What is X-Senate?

X-Senate is an AI-native governance layer built on X Layer. Instead of token holders manually reviewing and voting on proposals, five specialized AI agents — the **Genesis 5 Senate** — autonomously analyze, debate, and vote.

Any project with an ERC20 token on X Layer can register and immediately access:

- **Sentinel AI** — scans community signals and auto-drafts governance proposals
- **Senate Review** — 5 Genesis agents vote in parallel with live SSE streaming
- **Relay Debate** — sequential agent argumentation, each reading prior turns
- **On-chain Execution** — approved proposals recorded on X Layer
- **4-tier Staking + VP** — position-based staking with Voting Power multipliers
- **Custom AI Agent Builder** — visual personality builder, x402-gated registration
- **Multi-Tenant Registry** — one registration gives any X Layer ERC20 the full governance stack

---

## Architecture

```
┌─────────────────────────────────────────────┐
│           x-senate.vercel.app               │
│                                             │
│  Next.js 16 App Router (10 pages)           │
│  ├── /app/api    Serverless Functions       │
│  ├── /lib        DB · AI · OKX · Contract   │
│  │               rateLimit · agents         │
│  └── /contexts   WalletContext (global)     │
│                                             │
│  Neon Postgres   proposals, agent_votes,    │
│                  debate_turns, user_agents, │
│                  projects_meta,             │
│                  used_payment_hashes        │
│  Anthropic Claude  Genesis 5 AI reasoning  │
└──────────────┬──────────────────────────────┘
               │ ethers.js v6
┌──────────────▼──────────────────────────────┐
│             X Layer (chainId 196)           │
│                                             │
│  XToken.sol          XSEN ERC20             │
│  XSenateStaking.sol  4-tier staking + VP    │
│  XSenateGovernor.sol AI voting layer        │
│  XSenateRegistry.sol Project directory      │
│  QToken.sol          Test token (QTKN)      │
└─────────────────────────────────────────────┘
```

---

## Pages

| Route | Description |
|---|---|
| `/` | Landing — Genesis 5 showcase, animated counters, CTA |
| `/app` | Dashboard — proposal feed, x402 submit modal, live VP |
| `/proposals/[id]` | Proposal detail — senate voting (SSE), relay debate, execution, timeline |
| `/sentinel` | Sentinel AI scanner + XSEN live price + gas strip |
| `/stake` | Staking — 4-tier positions, OKX portfolio, delegate to agents |
| `/agents` | AI Agent Hub — Browse Genesis 5, create custom agent, My Agent |
| `/leaderboard` | Leaderboard — Agents / Stakers / Governance 3-tab ranking |
| `/activity` | Activity log — on-chain TX history (X Layer RPC eth_getLogs) |
| `/projects` | Multi-tenant registry — register any X Layer ERC20 project |
| `/projects/[id]` | Per-project governance — proposals, Run Sentinel, Submit Proposal |

---

## Genesis 5 AI Agents

| Agent | Mandate | Style | Top Weight |
|---|---|---|---|
| 🛡️ Guardian | Protocol security & constitutional integrity | Conservative | Security 50% |
| 💰 Merchant | Revenue, TVL, capital efficiency | Aggressive | ROI/Revenue 60% |
| ⚙️ Architect | Technical feasibility, scalability | Pragmatic | Feasibility 40% |
| 🤝 Diplomat | Ecosystem partnerships, reputation | Measured | Ecosystem 40% |
| 👥 Populist | Small holders, community fairness | Egalitarian | Community 50% |

3 of 5 approvals required to advance a proposal from Draft → Executed.

---

## Governance Flow

```
1. Sentinel AI scans signals → generates Draft proposal (per project)
2. Senate Review: 5 agents vote in parallel, streamed token-by-token via SSE
3. Relay Debate: agents argue sequentially, each reading prior arguments
4. Execute: approved proposal recorded on-chain via XSenateGovernor
5. Reflection: agents self-critique their votes
```

---

## Staking

| Tier | APY | VP Multiplier | Lock | Unstake |
|---|---|---|---|---|
| Flexible | 5% | 1.0x | None | Instant, anytime |
| Lock30 | 10% | 1.1x | 30 days | Instant after expiry · 7-day early-exit if still locked |
| Lock90 | 20% | 1.3x | 90 days | Instant after expiry · 7-day early-exit if still locked |
| Lock180 | 35% | 1.5x | 180 days | Instant after expiry · 7-day early-exit if still locked |

- **Position-based:** one wallet holds multiple independent positions
- **Snapshot VP:** locked at proposal creation (flash-stake attack prevention)
- **Delegation:** each position delegates independently to a governance agent
- **Creator rewards:** register a custom agent → earn 3% of delegated votes

---

## Multi-Tenant Project Registry

Any X Layer ERC20 project registers once and gets the full governance stack:

```
Registration flow:
1. Fill form: Project ID, Name, Token address, Description, Logo (200×200),
   Twitter / Discord / Telegram links
2. approve(REGISTRY, 1000 XSEN) — on-chain
3. Registry.registerProject(id, name, tokenAddr, stakingAddr) — on-chain
   → 1000 XSEN fee flows to XSEN staker ecosystem fund
4. Redirect to /projects/[id] governance page
```

Per-project governance page (`/projects/[id]`) includes:
- Project header with **token logo**, social links
- **Genesis 5 Connected** badge — all 5 agents active
- **Run Sentinel** button — AI scans signals, creates draft proposal tagged to this project
- **Submit Proposal** modal — title, summary, motivation, action
- Full proposal list with senate vote counts and status
- Staking overview (epoch, reward pool, total VP)

---

## Custom AI Agent Builder

```
1. Choose focus area (7 presets): Security / DeFi / Technical / Community /
                                   Ecosystem / Risk Management / Innovation
2. Decision style slider:  Conservative ←────────────── Progressive (0–100)
3. Voting weight sliders (4 axes, auto-normalize to 100%):
   Security ████░░ 35%   Economics ██░░░░ 20%
   Community ████████ 40%  Technical ░░░░░░ 5%
4. Custom mandate text (free-form instruction)
5. Preview generated system prompt in Genesis 5 format
6. Deploy → ~$10 fee in XSEN · earn 3% creator rewards on delegated votes
```

---

## Smart Contracts (X Layer Mainnet — chainId 196)

| Contract | Address |
|---|---|
| XToken (XSEN) | `0x1bAB744c4c98D844984e297744Cb6b4E24e2E89b` |
| XSenateStaking | `0xc8FD7B12De6bFb10dF3eaCb38AAc09CBbeb25bFD` |
| XSenateGovernor | `0xeD57C957D9f1F4CBF39155303B7143B605ff3546` |
| XSenateRegistry | `0x111bC1681fc34EAcab66f75D8273C4ECD49b13e5` |
| QToken (QTKN) | `0x678936A224c19FF41E776845C4044aD9aB424D6b` |
| XSEN/USDT Pool | `0xb524efba890ed7087a4188b9b0148eb7fb954da9` (V3/Algebra) |
| Treasury | `0x8266D8e3B231dfD16fa21e40Cc3B99F38bC4B6C2` |

> QToken (QTKN) is a test ERC20 deployed for demo registration purposes. 10M supply.

> Staking, Governor, and Registry were redeployed with security fixes applied (SEC-01 + SEC-05). XToken address is unchanged — LP pool and price feeds are preserved.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS |
| API | Next.js Serverless Functions (Vercel) |
| Database | Neon Postgres |
| AI | Anthropic Claude (`claude-sonnet-4-6`) |
| Blockchain | X Layer (OKX L2, chainId 196) |
| Contracts | Solidity 0.8.20 |
| Web3 | ethers.js v6 |
| Deployment | Vercel (maxDuration = 60s for AI routes) |

> **Note on `backend/` directory:** Contains an early FastAPI (Python) prototype, **not used in the live deployment**. All API logic runs in Next.js Serverless Functions under `frontend/app/api/`.

---

## OKX OnchainOS Integration

`frontend/lib/okx.ts` — HMAC-SHA256 authenticated OKX API client

| OKX API | Used For |
|---|---|
| `POST /api/v6/dex/market/price` | XSEN live price (authenticated) |
| `GET /api/v6/dex/balance/all-token-balances-by-address` | Wallet portfolio tokens |
| `GET /api/v6/dex/balance/total-value-by-address` | Wallet total USD value |
| `POST /api/v6/x402/verify` | Payment verification |
| `GET /api/v6/dex/market/candles` | XSEN price candles |
| `GET /api/v6/dex/market/token/basic-info` | Token metadata |

**XSEN Price fallback chain:**
```
1. OKX Market API v6 (authenticated)
2. OKX Market API v6 (unauthenticated)
3. On-chain V3 pool sqrtPriceX96 via X Layer RPC
4. Hardcoded $0.01 fallback
```

---

## x402 Payment Protocol

Two separate x402-style flows:

**Agent Registration (~$10 in XSEN):**
```
GET /api/x402/quote → live XSEN price
User approves + transfers XSEN to treasury
POST /api/x402/verify (OKX) → fallback: X Layer RPC receipt check
Replay check: tx_hash recorded in used_payment_hashes (unique constraint)
On success → agent saved to DB
```

**Project Registration (1,000 XSEN flat):**
```
User approves REGISTRY to spend 1,000 XSEN (on-chain)
User calls Registry.registerProject() (on-chain)
  → 1,000 XSEN transferred to XSEN staking ecosystem fund
  → ProjectRegistered event emitted
POST /api/registry/projects → social meta saved to DB
```

---

## On-Chain Activity (No API Key Required)

`/activity` page reads TX history directly from X Layer RPC via `eth_getLogs`:
- Queries last ~100,000 blocks
- Topics filtering for Transfer, Staking, and Governor events
- Deduplication by txHash+logIndex, sorted by block descending
- No third-party explorer API dependency

---

## Security

The following security controls were implemented and are live in production:

### Contract Layer

| ID | Fix | Contract |
|---|---|---|
| SEC-01 | `castSenateVote()` checks `agentAddresses[agentName]` — only the registered caller address can vote as each agent. `address(0)` = unrestricted (backward-compatible). | `XSenateGovernor.sol` |
| SEC-05 | Staking reward payout no longer falls back to `xToken.mint()`. If epoch reward pool is depleted, `claimReward()` reverts rather than inflating supply. | `XSenateStaking.sol` |

### API Layer

| ID | Fix | File |
|---|---|---|
| SEC-02 | Payment tx hash replay protection — `used_payment_hashes` table with `PRIMARY KEY` on `tx_hash`. Hash recorded atomically before action completes. Same tx hash rejected with HTTP 402 on reuse. | `lib/db.ts`, `proposals/submit/route.ts`, `uga/register/route.ts` |
| SEC-04 | `DELETE /api/proposals/[id]` requires `x-admin-secret` header matching `ADMIN_SECRET` env var. Returns 401 without it. | `proposals/[id]/route.ts` |
| Rate Limit | IP-based rate limiting on all Claude-calling routes: Sentinel scan (3/min), Senate review (5/min), Debate stream (5/min), Proposal submit (10/min). | `lib/rateLimit.ts` |
| P1-TxVerify | Registry POST verifies `tx_hash` on-chain via `eth_getTransactionReceipt` before writing project metadata. Status `0x1` required — failed txs are rejected. | `api/registry/projects/route.ts` |
| P1-ProjectId | `project_id` validated against DB + on-chain registry before creating any proposal or sentinel scan. Unknown project IDs rejected with HTTP 400. | `api/proposals/submit/route.ts`, `api/proposals/sentinel/scan/route.ts` |
| P2-PayRetry | Payment tx hash persisted in UI state across modal close. If AI review fails after payment, user retries submission without paying twice. Cleared only on successful save. | `app/projects/[projectId]/page.tsx` |
| P2-StaleLease | Stale `In_Senate` (>90s) auto-reset to `Draft`. Stale `In_Debate` (>90s, no turns saved) auto-reset to `Approved`. Prevents permanently stuck proposals if a serverless function times out. | `api/senate/review/[id]/route.ts`, `api/debate/stream/[id]/route.ts` |

### X Layer Web3 Notes

X Layer (chainId 196) has no ENS registry. All on-chain reads use `ethers.JsonRpcProvider` directly. All writes use raw EIP-1193 `eth_sendTransaction` via the connected wallet — no `BrowserProvider` involved, which eliminates ENS resolution errors. Explicit gas (`250,000`) is passed to prevent wallet-side `eth_estimateGas` calls that can produce misleading errors on simulation failure.

### Known Limitations (Out of Scope for Hackathon)

| ID | Issue | Status |
|---|---|---|
| SEC-06 | 7-day unstake cooldown enforced only in frontend localStorage — contract `unstake()` has no on-chain cooldown. | Roadmap: `requestUnstake()` + `completeUnstake()` pattern |
| SEC-07 | `delegateVote()` in Governor accepts arbitrary `votingPower` from caller. | Roadmap: derive from staking contract |
| SEC-04 partial | `senate/review`, `debate/start`, `execute` routes accept unauthenticated POST. Economic gates (payment, VP threshold) provide spam resistance at the proposal level. | Roadmap: wallet-signed authorization |

---

## Developer Reference

### Environment Variables (Complete)

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Claude API key (`claude-sonnet-4-6`) |
| `DATABASE_URL` | ✅ | Neon Postgres connection string |
| `OKX_API_KEY` | ✅ | OKX OnchainOS API key |
| `OKX_SECRET_KEY` | ✅ | OKX OnchainOS secret |
| `OKX_PASSPHRASE` | ✅ | OKX OnchainOS passphrase |
| `ADMIN_SECRET` | ✅ | Protects `DELETE /api/proposals/[id]` |
| `XSEN_STAKING_ADDRESS` | optional | Server-side staking address (default: `0xc8FD...bFD`) |
| `XSEN_TOKEN_ADDRESS` | optional | Server-side token address (default: `0x1bAB...89b`) |
| `XSEN_GOVERNOR_ADDRESS` | optional | Server-side governor address (default: `0xeD57...546`) |
| `XSEN_REGISTRY_ADDRESS` | optional | Server-side registry address (default: `0x111b...3e5`) |
| `NEXT_PUBLIC_XSEN_STAKING_ADDRESS` | optional | Client-side staking address |
| `NEXT_PUBLIC_XSEN_TOKEN_ADDRESS` | optional | Client-side token address |
| `NEXT_PUBLIC_XSEN_REGISTRY_ADDRESS` | optional | Client-side registry address |
| `XLAYER_RPC_URL` | optional | X Layer RPC (default: `https://rpc.xlayer.tech`) |

> All contract address env vars have hardcoded mainnet fallbacks — the app runs without them set.

---

### API Routes

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/proposals` | — | List all proposals (all projects) |
| GET | `/api/proposals/[id]` | — | Single proposal with votes + debate turns |
| POST | `/api/proposals/submit` | x402 payment | Submit proposal (x402-gated, ~$10 XSEN) |
| DELETE | `/api/proposals/[id]` | `x-admin-secret` | Delete proposal |
| POST | `/api/proposals/sentinel/scan` | — | Sentinel AI: scan signals + create Draft |
| GET | `/api/proposals/seed` | — | Seed demo proposals |
| POST | `/api/senate/review/[id]` | — | Trigger 5-agent parallel vote (SSE) |
| GET | `/api/senate/votes/[id]` | — | Get all agent votes for proposal |
| GET | `/api/debate/turns/[id]` | — | Get debate turns |
| POST | `/api/debate/start/[id]` | — | Start relay debate |
| GET | `/api/debate/stream/[id]` | — | Stream relay debate (SSE) |
| POST | `/api/execute/[id]` | — | Execute approved proposal on-chain |
| POST | `/api/execute/reflect/[id]` | — | Post-vote agent reflection |
| GET | `/api/personas` | — | Genesis 5 agent definitions |
| POST | `/api/uga/register` | x402 payment | Register custom agent (~$10 XSEN) |
| GET | `/api/uga` | — | List all user-created agents |
| GET | `/api/x402/quote` | — | Live XSEN price quote for payment |
| POST | `/api/x402/verify` | — | Verify payment tx hash (OKX → RPC fallback) |
| GET | `/api/registry/projects` | — | List registered projects |
| POST | `/api/registry/projects` | tx_hash required | Register new project |
| GET | `/api/registry/projects/[id]` | — | Project metadata |
| GET | `/api/registry/projects/[id]/staking` | — | Project staking stats |
| GET | `/api/registry/stats` | — | Registry global stats |
| GET | `/api/staking/tiers` | — | Tier definitions (APY, VP mult, lock) |
| GET | `/api/staking/totals` | — | Total staked + total VP (on-chain) |
| GET | `/api/staking/epoch` | — | Current epoch info (on-chain) |
| GET | `/api/staking/leaderboard` | — | Top agents by delegated VP |
| GET | `/api/staking/positions/[address]` | — | User positions (on-chain) |
| GET | `/api/staking/vp/[address]` | — | User effective VP (on-chain) |
| GET | `/api/onchain/gas` | — | X Layer gas prices |
| GET | `/api/onchain/market/price` | — | XSEN USD price |
| GET | `/api/onchain/market/summary` | — | XSEN market summary |
| GET | `/api/onchain/market/trending` | — | Trending tokens on X Layer |
| GET | `/api/onchain/contract` | — | Contract metadata |
| GET | `/api/onchain/xlayer/info` | — | X Layer chain info |
| GET | `/api/onchain/security/scan-token` | — | Token security scan |
| GET | `/api/onchain/wallet/[address]/portfolio` | — | Wallet token balances |
| GET | `/api/onchain/wallet/[address]/activity` | — | Wallet TX history (eth_getLogs) |
| GET | `/api/onchain/wallet/[address]/voting-power` | — | Wallet effective VP |

---

### Database Schema (Neon Postgres)

```sql
-- Governance proposals
proposals (
  id               TEXT PRIMARY KEY,          -- UUID
  project_id       TEXT DEFAULT 'XSEN',       -- which project this belongs to
  title            TEXT,
  summary          TEXT,
  motivation       TEXT,
  proposed_action  TEXT,
  potential_risks  TEXT,
  sentinel_analysis TEXT,                     -- raw Sentinel AI output
  source_data      TEXT,                      -- signals used by Sentinel
  status           TEXT DEFAULT 'Draft',      -- Draft | In_Senate | Approved | Rejected | In_Debate | Executed
  approve_count    INTEGER DEFAULT 0,
  reject_count     INTEGER DEFAULT 0,
  snapshot_url     TEXT,
  tx_hash          TEXT,                      -- on-chain execution tx
  one_liner_opinions TEXT,                    -- JSON: {agentName: "one line"}
  proposer_address TEXT,
  created_at       TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ
)

-- Agent votes per proposal
agent_votes (
  id               SERIAL PRIMARY KEY,
  proposal_id      TEXT,
  agent_name       TEXT,                      -- Guardian | Merchant | Architect | Diplomat | Populist | custom
  vote             TEXT,                      -- Approve | Reject | Abstain
  reason           TEXT,
  chain_of_thought TEXT,
  confidence       INTEGER,                   -- 0-100
  reflection_notes TEXT,
  voted_at         TIMESTAMPTZ
)

-- Relay debate turns
debate_turns (
  id               SERIAL PRIMARY KEY,
  proposal_id      TEXT,
  agent_name       TEXT,
  turn_order       INTEGER,
  full_argument    TEXT,
  one_liner        TEXT
)

-- Community-created agents
user_agents (
  id               SERIAL PRIMARY KEY,
  wallet_address   TEXT,
  agent_name       TEXT UNIQUE,
  system_prompt    TEXT,
  focus_area       TEXT,
  avatar_base64    TEXT,
  rank             TEXT DEFAULT 'Bronze',
  delegated_vp     NUMERIC DEFAULT 0,
  score            NUMERIC DEFAULT 0,
  created_at       TIMESTAMPTZ
)

-- Project registry (off-chain metadata)
projects_meta (
  project_id    TEXT PRIMARY KEY,             -- e.g. 'QTKN', 'XSEN'
  name          TEXT,
  description   TEXT,
  token_address TEXT,
  twitter       TEXT,
  discord       TEXT,
  telegram      TEXT,
  registrant    TEXT,                         -- wallet address
  tx_hash       TEXT,                         -- registration tx
  logo_base64   TEXT,
  created_at    TIMESTAMPTZ
)

-- Payment replay protection
used_payment_hashes (
  tx_hash  TEXT PRIMARY KEY,
  purpose  TEXT,                              -- 'agent_registration' | 'proposal_submission'
  used_at  TIMESTAMPTZ
)
```

---

### Contract ABIs (Key Functions)

```solidity
// XSenateStaking — 0xc8FD7B12De6bFb10dF3eaCb38AAc09CBbeb25bFD
function stake(uint256 amount, uint8 tier) external
function unstake(uint256 positionId) external
function claimAllRewards() external
function delegatePosition(uint256 positionId, string agentName) external
function getUserPositions(address user) view returns (tuple(
  uint256 id, address owner, uint256 amount, uint8 tier,
  uint256 lockEnd, uint256 stakedAt, uint256 lastRewardAt,
  uint256 accReward, string delegatedAgent, bool active
)[])
function getEffectiveVP(address user) view returns (uint256)
function getEpochInfo() view returns (uint256 epochId, uint256 startTime, uint256 endTime, uint256 rewardPool, bool finalized)
function getTotalStaked() view returns (uint256 totalStaked, uint256 totalEffectiveVP)

// XSenateGovernor — 0xeD57C957D9f1F4CBF39155303B7143B605ff3546
function castSenateVote(string proposalId, string agentName, bool approve) external
function executeProposal(string proposalId, string action) external
function snapshotForProposal(string proposalId) external

// XSenateRegistry — 0x111bC1681fc34EAcab66f75D8273C4ECD49b13e5
function registerProject(string projectId, string name, address tokenAddr, address stakingAddr) external
function getProject(string projectId) view returns (tuple(...))

// XToken (XSEN ERC20) — 0x1bAB744c4c98D844984e297744Cb6b4E24e2E89b
function approve(address spender, uint256 amount) external returns (bool)
function transfer(address to, uint256 amount) external returns (bool)
function balanceOf(address account) view returns (uint256)
```

---

## Local Development

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Required:
#   ANTHROPIC_API_KEY=...
#   DATABASE_URL=...              (Neon Postgres)
#   OKX_API_KEY=...               (OKX OnchainOS)
#   OKX_SECRET_KEY=...
#   OKX_PASSPHRASE=...
#   ADMIN_SECRET=...              (any strong secret — protects DELETE /api/proposals/[id])
# Optional (defaults to mainnet addresses below — no need to set unless overriding):
#   NEXT_PUBLIC_XSEN_STAKING_ADDRESS=0xc8FD7B12De6bFb10dF3eaCb38AAc09CBbeb25bFD
#   NEXT_PUBLIC_XSEN_TOKEN_ADDRESS=0x1bAB744c4c98D844984e297744Cb6b4E24e2E89b
#   NEXT_PUBLIC_XSEN_REGISTRY_ADDRESS=0x111bC1681fc34EAcab66f75D8273C4ECD49b13e5
npm run dev
```

> **Vercel env var note:** When setting `NEXT_PUBLIC_*` contract addresses in Vercel, paste values without trailing newlines. A stray `\n` in the value makes ethers.js reject the address as invalid at runtime. All address constants use `safeAddr()` (`.trim()` + `ethers.getAddress()` with fallback) as a defensive measure, but clean input is preferred.

**Redeploy contracts (upgrade only — keeps XToken):**
```bash
cd deploy
echo "DEPLOYER_PRIVATE_KEY=0x..." > .env
npx hardhat compile
node scripts/deploy-upgrade.js
# If post-setup fails due to nonce issues:
node scripts/post-setup.js
```

**Deploy Q Token (for demo testing):**
```bash
cd deploy
npx hardhat compile
node scripts/deploy-qtoken.js
```

---

## Hackathon Submission — OKX × X Layer OnchainOS AI Hackathon 2026

### OnchainOS Capabilities Used

| Capability | How Used |
|---|---|
| **Market API** | XSEN live price, candles, token metadata — Sentinel, x402 quote, staking dashboard |
| **Wallet API** | Portfolio token balances + total USD value — Stake page |
| **x402 Payments** | Agent registration (~$10 XSEN) and project registration (1,000 XSEN). OKX `POST /api/v6/x402/verify` as primary verifier |
| **DApp Wallet Connect** | MetaMask + OKX Wallet → X Layer Mainnet. Auto-switch/add via `wallet_switchEthereumChain` |

### AI Model & Version

**Anthropic Claude — `claude-sonnet-4-6`**

Used for: Genesis 5 senate voting (parallel SSE), Relay debate (sequential), Sentinel scanner, post-vote reflection.

### Prompt Design Overview *(600-char form answer)*

> X-Senate uses 5 specialized governance personas (Guardian, Merchant, Architect, Diplomat, Populist), each with a distinct system prompt: mandate, decision style (conservative→progressive slider), and 4-dimensional voting weights (Security, Economics, Community, Technical summing to 100%). Community agents use a visual builder to generate prompts in the same schema. All agents respond in structured JSON: `{"vote","reason","chain_of_thought","confidence"}`. Relay debate injects prior agent arguments as context to build sequential reasoning chains.

### What Makes X-Senate Different

1. **AI agents are the voters** — humans delegate VP to agents that vote autonomously, not a voting UI
2. **Multi-tenant** — any X Layer ERC20 gets the full governance stack with one registration
3. **Relay Debate** — sequential argumentation where each agent reads prior agents, creating emergent consensus
4. **x402 as economic moat** — spam-resistant via real-money proposal submission and agent creation
5. **Community extensibility** — anyone creates and monetizes governance agents (3% creator reward)

---

*Built for the OKX × X Layer OnchainOS AI Hackathon 2026 by Team QuackAI*
