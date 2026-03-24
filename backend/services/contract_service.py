"""
XSenateGovernor contract interaction service.
Connects the FastAPI backend to the deployed on-chain contract.
"""
import json
import os
from pathlib import Path
from typing import Optional

try:
    from web3 import Web3
    WEB3_AVAILABLE = True
except ImportError:
    WEB3_AVAILABLE = False

XLAYER_RPC      = "https://rpc.xlayer.tech"
XLAYER_CHAIN_ID = 196
DEPLOY_INFO_PATH = Path(__file__).parent.parent / "contract_deployment.json"


def _load_deployment() -> Optional[dict]:
    if DEPLOY_INFO_PATH.exists():
        return json.loads(DEPLOY_INFO_PATH.read_text())
    return None


def _get_w3() -> Optional["Web3"]:
    if not WEB3_AVAILABLE:
        return None
    w3 = Web3(Web3.HTTPProvider(XLAYER_RPC))
    return w3 if w3.is_connected() else None


def _get_w3_and_contract():
    """Returns (w3, governor_contract) using new multi-contract deployment format."""
    if not WEB3_AVAILABLE:
        return None, None
    deployment = _load_deployment()
    if not deployment:
        return None, None
    w3 = Web3(Web3.HTTPProvider(XLAYER_RPC))
    if not w3.is_connected():
        return None, None
    governor_addr = deployment.get("XSenateGovernor", {}).get("address")
    governor_abi  = deployment.get("abi", {}).get("XSenateGovernor")
    if not governor_addr or not governor_abi:
        return None, None
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(governor_addr),
        abi=governor_abi,
    )
    return w3, contract


def _get_w3_and_staking(staking_address: str = None):
    """
    Returns (w3, staking_contract).
    If staking_address is provided, use that directly (for external projects).
    Otherwise falls back to the XSEN native staking from deployment JSON.
    """
    if not WEB3_AVAILABLE:
        return None, None
    deployment = _load_deployment()
    if not deployment:
        return None, None
    w3 = Web3(Web3.HTTPProvider(XLAYER_RPC))
    if not w3.is_connected():
        return None, None

    staking_abi = deployment.get("abi", {}).get("XSenateStaking")
    if not staking_abi:
        return None, None

    addr = staking_address or deployment.get("XSenateStaking", {}).get("address")
    if not addr:
        return None, None

    contract = w3.eth.contract(
        address=Web3.to_checksum_address(addr),
        abi=staking_abi,
    )
    return w3, contract


def get_deployment_info() -> Optional[dict]:
    d = _load_deployment()
    if not d:
        return None
    explorer = "https://www.oklink.com/xlayer"
    return {
        "deployer":        d.get("deployer"),
        "chain":           d.get("chain"),
        "chain_id":        d.get("chain_id"),
        "XToken":          d.get("XToken", {}),
        "XSenateStaking":  d.get("XSenateStaking", {}),
        "XSenateGovernor": d.get("XSenateGovernor", {}),
        "token_distribution": d.get("token_distribution", {}),
        "primary_tx_hash":         d.get("primary_tx_hash"),
        "primary_contract_address": d.get("primary_contract_address"),
        "explorer": explorer,
    }


async def register_proposal_onchain(proposal_id: str, title: str, ipfs_hash: str = "") -> Optional[str]:
    """Register a proposal on XSenateGovernor contract. Returns tx_hash or None."""
    private_key = os.getenv("XLAYER_PRIVATE_KEY")
    if not private_key or not WEB3_AVAILABLE:
        return None

    w3, contract = _get_w3_and_contract()
    if not w3 or not contract:
        return None

    try:
        account = w3.eth.account.from_key(private_key)
        nonce = w3.eth.get_transaction_count(account.address)
        tx = contract.functions.registerProposal(
            proposal_id, title, ipfs_hash
        ).build_transaction({
            "from": account.address,
            "nonce": nonce,
            "gasPrice": w3.eth.gas_price,
            "chainId": XLAYER_CHAIN_ID,
        })
        signed = w3.eth.account.sign_transaction(tx, private_key)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
        return tx_hash.hex()
    except Exception as e:
        print(f"Contract call failed: {e}")
        return None


async def cast_senate_vote_onchain(
    proposal_id: str, agent_name: str, vote: str, reason: str
) -> Optional[str]:
    """Record a senate vote on-chain. Returns tx_hash or None."""
    private_key = os.getenv("XLAYER_PRIVATE_KEY")
    if not private_key or not WEB3_AVAILABLE:
        return None

    w3, contract = _get_w3_and_contract()
    if not w3 or not contract:
        return None

    try:
        account = w3.eth.account.from_key(private_key)
        vote_choice = 0 if vote == "Approve" else 1
        nonce = w3.eth.get_transaction_count(account.address)
        tx = contract.functions.castSenateVote(
            proposal_id, agent_name, vote_choice, reason[:100]
        ).build_transaction({
            "from": account.address,
            "nonce": nonce,
            "gasPrice": w3.eth.gas_price,
            "chainId": XLAYER_CHAIN_ID,
        })
        signed = w3.eth.account.sign_transaction(tx, private_key)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
        return tx_hash.hex()
    except Exception as e:
        print(f"Contract vote failed: {e}")
        return None


async def execute_proposal_onchain(proposal_id: str) -> Optional[str]:
    """Execute a proposal on-chain. Returns tx_hash or None."""
    private_key = os.getenv("XLAYER_PRIVATE_KEY")
    if not private_key or not WEB3_AVAILABLE:
        return None

    w3, contract = _get_w3_and_contract()
    if not w3 or not contract:
        return None

    try:
        account = w3.eth.account.from_key(private_key)
        nonce = w3.eth.get_transaction_count(account.address)
        tx = contract.functions.executeProposal(proposal_id).build_transaction({
            "from": account.address,
            "nonce": nonce,
            "gasPrice": w3.eth.gas_price,
            "chainId": XLAYER_CHAIN_ID,
        })
        signed = w3.eth.account.sign_transaction(tx, private_key)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
        return tx_hash.hex()
    except Exception as e:
        print(f"Contract execute failed: {e}")
        return None


def get_proposal_onchain(proposal_id: str) -> Optional[dict]:
    """Read proposal state from contract."""
    w3, contract = _get_w3_and_contract()
    if not w3 or not contract:
        return None
    try:
        result = contract.functions.getProposal(proposal_id).call()
        status_map = ["Draft","InSenate","RejectedBySenate","InDebate","Executed","Cancelled"]
        return {
            "proposal_id": result[0],
            "title": result[1],
            "ipfs_hash": result[2],
            "sentinel": result[3],
            "created_at": result[4],
            "executed_at": result[5],
            "status": status_map[result[6]] if result[6] < len(status_map) else "Unknown",
            "approvals": result[7],
            "rejections": result[8],
            "debate_ipfs_hash": result[9],
            "total_delegated_vp": result[10],
        }
    except Exception as e:
        return {"error": str(e)}


# ── Staking contract reads ──────────────────────────────────────────

TIER_NAMES = ["Flexible", "Lock30", "Lock90", "Lock180"]
RANK_NAMES = ["Bronze", "Silver", "Gold"]


def get_user_positions(user_address: str, staking_address: str = None) -> Optional[list]:
    """Return all stake positions for a user address."""
    w3, contract = _get_w3_and_staking(staking_address)
    if not w3 or not contract:
        return None
    try:
        addr = Web3.to_checksum_address(user_address)
        raw  = contract.functions.getUserPositions(addr).call()
        result = []
        for p in raw:
            result.append({
                "id":              p[0],
                "owner":           p[1],
                "amount":          str(p[2]),
                "amount_xsen":     p[2] / 1e18,
                "tier":            TIER_NAMES[p[3]] if p[3] < 4 else str(p[3]),
                "lock_end":        p[4],
                "staked_at":       p[5],
                "last_reward_at":  p[6],
                "acc_reward":      str(p[7]),
                "acc_reward_xsen": p[7] / 1e18,
                "delegated_agent": p[8],
                "active":          p[9],
            })
        return result
    except Exception as e:
        return {"error": str(e)}


def get_effective_vp(user_address: str, staking_address: str = None) -> Optional[dict]:
    """Return effective voting power (with tier multiplier applied)."""
    w3, contract = _get_w3_and_staking(staking_address)
    if not w3 or not contract:
        return None
    try:
        addr = Web3.to_checksum_address(user_address)
        vp   = contract.functions.getEffectiveVP(addr).call()
        return {"address": user_address, "effective_vp": str(vp), "effective_vp_xsen": vp / 1e18}
    except Exception as e:
        return {"error": str(e)}


def get_staking_leaderboard(limit: int = 20, staking_address: str = None) -> Optional[list]:
    """Return the UGA agent leaderboard sorted by delegated VP."""
    w3, contract = _get_w3_and_staking(staking_address)
    if not w3 or not contract:
        return None
    try:
        raw = contract.functions.getLeaderboard(limit).call()
        result = []
        for i, a in enumerate(raw):
            result.append({
                "rank":              i + 1,
                "agent_name":        a[0],
                "total_delegated_vp": str(a[1]),
                "total_delegated_vp_xsen": a[1] / 1e18,
                "delegator_count":   a[2],
                "voted_this_epoch":  a[3],
                "tier":              RANK_NAMES[a[4]] if a[4] < 3 else "Bronze",
                "bonus_bps":         a[5],
                "bonus_pct":         a[5] / 100,
            })
        return result
    except Exception as e:
        return {"error": str(e)}


def get_staking_epoch_info(staking_address: str = None) -> Optional[dict]:
    """Return current epoch info from staking contract."""
    w3, contract = _get_w3_and_staking(staking_address)
    if not w3 or not contract:
        return None
    try:
        e = contract.functions.getCurrentEpoch().call()
        return {
            "epoch_id":     e[0],
            "start_time":   e[1],
            "end_time":     e[2],
            "total_staked": str(e[3]),
            "total_staked_xsen": e[3] / 1e18,
            "reward_pool":  str(e[4]),
            "reward_pool_xsen": e[4] / 1e18,
            "finalized":    e[5],
        }
    except Exception as e:
        return {"error": str(e)}


def get_total_staked_info(staking_address: str = None) -> Optional[dict]:
    """Return protocol-wide staking totals."""
    w3, contract = _get_w3_and_staking(staking_address)
    if not w3 or not contract:
        return None
    try:
        total_staked = contract.functions.totalStaked().call()
        total_eff_vp = contract.functions.totalEffectiveVP().call()
        return {
            "total_staked":      str(total_staked),
            "total_staked_xsen": total_staked / 1e18,
            "total_effective_vp": str(total_eff_vp),
            "total_effective_vp_xsen": total_eff_vp / 1e18,
        }
    except Exception as e:
        return {"error": str(e)}
