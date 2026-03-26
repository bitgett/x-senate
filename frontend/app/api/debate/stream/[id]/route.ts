/**
 * SSE streaming debate endpoint — replaces WebSocket from FastAPI backend.
 * Client connects via GET and receives Server-Sent Events.
 */
import { NextRequest } from "next/server";
import { dbGetProposal, dbGetDebateTurns, dbSaveDebateTurn, dbUpdateProposal } from "@/lib/db";
import { runRelayDebate } from "@/lib/agents";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`${ip}:debate_stream`, 5, 60_000)) {
    return new Response(JSON.stringify({ error: "Too many requests. Please wait before retrying." }), { status: 429 });
  }
  const { id } = await params;

  const proposal = await dbGetProposal(id);
  if (!proposal) {
    return new Response(JSON.stringify({ error: "Proposal not found" }), { status: 404 });
  }
  if (proposal.status !== "In_Debate") {
    return new Response(JSON.stringify({ error: `Proposal must be In_Debate status, got: ${proposal.status}` }), { status: 400 });
  }

  // If debate turns already exist, replay them without re-running AI
  const existingTurns = await dbGetDebateTurns(id);
  if (existingTurns.length > 0) {
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (data: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        for (const turn of existingTurns) {
          send({ type: "turn_end", agent_name: turn.agent_name, turn_order: turn.turn_order, full_argument: turn.full_argument, one_liner: turn.one_liner });
        }
        const oneLiners = existingTurns.reduce((acc: Record<string, string>, t) => { if (t.one_liner) acc[t.agent_name] = t.one_liner; return acc; }, {});
        send({ type: "summary", one_liners: oneLiners });
        controller.close();
      },
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" } });
  }

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
      const send = (data: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        for await (const event of runRelayDebate(proposalDict)) {
          const ev = event as Record<string, unknown>;
          send(ev);

          if (ev.type === "turn_end") {
            await dbSaveDebateTurn({
              proposal_id: id,
              agent_name: ev.agent_name as string,
              turn_order: ev.turn_order as number,
              full_argument: ev.full_argument as string,
              one_liner: ev.one_liner as string ?? null,
            });
          } else if (ev.type === "summary") {
            await dbUpdateProposal(id, {
              one_liner_opinions: JSON.stringify(ev.one_liners),
            });
          }
        }
      } catch (e) {
        send({ error: String(e) });
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
