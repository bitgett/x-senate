import { NextRequest, NextResponse } from "next/server";
import { runSentinelScan } from "@/lib/agents";
import { dbCreateProposal, dbGetProjectMeta, initSchema } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { getRegistryProjects } from "@/lib/contract";

export const maxDuration = 60; // Vercel Pro: allow up to 60s for Claude

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`${ip}:sentinel_scan`, 3, 60_000)) {
    return NextResponse.json({ detail: "Too many requests. Please wait before retrying." }, { status: 429 });
  }
  try {
    await initSchema();
    const body = await req.json().catch(() => ({}));
    const projectId = (body?.project_id ?? "XSEN").trim().toUpperCase();

    // Validate project_id
    if (projectId !== "XSEN") {
      const [meta, onchain] = await Promise.all([
        dbGetProjectMeta(projectId).catch(() => null),
        getRegistryProjects().catch(() => []),
      ]);
      const inOnchain = (onchain as any[]).some(
        p => (p.projectId ?? p.project_id)?.toUpperCase() === projectId
      );
      if (!meta && !inOnchain) {
        return NextResponse.json({ detail: `Project "${projectId}" is not registered in X-Senate` }, { status: 400 });
      }
    }

    const result = await runSentinelScan();

    if (result.draft_proposal) {
      const draft = result.draft_proposal as Record<string, string>;
      const proposal = await dbCreateProposal({
        project_id: projectId,
        title: draft.title ?? "Untitled",
        summary: draft.summary ?? "",
        motivation: draft.motivation ?? null,
        proposed_action: draft.proposed_action ?? null,
        potential_risks: draft.potential_risks ?? null,
        sentinel_analysis: draft.sentinel_analysis ?? null,
        source_data: draft.source_data ?? null,
        status: "Draft",
        approve_count: 0,
        reject_count: 0,
        snapshot_url: null,
        tx_hash: null,
        one_liner_opinions: null,
      });
      (result as Record<string, unknown>).saved_proposal_id = proposal.id;
    }

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 503 });
  }
}
