from typing import List, Dict
from config import SENATE_APPROVAL_THRESHOLD


def count_votes(votes: List[Dict]) -> Dict:
    """
    Count senate votes and determine the outcome.

    Args:
        votes: list of dicts with 'agent', 'vote' (Approve/Reject), 'confidence'

    Returns:
        dict with approve_count, reject_count, passed, breakdown
    """
    approve_count = sum(1 for v in votes if v.get("vote") == "Approve")
    reject_count = sum(1 for v in votes if v.get("vote") == "Reject")
    passed = approve_count >= SENATE_APPROVAL_THRESHOLD

    return {
        "approve_count": approve_count,
        "reject_count": reject_count,
        "total_votes": len(votes),
        "threshold": SENATE_APPROVAL_THRESHOLD,
        "passed": passed,
        "result": "Passed" if passed else "Rejected",
        "breakdown": [
            {"agent": v["agent"], "vote": v["vote"], "confidence": v.get("confidence", 0)}
            for v in votes
        ]
    }
