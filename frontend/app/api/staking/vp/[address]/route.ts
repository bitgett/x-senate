import { NextRequest, NextResponse } from "next/server";
import { getEffectiveVP } from "@/lib/contract";

export async function GET(req: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const stakingAddr = req.nextUrl.searchParams.get("staking_address") ?? undefined;
  const vp = await getEffectiveVP(address, stakingAddr);
  return NextResponse.json({ address, effective_vp: vp });
}
