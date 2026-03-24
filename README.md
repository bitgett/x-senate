# 🏛️ X-Senate: The Agentic Governance Layer

Multi-AI agent governance system for DAOs — Genesis 5 agents autonomously sense, debate, and execute proposals on X Layer.

## Quick Start

### 1. Set up environment
```bash
cp .env.example backend/.env
# Edit backend/.env and add your ANTHROPIC_API_KEY
```

### 2. Start backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Start frontend (new terminal)
```bash
cd frontend
npm install
npm run dev
```

### 4. Open http://localhost:3000

Or just run `start.bat` on Windows to launch both.

## Demo Flow

1. **Sentinel** → `/sentinel` → Click "Run Sentinel Scan"
   - Scans 25 mock community messages
   - Detects governance keywords (staking, rewards, fees...)
   - Claude generates a formal proposal draft
   - Click "View Proposal → Send to Senate"

2. **Senate Review** → Proposal page → "Submit to Senate Review"
   - All 5 Genesis agents vote independently (streamed live)
   - Guardian 🛡️ | Merchant 💰 | Architect ⚙️ | Diplomat 🤝 | Populist 👥
   - 3/5 approval = advances to debate
   - Toggle "Chain of Thought" to see agent reasoning

3. **Relay Debate** → "Enter Relay Debate"
   - Agents debate sequentially via WebSocket streaming
   - Each agent reads ALL prior arguments before responding
   - Watch words appear in real-time
   - Get one-liner opinion summary at the end

4. **Execute** → "Execute Proposal"
   - Mock Snapshot URL generated
   - Fake tx_hash + block number recorded
   - Run "Post-Vote Reflection" — agents self-critique their vote

## Architecture

```
Sentinel (Phase 1) → Forum/Discord/Telegram mock data
    ↓ keyword threshold triggered
Draft Proposal → Claude generates structured JSON
    ↓
Senate Review (Phase 2) → 5 parallel Claude calls with distinct personas
    ↓ 3/5 majority
Relay Debate (Phase 3) → Sequential context-chain debate via WebSocket
    ↓
Execute (Phase 4) → Mock Snapshot + SQLite on-chain record
    ↓
Reflection → Agents self-critique based on mock market data
```

## API Reference
- Swagger UI: http://localhost:8000/docs
- WebSocket debate: `ws://localhost:8000/api/debate/ws/{proposal_id}`

## Genesis 5 Personas
| Agent | Focus | Bias |
|-------|-------|------|
| 🛡️ Guardian | Security & Constitution | Conservative |
| 💰 Merchant | ROI & TVL | Aggressive |
| ⚙️ Architect | Technical Innovation | Feasibility |
| 🤝 Diplomat | Ecosystem Partnerships | Collaborative |
| 👥 Populist | Community Voice | Egalitarian |
