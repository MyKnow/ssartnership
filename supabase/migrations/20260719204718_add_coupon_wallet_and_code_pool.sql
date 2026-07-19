alter table public.ad_coupons
  add column if not exists issuance_type text not null default 'service',
  add column if not exists download_starts_at timestamp with time zone,
  add column if not exists download_ends_at timestamp with time zone,
  add column if not exists usage_starts_at timestamp with time zone,
  add column if not exists usage_ends_at timestamp with time zone,
  add column if not exists daily_issue_limit integer,
  add column if not exists weekly_issue_limit integer,
  add column if not exists monthly_issue_limit integer;

update public.ad_coupons
set
  download_starts_at = coalesce(download_starts_at, starts_at),
  download_ends_at = coalesce(download_ends_at, ends_at),
  usage_starts_at = coalesce(usage_starts_at, starts_at),
  usage_ends_at = coalesce(usage_ends_at, ends_at)
where download_starts_at is null
   or download_ends_at is null
   or usage_starts_at is null
   or usage_ends_at is null;

alter table public.ad_coupons
  alter column download_starts_at set not null,
  alter column download_ends_at set not null,
  alter column usage_starts_at set not null,
  alter column usage_ends_at set not null;

alter table public.ad_coupons
  drop constraint if exists ad_coupons_issuance_type_check;
alter table public.ad_coupons
  add constraint ad_coupons_issuance_type_check
  check (issuance_type in ('service', 'partner_code_pool'));

alter table public.ad_coupons
  drop constraint if exists ad_coupons_download_period_check;
alter table public.ad_coupons
  add constraint ad_coupons_download_period_check
  check (download_starts_at <= download_ends_at);

alter table public.ad_coupons
  drop constraint if exists ad_coupons_usage_period_check;
alter table public.ad_coupons
  add constraint ad_coupons_usage_period_check
  check (usage_starts_at <= usage_ends_at);

alter table public.ad_coupons
  drop constraint if exists ad_coupons_issue_limit_check;
alter table public.ad_coupons
  add constraint ad_coupons_issue_limit_check
  check (
    (daily_issue_limit is null or daily_issue_limit >= 0)
    and (weekly_issue_limit is null or weekly_issue_limit >= 0)
    and (monthly_issue_limit is null or monthly_issue_limit >= 0)
  );

create table if not exists public.ad_coupon_codes (
  id uuid primary key default uuid_generate_v4(),
  coupon_id uuid not null references public.ad_coupons(id) on delete cascade,
  code text not null,
  code_hash text not null,
  status text not null default 'available',
  issue_id uuid,
  created_at timestamp with time zone not null default now(),
  assigned_at timestamp with time zone,
  used_at timestamp with time zone,
  constraint ad_coupon_codes_status_check
    check (status in ('available', 'assigned', 'used', 'expired', 'cancelled')),
  constraint ad_coupon_codes_code_check
    check (char_length(code) between 1 and 120),
  unique (coupon_id, code_hash)
);

create index if not exists ad_coupon_codes_available_idx
  on public.ad_coupon_codes(coupon_id, created_at)
  where status = 'available';

create table if not exists public.ad_coupon_issues (
  id uuid primary key default uuid_generate_v4(),
  coupon_id uuid not null references public.ad_coupons(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  code_id uuid references public.ad_coupon_codes(id) on delete set null,
  assigned_code text,
  title_snapshot text not null,
  description_snapshot text not null default '',
  discount_label_snapshot text not null default '',
  terms_snapshot text[] not null default '{}',
  redemption_type_snapshot text not null,
  external_url_snapshot text not null default '',
  usage_starts_at timestamp with time zone not null,
  usage_ends_at timestamp with time zone not null,
  status text not null default 'issued',
  issued_at timestamp with time zone not null default now(),
  used_at timestamp with time zone,
  expired_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  constraint ad_coupon_issues_status_check
    check (status in ('issued', 'used', 'expired', 'cancelled')),
  constraint ad_coupon_issues_code_check
    check (assigned_code is null or char_length(assigned_code) between 1 and 120)
);

create unique index if not exists ad_coupon_issues_active_member_idx
  on public.ad_coupon_issues(coupon_id, member_id)
  where status = 'issued';
create index if not exists ad_coupon_issues_member_created_idx
  on public.ad_coupon_issues(member_id, issued_at desc);
create index if not exists ad_coupon_issues_coupon_created_idx
  on public.ad_coupon_issues(coupon_id, issued_at desc);

alter table public.ad_coupon_codes
  drop constraint if exists ad_coupon_codes_issue_id_fkey;
alter table public.ad_coupon_codes
  add constraint ad_coupon_codes_issue_id_fkey
  foreign key (issue_id) references public.ad_coupon_issues(id) on delete set null;

alter table public.ad_coupon_redemptions
  add column if not exists issue_id uuid references public.ad_coupon_issues(id) on delete set null;
create index if not exists ad_coupon_redemptions_issue_idx
  on public.ad_coupon_redemptions(issue_id, created_at desc)
  where issue_id is not null;

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
  v_issue_id uuid;
begin
  select * into coupon_row
  from public.ad_coupons
  where id = p_coupon_id
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
    select 1 from public.ad_coupon_issues
    where coupon_id = coupon_row.id
      and member_id = p_member_id
      and status = 'issued'
  ) then
    raise exception 'ad_coupon_member_limit';
  end if;

  select count(*)::integer into issued_today
  from public.ad_coupon_issues
  where coupon_id = coupon_row.id
    and issued_at >= date_trunc('day', now_at at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  select count(*)::integer into issued_this_week
  from public.ad_coupon_issues
  where coupon_id = coupon_row.id
    and issued_at >= date_trunc('week', now_at at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  select count(*)::integer into issued_this_month
  from public.ad_coupon_issues
  where coupon_id = coupon_row.id
    and issued_at >= date_trunc('month', now_at at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';

  if coupon_row.daily_issue_limit is not null and issued_today >= coupon_row.daily_issue_limit then
    raise exception 'ad_coupon_daily_limit';
  end if;
  if coupon_row.weekly_issue_limit is not null and issued_this_week >= coupon_row.weekly_issue_limit then
    raise exception 'ad_coupon_weekly_limit';
  end if;
  if coupon_row.monthly_issue_limit is not null and issued_this_month >= coupon_row.monthly_issue_limit then
    raise exception 'ad_coupon_monthly_limit';
  end if;

  if coupon_row.issuance_type = 'partner_code_pool' then
    select * into code_row
    from public.ad_coupon_codes
    where coupon_id = coupon_row.id and status = 'available'
    order by created_at, id
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
    usage_starts_at, usage_ends_at
  ) values (
    coupon_row.id, p_member_id, code_row.id,
    case when coupon_row.issuance_type = 'partner_code_pool' then code_row.code
         when coupon_row.redemption_type = 'code' then 'SSAFY-' || upper(substr(replace(uuid_generate_v4()::text, '-', ''), 1, 10))
         else null end,
    coupon_row.title, coupon_row.description, coupon_row.discount_label,
    coupon_row.terms, coupon_row.redemption_type, coupon_row.external_url,
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
  from public.ad_coupon_issues issue
  where issue.id = v_issue_id;
end;
$$;

create or replace function public.redeem_ad_coupon_issue(
  p_issue_id uuid,
  p_member_id uuid,
  p_session_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (coupon_id uuid, issue_id uuid, assigned_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  issue_row public.ad_coupon_issues%rowtype;
  coupon_row public.ad_coupons%rowtype;
begin
  select * into issue_row from public.ad_coupon_issues
  where id = p_issue_id and member_id = p_member_id for update;
  if not found then raise exception 'ad_coupon_issue_not_found'; end if;
  if issue_row.status <> 'issued' then raise exception 'ad_coupon_issue_inactive'; end if;
  if now() < issue_row.usage_starts_at or now() > issue_row.usage_ends_at then
    raise exception 'ad_coupon_issue_expired';
  end if;
  select * into coupon_row from public.ad_coupons where id = issue_row.coupon_id for update;
  if coupon_row.status <> 'active' then raise exception 'ad_coupon_inactive'; end if;

  update public.ad_coupon_issues
  set status = 'used', used_at = now()
  where id = issue_row.id;
  if issue_row.code_id is not null then
    update public.ad_coupon_codes set status = 'used', used_at = now()
    where id = issue_row.code_id;
  end if;
  insert into public.ad_coupon_redemptions (
    issue_id, coupon_id, campaign_id, partner_id, member_id,
    session_id, redemption_code, metadata
  ) values (
    issue_row.id, coupon_row.id, coupon_row.campaign_id, coupon_row.partner_id,
    p_member_id, p_session_id, coalesce(issue_row.assigned_code, ''),
    coalesce(p_metadata, '{}'::jsonb)
  );
  return query select coupon_row.id, issue_row.id, issue_row.assigned_code;
end;
$$;

alter table public.ad_coupon_codes enable row level security;
alter table public.ad_coupon_issues enable row level security;
revoke all on table public.ad_coupon_codes from anon;
revoke all on table public.ad_coupon_codes from authenticated;
revoke all on table public.ad_coupon_issues from anon;
revoke all on table public.ad_coupon_issues from authenticated;
revoke all on function public.issue_ad_coupon(uuid, uuid, text) from public;
revoke all on function public.redeem_ad_coupon_issue(uuid, uuid, text, jsonb) from public;
