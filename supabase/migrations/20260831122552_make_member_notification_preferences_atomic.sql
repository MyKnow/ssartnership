create or replace function public.update_member_push_preferences_atomic(
  input_member_id uuid,
  input_enabled boolean,
  input_announcement_enabled boolean,
  input_new_partner_enabled boolean,
  input_expiring_partner_enabled boolean,
  input_review_enabled boolean,
  input_mm_enabled boolean,
  input_marketing_enabled boolean,
  input_ip_address text,
  input_user_agent text
)
returns table (
  enabled boolean,
  announcement_enabled boolean,
  new_partner_enabled boolean,
  expiring_partner_enabled boolean,
  review_enabled boolean,
  mm_enabled boolean,
  marketing_enabled boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_preferences public.push_preferences%rowtype;
  current_marketing_enabled boolean := false;
  active_push_subscription_count bigint := 0;
  active_marketing_policy_id uuid;
  active_marketing_policy_version integer;
  agreed_at timestamp with time zone := pg_catalog.clock_timestamp();
  next_enabled boolean;
  next_announcement_enabled boolean;
  next_new_partner_enabled boolean;
  next_expiring_partner_enabled boolean;
  next_review_enabled boolean;
  next_mm_enabled boolean;
  next_marketing_enabled boolean;
begin
  if input_member_id is null then
    raise exception using
      errcode = '22023',
      message = 'member_notification_preferences_invalid';
  end if;

  perform 1
  from public.members
  where id = input_member_id
    and deleted_at is null
  for update;
  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'member_not_found';
  end if;

  select *
  into current_preferences
  from public.push_preferences
  where member_id = input_member_id
  for update;

  current_marketing_enabled :=
    coalesce(current_preferences.marketing_enabled, false);

  select pg_catalog.count(*)
  into active_push_subscription_count
  from public.push_subscriptions
  where member_id = input_member_id
    and is_active = true;

  next_enabled :=
    coalesce(input_enabled, coalesce(current_preferences.enabled, false))
    and active_push_subscription_count > 0;
  next_announcement_enabled :=
    coalesce(
      input_announcement_enabled,
      coalesce(current_preferences.announcement_enabled, true)
    );
  next_new_partner_enabled :=
    coalesce(
      input_new_partner_enabled,
      coalesce(current_preferences.new_partner_enabled, true)
    );
  next_expiring_partner_enabled :=
    coalesce(
      input_expiring_partner_enabled,
      coalesce(current_preferences.expiring_partner_enabled, true)
    );
  next_review_enabled :=
    coalesce(
      input_review_enabled,
      coalesce(current_preferences.review_enabled, true)
    );
  next_mm_enabled :=
    coalesce(
      input_mm_enabled,
      coalesce(current_preferences.mm_enabled, true)
    );
  next_marketing_enabled :=
    coalesce(
      input_marketing_enabled,
      current_marketing_enabled
    );

  if next_marketing_enabled then
    select id, version
    into active_marketing_policy_id, active_marketing_policy_version
    from public.policy_documents
    where kind = 'marketing'
      and is_active = true
    order by version desc
    limit 1;

    if active_marketing_policy_id is null
      or active_marketing_policy_version is null then
      raise exception using
        errcode = 'P0002',
        message = 'marketing_policy_not_found';
    end if;
  end if;

  insert into public.push_preferences (
    member_id,
    enabled,
    announcement_enabled,
    new_partner_enabled,
    expiring_partner_enabled,
    review_enabled,
    mm_enabled,
    marketing_enabled,
    updated_at
  )
  values (
    input_member_id,
    next_enabled,
    next_announcement_enabled,
    next_new_partner_enabled,
    next_expiring_partner_enabled,
    next_review_enabled,
    next_mm_enabled,
    next_marketing_enabled,
    agreed_at
  )
  on conflict (member_id) do update
  set
    enabled = excluded.enabled,
    announcement_enabled = excluded.announcement_enabled,
    new_partner_enabled = excluded.new_partner_enabled,
    expiring_partner_enabled = excluded.expiring_partner_enabled,
    review_enabled = excluded.review_enabled,
    mm_enabled = excluded.mm_enabled,
    marketing_enabled = excluded.marketing_enabled,
    updated_at = excluded.updated_at;

  if next_marketing_enabled then
    insert into public.member_policy_consents (
      member_id,
      policy_document_id,
      kind,
      version,
      agreed_at,
      ip_address,
      user_agent
    )
    values (
      input_member_id,
      active_marketing_policy_id,
      'marketing',
      active_marketing_policy_version,
      agreed_at,
      input_ip_address,
      input_user_agent
    )
    on conflict (member_id, policy_document_id) do update
    set
      kind = excluded.kind,
      version = excluded.version,
      agreed_at = excluded.agreed_at,
      ip_address = excluded.ip_address,
      user_agent = excluded.user_agent;
  end if;

  return query
  select
    next_enabled,
    next_announcement_enabled,
    next_new_partner_enabled,
    next_expiring_partner_enabled,
    next_review_enabled,
    next_mm_enabled,
    next_marketing_enabled;
end;
$$;

revoke all on function public.update_member_push_preferences_atomic(
  uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, text, text
) from public;
revoke all on function public.update_member_push_preferences_atomic(
  uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, text, text
) from anon;
revoke all on function public.update_member_push_preferences_atomic(
  uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, text, text
) from authenticated;
grant execute on function public.update_member_push_preferences_atomic(
  uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, text, text
) to service_role;
