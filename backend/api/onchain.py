"""
X Layer OnchainOS integration endpoints.
Market API, Wallet API, and gas price queries.
"""
from fastapi import APIRouter, HTTPException
from services.okx_market_api import (
    get_xlayer_market_summary,
    get_token_price,
    get_trending_tokens,
    XLAYER_CHAIN_INDEX,
    XLAYER_TOKENS,
)
from services.contract_service import (
    get_deployment_info,
    get_proposal_onchain,
)
from services.okx_wallet_api import (
    get_wallet_portfolio,
    estimate_voting_power,
    get_xlayer_gas_price,
    scan_token_risk,
)

router = APIRouter(prefix="/api/onchain", tags=["onchain"])


@router.get("/market/summary")
async def xlayer_market_summary():
    """Get X Layer market conditions — real data from OKX Market API."""
    try:
        data = await get_xlayer_market_summary()
        return {
            "chain": "X Layer",
            "chain_index": XLAYER_CHAIN_INDEX,
            "data_source": "OKX OnchainOS Market API",
            **data,
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Market API unavailable: {str(e)}")


@router.get("/market/price")
async def token_price(
    chain_index: str = XLAYER_CHAIN_INDEX,
    token_address: str = None,
):
    """Get real-time token price from OKX Market API."""
    addr = token_address or XLAYER_TOKENS["native"]
    try:
        data = await get_token_price(chain_index, addr)
        return {"chain_index": chain_index, "token_address": addr, **data}
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/market/trending")
async def trending_tokens(chain_index: str = XLAYER_CHAIN_INDEX, limit: int = 10):
    """Get trending tokens on X Layer."""
    try:
        return await get_trending_tokens(chain_index, limit)
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/wallet/{address}/portfolio")
async def wallet_portfolio(address: str, chains: str = "196"):
    """
    Get wallet portfolio on X Layer.
    Uses OKX OnchainOS Wallet API.
    """
    try:
        return await get_wallet_portfolio(address, chains)
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/wallet/{address}/voting-power")
async def voting_power(address: str):
    """
    Estimate governance voting power for a wallet address.
    Based on X Layer token holdings via OKX Wallet API.
    """
    try:
        return await estimate_voting_power(address)
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/gas")
async def xlayer_gas():
    """Get current X Layer gas prices from OKX API."""
    try:
        data = await get_xlayer_gas_price()
        return {
            "chain": "X Layer",
            "chain_index": XLAYER_CHAIN_INDEX,
            "gas_prices": data,
            "note": "X Layer supports gasless transactions via OKX infrastructure",
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/security/scan-token")
async def security_scan(chain_index: str, token_address: str):
    """Security scan a token via OKX Security API."""
    try:
        return await scan_token_risk(chain_index, token_address)
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/contract")
def contract_info():
    """Return deployed XSenateGovernor contract info."""
    info = get_deployment_info()
    if not info:
        return {
            "deployed": False,
            "message": "Run: python backend/scripts/deploy_contract.py",
        }
    return {"deployed": True, **info}


@router.get("/contract/proposal/{proposal_id}")
def onchain_proposal(proposal_id: str):
    """Read proposal state directly from XSenateGovernor contract."""
    result = get_proposal_onchain(proposal_id)
    if not result:
        return {"error": "Contract not deployed or not connected"}
    return result


@router.get("/xlayer/info")
def xlayer_info():
    """X Layer network information for the frontend."""
    return {
        "name": "X Layer",
        "chain_index": "196",
        "chain_id": 196,
        "rpc": "https://rpc.xlayer.tech",
        "explorer": "https://www.oklink.com/xlayer",
        "native_token": "OKB",
        "governance_contract": "Pending deployment",
        "onchainos_skills_used": ["Market API", "Wallet API"],
        "api_base": "https://www.okx.com/api/v5/dex",
    }
