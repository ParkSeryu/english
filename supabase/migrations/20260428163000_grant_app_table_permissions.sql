-- Ensure Supabase Auth roles can reach app tables through the Data API.
-- RLS policies above still enforce owner scoping; these grants only expose the
-- tables to signed-in requests so the policies can be evaluated.

grant usage on schema public to anon, authenticated;

do $$
declare
  app_table text;
begin
  foreach app_table in array array[
    'study_cards',
    'card_examples',
    'lessons',
    'study_items',
    'study_examples',
    'ingestion_runs',
    'expression_days',
    'expressions',
    'expression_examples',
    'question_notes'
  ]
  loop
    if to_regclass('public.' || app_table) is not null then
      execute format('grant select, insert, update, delete on public.%I to anon, authenticated', app_table);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
