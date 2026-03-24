import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const chainIndex = req.nextUrl.searchParams.get("chain_index") ?? "196";
    const tokenAddress = req.nextUrl.searchParams.get("token_address");
    if (!tokenAddress) return NextResponse.json({ detail: "token_address required" }, { status: 400 });

    const res = await fetch("https://www.okx.com/api/v5/dex/security/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chainIndex, tokenContractAddress: tokenAddress }),
    });
    const data = await res.json();
    if (data.code === "0" && data.data?.[0]) {
      const d = data.data[0];
      return NextResponse.json({
        risk_level: d.riskLevel === "1" ? "LOW" : d.riskLevel === "2" ? "MEDIUM" : d.riskLevel === "3" ? "HIGH" : "UNKNOWN",
        risk_items: d.riskItems ?? [],
        ...d,
      });
    }
    return NextResponse.json({ risk_level: "UNKNOWN", error: data.msg });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 503 });
  }
}
