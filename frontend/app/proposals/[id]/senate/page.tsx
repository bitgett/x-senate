"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { fetchProposal, getSenateVotes, getSenateReviewUrl } from "@/lib/api";
import { Proposal, AgentVote, PERSONA_META } from "@/types";

export default function SenatePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [votes, setVotes] = useState<AgentVote[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [tally, setTally] = useState<any>(null);
  const [error, setError] = useState("");
  const [showCot, setShowCot] = useState<Record<string, boolean>>({});

  useEffect(() => {
    Promise.all([fetchProposal(id), getSenateVotes(id)])
      .then(([p, v]) => { setProposal(p); setVotes(v); });
  }, [id]);

  async function startReview() {
    setStreaming(true);
    setVotes([]);
    setTally(null);
    setError("");

    try {
      const res = await fetch(getSenateReviewUrl(id), { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          const data = JSON.parse(line.slice(6));
          if (data.type === "tally") {
            setTally(data.tally);
            // Refresh proposal status
            const p = await fetchProposal(id);
            setProposal(p);
          } else if (data.agent) {
            setVotes((prev) => {
              const exists = prev.find((v) => v.agent_name === data.agent);
              if (exists) return prev;
              return [...prev, {
                agent_name: data.agent,
                vote: data.vote,
                reason: data.reason,
                chain_of_thought: data.chain_of_thought,
                confidence: data.confidence,
              }];
            });
          }
        }
      }
    } catch (e: any) {
      setError(e.message || "Senate review failed");
    } finally {
      setStreaming(false);
    }
  }

  if (!proposal) return <div className="text-gray-400 py-12 text-center">Loading...</div>;

  const canReview = proposal.status === "Draft";
  const debateReady = proposal.status === "In_Debate" || (tally?.passed && votes.length === 5);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/" className="hover:text-gray-300">Proposals</Link>
        <span>›</span>
        <Link href={`/proposals/${id}`} className="hover:text-gray-300 truncate">{proposal.title}</Link>
        <span>›</span>
        <span>Senate</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-white">🏛️ Senate Review</h1>
        <p className="text-gray-400 text-sm mt-1">Genesis 5 agents independently review the proposal. 3/5 approval advances to debate.</p>
      </div>

      {/* Proposal summary */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="text-xs text-gray-500 mb-1">Reviewing Proposal</div>
        <div className="text-white font-semibold">{proposal.title}</div>
        <div className="text-gray-400 text-sm mt-1 line-clamp-2">{proposal.summary}</div>
      </div>

      {/* Start button */}
      {canReview && (
        <button
          onClick={startReview}
          disabled={streaming}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-4 rounded-xl transition-colors"
        >
          {streaming ? "⏳ Senate deliberating..." : "⚡ Start Senate Review"}
        </button>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-400 text-sm">⚠️ {error}</div>
      )}

      {/* Tally bar */}
      {votes.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-green-400 font-semibold">✓ {votes.filter(v => v.vote === "Approve").length} Approve</span>
            <span className="text-gray-400">Threshold: 3/5</span>
            <span className="text-red-400 font-semibold">✗ {votes.filter(v => v.vote === "Reject").length} Reject</span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden bg-gray-700">
            <div
              className="bg-green-500 transition-all duration-500"
              style={{ width: `${(votes.filter(v => v.vote === "Approve").length / 5) * 100}%` }}
            />
          </div>
          {tally && (
            <div className={`mt-3 text-center font-semibold text-sm ${tally.passed ? "text-green-400" : "text-red-400"}`}>
              {tally.passed ? "✅ PASSED — Advancing to Debate" : "❌ REJECTED by Senate"}
            </div>
          )}
        </div>
      )}

      {/* Agent vote cards */}
      <div className="grid gap-4">
        {votes.map((v) => {
          const meta = PERSONA_META[v.agent_name];
          const cotOpen = showCot[v.agent_name];
          return (
            <div
              key={v.agent_name}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 agent-card"
              style={{ borderLeftColor: meta?.color, borderLeftWidth: "4px" }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{meta?.emoji}</span>
                  <div>
                    <div className="font-semibold text-white">{v.agent_name}</div>
                    <div className="text-xs text-gray-500">{meta?.tagline}</div>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`font-bold text-lg ${v.vote === "Approve" ? "text-green-400" : "text-red-400"}`}>
                    {v.vote === "Approve" ? "✓ APPROVE" : "✗ REJECT"}
                  </span>
                  <div className="text-xs text-gray-500">{v.confidence}% confidence</div>
                </div>
              </div>

              <p className="text-gray-300 text-sm mt-3">{v.reason}</p>

              <button
                onClick={() => setShowCot((prev) => ({ ...prev, [v.agent_name]: !cotOpen }))}
                className="mt-2 text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                {cotOpen ? "▲ Hide" : "▼ Show"} Chain of Thought
              </button>

              {cotOpen && (
                <div className="mt-3 bg-gray-800/60 rounded-lg p-3 text-xs text-gray-400 leading-relaxed border border-gray-700">
                  {v.chain_of_thought}
                </div>
              )}
            </div>
          );
        })}

        {/* Loading placeholders */}
        {streaming && votes.length < 5 && Array.from({ length: 5 - votes.length }).map((_, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-700"></div>
              <div className="space-y-2">
                <div className="h-4 w-24 bg-gray-700 rounded"></div>
                <div className="h-3 w-32 bg-gray-800 rounded"></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      {debateReady && (
        <Link
          href={`/proposals/${id}/debate`}
          className="block w-full text-center bg-purple-600 hover:bg-purple-500 text-white font-semibold py-4 rounded-xl transition-colors"
        >
          ⚡ Enter Relay Debate →
        </Link>
      )}
    </div>
  );
}
