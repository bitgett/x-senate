/**
 * On-chain read helpers using ethers.js JsonRpcProvider.
 * Used by staking + registry API routes (server-side).
 */
import { ethers } from "ethers";

const XLAYER_RPC    = "https://rpc.xlayer.tech";
const STAKING_ADDR  = process.env.XSEN_STAKING_ADDRESS  ?? "0xc8FD7B12De6bFb10dF3eaCb38AAc09CBbeb25bFD";
const REGISTRY_ADDR = process.env.XSEN_REGISTRY_ADDRESS ?? "0x111bC1681fc34EAcab66f75D8273C4ECD49b13e5";

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
  "function getStakingForProject(string projectId) view returns (address)",
];

function provider() {
  return new ethers.JsonRpcProvider(XLAYER_RPC);
}

function staking(addr = STAKING_ADDR) {
  return new ethers.Contract(addr, STAKING_ABI, provider());
}

function registry(addr = REGISTRY_ADDR) {
  return new ethers.Contract(addr, REGISTRY_ABI, provider());
}

export async function getStakingEpochInfo(stakingAddress?: string): Promise<Record<string, unknown>> {
  try {
    const r = await staking(stakingAddress).getEpochInfo();
    return {
      epoch_id:         Number(r.epochId),
      start_time:       Number(r.startTime),
      end_time:         Number(r.endTime),
      reward_pool_xsen: Number(ethers.formatEther(r.rewardPool)),
      finalized:        r.finalized,
      next_epoch_in:    formatCountdown(Number(r.endTime) - Math.floor(Date.now() / 1000)),
      current_epoch:    Number(r.epochId),
      reward_pool:      Number(ethers.formatEther(r.rewardPool)),
    };
  } catch {
    // fallback so UI doesn't break if contract call fails
    return {
      epoch_id: 1, current_epoch: 1,
      start_time: Date.now() / 1000 - 3600,
      end_time:   Date.now() / 1000 + 604800,
      reward_pool_xsen: 20_000_000, reward_pool: 20_000_000,
      finalized: false,
      next_epoch_in: "7d 0h",
    };
  }
}

export async function getTotalStakedInfo(stakingAddress?: string): Promise<Record<string, unknown>> {
  try {
    const r = await staking(stakingAddress).getTotalStaked();
    return {
      total_staked_xsen:       Number(ethers.formatEther(r.totalStaked)),
      total_effective_vp_xsen: Number(ethers.formatEther(r.totalEffectiveVP)),
    };
  } catch {
    return { total_staked_xsen: 0, total_effective_vp_xsen: 0 };
  }
}

const RANK_LABELS: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th" };

export async function getLeaderboard(limit = 10, stakingAddress?: string): Promise<unknown[]> {
  try {
    const rows = await staking(stakingAddress).getLeaderboard(limit);
    return rows.map((r: any, i: number) => ({
      rank:                    i + 1,
      rank_label:              RANK_LABELS[i + 1] ?? `${i + 1}th`,
      agent_name:              r.agentName,
      agent_address:           r.agent,
      total_delegated_vp_xsen: Number(ethers.formatEther(r.totalDelegatedVP)),
      delegator_count:         0,
      is_genesis:              false,
      voted_this_epoch:        false,
    }));
  } catch {
    return [];
  }
}

export async function getUserPositions(userAddress: string, stakingAddress?: string): Promise<unknown[]> {
  try {
    const rows = await staking(stakingAddress).getUserPositions(userAddress);
    return rows.map((p: any) => ({
      id:             Number(p.id),
      owner:          p.owner,
      amount_xsen:    Number(ethers.formatEther(p.amount)),
      tier:           Number(p.tier),
      lockEnd:        Number(p.lockEnd),
      stakedAt:       Number(p.stakedAt),
      lastRewardAt:   Number(p.lastRewardAt),
      accReward_xsen: Number(ethers.formatEther(p.accReward)),
      delegatedAgent: p.delegatedAgent,
      active:         p.active,
    }));
  } catch {
    return [];
  }
}

export async function getEffectiveVP(userAddress: string, stakingAddress?: string): Promise<number> {
  try {
    const vp = await staking(stakingAddress).getEffectiveVP(userAddress);
    return Number(ethers.formatEther(vp));
  } catch {
    return 0;
  }
}

export async function getRegistryProjects(): Promise<unknown[]> {
  try {
    const rows = await registry().getAllProjects();
    return rows.map((p: any) => ({
      projectId:       p.projectId,
      name:            p.name,
      tokenAddress:    p.tokenAddress,
      stakingContract: p.stakingContract,
      registrant:      p.registrant,
      registeredAt:    Number(p.registeredAt),
      active:          p.active,
    }));
  } catch {
    return [];
  }
}

export async function getRegistryProjectCount(): Promise<number> {
  try {
    const count = await registry().getProjectCount();
    return Number(count);
  } catch {
    return 0;
  }
}

export function getDeploymentAddresses() {
  return {
    XSenateStaking:  { address: STAKING_ADDR },
    XSenateRegistry: { address: REGISTRY_ADDR },
  };
}

// ── helpers ──────────────────────────────────────────────────────────────────
function formatCountdown(sec: number): string {
  if (sec <= 0) return "Ended";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}
