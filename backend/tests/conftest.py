"""Shared fixtures for the ALIGN test suite.

Everything here is deterministic and offline — no real Gemini or Supabase
calls are ever made. The Gemini boundary is mocked so tests are free, fast,
and reproducible (the whole point of regression-testing LLM-backed code).
"""

import pytest

from app.schemas import AnalysisResponse, SkillMatch


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
