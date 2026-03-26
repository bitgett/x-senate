import { NextResponse } from "next/server";
import { dbListUGAs, initSchema } from "@/lib/db";

export async function GET() {
  try {
    await initSchema();
    const agents = await dbListUGAs();
    return NextResponse.json(agents.filter((a: any) => a.agent_name && a.agent_name.trim().length >= 3));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 503 });
  }
}
