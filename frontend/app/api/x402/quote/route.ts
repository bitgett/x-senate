/**
 * GET /api/x402/quote
 * Returns the XSEN amount required for a $10 payment.
 * Price sources (in priority order):
 *   1. OKX Web3 Market API v6  (POST web3.okx.com/api/v6/dex/market/price)
 *   2. On-chain pool via X Layer RPC  (getReserves on XSEN liquidity pool)
 *   3. Fallback $0.01
 */
import { NextResponse } from "next/server";

const XSEN_ADDRESS   = "0x1bAB744c4c98D844984e297744Cb6b4E24e2E89b";
const XSEN_POOL      = "0xb524efba890ed7087a4188b9b0148eb7fb954da9"; // X Layer DEX pool
const TREASURY       = "0x8266D8e3B231dfD16fa21e40Cc3B99F38bC4B6C2";
const XLAYER_RPC     = "https://rpc.xlayer.tech";
const USD_FEE        = 10;
const FALLBACK_PRICE = 0.01;

// ── OKX DEX Market API v6 ──────────────────────────────────────────────────
async function tryOkxMarketV6(): Promise<number | null> {
  try {
    const res = await fetch("https://web3.okx.com/api/v6/dex/market/price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ chainIndex: "196", tokenContractAddress: XSEN_ADDRESS }]),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    const price = parseFloat(data?.data?.[0]?.price ?? "0");
    return price > 0 ? price : null;
  } catch {
    return null;
  }
}

// ── On-chain pool price via X Layer RPC ────────────────────────────────────
async function ethCall(to: string, data: string): Promise<string> {
  const res = await fetch(XLAYER_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "eth_call",
      params: [{ to, data }, "latest"],
    }),
    signal: AbortSignal.timeout(5000),
  });
  const json = await res.json();
  return json.result ?? "0x";
}

async function tryPoolPrice(): Promise<number | null> {
  try {
    // Read token0, token1, and reserves in parallel
    const [t0raw, t1raw, reservesRaw] = await Promise.all([
      ethCall(XSEN_POOL, "0x0dfe1681"), // token0()
      ethCall(XSEN_POOL, "0xd21220a7"), // token1()
      ethCall(XSEN_POOL, "0x0902f1ac"), // getReserves()
    ]);

    if (!reservesRaw || reservesRaw === "0x" || reservesRaw.length < 130) return null;

    const token0 = ("0x" + t0raw.slice(-40)).toLowerCase();
    const token1 = ("0x" + t1raw.slice(-40)).toLowerCase();
    const xsenIsToken0 = token0 === XSEN_ADDRESS.toLowerCase();

    // Uniswap V2 reserves: [uint112 reserve0][uint112 reserve1][uint32 ts]
    const r0 = BigInt("0x" + reservesRaw.slice(2, 66));
    const r1 = BigInt("0x" + reservesRaw.slice(66, 130));

    const xsenReserve  = xsenIsToken0 ? r0 : r1;
    const otherReserve = xsenIsToken0 ? r1 : r0;
    const otherToken   = xsenIsToken0 ? token1 : token0;

    if (xsenReserve === 0n) return null;

    // Get decimals of the paired token
    const decRaw       = await ethCall(otherToken, "0x313ce567"); // decimals()
    const otherDec     = decRaw && decRaw !== "0x" ? (parseInt(decRaw, 16) || 18) : 18;

    // Price of 1 XSEN in terms of the other token
    const rawPrice = (Number(otherReserve) / 10 ** otherDec) /
                     (Number(xsenReserve)  / 1e18);

    // If paired with a stablecoin (6 decimals: USDC/USDT) → direct USD price
    if (otherDec === 6) return rawPrice > 0 ? rawPrice : null;

    // If paired with OKB or wETH (18 decimals) → convert via CoinGecko OKB price
    if (otherDec === 18) {
      const cgRes  = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=okb&vs_currencies=usd",
        { signal: AbortSignal.timeout(4000) }
      );
      const cgData = await cgRes.json().catch(() => null);
      const okbUsd = cgData?.okb?.usd;
      if (okbUsd && okbUsd > 0) return rawPrice * okbUsd;
    }

    return null;
  } catch {
    return null;
  }
}

// ── Route handler ──────────────────────────────────────────────────────────
export async function GET() {
  const [marketPrice, poolPrice] = await Promise.all([
    tryOkxMarketV6(),
    tryPoolPrice(),
  ]);

  let xsenPrice     = FALLBACK_PRICE;
  let priceSource   = "fallback";
  let fallbackReason: string | null = null;

  if (marketPrice && marketPrice > 0) {
    xsenPrice   = marketPrice;
    priceSource = "okx_market_v6";
  } else if (poolPrice && poolPrice > 0) {
    xsenPrice   = poolPrice;
    priceSource = "xlayer_pool";
    fallbackReason = "okx_market_v6: token not listed";
  } else {
    fallbackReason = "okx_market_v6: token not listed; xlayer_pool: no liquidity or pool not found";
  }

  const xsenAmount    = USD_FEE / xsenPrice;
  const xsenAmountWei = BigInt(Math.ceil(xsenAmount * 1e18)).toString();

  return NextResponse.json({
    usd_fee:         USD_FEE,
    xsen_price_usd:  xsenPrice,
    xsen_amount:     xsenAmount,
    xsen_amount_wei: xsenAmountWei,
    treasury:        TREASURY,
    xsen_token:      XSEN_ADDRESS,
    xsen_pool:       XSEN_POOL,
    price_source:    priceSource,
    fallback_reason: fallbackReason,
    expires_at:      Date.now() + 5 * 60 * 1000,
  });
}
