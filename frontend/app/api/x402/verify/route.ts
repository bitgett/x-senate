/**
 * POST /api/x402/verify
 * Verifies that a TX on X Layer transferred enough XSEN to the treasury.
 *
 * Body: { tx_hash, from_address, required_xsen_wei }
 * Returns: { verified, amount_received_wei, amount_received_xsen, error? }
 */
import { NextRequest, NextResponse } from "next/server";

const XLAYER_RPC   = "https://rpc.xlayer.tech";
const XSEN_ADDRESS = "0x1bAB744c4c98D844984e297744Cb6b4E24e2E89b".toLowerCase();
const TREASURY     = "0x8266D8e3B231dfD16fa21e40Cc3B99F38bC4B6C2".toLowerCase();

// ERC20 Transfer(address indexed from, address indexed to, uint256 value)
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

async function rpc(method: string, params: any[]) {
  const res = await fetch(XLAYER_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = await res.json();
  return data.result;
}

export async function POST(req: NextRequest) {
  try {
    const { tx_hash, from_address, required_xsen_wei } = await req.json();

    if (!tx_hash) {
      return NextResponse.json({ verified: false, error: "tx_hash required" }, { status: 400 });
    }

    // Get transaction receipt from X Layer
    const receipt = await rpc("eth_getTransactionReceipt", [tx_hash]);

    if (!receipt) {
      return NextResponse.json({ verified: false, error: "Transaction not found or not yet confirmed" });
    }

    if (receipt.status !== "0x1") {
      return NextResponse.json({ verified: false, error: "Transaction failed on-chain" });
    }

    // Find XSEN Transfer event to treasury
    const logs: any[] = receipt.logs ?? [];
    let amountWei = 0n;

    for (const log of logs) {
      if (
        log.address?.toLowerCase() === XSEN_ADDRESS &&
        log.topics?.[0] === TRANSFER_TOPIC &&
        log.topics?.[2] // to address in topics[2]
      ) {
        const toAddress = "0x" + log.topics[2].slice(26); // last 20 bytes
        if (toAddress.toLowerCase() === TREASURY) {
          amountWei += BigInt(log.data);
        }
      }
    }

    if (amountWei === 0n) {
      return NextResponse.json({ verified: false, error: "No XSEN transfer to treasury found in this TX" });
    }

    const requiredWei = BigInt(required_xsen_wei ?? "0");
    if (amountWei < requiredWei) {
      return NextResponse.json({
        verified: false,
        error: `Insufficient payment: received ${amountWei} wei, required ${requiredWei} wei`,
        amount_received_wei: amountWei.toString(),
      });
    }

    return NextResponse.json({
      verified: true,
      amount_received_wei: amountWei.toString(),
      amount_received_xsen: Number(amountWei) / 1e18,
      tx_hash,
    });

  } catch (e: any) {
    return NextResponse.json({ verified: false, error: e.message ?? String(e) }, { status: 500 });
  }
}
