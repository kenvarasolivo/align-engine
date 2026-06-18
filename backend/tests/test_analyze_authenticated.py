"""Signed-in /analyze tests: quota enforcement and persistence metadata.

The Supabase service functions are mocked so we exercise main.py's auth,
quota, and persistence branches without a database.
"""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

import main
from app.services import supabase_service
from tests.conftest import make_valid_analysis

AUTH = {"Authorization": "Bearer fake-token"}


@pytest.fixture
def client():
    return TestClient(main.app)


def _payload():
    return {
        "resume_text": "Python engineer.",
        "job_description_text": "Backend role.",
        "mode": "email",
        "language": "en",
    }


def test_authenticated_analyze_persists_and_returns_usage(client):
    analysis = make_valid_analysis()
    with patch.object(supabase_service, "is_configured", return_value=True), \
         patch.object(supabase_service, "get_user_id", AsyncMock(return_value="user-1")), \
         patch.object(supabase_service, "daily_limit", return_value=20), \
         patch.object(supabase_service, "count_usage_today", AsyncMock(return_value=3)), \
         patch.object(supabase_service, "log_usage", AsyncMock()), \
         patch.object(supabase_service, "save_analysis", AsyncMock(return_value="analysis-42")), \
         patch.object(main, "run_analysis", AsyncMock(return_value=(analysis, 100, 200))):
        resp = client.post("/analyze", json=_payload(), headers=AUTH)

    assert resp.status_code == 200
    body = resp.json()
    assert body["analysis_id"] == "analysis-42"
    assert body["usage"] == {"used_today": 4, "daily_limit": 20}


def test_quota_exceeded_returns_429_without_calling_gemini(client):
    with patch.object(supabase_service, "is_configured", return_value=True), \
         patch.object(supabase_service, "get_user_id", AsyncMock(return_value="user-1")), \
         patch.object(supabase_service, "daily_limit", return_value=5), \
         patch.object(supabase_service, "count_usage_today", AsyncMock(return_value=5)), \
         patch.object(main, "run_analysis", AsyncMock()) as gemini:
        resp = client.post("/analyze", json=_payload(), headers=AUTH)

    assert resp.status_code == 429
    gemini.assert_not_called()


def test_expired_token_returns_401(client):
    with patch.object(supabase_service, "is_configured", return_value=True), \
         patch.object(supabase_service, "get_user_id", AsyncMock(return_value=None)), \
         patch.object(main, "run_analysis", AsyncMock()) as gemini:
        resp = client.post("/analyze", json=_payload(), headers=AUTH)

    assert resp.status_code == 401
    gemini.assert_not_called()


def test_persistence_failure_does_not_lose_paid_analysis(client):
    """If saving fails, the user still gets their (already paid-for) result."""
    analysis = make_valid_analysis()
    with patch.object(supabase_service, "is_configured", return_value=True), \
         patch.object(supabase_service, "get_user_id", AsyncMock(return_value="user-1")), \
         patch.object(supabase_service, "daily_limit", return_value=20), \
         patch.object(supabase_service, "count_usage_today", AsyncMock(return_value=0)), \
         patch.object(supabase_service, "log_usage", AsyncMock(side_effect=Exception("db down"))), \
         patch.object(main, "run_analysis", AsyncMock(return_value=(analysis, 1, 2))):
        resp = client.post("/analyze", json=_payload(), headers=AUTH)

    assert resp.status_code == 200
    body = resp.json()
    assert body["match_score"] == analysis.match_score
    assert body["analysis_id"] is None  # persistence failed, but result returned
