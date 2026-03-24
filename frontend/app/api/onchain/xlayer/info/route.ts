import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    name: "X Layer",
    chain_index: "196",
    chain_id: 196,
    rpc: "https://rpc.xlayer.tech",
    explorer: "https://www.oklink.com/xlayer",
    native_token: "OKB",
    onchainos_skills_used: ["Market API", "Wallet API"],
    api_base: "https://www.okx.com/api/v5/dex",
  });
}
