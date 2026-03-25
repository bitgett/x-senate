/**
 * GET /api/onchain/wallet/[address]/portfolio
 * Returns token balances + USD values on X Layer.
 * Primary: OKX OnchainOS DEX Balance API v6
 * Fallback: X Layer RPC direct read
 */
import { NextRequest, NextResponse } from "next/server";
import { hasOkxKeys, okxGetTotalValue, okxGetTokenBalances } from "@/lib/okx";

const XLAYER_RPC   = "https://rpc.xlayer.tech";
const XSEN_ADDRESS = "0x1bAB744c4c98D844984e297744Cb6b4E24e2E89b";
const XSEN_POOL    = "0xb524efba890ed7087a4188b9b0148eb7fb954da9";

async function rpcCall(method: string, params: unknown[]) {
  const res = await fetch(XLAYER_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(5000),
  });
  return (await res.json()).result;
}

async function getXsenUsdPrice(): Promise<number> {
  try {
    const [t0raw, slot0raw] = await Promise.all([
      rpcCall("eth_call", [{ to: XSEN_POOL, data: "0x0dfe1681" }, "latest"]),
      rpcCall("eth_call", [{ to: XSEN_POOL, data: "0x3850c7bd" }, "latest"]),
    ]);
    if (!slot0raw || slot0raw === "0x" || slot0raw.length < 66) return 0.01;
    const sqrtPriceX96 = BigInt("0x" + slot0raw.slice(2, 66));
    if (sqrtPriceX96 === 0n) return 0.01;
    const token0       = ("0x" + t0raw.slice(-40)).toLowerCase();
    const xsenIsToken0 = token0 === XSEN_ADDRESS.toLowerCase();
    const Q96 = 2n ** 96n;
    if (xsenIsToken0) {
      const num = sqrtPriceX96 * sqrtPriceX96 * (10n ** 12n) * (10n ** 18n);
      return Number(num / (Q96 * Q96)) / 1e18;
    } else {
      const num = Q96 * Q96 * (10n ** 12n) * (10n ** 18n);
      return Number(num / (sqrtPriceX96 * sqrtPriceX96)) / 1e18;
    }
  } catch { return 0.01; }
}

async function getOkbUsdPrice(): Promise<number> {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=okb&vs_currencies=usd", { signal: AbortSignal.timeout(4000) });
    return (await res.json())?.okb?.usd ?? 0;
  } catch { return 0; }
}

function isStable(symbol: string) {
  return /^(USDT|USDC|USD|DAI|TUSD|BUSD)/i.test(symbol);
}

function enrichTokenValue(symbol: string, balance: number, okxPrice: number, xsenPrice: number, okbPrice: number): number {
  if (okxPrice > 0) return balance * okxPrice;
  if (symbol === "XSEN")       return balance * xsenPrice;
  if (symbol === "OKB")        return balance * okbPrice;
  if (isStable(symbol))        return balance * 1.0;
  return 0;
}

// ── OKX OnchainOS path ────────────────────────────────────────────────────
async function portfolioViaOkx(address: string) {
  const [balancesData, totalData, xsenPrice, okbPrice] = await Promise.all([
    okxGetTokenBalances(address),
    okxGetTotalValue(address),
    getXsenUsdPrice(),
    getOkbUsdPrice(),
  ]);

  if (!balancesData) return null;

  const tokens: { symbol: string; balance: string; usd_value: string; token_address: string }[] = [];
  for (const chainData of balancesData) {
    for (const t of chainData.tokenAssets ?? []) {
      const bal       = parseFloat(t.balance ?? "0");
      const okxPrice  = parseFloat(t.tokenPrice ?? "0");
      const usdVal    = enrichTokenValue(t.symbol, bal, okxPrice, xsenPrice, okbPrice);
      tokens.push({
        symbol:        t.symbol,
        balance:       t.balance,
        usd_value:     usdVal.toFixed(2),
        token_address: t.tokenAddress ?? "",
      });
    }
  }

  // Use OKX total if available, otherwise sum ourselves
  const okxTotal = totalData ? parseFloat(totalData) : 0;
  const calcTotal = tokens.reduce((s, t) => s + parseFloat(t.usd_value), 0);
  const total = okxTotal > 0 ? okxTotal : calcTotal;

  return { tokens, total_usd_value: total.toFixed(2), source: "okx_onchainos" };
}

// ── RPC fallback ──────────────────────────────────────────────────────────
async function portfolioViaRpc(address: string) {
  const [xsenBalRaw, okbBalRaw, xsenPrice, okbPrice] = await Promise.all([
    rpcCall("eth_call", [{ to: XSEN_ADDRESS, data: "0x70a08231" + address.slice(2).padStart(64, "0") }, "latest"]).catch(() => "0x0"),
    rpcCall("eth_getBalance", [address, "latest"]).catch(() => "0x0"),
    getXsenUsdPrice(),
    getOkbUsdPrice(),
  ]);

  const xsenBal  = parseInt(xsenBalRaw || "0x0", 16) / 1e18;
  const okbBal   = parseInt(okbBalRaw  || "0x0", 16) / 1e18;
  const xsenVal  = xsenBal * xsenPrice;
  const okbVal   = okbBal  * okbPrice;

  const tokens = [];
  if (xsenBal > 0) tokens.push({ symbol: "XSEN", balance: xsenBal.toFixed(4), usd_value: xsenVal.toFixed(2), token_address: XSEN_ADDRESS });
  if (okbBal  > 0) tokens.push({ symbol: "OKB",  balance: okbBal.toFixed(6),  usd_value: okbVal.toFixed(2),  token_address: "" });

  return { tokens, total_usd_value: (xsenVal + okbVal).toFixed(2), source: "xlayer_rpc" };
}

// ── Route ─────────────────────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  try {
    const { address } = await params;

    const result = hasOkxKeys()
      ? await portfolioViaOkx(address).catch(() => null) ?? await portfolioViaRpc(address)
      : await portfolioViaRpc(address);

    return NextResponse.json({ address, chain: "X Layer", chain_index: "196", ...result });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 503 });
  }
}
