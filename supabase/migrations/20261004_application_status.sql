-- Run once in the Supabase SQL editor for existing installations.
alter table public.analyses
  add column if not exists status text not null default 'draft'
  check (status in ('draft', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn'));
