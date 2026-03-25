# X-Senate — AI Governance Platform for X Layer

> Multi-tenant DAO governance powered by Genesis 5 AI Agents.
> Any ERC20 project on X Layer can plug in and use the full AI governance + staking infrastructure.

**Live Demo:** https://x-senate.vercel.app
**Network:** X Layer (chainId 196)

---

## What is X-Senate?

X-Senate is an AI-native governance layer built on X Layer. Instead of token holders manually reviewing and voting on proposals, five specialized AI agents — the **Genesis 5 Senate** — autonomously analyze, debate, and decide.

Any project that has deployed an ERC20 token on X Layer can register on the platform (1,000 XSEN fee) and immediately access:
- AI proposal scanning (Sentinel)
- 5-agent senate review with live streaming
- Relay debate with sequential agent argumentation
- On-chain proposal execution
- 4-tier staking with Voting Power and creator incentives

---

## Architecture

```
┌─────────────────────────────────────────┐
│         x-senate.vercel.app             │
│                                         │
│  Next.js 16 (App Router)                │
│  ├── /app           React UI            │
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
| Lock30 | 10% | 1.5x | 30 days | Auto |
| Lock90 | 20% | 2.0x | 90 days | Auto |
| Lock180 | 35% | 3.0x | 180 days | Auto |

- Position-based: one wallet can hold multiple positions
- Snapshot VP: agent voting power is locked at proposal creation (flash-stake proof)
- User Agents: anyone can register a custom AI agent and earn 3% creator reward from staking delegations
- Top 5 agents by delegated VP are ranked: 1st · 2nd · 3rd · 4th · 5th

---

## Multi-Tenant Registry

Any X Layer ERC20 project can register:
```
Fee: 1,000 XSEN → XSEN ecosystem fund
Result: dedicated staking contract + access to Genesis 5 senate
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS |
| API | Next.js API Routes (Vercel Serverless) |
| Database | Neon Postgres |
| AI | Anthropic Claude (claude-sonnet-4-6) |
| Blockchain | X Layer (OKX L2, chainId 196) |
| Contracts | Solidity 0.8.20 |
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

### Environment Variables

```
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-6
DATABASE_URL=postgres://...

# After contract deployment:
XSEN_TOKEN_ADDRESS=0x...
XSEN_STAKING_ADDRESS=0x...
XSEN_REGISTRY_ADDRESS=0x...
XLAYER_RPC_URL=https://rpc.xlayer.tech
XLAYER_PRIVATE_KEY=0x...
```

---

## Smart Contract Deployment

```bash
cd backend
pip install -r requirements.txt
python scripts/deploy_contract.py
```

Deploys in order:
1. XToken (XSEN ERC20 + vesting)
2. XSenateStaking (4-tier position staking)
3. XSenateGovernor (multi-tenant AI voting)
4. XSenateRegistry (permissionless project directory)

---

## Repository Structure

```
x-senate/
├── contracts/              Solidity contracts
│   ├── XToken.sol
│   ├── XSenateStaking.sol
│   ├── XSenateGovernor.sol
│   └── XSenateRegistry.sol
├── frontend/               Next.js app
│   ├── app/               Pages + API routes
│   ├── lib/               DB, agents, contract helpers
│   └── types/             TypeScript interfaces
├── backend/               Contract deployment scripts
│   └── scripts/
└── X-SENATE-PLAN.md       Full project plan
```

---

## OKX Integration

- **X Layer** — deployed on OKX's EVM L2 (chainId 196)
- **OKX Market API** — real-time token price feeds
- **OKX Wallet API** — portfolio and transaction data
- **OKX Security Scan** — token contract security check on project registration

---

*Built for the OKX × X Layer Hackathon 2025*
