-- Daily expression memorization schema.
create table if not exists public.expression_days (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  raw_input text not null,
  source_note text,
  day_date date,
  created_by text not null default 'llm' check (created_by in ('llm', 'user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expressions (
  id uuid primary key default gen_random_uuid(),
  expression_day_id uuid not null references public.expression_days(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  english text not null,
  korean_prompt text not null,
  nuance_note text,
  structure_note text,
  grammar_note text,
  user_memo text,
  source_order integer not null default 0,
  known_count integer not null default 0 check (known_count >= 0),
  unknown_count integer not null default 0 check (unknown_count >= 0),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expression_examples (
  id uuid primary key default gen_random_uuid(),
  expression_id uuid not null references public.expressions(id) on delete cascade,
  example_text text not null,
  meaning_ko text,
  source text not null default 'llm' check (source in ('llm', 'user', 'class')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.question_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  question_text text not null,
  status text not null default 'open' check (status in ('open', 'asked')),
  answer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expression_days_owner_date_idx on public.expression_days (owner_id, day_date desc nulls last, created_at desc);
create index if not exists expressions_owner_queue_idx on public.expressions (owner_id, unknown_count desc, last_reviewed_at asc nulls first, known_count asc, source_order asc);
create index if not exists expressions_day_order_idx on public.expressions (expression_day_id, source_order asc);
create index if not exists expression_examples_expression_sort_idx on public.expression_examples (expression_id, sort_order asc);
create index if not exists question_notes_owner_status_idx on public.question_notes (owner_id, status, updated_at desc);

alter table public.expression_days enable row level security;
alter table public.expressions enable row level security;
alter table public.expression_examples enable row level security;
alter table public.question_notes enable row level security;

create policy "expression_days_select_own" on public.expression_days for select to authenticated using (owner_id = auth.uid());
create policy "expression_days_insert_own" on public.expression_days for insert to authenticated with check (owner_id = auth.uid());
create policy "expression_days_update_own" on public.expression_days for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "expression_days_delete_own" on public.expression_days for delete to authenticated using (owner_id = auth.uid());

create policy "expressions_select_own" on public.expressions for select to authenticated using (owner_id = auth.uid());
create policy "expressions_insert_owned_day" on public.expressions for insert to authenticated with check (
  owner_id = auth.uid()
  and exists (select 1 from public.expression_days where expression_days.id = expressions.expression_day_id and expression_days.owner_id = auth.uid())
);
create policy "expressions_update_own" on public.expressions for update to authenticated using (owner_id = auth.uid()) with check (
  owner_id = auth.uid()
  and exists (select 1 from public.expression_days where expression_days.id = expressions.expression_day_id and expression_days.owner_id = auth.uid())
);
create policy "expressions_delete_own" on public.expressions for delete to authenticated using (owner_id = auth.uid());

create policy "expression_examples_select_owned_expression" on public.expression_examples for select to authenticated using (
  exists (select 1 from public.expressions where expressions.id = expression_examples.expression_id and expressions.owner_id = auth.uid())
);
create policy "expression_examples_insert_owned_expression" on public.expression_examples for insert to authenticated with check (
  exists (select 1 from public.expressions where expressions.id = expression_examples.expression_id and expressions.owner_id = auth.uid())
);
create policy "expression_examples_update_owned_expression" on public.expression_examples for update to authenticated using (
  exists (select 1 from public.expressions where expressions.id = expression_examples.expression_id and expressions.owner_id = auth.uid())
) with check (
  exists (select 1 from public.expressions where expressions.id = expression_examples.expression_id and expressions.owner_id = auth.uid())
);
create policy "expression_examples_delete_owned_expression" on public.expression_examples for delete to authenticated using (
  exists (select 1 from public.expressions where expressions.id = expression_examples.expression_id and expressions.owner_id = auth.uid())
);

create policy "question_notes_select_own" on public.question_notes for select to authenticated using (owner_id = auth.uid());
create policy "question_notes_insert_own" on public.question_notes for insert to authenticated with check (owner_id = auth.uid());
create policy "question_notes_update_own" on public.question_notes for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "question_notes_delete_own" on public.question_notes for delete to authenticated using (owner_id = auth.uid());
