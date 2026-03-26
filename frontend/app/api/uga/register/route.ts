import { NextRequest, NextResponse } from "next/server";
import { dbCreateUGA, dbIsPaymentHashUsed, dbMarkPaymentHashUsed, initSchema } from "@/lib/db";
import { hasOkxKeys, okxX402Verify, okxX402Settle } from "@/lib/okx";

const USDT_ADDRESS = "0x779ded0c9e1022225f8e0630b35a9b54be713736";
const TREASURY     = "0x8266D8e3B231dfD16fa21e40Cc3B99F38bC4B6C2";
const USDT_AMOUNT  = "1000000"; // $1 in 6-decimal units

/** Build the fixed paymentRequirements from the token domain the client reported. */
function buildRequirements(tokenName: string, tokenVersion: string) {
  return {
    scheme:            "exact",
    maxAmountRequired: USDT_AMOUNT,
    payTo:             TREASURY,
    asset:             USDT_ADDRESS,
    extra:             { name: tokenName, version: tokenVersion },
  };
}

export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const body = await req.json();
    const {
      wallet_address, agent_name, system_prompt, focus_area, avatar_base64,
      payment_payload, token_name, token_version,
    } = body;

    // ── x402 Payment Gate ────────────────────────────────────────────────────
    if (!payment_payload) {
      return NextResponse.json({
        detail:              "Payment required",
        x402:                true,
        usd_fee:             1,
        usdt_amount:         USDT_AMOUNT,
        treasury:            TREASURY,
        usdt_token:          USDT_ADDRESS,
      }, { status: 402 });
    }

    if (!hasOkxKeys()) {
      return NextResponse.json({ detail: "Payment service unavailable — OKX keys not configured" }, { status: 503 });
    }

    // Extract nonce from paymentPayload for replay protection
    const nonce: string | undefined = (payment_payload as any)?.payload?.authorization?.nonce;
    if (!nonce) {
      return NextResponse.json({ detail: "Invalid payment payload: missing nonce" }, { status: 400 });
    }

    // Replay protection: reject reused nonces
    if (await dbIsPaymentHashUsed(nonce)) {
      return NextResponse.json({ detail: "Payment already used — each authorization can only register one agent" }, { status: 402 });
    }

    const tName    = token_name    ?? "Tether USD";
    const tVersion = token_version ?? "1";
    const paymentRequirements = buildRequirements(tName, tVersion);

    // ── Verify via OKX x402 ──────────────────────────────────────────────────
    const verify = await okxX402Verify({
      chainIndex:           "196",
      paymentPayload:       payment_payload,
      paymentRequirements,
    });
    if (!verify.verified) {
      return NextResponse.json({ detail: `Payment verification failed: ${verify.error}` }, { status: 402 });
    }

    if (!wallet_address || !agent_name) {
      return NextResponse.json({ detail: "wallet_address and agent_name are required" }, { status: 400 });
    }

    if (avatar_base64 && avatar_base64.length > 280_000) {
      return NextResponse.json({ detail: "Avatar too large. Max 200KB." }, { status: 400 });
    }

    // ── Settle via OKX x402 ──────────────────────────────────────────────────
    const settle = await okxX402Settle({
      chainIndex:           "196",
      paymentPayload:       payment_payload,
      paymentRequirements,
      syncSettle:           true,
    });
    if (!settle.success) {
      return NextResponse.json({ detail: `Payment settlement failed: ${settle.error}` }, { status: 402 });
    }

    // Mark nonce as consumed (after successful settlement)
    await dbMarkPaymentHashUsed(nonce, "agent_registration");

    const agent = await dbCreateUGA({ wallet_address, agent_name, system_prompt, focus_area, avatar_base64 });
    return NextResponse.json({ ...agent, payment_tx_hash: settle.txHash }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ detail: e.message ?? String(e) }, { status: 400 });
  }
}
