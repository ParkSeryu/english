-- Lesson-first LLM ingestion schema.
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  raw_input text not null,
  source_note text,
  lesson_date date,
  created_by text not null default 'llm' check (created_by in ('llm', 'user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_items (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  expression text not null,
  meaning_ko text not null,
  core_nuance text,
  structure_note text,
  grammar_note text,
  user_memo text,
  confusion_note text,
  status text not null default 'new' check (status in ('new', 'learning', 'memorized', 'confusing')),
  last_reviewed_at timestamptz,
  review_count integer not null default 0 check (review_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_examples (
  id uuid primary key default gen_random_uuid(),
  study_item_id uuid not null references public.study_items(id) on delete cascade,
  example_text text not null,
  meaning_ko text,
  source text not null default 'llm' check (source in ('llm', 'user', 'class')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  raw_input text not null,
  normalized_payload jsonb not null,
  status text not null check (status in ('drafted', 'revised', 'approved', 'inserted', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lessons_owner_date_idx
  on public.lessons (owner_id, lesson_date desc nulls last, created_at desc);

create index if not exists study_items_owner_status_reviewed_idx
  on public.study_items (owner_id, status, last_reviewed_at asc nulls first, created_at asc);

create index if not exists study_items_lesson_idx
  on public.study_items (lesson_id, created_at asc);

create index if not exists study_examples_item_sort_idx
  on public.study_examples (study_item_id, sort_order asc);

create index if not exists ingestion_runs_owner_status_idx
  on public.ingestion_runs (owner_id, status, created_at desc);

alter table public.lessons enable row level security;
alter table public.study_items enable row level security;
alter table public.study_examples enable row level security;
alter table public.ingestion_runs enable row level security;

create policy "lessons_select_own"
  on public.lessons
  for select
  to authenticated
  using (owner_id = auth.uid());

create policy "lessons_insert_own"
  on public.lessons
  for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "lessons_update_own"
  on public.lessons
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "lessons_delete_own"
  on public.lessons
  for delete
  to authenticated
  using (owner_id = auth.uid());

create policy "study_items_select_own"
  on public.study_items
  for select
  to authenticated
  using (owner_id = auth.uid());

create policy "study_items_insert_owned_lesson"
  on public.study_items
  for insert
  to authenticated
  with check (
    owner_id = auth.uid()
    and exists (
      select 1
      from public.lessons
      where lessons.id = study_items.lesson_id
        and lessons.owner_id = auth.uid()
    )
  );

create policy "study_items_update_own"
  on public.study_items
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (
      select 1
      from public.lessons
      where lessons.id = study_items.lesson_id
        and lessons.owner_id = auth.uid()
    )
  );

create policy "study_items_delete_own"
  on public.study_items
  for delete
  to authenticated
  using (owner_id = auth.uid());

create policy "study_examples_select_owned_item"
  on public.study_examples
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.study_items
      where study_items.id = study_examples.study_item_id
        and study_items.owner_id = auth.uid()
    )
  );

create policy "study_examples_insert_owned_item"
  on public.study_examples
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.study_items
      where study_items.id = study_examples.study_item_id
        and study_items.owner_id = auth.uid()
    )
  );

create policy "study_examples_update_owned_item"
  on public.study_examples
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.study_items
      where study_items.id = study_examples.study_item_id
        and study_items.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.study_items
      where study_items.id = study_examples.study_item_id
        and study_items.owner_id = auth.uid()
    )
  );

create policy "study_examples_delete_owned_item"
  on public.study_examples
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.study_items
      where study_items.id = study_examples.study_item_id
        and study_items.owner_id = auth.uid()
    )
  );

create policy "ingestion_runs_select_own"
  on public.ingestion_runs
  for select
  to authenticated
  using (owner_id = auth.uid());

create policy "ingestion_runs_insert_own"
  on public.ingestion_runs
  for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "ingestion_runs_update_own"
  on public.ingestion_runs
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "ingestion_runs_delete_own"
  on public.ingestion_runs
  for delete
  to authenticated
  using (owner_id = auth.uid());
