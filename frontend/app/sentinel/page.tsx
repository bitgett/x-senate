"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { runSentinelScan } from "@/lib/api";

type MessageItem = {
  source: string;
  author: string;
  content: string;
  classification: "governance" | "chatter";
};

export default function SentinelPage() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  async function handleScan() {
    setScanning(true);
    setError("");
    setResult(null);
    try {
      const data = await runSentinelScan();
      setResult(data);
    } catch (e) {
      setError("Scan failed — is the backend running?");
    } finally {
      setScanning(false);
    }
  }

  const sourceIcon: Record<string, string> = {
    forum: "📋",
    discord: "💬",
    telegram: "📱",
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">🔍 Sentinel Monitor</h1>
        <p className="text-gray-400 mt-1">
          Scans Forum, Discord, and Telegram for governance signals. Generates proposal drafts automatically.
        </p>
      </div>

      {/* Scan Button */}
      <button
        onClick={handleScan}
        disabled={scanning}
        className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl transition-all text-lg"
      >
        {scanning ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Scanning community channels...
          </span>
        ) : "⚡ Run Sentinel Scan"}
      </button>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-400 text-sm">
          ⚠️ {error}
        </div>
      )}

      {result && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Scanned", value: result.total_messages_scanned },
              { label: "Governance", value: result.governance_messages, color: "text-green-400" },
              { label: "Chatter", value: result.chatter_messages, color: "text-gray-400" },
              { label: "Threshold", value: result.threshold_triggered ? "🔥 TRIGGERED" : "Not Triggered", color: result.threshold_triggered ? "text-red-400" : "text-gray-400" },
            ].map((stat) => (
              <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
                <div className={`text-2xl font-bold ${stat.color || "text-white"}`}>{stat.value}</div>
                <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Source breakdown */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Sources</h3>
            <div className="flex gap-4">
              {Object.entries(result.sources || {}).map(([src, count]) => (
                <div key={src} className="flex items-center gap-1.5 text-sm text-gray-400">
                  <span>{sourceIcon[src] || "📌"}</span>
                  <span className="capitalize">{src}</span>
                  <span className="text-white font-semibold">{String(count)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Keyword hits */}
          {result.keyword_counts && Object.keys(result.keyword_counts).length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Keyword Frequency</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(result.keyword_counts)
                  .sort(([, a], [, b]) => Number(b) - Number(a))
                  .map(([kw, count]) => (
                    <span key={kw} className="bg-purple-900/40 border border-purple-700/40 text-purple-300 text-xs px-2 py-1 rounded-full">
                      "{kw}" × {String(count)}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* Messages preview */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Community Feed Preview</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {(result.messages_preview || []).map((msg: MessageItem, i: number) => (
                <div key={i} className={`flex gap-3 p-2 rounded-lg text-sm ${msg.classification === "governance" ? "bg-purple-900/20 border border-purple-800/30" : "bg-gray-800/40"}`}>
                  <span>{sourceIcon[msg.source] || "📌"}</span>
                  <div>
                    <span className="text-gray-400 font-medium">@{msg.author}</span>
                    <span className="text-gray-300 ml-2">{msg.content}</span>
                  </div>
                  {msg.classification === "governance" && (
                    <span className="ml-auto text-xs text-purple-400 font-medium shrink-0">GOV</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Draft proposal */}
          {result.draft_proposal ? (
            <div className="bg-green-900/20 border border-green-700/50 rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-green-400 text-lg">✅</span>
                <h3 className="text-green-400 font-semibold">Draft Proposal Generated</h3>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Title</div>
                <div className="text-white font-semibold text-lg">{result.draft_proposal.title}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Summary</div>
                <div className="text-gray-300 text-sm">{result.draft_proposal.summary}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Sentinel Analysis</div>
                <div className="text-gray-400 text-sm">{result.draft_proposal.sentinel_analysis}</div>
              </div>
              {result.saved_proposal_id && (
                <button
                  onClick={() => router.push(`/proposals/${result.saved_proposal_id}`)}
                  className="w-full mt-2 bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  View Proposal → Send to Senate
                </button>
              )}
            </div>
          ) : result.threshold_triggered === false ? (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 text-center text-gray-400">
              No threshold triggered yet — community chatter hasn't reached governance levels.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
