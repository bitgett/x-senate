"""
X-Senate Staking API
Endpoints for stake positions, rewards, and UGA agent leaderboard.
All reads go directly to the XSenateStaking contract on X Layer.
"""
from fastapi import APIRouter, HTTPException

from services.contract_service import (
    get_user_positions,
    get_effective_vp,
    get_staking_leaderboard,
    get_staking_epoch_info,
    get_total_staked_info,
)

router = APIRouter(prefix="/api/staking", tags=["staking"])


@router.get("/epoch")
def staking_epoch():
    """Current epoch info: start/end times, reward pool, total staked."""
    info = get_staking_epoch_info()
    if not info:
        return {"deployed": False, "message": "Run: python backend/scripts/deploy_contract.py"}
    if "error" in info:
        raise HTTPException(status_code=503, detail=info["error"])
    return info


@router.get("/totals")
def staking_totals():
    """Protocol-wide staking totals: total staked + total effective VP."""
    info = get_total_staked_info()
    if not info:
        return {"deployed": False}
    if "error" in info:
        raise HTTPException(status_code=503, detail=info["error"])
    return info


@router.get("/leaderboard")
def agent_leaderboard(limit: int = 20):
    """
    UGA agent leaderboard sorted by total delegated VP.
    Returns rank, agent name, VP, delegator count, rank tier, bonus APY.
    """
    if limit < 1 or limit > 100:
        raise HTTPException(status_code=400, detail="limit must be 1-100")
    data = get_staking_leaderboard(limit)
    if not data:
        return {"deployed": False, "leaderboard": []}
    if isinstance(data, dict) and "error" in data:
        raise HTTPException(status_code=503, detail=data["error"])
    return {"leaderboard": data, "count": len(data)}


@router.get("/positions/{address}")
def user_positions(address: str):
    """
    All stake positions for a wallet address.
    Includes: amount, tier, lock expiry, accrued rewards, delegation.
    """
    if not address.startswith("0x") or len(address) != 42:
        raise HTTPException(status_code=400, detail="Invalid Ethereum address")
    data = get_user_positions(address)
    if not data:
        return {"deployed": False, "positions": []}
    if isinstance(data, dict) and "error" in data:
        raise HTTPException(status_code=503, detail=data["error"])
    return {
        "address":    address,
        "positions":  data,
        "count":      len(data),
        "active_count": sum(1 for p in data if p.get("active")),
    }


@router.get("/vp/{address}")
def voting_power(address: str):
    """
    Effective voting power for a wallet (tier multiplier applied).
    1 XSEN flexible = 1.0 VP
    1 XSEN Lock180  = 3.0 VP
    """
    if not address.startswith("0x") or len(address) != 42:
        raise HTTPException(status_code=400, detail="Invalid Ethereum address")
    data = get_effective_vp(address)
    if not data:
        return {"deployed": False}
    if "error" in data:
        raise HTTPException(status_code=503, detail=data["error"])
    return data


@router.get("/tiers")
def tier_info():
    """Static tier configuration for the frontend."""
    return {
        "tiers": [
            {
                "id":          0,
                "name":        "Flexible",
                "lock_days":   0,
                "apy_pct":     5,
                "vp_mult":     1.0,
                "early_exit":  "No penalty",
                "pop_auto":    False,
            },
            {
                "id":          1,
                "name":        "Lock30",
                "lock_days":   30,
                "apy_pct":     10,
                "vp_mult":     1.5,
                "early_exit":  "Forfeit all accrued rewards",
                "pop_auto":    True,
            },
            {
                "id":          2,
                "name":        "Lock90",
                "lock_days":   90,
                "apy_pct":     20,
                "vp_mult":     2.0,
                "early_exit":  "Forfeit all accrued rewards",
                "pop_auto":    True,
            },
            {
                "id":          3,
                "name":        "Lock180",
                "lock_days":   180,
                "apy_pct":     35,
                "vp_mult":     3.0,
                "early_exit":  "Forfeit all accrued rewards",
                "pop_auto":    True,
            },
        ],
        "min_stake_xsen":  100,
        "token_symbol":    "XSEN",
        "pop_description": (
            "Proof of Participation: You must vote or delegate to earn "
            "rewards on Flexible tier. Lock30+ positions auto-qualify."
        ),
        "rank_tiers": [
            {"rank": "Gold",   "threshold_pct": 10, "bonus_apy_pct": 2.0},
            {"rank": "Silver", "threshold_pct": 30, "bonus_apy_pct": 1.5},
            {"rank": "Bronze", "threshold_pct": 100, "bonus_apy_pct": 1.0},
        ],
    }
