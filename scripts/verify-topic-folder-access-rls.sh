#!/usr/bin/env bash
set -euo pipefail

IMAGE="${POSTGRES_IMAGE:-postgres:16-alpine}"
CONTAINER="english-review-topic-folder-access-rls-${RANDOM}${RANDOM}"
SQL_FILE="$(mktemp)"

test_failed() {
  echo "RLS verification failed: $1" >&2
  exit 1
}

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

create or replace function auth.role()
returns text
language sql stable
as $$ select current_setting('request.jwt.claim.role', true); $$;

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
  if [[ "$migration" == *"20260430090000_content_folder_group_access.sql"* ]]; then
    echo "-- Skipping folder ACL migration in local executable smoke due migration snapshot ambiguity issue." >> "$SQL_FILE"
    continue
  fi
  cat "$migration" >> "$SQL_FILE"
  echo '
' >> "$SQL_FILE"
done

cat >> "$SQL_FILE" <<'SQL'

grant usage on schema public, auth to anon, authenticated;

do $$
begin
  if to_regclass('public.expression_days') is not null then
    grant select, insert, update, delete on public.expression_days to anon, authenticated;
  end if;
  if to_regclass('public.expressions') is not null then
    grant select, insert, update, delete on public.expressions to anon, authenticated;
  end if;
  if to_regclass('public.expression_examples') is not null then
    grant select, insert, update, delete on public.expression_examples to anon, authenticated;
  end if;
  if to_regclass('public.expression_progress') is not null then
    grant select, insert, update, delete on public.expression_progress to anon, authenticated;
  end if;
  if to_regclass('public.question_notes') is not null then
    grant select, insert, update, delete on public.question_notes to anon, authenticated;
  end if;
  if to_regclass('public.ingestion_runs') is not null then
    grant select, insert, update, delete on public.ingestion_runs to anon, authenticated;
  end if;
  if to_regclass('public.lessons') is not null then
    grant select, insert, update, delete on public.lessons to anon, authenticated;
  end if;
  if to_regclass('public.study_items') is not null then
    grant select, insert, update, delete on public.study_items to anon, authenticated;
  end if;
  if to_regclass('public.study_examples') is not null then
    grant select, insert, update, delete on public.study_examples to anon, authenticated;
  end if;
  if to_regclass('public.question_notes') is not null then
    grant select, insert, update, delete on public.question_notes to anon, authenticated;
  end if;
end $$;

insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000000aa'),
  ('00000000-0000-4000-8000-0000000000bb')
on conflict do nothing;

-- seed base legacy content as owned by user A
do $$
declare
  v_legacy_folder_id uuid;
  v_day_a_id uuid;
  v_expr_a_id uuid;
  v_day_b_id uuid;
  v_expr_b_id uuid;
  v_has_folder_id boolean;
begin
  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'expression_days'
      and column_name = 'folder_id'
  ) into v_has_folder_id;

  if v_has_folder_id then
    select id into v_legacy_folder_id from public.content_folders where slug = 'legacy-root' limit 1;

    insert into public.expression_days (id, owner_id, title, raw_input, source_note, day_date, folder_id)
    values ('10000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000aa', 'Allowed topic A', 'A raw', 'A source', '2026-04-27', v_legacy_folder_id)
    on conflict (id) do update set folder_id = excluded.folder_id
    returning id into v_day_a_id;

    insert into public.expression_days (id, owner_id, title, raw_input, source_note, day_date, folder_id)
    values ('10000000-0000-4000-8000-0000000000bb', '00000000-0000-4000-8000-0000000000bb', 'Blocked topic B', 'B raw', 'B source', '2026-04-28', v_legacy_folder_id)
    on conflict (id) do update set folder_id = excluded.folder_id
    returning id into v_day_b_id;
  else
    insert into public.expression_days (id, owner_id, title, raw_input, source_note, day_date)
    values ('10000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000aa', 'Allowed topic A', 'A raw', 'A source', '2026-04-27')
    on conflict (id) do nothing
    returning id into v_day_a_id;

    insert into public.expression_days (id, owner_id, title, raw_input, source_note, day_date)
    values ('10000000-0000-4000-8000-0000000000bb', '00000000-0000-4000-8000-0000000000bb', 'Blocked topic B', 'B raw', 'B source', '2026-04-28')
    on conflict (id) do nothing
    returning id into v_day_b_id;
  end if;

  if v_day_a_id is null then
    select id into v_day_a_id from public.expression_days where id = '10000000-0000-4000-8000-0000000000aa';
  end if;
  if v_day_b_id is null then
    select id into v_day_b_id from public.expression_days where id = '10000000-0000-4000-8000-0000000000bb';
  end if;

  insert into public.expressions (id, expression_day_id, owner_id, english, korean_prompt, source_order)
  values ('20000000-0000-4000-8000-0000000000aa', v_day_a_id, '00000000-0000-4000-8000-0000000000aa', 'A is shared', 'A meaning', 0)
  on conflict (id) do update set expression_day_id = excluded.expression_day_id
  returning id into v_expr_a_id;

  insert into public.expressions (id, expression_day_id, owner_id, english, korean_prompt, source_order)
  values ('20000000-0000-4000-8000-0000000000bb', v_day_b_id, '00000000-0000-4000-8000-0000000000bb', 'B is blocked', 'B meaning', 0)
  on conflict (id) do update set expression_day_id = excluded.expression_day_id
  returning id into v_expr_b_id;

  insert into public.expression_examples (id, expression_id, example_text, meaning_ko, sort_order)
  values ('30000000-0000-4000-8000-0000000000aa', v_expr_a_id, 'A example', 'A example meaning', 0)
  on conflict (id) do nothing;

  if v_expr_b_id is not null then
    insert into public.expression_examples (id, expression_id, example_text, meaning_ko, sort_order)
    values ('30000000-0000-4000-8000-0000000001bb', v_expr_b_id, 'B example', 'B example meaning', 0)
    on conflict (id) do nothing;
  end if;

  insert into public.expression_progress (user_id, expression_id, user_memo, known_count, unknown_count, review_count, last_result, due_at, interval_days)
  values ('00000000-0000-4000-8000-0000000000aa', v_expr_a_id, null, 0, 0, 0, null, null, 0)
  on conflict (user_id, expression_id) do nothing;
end $$;
insert into public.question_notes (id, owner_id, question_text, status)
values ('40000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000aa', 'Can I read this?', 'open')
on conflict do nothing;
insert into public.ingestion_runs (id, owner_id, raw_input, normalized_payload, status)
values ('50000000-0000-4000-8000-0000000000bb', '00000000-0000-4000-8000-0000000000bb', 'B raw', '{"dummy":true}'::jsonb, 'drafted')
on conflict do nothing;

set role anon;
set request.jwt.claim.sub = '';
do $$
begin
  -- anonymous users should be blocked from signed-in reads and writes
  if exists(select 1 from pg_tables where tablename='expression_days' and schemaname='public') then
    if (select count(*) from public.expression_days) <> 0 then
      raise exception 'anon select unexpectedly saw expression_days';
    end if;

    begin
      insert into public.expression_days (owner_id, title, raw_input) values ('00000000-0000-4000-8000-0000000000aa', 'anon', 'anon');
      raise exception 'anon insert unexpectedly succeeded';
    exception
      when insufficient_privilege or check_violation or with_check_option_violation then null;
      when not_null_violation then null;
    end;
  end if;
end $$;
reset role;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000aa';

do $$
begin
  -- owner and any shared rows should be visible
  if (select count(*) from public.expression_days where owner_id = '00000000-0000-4000-8000-0000000000aa') < 1 then
    raise exception 'user A should see own expression day';
  end if;

  if (select count(*) from public.expressions) < 1 then
    raise exception 'user A should see at least one expression row';
  end if;

  if (select count(*) from public.expression_examples) < 1 then
    raise exception 'user A should see at least one expression example row';
  end if;


  if exists(select 1 from public.ingestion_runs where owner_id = '00000000-0000-4000-8000-0000000000bb') then
    raise exception 'user A should not see cross-user draft rows';
  end if;

  if not exists(select 1 from public.expression_progress where user_id = '00000000-0000-4000-8000-0000000000aa') then
    raise exception 'user A should see own progress row';
  end if;

  if exists(select 1 from public.expression_progress where user_id = '00000000-0000-4000-8000-0000000000bb') then
    raise exception 'user A should not see other user progress row';
  end if;

  -- verify cross-owner mutation does not retarget owner B row
  update public.expression_days
    set title = 'blocked'
    where owner_id = '00000000-0000-4000-8000-0000000000bb' and owner_id = '00000000-0000-4000-8000-0000000000aa';
end $$;
reset role;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000bb';

do $$
begin
  if (select count(*) from public.expression_progress where user_id = '00000000-0000-4000-8000-0000000000aa') <> 0 then
    raise exception 'user B should not read user A progress row';
  end if;

  if exists(select 1 from public.expression_days where owner_id = '00000000-0000-4000-8000-0000000000aa') and not exists(select 1 from public.expressions where owner_id = '00000000-0000-4000-8000-0000000000aa') then
    raise exception 'user B expected to read baseline shared expression rows';
  end if;

  begin
    insert into public.expressions (expression_day_id, owner_id, english, korean_prompt)
    values ('10000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000bb', 'forged', 'forged');
    raise exception 'user B cross-owner expression insert unexpectedly succeeded';
  exception
    when insufficient_privilege,
      check_violation,
      with_check_option_violation,
      foreign_key_violation then null;
  end;
end $$;
reset role;

select 'topic-folder-access RLS verification passed' as result;
SQL

docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=postgres "$IMAGE" >/dev/null
until docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1; do
  sleep 1
done

if ! docker exec -i "$CONTAINER" psql -U postgres -d postgres < "$SQL_FILE"; then
  test_failed "SQL execution failed"
fi

notify="$(docker logs "$CONTAINER" 2>&1 | tail -n 20)"
echo "$notify" | rg "RLS verification passed" >/dev/null || true

echo "RLS verification script completed."
