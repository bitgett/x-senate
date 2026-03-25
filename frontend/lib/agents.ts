/**
 * AI Agent logic — Claude-powered Genesis 5 agents
 * Ported from backend/agents/ + backend/services/claude_client.py
 */
import Anthropic from "@anthropic-ai/sdk";

// ─── Config ───────────────────────────────────────────────────────────────────

const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6";
const GENESIS_5 = ["Guardian", "Merchant", "Architect", "Diplomat", "Populist"] as const;
export type AgentName = (typeof GENESIS_5)[number];
export { GENESIS_5 };

const SENATE_APPROVAL_THRESHOLD = 3;
const GOVERNANCE_KEYWORDS = [
  "fee", "fees", "treasury", "upgrade", "vote", "voting", "parameter",
  "tokenomics", "reward", "rewards", "burn", "staking", "stake",
  "proposal", "governance", "fund", "budget", "allocation", "emission",
  "protocol", "smart contract", "liquidity", "tvl", "apy",
];
const KEYWORD_THRESHOLD = 5;

// ─── Claude client ────────────────────────────────────────────────────────────

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  return new Anthropic({ apiKey });
}

export async function claudeComplete(system: string, user: string, maxTokens = 2000): Promise<string> {
  const client = getClient();
  const msg = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  return (msg.content[0] as { text: string }).text;
}

export async function claudeCompleteJson(system: string, user: string, maxTokens = 1500): Promise<Record<string, unknown>> {
  const text = await claudeComplete(system, user + "\n\nRespond with valid JSON only.", maxTokens);
  const match = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) ?? text.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? (match[1] ?? match[0]) : text);
}

export async function* claudeStream(system: string, user: string, maxTokens = 2000): AsyncGenerator<string> {
  const client = getClient();
  const stream = await client.messages.stream({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  for await (const chunk of stream) {
    if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
      yield chunk.delta.text;
    }
  }
}

// ─── Personas ─────────────────────────────────────────────────────────────────

export const PERSONAS: Record<AgentName, { name: string; emoji: string; tagline: string; color: string; system_prompt: string }> = {
  Guardian: {
    name: "Guardian", emoji: "🛡️", tagline: "Security & Constitutional Integrity", color: "#4A90E2",
    system_prompt: `You are Guardian, a member of the X-Senate AI governance council.

YOUR MANDATE: Protect the protocol's security, constitutional integrity, and long-term stability above all else.
You are the last line of defense against reckless proposals that could harm the ecosystem.

DECISION STYLE:
- Conservative and skeptical of rapid change
- Demand rigorous risk analysis before approving anything
- Prioritize proven mechanisms over experimental ones
- If in doubt, reject — the protocol can always revisit later

VOTING WEIGHTS:
- Security implications: 50%
- Constitutional compliance: 30%
- Community impact: 20%

COMMUNICATION STYLE: Precise, formal, references specific risks and precedents. Cites security principles.

OUTPUT FORMAT for senate review (JSON):
{"vote": "Approve" or "Reject", "reason": "concise reason", "chain_of_thought": "detailed reasoning process", "confidence": 0-100}

ONE-LINER STYLE: Measured, serious, references specific risk vectors.`,
  },
  Merchant: {
    name: "Merchant", emoji: "💰", tagline: "Capital Efficiency & Token Value", color: "#F5A623",
    system_prompt: `You are Merchant, a member of the X-Senate AI governance council.

YOUR MANDATE: Maximize protocol revenue, TVL growth, token value, and capital efficiency. The protocol must generate returns.

DECISION STYLE:
- Aggressive and quantitative — you demand numbers, not feelings
- Ask: What's the ROI? What's the TVL impact? What's the revenue projection?
- If it doesn't make financial sense in 12 months, reject it

VOTING WEIGHTS:
- ROI / revenue impact: 60%
- TVL and liquidity effects: 25%
- Competitive positioning: 15%

COMMUNICATION STYLE: Blunt, numerical, impatient with vague arguments. Uses percentages, dollar amounts, yield figures.

OUTPUT FORMAT for senate review (JSON):
{"vote": "Approve" or "Reject", "reason": "concise reason", "chain_of_thought": "detailed reasoning process", "confidence": 0-100}

ONE-LINER STYLE: Sharp, numerical, challenges emotional reasoning.`,
  },
  Architect: {
    name: "Architect", emoji: "⚙️", tagline: "Technical Innovation & Infrastructure", color: "#7ED321",
    system_prompt: `You are Architect, a member of the X-Senate AI governance council.

YOUR MANDATE: Drive technical innovation, infrastructure reliability, and scalable protocol design.

DECISION STYLE:
- Technical first — feasibility, scalability, and implementation complexity matter
- Support innovation but demand a clear technical path
- Reject proposals with hand-wavy implementations

VOTING WEIGHTS:
- Technical feasibility: 40%
- Infrastructure impact: 30%
- Innovation value: 20%
- Security considerations: 10%

COMMUNICATION STYLE: Technical, precise, references architecture patterns, gas costs, smart contract implications.

OUTPUT FORMAT for senate review (JSON):
{"vote": "Approve" or "Reject", "reason": "concise reason", "chain_of_thought": "detailed reasoning process", "confidence": 0-100}

ONE-LINER STYLE: Technical, specific, notes implementation complexity.`,
  },
  Diplomat: {
    name: "Diplomat", emoji: "🤝", tagline: "Ecosystem Partnerships & Expansion", color: "#9B59B6",
    system_prompt: `You are Diplomat, a member of the X-Senate AI governance council.

YOUR MANDATE: Expand the protocol's ecosystem, forge strategic partnerships, and ensure X-Senate's proposals strengthen relationships with other DAOs and the broader Web3 community.

DECISION STYLE:
- Ecosystem-first — how does this affect our reputation and partnerships?
- Value collaboration and interoperability
- Prefer solutions that expand the pie rather than capture more of it

VOTING WEIGHTS:
- Ecosystem impact: 40%
- Partnership implications: 30%
- Reputation / precedent: 20%
- Community harmony: 10%

COMMUNICATION STYLE: Diplomatic, measured, references ecosystem trends and comparable protocols.

OUTPUT FORMAT for senate review (JSON):
{"vote": "Approve" or "Reject", "reason": "concise reason", "chain_of_thought": "detailed reasoning process", "confidence": 0-100}

ONE-LINER STYLE: Measured, ecosystem-focused, considers external perception.`,
  },
  Populist: {
    name: "Populist", emoji: "👥", tagline: "Community Voice & Small Holders", color: "#E74C3C",
    system_prompt: `You are Populist, a member of the X-Senate AI governance council.

YOUR MANDATE: Represent the voice of the community — especially small token holders, new participants, and those without technical expertise.

DECISION STYLE:
- Community-first — what do ordinary users actually want and need?
- Suspicious of complex proposals that obfuscate their real effects on small holders
- Champion accessibility, fairness, and transparency

VOTING WEIGHTS:
- Community sentiment and demand: 50%
- Small holder impact: 30%
- Accessibility and UX: 20%

COMMUNICATION STYLE: Passionate, accessible language, avoids jargon.

OUTPUT FORMAT for senate review (JSON):
{"vote": "Approve" or "Reject", "reason": "concise reason", "chain_of_thought": "detailed reasoning process", "confidence": 0-100}

ONE-LINER STYLE: Passionate, references community impact, accessible language.`,
  },
};

// ─── Senate Review ────────────────────────────────────────────────────────────

const SENATE_USER_TEMPLATE = `A Sentinel AI has identified the following governance proposal for your review.

PROPOSAL FOR REVIEW:
Title: {title}
Summary: {summary}
Motivation: {motivation}
Proposed Action: {proposed_action}
Potential Risks: {potential_risks}
Sentinel Analysis: {sentinel_analysis}

---
As {agent_name}, review this proposal and cast your vote.
Respond with valid JSON only:
{"vote": "Approve" or "Reject", "reason": "concise 1-2 sentence reason", "chain_of_thought": "your detailed reasoning process (3-5 sentences)", "confidence": 0-100}`;

function extractVoteJson(text: string): Record<string, unknown> {
  const match = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) ?? text.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? (match[1] ?? match[0]) : text);
}

async function voteAsync(agentName: AgentName, proposal: Record<string, string>) {
  const persona = PERSONAS[agentName];
  const userMsg = SENATE_USER_TEMPLATE
    .replace("{title}", proposal.title ?? "")
    .replace("{summary}", proposal.summary ?? "")
    .replace("{motivation}", proposal.motivation ?? "")
    .replace("{proposed_action}", proposal.proposed_action ?? "")
    .replace("{potential_risks}", proposal.potential_risks ?? "")
    .replace("{sentinel_analysis}", proposal.sentinel_analysis ?? "")
    .replace("{agent_name}", agentName);

  try {
    const text = await claudeComplete(persona.system_prompt, userMsg, 800);
    const data = extractVoteJson(text);
    return {
      agent: agentName,
      vote: (data.vote as string) || "Reject",
      reason: (data.reason as string) || "",
      chain_of_thought: (data.chain_of_thought as string) || "",
      confidence: Number(data.confidence ?? 50),
    };
  } catch (e) {
    return {
      agent: agentName,
      vote: "Reject",
      reason: `Error during review: ${e}`,
      chain_of_thought: "Technical error prevented proper review.",
      confidence: 0,
    };
  }
}

export function countVotes(votes: Array<{ vote: string; agent: string; confidence: number }>) {
  const approveCount = votes.filter((v) => v.vote === "Approve").length;
  const rejectCount = votes.filter((v) => v.vote === "Reject").length;
  const passed = approveCount >= SENATE_APPROVAL_THRESHOLD;
  return {
    approve_count: approveCount,
    reject_count: rejectCount,
    total_votes: votes.length,
    threshold: SENATE_APPROVAL_THRESHOLD,
    passed,
    result: passed ? "Passed" : "Rejected",
    breakdown: votes.map((v) => ({ agent: v.agent, vote: v.vote, confidence: v.confidence })),
  };
}

/** Async generator — yields each vote, then a tally event */
export async function* runSenateStreaming(proposal: Record<string, string>) {
  const allVotes = [];
  for (const agentName of GENESIS_5) {
    const vote = await voteAsync(agentName, proposal);
    allVotes.push(vote);
    yield vote;
  }
  const tally = countVotes(allVotes);
  yield {
    type: "tally",
    tally,
    status: tally.passed ? "In_Debate" : "Rejected_Senate",
  };
}

// ─── Relay Debate ─────────────────────────────────────────────────────────────

const DEBATE_SYSTEM_SUFFIX = `

DEBATE INSTRUCTIONS:
- You are in a live relay debate with the other Senate members.
- Read all prior arguments carefully before responding.
- Directly reference and respond to specific points made by other agents (use their names).
- State your position clearly and defend it with your persona's priorities.
- End your argument with a one-liner summary prefixed with "MY STANCE: "
- Keep your argument between 150-250 words. Be sharp and direct.`;

const SUMMARIZER_SYSTEM = `You are a neutral debate summarizer for X-Senate.
Given a full relay debate between 5 AI governance agents, extract each agent's ONE-LINER stance.
Look for lines starting with "MY STANCE:" in each agent's argument.
If not found, write your own one-liner based on their argument.

Output valid JSON:
{
  "Guardian": "one-liner",
  "Merchant": "one-liner",
  "Architect": "one-liner",
  "Diplomat": "one-liner",
  "Populist": "one-liner"
}`;

function formatDebateHistory(history: Array<{ agent_name: string; full_argument: string }>) {
  if (!history.length) return "(No prior arguments — you speak first.)";
  return history.map((t) => `--- ${t.agent_name} ---\n${t.full_argument}`).join("\n\n");
}

export async function* runRelayDebate(proposal: Record<string, string>) {
  const debateHistory: Array<{ agent_name: string; turn_order: number; full_argument: string; one_liner: string }> = [];

  for (let turnOrder = 0; turnOrder < GENESIS_5.length; turnOrder++) {
    const agentName = GENESIS_5[turnOrder];
    const persona = PERSONAS[agentName];
    const system = persona.system_prompt + DEBATE_SYSTEM_SUFFIX;

    const priorTurns = formatDebateHistory(debateHistory);
    const userMsg = `PROPOSAL UNDER DEBATE:
Title: ${proposal.title ?? ""}
Summary: ${proposal.summary ?? ""}
Proposed Action: ${proposal.proposed_action ?? ""}
Potential Risks: ${proposal.potential_risks ?? ""}

PRIOR DEBATE ARGUMENTS:
${priorTurns}

---
It is now YOUR turn, ${agentName}. Respond to the above arguments and state your position.
Remember to end with "MY STANCE: [one sentence]".`;

    yield {
      type: "turn_start",
      agent_name: agentName,
      turn_order: turnOrder,
      emoji: persona.emoji,
      color: persona.color,
    };

    let fullArgument = "";
    for await (const chunk of claudeStream(system, userMsg, 400)) {
      fullArgument += chunk;
      yield { type: "chunk", agent_name: agentName, turn_order: turnOrder, chunk };
    }

    const stanceMatch = fullArgument.includes("MY STANCE:")
      ? fullArgument.split("MY STANCE:").at(-1)!.split("\n")[0].trim()
      : fullArgument.slice(0, 100).trim() + "...";

    debateHistory.push({ agent_name: agentName, turn_order: turnOrder, full_argument: fullArgument, one_liner: stanceMatch });

    yield { type: "turn_end", agent_name: agentName, turn_order: turnOrder, full_argument: fullArgument, one_liner: stanceMatch };
  }

  // Summary
  const debateText = formatDebateHistory(debateHistory);
  let oneLiners: Record<string, string> = {};
  try {
    const summaryText = await claudeComplete(SUMMARIZER_SYSTEM, `Extract one-liners from this debate:\n\n${debateText}`, 400);
    const match = summaryText.match(/\{.*\}/s);
    oneLiners = match ? JSON.parse(match[0]) : {};
  } catch {
    oneLiners = Object.fromEntries(debateHistory.map((t) => [t.agent_name, t.one_liner]));
  }

  yield { type: "summary", one_liners: oneLiners, full_debate: debateHistory };
  yield { type: "done" };
}

// ─── Sentinel ─────────────────────────────────────────────────────────────────

const SENTINEL_SYSTEM = `You are Sentinel, the intelligence-gathering AI of X-Senate.
Your job is to monitor community discussions and identify the most pressing governance issue,
then draft a formal governance proposal for the Senate to review.

Always output valid JSON with this exact structure:
{
  "title": "Short, clear proposal title (max 10 words)",
  "summary": "2-3 sentence summary of what is being proposed",
  "motivation": "Why this proposal is needed — cite community sentiment and data",
  "proposed_action": "Specific, actionable change being requested",
  "potential_risks": "Honest assessment of what could go wrong",
  "sentinel_analysis": "Your meta-analysis: urgency level (Low/Medium/High/Critical), dominant topic, approximate community consensus percentage",
  "dominant_keyword": "The single governance keyword that appeared most"
}`;

const MOCK_MESSAGES = [
  { source: "forum", author: "yield_farmer_99", content: "We need to increase staking rewards by at least 10%. Current APY is not competitive vs Aave." },
  { source: "discord", author: "alpha_chad", content: "Staking rewards are way too low. Who's going to lock tokens for 5% APY? Ridiculous." },
  { source: "telegram", author: "moon_seeker", content: "The reward pool allocation needs a vote ASAP. We're losing liquidity to competitors." },
  { source: "forum", author: "defi_architect", content: "Proposal: Increase staking rewards from 5% to 15% for 6 months to boost TVL. This is urgent governance." },
  { source: "discord", author: "validator_queen", content: "Treasury has enough to cover a reward increase. Let's put it to a vote. Reward distribution must change." },
  { source: "telegram", author: "whale_anon", content: "I'll unstake my 2M tokens if rewards don't improve. This is a governance emergency." },
  { source: "forum", author: "protocol_nerd", content: "Current fee structure is outdated. We should implement dynamic fees based on TVL." },
  { source: "discord", author: "gas_watcher", content: "Fees are killing small users. Need a governance vote to change the fee tier parameters." },
  { source: "forum", author: "deflationary_dan", content: "Proposal to burn 5% of treasury tokens quarterly. This would significantly boost token value." },
  { source: "discord", author: "burn_maxi", content: "Burn the treasury allocation. It's sitting idle. Token holders deserve the value." },
  { source: "discord", author: "meme_lord", content: "GM everyone 🚀 who's buying the dip?" },
  { source: "telegram", author: "price_guy", content: "When lambo? Price action looking spicy today." },
  { source: "forum", author: "smart_contract_dev", content: "The current smart contract architecture needs an upgrade to support EIP-4337. This is a technical governance issue." },
  { source: "forum", author: "ecosystem_builder", content: "We should vote on allocating budget for ecosystem grants. Strong protocols do this." },
  { source: "forum", author: "staking_maximalist", content: "Vote needed: staking reward increase is the #1 community request for 3 months running." },
  { source: "discord", author: "locked_tokens", content: "My stake is up for renewal. Reward rate is the deciding factor. Governance needs to act on this." },
  { source: "telegram", author: "passive_income_pro", content: "APY comparison: us 5%, Aave 8%, Compound 7%. Our staking reward needs a governance update NOW." },
];

function classifyMessage(content: string) {
  const lower = content.toLowerCase();
  const hits = GOVERNANCE_KEYWORDS.filter((kw) => lower.includes(kw)).length;
  return hits >= 1 ? "governance" : "chatter";
}

function detectHotTopics(messages: typeof MOCK_MESSAGES) {
  const allText = messages.map((m) => m.content.toLowerCase()).join(" ");
  const counts: Record<string, number> = {};
  for (const kw of GOVERNANCE_KEYWORDS) {
    const c = (allText.match(new RegExp(kw, "g")) ?? []).length;
    if (c > 0) counts[kw] = c;
  }
  const triggered = Object.values(counts).some((c) => c >= KEYWORD_THRESHOLD);
  const dominant = triggered ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "" : "";
  return { triggered, counts, dominant };
}

export async function runSentinelScan() {
  const classified = MOCK_MESSAGES.map((m) => ({ ...m, classification: classifyMessage(m.content) }));
  const govMsgs = classified.filter((m) => m.classification === "governance");
  const chatMsgs = classified.filter((m) => m.classification === "chatter");
  const { triggered, counts, dominant } = detectHotTopics(MOCK_MESSAGES);

  const result: Record<string, unknown> = {
    total_messages_scanned: MOCK_MESSAGES.length,
    governance_messages: govMsgs.length,
    chatter_messages: chatMsgs.length,
    keyword_counts: counts,
    dominant_topic: dominant,
    threshold_triggered: triggered,
    sources: {
      forum: MOCK_MESSAGES.filter((m) => m.source === "forum").length,
      discord: MOCK_MESSAGES.filter((m) => m.source === "discord").length,
      telegram: MOCK_MESSAGES.filter((m) => m.source === "telegram").length,
    },
    draft_proposal: null,
    messages_preview: classified.slice(0, 15),
  };

  if (triggered) {
    const messagesText = MOCK_MESSAGES.map((m) => `[${m.source.toUpperCase()}] @${m.author}: ${m.content}`).join("\n");
    const topKw = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `"${k}" (${v}x)`).join(", ");

    const userPrompt = `Community messages from the past 7 days:\n\n${messagesText}\n\n---\nTop governance keywords detected: ${topKw}\nDominant topic cluster: "${dominant}"\nTotal governance-relevant messages: ${govMsgs.length}\n\nDraft a formal governance proposal based on the most pressing community concern.`;

    try {
      const draft = await claudeCompleteJson(SENTINEL_SYSTEM, userPrompt, 1500) as Record<string, unknown>;
      draft.source_data = JSON.stringify(govMsgs.slice(0, 10).map((m) => ({ source: m.source, content: m.content })));
      result.draft_proposal = draft;
    } catch (e) {
      result.error = String(e);
    }
  }

  return result;
}

// ─── Reflection ───────────────────────────────────────────────────────────────

const REFLECTION_SYSTEM = `You are {agent_name}, an X-Senate AI agent conducting a post-vote self-reflection.

REFLECTION INSTRUCTIONS:
- You previously voted on a governance proposal.
- You now have access to the market outcome data after the proposal passed/failed.
- Critically evaluate whether your vote was correct given the outcome.
- Identify what you underweighted or overweighted in your original reasoning.
- State what you would do differently in the next similar proposal.
- Be honest and specific — growth requires self-criticism.
- Keep your reflection to 100-150 words.`;

const FALLBACK_OUTCOMES = [
  { price_change_pct: -3.2, tvl_change_pct: 5.1, narrative: "Price dipped short-term but TVL increased." },
  { price_change_pct: 8.5, tvl_change_pct: 12.3, narrative: "Strong positive reaction — price and TVL surged." },
  { price_change_pct: -7.1, tvl_change_pct: -4.5, narrative: "Market reacted negatively post-execution." },
  { price_change_pct: 1.2, tvl_change_pct: -1.8, narrative: "Mixed signals — ambiguous market response." },
];

export async function runReflection(proposal: { title: string; summary: string }, agentVotes: Array<{ agent_name: string; vote: string; reason: string; chain_of_thought: string }>) {
  // Try to get real market data
  let outcome = FALLBACK_OUTCOMES[Math.floor(Math.random() * FALLBACK_OUTCOMES.length)];
  try {
    const res = await fetch("https://www.okx.com/api/v5/dex/market/price?chainIndex=196&tokenAddress=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");
    const data = await res.json();
    if (data.code === "0" && data.data?.[0]) {
      outcome = { price_change_pct: 0, tvl_change_pct: 0, narrative: `OKX Market API: ETH price $${data.data[0].price ?? "N/A"} on X Layer (chainIndex 196).` };
    }
  } catch { /* use fallback */ }

  const reflections: Record<string, unknown> = {};
  for (const voteData of agentVotes) {
    const agentName = voteData.agent_name as AgentName;
    if (!(agentName in PERSONAS)) continue;
    const persona = PERSONAS[agentName];
    const system = REFLECTION_SYSTEM.replace("{agent_name}", agentName) + "\n\n" + persona.system_prompt.slice(0, 300);
    const userMsg = `YOUR PRIOR VOTE:
Proposal: ${proposal.title}
You voted: ${voteData.vote}
Your reason: ${voteData.reason}
Your chain of thought: ${voteData.chain_of_thought}

MARKET OUTCOME (72 hours post-execution):
Price change: ${outcome.price_change_pct.toFixed(1)}%
TVL change: ${outcome.tvl_change_pct.toFixed(1)}%
Narrative: ${outcome.narrative}

Now reflect on whether your vote was correct and what you would do differently.`;

    try {
      const reflection = await claudeComplete(system, userMsg, 300);
      reflections[agentName] = { reflection, market_outcome: outcome };
    } catch (e) {
      reflections[agentName] = { reflection: `Reflection unavailable: ${e}`, market_outcome: outcome };
    }
  }
  return reflections;
}
