"""Supabase integration for ALIGN (auth verification + persistence).

Talks to Supabase over plain HTTP (GoTrue for auth, PostgREST for data)
instead of pulling in the full supabase-py client. All writes go through
the service-role key so the append-only `usage_log` table stays
tamper-proof; reads on behalf of users happen client-side under RLS.
"""

import os
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

_TIMEOUT = httpx.Timeout(10.0)


def _supabase_url() -> Optional[str]:
    # Accept the framework-prefixed names too (VITE_ for our Vite frontend,
    # NEXT_PUBLIC_ for Next): on Vercel the URL/anon key are often set only under
    # the frontend-prefixed name, and the backend reading the bare name would
    # otherwise see no config and silently disable Supabase-backed features.
    url = (
        os.environ.get("SUPABASE_URL")
        or os.environ.get("VITE_SUPABASE_URL")
        or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    )
    return url.rstrip("/") if url else None


def _service_key() -> Optional[str]:
    return os.environ.get("SUPABASE_SERVICE_ROLE_KEY")


def _anon_key() -> Optional[str]:
    return (
        os.environ.get("SUPABASE_ANON_KEY")
        or os.environ.get("VITE_SUPABASE_ANON_KEY")
        or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    )


def is_configured() -> bool:
    return bool(_supabase_url() and _service_key() and _anon_key())


def daily_limit() -> int:
    try:
        return int(os.environ.get("DAILY_ANALYSIS_LIMIT", "20"))
    except ValueError:
        return 20


def _service_headers() -> dict:
    key = _service_key()
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


async def get_user_id(access_token: str) -> Optional[str]:
    """Resolve a Supabase access token to a user id, or None if invalid/expired."""
    url = _supabase_url()
    if not url:
        return None
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        response = await client.get(
            f"{url}/auth/v1/user",
            headers={"apikey": _anon_key(), "Authorization": f"Bearer {access_token}"},
        )
    if response.status_code != 200:
        return None
    return response.json().get("id")


async def count_usage_today(user_id: str) -> int:
    """Number of Gemini runs this user has logged since midnight UTC."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%dT00:00:00Z")
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        response = await client.get(
            f"{_supabase_url()}/rest/v1/usage_log",
            params={
                "select": "id",
                "user_id": f"eq.{user_id}",
                "created_at": f"gte.{today}",
            },
            headers={**_service_headers(), "Prefer": "count=exact", "Range": "0-0"},
        )
    response.raise_for_status()
    # PostgREST reports the total as "Content-Range: 0-0/<count>".
    content_range = response.headers.get("content-range", "")
    if "/" in content_range:
        total = content_range.rsplit("/", 1)[1]
        if total.isdigit():
            return int(total)
    return 0


async def log_usage(user_id: str, prompt_tokens: Optional[int], output_tokens: Optional[int]) -> None:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        response = await client.post(
            f"{_supabase_url()}/rest/v1/usage_log",
            json={
                "user_id": user_id,
                "prompt_tokens": prompt_tokens,
                "output_tokens": output_tokens,
            },
            headers=_service_headers(),
        )
    response.raise_for_status()


async def save_analysis(record: dict[str, Any]) -> Optional[str]:
    """Insert an analysis row and return its id."""
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        response = await client.post(
            f"{_supabase_url()}/rest/v1/analyses",
            json=record,
            headers={**_service_headers(), "Prefer": "return=representation"},
        )
    response.raise_for_status()
    rows = response.json()
    return rows[0]["id"] if rows else None


async def touch_resume(user_id: str, resume_id: str) -> None:
    """Mark a vault resume as last used so the app can auto-load it next session."""
    now = datetime.now(timezone.utc).isoformat()
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        await client.patch(
            f"{_supabase_url()}/rest/v1/resumes",
            params={"id": f"eq.{resume_id}", "user_id": f"eq.{user_id}"},
            json={"last_used_at": now},
            headers=_service_headers(),
        )
