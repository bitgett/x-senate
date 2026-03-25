import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    token_symbol: "XSEN",
    min_stake_xsen: 100,
    pop_description: "Lock30+ auto-qualifies. Flexible requires active vote or delegation.",
    tiers: [
      { id: 0, name: "Flexible", lock_days: 0,   apy_pct: 5,  vp_mult: 1.0, early_exit: "No lock", pop_auto: false },
      { id: 1, name: "Lock30",   lock_days: 30,  apy_pct: 10, vp_mult: 1.5, early_exit: "Forfeit rewards", pop_auto: true },
      { id: 2, name: "Lock90",   lock_days: 90,  apy_pct: 20, vp_mult: 2.0, early_exit: "Forfeit rewards", pop_auto: true },
      { id: 3, name: "Lock180",  lock_days: 180, apy_pct: 35, vp_mult: 3.0, early_exit: "Forfeit rewards", pop_auto: true },
    ],
  });
}
