/**
 * GET /api/x402/quote
 * Returns the XSEN amount required for a $10 payment.
 * Price fetched live from OKX DEX Market API (X Layer chainIndex 196).
 */
import { NextResponse } from "next/server";

const XSEN_ADDRESS = "0x1bAB744c4c98D844984e297744Cb6b4E24e2E89b";
const TREASURY     = "0x8266D8e3B231dfD16fa21e40Cc3B99F38bC4B6C2";
const USD_FEE      = 10;
const FALLBACK_PRICE = 0.01; // $0.01 per XSEN fallback

export async function GET() {
  let xsenPrice = FALLBACK_PRICE;
  let priceSource = "fallback";

  try {
    const res = await fetch(
      `https://www.okx.com/api/v5/dex/market/price?chainIndex=196&tokenAddress=${XSEN_ADDRESS}`,
      { next: { revalidate: 60 } }
    );
    const data = await res.json();
    const raw = parseFloat(data?.data?.[0]?.price ?? "0");
    if (raw > 0) {
      xsenPrice = raw;
      priceSource = "okx_market_api";
    }
  } catch {
    // use fallback
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
    expires_at: Date.now() + 5 * 60 * 1000, // quote valid 5 minutes
  });
}
