import { NextRequest, NextResponse } from "next/server";
import { dbCreateUGA, initSchema } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const body = await req.json();
    const { wallet_address, agent_name, system_prompt, focus_area, avatar_base64 } = body;

    if (!wallet_address || !agent_name) {
      return NextResponse.json({ detail: "wallet_address and agent_name are required" }, { status: 400 });
    }

    // Limit avatar size to ~200KB base64
    if (avatar_base64 && avatar_base64.length > 280_000) {
      return NextResponse.json({ detail: "Avatar too large. Max 200KB." }, { status: 400 });
    }

    const agent = await dbCreateUGA({ wallet_address, agent_name, system_prompt, focus_area, avatar_base64 });
    return NextResponse.json(agent, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ detail: e.message ?? String(e) }, { status: 400 });
  }
}
