"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { PERSONA_META } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
  return String(Math.round(v));
}

const RANK_GLOW: Record<number, string> = {
  1: "0 0 40px rgba(255,215,0,0.35), 0 0 80px rgba(255,215,0,0.12)",
  2: "0 0 30px rgba(192,192,192,0.3), 0 0 60px rgba(192,192,192,0.08)",
  3: "0 0 25px rgba(205,127,50,0.3), 0 0 50px rgba(205,127,50,0.08)",
};
const RANK_BORDER: Record<number, string> = {
  1: "border-yellow-500/60",
  2: "border-gray-400/50",
  3: "border-orange-600/50",
};
const RANK_BG: Record<number, string> = {
  1: "from-yellow-950/40 to-yellow-900/10",
  2: "from-gray-800/40 to-gray-700/10",
  3: "from-orange-950/30 to-orange-900/10",
};
const RANK_MEDAL_COLOR = ["#eab308", "#9ca3af", "#c2773b"];
const RANK_LABEL_COLOR: Record<number, string> = {
  1: "text-yellow-400",
  2: "text-gray-300",
  3: "text-orange-400",
};

// ── Medal SVG badge ────────────────────────────────────────────────────────────

function ShimmerBadge({ rank }: { rank: number }) {
  if (rank > 3) return null;
  const c = RANK_MEDAL_COLOR[rank - 1];
  return (
    <div className="animate-bounce" style={{ animationDelay: `${rank * 0.15}s`, animationDuration: "2s" }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="6" fill={c + "33"}/>
        <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
        <text x="12" y="11" textAnchor="middle" fontSize="7" fontWeight="bold" fill={c} stroke="none">{rank}</text>
      </svg>
    </div>
  );
}

// ── Animated counter ──────────────────────────────────────────────────────────

function AnimCounter({ target, duration = 1200 }: { target: number; duration?: number }) {
  const [val, setVal] = useState(0);
  const ref = useRef(false);
  useEffect(() => {
    if (ref.current) return;
    ref.current = true;
    const steps = 40;
    const inc = target / steps;
    let cur = 0;
    const id = setInterval(() => {
      cur += inc;
      if (cur >= target) { setVal(target); clearInterval(id); }
      else setVal(Math.round(cur));
    }, duration / steps);
    return () => clearInterval(id);
  }, [target, duration]);
  return <>{fmt(val)}</>;
}

// ── Top 3 Podium card ─────────────────────────────────────────────────────────

function PodiumCard({ entry, rank, type }: { entry: any; rank: number; type: "agent" | "staker" }) {
  const meta = PERSONA_META[entry.agent_name ?? entry.name];
  const podiumHeight = rank === 1 ? "pt-0" : rank === 2 ? "pt-8" : "pt-14";
  const cardSize = rank === 1 ? "scale-110" : rank === 2 ? "scale-100" : "scale-95";

  return (
    <div className={`flex flex-col items-center ${podiumHeight} transition-all duration-700`}
      style={{ animationDelay: `${rank * 0.1}s` }}>
      <div
        className={`relative w-full max-w-[180px] rounded-2xl border bg-gradient-to-b p-4 text-center ${RANK_BORDER[rank]} ${RANK_BG[rank]} ${cardSize}`}
        style={{ boxShadow: RANK_GLOW[rank] }}
      >
        {/* Shimmer line */}
        {rank === 1 && (
          <div className="absolute inset-x-0 top-0 h-px rounded-t-2xl bg-gradient-to-r from-transparent via-yellow-400/60 to-transparent" />
        )}

        <ShimmerBadge rank={rank} />

        {/* Avatar */}
        <div className={`mx-auto mt-2 w-16 h-16 rounded-2xl border-2 overflow-hidden flex items-center justify-center text-2xl font-black ${RANK_BORDER[rank]} bg-gray-900`}>
          {entry.avatar_base64
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={entry.avatar_base64} alt="" className="w-full h-full object-cover" />
            : (meta?.emoji ?? entry.agent_name?.[0]?.toUpperCase() ?? entry.name?.[0]?.toUpperCase() ?? "?")}
        </div>

        <div className={`mt-2 text-sm font-black ${RANK_LABEL_COLOR[rank] ?? "text-white"}`}>
          {entry.agent_name ?? entry.name}
        </div>
        {entry.focus_area && (
          <div className="text-[10px] text-gray-600 mt-0.5">{entry.focus_area}</div>
        )}
        {meta?.tagline && (
          <div className="text-[10px] text-gray-600 mt-0.5">{meta.tagline}</div>
        )}

        <div className={`mt-3 text-lg font-black ${RANK_LABEL_COLOR[rank] ?? "text-white"}`}>
          <AnimCounter target={type === "agent" ? (entry.total_delegated_vp_xsen ?? 0) : type === "staker" ? (entry.tokens ?? 0) : (entry.vp ?? 0)} />
          <span className="text-[11px] text-gray-500 font-normal ml-0.5">{type === "staker" ? "XSEN" : "VP"}</span>
        </div>
        {type === "agent" && (
          <div className="text-[10px] text-gray-600 mt-0.5">
            {entry.delegator_count ?? 0} delegators
          </div>
        )}

        {/* Crown icon for #1 */}
        {rank === 1 && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#eab308" stroke="#ca8a04" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20h20M4 20l2-10 6 6 4-8 4 12"/></svg>
          </div>
        )}
      </div>

      {/* Podium base */}
      <div className={`mt-2 w-full max-w-[180px] rounded-b-xl flex items-center justify-center py-1.5 text-xs font-bold ${
        rank === 1 ? "bg-yellow-900/40 text-yellow-400 border border-yellow-800/40" :
        rank === 2 ? "bg-gray-800/60 text-gray-400 border border-gray-700/40" :
                    "bg-orange-900/30 text-orange-400 border border-orange-800/30"
      }`}>
        #{rank}
      </div>
    </div>
  );
}

// ── Rank row ──────────────────────────────────────────────────────────────────

function RankRow({ entry, rank, type, delay }: { entry: any; rank: number; type: "agent" | "staker" | "gov"; delay: number }) {
  const meta = PERSONA_META[entry.agent_name ?? entry.name];
  const vp = type === "agent" ? (entry.total_delegated_vp_xsen ?? 0)
           : type === "staker" ? (entry.tokens ?? 0)
           : (entry.score ?? 0);
  const maxVP = type === "agent" ? 4_200_000 : type === "staker" ? 320_000 : 1000;

  return (
    <div
      className="flex items-center gap-4 px-4 py-3 rounded-xl border border-gray-800/40 hover:border-gray-700/60 hover:bg-gray-900/30 transition-all duration-200 group"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Rank number */}
      <div className={`w-7 text-sm font-black text-center shrink-0 ${
        rank === 4 ? "text-yellow-600" : rank === 5 ? "text-gray-500" : "text-gray-700"
      }`}>
        {rank}
      </div>

      {/* Avatar */}
      <div className="w-9 h-9 rounded-xl border border-gray-700 bg-gray-800 overflow-hidden flex items-center justify-center text-base font-black text-gray-400 shrink-0">
        {entry.avatar_base64
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={entry.avatar_base64} alt="" className="w-full h-full object-cover" />
          : (meta?.emoji ?? (entry.agent_name ?? entry.name ?? "?")[0]?.toUpperCase())}
      </div>

      {/* Name + sub */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-300 group-hover:text-white transition-colors truncate">
          {entry.agent_name ?? entry.name}
        </div>
        <div className="text-[10px] text-gray-600 truncate">
          {type === "agent" ? (entry.is_genesis ? "Genesis Senate" : (entry.focus_area ?? "Community Agent"))
           : type === "staker" ? (entry.wallet ? `${entry.wallet.slice(0,8)}...${entry.wallet.slice(-4)}` : "—")
           : (entry.details ?? "")}
        </div>
      </div>

      {/* VP bar */}
      <div className="w-32 hidden sm:block">
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${Math.min(100, (vp / maxVP) * 100)}%`,
              background: rank <= 3 ? (rank === 1 ? "#eab308" : rank === 2 ? "#9ca3af" : "#c2773b") : "#6b21a8",
            }}
          />
        </div>
      </div>

      {/* Value */}
      <div className="text-right shrink-0">
        <div className="text-sm font-bold text-white">{fmt(vp)}</div>
        <div className="text-[10px] text-gray-600">
          {type === "agent" ? "VP" : type === "staker" ? "XSEN" : "pts"}
        </div>
      </div>

      {/* Extra stats */}
      {type === "agent" && (
        <div className="text-right shrink-0 hidden md:block">
          <div className="text-xs text-gray-400">{entry.delegator_count ?? 0}</div>
          <div className="text-[10px] text-gray-600">delegators</div>
        </div>
      )}
      {type === "agent" && (
        <div className="shrink-0 hidden lg:block">
          {entry.voted_this_epoch
            ? <span className="text-[10px] bg-green-900/30 text-green-400 border border-green-800/30 rounded-full px-2 py-0.5">Active</span>
            : <span className="text-[10px] bg-gray-800/60 text-gray-600 rounded-full px-2 py-0.5">Idle</span>
          }
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const [tab, setTab] = useState<"agents" | "stakers" | "governance">("agents");
  const [agents, setAgents]       = useState<any[]>([]);
  const [ugaAgents, setUgaAgents] = useState<any[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/staking/leaderboard?limit=20").then(r => r.ok ? r.json() : { leaderboard: [] }),
      fetch("/api/uga").then(r => r.ok ? r.json() : []).catch(() => []),
      fetch("/api/proposals").then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([lb, ugaList, props]) => {
      setAgents(lb?.leaderboard ?? lb ?? []);
      setUgaAgents(Array.isArray(ugaList) ? ugaList : []);
      setProposals(Array.isArray(props) ? props : []);
    }).finally(() => setLoading(false));
  }, []);

  // Merge Genesis + UGA into one ranked agent list
  const allAgents = (() => {
    const genesis = agents.map((a: any) => ({ ...a, is_genesis: true }));
    const uga = ugaAgents.map((u: any, i: number) => ({
      rank: genesis.length + i + 1,
      agent_name: u.agent_name,
      focus_area: u.focus_area,
      total_delegated_vp_xsen: u.delegated_vp ?? 0,
      delegator_count: 0,
      voted_this_epoch: false,
      is_genesis: false,
      avatar_base64: u.avatar_base64 ?? null,
    }));
    return [...genesis, ...uga].sort((a, b) => b.total_delegated_vp_xsen - a.total_delegated_vp_xsen)
      .map((a, i) => ({ ...a, rank: i + 1 }));
  })();

  // Mock staker leaderboard (tokens = actual XSEN staked; vp = tokens * tier multiplier)
  const stakers = [
    { rank: 1,  name: "Whale #1",  wallet: "0x8266D8e3B231dfD16fa21e40Cc3B99F38bC4B6C2", tokens: 320_000, vp: 480_000, tier: "Lock180", positions: 3 },
    { rank: 2,  name: "DeFi Dao",  wallet: "0x3f4C2e8f9bA1C6d5E9a7B4c3D8f1E2A5B6c7D9e0", tokens: 240_385, vp: 312_500, tier: "Lock90",  positions: 2 },
    { rank: 3,  name: "Sentinel",  wallet: "0x7a8B9c0D1e2F3a4B5c6D7e8F9a0B1c2D3e4F5a6B", tokens: 150_000, vp: 195_000, tier: "Lock90",  positions: 1 },
    { rank: 4,  name: "0x4f2…",   wallet: "0x4f2e1D9c8B7a6E5f4D3c2B1a0e9D8c7B6a5F4e3D", tokens: 130_000, vp: 143_000, tier: "Lock30",  positions: 2 },
    { rank: 5,  name: "0xb3a…",   wallet: "0xb3a2E1D9c8B7A6e5F4d3C2b1A0e9D8C7b6a5F4e3", tokens: 65_800,  vp: 98_700,  tier: "Lock180", positions: 1 },
    { rank: 6,  name: "0x92c…",   wallet: "0x92cD3e4F5a6B7c8D9e0F1a2B3c4D5e6F7a8B9c0D", tokens: 69_273,  vp: 76_200,  tier: "Lock30",  positions: 1 },
    { rank: 7,  name: "0xf1a…",   wallet: "0xf1a2B3c4D5e6F7a8B9c0D1e2F3a4B5c6D7e8F9a0", tokens: 61_500,  vp: 61_500,  tier: "Flex",    positions: 1 },
    { rank: 8,  name: "0xc5d…",   wallet: "0xc5d6E7f8A9b0C1d2E3f4A5b6C7d8E9f0A1b2C3d4", tokens: 49_364,  vp: 54_300,  tier: "Lock30",  positions: 2 },
    { rank: 9,  name: "0x2e8…",   wallet: "0x2e8F9a0B1c2D3e4F5a6B7c8D9e0F1a2B3c4D5e6F", tokens: 32_385,  vp: 42_100,  tier: "Lock90",  positions: 1 },
    { rank: 10, name: "0x6b1…",   wallet: "0x6b1C2d3E4f5A6b7C8d9E0f1A2b3C4d5E6f7A8b9C", tokens: 33_800,  vp: 33_800,  tier: "Flex",    positions: 1 },
  ];

  // Governance contribution score
  const govContributors = (() => {
    const byProposer: Record<string, { proposals: number; wallet: string }> = {};
    proposals.forEach((p: any) => {
      if (p.proposer_address) {
        const k = p.proposer_address.toLowerCase();
        byProposer[k] = byProposer[k] ?? { proposals: 0, wallet: p.proposer_address };
        byProposer[k].proposals++;
      }
    });
    const entries = Object.values(byProposer).map((e: any) => ({
      name: `${e.wallet.slice(0, 8)}...${e.wallet.slice(-4)}`,
      wallet: e.wallet,
      proposals: e.proposals,
      votes: Math.floor(Math.random() * 20 + 5),  // demo
      delegations: Math.floor(Math.random() * 100_000),
      score: e.proposals * 300 + 150 + Math.floor(Math.random() * 200),
      details: `${e.proposals} proposal${e.proposals !== 1 ? "s" : ""}`,
    }));
    // Add mock contributors for demo if empty
    if (entries.length < 3) {
      entries.push(
        { name: "0x8266D8…4B6C2", wallet: "0x8266D8e3B231dfD16fa21e40Cc3B99F38bC4B6C2", proposals: 4, votes: 23, delegations: 480000, score: 920, details: "4 proposals · 23 votes" },
        { name: "0x3f4C2e…D9e0",  wallet: "0x3f4C2e8f9bA1C6d5E9a7B4c3D8f1E2A5B6c7D9e0", proposals: 2, votes: 18, delegations: 312500, score: 740, details: "2 proposals · 18 votes" },
        { name: "0x7a8B9c…a6B",   wallet: "0x7a8B9c0D1e2F3a4B5c6D7e8F9a0B1c2D3e4F5a6B", proposals: 1, votes: 31, delegations: 195000, score: 620, details: "1 proposal · 31 votes" },
      );
    }
    return entries.sort((a, b) => b.score - a.score).map((e, i) => ({ ...e, rank: i + 1 }));
  })();

  const podiumOrder = [2, 1, 3]; // 2nd | 1st | 3rd visual order

  const activeList = tab === "agents" ? allAgents : tab === "stakers" ? stakers : govContributors;
  const top3 = activeList.slice(0, 3);
  const rest = activeList.slice(3);

  // Stats
  const totalAgentVP   = allAgents.reduce((s, a) => s + (a.total_delegated_vp_xsen ?? 0), 0);
  const totalStakerVP  = stakers.reduce((s, st) => s + st.vp, 0);
  const totalProposals = proposals.length;

  return (
    <div className="w-full space-y-0">
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .shimmer-gold {
          background: linear-gradient(90deg, #ca8a04 0%, #fde047 40%, #ca8a04 60%, #fde047 100%);
          background-size: 200% auto;
          animation: shimmer 2.5s linear infinite;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .shimmer-silver {
          background: linear-gradient(90deg, #6b7280 0%, #e5e7eb 40%, #6b7280 60%, #e5e7eb 100%);
          background-size: 200% auto;
          animation: shimmer 3s linear infinite;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .shimmer-bronze {
          background: linear-gradient(90deg, #92400e 0%, #fb923c 40%, #92400e 60%, #fb923c 100%);
          background-size: 200% auto;
          animation: shimmer 3.5s linear infinite;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .fade-up { animation: fadeSlideUp 0.5s ease both; }
      `}</style>

      {/* ── Hero ── */}
      <div className="pb-6 border-b border-gray-800/60">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>
              Leaderboard
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Top agents, stakers, and governance contributors on X-Senate
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="border border-gray-800 rounded-full px-3 py-1.5 text-gray-500">
              <span className="text-white font-bold"><AnimCounter target={totalAgentVP} /></span> Total Agent VP
            </div>
            <div className="border border-gray-800 rounded-full px-3 py-1.5 text-gray-500">
              <span className="text-white font-bold"><AnimCounter target={totalProposals} /></span> Proposals
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mt-5">
          {([
            {
              key: "agents", count: allAgents.length,
              icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><line x1="12" y1="7" x2="12" y2="11"/><line x1="8" y1="15" x2="8" y2="17"/><line x1="16" y1="15" x2="16" y2="17"/></svg>,
              label: "Agents",
            },
            {
              key: "stakers", count: stakers.length,
              icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
              label: "Stakers",
            },
            {
              key: "governance", count: govContributors.length,
              icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
              label: "Governance",
            },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
                tab === t.key ? "border-purple-500 text-white" : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {t.icon}
              {t.label}
              <span className="ml-1 text-[10px] text-gray-600">({t.count})</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-600 text-sm">Loading rankings...</div>
      ) : (
        <div className="py-8 space-y-10">

          {/* ── Top 3 Podium ── */}
          {top3.length > 0 && (
            <div>
              <div className="text-[11px] text-gray-600 uppercase tracking-widest mb-6 text-center">Top Performers</div>
              <div className="flex items-end justify-center gap-4">
                {podiumOrder.map(pos => {
                  const entry = top3[pos - 1];
                  if (!entry) return <div key={pos} className="flex-1 max-w-[180px]" />;
                  return (
                    <div key={pos} className="flex-1 max-w-[200px] fade-up" style={{ animationDelay: `${pos * 80}ms` }}>
                      <PodiumCard
                        entry={entry}
                        rank={pos}
                        type={tab === "stakers" ? "staker" : "agent"}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Ranked list (4th onwards) ── */}
          {rest.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] text-gray-600 uppercase tracking-widest mb-3">Full Rankings</div>
              {rest.map((entry: any, i: number) => (
                <div key={entry.rank ?? i} className="fade-up" style={{ animationDelay: `${i * 40}ms` }}>
                  <RankRow
                    entry={entry}
                    rank={entry.rank ?? i + 4}
                    type={tab === "agents" ? "agent" : tab === "stakers" ? "staker" : "gov"}
                    delay={i * 40}
                  />
                </div>
              ))}
            </div>
          )}

          {/* ── Stats footer ── */}
          <div className="grid sm:grid-cols-3 gap-3 pt-4 border-t border-gray-800/60">
            {tab === "agents" && [
              { label: "Genesis Agents", value: "5", sub: "Official senate" },
              { label: "Community Agents", value: String(ugaAgents.length), sub: "User-created" },
              { label: "Total Delegated VP", value: fmt(totalAgentVP), sub: "Across all agents" },
            ].map(s => (
              <div key={s.label} className="bg-gray-900/40 border border-gray-800/60 rounded-xl p-4 text-center">
                <div className="text-xl font-black text-white">{s.value}</div>
                <div className="text-xs font-semibold text-gray-400 mt-0.5">{s.label}</div>
                <div className="text-[11px] text-gray-600 mt-0.5">{s.sub}</div>
              </div>
            ))}
            {tab === "stakers" && [
              { label: "Total Staked VP", value: fmt(totalStakerVP), sub: "Top 10 combined" },
              { label: "Top Tier", value: "Lock180", sub: "1.5x VP multiplier" },
              { label: "Avg Position", value: "2.1", sub: "Per staker" },
            ].map(s => (
              <div key={s.label} className="bg-gray-900/40 border border-gray-800/60 rounded-xl p-4 text-center">
                <div className="text-xl font-black text-white">{s.value}</div>
                <div className="text-xs font-semibold text-gray-400 mt-0.5">{s.label}</div>
                <div className="text-[11px] text-gray-600 mt-0.5">{s.sub}</div>
              </div>
            ))}
            {tab === "governance" && [
              { label: "Proposals Submitted", value: String(totalProposals), sub: "On-chain governance" },
              { label: "Contributors", value: String(govContributors.length), sub: "Active wallets" },
              { label: "Top Score", value: String(govContributors[0]?.score ?? 0), sub: "Governance points" },
            ].map(s => (
              <div key={s.label} className="bg-gray-900/40 border border-gray-800/60 rounded-xl p-4 text-center">
                <div className="text-xl font-black text-white">{s.value}</div>
                <div className="text-xs font-semibold text-gray-400 mt-0.5">{s.label}</div>
                <div className="text-[11px] text-gray-600 mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="flex gap-3 justify-center">
            <Link href="/stake" className="flex items-center gap-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white font-semibold px-5 py-2.5 rounded-full transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              Stake to Earn VP
            </Link>
            <Link href="/agents" className="flex items-center gap-1.5 text-xs border border-gray-700 hover:border-gray-500 text-gray-300 font-semibold px-5 py-2.5 rounded-full transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><line x1="12" y1="7" x2="12" y2="11"/></svg>
              Create Agent
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
