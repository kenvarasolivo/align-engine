"""Tests for the RAG skill-coach service and endpoint, fully mocked.

Retrieval (pgvector) and generation (Gemini) are both patched, so these
assert the retrieve -> augment -> generate wiring, the citation guard, and
the honest ungrounded fallback without any network access.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

import main
from app.schemas import SkillCoachPlan, SkillCoachResponse, SkillPlanItem
from app.services import rag_service


def _cards():
    return [
        {
            "slug": "kubernetes",
            "name": "Kubernetes",
            "category": "Infrastructure",
            "summary": "Container orchestration.",
            "how_to_close": "Stand up a kind cluster.",
            "keywords": ["k8s"],
            "resources": [
                {"title": "Kubernetes Docs", "url": "https://kubernetes.io/docs/tutorials/", "type": "docs"},
                # Malformed entries must be dropped, not surfaced.
                {"title": "no url"},
            ],
            "similarity": 0.82,
        },
        {
            "slug": "terraform",
            "name": "Terraform",
            "category": "Infrastructure",
            "summary": "Infrastructure as code.",
            "how_to_close": "Provision a real resource.",
            "keywords": ["iac"],
            "similarity": 0.71,
        },
    ]


def _fake_gen_client(parsed=None, text=None):
    response = SimpleNamespace(parsed=parsed, text=text)
    client = SimpleNamespace()
    client.aio = SimpleNamespace()
    client.aio.models = SimpleNamespace(generate_content=AsyncMock(return_value=response))
    return client


@pytest.mark.asyncio
async def test_coach_grounds_plan_and_exposes_sources():
    plan = SkillCoachPlan(
        summary="Focus on infra.",
        items=[
            SkillPlanItem(gap="Kubernetes", guidance="Deploy a small app.", source_slugs=["kubernetes"]),
            SkillPlanItem(gap="Terraform", guidance="Write IaC.", source_slugs=["terraform"]),
        ],
    )
    client = _fake_gen_client(parsed=plan)
    with patch.object(rag_service, "retrieve_for_gaps", AsyncMock(return_value=_cards())), \
         patch.object(rag_service, "_get_client", return_value=client):
        out = await rag_service.coach_skill_gaps(["Kubernetes", "Terraform"])

    assert out.grounded is True
    assert len(out.items) == 2
    assert {s.slug for s in out.sources} == {"kubernetes", "terraform"}
    assert all(0.0 <= s.similarity <= 1.0 for s in out.sources)


@pytest.mark.asyncio
async def test_coach_surfaces_real_resources_verbatim():
    """Curated resource links ride along on sources; malformed ones are dropped."""
    plan = SkillCoachPlan(
        summary="Focus on infra.",
        items=[SkillPlanItem(gap="Kubernetes", guidance="Deploy.", source_slugs=["kubernetes"])],
    )
    client = _fake_gen_client(parsed=plan)
    with patch.object(rag_service, "retrieve_for_gaps", AsyncMock(return_value=_cards())), \
         patch.object(rag_service, "_get_client", return_value=client):
        out = await rag_service.coach_skill_gaps(["Kubernetes"])

    k8s = next(s for s in out.sources if s.slug == "kubernetes")
    assert [r.url for r in k8s.resources] == ["https://kubernetes.io/docs/tutorials/"]
    assert k8s.resources[0].title == "Kubernetes Docs"
    # The card's resource title is exposed to the model as grounding context.
    prompt = client.aio.models.generate_content.call_args.kwargs["contents"]
    assert "Kubernetes Docs" in prompt


@pytest.mark.asyncio
async def test_coach_synthesizes_across_multiple_cards():
    """An item may cite several retrieved cards; all valid slugs are kept."""
    plan = SkillCoachPlan(
        summary="Combine infra skills.",
        items=[
            SkillPlanItem(
                gap="Platform engineering",
                guidance="Provision with Terraform, then run it on Kubernetes.",
                source_slugs=["terraform", "kubernetes"],
            ),
        ],
    )
    client = _fake_gen_client(parsed=plan)
    with patch.object(rag_service, "retrieve_for_gaps", AsyncMock(return_value=_cards())), \
         patch.object(rag_service, "_get_client", return_value=client):
        out = await rag_service.coach_skill_gaps(["Platform engineering"])

    assert out.items[0].source_slugs == ["terraform", "kubernetes"]


@pytest.mark.asyncio
async def test_coach_passes_resume_and_job_into_prompt():
    """Resume + job text are spliced into the prompt for tailoring."""
    plan = SkillCoachPlan(
        summary="x",
        items=[SkillPlanItem(gap="Kubernetes", guidance="g", source_slugs=["kubernetes"])],
    )
    client = _fake_gen_client(parsed=plan)
    with patch.object(rag_service, "retrieve_for_gaps", AsyncMock(return_value=_cards())), \
         patch.object(rag_service, "_get_client", return_value=client):
        await rag_service.coach_skill_gaps(
            ["Kubernetes"],
            "en",
            resume_text="Built a FastAPI service",
            job_description_text="Seeking a platform engineer",
        )

    prompt = client.aio.models.generate_content.call_args.kwargs["contents"]
    assert "Built a FastAPI service" in prompt
    assert "Seeking a platform engineer" in prompt


@pytest.mark.asyncio
async def test_coach_drops_items_citing_unretrieved_cards():
    """The citation guard must reject a source_slug that was never retrieved."""
    plan = SkillCoachPlan(
        summary="...",
        items=[
            SkillPlanItem(gap="Kubernetes", guidance="ok", source_slugs=["kubernetes"]),
            SkillPlanItem(gap="GraphQL", guidance="hallucinated", source_slugs=["graphql"]),
            # Mixed: one real slug + one hallucinated — the bad slug is stripped,
            # the item survives on its valid citation.
            SkillPlanItem(gap="Mixed", guidance="part real", source_slugs=["terraform", "graphql"]),
        ],
    )
    client = _fake_gen_client(parsed=plan)
    with patch.object(rag_service, "retrieve_for_gaps", AsyncMock(return_value=_cards())), \
         patch.object(rag_service, "_get_client", return_value=client):
        out = await rag_service.coach_skill_gaps(["Kubernetes", "GraphQL", "Mixed"])

    assert [i.source_slugs for i in out.items] == [["kubernetes"], ["terraform"]]


@pytest.mark.asyncio
async def test_coach_falls_back_to_ungrounded_without_retrieval():
    """No KB hits -> honest empty plan, and the model is never called."""
    client = _fake_gen_client(parsed=SkillCoachPlan(summary="x", items=[]))
    with patch.object(rag_service, "retrieve_for_gaps", AsyncMock(return_value=[])), \
         patch.object(rag_service, "_get_client", return_value=client):
        out = await rag_service.coach_skill_gaps(["Anything"])

    assert out.grounded is False
    assert out.items == []
    client.aio.models.generate_content.assert_not_called()


@pytest.mark.asyncio
async def test_coach_validates_raw_json_when_not_pre_parsed():
    plan = SkillCoachPlan(
        summary="from text",
        items=[SkillPlanItem(gap="Kubernetes", guidance="g", source_slugs=["kubernetes"])],
    )
    client = _fake_gen_client(parsed=None, text=plan.model_dump_json())
    with patch.object(rag_service, "retrieve_for_gaps", AsyncMock(return_value=_cards())), \
         patch.object(rag_service, "_get_client", return_value=client):
        out = await rag_service.coach_skill_gaps(["Kubernetes"])

    assert out.summary == "from text"


# --- Endpoint ----------------------------------------------------------------

@pytest.fixture
def client():
    return TestClient(main.app)


def test_skill_coach_endpoint_returns_plan(client):
    response = SkillCoachResponse(
        summary="Focus on infra.",
        items=[SkillPlanItem(gap="Kubernetes", guidance="Deploy.", source_slugs=["kubernetes"])],
        sources=[],
        grounded=True,
    )
    with patch.object(main, "coach_skill_gaps", AsyncMock(return_value=response)):
        resp = client.post("/skill-coach", json={"skill_gaps": ["Kubernetes"], "language": "en"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["grounded"] is True
    assert body["items"][0]["source_slugs"] == ["kubernetes"]


def test_skill_coach_endpoint_rejects_empty_gaps(client):
    with patch.object(main, "coach_skill_gaps", AsyncMock()) as mocked:
        resp = client.post("/skill-coach", json={"skill_gaps": [], "language": "en"})
    assert resp.status_code == 422
    mocked.assert_not_called()


def test_skill_coach_endpoint_maps_failure_to_502(client):
    with patch.object(main, "coach_skill_gaps", AsyncMock(side_effect=Exception("boom"))):
        resp = client.post("/skill-coach", json={"skill_gaps": ["Kubernetes"]})
    assert resp.status_code == 502
    assert "Skill coaching failed" in resp.json()["detail"]
