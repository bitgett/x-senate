import { NextResponse } from "next/server";

const OKX_BASE = "https://web3.okx.com";
const NATIVE_OKB = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

export async function GET() {
  try {
    // POST /api/v6/dex/market/price — batch query: OKB (native) price on X Layer
    const priceRes = await fetch(`${OKX_BASE}/api/v6/dex/market/price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ chainIndex: "196", tokenContractAddress: NATIVE_OKB }]),
      signal: AbortSignal.timeout(5000),
    });

    const candleRes = await fetch(
      `${OKX_BASE}/api/v6/dex/market/candles?chainIndex=196&tokenContractAddress=${NATIVE_OKB}&bar=1H&limit=25`,
      { signal: AbortSignal.timeout(5000) }
    );

    const priceData = await priceRes.json();
    const klineData = await candleRes.json();

    const results: Record<string, unknown> = {
      chain: "X Layer",
      chain_index: "196",
      data_source: "OKX OnchainOS Web3 API v6",
    };

    if (priceData.code === "0" && priceData.data?.[0]) {
      results.ETH = priceData.data[0]; // native OKB on X Layer
    }

    if (klineData.code === "0" && klineData.data?.length >= 2) {
      const kline = klineData.data;
      const latestClose  = parseFloat(kline[0][4]);
      const prevClose    = parseFloat(kline[kline.length - 1][4]);
      if (latestClose && prevClose) {
        results.price_change_24h_pct = parseFloat(
          ((latestClose - prevClose) / prevClose * 100).toFixed(2)
        );
      }
      results.kline_data = kline.slice(0, 5);
    }

    return NextResponse.json(results);
  } catch (e) {
    return NextResponse.json({ detail: `Market API unavailable: ${e}` }, { status: 503 });
  }
}
