-- 혜택별 적용 횟수 계약으로 전환한다.
-- NULL max_apply_count는 제품상 1회로 해석하며, 과거 사용량은 합산하지 않는다.

create table if not exists public.partner_benefits (
  id uuid primary key default uuid_generate_v4(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  title text not null,
  display_order integer not null default 0,
  max_apply_count integer,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint partner_benefits_title_length_check
    check (char_length(trim(title)) between 1 and 500),
  constraint partner_benefits_display_order_check
    check (display_order >= 0),
  constraint partner_benefits_max_apply_count_check
    check (max_apply_count is null or max_apply_count between 1 and 2147483647),
  constraint partner_benefits_partner_title_unique
    unique (partner_id, title)
);

create index if not exists partner_benefits_partner_order_idx
  on public.partner_benefits(partner_id, display_order, id);

alter table public.partner_benefit_usages
  add column if not exists benefit_id uuid references public.partner_benefits(id) on delete set null;
create index if not exists partner_benefit_usages_benefit_verified_at_idx
  on public.partner_benefit_usages(benefit_id, verified_at desc);

alter table public.partner_registration_requests
  add column if not exists benefit_items jsonb not null default '[]'::jsonb;

-- 기존 문자열 혜택을 새 원장으로 옮기고, 가능한 사용 이력에는 혜택 ID를 연결한다.
insert into public.partner_benefits (partner_id, title, display_order, max_apply_count)
select p.id, item.title, item.display_order,
  case
    when to_jsonb(p) ? 'benefit_use_max_count'
      then nullif(to_jsonb(p)->>'benefit_use_max_count', '')::integer
    else null
  end
from public.partners p
cross join lateral unnest(coalesce(p.benefits, '{}'::text[])) with ordinality as item(title, display_order)
where not exists (
  select 1 from public.partner_benefits existing
  where existing.partner_id = p.id and existing.title = item.title
);

update public.partner_benefit_usages usage
set benefit_id = benefit.id
from public.partner_benefits benefit
where usage.benefit_id is null
  and usage.partner_id = benefit.partner_id
  and usage.benefit_snapshot = benefit.title;

drop function if exists public.record_partner_benefit_usage(uuid, uuid, text, integer, text, jsonb);
drop function if exists public.record_partner_benefit_usage(uuid, uuid, text, text, jsonb);

create or replace function public.record_partner_benefit_usage(
  p_partner_id uuid,
  p_member_id uuid,
  p_benefit_id uuid,
  p_use_count integer,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  usage_id uuid,
  partner_id uuid,
  member_id uuid,
  benefit_id uuid,
  benefit_snapshot text,
  use_count integer,
  verified_at timestamp with time zone,
  created_at timestamp with time zone,
  is_new boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  partner_row public.partners%rowtype;
  benefit_row public.partner_benefits%rowtype;
  usage_row public.partner_benefit_usages%rowtype;
  normalized_idempotency_key text := trim(coalesce(p_idempotency_key, ''));
  current_kst_date date := (now() at time zone 'Asia/Seoul')::date;
  inserted_count integer := 0;
begin
  if p_partner_id is null or p_member_id is null or p_benefit_id is null then
    raise exception 'partner_benefit_usage_subject_required';
  end if;
  if p_use_count is null or p_use_count < 1 then
    raise exception 'partner_benefit_usage_use_count_invalid';
  end if;
  if char_length(normalized_idempotency_key) < 16 or char_length(normalized_idempotency_key) > 128 then
    raise exception 'partner_benefit_usage_idempotency_key_invalid';
  end if;

  select * into partner_row from public.partners where id = p_partner_id;
  if not found then raise exception 'partner_benefit_usage_partner_not_found'; end if;
  if trim(coalesce(partner_row.location, '')) = '온라인' then
    raise exception 'partner_benefit_usage_online_partner';
  end if;
  if partner_row.period_start is not null and partner_row.period_start > current_kst_date then
    raise exception 'partner_benefit_usage_period_inactive';
  end if;
  if partner_row.period_end is not null and partner_row.period_end < current_kst_date then
    raise exception 'partner_benefit_usage_period_inactive';
  end if;

  select * into benefit_row
  from public.partner_benefits
  where id = p_benefit_id and partner_id = p_partner_id;
  if not found then raise exception 'partner_benefit_usage_benefit_not_found'; end if;
  if p_use_count > coalesce(benefit_row.max_apply_count, 1) then
    raise exception 'partner_benefit_usage_use_count_exceeded';
  end if;
  if not exists (select 1 from public.members where id = p_member_id) then
    raise exception 'partner_benefit_usage_member_not_found';
  end if;

  select * into usage_row from public.partner_benefit_usages
  where idempotency_key = normalized_idempotency_key for update;
  if found then
    if usage_row.partner_id <> p_partner_id or usage_row.member_id <> p_member_id
       or usage_row.benefit_id is distinct from p_benefit_id
       or usage_row.use_count <> p_use_count then
      raise exception 'partner_benefit_usage_idempotency_conflict';
    end if;
    return query select usage_row.id, usage_row.partner_id, usage_row.member_id,
      usage_row.benefit_id, usage_row.benefit_snapshot, usage_row.use_count,
      usage_row.verified_at, usage_row.created_at, false;
    return;
  end if;

  insert into public.partner_benefit_usages (
    partner_id, member_id, benefit_id, benefit_snapshot, use_count,
    idempotency_key, metadata
  ) values (
    p_partner_id, p_member_id, p_benefit_id, benefit_row.title, p_use_count,
    normalized_idempotency_key, coalesce(p_metadata, '{}'::jsonb)
  ) on conflict (idempotency_key) do nothing;
  get diagnostics inserted_count = row_count;
  select * into usage_row from public.partner_benefit_usages
  where idempotency_key = normalized_idempotency_key for update;
  if not found then raise exception 'partner_benefit_usage_record_failed'; end if;
  if usage_row.partner_id <> p_partner_id or usage_row.member_id <> p_member_id
     or usage_row.benefit_id is distinct from p_benefit_id
     or usage_row.use_count <> p_use_count then
    raise exception 'partner_benefit_usage_idempotency_conflict';
  end if;
  return query select usage_row.id, usage_row.partner_id, usage_row.member_id,
    usage_row.benefit_id, usage_row.benefit_snapshot, usage_row.use_count,
    usage_row.verified_at, usage_row.created_at, inserted_count > 0;
end;
$$;

revoke all on function public.record_partner_benefit_usage(uuid, uuid, uuid, integer, text, jsonb) from public;
revoke all on function public.record_partner_benefit_usage(uuid, uuid, uuid, integer, text, jsonb) from anon;
revoke all on function public.record_partner_benefit_usage(uuid, uuid, uuid, integer, text, jsonb) from authenticated;
grant execute on function public.record_partner_benefit_usage(uuid, uuid, uuid, integer, text, jsonb) to service_role;

drop function if exists public.update_partner_immediate_fields_with_audit(
  uuid, uuid[], text, text[], text[], text, text, integer, text, text,
  text, text, text, text, text, text, text, jsonb
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
    if benefit_id is null then
      benefit_id := uuid_generate_v4();
    end if;
    if exists (
      select 1
      from public.partner_benefits existing
      where existing.id = benefit_id
        and existing.partner_id <> partner_row.id
    ) then
      raise exception 'partner_immediate_update_benefit_forbidden';
    end if;
    requested_ids := array_append(requested_ids, benefit_id);
    benefit_titles := array_append(benefit_titles, title);
    insert into public.partner_benefits (id, partner_id, title, display_order, max_apply_count)
    values (benefit_id, partner_row.id, title, coalesce((item->>'displayOrder')::integer, 0), max_count)
    on conflict (id) do update set title = excluded.title, display_order = excluded.display_order, max_apply_count = excluded.max_apply_count, updated_at = now();
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
  update public.partners set thumbnail = p_thumbnail, images = coalesce(p_images, '{}'::text[]), tags = coalesce(p_tags, '{}'::text[]),
    benefit_action_type = p_benefit_action_type, benefit_action_link = p_benefit_action_link,
    benefits = benefit_titles, reservation_link = p_reservation_link, inquiry_link = p_inquiry_link, updated_at = now()
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

alter table public.partners drop constraint if exists partners_benefit_use_max_count_check;
alter table public.partners drop constraint if exists partners_benefit_use_max_count_action_check;
alter table public.partners drop column if exists benefit_use_max_count;
alter table public.partner_registration_requests drop constraint if exists partner_registration_requests_benefit_use_max_count_check;
alter table public.partner_registration_requests drop constraint if exists partner_registration_requests_benefit_use_max_count_action_check;
alter table public.partner_registration_requests drop column if exists benefit_use_max_count;

drop function if exists public.update_partner_immediate_fields_with_audit(
  uuid, uuid[], text, text[], text[], text, text, integer, text, text,
  text, text, text, text, text, text, jsonb
);

drop function if exists public.update_partner_immediate_fields_with_audit(
  uuid, uuid[], text, text[], text[], text, text, text, text,
  text, text, text, text, text, text, jsonb
);
