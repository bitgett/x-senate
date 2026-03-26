import { NextRequest, NextResponse } from "next/server";
import { getRegistryProjects } from "@/lib/contract";
import { dbUpsertProjectMeta, dbListProjectsMeta, dbIsPaymentHashUsed, dbMarkPaymentHashUsed, initSchema } from "@/lib/db";
import { hasOkxKeys, okxX402Verify, okxX402Settle } from "@/lib/okx";

const XLAYER_RPC = "https://rpc.xlayer.tech";

async function verifyTxSuccess(txHash: string): Promise<boolean> {
  try {
    const res = await fetch(XLAYER_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [txHash] }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    return data.result?.status === "0x1";
  } catch { return false; }
}

const XSEN_PROJECT = {
  project_id: "XSEN",
  name: "X-Senate",
  description: "The native X-Senate governance token and DAO platform on X Layer.",
  token_address: process.env.NEXT_PUBLIC_XSEN_TOKEN_ADDRESS ?? "0x1bAB744c4c98D844984e297744Cb6b4E24e2E89b",
  staking_contract: process.env.NEXT_PUBLIC_XSEN_STAKING_ADDRESS ?? "0xc8FD7B12De6bFb10dF3eaCb38AAc09CBbeb25bFD",
  registrant: "0x8266D8e3B231dfD16fa21e40Cc3B99F38bC4B6C2",
  registered_at: 0,
  active: true,
  twitter: "https://twitter.com/xsenate",
  discord: null,
  telegram: null,
};

export async function GET() {
  try {
    await initSchema().catch(() => {});

    // Merge on-chain projects with DB social meta
    const [onchain, metaRows] = await Promise.all([
      getRegistryProjects().catch(() => []),
      dbListProjectsMeta().catch(() => []),
    ]);

    const metaMap = Object.fromEntries(metaRows.map(m => [m.project_id, m]));

    let projects: any[] = onchain.length > 0
      ? onchain.map((p: any) => ({ ...p, ...(metaMap[p.project_id] ?? {}) }))
      : [XSEN_PROJECT];

    // Merge in any DB-only projects (registered via UI but maybe not yet indexed on-chain)
    for (const meta of metaRows) {
      if (!projects.find(p => p.project_id === meta.project_id)) {
        projects.push({
          project_id:      meta.project_id,
          name:            meta.name,
          description:     meta.description,
          token_address:   meta.token_address,
          staking_contract: process.env.NEXT_PUBLIC_XSEN_STAKING_ADDRESS ?? "0xc8FD7B12De6bFb10dF3eaCb38AAc09CBbeb25bFD",
          registrant:      meta.registrant,
          registered_at:   Math.floor(new Date(meta.created_at).getTime() / 1000),
          active:          true,
          twitter:         meta.twitter,
          discord:         meta.discord,
          telegram:        meta.telegram,
          tx_hash:         meta.tx_hash,
        });
      }
    }

    return NextResponse.json({ projects, count: projects.length, platform: "X-Senate AI Governance Platform" });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 503 });
  }
}

const USDT_ADDRESS = "0x779ded0c9e1022225f8e0630b35a9b54be713736";
const TREASURY     = "0x8266D8e3B231dfD16fa21e40Cc3B99F38bC4B6C2";
const USDT_AMOUNT  = "1000000"; // $1 in 6-decimal units

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
    await initSchema().catch(() => {});
    const body = await req.json();
    const {
      project_id, name, description, token_address,
      twitter, discord, telegram, registrant,
      payment_payload, token_name, token_version,
      logo_base64,
    } = body;

    if (!project_id?.trim()) return NextResponse.json({ detail: "project_id required" }, { status: 400 });
    if (!name?.trim())       return NextResponse.json({ detail: "name required" }, { status: 400 });
    if (!token_address?.startsWith("0x") || token_address.length !== 42) {
      return NextResponse.json({ detail: "Invalid token_address" }, { status: 400 });
    }

    const pid = project_id.trim().toUpperCase();

    // ── x402 Payment Gate ────────────────────────────────────────────────────
    if (!payment_payload) {
      return NextResponse.json({
        detail:      "Payment required",
        x402:        true,
        usd_fee:     1,
        usdt_amount: USDT_AMOUNT,
        treasury:    TREASURY,
        usdt_token:  USDT_ADDRESS,
      }, { status: 402 });
    }

    if (!hasOkxKeys()) {
      return NextResponse.json({ detail: "Payment service unavailable — OKX keys not configured" }, { status: 503 });
    }

    const nonce: string | undefined = (payment_payload as any)?.payload?.authorization?.nonce;
    if (!nonce) {
      return NextResponse.json({ detail: "Invalid payment payload: missing nonce" }, { status: 400 });
    }

    if (await dbIsPaymentHashUsed(nonce)) {
      return NextResponse.json({ detail: "Payment already used" }, { status: 402 });
    }

    const tName    = token_name    ?? "Tether USD";
    const tVersion = token_version ?? "1";
    const paymentRequirements = buildRequirements(tName, tVersion);

    const verify = await okxX402Verify({ chainIndex: "196", paymentPayload: payment_payload, paymentRequirements });
    if (!verify.verified) {
      return NextResponse.json({ detail: `Payment verification failed: ${verify.error}` }, { status: 402 });
    }

    const settle = await okxX402Settle({ chainIndex: "196", paymentPayload: payment_payload, paymentRequirements, syncSettle: true });
    if (!settle.success) {
      return NextResponse.json({ detail: `Payment settlement failed: ${settle.error}` }, { status: 402 });
    }

    await dbMarkPaymentHashUsed(nonce, "project_registration");

    await dbUpsertProjectMeta({
      project_id:    pid,
      name:          name.trim(),
      description:   description?.trim() || null,
      token_address: token_address.trim(),
      twitter:       twitter?.trim() || null,
      discord:       discord?.trim() || null,
      telegram:      telegram?.trim() || null,
      registrant:    registrant?.trim() || null,
      tx_hash:       settle.txHash ?? null,
      logo_base64:   logo_base64 || null,
    });

    return NextResponse.json({
      success:         true,
      project_id:      pid,
      name:            name.trim(),
      token_address,
      payment_tx_hash: settle.txHash,
      message:         `Project ${pid} registered! Governance page: /projects/${pid}`,
    });
  } catch (e: any) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
