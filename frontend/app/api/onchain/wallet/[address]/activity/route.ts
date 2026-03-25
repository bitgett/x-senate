import { NextRequest, NextResponse } from "next/server";

const STAKING_ADDR  = (process.env.NEXT_PUBLIC_XSEN_STAKING_ADDRESS  ?? "").toLowerCase();
const TOKEN_ADDR    = (process.env.NEXT_PUBLIC_XSEN_TOKEN_ADDRESS     ?? "").toLowerCase();
const GOVERNOR_ADDR = (process.env.NEXT_PUBLIC_XSEN_GOVERNOR_ADDRESS  ?? "").toLowerCase();
const REGISTRY_ADDR = (process.env.NEXT_PUBLIC_XSEN_REGISTRY_ADDRESS  ?? "").toLowerCase();

// First 4 bytes of keccak256 for known function signatures
const METHOD_MAP: Record<string, { label: string; category: string }> = {
  "0x7acb7757": { label: "Stake",           category: "staking"    },
  "0x2e17de78": { label: "Unstake",         category: "staking"    },
  "0x372500ab": { label: "Claim Rewards",   category: "staking"    },
  "0x4e71d92d": { label: "Claim All",       category: "staking"    },
  "0xa2b8e3e5": { label: "Delegate",        category: "delegation" },
  "0x3ccfd60b": { label: "Delegate VP",     category: "delegation" },
  "0x1c9b2dee": { label: "Cast Vote",       category: "governance" },
  "0x095ea7b3": { label: "Approve",         category: "token"      },
  "0xa9059cbb": { label: "Transfer",        category: "token"      },
};

function categorize(to: string, methodId: string): { label: string; category: string } {
  const method = METHOD_MAP[methodId?.slice(0, 10)];
  if (method) return method;

  const t = (to ?? "").toLowerCase();
  if (t === STAKING_ADDR)  return { label: "Staking",    category: "staking"    };
  if (t === GOVERNOR_ADDR) return { label: "Governance", category: "governance" };
  if (t === REGISTRY_ADDR) return { label: "Registry",   category: "registry"   };
  if (t === TOKEN_ADDR)    return { label: "Token",      category: "token"      };
  return { label: "Transaction", category: "other" };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  const limit = req.nextUrl.searchParams.get("limit") ?? "50";

  try {
    // OKLink explorer API for X Layer transaction history
    const res = await fetch(
      `https://www.oklink.com/api/v5/explorer/address/transaction-list?chainShortName=XLAYER&address=${address}&limit=${limit}`,
      {
        headers: {
          "Ok-Access-Key": process.env.OKLINK_API_KEY ?? "",
          "Content-Type": "application/json",
        },
        next: { revalidate: 30 },
      }
    );

    if (!res.ok) throw new Error(`OKLink ${res.status}`);
    const data = await res.json();

    if (data.code !== "0") throw new Error(data.msg ?? "OKLink error");

    const raw = data.data?.[0]?.transactionList ?? [];

    const txs = raw.map((tx: any) => {
      const cat = categorize(tx.to, tx.methodId);
      return {
        txHash:    tx.txId,
        method:    tx.methodId,
        label:     cat.label,
        category:  cat.category,
        from:      tx.from,
        to:        tx.to,
        time:      Number(tx.transactionTime),
        state:     tx.state,
        fee:       tx.txFee,
        amount:    tx.amount,
        symbol:    tx.transactionSymbol,
        blockHeight: tx.height,
        explorerUrl: `https://www.okx.com/web3/explorer/xlayer/tx/${tx.txId}`,
      };
    });

    // Filter to only X-Senate relevant contracts
    const relevant = txs.filter((tx: any) => tx.category !== "other");

    return NextResponse.json({
      address,
      total: raw.length,
      xsenate_count: relevant.length,
      transactions: relevant,
      all_transactions: txs,
      explorer_url: `https://www.okx.com/web3/explorer/xlayer/address/${address}`,
    });
  } catch (err) {
    // Fallback: return empty with explorer link
    return NextResponse.json({
      address,
      total: 0,
      xsenate_count: 0,
      transactions: [],
      all_transactions: [],
      explorer_url: `https://www.okx.com/web3/explorer/xlayer/address/${address}`,
      error: String(err),
    });
  }
}
