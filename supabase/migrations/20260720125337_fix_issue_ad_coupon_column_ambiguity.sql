-- The return column `coupon_id` is also a column on the issue/code tables.
-- Qualify every table reference so PL/pgSQL does not resolve it as the
-- function output variable.
create or replace function public.issue_ad_coupon(
  p_coupon_id uuid,
  p_member_id uuid,
  p_session_id text default null
)
returns table (
  issue_id uuid,
  coupon_id uuid,
  member_id uuid,
  assigned_code text,
  issued_at timestamp with time zone,
  usage_starts_at timestamp with time zone,
  usage_ends_at timestamp with time zone,
  title_snapshot text,
  description_snapshot text,
  discount_label_snapshot text,
  terms_snapshot text[],
  redemption_type_snapshot text,
  external_url_snapshot text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  coupon_row public.ad_coupons%rowtype;
  code_row public.ad_coupon_codes%rowtype;
  now_at timestamp with time zone := now();
  issued_today integer;
  issued_this_week integer;
  issued_this_month integer;
  member_issued_today integer;
  member_issued_this_week integer;
  member_issued_this_month integer;
  v_issue_id uuid;
begin
  select coupons.* into coupon_row
  from public.ad_coupons as coupons
  where coupons.id = p_coupon_id
  for update;

  if not found then
    raise exception 'ad_coupon_not_found';
  end if;
  if coupon_row.status <> 'active'
     or now_at < coupon_row.download_starts_at
     or now_at > coupon_row.download_ends_at then
    raise exception 'ad_coupon_not_downloadable';
  end if;

  if exists (
    select 1
    from public.ad_coupon_issues as issues
    where issues.coupon_id = coupon_row.id
      and issues.member_id = p_member_id
      and issues.status = 'issued'
  ) then
    raise exception 'ad_coupon_member_limit';
  end if;

  select count(*)::integer into issued_today
  from public.ad_coupon_issues as issues
  where issues.coupon_id = coupon_row.id
    and issues.issued_at >= date_trunc('day', now_at at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  select count(*)::integer into issued_this_week
  from public.ad_coupon_issues as issues
  where issues.coupon_id = coupon_row.id
    and issues.issued_at >= date_trunc('week', now_at at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  select count(*)::integer into issued_this_month
  from public.ad_coupon_issues as issues
  where issues.coupon_id = coupon_row.id
    and issues.issued_at >= date_trunc('month', now_at at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';

  if coupon_row.daily_issue_limit is not null and issued_today >= coupon_row.daily_issue_limit then
    raise exception 'ad_coupon_daily_limit';
  end if;
  if coupon_row.weekly_issue_limit is not null and issued_this_week >= coupon_row.weekly_issue_limit then
    raise exception 'ad_coupon_weekly_limit';
  end if;
  if coupon_row.monthly_issue_limit is not null and issued_this_month >= coupon_row.monthly_issue_limit then
    raise exception 'ad_coupon_monthly_limit';
  end if;

  select count(*)::integer into member_issued_today
  from public.ad_coupon_issues as issues
  where issues.coupon_id = coupon_row.id
    and issues.member_id = p_member_id
    and issues.issued_at >= date_trunc('day', now_at at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  select count(*)::integer into member_issued_this_week
  from public.ad_coupon_issues as issues
  where issues.coupon_id = coupon_row.id
    and issues.member_id = p_member_id
    and issues.issued_at >= date_trunc('week', now_at at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  select count(*)::integer into member_issued_this_month
  from public.ad_coupon_issues as issues
  where issues.coupon_id = coupon_row.id
    and issues.member_id = p_member_id
    and issues.issued_at >= date_trunc('month', now_at at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';

  if coupon_row.per_member_daily_issue_limit is not null
     and member_issued_today >= coupon_row.per_member_daily_issue_limit then
    raise exception 'ad_coupon_member_daily_limit';
  end if;
  if coupon_row.per_member_weekly_issue_limit is not null
     and member_issued_this_week >= coupon_row.per_member_weekly_issue_limit then
    raise exception 'ad_coupon_member_weekly_limit';
  end if;
  if coupon_row.per_member_monthly_issue_limit is not null
     and member_issued_this_month >= coupon_row.per_member_monthly_issue_limit then
    raise exception 'ad_coupon_member_monthly_limit';
  end if;

  if coupon_row.issuance_type = 'partner_code_pool' then
    select codes.* into code_row
    from public.ad_coupon_codes as codes
    where codes.coupon_id = coupon_row.id
      and codes.status = 'available'
    order by codes.created_at, codes.id
    for update skip locked
    limit 1;
    if not found then
      raise exception 'ad_coupon_code_unavailable';
    end if;
  end if;

  insert into public.ad_coupon_issues (
    coupon_id, member_id, code_id, assigned_code,
    title_snapshot, description_snapshot, discount_label_snapshot,
    terms_snapshot, redemption_type_snapshot, external_url_snapshot,
    onsite_password_hash_snapshot, onsite_password_salt_snapshot,
    usage_starts_at, usage_ends_at
  ) values (
    coupon_row.id, p_member_id, code_row.id,
    case when coupon_row.issuance_type = 'partner_code_pool' then code_row.code
         when coupon_row.redemption_type = 'code' then 'SSAFY-' || upper(substr(replace(uuid_generate_v4()::text, '-', ''), 1, 10))
         else null end,
    coupon_row.title, coupon_row.description, coupon_row.discount_label,
    coupon_row.terms, coupon_row.redemption_type, coupon_row.external_url,
    coupon_row.onsite_password_hash, coupon_row.onsite_password_salt,
    coupon_row.usage_starts_at, coupon_row.usage_ends_at
  ) returning id into v_issue_id;

  if coupon_row.issuance_type = 'partner_code_pool' then
    update public.ad_coupon_codes
    set status = 'assigned', issue_id = v_issue_id, assigned_at = now_at
    where id = code_row.id;
  end if;

  return query
  select issue.id, issue.coupon_id, issue.member_id, issue.assigned_code,
    issue.issued_at, issue.usage_starts_at, issue.usage_ends_at,
    issue.title_snapshot, issue.description_snapshot, issue.discount_label_snapshot,
    issue.terms_snapshot, issue.redemption_type_snapshot, issue.external_url_snapshot
  from public.ad_coupon_issues as issue
  where issue.id = v_issue_id;
end;
$$;

revoke all on function public.issue_ad_coupon(uuid, uuid, text) from public;
