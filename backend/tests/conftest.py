"""Shared fixtures for the ALIGN test suite.

Everything here is deterministic and offline — no real Gemini or Supabase
calls are ever made. The Gemini boundary is mocked so tests are free, fast,
and reproducible (the whole point of regression-testing LLM-backed code).
"""

import pytest

from app.schemas import AnalysisResponse, SkillMatch


@pytest.fixture(autouse=True)
def isolate_runtime(monkeypatch):
    """Tests never inherit real account keys or spend a network quota."""
    from app.services import quota_service
    for key in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY", "VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "VERCEL", "ENVIRONMENT", "GUEST_DAILY_ANALYSIS_LIMIT", "GUEST_DAILY_COACH_LIMIT", "DAILY_COACH_LIMIT"):
        monkeypatch.delenv(key, raising=False)
    quota_service._local_counts.clear()
    quota_service._local_day = ""


def make_valid_analysis(**overrides) -> AnalysisResponse:
    """Build a schema-valid AnalysisResponse, overridable per test."""
    data = {
        "match_score": 72,
        "score_rationale": "Strong Python and API background; lacks demonstrated Kubernetes experience.",
        "matching_skills": [
            SkillMatch(skill="Python", evidence="Built FastAPI services in Python for 3 years"),
            SkillMatch(skill="REST APIs", evidence="Designed and shipped REST APIs at scale"),
            SkillMatch(skill="PostgreSQL", evidence="Modeled relational schemas in PostgreSQL"),
        ],
        "skill_gaps": ["Kubernetes", "Terraform", "gRPC"],
        "generated_draft": "Subject: Application for Backend Engineer\n\nDear Hiring Team,\n\n...",
    }
    data.update(overrides)
    return AnalysisResponse(**data)


@pytest.fixture
def valid_analysis() -> AnalysisResponse:
    return make_valid_analysis()
