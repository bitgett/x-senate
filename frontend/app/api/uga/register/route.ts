import { NextRequest, NextResponse } from "next/server";
import { dbCreateUGA, initSchema } from "@/lib/db";
import { hasOkxKeys, okxGetTokenPrice, okxX402Verify } from "@/lib/okx";

const XLAYER_RPC   = "https://rpc.xlayer.tech";
const XSEN_ADDRESS = "0x1bAB744c4c98D844984e297744Cb6b4E24e2E89b".toLowerCase();
const TREASURY     = "0x8266D8e3B231dfD16fa21e40Cc3B99F38bC4B6C2".toLowerCase();
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const XSEN_USD_FEE   = 10;
const FALLBACK_PRICE = 0.01;

async function getRequiredXsenWei(): Promise<bigint> {
  const okxPrice = hasOkxKeys() ? await okxGetTokenPrice("196", XSEN_ADDRESS) : null;
  if (okxPrice && okxPrice > 0) return BigInt(Math.ceil((XSEN_USD_FEE / okxPrice) * 1e18));
  try {
    const res = await fetch("https://web3.okx.com/api/v6/dex/market/price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ chainIndex: "196", tokenContractAddress: XSEN_ADDRESS }]),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    const price = parseFloat(data?.data?.[0]?.price ?? "0");
    if (price > 0) return BigInt(Math.ceil((XSEN_USD_FEE / price) * 1e18));
  } catch { /* fallback */ }
  return BigInt(Math.ceil((XSEN_USD_FEE / FALLBACK_PRICE) * 1e18));
}

async function verifyPayment(txHash: string, requiredWei: bigint): Promise<{ ok: boolean; error?: string }> {
  if (hasOkxKeys()) {
    const okx = await okxX402Verify({ txHash, chainIndex: "196", tokenAddress: XSEN_ADDRESS, toAddress: TREASURY, amount: requiredWei.toString() });
    if (okx.verified) return { ok: true };
    if (okx.error && !okx.error.includes("unavailable")) return { ok: false, error: okx.error };
  }
  try {
    const res = await fetch(XLAYER_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [txHash] }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    const receipt = data.result;
    if (!receipt) return { ok: false, error: "Transaction not found or pending" };
    if (receipt.status !== "0x1") return { ok: false, error: "Transaction failed on-chain" };
    let received = 0n;
    for (const log of (receipt.logs ?? [])) {
      if (
        log.address?.toLowerCase() === XSEN_ADDRESS &&
        log.topics?.[0] === TRANSFER_TOPIC &&
        ("0x" + log.topics?.[2]?.slice(26)).toLowerCase() === TREASURY
      ) {
        received += BigInt(log.data);
      }
    }
    if (received === 0n) return { ok: false, error: "No XSEN transfer to treasury in this TX" };
    if (received < requiredWei) return { ok: false, error: `Insufficient: got ${received}, need ${requiredWei}` };
    return { ok: true };
  } catch (e: any) {
    console.error("x402 RPC error:", e.message);
    return { ok: false, error: "Payment verification unavailable — please retry in a moment" };
  }
}

export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const body = await req.json();
    const { wallet_address, agent_name, system_prompt, focus_area, avatar_base64, payment_tx_hash } = body;

    // ── x402 Payment Gate ────────────────────────────────────────────────────
    if (!payment_tx_hash) {
      const requiredWei = await getRequiredXsenWei();
      return NextResponse.json({
        detail: "Payment required",
        x402: true,
        usd_fee: XSEN_USD_FEE,
        required_xsen_wei: requiredWei.toString(),
        treasury: TREASURY,
        xsen_token: XSEN_ADDRESS,
      }, { status: 402 });
    }

    // Verify payment inline (no internal HTTP hop)
    const requiredWei = await getRequiredXsenWei();
    const verify = await verifyPayment(payment_tx_hash, requiredWei);
    if (!verify.ok) {
      return NextResponse.json({ detail: `Payment verification failed: ${verify.error}` }, { status: 402 });
    }

    if (!wallet_address || !agent_name) {
      return NextResponse.json({ detail: "wallet_address and agent_name are required" }, { status: 400 });
    }

    if (avatar_base64 && avatar_base64.length > 280_000) {
      return NextResponse.json({ detail: "Avatar too large. Max 200KB." }, { status: 400 });
    }

    const agent = await dbCreateUGA({ wallet_address, agent_name, system_prompt, focus_area, avatar_base64 });
    return NextResponse.json(agent, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ detail: e.message ?? String(e) }, { status: 400 });
  }
}
