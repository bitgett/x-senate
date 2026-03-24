"""
OKX OnchainOS Market API integration.
Real-time price data from X Layer (chainIndex=196) and other chains.
Public endpoints — no API key required for price queries.
"""
import httpx
from typing import Optional

OKX_BASE = "https://www.okx.com"
XLAYER_CHAIN_INDEX = "196"

# Known X Layer token addresses
XLAYER_TOKENS = {
    "native": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",  # ETH (native)
    "OKB": "0x3f4b6664338f23d2397c953f2ab4ce8031663f80",    # OKB on X Layer
    "USDT": "0x1e4a5963abfd975d8c9021ce480b42188849d41d",   # USDT on X Layer
    "USDC": "0x74b7f16337b8972027f6196a17a631ac6de26d22",   # USDC on X Layer
}


async def get_token_price(chain_index: str = XLAYER_CHAIN_INDEX, token_address: str = None) -> dict:
    """
    Fetch real-time token price from OKX Market API.
    Uses X Layer (chainIndex=196) by default.
    """
    if token_address is None:
        token_address = XLAYER_TOKENS["native"]

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{OKX_BASE}/api/v5/dex/market/price",
            params={"chainIndex": chain_index, "tokenAddress": token_address},
        )
        data = resp.json()
        if data.get("code") == "0" and data.get("data"):
            return data["data"][0]
        # Fallback — try alternative endpoint format
        return {"price": None, "error": data.get("msg", "Price unavailable")}


async def get_multiple_prices(tokens: list[dict]) -> list:
    """
    Batch price fetch: tokens = [{"chainIndex": "196", "tokenAddress": "0x..."}]
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{OKX_BASE}/api/v5/dex/market/prices",
            json={"prices": tokens},
        )
        data = resp.json()
        if data.get("code") == "0":
            return data.get("data", [])
        return []


async def get_token_kline(
    chain_index: str = XLAYER_CHAIN_INDEX,
    token_address: str = None,
    bar: str = "1H",
    limit: int = 24
) -> list:
    """
    Fetch candlestick/K-line data for a token.
    bar options: 1m, 5m, 1H, 4H, 1D
    """
    if token_address is None:
        token_address = XLAYER_TOKENS["native"]

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{OKX_BASE}/api/v5/dex/market/kline",
            params={
                "chainIndex": chain_index,
                "tokenAddress": token_address,
                "bar": bar,
            },
        )
        data = resp.json()
        if data.get("code") == "0":
            return data.get("data", [])
        return []


async def get_xlayer_market_summary() -> dict:
    """
    Get a summary of X Layer market conditions for agent reflection context.
    Returns price changes for key tokens.
    """
    results = {}
    try:
        # Fetch native ETH price on X Layer
        eth_price = await get_token_price(
            chain_index=XLAYER_CHAIN_INDEX,
            token_address=XLAYER_TOKENS["native"]
        )
        results["ETH"] = eth_price

        # Fetch kline for price change context
        kline = await get_token_kline(
            chain_index=XLAYER_CHAIN_INDEX,
            token_address=XLAYER_TOKENS["native"],
            bar="1H",
        )
        if kline and len(kline) >= 2:
            # kline format: [timestamp, open, high, low, close, vol, volUsd, confirm]
            latest_close = float(kline[0][4]) if kline[0][4] else None
            prev_close = float(kline[-1][4]) if kline[-1][4] else None
            if latest_close and prev_close and prev_close != 0:
                change_pct = ((latest_close - prev_close) / prev_close) * 100
                results["price_change_24h_pct"] = round(change_pct, 2)
            results["kline_data"] = kline[:5]  # last 5 candles

    except Exception as e:
        results["error"] = str(e)
        results["price_change_24h_pct"] = 0.0

    return results


async def get_trending_tokens(chain_index: str = XLAYER_CHAIN_INDEX, limit: int = 5) -> list:
    """Get trending tokens on X Layer for Sentinel analysis context."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{OKX_BASE}/api/v5/dex/market/token-list",
            params={"chainIndex": chain_index, "limit": limit},
        )
        data = resp.json()
        if data.get("code") == "0":
            return data.get("data", {}).get("tokens", [])
        return []
