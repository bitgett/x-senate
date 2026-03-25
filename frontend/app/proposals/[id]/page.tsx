"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchProposal, getSenateVotes, fetchProposals } from "@/lib/api";
import { Proposal, AgentVote, STATUS_LABELS, PERSONA_META } from "@/types";

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}

function ProposalTimeline({ proposal, votes }: { proposal: Proposal; votes: AgentVote[] }) {
  const steps = [
    {
      key: "submitted",
      icon: "🔍",
      label: "Sentinel Approved",
      desc: proposal.sentinel_analysis ? "AI scan passed" : "Submitted",
      time: proposal.created_at,
      done: true,
      color: "text-blue-400 border-blue-700/50 bg-blue-950/20",
    },
    {
      key: "senate",
      icon: "🏛️",
      label: "Senate Review",
      desc: votes.length > 0
        ? `${proposal.approve_count}/${votes.length} Approve`
        : "Pending",
      time: votes[0]?.voted_at ?? null,
      done: votes.length > 0,
      color: votes.length > 0
        ? (proposal.approve_count >= 3 ? "text-green-400 border-green-700/50 bg-green-950/20" : "text-red-400 border-red-700/50 bg-red-950/20")
        : "text-gray-600 border-gray-800 bg-gray-900/20",
    },
    {
      key: "debate",
      icon: "⚡",
      label: "Relay Debate",
      desc: ["In_Debate", "Executed"].includes(proposal.status) ? "Completed" : "Pending",
      time: null,
      done: ["In_Debate", "Executed"].includes(proposal.status),
      color: ["In_Debate", "Executed"].includes(proposal.status)
        ? "text-purple-400 border-purple-700/50 bg-purple-950/20"
        : "text-gray-600 border-gray-800 bg-gray-900/20",
    },
    {
      key: "executed",
      icon: "✅",
      label: "Executed On-Chain",
      desc: proposal.tx_hash ? `tx: ${proposal.tx_hash.slice(0, 8)}...` : "Pending",
      time: proposal.status === "Executed" ? proposal.created_at : null,
      done: proposal.status === "Executed",
      color: proposal.status === "Executed"
        ? "text-green-400 border-green-700/50 bg-green-950/20"
        : "text-gray-600 border-gray-800 bg-gray-900/20",
    },
  ];

  // Mark rejected path
  const isRejected = proposal.status === "Rejected_Senate" || proposal.status === "Rejected";

  return (
    <div className="bg-gray-900/30 border border-gray-800/60 rounded-xl p-5">
      <div className="text-[11px] text-gray-600 uppercase tracking-wider mb-4 font-semibold">Governance Timeline</div>
      <div className="relative">
        {/* connector line */}
        <div className="absolute top-5 left-5 right-5 h-px bg-gray-800" style={{ zIndex: 0 }} />
        <div className="flex justify-between relative" style={{ zIndex: 1 }}>
          {steps.map((s, i) => {
            const isBlocked = isRejected && i >= 2;
            return (
              <div key={s.key} className="flex flex-col items-center gap-2 flex-1">
                <div className={`w-10 h-10 rounded-full border flex items-center justify-center text-base shrink-0 ${isBlocked ? "text-gray-700 border-gray-800 bg-gray-900" : s.color}`}>
                  {isBlocked ? "✕" : s.icon}
                </div>
                <div className="text-center">
                  <div className={`text-[11px] font-semibold ${isBlocked ? "text-gray-700" : s.done ? "text-white" : "text-gray-600"}`}>
                    {s.label}
                  </div>
                  <div className={`text-[10px] mt-0.5 ${isBlocked ? "text-gray-800" : "text-gray-600"}`}>
                    {isBlocked ? "Skipped" : s.desc}
                  </div>
                  {s.time && !isBlocked && (
                    <div className="text-[10px] text-gray-700 mt-0.5">{fmtTime(s.time)}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function VoteTallyBar({ approve, reject }: { approve: number; reject: number }) {
  const total = approve + reject;
  if (total === 0) return (
    <div className="space-y-1">
      <div className="h-2 rounded-full bg-gray-800 w-full" />
      <div className="text-xs text-gray-600">No senate votes yet</div>
    </div>
  );
  const forPct = Math.round((approve / total) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex h-2 rounded-full overflow-hidden bg-gray-800">
        <div className="bg-green-500 transition-all" style={{ width: `${forPct}%` }} />
        <div className="bg-red-500/70 transition-all" style={{ width: `${100 - forPct}%` }} />
      </div>
      <div className="flex items-center gap-4 text-xs">
        <span className="text-green-400 font-semibold">{approve} Approve · {forPct}%</span>
        <span className="text-red-400">{reject} Reject · {100 - forPct}%</span>
        <span className="ml-auto text-gray-600">{total} / 5 agents voted</span>
      </div>
    </div>
  );
}

function AgentVoteCard({ vote }: { vote: AgentVote }) {
  const [expanded, setExpanded] = useState(false);
  const meta = PERSONA_META[vote.agent_name];
  const isApprove = vote.vote === "Approve";

  return (
    <div className={`border rounded-xl p-4 transition-all ${isApprove ? "border-green-800/40 bg-green-950/10" : "border-red-800/40 bg-red-950/10"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="text-2xl shrink-0">{meta?.emoji ?? "🤖"}</div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white text-sm">{vote.agent_name}</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${isApprove ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30"}`}>
                {vote.vote}
              </span>
              <span className="text-[11px] text-gray-500">{vote.confidence}% confidence</span>
            </div>
            <div className="text-[11px] text-gray-600 mt-0.5">{meta?.tagline}</div>
          </div>
        </div>
        {vote.voted_at && (
          <div className="text-[11px] text-gray-600 shrink-0">{fmtTime(vote.voted_at)}</div>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-3 leading-relaxed">{vote.reason}</p>
      {vote.chain_of_thought && (
        <>
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-[11px] text-purple-400 hover:text-purple-300 mt-2 flex items-center gap-1"
          >
            {expanded ? "▲ Hide reasoning" : "▼ Show full reasoning"}
          </button>
          {expanded && (
            <div className="mt-2 bg-gray-900/60 rounded-lg p-3 text-[11px] text-gray-500 leading-relaxed border border-gray-800/60">
              {vote.chain_of_thought}
            </div>
          )}
        </>
      )}
      {vote.reflection_notes && (
        <div className="mt-2 bg-blue-950/20 border border-blue-800/30 rounded-lg p-3 text-[11px] text-blue-300">
          <span className="text-blue-500 font-semibold">Reflection: </span>{vote.reflection_notes}
        </div>
      )}
    </div>
  );
}

export default function ProposalDetail() {
  const { id } = useParams<{ id: string }>();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [votes, setVotes] = useState<AgentVote[]>([]);
  const [allProposals, setAllProposals] = useState<Proposal[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchProposal(id),
      getSenateVotes(id),
      fetchProposals().catch(() => []),
      fetch("/api/staking/leaderboard?limit=10").then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([p, v, all, lb]) => {
      setProposal(p);
      setVotes(v);
      setAllProposals(all);
      setLeaderboard(lb?.leaderboard ?? []);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-gray-400 py-12 text-center text-sm">Loading proposal...</div>;
  if (!proposal) return <div className="text-red-400 py-12 text-center text-sm">Proposal not found</div>;

  const status = STATUS_LABELS[proposal.status];
  const oneLiners = proposal.one_liner_opinions ? JSON.parse(proposal.one_liner_opinions) : null;
  const currentIdx = allProposals.findIndex(p => p.id === id);
  const prevProposal = currentIdx > 0 ? allProposals[currentIdx - 1] : null;
  const nextProposal = currentIdx < allProposals.length - 1 ? allProposals[currentIdx + 1] : null;

  const totalDelegatedVP = leaderboard.reduce((s: number, l: any) => s + (l.total_delegated_vp_xsen ?? 0), 0);

  const approveVotes = votes.filter(v => v.vote === "Approve");
  const rejectVotes = votes.filter(v => v.vote === "Reject");

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/app" className="hover:text-gray-300 transition-colors">← All Proposals</Link>
        <span className="text-gray-700">›</span>
        <span className="font-mono text-xs text-gray-600">{proposal.id}</span>
      </div>

      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full text-white ${status?.color ?? "bg-gray-600"}`}>
            {status?.label ?? proposal.status}
          </span>
          {proposal.project_id && proposal.project_id !== "XSEN" && (
            <span className="text-xs bg-blue-900/40 text-blue-300 border border-blue-800/40 rounded-full px-2.5 py-1 font-mono">
              {proposal.project_id}
            </span>
          )}
          {proposal.status === "In_Senate" && (
            <span className="text-xs text-blue-400 animate-pulse">● Processing...</span>
          )}
        </div>
        <h1 className="text-2xl font-bold text-white leading-snug">{proposal.title}</h1>

        {/* Meta row */}
        <div className="flex items-center gap-4 flex-wrap text-xs text-gray-500 border border-gray-800/60 rounded-xl px-4 py-3 bg-gray-900/30">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-600">Proposer</span>
            {proposal.proposer_address ? (
              <span className="font-mono text-gray-300 bg-gray-800 px-2 py-0.5 rounded">
                {proposal.proposer_address.slice(0, 8)}...{proposal.proposer_address.slice(-6)}
              </span>
            ) : (
              <span className="text-gray-500 italic">X-Senate Protocol</span>
            )}
          </div>
          <span className="text-gray-700">·</span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-600">Created</span>
            <span className="text-gray-400">{fmtTime(proposal.created_at)}</span>
          </div>
          <span className="text-gray-700">·</span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-600">ID</span>
            <span className="font-mono text-gray-500">{proposal.id}</span>
          </div>
        </div>

        {/* Vote tally */}
        <VoteTallyBar approve={proposal.approve_count ?? 0} reject={proposal.reject_count ?? 0} />
      </div>

      {/* Timeline */}
      <ProposalTimeline proposal={proposal} votes={votes} />

      {/* Body sections */}
      {[
        { label: "Summary", text: proposal.summary },
        { label: "Motivation", text: proposal.motivation },
        { label: "Proposed Action", text: proposal.proposed_action },
        { label: "Potential Risks", text: proposal.potential_risks },
        { label: "Sentinel Analysis", text: proposal.sentinel_analysis },
      ].map(({ label, text }) =>
        text ? (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="text-[11px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">{label}</div>
            <p className="text-gray-300 text-sm leading-relaxed">{text}</p>
          </div>
        ) : null
      )}

      {/* Senate Votes — detailed */}
      {votes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white text-sm">Senate Votes</h3>
            <div className="flex gap-3 text-xs">
              <span className="text-green-400 font-semibold">{approveVotes.length} Approve</span>
              <span className="text-gray-700">·</span>
              <span className="text-red-400">{rejectVotes.length} Reject</span>
              <span className="text-gray-700">·</span>
              <span className="text-gray-500">3/5 threshold</span>
            </div>
          </div>
          <div className="space-y-2">
            {votes.map(v => <AgentVoteCard key={v.agent_name} vote={v} />)}
          </div>
        </div>
      )}

      {/* One-liner opinions */}
      {oneLiners && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="font-semibold text-gray-200 mb-3 text-sm">Agent Summaries</h3>
          <div className="space-y-2">
            {Object.entries(oneLiners).map(([name, text]) => {
              const meta = PERSONA_META[name];
              return (
                <div key={name} className="flex items-start gap-3 text-sm">
                  <span className="text-lg shrink-0">{meta?.emoji}</span>
                  <div>
                    <span className="text-gray-400 font-medium">{name}:</span>{" "}
                    <span className="text-gray-300">{String(text)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Community Participation — VP delegation breakdown */}
      {leaderboard.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white text-sm">Community Participation</h3>
            <span className="text-xs text-gray-600">VP delegated to senate agents</span>
          </div>
          <div className="space-y-2">
            {leaderboard.map((lb: any) => {
              const meta = PERSONA_META[lb.agent_name];
              const pct = totalDelegatedVP > 0 ? ((lb.total_delegated_vp_xsen / totalDelegatedVP) * 100).toFixed(1) : "0";
              const vote = votes.find(v => v.agent_name === lb.agent_name);
              return (
                <div key={lb.agent_name} className="flex items-center gap-3">
                  <span className="text-base w-6 shrink-0">{meta?.emoji ?? "🤖"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-300">{lb.agent_name}</span>
                      {vote && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${vote.vote === "Approve" ? "text-green-400 bg-green-900/30" : "text-red-400 bg-red-900/30"}`}>
                          {vote.vote}
                        </span>
                      )}
                      <span className="ml-auto text-[11px] text-gray-600">
                        {lb.delegator_count ?? 0} wallet{lb.delegator_count !== 1 ? "s" : ""} · {fmt(lb.total_delegated_vp_xsen ?? 0)} VP
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: vote?.vote === "Approve" ? "#22c55e" : vote?.vote === "Reject" ? "#ef4444" : "#6b7280",
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-[11px] text-gray-600 w-10 text-right shrink-0">{pct}%</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-800/60 flex items-center justify-between text-xs text-gray-600">
            <span>Total delegated VP: <span className="text-gray-400 font-semibold">{fmt(totalDelegatedVP)}</span></span>
            <Link href="/stake" className="text-purple-400 hover:text-purple-300">Stake & delegate →</Link>
          </div>
        </div>
      )}

      {/* Execution info */}
      {proposal.status === "Executed" && (
        <div className="bg-green-900/20 border border-green-700/50 rounded-xl p-5 space-y-3">
          <h3 className="text-green-400 font-semibold text-sm">✅ Executed On-Chain</h3>
          {proposal.snapshot_url && (
            <div className="text-sm">
              <span className="text-gray-500">Snapshot: </span>
              <span className="font-mono text-xs text-blue-400 break-all">{proposal.snapshot_url}</span>
            </div>
          )}
          {proposal.tx_hash && (
            <div className="text-sm">
              <span className="text-gray-500">Tx Hash: </span>
              <span className="font-mono text-xs text-gray-300 break-all">{proposal.tx_hash}</span>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        {proposal.status === "Draft" && (
          <Link href={`/proposals/${id}/senate`} className="flex-1 text-center bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
            🏛️ Submit to Senate Review
          </Link>
        )}
        {proposal.status === "In_Debate" && (
          <Link href={`/proposals/${id}/debate`} className="flex-1 text-center bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
            ⚡ Enter Relay Debate
          </Link>
        )}
        {proposal.status === "In_Debate" && (
          <Link href={`/proposals/${id}/execute`} className="flex-1 text-center bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
            🚀 Execute Proposal
          </Link>
        )}
        {proposal.status === "Executed" && votes.length > 0 && (
          <Link href={`/proposals/${id}/execute`} className="flex-1 text-center border border-gray-700 hover:border-gray-500 text-gray-300 font-semibold py-3 rounded-xl transition-colors text-sm">
            🔄 View Reflection
          </Link>
        )}
        {proposal.status === "In_Senate" && (
          <Link href={`/proposals/${id}/senate`} className="flex-1 text-center bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
            📊 View Senate Progress
          </Link>
        )}
      </div>

      {/* Bottom navigation */}
      <div className="border-t border-gray-800/60 pt-6 space-y-4">

        {/* Prev / Next proposal */}
        {(prevProposal || nextProposal) && (
          <div className="flex gap-3">
            {prevProposal ? (
              <Link href={`/proposals/${prevProposal.id}`} className="flex-1 flex items-center gap-3 border border-gray-800 hover:border-gray-700 rounded-xl p-4 group transition-all">
                <span className="text-gray-600 group-hover:text-gray-400 text-lg">←</span>
                <div className="min-w-0">
                  <div className="text-[11px] text-gray-600 mb-0.5">Previous</div>
                  <div className="text-sm text-gray-400 group-hover:text-white truncate transition-colors">{prevProposal.title}</div>
                </div>
              </Link>
            ) : <div className="flex-1" />}
            {nextProposal ? (
              <Link href={`/proposals/${nextProposal.id}`} className="flex-1 flex items-center justify-end gap-3 border border-gray-800 hover:border-gray-700 rounded-xl p-4 group transition-all text-right">
                <div className="min-w-0">
                  <div className="text-[11px] text-gray-600 mb-0.5">Next</div>
                  <div className="text-sm text-gray-400 group-hover:text-white truncate transition-colors">{nextProposal.title}</div>
                </div>
                <span className="text-gray-600 group-hover:text-gray-400 text-lg">→</span>
              </Link>
            ) : <div className="flex-1" />}
          </div>
        )}

        {/* Platform quick links */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { href: "/app",      icon: "📋", label: "All Proposals" },
            { href: "/stake",    icon: "⚡", label: "Stake & Delegate" },
            { href: "/agents",   icon: "🤖", label: "AI Agents" },
            { href: "/sentinel", icon: "🔍", label: "Sentinel" },
          ].map(({ href, icon, label }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 border border-gray-800 hover:border-gray-700 rounded-xl px-3 py-3 text-xs text-gray-500 hover:text-gray-300 transition-all group"
            >
              <span className="text-base">{icon}</span>
              <span>{label}</span>
              <span className="ml-auto text-gray-700 group-hover:text-gray-500">→</span>
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
