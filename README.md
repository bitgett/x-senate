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
│  └── /contexts   WalletContext (global)     │
│                                             │
│  Neon Postgres   proposals, votes, agents,  │
│                  projects_meta              │
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
| XSenateStaking | `0x9CD9eF69c4EE176c8115E4BCf6c604Eb46599502` |
| XSenateGovernor | `0xa140f36Cc529e6487b877547A543213aD2ae39dF` |
| XSenateRegistry | `0xFd11e955CCEA6346911F33119B3bf84b3f0E6678` |
| QToken (QTKN) | `0x678936A224c19FF41E776845C4044aD9aB424D6b` |
| XSEN/USDT Pool | `0xb524efba890ed7087a4188b9b0148eb7fb954da9` (V3/Algebra) |
| Treasury | `0x8266D8e3B231dfD16fa21e40Cc3B99F38bC4B6C2` |

> QToken (QTKN) is a test ERC20 deployed for demo registration purposes. 10M supply.

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

## Local Development

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Required:
#   ANTHROPIC_API_KEY=...
#   DATABASE_URL=...          (Neon Postgres)
#   OKX_API_KEY=...           (OKX OnchainOS)
#   OKX_SECRET_KEY=...
#   OKX_PASSPHRASE=...
# Optional:
#   NEXT_PUBLIC_XSEN_STAKING_ADDRESS=...
#   NEXT_PUBLIC_XSEN_TOKEN_ADDRESS=...
#   NEXT_PUBLIC_XSEN_REGISTRY_ADDRESS=...
npm run dev
```

**Deploy Q Token (for testing):**
```bash
cd deploy
echo "DEPLOYER_PRIVATE_KEY=0x..." > .env
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
