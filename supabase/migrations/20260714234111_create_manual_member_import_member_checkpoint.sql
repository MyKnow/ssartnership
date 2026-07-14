create or replace function public.checkpoint_manual_member_import_member(
  p_row_id uuid,
  p_batch_id uuid,
  p_expected_row_updated_at timestamp with time zone,
  p_display_name text,
  p_generation integer,
  p_staff_source_generation integer,
  p_campus text,
  p_mattermost_account_id uuid,
  p_email text,
  p_email_normalized text
)
returns table (
  member_id uuid,
  row_updated_at timestamp with time zone
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  import_row public.manual_member_import_rows%rowtype;
  existing_member public.members%rowtype;
  created_member_id uuid;
begin
  select * into import_row
  from public.manual_member_import_rows
  where id = p_row_id
    and batch_id = p_batch_id
    and status = 'processing'
    and updated_at = p_expected_row_updated_at
  for update;
  if not found then
    raise exception 'manual_member_import_row_lease_lost';
  end if;

  if import_row.member_id is not null then
    select * into existing_member
    from public.members
    where id = import_row.member_id
      and deleted_at is null
    for update;
    if not found then
      raise exception 'manual_member_import_checkpoint_member_missing';
    end if;

    member_id := existing_member.id;
    row_updated_at := import_row.updated_at;
    return next;
    return;
  end if;

  if p_email_normalized is not null and exists (
    select 1
    from public.members
    where email_normalized = p_email_normalized
      and deleted_at is null
  ) then
    raise exception 'existing_email';
  end if;
  if p_mattermost_account_id is not null and exists (
    select 1
    from public.members
    where mattermost_account_id = p_mattermost_account_id
      and deleted_at is null
  ) then
    raise exception 'existing_mattermost';
  end if;

  insert into public.members (
    display_name,
    generation,
    staff_source_generation,
    campus,
    mattermost_account_id,
    email,
    email_normalized,
    must_change_password
  ) values (
    p_display_name,
    p_generation,
    p_staff_source_generation,
    p_campus,
    p_mattermost_account_id,
    p_email,
    p_email_normalized,
    true
  ) returning id into created_member_id;

  update public.manual_member_import_rows
  set member_id = created_member_id
  where id = import_row.id
    and batch_id = p_batch_id
    and status = 'processing'
    and updated_at = p_expected_row_updated_at
  returning updated_at into row_updated_at;
  if not found then
    raise exception 'manual_member_import_row_lease_lost';
  end if;

  member_id := created_member_id;
  return next;
end;
$$;

revoke all on function public.checkpoint_manual_member_import_member(
  uuid,
  uuid,
  timestamp with time zone,
  text,
  integer,
  integer,
  text,
  uuid,
  text,
  text
) from public;
revoke all on function public.checkpoint_manual_member_import_member(
  uuid,
  uuid,
  timestamp with time zone,
  text,
  integer,
  integer,
  text,
  uuid,
  text,
  text
) from anon;
revoke all on function public.checkpoint_manual_member_import_member(
  uuid,
  uuid,
  timestamp with time zone,
  text,
  integer,
  integer,
  text,
  uuid,
  text,
  text
) from authenticated;
grant execute on function public.checkpoint_manual_member_import_member(
  uuid,
  uuid,
  timestamp with time zone,
  text,
  integer,
  integer,
  text,
  uuid,
  text,
  text
) to service_role;
