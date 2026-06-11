"""ALIGN — AI-Driven Professional Alignment Engine (API entry point).

Run from the backend/ directory:
    uvicorn main:app --reload --port 8000
"""

from dotenv import load_dotenv

load_dotenv()  # must run before the Gemini service reads GEMINI_API_KEY

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.schemas import AnalysisResponse, AnalyzeRequest, ExtractResponse
from app.services.extract_service import extract_text
from app.services.gemini_service import run_analysis

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


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok", "engine": "ALIGN"}


@app.post("/api/extract", response_model=ExtractResponse)
async def extract(file: UploadFile = File(...)) -> ExtractResponse:
    """Extract plain text from an uploaded resume file (PDF, DOCX, or TXT)."""
    data = await file.read()
    filename = file.filename or "upload"
    try:
        text = extract_text(filename, data)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return ExtractResponse(filename=filename, text=text)


@app.post("/api/analyze", response_model=AnalysisResponse)
async def analyze(payload: AnalyzeRequest) -> AnalysisResponse:
    try:
        return await run_analysis(payload)
    except RuntimeError as exc:
        # Configuration problems (e.g. missing API key) — actionable for the operator.
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Gemini analysis failed: {exc}") from exc
