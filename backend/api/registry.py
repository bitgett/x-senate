"""
X-Senate Registry API
Endpoints for project registration and directory lookup.
Any X Layer ERC20 project can register to use the AI governance platform.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from services.registry_service import (
    get_all_projects,
    get_project,
    get_staking_for_project,
    get_project_count,
    register_project_onchain,
    deploy_project_staking,
)
from services.contract_service import (
    get_staking_epoch_info,
    get_total_staked_info,
)

router = APIRouter(prefix="/api/registry", tags=["registry"])


class RegisterProjectRequest(BaseModel):
    project_id:    str              # Uppercase identifier, e.g. "AAVE"
    name:          str              # Human-readable name
    token_address: str              # ERC20 token address on X Layer
    staking_address: Optional[str] = None  # Pre-deployed staking, or backend deploys


@router.get("/projects")
def list_projects():
    """
    List all projects registered in the X-Senate governance platform.
    Each project has its own staking pool and can submit proposals to the AI Senate.
    """
    data = get_all_projects()
    if data is None:
        return {
            "deployed": False,
            "projects": [],
            "message": "Registry not deployed. Run: python backend/scripts/deploy_contract.py",
        }
    if isinstance(data, dict) and "error" in data:
        raise HTTPException(status_code=503, detail=data["error"])
    return {
        "projects": data,
        "count":    len(data),
        "platform": "X-Senate AI Governance Platform",
    }


@router.get("/projects/{project_id}")
def get_project_info(project_id: str):
    """Get detailed info for a single registered project."""
    data = get_project(project_id.upper())
    if not data:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")
    if isinstance(data, dict) and "error" in data:
        raise HTTPException(status_code=503, detail=data["error"])
    return data


@router.get("/projects/{project_id}/staking")
def project_staking_info(project_id: str):
    """Get staking contract info for a specific project."""
    staking_addr = get_staking_for_project(project_id.upper())
    if not staking_addr:
        raise HTTPException(status_code=404, detail=f"No staking contract for '{project_id}'")

    epoch  = get_staking_epoch_info(staking_addr)
    totals = get_total_staked_info(staking_addr)

    return {
        "project_id":       project_id.upper(),
        "staking_contract": staking_addr,
        "epoch":            epoch,
        "totals":           totals,
    }


@router.post("/projects")
async def register_project(body: RegisterProjectRequest):
    """
    Register a new project to use X-Senate AI governance.

    PERMISSIONLESS: any X Layer project can register.

    Flow:
      1. If staking_address not provided, backend deploys a new XSenateStaking
         for the project's token (Genesis 5 agents are auto-registered)
      2. Registry contract records the project on-chain
      3. Project can now create proposals via /api/proposals/?project_id=...

    Note: In production, caller pays 1000 XSEN registration fee.
    For hackathon demo, the deployer wallet covers this (registerNativeProject).
    """
    project_id = body.project_id.upper().strip()
    if not project_id:
        raise HTTPException(status_code=400, detail="project_id required")
    if not body.token_address.startswith("0x") or len(body.token_address) != 42:
        raise HTTPException(status_code=400, detail="Invalid token_address")

    staking_addr = body.staking_address

    # Step 1: Deploy staking if not provided
    if not staking_addr:
        staking_addr = await deploy_project_staking(body.token_address)
        if not staking_addr:
            raise HTTPException(
                status_code=503,
                detail="Failed to deploy staking contract. Check XLAYER_PRIVATE_KEY and OKB balance."
            )

    # Step 2: Register in registry contract
    tx_hash = await register_project_onchain(
        project_id, body.name, body.token_address, staking_addr
    )
    if not tx_hash:
        raise HTTPException(
            status_code=503,
            detail="Failed to register in on-chain registry. Staking was deployed at: " + staking_addr
        )

    return {
        "success":          True,
        "project_id":       project_id,
        "name":             body.name,
        "token_address":    body.token_address,
        "staking_contract": staking_addr,
        "tx_hash":          tx_hash,
        "message": (
            f"Project {project_id} registered! "
            f"Create proposals at POST /api/proposals/ with project_id='{project_id}'. "
            f"Staking at {staking_addr}"
        ),
    }


@router.get("/stats")
def platform_stats():
    """High-level platform statistics for the homepage."""
    count = get_project_count()
    return {
        "registered_projects": count,
        "platform":            "X-Senate AI Governance Platform",
        "network":             "X Layer (chainId: 196)",
        "ai_senate":           "Genesis 5 (Guardian, Merchant, Architect, Diplomat, Populist)",
        "registration_fee":    "1000 XSEN",
        "fee_destination":     "XSEN staker ecosystem fund",
    }
