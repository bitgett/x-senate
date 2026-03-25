"use client";
import { useEffect, useState, useCallback } from "react";
import { ethers } from "ethers";

const STAKING_ADDRESS = process.env.NEXT_PUBLIC_XSEN_STAKING_ADDRESS ?? "0x9CD9eF69c4EE176c8115E4BCf6c604Eb46599502";
const TOKEN_ADDRESS   = process.env.NEXT_PUBLIC_XSEN_TOKEN_ADDRESS   ?? "0x1bAB744c4c98D844984e297744Cb6b4E24e2E89b";

const STAKING_ABI = [
  "function getEffectiveVP(address user) view returns (uint256)",
  "function getPositions(address user) view returns (tuple(uint256 id, uint256 amount, uint8 tier, uint256 lockEnd, string delegatedAgent, bool active, uint256 accReward)[])",
  "function delegatePosition(uint256 positionId, string agentName) external",
  "function stake(uint256 amount, uint8 tier) external",
  "function claimAllRewards() external",
];

const TOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
];

const TIER_INFO = [
  { id: 0, name: "Flexible", days: 0,   apy: 5,  mult: 1.0, color: "border-gray-700 bg-gray-900/50",     badge: "bg-gray-700 text-gray-300" },
  { id: 1, name: "Lock30",   days: 30,  apy: 10, mult: 1.1, color: "border-blue-700/50 bg-blue-950/30",  badge: "bg-blue-800 text-blue-200" },
  { id: 2, name: "Lock90",   days: 90,  apy: 20, mult: 1.3, color: "border-purple-700/50 bg-purple-950/30", badge: "bg-purple-800 text-purple-200" },
  { id: 3, name: "Lock180",  days: 180, apy: 35, mult: 1.5, color: "border-yellow-600/50 bg-yellow-950/30", badge: "bg-yellow-700 text-yellow-200" },
];

const GENESIS_AGENTS = [
  { name: "Guardian",  role: "Security & Risk",       accent: "#3b82f6" },
  { name: "Merchant",  role: "Economics & ROI",       accent: "#eab308" },
  { name: "Architect", role: "Technical Feasibility", accent: "#22c55e" },
  { name: "Diplomat",  role: "Community & Consensus", accent: "#a855f7" },
  { name: "Populist",  role: "User Voice & Fairness", accent: "#ef4444" },
];

function fmt(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000)     return `${(val / 1_000).toFixed(1)}K`;
  return val.toFixed(2);
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function StakePage() {
  const [wallet, setWallet]       = useState<string | null>(null);
  const [walletType, setWalletType] = useState<"metamask" | "okx" | null>(null);
  const [xsenBal, setXsenBal]     = useState<number>(0);
  const [effectiveVP, setVP]      = useState<number>(0);
  const [positions, setPositions] = useState<any[]>([]);
  const [leaderboard, setLb]      = useState<any[]>([]);
  const [tiers, setTiers]         = useState<any>(null);
  const [totals, setTotals]       = useState<any>(null);
  const [delegating, setDelegating] = useState<string | null>(null);
  const [txStatus, setTxStatus]   = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);

  function getProvider() {
    if (walletType === "okx") return (window as any).okxwallet;
    return (window as any).ethereum;
  }

  // Load static data
  useEffect(() => {
    Promise.all([
      fetch("/api/staking/tiers").then(r => r.ok ? r.json() : null),
      fetch("/api/staking/totals").then(r => r.ok ? r.json() : null),
      fetch("/api/staking/leaderboard?limit=5").then(r => r.ok ? r.json() : null),
    ]).then(([t, tot, lb]) => {
      setTiers(t);
      setTotals(tot);
      setLb(lb?.leaderboard ?? []);
    });
  }, []);

  const loadWalletData = useCallback(async (address: string, type?: "metamask" | "okx") => {
    try {
      const raw = type === "okx" ? (window as any).okxwallet : (window as any).ethereum;
      const provider = new ethers.BrowserProvider(raw);
      const token   = new ethers.Contract(TOKEN_ADDRESS,   TOKEN_ABI,   provider);
      const staking = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI, provider);

      const [bal, vp] = await Promise.all([
        token.balanceOf(address),
        staking.getEffectiveVP(address).catch(() => 0n),
      ]);
      setXsenBal(Number(ethers.formatEther(bal)));
      setVP(Number(ethers.formatEther(vp)));

      try {
        const pos = await staking.getPositions(address);
        setPositions(pos.map((p: any) => ({
          id: Number(p.id),
          amount: Number(ethers.formatEther(p.amount)),
          tier: TIER_INFO[Number(p.tier)]?.name ?? "Unknown",
          tierId: Number(p.tier),
          lockEnd: Number(p.lockEnd),
          delegatedAgent: p.delegatedAgent,
          active: p.active,
          accReward: Number(ethers.formatEther(p.accReward)),
        })));
      } catch { setPositions([]); }
    } catch (e) { console.error(e); }
  }, []);

  async function connectWallet(type: "metamask" | "okx") {
    setShowWalletModal(false);
    const raw = type === "okx" ? (window as any).okxwallet : (window as any).ethereum;
    if (!raw) {
      alert(type === "okx" ? "OKX Wallet not detected. Please install OKX Wallet." : "MetaMask not detected. Please install MetaMask.");
      return;
    }
    setConnecting(true);
    const XLAYER = {
      chainId: "0xc4",
      chainName: "X Layer Mainnet",
      nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
      rpcUrls: ["https://rpc.xlayer.tech"],
      blockExplorerUrls: ["https://www.okx.com/web3/explorer/xlayer"],
    };
    try {
      try {
        await raw.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xc4" }] });
      } catch {
        await raw.request({ method: "wallet_addEthereumChain", params: [XLAYER] });
      }
      const accounts = await raw.request({ method: "eth_requestAccounts" });
      setWallet(accounts[0]);
      setWalletType(type);
      await loadWalletData(accounts[0], type);
    } catch (e: any) { console.error(e); }
    setConnecting(false);
  }

  async function delegateTo(agentName: string) {
    if (!wallet || positions.length === 0) return;
    const activePos = positions.find(p => p.active);
    if (!activePos) { setTxStatus("No active positions to delegate."); return; }

    setDelegating(agentName);
    setTxStatus(null);
    try {
      const provider = new ethers.BrowserProvider(getProvider());
      const signer = await provider.getSigner();
      const staking = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI, signer);
      const tx = await staking.delegatePosition(activePos.id, agentName);
      setTxStatus(`Delegating... TX: ${tx.hash.slice(0, 10)}...`);
      await tx.wait();
      setTxStatus(`Delegated to ${agentName}`);
      await loadWalletData(wallet);
    } catch (e: any) {
      setTxStatus(`Error: ${e.message?.slice(0, 80)}`);
    }
    setDelegating(null);
  }

  const currentDelegate = positions.find(p => p.active && p.delegatedAgent)?.delegatedAgent;
  const totalStaked = totals?.total_staked_xsen ?? 0;
  const totalVP = totals?.total_effective_vp_xsen ?? 0;
  const myVPPct = totalVP > 0 && effectiveVP > 0 ? ((effectiveVP / totalVP) * 100).toFixed(2) : "0.00";
  const totalAccReward = positions.reduce((s, p) => s + p.accReward, 0);

  return (
    <div className="-mx-6 -mt-6">

      {/* ── Hero Dashboard ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden px-6 pt-16 pb-10 text-center border-b border-gray-800/40"
        style={{ background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(139,92,246,0.12) 0%, transparent 70%)" }}
      >
        <h1 className="text-5xl font-black text-white mb-3 tracking-tight">
          X-Senate <span className="text-purple-400">Stake</span>
        </h1>
        <p className="text-gray-500 max-w-lg mx-auto mb-8">
          Stake and lock XSEN to receive Voting Power. Delegate to AI agents and participate in X-Senate governance.
        </p>

        {/* Action bar */}
        <div className="flex items-center justify-center gap-3">
          {wallet ? (
            <>
              <button
                onClick={async () => {
                  if (!wallet) return;
                  try {
                    const provider = new ethers.BrowserProvider(getProvider());
                    const signer = await provider.getSigner();
                    const staking = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI, signer);
                    const tx = await staking.claimAllRewards();
                    setTxStatus("Claiming rewards...");
                    await tx.wait();
                    setTxStatus("Rewards claimed!");
                    await loadWalletData(wallet, walletType ?? undefined);
                  } catch (e: any) { setTxStatus(`Error: ${e.message?.slice(0,60)}`); }
                }}
                className="flex items-center gap-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 font-semibold px-5 py-2.5 rounded-full text-sm transition-all"
              >
                Claim Rewards · {fmt(totalAccReward)} XSEN
              </button>
              <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-full px-4 py-2.5 text-sm">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="font-mono text-gray-300">{shortAddr(wallet)}</span>
                <span className="text-gray-600">·</span>
                <span className="text-white font-semibold">{fmt(xsenBal)} XSEN</span>
              </div>
            </>
          ) : (
            <button
              onClick={() => setShowWalletModal(true)}
              disabled={connecting}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold px-8 py-3 rounded-full transition-all hover:scale-105 text-sm"
              style={{ boxShadow: "0 0 30px rgba(139,92,246,0.35)" }}
            >
              {connecting ? "Connecting..." : "Connect Wallet"}
            </button>
          )}
        </div>

        {txStatus && (
          <div className={`mt-4 inline-block rounded-full px-4 py-1.5 text-xs border ${txStatus.startsWith("Error") ? "bg-red-900/20 border-red-700/40 text-red-300" : "bg-green-900/20 border-green-700/40 text-green-300"}`}>
            {txStatus}
          </div>
        )}
      </div>

      {/* ── Big Stats ──────────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-px bg-gray-800/40">
        {/* Global */}
        <div className="bg-[#0a0a0f] px-8 py-8">
          <div className="text-xs font-mono text-gray-600 tracking-widest uppercase mb-5">Protocol</div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-3xl font-black text-white">{fmt(totalStaked)}</div>
              <div className="text-sm text-gray-500 mt-1">Total XSEN Staked</div>
            </div>
            <div>
              <div className="text-3xl font-black text-purple-300">{fmt(totalVP)}</div>
              <div className="text-sm text-gray-500 mt-1">Total Voting Power</div>
            </div>
            <div>
              <div className="text-3xl font-black text-blue-300">{leaderboard.length}</div>
              <div className="text-sm text-gray-500 mt-1">Active Agents</div>
            </div>
            <div>
              <div className="text-3xl font-black text-green-300">35%</div>
              <div className="text-sm text-gray-500 mt-1">Max APY</div>
            </div>
          </div>
        </div>

        {/* Personal */}
        <div className="bg-[#0a0a0f] px-8 py-8">
          <div className="text-xs font-mono text-gray-600 tracking-widest uppercase mb-5">My Position</div>
          {wallet ? (
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-3xl font-black text-white">{myVPPct}%</div>
                <div className="text-sm text-gray-500 mt-1">My Voting Power</div>
              </div>
              <div>
                <div className="text-3xl font-black text-purple-300">{fmt(effectiveVP)}</div>
                <div className="text-sm text-gray-500 mt-1">Effective VP</div>
              </div>
              <div>
                <div className="text-3xl font-black text-white">{fmt(positions.filter(p=>p.active).reduce((s,p)=>s+p.amount,0))}</div>
                <div className="text-sm text-gray-500 mt-1">XSEN Staked</div>
              </div>
              <div>
                <div className="text-3xl font-black text-yellow-300">{currentDelegate || "—"}</div>
                <div className="text-sm text-gray-500 mt-1">Delegated To</div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-gray-600 text-sm">
              Connect wallet to view your position
            </div>
          )}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">

        {/* Tiers + Delegate */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Staking Tiers */}
          <div>
            <h2 className="text-base font-semibold text-white mb-4 tracking-tight">Staking Tiers</h2>
            <div className="space-y-2">
              {TIER_INFO.map((t) => (
                <div key={t.id} className={`border rounded-xl p-4 ${t.color}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.badge}`}>{t.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-white font-bold text-sm">{t.apy}% APY</span>
                      {t.days > 0 && <span className="text-gray-500 text-xs">{t.days}d lock</span>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-500">VP Multiplier</span>
                    <span className="font-bold text-purple-300">{t.mult}x</span>
                  </div>
                  <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-purple-600 to-blue-400" style={{ width: `${((t.mult - 1) / 0.5) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Delegate */}
          <div>
            <h2 className="text-base font-semibold text-white mb-4 tracking-tight">
              Delegate Voting Power
              {wallet && <span className="ml-2 text-sm font-normal text-purple-400">{fmt(effectiveVP)} VP</span>}
            </h2>
            {!wallet ? (
              <div className="border border-gray-800/60 rounded-xl p-8 text-center">
                <div className="text-gray-600 text-sm mb-3">Connect wallet to delegate</div>
                <button onClick={() => setShowWalletModal(true)} className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                  Connect Wallet
                </button>
              </div>
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
                        {lb && <div className="text-right text-xs text-gray-600">{fmt(lb.total_delegated_vp_xsen)} VP</div>}
                        {isActive ? (
                          <span className="text-xs bg-purple-600/20 border border-purple-500/30 text-purple-300 px-3 py-1.5 rounded-lg">Delegated</span>
                        ) : (
                          <button onClick={() => delegateTo(agent.name)} disabled={!!delegating || positions.filter(p=>p.active).length===0} className="text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg transition-colors">
                            {delegating === agent.name ? "..." : "Delegate"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {positions.filter(p=>p.active).length===0 && <p className="text-xs text-gray-700 mt-2">Stake XSEN first to enable delegation.</p>}
              </div>
            )}
          </div>
        </div>

        {/* My Positions */}
        {wallet && positions.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-white mb-4">My Positions</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {positions.map(p => (
                <div key={p.id} className={`border rounded-xl p-4 ${p.active ? "border-gray-700 bg-gray-900/40" : "border-gray-800 opacity-50"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-600">Position #{p.id}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${TIER_INFO[p.tierId]?.badge ?? "bg-gray-700 text-gray-300"}`}>{p.tier}</span>
                  </div>
                  <div className="text-2xl font-black text-white">{fmt(p.amount)} <span className="text-sm font-normal text-gray-500">XSEN</span></div>
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                    <span>Reward: <span className="text-green-400">+{fmt(p.accReward)}</span></span>
                    <span className="text-purple-400">{p.delegatedAgent || "—"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <div>
          <h2 className="text-base font-semibold text-white mb-4">Agent Leaderboard</h2>
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
                      {a.is_genesis && <span className="ml-2 text-xs text-purple-400 bg-purple-900/20 rounded-full px-1.5 py-0.5">Genesis</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-purple-300">{fmt(a.total_delegated_vp_xsen)}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{a.delegator_count}</td>
                    <td className="px-4 py-3 text-right">
                      {a.voted_this_epoch ? <span className="text-xs text-green-400 bg-green-900/20 rounded-full px-2 py-0.5">Active</span> : <span className="text-xs text-gray-700">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>

      {/* Wallet selection modal */}
      {showWalletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowWalletModal(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-80 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-6">
              <h3 className="text-lg font-bold text-white">Connect Wallet</h3>
              <p className="text-xs text-gray-500 mt-1">Choose your wallet to connect to X Layer</p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => connectWallet("metamask")}
                className="w-full flex items-center gap-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-orange-500/50 rounded-xl px-4 py-3.5 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-xl">
                  🦊
                </div>
                <div className="text-left">
                  <div className="font-semibold text-white text-sm">MetaMask</div>
                  <div className="text-xs text-gray-500">Most popular browser wallet</div>
                </div>
              </button>
              <button
                onClick={() => connectWallet("okx")}
                className="w-full flex items-center gap-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-blue-500/50 rounded-xl px-4 py-3.5 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center font-black text-white text-sm">
                  OKX
                </div>
                <div className="text-left">
                  <div className="font-semibold text-white text-sm">OKX Wallet</div>
                  <div className="text-xs text-gray-500">Native X Layer wallet</div>
                </div>
              </button>
            </div>
            <button onClick={() => setShowWalletModal(false)} className="w-full mt-4 text-xs text-gray-600 hover:text-gray-400 transition-colors py-2">
              Cancel
            </button>
          </div>
        </div>
      )}
  );
}
