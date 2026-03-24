import json
from services.mock_sources import get_mock_messages, get_messages_summary
from services.claude_client import complete_json
from utils.keyword_detector import detect_hot_topics, classify_message

SENTINEL_SYSTEM = """You are Sentinel, the intelligence-gathering AI of X-Senate.
Your job is to monitor community discussions and identify the most pressing governance issue,
then draft a formal governance proposal for the Senate to review.

When given a set of community messages, you must:
1. Identify the dominant governance concern
2. Draft a well-structured formal proposal
3. Assess community sentiment and urgency

Always output valid JSON with this exact structure:
{
  "title": "Short, clear proposal title (max 10 words)",
  "summary": "2-3 sentence summary of what is being proposed",
  "motivation": "Why this proposal is needed — cite community sentiment and data",
  "proposed_action": "Specific, actionable change being requested",
  "potential_risks": "Honest assessment of what could go wrong",
  "sentinel_analysis": "Your meta-analysis: urgency level (Low/Medium/High/Critical), dominant topic, approximate community consensus percentage",
  "dominant_keyword": "The single governance keyword that appeared most"
}"""


def run_sentinel_scan() -> dict:
    """
    Run a full Sentinel scan cycle:
    1. Fetch mock community messages
    2. Detect hot topics via keyword analysis
    3. If threshold triggered, generate proposal draft via Claude
    Returns a result dict with scan summary and optional draft proposal.
    """
    messages = get_mock_messages()

    # Classify each message
    classified = [
        {**msg, "classification": classify_message(msg["content"])}
        for msg in messages
    ]

    governance_msgs = [m for m in classified if m["classification"] == "governance"]
    chatter_msgs = [m for m in classified if m["classification"] == "chatter"]

    # Keyword detection
    triggered, keyword_counts, dominant_topic = detect_hot_topics(messages)

    result = {
        "total_messages_scanned": len(messages),
        "governance_messages": len(governance_msgs),
        "chatter_messages": len(chatter_msgs),
        "keyword_counts": keyword_counts,
        "dominant_topic": dominant_topic,
        "threshold_triggered": triggered,
        "sources": {
            "forum": len([m for m in messages if m["source"] == "forum"]),
            "discord": len([m for m in messages if m["source"] == "discord"]),
            "telegram": len([m for m in messages if m["source"] == "telegram"]),
        },
        "draft_proposal": None,
        "messages_preview": [
            {"source": m["source"], "author": m["author"], "content": m["content"], "classification": m["classification"]}
            for m in classified[:15]
        ]
    }

    if triggered:
        messages_text = get_messages_summary()
        top_keywords = sorted(keyword_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        kw_summary = ", ".join(f'"{kw}" ({cnt}x)' for kw, cnt in top_keywords)

        user_prompt = f"""Community messages from the past 7 days:

{messages_text}

---
Top governance keywords detected: {kw_summary}
Dominant topic cluster: "{dominant_topic}"
Total governance-relevant messages: {len(governance_msgs)}

Draft a formal governance proposal based on the most pressing community concern."""

        try:
            draft = complete_json(SENTINEL_SYSTEM, user_prompt, max_tokens=1500)
            draft["source_data"] = json.dumps([
                {"source": m["source"], "content": m["content"]}
                for m in governance_msgs[:10]
            ])
            result["draft_proposal"] = draft
        except Exception as e:
            result["error"] = str(e)

    return result
