import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch("https://www.okx.com/api/v5/dex/pre-transaction/gas-price?chainIndex=196");
    const data = await res.json();
    const gasData = data.code === "0" && data.data?.[0] ? data.data[0] : { normal: "N/A", fast: "N/A", rapid: "N/A" };
    return NextResponse.json({
      chain: "X Layer",
      chain_index: "196",
      gas_prices: gasData,
      note: "X Layer supports gasless transactions via OKX infrastructure",
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 503 });
  }
}
