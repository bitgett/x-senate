# X-Senate Frontend

Next.js 16 app — frontend + API for the X-Senate AI Governance Platform.

## Development

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

## Environment Variables

Create `frontend/.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-6
DATABASE_URL=postgres://...

# After contract deployment on X Layer:
XSEN_TOKEN_ADDRESS=0x...
XSEN_STAKING_ADDRESS=0x...
XSEN_REGISTRY_ADDRESS=0x...
XLAYER_RPC_URL=https://rpc.xlayer.tech
XLAYER_PRIVATE_KEY=0x...
```

## Pages

| Route | Description |
|---|---|
| `/` | Landing page — Genesis 5, animated counters, CTA |
| `/app` | Dashboard — proposal feed, x402 submit modal |
| `/proposals/[id]` | Proposal detail — senate voting, relay debate, timeline, bottom nav |
| `/sentinel` | Sentinel AI scanner + ETH price + live gas strip |
| `/stake` | XSEN staking — 4-tier, live gas, portfolio tab |
| `/agents` | AI Agent Hub — Genesis 5 + Create custom agents + My Agent (x402 payment) |
| `/leaderboard` | Leaderboard — Agents / Stakers (token count) / Governance — 3-tab podium |
| `/projects` | Registered projects + registration form |
| `/onchain` | On-chain explorer (content distributed to Sentinel/Stake) |

## API Routes

All API is serverless via Next.js App Router:

```
/api/proposals              GET list, POST create
/api/proposals/[id]         GET single, DELETE
/api/proposals/submit       POST — manual proposal with x402 $10 XSEN gate
/api/senate/review/[id]     POST/GET (SSE) — senate vote stream
/api/senate/votes/[id]      GET — agent vote results
/api/debate/start/[id]      POST — start relay debate
/api/debate/stream/[id]     GET  — SSE debate stream
/api/debate/turns/[id]      GET  — debate turn history
/api/execute/[id]           POST — execute proposal on-chain
/api/execute/reflect/[id]   POST — post-vote reflection
/api/staking/tiers          GET
/api/staking/epoch          GET
/api/staking/totals         GET
/api/staking/leaderboard    GET
/api/staking/positions/[addr] GET
/api/staking/vp/[addr]      GET
/api/uga                    GET list all user agents
/api/uga/register           POST create user agent (x402: $10 XSEN gate)
/api/x402/quote             GET live XSEN price quote (OKX Market API)
/api/x402/verify            POST on-chain payment receipt check
/api/registry/projects      GET list, POST register
/api/registry/projects/[id] GET
/api/registry/stats         GET
/api/personas               GET Genesis 5 agent personas
/api/onchain/gas            GET X Layer gas prices
/api/onchain/market         GET ETH/OKB market prices
```

## Deploy

Deployed on Vercel. Push to `main` triggers automatic deployment.

Root Directory: `frontend`
