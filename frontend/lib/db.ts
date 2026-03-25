/**
 * Database layer — Neon Postgres (Vercel-compatible serverless)
 * Schema: proposals, agent_votes, debate_turns
 */
import { neon } from "@neondatabase/serverless";

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL env var not set");
  return neon(url);
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProposalRow {
  id: string;
  project_id: string;
  title: string;
  summary: string;
  motivation: string | null;
  proposed_action: string | null;
  potential_risks: string | null;
  sentinel_analysis: string | null;
  source_data: string | null;
  status: string;
  approve_count: number;
  reject_count: number;
  snapshot_url: string | null;
  tx_hash: string | null;
  one_liner_opinions: string | null;
  proposer_address?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentVoteRow {
  id: number;
  proposal_id: string;
  agent_name: string;
  vote: string;
  reason: string;
  chain_of_thought: string;
  confidence: number;
  reflection_notes: string | null;
  voted_at?: string | null;
}

export interface DebateTurnRow {
  id: number;
  proposal_id: string;
  agent_name: string;
  turn_order: number;
  full_argument: string;
  one_liner: string | null;
}

// ─── Schema init ─────────────────────────────────────────────────────────────

export async function initSchema() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS proposals (
      id               TEXT PRIMARY KEY,
      project_id       TEXT NOT NULL DEFAULT 'XSEN',
      title            TEXT NOT NULL,
      summary          TEXT NOT NULL,
      motivation       TEXT,
      proposed_action  TEXT,
      potential_risks  TEXT,
      sentinel_analysis TEXT,
      source_data      TEXT,
      status           TEXT DEFAULT 'Draft',
      approve_count    INTEGER DEFAULT 0,
      reject_count     INTEGER DEFAULT 0,
      snapshot_url     TEXT,
      tx_hash          TEXT,
      one_liner_opinions TEXT,
      proposer_address TEXT,
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      updated_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE proposals ADD COLUMN IF NOT EXISTS proposer_address TEXT`;
  await sql`ALTER TABLE agent_votes ADD COLUMN IF NOT EXISTS voted_at TIMESTAMPTZ DEFAULT NOW()`;
  await sql`
    CREATE TABLE IF NOT EXISTS agent_votes (
      id               SERIAL PRIMARY KEY,
      proposal_id      TEXT NOT NULL,
      agent_name       TEXT NOT NULL,
      vote             TEXT NOT NULL,
      reason           TEXT,
      chain_of_thought TEXT,
      confidence       INTEGER DEFAULT 0,
      reflection_notes TEXT,
      voted_at         TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS debate_turns (
      id               SERIAL PRIMARY KEY,
      proposal_id      TEXT NOT NULL,
      agent_name       TEXT NOT NULL,
      turn_order       INTEGER NOT NULL,
      full_argument    TEXT,
      one_liner        TEXT
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS user_agents (
      id               SERIAL PRIMARY KEY,
      wallet_address   TEXT NOT NULL,
      agent_name       TEXT NOT NULL UNIQUE,
      system_prompt    TEXT,
      focus_area       TEXT,
      avatar_base64    TEXT,
      rank             TEXT DEFAULT 'Bronze',
      delegated_vp     NUMERIC DEFAULT 0,
      score            NUMERIC DEFAULT 0,
      created_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE user_agents ADD COLUMN IF NOT EXISTS avatar_base64 TEXT`;
}

// ─── User Agents (UGA) ────────────────────────────────────────────────────────

export interface UGARow {
  id: number;
  wallet_address: string;
  agent_name: string;
  system_prompt: string | null;
  focus_area: string | null;
  avatar_base64: string | null;
  rank: string;
  delegated_vp: number;
  score: number;
  created_at: string;
}

export async function dbListUGAs(): Promise<UGARow[]> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM user_agents ORDER BY score DESC, created_at DESC`;
  return rows as unknown as UGARow[];
}

export async function dbCreateUGA(data: {
  wallet_address: string;
  agent_name: string;
  system_prompt?: string;
  focus_area?: string;
  avatar_base64?: string;
}): Promise<UGARow> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO user_agents (wallet_address, agent_name, system_prompt, focus_area, avatar_base64)
    VALUES (
      ${data.wallet_address}, ${data.agent_name},
      ${data.system_prompt ?? null}, ${data.focus_area ?? null},
      ${data.avatar_base64 ?? null}
    )
    ON CONFLICT (agent_name) DO NOTHING
    RETURNING *
  ` as UGARow[];
  if (!rows[0]) throw new Error(`Agent name "${data.agent_name}" is already taken`);
  return rows[0];
}

export async function dbGetUGAByWallet(walletAddress: string): Promise<UGARow | null> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM user_agents WHERE LOWER(wallet_address) = LOWER(${walletAddress}) LIMIT 1` as UGARow[];
  return rows[0] ?? null;
}

// ─── Proposals ────────────────────────────────────────────────────────────────

export async function dbListProposals(projectId?: string): Promise<ProposalRow[]> {
  const sql = getSql();
  if (projectId) {
    const rows = await sql`SELECT * FROM proposals WHERE project_id = ${projectId} ORDER BY created_at DESC`;
    return rows as unknown as ProposalRow[];
  }
  const rows = await sql`SELECT * FROM proposals ORDER BY created_at DESC`;
  return rows as unknown as ProposalRow[];
}

export async function dbGetProposal(id: string): Promise<ProposalRow | null> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM proposals WHERE id = ${id}` as ProposalRow[];
  return rows[0] ?? null;
}

export async function dbCreateProposal(data: Omit<ProposalRow, "id" | "created_at" | "updated_at"> & { id?: string }): Promise<ProposalRow> {
  const sql = getSql();
  const { v4: uuidv4 } = await import("uuid");
  const id = data.id ?? `${(data.project_id || "XSEN").toUpperCase()}-${uuidv4().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  const rows = await sql`
    INSERT INTO proposals (
      id, project_id, title, summary, motivation, proposed_action,
      potential_risks, sentinel_analysis, source_data, status,
      approve_count, reject_count, proposer_address
    ) VALUES (
      ${id}, ${data.project_id || "XSEN"}, ${data.title}, ${data.summary},
      ${data.motivation ?? null}, ${data.proposed_action ?? null},
      ${data.potential_risks ?? null}, ${data.sentinel_analysis ?? null},
      ${data.source_data ?? null}, ${data.status || "Draft"},
      ${data.approve_count || 0}, ${data.reject_count || 0},
      ${(data as any).proposer_address ?? null}
    ) RETURNING *
  ` as ProposalRow[];
  return rows[0];
}

export async function dbUpdateProposal(id: string, updates: Partial<ProposalRow>): Promise<ProposalRow | null> {
  const sql = getSql();
  const fields = Object.entries(updates)
    .filter(([k]) => !["id", "created_at"].includes(k))
    .map(([k, v]) => ({ k, v }));
  if (!fields.length) return dbGetProposal(id);

  // Build update dynamically using template literals chaining
  let rows: ProposalRow[] = [];
  const { status, approve_count, reject_count, one_liner_opinions, snapshot_url, tx_hash } = updates;
  rows = await sql`
    UPDATE proposals SET
      status            = COALESCE(${status ?? null}, status),
      approve_count     = COALESCE(${approve_count ?? null}, approve_count),
      reject_count      = COALESCE(${reject_count ?? null}, reject_count),
      one_liner_opinions = COALESCE(${one_liner_opinions ?? null}, one_liner_opinions),
      snapshot_url      = COALESCE(${snapshot_url ?? null}, snapshot_url),
      tx_hash           = COALESCE(${tx_hash ?? null}, tx_hash),
      updated_at        = NOW()
    WHERE id = ${id}
    RETURNING *
  ` as ProposalRow[];
  return rows[0] ?? null;
}

export async function dbDeleteProposal(id: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM proposals WHERE id = ${id}`;
}

// ─── Agent Votes ──────────────────────────────────────────────────────────────

export async function dbSaveVote(data: Omit<AgentVoteRow, "id">): Promise<AgentVoteRow> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO agent_votes (proposal_id, agent_name, vote, reason, chain_of_thought, confidence)
    VALUES (${data.proposal_id}, ${data.agent_name}, ${data.vote}, ${data.reason}, ${data.chain_of_thought}, ${data.confidence})
    RETURNING *
  ` as AgentVoteRow[];
  return rows[0];
}

export async function dbGetVotes(proposalId: string): Promise<AgentVoteRow[]> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM agent_votes WHERE proposal_id = ${proposalId}`;
  return rows as unknown as AgentVoteRow[];
}

export async function dbUpdateVoteReflection(proposalId: string, agentName: string, reflection: string): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE agent_votes SET reflection_notes = ${reflection}
    WHERE proposal_id = ${proposalId} AND agent_name = ${agentName}
  `;
}

// ─── Debate Turns ─────────────────────────────────────────────────────────────

export async function dbSaveDebateTurn(data: Omit<DebateTurnRow, "id">): Promise<DebateTurnRow> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO debate_turns (proposal_id, agent_name, turn_order, full_argument, one_liner)
    VALUES (${data.proposal_id}, ${data.agent_name}, ${data.turn_order}, ${data.full_argument}, ${data.one_liner ?? null})
    RETURNING *
  ` as DebateTurnRow[];
  return rows[0];
}

export async function dbGetDebateTurns(proposalId: string): Promise<DebateTurnRow[]> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM debate_turns WHERE proposal_id = ${proposalId} ORDER BY turn_order`;
  return rows as unknown as DebateTurnRow[];
}
