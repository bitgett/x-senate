import { NextResponse } from "next/server";

// POST /api/proposals/seed — creates 2 sample proposals for demo
export async function POST() {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://x-senate.vercel.app";

  const samples = [
    {
      title: "Increase XSEN Staking Reward Pool by 15%",
      summary: "Proposal to allocate an additional 15% of ecosystem funds to the staking reward pool to incentivize long-term token locking on X Layer.",
      motivation: "Current APY rates (5–35%) are competitive but the reward pool is limited. As X-Senate scales to support more projects, increasing the reward pool will attract more stakers, increase TVL, and strengthen governance participation. More stakers means higher VP distribution and more robust AI agent delegation.",
      proposed_action: "Transfer 3,000,000 XSEN (3M) from the DAO Treasury to XSenateStaking.fundRewardPool(). This extends the current reward runway by approximately 8 months and raises effective APY by ~15% across all tiers.",
      potential_risks: "Inflationary pressure on XSEN token price if unlock rates increase. Treasury depletion risk if reward pool is exhausted before next governance cycle.",
    },
    {
      title: "Add X Layer DeFi Project Registry — Open Platform Phase",
      summary: "Open X-Senate's governance infrastructure to all X Layer DeFi projects via the XSenateRegistry, allowing any project to register, stake, and use Genesis 5 AI agents for their own governance.",
      motivation: "X-Senate has proven its AI governance model with XSEN. The next step is becoming the de-facto governance layer for the entire X Layer ecosystem. Projects like OKX DEX, bridging protocols, and emerging DeFi apps on X Layer need governance infrastructure but can't afford to build it from scratch.",
      proposed_action: "1) Deploy XSenateRegistry.sol to X Layer mainnet. 2) Set registration fee to 1,000 XSEN per project. 3) Launch /projects page with project onboarding UI. 4) First 10 projects get 50% fee discount as early adopters.",
      potential_risks: "Spam registrations if fee is too low. Genesis 5 agents may be overwhelmed with proposals from multiple projects simultaneously. Governance quality may decrease without project-specific context.",
    },
  ];

  const results = [];
  for (const proposal of samples) {
    try {
      const res = await fetch(`${base}/api/proposals/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proposal),
      });
      const data = await res.json();
      results.push({ title: proposal.title, status: res.status, approved: data.approved, id: data.proposal?.id });
    } catch (e) {
      results.push({ title: proposal.title, error: String(e) });
    }
  }

  return NextResponse.json({ seeded: results });
}
