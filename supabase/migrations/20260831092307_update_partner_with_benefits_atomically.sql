-- Persist the admin partner row and its ordered benefit items in one database
-- transaction. Any validation, constraint, or insert failure rolls the complete
-- mutation back before the server action performs media/company compensation.
create or replace function public.update_partner_with_benefits_atomic(
  p_partner_id uuid,
  p_expected_updated_at timestamp with time zone,
  p_partner jsonb,
  p_benefits jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  partner_payload public.partners%rowtype;
  updated_partner_id uuid;
  required_key text;
begin
  if p_partner_id is null
    or p_partner is null
    or pg_catalog.jsonb_typeof(p_partner) <> 'object'
    or p_benefits is null
    or pg_catalog.jsonb_typeof(p_benefits) <> 'array'
    or pg_catalog.jsonb_array_length(p_benefits) > 100 then
    raise exception using
      errcode = '22023',
      message = 'partner_update_payload_invalid';
  end if;

  foreach required_key in array array[
    'company_id',
    'name',
    'category_id',
    'location',
    'detail_description',
    'campus_slugs',
    'map_url',
    'benefit_action_type',
    'benefit_action_link',
    'benefit_verification_pin_hash',
    'benefit_verification_pin_salt',
    'reservation_link',
    'inquiry_link',
    'period_start',
    'period_end',
    'conditions',
    'benefits',
    'applies_to',
    'thumbnail',
    'images',
    'tags',
    'visibility',
    'benefit_visibility'
  ]
  loop
    if not p_partner ? required_key then
      raise exception using
        errcode = '22023',
        message = 'partner_update_payload_invalid';
    end if;
  end loop;

  partner_payload := pg_catalog.jsonb_populate_record(
    null::public.partners,
    p_partner
  );

  update public.partners
  set company_id = partner_payload.company_id,
      name = partner_payload.name,
      category_id = partner_payload.category_id,
      location = partner_payload.location,
      detail_description = partner_payload.detail_description,
      campus_slugs = partner_payload.campus_slugs,
      map_url = partner_payload.map_url,
      benefit_action_type = partner_payload.benefit_action_type,
      benefit_action_link = partner_payload.benefit_action_link,
      benefit_verification_pin_hash = partner_payload.benefit_verification_pin_hash,
      benefit_verification_pin_salt = partner_payload.benefit_verification_pin_salt,
      reservation_link = partner_payload.reservation_link,
      inquiry_link = partner_payload.inquiry_link,
      period_start = partner_payload.period_start,
      period_end = partner_payload.period_end,
      conditions = partner_payload.conditions,
      benefits = partner_payload.benefits,
      applies_to = partner_payload.applies_to,
      thumbnail = partner_payload.thumbnail,
      images = partner_payload.images,
      tags = partner_payload.tags,
      visibility = partner_payload.visibility,
      benefit_visibility = partner_payload.benefit_visibility,
      updated_at = pg_catalog.now()
  where id = p_partner_id
    and updated_at is not distinct from p_expected_updated_at
  returning id into updated_partner_id;

  if updated_partner_id is null then
    if exists (
      select 1
      from public.partners
      where id = p_partner_id
    ) then
      raise exception using
        errcode = '40001',
        message = 'partner_update_stale_conflict';
    end if;
    raise exception using
      errcode = 'P0002',
      message = 'partner_update_target_not_found';
  end if;

  delete from public.partner_benefits
  where partner_id = p_partner_id;

  insert into public.partner_benefits (
    partner_id,
    title,
    max_apply_count,
    display_order
  )
  select
    p_partner_id,
    benefit.title,
    benefit.max_apply_count,
    benefit.display_order
  from pg_catalog.jsonb_to_recordset(p_benefits) as benefit(
    title text,
    max_apply_count integer,
    display_order integer
  )
  order by benefit.display_order;

  return updated_partner_id;
end;
$$;

revoke all on function public.update_partner_with_benefits_atomic(uuid, timestamp with time zone, jsonb, jsonb) from public;
revoke all on function public.update_partner_with_benefits_atomic(uuid, timestamp with time zone, jsonb, jsonb) from anon;
revoke all on function public.update_partner_with_benefits_atomic(uuid, timestamp with time zone, jsonb, jsonb) from authenticated;
grant execute on function public.update_partner_with_benefits_atomic(uuid, timestamp with time zone, jsonb, jsonb) to service_role;
