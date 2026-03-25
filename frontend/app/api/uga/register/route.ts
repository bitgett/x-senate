import { NextRequest, NextResponse } from "next/server";
import { dbCreateUGA, initSchema } from "@/lib/db";

const XSEN_USD_FEE   = 10;
const FALLBACK_PRICE = 0.01;

async function getRequiredXsenWei(): Promise<bigint> {
  try {
    const res = await fetch("https://www.okx.com/api/v5/dex/market/price?chainIndex=196&tokenAddress=0x1bAB744c4c98D844984e297744Cb6b4E24e2E89b");
    const data = await res.json();
    const price = parseFloat(data?.data?.[0]?.price ?? "0");
    if (price > 0) return BigInt(Math.ceil((XSEN_USD_FEE / price) * 1e18));
  } catch { /* fallback */ }
  return BigInt(Math.ceil((XSEN_USD_FEE / FALLBACK_PRICE) * 1e18));
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
        treasury: "0x8266D8e3B231dfD16fa21e40Cc3B99F38bC4B6C2",
        xsen_token: "0x1bAB744c4c98D844984e297744Cb6b4E24e2E89b",
      }, { status: 402 });
    }

    // Verify payment on-chain
    const requiredWei = await getRequiredXsenWei();
    const verifyRes = await fetch(`${req.nextUrl.origin}/api/x402/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tx_hash: payment_tx_hash, from_address: wallet_address, required_xsen_wei: requiredWei.toString() }),
    });
    const verifyData = await verifyRes.json();
    if (!verifyData.verified) {
      return NextResponse.json({ detail: `Payment verification failed: ${verifyData.error}` }, { status: 402 });
    }

    if (!wallet_address || !agent_name) {
      return NextResponse.json({ detail: "wallet_address and agent_name are required" }, { status: 400 });
    }

    // Limit avatar size to ~200KB base64
    if (avatar_base64 && avatar_base64.length > 280_000) {
      return NextResponse.json({ detail: "Avatar too large. Max 200KB." }, { status: 400 });
    }

    const agent = await dbCreateUGA({ wallet_address, agent_name, system_prompt, focus_area, avatar_base64 });
    return NextResponse.json(agent, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ detail: e.message ?? String(e) }, { status: 400 });
  }
}
