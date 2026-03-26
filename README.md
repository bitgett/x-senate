# X-Senate — AI Governance Platform for X Layer

> Multi-tenant DAO governance powered by Genesis 5 AI Agents + Community-built custom agents.
> Any ERC20 project on X Layer can plug in and use the full AI governance + staking infrastructure.

**Live Demo:** https://x-senate.vercel.app
**Network:** X Layer (chainId 196)
**Team:** QuackAI — OKX × X Layer OnchainOS AI Hackathon 2026

---

## What is X-Senate?

X-Senate is an AI-native governance layer built on X Layer. Instead of token holders manually reviewing and voting on proposals, five specialized AI agents — the **Genesis 5 Senate** — autonomously analyze, debate, and decide.

Any project that has deployed an ERC20 token on X Layer can register on the platform and immediately access:
- AI proposal scanning (Sentinel)
- 5-agent senate review with live SSE streaming
- Relay debate with sequential agent argumentation
- On-chain proposal execution
- 4-tier staking with Voting Power and creator incentives
- **Custom AI Agent Builder** — anyone can create governance agents with a visual personality builder
- **x402 Payment Protocol** — agent creation and proposal submission gated by XSEN micropayment

---

## Architecture

```
┌─────────────────────────────────────────┐
│         x-senate.vercel.app             │
│                                         │
│  Next.js 16 (App Router)                │
│  ├── /app           React UI (9 pages)  │
│  ├── /app/api       Serverless API      │
│  └── /lib           DB · AI · OKX      │
│                                         │
│  Neon Postgres      proposals & votes   │
│  Anthropic Claude   AI agent reasoning  │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│           X Layer (chainId 196)         │
│                                         │
│  XToken.sol           XSEN ERC20        │
│  XSenateStaking.sol   4-tier staking    │
│  XSenateGovernor.sol  AI voting layer   │
│  XSenateRegistry.sol  Project directory │
└─────────────────────────────────────────┘
```

---

## Genesis 5 AI Agents

| Agent | Focus | Bias |
|---|---|---|
| 🛡️ Guardian | Security & Risk | Conservative |
| 💰 Merchant | Economics & ROI | Aggressive |
| ⚙️ Architect | Technical Feasibility | Pragmatic |
| 🤝 Diplomat | Community & Partnerships | Collaborative |
| 👥 Populist | User Experience | Egalitarian |

Each agent has a distinct persona and reasoning style. 3 of 5 approvals required to advance a proposal.

---

## Custom AI Agent Builder

Beyond Genesis 5, anyone can create their own governance agent:

```
1. Choose focus area: Security / DeFi / Technical / Community / Ecosystem / Risk
2. Set personality: Conservative ←──────────── Progressive
3. Set voting weights (4 sliders, auto-normalize to 100%):
   Security ████░░  35%   Economics ██░░░░  20%
   Community ████████ 40%  Technical ░░░░░░   5%
4. Write mandate: "My agent votes to protect small holders above all else"
5. Preview auto-generated system prompt (Genesis 5 format)
6. Register → earn 3% creator rewards when others delegate to your agent
```

---

## Governance Flow

```
1. Sentinel scans community signals → Draft proposal
2. Senate Review: 5 agents vote in parallel (SSE streaming)
3. Relay Debate: agents argue sequentially, building on prior arguments
4. Execute: approved proposal recorded on-chain
5. Reflection: agents self-critique their votes
```

---

## Staking

| Tier | APY | VP Multiplier | Lock | Unstake |
|---|---|---|---|---|
| Flexible | 5% | 1.0x | None | Instant, anytime |
| Lock30 | 10% | 1.1x | 30 days | Instant after lock expires · 7-day early-exit cooldown if still locked |
| Lock90 | 20% | 1.3x | 90 days | Instant after lock expires · 7-day early-exit cooldown if still locked |
| Lock180 | 35% | 1.5x | 180 days | Instant after lock expires · 7-day early-exit cooldown if still locked |

- Position-based: one wallet can hold multiple positions
- Snapshot VP: agent voting power is locked at proposal creation (flash-stake proof)
- Staking history: full transaction record with timestamps
- **User Agents**: register a custom AI agent and earn 3% creator reward from delegations

---

## Pages

| Route | Description |
|---|---|
| `/` | Landing page — Genesis 5, animated counters, CTA |
| `/app` | Dashboard — proposal feed, x402 submit modal, live VP display |
| `/proposals/[id]` | Proposal detail — senate voting, relay debate, execution, timeline |
| `/sentinel` | Sentinel AI scanner + XSEN price + live gas strip |
| `/stake` | Staking dashboard — 4-tier staking, OKX portfolio, positions, delegate |
| `/agents` | AI Agent Hub — Browse Genesis 5 + Create custom agents + My Agent |
| `/leaderboard` | Leaderboard — Agents / Stakers / Governance 3-tab podium ranking |
| `/activity` | Activity log — on-chain TX history via X Layer RPC, staking positions |
| `/projects` | Multi-tenant registry — registered projects + onboarding |

---

## Multi-Tenant Registry

Any X Layer ERC20 project can register:
```
Fee: 1,000 XSEN → XSEN ecosystem fund
Result: dedicated staking contract + access to Genesis 5 senate
```

---

## Smart Contracts (X Layer Mainnet — chainId 196)

| Contract | Address |
|---|---|
| XToken (XSEN) | `0x1bAB744c4c98D844984e297744Cb6b4E24e2E89b` |
| XSenateStaking | `0x9CD9eF69c4EE176c8115E4BCf6c604Eb46599502` |
| XSenateGovernor | `0xa140f36Cc529e6487b877547A543213aD2ae39dF` |
| XSenateRegistry | `0xFd11e955CCEA6346911F33119B3bf84b3f0E6678` |
| XSEN/USDT Pool | `0xb524efba890ed7087a4188b9b0148eb7fb954da9` (V3/Algebra) |
| Treasury | `0x8266D8e3B231dfD16fa21e40Cc3B99F38bC4B6C2` |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS |
| API | Next.js Serverless Functions (Vercel) |
| Database | Neon Postgres |
| AI | Anthropic Claude (claude-sonnet-4-6) |
| Blockchain | X Layer (OKX L2, chainId 196) |
| Contracts | Solidity 0.8.20 |
| Web3 | ethers.js v6 |
| Deployment | Vercel |

---

## OKX OnchainOS Integration

`frontend/lib/okx.ts` — shared authenticated OKX API client (HMAC-SHA256)

| OKX API Endpoint | Used For |
|---|---|
| `POST /api/v6/dex/market/price` | XSEN live price (authenticated) |
| `GET /api/v6/dex/balance/all-token-balances-by-address` | Wallet portfolio tokens |
| `GET /api/v6/dex/balance/total-value-by-address` | Wallet total USD value |
| `POST /api/v6/x402/verify` | Payment verification (primary) |
| `GET /api/v6/dex/post-transaction/transaction-detail-by-txhash` | TX detail lookup |
| `GET /api/v6/dex/market/candles` | XSEN price candles |
| `GET /api/v6/dex/market/token/basic-info` | Token metadata |
| `GET /api/v6/pre-transaction/gas-price` | (RPC direct used instead — X Layer not indexed) |

**Price source priority:**
```
1. OKX Market API v6 (authenticated) → okx_market_v6_auth
2. OKX Market API v6 (unauthenticated) → okx_market_v6
3. On-chain V3 pool slot0() via X Layer RPC → xlayer_pool
4. Hardcoded fallback $0.01 → fallback
```

**XSEN Pool:** Uniswap V3/Algebra style pool on X Layer
Pool reads `sqrtPriceX96` from `slot0()` → computes USD price
Current live price: ~$10.34 per XSEN

---

## x402 Payment Protocol

Agent creation and proposal submission require a $10 USD payment in XSEN tokens:

```
1. Frontend calls GET /api/x402/quote → live XSEN price (OKX API → pool → fallback)
2. User approves + transfers XSEN to treasury (0x8266...)
3. Frontend sends payment_tx_hash with the main request
4. Backend calls POST /api/v6/x402/verify (OKX OnchainOS) as primary verifier
5. Falls back to direct X Layer RPC receipt verification if OKX unavailable
```

- **No serverless chaining:** verification inlined in each route (avoids Vercel timeout)
- **Vercel maxDuration = 60:** extended timeout for Claude API calls
- **Anthropic timeout = 25s:** hard limit on AI calls
- **Client AbortSignal = 55s:** client-side fetch timeout

---

## Local Development

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Required:
#   ANTHROPIC_API_KEY=...
#   DATABASE_URL=...         (Neon Postgres)
#   OKX_API_KEY=...          (OKX OnchainOS)
#   OKX_SECRET_KEY=...
#   OKX_PASSPHRASE=...
npm run dev
```

Open http://localhost:3000

---

*Built for the OKX × X Layer OnchainOS AI Hackathon 2026 by Team QuackAI*
