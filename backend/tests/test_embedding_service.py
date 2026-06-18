"""Tests for the Gemini embedding wrapper with the network boundary mocked.

`_get_client` (shared with gemini_service) is patched to a fake whose
`embed_content` returns canned vectors, so we can assert batching, task-type
selection, vector extraction, and the pgvector literal formatting offline.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.services import embedding_service as emb


def _fake_client(vectors: list[list[float]]):
    response = SimpleNamespace(embeddings=[SimpleNamespace(values=v) for v in vectors])
    client = SimpleNamespace()
    client.aio = SimpleNamespace()
    client.aio.models = SimpleNamespace(embed_content=AsyncMock(return_value=response))
    return client


@pytest.mark.asyncio
async def test_embed_texts_returns_one_vector_per_input():
    client = _fake_client([[0.1, 0.2], [0.3, 0.4]])
    with patch.object(emb, "_get_client", return_value=client):
        out = await emb.embed_texts(["a", "b"])
    assert out == [[0.1, 0.2], [0.3, 0.4]]


@pytest.mark.asyncio
async def test_embed_texts_empty_input_skips_network():
    client = _fake_client([])
    with patch.object(emb, "_get_client", return_value=client):
        out = await emb.embed_texts([])
    assert out == []
    client.aio.models.embed_content.assert_not_called()


@pytest.mark.asyncio
async def test_embed_texts_passes_task_type_and_dimension():
    client = _fake_client([[1.0]])
    with patch.object(emb, "_get_client", return_value=client):
        await emb.embed_texts(["doc"], task_type="RETRIEVAL_DOCUMENT")
    _, kwargs = client.aio.models.embed_content.call_args
    assert kwargs["config"].task_type == "RETRIEVAL_DOCUMENT"
    assert kwargs["config"].output_dimensionality == emb.EMBED_DIM


@pytest.mark.asyncio
async def test_embed_query_uses_query_task_type_and_returns_single_vector():
    client = _fake_client([[0.5, 0.6, 0.7]])
    with patch.object(emb, "_get_client", return_value=client):
        vec = await emb.embed_query("kubernetes")
    assert vec == [0.5, 0.6, 0.7]
    _, kwargs = client.aio.models.embed_content.call_args
    assert kwargs["config"].task_type == "RETRIEVAL_QUERY"


@pytest.mark.asyncio
async def test_embed_query_raises_when_no_vector_returned():
    client = _fake_client([])
    with patch.object(emb, "_get_client", return_value=client):
        with pytest.raises(RuntimeError, match="no vector"):
            await emb.embed_query("anything")


def test_to_pgvector_formats_bracketed_literal():
    assert emb.to_pgvector([0.1, 0.2, 0.3]) == "[0.1,0.2,0.3]"


def test_to_pgvector_coerces_to_float():
    # Inputs may arrive as ints; pgvector needs a clean float literal.
    assert emb.to_pgvector([1, 2]) == "[1.0,2.0]"
