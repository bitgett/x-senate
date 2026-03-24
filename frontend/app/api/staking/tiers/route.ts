import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json([
    { tier: "Flexible", lock_days: 0, apy_bps: 500, apy_pct: 5, vp_multiplier: 1.0, description: "No lock. Requires active voting or delegation." },
    { tier: "Lock30",   lock_days: 30,  apy_bps: 1000, apy_pct: 10, vp_multiplier: 1.5, description: "30-day lock. Auto PoP qualification." },
    { tier: "Lock90",   lock_days: 90,  apy_bps: 2000, apy_pct: 20, vp_multiplier: 2.0, description: "90-day lock. Auto PoP qualification." },
    { tier: "Lock180",  lock_days: 180, apy_bps: 3500, apy_pct: 35, vp_multiplier: 3.0, description: "180-day lock. Auto PoP qualification." },
  ]);
}
