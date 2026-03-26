"use client";
import { useEffect, useState, useCallback } from "react";
import { ethers } from "ethers";
import { useWallet } from "@/contexts/WalletContext";

const STAKING_ADDRESS = process.env.NEXT_PUBLIC_XSEN_STAKING_ADDRESS ?? "0xc8FD7B12De6bFb10dF3eaCb38AAc09CBbeb25bFD";
const TOKEN_ADDRESS   = process.env.NEXT_PUBLIC_XSEN_TOKEN_ADDRESS   ?? "0x1bAB744c4c98D844984e297744Cb6b4E24e2E89b";

const STAKING_ABI = [
  "function getEffectiveVP(address user) view returns (uint256)",
  "function getUserPositions(address user) view returns (tuple(uint256 id, address owner, uint256 amount, uint8 tier, uint256 lockEnd, uint256 stakedAt, uint256 lastRewardAt, uint256 accReward, string delegatedAgent, bool active)[])",
  "function delegatePosition(uint256 positionId, string agentName) external",
  "function stake(uint256 amount, uint8 tier) external",
  "function unstake(uint256 positionId) external",
  "function claimAllRewards() external",
];
const TOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
];

const TIER_INFO = [
  { id: 0, name: "Flexible", days: 0,   apy: 5,  mult: 1.0, color: "border-gray-700 bg-gray-900/50",        badge: "bg-gray-700 text-gray-300" },
  { id: 1, name: "Lock30",   days: 30,  apy: 10, mult: 1.1, color: "border-blue-700/50 bg-blue-950/30",      badge: "bg-blue-800 text-blue-200" },
  { id: 2, name: "Lock90",   days: 90,  apy: 20, mult: 1.3, color: "border-purple-700/50 bg-purple-950/30",  badge: "bg-purple-800 text-purple-200" },
  { id: 3, name: "Lock180",  days: 180, apy: 35, mult: 1.5, color: "border-yellow-600/50 bg-yellow-950/30",  badge: "bg-yellow-700 text-yellow-200" },
];

const GENESIS_AGENTS = [
  { name: "Guardian",  role: "Security & Risk",       accent: "#3b82f6" },
  { name: "Merchant",  role: "Economics & ROI",       accent: "#eab308" },
  { name: "Architect", role: "Technical Feasibility", accent: "#22c55e" },
  { name: "Diplomat",  role: "Community & Consensus", accent: "#a855f7" },
  { name: "Populist",  role: "User Voice & Fairness", accent: "#ef4444" },
];

// 7-day unstake cooldown (UI-enforced)
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

function getCooldownKey(address: string, posId: number) {
  return `xsenate_unstake_${address}_${posId}`;
}
function getCooldownEnd(address: string, posId: number): number | null {
  try {
    const v = localStorage.getItem(getCooldownKey(address, posId));
    if (!v) return null;
    return JSON.parse(v).requestedAt + COOLDOWN_MS;
  } catch { return null; }
}
function startCooldown(address: string, posId: number) {
  localStorage.setItem(getCooldownKey(address, posId), JSON.stringify({ requestedAt: Date.now() }));
}
function clearCooldown(address: string, posId: number) {
  localStorage.removeItem(getCooldownKey(address, posId));
}

function fmtCountdown(ms: number): string {
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmt(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000)     return `${(val / 1_000).toFixed(1)}K`;
  return val.toFixed(2);
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const CATEGORY_COLOR: Record<string, string> = {
  staking:    "text-purple-400 bg-purple-900/20 border-purple-700/30",
  governance: "text-blue-400 bg-blue-900/20 border-blue-700/30",
  delegation: "text-green-400 bg-green-900/20 border-green-700/30",
  token:      "text-yellow-400 bg-yellow-900/20 border-yellow-700/30",
};

export default function StakePage() {
  const { wallet, walletType, openModal, rawProvider, refreshVP } = useWallet();

  const [activeTab, setActiveTab]   = useState<"staking" | "myvp">("staking");
  const [xsenBal, setXsenBal]       = useState<number>(0);
  const [effectiveVP, setVP]        = useState<number>(0);
  const [positions, setPositions]   = useState<any[]>([]);
  const [leaderboard, setLb]        = useState<any[]>([]);
  const [tiers, setTiers]           = useState<any>(null);
  const [totals, setTotals]         = useState<any>(null);
  const [epoch, setEpoch]           = useState<any>(null);
  const [delegating, setDelegating] = useState<string | null>(null);
  const [txStatus, setTxStatus]     = useState<string | null>(null);

  // Stake form
  const [stakeAmount, setStakeAmount]   = useState("");
  const [selectedTier, setSelectedTier] = useState(0);
  const [staking, setStaking]           = useState(false);
  const [unstaking, setUnstaking]       = useState<number | null>(null);

  // Cooldown tick (re-render every minute to update countdown)
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Staking history
  const [history, setHistory]     = useState<any[]>([]);
  const [histLoading, setHistLoad] = useState(false);

  // Wallet portfolio (OKX Wallet API)
  const [portfolio, setPortfolio]     = useState<any>(null);
  const [portLoading, setPortLoading] = useState(false);
  const [gas, setGas]                 = useState<any>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/staking/tiers").then(r => r.ok ? r.json() : null),
      fetch("/api/staking/totals").then(r => r.ok ? r.json() : null),
      fetch("/api/staking/leaderboard?limit=5").then(r => r.ok ? r.json() : null),
      fetch("/api/staking/epoch").then(r => r.ok ? r.json() : null),
      fetch("/api/onchain/gas").then(r => r.ok ? r.json() : null),
    ]).then(([t, tot, lb, ep, g]) => {
      setTiers(t);
      setTotals(tot);
      setLb(lb?.leaderboard ?? []);
      setEpoch(ep);
      setGas(g);
    });
  }, []);

  const loadWalletData = useCallback(async () => {
    if (!wallet || !walletType) return;
    try {
      const raw = rawProvider();
      const provider = new ethers.BrowserProvider(raw, { chainId: 196, name: "xlayer" });
      const token   = new ethers.Contract(TOKEN_ADDRESS,   TOKEN_ABI,   provider);
      const stk     = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI, provider);
      const [bal, vp] = await Promise.all([
        token.balanceOf(wallet),
        stk.getEffectiveVP(wallet).catch(() => 0n),
      ]);
      setXsenBal(Number(ethers.formatEther(bal)));
      setVP(Number(ethers.formatEther(vp)));
      try {
        const pos = await stk.getUserPositions(wallet);
        setPositions(pos.map((p: any) => ({
          id:             Number(p.id),
          amount:         Number(ethers.formatEther(p.amount)),
          tier:           TIER_INFO[Number(p.tier)]?.name ?? "Unknown",
          tierId:         Number(p.tier),
          lockEnd:        Number(p.lockEnd),
          stakedAt:       Number(p.stakedAt),
          delegatedAgent: p.delegatedAgent,
          active:         p.active,
          accReward:      Number(ethers.formatEther(p.accReward)),
        })));
      } catch (e) { console.error("getPositions failed:", e); setPositions([]); }
    } catch (e) { console.error(e); }
  }, [wallet, walletType, rawProvider]);

  // Load wallet data whenever wallet changes
  useEffect(() => {
    loadWalletData();
  }, [loadWalletData]);

  // Auto-load portfolio when wallet connects
  useEffect(() => {
    if (!wallet) { setPortfolio(null); return; }
    setPortLoading(true);
    fetch(`/api/onchain/wallet/${wallet}/portfolio`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setPortfolio(data); })
      .catch(() => {})
      .finally(() => setPortLoading(false));
  }, [wallet]);

  // Load staking history when wallet changes
  useEffect(() => {
    if (!wallet) { setHistory([]); return; }
    setHistLoad(true);
    fetch(`/api/onchain/wallet/${wallet}/activity?limit=50`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const txs = (data?.transactions ?? []).filter(
          (t: any) => t.category === "staking" || t.category === "delegation"
        );
        setHistory(txs.slice(0, 20));
      })
      .catch(() => {})
      .finally(() => setHistLoad(false));
  }, [wallet]);

  async function stakeTokens() {
    if (!wallet || !stakeAmount || Number(stakeAmount) <= 0) return;
    setStaking(true);
    setTxStatus(null);
    try {
      const provider = new ethers.BrowserProvider(rawProvider(), { chainId: 196, name: "xlayer" });
      const signer = await provider.getSigner();
      const token = new ethers.Contract(TOKEN_ADDRESS,   TOKEN_ABI,   signer);
      const stk   = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI, signer);
      const amt = ethers.parseEther(stakeAmount);
      setTxStatus("Approving XSEN...");
      const approveTx = await token.approve(STAKING_ADDRESS, amt);
      await approveTx.wait();
      setTxStatus("Staking...");
      const tx = await stk.stake(amt, selectedTier);
      await tx.wait();
      setTxStatus(`✓ Staked ${stakeAmount} XSEN in ${TIER_INFO[selectedTier].name}`);
      setStakeAmount("");
      await loadWalletData();
      await refreshVP();
      setActiveTab("myvp");
    } catch (e: any) {
      setTxStatus(`Error: ${e.message?.slice(0, 80)}`);
    }
    setStaking(false);
  }

  async function completeUnstake(posId: number) {
    if (!wallet) return;
    setUnstaking(posId);
    setTxStatus(null);
    try {
      const provider = new ethers.BrowserProvider(rawProvider(), { chainId: 196, name: "xlayer" });
      const signer = await provider.getSigner();
      const stk = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI, signer);
      const tx = await stk.unstake(posId);
      setTxStatus("Unstaking...");
      await tx.wait();
      clearCooldown(wallet, posId);
      setTxStatus("✓ Unstaked successfully");
      await loadWalletData();
      await refreshVP();
    } catch (e: any) {
      setTxStatus(`Error: ${e.message?.slice(0, 80)}`);
    }
    setUnstaking(null);
  }

  async function delegateTo(agentName: string) {
    if (!wallet || positions.length === 0) return;
    const activePos = positions.find(p => p.active);
    if (!activePos) { setTxStatus("No active positions to delegate."); return; }
    setDelegating(agentName);
    setTxStatus(null);
    try {
      const provider = new ethers.BrowserProvider(rawProvider(), { chainId: 196, name: "xlayer" });
      const signer = await provider.getSigner();
      const stk = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI, signer);
      const tx = await stk.delegatePosition(activePos.id, agentName);
      setTxStatus(`Delegating to ${agentName}...`);
      await tx.wait();
      setTxStatus(`✓ Delegated to ${agentName}`);
      await loadWalletData();
    } catch (e: any) {
      setTxStatus(`Error: ${e.message?.slice(0, 80)}`);
    }
    setDelegating(null);
  }

  const currentDelegate  = positions.find(p => p.active && p.delegatedAgent)?.delegatedAgent;
  const totalStaked      = totals?.total_staked_xsen ?? 0;
  const totalVP          = totals?.total_effective_vp_xsen ?? 0;
  const myVPPct          = totalVP > 0 && effectiveVP > 0 ? ((effectiveVP / totalVP) * 100).toFixed(2) : "0.00";
  const totalAccReward   = positions.reduce((s, p) => s + p.accReward, 0);
  const myTotalStaked    = positions.filter(p => p.active).reduce((s, p) => s + p.amount, 0);

  return (
    <div className="-mx-6 -mt-6">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden px-6 pt-14 pb-8 border-b border-gray-800/40"
        style={{ background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(139,92,246,0.12) 0%, transparent 70%)" }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-4xl font-black text-white tracking-tight">
              X-Senate <span className="text-purple-400">Stake</span>
            </h1>
            <p className="text-gray-500 mt-1.5 text-sm max-w-md">
              Lock XSEN to earn Voting Power. Delegate to AI agents and govern X Layer.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {wallet ? (
              <>
                {totalAccReward > 0 && (
                  <button
                    onClick={async () => {
                      if (!wallet) return;
                      try {
                        const provider = new ethers.BrowserProvider(rawProvider(), { chainId: 196, name: "xlayer" });
                        const signer = await provider.getSigner();
                        const stk = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI, signer);
                        const tx = await stk.claimAllRewards();
                        setTxStatus("Claiming...");
                        await tx.wait();
                        setTxStatus("✓ Claimed!");
                        await loadWalletData();
                        await refreshVP();
                      } catch (e: any) { setTxStatus(`Error: ${e.message?.slice(0, 60)}`); }
                    }}
                    className="flex items-center gap-2 bg-green-600/20 hover:bg-green-600/30 border border-green-500/40 text-green-300 font-semibold px-4 py-2 rounded-full text-sm transition-all"
                  >
                    Claim {fmt(totalAccReward)} XSEN
                  </button>
                )}
                <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-full px-4 py-2 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="font-mono text-gray-300">{shortAddr(wallet)}</span>
                  <span className="text-gray-600">·</span>
                  <span className="text-white font-semibold">{fmt(xsenBal)} XSEN</span>
                </div>
              </>
            ) : (
              <button
                onClick={openModal}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-2.5 rounded-full transition-all text-sm"
                style={{ boxShadow: "0 0 24px rgba(139,92,246,0.35)" }}
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>

        {txStatus && (
          <div className={`mt-4 max-w-5xl mx-auto inline-block rounded-full px-4 py-1.5 text-xs border ${txStatus.startsWith("Error") ? "bg-red-900/20 border-red-700/40 text-red-300" : "bg-green-900/20 border-green-700/40 text-green-300"}`}>
            {txStatus}
          </div>
        )}
      </div>

      {/* ── Protocol Stats Bar ── */}
      <div className="border-b border-gray-800/40 bg-[#0a0a0f]">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-4 divide-x divide-gray-800/60">
          {[
            { label: "Total Staked",  value: fmt(totalStaked) + " XSEN", color: "text-white" },
            { label: "Total VP",      value: fmt(totalVP),                color: "text-purple-300" },
            { label: "Max APY",       value: "35%",                       color: "text-green-300" },
            { label: "Active Agents", value: String(leaderboard.length),  color: "text-blue-300" },
          ].map(s => (
            <div key={s.label} className="px-4 py-4 text-center">
              <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-600 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="border-b border-gray-800/40 bg-[#0a0a0f]">
        <div className="max-w-5xl mx-auto px-6 flex gap-0">
          {(["staking", "myvp"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3.5 text-sm font-semibold border-b-2 transition-all ${
                activeTab === tab
                  ? "border-purple-500 text-white"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab === "staking" ? "Staking" : "My VP & History"}
              {tab === "myvp" && wallet && positions.filter(p => p.active).length > 0 && (
                <span className="ml-2 text-[10px] bg-purple-600/30 text-purple-300 rounded-full px-1.5 py-0.5">
                  {positions.filter(p => p.active).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* ── STAKING TAB ── */}
        {activeTab === "staking" && (
          <div className="space-y-8">

            {/* Stake Form */}
            <div className="border border-gray-800/60 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-800/40 flex items-center justify-between">
                <h2 className="font-semibold text-white">Stake XSEN</h2>
                {wallet && <span className="text-xs text-gray-500">Balance: <span className="text-white font-mono">{fmt(xsenBal)} XSEN</span></span>}
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="text-xs text-gray-500 mb-2 block">Amount</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={stakeAmount}
                      onChange={e => setStakeAmount(e.target.value)}
                      placeholder="0.00"
                      className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-purple-500 placeholder-gray-700"
                    />
                    {wallet && (
                      <button
                        onClick={() => setStakeAmount(String(Math.floor(xsenBal)))}
                        className="px-3 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-xs text-gray-400 transition-colors"
                      >
                        MAX
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-500 mb-2 block">Lock Period</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {TIER_INFO.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTier(t.id)}
                        className={`border rounded-xl p-3 text-left transition-all ${
                          selectedTier === t.id
                            ? `${t.color} ring-1 ring-purple-500/50`
                            : "border-gray-800 bg-gray-900/30 hover:border-gray-700"
                        }`}
                      >
                        <div className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full w-fit mb-1.5 ${t.badge}`}>{t.name}</div>
                        <div className="text-white font-bold text-sm">{t.apy}% APY</div>
                        <div className="text-xs text-purple-400 mt-0.5">{t.mult}x VP</div>
                        {t.days > 0 && <div className="text-xs text-gray-600 mt-0.5">{t.days}d lock</div>}
                      </button>
                    ))}
                  </div>
                </div>

                {stakeAmount && Number(stakeAmount) > 0 && (
                  <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl px-4 py-3 flex items-center justify-between text-sm">
                    <span className="text-gray-500">Estimated VP</span>
                    <span className="font-bold text-purple-300">
                      {fmt(Number(stakeAmount) * TIER_INFO[selectedTier].mult)} VP
                    </span>
                  </div>
                )}

                {selectedTier === 0 && (
                  <div className="bg-yellow-900/10 border border-yellow-700/30 rounded-xl px-4 py-3 text-xs text-yellow-400">
                    ⚠ Flexible positions require a <strong>7-day unstake cooldown</strong> after requesting withdrawal.
                  </div>
                )}

                <button
                  onClick={wallet ? stakeTokens : openModal}
                  disabled={staking || (!!wallet && (!stakeAmount || Number(stakeAmount) <= 0))}
                  className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all text-sm"
                  style={!staking ? { boxShadow: "0 0 20px rgba(139,92,246,0.25)" } : undefined}
                >
                  {staking ? "Processing..." : wallet ? `Stake ${TIER_INFO[selectedTier].name}` : "Connect Wallet to Stake"}
                </button>

                {/* Gas prices */}
                {gas?.gas_prices && (
                  <div className="flex items-center justify-between text-[11px] text-gray-600 pt-1">
                    <span>X Layer Gas</span>
                    <div className="flex gap-3">
                      {["normal", "fast", "rapid"].map(s => gas.gas_prices[s] && (
                        <span key={s}><span className="capitalize">{s}</span> <span className="text-gray-400 font-mono">{gas.gas_prices[s]}</span> Gwei</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tier Info Cards */}
            <div>
              <h2 className="text-sm font-semibold text-gray-400 mb-3 tracking-wider uppercase">Tier Details</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {TIER_INFO.map(t => (
                  <div key={t.id} className={`border rounded-xl p-4 ${t.color}`}>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${t.badge}`}>{t.name}</span>
                    <div className="mt-3 space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">APY</span>
                        <span className="text-white font-bold">{t.apy}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">VP Mult</span>
                        <span className="text-purple-300 font-bold">{t.mult}x</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Lock</span>
                        <span className="text-gray-300">{t.days > 0 ? `${t.days} days` : "None"}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Cooldown</span>
                        <span className="text-yellow-400 text-xs">7 days</span>
                      </div>
                    </div>
                    <div className="mt-3 h-1 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-purple-600 to-blue-400"
                        style={{ width: `${((t.mult - 1) / 0.5) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Epoch Info */}
            {epoch && (
              <div className="border border-gray-800/60 rounded-xl px-6 py-4">
                <div className="text-xs font-mono text-gray-600 tracking-widest uppercase mb-3">Epoch</div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-xl font-black text-white">{epoch.current_epoch ?? "—"}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Current Epoch</div>
                  </div>
                  <div>
                    <div className="text-xl font-black text-green-300">{epoch.reward_pool ? fmt(epoch.reward_pool) : "—"}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Reward Pool</div>
                  </div>
                  <div>
                    <div className="text-xl font-black text-blue-300">{epoch.next_epoch_in ?? "—"}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Next Epoch In</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── MY VP TAB ── */}
        {activeTab === "myvp" && (
          <div className="space-y-8">

            {!wallet ? (
              <div className="border border-dashed border-gray-700 rounded-2xl p-16 text-center">
                <div className="text-gray-600 text-sm mb-4">Connect your wallet to view your staking positions</div>
                <button
                  onClick={openModal}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-6 py-2.5 rounded-full text-sm transition-colors"
                >
                  Connect Wallet
                </button>
              </div>
            ) : (
              <>
                {/* My VP Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "Effective VP",   value: fmt(effectiveVP),   color: "text-purple-300" },
                    { label: "XSEN Staked",    value: fmt(myTotalStaked), color: "text-white" },
                    { label: "VP Share",       value: myVPPct + "%",      color: "text-blue-300" },
                    { label: "Pending Reward", value: fmt(totalAccReward) + " XSEN", color: "text-green-300" },
                  ].map(s => (
                    <div key={s.label} className="border border-gray-800/60 rounded-xl p-4 text-center">
                      <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                      <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                    </div>
                  ))}
                </div>

                {totalAccReward > 0 && (
                  <button
                    onClick={async () => {
                      if (!wallet) return;
                      try {
                        const provider = new ethers.BrowserProvider(rawProvider(), { chainId: 196, name: "xlayer" });
                        const signer = await provider.getSigner();
                        const stk = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI, signer);
                        const tx = await stk.claimAllRewards();
                        setTxStatus("Claiming...");
                        await tx.wait();
                        setTxStatus("✓ Claimed!");
                        await loadWalletData();
                        await refreshVP();
                      } catch (e: any) { setTxStatus(`Error: ${e.message?.slice(0,60)}`); }
                    }}
                    className="flex items-center gap-2 bg-green-600/20 hover:bg-green-600/30 border border-green-500/40 text-green-300 font-semibold px-5 py-2.5 rounded-full text-sm transition-all"
                  >
                    Claim All Rewards · {fmt(totalAccReward)} XSEN
                  </button>
                )}

                {/* My Positions */}
                {positions.length > 0 ? (
                  <div>
                    <h2 className="text-sm font-semibold text-gray-400 mb-3 tracking-wider uppercase">My Positions</h2>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {positions.map(p => {
                        const now   = Date.now();
                        const nowSec = Math.floor(now / 1000);
                        const locked = p.lockEnd > 0 && p.lockEnd > nowSec;
                        const unlockDate = p.lockEnd > 0 ? new Date(p.lockEnd * 1000).toLocaleDateString() : null;
                        const cooldownEnd = wallet ? getCooldownEnd(wallet, p.id) : null;
                        const inCooldown  = cooldownEnd !== null && now < cooldownEnd;
                        const cooldownDone = cooldownEnd !== null && now >= cooldownEnd;
                        const remaining   = cooldownEnd ? cooldownEnd - now : 0;

                        const stakedAt = p.stakedAt > 0 ? new Date(p.stakedAt * 1000) : null;

                        return (
                          <div key={p.id} className={`border rounded-xl p-4 flex flex-col ${p.active ? "border-gray-700 bg-gray-900/40" : "border-gray-800 opacity-40"}`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-gray-600">Position #{p.id}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${TIER_INFO[p.tierId]?.badge ?? "bg-gray-700 text-gray-300"}`}>{p.tier}</span>
                            </div>
                            <div className="text-2xl font-black text-white">{fmt(p.amount)} <span className="text-sm font-normal text-gray-500">XSEN</span></div>
                            <div className="mt-2 space-y-1 text-xs">
                              {stakedAt && (
                                <div className="flex justify-between text-gray-500">
                                  <span>Staked at</span>
                                  <span className="text-gray-400">{stakedAt.toLocaleDateString()} {stakedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                </div>
                              )}
                              <div className="flex justify-between text-gray-500">
                                <span>Reward</span>
                                <span className="text-green-400">+{fmt(p.accReward)} XSEN</span>
                              </div>
                              {p.delegatedAgent && (
                                <div className="flex justify-between text-gray-500">
                                  <span>Delegated</span>
                                  <span className="text-purple-400">{p.delegatedAgent}</span>
                                </div>
                              )}
                              {unlockDate && (
                                <div className="flex justify-between text-gray-500">
                                  <span>{locked ? "Locked until" : "Unlocked"}</span>
                                  <span className={locked ? "text-yellow-400" : "text-green-400"}>{locked ? unlockDate : "Now"}</span>
                                </div>
                              )}
                            </div>

                            {/* Unstake button / cooldown state */}
                            {p.active && (
                              <div className="mt-auto pt-3">
                                {p.tierId === 0 ? (
                                  /* Flexible: instant unstake anytime, no cooldown */
                                  <button
                                    onClick={() => completeUnstake(p.id)}
                                    disabled={unstaking === p.id}
                                    className="w-full text-xs font-semibold bg-red-900/20 hover:bg-red-900/30 disabled:opacity-40 border border-red-700/40 text-red-300 py-2 rounded-lg transition-colors"
                                  >
                                    {unstaking === p.id ? "Unstaking..." : "Unstake"}
                                  </button>
                                ) : !locked ? (
                                  /* Lock period expired naturally → instant unstake, no cooldown */
                                  <button
                                    onClick={() => completeUnstake(p.id)}
                                    disabled={unstaking === p.id}
                                    className="w-full text-xs font-semibold bg-red-900/20 hover:bg-red-900/30 disabled:opacity-40 border border-red-700/40 text-red-300 py-2 rounded-lg transition-colors"
                                  >
                                    {unstaking === p.id ? "Unstaking..." : "Unstake"}
                                  </button>
                                ) : inCooldown ? (
                                  /* Early exit cooldown in progress */
                                  <div className="text-center border border-yellow-700/40 bg-yellow-900/10 rounded-lg py-2">
                                    <div className="text-xs text-yellow-400 font-semibold">Early Exit Cooldown: {fmtCountdown(remaining)}</div>
                                    <div className="text-[10px] text-gray-600 mt-0.5">Unstake available in 7 days</div>
                                  </div>
                                ) : cooldownDone ? (
                                  /* Cooldown finished → complete unstake */
                                  <button
                                    onClick={() => completeUnstake(p.id)}
                                    disabled={unstaking === p.id}
                                    className="w-full text-xs font-semibold bg-red-900/20 hover:bg-red-900/30 disabled:opacity-40 border border-red-700/40 text-red-300 py-2 rounded-lg transition-colors"
                                  >
                                    {unstaking === p.id ? "Unstaking..." : "Complete Early Exit"}
                                  </button>
                                ) : (
                                  /* Still locked, no cooldown started → offer early exit */
                                  <button
                                    onClick={() => {
                                      if (wallet) {
                                        startCooldown(wallet, p.id);
                                        setTick(t => t + 1);
                                        setTxStatus("Early exit requested — 7-day cooldown started");
                                      }
                                    }}
                                    className="w-full text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 py-2 rounded-lg transition-colors"
                                  >
                                    Early Exit (7-day cooldown)
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="border border-dashed border-gray-800 rounded-xl p-10 text-center text-gray-600 text-sm">
                    No positions yet.{" "}
                    <button onClick={() => setActiveTab("staking")} className="text-purple-400 hover:text-purple-300 underline">
                      Stake XSEN
                    </button>{" "}
                    to get started.
                  </div>
                )}

                {/* Delegation */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Delegate Voting Power</h2>
                    {effectiveVP > 0 && <span className="text-sm text-purple-400 font-semibold">{fmt(effectiveVP)} VP</span>}
                  </div>
                  {positions.filter(p => p.active).length === 0 ? (
                    <p className="text-xs text-gray-700">Stake first to enable delegation.</p>
                  ) : (
                    <div className="space-y-2">
                      {GENESIS_AGENTS.map((agent) => {
                        const lb = leaderboard.find(l => l.agent_name === agent.name);
                        const isActive = currentDelegate === agent.name;
                        return (
                          <div key={agent.name} className={`border rounded-xl p-3.5 flex items-center justify-between transition-all ${isActive ? "border-purple-500/50 bg-purple-950/20" : "border-gray-800/60 bg-gray-900/20 hover:border-gray-700"}`}>
                            <div className="flex items-center gap-3">
                              <div className="w-1 h-8 rounded-full" style={{ backgroundColor: agent.accent }} />
                              <div>
                                <div className="font-semibold text-white text-sm">{agent.name}</div>
                                <div className="text-xs text-gray-600">{agent.role}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {lb && <div className="text-xs text-gray-600 font-mono">{fmt(lb.total_delegated_vp_xsen)} VP</div>}
                              {isActive ? (
                                <span className="text-xs bg-purple-600/20 border border-purple-500/30 text-purple-300 px-3 py-1.5 rounded-lg">Delegated</span>
                              ) : (
                                <button
                                  onClick={() => delegateTo(agent.name)}
                                  disabled={!!delegating}
                                  className="text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg transition-colors"
                                >
                                  {delegating === agent.name ? "..." : "Delegate"}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Leaderboard */}
                <div>
                  <h2 className="text-sm font-semibold text-gray-400 mb-3 tracking-wider uppercase">Agent Leaderboard</h2>
                  <div className="border border-gray-800/60 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-800 text-xs text-gray-600 text-left bg-gray-900/30">
                          <th className="px-4 py-3 w-16">Rank</th>
                          <th className="px-4 py-3">Agent</th>
                          <th className="px-4 py-3 text-right">Delegated VP</th>
                          <th className="px-4 py-3 text-right">Delegators</th>
                          <th className="px-4 py-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.map((a: any) => (
                          <tr key={a.agent_name} className="border-b border-gray-800/30 hover:bg-gray-800/20 transition-colors">
                            <td className="px-4 py-3 text-xs font-bold text-gray-500">{a.rank_label}</td>
                            <td className="px-4 py-3">
                              <span className="font-semibold text-white">{a.agent_name}</span>
                              {a.is_genesis && <span className="ml-2 text-[10px] text-purple-400 bg-purple-900/20 rounded-full px-1.5 py-0.5">Genesis</span>}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-purple-300">{fmt(a.total_delegated_vp_xsen)}</td>
                            <td className="px-4 py-3 text-right text-gray-400">{a.delegator_count}</td>
                            <td className="px-4 py-3 text-right">
                              {a.voted_this_epoch
                                ? <span className="text-xs text-green-400 bg-green-900/20 rounded-full px-2 py-0.5">Active</span>
                                : <span className="text-xs text-gray-700">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Wallet Portfolio */}
                <div className="border border-gray-800/60 rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-800/40 flex items-center justify-between">
                    <h2 className="font-semibold text-white text-sm">X Layer Portfolio</h2>
                    <span className="text-[10px] text-purple-400 bg-purple-900/20 border border-purple-800/30 rounded-full px-2 py-0.5">OKX Wallet API</span>
                  </div>
                  <div className="p-5">
                    {portLoading ? (
                      <div className="text-xs text-gray-600 text-center py-4">Fetching portfolio...</div>
                    ) : portfolio ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs text-gray-500">Total Value on X Layer</div>
                            <div className="text-2xl font-black text-white">${Number(portfolio.total_usd_value || 0).toFixed(2)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-gray-500">Estimated VP</div>
                            <div className="text-xl font-black text-purple-300">{Number(portfolio.total_usd_value || 0).toFixed(0)}</div>
                          </div>
                        </div>
                        {portfolio.tokens?.length > 0 && (
                          <div className="space-y-1.5 pt-2 border-t border-gray-800/60">
                            {portfolio.tokens.slice(0, 5).map((t: any, i: number) => (
                              <div key={i} className="flex justify-between text-xs">
                                <span className="text-gray-400">{t.symbol || "—"}</span>
                                <span className="text-gray-300 font-mono">${Number(t.usd_value || 0).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="text-[10px] text-gray-700 pt-1">Powered by OKX OnchainOS Wallet API · X Layer</div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-4">
                        <div className="text-xs text-gray-600">View any wallet&apos;s X Layer holdings and voting power estimate</div>
                        <button
                          onClick={async () => {
                            if (!wallet) return;
                            setPortLoading(true);
                            try {
                              const res = await fetch(`/api/onchain/wallet/${wallet}/portfolio`);
                              const data = await res.json();
                              setPortfolio(data);
                            } catch {}
                            setPortLoading(false);
                          }}
                          className="shrink-0 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-4 py-2 rounded-lg transition-colors"
                        >
                          Load Portfolio
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Transaction History */}
                <div>
                  <h2 className="text-sm font-semibold text-gray-400 mb-3 tracking-wider uppercase">Transaction History</h2>
                  {histLoading ? (
                    <div className="text-xs text-gray-600 py-4 text-center">Loading history...</div>
                  ) : history.length === 0 ? (
                    <div className="border border-dashed border-gray-800 rounded-xl p-6 text-center text-xs text-gray-700">
                      No staking transactions found on X Layer.
                    </div>
                  ) : (
                    <div className="border border-gray-800/60 rounded-xl overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-800 text-xs text-gray-600 text-left bg-gray-900/30">
                            <th className="px-4 py-3">Action</th>
                            <th className="px-4 py-3 hidden md:table-cell">Date & Time</th>
                            <th className="px-4 py-3 text-right">Amount</th>
                            <th className="px-4 py-3 text-right">TX</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map((tx: any, i: number) => {
                            const dt = new Date(tx.time);
                            return (
                              <tr key={i} className="border-b border-gray-800/30 hover:bg-gray-800/20 transition-colors">
                                <td className="px-4 py-3">
                                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${CATEGORY_COLOR[tx.category] ?? "text-gray-400 bg-gray-800"}`}>
                                    {tx.label}
                                  </span>
                                </td>
                                <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500">
                                  {dt.toLocaleDateString()} {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </td>
                                <td className="px-4 py-3 text-right text-xs font-mono text-gray-400">
                                  {tx.amount ? `${Number(tx.amount).toFixed(4)} ${tx.symbol ?? ""}` : "—"}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <a
                                    href={tx.explorerUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-purple-400 hover:text-purple-300 font-mono"
                                  >
                                    {tx.txHash?.slice(0, 8)}...
                                  </a>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
