-- Let question notes distinguish "asked" from "answer received".
alter table public.question_notes
  drop constraint if exists question_notes_status_check;

alter table public.question_notes
  add constraint question_notes_status_check
  check (status in ('open', 'asked', 'answered'));

notify pgrst, 'reload schema';
