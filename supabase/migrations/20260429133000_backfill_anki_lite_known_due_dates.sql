-- Keep remembered cards out of today's queue even when old progress rows lack due_at.
-- Unknown rows intentionally remain immediately due so they stay in the active queue until remembered.
alter table public.expression_progress
  add column if not exists due_at timestamptz,
  add column if not exists interval_days integer not null default 0 check (interval_days >= 0);

update public.expression_progress
set interval_days = case when interval_days > 0 then interval_days else 1 end,
    due_at = last_reviewed_at + ((case when interval_days > 0 then interval_days else 1 end) || ' days')::interval
where last_result = 'known'
  and last_reviewed_at is not null
  and (due_at is null or due_at <= last_reviewed_at);

update public.expression_progress
set due_at = null,
    interval_days = 0
where last_result = 'unknown';

notify pgrst, 'reload schema';
