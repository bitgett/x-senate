import { NextRequest, NextResponse } from "next/server";
import { getStakingEpochInfo } from "@/lib/contract";

export async function GET(req: NextRequest) {
  const stakingAddr = req.nextUrl.searchParams.get("staking_address") ?? undefined;
  const info = await getStakingEpochInfo(stakingAddr);
  return NextResponse.json(info);
}
