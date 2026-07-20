-- Offline, always-on benefits are verified separately from coupon issuance.
alter table public.partners
  add column if not exists benefit_verification_pin_hash text,
  add column if not exists benefit_verification_pin_salt text;

alter table public.partners
  drop constraint if exists partners_benefit_verification_pin_check;
alter table public.partners
  add constraint partners_benefit_verification_pin_check
  check (
    (benefit_verification_pin_hash is null and benefit_verification_pin_salt is null)
    or (
      char_length(benefit_verification_pin_hash) > 0
      and char_length(benefit_verification_pin_salt) > 0
    )
  );

comment on column public.partners.benefit_verification_pin_hash is
  'PBKDF2 hash for offline always-on benefit verification. Never expose to clients.';
comment on column public.partners.benefit_verification_pin_salt is
  'PBKDF2 salt for offline always-on benefit verification. Never expose to clients.';

create table if not exists public.partner_benefit_usages (
  id uuid primary key default uuid_generate_v4(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  benefit_snapshot text not null,
  idempotency_key text not null unique,
  verified_at timestamp with time zone not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint partner_benefit_usages_benefit_snapshot_length_check
    check (char_length(trim(benefit_snapshot)) between 1 and 500),
  constraint partner_benefit_usages_idempotency_key_length_check
    check (char_length(trim(idempotency_key)) between 16 and 128)
);

create index if not exists partner_benefit_usages_partner_verified_at_idx
  on public.partner_benefit_usages(partner_id, verified_at desc);
create index if not exists partner_benefit_usages_member_verified_at_idx
  on public.partner_benefit_usages(member_id, verified_at desc);

alter table public.partner_benefit_usages enable row level security;
revoke all on table public.partner_benefit_usages from public;
revoke all on table public.partner_benefit_usages from anon;
revoke all on table public.partner_benefit_usages from authenticated;

create or replace function public.record_partner_benefit_usage(
  p_partner_id uuid,
  p_member_id uuid,
  p_benefit text,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  usage_id uuid,
  partner_id uuid,
  member_id uuid,
  benefit_snapshot text,
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
  usage_row public.partner_benefit_usages%rowtype;
  normalized_benefit text := trim(coalesce(p_benefit, ''));
  normalized_idempotency_key text := trim(coalesce(p_idempotency_key, ''));
  current_kst_date date := (now() at time zone 'Asia/Seoul')::date;
  inserted_count integer := 0;
begin
  if p_partner_id is null or p_member_id is null then
    raise exception 'partner_benefit_usage_subject_required';
  end if;
  if char_length(normalized_benefit) < 1 or char_length(normalized_benefit) > 500 then
    raise exception 'partner_benefit_usage_benefit_invalid';
  end if;
  if char_length(normalized_idempotency_key) < 16 or char_length(normalized_idempotency_key) > 128 then
    raise exception 'partner_benefit_usage_idempotency_key_invalid';
  end if;

  select * into partner_row
  from public.partners
  where id = p_partner_id;
  if not found then
    raise exception 'partner_benefit_usage_partner_not_found';
  end if;

  if trim(coalesce(partner_row.location, '')) = '온라인' then
    raise exception 'partner_benefit_usage_online_partner';
  end if;
  if partner_row.period_start is not null and partner_row.period_start > current_kst_date then
    raise exception 'partner_benefit_usage_period_inactive';
  end if;
  if partner_row.period_end is not null and partner_row.period_end < current_kst_date then
    raise exception 'partner_benefit_usage_period_inactive';
  end if;
  if not normalized_benefit = any(coalesce(partner_row.benefits, '{}'::text[])) then
    raise exception 'partner_benefit_usage_benefit_not_found';
  end if;
  if not exists (
    select 1 from public.members
    where id = p_member_id
  ) then
    raise exception 'partner_benefit_usage_member_not_found';
  end if;

  select * into usage_row
  from public.partner_benefit_usages
  where idempotency_key = normalized_idempotency_key
  for update;
  if found then
    if usage_row.partner_id <> p_partner_id
       or usage_row.member_id <> p_member_id
       or usage_row.benefit_snapshot <> normalized_benefit then
      raise exception 'partner_benefit_usage_idempotency_conflict';
    end if;
    return query
    select usage_row.id, usage_row.partner_id, usage_row.member_id,
      usage_row.benefit_snapshot, usage_row.verified_at, usage_row.created_at, false;
    return;
  end if;

  insert into public.partner_benefit_usages (
    partner_id, member_id, benefit_snapshot, idempotency_key, metadata
  ) values (
    p_partner_id, p_member_id, normalized_benefit, normalized_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb)
  ) on conflict (idempotency_key) do nothing;
  get diagnostics inserted_count = row_count;

  select * into usage_row
  from public.partner_benefit_usages
  where idempotency_key = normalized_idempotency_key
  for update;
  if not found then
    raise exception 'partner_benefit_usage_record_failed';
  end if;
  if usage_row.partner_id <> p_partner_id
     or usage_row.member_id <> p_member_id
     or usage_row.benefit_snapshot <> normalized_benefit then
    raise exception 'partner_benefit_usage_idempotency_conflict';
  end if;

  return query
  select usage_row.id, usage_row.partner_id, usage_row.member_id,
    usage_row.benefit_snapshot, usage_row.verified_at, usage_row.created_at,
    inserted_count > 0;
end;
$$;

revoke all on function public.record_partner_benefit_usage(uuid, uuid, text, text, jsonb) from public;
revoke all on function public.record_partner_benefit_usage(uuid, uuid, text, text, jsonb) from anon;
revoke all on function public.record_partner_benefit_usage(uuid, uuid, text, text, jsonb) from authenticated;
grant execute on function public.record_partner_benefit_usage(uuid, uuid, text, text, jsonb) to service_role;

create or replace function public.is_partner_metric_event(event_name text)
returns boolean
language sql
immutable
as $$
  select event_name = any (
    array[
      'partner_detail_view',
      'partner_card_click',
      'partner_map_click',
      'reservation_click',
      'inquiry_click',
      'partner_benefit_use'
    ]
  )
$$;

do $$
declare
  partner_id uuid;
begin
  for partner_id in
    select distinct target_id::uuid
    from public.event_logs
    where target_type = 'partner'
      and target_id is not null
      and is_partner_metric_event(event_name)
  loop
    perform public.reconcile_partner_metric_rollups(partner_id);
  end loop;
end;
$$;
