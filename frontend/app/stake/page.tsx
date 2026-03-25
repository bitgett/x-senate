"use client";
import { useEffect, useState } from "react";

const BASE = "";

const TIER_COLORS: Record<string, string> = {
  Flexible: "border-gray-600 bg-gray-900",
  Lock30:   "border-blue-700 bg-blue-950",
  Lock90:   "border-purple-700 bg-purple-950",
  Lock180:  "border-yellow-600 bg-yellow-950",
};

const TIER_BADGE: Record<string, string> = {
  Flexible: "bg-gray-700 text-gray-300",
  Lock30:   "bg-blue-800 text-blue-200",
  Lock90:   "bg-purple-800 text-purple-200",
  Lock180:  "bg-yellow-700 text-yellow-200",
};

const RANK_BADGE: Record<number, string> = {
  1: "bg-yellow-500/20 text-yellow-300 border border-yellow-600/40",
  2: "bg-gray-500/20 text-gray-300 border border-gray-500/40",
  3: "bg-amber-700/20 text-amber-400 border border-amber-700/40",
  4: "bg-gray-800 text-gray-400",
  5: "bg-gray-800 text-gray-400",
};

function formatXSEN(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000)     return `${(val / 1_000).toFixed(1)}K`;
  return val.toFixed(2);
}

function timeUntil(ts: number): string {
  const now = Math.floor(Date.now() / 1000);
  if (ts <= now) return "Unlocked";
  const diff = ts - now;
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  return `${h}h`;
}

export default function StakePage() {
  const [tiers, setTiers]         = useState<any>(null);
  const [epoch, setEpoch]         = useState<any>(null);
  const [totals, setTotals]       = useState<any>(null);
  const [leaderboard, setLb]      = useState<any[]>([]);
  const [walletAddr, setWallet]   = useState("");
  const [positions, setPositions] = useState<any[]>([]);
  const [effectiveVP, setVP]      = useState<any>(null);
  const [loadingPos, setLoadingPos] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${BASE}/api/staking/tiers`).then(r => r.ok ? r.json() : null),
      fetch(`${BASE}/api/staking/epoch`).then(r => r.ok ? r.json() : null),
      fetch(`${BASE}/api/staking/totals`).then(r => r.ok ? r.json() : null),
      fetch(`${BASE}/api/staking/leaderboard?limit=20`).then(r => r.ok ? r.json() : null),
    ]).then(([t, e, tot, lb]) => {
      setTiers(t);
      setEpoch(e);
      setTotals(tot);
      setLb(lb?.leaderboard ?? []);
    });
  }, []);

  async function lookupPositions() {
    const addr = walletAddr.trim();
    if (!addr || addr.length !== 42) return;
    setLoadingPos(true);
    try {
      const [posRes, vpRes] = await Promise.all([
        fetch(`${BASE}/api/staking/positions/${addr}`).then(r => r.ok ? r.json() : null),
        fetch(`${BASE}/api/staking/vp/${addr}`).then(r => r.ok ? r.json() : null),
      ]);
      setPositions(posRes?.positions ?? []);
      setVP(vpRes);
    } catch {}
    setLoadingPos(false);
  }

  const epochEndMs  = epoch?.end_time ? epoch.end_time * 1000 : null;
  const epochPct    = epoch
    ? Math.min(100, ((Date.now() / 1000 - epoch.start_time) / (epoch.end_time - epoch.start_time)) * 100)
    : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-10">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">X-Senate Staking</h1>
        <p className="text-gray-400 mt-1">
          Stake XSEN to earn rewards and govern the X-Senate DAO.
          Lock longer for higher APY and VP multiplier.
        </p>
      </div>

      {/* Protocol stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Total Staked</div>
          <div className="text-xl font-bold text-white">
            {totals?.total_staked_xsen != null ? formatXSEN(totals.total_staked_xsen) : "—"}
          </div>
          <div className="text-xs text-gray-500">XSEN</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Total Eff. VP</div>
          <div className="text-xl font-bold text-purple-300">
            {totals?.total_effective_vp_xsen != null ? formatXSEN(totals.total_effective_vp_xsen) : "—"}
          </div>
          <div className="text-xs text-gray-500">votes</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Epoch Reward Pool</div>
          <div className="text-xl font-bold text-green-300">
            {epoch?.reward_pool_xsen != null ? formatXSEN(epoch.reward_pool_xsen) : "—"}
          </div>
          <div className="text-xs text-gray-500">XSEN</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Current Epoch</div>
          <div className="text-xl font-bold text-blue-300">
            #{epoch?.epoch_id ?? "—"}
          </div>
          {epoch && (
            <div className="text-xs text-gray-500">
              {timeUntil(epoch.end_time)} left
            </div>
          )}
        </div>
      </div>

      {/* Epoch progress bar */}
      {epoch && (
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Epoch #{epoch.epoch_id} progress</span>
            <span>{epochPct.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-600 to-blue-500 rounded-full transition-all"
              style={{ width: `${epochPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Tier cards */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Staking Tiers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {tiers?.tiers?.map((t: any) => (
            <div
              key={t.id}
              className={`border rounded-xl p-5 flex flex-col gap-3 ${TIER_COLORS[t.name] ?? "border-gray-700 bg-gray-900"}`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TIER_BADGE[t.name]}`}>
                  {t.name}
                </span>
                {t.pop_auto && (
                  <span className="text-xs text-green-400 bg-green-900/40 border border-green-700/40 rounded-full px-2 py-0.5">
                    Auto-PoP
                  </span>
                )}
              </div>
              <div>
                <div className="text-3xl font-bold text-white">{t.apy_pct}%</div>
                <div className="text-xs text-gray-400">Base APY</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-gray-500">VP Multiplier</div>
                  <div className="font-semibold text-purple-300">{t.vp_mult}x</div>
                </div>
                <div>
                  <div className="text-gray-500">Lock Period</div>
                  <div className="font-semibold text-white">
                    {t.lock_days === 0 ? "None" : `${t.lock_days}d`}
                  </div>
                </div>
              </div>
              <div className="text-xs text-gray-500 border-t border-gray-700/50 pt-2">
                {t.lock_days === 0
                  ? "Must vote or delegate to earn rewards."
                  : `Early exit: ${t.early_exit}.`}
              </div>
            </div>
          ))}
        </div>
        {tiers && (
          <p className="text-xs text-gray-500 mt-3">
            Min stake: {tiers.min_stake_xsen} {tiers.token_symbol} · {tiers.pop_description}
          </p>
        )}
      </div>

      {/* Wallet lookup */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4">My Stake Positions</h2>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="0x... wallet address"
            value={walletAddr}
            onChange={e => setWallet(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={lookupPositions}
            disabled={loadingPos}
            className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-5 py-2 rounded-lg disabled:opacity-50 transition-colors"
          >
            {loadingPos ? "Loading..." : "Lookup"}
          </button>
        </div>

        {/* VP summary */}
        {effectiveVP && (
          <div className="mt-4 flex gap-6">
            <div>
              <div className="text-xs text-gray-500">Effective Voting Power</div>
              <div className="text-2xl font-bold text-purple-300">
                {formatXSEN(effectiveVP.effective_vp_xsen ?? 0)} VP
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Active Positions</div>
              <div className="text-2xl font-bold text-white">
                {positions.filter(p => p.active).length}
              </div>
            </div>
          </div>
        )}

        {/* Position list */}
        {positions.length > 0 && (
          <div className="mt-5 space-y-3">
            {positions.map(p => (
              <div
                key={p.id}
                className={`border rounded-lg p-4 ${p.active ? "border-gray-700 bg-gray-800/50" : "border-gray-800 bg-gray-900/50 opacity-50"}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-sm">
                        Position #{p.id}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_BADGE[p.tier] ?? "bg-gray-700 text-gray-300"}`}>
                        {p.tier}
                      </span>
                      {!p.active && (
                        <span className="text-xs text-gray-500 bg-gray-800 rounded-full px-2 py-0.5">Closed</span>
                      )}
                    </div>
                    <div className="text-2xl font-bold text-white mt-1">
                      {formatXSEN(p.amount_xsen)} XSEN
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Accrued Reward</div>
                    <div className="text-lg font-semibold text-green-300">
                      +{formatXSEN(p.acc_reward_xsen)} XSEN
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-3 text-xs">
                  <div>
                    <div className="text-gray-500">Lock Expires</div>
                    <div className="text-white font-medium">
                      {p.lock_end > 0 ? timeUntil(p.lock_end) : "No lock"}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Delegated To</div>
                    <div className="text-white font-medium">
                      {p.delegated_agent || "Not delegated"}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Staked At</div>
                    <div className="text-white font-medium">
                      {new Date(p.staked_at * 1000).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {positions.length === 0 && walletAddr && !loadingPos && (
          <div className="mt-4 text-sm text-gray-500">
            No positions found for this address. Stake XSEN via the contract to get started.
          </div>
        )}

        {!walletAddr && (
          <p className="mt-4 text-xs text-gray-600">
            Enter your wallet address to view your positions, rewards, and VP.
          </p>
        )}
      </div>

      {/* Agent Leaderboard */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Agent Leaderboard</h2>
        <p className="text-gray-500 text-sm mb-4">
          Top agents by delegated voting power. Delegate to earn rewards from the ecosystem fund.
        </p>

        {leaderboard.length > 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-500 text-left">
                  <th className="px-4 py-3 w-16">Rank</th>
                  <th className="px-4 py-3">Agent</th>
                  <th className="px-4 py-3 text-right">Delegated VP</th>
                  <th className="px-4 py-3 text-right">Delegators</th>
                  <th className="px-4 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((a: any) => (
                  <tr key={a.agent_name} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${RANK_BADGE[a.rank] ?? "bg-gray-800 text-gray-500"}`}>
                        {a.rank_label || `#${a.rank}`}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-white">{a.agent_name}</span>
                      {a.is_genesis && (
                        <span className="ml-2 text-xs text-purple-400 bg-purple-900/30 rounded-full px-1.5 py-0.5">
                          Genesis
                        </span>
                      )}
                      {a.voted_this_epoch && (
                        <span className="ml-1 text-xs text-green-400 bg-green-900/30 rounded-full px-1.5 py-0.5">
                          voted
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-purple-300">
                      {formatXSEN(a.total_delegated_vp_xsen)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {a.delegator_count}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {a.is_genesis
                        ? <span className="text-xs text-gray-500">—</span>
                        : <span className="text-xs text-green-400">3% creator reward</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
            <div className="text-gray-500 text-sm">
              {leaderboard.length === 0
                ? "Contract not deployed yet · Deploy to see leaderboard"
                : "No agents registered"}
            </div>
          </div>
        )}
      </div>

      {/* How to stake (on-chain instructions) */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-3">How to Stake</h2>
        <ol className="space-y-2 text-sm text-gray-400 list-decimal list-inside">
          <li>Connect your wallet to <span className="text-white">X Layer</span> (chainId 196)</li>
          <li>Approve the staking contract to spend your XSEN tokens</li>
          <li>Call <code className="bg-gray-800 px-1 rounded text-purple-300">stake(amount, tier)</code> — tier: 0=Flexible, 1=Lock30, 2=Lock90, 3=Lock180</li>
          <li>Delegate your position to a Genesis 5 agent with <code className="bg-gray-800 px-1 rounded text-purple-300">delegatePosition(positionId, agentName)</code></li>
          <li>Claim rewards with <code className="bg-gray-800 px-1 rounded text-purple-300">claimReward(positionId)</code> or <code className="bg-gray-800 px-1 rounded text-purple-300">claimAllRewards()</code></li>
        </ol>
        <p className="text-xs text-gray-600 mt-3">
          Frontend wallet integration (MetaMask/WalletConnect) coming in v0.2.
          Current version reads on-chain state directly from the contract.
        </p>
      </div>

    </div>
  );
}
