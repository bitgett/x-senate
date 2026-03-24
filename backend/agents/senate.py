import asyncio
import json
from agents.personas import PERSONAS, GENESIS_5 as PERSONA_NAMES
from services.claude_client import complete_json, complete_async
from utils.vote_counter import count_votes
from config import GENESIS_5
import re

SENATE_REVIEW_USER_TEMPLATE = """A Sentinel AI has identified the following governance proposal for your review.

PROPOSAL FOR REVIEW:
Title: {title}
Summary: {summary}
Motivation: {motivation}
Proposed Action: {proposed_action}
Potential Risks: {potential_risks}
Sentinel Analysis: {sentinel_analysis}

---
As {agent_name}, review this proposal and cast your vote.
Respond with valid JSON only:
{{"vote": "Approve" or "Reject", "reason": "concise 1-2 sentence reason", "chain_of_thought": "your detailed reasoning process (3-5 sentences)", "confidence": 0-100}}"""


def _extract_vote_json(text: str) -> dict:
    """Extract JSON from Claude response, handling markdown code blocks."""
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        return json.loads(match.group(1))
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    return json.loads(text)


async def _vote_async(agent_name: str, proposal: dict) -> dict:
    """Single agent async vote."""
    persona = PERSONAS[agent_name]
    user_msg = SENATE_REVIEW_USER_TEMPLATE.format(
        title=proposal.get("title", ""),
        summary=proposal.get("summary", ""),
        motivation=proposal.get("motivation", ""),
        proposed_action=proposal.get("proposed_action", ""),
        potential_risks=proposal.get("potential_risks", ""),
        sentinel_analysis=proposal.get("sentinel_analysis", ""),
        agent_name=agent_name,
    )

    try:
        text = await complete_async(
            system=persona["system_prompt"],
            user=user_msg,
            max_tokens=800,
        )
        vote_data = _extract_vote_json(text)
        return {
            "agent": agent_name,
            "vote": vote_data.get("vote", "Reject"),
            "reason": vote_data.get("reason", ""),
            "chain_of_thought": vote_data.get("chain_of_thought", ""),
            "confidence": int(vote_data.get("confidence", 50)),
        }
    except Exception as e:
        return {
            "agent": agent_name,
            "vote": "Reject",
            "reason": f"Error during review: {str(e)}",
            "chain_of_thought": "Technical error prevented proper review.",
            "confidence": 0,
        }


async def run_senate_review(proposal: dict) -> dict:
    """
    Run all 5 Genesis agents in parallel.
    Returns individual votes + aggregated result.
    """
    tasks = [_vote_async(agent_name, proposal) for agent_name in GENESIS_5]
    votes = await asyncio.gather(*tasks)
    tally = count_votes(list(votes))
    return {
        "votes": list(votes),
        "tally": tally,
        "status": "In_Debate" if tally["passed"] else "Rejected_Senate",
    }


async def run_senate_review_streaming(proposal: dict):
    """
    Generator that yields each vote result as it completes.
    Runs agents sequentially for streaming UX (one card appears at a time).
    """
    all_votes = []
    for agent_name in GENESIS_5:
        vote = await _vote_async(agent_name, proposal)
        all_votes.append(vote)
        yield vote

    tally = count_votes(all_votes)
    yield {
        "type": "tally",
        "tally": tally,
        "status": "In_Debate" if tally["passed"] else "Rejected_Senate",
    }
