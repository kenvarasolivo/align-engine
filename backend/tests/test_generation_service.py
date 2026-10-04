"""Offline provider-routing, structured-output, and usage regression tests."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import pytest

from app.schemas import AnalysisResponse, AnalyzeRequest, SkillCoachPlan, SkillPlanItem
from app.services import generation_service, gemini_service, rag_service
from tests.conftest import make_valid_analysis


def openai_client(result, usage=True, status="completed"):
    response = SimpleNamespace(
        status=status, output_parsed=result,
        usage=SimpleNamespace(input_tokens=13, output_tokens=21) if usage else None,
    )
    return SimpleNamespace(responses=SimpleNamespace(parse=AsyncMock(return_value=response)))


def test_provider_defaults_and_models(monkeypatch):
    assert generation_service.provider() == "gemini"
    assert generation_service.model() == "gemini-2.5-flash"
    monkeypatch.setenv("GEMINI_MODEL", "custom-gemini")
    assert generation_service.model() == "custom-gemini"
    assert generation_service.provider(" OpenAI ") == "openai"
    assert generation_service.model("openai") == "gpt-6-luna"
    monkeypatch.setenv("OPENAI_MODEL", "custom-openai")
    assert generation_service.model("openai") == "custom-openai"
    with pytest.raises(RuntimeError, match="Provider"):
        generation_service.provider("unknown")


def test_openai_key_required():
    with pytest.raises(RuntimeError, match="OPENAI_API_KEY"):
        generation_service._get_openai_client()


@pytest.mark.asyncio
@pytest.mark.parametrize("usage", [True, False])
async def test_openai_schema_instructions_and_usage(monkeypatch, usage):
    expected = make_valid_analysis()
    client = openai_client(expected, usage=usage)
    gemini = Mock(side_effect=AssertionError("Must not use Gemini"))
    with patch.object(generation_service, "_get_openai_client", return_value=client):
        result, inputs, outputs = await generation_service.generate_structured(
            "resume and job", "rules", AnalysisResponse, gemini_client=gemini, temperature=0.4,
            selected_provider="openai",
        )
    assert result == expected
    assert (inputs, outputs) == ((13, 21) if usage else (None, None))
    client.responses.parse.assert_awaited_once_with(
        model="gpt-6-luna", instructions="rules", input="resume and job",
        text_format=AnalysisResponse, store=False,
    )
    gemini.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("result,status", [(None, "completed"), (make_valid_analysis(), "incomplete")])
async def test_openai_rejects_refusal_or_incomplete_output(monkeypatch, result, status):
    with patch.object(generation_service, "_get_openai_client", return_value=openai_client(result, status=status)):
        with pytest.raises(ValueError, match="complete structured result"):
            await generation_service.generate_structured("data", "rules", AnalysisResponse, gemini_client=Mock(), temperature=0.4, selected_provider="openai")


@pytest.mark.asyncio
async def test_openai_analysis_retains_quality_retry_and_totals(monkeypatch):
    valid = make_valid_analysis(matching_skills=[])
    client = openai_client(valid)
    response = client.responses.parse.return_value
    invalid = SimpleNamespace(**{**vars(response), "output_parsed": make_valid_analysis(
        matching_skills=[{"skill": "AWS", "evidence": "invented resume evidence"}],
    )})
    client.responses.parse.side_effect = [invalid, response]
    payload = AnalyzeRequest(resume_text="Python engineer", job_description_text="Backend role", mode="email", language="en", provider="openai")
    with patch.object(generation_service, "_get_openai_client", return_value=client), \
         patch.object(gemini_service, "_get_client", side_effect=AssertionError("Must not use Gemini")):
        result, inputs, outputs = await gemini_service.run_analysis(payload)
    assert result == valid
    assert (inputs, outputs) == (26, 42)
    assert "VALIDATION FEEDBACK" in client.responses.parse.call_args.kwargs["input"]


@pytest.mark.asyncio
async def test_openai_coach_preserves_citation_guard(monkeypatch):
    cards = [{"slug": "python", "name": "Python", "summary": "Python skills", "how_to_close": "Build a tool"}]
    plan = SkillCoachPlan(summary="Practice", items=[
        SkillPlanItem(gap="Python", guidance="Build a tool", source_slugs=["python", "invented"]),
        SkillPlanItem(gap="Other", guidance="Bad advice", source_slugs=["invented"]),
    ])
    client = openai_client(plan)
    with patch.object(generation_service, "_get_openai_client", return_value=client), \
         patch.object(rag_service, "retrieve_for_gaps", AsyncMock(return_value=cards)), \
         patch.object(rag_service, "_get_client", side_effect=AssertionError("Must not generate with Gemini")):
        result = await rag_service.coach_skill_gaps(["Python"], provider="openai")
    assert result.grounded
    assert len(result.items) == 1
    assert result.items[0].source_slugs == ["python"]
    assert client.responses.parse.call_args.kwargs["text_format"] is SkillCoachPlan
