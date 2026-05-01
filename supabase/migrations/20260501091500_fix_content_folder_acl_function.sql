-- Disambiguate can_read_content_folder arguments from table columns.
-- The prior function used a folder_id argument name that collides with
-- content_folder_permissions.folder_id inside PL/pgSQL, causing RPC/RLS checks
-- to fail with "column reference \"folder_id\" is ambiguous".

create or replace function public.can_read_content_folder(p_auth_user_id uuid, p_folder_id uuid)
returns boolean
language plpgsql
as $$
declare
  v_can_read boolean := false;
begin
  if p_auth_user_id is null or p_folder_id is null then
    return false;
  end if;

  select exists (
    select 1
    from public.content_folders cf
    join public.content_folder_permissions p
      on p.folder_id = any (cf.path_ids)
      and p.permission = 'read'
    join public.content_groups g on g.id = p.group_id
    where cf.id = p_folder_id
      and (
        g.slug = 'all_authenticated'
        or exists (
          select 1
          from public.content_group_memberships m
          where m.group_id = g.id
            and m.user_id = p_auth_user_id
        )
      )
  ) into v_can_read;

  return v_can_read;
end;
$$;

notify pgrst, 'reload schema';
