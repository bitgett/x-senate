import { NextRequest, NextResponse } from "next/server";
import { dbGetProposal, dbUpdateProposal } from "@/lib/db";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const proposal = await dbGetProposal(id);
    if (!proposal) return NextResponse.json({ detail: "Proposal not found" }, { status: 404 });
    if (proposal.status !== "Approved" && proposal.approve_count < 3) {
      return NextResponse.json({ detail: "Senate approval required (3/5 votes)" }, { status: 400 });
    }
    const updated = await dbUpdateProposal(id, { status: "In_Debate" });
    return NextResponse.json({ ok: true, status: updated?.status });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 503 });
  }
}
