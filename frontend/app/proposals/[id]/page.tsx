"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { fetchProposal, getSenateVotes } from "@/lib/api";
import { Proposal, AgentVote, STATUS_LABELS, PERSONA_META } from "@/types";

export default function ProposalDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [votes, setVotes] = useState<AgentVote[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [p, v] = await Promise.all([fetchProposal(id), getSenateVotes(id)]);
      setProposal(p);
      setVotes(v);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  if (loading) return <div className="text-gray-400 py-12 text-center">Loading...</div>;
  if (!proposal) return <div className="text-red-400 py-12 text-center">Proposal not found</div>;

  const status = STATUS_LABELS[proposal.status];
  const oneLiners = proposal.one_liner_opinions ? JSON.parse(proposal.one_liner_opinions) : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/" className="hover:text-gray-300">Proposals</Link>
        <span>›</span>
        <span className="font-mono text-xs">{proposal.id}</span>
      </div>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2 py-1 rounded-full text-white ${status?.color}`}>
            {status?.label}
          </span>
          {proposal.status === "In_Senate" && (
            <span className="text-xs text-blue-400 status-active">● Processing...</span>
          )}
        </div>
        <h1 className="text-2xl font-bold text-white">{proposal.title}</h1>
      </div>

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
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">{label}</div>
            <p className="text-gray-300 text-sm leading-relaxed">{text}</p>
          </div>
        ) : null
      )}

      {/* Senate votes summary */}
      {votes.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-200">Senate Votes</h3>
            <div className="flex gap-3 text-sm">
              <span className="text-green-400">✓ {proposal.approve_count} Approve</span>
              <span className="text-red-400">✗ {proposal.reject_count} Reject</span>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {votes.map((v) => {
              const meta = PERSONA_META[v.agent_name];
              return (
                <div key={v.agent_name} className="text-center p-2 rounded-xl bg-gray-800">
                  <div className="text-xl">{meta?.emoji}</div>
                  <div className="text-xs text-gray-400 mt-1">{v.agent_name}</div>
                  <div className={`text-xs font-bold mt-1 ${v.vote === "Approve" ? "text-green-400" : "text-red-400"}`}>
                    {v.vote}
                  </div>
                  <div className="text-xs text-gray-600">{v.confidence}%</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* One-liner opinions */}
      {oneLiners && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="font-semibold text-gray-200 mb-3">💬 Agent One-Liners</h3>
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

      {/* Execution info */}
      {proposal.status === "Executed" && (
        <div className="bg-green-900/20 border border-green-700/50 rounded-xl p-5 space-y-3">
          <h3 className="text-green-400 font-semibold">✅ Executed On-Chain</h3>
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
      <div className="flex flex-wrap gap-3 pt-2">
        {proposal.status === "Draft" && (
          <Link href={`/proposals/${id}/senate`} className="flex-1 text-center bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors">
            🏛️ Submit to Senate Review
          </Link>
        )}
        {(proposal.status === "In_Debate") && (
          <Link href={`/proposals/${id}/debate`} className="flex-1 text-center bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3 rounded-xl transition-colors">
            ⚡ Enter Relay Debate
          </Link>
        )}
        {proposal.status === "In_Debate" && (
          <Link href={`/proposals/${id}/execute`} className="flex-1 text-center bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded-xl transition-colors">
            🚀 Execute Proposal
          </Link>
        )}
        {proposal.status === "Executed" && votes.length > 0 && (
          <Link href={`/proposals/${id}/execute`} className="flex-1 text-center border border-gray-700 hover:border-gray-500 text-gray-300 font-semibold py-3 rounded-xl transition-colors">
            🔄 View Reflection
          </Link>
        )}
        {proposal.status === "In_Senate" && (
          <Link href={`/proposals/${id}/senate`} className="flex-1 text-center bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors">
            📊 View Senate Progress
          </Link>
        )}
      </div>
    </div>
  );
}
