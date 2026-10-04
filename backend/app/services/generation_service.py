"""Provider selection and structured generation shared by analysis and coaching."""

import os
from functools import lru_cache
from typing import TypeVar

from google.genai import types
from openai import AsyncOpenAI
from pydantic import BaseModel

Result = TypeVar("Result", bound=BaseModel)


def provider(selected: str | None = None) -> str:
    value = (selected if selected is not None else "gemini").strip().lower()
    if value not in {"gemini", "openai"}:
        raise RuntimeError("Provider must be 'gemini' or 'openai'.")
    return value


def model(selected: str | None = None) -> str:
    if provider(selected) == "openai":
        return os.environ.get("OPENAI_MODEL", "").strip() or "gpt-6-luna"
    return os.environ.get("GEMINI_MODEL", "").strip() or "gemini-2.5-flash"


@lru_cache(maxsize=1)
def _get_openai_client() -> AsyncOpenAI:
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise RuntimeError("OPENAI_API_KEY is not set. Add it to backend/.env before starting the server.")
    return AsyncOpenAI(api_key=key)


async def generate_structured(
    prompt: str,
    instruction: str,
    schema: type[Result],
    *,
    gemini_client,
    temperature: float,
    selected_provider: str | None = None,
) -> tuple[Result, int | None, int | None]:
    """Return validated output and usage without changing provider on failure."""
    if provider(selected_provider) == "openai":
        response = await _get_openai_client().responses.parse(
            model=model(selected_provider),
            instructions=instruction,
            input=prompt,
            text_format=schema,
            store=False,
        )
        if response.status != "completed" or response.output_parsed is None:
            raise ValueError("The AI did not return a complete structured result. Please try again.")
        usage = response.usage
        return response.output_parsed, usage.input_tokens if usage else None, usage.output_tokens if usage else None

    response = await gemini_client().aio.models.generate_content(
        model=model(selected_provider),
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=instruction,
            response_mime_type="application/json",
            response_schema=schema,
            temperature=temperature,
        ),
    )
    result = response.parsed if isinstance(response.parsed, schema) else schema.model_validate_json(response.text)
    usage = getattr(response, "usage_metadata", None)
    return result, usage.prompt_token_count if usage else None, usage.candidates_token_count if usage else None
