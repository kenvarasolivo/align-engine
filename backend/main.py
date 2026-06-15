"""ALIGN — AI-Driven Professional Alignment Engine (API entry point).

Run from the backend/ directory:
    uvicorn main:app --reload --port 8000
"""

import logging

from dotenv import load_dotenv

load_dotenv()  # must run before the Gemini service reads GEMINI_API_KEY

from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.schemas import AnalyzeRequest, AnalyzeResult, ExtractResponse, UsageInfo
from app.services import supabase_service
from app.services.extract_service import extract_text
from app.services.gemini_service import run_analysis

logger = logging.getLogger("align")

app = FastAPI(
    title="ALIGN",
    description="AI-Driven Professional Alignment Engine — context-aware application tailoring and analysis.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "engine": "ALIGN"}


@app.post("/extract", response_model=ExtractResponse)
async def extract(file: UploadFile = File(...)) -> ExtractResponse:
    """Extract plain text from an uploaded resume file (PDF, DOCX, or TXT)."""
    data = await file.read()
    filename = file.filename or "upload"
    try:
        text = extract_text(filename, data)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return ExtractResponse(filename=filename, text=text)


async def _resolve_user(authorization: str | None) -> str | None:
    """Map an optional Bearer token to a Supabase user id (None = guest)."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    if not supabase_service.is_configured():
        return None
    token = authorization.split(" ", 1)[1].strip()
    user_id = await supabase_service.get_user_id(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Your session has expired. Please sign in again.")
    return user_id


@app.post("/analyze", response_model=AnalyzeResult)
async def analyze(payload: AnalyzeRequest, authorization: str | None = Header(None)) -> AnalyzeResult:
    user_id = await _resolve_user(authorization)

    # Quota check before spending Gemini tokens (signed-in users only —
    # guests are not persisted, so there is nothing to count against).
    used_today = 0
    limit = supabase_service.daily_limit()
    if user_id:
        used_today = await supabase_service.count_usage_today(user_id)
        if used_today >= limit:
            raise HTTPException(
                status_code=429,
                detail=f"Daily analysis limit reached ({limit} runs/day). Quota resets at midnight UTC.",
            )

    try:
        result, prompt_tokens, output_tokens = await run_analysis(payload)
    except RuntimeError as exc:
        # Configuration problems (e.g. missing API key) — actionable for the operator.
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Gemini analysis failed: {exc}") from exc

    analysis_id: str | None = None
    usage: UsageInfo | None = None
    if user_id:
        # Persistence must never lose a successful (already paid-for) analysis.
        try:
            await supabase_service.log_usage(user_id, prompt_tokens, output_tokens)
            analysis_id = await supabase_service.save_analysis(
                {
                    "user_id": user_id,
                    "resume_id": payload.resume_id,
                    "job_description_id": payload.job_description_id,
                    "resume_snapshot": payload.resume_text,
                    "job_description_snapshot": payload.job_description_text,
                    "mode": payload.mode,
                    "language": payload.language,
                    # Store skills as plain strings (the column is text[]); the
                    # per-skill evidence is only surfaced live, not persisted.
                    "matching_skills": [m.skill for m in result.matching_skills],
                    "skill_gaps": result.skill_gaps,
                    "match_score": result.match_score,
                    "score_rationale": result.score_rationale,
                    "generated_draft": result.generated_draft,
                    "prompt_tokens": prompt_tokens,
                    "output_tokens": output_tokens,
                }
            )
            if payload.resume_id:
                await supabase_service.touch_resume(user_id, payload.resume_id)
            usage = UsageInfo(used_today=used_today + 1, daily_limit=limit)
        except Exception:
            logger.exception("Failed to persist analysis for user %s", user_id)

    return AnalyzeResult(
        **result.model_dump(),
        analysis_id=analysis_id,
        usage=usage,
        prompt_tokens=prompt_tokens,
        output_tokens=output_tokens,
    )
