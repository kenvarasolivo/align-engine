"""Retrieval-augmented skill coaching for ALIGN.

Ties the embedding + retrieval layer to generation: given a candidate's skill
gaps, it retrieves the most relevant curated knowledge-base cards from
pgvector and asks Gemini to synthesize a short, grounded upskilling plan that
draws ONLY on the retrieved context — the classic retrieve → augment →
generate loop, with citations back to the source cards so the advice is
auditable rather than hallucinated.
"""

import json

from google.genai import types

from app.schemas import RetrievedSkill, SkillCoachPlan, SkillCoachResponse, SkillPlanItem
from app.services.gemini_service import MODEL_ID as GEN_MODEL_ID
from app.services.gemini_service import _get_client
from app.services.retrieval_service import retrieve_for_gaps

_SYSTEM_INSTRUCTION = (
    "You are ALIGN's skill coach. You help a candidate close the gaps between their "
    "resume and a target role. You are given a set of retrieved knowledge-base cards as "
    "CONTEXT. Ground every recommendation strictly in that context: never invent tools, "
    "certifications, or facts that are not present in the provided cards. Each item must "
    "cite the slug of the card it draws from. Be specific, concrete, and encouraging."
)

_LANGUAGE_RULES = {
    "en": "Write the summary and all guidance in natural, professional English.",
    "de": (
        "Write the summary and all guidance in natural, professional German (Sie-Form). "
        "Established English technology terms may remain in English where standard."
    ),
}


def _format_context(cards: list[dict]) -> str:
    blocks = []
    for c in cards:
        kws = ", ".join(c.get("keywords", []) or [])
        blocks.append(
            f"[slug: {c['slug']}] {c['name']} ({c.get('category', 'General')})\n"
            f"Summary: {c['summary']}\n"
            f"How to close: {c['how_to_close']}\n"
            f"Keywords: {kws}"
        )
    return "\n\n".join(blocks)


def _to_sources(cards: list[dict]) -> list[RetrievedSkill]:
    return [
        RetrievedSkill(
            slug=c["slug"],
            name=c["name"],
            category=c.get("category"),
            summary=c["summary"],
            how_to_close=c["how_to_close"],
            similarity=round(float(c.get("similarity", 0.0)), 4),
        )
        for c in cards
    ]


def _ungrounded(gaps: list[str]) -> SkillCoachResponse:
    """Fallback when retrieval is unavailable (no Supabase / empty KB).

    We do NOT call the model with no context — that is exactly the
    hallucination the RAG layer exists to prevent. Instead we return an
    honest, empty-but-valid plan flagged as ungrounded.
    """
    return SkillCoachResponse(
        summary=(
            "Skill coaching is unavailable because the knowledge base has not been "
            "configured or ingested. Run the pgvector ingest step to enable grounded guidance."
        ),
        items=[],
        sources=[],
        grounded=False,
    )


async def coach_skill_gaps(gaps: list[str], language: str = "en") -> SkillCoachResponse:
    """Retrieve grounding cards for `gaps` and generate a grounded plan."""
    cards = await retrieve_for_gaps(gaps)
    if not cards:
        return _ungrounded(gaps)

    client = _get_client()
    prompt = (
        "Produce a grounded upskilling plan. Address each skill gap below using ONLY the "
        "retrieved context cards. If no card is relevant to a gap, omit that gap rather "
        "than inventing advice. Cite the card slug for every item.\n\n"
        f"{_LANGUAGE_RULES.get(language, _LANGUAGE_RULES['en'])}\n\n"
        f"=== SKILL GAPS ===\n{json.dumps(gaps, ensure_ascii=False)}\n\n"
        f"=== RETRIEVED CONTEXT CARDS ===\n{_format_context(cards)}"
    )

    response = await client.aio.models.generate_content(
        model=GEN_MODEL_ID,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=_SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
            response_schema=SkillCoachPlan,
            temperature=0.3,
        ),
    )

    if isinstance(response.parsed, SkillCoachPlan):
        plan = response.parsed
    else:
        plan = SkillCoachPlan.model_validate_json(response.text)

    # Defend the citation contract: drop any item the model grounded in a slug
    # that was not actually retrieved, so `source_slug` is always real.
    valid_slugs = {c["slug"] for c in cards}
    items: list[SkillPlanItem] = [i for i in plan.items if i.source_slug in valid_slugs]

    return SkillCoachResponse(
        summary=plan.summary,
        items=items,
        sources=_to_sources(cards),
        grounded=True,
    )
