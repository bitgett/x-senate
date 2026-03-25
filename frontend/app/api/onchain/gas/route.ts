import { NextResponse } from "next/server";

const XLAYER_RPC = "https://rpc.xlayer.tech";

export async function GET() {
  try {
    // Use X Layer RPC directly — OKX pre-transaction API doesn't index chainIndex=196 gas
    const res = await fetch(XLAYER_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_gasPrice", params: [] }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    const gasPriceWei = parseInt(data.result, 16);
    const gwei = gasPriceWei / 1e9;

    return NextResponse.json({
      chain: "X Layer",
      chain_index: "196",
      gas_prices: {
        normal: gwei.toFixed(4),
        fast:   (gwei * 1.25).toFixed(4),
        rapid:  (gwei * 1.5).toFixed(4),
      },
      note: "X Layer supports gasless transactions via OKX infrastructure",
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 503 });
  }
}
