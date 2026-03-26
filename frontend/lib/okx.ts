/**
 * OKX OnchainOS API client — shared HMAC auth + all endpoint helpers
 * Base: https://web3.okx.com
 * Docs: https://web3.okx.com/onchainos/dev-docs
 */
import { createHmac } from "crypto";

const OKX_BASE = "https://web3.okx.com";

// ── Auth ──────────────────────────────────────────────────────────────────

export function hasOkxKeys(): boolean {
  return !!(process.env.OKX_API_KEY && process.env.OKX_SECRET_KEY && process.env.OKX_PASSPHRASE);
}

export function okxAuthHeaders(method: string, path: string, body = ""): Record<string, string> {
  const key        = process.env.OKX_API_KEY!;
  const secret     = process.env.OKX_SECRET_KEY!;
  const passphrase = process.env.OKX_PASSPHRASE!;
  const timestamp  = new Date().toISOString();
  const preHash    = timestamp + method.toUpperCase() + path + body;
  const sign       = createHmac("sha256", secret).update(preHash).digest("base64");
  return {
    "Content-Type":        "application/json",
    "OK-ACCESS-KEY":        key,
    "OK-ACCESS-SIGN":       sign,
    "OK-ACCESS-TIMESTAMP":  timestamp,
    "OK-ACCESS-PASSPHRASE": passphrase,
  };
}

async function okxGet(path: string, timeoutMs = 8000) {
  const headers = okxAuthHeaders("GET", path);
  const res = await fetch(`${OKX_BASE}${path}`, { headers, signal: AbortSignal.timeout(timeoutMs) });
  return res.json();
}

async function okxPost(path: string, body: unknown, timeoutMs = 15_000) {
  const bodyStr = JSON.stringify(body);
  const headers = okxAuthHeaders("POST", path, bodyStr);
  const res = await fetch(`${OKX_BASE}${path}`, { method: "POST", headers, body: bodyStr, signal: AbortSignal.timeout(timeoutMs) });
  return res.json();
}

// ── DEX Market: token price ────────────────────────────────────────────────

/**
 * GET /api/v6/dex/market/price
 * Returns USD price for a token on a given chain.
 */
export async function okxGetTokenPrice(chainIndex: string, tokenAddress: string): Promise<number | null> {
  try {
    const path = `/api/v6/dex/market/price?chainIndex=${chainIndex}&tokenContractAddress=${tokenAddress.toLowerCase()}`;
    const data = await okxGet(path);
    const price = parseFloat(data?.data?.[0]?.price ?? "0");
    return price > 0 ? price : null;
  } catch { return null; }
}

// ── DEX Balance: wallet portfolio ─────────────────────────────────────────

/**
 * GET /api/v6/dex/balance/total-value-by-address
 * Returns total USD value of a wallet on given chains.
 */
export async function okxGetTotalValue(address: string, chains = "196"): Promise<string | null> {
  try {
    const path = `/api/v6/dex/balance/total-value-by-address?address=${address}&chains=${chains}&assetType=0`;
    const data = await okxGet(path);
    if (data.code === "0" && data.data?.[0]?.totalValue != null) {
      return data.data[0].totalValue;
    }
    return null;
  } catch { return null; }
}

/**
 * GET /api/v6/dex/balance/all-token-balances-by-address
 * Returns all token balances for a wallet on given chains.
 */
export async function okxGetTokenBalances(address: string, chains = "196") {
  try {
    const path = `/api/v6/dex/balance/all-token-balances-by-address?address=${address}&chains=${chains}&filter=0`;
    const data = await okxGet(path);
    if (data.code !== "0" || !data.data) return null;
    return data.data as Array<{ chainIndex: string; tokenAssets: Array<{
      symbol: string; balance: string; tokenValue: string; tokenAddress: string; tokenPrice: string;
    }> }>;
  } catch { return null; }
}

// ── x402: payment verify ──────────────────────────────────────────────────

/**
 * POST /api/v6/x402/verify
 * Validates an EIP-3009 transferWithAuthorization paymentPayload.
 * paymentPayload = { x402Version, scheme, payload: { signature, authorization } }
 * paymentRequirements = { scheme, maxAmountRequired, payTo, asset, extra }
 */
export async function okxX402Verify(params: {
  chainIndex: string;
  paymentPayload: unknown;
  paymentRequirements: unknown;
}): Promise<{ verified: boolean; payer?: string; error?: string }> {
  try {
    const body = { x402Version: 1, ...params };
    const data = await okxPost("/api/v6/x402/verify", body);
    if (data.code === "0" && data.data?.[0]?.isValid) {
      return { verified: true, payer: data.data[0].payer };
    }
    const reason = data.data?.[0]?.invalidReason ?? data.msg ?? "OKX x402 verify failed";
    return { verified: false, error: reason };
  } catch (e: any) {
    return { verified: false, error: e.message };
  }
}

// ── x402: payment settle ──────────────────────────────────────────────────

/**
 * POST /api/v6/x402/settle
 * Executes the on-chain transferWithAuthorization via OKX infrastructure.
 * syncSettle=true waits for on-chain confirmation before returning.
 */
export async function okxX402Settle(params: {
  chainIndex: string;
  paymentPayload: unknown;
  paymentRequirements: unknown;
  syncSettle?: boolean;
}): Promise<{ success: boolean; txHash?: string; payer?: string; error?: string }> {
  try {
    const body = { x402Version: 1, syncSettle: true, ...params };
    const data = await okxPost("/api/v6/x402/settle", body, 30_000);
    if (data.code === "0" && data.data?.[0]?.success) {
      return { success: true, txHash: data.data[0].txHash, payer: data.data[0].payer };
    }
    const reason = data.data?.[0]?.errorReason ?? data.msg ?? "Settlement failed";
    return { success: false, error: reason };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ── x402: supported chains ────────────────────────────────────────────────

export async function okxX402Supported() {
  try {
    const data = await okxGet("/api/v6/x402/supported");
    return data.code === "0" ? data.data : null;
  } catch { return null; }
}

// ── Post-tx: transaction detail ───────────────────────────────────────────

/**
 * GET /api/v6/dex/post-transaction/transaction-detail-by-txhash
 * Returns full transaction detail from OKX indexer.
 */
export async function okxGetTxDetail(chainIndex: string, txHash: string) {
  try {
    const path = `/api/v6/dex/post-transaction/transaction-detail-by-txhash?chainIndex=${chainIndex}&txHash=${txHash}`;
    const data = await okxGet(path);
    return data.code === "0" ? data.data : null;
  } catch { return null; }
}

/**
 * GET /api/v6/dex/post-transaction/transactions-by-address
 * Returns transaction history for a wallet.
 */
export async function okxGetTxHistory(address: string, chainIndex = "196", limit = 20) {
  try {
    const path = `/api/v6/dex/post-transaction/transactions-by-address?address=${address}&chainIndex=${chainIndex}&limit=${limit}`;
    const data = await okxGet(path);
    return data.code === "0" ? data.data : null;
  } catch { return null; }
}

// ── Market: candles ───────────────────────────────────────────────────────

/**
 * GET /api/v6/dex/market/candles
 * Returns OHLCV candle data for a token.
 */
export async function okxGetCandles(chainIndex: string, tokenAddress: string, bar = "1H", limit = 24) {
  try {
    const path = `/api/v6/dex/market/candles?chainIndex=${chainIndex}&tokenContractAddress=${tokenAddress.toLowerCase()}&bar=${bar}&limit=${limit}`;
    const data = await okxGet(path);
    return data.code === "0" ? data.data : null;
  } catch { return null; }
}

// ── Market: token basic info ──────────────────────────────────────────────

export async function okxGetTokenInfo(chainIndex: string, tokenAddress: string) {
  try {
    const path = `/api/v6/dex/market/token/basic-info?chainIndex=${chainIndex}&tokenContractAddress=${tokenAddress.toLowerCase()}`;
    const data = await okxGet(path);
    return data.code === "0" ? data.data : null;
  } catch { return null; }
}
