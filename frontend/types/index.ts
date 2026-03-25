export type ProposalStatus =
  | "Draft"
  | "In_Senate"
  | "Rejected_Senate"
  | "In_Debate"
  | "Executed"
  | "Rejected";

export interface Proposal {
  id: string;
  project_id?: string;
  title: string;
  summary: string;
  motivation?: string;
  proposed_action?: string;
  potential_risks?: string;
  sentinel_analysis?: string;
  status: ProposalStatus;
  approve_count: number;
  reject_count: number;
  snapshot_url?: string;
  tx_hash?: string;
  one_liner_opinions?: string;
  proposer_address?: string;
  created_at: string;
}

export interface Project {
  project_id:       string;
  name:             string;
  token_address:    string;
  staking_contract: string;
  registrant:       string;
  registered_at:    number;
  active:           boolean;
}

export interface AgentVote {
  agent_name: string;
  vote: "Approve" | "Reject";
  reason: string;
  chain_of_thought: string;
  confidence: number;
  reflection_notes?: string;
  voted_at?: string;
}

export interface DebateTurn {
  agent_name: string;
  turn_order: number;
  full_argument: string;
  one_liner?: string;
}

export interface Persona {
  name: string;
  emoji: string;
  tagline: string;
  color: string;
}

export interface UGA {
  id: string;
  wallet_address: string;
  agent_name: string;
  focus_area?: string;
  rank: "Bronze" | "Silver" | "Gold";
  delegated_vp: number;
  score: number;
}

export const PERSONA_META: Record<string, { emoji: string; color: string; tagline: string }> = {
  Guardian:  { emoji: "🛡️", color: "#4A90E2", tagline: "Security & Constitution" },
  Merchant:  { emoji: "💰", color: "#F5A623", tagline: "Capital Efficiency" },
  Architect: { emoji: "⚙️", color: "#7ED321", tagline: "Technical Innovation" },
  Diplomat:  { emoji: "🤝", color: "#9B59B6", tagline: "Ecosystem Expansion" },
  Populist:  { emoji: "👥", color: "#E74C3C", tagline: "Community Voice" },
};

export const STATUS_LABELS: Record<ProposalStatus, { label: string; color: string }> = {
  Draft:           { label: "Draft",            color: "bg-gray-500" },
  In_Senate:       { label: "Senate Review",    color: "bg-blue-500" },
  Rejected_Senate: { label: "Senate Rejected",  color: "bg-red-600" },
  In_Debate:       { label: "In Debate",        color: "bg-yellow-500" },
  Executed:        { label: "Executed",         color: "bg-green-500" },
  Rejected:        { label: "Rejected",         color: "bg-red-500" },
};
