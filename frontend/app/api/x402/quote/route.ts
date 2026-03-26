/**
 * GET /api/x402/quote
 * Returns the USDT amount required for a $1 payment and the paymentRequirements
 * structure needed for EIP-3009 transferWithAuthorization signing.
 *
 * USDT has 6 decimals → $1 = 1_000_000 units (no price oracle needed).
 */
import { NextResponse } from "next/server";

const USDT_ADDRESS  = "0x779ded0c9e1022225f8e0630b35a9b54be713736";
const TREASURY      = "0x8266D8e3B231dfD16fa21e40Cc3B99F38bC4B6C2";
const XLAYER_RPC    = "https://rpc.xlayer.tech";
const CHAIN_ID      = 196;
const USD_FEE       = 1;
const USDT_DECIMALS = 6;
const USDT_AMOUNT   = USD_FEE * 10 ** USDT_DECIMALS; // 1_000_000

// ── RPC helpers ──────────────────────────────────────────────────────────────

async function ethCall(to: string, data: string): Promise<string> {
  const res = await fetch(XLAYER_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
    signal: AbortSignal.timeout(5000),
  });
  return (await res.json()).result ?? "0x";
}

function decodeAbiString(hex: string): string | null {
  if (!hex || hex === "0x" || hex.length < 130) return null;
  try {
    const length = parseInt(hex.slice(66, 130), 16);
    if (length === 0 || length > 200) return null;
    return Buffer.from(hex.slice(130, 130 + length * 2), "hex").toString("utf8");
  } catch { return null; }
}

/** Query the token's EIP-712 domain name and version from the contract. */
async function getTokenDomain(address: string): Promise<{ name: string; version: string }> {
  const [nameHex, versionHex] = await Promise.all([
    ethCall(address, "0x06fdde03").catch(() => "0x"), // name()
    ethCall(address, "0x54fd4d50").catch(() => "0x"), // version()
  ]);
  return {
    name:    decodeAbiString(nameHex)    ?? "Tether USD",
    version: decodeAbiString(versionHex) ?? "1",
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET() {
  const { name: tokenName, version: tokenVersion } = await getTokenDomain(USDT_ADDRESS);

  const paymentRequirements = {
    scheme:            "exact",
    maxAmountRequired: String(USDT_AMOUNT),
    payTo:             TREASURY,
    asset:             USDT_ADDRESS,
    extra:             { name: tokenName, version: tokenVersion },
  };

  return NextResponse.json({
    usd_fee:             USD_FEE,
    usdt_amount:         USDT_AMOUNT,
    usdt_amount_str:     String(USDT_AMOUNT),
    treasury:            TREASURY,
    usdt_token:          USDT_ADDRESS,
    chain_id:            CHAIN_ID,
    token_name:          tokenName,
    token_version:       tokenVersion,
    paymentRequirements,
    expires_at:          Date.now() + 5 * 60 * 1000,
  });
}
