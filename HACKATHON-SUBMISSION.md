# X-Senate — OKX × X Layer OnchainOS AI Hackathon 2026
## Submission Document — Team QuackAI

**Live Demo:** https://x-senate.vercel.app
**GitHub:** https://github.com/bitgett/x-senate
**Network:** X Layer Mainnet (chainId 196)

---

## Project Summary

X-Senate is an AI-native governance platform for X Layer. Five specialized AI agents — the **Genesis 5 Senate** — autonomously scan, debate, and vote on governance proposals. Any ERC20 project on X Layer can register and access the full governance infrastructure: proposal pipeline, AI senate review, relay debate, on-chain execution, 4-tier staking with Voting Power, and a custom agent builder.

---

## Which OnchainOS Capabilities Does Your Project Use?

- [x] **Market API** — Live XSEN price (authenticated POST `/api/v6/dex/market/price`), price candles, token metadata. Used in Sentinel scanner, x402 quote, and staking dashboard.
- [x] **Wallet API** — Portfolio token balances and total USD value (`/api/v6/dex/balance/all-token-balances-by-address`, `/api/v6/dex/balance/total-value-by-address`). Displayed on Stake page.
- [x] **x402 Payments** — XSEN micropayment gate for agent registration and proposal submission. Quote → on-chain transfer → OKX x402 verify (`POST /api/v6/x402/verify`). Falls back to direct X Layer RPC receipt check.
- [x] **DApp Wallet Connect** — MetaMask and OKX Wallet connect to X Layer Mainnet (chainId 196). Auto-switch / add network via `wallet_switchEthereumChain` + `wallet_addEthereumChain`.

---

## AI Model & Version Used

**Anthropic Claude — `claude-sonnet-4-6`**

Used for:
- Genesis 5 senate agent voting (parallel, streamed via SSE)
- Relay debate (sequential agent argumentation, each reads prior turns)
- Sentinel proposal scanner
- Proposal reflection (post-vote self-critique)

---

## Prompt Design Overview
*(Max 600 characters — exact form answer)*

> X-Senate uses 5 specialized governance personas (Guardian, Merchant, Architect, Diplomat, Populist), each with a distinct system prompt: mandate, decision style (conservative→progressive slider), and 4-dimensional voting weights (Security, Economics, Community, Technical summing to 100%). Community agents use a visual builder to generate prompts in the same schema. All agents respond in structured JSON: `{"vote","reason","chain_of_thought","confidence"}`. Relay debate injects prior agent arguments as context to build sequential reasoning chains.

*(592 characters)*

---

## Full Prompt Architecture

### Genesis 5 System Prompt Structure

Each of the 5 Genesis agents has a hardcoded persona defined in `frontend/lib/personas.ts`:

```
You are [Name], a governance agent on X-Senate.

MANDATE: [role-specific mandate]

DECISION STYLE: [conservative / balanced / progressive description]

VOTING WEIGHTS:
- Security & Risk: X%
- Economic Impact: X%
- Community Benefit: X%
- Technical Feasibility: X%

Respond in valid JSON only:
{"vote": "Approve"|"Reject", "reason": "1-2 sentences",
 "chain_of_thought": "3-5 sentence reasoning", "confidence": 0-100}
```

| Agent | Mandate Focus | Style | Top Weight |
|---|---|---|---|
| Guardian | Protocol security & constitutional integrity | Conservative | Security 50% |
| Merchant | Revenue, TVL, capital efficiency | Aggressive | ROI/Revenue 60% |
| Architect | Technical feasibility, scalability | Pragmatic | Feasibility 40% |
| Diplomat | Ecosystem partnerships, reputation | Measured | Ecosystem 40% |
| Populist | Small holders, community fairness | Egalitarian | Community 50% |

### Relay Debate Context Injection

Each agent in the relay receives the full prior turn context:
```
[PRIOR DEBATE TURNS]
Guardian: "..." (Approve, 87%)
Merchant: "..." (Reject, 72%)
...

Now provide YOUR analysis as [AgentName]. You may agree or disagree with prior agents.
```

### Community Agent Builder

Users configure 4 parameters via UI → auto-generates system prompt in Genesis 5 format:
1. **Focus area** (7 presets: Security, DeFi/Economics, Technical, Community, Ecosystem, Risk Management, Innovation)
2. **Decision style slider** (0 = conservative, 100 = progressive)
3. **Voting weight sliders** (4 values, auto-normalize to 100%)
4. **Mandate text** (custom instruction)

Community agents participate in governance votes alongside Genesis 5 when delegated VP.

---

## Key Technical Decisions

### On-Chain Data: X Layer RPC Direct (No API Key Required)

Activity history uses `eth_getLogs` via X Layer RPC (`https://rpc.xlayer.tech`) — no third-party API dependency:
- Queries last ~100,000 blocks (Transfer events, Staking events, Governor events)
- Topics filtering: indexed address fields for both `topics[1]` and `topics[2]`
- Deduplication by txHash+logIndex, sorted by block descending

### x402 Payment Flow

```
1. GET /api/x402/quote → live XSEN price (OKX API → pool sqrtPriceX96 → fallback)
2. User approves + transfers XSEN to treasury on X Layer
3. POST /api/x402/verify (OKX OnchainOS) as primary verifier
4. Fallback: direct X Layer RPC eth_getTransactionReceipt
5. On success → register agent / submit proposal to DB
```

### VP (Voting Power) System

- 4-tier staking multipliers: 1.0x / 1.1x / 1.3x / 1.5x
- Snapshot VP: locked at proposal creation (prevents flash-stake gaming)
- Position-based: one wallet holds multiple staking positions
- Delegation: each position delegates independently to one governance agent

### Streaming Architecture

Senate review and relay debate stream via SSE (Server-Sent Events):
- Each agent's response streamed token-by-token via Anthropic streaming API
- Idempotent: reconnect replays from DB without re-running AI
- Vercel `maxDuration = 60`, Anthropic timeout = 25s, client AbortSignal = 55s

---

## Smart Contracts (X Layer Mainnet — chainId 196)

| Contract | Address |
|---|---|
| XToken (XSEN) | `0x1bAB744c4c98D844984e297744Cb6b4E24e2E89b` |
| XSenateStaking | `0x9CD9eF69c4EE176c8115E4BCf6c604Eb46599502` |
| XSenateGovernor | `0xa140f36Cc529e6487b877547A543213aD2ae39dF` |
| XSenateRegistry | `0xFd11e955CCEA6346911F33119B3bf84b3f0E6678` |
| Treasury | `0x8266D8e3B231dfD16fa21e40Cc3B99F38bC4B6C2` |

---

## What Makes X-Senate Different

1. **Not a voting UI** — the AI agents *are* the voters. Humans delegate their VP to agents that vote autonomously.
2. **Multi-tenant** — any X Layer ERC20 project gets the full governance stack by registering, no custom contracts needed.
3. **Relay Debate** — sequential argumentation where each agent reads and responds to prior agents, creating emergent consensus.
4. **x402 as economic moat** — spam-resistant governance via real-money proposal submission and agent registration.
5. **Community extensibility** — anyone can create and monetize a governance agent (3% creator reward on delegated votes).

---

*Built for the OKX × X Layer OnchainOS AI Hackathon 2026 by Team QuackAI*
