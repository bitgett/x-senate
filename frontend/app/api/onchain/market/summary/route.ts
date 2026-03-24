import { NextResponse } from "next/server";

const OKX_BASE = "https://www.okx.com";
const XLAYER_CHAIN_INDEX = "196";
const NATIVE_ETH = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

export async function GET() {
  try {
    const [priceRes, klineRes] = await Promise.all([
      fetch(`${OKX_BASE}/api/v5/dex/market/price?chainIndex=${XLAYER_CHAIN_INDEX}&tokenAddress=${NATIVE_ETH}`),
      fetch(`${OKX_BASE}/api/v5/dex/market/kline?chainIndex=${XLAYER_CHAIN_INDEX}&tokenAddress=${NATIVE_ETH}&bar=1H`),
    ]);

    const priceData = await priceRes.json();
    const klineData = await klineRes.json();

    const results: Record<string, unknown> = { chain: "X Layer", chain_index: XLAYER_CHAIN_INDEX, data_source: "OKX OnchainOS Market API" };

    if (priceData.code === "0" && priceData.data?.[0]) {
      results.ETH = priceData.data[0];
    }

    if (klineData.code === "0" && klineData.data?.length >= 2) {
      const kline = klineData.data;
      const latestClose = parseFloat(kline[0][4]);
      const prevClose = parseFloat(kline[kline.length - 1][4]);
      if (latestClose && prevClose) {
        results.price_change_24h_pct = parseFloat(((latestClose - prevClose) / prevClose * 100).toFixed(2));
      }
      results.kline_data = kline.slice(0, 5);
    }

    return NextResponse.json(results);
  } catch (e) {
    return NextResponse.json({ detail: `Market API unavailable: ${e}` }, { status: 503 });
  }
}
