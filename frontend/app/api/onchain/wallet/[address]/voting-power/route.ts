import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  try {
    const { address } = await params;
    const portfolioRes = await fetch(`${req.nextUrl.origin}/api/onchain/wallet/${address}/portfolio`);
    const portfolio = await portfolioRes.json();
    const totalValue = parseFloat(portfolio.total_usd_value ?? "0") || 0;
    return NextResponse.json({
      address,
      estimated_vp: totalValue,
      total_portfolio_usd: totalValue,
      tokens: portfolio.tokens ?? [],
      vp_model: "1 USD = 1 VP (demonstration)",
      chain: "X Layer (chainIndex: 196)",
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 503 });
  }
}
