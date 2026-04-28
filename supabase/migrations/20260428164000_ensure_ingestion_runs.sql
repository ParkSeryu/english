-- Ensure the assistant ingestion draft table exists even when legacy lesson
-- migrations were not applied to a fresh Supabase project.

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

create index if not exists ingestion_runs_owner_status_idx
  on public.ingestion_runs (owner_id, status, created_at desc);

alter table public.ingestion_runs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ingestion_runs'
      and policyname = 'ingestion_runs_select_own'
  ) then
    create policy "ingestion_runs_select_own"
      on public.ingestion_runs
      for select
      to authenticated
      using (owner_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ingestion_runs'
      and policyname = 'ingestion_runs_insert_own'
  ) then
    create policy "ingestion_runs_insert_own"
      on public.ingestion_runs
      for insert
      to authenticated
      with check (owner_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ingestion_runs'
      and policyname = 'ingestion_runs_update_own'
  ) then
    create policy "ingestion_runs_update_own"
      on public.ingestion_runs
      for update
      to authenticated
      using (owner_id = auth.uid())
      with check (owner_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ingestion_runs'
      and policyname = 'ingestion_runs_delete_own'
  ) then
    create policy "ingestion_runs_delete_own"
      on public.ingestion_runs
      for delete
      to authenticated
      using (owner_id = auth.uid());
  end if;
end $$;

grant select, insert, update, delete on public.ingestion_runs to anon, authenticated;

notify pgrst, 'reload schema';
