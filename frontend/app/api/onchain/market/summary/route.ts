import { NextResponse } from "next/server";

// Price sources (in priority order):
//   1. OKX Exchange REST API v5  (public, no auth)
//   2. CoinGecko Free API        (fallback — works globally)
const OKX_TICKER   = "https://www.okx.com/api/v5/market/ticker";
const OKX_CANDLE   = "https://www.okx.com/api/v5/market/candles";
const CG_PRICE_URL = "https://api.coingecko.com/api/v3/simple/price?ids=okb&vs_currencies=usd&include_24hr_change=true";

export async function GET() {
  try {
    // ── 1. Fetch OKX Exchange ticker + candles ──────────────────────────
    const [tickerRes, candleRes, cgRes] = await Promise.allSettled([
      fetch(`${OKX_TICKER}?instId=OKB-USDT`, { signal: AbortSignal.timeout(5000) }),
      fetch(`${OKX_CANDLE}?instId=OKB-USDT&bar=1H&limit=25`, { signal: AbortSignal.timeout(5000) }),
      fetch(CG_PRICE_URL, { signal: AbortSignal.timeout(5000) }),
    ]);

    const tickerData = tickerRes.status === "fulfilled" && tickerRes.value.ok
      ? await tickerRes.value.json().catch(() => null) : null;
    const candleData = candleRes.status === "fulfilled" && candleRes.value.ok
      ? await candleRes.value.json().catch(() => null) : null;
    const cgData     = cgRes.status    === "fulfilled" && cgRes.value.ok
      ? await cgRes.value.json().catch(() => null) : null;

    const results: Record<string, unknown> = {
      chain: "X Layer",
      chain_index: "196",
    };

    // ── 2. OKX ticker (primary) ─────────────────────────────────────────
    if (tickerData?.code === "0" && tickerData.data?.[0]) {
      const t = tickerData.data[0];
      results.OKB = { price: t.last, open24h: t.open24h };
      results.data_source = "OKX Exchange v5";
      const last    = parseFloat(t.last    ?? "0");
      const open24h = parseFloat(t.open24h ?? "0");
      if (last > 0 && open24h > 0) {
        results.price_change_24h_pct = parseFloat(
          (((last - open24h) / open24h) * 100).toFixed(2)
        );
      }
    }

    // ── 3. CoinGecko fallback if OKX failed ─────────────────────────────
    if (!results.OKB && cgData?.okb) {
      const cg = cgData.okb;
      results.OKB = { price: String(cg.usd ?? "0"), open24h: null };
      results.data_source = "CoinGecko";
      if (cg.usd_24h_change !== undefined) {
        results.price_change_24h_pct = parseFloat(
          Number(cg.usd_24h_change).toFixed(2)
        );
      }
    }

    // ── 4. Candles (price change refinement) ────────────────────────────
    if (candleData?.code === "0" && candleData.data?.length >= 2) {
      const kline = candleData.data;
      // OKX v5 candle format: [ts, o, h, l, c, vol, ...]
      const latestClose = parseFloat(kline[0][4] ?? "0");
      const prevClose   = parseFloat(kline[kline.length - 1][4] ?? "0");
      if (latestClose > 0 && prevClose > 0) {
        results.price_change_24h_pct = parseFloat(
          (((latestClose - prevClose) / prevClose) * 100).toFixed(2)
        );
      }
      results.kline_data = kline.slice(0, 5);
    }

    return NextResponse.json(results);
  } catch (e) {
    return NextResponse.json({ detail: `Market API unavailable: ${e}` }, { status: 503 });
  }
}
