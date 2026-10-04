"""Reserve AI requests before spending tokens; production uses an atomic DB RPC."""
import hashlib
import hmac
import os
import logging
import threading
from datetime import datetime, timezone

from fastapi import HTTPException, Request

from app.services import supabase_service

_lock = threading.Lock()
_local_counts: dict[tuple[str, str], int] = {}
_local_day = ""
logger = logging.getLogger("align.quota")


def _limit(name: str, default: int) -> int:
    try:
        return max(1, int(os.getenv(name, str(default))))
    except ValueError:
        return default


def guest_key(request: Request) -> str:
    # Only use Vercel's platform-owned header on Vercel. Never trust arbitrary
    # X-Forwarded-For headers supplied by a caller on other deployments.
    address = request.client.host if request.client else "unknown"
    if os.getenv("VERCEL") == "1":
        address = request.headers.get("x-vercel-forwarded-for", address).split(",")[0].strip()
    secret = os.getenv("QUOTA_HASH_SECRET") or supabase_service._service_key()
    if not secret and os.getenv("VERCEL") == "1":
        raise HTTPException(503, "Guest access is temporarily unavailable. Please try again later.")
    digest = hmac.new((secret or "align-local-development").encode(), address.encode(), hashlib.sha256).hexdigest()
    return f"guest:{digest}"


async def reserve(request: Request, user_id: str | None, operation: str) -> tuple[int, int]:
    """Return (requests used, limit). Reservations count attempted generations.

    Counting before generation also bounds retries and upstream failures. A
    request reserves once even if the AI service performs a validation retry.
    """
    global _local_day
    if user_id:
        key = f"user:{user_id}"
        limit = supabase_service.daily_limit() if operation == "analyze" else _limit("DAILY_COACH_LIMIT", 20)
    else:
        key = guest_key(request)
        limit = _limit("GUEST_DAILY_ANALYSIS_LIMIT" if operation == "analyze" else "GUEST_DAILY_COACH_LIMIT", 5)
    limit = max(1, limit)
    if supabase_service.is_configured():
        try:
            used = await supabase_service.reserve_quota(key, operation, limit)
        except Exception as exc:
            logger.exception("Shared AI quota reservation failed; check the ai_quotas migration and runtime config")
            raise HTTPException(503, "Usage limits are temporarily unavailable. Please try again shortly.") from exc
    else:
        # Convenient guest-only local development; multi-instance production
        # must use Supabase so counts are shared across workers and restarts.
        if os.getenv("VERCEL") == "1" or os.getenv("ENVIRONMENT") == "production":
            raise HTTPException(503, "The service is temporarily unavailable. Please try again later.")
        today = datetime.now(timezone.utc).date().isoformat()
        with _lock:
            if today != _local_day:
                _local_counts.clear()
                _local_day = today
            bucket = (key, operation)
            current = _local_counts.get(bucket, 0)
            used = current + 1 if current < limit else None
            if used is not None:
                _local_counts[bucket] = used
    if used is None:
        label = "analysis" if operation == "analyze" else "learning plan"
        hint = " Sign in for a higher limit." if not user_id else ""
        now = datetime.now(timezone.utc)
        retry_after = 86400 - (now.hour * 3600 + now.minute * 60 + now.second)
        raise HTTPException(429, f"Daily {label} limit reached ({limit}/day). Resets at midnight UTC.{hint}", headers={"Retry-After": str(retry_after)})
    return used, limit
