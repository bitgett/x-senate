import { NextRequest, NextResponse } from "next/server";
import { dbGetProposal, dbGetVotes, dbUpdateVoteReflection } from "@/lib/db";
import { runReflection } from "@/lib/agents";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const proposal = await dbGetProposal(id);
    if (!proposal) return NextResponse.json({ detail: "Proposal not found" }, { status: 404 });

    const votes = await dbGetVotes(id);
    if (!votes.length) return NextResponse.json({ detail: "No agent votes found for this proposal" }, { status: 400 });

    const agentVotes = votes.map((v) => ({
      agent_name: v.agent_name,
      vote: v.vote,
      reason: v.reason,
      chain_of_thought: v.chain_of_thought,
    }));

    const reflections = await runReflection(
      { title: proposal.title, summary: proposal.summary },
      agentVotes,
    );

    for (const [agentName, data] of Object.entries(reflections)) {
      const d = data as { reflection: string };
      await dbUpdateVoteReflection(id, agentName, d.reflection);
    }

    return NextResponse.json(reflections);
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 503 });
  }
}
