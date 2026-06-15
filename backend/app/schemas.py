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


class SkillMatch(BaseModel):
    """A matching skill paired with verbatim evidence from the resume.

    The evidence anchors every claimed alignment to a real line in the
    candidate's resume, so the result is verifiable rather than asserted.
    """

    skill: str = Field(
        ...,
        description=(
            "Short tag-style phrase (2-4 words) naming an alignment present in BOTH the resume "
            "and the job description, written in the requested output language."
        ),
    )
    evidence: str = Field(
        ...,
        description=(
            "A short verbatim quote (or the closest phrase) FROM THE RESUME that proves the "
            "candidate has this skill. Must be drawn from the resume text — never invented. "
            "Keep it under ~15 words; written in the resume's own language."
        ),
    )


class AnalysisResponse(BaseModel):
    """Structured Output contract enforced on the Gemini response."""

    match_score: int = Field(
        ...,
        ge=0,
        le=100,
        description=(
            "Overall alignment score from 0 to 100 — how well the resume covers the job "
            "description's core requirements. 0 = no overlap; 100 = essentially every key "
            "requirement is credibly evidenced. Be honest and calibrated: most genuine "
            "applications land between 40 and 85."
        ),
    )
    score_rationale: str = Field(
        ...,
        description=(
            "One concise sentence (in the requested output language) justifying the score: the "
            "candidate's standout strength and the main thing holding the score back."
        ),
    )
    matching_skills: List[SkillMatch] = Field(
        ...,
        description=(
            "Exactly the top 3 strongest technical/professional alignments that appear in BOTH "
            "the resume and the job description, each paired with verbatim resume evidence."
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
