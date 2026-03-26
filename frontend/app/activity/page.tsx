"use client";
import { useEffect, useState, useCallback } from "react";
import { ethers } from "ethers";
import Link from "next/link";
import { useWallet } from "@/contexts/WalletContext";

const STAKING_ADDRESS = process.env.NEXT_PUBLIC_XSEN_STAKING_ADDRESS ?? "0xc8FD7B12De6bFb10dF3eaCb38AAc09CBbeb25bFD";
const TOKEN_ADDRESS   = process.env.NEXT_PUBLIC_XSEN_TOKEN_ADDRESS   ?? "0x1bAB744c4c98D844984e297744Cb6b4E24e2E89b";

const STAKING_ABI = [
  "function getEffectiveVP(address) view returns (uint256)",
  "function getUserPositions(address) view returns (tuple(uint256 id, address owner, uint256 amount, uint8 tier, uint256 lockEnd, uint256 stakedAt, uint256 lastRewardAt, uint256 accReward, string delegatedAgent, bool active)[])",
];
const TOKEN_ABI = ["function balanceOf(address) view returns (uint256)"];

const TIER_NAMES = ["Flexible", "Lock30", "Lock90", "Lock180"];

const CATEGORY_STYLE: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  governance:  { bg: "bg-purple-900/30", text: "text-purple-300", dot: "bg-purple-400", label: "Governance" },
  staking:     { bg: "bg-blue-900/30",   text: "text-blue-300",   dot: "bg-blue-400",   label: "Staking"    },
  delegation:  { bg: "bg-green-900/30",  text: "text-green-300",  dot: "bg-green-400",  label: "Delegation" },
  token:       { bg: "bg-gray-800/60",   text: "text-gray-400",   dot: "bg-gray-500",   label: "Token"      },
  registry:    { bg: "bg-yellow-900/20", text: "text-yellow-400", dot: "bg-yellow-400", label: "Registry"   },
  other:       { bg: "bg-gray-800/40",   text: "text-gray-500",   dot: "bg-gray-600",   label: "Other"      },
};

function timeAgo(ms: number) {
  const sec = Math.floor((Date.now() - ms) / 1000);
  if (sec < 60)   return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function fmt(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000)     return `${(val / 1_000).toFixed(1)}K`;
  return val.toFixed(2);
}

export default function ActivityPage() {
  const { wallet, walletType, openModal } = useWallet();

  // On-chain state
  const [xsenBal, setXsenBal]     = useState(0);
  const [effectiveVP, setVP]      = useState(0);
  const [positions, setPositions] = useState<any[]>([]);

  // TX history
  const [txHistory, setTxHistory]     = useState<any[]>([]);
  const [explorerUrl, setExplorerUrl] = useState("");
  const [loadingTx, setLoadingTx]     = useState(false);
  const [txError, setTxError]         = useState("");

  // Filter
  const [filter, setFilter] = useState<string>("all");

  const loadChainData = useCallback(async (addr: string) => {
    try {
      const provider = new ethers.JsonRpcProvider("https://rpc.xlayer.tech");
      const token   = new ethers.Contract(TOKEN_ADDRESS,   TOKEN_ABI,   provider);
      const staking = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI, provider);
      const [bal, vp] = await Promise.all([
        token.balanceOf(addr),
        staking.getEffectiveVP(addr).catch(() => 0n),
      ]);
      setXsenBal(Number(ethers.formatEther(bal)));
      setVP(Number(ethers.formatEther(vp)));
      const pos = await staking.getUserPositions(addr).catch(() => []);
      setPositions(pos.map((p: any) => ({
        id: Number(p.id),
        amount: Number(ethers.formatEther(p.amount)),
        tier: TIER_NAMES[Number(p.tier)] ?? "Unknown",
        lockEnd: Number(p.lockEnd),
        delegatedAgent: p.delegatedAgent,
        active: p.active,
        accReward: Number(ethers.formatEther(p.accReward)),
      })));
    } catch (e) { console.error(e); }
  }, []);

  const loadTxHistory = useCallback(async (addr: string) => {
    setLoadingTx(true);
    setTxError("");
    try {
      const res = await fetch(`/api/onchain/wallet/${addr}/activity?limit=50`);
      const data = await res.json();
      setTxHistory(data.all_transactions ?? []);
      setExplorerUrl(data.explorer_url ?? "");
      if (data.error && data.total === 0) {
        setTxError("Could not load transaction history. Check OKX Explorer for full history.");
      }
    } catch {
      setTxError("Failed to load transaction history.");
    }
    setLoadingTx(false);
  }, []);

  // Auto-load when wallet connects (from global WalletContext)
  useEffect(() => {
    if (!wallet) {
      setXsenBal(0); setVP(0); setPositions([]);
      setTxHistory([]); setExplorerUrl(""); setTxError("");
      return;
    }
    loadChainData(wallet);
    loadTxHistory(wallet);
  }, [wallet, loadChainData, loadTxHistory]);

  const activePositions = positions.filter(p => p.active);
  const totalStaked     = activePositions.reduce((s, p) => s + p.amount, 0);
  const currentDelegate = activePositions.find(p => p.delegatedAgent)?.delegatedAgent;
  const pendingRewards  = activePositions.reduce((s, p) => s + p.accReward, 0);

  const categories = ["all", "governance", "staking", "delegation", "token"];
  const filtered   = filter === "all" ? txHistory : txHistory.filter(tx => tx.category === filter);
  const categoryCounts = txHistory.reduce((acc, tx) => {
    acc[tx.category] = (acc[tx.category] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Activity Log</h1>
          <p className="text-gray-500 text-sm mt-0.5">Your X-Senate governance and staking history on X Layer</p>
        </div>
        {wallet ? (
          <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-full px-4 py-2 text-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="font-mono text-gray-300 text-xs">{wallet.slice(0,6)}...{wallet.slice(-4)}</span>
            {explorerUrl && (
              <a href={explorerUrl} target="_blank" rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 text-xs ml-1 transition-colors">
                OKX Explorer →
              </a>
            )}
          </div>
        ) : (
          <button
            onClick={openModal}
            className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-5 py-2 rounded-full text-sm transition-all"
          >
            Connect Wallet
          </button>
        )}
      </div>

      {!wallet ? (
        <div className="border border-dashed border-gray-800 rounded-2xl p-20 text-center">
          <div className="text-gray-600 text-sm mb-4">Connect your wallet to view your activity log</div>
          <button
            onClick={openModal}
            className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-6 py-2.5 rounded-full text-sm transition-colors"
          >
            Connect Wallet
          </button>
        </div>
      ) : (
        <>
          {/* ── On-chain Summary ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "XSEN Balance",  value: fmt(xsenBal) + " XSEN",    color: "text-white" },
              { label: "Effective VP",  value: fmt(effectiveVP),           color: "text-purple-300" },
              { label: "Total Staked",  value: fmt(totalStaked) + " XSEN", color: "text-blue-300" },
              { label: "Delegated To",  value: currentDelegate ?? "—",     color: "text-green-300" },
            ].map(s => (
              <div key={s.label} className="border border-gray-800/60 rounded-xl p-4">
                <div className={`text-lg font-black truncate ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── Active Positions ── */}
          {activePositions.length > 0 && (
            <div className="border border-gray-800/60 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-800/40 flex items-center justify-between">
                <span className="text-sm font-semibold text-white">Staking Positions</span>
                {pendingRewards > 0 && (
                  <span className="text-xs text-green-400">+{fmt(pendingRewards)} XSEN pending</span>
                )}
              </div>
              <div className="divide-y divide-gray-800/40">
                {activePositions.map(p => {
                  const locked = p.lockEnd > 0 && p.lockEnd > Math.floor(Date.now() / 1000);
                  return (
                    <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-blue-400" />
                        <div>
                          <div className="text-sm font-semibold text-white">{fmt(p.amount)} XSEN</div>
                          <div className="text-xs text-gray-500">{p.tier} · {p.delegatedAgent ? `→ ${p.delegatedAgent}` : "not delegated"}</div>
                        </div>
                      </div>
                      <div className="text-right text-xs">
                        <div className="text-green-400">+{fmt(p.accReward)} reward</div>
                        <div className={locked ? "text-yellow-500" : "text-gray-600"}>
                          {locked ? `Locked until ${new Date(p.lockEnd * 1000).toLocaleDateString()}` : "Unlocked"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── TX History ── */}
          <div>
            <div className="flex items-center gap-1 border-b border-gray-800/40 mb-4">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={`px-3 py-2 text-xs font-semibold capitalize border-b-2 transition-all ${
                    filter === cat ? "border-purple-500 text-white" : "border-transparent text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {cat === "all" ? "All" : cat}
                  {cat !== "all" && categoryCounts[cat] && (
                    <span className="ml-1 text-gray-700">{categoryCounts[cat]}</span>
                  )}
                </button>
              ))}
              <div className="ml-auto">
                {explorerUrl && (
                  <a href={explorerUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                    Full history on OKX Explorer →
                  </a>
                )}
              </div>
            </div>

            {txError && (
              <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-xl p-4 text-yellow-400 text-xs mb-4">
                {txError}
              </div>
            )}

            {loadingTx ? (
              <div className="text-center py-12 text-gray-500 text-sm">Loading transaction history...</div>
            ) : filtered.length === 0 ? (
              <div className="border border-dashed border-gray-800 rounded-xl p-12 text-center">
                <div className="text-gray-600 text-sm">No transactions found</div>
                {explorerUrl && (
                  <a href={explorerUrl} target="_blank" rel="noopener noreferrer"
                    className="text-blue-400 text-xs mt-2 block hover:text-blue-300">
                    View on OKX Explorer →
                  </a>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((tx: any, i: number) => {
                  const style = CATEGORY_STYLE[tx.category] ?? CATEGORY_STYLE.other;
                  return (
                    <a
                      key={tx.txHash ?? i}
                      href={tx.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-4 border border-gray-800/60 hover:border-gray-700 bg-gray-900/20 hover:bg-gray-900/40 rounded-xl px-5 py-3.5 transition-all group"
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${style.bg} ${style.text}`}>
                        {tx.label}
                      </span>
                      <span className="font-mono text-xs text-gray-500 truncate flex-1">
                        {tx.txHash ? `${tx.txHash.slice(0, 18)}...${tx.txHash.slice(-6)}` : "—"}
                      </span>
                      {tx.amount && Number(tx.amount) > 0 && (
                        <span className="text-xs text-gray-400 shrink-0">
                          {Number(tx.amount).toFixed(4)} {tx.symbol}
                        </span>
                      )}
                      <span className={`text-[11px] shrink-0 ${tx.state === "success" ? "text-green-400" : "text-red-400"}`}>
                        {tx.state ?? "—"}
                      </span>
                      <span className="text-[11px] text-gray-600 shrink-0 w-16 text-right">
                        {tx.time ? timeAgo(tx.time) : "—"}
                      </span>
                      <span className="text-gray-700 group-hover:text-gray-500 text-xs transition-colors">↗</span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Quick Links ── */}
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/stake" className="text-xs border border-gray-800/60 hover:border-gray-700 text-gray-500 hover:text-gray-300 px-4 py-2 rounded-lg transition-colors">
              Manage Staking →
            </Link>
            <Link href="/app" className="text-xs border border-gray-800/60 hover:border-gray-700 text-gray-500 hover:text-gray-300 px-4 py-2 rounded-lg transition-colors">
              View Proposals →
            </Link>
            {explorerUrl && (
              <a href={explorerUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs border border-blue-800/40 hover:border-blue-600/60 text-blue-500 hover:text-blue-300 px-4 py-2 rounded-lg transition-colors">
                OKX Explorer →
              </a>
            )}
          </div>
        </>
      )}
    </div>
  );
}
