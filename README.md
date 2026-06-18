# ALIGN

**AI-Driven Professional Alignment Engine** — a decoupled, human-in-the-loop workspace that analyzes a job description against your resume, extracts a skill alignment matrix, and drafts editable outreach assets (one-page Anschreiben or punchy cold email) in English or German.

## Architecture

- `backend/` — FastAPI + the official `google-genai` SDK (`gemini-2.5-flash`) with Structured Outputs enforced via a Pydantic schema. Verifies Supabase JWTs, enforces daily quotas, and persists analysis runs.
- `frontend/` — React + Vite + Tailwind CSS, viewport-locked 50/50 split workspace, plus signed-in views for history, resume vault, saved jobs, and insights (talks to Supabase directly under RLS).
- `supabase/` — SQL schema for the Postgres tables and row-level-security policies.

## Features

- **Accounts (optional)** — email/password login via Supabase Auth. Guests can use the full analyzer; nothing is persisted for them.
- **Analysis history** — every signed-in run is snapshotted (resume, job description, skills, gaps, draft). Revisit, copy, reload into the workspace, or delete. Edits in the Draft Editor autosave back to the history row.
- **Resume vault** — save resume versions once; the last-used one auto-loads on your next visit.
- **Saved jobs** — bookmark job descriptions and reanalyze them against any resume later.
- **Insights** — aggregated across all runs: your most-matched skills vs. recurring gaps (a personal learning roadmap), plus token usage and estimated Gemini cost.
- **Usage tracking / quota** — the backend logs every run to an append-only table and enforces a daily per-user limit (`DAILY_ANALYSIS_LIMIT`, default 20, resets midnight UTC).

## Setup

### 1. Supabase (once)

1. Create a project at https://supabase.com.
2. Open **SQL Editor → New query**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and run it.
3. Grab the **Project URL**, **anon public key**, and **service_role key** from *Project Settings → API*.

### 2. Backend (Python 3.10+)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create `backend/.env` (see `backend/.env.example`):

```
GEMINI_API_KEY=...
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DAILY_ANALYSIS_LIMIT=20
```

Start the API:

```powershell
uvicorn main:app --reload --port 8000
```

### 3. Frontend (Node 18+)

Create `frontend/.env` (see `frontend/.env.example`):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — the Vite dev server proxies `/api/*` to the backend on port 8000. If the `VITE_SUPABASE_*` vars are missing, the app silently falls back to guest-only mode.

> **Vercel:** set the `VITE_SUPABASE_*` vars (frontend) and `GEMINI_API_KEY` + `SUPABASE_*` vars (backend) in the project's environment settings.

### Running locally

Once both `.env` files are in place and dependencies are installed, start the two dev servers in separate terminals:

```powershell
# Terminal 1 — backend
cd backend; .\.venv\Scripts\Activate.ps1; uvicorn main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend; npm run dev
```

Then open http://localhost:5173 (Vite proxies `/api/*` to the backend on port 8000).

## Testing

The backend ships with a `pytest` suite (offline — no real Gemini or Supabase
calls) that focuses on the LLM boundary: schema enforcement, regression tests
over a golden set of recorded model outputs, and full API-pipeline tests with
the AI mocked.

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
pytest --cov=app --cov=main --cov-report=term-missing
```

What's covered:

- **Schema enforcement** ([`tests/test_schemas.py`](backend/tests/test_schemas.py)) — proves the `AnalysisResponse` Pydantic contract rejects malformed model output (non-list fields, out-of-range scores, missing evidence) instead of passing it downstream.
- **Golden-set regression** ([`tests/test_golden_regression.py`](backend/tests/test_golden_regression.py)) — replays recorded Gemini responses for real resume + job-description pairs through the live `run_analysis` pipeline and asserts the structured contract and per-case expectations still hold.
- **Gemini service** ([`tests/test_gemini_service.py`](backend/tests/test_gemini_service.py)) — the network boundary is mocked; verifies the Pydantic schema is wired in as `response_schema`, the parsed/raw-JSON paths, and token accounting.
- **API pipeline** ([`tests/test_analyze_endpoint.py`](backend/tests/test_analyze_endpoint.py), [`tests/test_analyze_authenticated.py`](backend/tests/test_analyze_authenticated.py)) — FastAPI `TestClient` exercises validation, error mapping (500/502/429/401), quota enforcement, and the signed-in persistence path.

Current coverage: **94%** across `app/` and `main.py`.

### Evaluating model quality

The pytest suite mocks Gemini, so it checks the *pipeline*, not the *model*. To
measure how well the live model actually performs, run the evaluation harness
([`eval/run.py`](backend/eval/run.py)) over a labelled dataset of ~15 resume +
job-description pairs ([`eval/dataset.json`](backend/eval/dataset.json)):

```powershell
cd backend
python -m eval.run            # all cases
python -m eval.run --limit 5  # quick sample
```

It calls the real Gemini API and reports:

- **Schema-validity rate** — share of runs that parsed into the contract.
- **Structural-compliance rate** — share obeying the contract (top-3 matches with evidence, 3–5 gaps, in-range score).
- **Skill-gap hit-rate** — of the gaps each resume is *known* to be missing, how many the model surfaced (extraction quality).
- **Score-in-band rate** and **average match score** as calibration sanity checks.

It runs cases sequentially with a delay (`--delay`, default 5s) and retries on
rate-limit errors, so it stays comfortably within the Gemini **free tier** —
~15 calls per full run. The scoring logic itself is unit-tested offline in
[`tests/test_eval_harness.py`](backend/tests/test_eval_harness.py).

## Usage

1. Sign in (or **Continue as guest** — fully functional, nothing saved).
2. Pick a **mode** (Anschreiben — strict one-page cover letter, or Email Outreach — sub-200-word cold email) and a **language** (EN / DE) in the header.
3. Paste your resume (top-left) and the job description (bottom-left) — signed-in users can **Save** either to their vault.
4. Hit **Run Alignment Analysis**.
5. Review the **Semantic Analysis** tab (top-3 matching skills, crucial gaps), then refine the result in the **Draft Editor** tab — you stay in the loop; nothing ships without your edit.
6. Browse **History**, **Resumes**, **Jobs**, and **Insights** from the header nav.

## API

`POST /api/analyze` — optional `Authorization: Bearer <supabase-access-token>` header.

```json
{
  "resume_text": "...",
  "job_description_text": "...",
  "mode": "anschreiben | email",
  "language": "en | de",
  "resume_id": "optional vault id",
  "job_description_id": "optional saved-job id"
}
```

Returns `{ "matching_skills": [...], "skill_gaps": [...], "generated_draft": "...", "analysis_id": "...", "usage": { "used_today": 3, "daily_limit": 20 }, "prompt_tokens": 1234, "output_tokens": 567 }` (persistence fields are `null` for guests). Responds `429` when the daily quota is exhausted.
