import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const chainIndex = req.nextUrl.searchParams.get("chain_index") ?? "196";
  const limit = req.nextUrl.searchParams.get("limit") ?? "10";
  try {
    const res = await fetch(`https://www.okx.com/api/v5/dex/market/token-list?chainIndex=${chainIndex}&limit=${limit}`);
    const data = await res.json();
    if (data.code === "0") return NextResponse.json(data.data?.tokens ?? []);
    return NextResponse.json([]);
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 503 });
  }
}
