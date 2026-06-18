"""Gemini embedding integration for ALIGN's RAG layer.

Wraps the official `google-genai` SDK's `embed_content` with Google's
`gemini-embedding-001` model truncated to 768 dimensions (MRL). Embeddings are *task-typed*:
documents in the knowledge base are embedded as RETRIEVAL_DOCUMENT and
incoming search queries as RETRIEVAL_QUERY, which materially improves
retrieval quality versus embedding both sides identically.

The Gemini client is shared with `gemini_service` so a single API key and
connection pool back both generation and embeddings (free-tier friendly).
"""

from typing import Literal

from google.genai import types

from app.services.gemini_service import _get_client

MODEL_ID = "gemini-embedding-001"
# gemini-embedding-001 defaults to 3072-dim but supports Matryoshka (MRL)
# truncation via output_dimensionality; we request 768 to MUST match
# vector(768) in the Postgres schema and the dimension arg of the match RPC.
# (Cosine distance is scale-invariant, so the un-normalized truncated vectors
# are fine for ranking without re-normalization.)
EMBED_DIM = 768

TaskType = Literal["RETRIEVAL_DOCUMENT", "RETRIEVAL_QUERY"]


def _extract(response) -> list[list[float]]:
    """Pull the float vectors out of an embed_content response.

    The SDK returns objects with a `.values` attribute per embedding; we
    normalize to plain lists so callers never depend on SDK internals.
    """
    embeddings = getattr(response, "embeddings", None) or []
    return [list(getattr(e, "values", e)) for e in embeddings]


async def embed_texts(
    texts: list[str],
    task_type: TaskType = "RETRIEVAL_DOCUMENT",
) -> list[list[float]]:
    """Embed a batch of texts, returning one 768-d vector per input."""
    if not texts:
        return []
    client = _get_client()
    response = await client.aio.models.embed_content(
        model=MODEL_ID,
        contents=texts,
        config=types.EmbedContentConfig(
            task_type=task_type,
            output_dimensionality=EMBED_DIM,
        ),
    )
    return _extract(response)


async def embed_query(text: str) -> list[float]:
    """Embed a single search query (task_type = RETRIEVAL_QUERY)."""
    vectors = await embed_texts([text], task_type="RETRIEVAL_QUERY")
    if not vectors:
        raise RuntimeError("Embedding service returned no vector for the query.")
    return vectors[0]


def to_pgvector(vector: list[float]) -> str:
    """Render a float vector as a pgvector literal, e.g. '[0.1,0.2,0.3]'.

    PostgREST has no native vector type, so both inserts and RPC arguments
    pass the embedding as this bracketed string, which pgvector casts.
    """
    return "[" + ",".join(repr(float(x)) for x in vector) + "]"
