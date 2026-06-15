"""Gemini integration for ALIGN.

Uses the official `google-genai` SDK with `gemini-2.5-flash` and Structured
Outputs: the `AnalysisResponse` Pydantic model is passed straight into the
generation config as `response_schema`, so the model is forced to return
valid JSON matching our contract.
"""

import os
from functools import lru_cache

from google import genai
from google.genai import types

from app.schemas import AnalysisResponse, AnalyzeRequest

MODEL_ID = "gemini-2.5-flash"

SYSTEM_INSTRUCTION = (
    "You are ALIGN, an AI-driven professional alignment engine operating inside a "
    "human-in-the-loop workflow. You analyze a candidate's resume against a target job "
    "description, surface the strongest overlaps and the most critical gaps, and draft a "
    "tailored outreach asset that a human will review and edit before sending. "
    "You also score how well the resume matches the role and back every claimed strength "
    "with verbatim evidence from the resume, so the candidate can verify it. "
    "Never invent experience the resume does not contain. Be specific, concrete, and "
    "free of generic filler phrases."
)

_MODE_RULES = {
    "anschreiben": (
        "DRAFT MODE: Formal cover letter (Anschreiben).\n"
        "- HARD CONSTRAINT: the letter body (salutation through sign-off, excluding the "
        "header block) MUST be between 250 and 270 words — aim for roughly 260. Before "
        "finalizing, count the body words: if over 270, cut sentences; if under 240, add "
        "concrete substance (never filler) until it fits.\n"
        "- Use a tight, structured THREE-paragraph body:\n"
        "  1. HOOK — a specific, confident opening tying the candidate to this exact role/company.\n"
        "  2. ALIGNMENT — concrete evidence mapping the candidate's strongest matching skills "
        "to the job's core requirements (draw only from the resume).\n"
        "  3. CTA — a crisp, forward-moving close requesting a conversation/interview.\n"
        "- Header block: FILL IN every detail that appears in the resume — the candidate's "
        "real name, address, phone number, and email. The same applies to the company name "
        "and address if the job description states them. Use a square-bracket placeholder "
        "ONLY for details genuinely absent from the provided documents (e.g. [Datum], "
        "[Firmenanschrift], [Name Ansprechpartner]). Never output a placeholder for "
        "information that is present in the resume or job description.\n"
        "- Include a subject line, a formal salutation, and a formal sign-off ending with the "
        "candidate's real name. The subject line MUST begin with 'Bewerbung als ' (German) or "
        "'Application for ' (English), followed by the exact position title from the job "
        "description — never the bare job title alone.\n"
        "- FORMATTING: generated_draft is plain text that MUST contain real newline characters "
        "('\\n'). Put each header line (name, street, postal code + city, phone, email, company, "
        "date) on its OWN line. Separate the sender block, recipient block, date, subject line, "
        "salutation, EACH of the three body paragraphs, and the sign-off from one another with "
        "a BLANK line ('\\n\\n'). Never run two paragraphs together on one line.\n"
        "- If the output language is German, follow formal German business-letter conventions "
        "(Sie-Form, DIN-5008-style structure). Per modern DIN 5008, write the subject line "
        "WITHOUT the word 'Betreff:' — just the subject text itself on its own line."
    ),
    "email": (
        "DRAFT MODE: Cold networking outreach email.\n"
        "- HARD CONSTRAINT: strictly UNDER 200 words in total.\n"
        "- Start with a high-signal subject line on its own first line, prefixed "
        "'Subject: ' (or 'Betreff: ' in German).\n"
        "- Tone: modern, conversational, punchy. Short paragraphs, no corporate filler.\n"
        "- Lead with a specific hook, name 2-3 sharp points of alignment, and end with a "
        "low-friction ask (a short call or a pointer to the right person).\n"
        "- Use placeholders in square brackets for unknowns: [Recipient Name], [Your Name].\n"
        "- FORMATTING: generated_draft is plain text with real newline characters ('\\n'); "
        "separate paragraphs with a blank line ('\\n\\n')."
    ),
}

_LANGUAGE_RULES = {
    "en": (
        "OUTPUT LANGUAGE: English. Every field — matching_skills, skill_gaps, and "
        "generated_draft — must be written in natural, professional English."
    ),
    "de": (
        "OUTPUT LANGUAGE: German. Every field — matching_skills, skill_gaps, and "
        "generated_draft — must be written in natural, professional German. Established "
        "English technology terms (e.g. 'Machine Learning', 'CI/CD') may remain in English "
        "where that is standard German industry usage."
    ),
}


@lru_cache(maxsize=1)
def _get_client() -> genai.Client:
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not set. Add it to backend/.env or export it before starting the server."
        )
    return genai.Client(api_key=api_key)


def _build_prompt(payload: AnalyzeRequest) -> str:
    return (
        "Analyze the resume against the job description, then produce the structured result.\n\n"
        "ANALYSIS RULES:\n"
        "- match_score: an honest, calibrated 0-100 score for how well the resume covers the "
        "job's core requirements. Weight the requirements the job emphasizes most. Do not inflate "
        "— a generic or weak fit should score low.\n"
        "- score_rationale: ONE sentence naming the biggest strength and the main thing dragging "
        "the score down.\n"
        "- matching_skills: exactly the TOP 3 overlapping technical/professional alignments "
        "present in BOTH documents. For each, give a short tag-style 'skill' phrase AND an "
        "'evidence' quote taken VERBATIM from the resume that proves it — never paraphrase in a "
        "way that adds facts, and never use the job description as evidence.\n"
        "- skill_gaps: the 3-5 most crucial skills/keywords the job description requires but "
        "the resume does not credibly demonstrate, as short tag-style phrases.\n\n"
        f"{_MODE_RULES[payload.mode]}\n\n"
        f"{_LANGUAGE_RULES[payload.language]}\n\n"
        "=== RESUME ===\n"
        f"{payload.resume_text}\n\n"
        "=== JOB DESCRIPTION ===\n"
        f"{payload.job_description_text}"
    )


async def run_analysis(payload: AnalyzeRequest) -> tuple[AnalysisResponse, int | None, int | None]:
    """Run the alignment analysis via Gemini Structured Outputs.

    Returns the parsed result plus prompt/output token counts (None when the
    SDK does not report usage metadata) for usage tracking and cost estimates.
    """
    client = _get_client()

    response = await client.aio.models.generate_content(
        model=MODEL_ID,
        contents=_build_prompt(payload),
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
            response_schema=AnalysisResponse,
            temperature=0.4,
        ),
    )

    usage = response.usage_metadata
    prompt_tokens = usage.prompt_token_count if usage else None
    output_tokens = usage.candidates_token_count if usage else None

    # The SDK parses Structured Output into the Pydantic model for us; fall back
    # to validating the raw JSON text if `parsed` is unavailable.
    if isinstance(response.parsed, AnalysisResponse):
        return response.parsed, prompt_tokens, output_tokens
    return AnalysisResponse.model_validate_json(response.text), prompt_tokens, output_tokens
