-- English Review App MVP schema.
-- Apply in Supabase SQL editor or with Supabase CLI after creating a project.

create extension if not exists "pgcrypto";

create table if not exists public.study_cards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  english_text text not null,
  korean_meaning text not null,
  grammar_note text not null,
  status text not null default 'new' check (status in ('new', 'known', 'confusing')),
  last_reviewed_at timestamptz,
  review_count integer not null default 0 check (review_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.card_examples (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.study_cards(id) on delete cascade,
  example_text text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists study_cards_owner_status_reviewed_idx
  on public.study_cards (owner_id, status, last_reviewed_at asc nulls first, created_at asc);

create index if not exists card_examples_card_sort_idx
  on public.card_examples (card_id, sort_order asc);

alter table public.study_cards enable row level security;
alter table public.card_examples enable row level security;

create policy "study_cards_select_own"
  on public.study_cards
  for select
  to authenticated
  using (owner_id = auth.uid());

create policy "study_cards_insert_own"
  on public.study_cards
  for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "study_cards_update_own"
  on public.study_cards
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "study_cards_delete_own"
  on public.study_cards
  for delete
  to authenticated
  using (owner_id = auth.uid());

create policy "card_examples_select_owned_parent"
  on public.card_examples
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.study_cards
      where study_cards.id = card_examples.card_id
        and study_cards.owner_id = auth.uid()
    )
  );

create policy "card_examples_insert_owned_parent"
  on public.card_examples
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.study_cards
      where study_cards.id = card_examples.card_id
        and study_cards.owner_id = auth.uid()
    )
  );

create policy "card_examples_update_owned_parent"
  on public.card_examples
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.study_cards
      where study_cards.id = card_examples.card_id
        and study_cards.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.study_cards
      where study_cards.id = card_examples.card_id
        and study_cards.owner_id = auth.uid()
    )
  );

create policy "card_examples_delete_owned_parent"
  on public.card_examples
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.study_cards
      where study_cards.id = card_examples.card_id
        and study_cards.owner_id = auth.uid()
    )
  );
