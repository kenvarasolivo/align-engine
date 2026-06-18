"""Ingest the curated skill knowledge base into pgvector.

Reads `app/data/skill_kb.json`, embeds each card with Gemini
gemini-embedding-001 (RETRIEVAL_DOCUMENT task type, 768-dim), and upserts the rows —
embeddings included — into the Supabase `public.skill_kb` table via
PostgREST. Idempotent: re-running refreshes embeddings in place (upsert on
the unique `slug`), so it is safe to run after editing the JSON.

Usage (from backend/, with GEMINI_API_KEY + SUPABASE_* in .env):
    python -m scripts.ingest_kb
    python -m scripts.ingest_kb --batch 8
"""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv()  # load keys before the Gemini/Supabase clients are built

from app.services import supabase_service
from app.services.embedding_service import embed_texts, to_pgvector

KB_PATH = Path(__file__).resolve().parent.parent / "app" / "data" / "skill_kb.json"
_TIMEOUT = httpx.Timeout(30.0)


def _embedding_text(card: dict) -> str:
    """Build the document string that represents a card in vector space.

    Concatenating name, summary, keywords, and remediation text gives the
    embedding the fullest semantic surface to match a candidate's gap against.
    """
    keywords = ", ".join(card.get("keywords", []))
    return (
        f"{card['name']} ({card.get('category', '')}).\n"
        f"{card['summary']}\n"
        f"Keywords: {keywords}.\n"
        f"How to close: {card['how_to_close']}"
    )


async def _upsert(rows: list[dict]) -> None:
    """Upsert rows into skill_kb, merging on the unique slug."""
    url = supabase_service._supabase_url()
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        response = await client.post(
            f"{url}/rest/v1/skill_kb",
            params={"on_conflict": "slug"},
            json=rows,
            headers={
                **supabase_service._service_headers(),
                "Prefer": "resolution=merge-duplicates,return=minimal",
            },
        )
    response.raise_for_status()


async def main_async(batch: int) -> None:
    if not supabase_service.is_configured():
        raise SystemExit(
            "Supabase is not configured. Set SUPABASE_URL, SUPABASE_ANON_KEY, and "
            "SUPABASE_SERVICE_ROLE_KEY in backend/.env before ingesting."
        )

    cards = json.loads(KB_PATH.read_text(encoding="utf-8"))
    print(f"Loaded {len(cards)} skill cards from {KB_PATH.name}")

    total = 0
    for start in range(0, len(cards), batch):
        chunk = cards[start : start + batch]
        vectors = await embed_texts([_embedding_text(c) for c in chunk])
        rows = [
            {
                "slug": card["slug"],
                "name": card["name"],
                "category": card.get("category"),
                "summary": card["summary"],
                "how_to_close": card["how_to_close"],
                "keywords": card.get("keywords", []),
                "embedding": to_pgvector(vector),
            }
            for card, vector in zip(chunk, vectors)
        ]
        await _upsert(rows)
        total += len(rows)
        print(f"  upserted {total}/{len(cards)}")

    print(f"Done. {total} cards embedded and stored in pgvector.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest the skill KB into pgvector.")
    parser.add_argument("--batch", type=int, default=8, help="cards per embed/upsert batch")
    args = parser.parse_args()
    asyncio.run(main_async(args.batch))


if __name__ == "__main__":
    main()
