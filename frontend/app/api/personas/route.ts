import { NextResponse } from "next/server";
import { PERSONAS, GENESIS_5 } from "@/lib/agents";

export async function GET() {
  return NextResponse.json(
    GENESIS_5.map((name) => ({
      name,
      emoji: PERSONAS[name].emoji,
      tagline: PERSONAS[name].tagline,
      color: PERSONAS[name].color,
    }))
  );
}
