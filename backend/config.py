import os
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./x_senate.db")

KEYWORD_THRESHOLD = int(os.getenv("KEYWORD_THRESHOLD", "5"))
GOVERNANCE_KEYWORDS = [
    "fee", "fees", "treasury", "upgrade", "vote", "voting", "parameter",
    "tokenomics", "reward", "rewards", "burn", "staking", "stake",
    "proposal", "governance", "fund", "budget", "allocation", "emission",
    "protocol", "smart contract", "liquidity", "tvl", "apy"
]

SENATE_APPROVAL_THRESHOLD = 3
GENESIS_5 = ["Guardian", "Merchant", "Architect", "Diplomat", "Populist"]
