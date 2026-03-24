import json
import re
import anthropic
from config import ANTHROPIC_API_KEY, CLAUDE_MODEL
from typing import AsyncGenerator, Optional

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
async_client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)


def complete(system: str, user: str, max_tokens: int = 2000) -> str:
    """Blocking Claude call — returns full text response."""
    message = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return message.content[0].text


def complete_json(system: str, user: str, max_tokens: int = 1500) -> dict:
    """Blocking Claude call — extracts and parses JSON from response."""
    text = complete(system, user + "\n\nRespond with valid JSON only.", max_tokens)
    # Extract JSON block if wrapped in markdown
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        text = match.group(1)
    else:
        # Try to find first { ... } block
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            text = match.group(0)
    return json.loads(text)


async def stream_complete(system: str, user: str, max_tokens: int = 2000) -> AsyncGenerator[str, None]:
    """Async streaming Claude call — yields text chunks."""
    async with async_client.messages.stream(
        model=CLAUDE_MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    ) as stream:
        async for text in stream.text_stream:
            yield text


async def complete_async(system: str, user: str, max_tokens: int = 2000) -> str:
    """Async blocking Claude call — returns full text."""
    message = await async_client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return message.content[0].text
