"""Offline tests for the eval harness scoring logic (no network).

These verify the metric computation itself is correct, so the numbers the
live harness reports can be trusted. They never call Gemini.
"""

import json
from pathlib import Path

from eval.run import (
    CaseResult,
    evaluate_case,
    gap_is_hit,
    summarize,
)
from tests.conftest import make_valid_analysis


def test_gap_hit_exact_and_substring():
    gaps = ["Kubernetes (EKS)", "Terraform"]
    assert gap_is_hit("Kubernetes", gaps)
    assert gap_is_hit("Terraform", gaps)
    assert not gap_is_hit("GraphQL", gaps)


def test_gap_hit_is_case_insensitive():
    assert gap_is_hit("python", ["Python at scale"])


def test_evaluate_case_counts_gap_hits():
    result = make_valid_analysis(skill_gaps=["Kubernetes", "Terraform", "gRPC"])
    case = {"id": "c1", "expected_gaps": ["Kubernetes", "Terraform"], "score_band": [60, 95]}
    scored = evaluate_case(case, result)
    assert scored.schema_valid and scored.structural_ok
    assert (scored.gap_hits, scored.gap_total) == (2, 2)
    assert scored.score_in_band is True  # default match_score is 72


def test_evaluate_case_flags_partial_gap_hits_and_band_miss():
    result = make_valid_analysis(match_score=30, skill_gaps=["Kubernetes", "X", "Y"])
    case = {"id": "c2", "expected_gaps": ["Kubernetes", "Kafka"], "score_band": [60, 95]}
    scored = evaluate_case(case, result)
    assert scored.gap_hits == 1 and scored.gap_total == 2
    assert scored.score_in_band is False


def test_evaluate_case_detects_structural_violation():
    # Only 2 skill_gaps -> violates the 3-5 contract.
    result = make_valid_analysis(skill_gaps=["Kubernetes", "Terraform"])
    scored = evaluate_case({"id": "c3", "expected_gaps": []}, result)
    assert scored.structural_ok is False


def test_summarize_aggregates_rates():
    results = [
        CaseResult(id="a", schema_valid=True, structural_ok=True, gap_hits=2, gap_total=2,
                   match_score=70, score_in_band=True),
        CaseResult(id="b", schema_valid=True, structural_ok=False, gap_hits=1, gap_total=2,
                   match_score=40, score_in_band=False),
        CaseResult(id="c", schema_valid=False, error="boom"),
    ]
    s = summarize(results)
    assert s["cases"] == 3
    assert s["schema_valid_rate"] == 2 / 3
    assert s["structural_rate"] == 1 / 3
    assert s["gap_hit_rate"] == 3 / 4          # (2+1) / (2+2)
    assert s["score_in_band_rate"] == 0.5      # 1 of 2 banded valid cases
    assert s["avg_match_score"] == 55.0        # (70+40)/2


def test_dataset_is_well_formed():
    """Every dataset case has the fields the harness relies on."""
    cases = json.loads((Path(__file__).parent.parent / "eval" / "dataset.json").read_text("utf-8"))
    assert len(cases) >= 10
    ids = [c["id"] for c in cases]
    assert len(ids) == len(set(ids)), "duplicate case ids"
    for c in cases:
        assert {"resume_text", "job_description_text", "mode", "language"} <= c["request"].keys()
        assert c["request"]["mode"] in {"anschreiben", "email"}
        assert c["request"]["language"] in {"en", "de"}
        assert c["expected_gaps"], f"{c['id']} has no expected_gaps to measure"
