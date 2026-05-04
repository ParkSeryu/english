-- Backfill table privileges for learner-created private expression saves.
-- The RLS policies constrain rows to the signed-in owner; these grants allow the
-- authenticated role to reach those policies when creating a private expression
-- and when cleaning up the parent day after a child insert failure.

grant insert, delete on public.expression_days, public.expressions to authenticated;

notify pgrst, 'reload schema';
