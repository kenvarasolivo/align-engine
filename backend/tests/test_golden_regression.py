"""Golden-set regression tests for structured LLM outputs.

Each case pairs a real resume + job-description with a *recorded* Gemini
response (tests/golden/responses.json). The recorded response is replayed
through the real run_analysis pipeline with the network mocked, so the test
is deterministic and free. We then assert:

  1. the output still parses into the AnalysisResponse contract (schema lock),
  2. structural invariants hold (top-3 skills, evidence present, 3-5 gaps),
  3. case-specific expectations hold (score band, expected gap keywords).

If a schema change or a prompt/parse regression breaks the contract, these
fail loudly — that is the whole point of regression-testing LLM outputs.
"""

import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.schemas import AnalysisResponse, AnalyzeRequest
from app.services import gemini_service

GOLDEN_DIR = Path(__file__).parent / "golden"
CASES = json.loads((GOLDEN_DIR / "cases.json").read_text(encoding="utf-8"))
RESPONSES = json.loads((GOLDEN_DIR / "responses.json").read_text(encoding="utf-8"))


def _client_returning(payload: dict):
    """Fake genai client that replays a recorded structured response."""
    parsed = AnalysisResponse.model_validate(payload)
    response = SimpleNamespace(
        parsed=parsed,
        text=parsed.model_dump_json(),
        usage_metadata=SimpleNamespace(prompt_token_count=500, candidates_token_count=300),
    )
    client = SimpleNamespace(aio=SimpleNamespace(models=SimpleNamespace(
        generate_content=AsyncMock(return_value=response)
    )))
    return client


@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
@pytest.mark.asyncio
async def test_golden_case(case):
    recorded = RESPONSES[case["id"]]
    request = AnalyzeRequest(**case["request"])

    with patch.object(gemini_service, "_get_client", return_value=_client_returning(recorded)):
        result, prompt_tokens, output_tokens = await gemini_service.run_analysis(request)

    # 1. Contract lock — must still be a valid AnalysisResponse.
    assert isinstance(result, AnalysisResponse)

    # 2. Structural invariants from the schema's stated contract.
    assert len(result.matching_skills) == 3, "contract: exactly the top 3 matches"
    assert all(m.skill and m.evidence for m in result.matching_skills), "every match needs evidence"
    assert 3 <= len(result.skill_gaps) <= 5, "contract: 3-5 skill gaps"
    assert 0 <= result.match_score <= 100
    assert result.generated_draft.strip()

    # 3. Case-specific expectations (score band + expected gap keywords).
    exp = case["expectations"]
    if "match_score_min" in exp:
        assert result.match_score >= exp["match_score_min"]
    if "match_score_max" in exp:
        assert result.match_score <= exp["match_score_max"]
    gaps_lower = " ".join(result.skill_gaps).lower()
    for keyword in exp.get("expected_gaps_subset", []):
        assert keyword.lower() in gaps_lower, f"expected gap '{keyword}' missing for {case['id']}"


def test_every_case_has_a_recorded_response():
    """Guard against a case being added without its golden response."""
    case_ids = {c["id"] for c in CASES}
    assert case_ids == set(RESPONSES.keys()), "cases.json and responses.json are out of sync"
