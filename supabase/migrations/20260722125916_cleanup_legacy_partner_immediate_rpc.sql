-- 이미 적용된 혜택별 RPC에서 남은 레거시 오버로드를 제거하고,
-- 파트너 포털의 혜택 ID가 현재 제휴처 소유인지 서버에서 재검증한다.

drop function if exists public.update_partner_immediate_fields_with_audit(
  uuid, uuid[], text, text[], text[], text, text, integer, text, text,
  text, text, text, text, text, text, text, jsonb
);

drop function if exists public.update_partner_immediate_fields_with_audit(
  uuid, uuid[], text, text[], text[], text, text, text, text,
  text, text, text, text, text, text, jsonb
);

create or replace function public.update_partner_immediate_fields_with_audit(
  p_partner_id uuid,
  p_company_ids uuid[],
  p_thumbnail text,
  p_images text[],
  p_tags text[],
  p_benefit_action_type text,
  p_benefit_action_link text,
  p_benefit_items jsonb,
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
returns table (company_id uuid, previous_thumbnail text, previous_images text[])
language plpgsql security invoker set search_path = public as $$
declare
  partner_row public.partners%rowtype;
  item jsonb;
  benefit_id uuid;
  requested_ids uuid[] := '{}';
  benefit_titles text[] := '{}';
  title text;
  raw_max text;
  max_count integer;
begin
  if p_actor_type <> 'partner' or nullif(btrim(coalesce(p_actor_id, '')), '') is null then raise exception 'partner_immediate_update_invalid_audit_principal'; end if;
  if nullif(btrim(coalesce(p_request_id, '')), '') is null then raise exception 'partner_immediate_update_missing_request_context'; end if;
  if coalesce(array_length(p_company_ids, 1), 0) = 0 then raise exception 'partner_immediate_update_missing_company_scope'; end if;
  if p_benefit_action_type not in ('certification', 'external_link', 'onsite', 'none') then raise exception 'partner_immediate_update_invalid_benefit_action_type'; end if;
  if p_benefit_action_type = 'external_link' and nullif(btrim(coalesce(p_benefit_action_link, '')), '') is null then raise exception 'partner_immediate_update_missing_benefit_action_link'; end if;
  if jsonb_typeof(coalesce(p_benefit_items, '[]'::jsonb)) <> 'array' then raise exception 'partner_immediate_update_invalid_benefit_items'; end if;
  if jsonb_typeof(coalesce(p_properties, '{}'::jsonb)) <> 'object' then raise exception 'partner_immediate_update_invalid_audit_properties'; end if;
  select * into partner_row from public.partners where id = p_partner_id for update;
  if not found then raise exception 'partner_immediate_update_partner_not_found'; end if;
  if partner_row.company_id is null or not (partner_row.company_id = any(p_company_ids)) or not exists (
    select 1 from public.partner_account_companies access
    where access.account_id::text = p_actor_id and access.company_id = partner_row.company_id and access.is_active = true
  ) then raise exception 'partner_immediate_update_forbidden'; end if;

  for item in select value from jsonb_array_elements(coalesce(p_benefit_items, '[]'::jsonb)) loop
    title := btrim(coalesce(item->>'title', ''));
    if char_length(title) < 1 or char_length(title) > 500 then raise exception 'partner_immediate_update_invalid_benefit_title'; end if;
    raw_max := nullif(btrim(coalesce(item->>'maxApplyCount', '')), '');
    max_count := case when raw_max is null then null else raw_max::integer end;
    if max_count is not null and max_count < 1 then raise exception 'partner_immediate_update_invalid_benefit_max_apply_count'; end if;
    benefit_id := nullif(item->>'id', '')::uuid;
    if benefit_id is null then benefit_id := uuid_generate_v4(); end if;
    if exists (
      select 1 from public.partner_benefits existing
      where existing.id = benefit_id and existing.partner_id <> partner_row.id
    ) then raise exception 'partner_immediate_update_benefit_forbidden'; end if;
    requested_ids := array_append(requested_ids, benefit_id);
    benefit_titles := array_append(benefit_titles, title);
    insert into public.partner_benefits (id, partner_id, title, display_order, max_apply_count)
    values (benefit_id, partner_row.id, title, coalesce((item->>'displayOrder')::integer, 0), max_count)
    on conflict (id) do update set
      title = excluded.title,
      display_order = excluded.display_order,
      max_apply_count = excluded.max_apply_count,
      updated_at = now();
  end loop;
  delete from public.partner_benefits where partner_id = partner_row.id and not (id = any(requested_ids));

  if partner_row.thumbnail is not distinct from p_thumbnail
    and partner_row.images is not distinct from coalesce(p_images, '{}'::text[])
    and partner_row.tags is not distinct from coalesce(p_tags, '{}'::text[])
    and partner_row.benefit_action_type is not distinct from p_benefit_action_type
    and partner_row.benefit_action_link is not distinct from p_benefit_action_link
    and partner_row.reservation_link is not distinct from p_reservation_link
    and partner_row.inquiry_link is not distinct from p_inquiry_link
    and partner_row.benefits is not distinct from benefit_titles then raise exception 'partner_immediate_update_no_changes'; end if;
  update public.partners set
    thumbnail = p_thumbnail,
    images = coalesce(p_images, '{}'::text[]),
    tags = coalesce(p_tags, '{}'::text[]),
    benefit_action_type = p_benefit_action_type,
    benefit_action_link = p_benefit_action_link,
    benefits = benefit_titles,
    reservation_link = p_reservation_link,
    inquiry_link = p_inquiry_link,
    updated_at = now()
  where id = partner_row.id;
  insert into public.admin_audit_logs (request_id, actor_type, actor_id, action, path, target_type, target_id, properties, user_agent, ip_address)
  values (p_request_id, p_actor_type, p_actor_id, 'partner_portal_immediate_update', p_path, 'partner', partner_row.id::text, coalesce(p_properties, '{}'::jsonb), p_user_agent, p_ip_address);
  return query select partner_row.company_id, partner_row.thumbnail, partner_row.images;
end;
$$;

revoke all on function public.update_partner_immediate_fields_with_audit(uuid, uuid[], text, text[], text[], text, text, jsonb, text, text, text, text, text, text, text, text, jsonb) from public;
revoke all on function public.update_partner_immediate_fields_with_audit(uuid, uuid[], text, text[], text[], text, text, jsonb, text, text, text, text, text, text, text, text, jsonb) from anon;
revoke all on function public.update_partner_immediate_fields_with_audit(uuid, uuid[], text, text[], text[], text, text, jsonb, text, text, text, text, text, text, text, text, jsonb) from authenticated;
grant execute on function public.update_partner_immediate_fields_with_audit(uuid, uuid[], text, text[], text[], text, text, jsonb, text, text, text, text, text, text, text, text, jsonb) to service_role;
