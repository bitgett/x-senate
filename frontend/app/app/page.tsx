"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchProposals, fetchPlatformStats } from "@/lib/api";
import { Proposal, STATUS_LABELS, PERSONA_META } from "@/types";

const EMPTY_FORM = { title: "", summary: "", motivation: "", proposed_action: "", potential_risks: "" };

export default function Home() {
  const [proposals, setProposals]   = useState<Proposal[]>([]);
  const [platformStats, setPlatform] = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");

  // Submit Proposal modal
  const [showSubmit, setShowSubmit]     = useState(false);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [submitting, setSubmitting]     = useState(false);
  const [submitResult, setSubmitResult] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      fetchProposals(),
      fetchPlatformStats().catch(() => null),
    ])
      .then(([props, stats]) => {
        setProposals(props);
        setPlatform(stats);
      })
      .catch(() => setError("Backend offline — start the FastAPI server"))
      .finally(() => setLoading(false));
  }, []);

  const statusCounts = proposals.reduce(
    (acc, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc; },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center py-8 space-y-3">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          🏛️ X-Senate
        </h1>
        <p className="text-gray-400 max-w-xl mx-auto">
          The Agentic Governance Layer — Genesis 5 AI agents autonomously sense, debate,
          and execute DAO governance on X Layer.
        </p>
        <div className="flex justify-center gap-3 flex-wrap">
          <Link href="/sentinel" className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2 rounded-full text-sm font-medium transition-colors">
            🔍 Run Sentinel Scan
          </Link>
          <button
            onClick={() => { setShowSubmit(true); setSubmitResult(null); setForm(EMPTY_FORM); }}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-full text-sm font-medium transition-colors"
          >
            ✍️ Submit Proposal
          </button>
          <Link href="/agents" className="border border-gray-700 hover:border-gray-500 text-gray-300 px-5 py-2 rounded-full text-sm font-medium transition-colors">
            👥 View Genesis 5
          </Link>
        </div>
      </div>

      {/* Submit Proposal Modal */}
      {showSubmit && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Submit a Proposal</h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  Sentinel AI will review your proposal before it goes to the Senate.
                  Requires 1,000+ XSEN staked on-chain.
                </p>
              </div>
              <button onClick={() => setShowSubmit(false)} className="text-gray-500 hover:text-white text-2xl leading-none">×</button>
            </div>

            {!submitResult ? (
              <div className="p-6 space-y-4">
                {[
                  { key: "title", label: "Title", placeholder: "e.g. Increase staking reward pool by 10%", rows: 1 },
                  { key: "summary", label: "Summary", placeholder: "Brief overview of the proposal", rows: 2 },
                  { key: "motivation", label: "Motivation", placeholder: "Why is this change needed?", rows: 3 },
                  { key: "proposed_action", label: "Proposed Action", placeholder: "Exactly what should be done?", rows: 3 },
                  { key: "potential_risks", label: "Potential Risks (optional)", placeholder: "What could go wrong?", rows: 2 },
                ].map(({ key, label, placeholder, rows }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
                    {rows === 1 ? (
                      <input
                        type="text"
                        value={form[key as keyof typeof form]}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                      />
                    ) : (
                      <textarea
                        rows={rows}
                        value={form[key as keyof typeof form]}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                      />
                    )}
                  </div>
                ))}
                <button
                  onClick={async () => {
                    if (!form.title || !form.summary || !form.motivation || !form.proposed_action) return;
                    setSubmitting(true);
                    try {
                      const res = await fetch("/api/proposals/submit", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(form),
                      });
                      const data = await res.json();
                      setSubmitResult({ ...data, status: res.status });
                      if (res.status === 201) {
                        const updated = await fetchProposals();
                        setProposals(updated);
                      }
                    } catch { setSubmitResult({ approved: false, feedback: "Network error" }); }
                    setSubmitting(false);
                  }}
                  disabled={submitting || !form.title || !form.summary || !form.motivation || !form.proposed_action}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  {submitting ? "Sentinel is reviewing..." : "Submit for Sentinel Review"}
                </button>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                {submitResult.approved ? (
                  <div className="bg-green-900/30 border border-green-700 rounded-xl p-5">
                    <div className="text-green-400 font-bold text-lg mb-1">✓ Sentinel Approved</div>
                    <div className="text-sm text-gray-300">{submitResult.feedback}</div>
                    <div className="text-xs text-gray-500 mt-2">Score: {submitResult.score}/100</div>
                    <div className="text-xs text-green-400 mt-3">{submitResult.message}</div>
                  </div>
                ) : (
                  <div className="bg-red-900/30 border border-red-700 rounded-xl p-5">
                    <div className="text-red-400 font-bold text-lg mb-1">✗ Sentinel Rejected</div>
                    <div className="text-sm text-gray-300">{submitResult.feedback}</div>
                    {submitResult.concerns?.length > 0 && (
                      <ul className="mt-2 text-xs text-gray-400 list-disc list-inside space-y-0.5">
                        {submitResult.concerns.map((c: string, i: number) => <li key={i}>{c}</li>)}
                      </ul>
                    )}
                    {submitResult.suggested_improvements && (
                      <div className="mt-3 text-xs text-yellow-400">💡 {submitResult.suggested_improvements}</div>
                    )}
                  </div>
                )}
                <div className="flex gap-3">
                  {!submitResult.approved && (
                    <button onClick={() => setSubmitResult(null)} className="flex-1 border border-gray-700 hover:border-gray-500 text-gray-300 py-2 rounded-xl text-sm transition-colors">
                      Revise & Resubmit
                    </button>
                  )}
                  <button onClick={() => setShowSubmit(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-xl text-sm transition-colors">
                    {submitResult.approved ? "Close" : "Cancel"}
                  </button>
                  {submitResult.approved && submitResult.proposal && (
                    <Link href={`/proposals/${submitResult.proposal.id}`} className="flex-1 text-center bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-xl text-sm font-semibold transition-colors">
                      View Proposal →
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Registered Projects", value: platformStats?.registered_projects ?? "—" },
          { label: "Total Proposals", value: proposals.length },
          { label: "Executed", value: statusCounts["Executed"] || 0 },
          { label: "In Debate", value: statusCounts["In_Debate"] || 0 },
        ].map((stat) => (
          <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-white">{stat.value}</div>
            <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Proposals list */}
      <div>
        <h2 className="text-xl font-semibold mb-4 text-gray-200">Active Proposals</h2>
        {loading && (
          <div className="text-center py-12 text-gray-500">Loading proposals...</div>
        )}
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-6 text-center text-red-400">
            ⚠️ {error}
          </div>
        )}
        {!loading && !error && proposals.length === 0 && (
          <div className="bg-gray-900 border border-dashed border-gray-700 rounded-xl p-12 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-gray-400">No proposals yet.</p>
            <p className="text-gray-600 text-sm mt-1">Run a Sentinel scan to generate the first proposal.</p>
            <Link href="/sentinel" className="mt-4 inline-block bg-purple-600 hover:bg-purple-500 text-white px-5 py-2 rounded-full text-sm transition-colors">
              Run Sentinel
            </Link>
          </div>
        )}
        <div className="space-y-3">
          {proposals.map((p) => {
            const status = STATUS_LABELS[p.status];
            return (
              <Link key={p.id} href={`/proposals/${p.id}`} className="block">
                <div className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-5 transition-all agent-card">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full text-white ${status?.color || "bg-gray-600"}`}>
                          {status?.label || p.status}
                        </span>
                        {p.project_id && p.project_id !== "XSEN" && (
                          <span className="text-xs bg-blue-900/50 text-blue-300 border border-blue-800/50 rounded-full px-2 py-0.5 font-mono">
                            {p.project_id}
                          </span>
                        )}
                        <span className="text-xs text-gray-600 font-mono">{p.id}</span>
                      </div>
                      <h3 className="font-semibold text-white text-lg leading-tight">{p.title}</h3>
                      <p className="text-gray-400 text-sm mt-1 line-clamp-2">{p.summary}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {p.status === "In_Debate" || p.status === "Executed" ? (
                        <div className="flex gap-3 text-sm">
                          <span className="text-green-400">✓ {p.approve_count}</span>
                          <span className="text-red-400">✗ {p.reject_count}</span>
                        </div>
                      ) : null}
                      <div className="text-xs text-gray-600 mt-1">
                        {new Date(p.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
