-- Persist editor formatting as well as the plain-text copy used in history.
alter table public.analyses add column if not exists draft_document jsonb;
