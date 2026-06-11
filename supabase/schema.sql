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
  resume_snapshot text not null,
  job_description_snapshot text not null,
  mode text not null check (mode in ('anschreiben', 'email')),
  language text not null check (language in ('en', 'de')),
  matching_skills text[] not null default '{}',
  skill_gaps text[] not null default '{}',
  generated_draft text not null,
  final_draft text,
  prompt_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);

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
