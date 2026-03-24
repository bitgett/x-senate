from collections import Counter
from typing import List, Dict, Tuple
from config import GOVERNANCE_KEYWORDS, KEYWORD_THRESHOLD


def detect_hot_topics(messages: List[Dict]) -> Tuple[bool, Dict[str, int], str]:
    """
    Analyze messages for governance-relevant keywords.

    Returns:
        triggered: bool — whether threshold was exceeded
        keyword_counts: dict — counts per keyword
        dominant_topic: str — the most discussed topic cluster
    """
    all_text = " ".join(msg["content"].lower() for msg in messages)
    keyword_counts = {}
    for kw in GOVERNANCE_KEYWORDS:
        count = all_text.count(kw)
        if count > 0:
            keyword_counts[kw] = count

    triggered = any(count >= KEYWORD_THRESHOLD for count in keyword_counts.values())

    # Identify dominant topic (highest count keyword)
    dominant_topic = ""
    if keyword_counts:
        dominant_kw = max(keyword_counts, key=keyword_counts.get)
        dominant_topic = dominant_kw

    return triggered, keyword_counts, dominant_topic


def classify_message(content: str) -> str:
    """Classify a message as 'governance' or 'chatter'."""
    content_lower = content.lower()
    governance_hits = sum(1 for kw in GOVERNANCE_KEYWORDS if kw in content_lower)
    return "governance" if governance_hits >= 1 else "chatter"
