-- Restrict expression deletes to learner-created private expressions only.
-- LLM/imported expressions remain shared learning content even when the current
-- user owns the parent expression_day.

do $$
begin
  drop policy if exists "expressions_delete_own" on public.expressions;
  drop policy if exists "expressions_delete_private_user" on public.expressions;
end;
$$;

create policy "expressions_delete_private_user" on public.expressions
for delete
to authenticated
using (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.expression_days
    where expression_days.id = expressions.expression_day_id
      and (
        expression_days.created_by = 'user'
        or expressions.owner_id <> expression_days.owner_id
      )
  )
);

grant delete on public.expressions to authenticated;

notify pgrst, 'reload schema';
