from __future__ import annotations

import logging
from typing import List, Dict

logger = logging.getLogger(__name__)


async def search_web(query: str, max_results: int = 4) -> List[Dict[str, str]]:
    """Search DuckDuckGo and return top results as list of {title, url, snippet}."""
    try:
        from duckduckgo_search import DDGS
        results = []
        with DDGS() as ddgs:
            for r in ddgs.text(query, max_results=max_results, region="ru-ru"):
                results.append({
                    "title":   r.get("title", ""),
                    "url":     r.get("href", ""),
                    "snippet": r.get("body", ""),
                })
        return results
    except Exception as exc:
        logger.warning("Web search failed: %s", exc)
        return []


def needs_search(message: str) -> bool:
    """Return True if the message likely needs current/factual information."""
    msg = message.lower()
    keywords = [
        # Prices / products
        "сколько стоит", "цена", "стоимость", "купить", "price", "cost", "buy",
        # Current events
        "сейчас", "сегодня", "новости", "latest", "now", "today", "news", "current",
        # Recent years
        "2024", "2025", "2026",
        # Factual questions
        "кто такой", "что такое", "когда вышел", "когда выйдет",
        "who is", "what is", "when did", "when will",
        # Specific products/events
        "iphone", "samsung", "tesla", "openai", "курс", "доллар", "евро",
    ]
    return any(kw in msg for kw in keywords)


def format_search_context(results: List[Dict[str, str]]) -> str:
    """Format search results into a context string for the AI prompt."""
    if not results:
        return ""
    lines = ["[Актуальная информация из интернета:]"]
    for i, r in enumerate(results, 1):
        lines.append(f"{i}. {r['title']}")
        if r["snippet"]:
            lines.append(f"   {r['snippet'][:300]}")
        lines.append(f"   Источник: {r['url']}")
    lines.append("[Используй эти данные для ответа, но синтезируй информацию своими словами.]")
    return "\n".join(lines)
