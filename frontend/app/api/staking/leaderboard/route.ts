import { NextRequest, NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/contract";

const GENESIS_5_META = [
  { agent: "0x0000000000000000000000000000000000000001", agentName: "Guardian", emoji: "🛡️", color: "#4A90E2" },
  { agent: "0x0000000000000000000000000000000000000002", agentName: "Merchant", emoji: "💰", color: "#F5A623" },
  { agent: "0x0000000000000000000000000000000000000003", agentName: "Architect", emoji: "⚙️", color: "#7ED321" },
  { agent: "0x0000000000000000000000000000000000000004", agentName: "Diplomat", emoji: "🤝", color: "#9B59B6" },
  { agent: "0x0000000000000000000000000000000000000005", agentName: "Populist", emoji: "👥", color: "#E74C3C" },
];

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("project_id") ?? "XSEN";
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "10");
  const onchain = await getLeaderboard(limit);
  // Filter out garbage/test agent names (< 3 chars)
  const validOnchain = (onchain as any[]).filter(a => a.agent_name && a.agent_name.length >= 3);
  if (validOnchain.length > 0) return NextResponse.json({ leaderboard: validOnchain });

  const RANK_LABEL: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th" };
  // Return Genesis 5 with mock VP data when contract not deployed
  return NextResponse.json({ leaderboard:
    GENESIS_5_META.map((a, i) => ({
      rank: i + 1,
      rank_label: RANK_LABEL[i + 1] ?? "",
      agent_name: a.agentName,
      emoji: a.emoji,
      color: a.color,
      total_delegated_vp_xsen: Math.floor(4_200_000 / (i + 1)),
      delegator_count: Math.floor(120 / (i + 1)),
      is_genesis: true,
      creator: null,
      voted_this_epoch: i < 3,
    }))
  });
}
