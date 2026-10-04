-- Apply once when deploying frontend provider selection. The existing atomic
-- reserve_ai_quota RPC now uses provider-suffixed subjects and one shared
-- 'analyze' bucket for analysis + coaching. No RPC/table changes are needed.
-- Preserve all prior attempts in Gemini's pool; OpenAI starts separately.
begin;
with old_counters as (
  delete from public.ai_daily_quotas
  where subject_key !~ ':(gemini|openai)$'
  returning subject_key, day, used
)
insert into public.ai_daily_quotas (subject_key, operation, day, used)
select subject_key || ':gemini', 'analyze', day, sum(used)::integer
from old_counters
group by subject_key, day
on conflict (subject_key, operation, day) do update
set used = ai_daily_quotas.used + excluded.used;
commit;
