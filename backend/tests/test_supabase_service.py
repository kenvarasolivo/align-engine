"""Tests for the Supabase HTTP integration with httpx mocked.

No real network: httpx.AsyncClient is replaced with a fake whose verbs return
canned responses, so we can assert URL/header/param construction and the
parsing of PostgREST quirks (e.g. the Content-Range count header).
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services import supabase_service as svc

ENV = {
    "SUPABASE_URL": "https://proj.supabase.co",
    "SUPABASE_SERVICE_ROLE_KEY": "service-key",
    "SUPABASE_ANON_KEY": "anon-key",
}


@pytest.fixture
def env(monkeypatch):
    for k, v in ENV.items():
        monkeypatch.setenv(k, v)


def _fake_response(status=200, json_data=None, headers=None):
    resp = MagicMock()
    resp.status_code = status
    resp.json.return_value = json_data if json_data is not None else {}
    resp.headers = headers or {}
    resp.raise_for_status = MagicMock()
    return resp


def _patch_client(verb_to_response: dict):
    """Patch httpx.AsyncClient to a fake async context manager."""
    client = SimpleNamespace()
    for verb, resp in verb_to_response.items():
        setattr(client, verb, AsyncMock(return_value=resp))
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=client)
    cm.__aexit__ = AsyncMock(return_value=False)
    return patch("app.services.supabase_service.httpx.AsyncClient", return_value=cm), client


def test_is_configured_true(env):
    assert svc.is_configured() is True


def test_is_configured_false_when_missing(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("NEXT_PUBLIC_SUPABASE_URL", raising=False)
    assert svc.is_configured() is False


def test_supabase_url_strips_trailing_slash(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://proj.supabase.co/")
    assert svc._supabase_url() == "https://proj.supabase.co"


@pytest.mark.parametrize("raw,expected", [("5", 5), ("not-int", 20)])
def test_daily_limit(monkeypatch, raw, expected):
    monkeypatch.setenv("DAILY_ANALYSIS_LIMIT", raw)
    assert svc.daily_limit() == expected


def test_daily_limit_defaults_when_unset(monkeypatch):
    monkeypatch.delenv("DAILY_ANALYSIS_LIMIT", raising=False)
    assert svc.daily_limit() == 20


@pytest.mark.asyncio
async def test_get_user_id_success(env):
    p, _ = _patch_client({"get": _fake_response(200, {"id": "user-123"})})
    with p:
        assert await svc.get_user_id("token") == "user-123"


@pytest.mark.asyncio
async def test_get_user_id_returns_none_on_401(env):
    p, _ = _patch_client({"get": _fake_response(401)})
    with p:
        assert await svc.get_user_id("bad-token") is None


@pytest.mark.asyncio
async def test_count_usage_today_parses_content_range(env):
    resp = _fake_response(200, headers={"content-range": "0-0/7"})
    p, _ = _patch_client({"get": resp})
    with p:
        assert await svc.count_usage_today("user-123") == 7


@pytest.mark.asyncio
async def test_count_usage_today_zero_without_range(env):
    p, _ = _patch_client({"get": _fake_response(200, headers={})})
    with p:
        assert await svc.count_usage_today("user-123") == 0


@pytest.mark.asyncio
async def test_log_usage_posts_and_raises_for_status(env):
    resp = _fake_response(201)
    p, client = _patch_client({"post": resp})
    with p:
        await svc.log_usage("user-123", 100, 200)
    client.post.assert_awaited_once()
    resp.raise_for_status.assert_called_once()


@pytest.mark.asyncio
async def test_save_analysis_returns_row_id(env):
    p, _ = _patch_client({"post": _fake_response(201, [{"id": "row-9"}])})
    with p:
        assert await svc.save_analysis({"user_id": "u"}) == "row-9"


@pytest.mark.asyncio
async def test_save_analysis_returns_none_when_empty(env):
    p, _ = _patch_client({"post": _fake_response(201, [])})
    with p:
        assert await svc.save_analysis({"user_id": "u"}) is None


@pytest.mark.asyncio
async def test_touch_resume_issues_patch(env):
    p, client = _patch_client({"patch": _fake_response(204)})
    with p:
        await svc.touch_resume("user-123", "resume-1")
    client.patch.assert_awaited_once()
