import { NextRequest, NextResponse } from "next/server";
import { dbGetProposal, dbDeleteProposal } from "@/lib/db";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const proposal = await dbGetProposal(id);
    if (!proposal) return NextResponse.json({ detail: "Proposal not found" }, { status: 404 });
    return NextResponse.json(proposal);
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 503 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const proposal = await dbGetProposal(id);
    if (!proposal) return NextResponse.json({ detail: "Proposal not found" }, { status: 404 });
    await dbDeleteProposal(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 503 });
  }
}
