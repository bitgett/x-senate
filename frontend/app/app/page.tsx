"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ethers } from "ethers";
import { fetchProposals, fetchPlatformStats } from "@/lib/api";
import { Proposal, STATUS_LABELS } from "@/types";
import { useWallet } from "@/contexts/WalletContext";

const STAKING_ADDRESS = process.env.NEXT_PUBLIC_XSEN_STAKING_ADDRESS ?? "0xc8FD7B12De6bFb10dF3eaCb38AAc09CBbeb25bFD";
const STAKING_ABI = [
  "function getEffectiveVP(address user) view returns (uint256)",
  "function getUserPositions(address user) view returns (tuple(uint256 id, address owner, uint256 amount, uint8 tier, uint256 lockEnd, uint256 stakedAt, uint256 lastRewardAt, uint256 accReward, string delegatedAgent, bool active)[])",
  "function delegatePosition(uint256 positionId, string agentName) external",
];

const GENESIS_AGENTS = [
  { name: "Guardian",  role: "Strict Guardian",       accent: "#3b82f6", statement: "Votes only when proposals maintain network security and protect against systemic risks. Safety first, always." },
  { name: "Merchant",  role: "Economic Analyst",      accent: "#eab308", statement: "Prioritizes sustainable tokenomics and economic efficiency. Every proposal must pass a rigorous ROI analysis." },
  { name: "Architect", role: "Technical Lead",        accent: "#22c55e", statement: "Evaluates technical feasibility, code quality, and implementation risks before approving any changes." },
  { name: "Diplomat",  role: "Consensus Builder",     accent: "#a855f7", statement: "Seeks broad community consensus and fair representation. No proposal passes without stakeholder alignment." },
  { name: "Populist",  role: "Community Voice",       accent: "#ef4444", statement: "Champions everyday users over institutional interests. Governance power should be distributed, not concentrated." },
];

const EMPTY_FORM = { title: "", summary: "", motivation: "", proposed_action: "", potential_risks: "" };

function fmt(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000)     return `${(val / 1_000).toFixed(2)}K`;
  return val.toFixed(0);
}

function VoteBar({ approve, reject }: { approve: number; reject: number }) {
  const total = approve + reject;
  if (total === 0) return (
    <div className="mt-2">
      <div className="flex h-1 rounded-full overflow-hidden bg-gray-800/60 w-full" />
      <div className="text-[11px] text-gray-700 mt-1">No votes yet</div>
    </div>
  );
  const forPct = Math.round((approve / total) * 100);
  return (
    <div className="mt-2 space-y-1">
      <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-800">
        <div className="bg-green-500 transition-all" style={{ width: `${forPct}%` }} />
        <div className="bg-red-500/60 transition-all" style={{ width: `${100 - forPct}%` }} />
      </div>
      <div className="flex items-center gap-3 text-[11px] text-gray-500">
        <span className="text-green-400">{approve} For · {forPct}%</span>
        <span className="text-gray-700">·</span>
        <span className="text-red-400">{reject} Against</span>
        <span className="ml-auto text-gray-600">{total} votes · {Math.min(forPct, 100)}% Quorum</span>
      </div>
    </div>
  );
}

export default function GovernancePage() {
  const { wallet, walletType, effectiveVP, openModal, rawProvider } = useWallet();

  const [proposals, setProposals]     = useState<Proposal[]>([]);
  const [platformStats, setPlatform]  = useState<any>(null);
  const [loading, setLoading]         = useState(true);
  const [leaderboard, setLb]          = useState<any[]>([]);
  const [positions, setPositions]     = useState<any[]>([]);
  const [currentDelegate, setDelegate] = useState<string | null>(null);
  const [delegating, setDelegating]   = useState<string | null>(null);
  const [txStatus, setTxStatus]       = useState<string | null>(null);
  const [delegateSearch, setDelegateSearch] = useState("");

  // Submit modal
  const [showSubmit, setShowSubmit]     = useState(false);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [submitting, setSubmitting]     = useState(false);
  const [submitResult, setSubmitResult] = useState<any>(null);
  const [submitPayStep, setSubmitPayStep] = useState<"idle" | "fetching" | "paying" | "verifying" | "done">("idle");
  const [submitQuote, setSubmitQuote]   = useState<{ xsen_amount: number; usd_fee: number; xsen_price_usd: number; xsen_amount_wei: string; treasury: string; xsen_token: string } | null>(null);

  useEffect(() => {
    Promise.all([
      fetchProposals(),
      fetchPlatformStats().catch(() => null),
      fetch("/api/staking/leaderboard?limit=10").then(r => r.ok ? r.json() : null),
    ]).then(([props, stats, lb]) => {
      setProposals(props);
      setPlatform(stats);
      setLb(lb?.leaderboard ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const loadPositions = useCallback(async () => {
    if (!wallet || !walletType) return;
    try {
      const raw = rawProvider();
      const provider = new ethers.BrowserProvider(raw, { chainId: 196, name: "xlayer" });
      const staking = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI, provider);
      const pos = await staking.getUserPositions(wallet).catch(() => []);
      const parsed = pos.map((p: any) => ({
        id: Number(p.id), amount: Number(ethers.formatEther(p.amount)),
        active: p.active, delegatedAgent: p.delegatedAgent,
      }));
      setPositions(parsed);
      setDelegate(parsed.find((p: any) => p.active && p.delegatedAgent)?.delegatedAgent ?? null);
    } catch (e) { console.error(e); }
  }, [wallet, walletType, rawProvider]);

  useEffect(() => {
    loadPositions();
  }, [loadPositions]);

  async function delegateTo(agentName: string) {
    if (!wallet) { openModal(); return; }
    const activePos = positions.find(p => p.active);
    if (!activePos) { setTxStatus("No active staking positions. Stake XSEN first."); return; }
    setDelegating(agentName);
    setTxStatus(null);
    try {
      const provider = new ethers.BrowserProvider(rawProvider(), { chainId: 196, name: "xlayer" });
      const signer = await provider.getSigner();
      const staking = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI, signer);
      const tx = await staking.delegatePosition(activePos.id, agentName);
      setTxStatus(`Delegating to ${agentName}...`);
      await tx.wait();
      setDelegate(agentName);
      setTxStatus(`✓ Delegated to ${agentName}`);
      await loadPositions();
    } catch (e: any) { setTxStatus(`Error: ${e.message?.slice(0, 80)}`); }
    setDelegating(null);
  }

  const totalVotes = proposals.reduce((s, p) => s + (p.approve_count ?? 0) + (p.reject_count ?? 0), 0);
  const filteredAgents = GENESIS_AGENTS.filter(a => a.name.toLowerCase().includes(delegateSearch.toLowerCase()) || a.role.toLowerCase().includes(delegateSearch.toLowerCase()));

  return (
    <div className="w-full space-y-0">

      {/* ── Space Header ── */}
      <div className="pb-6 border-b border-gray-800/60">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/xsen-logo.svg" alt="XSEN" className="w-full h-full" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-white">X-Senate</h1>
                <span className="text-[10px] bg-purple-600/20 text-purple-400 border border-purple-500/30 rounded-full px-2 py-0.5 font-mono">X Layer</span>
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                <span><span className="text-white font-semibold">{proposals.length}</span> proposals</span>
                <span>·</span>
                <span><span className="text-white font-semibold">{fmt(totalVotes)}</span> votes</span>
                <span>·</span>
                <span><span className="text-white font-semibold">{GENESIS_AGENTS.length}</span> AI agents</span>
              </div>
              <p className="text-xs text-gray-600 mt-1 max-w-md">X-Senate is the first AI-powered governance senate for X Layer. Genesis 5 agents autonomously debate, vote, and execute DAO decisions.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {wallet ? (
              <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-full px-4 py-2 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="font-mono text-gray-300">{wallet.slice(0,6)}...{wallet.slice(-4)}</span>
                {effectiveVP > 0 && <><span className="text-gray-600">·</span><span className="text-purple-300 font-semibold">{fmt(effectiveVP)} VP</span></>}
              </div>
            ) : (
              <button onClick={openModal} className="text-sm font-semibold bg-gray-900 hover:bg-gray-800 border border-gray-700 text-white px-4 py-2 rounded-full transition-colors">
                Connect Wallet
              </button>
            )}
            <button
              onClick={() => { setShowSubmit(true); setSubmitResult(null); setForm(EMPTY_FORM); }}
              className="text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-full transition-colors"
              style={{ boxShadow: "0 0 16px rgba(139,92,246,0.3)" }}
            >
              + New Proposal
            </button>
          </div>
        </div>
      </div>

      {/* ── Recent Proposals ── */}
      <div className="py-6 border-b border-gray-800/60">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Recent Proposals</h2>
          <span className="text-xs text-gray-600">{proposals.length} total</span>
        </div>

        {loading && <div className="text-center py-10 text-gray-600 text-sm">Loading proposals...</div>}

        {!loading && proposals.length === 0 && (
          <div className="border border-dashed border-gray-800 rounded-xl p-10 text-center">
            <p className="text-gray-600 text-sm mb-3">No proposals yet. Create the first one.</p>
            <button onClick={() => { setShowSubmit(true); setSubmitResult(null); setForm(EMPTY_FORM); }} className="text-sm text-purple-400 hover:text-purple-300">
              + Create Proposal →
            </button>
          </div>
        )}

        <div className="space-y-3">
          {proposals.slice(0, 10).map((p) => {
            const status = STATUS_LABELS[p.status];
            const total  = (p.approve_count ?? 0) + (p.reject_count ?? 0);
            return (
              <div key={p.id} className="border border-gray-800/60 hover:border-gray-700 rounded-xl p-5 transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full text-white ${status?.color ?? "bg-gray-600"}`}>
                        {status?.label ?? p.status}
                      </span>
                      {p.project_id && p.project_id !== "XSEN" && (
                        <span className="text-[11px] bg-blue-900/40 text-blue-300 border border-blue-800/40 rounded-full px-2.5 py-0.5 font-mono">{p.project_id}</span>
                      )}
                      <span className="text-[11px] text-gray-700 font-mono">{p.id?.slice(0, 12)}</span>
                      <span className="text-[11px] text-gray-700 ml-auto">{new Date(p.created_at).toLocaleDateString()}</span>
                    </div>
                    <h3 className="font-semibold text-white text-base leading-snug">{p.title}</h3>
                    <p className="text-gray-500 text-sm mt-1 line-clamp-1">{p.summary}</p>
                    <VoteBar approve={p.approve_count ?? 0} reject={p.reject_count ?? 0} />
                  </div>
                  <Link href={`/proposals/${p.id}`} className="shrink-0 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white px-4 py-2 rounded-lg transition-colors whitespace-nowrap">
                    View →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Delegates ── */}
      <div className="py-6">
        <h2 className="text-sm font-semibold text-white mb-4">Delegates</h2>

        {/* Delegation status bar */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <input
            type="text"
            value={delegateSearch}
            onChange={e => setDelegateSearch(e.target.value)}
            placeholder="Search delegates..."
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 w-52"
          />
          <div className="flex items-center gap-2 border border-gray-700/60 rounded-full px-4 py-2 text-xs">
            <span className="text-gray-500">Voting Power</span>
            <span className="font-bold text-white">{wallet ? fmt(effectiveVP) : "0"}</span>
          </div>
          {wallet && currentDelegate && (
            <div className="flex items-center gap-2 border border-purple-500/30 bg-purple-900/10 rounded-full px-4 py-2 text-xs">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              <span className="text-gray-400">Delegated to</span>
              <span className="font-semibold text-purple-300">{currentDelegate}</span>
            </div>
          )}
          {txStatus && (
            <span className={`text-xs px-3 py-1.5 rounded-full border ${txStatus.startsWith("Error") ? "bg-red-900/20 border-red-700/40 text-red-300" : "bg-green-900/20 border-green-700/40 text-green-300"}`}>
              {txStatus}
            </span>
          )}
        </div>

        {/* Delegates table */}
        <div className="border border-gray-800/60 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800/60 bg-gray-900/40 text-xs text-gray-600 text-left">
                <th className="px-5 py-3">Delegatee</th>
                <th className="px-5 py-3 hidden md:table-cell">Statement</th>
                <th className="px-5 py-3 text-right">Delegators</th>
                <th className="px-5 py-3 text-right">Voting Power</th>
                <th className="px-5 py-3 w-28" />
              </tr>
            </thead>
            <tbody>
              {filteredAgents.map((agent) => {
                const lb = leaderboard.find(l => l.agent_name === agent.name);
                const isMyDelegate = currentDelegate === agent.name;
                return (
                  <tr key={agent.name} className={`border-b border-gray-800/30 transition-colors ${isMyDelegate ? "bg-purple-950/20" : "hover:bg-gray-900/30"}`}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                          style={{ background: `${agent.accent}22`, border: `1.5px solid ${agent.accent}44` }}>
                          {agent.name[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-white text-sm">{agent.name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] bg-orange-500/15 text-orange-400 border border-orange-500/20 rounded-full px-1.5 py-0.5">AI Agent</span>
                            <span className="text-[10px] rounded-full px-1.5 py-0.5 border" style={{ color: agent.accent, borderColor: `${agent.accent}33`, background: `${agent.accent}11` }}>
                              {agent.role}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <p className="text-xs text-gray-500 line-clamp-2 max-w-xs">{agent.statement}</p>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="text-sm font-semibold text-white">{lb?.delegator_count ?? 0}</div>
                      <div className="text-[11px] text-gray-600">{lb ? `${((lb.total_delegated_vp_xsen / Math.max(1, leaderboard.reduce((s: number, l: any) => s + l.total_delegated_vp_xsen, 0))) * 100).toFixed(4)}%` : "0%"}</div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="text-sm font-semibold text-purple-300">{lb ? fmt(lb.total_delegated_vp_xsen) : "0"} VP</div>
                      {lb?.voted_this_epoch && <div className="text-[11px] text-green-400 mt-0.5">Active</div>}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {isMyDelegate ? (
                        <span className="text-xs bg-purple-600/20 border border-purple-500/30 text-purple-300 px-3 py-1.5 rounded-lg">Delegated</span>
                      ) : (
                        <button
                          onClick={() => delegateTo(agent.name)}
                          disabled={!!delegating}
                          className="text-xs font-semibold bg-gray-800 hover:bg-gray-700 disabled:opacity-40 border border-gray-600 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ml-auto"
                        >
                          {delegating === agent.name ? "..." : currentDelegate ? "+ Change" : "+ Delegate"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!wallet && (
          <p className="text-xs text-gray-700 mt-3 text-center">
            <button onClick={openModal} className="text-purple-500 hover:text-purple-400 underline">Connect wallet</button>
            {" "}to delegate your voting power
          </p>
        )}
      </div>

      {/* ── Submit Proposal Modal ── */}
      {showSubmit && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">New Proposal</h2>
                <p className="text-sm text-gray-400 mt-0.5">Sentinel AI reviews before Senate. Requires 1,000+ XSEN staked.</p>
              </div>
              <button onClick={() => setShowSubmit(false)} className="text-gray-500 hover:text-white text-2xl leading-none">×</button>
            </div>
            {!submitResult ? (
              <div className="p-6 space-y-4">
                {[
                  { key: "title",           label: "Title",                  placeholder: "e.g. Increase staking reward pool by 10%", rows: 1 },
                  { key: "summary",         label: "Summary",                placeholder: "Brief overview",                           rows: 2 },
                  { key: "motivation",      label: "Motivation",             placeholder: "Why is this change needed?",               rows: 3 },
                  { key: "proposed_action", label: "Proposed Action",        placeholder: "Exactly what should be done?",             rows: 3 },
                  { key: "potential_risks", label: "Potential Risks (opt.)", placeholder: "What could go wrong?",                     rows: 2 },
                ].map(({ key, label, placeholder, rows }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
                    {rows === 1 ? (
                      <input type="text" value={form[key as keyof typeof form]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
                    ) : (
                      <textarea rows={rows} value={form[key as keyof typeof form]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none" />
                    )}
                  </div>
                ))}
                {/* x402 payment status */}
                {submitting && submitPayStep !== "idle" && (
                  <div className="rounded-xl border border-yellow-700/30 bg-yellow-950/20 p-3 text-xs space-y-1.5">
                    <div className="flex items-center gap-2 text-yellow-400 font-semibold">
                      <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                      x402 Payment in Progress
                    </div>
                    {submitQuote && (
                      <div className="text-yellow-300/70">
                        Fee: <span className="font-bold text-yellow-300">{Math.ceil(submitQuote.xsen_amount).toLocaleString()} XSEN</span>
                        {" "}≈ ${submitQuote.usd_fee} · XSEN @ ${submitQuote.xsen_price_usd.toFixed(4)}
                      </div>
                    )}
                    <div className="flex gap-3 text-[11px]">
                      {["fetching", "paying", "verifying", "done"].map((s, i) => {
                        const steps = ["fetching", "paying", "verifying", "done"];
                        const idx = steps.indexOf(submitPayStep);
                        const done = i < idx;
                        const active = i === idx;
                        return (
                          <span key={s} className={done ? "text-green-400" : active ? "text-yellow-300 font-semibold" : "text-gray-600"}>
                            {done ? "✓" : active ? "→" : "○"} {["Quote", "Paying", "Verifying", "AI Review"][i]}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
                <button
                  onClick={async () => {
                    if (!form.title || !form.summary || !form.motivation || !form.proposed_action) return;
                    setSubmitting(true);
                    setSubmitPayStep("fetching");
                    setSubmitResult(null);
                    try {
                      // Step 1: Get x402 quote
                      const quoteRes = await fetch("/api/x402/quote");
                      const quote = await quoteRes.json();
                      setSubmitQuote(quote);
                      setSubmitPayStep("paying");

                      // Step 2: Pay XSEN to treasury
                      const TOKEN_ABI = ["function transfer(address to, uint256 amount) returns (bool)"];
                      const provider = new ethers.BrowserProvider(rawProvider(), { chainId: 196, name: "xlayer" });
                      const signer = await provider.getSigner();
                      const token = new ethers.Contract(quote.xsen_token, TOKEN_ABI, signer);
                      const payTx = await token.transfer(quote.treasury, BigInt(quote.xsen_amount_wei));
                      setSubmitPayStep("verifying");
                      await payTx.wait();

                      // Step 3: Submit proposal with payment proof
                      setSubmitPayStep("done");
                      const res = await fetch("/api/proposals/submit", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ...form, submitter_address: wallet ?? undefined, payment_tx_hash: payTx.hash }),
                      });
                      const data = await res.json();
                      setSubmitResult({ ...data, status: res.status, payment_tx: payTx.hash });
                      if (res.status === 201) { const updated = await fetchProposals(); setProposals(updated); }
                    } catch (e: any) {
                      setSubmitResult({ approved: false, feedback: e.message?.slice(0, 120) ?? "Error" });
                    }
                    setSubmitting(false);
                    setSubmitPayStep("idle");
                  }}
                  disabled={submitting || !form.title || !form.summary || !form.motivation || !form.proposed_action || !wallet}
                  className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  {submitting
                    ? submitPayStep === "fetching"  ? "Getting price quote..."
                    : submitPayStep === "paying"    ? "Confirm XSEN payment in wallet..."
                    : submitPayStep === "verifying" ? "Verifying payment on-chain..."
                    : "Sentinel is reviewing..."
                    : wallet ? "Pay & Submit (~$10 in XSEN)" : "Connect Wallet to Submit"}
                </button>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                {submitResult.approved ? (
                  <div className="bg-green-900/30 border border-green-700 rounded-xl p-5">
                    <div className="text-green-400 font-bold mb-1">Sentinel Approved</div>
                    <div className="text-sm text-gray-300">{submitResult.feedback}</div>
                  </div>
                ) : (
                  <div className="bg-red-900/30 border border-red-700 rounded-xl p-5">
                    <div className="text-red-400 font-bold mb-1">Sentinel Rejected</div>
                    <div className="text-sm text-gray-300">{submitResult.feedback}</div>
                    {submitResult.suggested_improvements && <div className="mt-2 text-xs text-yellow-400">{submitResult.suggested_improvements}</div>}
                  </div>
                )}
                <div className="flex gap-3">
                  {!submitResult.approved && <button onClick={() => setSubmitResult(null)} className="flex-1 border border-gray-700 hover:border-gray-500 text-gray-300 py-2 rounded-xl text-sm transition-colors">Revise</button>}
                  <button onClick={() => setShowSubmit(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-xl text-sm transition-colors">{submitResult.approved ? "Close" : "Cancel"}</button>
                  {submitResult.approved && submitResult.proposal && (
                    <Link href={`/proposals/${submitResult.proposal.id}`} className="flex-1 text-center bg-purple-600 hover:bg-purple-500 text-white py-2 rounded-xl text-sm font-semibold transition-colors">View →</Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
