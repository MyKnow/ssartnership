-- Record the principal that performed an audited mutation. Legacy rows remain
-- NULL and the log reader renders them as historical admin actions.
alter table public.admin_audit_logs
  add column if not exists actor_type text;

alter table public.admin_audit_logs
  drop constraint if exists admin_audit_logs_actor_type_check;
alter table public.admin_audit_logs
  add constraint admin_audit_logs_actor_type_check
  check (actor_type is null or actor_type in ('admin', 'partner', 'member', 'system'));

create index if not exists admin_audit_logs_request_id_created_at_idx
  on public.admin_audit_logs(request_id, created_at desc)
  where request_id is not null;
create index if not exists admin_audit_logs_actor_type_actor_id_created_at_idx
  on public.admin_audit_logs(actor_type, actor_id, created_at desc);

create or replace function public.resolve_partner_change_request_with_audit(
  p_change_request_id uuid,
  p_admin_id text,
  p_decision text,
  p_actor_type text,
  p_actor_id text,
  p_request_id text,
  p_path text,
  p_user_agent text,
  p_ip_address text,
  p_properties jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  request_row public.partner_change_requests%rowtype;
  partner_row public.partners%rowtype;
  audit_action text;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'partner_change_request_invalid_decision';
  end if;
  if p_actor_type <> 'admin'
    or nullif(btrim(coalesce(p_actor_id, '')), '') is null
    or p_actor_id <> p_admin_id then
    raise exception 'partner_change_request_invalid_audit_principal';
  end if;
  if nullif(btrim(coalesce(p_request_id, '')), '') is null then
    raise exception 'partner_change_request_missing_request_context';
  end if;
  if jsonb_typeof(coalesce(p_properties, '{}'::jsonb)) <> 'object' then
    raise exception 'partner_change_request_invalid_audit_properties';
  end if;

  select * into request_row
  from public.partner_change_requests
  where id = p_change_request_id
  for update;
  if not found then
    raise exception 'partner_change_request_not_found';
  end if;
  if request_row.status <> 'pending' then
    raise exception 'partner_change_request_not_pending';
  end if;

  select * into partner_row
  from public.partners
  where id = request_row.partner_id
  for update;
  if not found then
    raise exception 'partner_change_request_partner_not_found';
  end if;

  if p_decision = 'approved' then
    if request_row.current_partner_name is distinct from partner_row.name
      or request_row.current_partner_location is distinct from partner_row.location
      or request_row.current_detail_description is distinct from partner_row.detail_description
      or request_row.current_map_url is distinct from partner_row.map_url
      or request_row.current_campus_slugs is distinct from partner_row.campus_slugs
      or request_row.current_conditions is distinct from partner_row.conditions
      or request_row.current_benefits is distinct from partner_row.benefits
      or request_row.current_applies_to is distinct from partner_row.applies_to
      or request_row.current_tags is distinct from partner_row.tags
      or request_row.current_thumbnail is distinct from partner_row.thumbnail
      or request_row.current_images is distinct from partner_row.images
      or request_row.current_reservation_link is distinct from partner_row.reservation_link
      or request_row.current_inquiry_link is distinct from partner_row.inquiry_link
      or request_row.current_period_start is distinct from partner_row.period_start
      or request_row.current_period_end is distinct from partner_row.period_end then
      raise exception 'partner_change_request_stale';
    end if;

    update public.partners
    set
      name = request_row.requested_partner_name,
      location = request_row.requested_partner_location,
      detail_description = request_row.requested_detail_description,
      campus_slugs = request_row.requested_campus_slugs,
      map_url = request_row.requested_map_url,
      conditions = request_row.requested_conditions,
      benefits = request_row.requested_benefits,
      applies_to = request_row.requested_applies_to,
      tags = request_row.requested_tags,
      thumbnail = request_row.requested_thumbnail,
      images = request_row.requested_images,
      reservation_link = request_row.requested_reservation_link,
      inquiry_link = request_row.requested_inquiry_link,
      period_start = request_row.requested_period_start,
      period_end = request_row.requested_period_end,
      updated_at = now()
    where id = request_row.partner_id;
  end if;

  update public.partner_change_requests
  set
    status = p_decision,
    reviewed_by_admin_id = p_admin_id,
    reviewed_at = now(),
    updated_at = now()
  where id = request_row.id;

  audit_action := case p_decision
    when 'approved' then 'partner_change_request_approve'
    else 'partner_change_request_reject'
  end;
  insert into public.admin_audit_logs (
    request_id,
    actor_type,
    actor_id,
    action,
    path,
    target_type,
    target_id,
    properties,
    user_agent,
    ip_address
  ) values (
    p_request_id,
    p_actor_type,
    p_actor_id,
    audit_action,
    p_path,
    'partner',
    request_row.partner_id::text,
    coalesce(p_properties, '{}'::jsonb),
    p_user_agent,
    p_ip_address
  );

  return request_row.partner_id;
end;
$$;

create or replace function public.update_partner_immediate_fields_with_audit(
  p_partner_id uuid,
  p_company_ids uuid[],
  p_thumbnail text,
  p_images text[],
  p_tags text[],
  p_benefit_action_type text,
  p_benefit_action_link text,
  p_reservation_link text,
  p_inquiry_link text,
  p_actor_type text,
  p_actor_id text,
  p_request_id text,
  p_path text,
  p_user_agent text,
  p_ip_address text,
  p_properties jsonb
)
returns table (
  company_id uuid,
  previous_thumbnail text,
  previous_images text[]
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  partner_row public.partners%rowtype;
begin
  if p_actor_type <> 'partner'
    or nullif(btrim(coalesce(p_actor_id, '')), '') is null then
    raise exception 'partner_immediate_update_invalid_audit_principal';
  end if;
  if nullif(btrim(coalesce(p_request_id, '')), '') is null then
    raise exception 'partner_immediate_update_missing_request_context';
  end if;
  if coalesce(array_length(p_company_ids, 1), 0) = 0 then
    raise exception 'partner_immediate_update_missing_company_scope';
  end if;
  if p_benefit_action_type not in ('certification', 'external_link', 'onsite', 'none') then
    raise exception 'partner_immediate_update_invalid_benefit_action_type';
  end if;
  if p_benefit_action_type = 'external_link'
    and nullif(btrim(coalesce(p_benefit_action_link, '')), '') is null then
    raise exception 'partner_immediate_update_missing_benefit_action_link';
  end if;
  if jsonb_typeof(coalesce(p_properties, '{}'::jsonb)) <> 'object' then
    raise exception 'partner_immediate_update_invalid_audit_properties';
  end if;

  select * into partner_row
  from public.partners
  where id = p_partner_id
  for update;
  if not found then
    raise exception 'partner_immediate_update_partner_not_found';
  end if;
  if partner_row.company_id is null
    or not (partner_row.company_id = any(p_company_ids))
    or not exists (
      select 1
      from public.partner_account_companies access
      where access.account_id::text = p_actor_id
        and access.company_id = partner_row.company_id
        and access.is_active = true
    ) then
    raise exception 'partner_immediate_update_forbidden';
  end if;
  if partner_row.thumbnail is not distinct from p_thumbnail
    and partner_row.images is not distinct from coalesce(p_images, '{}'::text[])
    and partner_row.tags is not distinct from coalesce(p_tags, '{}'::text[])
    and partner_row.benefit_action_type is not distinct from p_benefit_action_type
    and partner_row.benefit_action_link is not distinct from p_benefit_action_link
    and partner_row.reservation_link is not distinct from p_reservation_link
    and partner_row.inquiry_link is not distinct from p_inquiry_link then
    raise exception 'partner_immediate_update_no_changes';
  end if;

  update public.partners
  set
    thumbnail = p_thumbnail,
    images = coalesce(p_images, '{}'::text[]),
    tags = coalesce(p_tags, '{}'::text[]),
    benefit_action_type = p_benefit_action_type,
    benefit_action_link = p_benefit_action_link,
    reservation_link = p_reservation_link,
    inquiry_link = p_inquiry_link,
    updated_at = now()
  where id = partner_row.id;

  insert into public.admin_audit_logs (
    request_id,
    actor_type,
    actor_id,
    action,
    path,
    target_type,
    target_id,
    properties,
    user_agent,
    ip_address
  ) values (
    p_request_id,
    p_actor_type,
    p_actor_id,
    'partner_portal_immediate_update',
    p_path,
    'partner',
    partner_row.id::text,
    coalesce(p_properties, '{}'::jsonb),
    p_user_agent,
    p_ip_address
  );

  return query select partner_row.company_id, partner_row.thumbnail, partner_row.images;
end;
$$;

revoke all on function public.resolve_partner_change_request_with_audit(uuid, text, text, text, text, text, text, text, text, jsonb) from public;
revoke all on function public.resolve_partner_change_request_with_audit(uuid, text, text, text, text, text, text, text, text, jsonb) from anon;
revoke all on function public.resolve_partner_change_request_with_audit(uuid, text, text, text, text, text, text, text, text, jsonb) from authenticated;
grant execute on function public.resolve_partner_change_request_with_audit(uuid, text, text, text, text, text, text, text, text, jsonb) to service_role;

revoke all on function public.update_partner_immediate_fields_with_audit(uuid, uuid[], text, text[], text[], text, text, text, text, text, text, text, text, text, text, jsonb) from public;
revoke all on function public.update_partner_immediate_fields_with_audit(uuid, uuid[], text, text[], text[], text, text, text, text, text, text, text, text, text, text, jsonb) from anon;
revoke all on function public.update_partner_immediate_fields_with_audit(uuid, uuid[], text, text[], text[], text, text, text, text, text, text, text, text, text, text, jsonb) from authenticated;
grant execute on function public.update_partner_immediate_fields_with_audit(uuid, uuid[], text, text[], text[], text, text, text, text, text, text, text, text, text, text, jsonb) to service_role;
