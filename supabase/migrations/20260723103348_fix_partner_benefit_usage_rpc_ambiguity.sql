-- The canonical usage RPC's partner benefit lookup must qualify partner_id.
-- Otherwise PL/pgSQL resolves it against the RETURNS TABLE output variable.

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
  from public.partner_benefits benefit
  where benefit.id = p_benefit_id and benefit.partner_id = p_partner_id;
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
