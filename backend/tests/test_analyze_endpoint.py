"""End-to-end API tests via FastAPI's TestClient with Gemini mocked.

These exercise the real request/response pipeline (validation, status codes,
schema-valid JSON out) without any network calls. Guest mode is used so the
Supabase persistence path is never touched.
"""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

import main
from app.schemas import AnalysisResponse
from tests.conftest import make_valid_analysis


@pytest.fixture
def client():
    return TestClient(main.app)


def _payload(**overrides):
    data = {
        "resume_text": "Python engineer with FastAPI experience.",
        "job_description_text": "Backend engineer, Python and Kubernetes.",
        "mode": "email",
        "language": "en",
    }
    data.update(overrides)
    return data


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "engine": "ALIGN"}


def test_analyze_returns_schema_valid_json(client):
    analysis = make_valid_analysis()
    with patch.object(main, "run_analysis", AsyncMock(return_value=(analysis, 100, 200))):
        resp = client.post("/analyze", json=_payload())
    assert resp.status_code == 200
    body = resp.json()
    # The response must itself satisfy the structured contract.
    AnalysisResponse.model_validate(body)
    assert body["match_score"] == analysis.match_score
    assert body["prompt_tokens"] == 100
    assert body["output_tokens"] == 200
    # Guest run -> no persistence metadata.
    assert body["analysis_id"] is None
    assert body["usage"] is None


def test_analyze_rejects_invalid_payload(client):
    """Empty resume_text violates min_length -> 422 before any Gemini call."""
    with patch.object(main, "run_analysis", AsyncMock()) as mocked:
        resp = client.post("/analyze", json=_payload(resume_text=""))
    assert resp.status_code == 422
    mocked.assert_not_called()


def test_analyze_rejects_unknown_mode(client):
    resp = client.post("/analyze", json=_payload(mode="tweet"))
    assert resp.status_code == 422


def test_analyze_maps_config_error_to_500(client):
    with patch.object(main, "run_analysis", AsyncMock(side_effect=RuntimeError("GEMINI_API_KEY is not set"))):
        resp = client.post("/analyze", json=_payload())
    assert resp.status_code == 500
    assert "GEMINI_API_KEY" in resp.json()["detail"]


def test_analyze_maps_gemini_failure_to_502(client):
    with patch.object(main, "run_analysis", AsyncMock(side_effect=Exception("upstream blew up"))):
        resp = client.post("/analyze", json=_payload())
    assert resp.status_code == 502
    assert "Gemini analysis failed" in resp.json()["detail"]


def test_extract_endpoint_reads_uploaded_text(client):
    resp = client.post(
        "/extract",
        files={"file": ("resume.txt", b"Senior Backend Engineer", "text/plain")},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["filename"] == "resume.txt"
    assert "Senior Backend Engineer" in body["text"]


def test_extract_endpoint_rejects_unsupported_type(client):
    resp = client.post(
        "/extract",
        files={"file": ("resume.rtf", b"nope", "application/rtf")},
    )
    assert resp.status_code == 422
