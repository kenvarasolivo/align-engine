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
