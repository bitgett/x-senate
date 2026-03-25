"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { runSentinelScan } from "@/lib/api";

const TOKEN_ADDRESS   = process.env.NEXT_PUBLIC_XSEN_TOKEN_ADDRESS   ?? "0x1bAB744c4c98D844984e297744Cb6b4E24e2E89b";
const STAKING_ADDRESS = process.env.NEXT_PUBLIC_XSEN_STAKING_ADDRESS ?? "0x9CD9eF69c4EE176c8115E4BCf6c604Eb46599502";

type MessageItem = {
  source: string;
  author: string;
  content: string;
  classification: "governance" | "chatter";
};

const STATUS_STYLE: Record<string, string> = {
  approved:       "bg-green-900/40 text-green-300 border-green-700/40",
  executed:       "bg-blue-900/40 text-blue-300 border-blue-700/40",
  in_debate:      "bg-purple-900/40 text-purple-300 border-purple-700/40",
  rejected_by_ai: "bg-red-900/40 text-red-300 border-red-700/40",
  draft:          "bg-gray-800 text-gray-400 border-gray-700",
  pending:        "bg-yellow-900/30 text-yellow-400 border-yellow-700/30",
};

const STATUS_LABEL: Record<string, string> = {
  approved:       "Approved",
  executed:       "Executed",
  in_debate:      "In Debate",
  rejected_by_ai: "AI Rejected",
  draft:          "Draft",
  pending:        "Pending",
};

const SRC_ICON: Record<string, string> = {
  forum: "📋", discord: "💬", telegram: "📱",
};

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function SentinelPage() {
  const router = useRouter();
  const [scanning, setScanning]   = useState(false);
  const [result, setResult]       = useState<any>(null);
  const [error, setError]         = useState("");
  const [proposals, setProposals] = useState<any[]>([]);
  const [totals, setTotals]       = useState<any>(null);
  const [propsLoading, setPropsLoad] = useState(true);
  const [market, setMarket]       = useState<any>(null);
  const [gas, setGas]             = useState<any>(null);
  const [xsenPrice, setXsenPrice] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/proposals").then(r => r.ok ? r.json() : []).catch(() => []),
      fetch("/api/staking/totals").then(r => r.ok ? r.json() : null).catch(() => null),
      fetch("/api/onchain/market/summary").then(r => r.ok ? r.json() : null).catch(() => null),
      fetch("/api/onchain/gas").then(r => r.ok ? r.json() : null).catch(() => null),
      fetch("/api/x402/quote").then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([props, tot, mkt, g, quote]) => {
      setProposals(Array.isArray(props) ? props : []);
      setTotals(tot);
      setMarket(mkt);
      setGas(g);
      if (quote?.xsen_price_usd) setXsenPrice(quote.xsen_price_usd);
    }).finally(() => setPropsLoad(false));
  }, []);

  async function handleScan() {
    setScanning(true);
    setError("");
    setResult(null);
    try {
      const data = await runSentinelScan();
      setResult(data);
    } catch {
      setError("Scan failed — is the backend running?");
    } finally {
      setScanning(false);
    }
  }

  const totalProps    = proposals.length;
  const approved      = proposals.filter(p => p.status === "approved" || p.status === "executed").length;
  const rejected      = proposals.filter(p => p.status === "rejected_by_ai").length;
  const inDebate      = proposals.filter(p => p.status === "in_debate").length;
  const pending       = proposals.filter(p => p.status === "pending" || p.status === "draft").length;
  const approvalRate  = totalProps > 0 ? Math.round((approved / totalProps) * 100) : 0;
  const totalStaked   = totals?.total_staked_xsen ?? 0;

  function fmtNum(v: number) {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
    return String(v);
  }

  return (
    <div className="w-full space-y-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap pb-6 border-b border-gray-800/60">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-900/30 border border-purple-700/40 flex items-center justify-center text-2xl">
            🔍
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Sentinel Monitor</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              AI-powered community scanner · auto-generates governance proposals from Forum, Discord & Telegram
            </p>
          </div>
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl transition-all text-sm"
          style={{ boxShadow: "0 0 16px rgba(139,92,246,0.3)" }}
        >
          {scanning ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Scanning...
            </>
          ) : "⚡ Run Sentinel Scan"}
        </button>
      </div>

      {/* ── Market & Gas strip ── */}
      {(market || gas) && (
        <div className="flex flex-wrap gap-2 text-xs">
          {market?.ETH?.price && (
            <div className="flex items-center gap-1.5 border border-gray-800/60 rounded-full px-3 py-1.5">
              <span className="text-gray-500">ETH</span>
              <span className="text-white font-semibold">${Number(market.ETH.price).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              {market.price_change_24h_pct !== undefined && (
                <span className={`font-medium ${market.price_change_24h_pct >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {market.price_change_24h_pct > 0 ? "+" : ""}{Number(market.price_change_24h_pct).toFixed(2)}%
                </span>
              )}
            </div>
          )}
          {gas?.gas_prices && ["normal", "fast", "rapid"].map((s) => gas.gas_prices[s] && (
            <div key={s} className="flex items-center gap-1.5 border border-gray-800/60 rounded-full px-3 py-1.5">
              <span className="text-gray-600 capitalize">{s}</span>
              <span className="text-gray-300 font-mono">{gas.gas_prices[s]} Gwei</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 border border-purple-800/30 rounded-full px-3 py-1.5 text-purple-500">
            X Layer · chainId 196
          </div>
        </div>
      )}

      {/* ── Protocol Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Proposals", value: totalProps,       color: "text-white" },
          { label: "Approved",        value: approved,         color: "text-green-400" },
          { label: "AI Rejected",     value: rejected,         color: "text-red-400" },
          { label: "In Debate",       value: inDebate,         color: "text-purple-400" },
          { label: "Pending",         value: pending,          color: "text-yellow-400" },
          { label: "Approval Rate",   value: approvalRate + "%", color: "text-blue-300" },
        ].map(s => (
          <div key={s.label} className="border border-gray-800/60 rounded-xl p-4 text-center">
            <div className={`text-2xl font-black ${s.color}`}>{propsLoading ? "—" : s.value}</div>
            <div className="text-[11px] text-gray-600 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Two Column: Token Info + Recent Proposals ── */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Token / Protocol Info */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">XSEN Token</h2>

          <div className="border border-gray-800/60 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/xsen-logo.svg" alt="XSEN" className="w-10 h-10 rounded-xl" />
              <div>
                <div className="font-bold text-white">XSEN</div>
                <div className="text-xs text-gray-500">X Layer Mainnet</div>
              </div>
              <span className="ml-auto text-[10px] bg-green-900/30 text-green-400 border border-green-700/30 rounded-full px-2 py-0.5">Live</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-gray-800/60">
                <span className="text-gray-500">Price</span>
                {xsenPrice
                  ? <span className="text-white font-semibold">${xsenPrice < 0.01 ? xsenPrice.toFixed(6) : xsenPrice.toFixed(4)}</span>
                  : <span className="text-gray-600">fetching...</span>
                }
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-gray-800/60">
                <span className="text-gray-500">Total Staked</span>
                <span className="text-white font-semibold">{fmtNum(totalStaked)} XSEN</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-gray-800/60">
                <span className="text-gray-500">Chain ID</span>
                <span className="font-mono text-gray-300">196</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-gray-800/60">
                <span className="text-gray-500">Token</span>
                <a
                  href={`https://www.okx.com/web3/explorer/xlayer/address/${TOKEN_ADDRESS}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-purple-400 hover:text-purple-300 text-[11px]"
                >
                  {shortAddr(TOKEN_ADDRESS)}
                </a>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-gray-500">Staking</span>
                <a
                  href={`https://www.okx.com/web3/explorer/xlayer/address/${STAKING_ADDRESS}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-purple-400 hover:text-purple-300 text-[11px]"
                >
                  {shortAddr(STAKING_ADDRESS)}
                </a>
              </div>
            </div>
          </div>

          {/* Genesis 5 Status */}
          <div className="border border-gray-800/60 rounded-xl p-5">
            <h3 className="text-xs text-gray-500 mb-3 uppercase tracking-wide">Genesis 5 Status</h3>
            <div className="space-y-2">
              {["Guardian", "Merchant", "Architect", "Diplomat", "Populist"].map(name => (
                <div key={name} className="flex items-center justify-between text-sm">
                  <span className="text-gray-300">{name}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    <span className="text-[11px] text-green-400">Online</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Proposals */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Past Proposals</h2>
            <Link href="/app" className="text-xs text-purple-400 hover:text-purple-300">View all →</Link>
          </div>

          {propsLoading ? (
            <div className="border border-dashed border-gray-800 rounded-xl p-10 text-center text-gray-700 text-sm">Loading proposals...</div>
          ) : proposals.length === 0 ? (
            <div className="border border-dashed border-gray-800 rounded-xl p-10 text-center">
              <p className="text-gray-600 text-sm">No proposals yet.</p>
              <button
                onClick={handleScan}
                className="mt-3 text-sm text-purple-400 hover:text-purple-300"
              >
                Run Sentinel Scan to generate the first →
              </button>
            </div>
          ) : (
            <div className="border border-gray-800/60 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-600 text-left bg-gray-900/30">
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3 text-right hidden sm:table-cell">Votes</th>
                    <th className="px-4 py-3 text-right">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {proposals.slice(0, 12).map((p: any) => {
                    const totalVotes = (p.approve_count ?? 0) + (p.reject_count ?? 0);
                    const style = STATUS_STYLE[p.status] ?? "bg-gray-800 text-gray-400 border-gray-700";
                    return (
                      <tr key={p.id} className="border-b border-gray-800/30 hover:bg-gray-800/20 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${style}`}>
                            {STATUS_LABEL[p.status] ?? p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/proposals/${p.id}`} className="text-gray-300 hover:text-white text-xs line-clamp-1 transition-colors">
                            {p.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-gray-600 hidden sm:table-cell">
                          {totalVotes > 0 ? (
                            <span>
                              <span className="text-green-400">{p.approve_count ?? 0}✓</span>
                              {" / "}
                              <span className="text-red-400">{p.reject_count ?? 0}✗</span>
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-gray-600 whitespace-nowrap">
                          {new Date(p.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {proposals.length > 12 && (
                <div className="border-t border-gray-800 px-4 py-3 text-center">
                  <Link href="/app" className="text-xs text-purple-400 hover:text-purple-300">
                    View all {proposals.length} proposals →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Sentinel Scan Section ── */}
      <div className="border-t border-gray-800/60 pt-8">
        <h2 className="text-sm font-semibold text-gray-400 mb-4 tracking-wider uppercase">Community Scanner</h2>

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-400 text-sm mb-4">
            ⚠️ {error}
          </div>
        )}

        {!result && !scanning && (
          <div className="border border-dashed border-gray-800 rounded-xl p-10 text-center">
            <div className="text-3xl mb-3">🔍</div>
            <p className="text-gray-500 text-sm mb-2">Sentinel scans Forum, Discord, and Telegram for governance signals.</p>
            <p className="text-gray-700 text-xs mb-5">When governance-level discussions hit threshold, a draft proposal is auto-generated and sent to the AI Senate.</p>
            <button
              onClick={handleScan}
              disabled={scanning}
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl transition-all text-sm"
            >
              ⚡ Run Sentinel Scan
            </button>
          </div>
        )}

        {result && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Scanned", value: result.total_messages_scanned },
                { label: "Governance",    value: result.governance_messages,     color: "text-green-400" },
                { label: "Chatter",       value: result.chatter_messages,        color: "text-gray-400" },
                { label: "Threshold",     value: result.threshold_triggered ? "🔥 TRIGGERED" : "Not Triggered", color: result.threshold_triggered ? "text-red-400" : "text-gray-400" },
              ].map((stat) => (
                <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
                  <div className={`text-2xl font-bold ${stat.color || "text-white"}`}>{stat.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Source breakdown */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Sources</h3>
              <div className="flex gap-4 flex-wrap">
                {Object.entries(result.sources || {}).map(([src, count]) => (
                  <div key={src} className="flex items-center gap-1.5 text-sm text-gray-400">
                    <span>{SRC_ICON[src] || "📌"}</span>
                    <span className="capitalize">{src}</span>
                    <span className="text-white font-semibold">{String(count)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Keyword hits */}
            {result.keyword_counts && Object.keys(result.keyword_counts).length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Keyword Frequency</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(result.keyword_counts)
                    .sort(([, a], [, b]) => Number(b) - Number(a))
                    .map(([kw, count]) => (
                      <span key={kw} className="bg-purple-900/40 border border-purple-700/40 text-purple-300 text-xs px-2 py-1 rounded-full">
                        "{kw}" × {String(count)}
                      </span>
                    ))}
                </div>
              </div>
            )}

            {/* Messages preview */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Community Feed Preview</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {(result.messages_preview || []).map((msg: MessageItem, i: number) => (
                  <div key={i} className={`flex gap-3 p-2 rounded-lg text-sm ${msg.classification === "governance" ? "bg-purple-900/20 border border-purple-800/30" : "bg-gray-800/40"}`}>
                    <span>{SRC_ICON[msg.source] || "📌"}</span>
                    <div>
                      <span className="text-gray-400 font-medium">@{msg.author}</span>
                      <span className="text-gray-300 ml-2">{msg.content}</span>
                    </div>
                    {msg.classification === "governance" && (
                      <span className="ml-auto text-xs text-purple-400 font-medium shrink-0">GOV</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Draft proposal */}
            {result.draft_proposal ? (
              <div className="bg-green-900/20 border border-green-700/50 rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-green-400 text-lg">✅</span>
                  <h3 className="text-green-400 font-semibold">Draft Proposal Generated</h3>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Title</div>
                  <div className="text-white font-semibold text-lg">{result.draft_proposal.title}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Summary</div>
                  <div className="text-gray-300 text-sm">{result.draft_proposal.summary}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Sentinel Analysis</div>
                  <div className="text-gray-400 text-sm">{result.draft_proposal.sentinel_analysis}</div>
                </div>
                {result.saved_proposal_id && (
                  <button
                    onClick={() => router.push(`/proposals/${result.saved_proposal_id}`)}
                    className="w-full mt-2 bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded-xl transition-colors"
                  >
                    View Proposal → Send to Senate
                  </button>
                )}
              </div>
            ) : result.threshold_triggered === false ? (
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 text-center text-gray-400">
                No threshold triggered — community chatter hasn&apos;t reached governance levels.
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
