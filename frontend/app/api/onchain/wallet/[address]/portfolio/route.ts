/**
 * GET /api/onchain/wallet/[address]/portfolio
 * Returns token balances on X Layer using OKX OnchainOS Wallet API.
 *
 * Requires env vars: OKX_API_KEY, OKX_SECRET_KEY, OKX_PASSPHRASE
 * Falls back to X Layer RPC direct read if keys not configured.
 */
import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

const XLAYER_RPC    = "https://rpc.xlayer.tech";
const XSEN_ADDRESS  = "0x1bAB744c4c98D844984e297744Cb6b4E24e2E89b";
const XSEN_POOL     = "0xb524efba890ed7087a4188b9b0148eb7fb954da9";
const OKX_BASE      = "https://web3.okx.com";

// ── OKX HMAC auth headers ─────────────────────────────────────────────────
function okxHeaders(method: string, path: string, body = ""): HeadersInit | null {
  const key        = process.env.OKX_API_KEY;
  const secret     = process.env.OKX_SECRET_KEY;
  const passphrase = process.env.OKX_PASSPHRASE;
  if (!key || !secret || !passphrase) return null;

  const timestamp = new Date().toISOString();
  const preHash   = timestamp + method.toUpperCase() + path + body;
  const sign      = createHmac("sha256", secret).update(preHash).digest("base64");

  return {
    "Content-Type":       "application/json",
    "OK-ACCESS-KEY":       key,
    "OK-ACCESS-SIGN":      sign,
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PASSPHRASE": passphrase,
  };
}

// ── OnchainOS: all token balances ─────────────────────────────────────────
async function fetchOkxPortfolio(address: string) {
  const path = `/api/v5/wallet/asset/all-token-balances-by-address?address=${address}&chains=196&filter=0`;
  const headers = okxHeaders("GET", path);
  if (!headers) return null;

  const res  = await fetch(`${OKX_BASE}${path}`, { headers, signal: AbortSignal.timeout(8000) });
  const data = await res.json();
  if (data.code !== "0" || !data.data) return null;

  const tokens: { symbol: string; balance: string; usd_value: string; token_address: string }[] = [];
  for (const chainData of data.data) {
    for (const t of chainData.tokenAssets ?? []) {
      tokens.push({
        symbol:        t.symbol,
        balance:       t.balance,
        usd_value:     t.tokenValue ?? "0",
        token_address: t.tokenAddress ?? "",
      });
    }
  }

  const total = tokens.reduce((sum, t) => sum + parseFloat(t.usd_value || "0"), 0);
  return { tokens, total_usd_value: total.toFixed(2), source: "okx_onchainos" };
}

// ── RPC helper ────────────────────────────────────────────────────────────
async function rpcCall(method: string, params: unknown[]) {
  const res  = await fetch(XLAYER_RPC, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal:  AbortSignal.timeout(5000),
  });
  const json = await res.json();
  return json.result;
}

// ── Fallback: read from X Layer RPC directly ──────────────────────────────
async function fetchRpcPortfolio(address: string) {
  const addr = address.toLowerCase();

  // XSEN balance via balanceOf(address)
  const xsenBalRaw = await rpcCall("eth_call", [
    { to: XSEN_ADDRESS, data: "0x70a08231" + addr.slice(2).padStart(64, "0") },
    "latest",
  ]).catch(() => "0x0");
  const xsenBal = parseInt(xsenBalRaw || "0x0", 16) / 1e18;

  // Native OKB balance
  const okbBalRaw = await rpcCall("eth_getBalance", [address, "latest"]).catch(() => "0x0");
  const okbBal = parseInt(okbBalRaw || "0x0", 16) / 1e18;

  // XSEN price from pool slot0 (same logic as quote/route.ts)
  let xsenPrice = 0.01;
  try {
    const [t0raw, slot0raw] = await Promise.all([
      rpcCall("eth_call", [{ to: XSEN_POOL, data: "0x0dfe1681" }, "latest"]),
      rpcCall("eth_call", [{ to: XSEN_POOL, data: "0x3850c7bd" }, "latest"]),
    ]);
    if (slot0raw && slot0raw !== "0x" && slot0raw.length >= 66) {
      const sqrtPriceX96 = BigInt("0x" + slot0raw.slice(2, 66));
      if (sqrtPriceX96 > 0n) {
        const token0      = ("0x" + t0raw.slice(-40)).toLowerCase();
        const xsenIsToken0 = token0 === XSEN_ADDRESS.toLowerCase();
        const Q96 = 2n ** 96n;
        if (xsenIsToken0) {
          const num = sqrtPriceX96 * sqrtPriceX96 * (10n ** 12n) * (10n ** 18n);
          xsenPrice = Number(num / (Q96 * Q96)) / 1e18;
        } else {
          const num = Q96 * Q96 * (10n ** 12n) * (10n ** 18n);
          xsenPrice = Number(num / (sqrtPriceX96 * sqrtPriceX96)) / 1e18;
        }
      }
    }
  } catch { /* use fallback price */ }

  // OKB price from CoinGecko
  let okbPrice = 0;
  try {
    const cg = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=okb&vs_currencies=usd",
      { signal: AbortSignal.timeout(4000) }
    );
    const cgData = await cg.json();
    okbPrice = cgData?.okb?.usd ?? 0;
  } catch { /* 0 */ }

  const xsenValue = xsenBal * xsenPrice;
  const okbValue  = okbBal  * okbPrice;
  const total     = xsenValue + okbValue;

  const tokens = [];
  if (xsenBal > 0) tokens.push({ symbol: "XSEN", balance: xsenBal.toFixed(4), usd_value: xsenValue.toFixed(2), token_address: XSEN_ADDRESS });
  if (okbBal  > 0) tokens.push({ symbol: "OKB",  balance: okbBal.toFixed(6),  usd_value: okbValue.toFixed(2),  token_address: "" });

  return { tokens, total_usd_value: total.toFixed(2), source: "xlayer_rpc" };
}

// ── Route handler ─────────────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  try {
    const { address } = await params;

    // Try OKX OnchainOS first (requires API keys)
    const okx = await fetchOkxPortfolio(address).catch(() => null);
    if (okx) {
      return NextResponse.json({ address, chain: "X Layer", chain_index: "196", ...okx });
    }

    // Fallback: direct RPC
    const rpc = await fetchRpcPortfolio(address);
    return NextResponse.json({ address, chain: "X Layer", chain_index: "196", ...rpc });

  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 503 });
  }
}
