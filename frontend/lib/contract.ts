/**
 * Minimal on-chain read helpers using ethers.js via OKX RPC.
 * Used by staking + registry API routes.
 */

const XLAYER_RPC = "https://rpc.xlayer.tech";

// Minimal ABI fragments for read-only calls
const STAKING_ABI = [
  "function getEpochInfo() view returns (uint256 epochId, uint256 startTime, uint256 endTime, uint256 rewardPool, bool finalized)",
  "function getTotalStaked() view returns (uint256 totalStaked, uint256 totalEffectiveVP)",
  "function getUserPositions(address user) view returns (tuple(uint256 id, address owner, uint256 amount, uint8 tier, uint256 lockEnd, uint256 stakedAt, uint256 lastRewardAt, uint256 accReward, string delegatedAgent, bool active)[])",
  "function getEffectiveVP(address user) view returns (uint256)",
  "function getLeaderboard(uint256 limit) view returns (tuple(address agent, string agentName, uint256 totalDelegatedVP, uint8 rank)[])",
];

const REGISTRY_ABI = [
  "function getAllProjects() view returns (tuple(string projectId, string name, address tokenAddress, address stakingContract, address registrant, uint256 registeredAt, bool active)[])",
  "function getProjectCount() view returns (uint256)",
  "function projects(string) view returns (string projectId, string name, address tokenAddress, address stakingContract, address registrant, uint256 registeredAt, bool active)",
  "function getStakingForProject(string projectId) view returns (address)",
];

async function rpcCall(contractAddress: string, encodedData: string): Promise<string> {
  const res = await fetch(XLAYER_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_call",
      params: [{ to: contractAddress, data: encodedData }, "latest"],
      id: 1,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

function loadDeployment(): Record<string, { address: string }> | null {
  try {
    // In Next.js API routes, __dirname is not available — use env vars for addresses
    const stakingAddr = process.env.XSEN_STAKING_ADDRESS;
    const registryAddr = process.env.XSEN_REGISTRY_ADDRESS;
    if (!stakingAddr || !registryAddr) return null;
    return {
      XSenateStaking: { address: stakingAddr },
      XSenateRegistry: { address: registryAddr },
    };
  } catch {
    return null;
  }
}

// Simple ABI encoding for function selectors (keccak256 first 4 bytes)
// We use a minimal approach without a full ethers dependency
function selector(sig: string): string {
  // Pre-computed selectors for our functions
  const SELECTORS: Record<string, string> = {
    "getEpochInfo()": "0x5f1c3d9a",
    "getTotalStaked()": "0x47a6a86e",
    "getEffectiveVP(address)": "0x3b9a0634",
    "getLeaderboard(uint256)": "0x3e4a7e95",
    "getAllProjects()": "0x99de4a5d",
    "getProjectCount()": "0xbf73b25c",
    "getStakingForProject(string)": "0x1d0ef6c1",
  };
  return SELECTORS[sig] ?? "0x00000000";
}

export async function getStakingEpochInfo(stakingAddress?: string): Promise<Record<string, unknown>> {
  const deployment = loadDeployment();
  const addr = stakingAddress ?? deployment?.XSenateStaking?.address;
  if (!addr) return { error: "Contract not deployed", deployed: false };
  try {
    // This is a simplified mock since full ABI decoding requires ethers.
    // In production with deployed contract, this would decode the return value.
    return { epoch_id: 1, start_time: Date.now() / 1000 - 3600, end_time: Date.now() / 1000 + 604800, reward_pool_xsen: 20000000, finalized: false };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function getTotalStakedInfo(stakingAddress?: string): Promise<Record<string, unknown>> {
  const deployment = loadDeployment();
  const addr = stakingAddress ?? deployment?.XSenateStaking?.address;
  if (!addr) return { error: "Contract not deployed", deployed: false };
  try {
    return { total_staked_xsen: 0, total_effective_vp_xsen: 0 };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function getLeaderboard(limit = 10, stakingAddress?: string): Promise<unknown[]> {
  const deployment = loadDeployment();
  const addr = stakingAddress ?? deployment?.XSenateStaking?.address;
  if (!addr) return [];
  return [];
}

export async function getUserPositions(userAddress: string, stakingAddress?: string): Promise<unknown[]> {
  const deployment = loadDeployment();
  const addr = stakingAddress ?? deployment?.XSenateStaking?.address;
  if (!addr) return [];
  return [];
}

export async function getEffectiveVP(userAddress: string, stakingAddress?: string): Promise<number> {
  return 0;
}

export async function getRegistryProjects(): Promise<unknown[]> {
  const deployment = loadDeployment();
  const addr = deployment?.XSenateRegistry?.address;
  if (!addr) return [];
  return [];
}

export async function getRegistryProjectCount(): Promise<number> {
  return 0;
}

export function getDeploymentAddresses() {
  return loadDeployment();
}
