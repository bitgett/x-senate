# Team QuackAI

We are QuackAI — a small team obsessed with the intersection of AI and on-chain governance.

X-Senate was built for the **OKX × X Layer OnchainOS AI Hackathon 2026**.

---

## Members

### David Lee (이경영)
**Role:** Founder · Full-Stack Engineer · Architect

- Designed the overall system architecture: multi-agent governance model, relay debate mechanism, multi-tenant registry pattern
- Built the entire frontend (Next.js 16, 10 pages, SSE streaming)
- Wrote all smart contracts (XToken, XSenateStaking, XSenateGovernor, XSenateRegistry)
- Designed the Genesis 5 AI agent system prompts and voting weight schema
- Integrated Anthropic Claude Sonnet 4.6 for all AI reasoning pipelines
- Integrated OKX OnchainOS APIs (Market API, Wallet API, x402 payments)
- Deployed all contracts to X Layer mainnet (chainId 196)
- Set up Vercel deployment, Neon Postgres, and production infrastructure

**Contact:**
- X (Twitter): [@Phavorable](https://x.com/Phavorable)
- Email: davidlee@quackai.ai

---

### Sophia
**Role:** Product & Research

- Product design and user experience direction
- Research into DAO governance failure modes and AI delegation models
- Hackathon submission strategy and documentation

**Contact:**
- LinkedIn: [sophia-791a09353](https://www.linkedin.com/in/sophia-791a09353/)

---

## Project Contacts

- **Project X (Twitter):** [@QuackAI](https://x.com/QuackAI)
- **Email:** davidlee@quackai.ai
- **Telegram:** @kwanyeonglee
- **GitHub:** [github.com/bitgett/x-senate](https://github.com/bitgett/x-senate)
- **Live Demo:** [x-senate.vercel.app](https://x-senate.vercel.app)

---

## Build Log

X-Senate was designed and built in a compressed timeline for the hackathon. The core insight — that DAO governance is an attention problem solvable by AI delegation — came from observing the same patterns across every DAO we'd participated in or studied: low participation, delegate capture, and proposals that pass because no one bothered to read them.

The relay debate mechanism was the unexpected breakthrough. When we switched from parallel agent voting to sequential argumentation (where each agent reads prior arguments before responding), the quality of reasoning improved dramatically. The agents started rebutting each other, qualifying their positions, and building toward consensus in ways that looked genuinely deliberative. That's the feature we're most proud of.

The multi-tenant architecture came from a different frustration: every project building on-chain governance reinvents the same wheel. Sentinel AI + Senate Review + Relay Debate + Staking should be infrastructure, not something each project builds from scratch.

We built this on X Layer because the fee structure makes micro-payment governance economically viable. $1 to submit a proposal, essentially free to vote. That's only possible on an L2 with negligible gas costs.

---

*"Build things that make governance work for the people who don't have time to govern."*
