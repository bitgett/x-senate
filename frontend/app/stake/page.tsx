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
  const [xsenBal, setXsenBal]     = useState<number>(0);
  const [effectiveVP, setVP]      = useState<number>(0);
  const [positions, setPositions] = useState<any[]>([]);
  const [leaderboard, setLb]      = useState<any[]>([]);
  const [tiers, setTiers]         = useState<any>(null);
  const [totals, setTotals]       = useState<any>(null);
  const [delegating, setDelegating] = useState<string | null>(null);
  const [txStatus, setTxStatus]   = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

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

  const loadWalletData = useCallback(async (address: string) => {
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
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

  async function connectWallet() {
    if (!(window as any).ethereum) {
      alert("MetaMask not detected. Please install MetaMask.");
      return;
    }
    setConnecting(true);
    try {
      // Switch to X Layer
      try {
        await (window as any).ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0xc4" }], // 196
        });
      } catch {
        await (window as any).ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{ chainId: "0xc4", chainName: "X Layer Mainnet", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: ["https://rpc.xlayer.tech"], blockExplorerUrls: ["https://www.okx.com/web3/explorer/xlayer"] }],
        });
      }
      const accounts = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
      setWallet(accounts[0]);
      await loadWalletData(accounts[0]);
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
      const provider = new ethers.BrowserProvider((window as any).ethereum);
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

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Staking</h1>
          <p className="text-gray-500 mt-1 text-sm">Stake XSEN · Earn rewards · Delegate VP to AI agents</p>
        </div>

        {/* Wallet connect */}
        {wallet ? (
          <div className="flex items-center gap-3 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <div>
              <div className="text-xs text-gray-500">Connected</div>
              <div className="text-sm font-mono text-white">{shortAddr(wallet)}</div>
            </div>
            <div className="w-px h-8 bg-gray-700" />
            <div className="text-right">
              <div className="text-xs text-gray-500">XSEN Balance</div>
              <div className="text-sm font-bold text-white">{fmt(xsenBal)}</div>
            </div>
            <div className="w-px h-8 bg-gray-700" />
            <div className="text-right">
              <div className="text-xs text-gray-500">Voting Power</div>
              <div className="text-sm font-bold text-purple-300">{fmt(effectiveVP)} VP</div>
            </div>
          </div>
        ) : (
          <button
            onClick={connectWallet}
            disabled={connecting}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl transition-all hover:scale-105"
            style={{ boxShadow: "0 0 20px rgba(139,92,246,0.3)" }}
          >
            {connecting ? (
              <span className="animate-spin text-lg">◌</span>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2"/></svg>
            )}
            {connecting ? "Connecting..." : "Connect Wallet"}
          </button>
        )}
      </div>

      {/* TX status */}
      {txStatus && (
        <div className={`rounded-xl px-4 py-3 text-sm border ${txStatus.startsWith("Error") ? "bg-red-900/20 border-red-700/40 text-red-300" : "bg-green-900/20 border-green-700/40 text-green-300"}`}>
          {txStatus}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900/50 border border-gray-800/60 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Total Staked</div>
          <div className="text-2xl font-bold text-white">{totals?.total_staked_xsen != null ? fmt(totals.total_staked_xsen) : "—"}</div>
          <div className="text-xs text-gray-600">XSEN</div>
        </div>
        <div className="bg-gray-900/50 border border-gray-800/60 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Total Effective VP</div>
          <div className="text-2xl font-bold text-purple-300">{totals?.total_effective_vp_xsen != null ? fmt(totals.total_effective_vp_xsen) : "—"}</div>
          <div className="text-xs text-gray-600">votes</div>
        </div>
        <div className="bg-gray-900/50 border border-gray-800/60 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Your Delegation</div>
          <div className="text-2xl font-bold text-white">{currentDelegate || (wallet ? "None" : "—")}</div>
          <div className="text-xs text-gray-600">{wallet ? "current agent" : "connect wallet"}</div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid md:grid-cols-2 gap-6">

        {/* Left: Staking Tiers */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Staking Tiers</h2>
          <div className="space-y-3">
            {TIER_INFO.map((t) => (
              <div key={t.id} className={`border rounded-xl p-4 ${t.color}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.badge}`}>{t.name}</span>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-white font-bold">{t.apy}% APY</span>
                    {t.days > 0 && <span className="text-gray-500 text-xs">{t.days}d lock</span>}
                  </div>
                </div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-gray-500">VP Multiplier</span>
                  <span className="font-bold text-purple-300">{t.mult}x</span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-purple-600 to-blue-400"
                    style={{ width: `${((t.mult - 1) / 0.5) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-700 mt-0.5">
                  <span>1.0x base</span><span>1.5x max</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Delegate to Agent */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">
            Delegate Voting Power
            {wallet && <span className="ml-2 text-sm font-normal text-purple-300">{fmt(effectiveVP)} VP available</span>}
          </h2>

          {!wallet && (
            <div className="bg-gray-900/50 border border-gray-800/60 rounded-xl p-6 text-center">
              <div className="text-gray-500 text-sm mb-3">Connect your wallet to delegate VP</div>
              <button onClick={connectWallet} className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                Connect Wallet
              </button>
            </div>
          )}

          {wallet && (
            <div className="space-y-3">
              {GENESIS_AGENTS.map((agent) => {
                const lb = leaderboard.find(l => l.agent_name === agent.name);
                const isCurrentDelegate = currentDelegate === agent.name;
                return (
                  <div
                    key={agent.name}
                    className={`border rounded-xl p-4 transition-all ${
                      isCurrentDelegate
                        ? "border-purple-500/50 bg-purple-950/20"
                        : "border-gray-800/60 bg-gray-900/30 hover:border-gray-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {/* Color dot */}
                        <div className="w-2 h-8 rounded-full" style={{ backgroundColor: agent.accent }} />
                        <div>
                          <div className="font-semibold text-white text-sm">{agent.name}</div>
                          <div className="text-xs text-gray-500">{agent.role}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {lb && (
                          <div className="text-right text-xs">
                            <div className="text-gray-500">{fmt(lb.total_delegated_vp_xsen)} VP</div>
                            <div className="text-gray-600">{lb.delegator_count} delegators</div>
                          </div>
                        )}
                        {isCurrentDelegate ? (
                          <span className="text-xs bg-purple-600/30 border border-purple-500/40 text-purple-300 px-3 py-1.5 rounded-lg font-medium">
                            Delegated
                          </span>
                        ) : (
                          <button
                            onClick={() => delegateTo(agent.name)}
                            disabled={!!delegating || positions.filter(p => p.active).length === 0}
                            className="text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
                          >
                            {delegating === agent.name ? "..." : "Delegate"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {positions.filter(p => p.active).length === 0 && (
                <p className="text-xs text-gray-600 mt-2">Stake XSEN first to delegate voting power.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* My Positions */}
      {wallet && positions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">My Positions</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {positions.map(p => (
              <div key={p.id} className={`border rounded-xl p-4 ${p.active ? "border-gray-700 bg-gray-900/50" : "border-gray-800 opacity-50"}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">Position #{p.id}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${TIER_INFO[p.tierId]?.badge ?? "bg-gray-700 text-gray-300"}`}>{p.tier}</span>
                </div>
                <div className="text-xl font-bold text-white">{fmt(p.amount)} XSEN</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-500">
                  <div>Reward: <span className="text-green-300">+{fmt(p.accReward)}</span></div>
                  <div>Delegate: <span className="text-purple-300">{p.delegatedAgent || "—"}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agent Leaderboard */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Agent Leaderboard</h2>
        <div className="bg-gray-900/50 border border-gray-800/60 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500 text-left">
                <th className="px-4 py-3 w-16">Rank</th>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3 text-right">Delegated VP</th>
                <th className="px-4 py-3 text-right">Delegators</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((a: any) => (
                <tr key={a.agent_name} className="border-b border-gray-800/40 hover:bg-gray-800/20 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-xs font-bold text-gray-400">{a.rank_label}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-white">{a.agent_name}</span>
                    {a.is_genesis && <span className="ml-2 text-xs text-purple-400 bg-purple-900/30 rounded-full px-1.5 py-0.5">Genesis</span>}
                    {a.voted_this_epoch && <span className="ml-1 text-xs text-green-400 bg-green-900/30 rounded-full px-1.5 py-0.5">Active</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-purple-300">{fmt(a.total_delegated_vp_xsen)}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{a.delegator_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
