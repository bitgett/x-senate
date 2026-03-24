"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchProposals, fetchPlatformStats } from "@/lib/api";
import { Proposal, STATUS_LABELS, PERSONA_META } from "@/types";

export default function Home() {
  const [proposals, setProposals]   = useState<Proposal[]>([]);
  const [platformStats, setPlatform] = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");

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
          <Link href="/agents" className="border border-gray-700 hover:border-gray-500 text-gray-300 px-5 py-2 rounded-full text-sm font-medium transition-colors">
            👥 View Genesis 5
          </Link>
        </div>
      </div>

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
