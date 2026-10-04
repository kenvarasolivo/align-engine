-- Apply before deploying the quota changes. Counters contain a user id or a
-- keyed hash of a guest IP; resumes and job text never enter this table.
create table if not exists public.ai_daily_quotas (
  subject_key text not null,
  operation text not null check (operation in ('analyze', 'coach')),
  day date not null,
  used integer not null check (used >= 0),
  primary key (subject_key, operation, day)
);
alter table public.ai_daily_quotas enable row level security;
revoke all on public.ai_daily_quotas from anon, authenticated;
grant all on public.ai_daily_quotas to service_role;

-- Preserve existing analysis usage when applying this migration.
insert into public.ai_daily_quotas (subject_key, operation, day, used)
select 'user:' || user_id::text, 'analyze', (created_at at time zone 'UTC')::date, count(*)::integer
from public.usage_log
where created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
group by user_id, (created_at at time zone 'UTC')::date
on conflict (subject_key, operation, day) do update
set used = greatest(ai_daily_quotas.used, excluded.used);

create or replace function public.reserve_ai_quota(p_subject text, p_operation text, p_limit integer)
returns integer language plpgsql security definer set search_path = public
as $$
declare reserved integer;
begin
  if p_limit < 1 or p_operation not in ('analyze', 'coach') or p_subject is null then
    raise exception 'Invalid quota reservation';
  end if;
  insert into public.ai_daily_quotas (subject_key, operation, day, used)
  values (p_subject, p_operation, (now() at time zone 'UTC')::date, 1)
  on conflict (subject_key, operation, day) do update
    set used = ai_daily_quotas.used + 1
    where ai_daily_quotas.used < p_limit
  returning used into reserved;
  return reserved;
end;
$$;
revoke all on function public.reserve_ai_quota(text, text, integer) from public, anon, authenticated;
grant execute on function public.reserve_ai_quota(text, text, integer) to service_role;
