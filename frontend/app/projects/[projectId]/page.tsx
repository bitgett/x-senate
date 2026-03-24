"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchProject, fetchProposals } from "@/lib/api";
import { Proposal, Project, STATUS_LABELS } from "@/types";

const BASE = "http://localhost:8000";

function truncateAddr(addr: string) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

function formatXSEN(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000)     return `${(val / 1_000).toFixed(1)}K`;
  return val.toFixed(2);
}

export default function ProjectPage() {
  const params = useParams();
  const projectId = (params?.projectId as string ?? "").toUpperCase();

  const [project, setProject]     = useState<Project | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [staking, setStaking]     = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [notFound, setNotFound]   = useState(false);

  useEffect(() => {
    if (!projectId) return;
    Promise.all([
      fetchProject(projectId).catch(() => null),
      fetchProposals(projectId).catch(() => []),
      fetch(`${BASE}/api/registry/projects/${projectId}/staking`).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([proj, props, stk]) => {
      if (!proj || proj.detail) {
        setNotFound(true);
      } else {
        setProject(proj);
        setProposals(Array.isArray(props) ? props : []);
        setStaking(stk);
      }
      setLoading(false);
    });
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64 text-gray-500">
        Loading project...
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <div className="text-4xl mb-4">❓</div>
        <h1 className="text-2xl font-bold text-white mb-2">Project Not Found</h1>
        <p className="text-gray-400 mb-6">"{projectId}" is not registered in X-Senate.</p>
        <Link href="/projects" className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-full text-sm transition-colors">
          Back to Projects
        </Link>
      </div>
    );
  }

  const statusCounts = proposals.reduce(
    (acc, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc; },
    {} as Record<string, number>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8">

      {/* Back */}
      <Link href="/projects" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
        ← All Projects
      </Link>

      {/* Project header */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold text-white">{project?.name}</h1>
              <span className="text-sm bg-gray-800 text-gray-300 rounded-full px-3 py-0.5 font-mono">
                {project?.project_id}
              </span>
              {project?.project_id === "XSEN" && (
                <span className="text-xs bg-purple-800 text-purple-200 rounded-full px-2 py-0.5">Native</span>
              )}
            </div>
            <div className="text-sm text-gray-500 space-y-1">
              <div>
                Token:{" "}
                <a
                  href={`https://www.oklink.com/xlayer/address/${project?.token_address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-blue-400 hover:underline"
                >
                  {truncateAddr(project?.token_address ?? "")}
                </a>
              </div>
              <div>
                Staking:{" "}
                <a
                  href={`https://www.oklink.com/xlayer/address/${project?.staking_contract}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-blue-400 hover:underline"
                >
                  {truncateAddr(project?.staking_contract ?? "")}
                </a>
              </div>
            </div>
          </div>
          <div className="text-4xl">🔷</div>
        </div>
      </div>

      {/* Staking stats */}
      {staking && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">Staking Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">Total Staked</div>
              <div className="text-xl font-bold text-white">
                {staking.totals?.total_staked_xsen != null
                  ? formatXSEN(staking.totals.total_staked_xsen)
                  : "—"}
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">Effective VP</div>
              <div className="text-xl font-bold text-purple-300">
                {staking.totals?.total_effective_vp_xsen != null
                  ? formatXSEN(staking.totals.total_effective_vp_xsen)
                  : "—"}
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">Epoch</div>
              <div className="text-xl font-bold text-blue-300">#{staking.epoch?.epoch_id ?? "—"}</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">Reward Pool</div>
              <div className="text-xl font-bold text-green-300">
                {staking.epoch?.reward_pool_xsen != null
                  ? formatXSEN(staking.epoch.reward_pool_xsen)
                  : "—"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Proposal stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Proposals", value: proposals.length },
          { label: "In Debate",       value: statusCounts["In_Debate"] || 0 },
          { label: "Executed",        value: statusCounts["Executed"] || 0 },
          { label: "Rejected",        value: (statusCounts["Rejected_Senate"] || 0) + (statusCounts["Rejected"] || 0) },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Proposals list */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Governance Proposals</h2>

        {proposals.length === 0 ? (
          <div className="bg-gray-900 border border-dashed border-gray-700 rounded-xl p-10 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-gray-400">No proposals yet for {project?.name}.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {proposals.map((p) => {
              const statusInfo = STATUS_LABELS[p.status];
              return (
                <Link key={p.id} href={`/proposals/${p.id}`} className="block">
                  <div className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-5 transition-all">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full text-white ${statusInfo?.color || "bg-gray-600"}`}>
                            {statusInfo?.label || p.status}
                          </span>
                          <span className="text-xs text-gray-600 font-mono">{p.id}</span>
                        </div>
                        <h3 className="font-semibold text-white text-lg leading-tight">{p.title}</h3>
                        <p className="text-gray-400 text-sm mt-1 line-clamp-2">{p.summary}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {(p.status === "In_Debate" || p.status === "Executed") && (
                          <div className="flex gap-3 text-sm">
                            <span className="text-green-400">✓ {p.approve_count}</span>
                            <span className="text-red-400">✗ {p.reject_count}</span>
                          </div>
                        )}
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
        )}
      </div>

    </div>
  );
}
