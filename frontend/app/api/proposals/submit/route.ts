export const maxDuration = 60;
/**
 * POST /api/proposals/submit
 *
 * Manual proposal submission flow:
 * 1. User submits title + description + motivation + proposed_action + risks
 * 2. Sentinel AI evaluates feasibility and governance relevance
 * 3. If approved by Sentinel → proposal saved as Draft, ready for Senate
 * 4. If rejected → feedback returned, proposal not saved
 *
 * Staking threshold check is enforced on-chain at registerProposal().
 * This API returns the threshold so the frontend can warn users upfront.
 */
import { NextRequest, NextResponse } from "next/server";
import { dbCreateProposal, dbIsPaymentHashUsed, dbMarkPaymentHashUsed, dbGetProjectMeta, initSchema } from "@/lib/db";
import { claudeCompleteJson } from "@/lib/agents";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { hasOkxKeys, okxGetTokenPrice, okxX402Verify } from "@/lib/okx";
import { getRegistryProjects } from "@/lib/contract";

async function isValidProjectId(pid: string): Promise<boolean> {
  if (pid === "XSEN") return true;
  try {
    const [meta, onchain] = await Promise.all([
      dbGetProjectMeta(pid).catch(() => null),
      getRegistryProjects().catch(() => []),
    ]);
    if (meta) return true;
    return (onchain as any[]).some(
      p => (p.projectId ?? p.project_id)?.toUpperCase() === pid
    );
  } catch { return false; }
}

const PROPOSAL_THRESHOLD_XSEN = 1000; // must match governor contract

const SENTINEL_REVIEW_SYSTEM = `You are the Sentinel AI for X-Senate, an AI governance platform on X Layer.
Your job is to review manually submitted governance proposals and determine if they are:
1. A genuine governance matter (not spam, not personal requests, not off-topic)
2. Sufficiently well-defined to be actionable
3. Not clearly harmful or malicious

Be strict but fair. Proposals should relate to protocol parameters, treasury, tokenomics,
technical upgrades, partnerships, or governance rules.`;

const XLAYER_RPC   = "https://rpc.xlayer.tech";
const XSEN_ADDRESS = "0x1bAB744c4c98D844984e297744Cb6b4E24e2E89b".toLowerCase();
const TREASURY     = "0x8266D8e3B231dfD16fa21e40Cc3B99F38bC4B6C2".toLowerCase();
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const XSEN_USD_FEE   = 10;
const FALLBACK_PRICE = 0.01;

async function getRequiredXsenWei(): Promise<bigint> {
  // Try OKX OnchainOS market price (authenticated if keys available)
  const okxPrice = hasOkxKeys() ? await okxGetTokenPrice("196", XSEN_ADDRESS) : null;
  if (okxPrice && okxPrice > 0) return BigInt(Math.ceil((XSEN_USD_FEE / okxPrice) * 1e18));

  // Fallback: unauthenticated OKX market price call
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
  // Primary: OKX OnchainOS x402/verify
  if (hasOkxKeys()) {
    const okx = await okxX402Verify({
      txHash,
      chainIndex: "196",
      tokenAddress: XSEN_ADDRESS,
      toAddress: TREASURY,
      amount: requiredWei.toString(),
    });
    if (okx.verified) return { ok: true };
    // If OKX returns a definitive rejection, trust it
    if (okx.error && !okx.error.includes("unavailable")) {
      return { ok: false, error: okx.error };
    }
  }

  // Fallback: direct X Layer RPC verification
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
  const ip = getClientIp(req);
  if (!checkRateLimit(`${ip}:submit_proposal`, 10, 60_000)) {
    return NextResponse.json({ detail: "Too many requests. Please wait before retrying." }, { status: 429 });
  }
  try {
    await initSchema();
    const body = await req.json();

    const { title, summary, motivation, proposed_action, potential_risks, project_id, submitter_address, payment_tx_hash } = body;

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

    // Replay protection: reject reused tx hashes
    if (await dbIsPaymentHashUsed(payment_tx_hash)) {
      return NextResponse.json({ detail: "Payment already used — each transaction can only fund one proposal" }, { status: 402 });
    }

    // Verify payment inline (no internal HTTP hop)
    const requiredWei = await getRequiredXsenWei();
    const verify = await verifyPayment(payment_tx_hash, requiredWei);
    if (!verify.ok) {
      return NextResponse.json({ detail: `Payment verification failed: ${verify.error}` }, { status: 402 });
    }

    if (!title || !summary || !motivation || !proposed_action) {
      return NextResponse.json(
        { detail: "title, summary, motivation, and proposed_action are required" },
        { status: 400 }
      );
    }

    // Validate project_id against registry
    const pid = (project_id ?? "XSEN").trim().toUpperCase();
    if (!await isValidProjectId(pid)) {
      return NextResponse.json(
        { detail: `Project "${pid}" is not registered in X-Senate` },
        { status: 400 }
      );
    }

    // ── Sentinel feasibility review ──────────────────────────────────────────
    const sentinelPrompt = `Review this manually submitted governance proposal:

Title: ${title}
Summary: ${summary}
Motivation: ${motivation}
Proposed Action: ${proposed_action}
Potential Risks: ${potential_risks ?? "Not specified"}

Respond with JSON:
{
  "approved": true or false,
  "score": 0-100 (governance relevance + feasibility),
  "feedback": "1-2 sentence assessment",
  "concerns": ["list of specific concerns if any"],
  "suggested_improvements": "optional suggestions if rejected"
}`;

    const sentinelResult = await claudeCompleteJson(SENTINEL_REVIEW_SYSTEM, sentinelPrompt, 800);

    const approved = sentinelResult.approved as boolean;
    const score = sentinelResult.score as number;
    const feedback = sentinelResult.feedback as string;
    const concerns = sentinelResult.concerns as string[] ?? [];
    const suggestions = sentinelResult.suggested_improvements as string ?? null;

    if (!approved) {
      return NextResponse.json({
        approved: false,
        score,
        feedback,
        concerns,
        suggested_improvements: suggestions,
        message: "Sentinel rejected this proposal. Revise and resubmit.",
      }, { status: 422 });
    }

    // Mark payment hash as consumed (prevents replay even on concurrent requests)
    await dbMarkPaymentHashUsed(payment_tx_hash, "proposal");

    // ── Save as Draft ────────────────────────────────────────────────────────
    const proposal = await dbCreateProposal({
      project_id: pid,
      title,
      summary,
      motivation,
      proposed_action,
      potential_risks: potential_risks ?? null,
      sentinel_analysis: `[Manual submission — Sentinel score: ${score}/100] ${feedback}`,
      source_data: JSON.stringify({ type: "manual", submitter: submitter_address ?? "unknown" }),
      proposer_address: submitter_address ?? null,
      status: "Draft",
      approve_count: 0,
      reject_count: 0,
      snapshot_url: null,
      tx_hash: null,
      one_liner_opinions: null,
    });

    return NextResponse.json({
      approved: true,
      score,
      feedback,
      proposal,
      threshold_required_xsen: PROPOSAL_THRESHOLD_XSEN,
      message: "Sentinel approved. Proposal saved as Draft — submit to Senate when ready.",
    }, { status: 201 });

  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 503 });
  }
}

export async function GET() {
  // Returns the current staking threshold for proposal submission
  return NextResponse.json({
    threshold_xsen: PROPOSAL_THRESHOLD_XSEN,
    description: "Minimum XSEN staked (effective VP) required to submit a proposal on-chain.",
  });
}
