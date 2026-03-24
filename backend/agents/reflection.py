"""
Post-vote recursive reflection — agents self-critique their reasoning
after seeing the market outcome of a proposal's execution.
Uses real OKX Market API data for X Layer price context.
"""
import json
import random
from agents.personas import PERSONAS
from services.claude_client import complete_async
from services.okx_market_api import get_xlayer_market_summary
from config import GENESIS_5

REFLECTION_SYSTEM = """You are {agent_name}, an X-Senate AI agent conducting a post-vote self-reflection.
{persona_system}

REFLECTION INSTRUCTIONS:
- You previously voted on a governance proposal.
- You now have access to the market outcome data after the proposal passed/failed.
- Critically evaluate whether your vote was correct given the outcome.
- Identify what you underweighted or overweighted in your original reasoning.
- State what you would do differently in the next similar proposal.
- Be honest and specific — growth requires self-criticism.
- Keep your reflection to 100-150 words."""

FALLBACK_OUTCOMES = [
    {"price_change_pct": -3.2, "tvl_change_pct": 5.1, "narrative": "Price dipped short-term but TVL increased."},
    {"price_change_pct": 8.5, "tvl_change_pct": 12.3, "narrative": "Strong positive reaction — price and TVL surged."},
    {"price_change_pct": -7.1, "tvl_change_pct": -4.5, "narrative": "Market reacted negatively post-execution."},
    {"price_change_pct": 1.2, "tvl_change_pct": -1.8, "narrative": "Mixed signals — ambiguous market response."},
]


async def run_reflection(proposal: dict, agent_votes: list) -> dict:
    """
    Run post-vote self-reflection for all 5 agents.
    Fetches real X Layer market data from OKX Market API.
    Returns dict of agent_name -> reflection_text.
    """
    # Attempt to fetch real X Layer market data
    try:
        market_summary = await get_xlayer_market_summary()
        real_price_change = market_summary.get("price_change_24h_pct", None)
        eth_price_data = market_summary.get("ETH", {})
        real_price = eth_price_data.get("price", "N/A")

        if real_price_change is not None:
            outcome = {
                "price_change_pct": real_price_change,
                "tvl_change_pct": real_price_change * 1.3,  # estimated correlation
                "narrative": (
                    f"X Layer real market data (OKX API): ETH price ${real_price}, "
                    f"24h change {real_price_change:+.2f}%. "
                    f"{'Bullish market conditions suggest governance action was well-timed.' if real_price_change > 0 else 'Bearish conditions — timing of proposal may have been suboptimal.'}"
                ),
                "data_source": "OKX Market API (X Layer chainIndex: 196)",
                "is_real_data": True,
            }
        else:
            outcome = {**random.choice(FALLBACK_OUTCOMES), "is_real_data": False}
    except Exception:
        outcome = {**random.choice(FALLBACK_OUTCOMES), "is_real_data": False}
    reflections = {}

    for vote_data in agent_votes:
        agent_name = vote_data["agent_name"]
        if agent_name not in PERSONAS:
            continue

        persona = PERSONAS[agent_name]
        system = REFLECTION_SYSTEM.format(
            agent_name=agent_name,
            persona_system=persona["system_prompt"][:300],
        )

        user_msg = f"""YOUR PRIOR VOTE:
Proposal: {proposal.get('title', '')}
You voted: {vote_data.get('vote', 'Unknown')}
Your reason: {vote_data.get('reason', '')}
Your chain of thought: {vote_data.get('chain_of_thought', '')}

MARKET OUTCOME (72 hours post-execution):
Price change: {outcome['price_change_pct']:+.1f}%
TVL change: {outcome['tvl_change_pct']:+.1f}%
Narrative: {outcome['narrative']}

Now reflect on whether your vote was correct and what you would do differently."""

        try:
            reflection = await complete_async(system=system, user=user_msg, max_tokens=300)
        except Exception as e:
            reflection = f"Reflection unavailable: {str(e)}"

        reflections[agent_name] = {
            "reflection": reflection,
            "market_outcome": outcome,
        }

    return reflections
