"use client";
import { PERSONA_META } from "@/types";

const AGENT_DETAILS: Record<string, { mandate: string; style: string; weights: string[] }> = {
  Guardian: {
    mandate: "Protect the protocol's security, constitutional integrity, and long-term stability above all else.",
    style: "Conservative, skeptical of rapid change. Demands rigorous risk analysis.",
    weights: ["Security: 50%", "Constitution: 30%", "Community: 20%"],
  },
  Merchant: {
    mandate: "Maximize protocol revenue, TVL growth, token value, and capital efficiency.",
    style: "Aggressive and quantitative. Dismisses sentiment without financial backing.",
    weights: ["ROI/Revenue: 60%", "TVL/Liquidity: 25%", "Positioning: 15%"],
  },
  Architect: {
    mandate: "Drive technical innovation, infrastructure reliability, and scalable protocol design.",
    style: "Technical-first. Evaluates feasibility, scalability, and implementation complexity.",
    weights: ["Feasibility: 40%", "Infrastructure: 30%", "Innovation: 20%", "Security: 10%"],
  },
  Diplomat: {
    mandate: "Expand the ecosystem, forge strategic partnerships, ensure reputation integrity.",
    style: "Measured and ecosystem-first. Considers external perceptions and precedents.",
    weights: ["Ecosystem: 40%", "Partnerships: 30%", "Reputation: 20%", "Harmony: 10%"],
  },
  Populist: {
    mandate: "Represent the community voice — especially small token holders and new participants.",
    style: "Passionate, accessible language. Champions fairness and transparency.",
    weights: ["Community: 50%", "Small Holders: 30%", "Accessibility: 20%"],
  },
};

export default function AgentsPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">⚡ Genesis 5</h1>
        <p className="text-gray-400 mt-1">
          The Pentarchy — five AI agents with distinct personas who govern X-Senate.
          Each brings a unique worldview to every proposal debate.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Object.entries(PERSONA_META).map(([name, meta]) => {
          const details = AGENT_DETAILS[name];
          return (
            <div
              key={name}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4 agent-card"
              style={{ borderTopColor: meta.color, borderTopWidth: "3px" }}
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{meta.emoji}</span>
                <div>
                  <div className="font-bold text-white text-lg">{name}</div>
                  <div className="text-xs text-gray-400">{meta.tagline}</div>
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Mandate</div>
                <p className="text-gray-300 text-sm">{details?.mandate}</p>
              </div>

              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Decision Style</div>
                <p className="text-gray-400 text-sm">{details?.style}</p>
              </div>

              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Voting Weights</div>
                <div className="space-y-1">
                  {details?.weights.map((w) => (
                    <div key={w} className="text-xs text-gray-300 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }}></div>
                      {w}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-gray-800">
                <div className="flex items-center gap-2 text-xs text-green-400">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                  Online · Ready to vote
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-gray-300 font-semibold mb-2">🔄 How the Senate Works</h3>
        <ol className="text-gray-400 text-sm space-y-2 list-decimal list-inside">
          <li>Sentinel detects a hot governance topic and generates a draft proposal</li>
          <li>All 5 Genesis agents independently review the draft and vote Approve/Reject</li>
          <li>If 3 or more approve → Proposal advances to Relay Debate</li>
          <li>Agents debate sequentially, each reading prior arguments as context</li>
          <li>Debate summary is pushed to Snapshot (mock) and recorded on-chain</li>
        </ol>
      </div>
    </div>
  );
}
