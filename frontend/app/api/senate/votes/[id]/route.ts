import { NextRequest, NextResponse } from "next/server";
import { dbGetVotes } from "@/lib/db";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const votes = await dbGetVotes(id);
    return NextResponse.json(votes.map((v) => ({
      agent_name: v.agent_name,
      vote: v.vote,
      reason: v.reason,
      chain_of_thought: v.chain_of_thought,
      confidence: v.confidence,
      reflection_notes: v.reflection_notes,
    })));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 503 });
  }
}
