#!/usr/bin/env bash
set -euo pipefail

IMAGE="${POSTGRES_IMAGE:-postgres:16-alpine}"
CONTAINER="english-review-rls-$RANDOM"
SQL_FILE="$(mktemp)"
cleanup() {
  rm -f "$SQL_FILE"
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

cat > "$SQL_FILE" <<'SQL'
\set ON_ERROR_STOP on
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.uid()
returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;
SQL
for migration in supabase/migrations/*.sql; do
  cat "$migration" >> "$SQL_FILE"
done
cat >> "$SQL_FILE" <<'SQL'

grant usage on schema public, auth to anon, authenticated;
grant select, insert, update, delete on public.study_cards to anon, authenticated;
grant select, insert, update, delete on public.card_examples to anon, authenticated;
grant select, insert, update, delete on public.lessons to anon, authenticated;
grant select, insert, update, delete on public.study_items to anon, authenticated;
grant select, insert, update, delete on public.study_examples to anon, authenticated;
grant select, insert, update, delete on public.ingestion_runs to anon, authenticated;

insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000000aa'),
  ('00000000-0000-4000-8000-0000000000bb')
on conflict do nothing;

-- Seed a User B lesson graph as table owner so User A cross-owner checks have a target.
insert into public.lessons (id, owner_id, title, raw_input, source_note, lesson_date)
values ('10000000-0000-4000-8000-0000000000bb', '00000000-0000-4000-8000-0000000000bb', 'User B lesson', 'B raw', 'B source', '2026-04-27')
on conflict do nothing;
insert into public.study_items (id, lesson_id, owner_id, expression, meaning_ko)
values ('20000000-0000-4000-8000-0000000000bb', '10000000-0000-4000-8000-0000000000bb', '00000000-0000-4000-8000-0000000000bb', 'B expression', 'B meaning')
on conflict do nothing;
insert into public.study_examples (id, study_item_id, example_text, sort_order)
values ('30000000-0000-4000-8000-0000000000bb', '20000000-0000-4000-8000-0000000000bb', 'B example', 0)
on conflict do nothing;
insert into public.ingestion_runs (id, owner_id, raw_input, normalized_payload, status)
values ('40000000-0000-4000-8000-0000000000bb', '00000000-0000-4000-8000-0000000000bb', 'B raw', '{"lesson":{"title":"B","raw_input":"B"},"items":[{"expression":"B","meaning_ko":"B","examples":[{"example_text":"B"}]}]}'::jsonb, 'drafted')
on conflict do nothing;

-- Unauthenticated/anon users cannot see or write lesson rows.
set role anon;
set request.jwt.claim.sub = '';
do $$
declare row_count int;
begin
  select count(*) into row_count from public.lessons;
  if row_count <> 0 then raise exception 'anon select unexpectedly saw % lessons', row_count; end if;

  begin
    insert into public.lessons (owner_id, title, raw_input)
    values ('00000000-0000-4000-8000-0000000000aa', 'anon', 'anon');
    raise exception 'anon insert unexpectedly succeeded';
  exception when insufficient_privilege or check_violation or with_check_option_violation then
    null;
  end;
end $$;
reset role;

-- User A can insert and select own lesson graph and draft run.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000aa';
insert into public.lessons (id, owner_id, title, raw_input, source_note, lesson_date)
values ('10000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000aa', 'have to / be used to', 'raw lesson', 'academy', '2026-04-27');
insert into public.study_items (id, lesson_id, owner_id, expression, meaning_ko, structure_note)
values ('20000000-0000-4000-8000-0000000000aa', '10000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000aa', 'have to ~', '~해야 한다', 'have to + 동사원형');
insert into public.study_examples (id, study_item_id, example_text, sort_order)
values ('30000000-0000-4000-8000-0000000000aa', '20000000-0000-4000-8000-0000000000aa', 'I have to study English.', 0);
insert into public.ingestion_runs (id, owner_id, raw_input, normalized_payload, status)
values ('40000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000aa', 'raw lesson', '{"lesson":{"title":"A","raw_input":"A"},"items":[{"expression":"A","meaning_ko":"A","examples":[{"example_text":"A"}]}]}'::jsonb, 'drafted');

do $$
declare row_count int;
begin
  select count(*) into row_count from public.lessons where owner_id = '00000000-0000-4000-8000-0000000000aa';
  if row_count <> 1 then raise exception 'user A own lessons expected 1, got %', row_count; end if;

  select count(*) into row_count from public.lessons where owner_id = '00000000-0000-4000-8000-0000000000bb';
  if row_count <> 0 then raise exception 'user A cross-owner lessons expected 0, got %', row_count; end if;

  select count(*) into row_count from public.study_items;
  if row_count <> 1 then raise exception 'user A should see exactly own study item, got %', row_count; end if;

  select count(*) into row_count from public.study_examples;
  if row_count <> 1 then raise exception 'user A should see exactly own study example, got %', row_count; end if;

  select count(*) into row_count from public.ingestion_runs;
  if row_count <> 1 then raise exception 'user A should see exactly own ingestion run, got %', row_count; end if;

  update public.lessons set title = 'Hacked' where id = '10000000-0000-4000-8000-0000000000bb';
  get diagnostics row_count = row_count;
  if row_count <> 0 then raise exception 'user A cross-owner lesson update affected % rows', row_count; end if;

  delete from public.lessons where id = '10000000-0000-4000-8000-0000000000bb';
  get diagnostics row_count = row_count;
  if row_count <> 0 then raise exception 'user A cross-owner lesson delete affected % rows', row_count; end if;

  begin
    insert into public.lessons (owner_id, title, raw_input)
    values ('00000000-0000-4000-8000-0000000000bb', 'cross owner', 'cross');
    raise exception 'user A cross-owner lesson insert unexpectedly succeeded';
  exception when insufficient_privilege or check_violation or with_check_option_violation then
    null;
  end;

  begin
    insert into public.study_items (lesson_id, owner_id, expression, meaning_ko)
    values ('10000000-0000-4000-8000-0000000000bb', '00000000-0000-4000-8000-0000000000aa', 'cross lesson', 'cross');
    raise exception 'user A cross-owner parent item insert unexpectedly succeeded';
  exception when insufficient_privilege or check_violation or with_check_option_violation or foreign_key_violation then
    null;
  end;

  begin
    insert into public.study_examples (study_item_id, example_text, sort_order)
    values ('20000000-0000-4000-8000-0000000000bb', 'cross parent', 0);
    raise exception 'user A cross-owner example insert unexpectedly succeeded';
  exception when insufficient_privilege or check_violation or with_check_option_violation then
    null;
  end;

  begin
    insert into public.ingestion_runs (owner_id, raw_input, normalized_payload, status)
    values ('00000000-0000-4000-8000-0000000000bb', 'cross', '{}'::jsonb, 'drafted');
    raise exception 'user A cross-owner ingestion run insert unexpectedly succeeded';
  exception when insufficient_privilege or check_violation or with_check_option_violation then
    null;
  end;
end $$;
reset role;

-- Deleting an owned lesson cascades items and examples.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000aa';
delete from public.lessons where id = '10000000-0000-4000-8000-0000000000aa';
do $$
declare row_count int;
begin
  select count(*) into row_count from public.study_items where lesson_id = '10000000-0000-4000-8000-0000000000aa';
  if row_count <> 0 then raise exception 'study item cascade expected 0, got %', row_count; end if;

  select count(*) into row_count from public.study_examples where study_item_id = '20000000-0000-4000-8000-0000000000aa';
  if row_count <> 0 then raise exception 'study example cascade expected 0, got %', row_count; end if;
end $$;
reset role;

select 'RLS verification passed' as result;
SQL

docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=postgres "$IMAGE" >/dev/null
until docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1; do
  sleep 1
done

docker exec -i "$CONTAINER" psql -U postgres -d postgres < "$SQL_FILE"
