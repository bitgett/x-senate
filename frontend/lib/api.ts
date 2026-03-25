const BASE = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_BASE ?? "");

export async function fetchProposals(projectId?: string) {
  const url = projectId
    ? `${BASE}/api/proposals?project_id=${projectId}`
    : `${BASE}/api/proposals`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch proposals");
  return res.json();
}

export async function fetchProjects() {
  const res = await fetch(`${BASE}/api/registry/projects`);
  if (!res.ok) throw new Error("Failed to fetch projects");
  return res.json();
}

export async function fetchProject(projectId: string) {
  const res = await fetch(`${BASE}/api/registry/projects/${projectId}`);
  if (!res.ok) throw new Error("Failed to fetch project");
  return res.json();
}

export async function fetchPlatformStats() {
  const res = await fetch(`${BASE}/api/registry/stats`);
  if (!res.ok) throw new Error("Failed to fetch platform stats");
  return res.json();
}

export async function registerProject(data: {
  project_id: string;
  name: string;
  token_address: string;
  staking_address?: string;
}) {
  const res = await fetch(`${BASE}/api/registry/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || "Registration failed");
  }
  return res.json();
}

export async function fetchProposal(id: string) {
  const res = await fetch(`${BASE}/api/proposals/${id}`);
  if (!res.ok) throw new Error("Failed to fetch proposal");
  return res.json();
}

export async function runSentinelScan() {
  const res = await fetch(`${BASE}/api/proposals/sentinel/scan`, {
    method: "POST",
    signal: AbortSignal.timeout(55_000), // 55s client-side abort
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Server error ${res.status}` }));
    throw new Error(err.detail ?? "Sentinel scan failed");
  }
  return res.json();
}

export async function getPersonas() {
  const res = await fetch(`${BASE}/api/personas`);
  if (!res.ok) throw new Error("Failed to fetch personas");
  return res.json();
}

export async function getSenateVotes(proposalId: string) {
  const res = await fetch(`${BASE}/api/senate/votes/${proposalId}`);
  if (!res.ok) throw new Error("Failed to fetch votes");
  return res.json();
}

export async function startDebate(proposalId: string) {
  const res = await fetch(`${BASE}/api/debate/start/${proposalId}`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to start debate");
  return res.json();
}

export async function getDebateTurns(proposalId: string) {
  const res = await fetch(`${BASE}/api/debate/turns/${proposalId}`);
  if (!res.ok) throw new Error("Failed to fetch debate turns");
  return res.json();
}

export async function executeProposal(proposalId: string) {
  const res = await fetch(`${BASE}/api/execute/${proposalId}`, { method: "POST" });
  if (!res.ok) throw new Error("Execution failed");
  return res.json();
}

export async function runReflection(proposalId: string) {
  const res = await fetch(`${BASE}/api/execute/reflect/${proposalId}`, { method: "POST" });
  if (!res.ok) throw new Error("Reflection failed");
  return res.json();
}

/** SSE stream URL for relay debate (replaces WebSocket) */
export function getDebateStreamUrl(proposalId: string) {
  return `${BASE}/api/debate/stream/${proposalId}`;
}

/** SSE stream URL for senate review */
export function getSenateReviewUrl(proposalId: string) {
  return `${BASE}/api/senate/review/${proposalId}`;
}

export async function fetchUGAs() {
  const res = await fetch(`${BASE}/api/uga/`);
  if (!res.ok) throw new Error("Failed to fetch agents");
  return res.json(); // returns UGA[]
}

export async function registerUGA(data: {
  wallet_address: string;
  agent_name: string;
  system_prompt: string;
  focus_area?: string;
}) {
  const res = await fetch(`${BASE}/api/uga/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || "Registration failed");
  }
  return res.json();
}
