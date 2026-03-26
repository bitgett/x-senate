"use client";
import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { PERSONA_META } from "@/types";
import { fetchUGAs, registerUGA } from "@/lib/api";
import { useWallet } from "@/contexts/WalletContext";

// ── Types ──────────────────────────────────────────────────────────────────

interface UGAAgent {
  id: string;
  wallet_address: string;
  agent_name: string;
  focus_area?: string;
  rank: "Bronze" | "Silver" | "Gold";
  delegated_vp: number;
  participation_rate: number;
  proposal_success_rate: number;
  score: number;
  created_at?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

function safeAddr(env: string | undefined, fallback: string): string {
  try { return ethers.getAddress((env ?? fallback).trim().toLowerCase()); } catch { return fallback; }
}
const STAKING_ADDRESS = safeAddr(process.env.NEXT_PUBLIC_XSEN_STAKING_ADDRESS, "0xc8FD7B12De6bFb10dF3eaCb38AAc09CBbeb25bFD");
const STAKING_ABI = [
  "function getUserPositions(address user) view returns (tuple(uint256 id, address owner, uint256 amount, uint8 tier, uint256 lockEnd, uint256 stakedAt, uint256 lastRewardAt, uint256 accReward, string delegatedAgent, bool active)[])",
  "function delegatePosition(uint256 positionId, string agentName) external",
];
const STAKING_IFACE = new ethers.Interface(STAKING_ABI);
const TOKEN_TRANSFER_IFACE = new ethers.Interface(["function transfer(address to, uint256 amount) returns (bool)"]);
const RPC_PROVIDER = new ethers.JsonRpcProvider("https://rpc.xlayer.tech");
async function sendTx(rawProv: any, from: string, to: string, data: string): Promise<string> {
  return await rawProv.request({ method: "eth_sendTransaction", params: [{ from, to, data, gas: "0x3D090" }] });
}
async function waitTx(hash: string): Promise<void> {
  for (let i = 0; i < 60; i++) {
    const r = await RPC_PROVIDER.getTransactionReceipt(hash).catch(() => null);
    if (r) return;
    await new Promise(res => setTimeout(res, 2000));
  }
  throw new Error("Transaction not confirmed after 2 minutes");
}

const AGENT_DETAILS: Record<string, { mandate: string; style: string; weights: string[]; accent: string }> = {
  Guardian:  { mandate: "Protect protocol security, constitutional integrity, and long-term stability.", style: "Conservative, skeptical of rapid change. Demands rigorous risk analysis.", weights: ["Security: 50%", "Constitution: 30%", "Community: 20%"], accent: "#3b82f6" },
  Merchant:  { mandate: "Maximize protocol revenue, TVL growth, token value, and capital efficiency.",   style: "Aggressive and quantitative. Dismisses sentiment without financial backing.",  weights: ["ROI/Revenue: 60%", "TVL/Liquidity: 25%", "Positioning: 15%"],          accent: "#eab308" },
  Architect: { mandate: "Drive technical innovation, infrastructure reliability, and scalable design.",   style: "Technical-first. Evaluates feasibility, scalability, and implementation risks.", weights: ["Feasibility: 40%", "Infrastructure: 30%", "Innovation: 20%", "Security: 10%"], accent: "#22c55e" },
  Diplomat:  { mandate: "Expand the ecosystem, forge partnerships, ensure reputation integrity.",          style: "Measured and ecosystem-first. Considers external perceptions and precedents.",   weights: ["Ecosystem: 40%", "Partnerships: 30%", "Reputation: 20%", "Harmony: 10%"],   accent: "#a855f7" },
  Populist:  { mandate: "Represent the community — especially small token holders and new participants.",  style: "Passionate, accessible language. Champions fairness and transparency.",          weights: ["Community: 50%", "Small Holders: 30%", "Accessibility: 20%"],              accent: "#ef4444" },
};

interface FocusPreset {
  icon: string;
  style: number;
  weights: { sec: number; eco: number; com: number; tech: number };
  mandatePlaceholder: string;
  description: string;
}

const FOCUS_PRESETS: Record<string, FocusPreset> = {
  "Security": {
    icon: "🛡️",
    style: 18,
    weights: { sec: 55, eco: 15, com: 15, tech: 15 },
    mandatePlaceholder: "reject any proposal that introduces unaudited code or untested attack surfaces",
    description: "Prioritizes protocol safety above all. Skeptical of rapid changes.",
  },
  "DeFi/Economics": {
    icon: "💰",
    style: 68,
    weights: { sec: 20, eco: 55, com: 10, tech: 15 },
    mandatePlaceholder: "maximize protocol revenue and TVL while maintaining sustainable tokenomics",
    description: "Driven by economic metrics — ROI, TVL, fee efficiency, yield.",
  },
  "Technical": {
    icon: "⚙️",
    style: 45,
    weights: { sec: 20, eco: 15, com: 10, tech: 55 },
    mandatePlaceholder: "only approve proposals with clear implementation plans and audited smart contracts",
    description: "Evaluates feasibility, code quality, and scalability first.",
  },
  "Community": {
    icon: "👥",
    style: 72,
    weights: { sec: 10, eco: 20, com: 55, tech: 15 },
    mandatePlaceholder: "champion fairness for small holders and prioritize broad community benefit",
    description: "Voices the community — accessibility, fairness, and inclusion.",
  },
  "Ecosystem": {
    icon: "🌐",
    style: 60,
    weights: { sec: 15, eco: 30, com: 35, tech: 20 },
    mandatePlaceholder: "support proposals that grow the X Layer ecosystem and attract new projects",
    description: "Thinks long-term — partnerships, ecosystem growth, reputation.",
  },
  "Risk Management": {
    icon: "⚠️",
    style: 12,
    weights: { sec: 45, eco: 25, com: 10, tech: 20 },
    mandatePlaceholder: "block any proposal where expected downside risk exceeds projected upside",
    description: "Ultra-conservative. Models worst-case scenarios before approving.",
  },
  "Innovation": {
    icon: "🚀",
    style: 85,
    weights: { sec: 10, eco: 30, com: 20, tech: 40 },
    mandatePlaceholder: "embrace bold technical innovation that positions the protocol ahead of competitors",
    description: "Progressive and forward-looking. Backs high-upside experiments.",
  },
};

const FOCUS_AREAS = Object.keys(FOCUS_PRESETS);

const RANK_STYLE: Record<string, { badge: string; icon: string }> = {
  Gold:   { badge: "bg-yellow-900/40 text-yellow-300 border-yellow-600/40", icon: "🥇" },
  Silver: { badge: "bg-gray-700/40 text-gray-300 border-gray-500/40",       icon: "🥈" },
  Bronze: { badge: "bg-orange-900/30 text-orange-400 border-orange-700/30", icon: "🥉" },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(v: number | string | undefined | null): string {
  const n = Number(v ?? 0);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function pct(v: number | string | undefined | null): string {
  return `${(Number(v ?? 0) * 100).toFixed(0)}%`;
}

function buildSystemPrompt(cfg: {
  name: string; focus: string; style: number;
  sec: number; eco: number; com: number; tech: number; mandate: string;
}): string {
  const styleDesc = cfg.style < 33 ? "conservative and risk-averse, preferring proven approaches over experimental ones"
                  : cfg.style < 66 ? "balanced and measured, weighing trade-offs pragmatically"
                  : "progressive and change-oriented, embracing innovation when benefits outweigh risks";
  return `You are ${cfg.name}, a governance agent on X-Senate focused on ${cfg.focus}.

MANDATE: ${cfg.mandate || `Evaluate proposals from a ${cfg.focus} perspective and vote in the best interest of the protocol.`}

DECISION STYLE: You are ${styleDesc}. Always provide clear, evidence-based reasoning rooted in your focus area.

VOTING WEIGHTS:
- Security & Risk: ${cfg.sec}%
- Economic Impact: ${cfg.eco}%
- Community Benefit: ${cfg.com}%
- Technical Feasibility: ${cfg.tech}%

When reviewing proposals, prioritize dimensions with the highest weight. Be direct and specific.
Respond in valid JSON only:
{"vote": "Approve" or "Reject", "reason": "1-2 sentences", "chain_of_thought": "3-5 sentence reasoning", "confidence": 0-100}`;
}

function getMockVote(cfg: { sec: number; eco: number; com: number; tech: number; style: number }) {
  // Simple heuristic: economic weight drives approve confidence
  const baseConf = 50 + (cfg.eco - 25) * 0.4 + (cfg.style - 50) * 0.2;
  const conf = Math.max(30, Math.min(95, Math.round(baseConf)));
  const approve = conf > 55;
  const topWeight = Object.entries({ Security: cfg.sec, Economics: cfg.eco, Community: cfg.com, Technical: cfg.tech })
    .sort((a, b) => b[1] - a[1])[0][0];
  return {
    vote: approve ? "Approve" : "Reject",
    confidence: conf,
    reason: approve
      ? `From a ${topWeight} standpoint, the 15% reward increase is justified — it strengthens long-term staker retention.`
      : `The ${topWeight} implications are underspecified. Treasury impact needs clearer runway analysis before approval.`,
  };
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const { wallet, walletType, openModal, rawProvider } = useWallet();
  const [tab, setTab] = useState<"browse" | "create" | "mine">("browse");

  // Browse data
  const [leaderboard, setLb] = useState<any[]>([]);
  const [ugas, setUgas]      = useState<UGAAgent[]>([]);
  const [loading, setLoading] = useState(true);

  // Delegate state
  const [delegating, setDelegating] = useState<string | null>(null);
  const [txStatus, setTxStatus]     = useState<string | null>(null);

  // Create form state
  const [agentName, setAgentName]     = useState("");
  const [focusArea, setFocusArea]     = useState("Community");
  const [style, setStyle]             = useState(FOCUS_PRESETS["Community"].style);
  const [weights, setWeights]         = useState(FOCUS_PRESETS["Community"].weights);
  const [mandate, setMandate]         = useState("");

  function selectFocusArea(area: string) {
    const preset = FOCUS_PRESETS[area];
    setFocusArea(area);
    setStyle(preset.style);
    setWeights(preset.weights);
    // Only clear mandate if it's empty or was the previous preset placeholder
    // Don't override if user has typed something custom
  }
  const [showPrompt, setShowPrompt]   = useState(false);
  const [customMode, setCustomMode]   = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [registering, setRegistering]  = useState(false);
  const [registerResult, setRegResult]  = useState<{ ok: boolean; msg: string } | null>(null);
  const [payStep, setPayStep]           = useState<"idle" | "fetching" | "paying" | "verifying" | "done">("idle");
  const [payQuote, setPayQuote]         = useState<{ xsen_amount: number; usd_fee: number; xsen_price_usd: number } | null>(null);

  function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500_000) { setRegResult({ ok: false, msg: "Image too large. Max 500KB." }); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Resize to 200x200 via canvas
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 200; canvas.height = 200;
        const ctx = canvas.getContext("2d")!;
        // Cover crop: center
        const scale = Math.max(200 / img.width, 200 / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, (200 - w) / 2, (200 - h) / 2, w, h);
        setAvatarBase64(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/staking/leaderboard?limit=10").then(r => r.ok ? r.json() : null),
      fetchUGAs().catch(() => []),
    ]).then(([lb, ugaList]) => {
      setLb(lb?.leaderboard ?? []);
      setUgas(Array.isArray(ugaList) ? ugaList : []);
    }).finally(() => setLoading(false));
  }, []);

  // Normalize weights so they sum to 100
  function setWeight(key: keyof typeof weights, val: number) {
    const clamped = Math.max(0, Math.min(100, val));
    const others = (Object.keys(weights) as (keyof typeof weights)[]).filter(k => k !== key);
    const remaining = 100 - clamped;
    const prevOthersSum = others.reduce((s, k) => s + weights[k], 0);
    const newWeights = { ...weights, [key]: clamped };
    if (prevOthersSum > 0) {
      others.forEach(k => {
        newWeights[k] = Math.round((weights[k] / prevOthersSum) * remaining);
      });
      // Fix rounding drift
      const drift = 100 - Object.values(newWeights).reduce((s, v) => s + v, 0);
      newWeights[others[0]] += drift;
    } else {
      const share = Math.floor(remaining / others.length);
      others.forEach(k => { newWeights[k] = share; });
    }
    setWeights(newWeights);
  }

  async function handleDelegate(agentName: string) {
    if (!wallet) { openModal(); return; }
    setDelegating(agentName);
    setTxStatus(null);
    try {
      const raw = rawProvider();
      const staking = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI, RPC_PROVIDER);
      const positions = await staking.getUserPositions(wallet).catch(() => []);
      const activePos = positions.find((p: any) => p.active);
      if (!activePos) { setTxStatus("No active staking position. Stake XSEN first."); setDelegating(null); return; }
      const txHash = await sendTx(raw, wallet, STAKING_ADDRESS,
        STAKING_IFACE.encodeFunctionData("delegatePosition", [activePos.id, agentName]));
      setTxStatus(`Delegating to ${agentName}...`);
      await waitTx(txHash);
      setTxStatus(`✓ Delegated to ${agentName}`);
    } catch (e: any) {
      setTxStatus(`Error: ${e.message?.slice(0, 80)}`);
    }
    setDelegating(null);
  }

  const loadUgas = useCallback(async () => {
    const list = await fetchUGAs().catch(() => []);
    setUgas(Array.isArray(list) ? list : []);
  }, []);

  async function handleRegister() {
    if (!wallet) { openModal(); return; }
    if (!agentName.trim()) { setRegResult({ ok: false, msg: "Agent name is required." }); return; }
    setRegistering(true);
    setRegResult(null);
    setPayStep("fetching");
    try {
      // Step 1: Get x402 quote (live XSEN price from OKX Market API)
      const quoteRes = await fetch("/api/x402/quote");
      const quote = await quoteRes.json();
      setPayQuote(quote);
      setPayStep("paying");

      // Step 2: Transfer XSEN to treasury
      const txHash = await sendTx(rawProvider(), wallet, quote.xsen_token,
        TOKEN_TRANSFER_IFACE.encodeFunctionData("transfer", [quote.treasury, BigInt(quote.xsen_amount_wei)]));
      setPayStep("verifying");
      await waitTx(txHash);

      // Step 3: Register with payment proof
      setPayStep("done");
      await registerUGA({
        wallet_address: wallet,
        agent_name: agentName.trim(),
        system_prompt: customMode ? customPrompt : buildSystemPrompt({ name: agentName.trim(), focus: focusArea, style, ...weights, mandate }),
        focus_area: focusArea,
        avatar_base64: avatarBase64 ?? undefined,
        payment_tx_hash: txHash,
      } as any);
      setRegResult({ ok: true, msg: `Agent "${agentName.trim()}" registered! Payment: ${Math.ceil(quote.xsen_amount).toLocaleString()} XSEN ($${quote.usd_fee})` });
      await loadUgas();
      setTimeout(() => setTab("mine"), 1500);
    } catch (e: any) {
      setRegResult({ ok: false, msg: e.message ?? "Registration failed" });
    }
    setRegistering(false);
    setPayStep("idle");
  }

  const myAgent = wallet ? ugas.find(u => u.wallet_address.toLowerCase() === wallet.toLowerCase()) : null;
  const generatedPrompt = customMode
    ? customPrompt
    : buildSystemPrompt({ name: agentName || "MyAgent", focus: focusArea, style, ...weights, mandate });
  const mockVote = getMockVote({ ...weights, style });

  return (
    <div className="w-full space-y-0">

      {/* ── Header ── */}
      <div className="pb-6 border-b border-gray-800/60">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-black text-white">AI Agent Hub</h1>
            <p className="text-sm text-gray-500 mt-1">
              Genesis 5 govern X-Senate. Create your own AI agent and earn delegation from the community.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="border border-gray-800 rounded-full px-3 py-1.5 text-gray-500">
              <span className="text-white font-bold">5</span> Genesis · <span className="text-purple-300 font-bold">{ugas.length}</span> Community
            </div>
            <button
              onClick={() => setTab("create")}
              className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-4 py-1.5 rounded-full transition-colors"
              style={{ boxShadow: "0 0 12px rgba(139,92,246,0.3)" }}
            >
              + Create Agent
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mt-5">
          {(["browse", "create", "mine"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all capitalize ${
                tab === t ? "border-purple-500 text-white" : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {t === "browse" ? "Browse Agents" : t === "create" ? "Create Agent" : "My Agent"}
              {t === "mine" && myAgent && (
                <span className="ml-2 text-[10px] bg-purple-600/30 text-purple-300 rounded-full px-1.5 py-0.5">1</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── TX Status ── */}
      {txStatus && (
        <div className={`mt-4 inline-block rounded-full px-4 py-1.5 text-xs border ${txStatus.startsWith("Error") ? "bg-red-900/20 border-red-700/40 text-red-300" : "bg-green-900/20 border-green-700/40 text-green-300"}`}>
          {txStatus}
        </div>
      )}

      {/* ══════════════════════════════════════ BROWSE TAB ══════ */}
      {tab === "browse" && (
        <div className="py-6 space-y-10">

          {/* Genesis 5 */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-sm font-semibold text-white">Genesis 5</h2>
              <span className="text-[10px] bg-purple-900/40 text-purple-300 border border-purple-700/30 rounded-full px-2 py-0.5">Official Senate</span>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {Object.entries(PERSONA_META).map(([name, meta]) => {
                const details = AGENT_DETAILS[name];
                const lb = leaderboard.find(l => l.agent_name === name);
                return (
                  <div key={name} className="flex flex-col bg-gray-900/60 border border-gray-800/60 rounded-2xl p-4 hover:border-gray-700 transition-colors"
                    style={{ borderTopColor: details?.accent, borderTopWidth: "2px" }}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{meta.emoji}</span>
                        <div>
                          <div className="font-bold text-white text-sm">{name}</div>
                          <div className="text-[10px] text-gray-500">{meta.tagline}</div>
                        </div>
                      </div>
                      {lb?.rank_label && (
                        <span className="text-[10px] text-gray-600 bg-gray-800 rounded-full px-2 py-0.5">{lb.rank_label}</span>
                      )}
                    </div>

                    <p className="text-gray-400 text-xs leading-relaxed mb-3">{details?.mandate}</p>

                    <div className="space-y-1 flex-1">
                      {details?.weights.map(w => (
                        <div key={w} className="flex items-center gap-1.5 text-[11px] text-gray-500">
                          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: details.accent }} />
                          {w}
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 pt-2 border-t border-gray-800/60 flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 text-[11px] text-green-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        Online
                      </div>
                      {lb && (
                        <span className="text-[11px] text-purple-300 font-semibold">{fmt(lb.total_delegated_vp_xsen)} VP</span>
                      )}
                    </div>

                    <button
                      onClick={() => handleDelegate(name)}
                      disabled={!!delegating}
                      className="w-full text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-40 border border-gray-700 text-white py-1.5 rounded-lg transition-colors"
                    >
                      {delegating === name ? "Delegating..." : "Delegate VP"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* How the Senate Works */}
          <div className="border border-gray-800/60 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">How the Senate Works</h3>
            <ol className="text-gray-500 text-sm space-y-1.5 list-decimal list-inside">
              <li>Sentinel scans community channels and generates a governance proposal</li>
              <li>All 5 Genesis agents independently vote Approve / Reject</li>
              <li>If 3+ approve → Proposal advances to Relay Debate</li>
              <li>Agents debate sequentially, each reading prior arguments</li>
              <li>Debate summary recorded on-chain · Proposal executed or rejected</li>
            </ol>
          </div>

          {/* Community Agents */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white">Community Agents</h2>
                <span className="text-[10px] bg-blue-900/30 text-blue-300 border border-blue-700/30 rounded-full px-2 py-0.5">Advisory</span>
              </div>
              <button
                onClick={() => setTab("create")}
                className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                + Create yours →
              </button>
            </div>

            {loading ? (
              <div className="text-center py-10 text-gray-700 text-sm">Loading agents...</div>
            ) : ugas.length === 0 ? (
              <div className="border border-dashed border-gray-800 rounded-xl p-12 text-center">
                <div className="text-3xl mb-3">🤖</div>
                <p className="text-gray-600 text-sm mb-2">No community agents yet.</p>
                <p className="text-gray-700 text-xs mb-4">Be the first to create a custom AI governance agent.</p>
                <button
                  onClick={() => setTab("create")}
                  className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold px-5 py-2 rounded-full transition-colors"
                >
                  Create First Agent →
                </button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {ugas.map(u => {
                  const rank = RANK_STYLE[u.rank] ?? RANK_STYLE.Bronze;
                  return (
                    <div key={u.id} className="border border-gray-800/60 rounded-xl p-4 hover:border-gray-700 transition-colors bg-gray-900/30">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-gray-800 border border-gray-700 overflow-hidden flex items-center justify-center text-sm font-black text-white shrink-0">
                            {(u as any).avatar_base64
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={(u as any).avatar_base64} alt={u.agent_name} className="w-full h-full object-cover" />
                              : u.agent_name[0].toUpperCase()
                            }
                          </div>
                          <div>
                            <div className="font-semibold text-white text-sm">{u.agent_name}</div>
                            <div className="text-[11px] text-gray-500">{u.focus_area ?? "General"}</div>
                          </div>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${rank.badge}`}>
                          {rank.icon} {u.rank}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="text-center bg-gray-800/40 rounded-lg py-2">
                          <div className="text-sm font-bold text-purple-300">{fmt(u.delegated_vp)}</div>
                          <div className="text-[10px] text-gray-600 mt-0.5">Delegated VP</div>
                        </div>
                        <div className="text-center bg-gray-800/40 rounded-lg py-2">
                          <div className="text-sm font-bold text-white">{pct(u.participation_rate)}</div>
                          <div className="text-[10px] text-gray-600 mt-0.5">Participation</div>
                        </div>
                      </div>

                      <div className="text-[11px] text-gray-600 mb-3">
                        by {u.wallet_address.slice(0, 6)}...{u.wallet_address.slice(-4)}
                      </div>

                      <button
                        onClick={() => handleDelegate(u.agent_name)}
                        disabled={!!delegating}
                        className="w-full text-xs font-semibold bg-purple-600/20 hover:bg-purple-600/30 disabled:opacity-40 border border-purple-500/30 text-purple-300 py-1.5 rounded-lg transition-colors"
                      >
                        {delegating === u.agent_name ? "Delegating..." : "+ Delegate VP"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════ CREATE TAB ══════ */}
      {tab === "create" && (
        <div className="py-6">
          <div className="max-w-2xl space-y-6">

            <div className="border border-gray-800/60 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-800/40 bg-gray-900/30">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-white">Agent Builder</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Design your AI agent's personality and governance focus</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5 bg-yellow-900/20 border border-yellow-700/40 rounded-full px-3 py-1.5">
                    <span className="text-yellow-400 text-xs">⚡</span>
                    <span className="text-yellow-400 text-xs font-bold">~$10</span>
                    <span className="text-yellow-600 text-[11px]">in XSEN</span>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Step 1: Basic Info */}
                <div className="space-y-4">
                  <div className="text-xs text-gray-600 uppercase tracking-widest">Step 1 — Identity</div>

                  {/* Avatar upload */}
                  <div className="flex items-center gap-5">
                    <div className="relative shrink-0">
                      <div className="w-[80px] h-[80px] rounded-2xl overflow-hidden border-2 border-gray-700 bg-gray-800 flex items-center justify-center">
                        {avatarBase64 ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={avatarBase64} alt="avatar" className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-2xl text-gray-600">{agentName ? agentName[0].toUpperCase() : "?"}</span>
                          </div>
                        )}
                      </div>
                      {avatarBase64 && (
                        <button
                          onClick={() => setAvatarBase64(null)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 rounded-full text-white text-[10px] flex items-center justify-center hover:bg-red-500"
                        >×</button>
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-400 mb-1.5 block">Profile Image <span className="text-gray-700">(200×200px · JPEG/PNG)</span></label>
                      <label className="flex items-center gap-2 cursor-pointer w-fit">
                        <div className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs px-4 py-2 rounded-lg transition-colors">
                          {avatarBase64 ? "Change Image" : "Upload Image"}
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                          className="hidden"
                        />
                      </label>
                      <p className="text-[10px] text-gray-700 mt-1.5">Auto-cropped to 200×200. Max 500KB.</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 block">Agent Name <span className="text-gray-700">(unique, public)</span></label>
                    <input
                      type="text"
                      value={agentName}
                      onChange={e => setAgentName(e.target.value.slice(0, 24))}
                      placeholder="e.g. AlphaGuard, VaultKeeper, DeFiOwl..."
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500"
                    />
                    <div className="text-[10px] text-gray-700 mt-1">{agentName.length}/24 characters</div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-2 block">Focus Area <span className="text-gray-700">— presets slider values automatically</span></label>
                    <div className="grid grid-cols-2 gap-2">
                      {FOCUS_AREAS.map(f => {
                        const preset = FOCUS_PRESETS[f];
                        const isSelected = focusArea === f;
                        return (
                          <button
                            key={f}
                            onClick={() => selectFocusArea(f)}
                            className={`flex items-start gap-2.5 text-left px-3 py-2.5 rounded-xl border transition-all ${
                              isSelected
                                ? "bg-purple-600/20 border-purple-500/50 text-purple-300"
                                : "border-gray-800 text-gray-500 hover:border-gray-700 hover:text-gray-400 bg-gray-900/30"
                            }`}
                          >
                            <span className="text-base shrink-0 mt-0.5">{preset.icon}</span>
                            <div className="min-w-0">
                              <div className={`text-xs font-semibold ${isSelected ? "text-purple-300" : "text-gray-400"}`}>{f}</div>
                              <div className="text-[10px] text-gray-600 mt-0.5 leading-snug">{preset.description}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="h-px bg-gray-800" />

                {/* Step 2: Personality Builder — with Custom Prompt toggle */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-600 uppercase tracking-widest">Step 2 — Personality</div>
                    {/* Toggle: Builder vs Custom Prompt */}
                    <div className="flex items-center gap-1 bg-gray-800 rounded-full p-0.5">
                      <button
                        onClick={() => setCustomMode(false)}
                        className={`text-[11px] px-3 py-1 rounded-full transition-all ${!customMode ? "bg-purple-600 text-white font-semibold" : "text-gray-500 hover:text-gray-400"}`}
                      >
                        Builder
                      </button>
                      <button
                        onClick={() => setCustomMode(true)}
                        className={`text-[11px] px-3 py-1 rounded-full transition-all ${customMode ? "bg-purple-600 text-white font-semibold" : "text-gray-500 hover:text-gray-400"}`}
                      >
                        Custom Prompt
                      </button>
                    </div>
                  </div>

                  {customMode ? (
                    /* Custom prompt mode */
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-gray-400">Your System Prompt <span className="text-gray-700">(max 10 lines)</span></label>
                        <span className="text-[11px] text-gray-600">{customPrompt.split("\n").length}/10 lines</span>
                      </div>
                      <textarea
                        rows={8}
                        value={customPrompt}
                        onChange={e => {
                          const lines = e.target.value.split("\n");
                          if (lines.length <= 10) setCustomPrompt(e.target.value);
                        }}
                        placeholder={`You are [AgentName], a governance agent on X-Senate.\n\nMANDATE: Vote to protect long-term protocol health.\n\nWhen reviewing proposals, respond in JSON:\n{"vote": "Approve" or "Reject", "reason": "...", "chain_of_thought": "...", "confidence": 0-100}`}
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-xs font-mono placeholder-gray-700 focus:outline-none focus:border-purple-500 resize-none leading-relaxed"
                      />
                      <p className="text-[11px] text-gray-700">
                        Write your full agent system prompt. The sliders are disabled in Custom Prompt mode. Your prompt controls all voting behavior.
                      </p>
                    </div>
                  ) : (
                    /* Builder mode */
                    <>
                      {/* Style slider */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs text-gray-400">Decision Style</label>
                          <span className="text-xs text-gray-500">{style < 33 ? "Conservative" : style < 66 ? "Balanced" : "Progressive"}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-gray-600 shrink-0">Conservative</span>
                          <input
                            type="range" min={0} max={100} value={style}
                            onChange={e => setStyle(Number(e.target.value))}
                            className="flex-1 accent-purple-500 h-1.5 cursor-pointer"
                          />
                          <span className="text-[10px] text-gray-600 shrink-0">Progressive</span>
                        </div>
                      </div>

                      {/* Voting weights */}
                      <div>
                        <label className="text-xs text-gray-400 mb-3 block">Voting Priorities <span className="text-gray-700">(sum = 100%)</span></label>
                        <div className="space-y-3">
                          {(["sec", "eco", "com", "tech"] as const).map((key) => {
                            const labels = { sec: "Security & Risk", eco: "Economic Impact", com: "Community Benefit", tech: "Technical Feasibility" };
                            const colors = { sec: "#3b82f6", eco: "#eab308", com: "#22c55e", tech: "#a855f7" };
                            return (
                              <div key={key}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-gray-400">{labels[key]}</span>
                                  <span className="text-xs font-mono font-bold text-white">{weights[key]}%</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full transition-all"
                                      style={{ width: `${weights[key]}%`, backgroundColor: colors[key] }}
                                    />
                                  </div>
                                  <input
                                    type="range" min={0} max={100} value={weights[key]}
                                    onChange={e => setWeight(key, Number(e.target.value))}
                                    className="w-20 cursor-pointer"
                                    style={{ accentColor: colors[key] }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Mandate */}
                      <div>
                        <label className="text-xs text-gray-400 mb-1.5 block">Mandate <span className="text-gray-700">(optional — "My agent votes to...")</span></label>
                        <input
                          type="text"
                          value={mandate}
                          onChange={e => setMandate(e.target.value)}
                          placeholder={FOCUS_PRESETS[focusArea]?.mandatePlaceholder ?? "protect small holders above all else"}
                          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="h-px bg-gray-800" />

                {/* Step 3: Preview */}
                <div className="space-y-4">
                  <div className="text-xs text-gray-600 uppercase tracking-widest">Step 3 — Preview</div>

                  {/* Mock vote preview — only in builder mode */}
                  {!customMode && (
                    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
                      <div className="text-[11px] text-gray-600 mb-2 uppercase tracking-wide">How your agent would vote</div>
                      <div className="text-xs text-gray-500 mb-3 italic">
                        Sample: "Increase XSEN Staking Reward Pool by 15%"
                      </div>
                      <div className="flex items-start gap-3">
                        <div className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-bold ${mockVote.vote === "Approve" ? "bg-green-900/40 text-green-300 border border-green-700/40" : "bg-red-900/40 text-red-300 border border-red-700/40"}`}>
                          {mockVote.vote}
                        </div>
                        <div>
                          <div className="text-xs text-gray-400 mb-1">{mockVote.confidence}% confidence</div>
                          <div className="text-xs text-gray-500 italic">"{mockVote.reason}"</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* System prompt preview */}
                  {!customMode && (
                    <div className="border border-gray-800 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setShowPrompt(!showPrompt)}
                        className="w-full flex items-center justify-between px-4 py-3 text-xs text-gray-500 hover:text-gray-400 hover:bg-gray-800/30 transition-colors"
                      >
                        <span>View generated system prompt</span>
                        <span>{showPrompt ? "▲" : "▼"}</span>
                      </button>
                      {showPrompt && (
                        <pre className="px-4 pb-4 text-[11px] text-gray-500 whitespace-pre-wrap leading-relaxed border-t border-gray-800 pt-3 font-mono">
                          {generatedPrompt}
                        </pre>
                      )}
                    </div>
                  )}

                  {customMode && customPrompt && (
                    <div className="bg-blue-950/20 border border-blue-800/30 rounded-xl p-3">
                      <div className="text-[11px] text-blue-400 font-semibold mb-1">Custom prompt ready</div>
                      <div className="text-[11px] text-blue-300/60">{customPrompt.split("\n").length} lines · {customPrompt.length} characters</div>
                    </div>
                  )}
                </div>

                {/* x402 payment status */}
                {registering && payStep !== "idle" && (
                  <div className="rounded-xl border border-yellow-700/30 bg-yellow-950/20 p-3 text-xs space-y-1.5">
                    <div className="flex items-center gap-2 text-yellow-400 font-semibold">
                      <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                      x402 Payment in Progress
                    </div>
                    {payQuote && (
                      <div className="text-yellow-300/70">
                        Fee: <span className="font-bold text-yellow-300">{Math.ceil(payQuote.xsen_amount).toLocaleString()} XSEN</span>
                        {" "}≈ ${payQuote.usd_fee} · XSEN @ ${payQuote.xsen_price_usd.toFixed(4)}
                      </div>
                    )}
                    <div className="flex gap-3 text-[11px]">
                      {["fetching", "paying", "verifying", "done"].map((s, i) => {
                        const steps = ["fetching", "paying", "verifying", "done"];
                        const idx = steps.indexOf(payStep);
                        const done = i < idx;
                        const active = i === idx;
                        return (
                          <span key={s} className={done ? "text-green-400" : active ? "text-yellow-300 font-semibold" : "text-gray-600"}>
                            {done ? "✓" : active ? "→" : "○"} {["Quote", "Paying", "Verifying", "Done"][i]}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Register result */}
                {registerResult && (
                  <div className={`rounded-xl p-3 text-xs border ${registerResult.ok ? "bg-green-900/20 border-green-700/40 text-green-300" : "bg-red-900/20 border-red-700/40 text-red-300"}`}>
                    {registerResult.msg}
                  </div>
                )}

                <button
                  onClick={wallet ? handleRegister : openModal}
                  disabled={registering || (!!wallet && (!agentName.trim() || (customMode && !customPrompt.trim())))}
                  className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all text-sm"
                  style={{ boxShadow: "0 0 20px rgba(139,92,246,0.25)" }}
                >
                  {registering
                    ? payStep === "fetching"   ? "Getting price quote..."
                    : payStep === "paying"     ? "Confirm XSEN payment in wallet..."
                    : payStep === "verifying"  ? "Verifying payment on-chain..."
                    : "Registering agent..."
                    : wallet ? `Deploy ${agentName || "Agent"} to X-Senate — ~$10 in XSEN` : "Connect Wallet to Register"}
                </button>
                <p className="text-[11px] text-gray-700 text-center">
                  One-time ~$10 fee in XSEN · Name must be unique · Earn 3% creator rewards on delegations
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════ MY AGENT TAB ══════ */}
      {tab === "mine" && (
        <div className="py-6">
          {!wallet ? (
            <div className="border border-dashed border-gray-700 rounded-2xl p-16 text-center">
              <div className="text-gray-600 text-sm mb-4">Connect your wallet to view or create your agent</div>
              <button onClick={openModal} className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-6 py-2.5 rounded-full text-sm transition-colors">
                Connect Wallet
              </button>
            </div>
          ) : !myAgent ? (
            <div className="border border-dashed border-gray-700 rounded-2xl p-16 text-center">
              <div className="text-3xl mb-3">🤖</div>
              <div className="text-gray-500 text-sm mb-4">You haven&apos;t created an agent yet.</div>
              <button
                onClick={() => setTab("create")}
                className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-6 py-2.5 rounded-full text-sm transition-colors"
              >
                Create Your Agent →
              </button>
            </div>
          ) : (
            <div className="max-w-lg space-y-5">
              {/* Agent Profile */}
              <div className="border border-purple-500/30 bg-purple-950/10 rounded-2xl p-6">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-16 h-16 rounded-2xl bg-purple-900/30 border border-purple-600/40 overflow-hidden flex items-center justify-center text-2xl font-black text-purple-300">
                    {(myAgent as any).avatar_base64
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={(myAgent as any).avatar_base64} alt={myAgent.agent_name} className="w-full h-full object-cover" />
                      : myAgent.agent_name[0].toUpperCase()
                    }
                  </div>
                  <div>
                    <div className="text-xl font-black text-white">{myAgent.agent_name}</div>
                    <div className="text-sm text-gray-500">{myAgent.focus_area ?? "General"}</div>
                    <span className={`mt-1 inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${RANK_STYLE[myAgent.rank]?.badge ?? RANK_STYLE.Bronze.badge}`}>
                      {RANK_STYLE[myAgent.rank]?.icon} {myAgent.rank}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Delegated VP",    value: fmt(myAgent.delegated_vp),          color: "text-purple-300" },
                    { label: "Participation",   value: pct(myAgent.participation_rate),     color: "text-blue-300" },
                    { label: "Success Rate",    value: pct(myAgent.proposal_success_rate),  color: "text-green-300" },
                  ].map(s => (
                    <div key={s.label} className="text-center bg-gray-800/40 rounded-xl py-3">
                      <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
                      <div className="text-[10px] text-gray-600 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rank info */}
              <div className="border border-gray-800/60 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Rank Tiers</h3>
                <div className="space-y-2 text-xs">
                  {[
                    { rank: "Gold",   desc: "Top 10% by delegated VP",  bonus: "+2% creator reward APY",   icon: "🥇" },
                    { rank: "Silver", desc: "Top 30% by delegated VP",  bonus: "+1.5% creator reward APY", icon: "🥈" },
                    { rank: "Bronze", desc: "All other community agents", bonus: "+1% creator reward APY", icon: "🥉" },
                  ].map(r => (
                    <div key={r.rank} className={`flex items-center justify-between p-2.5 rounded-lg border ${myAgent.rank === r.rank ? "border-purple-500/30 bg-purple-950/10" : "border-gray-800"}`}>
                      <div className="flex items-center gap-2">
                        <span>{r.icon}</span>
                        <div>
                          <div className="font-semibold text-gray-300">{r.rank}</div>
                          <div className="text-[10px] text-gray-600">{r.desc}</div>
                        </div>
                      </div>
                      <span className="text-green-400 font-semibold text-[11px]">{r.bonus}</span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-gray-700 text-center">
                Grow your VP by attracting delegators. Higher rank = higher creator rewards from staking.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
