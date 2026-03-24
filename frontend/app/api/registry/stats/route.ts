import { NextResponse } from "next/server";
import { getRegistryProjectCount } from "@/lib/contract";

export async function GET() {
  const count = await getRegistryProjectCount();
  return NextResponse.json({
    registered_projects: count || 1, // minimum 1 (XSEN native)
    platform: "X-Senate AI Governance Platform",
    network: "X Layer (chainId: 196)",
    ai_senate: "Genesis 5 (Guardian, Merchant, Architect, Diplomat, Populist)",
    registration_fee: "1000 XSEN",
    fee_destination: "XSEN staker ecosystem fund",
  });
}
