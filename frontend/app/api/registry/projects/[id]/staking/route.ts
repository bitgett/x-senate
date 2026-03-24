import { NextRequest, NextResponse } from "next/server";
import { getStakingEpochInfo, getTotalStakedInfo } from "@/lib/contract";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const projectId = id.toUpperCase();

    const stakingAddr = projectId === "XSEN" ? process.env.XSEN_STAKING_ADDRESS : undefined;
    if (!stakingAddr && projectId !== "XSEN") {
      return NextResponse.json({ detail: `No staking contract for '${projectId}'` }, { status: 404 });
    }

    const [epoch, totals] = await Promise.all([
      getStakingEpochInfo(stakingAddr),
      getTotalStakedInfo(stakingAddr),
    ]);

    return NextResponse.json({ project_id: projectId, staking_contract: stakingAddr ?? null, epoch, totals });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 503 });
  }
}
