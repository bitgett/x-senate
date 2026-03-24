import { NextRequest, NextResponse } from "next/server";
import { dbGetDebateTurns } from "@/lib/db";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const turns = await dbGetDebateTurns(id);
    return NextResponse.json(turns.map((t) => ({
      agent_name: t.agent_name,
      turn_order: t.turn_order,
      full_argument: t.full_argument,
      one_liner: t.one_liner,
    })));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 503 });
  }
}
