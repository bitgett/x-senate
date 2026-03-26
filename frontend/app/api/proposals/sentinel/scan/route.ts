import { NextRequest, NextResponse } from "next/server";
import { runSentinelScan } from "@/lib/agents";
import { dbCreateProposal, initSchema } from "@/lib/db";

export const maxDuration = 60; // Vercel Pro: allow up to 60s for Claude

export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const body = await req.json().catch(() => ({}));
    const projectId = body?.project_id ?? "XSEN";
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
