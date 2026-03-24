import { NextRequest, NextResponse } from "next/server";
import { dbListProposals, dbCreateProposal, initSchema } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    await initSchema();
    const projectId = req.nextUrl.searchParams.get("project_id") ?? undefined;
    const proposals = await dbListProposals(projectId);
    return NextResponse.json(proposals);
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const body = await req.json();
    if (!body.title || !body.summary) {
      return NextResponse.json({ detail: "title and summary required" }, { status: 400 });
    }
    const proposal = await dbCreateProposal({
      project_id: body.project_id ?? "XSEN",
      title: body.title,
      summary: body.summary,
      motivation: body.motivation ?? null,
      proposed_action: body.proposed_action ?? null,
      potential_risks: body.potential_risks ?? null,
      sentinel_analysis: body.sentinel_analysis ?? null,
      source_data: body.source_data ?? null,
      status: body.status ?? "Draft",
      approve_count: 0,
      reject_count: 0,
      snapshot_url: null,
      tx_hash: null,
      one_liner_opinions: null,
    });
    return NextResponse.json(proposal, { status: 201 });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 503 });
  }
}
