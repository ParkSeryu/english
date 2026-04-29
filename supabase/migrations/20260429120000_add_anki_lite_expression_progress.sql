-- Add two-button Anki-lite scheduling state to per-user expression progress.
alter table public.expression_progress
  add column if not exists due_at timestamptz,
  add column if not exists interval_days integer not null default 0 check (interval_days >= 0);

-- Existing reviewed cards should remain due until the learner reviews them under the new scheduler.
update public.expression_progress
set due_at = coalesce(due_at, last_reviewed_at),
    interval_days = coalesce(interval_days, 0)
where last_reviewed_at is not null;

create index if not exists expression_progress_user_due_idx
  on public.expression_progress (user_id, due_at asc nulls first, unknown_count desc, last_reviewed_at asc nulls first);

notify pgrst, 'reload schema';
