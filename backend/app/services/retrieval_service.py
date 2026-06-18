"""Vector retrieval over the pgvector skill knowledge base.

Embeds a natural-language query with Gemini, then runs an approximate
nearest-neighbour search in Postgres via the `match_skill_kb` SQL function
(cosine distance over an HNSW index). Talks to Postgres over PostgREST's
RPC endpoint, reusing the same service-role auth as the rest of the app —
no extra database driver or connection string required.
"""

from typing import Any, Optional

import httpx

from app.services import supabase_service
from app.services.embedding_service import embed_query, to_pgvector

_TIMEOUT = httpx.Timeout(15.0)


async def search_skills(
    query: str,
    *,
    match_count: int = 4,
    min_similarity: float = 0.3,
) -> list[dict[str, Any]]:
    """Return the knowledge-base cards most semantically similar to `query`.

    Each result carries its cosine `similarity` (0-1, higher = closer). An
    empty list is returned when Supabase is not configured, so callers can
    degrade gracefully rather than fail.
    """
    if not supabase_service.is_configured():
        return []

    query_vector = await embed_query(query)
    payload = {
        "query_embedding": to_pgvector(query_vector),
        "match_count": match_count,
        "min_similarity": min_similarity,
    }

    url = supabase_service._supabase_url()
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        response = await client.post(
            f"{url}/rest/v1/rpc/match_skill_kb",
            json=payload,
            headers=supabase_service._service_headers(),
        )
    response.raise_for_status()
    rows = response.json()
    return rows if isinstance(rows, list) else []


async def retrieve_for_gaps(
    gaps: list[str],
    *,
    per_gap: int = 2,
    max_cards: int = 6,
) -> list[dict[str, Any]]:
    """Retrieve and de-duplicate knowledge cards for a list of skill gaps.

    Searches the KB once per gap, then merges the hits keeping the highest
    similarity seen for each card, so the coach is grounded in the most
    relevant material without repeating a card the gaps share.
    """
    best: dict[str, dict[str, Any]] = {}
    for gap in gaps:
        if not gap or not gap.strip():
            continue
        for card in await search_skills(gap, match_count=per_gap):
            slug = card.get("slug") or card.get("id")
            if slug is None:
                continue
            existing: Optional[dict[str, Any]] = best.get(slug)
            if existing is None or card.get("similarity", 0) > existing.get("similarity", 0):
                best[slug] = card

    ranked = sorted(best.values(), key=lambda c: c.get("similarity", 0), reverse=True)
    return ranked[:max_cards]
