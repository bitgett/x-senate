"""
OKX OnchainOS Wallet API integration.
Portfolio queries, token balances, and delegation mechanics on X Layer.
Public balance endpoints — no API key required for read operations.
"""
import httpx
from typing import Optional

OKX_BASE = "https://www.okx.com"
XLAYER_CHAIN_INDEX = "196"


async def get_wallet_portfolio(address: str, chains: str = "196") -> dict:
    """
    Get total portfolio value and token balances for a wallet on X Layer.
    Uses public OKX DEX balance API — no auth required.
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        # Total portfolio value
        total_resp = await client.get(
            f"{OKX_BASE}/api/v5/dex/balance/total-value-by-address",
            params={
                "address": address,
                "chains": chains,
                "assetType": "0",  # 0 = on-chain tokens
            },
        )
        total_data = total_resp.json()

        # All token balances
        tokens_resp = await client.get(
            f"{OKX_BASE}/api/v5/dex/balance/all-token-balances-by-address",
            params={"address": address, "chains": chains},
        )
        tokens_data = tokens_resp.json()

    portfolio = {
        "address": address,
        "chain": "X Layer",
        "chain_index": XLAYER_CHAIN_INDEX,
        "total_usd_value": None,
        "tokens": [],
    }

    if total_data.get("code") == "0" and total_data.get("data"):
        portfolio["total_usd_value"] = total_data["data"][0].get("totalValue")

    if tokens_data.get("code") == "0" and tokens_data.get("data"):
        for chain_data in tokens_data["data"]:
            for token in chain_data.get("tokenAssets", []):
                portfolio["tokens"].append({
                    "symbol": token.get("symbol"),
                    "balance": token.get("balance"),
                    "usd_value": token.get("tokenValue"),
                    "token_address": token.get("tokenAddress"),
                })

    return portfolio


async def get_supported_chains() -> list:
    """List all chains supported by OKX DEX."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{OKX_BASE}/api/v5/dex/aggregator/supported/chain")
        data = resp.json()
        if data.get("code") == "0":
            return data.get("data", [])
        return []


async def estimate_voting_power(address: str) -> dict:
    """
    Estimate governance voting power for a wallet based on X Layer token holdings.
    Returns a governance power estimate based on held tokens.
    """
    portfolio = await get_wallet_portfolio(address)

    # Voting power calculation: based on total portfolio value on X Layer
    # In production this would check actual governance token holdings
    total_value = float(portfolio.get("total_usd_value") or 0)

    # Simple VP model: $1 USD = 1 VP (placeholder)
    estimated_vp = total_value

    return {
        "address": address,
        "estimated_vp": estimated_vp,
        "total_portfolio_usd": total_value,
        "tokens": portfolio.get("tokens", []),
        "vp_model": "1 USD = 1 VP (demonstration)",
        "chain": "X Layer (chainIndex: 196)",
    }


async def scan_token_risk(chain_index: str, token_address: str) -> dict:
    """
    Security scan for a token using OKX security API.
    Returns risk level: safe | warn | block
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{OKX_BASE}/api/v5/dex/security/token",
            json={"chainIndex": chain_index, "tokenContractAddress": token_address},
        )
        data = resp.json()
        if data.get("code") == "0" and data.get("data"):
            return data["data"][0]
        return {"riskLevel": "unknown", "error": data.get("msg")}


async def get_xlayer_gas_price() -> dict:
    """Get current gas price on X Layer."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{OKX_BASE}/api/v5/dex/pre-transaction/gas-price",
            params={"chainIndex": XLAYER_CHAIN_INDEX},
        )
        data = resp.json()
        if data.get("code") == "0" and data.get("data"):
            return data["data"][0]
        return {"normal": "N/A", "fast": "N/A", "rapid": "N/A"}
