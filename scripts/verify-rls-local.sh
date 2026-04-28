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
cat supabase/migrations/20260428022608_create_study_cards.sql >> "$SQL_FILE"
cat >> "$SQL_FILE" <<'SQL'

grant usage on schema public, auth to anon, authenticated;
grant select, insert, update, delete on public.study_cards to anon, authenticated;
grant select, insert, update, delete on public.card_examples to anon, authenticated;

insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000000aa'),
  ('00000000-0000-4000-8000-0000000000bb')
on conflict do nothing;

-- Seed a User B card as table owner so User A cross-owner checks have a target.
insert into public.study_cards (id, owner_id, english_text, korean_meaning, grammar_note)
values ('10000000-0000-4000-8000-0000000000bb', '00000000-0000-4000-8000-0000000000bb', 'User B card', 'B meaning', 'B note')
on conflict do nothing;

-- Unauthenticated/anon users cannot see or write rows.
set role anon;
set request.jwt.claim.sub = '';
do $$
declare row_count int;
begin
  select count(*) into row_count from public.study_cards;
  if row_count <> 0 then raise exception 'anon select unexpectedly saw % study cards', row_count; end if;

  begin
    insert into public.study_cards (owner_id, english_text, korean_meaning, grammar_note)
    values ('00000000-0000-4000-8000-0000000000aa', 'anon', 'anon', 'anon');
    raise exception 'anon insert unexpectedly succeeded';
  exception when insufficient_privilege or check_violation or with_check_option_violation then
    null;
  end;
end $$;
reset role;

-- User A can insert and select own cards.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000aa';
insert into public.study_cards (id, owner_id, english_text, korean_meaning, grammar_note)
values ('10000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000aa', 'Could you elaborate?', '자세히 설명해 주세요', 'Polite request');
insert into public.card_examples (id, card_id, example_text, sort_order)
values ('20000000-0000-4000-8000-0000000000aa', '10000000-0000-4000-8000-0000000000aa', 'Could you elaborate on your plan?', 0);

do $$
declare row_count int;
begin
  select count(*) into row_count from public.study_cards where owner_id = '00000000-0000-4000-8000-0000000000aa';
  if row_count <> 1 then raise exception 'user A own select expected 1, got %', row_count; end if;

  select count(*) into row_count from public.study_cards where owner_id = '00000000-0000-4000-8000-0000000000bb';
  if row_count <> 0 then raise exception 'user A cross-owner select expected 0, got %', row_count; end if;

  update public.study_cards set english_text = 'Hacked' where id = '10000000-0000-4000-8000-0000000000bb';
  get diagnostics row_count = row_count;
  if row_count <> 0 then raise exception 'user A cross-owner update affected % rows', row_count; end if;

  delete from public.study_cards where id = '10000000-0000-4000-8000-0000000000bb';
  get diagnostics row_count = row_count;
  if row_count <> 0 then raise exception 'user A cross-owner delete affected % rows', row_count; end if;

  begin
    insert into public.study_cards (owner_id, english_text, korean_meaning, grammar_note)
    values ('00000000-0000-4000-8000-0000000000bb', 'cross owner', 'cross', 'cross');
    raise exception 'user A cross-owner study card insert unexpectedly succeeded';
  exception when insufficient_privilege or check_violation or with_check_option_violation then
    null;
  end;

  begin
    insert into public.card_examples (card_id, example_text, sort_order)
    values ('10000000-0000-4000-8000-0000000000bb', 'cross parent', 0);
    raise exception 'user A cross-owner example insert unexpectedly succeeded';
  exception when insufficient_privilege or check_violation or with_check_option_violation then
    null;
  end;

  select count(*) into row_count from public.card_examples;
  if row_count <> 1 then raise exception 'user A should see exactly own example, got %', row_count; end if;
end $$;
reset role;

-- Deleting an owned card cascades examples.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000aa';
delete from public.study_cards where id = '10000000-0000-4000-8000-0000000000aa';
do $$
declare row_count int;
begin
  select count(*) into row_count from public.card_examples where card_id = '10000000-0000-4000-8000-0000000000aa';
  if row_count <> 0 then raise exception 'example cascade expected 0, got %', row_count; end if;
end $$;
reset role;

select 'RLS verification passed' as result;
SQL

docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=postgres "$IMAGE" >/dev/null
until docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1; do
  sleep 1
done

docker exec -i "$CONTAINER" psql -U postgres -d postgres < "$SQL_FILE"
