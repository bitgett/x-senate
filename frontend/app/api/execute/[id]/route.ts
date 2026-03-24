import { NextRequest, NextResponse } from "next/server";
import { dbGetProposal, dbUpdateProposal } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

function mockSnapshotSubmit(proposal: { title: string; summary: string; proposed_action: string | null }) {
  const id = `0x${uuidv4().replace(/-/g, "")}`;
  return {
    id,
    url: `https://snapshot.org/#/x-senate.eth/proposal/${id}`,
    status: "active",
    title: proposal.title,
    space: "x-senate.eth",
    network: "196",
  };
}

function mockChainRecord(snapshotId: string) {
  return {
    tx_hash: `0x${uuidv4().replace(/-/g, "")}`,
    block: Math.floor(Math.random() * 1_000_000 + 5_000_000),
    chain: "X Layer",
    snapshot_id: snapshotId,
    timestamp: new Date().toISOString(),
  };
}

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const proposal = await dbGetProposal(id);
    if (!proposal) return NextResponse.json({ detail: "Proposal not found" }, { status: 404 });
    if (proposal.status !== "In_Debate") {
      return NextResponse.json({ detail: `Cannot execute from status: ${proposal.status}` }, { status: 400 });
    }

    const snapshot = mockSnapshotSubmit({
      title: proposal.title,
      summary: proposal.summary,
      proposed_action: proposal.proposed_action,
    });
    const chain = mockChainRecord(snapshot.id);

    await dbUpdateProposal(id, {
      status: "Executed",
      snapshot_url: snapshot.url,
      tx_hash: chain.tx_hash,
    });

    return NextResponse.json({
      proposal_id: id,
      status: "Executed",
      snapshot,
      chain,
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 503 });
  }
}
