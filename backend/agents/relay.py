import json
from typing import AsyncGenerator, List, Dict
from agents.personas import PERSONAS
from services.claude_client import stream_complete, complete_async
from config import GENESIS_5

DEBATE_SYSTEM_SUFFIX = """

DEBATE INSTRUCTIONS:
- You are in a live relay debate with the other Senate members.
- Read all prior arguments carefully before responding.
- Directly reference and respond to specific points made by other agents (use their names).
- State your position clearly and defend it with your persona's priorities.
- End your argument with a one-liner summary prefixed with "MY STANCE: "
- Keep your argument between 150-250 words. Be sharp and direct."""

SUMMARIZER_SYSTEM = """You are a neutral debate summarizer for X-Senate.
Given a full relay debate between 5 AI governance agents, extract each agent's ONE-LINER stance.
Look for lines starting with "MY STANCE:" in each agent's argument.
If not found, write your own one-liner based on their argument.

Output valid JSON:
{
  "Guardian": "one-liner",
  "Merchant": "one-liner",
  "Architect": "one-liner",
  "Diplomat": "one-liner",
  "Populist": "one-liner"
}"""


def _format_debate_history(history: List[Dict]) -> str:
    if not history:
        return "(No prior arguments — you speak first.)"
    lines = []
    for turn in history:
        lines.append(f"--- {turn['agent_name']} ---\n{turn['full_argument']}\n")
    return "\n".join(lines)


async def run_relay_debate(proposal: dict) -> AsyncGenerator[Dict, None]:
    """
    Run the relay debate sequentially, yielding each turn as it completes.
    Each agent receives the full prior debate history as context.

    Yields dicts:
      - type: "turn_start" | "chunk" | "turn_end" | "summary" | "done"
    """
    debate_history: List[Dict] = []

    for turn_order, agent_name in enumerate(GENESIS_5):
        persona = PERSONAS[agent_name]
        system = persona["system_prompt"] + DEBATE_SYSTEM_SUFFIX

        prior_turns = _format_debate_history(debate_history)
        user_msg = f"""PROPOSAL UNDER DEBATE:
Title: {proposal.get('title', '')}
Summary: {proposal.get('summary', '')}
Proposed Action: {proposal.get('proposed_action', '')}
Potential Risks: {proposal.get('potential_risks', '')}

PRIOR DEBATE ARGUMENTS:
{prior_turns}

---
It is now YOUR turn, {agent_name}. Respond to the above arguments and state your position.
Remember to end with "MY STANCE: [one sentence]"."""

        yield {
            "type": "turn_start",
            "agent_name": agent_name,
            "turn_order": turn_order,
            "emoji": persona["emoji"],
            "color": persona["color"],
        }

        full_argument = ""
        async for chunk in stream_complete(system, user_msg, max_tokens=400):
            full_argument += chunk
            yield {
                "type": "chunk",
                "agent_name": agent_name,
                "turn_order": turn_order,
                "chunk": chunk,
            }

        # Extract one-liner
        one_liner = ""
        if "MY STANCE:" in full_argument:
            one_liner = full_argument.split("MY STANCE:")[-1].strip()
            one_liner = one_liner.split("\n")[0].strip()
        else:
            one_liner = full_argument[:100].strip() + "..."

        debate_history.append({
            "agent_name": agent_name,
            "turn_order": turn_order,
            "full_argument": full_argument,
            "one_liner": one_liner,
        })

        yield {
            "type": "turn_end",
            "agent_name": agent_name,
            "turn_order": turn_order,
            "full_argument": full_argument,
            "one_liner": one_liner,
        }

    # Generate final summary
    debate_text = _format_debate_history(debate_history)
    try:
        summary_text = await complete_async(
            system=SUMMARIZER_SYSTEM,
            user=f"Extract one-liners from this debate:\n\n{debate_text}",
            max_tokens=400,
        )
        import re
        match = re.search(r"\{.*\}", summary_text, re.DOTALL)
        one_liners = json.loads(match.group(0)) if match else {}
    except Exception:
        one_liners = {turn["agent_name"]: turn["one_liner"] for turn in debate_history}

    yield {
        "type": "summary",
        "one_liners": one_liners,
        "full_debate": debate_history,
    }

    yield {"type": "done"}
