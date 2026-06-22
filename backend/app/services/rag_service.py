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

from app.schemas import (
    RetrievedSkill,
    SkillCoachPlan,
    SkillCoachResponse,
    SkillPlanItem,
    SkillResource,
)
from app.services.gemini_service import MODEL_ID as GEN_MODEL_ID
from app.services.gemini_service import _get_client
from app.services.retrieval_service import retrieve_for_gaps

_SYSTEM_INSTRUCTION = (
    "You are ALIGN's skill coach. You help a candidate close the gaps between their "
    "resume and a target role. You are given a set of retrieved knowledge-base cards as "
    "CONTEXT, and (when available) the candidate's resume and the target job description. "
    "Ground every concrete recommendation — tools, actions, practices — strictly in the "
    "retrieved cards: never invent tools, certifications, or facts that are not present in "
    "them. Use the resume and job description ONLY to TAILOR the advice: reference the "
    "candidate's actual experience, connect each gap to what this specific role needs, and "
    "suggest how they could demonstrate the skill using projects they already have. When a "
    "gap is best addressed by more than one card, synthesize across them in a single item "
    "and cite every card slug you drew from. Be specific, concrete, and encouraging."
)

_LANGUAGE_RULES = {
    "en": "Write the summary and all guidance in natural, professional English.",
    "de": (
        "Write the summary and all guidance in natural, professional German (Sie-Form). "
        "Established English technology terms may remain in English where standard."
    ),
}


def _card_resources(card: dict) -> list[dict]:
    """The well-formed resource dicts on a card (title + url required)."""
    return [
        r
        for r in (card.get("resources") or [])
        if isinstance(r, dict) and r.get("title") and r.get("url")
    ]


def _format_context(cards: list[dict]) -> str:
    blocks = []
    for c in cards:
        kws = ", ".join(c.get("keywords", []) or [])
        block = (
            f"[slug: {c['slug']}] {c['name']} ({c.get('category', 'General')})\n"
            f"Summary: {c['summary']}\n"
            f"How to close: {c['how_to_close']}\n"
            f"Keywords: {kws}"
        )
        # Expose resource *titles* so guidance can name a real resource (e.g.
        # "work through the official Kubernetes tutorial"). The clickable URL is
        # attached deterministically from the card — the model never emits it —
        # so links can't be hallucinated.
        titles = ", ".join(r["title"] for r in _card_resources(c))
        if titles:
            block += f"\nResources (refer to by name; do NOT invent URLs): {titles}"
        blocks.append(block)
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
            resources=[
                SkillResource(title=r["title"], url=r["url"], type=r.get("type"))
                for r in _card_resources(c)
            ],
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


# Cap how much resume/job text we splice into the prompt. Enough to ground the
# tailoring in the candidate's real background without blowing the free-tier
# token budget on boilerplate.
_CONTEXT_CHARS = 2000


def _clip(text: str | None) -> str:
    if not text or not text.strip():
        return ""
    text = text.strip()
    return text if len(text) <= _CONTEXT_CHARS else text[:_CONTEXT_CHARS] + " …[truncated]"


def _candidate_context(resume_text: str | None, job_description_text: str | None) -> str:
    """Optional resume/job block used only to tailor (not ground) the advice."""
    parts = []
    resume = _clip(resume_text)
    job = _clip(job_description_text)
    if resume:
        parts.append(f"=== CANDIDATE RESUME (for tailoring only) ===\n{resume}")
    if job:
        parts.append(f"=== TARGET JOB DESCRIPTION (for tailoring only) ===\n{job}")
    return "\n\n".join(parts)


async def coach_skill_gaps(
    gaps: list[str],
    language: str = "en",
    resume_text: str | None = None,
    job_description_text: str | None = None,
) -> SkillCoachResponse:
    """Retrieve grounding cards for `gaps` and generate a grounded, tailored plan."""
    cards = await retrieve_for_gaps(gaps)
    if not cards:
        return _ungrounded(gaps)

    client = _get_client()
    candidate_context = _candidate_context(resume_text, job_description_text)
    tailoring = (
        "Tailor each recommendation to the candidate's actual background and the target "
        "role using the resume and job description below — name the projects or experience "
        "they could build on. Still ground every concrete tool or action ONLY in the "
        "retrieved cards.\n\n"
        if candidate_context
        else ""
    )
    prompt = (
        "Produce a grounded upskilling plan. Address each skill gap below using ONLY the "
        "retrieved context cards for the concrete advice. If a gap is best served by several "
        "cards, combine them into one item and cite every slug used. If no card is relevant "
        "to a gap, omit that gap rather than inventing advice.\n\n"
        f"{tailoring}"
        f"{_LANGUAGE_RULES.get(language, _LANGUAGE_RULES['en'])}\n\n"
        f"=== SKILL GAPS ===\n{json.dumps(gaps, ensure_ascii=False)}\n\n"
        f"=== RETRIEVED CONTEXT CARDS ===\n{_format_context(cards)}"
    )
    if candidate_context:
        prompt += f"\n\n{candidate_context}"

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

    # Defend the citation contract: keep only the slugs that were actually
    # retrieved, and drop any item left with no real citation — so every
    # `source_slugs` entry maps to a card we can show the user.
    valid_slugs = {c["slug"] for c in cards}
    items: list[SkillPlanItem] = []
    for item in plan.items:
        grounded_slugs = [s for s in item.source_slugs if s in valid_slugs]
        if grounded_slugs:
            item.source_slugs = grounded_slugs
            items.append(item)

    return SkillCoachResponse(
        summary=plan.summary,
        items=items,
        sources=_to_sources(cards),
        grounded=True,
    )
