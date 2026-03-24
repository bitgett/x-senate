const BASE = "http://localhost:8000";

export async function fetchProposals(projectId?: string) {
  const url = projectId
    ? `${BASE}/api/proposals/?project_id=${projectId}`
    : `${BASE}/api/proposals/`;
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
  const res = await fetch(`${BASE}/api/proposals/sentinel/scan`, { method: "POST" });
  if (!res.ok) throw new Error("Sentinel scan failed");
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

export const WS_BASE = "ws://localhost:8000";
