import secrets
import time
import random


def submit_proposal(proposal: dict) -> dict:
    """
    Mock Snapshot.org proposal submission.
    Returns a response matching real Snapshot API shape.
    Swap this file with real Snapshot SDK integration for production.
    """
    fake_id = "0x" + secrets.token_hex(32)
    now = int(time.time())

    return {
        "id": fake_id,
        "title": proposal.get("title", "Untitled Proposal"),
        "body": proposal.get("summary", ""),
        "choices": ["For", "Against", "Abstain"],
        "start": now,
        "end": now + 259200,  # 72 hours
        "snapshot": str(random.randint(19_000_000, 20_000_000)),
        "state": "active",
        "space": {"id": "xdao.eth", "name": "X-Senate DAO"},
        "url": f"https://snapshot.org/#/xdao.eth/proposal/{fake_id}",
        "quorum": "4%",
        "voting_system": "single-choice",
    }
