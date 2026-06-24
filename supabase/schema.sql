-- ALIGN — Supabase schema
-- Run this once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Safe to re-run: everything is guarded with IF NOT EXISTS / OR REPLACE where possible.

-- ============================================================
-- Resume vault: one or more stored resume versions per user.
-- ============================================================
create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  content text not null,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists resumes_user_idx on public.resumes (user_id, last_used_at desc nulls last);

alter table public.resumes enable row level security;

drop policy if exists "resumes own rows" on public.resumes;
create policy "resumes own rows" on public.resumes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- Saved job descriptions (bookmarks).
-- ============================================================
create table if not exists public.job_descriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists job_descriptions_user_idx on public.job_descriptions (user_id, created_at desc);

alter table public.job_descriptions enable row level security;

drop policy if exists "job_descriptions own rows" on public.job_descriptions;
create policy "job_descriptions own rows" on public.job_descriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- Analysis history: a full snapshot of each run.
-- Inserted by the backend (service role) after a successful run;
-- users may read, update final_draft, and delete their own rows.
-- ============================================================
create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  resume_id uuid references public.resumes (id) on delete set null,
  job_description_id uuid references public.job_descriptions (id) on delete set null,
  title text,
  resume_snapshot text not null,
  job_description_snapshot text not null,
  mode text not null check (mode in ('anschreiben', 'email')),
  language text not null check (language in ('en', 'de')),
  matching_skills text[] not null default '{}',
  skill_gaps text[] not null default '{}',
  match_score integer,
  score_rationale text,
  generated_draft text not null,
  final_draft text,
  prompt_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);

-- Additive columns for existing deployments (the alignment score + its rationale).
alter table public.analyses add column if not exists match_score integer;
alter table public.analyses add column if not exists score_rationale text;
-- Editable history title (defaults to the job title at analysis time; renameable).
alter table public.analyses add column if not exists title text;

create index if not exists analyses_user_idx on public.analyses (user_id, created_at desc);

alter table public.analyses enable row level security;

drop policy if exists "analyses select own" on public.analyses;
create policy "analyses select own" on public.analyses
  for select using (auth.uid() = user_id);

drop policy if exists "analyses update own" on public.analyses;
create policy "analyses update own" on public.analyses
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "analyses delete own" on public.analyses;
create policy "analyses delete own" on public.analyses
  for delete using (auth.uid() = user_id);

-- ============================================================
-- Usage log: append-only record of every Gemini run, used for
-- quota enforcement and cost estimates. Users can only READ
-- their own rows — inserts happen via the service role, and
-- there is intentionally no delete/update policy so quotas
-- cannot be reset by deleting history.
-- ============================================================
create table if not exists public.usage_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  prompt_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);

create index if not exists usage_log_user_idx on public.usage_log (user_id, created_at desc);

alter table public.usage_log enable row level security;

drop policy if exists "usage_log select own" on public.usage_log;
create policy "usage_log select own" on public.usage_log
  for select using (auth.uid() = user_id);

-- ============================================================
-- Skill knowledge base (RAG / vector search via pgvector).
-- A curated library of skill "cards" embedded with Gemini
-- gemini-embedding-001 (768-dim, MRL-truncated). The backend retrieves the
-- nearest cards to a candidate's skill gaps and grounds the
-- "Skill Coach" guidance in them instead of free-form LLM output.
--
-- Populate with:  python -m scripts.ingest_kb   (from backend/)
-- ============================================================
create extension if not exists vector;

create table if not exists public.skill_kb (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  category text,
  summary text not null,
  how_to_close text not null,
  keywords text[] not null default '{}',
  -- Curated real learning resources ([{title, url, type}, ...]). Surfaced
  -- verbatim by the coach so the links are never LLM-generated.
  resources jsonb not null default '[]'::jsonb,
  -- Must match EMBED_DIM in backend/app/services/embedding_service.py.
  embedding vector(768),
  updated_at timestamptz not null default now()
);

-- Additive column for existing deployments (curated resource links).
alter table public.skill_kb add column if not exists resources jsonb not null default '[]'::jsonb;

-- Approximate nearest-neighbour index for cosine distance. HNSW gives
-- fast, high-recall search; the KB is small so this is instant either way,
-- but the index is what makes the pattern scale.
create index if not exists skill_kb_embedding_idx
  on public.skill_kb using hnsw (embedding vector_cosine_ops);

-- The KB is non-sensitive reference data. Enable RLS and allow read-only
-- access; writes go exclusively through the service role (ingest script),
-- which bypasses RLS.
alter table public.skill_kb enable row level security;

drop policy if exists "skill_kb read" on public.skill_kb;
create policy "skill_kb read" on public.skill_kb
  for select using (true);

-- KNN search RPC: returns the cards closest to a query embedding, with a
-- cosine similarity score in [0,1] (1 = identical). Called over PostgREST
-- as /rest/v1/rpc/match_skill_kb by app/services/retrieval_service.py.
--
-- Dropped first: adding `resources` to the RETURNS TABLE changes the function's
-- result type, which CREATE OR REPLACE cannot do in place.
drop function if exists public.match_skill_kb(vector(768), int, float);
create function public.match_skill_kb(
  query_embedding vector(768),
  match_count int default 4,
  min_similarity float default 0.0
)
returns table (
  slug text,
  name text,
  category text,
  summary text,
  how_to_close text,
  keywords text[],
  resources jsonb,
  similarity float
)
language sql stable
as $$
  select
    kb.slug,
    kb.name,
    kb.category,
    kb.summary,
    kb.how_to_close,
    kb.keywords,
    kb.resources,
    1 - (kb.embedding <=> query_embedding) as similarity
  from public.skill_kb kb
  where kb.embedding is not null
    and 1 - (kb.embedding <=> query_embedding) >= min_similarity
  order by kb.embedding <=> query_embedding
  limit match_count;
$$;
