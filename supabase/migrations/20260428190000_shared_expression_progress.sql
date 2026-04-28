-- Split shared expression content from per-user memorization state.
-- Existing expression owner_id columns remain as creator/import audit fields, but
-- signed-in users can read all expression content. Review counters and memos move
-- to expression_progress and are isolated per auth user.

create table if not exists public.expression_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  expression_id uuid not null references public.expressions(id) on delete cascade,
  user_memo text,
  known_count integer not null default 0 check (known_count >= 0),
  unknown_count integer not null default 0 check (unknown_count >= 0),
  review_count integer not null default 0 check (review_count >= 0),
  last_result text check (last_result in ('known', 'unknown')),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, expression_id)
);

insert into public.expression_progress (
  user_id,
  expression_id,
  user_memo,
  known_count,
  unknown_count,
  review_count,
  last_result,
  last_reviewed_at,
  created_at,
  updated_at
)
select
  owner_id,
  id,
  user_memo,
  known_count,
  unknown_count,
  review_count,
  last_result,
  last_reviewed_at,
  created_at,
  updated_at
from public.expressions
where user_memo is not null
   or known_count <> 0
   or unknown_count <> 0
   or review_count <> 0
   or last_result is not null
   or last_reviewed_at is not null
on conflict (user_id, expression_id) do nothing;

create index if not exists expression_progress_user_queue_idx
  on public.expression_progress (user_id, unknown_count desc, last_reviewed_at asc nulls first, known_count asc, updated_at asc);
create index if not exists expression_progress_expression_idx on public.expression_progress (expression_id);

alter table public.expression_progress enable row level security;

drop policy if exists "expression_days_select_own" on public.expression_days;
drop policy if exists "expression_days_insert_own" on public.expression_days;
drop policy if exists "expression_days_update_own" on public.expression_days;
drop policy if exists "expression_days_delete_own" on public.expression_days;
drop policy if exists "expressions_select_own" on public.expressions;
drop policy if exists "expressions_insert_owned_day" on public.expressions;
drop policy if exists "expressions_update_own" on public.expressions;
drop policy if exists "expressions_delete_own" on public.expressions;
drop policy if exists "expression_examples_select_owned_expression" on public.expression_examples;
drop policy if exists "expression_examples_insert_owned_expression" on public.expression_examples;
drop policy if exists "expression_examples_update_owned_expression" on public.expression_examples;
drop policy if exists "expression_examples_delete_owned_expression" on public.expression_examples;

create policy "expression_days_select_shared" on public.expression_days
  for select to authenticated using (auth.uid() is not null);
create policy "expressions_select_shared" on public.expressions
  for select to authenticated using (auth.uid() is not null);
create policy "expression_examples_select_shared_expression" on public.expression_examples
  for select to authenticated using (
    auth.uid() is not null
    and exists (select 1 from public.expressions where expressions.id = expression_examples.expression_id)
  );

create policy "expression_progress_select_own" on public.expression_progress
  for select to authenticated using (user_id = auth.uid());
create policy "expression_progress_insert_own" on public.expression_progress
  for insert to authenticated with check (user_id = auth.uid());
create policy "expression_progress_update_own" on public.expression_progress
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "expression_progress_delete_own" on public.expression_progress
  for delete to authenticated using (user_id = auth.uid());

grant select on public.expression_days, public.expressions, public.expression_examples to authenticated;
grant select, insert, update, delete on public.expression_progress to authenticated;
notify pgrst, 'reload schema';
