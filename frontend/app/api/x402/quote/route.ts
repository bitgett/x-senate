/**
 * GET /api/x402/quote
 * Returns the XSEN amount required for a $10 payment.
 * Price sources (in order): OKX Market API → OKX DEX Swap price → fallback $0.01
 */
import { NextResponse } from "next/server";

const XSEN_ADDRESS = "0x1bAB744c4c98D844984e297744Cb6b4E24e2E89b";
const USDT_ADDRESS = "0x1E4a5963aBFD975d8c9021ce480b42188849D41d"; // USDT0 on X Layer
const TREASURY     = "0x8266D8e3B231dfD16fa21e40Cc3B99F38bC4B6C2";
const XLAYER_RPC   = "https://rpc.xlayer.tech";
const USD_FEE      = 10;
const FALLBACK_PRICE = 0.01;

// Try OKX DEX Market API
async function tryOkxMarketApi(): Promise<number | null> {
  try {
    const res = await fetch(
      `https://www.okx.com/api/v5/dex/market/price?chainIndex=196&tokenAddress=${XSEN_ADDRESS}`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json();
    const price = parseFloat(data?.data?.[0]?.price ?? "0");
    return price > 0 ? price : null;
  } catch {
    return null;
  }
}

// Try fetching 1 XSEN → USDT quote from OKX DEX swap API
async function tryOkxSwapQuote(): Promise<number | null> {
  try {
    const oneXsen = (1e18).toString();
    const res = await fetch(
      `https://www.okx.com/api/v5/dex/aggregator/quote?chainId=196&fromTokenAddress=${XSEN_ADDRESS}&toTokenAddress=${USDT_ADDRESS}&amount=${oneXsen}&slippage=0.05`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json();
    const toAmount = parseFloat(data?.data?.[0]?.toTokenAmount ?? "0");
    const toDecimals = parseInt(data?.data?.[0]?.toToken?.decimal ?? "6");
    if (toAmount > 0) return toAmount / 10 ** toDecimals;
  } catch { /* ignore */ }
  return null;
}

// Fallback: query X Layer RPC for ETH price to sanity-check (shows RPC works)
async function tryRpcFallback(): Promise<number | null> {
  try {
    const res = await fetch(XLAYER_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "eth_call",
        params: [{
          // Uniswap V3 pool slot0 would go here if we had pool address
          // For now just confirm RPC responds
        }, "latest"],
      }),
      signal: AbortSignal.timeout(4000),
    });
    return res.ok ? null : null; // RPC works but no price calc yet
  } catch {
    return null;
  }
}

export async function GET() {
  // Try price sources in order
  const [marketPrice, swapPrice] = await Promise.all([
    tryOkxMarketApi(),
    tryOkxSwapQuote(),
  ]);

  let xsenPrice = FALLBACK_PRICE;
  let priceSource = "fallback";

  if (marketPrice && marketPrice > 0) {
    xsenPrice = marketPrice;
    priceSource = "okx_market_api";
  } else if (swapPrice && swapPrice > 0) {
    xsenPrice = swapPrice;
    priceSource = "okx_swap_quote";
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
