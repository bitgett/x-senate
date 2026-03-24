import { NextRequest, NextResponse } from "next/server";

const MOCK_PROJECTS: Record<string, unknown> = {
  XSEN: {
    project_id: "XSEN",
    name: "X-Senate",
    token_address: process.env.XSEN_TOKEN_ADDRESS ?? "0x0000000000000000000000000000000000000000",
    staking_contract: process.env.XSEN_STAKING_ADDRESS ?? "0x0000000000000000000000000000000000000000",
    registrant: "0x0000000000000000000000000000000000000000",
    registered_at: Math.floor(Date.now() / 1000) - 86400,
    active: true,
  },
};

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const projectId = id.toUpperCase();
    const project = MOCK_PROJECTS[projectId];
    if (!project) return NextResponse.json({ detail: `Project '${projectId}' not found` }, { status: 404 });
    return NextResponse.json(project);
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 503 });
  }
}
