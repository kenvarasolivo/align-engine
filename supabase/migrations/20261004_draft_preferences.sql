-- Preserve draft preferences for history reloads and regeneration.
alter table public.analyses
  add column if not exists personal_motivation text,
  add column if not exists writing_style text not null default 'neutral'
    check (writing_style in ('neutral', 'direct', 'friendly'));
