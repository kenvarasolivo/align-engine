# ALIGN

**AI-Driven Professional Alignment Engine** — a decoupled, human-in-the-loop workspace that analyzes a job description against your resume, extracts a skill alignment matrix, and drafts editable outreach assets (one-page Anschreiben or punchy cold email) in English or German.

## Architecture

- `backend/` — FastAPI + the official `google-genai` SDK (`gemini-2.5-flash`) with Structured Outputs enforced via a Pydantic schema.
- `frontend/` — React + Vite + Tailwind CSS, viewport-locked 50/50 split workspace.

## Setup

### 1. Backend (Python 3.10+)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create `backend/.env` (see `backend/.env.example`):

```
GEMINI_API_KEY=your-key-from-https://aistudio.google.com/apikey
```

Start the API:

```powershell
uvicorn main:app --reload --port 8000
```

### 2. Frontend (Node 18+)

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — the Vite dev server proxies `/api/*` to the backend on port 8000.

## Usage

1. Pick a **mode** (Anschreiben — strict one-page cover letter, or Email Outreach — sub-200-word cold email) and a **language** (EN / DE) in the header.
2. Paste your resume (top-left) and the job description (bottom-left).
3. Hit **Run Alignment Analysis**.
4. Review the **Semantic Analysis** tab (top-3 matching skills, crucial gaps), then refine the result in the **Draft Editor** tab — you stay in the loop; nothing ships without your edit.

## API

`POST /api/analyze`

```json
{
  "resume_text": "...",
  "job_description_text": "...",
  "mode": "anschreiben | email",
  "language": "en | de"
}
```

Returns `{ "matching_skills": [...], "skill_gaps": [...], "generated_draft": "..." }`.
