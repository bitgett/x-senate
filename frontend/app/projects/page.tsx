"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchProjects, fetchPlatformStats, registerProject } from "@/lib/api";
import { Project } from "@/types";

const BASE = "";

function truncateAddr(addr: string) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function ProjectsPage() {
  const [projects, setProjects]     = useState<Project[]>([]);
  const [stats, setStats]           = useState<any>(null);
  const [loading, setLoading]       = useState(true);

  // Registration form
  const [formId, setFormId]         = useState("");
  const [formName, setFormName]     = useState("");
  const [formToken, setFormToken]   = useState("");
  const [registering, setReg]       = useState(false);
  const [regResult, setRegResult]   = useState<any>(null);
  const [regError, setRegError]     = useState("");

  // Security scan
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanning, setScanning]     = useState(false);

  useEffect(() => {
    Promise.all([
      fetchProjects().catch(() => null),
      fetchPlatformStats().catch(() => null),
    ]).then(([p, s]) => {
      if (p?.projects) setProjects(p.projects);
      setStats(s);
      setLoading(false);
    });
  }, []);

  async function handleScanToken() {
    if (!formToken.startsWith("0x")) return;
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch(
        `${BASE}/api/onchain/security/scan-token?chain_index=196&token_address=${formToken}`,
        { method: "POST" }
      );
      const data = await res.json();
      setScanResult(data);
    } catch {}
    setScanning(false);
  }

  async function handleRegister() {
    setRegError("");
    setRegResult(null);
    if (!formId.trim() || !formName.trim() || !formToken.trim()) {
      setRegError("All fields required");
      return;
    }
    if (!formToken.startsWith("0x") || formToken.length !== 42) {
      setRegError("Invalid token address");
      return;
    }
    setReg(true);
    try {
      const result = await registerProject({
        project_id:    formId.trim().toUpperCase(),
        name:          formName.trim(),
        token_address: formToken.trim(),
      });
      setRegResult(result);
      // Refresh project list
      const p = await fetchProjects().catch(() => null);
      if (p?.projects) setProjects(p.projects);
      setFormId(""); setFormName(""); setFormToken("");
      setScanResult(null);
    } catch (e: any) {
      setRegError(e.message || "Registration failed");
    }
    setReg(false);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-10">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">🗂️ X-Senate Governance Platform</h1>
        <p className="text-gray-400 mt-1 max-w-2xl">
          Any project on X Layer can use X-Senate's Genesis 5 AI Senate and staking infrastructure.
          One registration — access to AI governance, PoP staking rewards, and on-chain execution.
        </p>
      </div>

      {/* Platform stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Registered Projects", value: stats?.registered_projects ?? projects.length },
          { label: "AI Agents",           value: "5" },
          { label: "Network",             value: "X Layer" },
          { label: "Registration Fee",    value: "1000 XSEN" },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="bg-gray-900/50 border border-purple-800/30 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-3">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-400">
          <div className="flex gap-3">
            <span className="text-2xl">1️⃣</span>
            <div>
              <div className="text-white font-medium mb-1">Register Your Token</div>
              Submit your X Layer ERC20 token address. X-Senate deploys a dedicated staking pool for your community.
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-2xl">2️⃣</span>
            <div>
              <div className="text-white font-medium mb-1">AI Senate Reviews</div>
              The Genesis 5 AI agents (Guardian, Merchant, Architect, Diplomat, Populist) debate and vote on your proposals.
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-2xl">3️⃣</span>
            <div>
              <div className="text-white font-medium mb-1">On-Chain Execution</div>
              Approved proposals are executed on X Layer. Full audit trail with IPFS debate transcripts.
            </div>
          </div>
        </div>
      </div>

      {/* Project grid */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Registered Projects</h2>

        {loading && (
          <div className="text-center py-8 text-gray-500">Loading projects...</div>
        )}

        {!loading && projects.length === 0 && (
          <div className="bg-gray-900 border border-dashed border-gray-700 rounded-xl p-10 text-center">
            <div className="text-4xl mb-3">🏗️</div>
            <p className="text-gray-400">No projects registered yet.</p>
            <p className="text-gray-600 text-sm mt-1">Be the first to register your X Layer project below.</p>
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link key={p.project_id} href={`/projects/${p.project_id}`}>
              <div className="bg-gray-900 border border-gray-800 hover:border-purple-600 rounded-xl p-5 transition-all cursor-pointer h-full">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-lg">{p.project_id}</span>
                      {p.project_id === "XSEN" && (
                        <span className="text-xs bg-purple-800 text-purple-200 rounded-full px-2 py-0.5">Native</span>
                      )}
                      {!p.active && (
                        <span className="text-xs bg-red-900 text-red-300 rounded-full px-2 py-0.5">Inactive</span>
                      )}
                    </div>
                    <div className="text-gray-400 text-sm">{p.name}</div>
                  </div>
                  <div className="text-2xl">
                    {p.project_id === "XSEN" ? "🏛️" : "🔷"}
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-gray-500">
                  <div className="flex justify-between">
                    <span>Token</span>
                    <span className="text-gray-300 font-mono">{truncateAddr(p.token_address)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Staking</span>
                    <span className="text-gray-300 font-mono">{truncateAddr(p.staking_contract)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Registered</span>
                    <span className="text-gray-300">
                      {p.registered_at ? new Date(p.registered_at * 1000).toLocaleDateString() : "—"}
                    </span>
                  </div>
                </div>

                <div className="mt-3 text-xs text-purple-400 font-medium">
                  View governance →
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Registration form */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-1">Register Your Project</h2>
        <p className="text-gray-500 text-sm mb-5">
          Bring X-Senate AI governance to your X Layer community. Registration fee: 1000 XSEN
          (flows to XSEN staker ecosystem fund).
        </p>

        <div className="space-y-4 max-w-lg">
          {/* Project ID */}
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">Project ID</label>
            <input
              type="text"
              placeholder="AAVE"
              value={formId}
              onChange={e => setFormId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              maxLength={12}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 font-mono uppercase"
            />
            <p className="text-xs text-gray-600 mt-1">Uppercase letters and numbers only (max 12 chars)</p>
          </div>

          {/* Project Name */}
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">Project Name</label>
            <input
              type="text"
              placeholder="Aave Protocol"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Token Address */}
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">Token Contract Address (X Layer)</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="0x..."
                value={formToken}
                onChange={e => { setFormToken(e.target.value); setScanResult(null); }}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 font-mono"
              />
              <button
                onClick={handleScanToken}
                disabled={scanning || !formToken.startsWith("0x")}
                className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-2 rounded-lg disabled:opacity-40 transition-colors whitespace-nowrap"
              >
                {scanning ? "Scanning..." : "🔍 Scan"}
              </button>
            </div>

            {/* Security scan result */}
            {scanResult && (
              <div className={`mt-2 p-3 rounded-lg text-xs ${
                scanResult.risk_level === "LOW"
                  ? "bg-green-900/30 border border-green-700/40 text-green-300"
                  : "bg-yellow-900/30 border border-yellow-700/40 text-yellow-300"
              }`}>
                OKX Security: {scanResult.risk_level ?? "Unknown"} risk
                {scanResult.risk_items?.length > 0 && (
                  <span className="ml-2">· {scanResult.risk_items.length} issues found</span>
                )}
              </div>
            )}
          </div>

          {/* Error / success */}
          {regError && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-sm text-red-300">
              {regError}
            </div>
          )}

          {regResult && (
            <div className="bg-green-900/30 border border-green-700 rounded-lg p-3 text-sm text-green-300">
              <div className="font-semibold mb-1">Project registered!</div>
              <div className="font-mono text-xs">{regResult.staking_contract}</div>
              <div className="text-xs mt-1 text-green-400">TX: {regResult.tx_hash}</div>
            </div>
          )}

          <button
            onClick={handleRegister}
            disabled={registering}
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-2.5 rounded-lg disabled:opacity-50 transition-colors text-sm"
          >
            {registering ? "Registering..." : "Register Project (1000 XSEN fee)"}
          </button>
        </div>
      </div>

    </div>
  );
}
