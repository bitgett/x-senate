import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const chainIndex = req.nextUrl.searchParams.get("chain_index") ?? "196";
  const tokenAddress = req.nextUrl.searchParams.get("token_address") ?? "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
  try {
    const res = await fetch(`https://www.okx.com/api/v5/dex/market/price?chainIndex=${chainIndex}&tokenAddress=${tokenAddress}`);
    const data = await res.json();
    if (data.code === "0" && data.data?.[0]) {
      return NextResponse.json({ chain_index: chainIndex, token_address: tokenAddress, ...data.data[0] });
    }
    return NextResponse.json({ price: null, error: data.msg ?? "Price unavailable" });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 503 });
  }
}
