"""Pydantic schemas shared by the API layer and the Gemini service.

`AnalysisResponse` doubles as the Structured Output contract passed directly
into the Gemini generation config, so its field names and descriptions are
part of the prompt surface — keep them precise.
"""

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

Mode = Literal["anschreiben", "email"]
Language = Literal["en", "de"]


class AnalyzeRequest(BaseModel):
    """Inbound payload for POST /api/analyze."""

    resume_text: str = Field(..., min_length=1, description="Raw pasted resume / CV text.")
    job_description_text: str = Field(..., min_length=1, description="Raw pasted job description text.")
    mode: Mode = Field(..., description="Workflow mode: 'anschreiben' (one-page cover letter) or 'email' (cold outreach).")
    language: Language = Field(..., description="Strict output locale: 'en' or 'de'.")
    resume_id: Optional[str] = Field(None, description="Vault resume id, when the resume came from the user's vault.")
    job_description_id: Optional[str] = Field(None, description="Saved job description id, when loaded from bookmarks.")


class ExtractResponse(BaseModel):
    """Result of POST /api/extract — plain text pulled from an uploaded resume file."""

    filename: str = Field(..., description="Original name of the uploaded file.")
    text: str = Field(..., description="Extracted plain text content.")


class AnalysisResponse(BaseModel):
    """Structured Output contract enforced on the Gemini response."""

    matching_skills: List[str] = Field(
        ...,
        description=(
            "Exactly the top 3 strongest technical/professional alignments that appear in BOTH "
            "the resume and the job description. Short tag-style phrases (2-4 words each), "
            "written in the requested output language."
        ),
    )
    skill_gaps: List[str] = Field(
        ...,
        description=(
            "The 3 to 5 most crucial skills or keywords the job description demands but the "
            "resume does not credibly evidence. Short tag-style phrases, written in the "
            "requested output language."
        ),
    )
    generated_draft: str = Field(
        ...,
        description=(
            "The complete tailored outreach asset (cover letter or email) following the mode "
            "rules, written entirely in the requested output language."
        ),
    )


class UsageInfo(BaseModel):
    """Per-user quota snapshot returned alongside an analysis."""

    used_today: int = Field(..., description="Runs consumed today (UTC), including this one.")
    daily_limit: int = Field(..., description="Maximum runs allowed per day.")


class AnalyzeResult(AnalysisResponse):
    """API response for POST /api/analyze.

    Extends the Gemini contract with persistence/usage metadata. Kept separate
    from `AnalysisResponse` so the extra fields never leak into the Structured
    Output schema sent to Gemini.
    """

    analysis_id: Optional[str] = Field(None, description="History row id, when the user is signed in.")
    usage: Optional[UsageInfo] = Field(None, description="Quota snapshot, when the user is signed in.")
    prompt_tokens: Optional[int] = Field(None, description="Gemini prompt token count for this run.")
    output_tokens: Optional[int] = Field(None, description="Gemini output token count for this run.")
