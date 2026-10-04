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
        "resume_text": "Python engineer. Built FastAPI services in Python for 3 years. Designed and shipped REST APIs at scale. Modeled relational schemas in PostgreSQL.",
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


def test_unknown_recipient_defaults_preserve_company_placeholders():
    text = "[Firmenname]\n[Name Ansprechpartner]\n[Firmenanschrift]\n\nSehr geehrte/r [Name Ansprechpartner],\n\nBody."
    result = gemini_service.safe_recipient_defaults(text, "de")
    assert "[Firmenname]\nPersonalabteilung\n[Firmenanschrift]" in result
    assert "Sehr geehrte Damen und Herren," in result
    assert "[Name Ansprechpartner]" not in result


def test_known_contact_is_not_replaced():
    text = "Acme\nFrau Mueller\n\nSehr geehrte Frau Mueller,\n\nBody."
    assert gemini_service.safe_recipient_defaults(text, "de") == text


def test_unknown_english_recipient_has_generic_greeting():
    assert gemini_service.safe_recipient_defaults("Dear [Recipient Name],\n\nBody.", "en") == "Dear Hiring Team,\n\nBody."


def test_contact_fallbacks_do_not_swallow_blank_lines():
    assert gemini_service.safe_recipient_defaults("[Name Ansprechpartner]\n\n[Anrede]\n\nBody.", "de") == "Personalabteilung\n\nSehr geehrte Damen und Herren,\n\nBody."


@pytest.mark.parametrize("mode", ["anschreiben", "email"])
def test_build_prompt_includes_documents_and_mode_rules(mode):
    prompt = gemini_service._build_prompt(_request(mode=mode, language="de"))
    assert "Python engineer" in prompt          # resume embedded
    assert "Kubernetes" in prompt                # job description embedded
    assert "OUTPUT LANGUAGE: German" in prompt   # language rule selected
    assert gemini_service._MODE_RULES[mode][:20] in prompt


@pytest.mark.asyncio
@pytest.mark.parametrize("style", ["neutral", "direct", "friendly"])
@pytest.mark.parametrize("language", ["en", "de"])
@pytest.mark.parametrize("motivation", [None, "I enjoy making complex tools accessible."])
async def test_draft_preferences_reach_gemini(style, language, motivation):
    client, _ = _fake_client(parsed=make_valid_analysis())
    with patch.object(gemini_service, "_get_client", return_value=client):
        await gemini_service.run_analysis(_request(
            mode="anschreiben", language=language, writing_style=style,
            personal_motivation=motivation,
        ))
    prompt = client.aio.models.generate_content.call_args.kwargs["contents"]
    assert f"WRITING STYLE: {style}." in prompt
    assert gemini_service._STYLE_RULES[style] in prompt
    assert "Sie-Form in every style" in prompt
    assert "between 250 and 270 words" in prompt
    assert "if under 250, develop" in prompt
    assert "describe a concrete resume example" in prompt
    assert "identify the advertised task it relates to" in prompt
    assert "Do not merely list" in prompt
    assert "never as a claim" in prompt
    assert "Do not use Markdown bold" in prompt
    assert "Shorter letters are welcome" not in prompt
    assert "unsupported achievements" in prompt
    assert "NOT evidence for skills, experience, or the match score" in prompt
    if motivation:
        assert motivation in prompt
        assert "No personal motivation was supplied" not in prompt
    else:
        assert "No personal motivation was supplied" in prompt
        assert "=== OPTIONAL PERSONAL MOTIVATION" not in prompt


def test_whitespace_motivation_uses_missing_context_fallback():
    prompt = gemini_service._build_prompt(_request(personal_motivation="  \n "))
    assert "No personal motivation was supplied" in prompt


@pytest.mark.asyncio
async def test_short_cover_letter_gets_one_expansion_attempt():
    short = make_valid_analysis(matching_skills=[], generated_draft="Dear Hiring Team,\n\nI built APIs.\n\nBest regards,\nAlex Morgan")
    full_draft = "Dear Hiring Team,\n\n" + " ".join(["word"] * 243) + "\n\nBest regards,\nAlex Morgan"
    fuller = short.model_copy(update={"generated_draft": full_draft})
    client, response = _fake_client(parsed=short)
    client.aio.models.generate_content.side_effect = [
        response, SimpleNamespace(parsed=fuller, usage_metadata=response.usage_metadata),
    ]
    with patch.object(gemini_service, "_get_client", return_value=client):
        result, prompt_tokens, output_tokens = await gemini_service.run_analysis(_request(mode="anschreiben"))
    assert gemini_service.draft_word_count(result.generated_draft, "anschreiben") == 250
    assert (prompt_tokens, output_tokens) == (22, 44)
    feedback = client.aio.models.generate_content.call_args.kwargs["contents"]
    assert "target is 250-270" in feedback
    assert "without inventing experience" in feedback


@pytest.mark.asyncio
async def test_length_alone_does_not_discard_verified_letter_after_retry():
    expected = make_valid_analysis()
    client, _ = _fake_client(parsed=expected)
    with patch.object(gemini_service, "_get_client", return_value=client):
        result, _, _ = await gemini_service.run_analysis(_request(mode="anschreiben"))
    assert result == expected
    assert client.aio.models.generate_content.await_count == 2


@pytest.mark.asyncio
async def test_invalid_evidence_and_long_email_are_retried_and_tokens_totaled():
    invalid = make_valid_analysis(matching_skills=[{"skill": "Kubernetes", "evidence": "Managed a Kubernetes fleet"}], generated_draft=" ".join(["word"] * 200))
    valid = make_valid_analysis(matching_skills=[], skill_gaps=[])
    client, response = _fake_client(parsed=invalid)
    corrected = SimpleNamespace(parsed=valid, usage_metadata=response.usage_metadata)
    client.aio.models.generate_content.side_effect = [response, corrected]
    with patch.object(gemini_service, "_get_client", return_value=client):
        output, prompt, completion = await gemini_service.run_analysis(_request())
    assert output.matching_skills == []
    assert (prompt, completion) == (22, 44)
    feedback = client.aio.models.generate_content.call_args_list[1].kwargs["contents"]
    assert "not a verbatim resume quote" in feedback
    assert "maximum is 199" in feedback


@pytest.mark.asyncio
async def test_unverifiable_evidence_is_never_returned_after_retry():
    client, _ = _fake_client(parsed=make_valid_analysis(matching_skills=[{"skill": "AWS", "evidence": "Invented experience"}]))
    with patch.object(gemini_service, "_get_client", return_value=client):
        with pytest.raises(ValueError, match="could not be verified"):
            await gemini_service.run_analysis(_request())
    assert client.aio.models.generate_content.await_count == 2


def test_evidence_normalizes_whitespace_but_never_invents_words():
    request = _request(resume_text="Built\nFastAPI  services in Python.")
    result = make_valid_analysis(matching_skills=[{"skill": "Python", "evidence": "Built FastAPI services in Python"}])
    assert gemini_service.quality_issues(result, request) == []
    result.matching_skills[0].evidence = "Built scalable FastAPI services in Python"
    assert gemini_service.quality_issues(result, request)


def test_cover_letter_word_limit_excludes_header_and_includes_signoff():
    header = " ".join(["address"] * 100)
    draft = f"{header}\n\nApplication for Engineer\n\nDear Hiring Team,\n\n{' '.join(['word'] * 263)}\n\nBest regards,\nAlex Morgan"
    assert gemini_service.draft_word_count(draft, "anschreiben") == 270
    request = _request(mode="anschreiben")
    result = make_valid_analysis(matching_skills=[], generated_draft=draft)
    assert gemini_service.quality_issues(result, request) == []
    result.generated_draft += " extra"
    assert gemini_service.quality_issues(result, request)
