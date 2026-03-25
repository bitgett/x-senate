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
| `/` | Dashboard — proposal list, platform stats |
| `/proposals/[id]` | Proposal detail — senate voting, relay debate |
| `/proposals/[id]/senate` | Live senate vote stream |
| `/proposals/[id]/debate` | Relay debate stream |
| `/proposals/[id]/execute` | On-chain execution |
| `/sentinel` | Sentinel AI scanner |
| `/stake` | XSEN staking — tiers, positions, leaderboard |
| `/projects` | Registered projects + registration form |
| `/projects/[id]` | Per-project governance view |
| `/onchain` | On-chain explorer |

## API Routes

All API is serverless via Next.js App Router:

```
/api/proposals          GET list, POST create
/api/proposals/[id]     GET single, DELETE
/api/senate/review/[id] POST — triggers SSE senate vote stream
/api/senate/votes/[id]  GET — agent vote results
/api/debate/start/[id]  POST — start relay debate
/api/debate/stream/[id] GET  — SSE debate stream
/api/execute/[id]       POST — execute proposal on-chain
/api/staking/tiers      GET
/api/staking/epoch      GET
/api/staking/totals     GET
/api/staking/leaderboard GET
/api/staking/positions/[addr] GET
/api/staking/vp/[addr]  GET
/api/registry/projects  GET list, POST register
/api/registry/projects/[id] GET
/api/registry/stats     GET
```

## Deploy

Deployed on Vercel. Push to `main` triggers automatic deployment.

Root Directory: `frontend`
