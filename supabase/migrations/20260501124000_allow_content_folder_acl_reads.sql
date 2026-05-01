-- Let authenticated learners read folders they are authorized to see.
-- The ACL helper must be SECURITY DEFINER because it reads ACL tables that are
-- themselves protected by RLS and have no direct learner-facing policies.

create or replace function public.can_read_content_folder(auth_user_id uuid, folder_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_can_read boolean := false;
begin
  if $1 is null or $2 is null then
    return false;
  end if;

  select exists (
    select 1
    from public.content_folders cf
    join public.content_folder_permissions p
      on p.folder_id = any (cf.path_ids)
      and p.permission = 'read'
    join public.content_groups g on g.id = p.group_id
    where cf.id = $2
      and (
        g.slug = 'all_authenticated'
        or exists (
          select 1
          from public.content_group_memberships m
          where m.group_id = g.id
            and m.user_id = $1
        )
      )
  ) into v_can_read;

  return v_can_read;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'content_folders'
      and policyname = 'content_folders_select_authorized'
  ) then
    drop policy content_folders_select_authorized on public.content_folders;
  end if;
end;
$$;

create policy "content_folders_select_authorized" on public.content_folders
for select
to authenticated
using (public.can_read_content_folder(auth.uid(), id));

notify pgrst, 'reload schema';
