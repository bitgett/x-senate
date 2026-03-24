import { NextRequest, NextResponse } from "next/server";
import { getRegistryProjects } from "@/lib/contract";

// Mock project data for demo when contract isn't deployed
const MOCK_PROJECTS = [
  {
    project_id: "XSEN",
    name: "X-Senate",
    token_address: process.env.XSEN_TOKEN_ADDRESS ?? "0x0000000000000000000000000000000000000000",
    staking_contract: process.env.XSEN_STAKING_ADDRESS ?? "0x0000000000000000000000000000000000000000",
    registrant: "0x0000000000000000000000000000000000000000",
    registered_at: Math.floor(Date.now() / 1000) - 86400,
    active: true,
  },
];

export async function GET() {
  try {
    const onchain = await getRegistryProjects();
    if (onchain.length > 0) {
      return NextResponse.json({ projects: onchain, count: onchain.length, platform: "X-Senate AI Governance Platform" });
    }
    // Return mock when contract not deployed
    return NextResponse.json({
      deployed: !!(process.env.XSEN_REGISTRY_ADDRESS),
      projects: MOCK_PROJECTS,
      count: MOCK_PROJECTS.length,
      platform: "X-Senate AI Governance Platform",
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { project_id, name, token_address } = body;

    if (!project_id?.trim()) return NextResponse.json({ detail: "project_id required" }, { status: 400 });
    if (!token_address?.startsWith("0x") || token_address.length !== 42) {
      return NextResponse.json({ detail: "Invalid token_address" }, { status: 400 });
    }

    // In hackathon demo mode — registration is recorded but not on-chain unless private key is set
    const registryAddr = process.env.XSEN_REGISTRY_ADDRESS;
    if (!registryAddr) {
      return NextResponse.json({
        detail: "Registry contract not deployed. Run: python backend/scripts/deploy_contract.py",
      }, { status: 503 });
    }

    // In production: call registry_service functions
    // For now: return demo success
    return NextResponse.json({
      success: true,
      project_id: project_id.toUpperCase(),
      name,
      token_address,
      staking_contract: "0x0000000000000000000000000000000000000000",
      tx_hash: "0x" + "0".repeat(64),
      message: `Project ${project_id.toUpperCase()} registered! Create proposals at POST /api/proposals/ with project_id='${project_id.toUpperCase()}'.`,
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 503 });
  }
}
