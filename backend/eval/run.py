"""ALIGN evaluation harness — measures real Gemini output quality.

Unlike the pytest suite (which mocks Gemini), this script calls the *live*
model over a labelled dataset and reports three metrics:

  * Schema-validity rate  — share of runs that parsed into AnalysisResponse.
  * Structural-compliance rate — share obeying the contract (top-3 matches
    with evidence, 3-5 gaps, in-range score).
  * Skill-gap hit-rate    — of the gaps we KNOW the resume is missing, how
    many the model actually surfaced (extraction quality).

Designed for the Gemini free tier: it runs cases sequentially with a delay
and retries on rate-limit (429) errors, so ~15 cases cost nothing but a
sliver of the daily quota.

Usage (from backend/, with GEMINI_API_KEY in .env):
    python -m eval.run
    python -m eval.run --delay 6 --limit 5
"""

from __future__ import annotations

import argparse
import asyncio
import json
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv()  # load GEMINI_API_KEY before the Gemini client is built

from app.schemas import AnalysisResponse, AnalyzeRequest
from app.services.gemini_service import run_analysis

DATASET_PATH = Path(__file__).parent / "dataset.json"


# --- Pure scoring (no network; unit-tested in tests/test_eval_harness.py) -----

def _normalize(text: str) -> str:
    return text.lower().strip()


def gap_is_hit(expected: str, model_gaps: list[str]) -> bool:
    """True if an expected (missing) skill shows up in the model's gap list.

    Matches loosely in either direction so 'Kubernetes' hits 'Kubernetes (EKS)'
    and 'AWS' hits 'AWS cloud'.
    """
    exp = _normalize(expected)
    return any(exp in _normalize(g) or _normalize(g) in exp for g in model_gaps if g)


@dataclass
class CaseResult:
    id: str
    schema_valid: bool
    structural_ok: bool = False
    gap_hits: int = 0
    gap_total: int = 0
    match_score: Optional[int] = None
    score_in_band: Optional[bool] = None
    error: Optional[str] = None


def evaluate_case(case: dict, result: AnalysisResponse) -> CaseResult:
    """Score a successfully-parsed model result against a labelled case."""
    structural_ok = (
        len(result.matching_skills) == 3
        and all(m.skill and m.evidence for m in result.matching_skills)
        and 3 <= len(result.skill_gaps) <= 5
        and 0 <= result.match_score <= 100
    )

    expected = case.get("expected_gaps", [])
    hits = sum(gap_is_hit(g, result.skill_gaps) for g in expected)

    band = case.get("score_band")
    in_band = None
    if band:
        in_band = band[0] <= result.match_score <= band[1]

    return CaseResult(
        id=case["id"],
        schema_valid=True,
        structural_ok=structural_ok,
        gap_hits=hits,
        gap_total=len(expected),
        match_score=result.match_score,
        score_in_band=in_band,
    )


def summarize(results: list[CaseResult]) -> dict:
    n = len(results)
    valid = [r for r in results if r.schema_valid]
    gap_total = sum(r.gap_total for r in valid)
    gap_hits = sum(r.gap_hits for r in valid)
    banded = [r for r in valid if r.score_in_band is not None]
    return {
        "cases": n,
        "schema_valid_rate": len(valid) / n if n else 0.0,
        "structural_rate": sum(r.structural_ok for r in valid) / n if n else 0.0,
        "gap_hit_rate": gap_hits / gap_total if gap_total else 0.0,
        "gap_hits": gap_hits,
        "gap_total": gap_total,
        "score_in_band_rate": (
            sum(bool(r.score_in_band) for r in banded) / len(banded) if banded else None
        ),
        "avg_match_score": (
            sum(r.match_score for r in valid if r.match_score is not None) / len(valid)
            if valid else None
        ),
    }


def _pct(x: Optional[float]) -> str:
    return "n/a" if x is None else f"{x * 100:.0f}%"


def print_report(results: list[CaseResult], summary: dict) -> None:
    print("\n" + "=" * 64)
    print("ALIGN EVAL REPORT")
    print("=" * 64)
    print(f"{'case':<28} {'valid':>5} {'struct':>6} {'gaps':>6} {'score':>6}")
    print("-" * 64)
    for r in results:
        if not r.schema_valid:
            print(f"{r.id:<28} {'FAIL':>5} {'-':>6} {'-':>6} {'-':>6}  ({r.error})")
            continue
        band = "" if r.score_in_band is None else ("✓" if r.score_in_band else "✗band")
        print(
            f"{r.id:<28} {'ok':>5} {('ok' if r.structural_ok else 'BAD'):>6} "
            f"{f'{r.gap_hits}/{r.gap_total}':>6} {f'{r.match_score}{band}':>6}"
        )
    print("-" * 64)
    print(f"Cases:                 {summary['cases']}")
    print(f"Schema-validity rate:  {_pct(summary['schema_valid_rate'])}")
    print(f"Structural-compliance: {_pct(summary['structural_rate'])}")
    print(f"Skill-gap hit-rate:    {_pct(summary['gap_hit_rate'])} "
          f"({summary['gap_hits']}/{summary['gap_total']})")
    print(f"Score-in-band rate:    {_pct(summary['score_in_band_rate'])}")
    avg = summary["avg_match_score"]
    print(f"Avg match_score:       {'n/a' if avg is None else f'{avg:.1f}'}")
    print("=" * 64 + "\n")


# --- Live API loop (free-tier friendly) ---------------------------------------

def _is_rate_limit(exc: Exception) -> bool:
    s = str(exc).lower()
    return "429" in s or "resource_exhausted" in s or "rate" in s


async def run_one(case: dict, retries: int = 2) -> CaseResult:
    request = AnalyzeRequest(**case["request"])
    for attempt in range(retries + 1):
        try:
            result, _, _ = await run_analysis(request)
            return evaluate_case(case, result)
        except Exception as exc:  # noqa: BLE001 - we want to record any failure
            if _is_rate_limit(exc) and attempt < retries:
                backoff = 5 * (2 ** attempt)
                print(f"  rate-limited on {case['id']}, retrying in {backoff}s...")
                await asyncio.sleep(backoff)
                continue
            return CaseResult(id=case["id"], schema_valid=False, error=str(exc)[:80])
    return CaseResult(id=case["id"], schema_valid=False, error="exhausted retries")


async def main_async(delay: float, limit: Optional[int]) -> None:
    cases = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
    if limit:
        cases = cases[:limit]

    results: list[CaseResult] = []
    for i, case in enumerate(cases):
        print(f"[{i + 1}/{len(cases)}] {case['id']} ...")
        results.append(await run_one(case))
        if i < len(cases) - 1:
            await asyncio.sleep(delay)  # stay under free-tier RPM

    print_report(results, summarize(results))


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the ALIGN evaluation harness.")
    parser.add_argument("--delay", type=float, default=5.0,
                        help="seconds between calls (free-tier RPM guard; default 5)")
    parser.add_argument("--limit", type=int, default=None,
                        help="only run the first N cases")
    args = parser.parse_args()
    asyncio.run(main_async(args.delay, args.limit))


if __name__ == "__main__":
    main()
