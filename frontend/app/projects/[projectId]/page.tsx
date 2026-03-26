"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ethers } from "ethers";
import { useWallet } from "@/contexts/WalletContext";
import { STATUS_LABELS } from "@/types";

const TOKEN_IFACE = new ethers.Interface(["function transfer(address to, uint256 amount) returns (bool)"]);
const RPC_PROVIDER = new ethers.JsonRpcProvider("https://rpc.xlayer.tech");
async function sendTx(rawProv: any, from: string, to: string, data: string): Promise<string> {
  return await rawProv.request({ method: "eth_sendTransaction", params: [{ from, to, data, gas: "0x3D090" }] });
}
async function waitTx(hash: string): Promise<void> {
  for (let i = 0; i < 60; i++) {
    const r = await RPC_PROVIDER.getTransactionReceipt(hash).catch(() => null);
    if (r) return;
    await new Promise(res => setTimeout(res, 2000));
  }
  throw new Error("Transaction not confirmed after 2 minutes");
}

function truncateAddr(addr: string) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
function fmt(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(2);
}

const GENESIS_5 = [
  { name: "Guardian",  icon: "🛡️", color: "text-blue-400"   },
  { name: "Merchant",  icon: "💰", color: "text-yellow-400" },
  { name: "Architect", icon: "⚙️", color: "text-green-400"  },
  { name: "Diplomat",  icon: "🤝", color: "text-purple-400" },
  { name: "Populist",  icon: "👥", color: "text-red-400"    },
];

export default function ProjectPage() {
  const params    = useParams();
  const router    = useRouter();
  const projectId = (params?.projectId as string ?? "").toUpperCase();
  const { wallet, openModal, rawProvider } = useWallet();

  const [project,  setProject]  = useState<any>(null);
  const [proposals,setProposals]= useState<any[]>([]);
  const [staking,  setStaking]  = useState<any>(null);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Submit Proposal modal
  const [showSubmit,    setShowSubmit]    = useState(false);
  const [subTitle,      setSubTitle]      = useState("");
  const [subSummary,    setSubSummary]    = useState("");
  const [subMotivation, setSubMotivation] = useState("");
  const [subAction,     setSubAction]     = useState("");
  const [submitting,    setSubmitting]    = useState(false);
  const [subError,      setSubError]      = useState("");
  const [subPayStep,    setSubPayStep]    = useState<"idle"|"fetching"|"paying"|"verifying"|"done">("idle");
  // retryTxHash persists across modal close so a paid-but-failed submission can retry without a second payment
  const [retryTxHash,   setRetryTxHash]   = useState<string|null>(null);

  // Sentinel
  const [runningSentinel, setRunningSentinel] = useState(false);
  const [sentinelResult,  setSentinelResult]  = useState<any>(null);

  useEffect(() => {
    if (!projectId) return;
    Promise.all([
      fetch(`/api/registry/projects/${projectId}`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`/api/proposals?project_id=${projectId}`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`/api/registry/projects/${projectId}/staking`).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([proj, props, stk]) => {
      if (!proj || proj.detail) {
        // Try loading from registry API which merges on-chain + DB
        fetch("/api/registry/projects")
          .then(r => r.json())
          .then(d => {
            const found = d.projects?.find((p: any) => p.project_id === projectId);
            if (!found) { setNotFound(true); }
            else { setProject(found); }
            setLoading(false);
          });
      } else {
        setProject(proj);
        setProposals(Array.isArray(props) ? props : (props?.proposals ?? []));
        setStaking(stk);
        setLoading(false);
      }
    });
  }, [projectId]);

  async function handleSubmitProposal() {
    if (!wallet) { openModal(); return; }
    if (!subTitle.trim() || !subSummary.trim()) { setSubError("Title and summary are required."); return; }
    setSubmitting(true); setSubError(""); setSubPayStep("idle");
    try {
      let txHash = retryTxHash;

      // Pay if no valid tx hash from a prior attempt
      if (!txHash) {
        setSubPayStep("fetching");
        const quoteRes = await fetch("/api/x402/quote");
        const quote = await quoteRes.json();
        setSubPayStep("paying");
        txHash = await sendTx(rawProvider(), wallet, quote.xsen_token,
          TOKEN_IFACE.encodeFunctionData("transfer", [quote.treasury, BigInt(quote.xsen_amount_wei)]));
        setRetryTxHash(txHash); // persist so modal close doesn't lose it
        setSubPayStep("verifying");
        await waitTx(txHash);
      }

      setSubPayStep("done");
      const res = await fetch("/api/proposals/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id:       projectId,
          title:            subTitle.trim(),
          summary:          subSummary.trim(),
          motivation:       subMotivation.trim() || null,
          proposed_action:  subAction.trim() || null,
          proposer_address: wallet,
          payment_tx_hash:  txHash,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Submission failed");
      // Success — clear everything including the retry hash
      setRetryTxHash(null);
      setShowSubmit(false);
      setSubTitle(""); setSubSummary(""); setSubMotivation(""); setSubAction("");
      router.push(`/proposals/${data.proposal?.id ?? data.id}`);
    } catch (e: any) {
      setSubError(e.message ?? "Submission failed");
      // retryTxHash is intentionally NOT cleared here — lets user retry without paying again
    }
    setSubmitting(false);
    setSubPayStep("idle");
  }

  async function handleRunSentinel() {
    setRunningSentinel(true);
    setSentinelResult(null);
    try {
      const res = await fetch("/api/proposals/sentinel/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId }),
      });
      const data = await res.json();
      setSentinelResult(data);
      // Refresh proposals if a draft was saved
      if (data.saved_proposal_id) {
        const updated = await fetch(`/api/proposals?project_id=${projectId}`).then(r => r.ok ? r.json() : []);
        setProposals(Array.isArray(updated) ? updated : (updated?.proposals ?? []));
      }
    } catch (e: any) {
      setSentinelResult({ error: e.message ?? "Sentinel scan failed" });
    }
    setRunningSentinel(false);
  }

  if (loading) return <div className="flex items-center justify-center min-h-64 text-gray-500">Loading project...</div>;

  if (notFound) return (
    <div className="max-w-2xl mx-auto text-center py-16">
      <div className="text-4xl mb-4">❓</div>
      <h1 className="text-2xl font-bold text-white mb-2">Project Not Found</h1>
      <p className="text-gray-400 mb-6">"{projectId}" is not registered in X-Senate.</p>
      <Link href="/projects" className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-full text-sm transition-colors">
        Back to Projects
      </Link>
    </div>
  );

  const statusCounts = proposals.reduce((acc: any, p: any) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc; }, {});

  return (
    <div className="max-w-4xl mx-auto space-y-8">

      {/* Back */}
      <Link href="/projects" className="text-sm text-gray-500 hover:text-gray-300 transition-colors inline-block">
        ← All Projects
      </Link>

      {/* Project header */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              {project?.logo_base64 ? (
                <img src={project.logo_base64} alt={project.project_id} className="w-12 h-12 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center text-2xl shrink-0">
                  {project?.project_id === "XSEN" ? "🏛️" : "🔷"}
                </div>
              )}
              <h1 className="text-3xl font-bold text-white">{project?.name}</h1>
              <span className="text-sm bg-gray-800 text-gray-300 rounded-full px-3 py-0.5 font-mono">{project?.project_id}</span>
              {project?.project_id === "XSEN" && (
                <span className="text-xs bg-purple-800 text-purple-200 rounded-full px-2 py-0.5">Native</span>
              )}
            </div>
            {project?.description && (
              <p className="text-gray-400 text-sm mt-1 mb-3">{project.description}</p>
            )}
            <div className="text-sm text-gray-500 space-y-1">
              <div>Token: <a href={`https://www.oklink.com/xlayer/address/${project?.token_address}`} target="_blank" rel="noopener noreferrer" className="font-mono text-blue-400 hover:underline">{truncateAddr(project?.token_address ?? "")}</a></div>
            </div>
            {/* Social links */}
            {(project?.twitter || project?.discord || project?.telegram) && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {project.twitter && (
                  <a href={project.twitter} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-400 bg-blue-900/20 border border-blue-800/30 px-3 py-1 rounded-full hover:bg-blue-900/40 transition-colors">
                    𝕏 Twitter
                  </a>
                )}
                {project.discord && (
                  <a href={project.discord} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-indigo-400 bg-indigo-900/20 border border-indigo-800/30 px-3 py-1 rounded-full hover:bg-indigo-900/40 transition-colors">
                    Discord
                  </a>
                )}
                {project.telegram && (
                  <a href={project.telegram} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-sky-400 bg-sky-900/20 border border-sky-800/30 px-3 py-1 rounded-full hover:bg-sky-900/40 transition-colors">
                    Telegram
                  </a>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={() => wallet ? setShowSubmit(true) : openModal()}
              className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-4 py-2 rounded-full text-sm transition-colors"
              style={{ boxShadow: "0 0 12px rgba(139,92,246,0.3)" }}
            >
              + Submit Proposal
            </button>
          </div>
        </div>
      </div>

      {/* Genesis 5 Connected */}
      <div className="border border-purple-800/40 bg-purple-900/10 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm font-semibold text-white">Genesis 5 Senate</span>
            <span className="text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded-full">Connected</span>
          </div>
          <span className="text-xs text-gray-500">AI agents vote on all proposals</span>
        </div>
        <div className="flex gap-3 flex-wrap">
          {GENESIS_5.map(a => (
            <div key={a.name} className="flex items-center gap-1.5 bg-gray-900/60 border border-gray-800/60 rounded-full px-3 py-1">
              <span className="text-sm">{a.icon}</span>
              <span className={`text-xs font-medium ${a.color}`}>{a.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sentinel Scanner */}
      <div className="border border-gray-800/60 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">🔍</span>
            <span className="text-sm font-semibold text-white">Sentinel Scanner</span>
            <span className="text-xs text-gray-500">AI-powered proposal discovery</span>
          </div>
          <button
            onClick={handleRunSentinel}
            disabled={runningSentinel}
            className="bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-semibold text-xs px-4 py-1.5 rounded-full transition-colors"
          >
            {runningSentinel ? "Scanning..." : "Run Sentinel"}
          </button>
        </div>
        {runningSentinel && (
          <div className="flex items-center gap-2 text-xs text-orange-300 bg-orange-900/20 border border-orange-700/30 rounded-lg p-3">
            <div className="w-3 h-3 rounded-full border-2 border-orange-400 border-t-transparent animate-spin shrink-0" />
            Sentinel is scanning community signals and generating a draft proposal... (may take up to 30s)
          </div>
        )}
        {sentinelResult && !runningSentinel && (
          <div className={`text-xs rounded-lg p-3 ${sentinelResult.error
            ? "bg-red-900/20 border border-red-700/30 text-red-400"
            : "bg-green-900/20 border border-green-700/30 text-green-400"
          }`}>
            {sentinelResult.error ? (
              <span>Scan failed: {sentinelResult.error}</span>
            ) : sentinelResult.saved_proposal_id ? (
              <span>Draft proposal created: <a href={`/proposals/${sentinelResult.saved_proposal_id}`} className="underline font-mono">{sentinelResult.saved_proposal_id}</a></span>
            ) : (
              <span>Scan complete — {sentinelResult.summary ?? "no actionable signals found"}</span>
            )}
          </div>
        )}
      </div>

      {/* Staking stats */}
      {staking && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Staked", value: staking.totals?.total_staked_xsen != null ? fmt(staking.totals.total_staked_xsen) + " XSEN" : "—", color: "text-white" },
            { label: "Effective VP", value: staking.totals?.total_effective_vp_xsen != null ? fmt(staking.totals.total_effective_vp_xsen) : "—", color: "text-purple-300" },
            { label: "Epoch",        value: staking.epoch?.epoch_id != null ? `#${staking.epoch.epoch_id}` : "—", color: "text-blue-300" },
            { label: "Reward Pool",  value: staking.epoch?.reward_pool_xsen != null ? fmt(staking.epoch.reward_pool_xsen) + " XSEN" : "—", color: "text-green-300" },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Governance Proposals</h2>
          <button
            onClick={() => wallet ? setShowSubmit(true) : openModal()}
            className="text-xs border border-purple-700/50 hover:border-purple-500 text-purple-400 hover:text-purple-300 px-3 py-1.5 rounded-lg transition-colors"
          >
            + New Proposal
          </button>
        </div>
        {proposals.length === 0 ? (
          <div className="bg-gray-900 border border-dashed border-gray-700 rounded-xl p-10 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-gray-400 mb-2">No proposals yet for {project?.name}.</p>
            <button
              onClick={() => wallet ? setShowSubmit(true) : openModal()}
              className="text-sm bg-purple-600 hover:bg-purple-500 text-white px-5 py-2 rounded-full transition-colors"
            >
              Submit First Proposal
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {proposals.map((p: any) => {
              const statusInfo = (STATUS_LABELS as any)[p.status];
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
                        {(p.approve_count > 0 || p.reject_count > 0) && (
                          <div className="flex gap-3 text-sm">
                            <span className="text-green-400">✓ {p.approve_count}</span>
                            <span className="text-red-400">✗ {p.reject_count}</span>
                          </div>
                        )}
                        <div className="text-xs text-gray-600 mt-1">{new Date(p.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Submit Proposal Modal */}
      {showSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowSubmit(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-white">Submit Proposal</h3>
                <p className="text-xs text-gray-500 mt-0.5">{project?.name} · Reviewed by Genesis 5 Senate</p>
              </div>
              <button onClick={() => setShowSubmit(false)} className="text-gray-600 hover:text-gray-400 text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">Title *</label>
                <input type="text" placeholder="e.g. Increase staking rewards by 15%" value={subTitle}
                  onChange={e => setSubTitle(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">Summary *</label>
                <textarea placeholder="Brief description of what this proposal does..." value={subSummary}
                  onChange={e => setSubSummary(e.target.value)} rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">Motivation</label>
                <textarea placeholder="Why is this proposal needed?" value={subMotivation}
                  onChange={e => setSubMotivation(e.target.value)} rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">Proposed Action</label>
                <textarea placeholder="Specific actions to be taken if approved..." value={subAction}
                  onChange={e => setSubAction(e.target.value)} rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>
              {retryTxHash && !submitting && (
                <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-lg p-2.5 text-[11px] text-yellow-400">
                  Payment already sent — retrying submission without a second charge.
                </div>
              )}
              {submitting && subPayStep !== "idle" && subPayStep !== "done" && (
                <div className="flex gap-3 text-[11px]">
                  {(["fetching","paying","verifying","done"] as const).map((s, i) => {
                    const idx = ["fetching","paying","verifying","done"].indexOf(subPayStep);
                    return (
                      <span key={s} className={i < idx ? "text-green-400" : i === idx ? "text-yellow-300 font-semibold" : "text-gray-600"}>
                        {i < idx ? "✓" : i === idx ? "→" : "○"} {["Quote","Paying","Verifying","AI Review"][i]}
                      </span>
                    );
                  })}
                </div>
              )}
              {subError && <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-sm text-red-300">{subError}</div>}
              <div className="flex gap-3">
                <button onClick={() => setShowSubmit(false)}
                  className="flex-1 border border-gray-700 text-gray-400 hover:text-gray-300 py-2.5 rounded-xl text-sm transition-colors">
                  Cancel
                </button>
                <button onClick={handleSubmitProposal} disabled={submitting}
                  className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
                  {submitting ? "Submitting..." : retryTxHash ? "Retry Submission →" : "Pay & Submit (~$10 in XSEN) →"}
                </button>
              </div>
              <p className="text-[11px] text-gray-700 text-center">Genesis 5 AI agents will review and vote on this proposal</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
