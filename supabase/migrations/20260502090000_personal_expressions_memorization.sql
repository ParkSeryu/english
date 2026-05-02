-- Allow learners to keep private expressions and choose whether each expression appears in their own memorize queue.

alter table public.expression_progress
  add column if not exists is_memorization_enabled boolean not null default true;

create index if not exists expression_progress_user_memorization_due_idx
  on public.expression_progress (user_id, is_memorization_enabled, due_at asc nulls first, unknown_count desc, last_reviewed_at asc nulls first);

do $$
begin
  drop policy if exists "expression_days_select_authorized" on public.expression_days;
  drop policy if exists "expressions_select_authorized" on public.expressions;
  drop policy if exists "expression_examples_select_authorized_expression" on public.expression_examples;
  drop policy if exists "expression_days_insert_private_user" on public.expression_days;
  drop policy if exists "expression_days_delete_private_user" on public.expression_days;
  drop policy if exists "expressions_insert_private_user" on public.expressions;
  drop policy if exists "expressions_delete_private_user" on public.expressions;
end;
$$;

-- LLM/imported content remains visible by folder ACL. Learner-created content is only visible to its owner.
create policy "expression_days_select_authorized" on public.expression_days
for select
to authenticated
using (
  auth.uid() is not null
  and (
    (created_by = 'llm' and public.can_read_content_folder(auth.uid(), folder_id))
    or (created_by = 'user' and owner_id = auth.uid())
  )
);

create policy "expressions_select_authorized" on public.expressions
for select
to authenticated
using (
  auth.uid() is not null
  and exists (
    select 1
    from public.expression_days
    where expression_days.id = expressions.expression_day_id
      and (
        (expression_days.created_by = 'llm' and public.can_read_content_folder(auth.uid(), expression_days.folder_id))
        or (expression_days.created_by = 'user' and expression_days.owner_id = auth.uid())
      )
  )
);

create policy "expression_examples_select_authorized_expression" on public.expression_examples
for select
to authenticated
using (
  auth.uid() is not null
  and exists (
    select 1
    from public.expressions
    join public.expression_days on expression_days.id = expressions.expression_day_id
    where expressions.id = expression_examples.expression_id
      and (
        (expression_days.created_by = 'llm' and public.can_read_content_folder(auth.uid(), expression_days.folder_id))
        or (expression_days.created_by = 'user' and expression_days.owner_id = auth.uid())
      )
  )
);

-- Normal app users may create only their own private expression days/expressions.
create policy "expression_days_insert_private_user" on public.expression_days
for insert
to authenticated
with check (owner_id = auth.uid() and created_by = 'user');

create policy "expressions_insert_private_user" on public.expressions
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.expression_days
    where expression_days.id = expressions.expression_day_id
      and expression_days.owner_id = auth.uid()
      and expression_days.created_by = 'user'
  )
);

create policy "expressions_delete_private_user" on public.expressions
for delete
to authenticated
using (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.expression_days
    where expression_days.id = expressions.expression_day_id
      and expression_days.owner_id = auth.uid()
      and expression_days.created_by = 'user'
  )
);

create policy "expression_days_delete_private_user" on public.expression_days
for delete
to authenticated
using (owner_id = auth.uid() and created_by = 'user');

notify pgrst, 'reload schema';
