"""Pydantic schemas shared by the API layer and the Gemini service.

`AnalysisResponse` doubles as the Structured Output contract passed directly
into the Gemini generation config, so its field names and descriptions are
part of the prompt surface — keep them precise.
"""

from typing import List, Literal

from pydantic import BaseModel, Field

Mode = Literal["anschreiben", "email"]
Language = Literal["en", "de"]


class AnalyzeRequest(BaseModel):
    """Inbound payload for POST /api/analyze."""

    resume_text: str = Field(..., min_length=1, description="Raw pasted resume / CV text.")
    job_description_text: str = Field(..., min_length=1, description="Raw pasted job description text.")
    mode: Mode = Field(..., description="Workflow mode: 'anschreiben' (one-page cover letter) or 'email' (cold outreach).")
    language: Language = Field(..., description="Strict output locale: 'en' or 'de'.")


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
