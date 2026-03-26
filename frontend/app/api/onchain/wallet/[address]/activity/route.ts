import { NextRequest, NextResponse } from "next/server";

const XLAYER_RPC     = "https://rpc.xlayer.tech";
const XLAYER_EXPLORER = "https://www.okx.com/web3/explorer/xlayer";

const STAKING_ADDR  = "0x9CD9eF69c4EE176c8115E4BCf6c604Eb46599502".toLowerCase();
const TOKEN_ADDR    = "0x1bAB744c4c98D844984e297744Cb6b4E24e2E89b".toLowerCase();
const GOVERNOR_ADDR = "0xa140f36Cc529e6487b877547A543213aD2ae39dF".toLowerCase();
const REGISTRY_ADDR = "0xFd11e955CCEA6346911F33119B3bf84b3f0E6678".toLowerCase();

// Known event topic0 hashes → label / category
const EVENT_MAP: Record<string, { label: string; category: string }> = {
  // ERC20
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef": { label: "Transfer",       category: "token"      },
  "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925": { label: "Approve",        category: "token"      },
  // Common staking event signatures
  "0x9e71bc8eea02a63969f509818f2dafb9254532904319f9dbda79b67bd34a5f3d": { label: "Stake",          category: "staking"    },
  "0x7084f5476618d8e60b11ef0d7d3f06914655adb8793e28ff7f018d4c76d505d5": { label: "Unstake",        category: "staking"    },
  "0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c": { label: "Stake",          category: "staking"    },
  "0x884edad9ce6fa2440d8a54cc123490eb96d2768479d49ff9c7366125a9424364": { label: "Unstake",        category: "staking"    },
  "0x2717ead6b9200dd235aad468c9809ea400fe33ac69b5bfaa6d3e90fc922b6398": { label: "Reward Claimed", category: "staking"    },
  "0xf279e6a1f5e320cca91135676d9cb6e44ca8a08c0b88342bcdb1144f6511b568": { label: "Cooldown Start", category: "staking"    },
  // Governance
  "0xb8e138887d0aa13bab447e82de9d5c1777041ecd21ca36ba824ff1e6c07ddda4": { label: "Vote Cast",      category: "governance" },
  "0x7d84a6263ae0d98d3329bd7b46bb4e8d6f98cd35a7adb45c274c8b7fd5edc5e0": { label: "Proposal",       category: "governance" },
  // Registry
  "0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0": { label: "Registry",       category: "registry"   },
};

function classifyLog(log: any, userAddr: string): { label: string; category: string } {
  const topic0 = log.topics?.[0];
  const known = topic0 ? EVENT_MAP[topic0] : null;
  if (known) {
    // For Transfer: distinguish send vs receive
    if (topic0 === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") {
      const from = ("0x" + (log.topics[1] ?? "").slice(26)).toLowerCase();
      const to   = ("0x" + (log.topics[2] ?? "").slice(26)).toLowerCase();
      if (from === userAddr) return { label: "Transfer Out", category: "token" };
      if (to   === userAddr) return { label: "Transfer In",  category: "token" };
      return known;
    }
    return known;
  }
  // Classify by contract
  const addr = (log.address ?? "").toLowerCase();
  if (addr === STAKING_ADDR)  return { label: "Staking Tx",    category: "staking"    };
  if (addr === GOVERNOR_ADDR) return { label: "Governance Tx", category: "governance" };
  if (addr === REGISTRY_ADDR) return { label: "Registry Tx",   category: "registry"   };
  return { label: "Transaction",  category: "other" };
}

async function rpcCall(method: string, params: any[]): Promise<any> {
  const res = await fetch(XLAYER_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(8000),
  });
  const json = await res.json();
  return json.result;
}

async function getBlockNumber(): Promise<number> {
  const hex = await rpcCall("eth_blockNumber", []);
  return parseInt(hex, 16);
}

async function getLogs(filter: object): Promise<any[]> {
  const result = await rpcCall("eth_getLogs", [filter]);
  return Array.isArray(result) ? result : [];
}

async function getBlockTimestamp(blockHex: string): Promise<number> {
  const block = await rpcCall("eth_getBlockByNumber", [blockHex, false]);
  return block ? parseInt(block.timestamp, 16) * 1000 : 0;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "50");
  const userAddr = address.toLowerCase();
  const paddedUser = "0x000000000000000000000000" + userAddr.slice(2);

  try {
    const latestBlock = await getBlockNumber();
    // ~100k blocks ≈ 2-3 days on X Layer (2s block time)
    const fromBlock = "0x" + Math.max(0, latestBlock - 100_000).toString(16);
    const toBlock   = "latest";

    // Query in parallel:
    // 1. XSEN Transfer events (from user)
    // 2. XSEN Transfer events (to user)
    // 3. All Staking contract events with user in topics
    // 4. All Governor contract events with user in topics
    const [
      transfersFrom,
      transfersTo,
      stakingLogs,
      governorLogs,
    ] = await Promise.all([
      getLogs({ address: TOKEN_ADDR,    fromBlock, toBlock, topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", paddedUser] }),
      getLogs({ address: TOKEN_ADDR,    fromBlock, toBlock, topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", null, paddedUser] }),
      getLogs({ address: STAKING_ADDR,  fromBlock, toBlock, topics: [null, paddedUser] }),
      getLogs({ address: GOVERNOR_ADDR, fromBlock, toBlock, topics: [null, paddedUser] }),
    ]);

    // De-duplicate by txHash+logIndex
    const seen = new Set<string>();
    const allLogs: any[] = [];
    for (const log of [...transfersFrom, ...transfersTo, ...stakingLogs, ...governorLogs]) {
      const key = `${log.transactionHash}-${log.logIndex}`;
      if (!seen.has(key)) { seen.add(key); allLogs.push(log); }
    }

    // Sort by blockNumber desc (most recent first)
    allLogs.sort((a, b) => parseInt(b.blockNumber, 16) - parseInt(a.blockNumber, 16));

    // Fetch timestamps for unique blocks (up to first `limit` logs)
    const topLogs = allLogs.slice(0, limit);
    const uniqueBlocks = [...new Set(topLogs.map(l => l.blockNumber))];
    const timestampMap: Record<string, number> = {};
    await Promise.all(
      uniqueBlocks.slice(0, 30).map(async blk => {
        timestampMap[blk] = await getBlockTimestamp(blk).catch(() => 0);
      })
    );

    // Build TX list — one entry per txHash (use the most significant log)
    const txMap = new Map<string, any>();
    for (const log of topLogs) {
      const txHash = log.transactionHash;
      if (txMap.has(txHash)) continue;
      const cat = classifyLog(log, userAddr);
      const blockNum = parseInt(log.blockNumber, 16);
      const time = timestampMap[log.blockNumber] ?? 0;

      // Parse amount from data (uint256, 18 decimals for XSEN)
      let amount = "0";
      let symbol = "";
      const addr = (log.address ?? "").toLowerCase();
      if (addr === TOKEN_ADDR && log.data && log.data !== "0x") {
        try {
          const raw = BigInt(log.data);
          amount = (Number(raw) / 1e18).toFixed(4);
          symbol = "XSEN";
        } catch { /* */ }
      }

      txMap.set(txHash, {
        txHash,
        label:       cat.label,
        category:    cat.category,
        blockHeight: blockNum,
        time,
        state:       "success",
        amount,
        symbol,
        explorerUrl: `${XLAYER_EXPLORER}/tx/${txHash}`,
      });
    }

    const txs = [...txMap.values()];

    return NextResponse.json({
      address,
      total:          allLogs.length,
      xsenate_count:  txs.filter(t => t.category !== "token" && t.category !== "other").length,
      transactions:   txs.filter(t => t.category !== "other"),
      all_transactions: txs,
      explorer_url:   `${XLAYER_EXPLORER}/address/${address}`,
      source:         "xlayer_rpc",
    });
  } catch (err) {
    return NextResponse.json({
      address,
      total:           0,
      xsenate_count:   0,
      transactions:    [],
      all_transactions: [],
      explorer_url:    `${XLAYER_EXPLORER}/address/${address}`,
      error:           String(err),
      source:          "error",
    });
  }
}
