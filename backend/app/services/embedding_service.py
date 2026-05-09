import os
import asyncio
from typing import Optional, List, Dict
from openai import OpenAI

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_EMBEDDING_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")

client = OpenAI(api_key=OPENAI_API_KEY)


def build_query_embedding_text(
    keywords: list[str],
    language: str,
    start_date: str | None = None,
    end_date: str | None = None,
) -> str:
    return (
        f"Search query keywords: {', '.join(keywords)}\n"
        f"Language: {language}"
    )
# ~4 chars per token; leave headroom below the 8192-token model limit
_MAX_EMBEDDING_CHARS = 30_000


def _create_embedding_sync(text: str) -> List[float]:
    response = client.embeddings.create(
        model=OPENAI_EMBEDDING_MODEL,
        input=text[:_MAX_EMBEDDING_CHARS],
    )
    return response.data[0].embedding


async def create_query_embedding(
    keywords: List[str],
    language: str,
    start_date: str,
    end_date: str,
) -> Optional[List[float]]:
    if not OPENAI_API_KEY:
        return None

    text = build_query_embedding_text(
        keywords=keywords,
        language=language,
        start_date=start_date,
        end_date=end_date,
    )

    return await asyncio.to_thread(_create_embedding_sync, text)


async def create_text_embedding(text: str) -> Optional[List[float]]:
    if not OPENAI_API_KEY or not text:
        return None
    return await asyncio.to_thread(_create_embedding_sync, text)