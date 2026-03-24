"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchProposal, getDebateTurns, startDebate } from "@/lib/api";
import { Proposal, DebateTurn, PERSONA_META } from "@/types";

const WS_BASE = "ws://localhost:8000";

type DebateEvent = {
  type: "turn_start" | "chunk" | "turn_end" | "summary" | "done" | "error";
  agent_name?: string;
  turn_order?: number;
  emoji?: string;
  color?: string;
  chunk?: string;
  full_argument?: string;
  one_liner?: string;
  one_liners?: Record<string, string>;
  full_debate?: DebateTurn[];
  error?: string;
};

export default function DebatePage() {
  const { id } = useParams<{ id: string }>();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [turns, setTurns] = useState<Record<string, string>>({});
  const [oneLiners, setOneLiners] = useState<Record<string, string>>({});
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [debating, setDebating] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [existingTurns, setExistingTurns] = useState<DebateTurn[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([fetchProposal(id), getDebateTurns(id)]).then(([p, t]) => {
      setProposal(p);
      setExistingTurns(t);
      if (t.length === 5) {
        // Already debated — show results
        const turnMap: Record<string, string> = {};
        const oliners: Record<string, string> = {};
        t.forEach((turn: DebateTurn) => {
          turnMap[turn.agent_name] = turn.full_argument;
          if (turn.one_liner) oliners[turn.agent_name] = turn.one_liner;
        });
        setTurns(turnMap);
        setOneLiners(oliners);
        setDone(true);
      }
      if (p?.one_liner_opinions) {
        try { setOneLiners(JSON.parse(p.one_liner_opinions)); } catch {}
      }
    });
  }, [id]);

  async function startDebateWS() {
    setDebating(true);
    setTurns({});
    setOneLiners({});
    setActiveAgent(null);
    setDone(false);
    setError("");

    // Make sure status is In_Debate
    try { await startDebate(id); } catch {}

    const ws = new WebSocket(`${WS_BASE}/api/debate/ws/${id}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data: DebateEvent = JSON.parse(event.data);

      if (data.type === "turn_start") {
        setActiveAgent(data.agent_name!);
        setTurns((prev) => ({ ...prev, [data.agent_name!]: "" }));
      } else if (data.type === "chunk") {
        setTurns((prev) => ({
          ...prev,
          [data.agent_name!]: (prev[data.agent_name!] || "") + data.chunk,
        }));
        // Auto-scroll
        if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
      } else if (data.type === "turn_end") {
        setActiveAgent(null);
      } else if (data.type === "summary") {
        setOneLiners(data.one_liners || {});
        setDone(true);
      } else if (data.type === "done") {
        setDebating(false);
      } else if (data.error) {
        setError(data.error);
        setDebating(false);
      }
    };

    ws.onerror = () => {
      setError("WebSocket connection failed — is backend running?");
      setDebating(false);
    };
  }

  const agentOrder = ["Guardian", "Merchant", "Architect", "Diplomat", "Populist"];

  if (!proposal) return <div className="text-gray-400 py-12 text-center">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/" className="hover:text-gray-300">Proposals</Link>
        <span>›</span>
        <Link href={`/proposals/${id}`} className="hover:text-gray-300 truncate">{proposal.title}</Link>
        <span>›</span>
        <span>Debate</span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">⚡ Relay Debate</h1>
          <p className="text-gray-400 text-sm mt-1">
            Agents debate sequentially — each reads prior arguments before responding.
          </p>
        </div>
        {!debating && !done && (
          <button
            onClick={startDebateWS}
            className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2.5 rounded-xl font-semibold transition-colors shrink-0"
          >
            ⚡ Start Debate
          </button>
        )}
        {debating && (
          <div className="flex items-center gap-2 text-purple-400 text-sm">
            <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></div>
            Live debate in progress...
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-400 text-sm">⚠️ {error}</div>
      )}

      {/* Progress bar */}
      {(debating || done) && (
        <div className="flex gap-1">
          {agentOrder.map((name) => {
            const meta = PERSONA_META[name];
            const hasContent = !!turns[name];
            const isActive = activeAgent === name;
            return (
              <div
                key={name}
                className="flex-1 h-1.5 rounded-full transition-all duration-300"
                style={{
                  backgroundColor: hasContent ? meta?.color : isActive ? meta?.color + "88" : "#374151",
                  opacity: isActive ? 1 : hasContent ? 1 : 0.3,
                }}
              />
            );
          })}
        </div>
      )}

      {/* Debate feed */}
      {(debating || Object.keys(turns).length > 0) && (
        <div ref={feedRef} className="space-y-4 max-h-[600px] overflow-y-auto">
          {agentOrder.map((agentName) => {
            const meta = PERSONA_META[agentName];
            const content = turns[agentName];
            const isActive = activeAgent === agentName;
            if (!content && !isActive) return null;
            return (
              <div
                key={agentName}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5"
                style={{ borderLeftColor: meta?.color, borderLeftWidth: "4px" }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{meta?.emoji}</span>
                  <span className="font-semibold text-white">{agentName}</span>
                  <span className="text-xs text-gray-500">{meta?.tagline}</span>
                  {isActive && (
                    <span className="ml-auto text-xs text-purple-400 status-active">● Speaking...</span>
                  )}
                </div>
                <div className={`text-gray-300 text-sm leading-relaxed whitespace-pre-wrap ${isActive && !content ? "cursor-blink" : ""}`}>
                  {content || ""}
                  {isActive && content && <span className="cursor-blink"></span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* One-liner summary */}
      {done && Object.keys(oneLiners).length > 0 && (
        <div className="bg-gray-900 border border-purple-800/40 rounded-xl p-5">
          <h3 className="text-purple-400 font-semibold mb-4">💬 Agent Stances — One-Liners</h3>
          <div className="space-y-3">
            {agentOrder.map((name) => {
              const meta = PERSONA_META[name];
              const line = oneLiners[name];
              if (!line) return null;
              return (
                <div key={name} className="flex items-start gap-3">
                  <span className="text-xl shrink-0">{meta?.emoji}</span>
                  <div>
                    <span className="text-gray-400 font-medium text-sm">{name}: </span>
                    <span className="text-gray-300 text-sm">{line}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CTA after debate */}
      {done && (
        <Link
          href={`/proposals/${id}/execute`}
          className="block w-full text-center bg-green-600 hover:bg-green-500 text-white font-semibold py-4 rounded-xl transition-colors"
        >
          🚀 Execute Proposal → Push to Snapshot
        </Link>
      )}
    </div>
  );
}
