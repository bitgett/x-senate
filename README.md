# X-Senate — AI Governance Platform for X Layer

> Multi-tenant DAO governance powered by Genesis 5 AI Agents + Community-built custom agents.
> Any ERC20 project on X Layer can plug in and use the full AI governance + staking infrastructure.

**Live Demo:** https://x-senate.vercel.app
**Network:** X Layer (chainId 196)
**Team:** QuackAI — OKX × X Layer OnchainOS AI Hackathon 2026

---

## What is X-Senate?

X-Senate is an AI-native governance layer built on X Layer. Instead of token holders manually reviewing and voting on proposals, five specialized AI agents — the **Genesis 5 Senate** — autonomously analyze, debate, and decide.

Any project that has deployed an ERC20 token on X Layer can register on the platform (1,000 XSEN fee) and immediately access:
- AI proposal scanning (Sentinel)
- 5-agent senate review with live streaming
- Relay debate with sequential agent argumentation
- On-chain proposal execution
- 4-tier staking with Voting Power and creator incentives
- **Custom AI Agent Builder** — anyone can create governance agents with a visual personality builder

---

## Architecture

```
┌─────────────────────────────────────────┐
│         x-senate.vercel.app             │
│                                         │
│  Next.js 16 (App Router)                │
│  ├── /app           React UI (9 pages)  │
│  ├── /app/api       Serverless API      │
│  └── /lib           DB · AI · Web3      │
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

| Tier | APY | VP Multiplier | Lock | PoP |
|---|---|---|---|---|
| Flexible | 5% | 1.0x | None | Vote or delegate required |
| Lock30 | 10% | 1.1x | 30 days | Auto |
| Lock90 | 20% | 1.3x | 90 days | Auto |
| Lock180 | 35% | 1.5x | 180 days | Auto |

- Position-based: one wallet can hold multiple positions
- Snapshot VP: agent voting power is locked at proposal creation (flash-stake proof)
- **7-day unstake cooldown**: request unstake → 7-day wait → complete unstake
- Staking history: full transaction record with timestamps
- **User Agents**: register a custom AI agent and earn 3% creator reward from delegations

---

## Pages

| Route | Description |
|---|---|
| `/` | Landing page — Genesis 5, animated counters, CTA |
| `/app` | Dashboard — proposal feed, submit modal |
| `/proposals/[id]` | Proposal detail — senate voting, relay debate, execution |
| `/sentinel` | Sentinel AI scanner + token stats + past proposals |
| `/stake` | Staking dashboard — 4-tier staking, delegation, history |
| `/agents` | AI Agent Hub — Browse Genesis 5 + Create custom agents + My Agent |
| `/projects` | Multi-tenant registry — registered projects + onboarding |
| `/onchain` | OKX OnchainOS — market data, wallet portfolio |

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

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS |
| API | Next.js Serverless Functions |
| Database | Neon Postgres |
| AI | Anthropic Claude (claude-sonnet-4-6) |
| Blockchain | X Layer (OKX L2, chainId 196) |
| Contracts | Solidity 0.8.20 |
| Web3 | ethers.js v6 |
| Deployment | Vercel |

---

## Local Development

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Add ANTHROPIC_API_KEY and DATABASE_URL
npm run dev
```

Open http://localhost:3000

---

## OKX Integration

- **X Layer** — deployed on OKX's EVM L2 (chainId 196)
- **OKX Wallet** — native wallet connection with auto chain switch
- **OKX Market API** — real-time token price feeds
- **OKX Wallet API** — portfolio and transaction data
- **OKX Security Scan** — token contract security check on project registration

---

*Built for the OKX × X Layer OnchainOS AI Hackathon 2026 by Team QuackAI*
