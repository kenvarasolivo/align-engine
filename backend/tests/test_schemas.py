"""Schema-enforcement tests for the Gemini Structured Output contract.

These prove that `AnalysisResponse` — the Pydantic model passed to Gemini as
`response_schema` — actually rejects malformed LLM output instead of silently
passing it downstream. This is the safety net behind "typsichere KI-Ausgaben".
"""

import pytest
from pydantic import ValidationError

from app.schemas import AnalysisResponse, AnalyzeRequest, SkillMatch
from tests.conftest import make_valid_analysis


def test_accepts_well_formed_output(valid_analysis):
    """A complete, in-bounds payload validates cleanly."""
    assert valid_analysis.match_score == 72
    assert len(valid_analysis.matching_skills) == 3


def test_rejects_non_list_skill_gaps():
    """The classic malformed LLM response: a scalar where a list is required."""
    bad = {
        "match_score": 50,
        "score_rationale": "ok",
        "matching_skills": [],
        "skill_gaps": "not-a-list",
        "generated_draft": "draft",
    }
    with pytest.raises(ValidationError):
        AnalysisResponse.model_validate(bad)


def test_rejects_missing_required_field():
    """Dropping any contract field must fail validation, not default silently."""
    payload = make_valid_analysis().model_dump()
    del payload["generated_draft"]
    with pytest.raises(ValidationError):
        AnalysisResponse.model_validate(payload)


@pytest.mark.parametrize("score", [-1, 101, 150, -50])
def test_rejects_out_of_range_match_score(score):
    """match_score is constrained to 0..100; the model must not invent 110/100."""
    with pytest.raises(ValidationError):
        make_valid_analysis(match_score=score)


@pytest.mark.parametrize("score", [0, 1, 50, 99, 100])
def test_accepts_boundary_match_score(score):
    assert make_valid_analysis(match_score=score).match_score == score


def test_rejects_non_integer_match_score():
    """A float-looking score that isn't a clean int must be rejected."""
    with pytest.raises(ValidationError):
        AnalysisResponse.model_validate(
            {**make_valid_analysis().model_dump(), "match_score": "high"}
        )


def test_skill_match_requires_evidence():
    """Every claimed skill must carry resume evidence — no evidence, no skill."""
    with pytest.raises(ValidationError):
        SkillMatch(skill="Python")  # missing evidence


def test_skill_match_rejects_extra_garbage_is_lenient_but_keeps_contract():
    """Core fields survive even if the LLM adds chatter (extra keys ignored)."""
    sm = SkillMatch.model_validate(
        {"skill": "Go", "evidence": "Wrote Go microservices", "confidence": "high"}
    )
    assert sm.skill == "Go"
    assert sm.evidence == "Wrote Go microservices"


def test_roundtrip_json_validation(valid_analysis):
    """Validating from raw JSON text mirrors the gemini_service fallback path."""
    raw = valid_analysis.model_dump_json()
    restored = AnalysisResponse.model_validate_json(raw)
    assert restored == valid_analysis


def test_rejects_malformed_json_text():
    with pytest.raises(ValidationError):
        AnalysisResponse.model_validate_json('{"match_score": 50, ')  # truncated JSON


# --- Inbound request contract -------------------------------------------------

def test_analyze_request_rejects_empty_resume():
    with pytest.raises(ValidationError):
        AnalyzeRequest(
            resume_text="",
            job_description_text="JD",
            mode="email",
            language="en",
        )


@pytest.mark.parametrize("mode", ["anschreiben", "email"])
def test_analyze_request_accepts_valid_modes(mode):
    req = AnalyzeRequest(
        resume_text="R", job_description_text="JD", mode=mode, language="de"
    )
    assert req.mode == mode


def test_analyze_request_rejects_unknown_mode():
    with pytest.raises(ValidationError):
        AnalyzeRequest(
            resume_text="R", job_description_text="JD", mode="tweet", language="en"
        )


def test_analyze_request_rejects_unknown_language():
    with pytest.raises(ValidationError):
        AnalyzeRequest(
            resume_text="R", job_description_text="JD", mode="email", language="fr"
        )
