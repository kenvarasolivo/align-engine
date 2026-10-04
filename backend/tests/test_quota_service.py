import asyncio
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException, Request
from fastapi.testclient import TestClient

import main
from app.services import quota_service as quota, supabase_service
from tests.conftest import make_valid_analysis


def request(address="203.0.113.1", headers=None):
    return Request({"type": "http", "client": (address, 1234), "headers": [(key.encode(), value.encode()) for key, value in (headers or {}).items()]})


@pytest.mark.asyncio
async def test_guest_limit_is_reserved_before_generation_and_separate_for_coach(monkeypatch):
    monkeypatch.setenv("GUEST_DAILY_ANALYSIS_LIMIT", "2")
    assert await quota.reserve(request(), None, "analyze") == (1, 2)
    assert await quota.reserve(request(), None, "analyze") == (2, 2)
    with pytest.raises(HTTPException) as caught:
        await quota.reserve(request(), None, "analyze")
    assert caught.value.status_code == 429
    assert int(caught.value.headers["Retry-After"]) > 0
    assert await quota.reserve(request(), None, "coach") == (1, 5)
    assert await quota.reserve(request("203.0.113.2"), None, "analyze") == (1, 2)


@pytest.mark.asyncio
async def test_concurrent_guest_requests_cannot_exceed_local_limit(monkeypatch):
    monkeypatch.setenv("GUEST_DAILY_ANALYSIS_LIMIT", "3")
    results = await asyncio.gather(*(quota.reserve(request(), None, "analyze") for _ in range(15)), return_exceptions=True)
    assert sorted(result[0] for result in results if isinstance(result, tuple)) == [1, 2, 3]
    assert sum(isinstance(result, HTTPException) and result.status_code == 429 for result in results) == 12


def test_guest_identity_is_hashed_and_ignores_untrusted_forwarding(monkeypatch):
    monkeypatch.setenv("QUOTA_HASH_SECRET", "test-secret")
    key = quota.guest_key(request())
    assert "203.0.113" not in key
    assert key == quota.guest_key(request(headers={"x-forwarded-for": "192.0.2.1", "x-vercel-forwarded-for": "192.0.2.1"}))
    monkeypatch.setenv("VERCEL", "1")
    assert key == quota.guest_key(request("proxy", {"x-vercel-forwarded-for": "203.0.113.1"}))


@pytest.mark.asyncio
async def test_configured_quota_uses_atomic_rpc_and_fails_closed():
    with patch.object(supabase_service, "is_configured", return_value=True), patch.object(supabase_service, "reserve_quota", AsyncMock(return_value=4)) as rpc:
        assert await quota.reserve(request(), "user-1", "coach") == (4, 20)
        rpc.assert_awaited_once_with("user:user-1", "coach", 20)
    with patch.object(supabase_service, "is_configured", return_value=True), patch.object(supabase_service, "reserve_quota", AsyncMock(side_effect=Exception("DB unavailable"))):
        with pytest.raises(HTTPException) as caught:
            await quota.reserve(request(), "user-1", "analyze")
        assert caught.value.status_code == 503


@pytest.mark.asyncio
async def test_production_never_uses_process_local_counters(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    with pytest.raises(HTTPException) as caught:
        await quota.reserve(request(), None, "analyze")
    assert caught.value.status_code == 503


def test_guest_limit_stops_model_even_after_failures(monkeypatch):
    monkeypatch.setenv("GUEST_DAILY_ANALYSIS_LIMIT", "1")
    payload = {"resume_text": "Python", "job_description_text": "Python", "mode": "email", "language": "en"}
    with TestClient(main.app) as client, patch.object(main, "run_analysis", AsyncMock(side_effect=Exception("upstream failure"))) as model:
        assert client.post("/analyze", json=payload).status_code == 502
        assert client.post("/analyze", json=payload).status_code == 429
        assert model.await_count == 1


def test_coach_auth_and_quota_are_checked_before_retrieval():
    with TestClient(main.app) as client, patch.object(supabase_service, "is_configured", return_value=True), patch.object(supabase_service, "get_user_id", AsyncMock(return_value="user-1")), patch.object(supabase_service, "reserve_quota", AsyncMock(return_value=None)) as rpc, patch.object(main, "coach_skill_gaps", AsyncMock()) as coach:
        assert client.post("/skill-coach", json={"skill_gaps": ["Docker"]}, headers={"Authorization": "Bearer token"}).status_code == 429
        rpc.assert_awaited_once_with("user:user-1", "coach", 20)
        coach.assert_not_called()


def test_authenticated_request_does_not_silently_become_guest():
    with TestClient(main.app) as client, patch.object(main, "run_analysis", AsyncMock(return_value=(make_valid_analysis(), 1, 2))) as model:
        assert client.post("/analyze", json={"resume_text": "Python", "job_description_text": "Python", "mode": "email", "language": "en"}, headers={"Authorization": "Bearer token"}).status_code == 503
        model.assert_not_called()
