"""
Mock data source generator — simulates Forum, Discord, and Telegram messages
for the Sentinel agent to analyze.
"""
import random
from datetime import datetime, timedelta
from typing import List, Dict

MOCK_MESSAGES: List[Dict] = [
    # Governance-heavy cluster — staking rewards
    {"source": "forum", "author": "yield_farmer_99", "content": "We need to increase staking rewards by at least 10%. Current APY is not competitive vs Aave.", "timestamp": (datetime.now() - timedelta(hours=2)).isoformat()},
    {"source": "discord", "author": "alpha_chad", "content": "Staking rewards are way too low. Who's going to lock tokens for 5% APY? Ridiculous.", "timestamp": (datetime.now() - timedelta(hours=3)).isoformat()},
    {"source": "telegram", "author": "moon_seeker", "content": "The reward pool allocation needs a vote ASAP. We're losing liquidity to competitors.", "timestamp": (datetime.now() - timedelta(hours=1)).isoformat()},
    {"source": "forum", "author": "defi_architect", "content": "Proposal: Increase staking rewards from 5% to 15% for 6 months to boost TVL. This is urgent governance.", "timestamp": (datetime.now() - timedelta(hours=4)).isoformat()},
    {"source": "discord", "author": "validator_queen", "content": "Treasury has enough to cover a reward increase. Let's put it to a vote. Reward distribution must change.", "timestamp": (datetime.now() - timedelta(hours=5)).isoformat()},
    {"source": "telegram", "author": "whale_anon", "content": "I'll unstake my 2M tokens if rewards don't improve. This is a governance emergency.", "timestamp": (datetime.now() - timedelta(hours=2)).isoformat()},

    # Fee structure discussion
    {"source": "forum", "author": "protocol_nerd", "content": "Current fee structure is outdated. We should implement dynamic fees based on TVL.", "timestamp": (datetime.now() - timedelta(hours=6)).isoformat()},
    {"source": "discord", "author": "gas_watcher", "content": "Fees are killing small users. Need a governance vote to change the fee tier parameters.", "timestamp": (datetime.now() - timedelta(hours=7)).isoformat()},
    {"source": "telegram", "author": "tokenomics_guru", "content": "The tokenomics paper suggested reviewing fees quarterly. It's been 8 months with no vote.", "timestamp": (datetime.now() - timedelta(hours=3)).isoformat()},

    # Treasury burn proposal
    {"source": "forum", "author": "deflationary_dan", "content": "Proposal to burn 5% of treasury tokens quarterly. This would significantly boost token value.", "timestamp": (datetime.now() - timedelta(hours=8)).isoformat()},
    {"source": "discord", "author": "burn_maxi", "content": "Burn the treasury allocation. It's sitting idle. Token holders deserve the value.", "timestamp": (datetime.now() - timedelta(hours=9)).isoformat()},
    {"source": "telegram", "author": "supply_hawk", "content": "We should vote on a burn mechanism. Protocol revenues should go to burn, not to insiders.", "timestamp": (datetime.now() - timedelta(hours=4)).isoformat()},

    # Random chatter (non-governance)
    {"source": "discord", "author": "meme_lord", "content": "GM everyone 🚀 who's buying the dip?", "timestamp": (datetime.now() - timedelta(hours=1)).isoformat()},
    {"source": "telegram", "author": "price_guy", "content": "When lambo? Price action looking spicy today.", "timestamp": (datetime.now() - timedelta(minutes=30)).isoformat()},
    {"source": "discord", "author": "coffee_anon", "content": "Anyone else hate Monday mornings? At least DeFi never sleeps lol", "timestamp": (datetime.now() - timedelta(hours=2)).isoformat()},
    {"source": "forum", "author": "newbie_2023", "content": "Hi just joined the community! How do I get started with staking?", "timestamp": (datetime.now() - timedelta(hours=12)).isoformat()},

    # Technical upgrade discussion
    {"source": "forum", "author": "smart_contract_dev", "content": "The current smart contract architecture needs an upgrade to support EIP-4337. This is a technical governance issue.", "timestamp": (datetime.now() - timedelta(hours=10)).isoformat()},
    {"source": "discord", "author": "solidity_wizard", "content": "Protocol upgrade to v2 is long overdue. Need to put the upgrade parameter change to governance vote.", "timestamp": (datetime.now() - timedelta(hours=11)).isoformat()},

    # Partnership
    {"source": "forum", "author": "ecosystem_builder", "content": "We should vote on allocating budget for ecosystem grants. Strong protocols do this.", "timestamp": (datetime.now() - timedelta(hours=5)).isoformat()},
    {"source": "telegram", "author": "bd_anon", "content": "Partnership with major L2 is on the table but needs governance approval for budget allocation.", "timestamp": (datetime.now() - timedelta(hours=6)).isoformat()},

    # More staking (reinforcing the dominant topic)
    {"source": "forum", "author": "staking_maximalist", "content": "Vote needed: staking reward increase is the #1 community request for 3 months running.", "timestamp": (datetime.now() - timedelta(hours=1)).isoformat()},
    {"source": "discord", "author": "locked_tokens", "content": "My stake is up for renewal. Reward rate is the deciding factor. Governance needs to act on this.", "timestamp": (datetime.now() - timedelta(minutes=45)).isoformat()},
    {"source": "telegram", "author": "passive_income_pro", "content": "APY comparison: us 5%, Aave 8%, Compound 7%. Our staking reward needs a governance update NOW.", "timestamp": (datetime.now() - timedelta(hours=2)).isoformat()},

    # More chatter
    {"source": "discord", "author": "nft_enjoyer", "content": "Anyone minting the new collection? Completely unrelated to governance lol", "timestamp": (datetime.now() - timedelta(hours=3)).isoformat()},
    {"source": "telegram", "author": "chart_watcher", "content": "RSI looking oversold. Not financial advice.", "timestamp": (datetime.now() - timedelta(hours=1)).isoformat()},
]


def get_mock_messages(hours_lookback: int = 7 * 24) -> List[Dict]:
    """Return mock messages filtered to the lookback window."""
    cutoff = datetime.now() - timedelta(hours=hours_lookback)
    return [
        msg for msg in MOCK_MESSAGES
        if datetime.fromisoformat(msg["timestamp"]) > cutoff
    ]


def get_messages_summary() -> str:
    """Format messages as a readable string for Claude to analyze."""
    messages = get_mock_messages()
    lines = []
    for msg in messages:
        source = msg["source"].upper()
        lines.append(f"[{source}] @{msg['author']}: {msg['content']}")
    return "\n".join(lines)
