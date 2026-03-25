"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ethers } from "ethers";
import { fetchProposals, fetchPlatformStats } from "@/lib/api";
import { Proposal, STATUS_LABELS } from "@/types";

const STAKING_ADDRESS = process.env.NEXT_PUBLIC_XSEN_STAKING_ADDRESS ?? "0x9CD9eF69c4EE176c8115E4BCf6c604Eb46599502";
const STAKING_ABI = [
  "function getEffectiveVP(address user) view returns (uint256)",
  "function getPositions(address user) view returns (tuple(uint256 id, uint256 amount, uint8 tier, uint256 lockEnd, string delegatedAgent, bool active, uint256 accReward)[])",
];

const EMPTY_FORM = { title: "", summary: "", motivation: "", proposed_action: "", potential_risks: "" };

function fmt(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000)     return `${(val / 1_000).toFixed(1)}K`;
  return val.toFixed(0);
}

function VoteBar({ approve, reject }: { approve: number; reject: number }) {
  const total = approve + reject;
  if (total === 0) return null;
  const forPct = Math.round((approve / total) * 100);
  const agPct  = 100 - forPct;
  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-800">
        <div className="bg-green-500 transition-all" style={{ width: `${forPct}%` }} />
        <div className="bg-red-500/70 transition-all" style={{ width: `${agPct}%` }} />
      </div>
      <div className="flex items-center gap-3 text-[11px] text-gray-500">
        <span className="text-green-400">{approve} For ({forPct}%)</span>
        <span className="text-gray-700">·</span>
        <span className="text-red-400">{reject} Against ({agPct}%)</span>
      </div>
    </div>
  );
}

export default function GovernancePage() {
  const [proposals, setProposals]     = useState<Proposal[]>([]);
  const [platformStats, setPlatform]  = useState<any>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [activeProject, setActiveProject] = useState<string>("all");
  const [projects, setProjects]       = useState<string[]>([]);

  // Wallet / VP
  const [wallet, setWallet]           = useState<string | null>(null);
  const [walletType, setWalletType]   = useState<"metamask" | "okx" | null>(null);
  const [effectiveVP, setVP]          = useState<number>(0);
  const [currentDelegate, setDelegate] = useState<string | null>(null);
  const [connecting, setConnecting]   = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);

  // Submit modal
  const [showSubmit, setShowSubmit]     = useState(false);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [submitting, setSubmitting]     = useState(false);
  const [submitResult, setSubmitResult] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      fetchProposals(),
      fetchPlatformStats().catch(() => null),
    ])
      .then(([props, stats]) => {
        setProposals(props);
        setPlatform(stats);
        // Extract unique project IDs
        const ids = Array.from(new Set(props.map((p: Proposal) => p.project_id).filter(Boolean))) as string[];
        setProjects(ids);
      })
      .catch(() => setError("Backend offline"))
      .finally(() => setLoading(false));
  }, []);

  const loadWalletData = useCallback(async (address: string, type?: "metamask" | "okx") => {
    try {
      const raw = type === "okx" ? (window as any).okxwallet : (window as any).ethereum;
      const provider = new ethers.BrowserProvider(raw);
      const staking = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI, provider);
      const vp = await staking.getEffectiveVP(address).catch(() => 0n);
      setVP(Number(ethers.formatEther(vp)));

      try {
        const pos = await staking.getPositions(address);
        const delegate = pos.find((p: any) => p.active && p.delegatedAgent)?.delegatedAgent ?? null;
        setDelegate(delegate);
      } catch { setDelegate(null); }
    } catch (e) { console.error(e); }
  }, []);

  async function connectWallet(type: "metamask" | "okx") {
    setShowWalletModal(false);
    const raw = type === "okx" ? (window as any).okxwallet : (window as any).ethereum;
    if (!raw) { alert(type === "okx" ? "OKX Wallet not detected." : "MetaMask not detected."); return; }
    setConnecting(true);
    const XLAYER = {
      chainId: "0xc4",
      chainName: "X Layer Mainnet",
      nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
      rpcUrls: ["https://rpc.xlayer.tech"],
      blockExplorerUrls: ["https://www.okx.com/web3/explorer/xlayer"],
    };
    try {
      try { await raw.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xc4" }] }); }
      catch { await raw.request({ method: "wallet_addEthereumChain", params: [XLAYER] }); }
      const accounts = await raw.request({ method: "eth_requestAccounts" });
      setWallet(accounts[0]);
      setWalletType(type);
      await loadWalletData(accounts[0], type);
    } catch (e: any) { console.error(e); }
    setConnecting(false);
  }

  const filtered = proposals.filter(p =>
    activeProject === "all" ? true : p.project_id === activeProject
  );

  const statusCounts = proposals.reduce(
    (acc, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc; },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-0">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="pb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Governance</h1>
          <p className="text-gray-500 text-sm mt-0.5">Review, vote, and delegate on X-Senate proposals</p>
        </div>
        <div className="flex items-center gap-3">
          {wallet ? (
            <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-full px-4 py-2 text-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="font-mono text-gray-300 text-xs">{wallet.slice(0,6)}...{wallet.slice(-4)}</span>
              {effectiveVP > 0 && <>
                <span className="text-gray-600">·</span>
                <span className="text-purple-300 font-semibold text-xs">{fmt(effectiveVP)} VP</span>
              </>}
            </div>
          ) : (
            <button
              onClick={() => setShowWalletModal(true)}
              disabled={connecting}
              className="text-sm font-semibold bg-gray-900 hover:bg-gray-800 border border-gray-700 text-white px-4 py-2 rounded-full transition-colors disabled:opacity-50"
            >
              {connecting ? "Connecting..." : "Connect Wallet"}
            </button>
          )}
          <button
            onClick={() => { setShowSubmit(true); setSubmitResult(null); setForm(EMPTY_FORM); }}
            className="text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-full transition-colors"
            style={{ boxShadow: "0 0 16px rgba(139,92,246,0.3)" }}
          >
            + Submit Proposal
          </button>
        </div>
      </div>

      {/* ── Project Filter Tabs ─────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-gray-800/60 pb-0 mb-6 overflow-x-auto">
        {["all", ...projects].map(p => (
          <button
            key={p}
            onClick={() => setActiveProject(p)}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-all ${
              activeProject === p
                ? "border-purple-500 text-white"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {p === "all" ? "All Projects" : p}
            {p === "all" && <span className="ml-1.5 text-[11px] text-gray-600">{proposals.length}</span>}
          </button>
        ))}
      </div>

      {/* ── Main Grid ──────────────────────────────────────────────── */}
      <div className="flex gap-6 items-start">

        {/* ── Proposals Feed ── */}
        <div className="flex-1 min-w-0 space-y-3">
          {loading && <div className="text-center py-16 text-gray-500 text-sm">Loading proposals...</div>}
          {error && (
            <div className="bg-red-900/20 border border-red-800/40 rounded-xl p-5 text-red-400 text-sm text-center">{error}</div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div className="border border-dashed border-gray-800 rounded-xl p-16 text-center">
              <div className="text-gray-600 text-sm mb-3">No proposals found</div>
              <Link href="/sentinel" className="text-purple-400 text-sm hover:text-purple-300">
                Run Sentinel to generate proposals
              </Link>
            </div>
          )}
          {filtered.map((p) => {
            const status = STATUS_LABELS[p.status];
            const total = (p.approve_count ?? 0) + (p.reject_count ?? 0);
            return (
              <Link key={p.id} href={`/proposals/${p.id}`} className="block group">
                <div className="border border-gray-800/60 hover:border-gray-700 bg-gray-900/20 hover:bg-gray-900/40 rounded-xl p-5 transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Badges row */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full text-white ${status?.color ?? "bg-gray-600"}`}>
                          {status?.label ?? p.status}
                        </span>
                        {p.project_id && p.project_id !== "XSEN" && (
                          <span className="text-[11px] bg-blue-900/40 text-blue-300 border border-blue-800/40 rounded-full px-2.5 py-0.5 font-mono">
                            {p.project_id}
                          </span>
                        )}
                        <span className="text-[11px] text-gray-700 font-mono">{p.id?.slice(0, 12)}</span>
                      </div>
                      {/* Title */}
                      <h3 className="font-semibold text-white text-base leading-snug group-hover:text-purple-100 transition-colors">
                        {p.title}
                      </h3>
                      {/* Summary */}
                      <p className="text-gray-500 text-sm mt-1 line-clamp-2">{p.summary}</p>
                      {/* Vote bar */}
                      {total > 0 && <VoteBar approve={p.approve_count ?? 0} reject={p.reject_count ?? 0} />}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-xs text-gray-600">{new Date(p.created_at).toLocaleDateString()}</div>
                      <div className="mt-2 text-xs text-gray-600 group-hover:text-gray-400 transition-colors">View →</div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* ── Side Panel ── */}
        <div className="w-64 shrink-0 space-y-4 hidden lg:block">

          {/* Stats */}
          <div className="border border-gray-800/60 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800/40 text-xs font-mono text-gray-600 tracking-widest uppercase">Overview</div>
            <div className="divide-y divide-gray-800/40">
              {[
                { label: "Total",    value: proposals.length,               color: "text-white" },
                { label: "In Debate", value: statusCounts["In_Debate"] ?? 0, color: "text-yellow-400" },
                { label: "In Senate", value: statusCounts["In_Senate"] ?? 0, color: "text-blue-400" },
                { label: "Executed",  value: statusCounts["Executed"]  ?? 0, color: "text-green-400" },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-gray-500">{s.label}</span>
                  <span className={`text-sm font-bold ${s.color}`}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div className="space-y-2">
            <Link href="/sentinel" className="flex items-center justify-between border border-gray-800/60 rounded-xl px-4 py-3 hover:border-gray-700 hover:bg-gray-900/30 transition-all group">
              <div>
                <div className="text-sm font-semibold text-white">Sentinel Scan</div>
                <div className="text-xs text-gray-600">AI proposal review</div>
              </div>
              <span className="text-gray-600 group-hover:text-gray-400">→</span>
            </Link>
            <Link href="/agents" className="flex items-center justify-between border border-gray-800/60 rounded-xl px-4 py-3 hover:border-gray-700 hover:bg-gray-900/30 transition-all group">
              <div>
                <div className="text-sm font-semibold text-white">Genesis 5</div>
                <div className="text-xs text-gray-600">AI debate agents</div>
              </div>
              <span className="text-gray-600 group-hover:text-gray-400">→</span>
            </Link>
          </div>

          {/* My VP card */}
          <div className="border border-gray-800/60 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800/40 text-xs font-mono text-gray-600 tracking-widest uppercase">My Voting Power</div>
            {wallet ? (
              <div className="p-4 space-y-3">
                <div>
                  <div className="text-2xl font-black text-purple-300">{fmt(effectiveVP)}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Effective VP</div>
                </div>
                {currentDelegate && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Delegated to</span>
                    <span className="text-white font-semibold">{currentDelegate}</span>
                  </div>
                )}
                <Link
                  href="/stake"
                  className="block w-full text-center text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 py-2 rounded-lg transition-colors"
                >
                  {currentDelegate ? "Change Delegate" : "Delegate VP"} →
                </Link>
              </div>
            ) : (
              <div className="p-4 text-center">
                <div className="text-xs text-gray-600 mb-3">Connect wallet to view your VP</div>
                <button
                  onClick={() => setShowWalletModal(true)}
                  disabled={connecting}
                  className="w-full text-xs bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {connecting ? "Connecting..." : "Connect Wallet"}
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Submit Proposal Modal ─────────────────────────────────── */}
      {showSubmit && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Submit a Proposal</h2>
                <p className="text-sm text-gray-400 mt-0.5">Sentinel AI reviews before Senate. Requires 1,000+ XSEN staked.</p>
              </div>
              <button onClick={() => setShowSubmit(false)} className="text-gray-500 hover:text-white text-2xl leading-none">×</button>
            </div>

            {!submitResult ? (
              <div className="p-6 space-y-4">
                {[
                  { key: "title",           label: "Title",                    placeholder: "e.g. Increase staking reward pool by 10%", rows: 1 },
                  { key: "summary",         label: "Summary",                  placeholder: "Brief overview",                           rows: 2 },
                  { key: "motivation",      label: "Motivation",               placeholder: "Why is this change needed?",               rows: 3 },
                  { key: "proposed_action", label: "Proposed Action",          placeholder: "Exactly what should be done?",             rows: 3 },
                  { key: "potential_risks", label: "Potential Risks (opt.)",   placeholder: "What could go wrong?",                     rows: 2 },
                ].map(({ key, label, placeholder, rows }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
                    {rows === 1 ? (
                      <input
                        type="text"
                        value={form[key as keyof typeof form]}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                      />
                    ) : (
                      <textarea
                        rows={rows}
                        value={form[key as keyof typeof form]}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
                      />
                    )}
                  </div>
                ))}
                <button
                  onClick={async () => {
                    if (!form.title || !form.summary || !form.motivation || !form.proposed_action) return;
                    setSubmitting(true);
                    try {
                      const res = await fetch("/api/proposals/submit", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(form),
                      });
                      const data = await res.json();
                      setSubmitResult({ ...data, status: res.status });
                      if (res.status === 201) {
                        const updated = await fetchProposals();
                        setProposals(updated);
                      }
                    } catch { setSubmitResult({ approved: false, feedback: "Network error" }); }
                    setSubmitting(false);
                  }}
                  disabled={submitting || !form.title || !form.summary || !form.motivation || !form.proposed_action}
                  className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  {submitting ? "Sentinel is reviewing..." : "Submit for Sentinel Review"}
                </button>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                {submitResult.approved ? (
                  <div className="bg-green-900/30 border border-green-700 rounded-xl p-5">
                    <div className="text-green-400 font-bold text-lg mb-1">Sentinel Approved</div>
                    <div className="text-sm text-gray-300">{submitResult.feedback}</div>
                    <div className="text-xs text-gray-500 mt-2">Score: {submitResult.score}/100</div>
                    <div className="text-xs text-green-400 mt-3">{submitResult.message}</div>
                  </div>
                ) : (
                  <div className="bg-red-900/30 border border-red-700 rounded-xl p-5">
                    <div className="text-red-400 font-bold text-lg mb-1">Sentinel Rejected</div>
                    <div className="text-sm text-gray-300">{submitResult.feedback}</div>
                    {submitResult.concerns?.length > 0 && (
                      <ul className="mt-2 text-xs text-gray-400 list-disc list-inside space-y-0.5">
                        {submitResult.concerns.map((c: string, i: number) => <li key={i}>{c}</li>)}
                      </ul>
                    )}
                    {submitResult.suggested_improvements && (
                      <div className="mt-3 text-xs text-yellow-400">{submitResult.suggested_improvements}</div>
                    )}
                  </div>
                )}
                <div className="flex gap-3">
                  {!submitResult.approved && (
                    <button onClick={() => setSubmitResult(null)} className="flex-1 border border-gray-700 hover:border-gray-500 text-gray-300 py-2 rounded-xl text-sm transition-colors">
                      Revise
                    </button>
                  )}
                  <button onClick={() => setShowSubmit(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-xl text-sm transition-colors">
                    {submitResult.approved ? "Close" : "Cancel"}
                  </button>
                  {submitResult.approved && submitResult.proposal && (
                    <Link href={`/proposals/${submitResult.proposal.id}`} className="flex-1 text-center bg-purple-600 hover:bg-purple-500 text-white py-2 rounded-xl text-sm font-semibold transition-colors">
                      View Proposal →
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Wallet modal */}
      {showWalletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowWalletModal(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-80 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-6">
              <h3 className="text-lg font-bold text-white">Connect Wallet</h3>
              <p className="text-xs text-gray-500 mt-1">View your VP and delegation status</p>
            </div>
            <div className="space-y-3">
              <button onClick={() => connectWallet("metamask")} className="w-full flex items-center gap-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-orange-500/50 rounded-xl px-4 py-3.5 transition-all">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-xl">🦊</div>
                <div className="text-left">
                  <div className="font-semibold text-white text-sm">MetaMask</div>
                  <div className="text-xs text-gray-500">Browser wallet</div>
                </div>
              </button>
              <button onClick={() => connectWallet("okx")} className="w-full flex items-center gap-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-blue-500/50 rounded-xl px-4 py-3.5 transition-all">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center font-black text-white text-sm">OKX</div>
                <div className="text-left">
                  <div className="font-semibold text-white text-sm">OKX Wallet</div>
                  <div className="text-xs text-gray-500">Native X Layer</div>
                </div>
              </button>
            </div>
            <button onClick={() => setShowWalletModal(false)} className="w-full mt-4 text-xs text-gray-600 hover:text-gray-400 transition-colors py-2">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
