"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchProposal, executeProposal, runReflection, getSenateVotes } from "@/lib/api";
import { Proposal, AgentVote, PERSONA_META } from "@/types";

export default function ExecutePage() {
  const { id } = useParams<{ id: string }>();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [votes, setVotes] = useState<AgentVote[]>([]);
  const [executing, setExecuting] = useState(false);
  const [reflecting, setReflecting] = useState(false);
  const [execResult, setExecResult] = useState<any>(null);
  const [reflections, setReflections] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([fetchProposal(id), getSenateVotes(id)]).then(([p, v]) => {
      setProposal(p);
      setVotes(v);
      if (p.status === "Executed") {
        setExecResult({
          snapshot: { url: p.snapshot_url },
          chain: { tx_hash: p.tx_hash },
        });
      }
    });
  }, [id]);

  async function handleExecute() {
    setExecuting(true);
    setError("");
    try {
      const result = await executeProposal(id);
      setExecResult(result);
      setProposal((prev) => prev ? { ...prev, status: "Executed", snapshot_url: result.snapshot?.url, tx_hash: result.chain?.tx_hash } : prev);
    } catch (e: any) {
      setError(e.message || "Execution failed");
    } finally {
      setExecuting(false);
    }
  }

  async function handleReflect() {
    setReflecting(true);
    setError("");
    try {
      const result = await runReflection(id);
      setReflections(result);
      // Reload votes to get reflection_notes
      const v = await getSenateVotes(id);
      setVotes(v);
    } catch (e: any) {
      setError(e.message || "Reflection failed");
    } finally {
      setReflecting(false);
    }
  }

  if (!proposal) return <div className="text-gray-400 py-12 text-center">Loading...</div>;

  const alreadyExecuted = proposal.status === "Executed";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/" className="hover:text-gray-300">Proposals</Link>
        <span>›</span>
        <Link href={`/proposals/${id}`} className="hover:text-gray-300 truncate">{proposal.title}</Link>
        <span>›</span>
        <span>Execute</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-white">🚀 Execute Proposal</h1>
        <p className="text-gray-400 text-sm mt-1">
          Push the approved proposal to Snapshot and record on X Layer.
        </p>
      </div>

      {/* Proposal summary */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="text-xs text-gray-500 mb-1">Proposal</div>
        <div className="text-white font-semibold">{proposal.title}</div>
        <div className="flex gap-3 mt-2 text-sm">
          <span className="text-green-400">✓ {proposal.approve_count} Approve</span>
          <span className="text-red-400">✗ {proposal.reject_count} Reject</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-400 text-sm">⚠️ {error}</div>
      )}

      {/* Execute button */}
      {!alreadyExecuted && (
        <button
          onClick={handleExecute}
          disabled={executing}
          className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-4 rounded-xl transition-colors"
        >
          {executing ? "⏳ Executing on-chain..." : "🚀 Execute & Push to Snapshot"}
        </button>
      )}

      {/* Execution result */}
      {(execResult || alreadyExecuted) && (
        <div className="bg-green-900/20 border border-green-700/50 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✅</span>
            <h3 className="text-green-400 font-semibold text-lg">Proposal Executed</h3>
          </div>

          <div className="space-y-3">
            <div className="bg-gray-900/60 rounded-lg p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">📸 Snapshot</div>
              <div className="font-mono text-xs text-blue-400 break-all">
                {execResult?.snapshot?.url || proposal.snapshot_url || "—"}
              </div>
              <div className="text-xs text-gray-600 mt-1">72-hour voting window · Choices: For / Against / Abstain</div>
            </div>

            <div className="bg-gray-900/60 rounded-lg p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">⛓️ On-Chain Transaction</div>
              <div className="font-mono text-xs text-gray-300 break-all">
                {execResult?.chain?.tx_hash || proposal.tx_hash || "—"}
              </div>
              {execResult?.chain?.block_number && (
                <div className="text-xs text-gray-600 mt-1">Block #{execResult.chain.block_number} · X Layer Mainnet</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reflection section */}
      {(alreadyExecuted || execResult) && votes.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold">🔄 Post-Vote Reflection</h3>
              <p className="text-gray-400 text-sm">Agents self-critique their vote based on market outcomes.</p>
            </div>
            <button
              onClick={handleReflect}
              disabled={reflecting}
              className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              {reflecting ? "Reflecting..." : "Run Reflection"}
            </button>
          </div>

          {votes.filter((v) => v.reflection_notes).map((v) => {
            const meta = PERSONA_META[v.agent_name];
            return (
              <div key={v.agent_name} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span>{meta?.emoji}</span>
                  <span className="font-medium text-white text-sm">{v.agent_name}</span>
                  <span className={`text-xs ${v.vote === "Approve" ? "text-green-400" : "text-red-400"}`}>
                    (voted {v.vote})
                  </span>
                </div>
                <p className="text-gray-400 text-sm leading-relaxed">{v.reflection_notes}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="pt-2">
        <Link href="/" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
          ← Back to Proposals
        </Link>
      </div>
    </div>
  );
}
