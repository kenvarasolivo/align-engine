"""Tests for the Gemini service with the network boundary mocked.

We never call Gemini for real: `_get_client` is patched to return a fake
client whose `generate_content` yields a canned response. This lets us assert
both the happy path (parsed Structured Output) and the fallback path (raw JSON
text validation) deterministically and for free.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.schemas import AnalysisResponse, AnalyzeRequest
from app.services import gemini_service
from tests.conftest import make_valid_analysis


def _request(**overrides) -> AnalyzeRequest:
    data = {
        "resume_text": "Python engineer, built FastAPI services.",
        "job_description_text": "Seeking a backend engineer with Kubernetes.",
        "mode": "email",
        "language": "en",
    }
    data.update(overrides)
    return AnalyzeRequest(**data)


def _fake_client(parsed=None, text=None, prompt_tokens=11, output_tokens=22):
    """Build a fake genai client mimicking the bits gemini_service touches."""
    response = SimpleNamespace(
        parsed=parsed,
        text=text,
        usage_metadata=SimpleNamespace(
            prompt_token_count=prompt_tokens,
            candidates_token_count=output_tokens,
        ),
    )
    client = SimpleNamespace()
    client.aio = SimpleNamespace()
    client.aio.models = SimpleNamespace(generate_content=AsyncMock(return_value=response))
    return client, response


@pytest.mark.asyncio
async def test_run_analysis_returns_parsed_result_and_tokens():
    expected = make_valid_analysis()
    client, _ = _fake_client(parsed=expected)
    with patch.object(gemini_service, "_get_client", return_value=client):
        result, prompt_tokens, output_tokens = await gemini_service.run_analysis(_request())
    assert result == expected
    assert (prompt_tokens, output_tokens) == (11, 22)


@pytest.mark.asyncio
async def test_run_analysis_falls_back_to_json_text():
    """When the SDK doesn't pre-parse, we validate the raw JSON ourselves."""
    expected = make_valid_analysis(match_score=88)
    client, _ = _fake_client(parsed=None, text=expected.model_dump_json())
    with patch.object(gemini_service, "_get_client", return_value=client):
        result, _, _ = await gemini_service.run_analysis(_request())
    assert result.match_score == 88


@pytest.mark.asyncio
async def test_run_analysis_propagates_malformed_output():
    """A malformed LLM payload surfaces as ValidationError, not silent garbage."""
    from pydantic import ValidationError

    client, _ = _fake_client(parsed=None, text='{"match_score": "oops"}')
    with patch.object(gemini_service, "_get_client", return_value=client):
        with pytest.raises(ValidationError):
            await gemini_service.run_analysis(_request())


@pytest.mark.asyncio
async def test_run_analysis_handles_missing_usage_metadata():
    client, response = _fake_client(parsed=make_valid_analysis())
    response.usage_metadata = None
    with patch.object(gemini_service, "_get_client", return_value=client):
        _, prompt_tokens, output_tokens = await gemini_service.run_analysis(_request())
    assert prompt_tokens is None and output_tokens is None


@pytest.mark.asyncio
async def test_run_analysis_passes_response_schema_to_gemini():
    """The Pydantic contract must actually be wired in as the response_schema."""
    client, _ = _fake_client(parsed=make_valid_analysis())
    with patch.object(gemini_service, "_get_client", return_value=client):
        await gemini_service.run_analysis(_request())
    _, kwargs = client.aio.models.generate_content.call_args
    assert kwargs["config"].response_schema is AnalysisResponse
    assert kwargs["config"].response_mime_type == "application/json"


def test_get_client_requires_api_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    gemini_service._get_client.cache_clear()
    with pytest.raises(RuntimeError, match="GEMINI_API_KEY"):
        gemini_service._get_client()
    gemini_service._get_client.cache_clear()


@pytest.mark.parametrize("mode", ["anschreiben", "email"])
def test_build_prompt_includes_documents_and_mode_rules(mode):
    prompt = gemini_service._build_prompt(_request(mode=mode, language="de"))
    assert "Python engineer" in prompt          # resume embedded
    assert "Kubernetes" in prompt                # job description embedded
    assert "OUTPUT LANGUAGE: German" in prompt   # language rule selected
    assert gemini_service._MODE_RULES[mode][:20] in prompt
