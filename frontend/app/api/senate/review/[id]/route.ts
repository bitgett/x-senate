export const maxDuration = 60;
import { NextRequest } from "next/server";
import { dbGetProposal, dbUpdateProposal, dbSaveVote } from "@/lib/db";
import { runSenateStreaming } from "@/lib/agents";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const proposal = await dbGetProposal(id);
  if (!proposal) {
    return new Response(JSON.stringify({ detail: "Proposal not found" }), { status: 404 });
  }
  if (proposal.status !== "Draft") {
    return new Response(JSON.stringify({ detail: `Proposal status is '${proposal.status}', cannot review` }), { status: 400 });
  }

  await dbUpdateProposal(id, { status: "In_Senate" });

  const proposalDict = {
    title: proposal.title,
    summary: proposal.summary,
    motivation: proposal.motivation ?? "",
    proposed_action: proposal.proposed_action ?? "",
    potential_risks: proposal.potential_risks ?? "",
    sentinel_analysis: proposal.sentinel_analysis ?? "",
  };

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const result of runSenateStreaming(proposalDict)) {
          const r = result as Record<string, unknown>;
          if (r.type === "tally") {
            const tally = r.tally as { approve_count: number; reject_count: number };
            await dbUpdateProposal(id, {
              approve_count: tally.approve_count,
              reject_count: tally.reject_count,
              status: r.status as string,
            });
          } else {
            await dbSaveVote({
              proposal_id: id,
              agent_name: r.agent as string,
              vote: r.vote as string,
              reason: r.reason as string,
              chain_of_thought: r.chain_of_thought as string,
              confidence: r.confidence as number,
              reflection_notes: null,
            });
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(result)}\n\n`));
        }
      } catch (e) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(e) })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
