import { NextRequest, NextResponse } from "next/server";
import { getUserPositions } from "@/lib/contract";

export async function GET(req: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const stakingAddr = req.nextUrl.searchParams.get("staking_address") ?? undefined;
  const positions = await getUserPositions(address, stakingAddr);
  return NextResponse.json(positions);
}
