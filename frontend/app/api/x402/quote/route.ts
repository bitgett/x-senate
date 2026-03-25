/**
 * GET /api/x402/quote
 * Returns the XSEN amount required for a $10 payment.
 * Price sources:
 *   1. OKX Web3 Market API v6  (POST web3.okx.com/api/v6/dex/market/price)
 *   2. OKX Index Price v6      (POST web3.okx.com/api/v6/dex/index/current-price)
 *   3. Fallback $0.01
 */
import { NextResponse } from "next/server";

const XSEN_ADDRESS = "0x1bAB744c4c98D844984e297744Cb6b4E24e2E89b";
const TREASURY     = "0x8266D8e3B231dfD16fa21e40Cc3B99F38bC4B6C2";
const OKX_BASE     = "https://web3.okx.com";
const USD_FEE      = 10;
const FALLBACK_PRICE = 0.01;

const OKX_HEADERS = {
  "Content-Type": "application/json",
};

async function tryOkxMarketV6(): Promise<number | null> {
  try {
    const res = await fetch(`${OKX_BASE}/api/v6/dex/market/price`, {
      method: "POST",
      headers: OKX_HEADERS,
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

async function tryOkxIndexPrice(): Promise<number | null> {
  try {
    const res = await fetch(`${OKX_BASE}/api/v6/dex/index/current-price`, {
      method: "POST",
      headers: OKX_HEADERS,
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

export async function GET() {
  const [marketPrice, indexPrice] = await Promise.all([
    tryOkxMarketV6(),
    tryOkxIndexPrice(),
  ]);

  let xsenPrice = FALLBACK_PRICE;
  let priceSource = "fallback";

  if (marketPrice && marketPrice > 0) {
    xsenPrice = marketPrice;
    priceSource = "okx_market_v6";
  } else if (indexPrice && indexPrice > 0) {
    xsenPrice = indexPrice;
    priceSource = "okx_index_v6";
  }

  const xsenAmount = USD_FEE / xsenPrice;
  const xsenAmountWei = BigInt(Math.ceil(xsenAmount * 1e18)).toString();

  return NextResponse.json({
    usd_fee: USD_FEE,
    xsen_price_usd: xsenPrice,
    xsen_amount: xsenAmount,
    xsen_amount_wei: xsenAmountWei,
    treasury: TREASURY,
    xsen_token: XSEN_ADDRESS,
    price_source: priceSource,
    expires_at: Date.now() + 5 * 60 * 1000,
  });
}
