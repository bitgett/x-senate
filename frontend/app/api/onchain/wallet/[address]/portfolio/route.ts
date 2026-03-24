import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  try {
    const { address } = await params;
    const chains = req.nextUrl.searchParams.get("chains") ?? "196";

    const [totalRes, tokensRes] = await Promise.all([
      fetch(`https://www.okx.com/api/v5/dex/balance/total-value-by-address?address=${address}&chains=${chains}&assetType=0`),
      fetch(`https://www.okx.com/api/v5/dex/balance/all-token-balances-by-address?address=${address}&chains=${chains}`),
    ]);

    const totalData = await totalRes.json();
    const tokensData = await tokensRes.json();

    const portfolio: Record<string, unknown> = {
      address,
      chain: "X Layer",
      chain_index: "196",
      total_usd_value: null,
      tokens: [],
    };

    if (totalData.code === "0" && totalData.data?.[0]) {
      portfolio.total_usd_value = totalData.data[0].totalValue;
    }

    if (tokensData.code === "0" && tokensData.data) {
      const tokens: unknown[] = [];
      for (const chainData of tokensData.data) {
        for (const token of chainData.tokenAssets ?? []) {
          tokens.push({ symbol: token.symbol, balance: token.balance, usd_value: token.tokenValue, token_address: token.tokenAddress });
        }
      }
      portfolio.tokens = tokens;
    }

    return NextResponse.json(portfolio);
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 503 });
  }
}
