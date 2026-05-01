-- Introduce nested content folders, role/group ACL, and RLS-enforced content visibility.

create table if not exists public.content_folders (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.content_folders(id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  slug text not null unique,
  sort_order integer not null default 0,
  path_ids uuid[] not null default '{}'::uuid[],
  path_names text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists content_folders_slug_idx on public.content_folders (slug);
create index if not exists content_folders_parent_idx on public.content_folders (parent_id);
create index if not exists content_folders_path_gin_idx on public.content_folders using gin (path_ids);

create or replace function public.sync_content_folder_paths() returns trigger
language plpgsql
as $$
begin
  if NEW.name is null or length(trim(NEW.name)) = 0 then
    raise exception 'content_folder name must not be empty';
  end if;

  if NEW.parent_id is null then
    NEW.path_ids := ARRAY[NEW.id];
    NEW.path_names := ARRAY[NEW.name];
  else
    if NEW.id = ANY(COALESCE((select path_ids from public.content_folders where id = NEW.parent_id), ARRAY[]::uuid[])) then
      raise exception 'cycle detected in content_folders hierarchy';
    end if;

    select
      COALESCE(path_ids, ARRAY[]::uuid[]) || NEW.id,
      COALESCE(path_names, ARRAY[]::text[]) || NEW.name
    into NEW.path_ids, NEW.path_names
    from public.content_folders
    where id = NEW.parent_id;

    if NEW.path_ids = '{}'::uuid[] then
      raise exception 'parent content_folder not found';
    end if;
  end if;

  NEW.updated_at := now();
  return NEW;
end;
$$;

create or replace trigger content_folders_sync_path_trg
before insert or update of name, parent_id
on public.content_folders
for each row
execute function public.sync_content_folder_paths();

create table if not exists public.content_groups (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.content_group_memberships (
  group_id uuid not null references public.content_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists content_group_memberships_user_idx on public.content_group_memberships (user_id, group_id);

create table if not exists public.content_folder_permissions (
  folder_id uuid not null references public.content_folders(id) on delete cascade,
  group_id uuid not null references public.content_groups(id) on delete cascade,
  permission text not null check (permission in ('read')),
  created_at timestamptz not null default now(),
  primary key (folder_id, group_id, permission)
);

create index if not exists content_folder_permissions_folder_permission_idx on public.content_folder_permissions (folder_id, permission, group_id);

do $$
begin
  insert into public.content_groups (slug, name)
  values ('all_authenticated', '모든 인증 사용자')
  on conflict (slug) do nothing;

  alter table public.expression_days
    add column if not exists folder_id uuid references public.content_folders(id) on delete set null;

  insert into public.content_folders (name, slug, sort_order)
  values ('기존 표현', 'legacy-root', 0)
  on conflict (slug) do nothing;

  if not exists (select 1 from public.content_folder_permissions p
                 join public.content_groups g on g.id = p.group_id
                 where g.slug = 'all_authenticated'
                   and p.permission = 'read'
                   and exists (select 1 from public.content_folders f where f.id = p.folder_id and f.slug = 'legacy-root')) then
    insert into public.content_folder_permissions (folder_id, group_id, permission)
    select
      (select id from public.content_folders where slug = 'legacy-root' limit 1),
      (select id from public.content_groups where slug = 'all_authenticated' limit 1),
      'read'
    on conflict (folder_id, group_id, permission) do nothing;
  end if;

  update public.expression_days
  set folder_id = (select id from public.content_folders where slug = 'legacy-root' limit 1)
  where folder_id is null;

  alter table public.expression_days alter column folder_id set not null;
end;
$$;

create or replace function public.can_read_content_folder(auth_user_id uuid, folder_id uuid)
returns boolean
language plpgsql
as $$
declare
  can_read boolean := false;
begin
  if auth_user_id is null or folder_id is null then
    return false;
  end if;

  select exists (
    select 1
    from public.content_folders cf
    join public.content_folder_permissions p on p.folder_id = any (cf.path_ids) and p.permission = 'read'
    join public.content_groups g on g.id = p.group_id
    where cf.id = folder_id
      and (
        g.slug = 'all_authenticated'
        or exists (
          select 1
          from public.content_group_memberships m
          where m.group_id = g.id
            and m.user_id = auth_user_id
        )
      )
  ) into can_read;

  return can_read;
end;
$$;

-- Read policies now require folder ACL checks.

do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'expression_days' and policyname = 'expression_days_select_shared') then
    drop policy expression_days_select_shared on public.expression_days;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'expressions' and policyname = 'expressions_select_shared') then
    drop policy expressions_select_shared on public.expressions;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'expression_examples' and policyname = 'expression_examples_select_shared_expression') then
    drop policy expression_examples_select_shared_expression on public.expression_examples;
  end if;
end;
$$;

create policy "expression_days_select_authorized" on public.expression_days
for select
to authenticated
using (auth.uid() is not null and public.can_read_content_folder(auth.uid(), folder_id));

create policy "expressions_select_authorized" on public.expressions
for select
to authenticated
using (
  auth.uid() is not null
  and exists (
    select 1
    from public.expression_days
    where expression_days.id = expressions.expression_day_id
      and public.can_read_content_folder(auth.uid(), expression_days.folder_id)
  )
);

create policy "expression_examples_select_authorized_expression" on public.expression_examples
for select
to authenticated
using (
  auth.uid() is not null
  and exists (
    select 1
    from public.expressions
    join public.expression_days on expression_days.id = expressions.expression_day_id
    where expressions.id = expression_examples.expression_id
      and public.can_read_content_folder(auth.uid(), expression_days.folder_id)
  )
);

grant select on public.content_folders, public.content_groups, public.content_folder_permissions, public.content_group_memberships to authenticated;
grant select, insert, update, delete on public.expression_progress to authenticated;
notify pgrst, 'reload schema';
