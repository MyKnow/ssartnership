-- 운영 DB에 남아 있을 수 있는 문자열 기반 혜택 이용 RPC를 정규화된
-- partner_benefits 원장과 UUID 기반 계약으로 전환한다.
-- 이 migration은 이미 적용된 환경에서도 안전하게 재실행할 수 있도록 멱등적으로 작성한다.

create table if not exists public.partner_benefits (
  id uuid primary key default uuid_generate_v4(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  title text not null,
  display_order integer not null default 0,
  max_apply_count integer,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.partner_benefits
  add column if not exists display_order integer not null default 0,
  add column if not exists max_apply_count integer,
  add column if not exists created_at timestamp with time zone not null default now(),
  add column if not exists updated_at timestamp with time zone not null default now();

alter table public.partner_benefits
  drop constraint if exists partner_benefits_title_length_check,
  drop constraint if exists partner_benefits_display_order_check,
  drop constraint if exists partner_benefits_max_apply_count_check;
alter table public.partner_benefits
  add constraint partner_benefits_title_length_check
    check (char_length(trim(title)) between 1 and 500),
  add constraint partner_benefits_display_order_check
    check (display_order >= 0),
  add constraint partner_benefits_max_apply_count_check
    check (max_apply_count is null or max_apply_count between 1 and 2147483647);

create unique index if not exists partner_benefits_partner_title_unique_idx
  on public.partner_benefits(partner_id, title);
create index if not exists partner_benefits_partner_order_idx
  on public.partner_benefits(partner_id, display_order, id);

alter table public.partner_benefit_usages
  add column if not exists benefit_id uuid references public.partner_benefits(id) on delete set null,
  add column if not exists use_count integer not null default 1;
alter table public.partner_benefit_usages
  drop constraint if exists partner_benefit_usages_use_count_check;
alter table public.partner_benefit_usages
  add constraint partner_benefit_usages_use_count_check
    check (use_count between 1 and 2147483647);
create index if not exists partner_benefit_usages_benefit_verified_at_idx
  on public.partner_benefit_usages(benefit_id, verified_at desc);

-- Legacy partner benefits become the initial normalized ledger when necessary.
insert into public.partner_benefits (partner_id, title, display_order, max_apply_count)
select p.id,
       item.title,
       item.display_order - 1,
       case
         when to_jsonb(p) ? 'benefit_use_max_count'
           then nullif(to_jsonb(p)->>'benefit_use_max_count', '')::integer
         else null
       end
from public.partners p
cross join lateral unnest(coalesce(p.benefits, '{}'::text[])) with ordinality as item(title, display_order)
where not exists (
  select 1
  from public.partner_benefits existing
  where existing.partner_id = p.id
    and existing.title = item.title
);

update public.partner_benefit_usages usage
set benefit_id = benefit.id
from public.partner_benefits benefit
where usage.benefit_id is null
  and usage.partner_id = benefit.partner_id
  and usage.benefit_snapshot = benefit.title;

drop function if exists public.record_partner_benefit_usage(uuid, uuid, text, text, jsonb);
drop function if exists public.record_partner_benefit_usage(uuid, uuid, text, integer, text, jsonb);

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
  normalized_key text := trim(coalesce(p_idempotency_key, ''));
  current_kst_date date := (now() at time zone 'Asia/Seoul')::date;
  inserted_count integer := 0;
begin
  if p_partner_id is null or p_member_id is null or p_benefit_id is null then
    raise exception 'partner_benefit_usage_subject_required';
  end if;
  if p_use_count is null or p_use_count < 1 then
    raise exception 'partner_benefit_usage_use_count_invalid';
  end if;
  if char_length(normalized_key) < 16 or char_length(normalized_key) > 128 then
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

  select * into usage_row
  from public.partner_benefit_usages
  where idempotency_key = normalized_key
  for update;
  if found then
    if usage_row.partner_id <> p_partner_id
       or usage_row.member_id <> p_member_id
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
    normalized_key, coalesce(p_metadata, '{}'::jsonb)
  ) on conflict (idempotency_key) do nothing;
  get diagnostics inserted_count = row_count;

  select * into usage_row
  from public.partner_benefit_usages
  where idempotency_key = normalized_key
  for update;
  if not found then raise exception 'partner_benefit_usage_record_failed'; end if;
  if usage_row.partner_id <> p_partner_id
     or usage_row.member_id <> p_member_id
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
