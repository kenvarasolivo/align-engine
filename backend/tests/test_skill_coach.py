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
            SkillPlanItem(gap="Kubernetes", guidance="Deploy a small app.", source_slug="kubernetes"),
            SkillPlanItem(gap="Terraform", guidance="Write IaC.", source_slug="terraform"),
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
async def test_coach_drops_items_citing_unretrieved_cards():
    """The citation guard must reject a source_slug that was never retrieved."""
    plan = SkillCoachPlan(
        summary="...",
        items=[
            SkillPlanItem(gap="Kubernetes", guidance="ok", source_slug="kubernetes"),
            SkillPlanItem(gap="GraphQL", guidance="hallucinated", source_slug="graphql"),
        ],
    )
    client = _fake_gen_client(parsed=plan)
    with patch.object(rag_service, "retrieve_for_gaps", AsyncMock(return_value=_cards())), \
         patch.object(rag_service, "_get_client", return_value=client):
        out = await rag_service.coach_skill_gaps(["Kubernetes", "GraphQL"])

    assert [i.source_slug for i in out.items] == ["kubernetes"]


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
        items=[SkillPlanItem(gap="Kubernetes", guidance="g", source_slug="kubernetes")],
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
        items=[SkillPlanItem(gap="Kubernetes", guidance="Deploy.", source_slug="kubernetes")],
        sources=[],
        grounded=True,
    )
    with patch.object(main, "coach_skill_gaps", AsyncMock(return_value=response)):
        resp = client.post("/skill-coach", json={"skill_gaps": ["Kubernetes"], "language": "en"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["grounded"] is True
    assert body["items"][0]["source_slug"] == "kubernetes"


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
