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
import { dbCreateProposal, initSchema } from "@/lib/db";
import { claudeCompleteJson } from "@/lib/agents";

const PROPOSAL_THRESHOLD_XSEN = 1000; // must match governor contract

const SENTINEL_REVIEW_SYSTEM = `You are the Sentinel AI for X-Senate, an AI governance platform on X Layer.
Your job is to review manually submitted governance proposals and determine if they are:
1. A genuine governance matter (not spam, not personal requests, not off-topic)
2. Sufficiently well-defined to be actionable
3. Not clearly harmful or malicious

Be strict but fair. Proposals should relate to protocol parameters, treasury, tokenomics,
technical upgrades, partnerships, or governance rules.`;

export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const body = await req.json();

    const { title, summary, motivation, proposed_action, potential_risks, project_id, submitter_address } = body;

    if (!title || !summary || !motivation || !proposed_action) {
      return NextResponse.json(
        { detail: "title, summary, motivation, and proposed_action are required" },
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

    // ── Save as Draft ────────────────────────────────────────────────────────
    const proposal = await dbCreateProposal({
      project_id: project_id ?? "XSEN",
      title,
      summary,
      motivation,
      proposed_action,
      potential_risks: potential_risks ?? null,
      sentinel_analysis: `[Manual submission — Sentinel score: ${score}/100] ${feedback}`,
      source_data: JSON.stringify({ type: "manual", submitter: submitter_address ?? "unknown" }),
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
