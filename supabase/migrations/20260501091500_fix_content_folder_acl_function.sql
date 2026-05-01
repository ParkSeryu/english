-- Disambiguate can_read_content_folder arguments from table columns.
-- Keep the existing public signature stable because PostgreSQL cannot rename
-- input parameters with create or replace function while policies depend on it.
-- Use positional references inside PL/pgSQL to avoid collisions with
-- content_folder_permissions.folder_id.

create or replace function public.can_read_content_folder(auth_user_id uuid, folder_id uuid)
returns boolean
language plpgsql
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

notify pgrst, 'reload schema';
