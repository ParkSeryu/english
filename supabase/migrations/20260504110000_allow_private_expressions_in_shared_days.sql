-- Allow learners to add their own private expressions inside a shared learning topic.
-- The parent expression_day can remain shared/LLM-created, while the inserted expression
-- is visible only to the inserting learner.

do $$
begin
  drop policy if exists "expressions_select_authorized" on public.expressions;
  drop policy if exists "expression_examples_select_authorized_expression" on public.expression_examples;
  drop policy if exists "expressions_insert_private_user" on public.expressions;
  drop policy if exists "expressions_delete_private_user" on public.expressions;
end;
$$;

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
        expressions.owner_id = auth.uid()
        or (
          expressions.owner_id = expression_days.owner_id
          and (
            (expression_days.created_by = 'llm' and public.can_read_content_folder(auth.uid(), expression_days.folder_id))
            or (expression_days.created_by = 'user' and expression_days.owner_id = auth.uid())
          )
        )
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
        expressions.owner_id = auth.uid()
        or (
          expressions.owner_id = expression_days.owner_id
          and (
            (expression_days.created_by = 'llm' and public.can_read_content_folder(auth.uid(), expression_days.folder_id))
            or (expression_days.created_by = 'user' and expression_days.owner_id = auth.uid())
          )
        )
      )
  )
);

create policy "expressions_insert_private_user" on public.expressions
for insert
to authenticated
with check (
  owner_id = auth.uid()
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

create policy "expressions_delete_private_user" on public.expressions
for delete
to authenticated
using (owner_id = auth.uid());

grant insert, delete on public.expressions to authenticated;

notify pgrst, 'reload schema';
