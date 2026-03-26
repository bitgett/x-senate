export const maxDuration = 60;
/**
 * POST /api/proposals/submit
 *
 * Manual proposal submission flow:
 * 1. User signs EIP-3009 transferWithAuthorization ($1 USDT) off-chain
 * 2. Server verifies + settles via OKX x402
 * 3. Sentinel AI evaluates feasibility and governance relevance
 * 4. If approved → proposal saved as Draft, ready for Senate
 * 5. If rejected → feedback returned, payment already settled (non-refundable)
 *
 * Staking threshold check is enforced on-chain at registerProposal().
 */
import { NextRequest, NextResponse } from "next/server";
import { dbCreateProposal, dbIsPaymentHashUsed, dbMarkPaymentHashUsed, dbGetProjectMeta, initSchema } from "@/lib/db";
import { claudeCompleteJson } from "@/lib/agents";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { hasOkxKeys, okxX402Verify, okxX402Settle } from "@/lib/okx";
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
  const ip = getClientIp(req);
  if (!checkRateLimit(`${ip}:submit_proposal`, 10, 60_000)) {
    return NextResponse.json({ detail: "Too many requests. Please wait before retrying." }, { status: 429 });
  }
  try {
    await initSchema();
    const body = await req.json();

    const {
      title, summary, motivation, proposed_action, potential_risks,
      project_id, submitter_address,
      payment_payload, token_name, token_version,
    } = body;

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

    // Extract nonce for replay protection
    const nonce: string | undefined = (payment_payload as any)?.payload?.authorization?.nonce;
    if (!nonce) {
      return NextResponse.json({ detail: "Invalid payment payload: missing nonce" }, { status: 400 });
    }

    if (await dbIsPaymentHashUsed(nonce)) {
      return NextResponse.json({ detail: "Payment already used — each authorization can only fund one proposal" }, { status: 402 });
    }

    const tName    = token_name    ?? "Tether USD";
    const tVersion = token_version ?? "1";
    const paymentRequirements = buildRequirements(tName, tVersion);

    // ── Verify signature ─────────────────────────────────────────────────────
    const verify = await okxX402Verify({
      chainIndex:          "196",
      paymentPayload:      payment_payload,
      paymentRequirements,
    });
    if (!verify.verified) {
      return NextResponse.json({ detail: `Payment verification failed: ${verify.error}` }, { status: 402 });
    }

    if (!title || !summary || !motivation || !proposed_action) {
      return NextResponse.json(
        { detail: "title, summary, motivation, and proposed_action are required" },
        { status: 400 }
      );
    }

    const pid = (project_id ?? "XSEN").trim().toUpperCase();
    if (!await isValidProjectId(pid)) {
      return NextResponse.json(
        { detail: `Project "${pid}" is not registered in X-Senate` },
        { status: 400 }
      );
    }

    // ── Settle payment ───────────────────────────────────────────────────────
    const settle = await okxX402Settle({
      chainIndex:          "196",
      paymentPayload:      payment_payload,
      paymentRequirements,
      syncSettle:          true,
    });
    if (!settle.success) {
      return NextResponse.json({ detail: `Payment settlement failed: ${settle.error}` }, { status: 402 });
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

    const approved    = sentinelResult.approved as boolean;
    const score       = sentinelResult.score as number;
    const feedback    = sentinelResult.feedback as string;
    const concerns    = sentinelResult.concerns as string[] ?? [];
    const suggestions = sentinelResult.suggested_improvements as string ?? null;

    if (!approved) {
      // Payment is already settled — mark nonce consumed even on rejection
      await dbMarkPaymentHashUsed(nonce, "proposal");
      return NextResponse.json({
        approved: false,
        score,
        feedback,
        concerns,
        suggested_improvements: suggestions,
        message: "Sentinel rejected this proposal. Revise and resubmit.",
      }, { status: 422 });
    }

    // ── Save as Draft ────────────────────────────────────────────────────────
    const proposal = await dbCreateProposal({
      project_id: pid,
      title,
      summary,
      motivation,
      proposed_action,
      potential_risks: potential_risks ?? null,
      sentinel_analysis: `[Manual submission — Sentinel score: ${score}/100] ${feedback}`,
      source_data: JSON.stringify({ type: "manual", submitter: submitter_address ?? "unknown", tx_hash: settle.txHash }),
      proposer_address: submitter_address ?? null,
      status: "Draft",
      approve_count: 0,
      reject_count: 0,
      snapshot_url: null,
      tx_hash: settle.txHash ?? null,
      one_liner_opinions: null,
    });

    // Mark nonce consumed after successful save
    await dbMarkPaymentHashUsed(nonce, "proposal");

    return NextResponse.json({
      approved: true,
      score,
      feedback,
      proposal,
      payment_tx_hash: settle.txHash,
      threshold_required_xsen: PROPOSAL_THRESHOLD_XSEN,
      message: "Sentinel approved. Proposal saved as Draft — submit to Senate when ready.",
    }, { status: 201 });

  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 503 });
  }
}

export async function GET() {
  return NextResponse.json({
    threshold_xsen: PROPOSAL_THRESHOLD_XSEN,
    description: "Minimum XSEN staked (effective VP) required to submit a proposal on-chain.",
  });
}
