"""Tests for the pgvector retrieval layer with embeddings + HTTP mocked.

No real Gemini or Postgres: `embed_query` is patched to a fixed vector and
httpx.AsyncClient is replaced with a fake returning canned RPC rows, so we can
assert the RPC payload, graceful degradation, and gap de-duplication.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services import retrieval_service as rs


def _fake_response(json_data):
    resp = MagicMock()
    resp.json.return_value = json_data
    resp.raise_for_status = MagicMock()
    return resp


def _patch_client(resp):
    client = SimpleNamespace(post=AsyncMock(return_value=resp))
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=client)
    cm.__aexit__ = AsyncMock(return_value=False)
    return patch("app.services.retrieval_service.httpx.AsyncClient", return_value=cm), client


@pytest.mark.asyncio
async def test_search_skills_returns_empty_when_unconfigured():
    with patch.object(rs.supabase_service, "is_configured", return_value=False):
        out = await rs.search_skills("kubernetes")
    assert out == []


@pytest.mark.asyncio
async def test_search_skills_embeds_query_and_calls_rpc():
    rows = [{"slug": "kubernetes", "name": "Kubernetes", "similarity": 0.81}]
    p, client = _patch_client(_fake_response(rows))
    with patch.object(rs.supabase_service, "is_configured", return_value=True), \
         patch.object(rs.supabase_service, "_supabase_url", return_value="https://proj.supabase.co"), \
         patch.object(rs.supabase_service, "_service_headers", return_value={"apikey": "k"}), \
         patch.object(rs, "embed_query", AsyncMock(return_value=[0.1, 0.2])), \
         p:
        out = await rs.search_skills("kubernetes", match_count=3, min_similarity=0.25)

    assert out == rows
    args, kwargs = client.post.call_args
    assert args[0].endswith("/rest/v1/rpc/match_skill_kb")
    body = kwargs["json"]
    assert body["query_embedding"] == "[0.1,0.2]"   # vector rendered as pgvector literal
    assert body["match_count"] == 3
    assert body["min_similarity"] == 0.25


@pytest.mark.asyncio
async def test_retrieve_for_gaps_dedupes_keeping_highest_similarity():
    async def fake_search(query, **kwargs):
        # Both gaps surface the same card; the second hit scores higher.
        return {
            "k8s": [{"slug": "kubernetes", "similarity": 0.6}],
            "containers": [
                {"slug": "kubernetes", "similarity": 0.9},
                {"slug": "docker", "similarity": 0.7},
            ],
        }[query]

    with patch.object(rs, "search_skills", side_effect=fake_search):
        out = await rs.retrieve_for_gaps(["k8s", "containers"])

    slugs = [c["slug"] for c in out]
    assert slugs == ["kubernetes", "docker"]      # ranked by similarity, deduped
    assert out[0]["similarity"] == 0.9            # kept the higher score


@pytest.mark.asyncio
async def test_retrieve_for_gaps_skips_blank_gaps():
    search = AsyncMock(return_value=[])
    with patch.object(rs, "search_skills", search):
        await rs.retrieve_for_gaps(["", "   "])
    search.assert_not_called()
